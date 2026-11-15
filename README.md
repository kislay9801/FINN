# FINN · Signal over Noise

A mobile-first investment intelligence desk for the ENAM AI Engineer Build Challenge. Discover what changed, inspect the filing, then investigate the company. No login or credentials are required for the source-backed local experience.

Live application: https://finn-ecru-chi.vercel.app

## Workspace and optional sign-in

The account button in the header (including mobile) and the bottom-left workspace control open the same account/settings panel. A custom workspace name saves on this device without requiring an account. The updated reading theme uses a dark pine navigation rail, warm paper surfaces, stronger contrast and larger body/financial text.

For actual email/password sign-in, account creation and sign-out, enable the Email provider in Supabase Authentication, allow new users if desired, and set **Site URL** to `https://finn-ecru-chi.vercel.app`. Add these Vercel environment variables and redeploy:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-project-anon-or-publishable-key
```

These are separate from the optional service-role key used for cache persistence. The server calls Supabase Auth, validates users with its `/user` endpoint and stores access/refresh tokens in HttpOnly, SameSite=Lax cookies (Secure in production). Expired sessions refresh through the server. Credentials and tokens are never placed in localStorage or returned to client components. Missing configuration keeps guest mode available and shows a precise connection message; it never pretends that a local profile is authenticated. The account panel explicitly states that watchlists/preferences remain browser-local and do not yet synchronize across devices. Actual hosted Supabase authentication requires those owner-provided settings; provider-response fixtures test the UI without creating real accounts or sending email.

## Run

Use Node 22.13+ (recommended; application minimum 20.9). From this directory:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. For a production server: `npm run build` then `npm start`. Your phone can use `http://<your-computer-LAN-IP>:3000` on the same network if your firewall permits it. Do not expose a development server to the public internet.

## What works

- 18 actual NSE equities, validated against the captured official directory. Search the full directory, add/remove companies (maximum 25), and open ad-hoc research.
- 24-hour, 7-day, 30-day and custom-window filing digest. Priority, category, company and saved filters; procedural filings collapse into a secondary area. Signal details, original sources, saved and reviewed state, and contextual investigation.
- Actual daily closes and volumes for all 18 stocks. Deterministic price movements and relative volume over the **previous** 20 sessions. No current-session leakage; insufficient baselines show unavailable.
- Official NSE archive ingestion with RSS fallback. Manual refresh, provider health, retries, timeouts, bounded concurrency, stable URL-based deduplication and protected cron ingestion.
- Persistent browser preferences, watchlist, notifications, saved/reviewed signals and research history. In-app alerts have evaluation times and stable event IDs. Lowering a threshold evaluates existing observations once; history retains earlier matches.
- Source discovery through Screener's **document links only**, then bounded primary PDF download and per-page text extraction. Annual reports, transcripts and presentations are selected ahead of procedural filings. Safe redirects are checked at every hop. No secondary financial tables or news enter the research corpus.
- Eight research modules with original excerpts, an evidence drawer, document library and contextual questions. With a configured LLM, validated JSON synthesis uses retrieved evidence only. Without a key, the UI explicitly shows **evidence mode**, not simulated AI reasoning.
- Infosys consolidated IFRS quarter comparison: revenue, operating profit, PBT, PAT attributable to owners, QoQ and YoY. EBITDA is explicitly unavailable. A guarded issuer/layout adapter rejects unsupported layouts and other issuers instead of guessing rows.
- **Promises vs performance:** five actual revenue-guidance revisions from company releases, spanning five quarterly releases. Two FY26 revisions are matched to the full-year constant-currency result; three FY27 revisions remain not yet due. Revisions are not five independent promises. Five earnings-call transcripts are available alongside them. This is not a fabricated four-quarter beat/miss series.

## Demo journey

1. Open Today. A quiet 24-hour period is an intentional empty state. Choose **30 days** for captured historical filings.
2. Open a results signal; inspect the official PDF or choose **Read filing evidence**. Save it and mark reviewed.
3. Investigate the company, or use **Investigate Infosys** for the richest captured case.
4. Inspect the quarterly comparison, page-4 evidence and **Promises vs performance**. Look at the annual horizon explanation.
5. Ask a cash-conversion question. With no LLM key, FINN retrieves passages and explicitly explains the reasoning limitation.
6. Add WIPRO or another NSE equity, adjust alert thresholds, reload and verify persistence.

## Captured real data

`src/data` contains genuine responses captured on **14 November 2026**, retaining original URLs and retrieval times. Market observations retain their original trading dates, not the capture date. The original PDF byte SHA-256 is preserved for every captured document; page indices are actual PDF indices.

- Official NSE equity directory: `https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv`.
- 310 filings for the 18 portfolio and four ad-hoc demo companies, captured from the NSE public archive for 15 October–14 November 2026, plus the captured official RSS slice.
- 18 Yahoo `.NS` daily series, approximately three months each. Prices use the provider's daily `quote.close`, not `adjclose`; no dividend total-return adjustments. Corporate-action effects can still require manual review. No trading-calendar days are fabricated or forward-filled.
- 26 primary documents: Infosys (16); Asian Paints, Pidilite, DMart, Bajaj Finance and Wipro (annual report + transcript each). The directory, archive, corpus and EOD snapshots are independent of synthetic fixtures in tests.

