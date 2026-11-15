# Executed validation · 14 November 2026

## Readability and account update · 15 November 2026

- Lint and strict TypeScript checks passed; the production build includes the new `/api/auth` route.
- **24/24 unit/adapter tests passed**, including credential/session validation, authentic provider-user parsing and sanitized authentication errors.
- **10/10 browser tests passed** at 390×844 mobile and 1440×1000 desktop. Added checks assert body copy is at least 15 px, the canvas is not pure white, the workspace settings button saves a desk name across reloads, and sign-in/error/sign-out screens handle synthetic provider responses correctly. Original digest, portfolio, research and rule-persistence journeys still pass.
- Refreshed mobile/desktop screenshots were visually inspected. The default theme now has a dark pine navigation rail, warmer reading surfaces, stronger metadata contrast, larger body text and enlarged controls. Dialogs have accessible names; sign-in tabs support arrow-key navigation.
- Real Supabase authentication remains **configuration-dependent**. UI tests use mocked account responses and adapter tests use mocked upstream responses: they do not prove a live Supabase project accepts credentials or sends confirmation email. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY`, enable the Email provider, set the Supabase Site URL, and redeploy to enable it. Tokens are server-validated and stored in HttpOnly cookies. Personal watchlists/preferences remain on the device.

The original build-validation record follows.

Environment: Windows, Node 20.12.1, Next.js 16.4.6, React 19.3.1. Node 22.13+ is recommended for clean dependency engine compatibility; lint/build/test commands also executed successfully on the installed Node version.

- `npm install`: completed. Follow-up dependency audit: **0 known vulnerabilities** after replacing the Vitest dependency tree with Node's built-in runner and updating Zod/minimatch.
- `npm run lint`: passed with no warnings.
- `npm run typecheck`: passed under strict TypeScript.
- `npm test`: **22/22** deterministic, schema, provenance, provider-adapter and security regression tests passed. Synthetic arithmetic fixtures are test-only.
- `npm run build`: production build passed with all six API routes and the application page generated/compiled.
- `npm run test:e2e`: **6/6** Playwright journeys passed in headless Microsoft Edge, at 390×844 mobile and 1440×1000 desktop. Tested digest filtering, official-source links, saved/reviewed state, watchlist add, threshold persistence, notification history, Infosys financials, five guidance revisions/two annual outcomes, evidence drawer, questions in evidence mode, Wipro selection and protected/invalid API responses. No page-level horizontal overflow in asserted views; no page errors in the digest journey.

## Live provider checks

`npx tsx scripts/provider-smoke.ts` executed successfully:

- Yahoo INFY daily chart: 63 completed sessions, latest observed 13 November 2026.
- NSE official RSS: actual records retrieved (count varies as the feed updates).
- MARUTI official results filing: five PDF pages parsed.
- **COALINDIA**, outside all six bundled issuers: six newly discovered primary documents, 466 parsed pages, no discovery warnings after the redirect fix. Not a hardcoded response or bundled ticker branch.

Manual `POST /api/refresh` with a same-origin header for INFY and RELIANCE completed. Both EOD series refreshed; official NSE filings merged with existing records (3,742 total retained announcements at that check). Other companies' previous genuine market snapshots were preserved. The application reports per-provider fetch times separately from original event/session times.

## Bugs found and fixed

- Locale-dependent server/client date rendering caused hydration mismatch; client time now initializes after hydration.
- Browser filter selectors exposed insufficiently explicit select labels; explicit accessible names were added.
- Original document ingestion rejected BSE redirects and larger annual reports. Every redirect now receives the same domain and public-DNS checks; bounded downloads allow 32 MB.
- Production Next.js internal bind URL differed from browser origin. Origin validation now checks the incoming Host header and rejects cross-site requests; a unit regression covers proxy/bind behavior.
- Earlier browser runs occurred during source changes and failed. They were rerun against a fixed production build; only the final successful runs count as passing.

## Not verified / scope limits

- No LLM API key was available: configured-provider analytical synthesis and its factual quality were not exercised. Evidence mode and deterministic comparisons were tested.
- No hosted Supabase instance or Vercel/GitHub deployment was provisioned. Migration, hosted persistence, production cron execution and public phone URL remain unverified.
- Native background Web Push is not implemented. Foreground browser notifications are permission-gated; operating-system notification delivery was not tested or permission-granted by the build agent.
- Deep deterministic financial-table and guidance extraction is currently issuer/layout specific to Infosys. General discovery/retrieval was exercised against a new COALINDIA request; this does not establish coverage for every NSE company or scanned/encrypted PDFs.
- Mobile testing is browser emulation, not a physical phone or iOS Safari certification. No complete WCAG audit or production penetration test was performed.

Local screenshots are in `docs/screenshots`. Generated Playwright traces/reports remain local and are ignored by Git.
