# Portfolio & Interview Notes

## One-line description

**Reverse-engineered an inherited Weidian-to-mall exporter and evolved it into a stateful product-discovery and entity-resolution system with verified Excel contracts, historical reconciliation, fuzzy search/category routing, five-layer dedupe, SQLite continuity and recovery tooling.**

## Resume-ready Chinese

> **微店商品迁移与商品实体去重系统｜个人项目 / AI 辅助工程实践**  
> 接手第三方 Windows 商家导出器后先完成证据驱动逆向：还原 .NET→PowerShell/Node→Playwright→微店公开 API→31 列 Excel 数据链，并通过只读探针和真实商城成功/失败样本校验字段契约。解析历史导入 Excel 后将 5,278 个 SKU/data rows 重建为约 1.6k 商品组，并归并为 1,721 个历史实体；设计 `ID/SKU → 硬规格 → 标题归一化 → 字符模糊 → Chrome Canvas dHash` 五层实体去重和 `REVIEW_REQUIRED` 人工兜底。进一步实现 `addTime` 真最新、N 个真正新品、多目标模糊找货、候选人工选号、商品类型分类路由和请求预算控制；主动放弃 tokenizer/embedding 等过度复杂方案。v2.5 将版本目录历史重构为外部 SQLite 单一状态源，v2.6 增加运行/导出账本、高水位、健康锚点、checkpoint 和显式恢复。真实 100 候选运行自动挡掉 79 个历史重复，仅 1 个需人工确认，20 个新品展开 122 SKU 且 31 列 QA 必填问题为 0。

## Resume-ready English

> **Weidian Merchant Migration & Entity Resolution System** — Reverse-engineered an inherited Windows exporter into a maintainable data path (.NET launcher → PowerShell/Node → Playwright → public Weidian APIs → verified 31-column mall Excel). Reconciled 5,278 historical SKU/data rows into ~1.6k product groups and a 1,721-entity baseline; built five-layer entity resolution (IDs/SKUs, hard specs, normalized text, character fuzzy matching, browser-Canvas dHash) with explicit review fallback. Added true-N-new incremental acquisition, multi-target fuzzy discovery with human selection, category routing and request-budget controls while deliberately avoiding unnecessary tokenizer/embedding complexity. Separated source/releases from persistent SQLite merchant state and added ledgers, health anchors, checkpoints and recovery.

---

# Strongest interview stories

## Story 1 — Reverse engineering without losing the business problem

**Situation:** inherited encrypted Windows package; unclear whether core was EXE, Node, browser automation or template magic.

**Action:** static-first evidence chain: file inventory → EXE → DAT → loader → runtime → API → Excel; then function-level and field-level lineage; finally runtime probes.

**Result:** converted “black box exporter” into an explainable system where a Weidian JSON field could be traced to a mall Excel column.

**Signal:** inherited-system analysis, evidence hierarchy, ability to avoid premature rewrites.

---

## Story 2 — Correcting a 5,000-vs-1,600 data illusion

**Situation:** historical import count 5,000+ looked incompatible with ~1,600 current mall products.

**Wrong conclusion available:** thousands of products were lost.

**Action:** download/parse all historical Excel, group SKU rows into product groups, compare with current inventory probe.

**Result:** 5,278 rows ≈1,628 product groups; later 1,721 historical entities. The apparent huge data loss largely disappeared.

**Signal:** data-definition discipline, reconciliation, resisting metric-label assumptions.

---

## Story 3 — Designing dedupe around human cost, not CPU cost

**Situation:** as history grew, manual duplicate review became the real scaling bottleneck.

**Initial optimization idea:** aggressive indexes / fingerprints to avoid full comparisons.

**Correction:** if approximate pruning risks misses, machine time is cheaper than human rework.

**Result:** full relevant history comparison at manageable scale; stress tested ~861k pairs without false duplicate/review in the synthetic new set.

**Signal:** optimization objective selection, product economics, reliability-first engineering.

---

## Story 4 — Why dHash was added even though image URLs already existed

**Situation:** historical Excel already had main-image URLs.

**Problem:** URL identity is not visual identity; different CDNs/re-encodings can point to the same image.

