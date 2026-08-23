# FlapPearLabs Weidian Merchant Tool

[中文](README.md) | **English**

> **A merchant migration system evolved from an encrypted Windows exporter through evidence-driven reverse engineering, black-box validation, historical reconstruction, entity resolution, and persistent-state redesign.**

This project is not simply a “Weidian scraper.” It addresses a progressively harder merchant problem:

> **How do we find the products an operator actually wants, identify what is truly new, generate an Excel file the target mall really accepts, and preserve product identity across program upgrades, network failures, and deleted release folders?**

The starting point was a third-party package named `微店商品导出器-v1.2.0-客户版`. Instead of rewriting it from assumptions, the project first made the black box observable and then repeatedly corrected earlier designs using real runtime and mall-import evidence. The result evolved from a one-shot exporter into a local system for **product discovery, entity deduplication, persistent state, operational ledgers, and recovery**.

---

## 1. Critical path

```text
third-party encrypted Windows exporter
        ↓
static recovery: EXE / DAT / boot chain / Node / Playwright / ExcelJS
        ↓
function-level recovery → field lineage → Weidian JSON to 31-column Excel
        ↓
runtime probes: real list / SKU / detail / category behavior
        ↓
black-box mall validation using real successful and failed imports
        ↓
category / keyword / item-ID / addTime-based latest acquisition
        ↓
historical Excel reconciliation: 5,278 SKU rows are not 5,278 products
        ↓
reconstruct ~1.6k–1.7k historical product entities
        ↓
five-layer entity resolution + dHash image evidence + human review
        ↓
"latest N candidates" → "find N truly new products"
        ↓
multi-target fuzzy search → ranked lists → human selection → deep fetch → dedupe
        ↓
product-type fragments → real shop-category routing → whole-shop fallback
        ↓
version-folder JSON → fixed history center → SQLite source of truth
        ↓
GitHub / Release / SQLite lifecycle separation
        ↓
run ledger / export ledger / high-water / health anchor / checkpoint / recovery
```

See:

- [Critical Path](docs/CRITICAL_PATH.en.md)
- [Project Evolution](docs/PROJECT_EVOLUTION.en.md)
- [Decision Trace from Dialogue](docs/DECISION_TRACE_FROM_DIALOGUE.en.md)

---

## 2. High-leverage decisions

### 2.1 Reverse-engineer first, rewrite second

Static analysis established the actual chain:

```text
8KB .NET Framework C# launcher
        ↓
decrypt launcher.dat / engine.dat
        ↓
PowerShell + minified ESM JavaScript
        ↓
Node.js + Playwright + ExcelJS
        ↓
public Weidian H5 APIs
        ↓
31-column mall Excel
```

The work then went beyond “which library is used” into function-level recovery and field-level lineage. That preserved real compatibility behavior already solved by the inherited tool while making the new contribution boundary explicit.

### 2.2 Prefer observed mall behavior over plausible semantics

The mall importer is opaque. Rather than infer its contract from column names, the project used a workbook known to import successfully and locked the output to observed behavior: 31 columns, row 2 as first product row, category blank, product status `放置仓库`, Chinese source text preserved, and no template/helper rows in the upload artifact.

The same rule was applied to failures. A 450-row import produced 448 successes and two failures. The attractive hypothesis was “the mall has an SKU-count limit.” The actual failure data said `规格已存在`; replay found exactly two duplicated final specification strings. Canonicalization produced 448 rows without splitting SPUs.

### 2.3 Reconcile the history before designing dedupe

A historical count above 5,000 initially looked inconsistent with roughly 1,600 current mall products. The historical Excel files showed the numbers used different units:

- 7 historical files: **5,278 SKU/data rows → about 1,628 product groups**;
- 8 batches: **1,729 raw groups → 1,721 historical product entities**.

This created a historical identity baseline that predates the new tool. It also changed the optimization target: human duplicate hunting gets progressively worse as the catalog grows, while a local program can cheaply compare hundreds of thousands or even a million product pairs. The system therefore prioritizes **reducing human complexity rather than minimizing CPU comparisons at any cost**.

