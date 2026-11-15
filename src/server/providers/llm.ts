export type LlmConfiguration = {
  provider: "gemini" | "openai-compatible";
  apiKey: string;
  baseUrl: string;
  model: string;
};
const openaiBase = "https://api.openai.com/v1";
const geminiBase = "https://generativelanguage.googleapis.com/v1beta/openai";
export function resolveLlmConfiguration(
  env: Record<string, string | undefined> = process.env,
): LlmConfiguration | null {
  const hint = env.LLM_PROVIDER?.trim().toLowerCase();
  const generic = env.LLM_API_KEY?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim();
  const base = env.LLM_BASE_URL?.trim().replace(/\/$/, "");
  const isGemini =
    hint === "gemini" ||
    (hint !== "openai" &&
      hint !== "openai-compatible" &&
      Boolean(
        geminiKey ||
        generic?.startsWith("AIza") ||
        base?.includes("generativelanguage.googleapis.com") ||
        env.LLM_MODEL?.startsWith("gemini-"),
      ));
  if (isGemini) {
    const apiKey = geminiKey || generic;
    if (!apiKey) return null;
    return {
      provider: "gemini",
      apiKey,
      baseUrl: base && base !== openaiBase ? base : geminiBase,
      model:
        env.GEMINI_MODEL?.trim() ||
        (env.LLM_MODEL?.startsWith("gemini-")
          ? env.LLM_MODEL
          : "gemini-3.5-flash-lite"),
    };
  }
  const apiKey = generic || env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    provider: "openai-compatible",
    apiKey,
    baseUrl: base || openaiBase,
    model: env.LLM_MODEL?.trim() || "gpt-4.1-mini",
  };
}
