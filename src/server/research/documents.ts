import { createHash } from "node:crypto";
import pdf from "pdf-parse/lib/pdf-parse.js";
import snapshots from "@/data/documents.json";
import type { Document } from "@/types";
import { fetchSafe, allowedUrl, bounded } from "@/server/providers/http";
import { getCache, setCache } from "@/server/store";
export const capturedDocuments = snapshots as Document[];
export function chunkDocument(doc: Document) {
  return doc.pages.flatMap((p) => {
    const words = p.text.replace(/\s+/g, " ").split(" ");
    const chunks = [];
    for (let i = 0; i < words.length; i += 170)
      chunks.push({
        documentId: doc.id,
        title: doc.title,
        url: doc.url,
        period: doc.period,
        page: p.page,
        excerpt: words.slice(i, i + 220).join(" "),
      });
    return chunks;
  });
}
export async function parsePdf(
  url: string,
  ticker: string,
  title: string,
  kind: string,
  extra: string[] = [],
): Promise<Document> {
  const old = await getCache<Document>(
    `docurl:${createHash("sha256").update(url).digest("hex")}`,
  );
  if (old && Date.now() - Date.parse(old.retrievedAt) < 86400_000) return old;
  const raw = await fetchSafe(url, extra);
  if (!raw.subarray(0, 5).toString().startsWith("%PDF"))
    throw new Error("Source did not return a PDF");
  const hash = createHash("sha256").update(raw).digest("hex");
  const cached = await getCache<Document>(`doc:${hash}`);
  if (cached) return cached;
  const pages: { page: number; text: string }[] = [];
  await pdf(raw, {
    max: 180,
    pagerender: async (page: {
      pageNumber: number;
      getTextContent: (
        options: object,
      ) => Promise<{ items: { str: string }[] }>;
    }) => {
      const text = (
        await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false,
        })
      ).items
        .map((i) => i.str)
        .join(" ");
      pages.push({ page: page.pageNumber, text });
      return text;
    },
  });
  if (pages.reduce((n, p) => n + p.text.length, 0) < 200)
    throw new Error("No usable text; scanned PDFs need OCR.");
  const doc: Document = {
    id: hash.slice(0, 20),
    ticker,
    title,
    kind,
    period: "See document",
    url,
    retrievedAt: new Date().toISOString(),
    hash,
    pages: pages.sort((a, b) => a.page - b.page),
  };
  await setCache(`doc:${hash}`, doc);
  await setCache(
    `docurl:${createHash("sha256").update(url).digest("hex")}`,
    doc,
  );
  return doc;
}
function links(html: string, base: string) {
  return [
    ...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ].flatMap((m) => {
    try {
      return [
        {
          url: new URL(m[1].replaceAll("&amp;", "&"), base).href,
          text: m[2]
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        },
      ];
    } catch {
      return [];
    }
  });
}
export async function discoverDocuments(
  ticker: string,
): Promise<{ documents: Document[]; warnings: string[] }> {
  const bundled = capturedDocuments.filter((d) => d.ticker === ticker);
  if (bundled.length) return { documents: bundled, warnings: [] };
  const cached = await getCache<{
    documents: Document[];
    warnings: string[];
    at: number;
  }>(`library:v2:${ticker}`);
  if (
    cached &&
    Date.now() - cached.at < (cached.documents.length ? 86400_000 : 600_000)
  )
    return cached;
  const warnings: string[] = [];
  let documents: Document[] = [];
  try {
    let base = `https://www.screener.in/company/${encodeURIComponent(ticker)}/consolidated/`;
    let raw: Buffer;
    try {
      raw = await fetchSafe(base, [], 3_000_000);
    } catch {
      base = `https://www.screener.in/company/${encodeURIComponent(ticker)}/`;
      raw = await fetchSafe(base, [], 3_000_000);
    }
    const html = raw.toString();
    const anchors = links(html, base);
    // Only links in Screener's document sections are considered; its financial tables are never evidence.
    const start = html.indexOf('id="documents"');
    const documentLinks = links(start >= 0 ? html.slice(start) : "", base);
    const website = anchors.find(
      (a) =>
        /company website/i.test(a.text) ||
        (/website/i.test(a.text) && !a.url.includes("screener.in")),
    );
    const officialHosts = website ? [new URL(website.url).hostname] : [];
    const eligible = documentLinks.filter(
      (a) => /\.pdf(?:\?|$)/i.test(a.url) && allowedUrl(a.url, officialHosts),
    );
    const candidates = [
      ...new Map(
        [
          ...eligible.filter((a) => /annual report/i.test(a.text)).slice(0, 2),
          ...eligible.filter((a) => /transcript/i.test(a.text)).slice(0, 3),
          ...eligible
            .filter((a) => /PPT|presentation/i.test(a.text))
            .slice(0, 1),
        ].map((a) => [a.url, a]),
      ).values(),
    ];
    if (!candidates.length)
      warnings.push(
        "No accessible primary PDF links on approved company/exchange domains were discovered.",
      );
    const results = await bounded(candidates, 2, (a) =>
      parsePdf(
        a.url,
        ticker,
        `${ticker} · ${a.text || "Primary filing"}`,
        /annual/i.test(a.text)
          ? "annual"
          : /transcript|concall/i.test(a.text)
            ? "transcript"
            : "filing",
        officialHosts,
      ),
    );
    documents = results.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length)
      warnings.push(
        `${failed.length} source document(s) could not be parsed or fetched: ${[...new Set(failed.map((r) => String(r.reason instanceof Error ? r.reason.message : "Source error")))].join("; ")}`,
      );
  } catch (e) {
    warnings.push(
      `Document discovery unavailable: ${e instanceof Error ? e.message : "provider error"}.`,
    );
  }
  const value = { documents, warnings, at: Date.now() };
  await setCache(`library:v2:${ticker}`, value);
  return value;
}
