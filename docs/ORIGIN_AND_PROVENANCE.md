# Origin, Provenance & Contribution Boundary

A credible portfolio should distinguish **inherited work** from **project contributions**.

## Inherited starting point

The project began from a third-party Windows package described as `微店商品导出器-v1.2.0-客户版`, already used in a real merchant workflow.

Static analysis showed the inherited package contained:

- a small .NET C# protected launcher;
- encrypted launcher/business-runtime payloads;
- bundled Node.js runtime;
- Playwright + ExcelJS dependencies;
- a mall Excel template;
- logic for public Weidian product acquisition and workbook generation.

The inherited binary/source is **not claimed as original work by this repository** and is not redistributed in this portfolio archive.

## Project work layered on top

The portfolio contribution is the evidence-driven analysis, redesign and iterative engineering work after obtaining that baseline, including:

1. recovering and documenting the boot/data path;
2. validating the mall import contract through real success/failure samples;
3. controlled category/keyword/ID/latest acquisition modes;
4. `addTime`-based latest ordering and cheap-index/expensive-detail separation;
5. request-budget and cooldown design;
6. reconstruction of historical product entities from past mall imports;
7. five-layer entity deduplication and three-state decisions;
8. browser-Canvas dHash cache and evidence hierarchy;
9. duplicate final-spec regression based on actual mall failure data;
10. true-N-new incremental acquisition;
11. fuzzy multi-target search, manual selection and category routing;
12. single-screen terminal UX;
13. state separation into GitHub / disposable Release / external SQLite;
14. run/export ledgers, health anchors, checkpoints, mall-confirmation state and recovery tooling.

## Historical version packets

`archive/version-packets/` contains **compact project-history packets**, not full production releases. Each packet records milestone notes, original local artifact identity/SHA256, and a source/config file index.

They intentionally avoid committing duplicated ~47MB runtime bundles and exclude production/user state.

## Portfolio claim language

Recommended:

> “Reverse-engineered and progressively rebuilt an inherited merchant migration tool into a stateful product-discovery and entity-deduplication system, validating decisions against real mall import evidence.”

Avoid:

> “Built the original Weidian exporter entirely from scratch.”

That distinction makes the project stronger: the work demonstrates inherited-system analysis, contract discovery, uncertainty management, safe iteration and operational state design.
