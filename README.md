# Apify + Gemini Web Research Actor

An Apify Actor that performs **end-to-end web research** for a given question:

1. Uses Apify's **Google Search Scraper** to find relevant pages.
2. Uses Apify's **Website Content Crawler** to extract page content.
3. Normalizes the results into structured items (name, website, description, extra).
4. Calls **Google Gemini** to generate a rich Markdown report comparing the items.

Originally built as a portfolio project for the **Applied AI Engineer** role at [Apify](https://apify.com/).

---

## Features

- ✅ Written in **TypeScript** with `strict` type checking.
- ✅ Uses **Apify SDK** Actors, datasets and key-value stores.
- ✅ Integrates **Google Gemini** via the official `@google/generative-ai` SDK.
- ✅ Generates:
  - `REPORT.md` – human-readable research report.
  - Dataset items – structured JSON for programmatic use.
  - `OUTPUT.json` – metadata (datasetId, reportKey, itemCount, model, etc.).

---

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Platform:** [Apify Actors](https://apify.com/docs)
- **Scraping:**
  - [`apify/google-search-scraper`](https://apify.com/apify/google-search-scraper)
  - [`apify/website-content-crawler`](https://apify.com/apify/website-content-crawler)
- **LLM:** Google Gemini (`@google/generative-ai`)

---

## Input

The Actor input is defined in `INPUT_SCHEMA.json`. The main fields are:

- `question` *(string, required)* – The research question.
- `searchQueries` *(string[], optional)* – Custom queries (defaults to `[question]`).
- `maxResults` *(number, default: 10)* – Max number of tools / items to include.
- `maxSearchResultsPerQuery` *(number, default: 8)* – Max SERP items per query.
- `useApifyScrapers` *(boolean, default: true)* – Toggle using Store Actors.
- `geminiModel` *(string, default: `gemini-2.5-flash-lite`)* – Gemini model to use.
- `geminiApiKey` *(string, optional)* – Gemini API key. Prefer setting via env.

Example `input.json`:

```json
{
  "question": "Find 10 AI code assistant tools and summarize them.",
  "maxResults": 10,
  "geminiModel": "gemini-2.5-flash-lite",
  "geminiApiKey": "YOUR_GEMINI_API_KEY_HERE"
}
