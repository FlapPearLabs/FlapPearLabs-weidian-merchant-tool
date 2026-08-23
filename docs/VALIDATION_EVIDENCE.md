# Validation Evidence

This document distinguishes **observed evidence**, **offline regression/stress evidence**, and **known environmental limits**.

## Legacy-package analysis

Recovered analysis established a .NET Framework C# launcher, encrypted launcher/business runtime recovered to readable PowerShell/ESM JavaScript, Node.js + Playwright + ExcelJS runtime, public Weidian H5 list/category/SKU/detail sources, and a 31-column mall import model. The inherited client itself is not redistributed in this public portfolio archive.

## Mall import contract — real black-box validation

A workbook copied from a **known successful mall import** established the output constraints used from v1.4 onward:

- 31 headers in row 1;
- real product rows begin at row 2;
- product category left blank;
- product status `放置仓库`;
- Chinese source title/spec preserved;
- helper/example/template rows removed from the actual upload workbook.

A one-item golden-template test produced a successful mall import and a product visible in the mall’s post-import operation flow.

## Historical baseline reconstruction

Historical mall-import spreadsheets were grouped at product level rather than naïvely counting SKU rows.

- 7 distinct historical import files: **5,278 data/SKU rows ≈ 1,628 product groups**.
- 8 batches available for baseline reconstruction: **1,729 raw product groups → 1,721 exact title+carousel entities**.

This changed dedupe from “new JSON history only” to a baseline representing pre-tool historical imports.

## Five-layer dedupe — real v2.0 run

| Metric | Result |
|---|---:|
| Candidate products | 100 |
| Automatic historical duplicates | 79 |
| Review required | 1 |
| Confirmed new products | 20 |
| New-product SKU rows | 122 |
| 31-column QA | PASS |
| Required-field problems | 0 |
| Historical baseline | 1,721 → 1,741 |

Observed evidence breakdown for the 79 automatic duplicates:

- 52 exact item/SKU/code evidence;
- 13 normalized-title exact matches without hard-spec conflict;
- 12 normalized title + same main-image URL;
- 2 changed-title matches recovered by dHash evidence.

## Mall failure root-cause regression

A 450-row import had 448 successful rows and 2 failed rows. Initial correlation suggested two high-SKU products might exceed an unknown limit. This was **not** promoted to a rule.

The mall failure data later identified `规格已存在`. Replay showed two duplicate final spec strings. v2.0 canonicalized final spec rows:

```text
450 input SKU rows
→ detect 2 duplicate final mall specifications
→ 448 output rows
→ product count remains 100
```

This exactly matched the observed 448-success / 2-failure pattern without splitting a product into artificial SPUs.

## Image-hash evidence

Synthetic regression re-encoded the same image between PNG/JPEG representations. Computed dHash Hamming distance was 0, demonstrating that pixel-structure comparison is independent of URL/file bytes. A hard-spec conflict remains a veto even when dHash is identical.

## Stress test

```text
500 synthetic new candidates
× 1,722 historical entities
≈ 861,000 pair comparisons
```

Result:

- 500 / 500 `NEW_CONFIRMED`;
- 0 false duplicate classifications;
- 0 unnecessary review classifications;
- ~25.9 seconds in the test Linux environment.

This supported the decision not to introduce aggressive approximate indexing at this catalog scale.

## v2.3 category-routing / fuzzy-search run

Real operator run with five apparel-related targets:

- all five routed to the real `衣服鞋帽` category with high confidence;
- scan covered roughly 680 category items rather than 2,000+ whole-shop items;
- user selected five candidates;
- five-layer dedupe blocked one historical duplicate;
- output: **4 new products / 40 SKU rows**;
- history advanced **1,741 → 1,745**.

## v2.5 SQLite migration

First unified-data-center initialization observed:

- historical products: **1,745**;
- main-image dHash entries: **1,740**;
- same-shop history: **104**;
- SQLite database placed outside the version directory;
- daily backup created.

This is the high-water baseline subsequent versions must not silently undercut.

## v2.6 operational checks

v2.6 adds:

- SQLite `quick_check` / foreign-key checks;
- internal product high-water mark;
- external health anchor;
- per-run ledger (`runs`);
- export batch ledger (`export_batches`);
- checkpoint backups before important state transitions;
- history/report command;
- explicit backup recovery;
- manual mall-import confirmation (`PREPARED → MALL_IMPORTED`).

## Known limitations / claims deliberately not made

- The assistant execution environment could not reliably access `thor.weidian.com` during some remote tests due DNS/network restrictions. Those runs are **not** represented as successful remote live-E2E evidence.
- The target mall’s internal import implementation is unknown; validated behavior comes from observed successful/failed imports.
- Fuzzy category routing is a request-reduction heuristic, not a semantic truth oracle. Low confidence falls back instead of forcing a category.
- The matcher is not claimed to eliminate all ambiguity; uncertain evidence is intentionally surfaced as `REVIEW_REQUIRED`.
