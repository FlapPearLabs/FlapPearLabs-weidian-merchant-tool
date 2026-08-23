# Portfolio & Interview Notes

## One-line project description

**Stateful Weidian-to-mall product migration tool with fuzzy discovery, five-layer entity deduplication, verified 31-column Excel export, persistent SQLite history, and recovery/health tooling.**

## Resume-ready version (Chinese)

> **微店商品迁移与去重工具｜个人项目 / AI 辅助工程实践**  
> 从既有 Windows 商家导出器出发完成证据驱动逆向与持续重构：还原微店公开商品/SKU/详情数据链路，使用真实商城成功/失败样本锁定 31 列导入契约；设计 `ID/SKU → 硬规格 → 标题归一化 → 字符模糊 → dHash` 五层商品实体去重与 `REVIEW_REQUIRED` 人工兜底；实现基于 `addTime` 的增量采集、多目标模糊找货、分类路由与请求预算控制。将早期版本目录 JSON 历史重构为版本外 SQLite 单一状态源，并加入运行/导出账本、高水位、健康检查、checkpoint 和恢复机制。真实 100 候选运行自动挡掉 79 个历史重复，仅 1 个需人工确认，20 个新品展开 122 SKU 且 Excel QA 必填问题为 0。

## Short English resume version

> **Weidian Merchant Migration & Entity Resolution Tool** — Reverse-engineered an inherited Windows exporter and evolved it into a stateful merchant workflow: verified an opaque mall Excel contract using real imports; built five-layer product identity resolution (IDs/SKUs, hard specs, normalized text, character fuzzy matching, image dHash) with explicit review fallback; added true-N-new incremental acquisition, fuzzy search/category routing, and request-budget controls; separated code/releases from persistent SQLite business state and added ledgers, high-water checks, checkpoints, and recovery tooling.

## Three strongest interview stories

### 1. Two failures — and refusing to invent a hidden SKU limit

**Situation.** 450 SKU rows imported, exactly two failed; the two products with unusually high SKU counts looked suspicious.

**Tempting answer.** Assume a hidden SKU-count limit and split products.

**Action.** Refused to encode an unverified threshold. Retrieved the mall failure data, found `规格已存在`, replayed final specification strings, and found exactly two duplicates.

**Result.** Canonicalization changed 450 → 448 rows while keeping 100 products, exactly matching the observed result.

**Interview signal.** Evidence hierarchy, debugging discipline, resistance to confirmation bias, preserving domain identity.

### 2. “Latest N” is not “N candidates”

**Situation.** A “latest 100” mode fetched 100 candidates, then historical dedupe left only 20 new products.

**Insight.** The business request was not “inspect 100 records”; it was “give me 100 products I do not already have.”

**Action.** Reframed the algorithm as a goal-seeking loop: scan cheap candidates in order, deep-fetch/dedupe one by one, stop when N new products are confirmed.

**Interview signal.** Ability to distinguish implementation units from user outcomes.

### 3. Version history vs. business history

**Situation.** Each release carried or searched for JSON history in nearby old-version folders. Deleting old folders could threaten dedupe state.

**Insight.** Code versioning and merchant state have different ownership and lifecycles.

**Action.** Introduced the three-way architecture: GitHub for source history, disposable Release ZIP for execution, external SQLite for merchant state. Added fail-closed initialization, backups, high-water checks and recovery.

**Interview signal.** State architecture, operational thinking, safe migration, product ownership beyond feature coding.

## Why this project is relevant to AI product / Agent / FDE roles

Although it is not an LLM application, it demonstrates patterns directly relevant to agentic systems:

- **evidence vs. guess** — uncertain observations are not promoted to facts;
- **multi-sensor decisioning** — ID, specs, text and images contribute different evidence;
- **three-state outcomes** — review/unknown is safer than forced binary confidence;
- **human-in-the-loop** — automate high-confidence work and surface the long tail;
- **state continuity** — future decisions depend on durable past outcomes;
- **external-system boundaries** — network APIs and mall imports are not fully controlled;
- **observability/recovery** — successful execution is not the same as successful business outcome.

## What not to oversell

- Do not call the fuzzy matcher “AI semantic search”; it is intentionally lightweight character-level retrieval.
- Do not claim perfect duplicate detection.
- Do not claim the inherited third-party exporter was authored from scratch.
- Do not claim remote live Weidian E2E when the test environment was network-blocked.
- Do emphasize how real evidence repeatedly corrected earlier hypotheses.
