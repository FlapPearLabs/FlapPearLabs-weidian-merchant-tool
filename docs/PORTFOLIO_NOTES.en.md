# Portfolio & Interview Notes

[中文](PORTFOLIO_NOTES.md) | **English**

## One-line description

**Reverse-engineered an inherited Weidian-to-mall exporter and evolved it into a stateful product-discovery and entity-resolution system with verified Excel contracts, historical reconciliation, fuzzy search/category routing, five-layer dedupe, SQLite continuity, and recovery tooling.**

## Resume-ready version

> **Weidian Merchant Migration & Entity Resolution System** — Reverse-engineered an inherited Windows exporter into a maintainable data path (.NET launcher → PowerShell/Node → Playwright → public Weidian APIs → verified 31-column mall Excel). Reconciled 5,278 historical SKU/data rows into ~1.6k product groups and a 1,721-entity baseline; built five-layer entity resolution (IDs/SKUs, hard specs, normalized text, character fuzzy matching, browser-Canvas dHash) with explicit review fallback. Added true-N-new incremental acquisition, multi-target fuzzy discovery with human selection, category routing, and request-budget controls while deliberately avoiding unnecessary tokenizer/embedding complexity. Separated source/releases from persistent SQLite merchant state and added ledgers, health anchors, checkpoints, and recovery.

## Interview story 1 — Reverse engineering without losing the business problem

**Situation.** An encrypted Windows package was already used in a real merchant workflow, but it was unclear whether the core lived in the EXE, Node runtime, browser automation, or Excel template.

**Action.** Followed a static-first evidence chain: file inventory → EXE → DAT container → loader → recovered runtime → API → Excel. Then built function-level and field-level lineage and added read-only runtime probes.

**Result.** Turned a black-box exporter into an explainable system where a Weidian JSON field could be traced to a mall Excel column.

**Signal.** Inherited-system analysis, evidence hierarchy, avoiding premature rewrites.

## Interview story 2 — Correcting the “5,000 vs 1,600” data illusion

**Situation.** More than 5,000 historical import records appeared incompatible with roughly 1,600 current mall products.

**Wrong conclusion available.** Thousands of products had disappeared.

**Action.** Parsed all historical import Excel files, grouped SKU rows into products, and reconciled the result with current inventory evidence.

**Result.** 5,278 rows represented about 1,628 product groups; eight batches were further consolidated into 1,721 historical entities.

**Signal.** Data-definition discipline, reconciliation, resistance to misleading metric labels.

## Interview story 3 — Optimize human cost before CPU cost

**Situation.** Manual duplicate review became the real scaling bottleneck as the catalog grew.

**Initial idea.** Use aggressive indexing/fingerprints to avoid full comparisons.

**Correction.** If approximate pruning risks misses, local machine time is cheaper than repeated human review.

**Result.** Kept full relevant-history comparisons at manageable scale; stress-tested ~861k product pairs.

**Signal.** Choosing the right optimization target and prioritizing reliability over premature optimization.

## Interview story 4 — Why dHash was added even though image URLs already existed

**Situation.** Historical Excel files already contained main-image URLs.

**Problem.** URL identity is not visual identity. Different CDNs, sizes, or image re-encoding can point to the same visual content.

**Action.** Reused Chrome/Canvas to decode pixels and compute a 64-bit dHash; no OpenCV, TensorFlow, GPU, or heavy vision stack.

**Result.** The same image re-encoded PNG→JPEG produced Hamming distance 0; real dedupe also used dHash to recover changed-title duplicates.

**Signal.** Independent evidence sources, pragmatic image processing, reuse of existing runtime capabilities.

## Interview story 5 — Deliberately not adding tokenizer / embeddings

**Situation.** Product titles mix Chinese/English brands, changed word order, units, and marketing noise.

**Available solution.** Tokenizer + custom dictionary + embeddings/vector DB.

