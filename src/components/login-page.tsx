"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  ShieldCheck,
  Activity,
  Layers,
} from "lucide-react";
import { AuthForm } from "./auth-form";
import {
  safeWorkspaceDestination,
  useAccountSession,
} from "@/lib/account-client";
export function LoginPage() {
  const { session, ready, error, refresh } = useAccountSession();
  const router = useRouter();
  const enter = () =>
    router.replace(
      safeWorkspaceDestination(
        new URLSearchParams(window.location.search).get("next"),
      ),
    );
  useEffect(() => {
    if (ready && session.user)
      router.replace(
        safeWorkspaceDestination(
          new URLSearchParams(window.location.search).get("next"),
        ),
      );
  }, [ready, session.user, router]);
  return (
    <main className="login-page">
      <section className="login-story">
        <Link className="login-brand" href="/login" aria-label="FINN home">
          finn<span>.</span>
        </Link>
        <div className="login-editorial">
          <span className="eyebrow">SIGNAL OVER NOISE</span>
          <h1>
            Your next question.
            <br />
            <em>Better evidence.</em>
          </h1>
          <p>
            An investment intelligence desk for the things that deserve a closer
            look.
          </p>
          <div className="login-principles">
            <div>
              <Activity size={21} />
              <span>
                <strong>Discover what changed.</strong>
                <small>
                  Portfolio signals, with the routine noise set aside.
                </small>
              </span>
            </div>
            <div>
              <FileText size={21} />
              <span>
                <strong>Understand the evidence.</strong>
                <small>
                  Original filings, reported numbers and useful context.
                </small>
              </span>
            </div>
            <div>
              <Layers size={21} />
              <span>
                <strong>Investigate further.</strong>
                <small>
                  Connect management’s words with financial outcomes.
                </small>
              </span>
            </div>
          </div>
        </div>
        <footer>PRIMARY SOURCES. INDEPENDENT JUDGMENT.</footer>
      </section>
      <section className="login-entry">
        <div className="login-card">
          <span className="eyebrow green">YOUR RESEARCH WORKSPACE</span>
          <h2>
            Welcome to
            <br />a clearer view.
          </h2>
          <p className="login-intro">
            Sign in to open your workspace and manage your own alerts.
          </p>
          <AuthForm
            configured={session.configured}
            ready={ready}
            onSuccess={enter}
          />
          {error && (
            <p className="warning-note" role="alert">
              {error}
              <button className="text-link" onClick={() => void refresh()}>
                Retry connection
              </button>
            </p>
          )}
          <div className="login-demo">
            <span>Take a look around first.</span>
            <Link className="button subtle full-width" href="/demo">
              Explore source-backed demo
              <ArrowRight size={17} />
            </Link>
            <small>Shared sample portfolio. No personal notifications.</small>
          </div>
          <p className="login-security">
            <ShieldCheck size={16} />
            Secure email sign-in. No brokerage connection.
          </p>
        </div>
        <p className="login-disclaimer">
          Research support. Not investment advice.
        </p>
      </section>
    </main>
  );
}
