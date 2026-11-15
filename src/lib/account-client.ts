"use client";
import { useCallback, useEffect, useState } from "react";
export type AccountIdentity = { id: string; name: string; email: string };
export type AccountSession = {
  configured: boolean;
  user: AccountIdentity | null;
};
let pending: Promise<AccountSession> | null = null;
export function readAccountSession(force = false) {
  if (!pending || force) {
    const task: Promise<AccountSession> = fetch("/api/auth", {
      cache: "no-store",
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok)
          throw new Error(data.error ?? "Could not verify your session.");
        return data as AccountSession;
      })
      .finally(() => {
        if (pending === task) pending = null;
      });
    pending = task;
  }
  return pending;
}
export function accountChanged(signedOut = false) {
  window.dispatchEvent(
    new CustomEvent("finn-account-change", { detail: { signedOut } }),
  );
}
export function useAccountSession() {
  const [session, setSession] = useState<AccountSession>({
    configured: false,
    user: null,
  });
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await readAccountSession();
      setSession(result);
      setError("");
      return result;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not verify your session.",
      );
      return null;
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const update = (e: Event) => {
      if ((e as CustomEvent<{ signedOut?: boolean }>).detail?.signedOut)
        setSession((s) => ({ ...s, user: null }));
      void refresh();
    };
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("finn-account-change", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("finn-account-change", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  return { session, ready, error, refresh };
}
export function safeWorkspaceDestination(input: string | null) {
  return input === "/workspace" || input?.startsWith("/workspace?")
    ? input
    : "/workspace";
}
