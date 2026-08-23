# Critical Path — From Black Box to Stateful Merchant System

[中文](CRITICAL_PATH.md) | **English**

This document preserves the steps that actually changed the next engineering decision. It is not a feature-counting timeline.

## Stage 0 — Determine what the inherited software really is

The input was a third-party Windows package containing an EXE, `engine.dat`, `launcher.dat`, Node runtime, Playwright/ExcelJS dependencies, and an Excel template.

Static-first workflow:

```text
file inventory
→ SHA256 evidence
→ EXE architecture
→ DAT container
→ load chain
→ runtime recovery
→ Playwright/API
→ Excel
→ dynamic validation
```

Key findings: the EXE was a small .NET Framework C# launcher rather than the business core; protected DAT payloads were recovered into readable PowerShell / ESM JavaScript; the engine was formatted and explained at function level; field lineage was then traced from Weidian JSON into mall Excel columns.

## Stage 1 — Add runtime probes when static analysis reaches an external boundary

Read-only runtime capture collected real product-list, SKU, detail, and category behavior, then generated contract checks and shape baselines.

The probes verified list/SKU/detail paths and price/stock lineage, and showed that “category returns 0” was not a category-API failure: the storefront no longer triggered the category-seed request expected by the inherited code.

**Rule established:** when external behavior is unknown, use a minimal read-only probe instead of guessing.

## Stage 2 — Establish the mall golden contract with real imports

The target mall importer was opaque, so the project used black-box validation:

```text
generate Excel
→ import into mall
→ observe success/failure
→ infer the minimum stable contract
```

This locked the 31-column structure, first-data-row position, blank category field, `放置仓库` status, and clean upload artifact.

## Stage 3 — Add basic operator control

Once the data path and import contract were stable, acquisition modes were added: source category, whole-shop keyword, category+keyword, item ID/link, whole-shop latest, and category latest.

Multi-keyword semantics were corrected from AND to OR because merchant input such as “Lancôme, Estée Lauder” means “match either brand,” not “a title must contain both.”

## Stage 4 — Prove “latest” with `addTime`

An early version approximated latest products using API list order. Real API data exposed `addTime`, and list order was not strictly consistent with it.

The design became:

```text
lightweight list: itemId + itemName + addTime
→ sort by addTime
→ deep-fetch SKU/detail/image only for target products
```

This established the later cheap-index / expensive-deep-fetch architecture.

## Stage 5 — Correct historical counting and reconstruct the baseline

More than 5,000 historical import records initially appeared inconsistent with roughly 1,600 products. Instead of concluding that thousands of products were lost, the project reconciled all historical Excel files.

Results:

```text
5,278 SKU/data rows
→ ~1,628 product groups

8 batches
→ 1,729 raw groups
→ 1,721 product entities
```

This changed dedupe from “remember what this new tool exported” into “reconstruct what the merchant had already migrated before this tool existed.”

## Stage 6 — Move from string equality to product-entity resolution

The operator explicitly prioritized reducing human duplicate review over saving CPU cycles. At this scale, hundreds of thousands or roughly one million comparisons are cheap compared with manual duplicate hunting across a growing catalog.

The five evidence families became:

1. exact itemId / skuId / product code;
2. hard specs such as capacity, weight, quantity, size, color number, model;
3. normalized title;
4. character-level fuzzy/order-tolerant similarity;
5. Chrome Canvas + 64-bit dHash.

Final states:

```text
DUPLICATE_CONFIRMED
NEW_CONFIRMED
REVIEW_REQUIRED
```

## Stage 7 — Do not equate image URL with image identity

URL normalization was useful, but different CDNs or re-encodings can represent the same visual image.

The project reused the existing browser stack:

```text
URL
→ Chrome decode
→ Canvas 9×8 grayscale
→ 64-bit dHash
→ Hamming distance
```

The result is cached. Hard-spec conflicts retain higher priority than image similarity.

## Stage 8 — Deliberately avoid unnecessary NLP complexity

Tokenizer, custom dictionaries, embeddings, vector databases, and heavier vision models were considered. The operator repeatedly challenged whether they would over-engineer a workflow that permits a small human-review tail.

The chosen stack remained deterministic and local: hard-spec regexes, compact aliases, normalization, character n-grams/bags/edit distance, dHash, and `REVIEW_REQUIRED`.

## Stage 9 — Redefine incremental output around the business goal

“Latest 100 candidates” can produce only 20 new products if 80 are historical duplicates. The business goal is instead “find 100 products I do not already have.”

The algorithm became a goal-seeking loop: deep-fetch and dedupe candidates in order, increment only on `NEW_CONFIRMED`, and stop when N new products are found or the horizon is exhausted.

## Stage 10 — Separate fuzzy search, user intent, deep fetch, and dedupe

Real usage involved multiple approximate descriptions, not exact keys.

```text
multiple target descriptions
→ independent fuzzy ranking per target
→ show candidate lists
→ human selects numbers
→ deep-fetch selected products only
→ five-layer historical dedupe
```

Search is high-recall; identity resolution is high-precision.

## Stage 11 — Route “what kind of product is this?” before full-shop search

v2.2 fuzzy search could still scan 2,000+ products. v2.3 added a thin product-type routing layer. It does not hardcode brands such as Tommy/CK/Hollister; it uses type fragments such as sweatshirt, shorts, denim, flip-flops, skincare, etc., and scores them against the current shop's actual category names.

```text
high confidence   → best category
medium confidence → top 1–2 categories
low confidence    → whole-shop fallback
```

A real five-target apparel run routed all targets to `衣服鞋帽`, reducing the scan surface to roughly 660–680 items and reusing one category scan.

## Stage 12 — Treat request budget as a product constraint

Full-shop scans and aggressive retries produced socket hangups / HTTP2 errors. The response was not “retry harder,” but category-latest defaults, bounded intelligent windows, progressive cooldowns, active stop after repeated failure, and category routing.

## Stage 13 — Replace sibling-version inheritance with a proper state lifecycle

v2.3/v2.4 used nearby release folders as an upgrade compatibility mechanism: find the largest/newest historical JSON and inherit it. The operator challenged the architecture directly: deleting v1.8/v2.0/v2.3 should not affect history.

v2.5 separated:

```text
GitHub = code/version history
Release ZIP = disposable runtime
SQLite = persistent merchant state
```

The database lives outside version folders, so future upgrades open the same state directly.

## Stage 14 — Make state continuity observable and recoverable

The next question was: what happens if SQLite itself rolls back or becomes inconsistent?

v2.6 added `quick_check`, foreign-key checks, internal high-water, external health anchor, `runs`, `export_batches`, `PREPARED → MALL_IMPORTED`, daily/checkpoint backups, and explicit restore.

The system's question is no longer merely “did the program run?” It is “is merchant state continuous, explainable, and recoverable?”
