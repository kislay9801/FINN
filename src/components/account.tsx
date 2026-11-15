"use client";
import { useCallback, useEffect, useState, useId } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  LogOut,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Drawer } from "./primitives";
type User = { id: string; name: string; email: string };
type Session = { configured: boolean; user: User | null };
let pendingSession: Promise<Session> | null = null;
function readSession() {
  if (!pendingSession)
    pendingSession = fetch("/api/auth", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok)
          throw new Error(data.error ?? "Could not check sign-in status.");
        return data as Session;
      })
      .finally(() => {
        pendingSession = null;
      });
  return pendingSession;
}
export function Account({ placement }: { placement: "sidebar" | "header" }) {
  const accountId = useId();
  const [open, setOpen] = useState(false),
    [session, setSession] = useState<Session>({
      configured: false,
      user: null,
    });
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login"),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [localName, setLocalName] = useState("");
  const refresh = useCallback(async () => {
    try {
      setSession(await readSession());
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not check sign-in status.",
      );
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    const update = () => {
      void refresh();
      setLocalName(localStorage.getItem("finn.workspace-name") ?? "");
    };
    update();
    window.addEventListener("finn-account-change", update);
    return () => window.removeEventListener("finn-account-change", update);
  }, [refresh]);
  const displayName = session.user?.name || localName || "Guest workspace";
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const authenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email,
          password,
          ...(mode === "signup" ? { name } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Sign-in failed.");
      setPassword("");
      if (data.confirmationRequired) setMessage(data.message);
      else {
        await refresh();
        window.dispatchEvent(new Event("finn-account-change"));
        setMessage("You’re signed in.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!r.ok) throw new Error("Could not sign out. Please try again.");
      setSession((s) => ({ ...s, user: null }));
      window.dispatchEvent(new Event("finn-account-change"));
      setMessage("You’re signed out. The guest workspace is still available.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        className={placement === "sidebar" ? "profile" : "account-trigger"}
        aria-label={
          placement === "sidebar"
            ? "Open workspace settings"
            : session.user
              ? "Open account"
              : "Log in"
        }
        onClick={() => {
          setOpen(true);
          setMessage("");
          void refresh();
        }}
      >
        {placement === "sidebar" ? (
          <>
            <span className="avatar">{initials}</span>
            <span>
              {displayName}
              <small>
                {session.user
                  ? "Signed in · Account settings"
                  : "Local preferences · Log in"}
              </small>
            </span>
            <Settings2 size={17} />
          </>
        ) : (
          <>
            <UserRound size={17} />
            <span>{session.user ? session.user.name : "Log in"}</span>
          </>
        )}
      </button>
      {open && (
        <Drawer
          eyebrow="FINN / YOUR WORKSPACE"
          title={
            session.user ? "Your workspace." : "Make room for your research."
          }
          onClose={() => {
            setOpen(false);
            setPassword("");
          }}
        >
          <div className="account-intro">
            <span className="account-icon">
              <UserRound size={25} />
            </span>
            <div>
              <strong>{displayName}</strong>
              <p>
                {session.user?.email ??
                  "Explore FINN freely. An account is optional."}
              </p>
            </div>
          </div>
          {!loaded ? (
            <p className="account-status">
              <LoaderCircle className="spin" size={18} />
              Checking sign-in…
            </p>
          ) : session.user ? (
            <div className="account-signed-in">
              <p>
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
            </div>
          ) : session.configured ? (
            <>
              <div
                className="account-tabs"
                role="tablist"
                aria-label="Account action"
                onKeyDown={(e) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? "login"
                      : e.key === "End"
                        ? "signup"
                        : mode === "login"
                          ? "signup"
                          : "login";
                  setMode(next);
                  setError("");
                  setMessage("");
                  e.currentTarget
                    .querySelectorAll<HTMLButtonElement>('[role="tab"]')
                    [next === "login" ? 0 : 1]?.focus();
                }}
              >
                <button
                  role="tab"
                  id={`${accountId}-login`}
                  aria-controls={`${accountId}-form`}
                  aria-selected={mode === "login"}
                  tabIndex={mode === "login" ? 0 : -1}
                  onClick={() => {
                    setMode("login");
                    setMessage("");
                    setError("");
                  }}
                >
                  Log in
                </button>
                <button
                  role="tab"
                  id={`${accountId}-signup`}
                  aria-controls={`${accountId}-form`}
                  aria-selected={mode === "signup"}
                  tabIndex={mode === "signup" ? 0 : -1}
                  onClick={() => {
                    setMode("signup");
                    setMessage("");
                    setError("");
                  }}
                >
                  Create account
                </button>
              </div>
              <form
                className="account-form"
                id={`${accountId}-form`}
                role="tabpanel"
                aria-labelledby={`${accountId}-${mode}`}
                onSubmit={authenticate}
              >
                {mode === "signup" && (
                  <label>
                    Your name
                    <input
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={60}
                      required
                    />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label>
                  Password
                  <span className="password-input">
                    <input
                      aria-label="Password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      maxLength={128}
                      placeholder="At least 8 characters"
                      required
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                <button
                  className="button primary full-width"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <LogIn size={17} />
                  )}{" "}
                  {busy
                    ? "Please wait…"
                    : mode === "login"
                      ? "Log in"
                      : "Create account"}
                  <ArrowRight size={17} />
                </button>
              </form>
            </>
          ) : (
            <div className="account-connection">
              <h3>Continue with your guest workspace.</h3>
              <p>
                Email sign-in is not connected on this deployment yet. Your
                watchlist, saved signals and alert preferences still work in
                this browser.
              </p>
              <details>
                <summary>Connect email sign-in</summary>
                <p>
                  In Vercel, add <code>SUPABASE_URL</code> and{" "}
                  <code>SUPABASE_ANON_KEY</code>, enable Supabase’s Email
                  provider, set the deployed site URL in Supabase Auth settings,
                  and redeploy.
                </p>
              </details>
            </div>
          )}
          {error && (
            <p className="warning-note" role="alert">
              {error}
              <button className="text-link" onClick={() => void refresh()}>
                Retry connection
              </button>
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
                localStorage.setItem("finn.workspace-name", localName.trim());
                window.dispatchEvent(new Event("finn-account-change"));
                setMessage("Workspace name saved on this device.");
              }}
            >
              <label>
                Workspace name
                <input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
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
              Watchlists, saved items and personal settings stay on this device.
              Signing in does not yet synchronize them across devices.
            </p>
          </section>
        </Drawer>
      )}
    </>
  );
}
