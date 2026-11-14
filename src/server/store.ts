import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
const memory = new Map<string, unknown>();
const folder = process.env.VERCEL
  ? "/tmp/finn-cache"
  : path.join(process.cwd(), ".cache");
function safeKey(key: string) {
  if (!/^[a-zA-Z0-9:_-]{1,180}$/.test(key))
    throw new Error("Invalid cache key");
  return key.replaceAll(":", "_");
}
async function hosted(key: string, method = "GET", value?: unknown) {
  const base = process.env.SUPABASE_URL,
    secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !secret) return null;
  const url =
    method === "GET"
      ? `${base}/rest/v1/app_cache?key=eq.${encodeURIComponent(key)}&select=value`
      : `${base}/rest/v1/app_cache?on_conflict=key`;
  const r = await fetch(url, {
    method,
    signal: AbortSignal.timeout(8000),
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body:
      method === "GET"
        ? undefined
        : JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`Persistence HTTP ${r.status}`);
  return method === "GET" ? (await r.json())[0]?.value : null;
}
export async function getCache<T>(key: string): Promise<T | null> {
  safeKey(key);
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const h = await hosted(key);
    if (h) {
      memory.set(key, h);
      return h as T;
    }
  } catch {
    /* Preserve local availability if hosted persistence fails. */
  }
  try {
    const v = JSON.parse(
      await readFile(path.join(folder, safeKey(key) + ".json"), "utf8"),
    );
    memory.set(key, v);
    return v;
  } catch {
    return null;
  }
}
export async function setCache(key: string, value: unknown) {
  const name = safeKey(key);
  memory.set(key, value);
  let persisted = false;
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await hosted(key, "POST", value);
      persisted = true;
    }
  } catch (e) {
    console.error(
      "Hosted cache write failed",
      e instanceof Error ? e.message : "unknown",
    );
  }
  try {
    await mkdir(folder, { recursive: true });
    const file = path.join(folder, name + ".json");
    const temp = file + "." + crypto.randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(value));
    await rename(temp, file);
  } catch {
    if (!persisted)
      console.error(
        "Cache is process-local; filesystem persistence unavailable.",
      );
  }
}
