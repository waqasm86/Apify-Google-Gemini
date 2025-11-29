# Project Overview

This Actor automates web research by combining Apify Store scrapers with Google Gemini. The flow mirrors the implementation in [`main.ts`](../main.ts):

1. **Input parsing & API key resolution:** Validates `question` and loads the Gemini API key from input or `GEMINI_API_KEY`.
2. **Discovery (optional):** If `useApifyScrapers` is true, the Google Search Scraper runs for each query (or the `question`), returning organic URLs.
3. **Crawling:** The Website Content Crawler fetches each URL (depth 0) and stores markdown/text in a dataset.
4. **Item extraction:** Each crawled page is summarized into at most one `ResearchItem` using Gemini, capped by `maxResults`.
5. **Reporting:** Gemini generates a Markdown comparison report that links back to each `sourceUrl`.
6. **Persistence:**
   - Dataset: `ResearchItem` objects.
   - Key-value store: `REPORT.md` and `OUTPUT.json` metadata (dataset id, report key, item count, model name).

## Data model

```ts
interface ResearchItem {
  name: string;
  website?: string;
  country?: string;
  description?: string;
  extra?: Record<string, unknown>;
  sourceUrl: string;
}
```

## Modes

- **Scraper + LLM mode (default):** Uses Apify Store Actors for real web content and then summarizes with Gemini.
- **LLM-only mode:** Skip scraping by setting `useApifyScrapers` to `false`; Gemini fabricates items directly from the question.

## Operational notes

- Prompts truncate page content to roughly the first 8k characters to stay within model limits.
- Search results are over-collected (up to `maxResults * 3`) to give the crawler enough candidates before deduplication.
- Logs rely on the Apify SDK logger, so they appear in the Actor run console on the Apify platform.
- `REPORT.md` is always written even if no items are extracted, so runs can be inspected from the key-value store.
- If Gemini returns non-JSON output, the Actor logs the raw response (truncated) to aid debugging.