### 2.4 An image URL is evidence, not image identity

Historical workbooks already contained CDN URLs, but URL equality is not enough. Different CDNs, dimensions, JPEG/WebP re-encoding, or query parameters can produce different URLs and bytes for the same visual image.

The project therefore reused Playwright/Chrome:

```text
image URL
→ Chrome decode
→ Canvas normalize to 9×8 grayscale
→ Node computes 64-bit dHash
→ Hamming distance
→ cached result
```

A regression using the same visual image re-encoded from PNG to JPEG produced **Hamming Distance = 0**. dHash became an independent evidence source, but it never overrides a hard-spec conflict such as 30ml vs. 60ml. Since v2.5, dHash entries live in SQLite `image_hashes` rather than release-local JSON.

### 2.5 Deliberately avoid tokenizer/embedding over-engineering

Tokenizer, custom dictionaries, embeddings, vector databases, and heavier vision models were all considered. They were intentionally not made default dependencies.

At this catalog scale, deterministic techniques are cheap and inspectable:

```text
exact IDs/SKUs
+ hard-spec regexes
+ title normalization
+ character 2/3-grams
+ character bag / edit distance
+ dHash
+ REVIEW_REQUIRED for ambiguity
```

The principle is not “never use embeddings.” It is **buy complexity only when real failure samples justify it**.

### 2.6 Separate search, intent confirmation, deep fetch, and dedupe

A query such as “Hollister women’s light-gray sweatshirt” is not an exact database key. The workflow therefore separates four concerns:

```text
multiple natural-language targets
→ high-recall fuzzy ranking
→ candidate lists per target
→ operator selects numbers
→ deep-fetch selected products only
→ high-precision historical dedupe
→ confirmed-new products enter mall Excel
```

Fuzzy ranking should not silently decide user intent; dedupe should not be weakened merely to increase search recall.

### 2.7 Route by product type before scanning the entire shop

v2.2 fuzzy search worked but could scan 2,000+ shop items. v2.3 introduced a thin, explainable routing layer based on product-type fragments rather than brand hardcoding:

```text
sweatshirt / jacket / shorts / denim
→ apparel

flip-flops / sandals / sneakers
→ footwear

cream / serum / skincare
→ cosmetics
```

Those fragments are scored against the **shop’s actual live category names**:

- high confidence → best category;
- medium confidence → top one or two categories;
- low confidence → whole-shop fallback.

In a real five-target apparel run, all targets routed to `衣服鞋帽`, reducing the scan surface from 2,000+ items to roughly 660–680, while still retaining human selection and final five-layer dedupe.

### 2.8 Sibling-version history inheritance was a migration shim, not an architecture

v2.3/v2.4 could search nearby old release folders for a larger/newer JSON history. That helped upgrades, but deleting v1.8/v2.0/v2.3 should never threaten merchant identity history.

v2.5 therefore separated three lifecycles:

```text
GitHub      = source and version history
Release ZIP = disposable runtime snapshot
SQLite      = persistent merchant business state
```

Product entities, same-shop history, dHash and events live outside every version folder at:

```text
%LOCALAPPDATA%\WeidianMerchantTool\data\state.sqlite3
```

Future releases open the same database directly; old program directories can be deleted.

### 2.9 Execution success is not business success

Creating and QA-validating an Excel file proves only that a batch is `PREPARED`. It does not prove the mall accepted it. v2.6 therefore separates:

```text
PREPARED
→ operator confirms actual mall import
→ MALL_IMPORTED
```

The same release adds run/export ledgers, SQLite integrity checks, internal high-water marks, an external health anchor, daily/checkpoint backups, and explicit recovery.

---

## 3. Version evolution

