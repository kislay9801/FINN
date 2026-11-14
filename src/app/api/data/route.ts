import { initialData } from "@/server/ingestion";
import { getCache } from "@/server/store";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      ...(await initialData()),
      scheduledAlerts: (await getCache("alerts")) ?? [],
      mode: process.env.SUPABASE_URL ? "hosted" : "local",
      llmConfigured: Boolean(process.env.LLM_API_KEY),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
