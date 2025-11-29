// main.ts
import "dotenv/config";

import { Actor, log } from "apify";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface Input {
  question: string;
  searchQueries?: string[];
  maxResults?: number;
  maxSearchResultsPerQuery?: number;
  useApifyScrapers?: boolean;
  geminiModel?: string;
  geminiApiKey?: string;
}

interface ResearchItem {
  name: string;
  website?: string;
  country?: string;
  description?: string;
  extra?: Record<string, unknown>;
  sourceUrl: string;
}

(async () => {
  await Actor.init();

  const input = (await Actor.getInput<Input>()) ?? null;
  if (!input) throw new Error("No input provided.");

  const {
    question,
    searchQueries,
    maxResults = 10,
    maxSearchResultsPerQuery = 10,
    useApifyScrapers = true,
    geminiModel = "gemini-2.5-flash-lite",
    geminiApiKey: geminiApiKeyFromInput,
  } = input;

  // 1) Resolve Gemini API key
  let geminiApiKey = geminiApiKeyFromInput || process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error(
      "Gemini API key not provided. Set GEMINI_API_KEY env or input.geminiApiKey.",
    );
  }

  log.info("Starting Apify + Gemini web research Actor...");
  log.info(`Question: ${question}`);
  log.info(`Using Apify scrapers: ${useApifyScrapers}`);
  log.info(`Gemini model: ${geminiModel}`);

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: geminiModel });

  let items: ResearchItem[] = [];

  if (useApifyScrapers) {
    // 2) Discover URLs via Google Search Results Scraper Actor
    const searchRun = await Actor.call("apify/google-search-scraper", {
      queries:
        searchQueries && searchQueries.length > 0
          ? searchQueries.join("\n")
          : question,
      maxPagesPerQuery: 1,
      resultsPerPage: maxSearchResultsPerQuery,
      countryCode: "us",
      languageCode: "en",
    });

    if (!searchRun) {
      throw new Error("Search actor run did not start.");
    }

    const searchDatasetId = searchRun.defaultDatasetId;
    log.info(`Google search dataset id: ${searchDatasetId}`);

    const client = Actor.newClient();
    const datasetClient = client.dataset(searchDatasetId);

    const { items: searchItems } = await datasetClient.listItems();

    const urls: string[] = [];
    for (const s of searchItems as any[]) {
      const organic = s.organicResults ?? [];
      for (const r of organic) {
        if (r.url && urls.length < maxResults * 3) {
          urls.push(r.url);
        }
      }
    }

    log.info(`Collected ${urls.length} URLs from search.`);

    // 3) Crawl content via Website Content Crawler Actor
    const crawlerRun = await Actor.call("apify/website-content-crawler", {
      startUrls: urls.map((url) => ({ url })),
      maxCrawlDepth: 0,
      maxCrawlPages: urls.length,
    });

    if (!crawlerRun) {
      throw new Error("Website content crawler run did not start.");
    }

    const crawlerDatasetId = crawlerRun.defaultDatasetId;
    log.info(`Crawler dataset id: ${crawlerDatasetId}`);

    const crawlerDatasetClient = client.dataset(crawlerDatasetId);
    const { items: pages } = await crawlerDatasetClient.listItems();

    // 4) Extract structured items with Gemini
    for (const page of pages as any[]) {
      const url = page.url ?? "";
      const markdown = page.markdown ?? page.text ?? "";

      if (!url || !markdown) continue;

      const prompt = `
You are an AI research assistant working with real web content.

Question: ${question}

Here is the content of a web page in Markdown:

${markdown.slice(0, 8000)}

From this page, extract at most ONE relevant tool / company / resource that helps answer the question.

Return STRICT JSON ONLY in the following TypeScript shape:

interface ResearchItem {
  name: string;
  website?: string;
  country?: string;
  description?: string;
  extra?: Record<string, unknown>;
  sourceUrl: string;
}

If the page is not relevant, return null.
`;

      try {
        const response = await model.generateContent(prompt);
        const text = response.response.text().trim();

        let parsed: ResearchItem | null = null;
        try {
          // Remove markdown code blocks if present
          const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
          parsed = JSON.parse(cleanText);
        } catch {
          log.warning(
            `Could not parse JSON from page ${url}, raw response was: ${text.slice(
              0,
              200,
            )}...`,
          );
        }

        if (parsed && parsed.name) {
          parsed.sourceUrl = parsed.sourceUrl || url;
          items.push(parsed);
          log.info(`Extracted: ${parsed.name} from ${url}`);
        }

        if (items.length >= maxResults) break;
      } catch (error) {
        log.error(`Error processing page ${url}: ${error}`);
      }
    }
  } else {
    // Fallback: LLM-only mode (no web scraping)
    log.info("Running in LLM-only mode (no web scraping).");

    const llmPrompt = `
You are an AI research assistant.

Question: ${question}

Research and provide ${maxResults} relevant tools, companies, or resources that answer this question.

Return STRICT JSON ONLY as an array of ResearchItem objects:

interface ResearchItem {
  name: string;
  website?: string;
  country?: string;
  description?: string;
  extra?: Record<string, unknown>;
  sourceUrl: string;
}

Return exactly ${maxResults} items based on your knowledge.
`;

    try {
      const response = await model.generateContent(llmPrompt);
      const text = response.response.text().trim();
      const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
      items = JSON.parse(cleanText);
    } catch (error) {
      log.error(`Error in LLM-only mode: ${error}`);
    }
  }

  log.info(`Got ${items.length} structured items.`);

  // 5) Save items into dataset
  const dataset = await Actor.openDataset();
  if (items.length > 0) {
    await dataset.pushData(items);
  }
  const datasetId = dataset.id;

  // 6) Summary report with Gemini
  const summaryPrompt = `
You are an AI research analyst.

Question:
${question}

Here are JSON items representing tools/resources:

${JSON.stringify(items, null, 2)}

Write a detailed Markdown report with:

- High-level summary
- Comparison table of tools (name, website, key features, best use-case)
- Bullet points for pros/cons
- Sections for "Best for beginners", "Best for enterprise", etc.
- A final recommendation section.

Use markdown headings (##, ###) and bullet lists.
Include the sourceUrl for each tool as a markdown link.
`;

  const summaryResponse = await model.generateContent(summaryPrompt);
  const reportMarkdown = summaryResponse.response.text();

  const reportKey = "REPORT.md";
  const kvStore = await Actor.openKeyValueStore();
  await kvStore.setValue(reportKey, reportMarkdown, {
    contentType: "text/markdown",
  });

  log.info(`Saved markdown report as key: ${reportKey}`);

  await Actor.setValue("OUTPUT", {
    question,
    useApifyScrapers,
    datasetId,
    reportKey,
    itemCount: items.length,
    geminiModel,
  });

  log.info("Actor finished successfully.");
  await Actor.exit();
})();
