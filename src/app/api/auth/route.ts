import { cookies } from "next/headers";
import {
  authConfigured,
  authRequest,
  accountUser,
  parseSession,
  credentialsSchema,
  AuthError,
  type AuthSession,
} from "@/server/auth";
import { jsonBody, rateLimit, sameOrigin } from "@/server/security";
import { z } from "zod";
export const dynamic = "force-dynamic";
const accessName = "finn-access";
const refreshName = "finn-refresh";
const cacheHeaders = { "Cache-Control": "no-store, private", Vary: "Cookie" };
async function saveSession(session: AuthSession) {
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  jar.set(accessName, session.access_token, {
    ...options,
    maxAge: Math.min(session.expires_in, 3600),
  });
  jar.set(refreshName, session.refresh_token, {
    ...options,
    maxAge: 30 * 86400,
  });
}
async function clearSession() {
  const jar = await cookies();
  jar.delete(accessName);
  jar.delete(refreshName);
}
function failure(e: unknown) {
  if (e instanceof AuthError)
    return Response.json(
      { error: e.message },
      { status: e.status, headers: cacheHeaders },
    );
  return Response.json(
    {
      error:
        e instanceof z.ZodError
          ? "Enter a valid email and a password of 8–128 characters."
          : "The account request could not complete. Please try again.",
    },
    { status: 400, headers: cacheHeaders },
  );
}
export async function GET() {
  if (!authConfigured())
    return Response.json(
      { configured: false, user: null },
      { headers: cacheHeaders },
    );
  const jar = await cookies(),
    access = jar.get(accessName)?.value,
    refresh = jar.get(refreshName)?.value;
  if (!access && !refresh)
    return Response.json(
      { configured: true, user: null },
      { headers: cacheHeaders },
    );
  try {
    if (access) {
      try {
        return Response.json(
          {
            configured: true,
            user: accountUser(await authRequest("user", undefined, access)),
          },
          { headers: cacheHeaders },
        );
      } catch (e) {
        if (!(e instanceof AuthError) || e.status !== 401) throw e;
      }
    }
    if (!refresh) {
      await clearSession();
      return Response.json(
        { configured: true, user: null },
        { headers: cacheHeaders },
      );
    }
    const session = parseSession(
      await authRequest("token?grant_type=refresh_token", {
        refresh_token: refresh,
      }),
    );
    if (!session)
      throw new AuthError(
        "Your session has expired. Please sign in again.",
        401,
      );
    const user = accountUser(
      await authRequest("user", undefined, session.access_token),
    );
    await saveSession(session);
    return Response.json({ configured: true, user }, { headers: cacheHeaders });
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) {
      await clearSession();
      return Response.json(
        { configured: true, user: null },
        { headers: cacheHeaders },
      );
    }
    return failure(e);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin rejected" }, { status: 403 });
  if (!rateLimit(request, "auth", 8))
    return Response.json(
      { error: "Too many account attempts. Please wait a minute." },
      { status: 429 },
    );
  try {
    const input = await jsonBody(request);
    if (input.action === "logout") {
      const token = (await cookies()).get(accessName)?.value;
      if (token && authConfigured()) {
        try {
          await authRequest("logout?scope=local", undefined, token, "POST");
        } catch {
          /* Always clear this browser's session. */
        }
      }
      await clearSession();
      return Response.json({ user: null }, { headers: cacheHeaders });
    }
    const fields = credentialsSchema.parse(input);
    const raw = await authRequest(
      fields.action === "login" ? "token?grant_type=password" : "signup",
      {
        email: fields.email,
        password: fields.password,
        ...(fields.action === "signup" && fields.name
          ? { data: { name: fields.name } }
          : {}),
      },
    );
    const session = parseSession(raw);
    if (!session) {
      if (fields.action === "signup")
        return Response.json(
          {
            confirmationRequired: true,
            message:
              "Check your email to confirm your account, then return here to sign in.",
          },
          { headers: cacheHeaders },
        );
      throw new AuthError(
        "Sign-in did not return a valid session. Please try again.",
        502,
      );
    }
    const user = accountUser(
      await authRequest("user", undefined, session.access_token),
    );
    await saveSession(session);
    return Response.json({ user }, { headers: cacheHeaders });
  } catch (e) {
    return failure(e);
  }
}
