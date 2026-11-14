import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
const fixed = [
  "nsearchives.nseindia.com",
  "archives.nseindia.com",
  "www.nseindia.com",
  "www.nseindia.in",
  "query1.finance.yahoo.com",
  "www.screener.in",
  "www.infosys.com",
  "www.bseindia.com",
  "www.annualreports.com",
];
export function allowedUrl(input: string, extra: string[] = []) {
  try {
    const u = new URL(input);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      [...fixed, ...extra].some((h) => u.hostname === h)
    );
  } catch {
    return false;
  }
}
function privateIp(ip: string) {
  return (
    ip.includes(":") ||
    /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(
      ip,
    )
  );
}
export async function fetchSafe(
  input: string,
  extra: string[] = [],
  maxBytes = 32_000_000,
  redirects = 0,
): Promise<Buffer> {
  if (redirects > 3) throw new Error("Source redirect limit reached.");
  if (!allowedUrl(input, extra))
    throw new Error("Source domain is not approved.");
  const host = new URL(input).hostname;
  if (isIP(host)) throw new Error("IP destinations are not supported.");
  const addresses = await lookup(host, { all: true, family: 4 });
  if (!addresses.length || addresses.some((x) => privateIp(x.address)))
    throw new Error("Non-public source address rejected.");
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(input, {
        redirect: "manual",
        signal: AbortSignal.timeout(18000),
        headers: {
          "User-Agent": "FINN/1.0 (public-source investment research)",
          Accept: "*/*",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("Redirect without destination.");
        return fetchSafe(
          new URL(location, input).href,
          extra,
          maxBytes,
          redirects + 1,
        );
      }
      if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
      if (Number(response.headers.get("content-length")) > maxBytes)
        throw new Error("Document exceeds size limit.");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Empty source response.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          throw new Error("Source exceeds size limit.");
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks);
    } catch (e) {
      last = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw last;
}
export async function bounded<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const output: PromiseSettledResult<R>[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const i = cursor++;
        try {
          output[i] = { status: "fulfilled", value: await fn(values[i]) };
        } catch (reason) {
          output[i] = { status: "rejected", reason };
        }
      }
    }),
  );
  return output;
}
