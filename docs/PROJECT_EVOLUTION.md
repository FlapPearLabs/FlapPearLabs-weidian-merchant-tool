# Project Evolution — v1.0 → v2.6

> Purpose: preserve the project's **critical path, feature evolution, and reasoning** for engineering review and job-search presentation. This is a product/engineering history, not a claim that every historical version existed as a Git tag at the time.

## Context

The project started from a third-party Windows client package used to migrate public Weidian products into a mall Excel import workflow. The inherited baseline could scrape products and emit Excel, but its architecture, data contract, failure modes, and state semantics were opaque.

The first project task was therefore **not** “rewrite it from scratch.” It was to establish evidence:

1. statically recover the boot chain and core runtime;
2. identify the real Weidian data sources and SKU model;
3. validate the target mall Excel contract with successful imports;
4. only then iterate on merchant workflow, deduplication, reliability, and state management.

## Version matrix

| Version | Theme | Main change | Why it mattered |
|---|---|---|---|
| **v1.0** | Controlled category export | Added real shop-category discovery and category-scoped export. | Turned an opaque exporter into a controllable acquisition tool. |
| **v1.1** | Product selection | Added category, whole-shop keyword, category+keyword, and item ID/link modes; global history ledger. | Merchant can choose what to migrate instead of accepting a fixed flow. |
| **v1.2** | Search semantics + stability | Fixed keyword logic from AND to OR; added aliases; hardened top-level PowerShell failure behavior. | Matched real operator intent and stopped silent terminal exits. |
| **v1.3** | Clean import artifact | Separated upload-ready Excel from helper files; removed template examples/notes from upload sheet. | Fixed “upload parses but no import task appears” class of failure. |
| **v1.4** | Verified mall contract | Locked output to a real successful sample: 31 headers, row 2 data, category blank, status `放置仓库`, Chinese text preserved. | Replaced guessed mall semantics with black-box evidence. |
| **v1.5** | Latest-product workflow | Reintroduced a latest-products mode independent of an exhaustive baseline. | Supported the real workflow: move a shop’s recent items, not the whole catalog. |
| **v1.6** | Real add-time ordering | Used Weidian `addTime`; split lightweight list indexing from expensive detail/SKU/image fetch. | Stopped treating API order as absolute “latest”; reduced expensive work. |
| **v1.7** | Category+latest + retries | Added category+latest and multi-channel retry/checkpoint behavior. | Exposed a new failure mode: aggressive retries and full scans could worsen network/rate-limit instability. |
| **v1.8** | Request-budget control | Defaulted toward bounded intelligent windows and category-latest; progressive cooldown; fail early after repeated network failures. | Reliability became a first-class product constraint. |
| **v1.9** | Entity-level deduplication | Added five-layer matching and three-state verdicts; built a 1,721-entity historical baseline. | The system moved from string comparison to product identity resolution. |
| **v2.0** | Dynamic history + real failure fix | Fixed mall `规格已存在` duplicate-spec rows; advanced history after QA; added stress/regression evidence. | Rejected an attractive but false “too many SKUs” hypothesis and fixed the actual root cause. |
| **v2.1** | True incremental acquisition | “Find N truly new products” continues past duplicates until N new items are found; session-local baseline prevents within-run duplicates. | Business target is N new products, not N candidates. |
| **v2.2** | Fuzzy product discovery | Added multi-target natural-language fuzzy ranking, pagination, manual number selection, then full dedupe. | Search and identity resolution were intentionally separated. |
| **v2.3** | Category routing | Routed high-confidence product fragments into the real shop category before fuzzy ranking; low-confidence queries fall back to whole-shop scan. | Cut request surface dramatically without pretending routing is final truth. |
| **v2.4** | Stable terminal UX | Changed candidate selection to in-place single-screen redraw with non-TTY fallback. | Matured the tool from debug-output workflow to operator-facing workflow without touching core logic. |
| **v2.5** | State architecture | GitHub became code/version source of truth; release package became stateless; product/dHash/shop history moved to one SQLite database outside the version folder. | Removed sibling-version discovery and made old program folders disposable. |
| **v2.6** | Operational correctness | Added run ledger, export batches, mall confirmation state, high-water marks, health anchor, SQLite checks, checkpoints, history report, and explicit recovery. | The question changed from “did export run?” to “can we prove state did not silently regress, and recover if it did?” |

## Four architectural phases

### Phase A — Make the black box observable and validate the business contract

`legacy → v1.4`: recovered runtime/data path, known Weidian list/category/SKU/detail sources, real mall-import golden sample, clean 31-column contract, and an explicit `放置仓库` human-review boundary.

### Phase B — Control discovery while respecting external-system reliability

`v1.5 → v1.8`: `addTime` as ordering signal, cheap index scan vs. expensive detail fetch, category-first workflows, bounded windows and cooldowns instead of “retry harder.”

### Phase C — Resolve product identity and create a real incremental loop

`v1.9 → v2.4`: exact evidence + hard-spec conflicts + normalized text + character fuzzy + dHash; `DUPLICATE_CONFIRMED / NEW_CONFIRMED / REVIEW_REQUIRED`; fuzzy search is high-recall discovery, human selection is intent resolution, dedupe is high-precision identity resolution.

### Phase D — Separate code lifecycle from business-state lifecycle

`v2.5 → v2.6`:

```text
GitHub            Release ZIP              SQLite
(code history)    (replaceable runtime)     (persistent merchant truth)
```

This eliminated a fragile compatibility mechanism where new versions searched nearby old-version folders for a larger JSON baseline.

## Deliberately not built

- No tokenizer-first architecture.
- No embedding/vector database merely for fuzzy product identity.
- No heavy vision model or GPU requirement.
- No aggressive auto-selection of fuzzy search results.
- No automatic direct listing to customers after import.

These were explicit scope decisions based on catalog scale, error tolerance, deterministic evidence, and acceptable human review for the long tail.
