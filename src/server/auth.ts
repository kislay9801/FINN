import { z } from "zod";

const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  user_metadata: z
    .object({ name: z.string().optional() })
    .passthrough()
    .optional(),
});
export type AccountUser = { id: string; email: string; name: string };
export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};
export class AuthError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function configuration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    return null;
  return { url: parsed.origin, key };
}
export function authConfigured() {
  try {
    return Boolean(configuration());
  } catch {
    return false;
  }
}
export async function authRequest(
  path: string,
  body?: unknown,
  token?: string,
  method = body ? "POST" : "GET",
) {
  const config = configuration();
  if (!config)
    throw new AuthError(
      "Email sign-in is not connected yet. You can continue using the guest workspace.",
      503,
    );
  let response: Response;
  try {
    response = await fetch(`${config.url}/auth/v1/${path}`, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        apikey: config.key,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AuthError(
      "The sign-in service could not be reached. Please try again.",
      503,
    );
  }
  const raw =
    response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429)
      throw new AuthError(
        "Too many attempts. Please wait before trying again.",
        429,
      );
    if (raw.error_code === "email_not_confirmed")
      throw new AuthError("Please confirm your email before signing in.", 401);
    if (response.status >= 500)
      throw new AuthError(
        "The sign-in service is temporarily unavailable.",
        503,
      );
    throw new AuthError(
      "Sign-in could not be completed. Check your email and password, or confirm your email first.",
      401,
    );
  }
  return raw;
}
export function accountUser(raw: unknown): AccountUser {
  const user = userSchema.parse(raw);
  return {
    id: user.id,
    email: user.email,
    name:
      user.user_metadata?.name?.trim().slice(0, 60) || user.email.split("@")[0],
  };
}
export function parseSession(raw: unknown): AuthSession | null {
  const parsed = z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().min(1),
      expires_in: z.number().positive(),
    })
    .safeParse(raw);
  return parsed.success ? parsed.data : null;
}
export const credentialsSchema = z.object({
  action: z.enum(["login", "signup"]),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(60).optional(),
});
