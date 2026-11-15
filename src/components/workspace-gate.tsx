"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useAccountSession } from "@/lib/account-client";
import Finn from "./finn";
export function WorkspaceGate() {
  const { session, ready, error, refresh } = useAccountSession();
  const router = useRouter();
  useEffect(() => {
    if (ready && !session.user && !error)
      router.replace(
        "/login?next=" +
          encodeURIComponent("/workspace" + window.location.search),
      );
  }, [ready, session.user, error, router]);
  if (!ready || !session.user)
    return (
      <main className="access-loading">
        <ShieldCheck size={28} />
        <h1>
          {error
            ? "Your session needs a closer look."
            : "Opening your workspace."}
        </h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="button primary" onClick={() => void refresh()}>
              Try again
            </button>
          </>
        ) : (
          <p>
            <LoaderCircle className="spin" size={18} />
            Verifying your sign-in…
          </p>
        )}
      </main>
    );
  return <Finn key={session.user.id} user={session.user} />;
}
