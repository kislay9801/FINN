import { discoverDocuments, parsePdf } from "../src/server/research/documents";
import { initialData } from "../src/server/ingestion";
import { NseRssProvider } from "../src/server/providers/announcements";
import { YahooEodProvider } from "../src/server/providers/prices";
import { companies } from "../src/server/ingestion";
const results = await Promise.allSettled([
  new YahooEodProvider()
    .fetch("INFY")
    .then((d) => ({
      provider: "Yahoo EOD",
      sessions: d.sessions.length,
      latest: d.sessions.at(-1)?.date,
    })),
  new NseRssProvider()
    .fetch(companies)
    .then((d) => ({ provider: "NSE RSS", filings: d.length })),
  discoverDocuments("COALINDIA").then((d) => ({
    provider: "Ad-hoc COALINDIA discovery",
    documents: d.documents.length,
    pages: d.documents.reduce((n, v) => n + v.pages.length, 0),
    warnings: d.warnings,
  })),
  (async () => {
    const s = (await initialData()).announcements.find(
      (a) => a.category === "results" && !a.routine,
    )!;
    const doc = await parsePdf(s.sourceUrl, s.ticker, s.title, "results");
    return {
      provider: "Filing PDF extraction",
      ticker: s.ticker,
      pages: doc.pages.length,
    };
  })(),
]);
for (const result of results)
  console.log(
    JSON.stringify(
      result.status === "fulfilled"
        ? result.value
        : { failure: String(result.reason) },
    ),
  );