**Decision.** Do not add them until real errors justify the complexity. Use hard specs, compact aliases, normalization, character n-grams, edit distance, dHash, and human review.

**Why.** At a 1.7k–5k historical catalog size, deterministic comparison is cheap, inspectable, and easier to debug. Long-tail ambiguity can be surfaced as `REVIEW_REQUIRED` instead of hidden behind semantic confidence.

**Signal.** Complexity budgeting and knowing when *not* to use AI.

## Interview story 6 — Search high recall, dedupe high precision

**Situation.** The operator often knows only approximate descriptions and may search for several products at once.

**Action.** One target per line → fuzzy-ranked candidates → manual number selection → deep-fetch selected products only → five-layer dedupe.

**Why.** A fuzzy top result should not silently define user intent.

**Signal.** Human-in-the-loop architecture and separation of error profiles.

## Interview story 7 — Category routing as a low-risk heuristic

**Situation.** Multi-target fuzzy search across 2,000+ shop items generated too many requests.

**Action.** Extract product-type fragments and score them against the shop's live category names. High confidence routes one category, medium routes the top two, and low confidence falls back to the whole shop.

**Result.** Five apparel targets routed to a ~660–680-item category, and a single category scan was reused across all targets.

**Signal.** System optimization without increasing business-decision risk.

## Interview story 8 — Two failures and refusing to invent a hidden SKU limit

**Situation.** 450 SKU rows produced 448 successes and two failures; two high-SKU products looked suspicious.

**Tempting fix.** Split products above an invented 30/50-SKU threshold.

**Action.** Inspect the actual failure data.

**Result.** Error was `规格已存在`; exactly two final spec strings were duplicated. Canonicalization reproduced 448 valid rows without splitting SPUs.

**Signal.** Root-cause analysis and resistance to confirmation bias.

## Interview story 9 — “Latest 100” is a product goal, not a database slice

**Situation.** The first 100 latest candidates could contain 80 historical duplicates.

**Insight.** The business request was “give me 100 products I do not already have,” not “inspect 100 records.”

**Action.** Implement a goal-seeking loop until 100 `NEW_CONFIRMED` products are found or the candidate horizon is exhausted.

**Signal.** Translating implementation units into user outcomes.

## Interview story 10 — From sibling-version history to SQLite lifecycle separation

**Situation.** Releases searched nearby old version folders for the newest/largest JSON history.

**User challenge.** Deleting v1.8/v2.0/v2.3 should not threaten merchant history.

**Action.** Separate GitHub=code, Release=disposable runtime, SQLite=persistent state. An intermediate idea of placing `.git` inside the release was also rejected because deleting the release would delete the repository state.

**Result.** Version upgrades no longer migrate merchant identity data.

**Signal.** Lifecycle modeling and correcting architecture from first principles.

## Interview story 11 — Internal candidate pool vs. operator mental model

**Situation.** Goal=5 new products, while the terminal displayed internal pools such as 200/148 and made it look as if hundreds would be fetched. Actual deep checks stopped around 15 once five new products were found.

**Decision.** Primary UI shows target / checked / found; internal queue sizes belong in diagnostic logs.

**Signal.** UX as abstraction design, not cosmetic formatting.

## Why this project matters for AI Product / Agent / FDE roles

- evidence-backed decisions instead of confident guessing;
- explicit UNKNOWN / REVIEW states;
- multi-source evidence fusion without unnecessary model complexity;
- human confirmation at intent and business-success boundaries;
- durable state across runs and versions;
- request-budget handling under unreliable external systems;
- observability and recovery;
- ability to inherit, understand, and improve an existing customer workflow.

## What not to oversell

- Do not call character-level fuzzy search “LLM semantic search.”
- Do not claim perfect duplicate detection.
- Do not claim the inherited exporter was authored from scratch.
- Do not claim the target mall's internal importer is known.
- Do not present every historical milestone as an original contemporaneous Git tag.
- Do emphasize the repeated pattern: **hypothesis → evidence → correction → safer design**.
