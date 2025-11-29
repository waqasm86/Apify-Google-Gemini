# Apify + Gemini Web Research Actor

[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Apify](https://img.shields.io/badge/Apify-Actors-0A2339)](https://apify.com/actors)

An Apify Actor that performs **end-to-end web research** for a given question. The Actor discovers relevant sources with Apify Store scrapers, crawls the pages, normalizes the findings, and asks **Google Gemini** to produce a rich Markdown report.

Originally built as a portfolio project for the **Applied AI Engineer** role at [Apify](https://apify.com/).

## Quick Start

### Apify Cloud

1. Open the Actor in Apify Console and click **Run**.
2. Paste your research question into the input (or upload `input.json`).
3. Set the **GEMINI_API_KEY** secret (or provide `geminiApiKey` in the input).
4. Start the run and read the generated `REPORT.md` from the run's key-value store.

### Local Run
```bash
npm install
export GEMINI_API_KEY="your_key"
apify run -p input.json
```

## What it does

1. Uses Apify's **Google Search Scraper** to find relevant pages (or uses your custom queries).
2. Uses Apify's **Website Content Crawler** to fetch page content.
3. Normalizes the results into structured items (name, website, description, country, extra metadata, sourceUrl).
4. Calls **Google Gemini** to generate a research report that compares the items and provides recommendations.
5. Saves the Markdown report to the default key-value store and pushes the structured items to the default dataset.

## Tech stack

- **Runtime:** Node.js + TypeScript (`strict` mode)
- **Platform:** [Apify Actors](https://apify.com/docs)
- **Scraping:**
  - [`apify/google-search-scraper`](https://apify.com/apify/google-search-scraper)
  - [`apify/website-content-crawler`](https://apify.com/apify/website-content-crawler)
- **LLM:** Google Gemini via `@google/generative-ai`

## Inputs

The Actor input is defined in [`INPUT_SCHEMA.json`](INPUT_SCHEMA.json). Key fields:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `question` | string (required) | – | The research question to answer. |
| `searchQueries` | string[] | `[question]` | Optional custom queries for the search scraper. |
| `maxResults` | number | `10` | Maximum number of structured results to keep. |
| `maxSearchResultsPerQuery` | number | `10` | Google Search results per query (capped by the search Actor). |
| `useApifyScrapers` | boolean | `true` | If `false`, skips scraping and uses Gemini only. |
| `geminiModel` | string | `gemini-2.5-flash-lite` | Gemini model name. |
| `geminiApiKey` | string | – | Gemini API key (or set `GEMINI_API_KEY` env var). |

Example `input.json`:

```json
{
  "question": "Find 10 AI code assistant tools and summarize them.",
  "maxResults": 10,
  "geminiModel": "gemini-2.5-flash-lite",
  "geminiApiKey": "YOUR_GEMINI_API_KEY_HERE"
}
```

## Outputs

- **Dataset items:** Structured `ResearchItem` objects with `name`, `website`, `country`, `description`, `extra`, and `sourceUrl` fields.
- **`REPORT.md`:** A Markdown report stored in the default key-value store.
- **`OUTPUT.json`:** Metadata stored in the default key-value store with `question`, `useApifyScrapers`, `datasetId`, `reportKey`, `itemCount`, and `geminiModel`.

### Where to find results on Apify

- **Datasets tab:** The normalized `ResearchItem` list.
- **Storage / Key-value store:**
  - `REPORT.md` — human-friendly Markdown report.
  - `OUTPUT.json` — run summary with dataset id and counts.

## Running locally

Prerequisites:

- Node.js 18+ (Apify cloud currently runs Node 18).
- A Google Gemini API key available as `GEMINI_API_KEY` or provided via Actor input.

Pass input via the Apify CLI or `APIFY_INPUT` environment variable. Example using `input.json`:

```bash
APIFY_INPUT=$(cat input.json) npm run dev
```

## Deploying on Apify

1. Install the [Apify CLI](https://docs.apify.com/cli/quick-start).
2. Log in with `apify login` and initialize the Actor if needed.
3. Deploy with `apify push`. The CLI will build the project and upload it to your Apify account.
4. In the Apify Console, set the `GEMINI_API_KEY` secret (or provide `geminiApiKey` in input) and run the Actor with your desired `input.json`.

## How it works (under the hood)

- Actor initialization and input validation happen in [`main.ts`](main.ts).
- When `useApifyScrapers` is true:
  1. The Google Search Scraper collects candidate URLs.
  2. The Website Content Crawler downloads page content.
  3. Each page is summarized into a `ResearchItem` via Gemini, capped at `maxResults` items.
- In LLM-only mode, Gemini fabricates the `ResearchItem` list directly from the question.
- Gemini then produces a Markdown report summarizing and comparing the items. The report is saved as `REPORT.md`, and the structured data is pushed to the dataset.

## Development notes

- TypeScript compilation targets ES2020 and uses CommonJS modules (see [`tsconfig.json`](tsconfig.json)).
- The project avoids wrapping imports in try/catch to keep module loading predictable.
- Logging is handled via the Apify SDK logger for consistent Actor run output.
- Build with `npm run build`; run TypeScript directly with `npm run dev`; run the compiled bundle with `npm start`.

## Troubleshooting

- **Missing Gemini API key:** set `GEMINI_API_KEY` in the Actor secrets or pass `geminiApiKey` in the input.
- **Empty results:** Increase `maxSearchResultsPerQuery` or provide custom `searchQueries` relevant to your topic.
- **Large pages:** The crawler content is truncated to the first ~8000 characters before being sent to Gemini to control prompt size.
- **Low relevance:** Add explicit `searchQueries` instead of relying on the question alone, or reduce `maxResults` to keep only the strongest findings.
- **Long Gemini responses:** Responses are parsed as JSON; if parsing fails, check logs for the raw response and trim conversational text.

## License

MIT
