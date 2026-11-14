import { z } from "zod";
import { initialData } from "@/server/ingestion";
import { parsePdf } from "@/server/research/documents";
import { financialComparison } from "@/server/research/financials";
import { jsonBody, rateLimit, sameOrigin } from "@/server/security";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!sameOrigin(request) || !rateLimit(request, "evidence", 10))
    return Response.json({ error: "Request not allowed" }, { status: 429 });
  try {
    const { id } = z
      .object({ id: z.string().max(100) })
      .parse(await jsonBody(request));
    const signal = (await initialData()).announcements.find((s) => s.id === id);
    if (!signal)
      return Response.json({ error: "Filing not found" }, { status: 404 });
    const doc = await parsePdf(
      signal.attachmentUrl ?? signal.sourceUrl,
      signal.ticker,
      signal.title,
      signal.category === "results" ? "results" : "filing",
    );
    return Response.json({
      document: { ...doc, pages: doc.pages.slice(0, 8) },
      financials: financialComparison(doc),
    });
  } catch {
    return Response.json(
      {
        error:
          "This filing could not be read automatically. Open the original source to inspect it.",
      },
      { status: 422 },
    );
  }
}
