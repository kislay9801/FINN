import { timingSafeEqual } from "node:crypto";
import { refreshData } from "@/server/ingestion";
import { evaluateScheduledAlerts } from "@/server/alerts";
export const maxDuration = 120;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  const state = await refreshData();
  return Response.json({
    refreshedAt: state.refreshedAt,
    newAlerts: await evaluateScheduledAlerts(state),
    health: state.health,
  });
}
