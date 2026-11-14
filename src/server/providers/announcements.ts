import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { classify } from "@/server/analysis/classify";
import { dedupe } from "@/lib/finance";
import type { Company, Signal } from "@/types";
import { allowedUrl, fetchSafe } from "./http";
export const feedUrl =
  "https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml";
export function parseIst(input: string) {
  const m = input.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d\d:\d\d:\d\d)$/);
  if (m) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = months.indexOf(m[2]) + 1;
    if (!month) return null;
    const d = new Date(
      `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}T${m[4]}+05:30`,
    );
    return Number.isNaN(+d) ? null : d.toISOString();
  }
  if (!/(?:Z|[+-]\d\d:?\d\d|GMT)/i.test(input)) return null;
  const d = new Date(input);
  return Number.isNaN(+d) ? null : d.toISOString();
}
export function parseAnnouncements(
  xml: string,
  companies: Company[],
  ingestedAt: string,
): Signal[] {
  const raw = new XMLParser({
    ignoreAttributes: false,
    processEntities: true,
  }).parse(xml);
  let items = raw?.rss?.channel?.item;
  if (!items) return [];
  if (!Array.isArray(items)) items = [items];
  const lookup = new Map(companies.map((c) => [c.ticker, c]));
  const names = new Map(
    companies.map((c) => [
      c.name.toLowerCase().replace(/limited|ltd\.?|[^a-z0-9]/g, ""),
      c,
    ]),
  );
  const signals: Signal[] = [];
  for (const item of items) {
    const url = String(item.link ?? "");
    if (!allowedUrl(url)) continue;
    const ticker = decodeURIComponent(url.split("/").at(-1) ?? "")
      .split("_")[0]
      .toUpperCase();
    const company =
      lookup.get(ticker) ??
      names.get(
        String(item.title)
          .toLowerCase()
          .replace(/limited|ltd\.?|[^a-z0-9]/g, ""),
      );
    if (!company) continue;
    const description = String(item.description ?? "")
      .replace(/<[^>]+>/g, " ")
      .trim();
    const title =
      description.split("|SUBJECT:")[1]?.trim() ||
      description.slice(0, 180) ||
      "Corporate disclosure";
    const publishedAt = parseIst(String(item.pubDate));
    if (!publishedAt) continue;
    const classification = classify(title, description);
    signals.push({
      id: createHash("sha256").update(url).digest("hex").slice(0, 24),
      ticker: company.ticker,
      company: company.name,
      publishedAt,
      title,
      description: description.split("|SUBJECT:")[0].trim(),
      ...classification,
      sourceName: "NSE · official filing",
      sourceUrl: url,
      attachmentUrl: url,
      ingestedAt,
    });
  }
  return dedupe(signals);
}
export interface AnnouncementProvider {
  fetch(companies: Company[]): Promise<Signal[]>;
}
export class NseRssProvider implements AnnouncementProvider {
  async fetch(companies: Company[]) {
    return parseAnnouncements(
      (await fetchSafe(feedUrl)).toString("utf8"),
      companies,
      new Date().toISOString(),
    );
  }
}
export function parseArchive(
  records: unknown,
  companies: Company[],
  ingestedAt: string,
): Signal[] {
  if (!Array.isArray(records)) throw new Error("Malformed NSE archive");
  const lookup = new Map(companies.map((c) => [c.ticker, c]));
  return dedupe(
    records.flatMap((row) => {
      const c = lookup.get(row.symbol);
      const publishedAt = parseIst(String(row.an_dt ?? ""));
      const url = String(row.attchmntFile ?? "");
      if (!c || !publishedAt || !allowedUrl(url)) return [];
      const title = String(row.desc ?? "Corporate disclosure"),
        description = String(row.attchmntText ?? title).replace(
          /<[^>]*>/g,
          " ",
        );
      return [
        {
          id: createHash("sha256").update(url).digest("hex").slice(0, 24),
          ticker: c.ticker,
          company: c.name,
          publishedAt,
          title,
          description,
          ...classify(title, description),
          sourceName: "NSE · official filing",
          sourceUrl: url,
          attachmentUrl: url,
          ingestedAt,
        },
      ];
    }),
  );
}
export class NseArchiveProvider implements AnnouncementProvider {
  async fetch(companies: Company[]) {
    const format = (d: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
        .format(d)
        .replaceAll("/", "-");
    const end = new Date(),
      start = new Date(Date.now() - 7 * 86400_000);
    const url = `https://www.nseindia.com/api/corporate-announcements?index=equities&from_date=${format(start)}&to_date=${format(end)}`;
    return parseArchive(
      JSON.parse((await fetchSafe(url, [], 20_000_000)).toString()),
      companies,
      new Date().toISOString(),
    );
  }
}
