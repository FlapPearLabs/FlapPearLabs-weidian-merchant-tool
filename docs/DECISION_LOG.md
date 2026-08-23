# Decision Log — High-Leverage Product & Engineering Decisions

This file records decisions that materially changed the project direction. Each entry preserves the **problem, rejected shortcut, chosen design, and why**.

## D01 — Reverse-engineer first; do not rewrite an unknown working tool

**Problem.** A legacy exporter already worked in production-like usage, but its architecture and data contracts were unknown.

**Rejected shortcut.** Discard it and rebuild from assumptions.

**Decision.** Recover the boot chain and business runtime first. Analysis established a .NET launcher feeding decrypted PowerShell/ESM JavaScript into PowerShell/Node, with Playwright + ExcelJS handling Weidian access and Excel output.

**Why.** Rewriting first would discard already-solved compatibility details and blur new regressions with inherited behavior.

## D02 — Treat a real successful mall import as the golden contract

**Problem.** The target mall is externally implemented and its import internals are unknown.

**Rejected shortcut.** Infer semantics from column names, e.g. assuming the category column must contain `[新品上市]`.

**Decision.** Compare generated workbooks against a historical file that demonstrably imported successfully. Lock the upload sheet to the observed contract: 31 headers, data from row 2, category blank, Chinese text retained, product status `放置仓库`.

**Principle.** For an opaque integration, **observed successful behavior outranks plausible field semantics**.

## D03 — Stop automation at “warehouse,” not “live to customers”

**Decision.** Preserve `放置仓库`. Operators still change price, stock, discounts, categories and content before publication.

**Why.** The cost of exposing unreviewed migrated products is higher than one deliberate human review step.

## D04 — Separate “find what I mean” from “is this already the same product?”

Fuzzy search and deduplication have opposite error profiles.

```text
natural-language intent
    ↓
high-recall candidates
    ↓
human selection
    ↓
full product evidence
    ↓
high-precision dedupe
```

Search ranks plausible candidates. Deduplication fetches full detail/SKU, compares against history, and allows `REVIEW_REQUIRED`. Auto-selecting a fuzzy result would confuse user intent with entity identity.

## D05 — Prefer deterministic evidence over fashionable NLP complexity

**Rejected shortcut.** Add Chinese tokenizers, embeddings, a vector DB or LLM classification before evidence shows they are necessary.

**Decision.** Use exact IDs, regex-extracted hard specs, normalization, character 2/3-grams, character-bag similarity, edit distance, and manual review for ambiguity.

**Why.** At a few thousand historical products, even full comparison is cheap. Complexity should be purchased only when real errors justify it.

## D06 — Use dHash as an independent sensor, but never override hard specs

Use browser Canvas to compute a 64-bit dHash and Hamming distance, reusing Chrome/Playwright rather than adding OpenCV/TensorFlow. A hard conflict such as `30ml != 60ml` vetoes “same product” even if the image hash matches perfectly.

## D07 — Optimize human effort before CPU effort

An early indexing idea would reduce full-history comparisons. The business constraint was the opposite: program time is cheap; manual duplicate hunting becomes expensive as the catalog grows.

**Decision.** Compare fully fetched candidates against the complete relevant historical set when needed. `100 × 1,700` or `200 × 5,000` comparisons are acceptable on commodity hardware.

## D08 — Do not perform semantic dedupe from lightweight candidate records

Lightweight records often contain only item ID, title and add time. “兰蔻菁纯面霜” does not reveal 15/30/60ml or variant details.

**Decision.** Lightweight phase may skip exact historical source IDs, but product-level dedupe waits for full detail/SKU evidence.

## D09 — Do not convert correlation into a mall rule

A 450-row import had exactly two failures; two products also had unusually high SKU counts.

**Rejected shortcut.** Invent a “max 30/50 SKU” limit and split products.

**Evidence.** Mall failure data later showed `规格已存在`: two duplicate final specification strings inside one product.

**Decision.** Canonicalize final mall spec strings; merge identical rows or report conflicts. Keep the product as one SPU.

**Lesson.** A neat correlation is not a contract.

## D10 — Define true incremental output in business terms

“Latest 100” originally meant take 100 candidates, dedupe, export the remainder. If 80 were old, only 20 new products were delivered.

**Decision.** If the operator asks for N new products, continue scanning/fetching until N `NEW_CONFIRMED` products are found or the candidate horizon is exhausted.

## D11 — Control request budget instead of trying to win against rate limits

Full-shop scans and aggressive retries produced socket hangups / HTTP2 protocol errors.

**Decision.** Make category-latest and bounded intelligent windows the normal path; add cooldowns and stop after repeated failures. Later, route fuzzy queries into likely shop categories before scanning.

## D12 — Historical identity is user data, not release-package data

Early versions carried JSON history in the program folder and searched nearby “sibling” versions for the largest/newest baseline.

**Decision.** First move to a fixed `%LOCALAPPDATA%` history center; then replace fragmented JSON with one SQLite `state.sqlite3` outside every release folder.

**Invariant.** Updating or deleting a program version must never reset product identity history.

## D13 — Separate GitHub / Release / SQLite lifecycles

```text
GitHub     = source and version history
Release    = disposable executable snapshot
SQLite     = persistent merchant business state
```

Putting `.git` inside a deletable release folder is contradictory; putting SQLite in Git is also wrong because it is binary, private, and high-churn.

## D14 — “Export succeeded” is not “mall import succeeded”

A generated Excel proves the tool prepared a batch, not that the mall accepted it.

**Decision.** v2.6 records export batches separately and allows explicit operator confirmation from `PREPARED` to `MALL_IMPORTED`.

## D15 — Detect state regression explicitly, then recover; never silently reset

v2.6 adds SQLite integrity checks, an internal high-water mark, external health anchor, daily/checkpoint backups, run/export ledgers, and explicit recovery.

**Failure policy.** If persistent state is missing/corrupt/behind a known high-water mark, **fail closed** rather than creating an empty history and continuing.
