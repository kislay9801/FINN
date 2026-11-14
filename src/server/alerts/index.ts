import { defaultRules, type Signal } from "@/types";
import { alertMatches, dedupe, priceSignals } from "@/lib/finance";
import { getCache, setCache } from "@/server/store";
import type { DataState } from "@/types";
import { portfolio } from "@/data/companies";
export async function evaluateScheduledAlerts(state: DataState) {
  const watched = new Set(portfolio.map((c) => c.ticker));
  const signals = [
    ...state.announcements.filter((s) => watched.has(s.ticker)),
    ...state.prices
      .filter((p) => watched.has(p.ticker))
      .flatMap((p) =>
        priceSignals(
          p,
          defaultRules,
          portfolio.find((c) => c.ticker === p.ticker)?.name ?? p.ticker,
        ),
      ),
  ];
  const existing =
    (await getCache<(Signal & { evaluatedAt: string })[]>("alerts")) ?? [];
  const evaluatedAt = new Date().toISOString();
  const fresh = signals.filter(
    (s) =>
      alertMatches(s, defaultRules) && !existing.some((a) => a.id === s.id),
  );
  await setCache(
    "alerts",
    dedupe([...fresh.map((s) => ({ ...s, evaluatedAt })), ...existing]).slice(
      0,
      500,
    ),
  );
  return fresh.length;
}
