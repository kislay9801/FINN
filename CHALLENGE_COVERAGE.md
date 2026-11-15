# ENAM brief: implementation coverage

This audit uses the actual **ENAM_AI_Engineer_Build_Challenge_Main.pdf** (three pages) and its companion reference, rather than treating the longer initial build prompt as the official grading checklist.

## What ENAM supplied

The brief guides the backend by identifying three data-source families. It does **not** supply an implemented backend or preprocessed data. It explicitly asks for price/volume, exchange filings and original company fundamentals to work. It calls the frontend examples illustrations and the eight research outputs a menu. Login is a product choice, not an ENAM requirement.

## Core workflows

| Brief item | Status | Evidence / limits |
|---|---|---|
| Mobile-first working prototype | Implemented | Responsive login, digest, portfolio, research and rules; 390 px mobile and desktop browser tests. Physical-device/iOS certification is not implied. |
| 15–20 diversified portfolio companies | Implemented | 18 actual NSE companies, checked against the captured official directory; editable watchlist. |
| 3–5 ad-hoc demonstration companies | Implemented | Asian Paints, Pidilite, DMart and Bajaj Finance have original annual-report/transcript snapshots. Wipro is also available. |
| Generalise beyond the selected companies | Implemented with source limits | NSE directory resolution, general document discovery and parsing/retrieval. A fresh COALINDIA request successfully obtained six primary documents. No guarantee that every issuer has accessible, parseable documents. |
| EOD price and volume | Implemented | Actual Yahoo daily series; price change and prior-20-session volume baseline. Cached observations retain genuine session dates. No intraday streaming. |
| Official corporate filings | Implemented | NSE archive adapter with RSS fallback, classification, URL deduplication, source metadata and retained snapshots. Captured history is not an exhaustive exchange archive. |
| Original annual reports and transcripts | Implemented | Company/exchange PDFs, page extraction, source provenance, hash caching and lexical retrieval. Screener is used to discover document links, not as research evidence. |
| Windowed digest and routine-noise filtering | Implemented | Default 24 hours, 7/30 days and custom dates; company/category/priority/saved filters; routine disclosures collapsed. |
| Configurable price, volume and announcement alerts | Implemented; background scope partial | Personal rules evaluate when a signed-in workspace is open and data/settings change. Initial observations establish a baseline; old filings are not marked newly unread. Demo creates no personal notifications. Protected cron evaluates default server rules. Per-account unattended scheduling and background Web Push are not implemented. |
| Source-grounded on-demand research | Implemented; synthesis requires a working provider | Eight-module evidence retrieval, citations and contextual questions. Google Gemini keys are detected through GEMINI_API_KEY/GOOGLE_API_KEY; compatible alternatives remain supported. Successful model responses must pass schema/citation/numeric checks. Provider failures retain evidence and show their actual reason. |
| Efficient model use | Implemented | Deterministic calculations/classification/rules, bounded contexts, document hash caches and revision-keyed research caches. No benchmark of all providers is claimed. |

## Examples and deeper research

| Example / menu item | Coverage |
|---|---|
| Management-change background / biography | **Not implemented.** Classification and original filing inspection exist; verified incoming-person career enrichment is absent. This is an ENAM presentation example, not a claim of completed coverage. |
| Revenue, EBITDA, PBT and PAT QoQ / YoY | **Partial.** Guarded deterministic extraction for the captured Infosys consolidated IFRS layout, with traceable comparisons. EBITDA is explicitly unavailable when not reported; operating profit is not relabelled. General issuer-independent financial-table extraction is not implemented. |
| Business and financial snapshot | Cited evidence modules plus a deterministic Infosys financial table. General narrative synthesis depends on the configured model and evidence. |
| Trajectory, balance sheet and cash quality | Relevant primary passages and optional cited analysis. A complete standardised multi-year financial model and ratios across issuers are not implemented. |
| Narrative vs numbers and guidance | Primary evidence and deterministic Infosys annual constant-currency revenue-guidance comparisons. |
| Bull vs bear | Evidence module and model-backed synthesis when supported by available documents; not a prewritten investment case. |
| Last-four-quarter promises vs actual outcomes | **Partial, not complete.** Five quarterly releases/transcripts are captured, but the deterministic tracker compares annual guidance revisions with the appropriate annual result: two FY26 revisions have outcomes; three FY27 revisions remain open. This is not four independent quarter-by-quarter delivery verdicts. |

## Submission deliverables

| Deliverable | State |
|---|---|
| Phone-accessible prototype | https://finn-ecru-chi.vercel.app |
| GitHub repository | https://github.com/kislay9801/FINN |
| Covering writeup | Draft in SUBMISSION_NOTES.md; owner should review before sending. |
| Actual AI build history | Owner must export/share the real Codex conversation. No history/share link is fabricated. |
| Submission email | Not sent by this agent. |

## Important product boundaries

The default entry is the login page. `/workspace` mounts the personal UI only after server-verified auth status; `/demo` is a clearly labelled sample experience with no personal notifications. Shared public market/research APIs support that demo; they are not private portfolio APIs. Browser state is namespaced per account. Cross-device personal-workspace synchronization is not implemented. Supabase configuration alone is not proof that every database write or email delivery succeeds.

The strongest remaining assessment improvement is a source-verified four-quarter guidance/performance case. Broader financial extraction and verified management biographies would then deepen the examples. The brief favours a focused working product over superficial completeness, so these gaps should be described honestly in the covering note.
