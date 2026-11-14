import type { PriceSeries } from "@/types";
import { fetchSafe } from "./http";
export function parseChart(
  ticker: string,
  raw: unknown,
  sourceUrl: string,
): PriceSeries {
  const data = raw as {
    chart: {
      result?: {
        timestamp: number[];
        indicators: {
          quote: { close: (number | null)[]; volume: (number | null)[] }[];
        };
      }[];
      error?: unknown;
    };
  };
  const r = data.chart?.result?.[0];
  if (!r || data.chart.error) throw new Error("No EOD series returned");
  const q = r.indicators.quote[0];
  return {
    ticker,
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    sessions: r.timestamp
      .flatMap((ts, i) =>
        q.close[i] != null && q.volume[i] != null
          ? [
              {
                date: new Date(ts * 1000).toISOString(),
                close: q.close[i]!,
                volume: q.volume[i]!,
              },
            ]
          : [],
      )
      .filter((x) => Date.parse(x.date) + 6.25 * 3600_000 < Date.now()),
  };
}
export interface PriceProvider {
  fetch(ticker: string): Promise<PriceSeries>;
}
export class YahooEodProvider implements PriceProvider {
  async fetch(ticker: string) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.NS?range=3mo&interval=1d`;
    return parseChart(
      ticker,
      JSON.parse((await fetchSafe(url)).toString()),
      url,
    );
  }
}
