import { z } from "zod";
import { tickerSchema } from "@/types";
import { companies, initialData } from "@/server/ingestion";
import { researchCompany } from "@/server/research";
import { jsonBody, rateLimit, sameOrigin } from "@/server/security";
export const maxDuration = 120;
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin rejected" }, { status: 403 });
  if (!rateLimit(request, "research", 12))
    return Response.json(
      { error: "Research rate limit reached. Please try again shortly." },
      { status: 429 },
    );
  try {
    const { ticker, question, signalId } = z
      .object({
        ticker: tickerSchema,
        question: z.string().trim().min(3).max(600).optional(),
        signalId: z.string().max(100).optional(),
      })
      .parse(await jsonBody(request));
    const company = companies.find((c) => c.ticker === ticker);
    if (!company)
      return Response.json(
        {
          error:
            "Ticker not found in the captured official NSE equity directory.",
        },
        { status: 404 },
      );
    const context = signalId
      ? (await initialData()).announcements.find(
          (s) => s.id === signalId && s.ticker === ticker,
        )
      : undefined;
    return Response.json(
      await researchCompany(ticker, company.name, question, context),
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? "Enter a valid NSE ticker and a question under 600 characters."
            : "Research could not complete. Source data may be unavailable; try again.",
      },
      { status: 400 },
    );
  }
}
