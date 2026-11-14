import type { Citation, Document, PromiseRecord } from "@/types";
function cite(doc: Document, page: number, text: string): Citation {
  return {
    documentId: doc.id,
    title: doc.title,
    url: doc.url,
    page,
    period: doc.period,
    excerpt: text,
  };
}
export function extractPromises(
  documents: Document[],
  now = new Date(),
): PromiseRecord[] {
  const output: PromiseRecord[] = [];
  for (const doc of documents.filter((d) => d.kind === "release")) {
    const first = doc.pages[0];
    const t = first.text.replace(/\s+/g, " ");
    const date = t.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/,
    )?.[0];
    if (!date) continue;
    const fiscal = t.match(/Guidance for FY\s*(\d{2})\s*:/i);
    if (!fiscal) continue;
    const scope = t.slice(fiscal.index!, fiscal.index! + 280);
    const target = scope.match(
      /Revenue growth of\s*([\d.]+)%?\s*[-–]\s*([\d.]+)%\s*in constant currency/i,
    );
    if (!target) continue;
    const year = 2000 + Number(fiscal[1]);
    const targetPeriod = `FY${fiscal[1]}`;
    const due = now >= new Date(`${year}-04-01T00:00:00+05:30`);
    const low = Number(target[1]),
      high = Number(target[2]);
    const result = documents.find(
      (d) => d.kind === "release" && d.period === `Q4 FY${fiscal[1]}`,
    );
    const resultText = result?.pages[0].text.replace(/\s+/g, " ");
    const actual = resultText?.match(
      new RegExp(
        `FY\\s*${fiscal[1]} revenues with (?:a )?growth of ([\\d.]+)%\\s*in constant currency`,
      ),
    );
    const value = actual ? Number(actual[1]) : null;
    const status = !due
      ? "NOT YET DUE"
      : value === null
        ? "INSUFFICIENT EVIDENCE"
        : value >= low
          ? "MET"
          : "MISSED";
    output.push({
      statement: target[0],
      statementDate: new Date(date + " 12:00:00 GMT+0530").toISOString(),
      metric: "Annual revenue growth · constant currency",
      targetPeriod,
      targetLow: low,
      targetHigh: high,
      actualValue: value,
      actualPeriod: targetPeriod,
      status,
      statementSource: cite(doc, first.page, scope),
      resultSource: result && actual ? cite(result, 1, actual[0]) : undefined,
      explanation: !due
        ? "Annual guidance remains open. An interim quarter cannot establish delivery of a full-year target."
        : value === null
          ? "A comparable full-year constant-currency growth observation was not found."
          : value > high
            ? `Full-year growth ${value}% exceeded the ${low}–${high}% range. Growth above the upper bound is treated as delivery, not a miss.`
            : `Full-year growth ${value}% ${value >= low ? "met" : "fell short of"} the ${low}–${high}% guidance range. Revisions are shown independently; this is not a commitment count.`,
      confidence: 1,
    });
  }
  return output.sort((a, b) => b.statementDate.localeCompare(a.statementDate));
}
