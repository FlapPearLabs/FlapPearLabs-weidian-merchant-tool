# Origin, Provenance & Contribution Boundary

[中文](ORIGIN_AND_PROVENANCE.md) | **English**

A credible portfolio should distinguish **inherited work** from **project contributions**.

## Inherited starting point

The project began from a third-party Windows package described as `微店商品导出器-v1.2.0-客户版`, already used in a real merchant workflow.

Static analysis showed the inherited package contained:

- a small .NET C# protected launcher;
- encrypted launcher/business-runtime payloads;
- a bundled Node.js runtime;
- Playwright + ExcelJS dependencies;
- a mall Excel template;
- logic for public Weidian product acquisition and workbook generation.

The inherited binary/source is **not claimed as original work by this repository** and is not redistributed in this public portfolio archive.

## Project work layered on top

The portfolio contribution is the evidence-driven analysis, redesign, validation, and iterative engineering after obtaining that baseline, including:

1. recovering and documenting the boot/data path;
2. function-level and field-level data-flow reconstruction;
3. read-only runtime probes for real list/SKU/detail/category behavior;
4. validating the mall-import contract through real success/failure samples;
5. controlled category/keyword/ID/latest acquisition modes;
6. `addTime`-based latest ordering and cheap-index/expensive-detail separation;
7. request-budget and cooldown design;
8. reconstruction of historical product entities from past mall imports;
9. five-layer entity deduplication and three-state decisions;
10. browser-Canvas dHash cache and evidence hierarchy;
11. duplicate final-spec regression based on actual mall failure data;
12. true-N-new incremental acquisition;
13. fuzzy multi-target search, manual selection, and category routing;
14. operator-facing terminal UX and internal-state abstraction;
15. state separation into GitHub / disposable Release / external SQLite;
16. run/export ledgers, health anchors, checkpoints, mall-confirmation state, and recovery tooling.

## Historical version packets

`archive/version-packets/` contains **compact project-history packets**, not full production releases. Each packet records milestone notes, original local artifact identity/SHA256, and a source/config file index.

They intentionally avoid committing duplicated ~47MB runtime bundles and exclude production/user state.

`v2.5.1` is documented as a real point-release stage, but no standalone final binary artifact is currently preserved; the archive therefore does not invent a SHA or packet for it.

## Recommended portfolio claim

> “Reverse-engineered and progressively rebuilt an inherited merchant migration tool into a stateful product-discovery and entity-deduplication system, validating decisions against real mall import evidence.”

Avoid:

> “Built the original Weidian exporter entirely from scratch.”

That distinction strengthens the project: the work demonstrates inherited-system analysis, contract discovery, uncertainty management, evidence-driven iteration, and operational state design.
