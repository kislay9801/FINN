import { readFile } from "node:fs/promises";
import path from "node:path";
import prices from "@/data/prices.json";
import provenance from "@/data/feed-provenance.json";
import directory from "@/data/nse-companies.json";
import archive from "@/data/archive-signals.json";
import { portfolio, candidates } from "@/data/companies";
import type { Company, DataState, PriceSeries } from "@/types";
import { dedupe } from "@/lib/finance";
import { getCache, setCache } from "@/server/store";
import {
  NseRssProvider,
  NseArchiveProvider,
  parseAnnouncements,
} from "@/server/providers/announcements";
import { YahooEodProvider } from "@/server/providers/prices";
import { bounded } from "@/server/providers/http";
export const companies: Company[] = directory.companies.map((c) => ({
  ...c,
  sector:
    [...portfolio, ...candidates].find((p) => p.ticker === c.ticker)?.sector ??
    c.sector,
}));
export async function initialData(): Promise<DataState> {
  const cache = await getCache<DataState>("ingestion");
  if (cache) return cache;
  let announcements: DataState["announcements"] =
    archive as DataState["announcements"];
  try {
    announcements = dedupe([
      ...announcements,
      ...parseAnnouncements(
        await readFile(
          path.join(process.cwd(), "src/data/announcements.xml"),
          "utf8",
        ),
        companies,
        provenance.retrievedAt,
      ),
    ]);
  } catch {
    /* JSON archive remains available when RSS asset is missing. */
  }
  return {
    announcements,
    prices: prices as PriceSeries[],
    health: [
      {
        provider: "NSE announcements",
        status: announcements.length ? "cached" : "unavailable",
        detail:
          "Official RSS plus captured 15 Oct–14 Nov 2026 archive for the demo companies. Coverage beyond captured records is not implied.",
        asOf: provenance.retrievedAt,
      },
      {
        provider: "EOD prices",
        status: "cached",
        detail:
          "Actual Yahoo daily observations · unadjusted close · no intraday streaming.",
        asOf: prices[0]?.retrievedAt,
      },
      {
        provider: "Research documents",
        status: "cached",
        detail:
          "26 captured primary documents across 6 issuers. Other tickers are discovered on demand.",
      },
    ],
  };
}
let running: Promise<DataState> | null = null;
export async function refreshData(tickers = portfolio.map((c) => c.ticker)) {
  if (running) return running;
  running = (async () => {
    const previous = await initialData();
    const now = new Date().toISOString();
    const nse = new NseArchiveProvider(),
      yahoo = new YahooEodProvider();
    const [announcementResult, priceResults] = await Promise.all([
      nse
        .fetch(companies)
        .catch(() => new NseRssProvider().fetch(companies))
        .then((value) => ({ ok: true as const, value }))
        .catch((error: Error) => ({ ok: false as const, error })),
      bounded(tickers.slice(0, 25), 3, (t) => yahoo.fetch(t)),
    ]);
    const freshPrices = priceResults.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    const mergedPrices = [
      ...new Map(
        [...previous.prices, ...freshPrices].map((p) => [p.ticker, p]),
      ).values(),
    ];
    const state: DataState = {
      announcements: announcementResult.ok
        ? dedupe([...previous.announcements, ...announcementResult.value])
        : previous.announcements,
      prices: mergedPrices,
      refreshedAt: now,
      health: [
        {
          provider: "NSE announcements",
          status: announcementResult.ok ? "fresh" : "unavailable",
          detail: announcementResult.ok
            ? "Official NSE filings fetched; prior records retained. Historical windows only include captured records."
            : `Provider failed; retained prior records. ${announcementResult.error.message}`,
          asOf: announcementResult.ok ? now : previous.health[0]?.asOf,
        },
        {
          provider: "EOD prices",
          status:
            freshPrices.length === tickers.length
              ? "fresh"
              : freshPrices.length
                ? "cached"
                : "unavailable",
          detail: `${freshPrices.length}/${tickers.length} series refreshed; previous snapshots retained for failed requests.`,
          asOf: freshPrices.length ? now : previous.health[1]?.asOf,
        },
        {
          provider: "Research documents",
          status: "cached",
          detail: "Parsed primary documents are content-hash cached.",
        },
      ],
    };
    await setCache("ingestion", state);
    return state;
  })().finally(() => {
    running = null;
  });
  return running;
}