**Action:** reuse Chrome/Canvas to decode pixels and compute 64-bit dHash; no OpenCV/TensorFlow/GPU.

**Result:** same image PNG→JPEG had Hamming distance 0; real v2.0 dedupe used dHash to recover changed-title duplicates.

**Signal:** independent evidence sources, pragmatic image processing, reuse of existing runtime.

---

## Story 5 — Deliberately not adding tokenizer / embedding

**Situation:** product names contain Chinese/English brands, order changes and marketing noise.

**Available solution:** tokenizer + custom dictionary + embeddings/vector DB.

**Decision:** reject until real errors justify it; use hard specs, compact aliases, normalization, char n-grams, edit distance, dHash and human Review.

**Why:** at 1.7k–5k history size, deterministic comparison is cheap and easier to debug; long-tail ambiguity can be surfaced rather than hidden behind semantic confidence.

**Signal:** complexity budgeting, knowing when *not* to use AI.

---

## Story 6 — Search high recall, dedupe high precision

**Situation:** operator knows approximate product descriptions, often multiple at once.

**Action:** one target per line → fuzzy ranked candidates → manual number selection → only selected detail/SKU fetch → five-layer dedupe.

**Why:** fuzzy top1 should not be allowed to define user intent.

**Signal:** human-in-the-loop architecture and error-profile separation.

---

## Story 7 — Category routing as a low-risk heuristic

**Situation:** multi-target fuzzy search across 2,000+ shop items caused many requests.

**Action:** extract product-type fragments and score against live shop categories; high confidence routes one category, medium top two, low full-shop fallback.

**Result:** five apparel targets routed to ~660–680-item `衣服鞋帽`; one scan reused for all targets.

**Signal:** systems optimization without increasing business-decision risk.

---

## Story 8 — Two failures and refusing to invent a hidden SKU limit

**Situation:** 450 SKU rows, 448 success, 2 failure; high-SKU products looked suspicious.

**Tempting fix:** split products above 30/50 SKU.

**Action:** inspect actual failure data.

**Result:** `规格已存在`; exactly two duplicate spec rows; canonicalization reproduced 448 rows without splitting SPUs.

**Signal:** root-cause analysis, resisting confirmation bias.

---

## Story 9 — “Latest 100” is a product goal, not a database slice

**Situation:** first 100 candidates could contain 80 old items.

**Insight:** user wants 100 products they do not have.

**Action:** goal-seeking loop until 100 `NEW_CONFIRMED` or horizon exhausted.

**Signal:** translate implementation metrics into business outcomes.

---

## Story 10 — From sibling-version history to SQLite lifecycle separation

**Situation:** releases searched nearby old version folders for the newest/largest JSON history.

**User challenge:** deleting v1.8/v2.0/v2.3 should not threaten merchant history.

**Action:** GitHub=code; Release=disposable; SQLite=persistent state. A first attempt to put `.git` inside the release was also rejected because deleting the release would delete Git history.

**Result:** version upgrades no longer migrate merchant identity data.

**Signal:** lifecycle modeling, architecture correction from first principles.

---

## Story 11 — Internal candidate pool vs operator mental model

**Situation:** goal=5 new products, UI displayed 200/148 candidates and looked as if hundreds would be fetched; actual deep checks stopped around 15.

**Decision:** show target / checked / found in primary UI; keep internal pool only for diagnostics.

**Signal:** UX as systems abstraction, not cosmetic formatting.

---

# Why relevant to AI Product / Agent / FDE

- evidence-backed decisions rather than confident guessing;
- explicit UNKNOWN / REVIEW state;
- multimodal-ish evidence fusion without unnecessary model complexity;
- human confirmation at intent and business-success boundaries;
- persistent state across runs;
- request-budget handling under unreliable external systems;
- observability and recovery;
- ability to inherit, understand and improve an existing customer workflow.

# What not to oversell

- Do not call char-level fuzzy search “LLM semantic search”.
- Do not claim perfect duplicate detection.
- Do not claim the inherited exporter was authored from scratch.
- Do not claim the target mall internal importer is known.
- Do not present every historical milestone as an original contemporaneous Git tag.
- Do emphasize the repeated pattern: **hypothesis → evidence → correction → safer design**.