| Version | Theme | Main change |
|---|---|---|
| **Pre-v1.0** | Reverse engineering & evidence | EXE/DAT/boot-chain recovery, function/field lineage, runtime API probes |
| **v1.0** | Category acquisition | Discover real shop categories and export by `cateId` |
| **v1.1** | Controlled discovery | Category / whole-shop keyword / category+keyword / item ID-link + global history |
| **v1.2** | Search semantics | Multi-keyword AND → OR; aliases; safer launcher failure behavior |
| **v1.3** | Clean upload artifact | Separate upload workbook from helper/template content |
| **v1.4** | Verified mall contract | Lock 31 columns, blank category, `放置仓库`, Chinese source text |
| **v1.5** | Latest workflow | Add recent-product acquisition independent of a full crawl |
| **v1.6** | Real latest ordering | Use `addTime`; separate light index from detail/SKU/image fetch |
| **v1.7** | Category latest / retries | Add category+latest, checkpoints, retry experiments |
| **v1.8** | Request-budget control | Low-frequency scanning, cooldowns, bounded windows |
| **v1.9** | Entity resolution | 1,721 historical entities + five evidence layers + three-state verdict + dHash |
| **v2.0** | Dynamic history / failure root cause | Fix duplicate final specs; advance history only after QA |
| **v2.1** | True incremental | Continue until N truly new products are found |
| **v2.2** | Multi-target fuzzy discovery | Fuzzy ranking, pagination, human selection, deep-fetch selected only |
| **v2.3** | Category routing | Route product-type fragments to real categories; fixed external history center |
| **v2.4** | Terminal UX | Single-screen in-place candidate selection |
| **v2.5** | State architecture | GitHub / Release / SQLite separation; remove sibling-history dependency |
| **v2.5.1** | Incremental UX correction | Hide misleading 200/148 internal pools from primary progress; temp-ZIP launch guard |
| **v2.6** | Operational correctness | Runs/exports, mall confirmation, high-water, health anchor, checkpoints, recovery |

Historical compact packets are under [`archive/version-packets/`](archive/version-packets/).

---

## 4. Selected evidence

| Evidence | Result |
|---|---:|
| Historical Excel reconciliation | **5,278 SKU/data rows → ~1,628 product groups** |
| Historical entity reconstruction | **1,729 raw groups → 1,721 entities** |
| Real v2.0 run, 100 candidates | **79 duplicates / 1 review / 20 new** |
| Those 20 new products | **122 SKU rows; 31-column QA PASS; 0 required-field issues** |
| Mall failure replay | **448 success / 2 failure → exactly 2 duplicated final specs** |
| dHash regression | Same visual PNG vs JPEG → **Hamming Distance 0** |
| Full-history stress test | **500 × 1,722 ≈ 861k** comparisons; 500/500 new confirmed |
| Real v2.3 routing run | 5 targets → apparel category; select 5, block 1 old, export **4 new / 40 SKU** |
| v2.5 first SQLite initialization | **1,745 products / 1,740 dHash / 104 same-shop history** |
| Subsequent persistent run | History advanced **1,745 → 1,750** across process restart |

See [Validation Evidence](docs/VALIDATION_EVIDENCE.en.md).

---

## 5. Current architecture

```text
GitHub repository
  ├─ source / tests / bilingual docs
  └─ compact historical version packets

Release ZIP
  └─ disposable runtime; no user state; no .git

%LOCALAPPDATA%\WeidianMerchantTool\
  ├─ data\state.sqlite3
  ├─ data\health_anchor.json
  ├─ backups\
  ├─ cache\
  └─ logs\
```

SQLite Schema 2 includes `products`, `image_hashes`, `global_history`, `events`, `runs`, and `export_batches`.

---

## 6. Portfolio entry points

- [Portfolio & Interview Notes](docs/PORTFOLIO_NOTES.en.md)
- [Decision Trace from Dialogue](docs/DECISION_TRACE_FROM_DIALOGUE.en.md)
- [Decision Log](docs/DECISION_LOG.en.md)
- [Origin & Contribution Boundary](docs/ORIGIN_AND_PROVENANCE.en.md)
- [Architecture](ARCHITECTURE.en.md)
- [Changelog](CHANGELOG.en.md)

The project is intentionally careful about claims: it does not present the inherited exporter as original work, fuzzy character matching as LLM semantic search, or unverified remote runs as successful live E2E evidence.

## Current version

**v2.6.0**
