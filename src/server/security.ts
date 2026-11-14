const attempts = new Map<string, { at: number; count: number }>();
export function rateLimit(
  request: Request,
  scope: string,
  max = 10,
  windowMs = 60_000,
) {
  const key =
    scope +
    ":" +
    (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local");
  let row = attempts.get(key);
  if (!row || Date.now() - row.at > windowMs) {
    row = { at: Date.now(), count: 0 };
    attempts.set(key, row);
  }
  row.count++;
  if (attempts.size > 5000) {
    for (const [k, v] of attempts)
      if (Date.now() - v.at > windowMs) attempts.delete(k);
  }
  return row.count <= max;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const parsed = new URL(origin);
    const host = request.headers.get("host") ?? new URL(request.url).host;
    return (
      ["http:", "https:"].includes(parsed.protocol) && parsed.host === host
    );
  } catch {
    return false;
  }
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 8000)
    throw new Error("Request too large");
  const text = await request.text();
  if (text.length > 8000) throw new Error("Request too large");
  return JSON.parse(text);
}