Regenerate snapshots with `python scripts/snapshot.py` and `python scripts/capture-research.py` after installing `pypdf`. Those capture scripts originally used the workspace-local `.tools` reader; ordinary Python installations can resolve a globally installed `pypdf`. `scripts/normalise-archive.ts` expects a raw `src/data/nse-announcements.json` from the official archive and writes the compact normalised snapshot. Snapshot generation intentionally preserves capture dates and never creates observations to fill missing days.

## Push architecture and materiality

Provider adapters → normalization → keyword classification → inspectable category priority → time-window digest → rule evaluation. Category base scores are in `src/server/analysis/classify.ts`. Results score 88, M&A 90, leadership changes 85. Procedural notices are downweighted to 18; unclassified paperwork scores 10. This is **routing priority**, not an AI claim of financial impact. Sort order is priority, then recency. Obvious classifications never spend LLM tokens. The source URL is the deduplication key; separate filings describing the same underlying event may still appear independently.

`src/lib/finance.ts` handles arithmetic, comparison bases, threshold matching and deduplication. Growth is `(current - prior) / abs(prior) * 100`; zero/missing denominator returns unavailable. Volume uses the previous 20 observed sessions. EOD data cannot support real-time alert claims.

Personal rules evaluate while the browser is open when data or rules change. Browser notifications require an explicit permission click; background Web Push is not implemented. `/api/cron` refreshes the seed portfolio and evaluates **default server rules**, retaining deduplicated events in server storage. It does not synchronize personal browser rules. The UI clearly distinguishes this limitation.

## Pull architecture and cost

Resolve ticker from official directory → discover original document URLs → validate HTTPS/domain/public DNS and redirects → download at most 32 MB/PDF → extract at most 180 pages for new documents → overlapping 220-word chunks → lexical retrieval → page citations → optional LLM synthesis. Bundled documents retain their complete extracted pages. There is no OCR; inaccessible or scanned PDFs produce explicit gaps.

Parsed downloads cache by URL and content hash. Discovery caches for 24 hours on success and 10 minutes on failure. Research caches by ticker, document revisions, provider mode, model and question for 24 hours. Context is bounded to retrieved passages; entire annual reports are never sent to the model. PDF text is untrusted data. JSON is schema-validated, citation indices are range checked and unsupported numeric tokens cause rejection and evidence-mode fallback. This does not mathematically guarantee the correctness of every narrative interpretation; original passages remain visible for review.

## AI configuration

Copy `.env.example` to `.env.local` and set:

```text
LLM_API_KEY=your-server-side-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4.1-mini
```

Any OpenAI-compatible chat-completions provider supporting JSON object output may be used. Choose a model available to your account. Keys never reach browser code. Provider errors or invalid model output preserve evidence-mode research. No LLM provider was configured during this build; live synthesis remains unverified.

## Persistence

Without credentials, server records use memory plus `.cache/` on local disk (`/tmp` on Vercel). Vercel local cache is ephemeral and not shared between instances. Browser settings are durable only in that browser.

For durable hosted records, apply `supabase/migrations/001_finn.sql`, then set `SUPABASE_URL` and **server-only** `SUPABASE_SERVICE_ROLE_KEY`. The REST provider persists to `app_cache`. A database trigger mirrors ingestion into indexed companies, announcements, daily prices and ingestion status, and newly parsed PDFs into source documents and page chunks. The schema also provides typed relational foundations for facts, promises and user state; those derived/user records currently persist as cached research/browser state, not individually normalized rows. RLS is enabled with no anonymous policies. No Supabase instance was provisioned or verified during this build.

## Deployment

1. Push this `finn` directory as a GitHub repository, or set **Root Directory = finn** when pushing the parent workspace.
2. Import the repository into Vercel; choose Next.js and Node 22.x. Build: `npm run build`.
3. Add optional AI and Supabase variables; add a strong random `CRON_SECRET`.
4. Deploy; verify `/`, `/api/data`, company search and Infosys research on a phone. Copy the actual resulting URL into submission notes.

`vercel.json` requests a weekday 13:00 UTC / 18:30 IST cron (after market close). Platform plan limits apply; function budgets request 120 seconds. Missed calls do not imply missed trading days. Configure an equivalent external scheduler to call `GET /api/cron` with `Authorization: Bearer <CRON_SECRET>` if needed. Never put the secret in a URL. Without the secret the endpoint returns 401. Scheduling and hosted deployment remain unverified until configured in a real account. No deployment or repository URL has been invented.

## Tests

```sh
npm run lint
npm run typecheck
npm test
npm run build
# Start the app separately, then:
npm run test:e2e
```

Unit/integration tests use Node's built-in runner with TSX. Playwright uses an installed Edge browser by default, at 390×844 and 1440×1000; change `channel` in `playwright.config.ts` if needed. `FINN_BASE_URL` overrides localhost for tests. Test failures retain traces in `test-results`; HTML report is in `playwright-report`. Synthetic fixtures exist only in tests. See `VALIDATION.md` for executed results.

## Boundaries

This is a public assessment prototype with optional email authentication; private per-user cloud workspaces are not implemented. Rate limits are per process; use a distributed limiter and per-user data authorization for a multi-user production rollout. General document discovery depends on third-party availability and primary-domain validation. The financial-layout and deterministic guidance adapters currently have deep coverage for Infosys; other companies get the same document/retrieval pipeline but no invented numerical completeness. No biography enrichment, OCR, semantic embeddings, trading/execution, brokerage linkage or background Web Push. No claims of real-time delivery or guaranteed investment outcomes.

See `ARCHITECTURE.md`, `BUILD_DECISIONS.md` and `SUBMISSION_NOTES.md`.
