# Changelog

## v2.6.0 — Operational correctness

- Add schema-v2 run ledger and export-batch ledger.
- Add `PREPARED → MALL_IMPORTED` explicit mall confirmation.
- Add SQLite integrity/foreign-key checks, internal product high-water mark and external health anchor.
- Add checkpoint backups and explicit recovery workflow.
- Add operator-facing history/status report.
- Add startup diagnostics showing recent run/export and state health.
- Keep request/identity logic from v2.5 while increasing observability and recoverability.

## v2.5.0 — State architecture baseline

- Establish GitHub as source-code/version source of truth.
- Establish `%LOCALAPPDATA%\WeidianMerchantTool\data\state.sqlite3` as the single persistent business-state source of truth.
- Move product history, image dHash cache, and same-shop history into SQLite.
- One-time import from the old fixed `%LOCALAPPDATA%\WeidianMerchantTool\历史中心`; no sibling-version discovery afterwards.
- Release folders become stateless and deletable; `.git` and user state stay outside them.

## v2.4 — Operator UX

- Single-screen in-place candidate selection with non-TTY fallback.
- Preserve v2.3 routing, fuzzy ranking, dedupe and persistent-history semantics unchanged.

## v2.3 — Category-routed fuzzy search

- Route high-confidence product fragments to actual shop categories before scanning.
- Fall back to whole-shop search when category confidence is insufficient.
- Preserve partial lightweight search progress on network interruption when possible.
- Move rolling history to a fixed `%LOCALAPPDATA%` center independent of the program directory.

## v2.2 — Multi-target fuzzy discovery

- Natural-language target list, fuzzy ranking, pagination and numeric selection.
- Deep-fetch and five-layer dedupe happen only after user selection.

## v2.1 — True incremental N-new acquisition

- Continue past duplicates until N truly new products are found or candidate horizon ends.
- Add session-local provisional baseline to prevent within-run duplicate output.

## v2.0 — Dynamic baseline + real duplicate-spec fix

- Advance the historical baseline only after export QA succeeds.
- Reproduce and fix the mall `规格已存在` failure via per-product final-spec deduplication.
- Add regression/stress evidence around dedupe, dHash and Excel output.

## v1.9 — Five-layer product entity dedupe

- Exact ID/SKU/code evidence.
- Hard spec conflict extraction.
- Normalized-title comparison.
- Character-level fuzzy matching.
- Browser Canvas 64-bit dHash evidence.
- Three-state verdict: duplicate / new / review required.
- Reconstruct a 1,721-entity historical baseline from prior mall imports.

## v1.8 — Request-budget control

- Bounded intelligent latest windows and category-latest as normal path.
- Longer cooldowns and active stop after repeated network failure.

## v1.7 — Category+latest and retry experiments

- Add category+latest mode, checkpoints and multi-channel retries.
- Real runs exposed the cost of aggressive full-shop scanning/retries.

## v1.6 — Real latest ordering

- Sort by Weidian `addTime` rather than relying on API list order.
- Separate lightweight list index from detail/SKU/image fetch.

## v1.5 — Latest-product mode

- Add recent-product workflow independent of a full historical crawl.

## v1.4 — Verified mall Excel contract

- Adopt a real successful import workbook as golden structure.
- 31 headers; data from row 2; category blank; Chinese text preserved; status `放置仓库`.

## v1.3 — Clean upload workbook

- Remove template notes/examples from upload sheet.
- Separate upload-ready artifact from helper files.

## v1.2 — Keyword OR and launcher stability

- Correct multi-keyword semantics from AND to OR.
- Add alias handling and keep terminal visible on failures.

## v1.1 — Multi-mode discovery

- Category, whole-shop keyword, category+keyword and specific-item modes.
- Add first global history ledger.

## v1.0 — Controlled category export

- Read real shop categories and export a specified source category.
