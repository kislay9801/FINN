"use client";
import { useId, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  Check,
} from "lucide-react";
import { accountChanged, readAccountSession } from "@/lib/account-client";
export function AuthForm({
  configured,
  ready,
  onSuccess,
}: {
  configured: boolean;
  ready: boolean;
  onSuccess: () => void;
}) {
  const id = useId(),
    [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
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
      if (!r.ok) throw new Error(data.error ?? "Sign-in could not complete.");
      setPassword("");
      if (data.confirmationRequired) {
        setMessage(data.message);
        return;
      }
      const verified = await readAccountSession(true);
      if (!verified.user)
        throw new Error(
          "Your session could not be verified. Please sign in again.",
        );
      accountChanged();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in could not complete.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className="account-tabs"
        role="tablist"
        aria-label="Account action"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
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
        {(["login", "signup"] as const).map((action) => (
          <button
            key={action}
            type="button"
            role="tab"
            id={`${id}-${action}`}
            aria-selected={mode === action}
            aria-controls={`${id}-form`}
            tabIndex={mode === action ? 0 : -1}
            onClick={() => {
              setMode(action);
              setError("");
              setMessage("");
            }}
          >
            {action === "login" ? "Log in" : "Create account"}
          </button>
        ))}
      </div>
      <form
        className="account-form"
        id={`${id}-form`}
        role="tabpanel"
        aria-labelledby={`${id}-${mode}`}
        onSubmit={submit}
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
              type={visible ? "text" : "password"}
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
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <button
          type="submit"
          className="button primary full-width"
          disabled={busy || !ready || !configured}
        >
          {busy || !ready ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <LogIn size={17} />
          )}{" "}
          {!ready
            ? "Connecting…"
            : busy
              ? "Please wait…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
          <ArrowRight size={17} />
        </button>
      </form>
      {ready && !configured && (
        <p className="login-config-note" role="status">
          Secure sign-in is not connected yet. The source-backed demo is
          available below.
        </p>
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
    </>
  );
}
