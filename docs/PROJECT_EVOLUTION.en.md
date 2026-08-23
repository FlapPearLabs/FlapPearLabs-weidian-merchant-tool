# Project Evolution — Legacy Baseline → v2.6

[中文](PROJECT_EVOLUTION.md) | **English**

This is the product/engineering evolution history, not a claim that every historical version originally existed as a Git tag. The sequence is reconstructed from conversation records, artifacts, code states, and real runs.

## Phase 0 — Before v1.0: make the inherited black box understandable

### Static recovery

The project started from the third-party `微店商品导出器-v1.2.0-客户版` package. The first work was not feature development but evidence collection:

```text
file inventory
→ hashes
→ EXE technology
→ DAT container
→ loading chain
→ runtime recovery
```

Key findings included a small .NET Framework C# launcher, recovered PowerShell/ESM JavaScript payloads, Node.js + Playwright + ExcelJS, public Weidian H5 list/category/SKU/detail paths, and a 31-column mall workbook model.

### Function-level / field-level recovery

The project then documented function maps, main/launcher flow, Weidian API contracts, internal models, and field lineage from JSON into Excel columns. Recovered semantic names are not presented as original source names.

### Runtime probes

Read-only captures of real item-list/SKU/detail/category behavior validated static assumptions and diagnosed external behavior changes.

### Mall black-box contract

Real successful/failed imports were used to establish the target integration contract.

---

## Version matrix

| Version | Theme | Main change | Key learning |
|---|---|---|---|
| **v1.0** | Controlled category export | Discover real shop categories and export by `cateId` | Make the inherited exporter operator-controllable |
| **v1.1** | Product selection | Category / whole-shop keyword / category+keyword / ID-link + global item history | “What should I migrate?” becomes a first-class concern |
| **v1.2** | Search semantics | Multi-keyword AND → OR; aliases; safer launcher behavior | Interpret keywords according to merchant intent |
| **v1.3** | Clean import artifact | Separate upload workbook from template/helper content | The deliverable must be clean enough for the mall importer |
| **v1.4** | Verified mall contract | 31 columns, row-2 data, blank category, `放置仓库`, Chinese source text | Observed success outranks guessed semantics |
| **v1.5** | Latest workflow | Recent-product mode independent of a full crawl | Real work is not always “migrate the whole shop” |
| **v1.6** | Real latest ordering | Use `addTime`; cheap list index vs expensive deep fetch | API order is not proof of latest |
| **v1.7** | Category latest / retries | Category+latest, checkpoints, retry experiments | Aggressive retry/scanning can worsen reliability |
| **v1.8** | Request budget | Bounded windows, cooldowns, category-latest default | External API reliability becomes a product constraint |
| **v1.9** | Historical entity resolution | Reconstruct 1,721 entities; five evidence layers; three-state verdict | Manual duplicate hunting is the scaling cost |
| **v2.0** | Evidence-driven failure fix | Fix `规格已存在`; advance history after QA | Reject an attractive but false SKU-count hypothesis |
| **v2.1** | True incremental | Continue until N truly new products are found | The business target is N new items, not N candidates |
| **v2.2** | Multi-target fuzzy discovery | Natural-language targets, ranking, lists, manual selection, selected-only deep fetch | Search and identity resolution have different error profiles |
| **v2.3** | Category routing | Product-type fragments → live categories; fallback when uncertain | Routing only reduces search space; it is not semantic truth |
| **v2.4** | Terminal UX | Single-screen in-place candidate selection | Internal state should not flood the operator interface |
| **v2.5** | State lifecycle | GitHub / Release / SQLite separation; dHash moves into DB | Sibling-version history lookup is not a long-term architecture |
| **v2.5.1** | Incremental UX correction | Hide 200/148 internal pools from primary UI; add temp-ZIP launch guard | Algorithm queues should not become business quantities |
| **v2.6** | Operational correctness | Run/export ledgers, high-water, health anchor, checkpoints, recovery | State must be continuous, auditable, and recoverable |

`v2.5.1` is a documented point-release stage, but no standalone final full artifact is currently preserved, so the archive intentionally does not invent a binary packet or SHA.

---

## Capability evolution

### Discovery

```text
category
→ keyword OR
→ category + keyword
→ item ID/link
→ addTime latest
→ category latest
→ multiple fuzzy targets
→ routed fuzzy search
```

### Identity

```text
same itemId only
→ reconstructed historical baseline
→ exact SKU/code
→ hard specs
→ normalized title
→ character fuzzy
→ image URL
→ dHash
→ three-state verdict
```

### State

```text
per-run/category JSON
→ global JSON history
→ historical entity baseline
→ dynamic rolling baseline
→ fixed LOCALAPPDATA history center
→ SQLite single source of truth
→ health / ledgers / checkpoints / recovery
```

### Reliability

```text
simple retry
→ checkpoints
→ network fallback / lower frequency
→ cooldown / bounded window
→ category routing
→ fail-closed state checks
```

---

## Corrections that materially changed the design

1. API order ≠ latest → use `addTime`.
2. 5,000 import rows ≠ 5,000 products → group SKU/data rows into product entities.
3. Different URL ≠ different image → dHash.
4. Fuzzy match ≠ user intent → display candidates and require selection.
5. Fuzzy search ≠ dedupe → high recall first, high precision later.
6. High SKU count ≠ failure cause → real error was duplicate final spec.
7. Latest N candidates ≠ N new products → goal-seeking incremental loop.
8. Retrying harder ≠ more reliable → request budget and routing.
9. History inheritance ≠ version architecture → external SQLite.
10. Excel generated ≠ mall accepted → `PREPARED` vs `MALL_IMPORTED`.
11. Candidate pool ≠ products actually deep-fetched → show target/checked/new instead.

## Deliberately not built

- tokenizer-first architecture;
- vector DB / embeddings merely for this catalog scale;
- heavy vision model/GPU dependency;
- brand→category encyclopedia;
- automatic fuzzy top1 selection;
- automatic live-to-customer listing;
- silent reset when persistent history is missing.

These are intentional complexity and risk boundaries, not unfinished checkboxes.
