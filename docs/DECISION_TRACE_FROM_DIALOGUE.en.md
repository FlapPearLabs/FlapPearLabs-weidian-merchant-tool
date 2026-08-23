# Decision Trace from Dialogue

[中文](DECISION_TRACE_FROM_DIALOGUE.md) | **English**

This document preserves design turning points from the discussion: the initial direction, the operator's challenge, the final decision, and what the change demonstrates in a portfolio context.

## T01 — Do not save machine time by pushing complexity onto the operator

**Initial direction:** reduce comparisons using fingerprints/indexing.

**Challenge:** the real scaling problem is manual duplicate recognition. If pruning can miss duplicates, let the program compare more rather than forcing a person to repeatedly search a growing catalog.

**Final design:** fully fetched candidates can be compared against the complete relevant historical set. `100 × 1700 = 170k` and `200 × 5000 = 1M` comparisons are acceptable.

**Signal:** optimize the expensive resource—human attention—not the cheap one—local CPU.

## T02 — First fix the unit behind “5,000+ historical records”

Historical imports showed 5,000+ records while current products were around 1,600. The discussion rejected the assumption that thousands of products were missing.

Actual reconciliation: 5,278 SKU/data rows → ~1,628 product groups; eight batches → 1,721 historical entities.

**Impact:** this became the historical fact base for dedupe and removed the need for repeated manual historical screening.

## T03 — Same URL can be strong evidence; different URL does not prove a different image

Historical Excel already carried image URLs, but different CDNs/re-encodings can produce different URLs for the same image.

**Final design:** Playwright/Chrome pixel decode → Canvas 9×8 → 64-bit dHash → Hamming distance → cache.

Evidence hierarchy: identical/near dHash is useful visual evidence, but a hard-spec conflict vetoes a duplicate decision.

## T04 — Tokenizer is possible, but is it over-engineering?

Tokenizer, custom dictionary, embeddings/vector DB, multilingual semantics, and heavier vision were all considered.

The operator's repeated question was not “can we add them?” but “are we adding technology for its own sake?” A small manual review tail was acceptable.

**Final design:** hard-spec regexes + compact aliases + normalization + character 2/3-grams + character bag + edit distance + dHash + `REVIEW_REQUIRED`.

**Principle:** do not build a product-NLP stack merely to eliminate the last few ambiguous cases.

## T05 — Search and dedupe cannot be one algorithm

The operator wanted to enter multiple approximate targets, see candidate lists, select desired products, and fetch only those products.

**Final design:** multi-target fuzzy ranking → displayed candidate lists → human selection → deep fetch selected IDs → five-layer dedupe.

Search is high-recall; dedupe is high-precision. Fuzzy top1 is not user intent.

## T06 — Infer the rough product type first, then route to a category

v2.2 whole-shop fuzzy search could scan 2,000+ items.

The design deliberately avoided brand rules such as `Tommy → apparel`. Instead it uses high-information type fragments such as sweatshirt, shorts, denim, flip-flops, skincare, and scores them against the current shop's actual category names.

High confidence routes one category, medium routes the top one or two, low confidence falls back to the whole shop.

A real five-target apparel run reduced the scan surface to roughly 660–680 products.

**Principle:** routing has low business risk because it only reduces search space; human selection and final dedupe remain downstream.

## T07 — Latest must be proven by `addTime`, not inferred from list order

The first latest implementation used the API's leading records. Real response inspection showed `addTime`, and list order was not strictly identical to it.

**Final design:** lightweight `itemId/itemName/addTime` indexing → sort → deep-fetch target products only.

## T08 — Probe external systems instead of extending speculation

Two recurring examples:

- Weidian runtime capture validated real list/SKU/detail structures and diagnosed the missing category seed.
- A read-only mall probe plus historical Excel reconciliation was preferred over guessing where thousands of apparent products went.

**Principle:** minimal read-only evidence beats a long speculative explanation.

## T09 — Two failures do not prove a hidden SKU-count limit

450 rows produced 448 successes and two failures. Two SPUs also had unusually many SKUs, making a 30/50-SKU threshold an attractive story.

The operator required actual failure evidence before encoding a rule. The mall error was `规格已存在`; replay found exactly two duplicated final specification strings.

**Final design:** canonicalize and dedupe final specs inside an SPU; do not split the product.

## T10 — “Latest 100” really means “100 new products I do not have”

If the first 100 candidates contain 80 old products, returning 20 new ones does not meet the business request.

**Final design:** continue deep fetch/dedupe until `NEW_CONFIRMED == N` or the candidate horizon is exhausted.

## T11 — Sibling-version history lookup is a compatibility shim, not an architecture

New releases once scanned nearby v1.8/v2.0/v2.3/v2.4 folders to inherit the largest/newest JSON history.

The operator challenged this directly: deleting old versions should not affect the system.

**Final design:** GitHub=source/version history; Release=disposable runtime; SQLite=persistent business state. An intermediate idea of putting `.git` inside the deletable release was also rejected because deleting the release would delete Git state.

## T12 — Internal candidate-pool numbers should not become the operator's mental model

When the goal was five new products, the terminal exposed internal counts such as 200/148, making it appear that hundreds of products would be fetched. In reality, the process could stop after roughly 15 deep checks once five new products were found.

**Final design:** primary UI emphasizes target, checked, and found; internal pool sizes belong in diagnostics.

**Principle:** do not leak algorithmic implementation details as user-facing business quantities.

## T13 — Excel prepared is not mall imported

A valid Excel proves only preparation. v2.6 separates `PREPARED` from operator-confirmed `MALL_IMPORTED` and records run/export history around that distinction.

---

## Recurring working principles

1. Find evidence before promoting an observation to a rule.
2. Optimize human cost before local machine cost.
3. Use conservative logic for high-risk identity decisions; simple heuristics are acceptable for low-risk routing.
4. Model search, intent, identity, and business success separately.
5. Preserve UNKNOWN / REVIEW instead of forcing every case into a binary answer.
6. Avoid heavy AI dependencies when lightweight deterministic methods already meet the operational need.
7. Give source code, release artifacts, and business state separate lifecycles.
8. Keep internal algorithm state out of the operator's primary mental model.
