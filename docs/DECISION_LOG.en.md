# Decision Log — High-Leverage Product & Engineering Decisions

[中文](DECISION_LOG.md) | **English**

Each entry preserves the problem, tempting shortcut, correction from user/evidence, final design, and rationale.

## D00 — Establish evidence levels before modifying an inherited black box

Manage conclusions as `VERIFIED / INFERRED / UNKNOWN`. Prefer static recovery first, preserve the original package, and do not promote guesses into facts.

## D01 — Reverse-engineer first; do not rewrite an unknown working tool

**Rejected:** reproduce surface behavior from scratch.

**Chosen:** recover the boot chain, business runtime, API path, and Excel lineage before redesigning components.

**Why:** the inherited system already encodes real compatibility details.

## D02 — Use read-only probes at external-system boundaries

When static analysis cannot prove the real API shape, category seed behavior, or current mall inventory, capture real JSON with minimal read-only probes instead of extending speculation.

## D03 — Treat a real successful mall import as the golden contract

Observed successful workbook behavior outranks plausible column semantics. The output was locked to 31 columns, product data from row 2, blank category, Chinese text preservation, and `放置仓库` status.

## D04 — Stop automation at `放置仓库`

Operators still adjust price, stock, discounts, categories, and content. The safe automation boundary is “prepared for review,” not “automatically live to customers.”

## D05 — Reconcile historical Excel at product level before building dedupe

**Problem:** 5,000+ historical records vs. ~1,600 products looked like a large loss.

**Evidence:** 5,278 SKU/data rows grouped into about 1,628 products; eight batches formed 1,721 historical entities.

**Impact:** dedupe now covers merchant history from before the new tool existed.

## D06 — Optimize human effort before CPU effort

The operator corrected an early indexing direction: local comparisons are cheap, while manual duplicate review scales badly with catalog size.

**Decision:** do not use aggressive candidate pruning to declare products new; compare fully fetched candidates against the complete relevant historical set when needed.

## D07 — Product identity is multi-evidence, not a title hash

Use exact IDs/SKUs/codes, hard-spec conflicts, normalized titles, character-level fuzzy similarity, and dHash image evidence. Return `DUPLICATE_CONFIRMED`, `NEW_CONFIRMED`, or `REVIEW_REQUIRED`.

## D08 — Do not trust image URLs as image identity

The same image can move across CDNs, resolutions, or encodings. Reuse Chrome Canvas to compute 64-bit dHash and cache it. Hard-spec conflicts override image similarity.

## D09 — Reject tokenizer/embedding until real errors justify them

**Rejected as defaults:** tokenizer, embeddings, vector DB, heavy vision stack.

**Chosen:** hard-spec regexes + compact aliases + char n-grams + char bag + edit distance + dHash + human review.

**Why:** complexity should be purchased by real failure samples, not by technology fashion.

## D10 — Separate discovery, intent confirmation, deep fetch, and dedupe

```text
multi-target fuzzy search
→ ranked candidate lists
→ human selects IDs
→ selected products get full detail/SKU
→ high-precision historical dedupe
```

Search optimizes recall; dedupe optimizes precision.

## D11 — Use type fragments for low-risk category routing, not brand hardcoding

Score product-type fragments against the shop's live categories. High confidence routes the best category, medium the top one or two, low confidence falls back to the whole shop.

Routing reduces request surface; it does not decide product identity.

## D12 — Real latest means `addTime`, not API list order

Real list data showed API order and `addTime` were not strictly identical. Latest acquisition therefore uses a lightweight time index and deep-fetches only chosen candidates.

## D13 — Control request budget instead of retrying harder

Full-shop scans and aggressive retries caused socket hangups / HTTP2 errors. Category-latest, bounded windows, cooldowns, active stop, and routing are safer than unlimited retry pressure.

## D14 — Do not convert correlation into a mall rule

Two failures occurred in a 450-row import and two SPUs had many SKUs. The real failure data was `规格已存在`, with two duplicate final spec strings.

**Fix:** canonicalize final specs; 450 → 448; do not split the SPU.

## D15 — Define incremental output in business terms

If the operator requests 100 new products, keep scanning until 100 `NEW_CONFIRMED` products are found or the horizon is exhausted. N candidates is not the business objective.

## D16 — Show business progress, not scary internal queue sizes

A target of five new products should not present 200/148 internal candidate pools as if hundreds will be fetched. Primary UI shows target / checked / found; internal pools stay in diagnostics.

## D17 — Sibling-version history inheritance is a migration shim, not architecture

Searching nearby v1.8/v2.0/v2.3/v2.4 folders for a larger/newer JSON baseline was acceptable for compatibility but wrong as a permanent design.

**Decision:** move to a fixed external state center and then SQLite; permanently remove sibling scanning.

## D18 — Separate GitHub / Release / SQLite lifecycles

```text
GitHub = source/version history
Release ZIP = disposable executable snapshot
SQLite = persistent merchant business state
```

Putting `.git` inside a deletable release is contradictory; putting private high-churn SQLite state in Git is also wrong.

## D19 — Export success is not mall-import success

Excel QA proves only `PREPARED`. v2.6 requires explicit operator confirmation to reach `MALL_IMPORTED`.

## D20 — Detect state regression and fail closed

Missing/corrupt/rolled-back SQLite state must not silently restart from an empty history. v2.6 adds `quick_check`, foreign-key checks, internal high-water, external health anchor, backups, ledgers, and explicit recovery.
