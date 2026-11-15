"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Account } from "./account";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  FileText,
  Layers,
  LayoutGrid,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  Volume2,
  X,
} from "lucide-react";
import { portfolio as seed, candidates } from "@/data/companies";
import {
  alertMatches,
  dedupe,
  marketStats,
  priceSignals,
  prioritySort,
} from "@/lib/finance";
import {
  categories,
  defaultRules,
  type Category,
  type Citation,
  type Company,
  type DataState,
  type Research,
  type Rules,
  type Signal,
} from "@/types";
import type { financialComparison } from "@/server/research/financials";
import {
  Drawer,
  Source,
  Sparkline,
  formatDate,
  number,
  pct,
} from "./primitives";
type View = "today" | "portfolio" | "research" | "alerts";
type ResearchResult = Research & {
  financials: ReturnType<typeof financialComparison>;
};
type Notice = Signal & { evaluatedAt: string; read: boolean };
const nav = [
  { key: "today" as const, label: "Today", icon: LayoutGrid },
  { key: "portfolio" as const, label: "Portfolio", icon: Layers },
  { key: "research" as const, label: "Research", icon: Sparkles },
  { key: "alerts" as const, label: "Alerts", icon: Bell },
];
const label = (s: string) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setValue(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (ready) localStorage.setItem(key, JSON.stringify(value));
  }, [key, value, ready]);
  return [value, setValue, ready] as const;
}
async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "The request could not complete.");
  return data;
}
export default function Finn() {
  const [clock, setClock] = useState(0);
  useEffect(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [view, setView] = useState<View>("today"),
    [data, setData] = useState<DataState | null>(null),
    [loadError, setLoadError] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [toast, setToast] = useState("");
  const [watchlist, setWatchlist, watchReady] = useStored<Company[]>(
      "finn.watchlist.v1",
      seed,
    ),
    [rules, setRules, rulesReady] = useStored<Rules>(
      "finn.rules.v1",
      defaultRules,
    ),
    [saved, setSaved] = useStored<string[]>("finn.saved.v1", []),
    [reviewed, setReviewed] = useStored<string[]>("finn.reviewed.v1", []),
    [notices, setNotices, noticesReady] = useStored<Notice[]>(
      "finn.notices.v1",
      [],
    );
  const [windowDays, setWindowDays] = useState("1"),
    [category, setCategory] = useState("all"),
    [priority, setPriority] = useState("all"),
    [companyFilter, setCompanyFilter] = useState("all"),
    [onlySaved, setOnlySaved] = useState(false),
    [filters, setFilters] = useState(false),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [selected, setSelected] = useState<Signal | null>(null),
    [evidence, setEvidence] = useState<Citation | null>(null),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState(""),
    [searchResults, setSearchResults] = useState<Company[]>([]),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState("");
  const [eventContext, setEventContext] = useState<Signal | null>(null);
  const [ticker, setTicker] = useState("INFY"),
    [research, setResearch] = useState<ResearchResult | null>(null),
    [researching, setResearching] = useState(false),
    [researchError, setResearchError] = useState(""),
    [activeSection, setActiveSection] = useState("Business snapshot"),
    [question, setQuestion] = useState(""),
    [history, setHistory] = useStored<
      { ticker: string; question: string; answer: string; at: string }[]
    >("finn.history.v1", []);
  const [filing, setFiling] = useState<{
      document: {
        title: string;
        url: string;
        pages: { page: number; text: string }[];
      };
      financials: ReturnType<typeof financialComparison>;
    } | null>(null),
    [filingBusy, setFilingBusy] = useState(false),
    [filingError, setFilingError] = useState("");
  const tell = useCallback((text: string) => {
    setToast(text);
  }, []);
  const navigate = useCallback((next: View, symbol?: string) => {
    setView(next);
    if (symbol) setTicker(symbol);
    window.history.pushState(
      null,
      "",
      `/?view=${next}${symbol ? "&ticker=" + encodeURIComponent(symbol) : ""}`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    const sync = () => {
      const p = new URLSearchParams(location.search);
      const v = p.get("view");
      if (nav.some((n) => n.key === v)) setView(v as View);
      const t = p.get("ticker");
      if (t && /^[A-Z0-9&-]{1,25}$/.test(t)) setTicker(t);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    fetch("/api/data")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load the source archive.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setLoadError(e.message));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    if (!searchOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError("");
      fetch(`/api/companies?q=${encodeURIComponent(search)}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then(setSearchResults)
        .catch((e) => {
          if (e.name !== "AbortError")
            setSearchError("Company search is unavailable. Try again.");
        })
        .finally(() => setSearching(false));
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, searchOpen]);
  const allSignals = useMemo(
    () =>
      data
        ? prioritySort(
            dedupe([
              ...data.announcements.filter((a) =>
                watchlist.some((c) => c.ticker === a.ticker),
              ),
              ...data.prices
                .filter((p) => watchlist.some((c) => c.ticker === p.ticker))
                .flatMap((p) =>
                  priceSignals(
                    p,
                    rules,
                    watchlist.find((c) => c.ticker === p.ticker)?.name ??
                      p.ticker,
                  ),
                ),
            ]),
          )
        : [],
    [data, watchlist, rules],
  );
  const filtered = useMemo(
    () =>
      allSignals.filter((s) => {
        const date = Date.parse(s.publishedAt);
        const now = clock;
        const inWindow =
          windowDays === "custom"
            ? (!start || date >= Date.parse(start + "T00:00:00+05:30")) &&
              (!end || date <= Date.parse(end + "T23:59:59+05:30"))
            : date >= now - Number(windowDays) * 86400_000;
        return (
          date <= now &&
          inWindow &&
          (category === "all" || s.category === category) &&
          (companyFilter === "all" || s.ticker === companyFilter) &&
          (priority === "all" || s.priority >= Number(priority)) &&
          (!onlySaved || saved.includes(s.id))
        );
      }),
    [
      allSignals,
      clock,
      windowDays,
      start,
      end,
      category,
      priority,
      companyFilter,
      onlySaved,
      saved,
    ],
  );
  const material = filtered.filter((s) => !s.routine),
    routine = filtered.filter((s) => s.routine);
  const movers = useMemo(
    () =>
      data?.prices
        .filter((p) => watchlist.some((c) => c.ticker === p.ticker))
        .map((p) => ({ p, s: marketStats(p) }))
        .filter((x) => x.s.last)
        .sort(
          (a, b) => Math.abs(b.s.change ?? 0) - Math.abs(a.s.change ?? 0),
        ) ?? [],
    [data, watchlist],
  );
  useEffect(() => {
    if (!data || !watchReady || !rulesReady || !noticesReady || !rules.enabled)
      return;
    const now = new Date().toISOString();
    const matches = allSignals.filter(
      (s) =>
        alertMatches(s, rules) &&
        Date.now() - Date.parse(s.publishedAt) < 30 * 86400_000,
    );
    setNotices((old) => {
      const existing = new Set(old.map((n) => n.id));
      const fresh = matches.filter((s) => !existing.has(s.id));
      if (!fresh.length) return old;
      return [
        ...fresh.map((s) => ({ ...s, evaluatedAt: now, read: false })),
        ...old,
      ].slice(0, 300);
    });
  }, [
    allSignals,
    data,
    watchReady,
    rulesReady,
    noticesReady,
    rules,
    setNotices,
  ]);
  const loadResearch = useCallback(
    async (symbol: string, query?: string) => {
      setResearching(true);
      setResearchError("");
      try {
        const r = await post<ResearchResult>("/api/research", {
          ticker: symbol,
          question: query,
          signalId:
            eventContext?.ticker === symbol ? eventContext.id : undefined,
        });
        setResearch(r);
        if (query)
          setHistory((h) =>
            [
              {
                ticker: symbol,
                question: query,
                answer: r.answer ?? "No answer available.",
                at: new Date().toISOString(),
              },
              ...h,
            ].slice(0, 30),
          );
      } catch (e) {
        setResearchError(
          e instanceof Error ? e.message : "Research unavailable.",
        );
      } finally {
        setResearching(false);
      }
    },
    [setHistory, eventContext],
  );
  useEffect(() => {
    if (view === "research") {
      setResearch(null);
      setQuestion("");
      void loadResearch(ticker);
    }
  }, [view, ticker, loadResearch]);
  useEffect(() => {
    setFiling(null);
    setFilingError("");
  }, [selected?.id]);
  const refresh = async () => {
    setRefreshing(true);
    try {
      setData(
        await post<DataState>("/api/refresh", {
          tickers: watchlist.map((c) => c.ticker),
        }),
      );
      tell("Refresh completed. Check source health for provider coverage.");
    } catch (e) {
      tell(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };
  const toggleSaved = (id: string) =>
    setSaved((old) =>
      old.includes(id) ? old.filter((s) => s !== id) : [...old, id],
    );
  const openResearch = (symbol: string, context?: Signal) => {
    setEventContext(context ?? null);
    setSelected(null);
    navigate("research", symbol);
    if (context) tell(`Investigating ${symbol}: ${context.title}`);
  };
  const loadFiling = async () => {
    if (!selected) return;
    setFilingBusy(true);
    setFilingError("");
    try {
      setFiling(await post("/api/evidence", { id: selected.id }));
    } catch (e) {
      setFilingError(e instanceof Error ? e.message : "Filing unavailable.");
    } finally {
      setFilingBusy(false);
    }
  };
  const delivered = useRef(new Set<string>());
  useEffect(() => {
    if (!noticesReady) return;
    const fresh = notices.filter(
      (n) =>
        !delivered.current.has(n.id) &&
        Date.now() - Date.parse(n.evaluatedAt) < 15_000,
    );
    notices.forEach((n) => delivered.current.add(n.id));
    if ("Notification" in window && Notification.permission === "granted") {
      for (const n of fresh.slice(0, 3)) {
        try {
          new Notification(`${n.ticker} · ${label(n.category)}`, {
            body: n.title,
            tag: n.id,
          });
        } catch {
          /* In-app history remains available on browsers that require a service worker. */
        }
      }
    }
  }, [notices, noticesReady]);
  const unread = notices.filter((n) => !n.read).length;
  const health = data?.health ?? [];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="FINN home">
          finn<span className="brand-dot">.</span>
        </Link>
        <div className="brand-caption">SIGNAL OVER NOISE</div>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.key}
              className={view === n.key ? "nav-link active" : "nav-link"}
              onClick={() => navigate(n.key)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.key === "alerts" && unread > 0 && <b>{unread}</b>}
              {view === n.key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="orbit">
            <Activity size={20} />
          </div>
          <strong>Built for the long view.</strong>
          <p>
            Primary sources.
            <br />A clearer perspective.
          </p>
          <span>ENAM BUILD CHALLENGE / 2026</span>
        </div>
        <Account placement="sidebar" />
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">
            finn<span>.</span>
          </div>
          <span className="breadcrumb">
            WORKSPACE <span>/</span> {label(view)}
          </span>
          <div className="top-actions">
            <Account placement="header" />
            <span className="local-tag">
              <i />
              SOURCE-BACKED ARCHIVE
            </span>
            <button
              className="search-trigger"
              aria-label="Search companies"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>Find a company</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button notification-bell"
              aria-label={`${unread} unread alerts`}
              onClick={() => navigate("alerts")}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
          </div>
        </header>
        <div className="page-content">
          {view === "today" && (
            <>
              <div className="page-kicker">
                <span>
                  <i className="status-dot" /> YOUR DAILY INTELLIGENCE
                </span>
                <time>
                  {clock
                    ? new Intl.DateTimeFormat("en-IN", {
                        timeZone: "Asia/Kolkata",
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(clock))
                    : "Loading date…"}
                </time>
              </div>
              <section className="brief-hero">
                <div className="hero-copy">
                  <span className="eyebrow">LESS TO READ. MORE TO KNOW.</span>
                  <h1>
                    Your portfolio,
                    <br />
                    <em>distilled.</em>
                  </h1>
                  <p>
                    {data ? (
                      <>
                        <strong>
                          {material.length} development
                          {material.length === 1 ? "" : "s"}
                        </strong>{" "}
                        in your selected window.
                        <br />
                        The evidence is here. The judgment is yours.
                      </>
                    ) : (
                      "Connecting your portfolio to the source."
                    )}
                  </p>
                </div>
                <div className="hero-ledger">
                  <div>
                    <span>COMPANIES WATCHED</span>
                    <strong>
                      {watchlist.length.toString().padStart(2, "0")}
                      <Layers size={23} />
                    </strong>
                  </div>
                  <div>
                    <span>SIGNALS TO EXPLORE</span>
                    <strong>
                      {material.length.toString().padStart(2, "0")}
                      <ArrowUpRight size={25} />
                    </strong>
                  </div>
                  <div>
                    <span>ROUTINE FILINGS FILTERED</span>
                    <strong>
                      {routine.length.toString().padStart(2, "0")}
                      <CheckCheck size={24} />
                    </strong>
                  </div>
                  <small>
                    Counts reflect retrieved records in your window.
                  </small>
                </div>
                <span className="hero-watermark" aria-hidden="true">
                  f.
                </span>
              </section>
              <div className="data-strip">
                <span>
                  <ShieldCheck size={14} />{" "}
                  {data
                    ? data.refreshedAt
                      ? "Refreshed sources · EOD, not live prices"
                      : "Cached real observations · EOD, not live prices"
                    : "Loading source archive…"}
                </span>
                <button onClick={refresh} disabled={refreshing}>
                  <RefreshCw size={13} className={refreshing ? "spin" : ""} />
                  {refreshing ? "Refreshing…" : "Refresh sources"}
                </button>
              </div>
              <div className="content-columns">
                <section className="feed-column">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow green">
                        CURATED FOR YOUR WATCHLIST
                      </span>
                      <h2>
                        The signal brief
                        <span className="small-count">{material.length}</span>
                      </h2>
                    </div>
                    <button
                      className={"icon-button " + (filters ? "selected" : "")}
                      aria-label="Toggle signal filters"
                      onClick={() => setFilters(!filters)}
                    >
                      <SlidersHorizontal size={18} />
                    </button>
                  </div>
                  <div className="feed-toolbar">
                    <div className="segmented" aria-label="Time window">
                      {[
                        ["1", "24 hours"],
                        ["7", "7 days"],
                        ["30", "30 days"],
                        ["custom", "Custom"],
                      ].map(([v, l]) => (
                        <button
                          aria-pressed={windowDays === v}
                          className={windowDays === v ? "selected" : ""}
                          key={v}
                          onClick={() => setWindowDays(v)}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <button
                      className={"saved-toggle " + (onlySaved ? "green" : "")}
                      onClick={() => setOnlySaved(!onlySaved)}
                      aria-pressed={onlySaved}
                    >
                      <Bookmark size={15} />
                      <span>Saved</span>
                    </button>
                  </div>
                  {(filters || windowDays === "custom") && (
                    <div className="filter-panel">
                      {windowDays === "custom" && (
                        <>
                          <label>
                            From
                            <input
                              type="date"
                              value={start}
                              onChange={(e) => setStart(e.target.value)}
                            />
                          </label>
                          <label>
                            Through
                            <input
                              type="date"
                              value={end}
                              min={start}
                              onChange={(e) => setEnd(e.target.value)}
                            />
                          </label>
                        </>
                      )}
                      <label>
                        Category
                        <select
                          aria-label="Category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          <option value="all">All categories</option>
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {label(c)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Priority
                        <select
                          aria-label="Priority"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                        >
                          <option value="all">All priorities</option>
                          <option value="80">High · 80+</option>
                          <option value="50">Medium and high · 50+</option>
                        </select>
                      </label>
                      <label>
                        Company
                        <select
                          aria-label="Company filter"
                          value={companyFilter}
                          onChange={(e) => setCompanyFilter(e.target.value)}
                        >
                          <option value="all">All watched</option>
                          {watchlist.map((c) => (
                            <option key={c.ticker}>{c.ticker}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  {loadError && (
                    <div className="error-state">
                      {loadError}
                      <button onClick={() => location.reload()}>Retry</button>
                    </div>
                  )}
                  {!data && !loadError ? (
                    <div className="skeleton-list">
                      <div />
                      <div />
                      <div />
                    </div>
                  ) : material.length ? (
                    material.map((s, i) => (
                      <SignalCard
                        key={s.id}
                        signal={s}
                        first={i === 0}
                        saved={saved.includes(s.id)}
                        reviewed={reviewed.includes(s.id)}
                        onOpen={() => setSelected(s)}
                        onSave={() => toggleSaved(s.id)}
                        onResearch={() => openResearch(s.ticker, s)}
                      />
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <CheckCheck size={27} />
                      </div>
                      <h3>A quieter window.</h3>
                      <p>
                        No significant signals match these filters. A quiet feed
                        is useful, too. Source coverage is limited to the
                        captured filing archive and available market sessions.
                      </p>
                      <button
                        className="button subtle"
                        onClick={() => {
                          setWindowDays("30");
                          setCategory("all");
                          setPriority("all");
                          setCompanyFilter("all");
                          setOnlySaved(false);
                        }}
                      >
                        Explore the last 30 days <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                  <details className="routine">
                    <summary>
                      <span>
                        <Layers size={15} />
                        {routine.length} routine filing
                        {routine.length === 1 ? "" : "s"} kept in the background
                      </span>
                      <ChevronDown size={16} />
                    </summary>
                    <p>
                      Procedural notices and low-priority disclosures remain
                      available for inspection.
                    </p>
                    {routine.map((s) => (
                      <button key={s.id} onClick={() => setSelected(s)}>
                        <b>{s.ticker}</b>
                        <span>{s.title}</span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </details>
                  <div className="end-note">
                    <span />
                    YOU’RE LOOKING AT THE SIGNAL.
                    <span />
                  </div>
                </section>
                <aside className="context-column">
                  <div className="market-panel">
                    <div className="section-heading compact">
                      <h3>At the close</h3>
                      <span className="tiny-tag">EOD</span>
                    </div>
                    <p className="muted small">
                      Largest absolute moves in your watchlist
                    </p>
                    {movers.slice(0, 5).map(({ p, s }) => (
                      <button
                        className="mover"
                        key={p.ticker}
                        onClick={() => openResearch(p.ticker)}
                      >
                        <div>
                          <strong>{p.ticker}</strong>
                          <small>
                            {s.last && formatDate(s.last.date, true)}
                          </small>
                        </div>
                        <Sparkline
                          values={s.sessions.slice(-20).map((x) => x.close)}
                          positive={(s.change ?? 0) >= 0}
                        />
                        <div>
                          <b>₹{number(s.last?.close, 2)}</b>
                          <small
                            className={
                              (s.change ?? 0) >= 0 ? "positive" : "negative"
                            }
                          >
                            {pct(s.change)}
                          </small>
                        </div>
                      </button>
                    ))}
                    <button
                      className="text-link"
                      onClick={() => navigate("portfolio")}
                    >
                      Open portfolio <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="research-prompt">
                    <span className="eyebrow">GO BEYOND THE HEADLINE</span>
                    <div className="prompt-symbol">
                      <Sparkles size={25} />
                    </div>
                    <h3>
                      What did management
                      <br />
                      <em>actually deliver?</em>
                    </h3>
                    <p>
                      Put the promises next to the performance. Read both sides
                      of the evidence.
                    </p>
                    <button onClick={() => openResearch("INFY")}>
                      Investigate Infosys <ArrowUpRight size={16} />
                    </button>
                    <small>5 transcript periods captured</small>
                  </div>
                  <HealthPanel health={health} />
                </aside>
              </div>
            </>
          )}
          {view === "portfolio" && (
            <>
              <PageHeading
                kicker="THE COMPANIES YOU FOLLOW"
                title="Your portfolio."
                description={`${watchlist.length} companies. One connected research desk.`}
                action={
                  <button
                    className="button primary"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Plus size={17} />
                    Add company
                  </button>
                }
              />
              <div className="portfolio-summary">
                <div>
                  <span>WATCHLIST</span>
                  <strong>
                    {watchlist.length} <small>companies</small>
                  </strong>
                </div>
                <div>
                  <span>SECTOR COVERAGE</span>
                  <strong>
                    {new Set(watchlist.map((c) => c.sector)).size}{" "}
                    <small>sectors</small>
                  </strong>
                </div>
                <div>
                  <span>DATA BASIS</span>
                  <strong className="summary-word">End of day</strong>
                  <small>Actual observations · unadjusted closes</small>
                </div>
              </div>
              <div className="table-container">
                <table className="portfolio-table">
                  <thead>
                    <tr>
                      <th>COMPANY</th>
                      <th>LAST CLOSE / ₹</th>
                      <th>1D CHANGE</th>
                      <th className="desktop-cell">20 SESSIONS</th>
                      <th>VOLUME / AVG.</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((c) => {
                      const p = data?.prices.find((p) => p.ticker === c.ticker),
                        s = p ? marketStats(p) : null;
                      return (
                        <tr key={c.ticker}>
                          <td>
                            <button
                              className="company-cell"
                              onClick={() => openResearch(c.ticker)}
                            >
                              <span className="company-monogram">
                                {c.ticker.slice(0, 2)}
                              </span>
                              <span>
                                <strong>{c.name}</strong>
                                <small>
                                  {c.ticker} <span>· {c.sector}</span>
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>
                            {s?.last ? (
                              <>
                                <strong className="tabular">
                                  {number(s.last.close, 2)}
                                </strong>
                                <small>{formatDate(s.last.date, true)}</small>
                              </>
                            ) : (
                              "Not ingested"
                            )}
                          </td>
                          <td
                            className={
                              (s?.change ?? 0) >= 0 ? "positive" : "negative"
                            }
                          >
                            {pct(s?.change)}
                          </td>
                          <td className="desktop-cell">
                            {s && (
                              <Sparkline
                                values={s.sessions
                                  .slice(-20)
                                  .map((x) => x.close)}
                                positive={(s.change ?? 0) >= 0}
                              />
                            )}
                          </td>
                          <td>
                            {s?.ratio ? `${s.ratio.toFixed(2)}×` : "—"}
                            <small>20 prior sessions</small>
                          </td>
                          <td>
                            <button
                              className="icon-button remove-company"
                              aria-label={`Remove ${c.ticker}`}
                              onClick={() => {
                                setWatchlist((w) =>
                                  w.filter((x) => x.ticker !== c.ticker),
                                );
                                tell(
                                  `${c.ticker} removed from your watchlist.`,
                                );
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="portfolio-foot">
                <span>
                  Watchlist edits are saved in this browser. Added companies
                  fetch prices on refresh.
                </span>
                <button
                  className="button subtle"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  <RefreshCw size={15} className={refreshing ? "spin" : ""} />
                  {refreshing ? "Refreshing…" : "Refresh EOD data"}
                </button>
              </div>
              <HealthPanel health={health} />
            </>
          )}
          {view === "research" && (
            <>
              <PageHeading
                kicker="FOLLOW THE EVIDENCE"
                title="The research desk."
                description="Original documents. Connected thinking. Your next question."
                action={
                  <button
                    className="button subtle"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search size={16} />
                    Change company
                  </button>
                }
              />
              <div className="research-company">
                <span className="company-monogram large">
                  {ticker.slice(0, 2)}
                </span>
                <div>
                  <span className="eyebrow green">NSE: {ticker}</span>
                  <h2>
                    {research?.company ??
                      watchlist.find((c) => c.ticker === ticker)?.name ??
                      ticker}
                  </h2>
                  <p>
                    {research?.coverage ??
                      "Discovering the primary-source library…"}
                  </p>
                </div>
                <span className="mode-badge">
                  {research?.mode === "llm" ? (
                    <Sparkles size={13} />
                  ) : (
                    <FileText size={13} />
                  )}{" "}
                  {research?.mode === "llm" ? "AI synthesis" : "Evidence mode"}
                </span>
              </div>
              <div className="candidate-row">
                <span>Explore a different company</span>
                {candidates.map((c) => (
                  <button key={c.ticker} onClick={() => openResearch(c.ticker)}>
                    {c.ticker}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
              {researching && !research ? (
                <div className="research-loading">
                  <LoaderCircle size={26} className="spin" />
                  <h3>Reading from the source.</h3>
                  <p>
                    Discovering documents, retaining page references, and
                    retrieving the evidence. This can take a minute for a new
                    company.
                  </p>
                </div>
              ) : researchError ? (
                <div className="error-state">
                  {researchError}
                  <button
                    className="button subtle"
                    onClick={() => loadResearch(ticker)}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                research && (
                  <>
                    {eventContext && (
                      <div className="event-context">
                        <span className="eyebrow green">
                          FROM THE SIGNAL BRIEF
                        </span>
                        <h3>{eventContext.title}</h3>
                        <p>{nextQuestion(eventContext.category)}</p>
                        <button
                          className="text-link"
                          onClick={() => {
                            const q = nextQuestion(eventContext.category);
                            setQuestion(q);
                            void loadResearch(ticker, q);
                          }}
                        >
                          Investigate this question <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                    {research.mode === "evidence" && (
                      <div className="mode-notice">
                        <ShieldCheck size={18} />
                        <div>
                          <strong>Primary-source evidence mode</strong>
                          <p>
                            Deterministic comparisons and original passages are
                            available. Set a server-side LLM key for analytical
                            synthesis and conversational answers.
                          </p>
                        </div>
                      </div>
                    )}
                    {research.warnings.map((w, i) => (
                      <p key={i} className="warning-note">
                        {w}
                      </p>
                    ))}
                    {research.financials && (
                      <FinancialTable
                        data={research.financials}
                        onEvidence={setEvidence}
                      />
                    )}
                    <div className="workbench">
                      <aside
                        className="research-tabs"
                        aria-label="Research modules"
                      >
                        {research.sections.map((s, i) => (
                          <button
                            className={
                              activeSection === s.title ? "active" : ""
                            }
                            key={s.title}
                            onClick={() => setActiveSection(s.title)}
                          >
                            <span>{String(i + 1).padStart(2, "0")}</span>
                            {s.title}
                            <ArrowUpRight size={13} />
                          </button>
                        ))}
                      </aside>
                      <section className="research-section">
                        {research.sections
                          .filter((s) => s.title === activeSection)
                          .map((s) => (
                            <div key={s.title}>
                              <span className="eyebrow green">
                                THE FUNDAMENTALS
                              </span>
                              <h2>{s.title}</h2>
                              <p className="analysis-copy">{s.analysis}</p>
                              {s.citations.map((index) => {
                                const c = research.citations[index];
                                return c ? (
                                  <div className="evidence-excerpt" key={index}>
                                    <span className="eyebrow">
                                      FROM THE ORIGINAL DOCUMENT
                                    </span>
                                    <p>{c.excerpt}</p>
                                    <Source
                                      citation={c}
                                      onClick={setEvidence}
                                    />
                                  </div>
                                ) : null;
                              })}
                            </div>
                          ))}
                      </section>
                    </div>
                    <section className="promise-section">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow green">
                            ACCOUNTABILITY, WITH RECEIPTS
                          </span>
                          <h2>
                            Promises vs performance
                            <span className="small-count">
                              {research.promises.length}
                            </span>
                          </h2>
                        </div>
                        <span className="tiny-tag">DETERMINISTIC VERDICTS</span>
                      </div>
                      <p className="section-description">
                        Explicit guidance, matched to the correct period and
                        metric. Annual targets are never judged against a single
                        quarter.
                      </p>
                      {research.promises.length ? (
                        research.promises.map((p, i) => (
                          <article className="promise-card" key={i}>
                            <header>
                              <div>
                                <span className="eyebrow">
                                  {p.targetPeriod} · {p.metric}
                                </span>
                                <small>
                                  Statement: {formatDate(p.statementDate, true)}{" "}
                                  · confidence: {Math.round(p.confidence * 100)}
                                  %
                                </small>
                              </div>
                              <span
                                className={
                                  "verdict " +
                                  p.status.toLowerCase().replaceAll(" ", "-")
                                }
                              >
                                {p.status === "MET" ? (
                                  <Check size={13} />
                                ) : null}
                                {p.status}
                              </span>
                            </header>
                            <div className="promise-comparison">
                              <div>
                                <span>MANAGEMENT SAID</span>
                                <blockquote>“{p.statement}”</blockquote>
                                <Source
                                  citation={p.statementSource}
                                  onClick={setEvidence}
                                />
                              </div>
                              <ArrowRight size={22} className="promise-arrow" />
                              <div>
                                <span>WHAT HAPPENED</span>
                                <strong>
                                  {p.actualValue === null
                                    ? "Period still open / evidence unavailable"
                                    : `${p.actualValue}%`}
                                </strong>
                                <p>{p.explanation}</p>
                                {p.resultSource && (
                                  <Source
                                    citation={p.resultSource}
                                    onClick={setEvidence}
                                  />
                                )}
                              </div>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="empty-state compact-empty">
                          <FileText size={25} />
                          <h3>No comparable commitments extracted.</h3>
                          <p>
                            The available documents do not support a
                            deterministic guidance comparison. FINN will not
                            turn general optimism into a missed promise.
                          </p>
                        </div>
                      )}
                    </section>
                    <section className="ask-panel">
                      <div>
                        <span className="eyebrow green">
                          THE NEXT GOOD QUESTION
                        </span>
                        <h2>
                          Ask FINN
                          <span className="ai-star">
                            <Sparkles size={20} />
                          </span>
                        </h2>
                        <p>
                          Investigate {ticker} using the same primary-document
                          library.
                        </p>
                      </div>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (question.trim().length >= 3)
                            void loadResearch(ticker, question);
                        }}
                      >
                        <label className="sr-only" htmlFor="question">
                          Ask a company research question
                        </label>
                        <input
                          id="question"
                          maxLength={600}
                          minLength={3}
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          placeholder="Is cash generation keeping up with profits?"
                          required
                        />
                        <button
                          className="button primary"
                          disabled={researching}
                          aria-label="Ask FINN"
                        >
                          {researching ? (
                            <LoaderCircle className="spin" size={17} />
                          ) : (
                            <ArrowRight size={19} />
                          )}
                        </button>
                      </form>
                      <div className="suggestions">
                        {[
                          "Has management delivered on guidance?",
                          "What risks are disclosed?",
                          "How is cash conversion changing?",
                        ].map((q) => (
                          <button
                            key={q}
                            onClick={() => {
                              setQuestion(q);
                              void loadResearch(ticker, q);
                            }}
                            disabled={researching}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      {research.answer && (
                        <div className="answer">
                          <span className="eyebrow">
                            {research.mode === "llm"
                              ? "SOURCE-GROUNDED RESPONSE"
                              : "RETRIEVED EVIDENCE"}
                          </span>
                          <p>{research.answer}</p>
                          <div>
                            {research.citations.slice(-5).map((c, i) => (
                              <Source
                                key={i}
                                citation={c}
                                onClick={setEvidence}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {history.filter((h) => h.ticker === ticker).length >
                        0 && (
                        <details className="history">
                          <summary>Recent questions about {ticker}</summary>
                          {history
                            .filter((h) => h.ticker === ticker)
                            .slice(0, 4)
                            .map((h, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setQuestion(h.question);
                                  void loadResearch(ticker, h.question);
                                }}
                              >
                                {h.question}
                                <ArrowUpRight size={13} />
                              </button>
                            ))}
                        </details>
                      )}
                    </section>
                    <section className="document-library">
                      <div className="section-heading">
                        <h3>Source library</h3>
                        <span>{research.documents.length} documents</span>
                      </div>
                      {research.documents.map((d) => (
                        <a
                          className="document-row"
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          key={d.id}
                        >
                          <FileText size={19} />
                          <span>
                            <strong>{d.title}</strong>
                            <small>
                              {label(d.kind)} · {d.period} · captured{" "}
                              {formatDate(d.retrievedAt, true)}
                            </small>
                          </span>
                          <ExternalLink size={15} />
                        </a>
                      ))}
                      {!research.documents.length && (
                        <p>
                          No usable primary documents were discovered. Try
                          another company or inspect its investor-relations
                          website. No research claims have been generated.
                        </p>
                      )}
                    </section>
                  </>
                )
              )}
            </>
          )}
          {view === "alerts" && (
            <>
              <PageHeading
                kicker="YOUR DEFINITION OF UNUSUAL"
                title="Signals, on your terms."
                description="Set the thresholds. FINN keeps the evidence."
              />
              <div className="alerts-grid">
                <section className="rules-panel">
                  <div className="section-heading">
                    <h3>Monitoring rules</h3>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={rules.enabled}
                        onChange={(e) =>
                          setRules({ ...rules, enabled: e.target.checked })
                        }
                      />
                      <span />
                      <b>{rules.enabled ? "Enabled" : "Paused"}</b>
                    </label>
                  </div>
                  <label className="range-label">
                    <span>
                      Daily price movement<strong>±{rules.price}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0.5"
                      max="20"
                      step="0.5"
                      value={rules.price}
                      onChange={(e) =>
                        setRules({ ...rules, price: Number(e.target.value) })
                      }
                    />
                    <small>
                      Absolute change between the two latest completed session
                      closes.
                    </small>
                  </label>
                  <label className="range-label">
                    <span>
                      Relative volume<strong>{rules.volume.toFixed(1)}×</strong>
                    </span>
                    <input
                      type="range"
                      min="1.1"
                      max="6"
                      step="0.1"
                      value={rules.volume}
                      onChange={(e) =>
                        setRules({ ...rules, volume: Number(e.target.value) })
                      }
                    />
                    <small>
                      Versus the previous 20 trading sessions, excluding the
                      latest.
                    </small>
                  </label>
                  <label className="range-label">
                    <span>
                      Minimum priority
                      <strong>{rules.minimumPriority}/100</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={rules.minimumPriority}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          minimumPriority: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <h4>Announcement & market categories</h4>
                  <div className="category-checks">
                    {categories.map((c) => (
                      <label key={c}>
                        <input
                          type="checkbox"
                          checked={rules.categories.includes(c)}
                          onChange={(e) =>
                            setRules({
                              ...rules,
                              categories: e.target.checked
                                ? [...rules.categories, c]
                                : rules.categories.filter((x) => x !== c),
                            })
                          }
                        />
                        {label(c)}
                      </label>
                    ))}
                  </div>
                  <div className="rules-footer">
                    <Check size={14} />
                    Preferences save automatically in this browser.
                  </div>
                  <button
                    className="text-link"
                    onClick={() => navigate("portfolio")}
                  >
                    Edit watched companies <ArrowRight size={14} />
                  </button>
                  <button
                    className="button subtle full-width"
                    onClick={async () => {
                      if (!("Notification" in window))
                        return tell(
                          "Browser notifications are not supported here.",
                        );
                      const permission = await Notification.requestPermission();
                      if (permission === "granted") {
                        new Notification("FINN notifications enabled", {
                          body: "In-app alerts are evaluated while this workspace is open. Background Web Push is not configured.",
                        });
                        tell("Notifications enabled for this open workspace.");
                      } else
                        tell(
                          "Notifications were not enabled. In-app alerts remain available.",
                        );
                    }}
                  >
                    <Bell size={16} />
                    Enable browser notifications
                  </button>
                  <p className="small muted">
                    Personal rules run when this workspace is open and new data
                    loads. The protected scheduler evaluates the default server
                    rules; it does not deliver background Web Push.
                  </p>
                </section>
                <section className="notification-centre">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow green">THE AUDIT TRAIL</span>
                      <h3>
                        Notification centre{" "}
                        <span className="small-count">{unread}</span>
                      </h3>
                    </div>
                    <button
                      className="text-link"
                      onClick={() =>
                        setNotices((n) => n.map((x) => ({ ...x, read: true })))
                      }
                    >
                      Mark all read <CheckCheck size={15} />
                    </button>
                  </div>
                  <p className="small muted">
                    History reflects rules at evaluation time. Changing a
                    threshold does not remove an earlier alert.
                  </p>
                  {notices.length ? (
                    notices.map((n) => (
                      <button
                        className={"notice " + (!n.read ? "unread" : "")}
                        key={n.id}
                        onClick={() => {
                          setNotices((old) =>
                            old.map((x) =>
                              x.id === n.id ? { ...x, read: true } : x,
                            ),
                          );
                          setSelected(n);
                        }}
                      >
                        <span className="notice-dot" />
                        <div>
                          <span className="eyebrow">
                            {n.ticker} · {label(n.category)}
                          </span>
                          <h4>{n.title}</h4>
                          <p>{n.reason}</p>
                          <small>
                            Event: {formatDate(n.publishedAt)} IST
                            <br />
                            Evaluated: {formatDate(n.evaluatedAt)} IST
                          </small>
                        </div>
                        <ArrowUpRight size={16} />
                      </button>
                    ))
                  ) : (
                    <div className="empty-state">
                      <Bell size={27} />
                      <h3>Nothing has crossed your rules.</h3>
                      <p>
                        New matches will appear here when source data is loaded.
                        You can adjust thresholds at any time.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          <footer className="page-footer">
            <Link href="/" className="footer-brand">
              finn.
            </Link>
            <span>Primary sources. Independent judgment.</span>
            <span>Research support · Not investment advice</span>
          </footer>
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <button
            key={n.key}
            className={view === n.key ? "active" : ""}
            onClick={() => navigate(n.key)}
          >
            <n.icon size={19} />
            <span>{n.label}</span>
            {n.key === "alerts" && unread > 0 && <i />}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {searchOpen && (
        <Drawer title="Follow a company." onClose={() => setSearchOpen(false)}>
          <p className="muted">
            Search the official NSE equity directory. Research any supported
            ticker, or add it to your watchlist.
          </p>
          <label className="search-input">
            <Search size={19} />
            <input
              autoFocus
              aria-label="Company name or NSE ticker"
              placeholder="Company name or NSE ticker…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searching && <LoaderCircle size={17} className="spin" />}
          </label>
          {searchError && <p className="warning-note">{searchError}</p>}
          <div className="search-results">
            {searchResults.map((c) => (
              <div key={c.ticker}>
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    openResearch(c.ticker);
                  }}
                >
                  <span className="company-monogram">
                    {c.ticker.slice(0, 2)}
                  </span>
                  <span>
                    <b>{c.name}</b>
                    <small>NSE: {c.ticker}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Add ${c.ticker} to watchlist`}
                  disabled={watchlist.some((w) => w.ticker === c.ticker)}
                  onClick={() => {
                    if (watchlist.length >= 25)
                      return tell(
                        "This prototype supports up to 25 watched companies.",
                      );
                    setWatchlist((w) => [...w, c]);
                    tell(
                      `${c.ticker} added. Refresh sources to fetch EOD prices.`,
                    );
                  }}
                >
                  {watchlist.some((w) => w.ticker === c.ticker) ? (
                    <Check size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                </button>
              </div>
            ))}
            {!searching && !searchResults.length && (
              <p className="muted">No matching listed equity was found.</p>
            )}
          </div>
        </Drawer>
      )}
      {selected && !evidence && (
        <Drawer title={selected.company} onClose={() => setSelected(null)}>
          <div className="detail-meta">
            <span className="category">{label(selected.category)}</span>
            <span>
              {selected.ticker} · {formatDate(selected.publishedAt)} IST
            </span>
          </div>
          <h3 className="detail-headline">{selected.title}</h3>
          <div className="detail-section">
            <span className="eyebrow green">WHAT HAPPENED</span>
            <p>{selected.description}</p>
          </div>
          <div className="detail-section">
            <span className="eyebrow green">WHY THIS SURFACED</span>
            <p>{selected.reason}</p>
            <small>
              Priority {selected.priority}/100 · {selected.classificationMethod}{" "}
              · classification confidence{" "}
              {Math.round(selected.confidence * 100)}%
            </small>
          </div>
          <div className="detail-section">
            <span className="eyebrow green">WHY IT COULD MATTER</span>
            <p>{implication(selected.category)}</p>
          </div>
          {selected.facts && (
            <div className="detail-facts">
              {selected.facts.map((f) => (
                <div key={f.label}>
                  <span>{f.label}</span>
                  <strong>{f.value}</strong>
                </div>
              ))}
            </div>
          )}
          <a
            className="original-source"
            href={selected.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <FileText size={21} />
            <span>
              <strong>Open original source</strong>
              <small>
                {selected.sourceName} · ingested{" "}
                {formatDate(selected.ingestedAt)} IST
              </small>
            </span>
            <ArrowUpRight size={20} />
          </a>
          {!["price", "volume"].includes(selected.category) && (
            <>
              <button
                className="button subtle full-width"
                disabled={filingBusy}
                onClick={loadFiling}
              >
                {filingBusy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <FileText size={16} />
                )}
                Read filing evidence
              </button>
              {filingError && <p className="warning-note">{filingError}</p>}
              {filing?.financials && (
                <FinancialTable
                  data={filing.financials}
                  onEvidence={setEvidence}
                />
              )}
              <div>
                {filing?.document.pages.map((p) => (
                  <div className="evidence-excerpt" key={p.page}>
                    <span className="eyebrow">
                      PDF PAGE {p.page} · EXTRACTED TEXT
                    </span>
                    <p>{p.text.slice(0, 5000)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="detail-section">
            <span className="eyebrow green">WHAT TO INVESTIGATE NEXT</span>
            <p>{nextQuestion(selected.category)}</p>
          </div>
          <button
            className="button primary full-width"
            onClick={() => openResearch(selected.ticker, selected)}
          >
            Investigate {selected.ticker}
            <ArrowRight size={17} />
          </button>
          <div className="detail-actions">
            <button
              className="button subtle"
              onClick={() => toggleSaved(selected.id)}
            >
              <Bookmark size={16} />
              {saved.includes(selected.id) ? "Saved" : "Save signal"}
            </button>
            <button
              className="button subtle"
              onClick={() =>
                setReviewed((old) =>
                  old.includes(selected.id) ? old : [...old, selected.id],
                )
              }
            >
              <CheckCheck size={17} />
              {reviewed.includes(selected.id) ? "Reviewed" : "Mark reviewed"}
            </button>
          </div>
          <button
            className="text-link"
            onClick={() => {
              setSelected(null);
              navigate("alerts");
            }}
          >
            Adjust alert rules <Settings2 size={14} />
          </button>
        </Drawer>
      )}
      {evidence && (
        <Drawer
          title="The underlying evidence."
          onClose={() => setEvidence(null)}
        >
          <div className="evidence-document">
            <FileText size={25} />
            <div>
              <h3>{evidence.title}</h3>
              <span>
                {evidence.period} ·{" "}
                {evidence.page
                  ? `PDF page ${evidence.page}`
                  : "Document-level citation"}
              </span>
            </div>
          </div>
          <div className="evidence-excerpt">
            <span className="eyebrow">ORIGINAL DOCUMENT EXCERPT</span>
            <p>{evidence.excerpt}</p>
          </div>
          <p className="small muted">
            Page numbers refer to the PDF page index and may differ from printed
            report pagination. Excerpts are source text, not instructions or
            independent verification.
          </p>
          <a
            className="button primary full-width"
            href={
              evidence.url + (evidence.page ? `#page=${evidence.page}` : "")
            }
            target="_blank"
            rel="noreferrer"
          >
            Open primary document
            <ArrowUpRight size={17} />
          </a>
        </Drawer>
      )}
    </div>
  );
}
function PageHeading({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow green">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function SignalCard({
  signal: s,
  first,
  saved,
  reviewed,
  onOpen,
  onSave,
  onResearch,
}: {
  signal: Signal;
  first: boolean;
  saved: boolean;
  reviewed: boolean;
  onOpen: () => void;
  onSave: () => void;
  onResearch: () => void;
}) {
  return (
    <article
      className={
        "signal-card " +
        (first ? "lead-signal " : "") +
        (reviewed ? "reviewed" : "")
      }
    >
      <div className="signal-top">
        <span className="company-monogram">{s.ticker.slice(0, 2)}</span>
        <div>
          <strong>{s.company}</strong>
          <small>
            {s.ticker} · {formatDate(s.publishedAt)} IST
          </small>
        </div>
        <button
          className={"icon-button " + (saved ? "green" : "")}
          aria-label={`${saved ? "Unsave" : "Save"} ${s.ticker} signal`}
          onClick={onSave}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="signal-tags">
        <span className="category">
          {s.category === "volume" ? (
            <Volume2 size={11} />
          ) : s.category === "price" ? (
            <TrendingUp size={11} />
          ) : null}
          {label(s.category)}
        </span>
        <span className={"priority " + (s.priority >= 80 ? "high" : "medium")}>
          <i />
          {s.priority >= 80 ? "High priority" : "Worth a look"}
        </span>
        {reviewed && (
          <span className="reviewed-tag">
            <Check size={12} />
            Reviewed
          </span>
        )}
      </div>
      <button className="headline-button" onClick={onOpen}>
        <h3>{s.title}</h3>
      </button>
      <p>
        {s.description.length > 215
          ? s.description.slice(0, 212) + "…"
          : s.description}
      </p>
      {s.facts && (
        <div className="inline-facts">
          {s.facts.map((f) => (
            <div key={f.label}>
              <span>{f.label}</span>
              <strong>{f.value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="signal-bottom">
        <button className="evidence-link" onClick={onOpen}>
          <FileText size={14} />
          View evidence
        </button>
        <button className="investigate" onClick={onResearch}>
          Investigate <ArrowUpRight size={15} />
        </button>
      </div>
    </article>
  );
}
function HealthPanel({ health }: { health: DataState["health"] }) {
  return (
    <details className="health-panel">
      <summary>
        <span>
          <i className="status-dot" />
          Source health
        </span>
        <ChevronDown size={14} />
      </summary>
      {health.map((h) => (
        <div key={h.provider}>
          <span>
            <b>{h.provider}</b>
            <i className={h.status}>{h.status}</i>
          </span>
          <p>{h.detail}</p>
          {h.asOf && <small>Fetched {formatDate(h.asOf)} IST</small>}
        </div>
      ))}
    </details>
  );
}
function FinancialTable({
  data,
  onEvidence,
}: {
  data: NonNullable<ReturnType<typeof financialComparison>>;
  onEvidence: (c: Citation) => void;
}) {
  return (
    <section className="financial-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow green">THE REPORTED NUMBERS</span>
          <h3>{data.period} financial snapshot</h3>
        </div>
        <span className="tiny-tag">{data.unit}</span>
      </div>
      <p className="small muted">
        {data.basis} · Prior quarter and same quarter last year · EBITDA is not
        substituted with operating profit.
      </p>
      <div className="financial-table-scroll">
        <table className="financial-table">
          <thead>
            <tr>
              <th>METRIC</th>
              <th>CURRENT</th>
              <th>PREV. QTR</th>
              <th>YEAR AGO</th>
              <th>QoQ</th>
              <th>YoY</th>
            </tr>
          </thead>
          <tbody>
            {data.metrics.map((m) => (
              <tr key={m.metric}>
                <td>{m.metric}</td>
                <td>
                  <strong>{number(m.current)}</strong>
                </td>
                <td>{number(m.previous)}</td>
                <td>{number(m.yearAgo)}</td>
                <td>{pct(m.qoq)}</td>
                <td>{pct(m.yoy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Source citation={data.source} onClick={onEvidence} />
    </section>
  );
}
function implication(c: Category) {
  const map: Partial<Record<Category, string>> = {
    results:
      "Reported results can change the earnings trajectory. Compare like-for-like periods and accounting bases before interpreting the growth rate.",
    management_change:
      "A leadership transition may affect execution or capital allocation. Read the filing for the role, effective date, and any disclosed background; no unverified biography is inferred.",
    "M&A":
      "A transaction can change the business mix and funding needs. Deal terms, approvals and completion conditions determine its financial impact.",
    price:
      "An unusual closing-price move warrants checking contemporaneous disclosures and corporate actions. It does not establish a cause.",
    volume:
      "Elevated participation can accompany new information or index and corporate actions. This observation alone is not a directional trading signal.",
    litigation:
      "A regulatory or legal matter may create financial or operational exposure. Quantify only amounts explicitly disclosed in the filing.",
  };
  return (
    map[c] ??
    "This disclosure may change the information available to shareholders. Read the original filing before deciding whether it changes the investment case."
  );
}
function nextQuestion(c: Category) {
  return c === "results"
    ? "How do growth, profitability and cash conversion compare with management’s earlier guidance?"
    : c === "management_change"
      ? "What role is changing, when does it take effect, and what background is explicitly disclosed?"
      : c === "M&A"
        ? "What consideration and funding are disclosed, and what conditions remain before completion?"
        : "What does the primary-source record show, and is there evidence of a lasting change to the business?";
}
