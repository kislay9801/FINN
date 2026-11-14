import type { Document } from "@/types";
import { growth } from "@/lib/finance";
export type FinancialRow = {
  metric: string;
  current: number | null;
  previous: number | null;
  yearAgo: number | null;
  qoq: number | null;
  yoy: number | null;
};
export function financialComparison(doc: Document) {
  // Layout-specific adapter, gated by issuer, labels, basis, currency and row count.
  if (doc.ticker !== "INFY" || doc.kind !== "results") return null;
  for (const page of doc.pages) {
    const text = page.text;
    if (
      !/In\s*₹\s*crore/i.test(text) ||
      !/Consolidated Statement of Comprehensive Income for three months/i.test(
        text,
      )
    )
      continue;
    const section = text
      .split(/In\s*₹\s*crore/i)[1]
      ?.split(
        /Consolidated Statement of Comprehensive Income for (?:six|nine|year)/i,
      )[0];
    if (!section) continue;
    const rows = section
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) =>
        /^[-\d,.]+\s+[-\d,.]+\s+[-\d,.]+%\s+[-\d,.]+\s+[-\d,.]+%$/.test(s),
      )
      .map((s) =>
        s
          .split(/\s+/)
          .map((n) => Number(n.replaceAll(",", "").replace("%", ""))),
      );
    if (
      rows.length < 12 ||
      !text.includes("Net profit (after non-controlling interests)")
    )
      continue;
    const mappings: [string, number][] = [
      ["Revenue", 0],
      ["Operating profit", 6],
      ["PBT", 9],
      ["PAT · attributable to owners", 11],
    ];
    const metrics: FinancialRow[] = mappings.map(([metric, index]) => {
      const r = rows[index];
      return {
        metric,
        current: r[0],
        previous: r[3],
        yearAgo: r[1],
        qoq: growth(r[0], r[3]),
        yoy: growth(r[0], r[1]),
      };
    });
    metrics.splice(2, 0, {
      metric: "EBITDA · not reported",
      current: null,
      previous: null,
      yearAgo: null,
      qoq: null,
      yoy: null,
    });
    return {
      basis: "Consolidated · IFRS",
      unit: "₹ crore",
      period: doc.period,
      metrics,
      source: {
        documentId: doc.id,
        title: doc.title,
        url: doc.url,
        page: page.page,
        period: doc.period,
        excerpt: section.slice(0, 2400),
      },
    };
  }
  return null;
}
