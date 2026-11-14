import type { Category } from "@/types";
const rules: [Category, RegExp, number][] = [
  ["M&A", /acquisition|merger|demerger|joint venture|sale of.*stake/i, 90],
  [
    "management_change",
    /chief|\bcfo\b|\bceo\b|managing director|resignation.*director|appointment.*director/i,
    85,
  ],
  [
    "litigation",
    /litigation|penalty|regulatory order|insolvency|fine imposed/i,
    84,
  ],
  [
    "results",
    /financial results|quarterly results|audited results|financial statement/i,
    88,
  ],
  [
    "fund_raise",
    /qip|preferential|rights issue|fund rais|buyback|commercial paper/i,
    80,
  ],
  ["bonus_split", /bonus|stock split|sub.division/i, 75],
  [
    "capex",
    /capacity expansion|capital expenditure|new plant|new facility/i,
    80,
  ],
  ["pledging", /pledge|pledging|encumbrance/i, 75],
  ["dividend", /dividend/i, 65],
  [
    "credit_rating",
    /credit rating|rating.*(?:upgrade|downgrade|reaffirm)/i,
    60,
  ],
  ["insider_trading", /insider|promoter.*(?:sale|purchase|trading)/i, 55],
  ["earnings_call", /earnings call|conference call|concall|transcript/i, 52],
  ["investor_meetings", /analyst|investor meet|institutional investor/i, 22],
  ["postal_ballot", /postal ballot/i, 15],
  [
    "agm_egm",
    /annual general meeting|extraordinary general|\bagm\b|\begm\b/i,
    15,
  ],
  ["press_release", /press release|order win|partnership/i, 50],
];
export function classify(title: string, description = "") {
  const text = title + " " + description;
  const procedural =
    /newspaper|publication|advertisement|trading window|loss of share|duplicate share|compliance certificate|esop|recording|board meeting intimation|notice of.*(?:results|meeting)/i.test(
      title,
    );
  const hit = rules.find(([, regex]) => regex.test(text));
  const category = hit?.[0] ?? "unclassified";
  const priority = procedural ? 18 : (hit?.[2] ?? 10);
  return {
    category,
    priority,
    routine: priority < 40,
    confidence: hit ? 0.9 : 0.4,
    classificationMethod: "keyword rules v1",
    reason: procedural
      ? "Procedural notice: downweighted to keep the digest focused."
      : hit
        ? `${category.replaceAll("_", " ")} category base score ${priority}/100. A routing score, not a claim of financial impact.`
        : "No material event identified by deterministic rules; retained for review.",
  };
}
