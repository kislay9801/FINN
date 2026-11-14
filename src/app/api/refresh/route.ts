import { z } from "zod";
import { companies, refreshData } from "@/server/ingestion";
import { evaluateScheduledAlerts } from "@/server/alerts";
import { jsonBody, rateLimit, sameOrigin } from "@/server/security";
import { tickerSchema } from "@/types";
export const maxDuration = 120;
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin rejected" }, { status: 403 });
  if (!rateLimit(request, "refresh", 1, 60_000))
    return Response.json(
      {
        error:
          "Refresh is limited to once per minute. Cached records remain available.",
      },
      { status: 429 },
    );
  try {
    const body = z
      .object({ tickers: z.array(tickerSchema).max(25) })
      .parse(await jsonBody(request));
    const valid = body.tickers.filter((t) =>
      companies.some((c) => c.ticker === t),
    );
    const data = await refreshData(valid);
    await evaluateScheduledAlerts(data);
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Invalid refresh request or unavailable storage" },
      { status: 400 },
    );
  }
}
