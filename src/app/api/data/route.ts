import { initialData } from "@/server/ingestion";
import { resolveLlmConfiguration } from "@/server/providers/llm";
export const dynamic = "force-dynamic";
export async function GET() {
  const ai = resolveLlmConfiguration();
  return Response.json(
    {
      ...(await initialData()),
      mode: process.env.SUPABASE_URL ? "hosted" : "local",
      llmConfigured: Boolean(ai),
      aiProvider: ai?.provider ?? null,
      aiModel: ai?.model ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
