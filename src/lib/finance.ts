import type { PriceSeries, Rules, Signal } from "@/types";
export function growth(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  return current == null ||
    previous == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}
export function inCrores(
  value: number,
  unit: "rupees" | "lakhs" | "crores" | "millions" | "billions",
) {
  return (
    value *
    { rupees: 1e-7, lakhs: 0.01, crores: 1, millions: 0.1, billions: 100 }[unit]
  );
}
export function compareFacts(
  a: { basis: string; unit: string; value: number },
  b: { basis: string; unit: string; value: number },
) {
  if (a.basis !== b.basis || a.unit !== b.unit) return null;
  return growth(a.value, b.value);
}
export function marketStats(series: PriceSeries) {
  const s = [...series.sessions]
    .filter(
      (x) =>
        Number.isFinite(x.close) &&
        x.close > 0 &&
        Number.isFinite(x.volume) &&
        x.volume >= 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = s.at(-1),
    prev = s.at(-2),
    baseline = s.slice(-21, -1);
  const average =
    baseline.length === 20
      ? baseline.reduce((n, x) => n + x.volume, 0) / 20
      : null;
  return {
    last,
    previous: prev,
    change: growth(last?.close, prev?.close),
    average,
    ratio: average && last ? last.volume / average : null,
    sessions: s,
  };
}
export function priceSignals(
  series: PriceSeries,
  rules: Rules,
  company: string,
): Signal[] {
  const s = marketStats(series);
  if (!s.last) return [];
  const base = {
    ticker: series.ticker,
    company,
    publishedAt: s.last.date,
    sourceName: "Yahoo Finance · EOD",
    sourceUrl: series.sourceUrl,
    ingestedAt: series.retrievedAt,
    classificationMethod: "deterministic EOD rule",
    confidence: 1,
    routine: false,
  };
  const out: Signal[] = [];
  if (s.change !== null && Math.abs(s.change) >= rules.price)
    out.push({
      ...base,
      id: `price:${series.ticker}:${s.last.date}`,
      title: `${s.change > 0 ? "+" : ""}${s.change.toFixed(2)}% at the closing bell`,
      description:
        "A session-close price movement crossed your configured threshold. Review the filings before drawing a conclusion.",
      category: "price",
      priority: 78,
      reason: `Absolute EOD movement ${Math.abs(s.change).toFixed(2)}% ≥ ${rules.price}% rule. Unadjusted closes; inspect corporate actions.`,
      facts: [
        { label: "Close", value: `₹${s.last.close.toFixed(2)}` },
        { label: "Previous close", value: `₹${s.previous?.close.toFixed(2)}` },
      ],
    });
  if (s.ratio !== null && s.ratio >= rules.volume)
    out.push({
      ...base,
      id: `volume:${series.ticker}:${s.last.date}`,
      title: `Trading volume at ${s.ratio.toFixed(2)}× its 20-session baseline`,
      description:
        "Participation increased relative to the previous 20 completed sessions. Volume alone does not establish direction or cause.",
      category: "volume",
      priority: 70,
      reason: `Volume ratio ${s.ratio.toFixed(2)}× ≥ ${rules.volume}× rule. Current session excluded from baseline.`,
      facts: [
        {
          label: "Session volume",
          value: s.last.volume.toLocaleString("en-IN"),
        },
        {
          label: "20-session average",
          value: Math.round(s.average!).toLocaleString("en-IN"),
        },
      ],
    });
  return out;
}
export function alertMatches(signal: Signal, rules: Rules) {
  return (
    rules.enabled &&
    rules.categories.includes(signal.category) &&
    signal.priority >= rules.minimumPriority
  );
}
export function evaluateNewSignals(
  seen: string[] | null,
  signals: Signal[],
  rules: Rules,
  now: number,
) {
  const previous = new Set(seen ?? []);
  const unseen = signals.filter((s) => !previous.has(s.id));
  const next = unseen.length
    ? [...previous, ...unseen.map((s) => s.id)].slice(-10000)
    : (seen ?? []);
  return {
    seen: next,
    matches:
      seen === null
        ? []
        : unseen.filter(
            (s) =>
              alertMatches(s, rules) &&
              now - Date.parse(s.publishedAt) >= 0 &&
              now - Date.parse(s.publishedAt) < 30 * 86400_000,
          ),
  };
}
export function dedupe<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((x) => [x.id, x])).values()];
}
export function prioritySort<
  T extends { priority: number; publishedAt: string },
>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      b.priority - a.priority || b.publishedAt.localeCompare(a.publishedAt),
  );
}
export function compareTarget(
  actual: number | null,
  low: number | null,
  high: number | null,
  due: boolean,
): "MET" | "MISSED" | "NOT YET DUE" | "INSUFFICIENT EVIDENCE" {
  if (!due) return "NOT YET DUE";
  if (actual === null || low === null) return "INSUFFICIENT EVIDENCE";
  return actual >= low && (high === null || actual <= high) ? "MET" : "MISSED";
}
