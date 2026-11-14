import { z } from "zod";
export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((s) => s.replace(/\.NS$/, ""))
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9&-]{0,24}$/));
export const categories = [
  "results",
  "M&A",
  "fund_raise",
  "management_change",
  "litigation",
  "insider_trading",
  "earnings_call",
  "investor_meetings",
  "credit_rating",
  "dividend",
  "bonus_split",
  "capex",
  "press_release",
  "postal_ballot",
  "agm_egm",
  "pledging",
  "unclassified",
  "price",
  "volume",
] as const;
export type Category = (typeof categories)[number];
export type Company = { ticker: string; name: string; sector: string };
export type Session = { date: string; close: number; volume: number };
export type PriceSeries = {
  ticker: string;
  sourceUrl: string;
  retrievedAt: string;
  sessions: Session[];
};
export type Citation = {
  documentId: string;
  title: string;
  url: string;
  page?: number;
  period?: string;
  excerpt: string;
};
export type Document = {
  id: string;
  ticker: string;
  title: string;
  kind: string;
  period: string;
  url: string;
  retrievedAt: string;
  hash: string;
  pages: { page: number; text: string }[];
};
export type Signal = {
  id: string;
  ticker: string;
  company: string;
  publishedAt: string;
  title: string;
  description: string;
  category: Category;
  priority: number;
  reason: string;
  sourceName: string;
  sourceUrl: string;
  attachmentUrl?: string;
  ingestedAt: string;
  classificationMethod: string;
  confidence: number;
  facts?: { label: string; value: string }[];
  routine: boolean;
};
export const rulesSchema = z.object({
  price: z.number().min(0.5).max(50),
  volume: z.number().min(1.1).max(20),
  minimumPriority: z.number().min(0).max(100),
  categories: z.array(z.enum(categories)),
  enabled: z.boolean(),
});
export type Rules = z.infer<typeof rulesSchema>;
export const defaultRules: Rules = {
  price: 5,
  volume: 2,
  minimumPriority: 50,
  categories: categories.filter(
    (c) =>
      ![
        "unclassified",
        "investor_meetings",
        "postal_ballot",
        "agm_egm",
      ].includes(c),
  ),
  enabled: true,
};
export type Health = {
  provider: string;
  status: "fresh" | "cached" | "unavailable";
  detail: string;
  asOf?: string;
};
export type DataState = {
  announcements: Signal[];
  prices: PriceSeries[];
  health: Health[];
  refreshedAt?: string;
};
export const sectionKeys = [
  "Business snapshot",
  "Financial snapshot",
  "Financial trajectory",
  "Balance sheet",
  "Cash quality",
  "Narrative vs numbers",
  "Management guidance",
  "Bull vs bear",
] as const;
export const researchSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.enum(sectionKeys),
        analysis: z.string().max(3000),
        citations: z.array(z.number().int().nonnegative()).max(8),
      }),
    )
    .max(8),
  answer: z.string().max(5000).optional(),
});
export type ResearchSection = z.infer<
  typeof researchSchema
>["sections"][number];
export type PromiseRecord = {
  statement: string;
  statementDate: string;
  metric: string;
  targetPeriod: string;
  targetLow: number | null;
  targetHigh: number | null;
  actualValue: number | null;
  actualPeriod: string;
  status:
    | "MET"
    | "MISSED"
    | "ON TRACK"
    | "NOT YET DUE"
    | "NOT COMPARABLE"
    | "INSUFFICIENT EVIDENCE";
  statementSource: Citation;
  resultSource?: Citation;
  explanation: string;
  confidence: number;
};
export type Research = {
  ticker: string;
  company: string;
  documents: Omit<Document, "pages">[];
  citations: Citation[];
  sections: ResearchSection[];
  answer?: string;
  promises: PromiseRecord[];
  mode: "llm" | "evidence";
  coverage: string;
  cached: boolean;
  warnings: string[];
  generatedAt: string;
};
