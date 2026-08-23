# Validation Evidence

[中文](VALIDATION_EVIDENCE.md) | **English**

This document distinguishes real observed evidence, offline regression/stress evidence, and known environmental limits.

## 1. Legacy-package static recovery

Static analysis established:

- an 8KB `.NET Framework 4.0` C# protected launcher;
- protected `engine.dat / launcher.dat` payloads recovered into PowerShell and ESM JavaScript runtime logic;
- Node.js + Playwright + ExcelJS;
- public Weidian H5 list/category/SKU/detail data paths;
- a 31-column mall workbook model.

The project does **not** claim recovery of the original Git history, comments, TypeScript source, or original variable/function names.

## 2. Runtime probe evidence

Read-only Windows runtime capture obtained real list/SKU/detail responses and verified:

- product-list path works;
- SKU path works;
- product-detail/image path works;
- list price aligns with minimum SKU price / 100;
- list stock aligns with the sum of SKU stock;
- some products lack structured `attrList`, so the inherited runtime correctly falls back to `skuInfo.title` for `[规格:...]`;
- “category returned 0 products” was traced to the homepage no longer triggering the category-seed request expected by the inherited code, rather than a simple category-API error.

## 3. Real mall-import black-box contract

A workbook known to import successfully established:

- 31 headers in row 1;
- product data begins at row 2;
- category is blank;
- product status is `放置仓库`;
- Chinese source text is preserved;
- template/helper/example rows must not be mixed into the upload artifact.

A one-item golden-template experiment successfully entered the mall's post-import workflow.

## 4. Historical Excel reconciliation: rows are not products

The backend once showed more than 5,000 historical import records while current products were around 1,600. Direct subtraction would have produced a false conclusion.

Actual analysis:

- 7 distinct historical import files: **5,278 SKU/data rows → about 1,628 product groups**;
- 8 batches for baseline reconstruction: **1,729 raw groups → 1,721 historical entities**.

The main discrepancy was therefore a unit mismatch: SKU/data rows are not SPU/product counts.

## 5. Five-layer dedupe — real v2.0 run

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

Evidence breakdown for the 79 automatic duplicates:

- 52 exact item/SKU/code cases;
- 13 normalized-title exact matches without hard-spec conflict;
- 12 normalized title + same main-image URL;
- 2 changed-title cases recovered by dHash evidence.

Only one product required manual review in that run.

## 6. Image URL vs dHash evidence

URL normalization is useful evidence, but different CDN URLs can still represent the same visual image.

Regression:

```text
same synthetic visual image
→ PNG
→ re-encoded JPEG
→ Chrome Canvas decode
→ 64-bit dHash
→ Hamming Distance = 0
```

Hard-spec conflict remains a veto: 30ml vs 60ml cannot be automatically treated as the same product even if the image is identical.

The first v2.5 SQLite migration observed **1,740 dHash entries** persisted into the unified data center.

## 7. Mall failure root-cause regression

Observed mall result:

```text
450 rows submitted
448 success
2 failed
```

Two products also had unusually high SKU counts, making a hidden SKU-count limit an attractive hypothesis. It was not promoted to a rule.

The real failure CSV reported `规格已存在`. Replay found exactly two duplicated final mall specification strings:

```text
450 input SKU rows
→ detect 2 duplicate final specifications
→ 448 canonical output rows
```

This explained the observed 448/2 outcome without splitting one SPU into artificial products.

## 8. Full-history stress test

```text
500 synthetic new candidates
× 1,722 historical entities
≈ 861,000 pair comparisons
```

Result:

- 500/500 `NEW_CONFIRMED`;
- 0 false duplicate classifications;
- 0 unnecessary review classifications;
- approximately 25.9 seconds in the test Linux environment.

This supported the decision not to introduce aggressive approximate pruning at the current catalog scale.

## 9. Real v2.3 fuzzy-search / category-routing run

Five apparel-related target descriptions:

- all five high-confidence routed to the real `衣服鞋帽` category;
- scan surface reduced to roughly 660–680 category items instead of 2,000+ whole-shop items;
- multiple targets reused one category scan;
- operator selected five candidates;
- five-layer dedupe blocked one historical duplicate;
- output: **4 new products / 40 SKU rows**;
- history advanced **1,741 → 1,745**.

## 10. True-N-new behavior

Synthetic regression:

```text
candidate pool 300
80% duplicate rate
new target 20
```

At candidate 100 the process had 80 duplicates + 20 new, reached the target, and stopped. The remaining 200 candidates were not deep-fetched.

## 11. SQLite migration and state continuity

First v2.5 unified-data-center initialization observed:

- historical products: **1,745**;
- dHash entries: **1,740**;
- same-shop history: **104**;
- database outside the release directory;
- daily backup created.

After a later real run added five products and the process was restarted:

- products: **1,750**;
- dHash: **1,747**;
- same-shop history: **109**.

This shows state continuity across process restarts without relying on old release folders.

## 12. v2.6 state-correctness tests

v2.6 adds/tests:

- SQLite `quick_check` and foreign-key checks;
- product high-water rollback detection;
- external `health_anchor.json` rollback detection;
- `runs` ledger;
- `export_batches` ledger;
- explicit `PREPARED → MALL_IMPORTED` confirmation;
- checkpoint backup creation;
- recovery with emergency pre-restore backup.

## 13. Known limits and deliberately scoped claims

- Some assistant/Linux environments could not reliably access `thor.weidian.com`; those failed remote runs are not represented as successful live E2E evidence.
- The target mall importer's internal source is unknown; the contract is based on observed black-box success/failure behavior.
- Category routing is a request-reduction heuristic, not semantic truth; low confidence falls back.
- The matcher is not claimed to remove all ambiguity; `REVIEW_REQUIRED` is part of the design.
- Character-level fuzzy matching is not marketed as “LLM semantic search.”
