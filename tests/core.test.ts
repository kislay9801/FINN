import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  growth,
  inCrores,
  compareFacts,
  marketStats,
  priceSignals,
  alertMatches,
  dedupe,
  prioritySort,
  compareTarget,
  evaluateNewSignals,
} from "../src/lib/finance";
import { classify } from "../src/server/analysis/classify";
import {
  parseAnnouncements,
  parseArchive,
  parseIst,
} from "../src/server/providers/announcements";
import { parseChart } from "../src/server/providers/prices";
import { allowedUrl, bounded } from "../src/server/providers/http";
import {
  capturedDocuments,
  chunkDocument,
} from "../src/server/research/documents";
import { financialComparison } from "../src/server/research/financials";
import { extractPromises } from "../src/server/research/promises";
import { retrieve, validateCitations, numbersSupported } from "../src/server/research";
import {
  defaultRules,
  researchSchema,
  tickerSchema,
  type PriceSeries,
} from "../src/types";
import { companies } from "../src/server/ingestion";
import { portfolio } from "../src/data/companies";
import { sameOrigin } from "../src/server/security";
import { safeWorkspaceDestination } from "../src/lib/account-client";
import { resolveLlmConfiguration } from "../src/server/providers/llm";
import {
  accountUser,
  parseSession,
  credentialsSchema,
  authRequest,
  authConfigured,
  AuthError,
} from "../src/server/auth";
// Synthetic fixtures below exercise arithmetic only. They are never shipped as observations.
test("account validation rejects weak/malformed credentials and never treats a profile as a session", () => {
  assert.equal(
    credentialsSchema.safeParse({
      action: "login",
      email: "invalid",
      password: "123",
    }).success,
    false,
  );
  assert.equal(
    credentialsSchema.safeParse({
      action: "login",
      email: "analyst@example.test",
      password: "test-password",
    }).success,
    true,
  );
  assert.equal(parseSession({ user: { id: "fixture" } }), null);
  assert.equal(
    parseSession({
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
      expires_in: 3600,
    })?.expires_in,
    3600,
  );
  assert.throws(() => accountUser({ id: "fixture", email: "not-an-email" }));
  assert.equal(
    accountUser({
      id: "fixture",
      email: "analyst@example.test",
      user_metadata: { name: " Test Analyst " },
    }).name,
    "Test Analyst",
  );
});
test("auth adapter uses the configured provider and maps failures without leaking responses", async () => {
  const oldUrl = process.env.SUPABASE_URL,
    oldKey = process.env.SUPABASE_ANON_KEY,
    originalFetch = globalThis.fetch;
  try {
    delete process.env.SUPABASE_ANON_KEY;
    assert.equal(authConfigured(), false);
    await assert.rejects(() => authRequest("user"), AuthError);
    process.env.SUPABASE_URL = "https://fixture.supabase.co";
    process.env.SUPABASE_ANON_KEY = "test-only-anon-key";
    assert.equal(authConfigured(), true);
    globalThis.fetch = async (input, options) => {
      assert.equal(
        String(input),
        "https://fixture.supabase.co/auth/v1/token?grant_type=password",
      );
      assert.equal(
        (options?.headers as Record<string, string>).apikey,
        "test-only-anon-key",
      );
      return Response.json(
        {
          error_code: "invalid_credentials",
          message: "Sensitive upstream details",
        },
        { status: 400 },
      );
    };
    await assert.rejects(
      () =>
        authRequest("token?grant_type=password", {
          email: "analyst@example.test",
          password: "fixture-password",
        }),
      (e) =>
        e instanceof AuthError &&
        e.status === 401 &&
        !e.message.includes("Sensitive"),
    );
    globalThis.fetch = async () =>
      Response.json({ id: "fixture", email: "analyst@example.test" });
    assert.equal(
      accountUser(await authRequest("user", undefined, "fixture-access")).email,
      "analyst@example.test",
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = oldKey;
  }
});
const series: PriceSeries = {
  ticker: "TEST",
  sourceUrl: "https://query1.finance.yahoo.com/test",
  retrievedAt: "2026-11-14T00:00:00Z",
  sessions: Array.from({ length: 22 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 9, i + 1)).toISOString(),
    close: i === 21 ? 110 : 100,
    volume: i === 21 ? 300 : 100,
  })),
};
test("daily / QoQ / YoY changes use absolute denominator", () => {
  assert.equal(growth(110, 100), 10);
  assert.equal(growth(-50, -100), 50);
  assert.equal(growth(100, -100), 200);
  assert.equal(growth(100, 0), null);
  assert.equal(growth(null, 100), null);
  assert.equal(growth(1, undefined), null);
  assert.equal(growth(NaN, 2), null);
});
test("financial units normalise to INR crores", () => {
  assert.equal(inCrores(1e7, "rupees"), 1);
  assert.equal(inCrores(100, "lakhs"), 1);
  assert.equal(inCrores(10, "millions"), 1);
  assert.equal(inCrores(1, "billions"), 100);
});
test("mixed accounting bases and currencies are never compared", () => {
  assert.equal(
    compareFacts(
      { basis: "consolidated", unit: "INR", value: 2 },
      { basis: "standalone", unit: "INR", value: 1 },
    ),
    null,
  );
  assert.equal(
    compareFacts(
      { basis: "consolidated", unit: "INR", value: 2 },
      { basis: "consolidated", unit: "USD", value: 1 },
    ),
    null,
  );
});
test("20-session baseline excludes current session", () => {
  const s = marketStats(series);
  assert.equal(s.average, 100);
  assert.equal(s.ratio, 3);
  assert.equal(s.change, 10);
});
test("missing history and zero-volume baselines remain unavailable", () => {
  assert.equal(
    marketStats({ ...series, sessions: series.sessions.slice(0, 20) }).ratio,
    null,
  );
  assert.equal(
    marketStats({
      ...series,
      sessions: series.sessions.map((s) => ({ ...s, volume: 0 })),
    }).ratio,
    null,
  );
  assert.equal(marketStats({ ...series, sessions: [] }).change, null);
});
test("market thresholds are inclusive and configurable", () => {
  const signals = priceSignals(
    series,
    { ...defaultRules, price: 10, volume: 3 },
    "Fixture",
  );
  assert.equal(signals.length, 2);
  assert.equal(
    priceSignals(series, { ...defaultRules, price: 11, volume: 4 }, "Fixture")
      .length,
    0,
  );
  assert.ok(signals.every((s) => s.reason.includes("rule")));
});
test("classification suppresses procedural results publications", () => {
  assert.equal(classify("Financial Results").category, "results");
  assert.equal(classify("Acquisition of a subsidiary").category, "M&A");
  assert.equal(classify("CFO resignation").category, "management_change");
  assert.equal(
    classify("Copy of Newspaper Publication", "quarterly financial results")
      .routine,
    true,
  );
  assert.equal(
    classify("Investor conference call transcript").category,
    "earnings_call",
  );
});
test("priority sorting retains chronological order within a score", () => {
  const s = prioritySort([
    { priority: 20, publishedAt: "2026-01-01" },
    { priority: 80, publishedAt: "2026-01-01" },
    { priority: 80, publishedAt: "2026-02-01" },
  ]);
  assert.equal(s[0].publishedAt, "2026-02-01");
  assert.equal(s.at(-1)?.priority, 20);
});
test("deduplication is stable by source/event identifier", () => {
  assert.equal(dedupe([{ id: "a" }, { id: "a" }, { id: "b" }]).length, 2);
});
test("alert categories, minimum priority and enabled state are enforced", () => {
  const signal = priceSignals(series, defaultRules, "Fixture")[0];
  assert.equal(alertMatches(signal, defaultRules), true);
  assert.equal(
    alertMatches(signal, { ...defaultRules, enabled: false }),
    false,
  );
  assert.equal(
    alertMatches(signal, { ...defaultRules, categories: [] }),
    false,
  );
  assert.equal(
    alertMatches(signal, { ...defaultRules, minimumPriority: 99 }),
    false,
  );
  const history = dedupe([
    ...priceSignals(series, defaultRules, "Fixture"),
    ...priceSignals(series, defaultRules, "Fixture"),
  ]);
  assert.equal(history.length, 2);
});
test("NSE timestamps are explicitly IST", () => {
  assert.equal(parseIst("14-Nov-2026 11:52:47"), "2026-11-14T06:22:47.000Z");
  assert.equal(parseIst("2026-11-14 11:52:47"), null);
});
test("NSE adapter handles single item, entities, dedupe and malformed response", () => {
  const item =
    "<item><title>Fixture Ltd</title><link>https://nsearchives.nseindia.com/corporate/TEST_123.pdf</link><description>Financial Results &amp; updates |SUBJECT: Financial Results</description><pubDate>14-Nov-2026 11:00:00</pubDate></item>";
  const result = parseAnnouncements(
    "<rss><channel>" + item + item + "</channel></rss>",
    [{ ticker: "TEST", name: "Fixture Ltd", sector: "Test" }],
    "2026-11-14T06:00:00Z",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].category, "results");
  assert.equal(
    parseAnnouncements("<html>blocked</html>", [], new Date().toISOString())
      .length,
    0,
  );
  assert.throws(() => parseArchive({}, [], ""));
});
test("Yahoo adapter handles null rows and provider errors", () => {
  const raw = {
    chart: {
      result: [
        {
          timestamp: [1600000000, 1600100000],
          indicators: { quote: [{ close: [100, null], volume: [20, 30] }] },
        },
      ],
      error: null,
    },
  };
  assert.equal(parseChart("TEST", raw, series.sourceUrl).sessions.length, 1);
  assert.throws(() =>
    parseChart(
      "TEST",
      { chart: { result: null, error: { code: "Not Found" } } },
      series.sourceUrl,
    ),
  );
});
test("SSRF checks reject non-HTTPS, credentials, local and unknown hosts", () => {
  assert.equal(allowedUrl("https://www.infosys.com/report.pdf"), true);
  for (const url of [
    "http://www.infosys.com/x",
    "https://localhost/x",
    "https://127.0.0.1/x",
    "https://www.infosys.com.evil.test/x",
    "https://u:p@www.infosys.com/x",
    "https://www.infosys.com:444/x",
  ])
    assert.equal(allowedUrl(url), false);
});
test("bounded provider requests preserve individual failures", async () => {
  let active = 0,
    max = 0;
  const r = await bounded([1, 2, 3, 4], 2, async (n) => {
    active++;
    max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    if (n === 3) throw new Error("fixture failure");
    return n;
  });
  assert.equal(max, 2);
  assert.equal(r[2].status, "rejected");
  assert.equal(r[3].status, "fulfilled");
});
test("primary corpus has actual page-level provenance", () => {
  assert.ok(capturedDocuments.length >= 26);
  for (const d of capturedDocuments) {
    assert.match(d.url, /^https:\/\//);
    assert.equal(d.hash.length, 64);
    assert.ok(d.pages.length > 0);
    assert.ok(d.pages[0].page === 1);
  }
  const chunks = chunkDocument(capturedDocuments[0]);
  assert.ok(chunks.every((c) => c.page && c.page > 0 && c.documentId && c.url));
  assert.ok(retrieve(chunks, "revenue segments", 2).length > 0);
});
test("financial adapter reproduces reported quarter and computes growth", () => {
  const doc = capturedDocuments.find(
    (d) => d.ticker === "INFY" && d.kind === "results",
  )!;
  const comparison = financialComparison(doc);
  assert.ok(comparison);
  assert.equal(comparison.metrics[0].current, 49244);
  assert.equal(comparison.metrics[0].previous, 48211);
  assert.equal(comparison.metrics[0].yearAgo, 44490);
  assert.equal(
    comparison.metrics.find((m) => m.metric.startsWith("EBITDA"))?.current,
    null,
  );
  assert.equal(
    comparison.metrics.find((m) => m.metric === "PBT")?.current,
    11063,
  );
  assert.equal(comparison.source.page, 4);
  assert.ok(Math.abs(comparison.metrics[0].yoy! - 10.6855) < 0.001);
  assert.equal(financialComparison({ ...doc, ticker: "HDFCBANK" }), null);
});
test("guidance comparisons respect annual target horizon and revisions", () => {
  const p = extractPromises(
    capturedDocuments,
    new Date("2026-11-14T00:00:00Z"),
  );
  assert.equal(p.length, 5);
  assert.equal(p.filter((x) => x.status === "NOT YET DUE").length, 3);
  const completed = p.filter((x) => x.status === "MET");
  assert.equal(completed.length, 2);
  assert.ok(completed.every((x) => x.actualValue === 3.1 && x.resultSource));
  assert.equal(compareTarget(2, 3, 4, true), "MISSED");
  assert.equal(compareTarget(null, 3, 4, true), "INSUFFICIENT EVIDENCE");
  assert.equal(compareTarget(1, 3, 4, false), "NOT YET DUE");
});
test("research schema rejects malformed output and invalid citations", () => {
  assert.equal(
    researchSchema.safeParse({
      sections: [{ title: "Invented", analysis: "foo", citations: [] }],
    }).success,
    false,
  );
  assert.equal(
    validateCitations([{ analysis: "Revenue 10", citations: [2] }], []),
    false,
  );
  assert.equal(
    validateCitations([{ analysis: "Revenue 10", citations: [] }], []),
    false,
  );
});
test("ad-hoc tickers resolve beyond seeded portfolio", () => {
  for (const ticker of ["WIPRO", "COALINDIA", "SBIN", "ASIANPAINT"]) {
    assert.ok(companies.some((c) => c.ticker === ticker));
    assert.ok(!portfolio.some((c) => c.ticker === ticker));
    assert.equal(tickerSchema.parse(ticker.toLowerCase() + ".NS"), ticker);
  }
  assert.ok(
    portfolio.every((p) => companies.some((c) => c.ticker === p.ticker)),
  );
  assert.equal(tickerSchema.safeParse("http://evil").success, false);
});
test("captured official archive remains distinct from synthetic test fixtures", async () => {
  const archive = JSON.parse(
    await readFile("src/data/archive-signals.json", "utf8"),
  );
  assert.equal(archive.length, 310);
  assert.ok(
    archive.every(
      (s: { sourceUrl: string; publishedAt: string }) =>
        s.sourceUrl.startsWith("https://nsearchives.nseindia.com/") &&
        Date.parse(s.publishedAt),
    ),
  );
});
test("Gemini keys select Google and ignore incompatible OpenAI example defaults", () => {
  const config = resolveLlmConfiguration({
    GEMINI_API_KEY: "fixture-gemini-key",
    LLM_BASE_URL: "https://api.openai.com/v1",
    LLM_MODEL: "gpt-4.1-mini",
  });
  assert.equal(config?.provider, "gemini");
  assert.equal(
    config?.baseUrl,
    "https://generativelanguage.googleapis.com/v1beta/openai",
  );
  assert.equal(config?.model, "gemini-3.5-flash-lite");
  assert.equal(
    resolveLlmConfiguration({ GOOGLE_API_KEY: "fixture-google-key" })?.provider,
    "gemini",
  );
  assert.equal(
    resolveLlmConfiguration({ LLM_API_KEY: "AIza-test-only-key" })?.provider,
    "gemini",
  );
  assert.equal(
    resolveLlmConfiguration({
      GEMINI_API_KEY: "fixture-key",
      GEMINI_MODEL: "gemini-custom",
    })?.model,
    "gemini-custom",
  );
  assert.equal(resolveLlmConfiguration({}), null);
  assert.equal(
    resolveLlmConfiguration({ LLM_API_KEY: "fixture-openai-key" })?.provider,
    "openai-compatible",
  );
});
test("first visit establishes an alert baseline; only unseen matching observations notify", () => {
  const [signal] = priceSignals(series, defaultRules, "Fixture");
  const now = Date.parse(signal.publishedAt) + 60_000;
  const first = evaluateNewSignals(null, [signal], defaultRules, now);
  assert.deepEqual(first.matches, []);
  assert.ok(first.seen.includes(signal.id));
  assert.equal(
    evaluateNewSignals(first.seen, [signal], defaultRules, now).matches.length,
    0,
  );
  const fresh = { ...signal, id: "fixture-new-observation" };
  assert.equal(
    evaluateNewSignals(first.seen, [signal, fresh], defaultRules, now).matches
      .length,
    1,
  );
  assert.equal(
    evaluateNewSignals(
      first.seen,
      [fresh],
      { ...defaultRules, enabled: false },
      now,
    ).matches.length,
    0,
  );
});
test("login destinations remain within the workspace route", () => {
  assert.equal(
    safeWorkspaceDestination("/workspace?view=research&ticker=INFY"),
    "/workspace?view=research&ticker=INFY",
  );
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/workspace/../../evil",
    null,
  ])
    assert.equal(safeWorkspaceDestination(value), "/workspace");
});
test("same-origin validation works behind Next production host binding and rejects foreign origins", () => {
  assert.equal(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/research", {
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("http://internal/api/research", {
        headers: { host: "finn.example", origin: "https://finn.example" },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("http://localhost:3000/api/research", {
        headers: { host: "localhost:3000", origin: "https://evil.example" },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(
      new Request("http://localhost:3000/api/research", {
        headers: { "sec-fetch-site": "cross-site" },
      }),
    ),
    false,
  );
});

test("AI numerical checks reject unsupported numbers and partial matches", () => {
  assert.equal(numbersSupported("Revenue 1,250 and margin 12.5%", "Revenue 1250. Margin 12.5%."), true);
  assert.equal(numbersSupported("Margin 12%", "Margin 112%"), false);
  assert.equal(numbersSupported("Growth 13.5%", "Growth 13.4%"), false);
  assert.equal(numbersSupported("Cash conversion improved", "Cash flow information"), true);
});
