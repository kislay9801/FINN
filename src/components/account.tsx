"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, LogOut, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { accountChanged, type AccountIdentity } from "@/lib/account-client";
import { Drawer } from "./primitives";
export function Account({
  placement,
  user,
}: {
  placement: "sidebar" | "header";
  user?: AccountIdentity;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = `finn.${user?.id ?? "demo"}.workspace-name`;
  useEffect(() => {
    const update = () => {
      try {
        setName(localStorage.getItem(key) ?? "");
      } catch {}
    };
    update();
    window.addEventListener("finn-workspace-name", update);
    return () => window.removeEventListener("finn-workspace-name", update);
  }, [key]);
  const display = name || user?.name || "Demo workspace";
  const initials = display
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!r.ok) throw new Error("Could not sign out. Please try again.");
      accountChanged(true);
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign out.");
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={placement === "sidebar" ? "profile" : "account-trigger"}
        aria-label={
          placement === "sidebar"
            ? "Open workspace settings"
            : user
              ? "Open account"
              : "Open demo settings"
        }
        onClick={() => {
          setOpen(true);
          setMessage("");
        }}
      >
        {placement === "sidebar" ? (
          <>
            <span className="avatar">{initials}</span>
            <span>
              {display}
              <small>
                {user
                  ? "Signed in · Account settings"
                  : "Demo · Personal alerts off"}
              </small>
            </span>
            <Settings2 size={17} />
          </>
        ) : (
          <>
            <UserRound size={17} />
            <span>{user?.name ?? "Demo"}</span>
          </>
        )}
      </button>
      {open && (
        <Drawer
          eyebrow="FINN / YOUR WORKSPACE"
          title="Your workspace."
          onClose={() => setOpen(false)}
        >
          <div className="account-intro">
            <span className="account-icon">
              <UserRound size={25} />
            </span>
            <div>
              <strong>{display}</strong>
              <p>
                {user?.email ??
                  "A separate sample workspace for exploring FINN."}
              </p>
            </div>
          </div>
          {user ? (
            <>
              <p className="account-status">
                <ShieldCheck size={18} />
                Your email account is authenticated.
              </p>
              <button
                className="button subtle full-width"
                onClick={logout}
                disabled={busy}
              >
                <LogOut size={17} />
                {busy ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <div className="account-connection">
              <h3>You’re exploring the demo.</h3>
              <p>
                Personal notifications are off. Sign in to open your own
                workspace.
              </p>
              <Link className="button primary full-width" href="/login">
                Go to login
              </Link>
            </div>
          )}
          {error && (
            <p className="warning-note" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="account-success" role="status">
              <Check size={17} />
              {message}
            </p>
          )}
          <section className="workspace-preferences">
            <span className="eyebrow green">PERSONAL PREFERENCES</span>
            <h3>Your desk, your way.</h3>
            <form
              className="account-form"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  localStorage.setItem(key, name.trim());
                  window.dispatchEvent(new Event("finn-workspace-name"));
                  setMessage("Workspace name saved on this device.");
                } catch {
                  setError(
                    "Browser storage is unavailable. Your change could not be saved.",
                  );
                }
              }}
            >
              <label>
                Workspace name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  placeholder="My research desk"
                />
              </label>
              <button className="button subtle" type="submit">
                Save workspace name
                <Check size={16} />
              </button>
            </form>
            <p className="account-privacy">
              Watchlists and preferences are stored on this device, separately
              for each account. Cross-device synchronization is not yet enabled.
            </p>
          </section>
        </Drawer>
      )}
    </>
  );
}
