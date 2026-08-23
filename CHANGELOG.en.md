# Changelog

[中文](CHANGELOG.md) | **English**

## v2.6.0 — Operational correctness

- Added Schema 2 run ledger and export-batch ledger.
- Added explicit `PREPARED → MALL_IMPORTED` confirmation.
- Added SQLite integrity/foreign-key checks, internal product high-water mark, and external health anchor.
- Added checkpoint backups and explicit recovery workflow.
- Added operator-facing history/status reporting and startup diagnostics.

## v2.5.1 — Incremental UX correction

- Reframed latest-product progress around the business target: target new items / deep-checked items / confirmed new items.
- Stopped presenting large internal candidate pools such as 200/148 as if they were products that would all be fetched.
- Added protection against running from a temporary ZIP extraction path whose files disappear after the temporary session closes.

> This point release is documented by the conversation/code evolution, but no standalone final artifact is currently preserved in the archive. The archive intentionally does not invent a binary packet or SHA for it.

## v2.5.0 — State architecture baseline

- Established GitHub as the source-code/version source of truth.
- Established `%LOCALAPPDATA%\WeidianMerchantTool\data\state.sqlite3` as the persistent business-state source of truth.
- Moved product history, image dHash cache, and same-shop history into SQLite.
- Performed a one-time import from the old fixed history center; removed recurring sibling-version discovery.
- Made release folders stateless and deletable; `.git` and user state stay outside them.

## v2.4 — Operator UX

- Added single-screen in-place candidate selection with non-TTY fallback.
- Preserved v2.3 routing, fuzzy ranking, dedupe, and persistent-history semantics.

## v2.3 — Category-routed fuzzy search

- Routed high-confidence product-type fragments to actual shop categories before scanning.
- Fell back to whole-shop search when confidence was insufficient.
- Reused one category scan across multiple targets that routed to the same category.
- Preserved partial lightweight search progress on network interruption when possible.
- Moved rolling history to a fixed `%LOCALAPPDATA%` center independent of the program directory.

## v2.2 — Multi-target fuzzy discovery

- Added one-natural-language-target-per-line input.
- Added fuzzy ranking, pagination, numeric selection, and multi-selection.
- Deep fetch and five-layer dedupe run only after the operator selects products.

## v2.1 — True incremental N-new acquisition

- Continued past duplicates until N truly new products were found or the candidate horizon ended.
- Added a session-local provisional baseline to prevent within-run duplicate output.

## v2.0 — Dynamic baseline + real duplicate-spec fix

- Advanced the historical baseline only after export QA succeeded.
- Reproduced and fixed the mall `规格已存在` failure through per-product final-spec deduplication.
- Added regression/stress evidence for entity dedupe, dHash, and Excel output.

## v1.9 — Five-layer product entity dedupe

- Reconstructed a 1,721-entity historical baseline from prior mall-import Excel files.
- Added exact ID/SKU/code evidence.
- Added hard-spec extraction and conflict vetoes.
- Added normalized-title comparison.
- Added character-level fuzzy/order-tolerant comparison.
- Added browser-Canvas 64-bit dHash image evidence and caching.
- Added three-state verdicts: duplicate / new / review required.

## v1.8 — Request-budget control

- Made bounded intelligent latest windows and category-latest the normal path.
- Added longer cooldowns and active stop after repeated network failures.

## v1.7 — Category+latest and retry experiments

- Added category+latest mode, checkpoints, and multi-channel retries.
- Real runs exposed the cost of aggressive full-shop scanning/retries.

## v1.6 — Real latest ordering

- Sorted by Weidian `addTime` instead of trusting API list order.
- Separated lightweight list indexing from detail/SKU/image fetch.

## v1.5 — Latest-product mode

- Added recent-product acquisition independent of a full historical crawl.

## v1.4 — Verified mall Excel contract

- Adopted a real successful import workbook as the golden structure.
- Locked 31 headers; product data from row 2; category blank; Chinese text preserved; status `放置仓库`.

## v1.3 — Clean upload workbook

- Removed template notes/examples from the upload sheet.
- Separated the upload-ready artifact from helper files.

## v1.2 — Keyword OR and launcher stability

- Corrected multi-keyword semantics from AND to OR.
- Added alias handling and kept the terminal visible on failures.

## v1.1 — Multi-mode discovery

- Added category, whole-shop keyword, category+keyword, and specific-item modes.
- Added the first global history ledger.

## v1.0 — Controlled category export

- Read real shop categories and exported a specified source category.

## Pre-v1.0 — Evidence-driven recovery

- Recovered the inherited package boot chain and runtime.
- Reconstructed function-level and field-level data flow.
- Added read-only runtime probes for list/SKU/detail/category behavior.
- Used real mall import outcomes to validate the integration contract before feature work.
