# Project Evolution — Legacy Baseline → v2.6

> 这不是简单 changelog，而是项目的产品/工程演进史。早期版本并非当时就存在完整 Git tag，因此这里保存的是经聊天记录、版本 artifact 和运行证据重建出的关键路径。

## Phase 0 — Before v1.0: make the inherited black box understandable

### 0A. Static recovery

项目起点是第三方 `微店商品导出器-v1.2.0-客户版`。第一步没有运行或修改，而是：

```text
file inventory
→ hashes
→ EXE technology
→ DAT container
→ loading chain
→ runtime recovery
```

决定性结果：

- small .NET Framework C# launcher；
- `engine.dat / launcher.dat` 解密恢复；
- launcher → PowerShell；engine → minified ESM JavaScript；
- Node.js + Playwright + ExcelJS；
- Weidian public H5 list/category/SKU/detail data path；
- 31-column mall workbook generation。

### 0B. Function-level and field-level recovery

不止“知道用什么库”，还继续建立：

- function map；
- main flow / launcher flow；
- Weidian API contract；
- internal data model；
- field lineage：JSON 字段 → 中间结构 → Excel column。

恢复语义名称不冒充原作者源码名称；原 Git history / comments / TypeScript source 仍标记为未恢复。

### 0C. Runtime contract probes

做只读 capture：真实 item list / SKU / detail / category behavior；验证价格、库存和 fallback SKU title 结构；定位分类 seed 行为变化。

### 0D. Mall black-box contract

用真实成功导入样本和失败样本建立目标商城契约，而不是根据字段名猜。

---

## Version matrix

| Version | Theme | Main change | Key decision / learning |
|---|---|---|---|
| **v1.0** | Controlled category export | 读取真实店铺分类、选择分类、按 `cateId` 抓取 | 先把原黑箱变成商家可控制的采集工具 |
| **v1.1** | Product selection | 分类 / 全店关键词 / 分类+关键词 / 指定 ID/链接；全局 itemId 历史 | “我要搬什么”成为一级能力 |
| **v1.2** | Search semantics | 多关键词 AND → OR；别名；顶层失败不闪退 | 关键词按运营语义而不是按实现方便解释 |
| **v1.3** | Clean upload artifact | 上传表与辅助 Excel 分开；去模板说明/示例污染 | 让上传 artifact 成为真正业务产物 |
| **v1.4** | Verified mall contract | 31列、row2 data、分类空、`放置仓库`、中文原文 | observed success > guessed semantics |
| **v1.5** | Latest-product workflow | 新增 latest，不要求先全量建立店铺基线 | 真实工作不是“一次搬完整店” |
| **v1.6** | Real add-time ordering | `addTime`；cheap list index vs expensive detail fetch | 不再把 API 顺序冒充真实上架时间 |
| **v1.7** | Category+latest / retry | 分类最新、checkpoint、多通道重试 | 暴露“retry harder”会恶化网络问题 |
| **v1.8** | Request budget | bounded window、cooldown、分类最新日常路径 | 外部 API 可靠性进入产品设计 |
| **v1.9** | Historical entity resolution | 从历史 Excel 重建 1,721 实体；五层证据；三态输出 | 人工去重才是会随 catalog 爆炸的成本 |
| **v2.0** | Evidence-driven failure fix | 修复 `规格已存在`；QA 后动态推进历史 | 拒绝“SKU 太多”相关性假设 |
| **v2.1** | True incremental | 继续向后直到凑够 N 个真正新品 | 业务目标不是 N 个候选 |
| **v2.2** | Multi-target fuzzy discovery | 多自然语言目标、模糊排序、列表、人工选号、只抓所选 | 搜索和去重拆职责 |
| **v2.3** | Category routing | 商品类型词段 → 当前真实分类；低置信全店兜底 | 路由只缩空间，不冒充语义真相 |
| **v2.4** | Terminal UX | 单屏原位候选选择 | 内部状态不应该无限刷给用户 |
| **v2.5** | State lifecycle | GitHub / Release / SQLite 分离；dHash 进入 DB | 废弃“兄弟版本继承历史”长期机制 |
| **v2.6** | Operational correctness | runs/export_batches、高水位、health anchor、checkpoint、恢复 | 状态必须可证明连续、可审计、可恢复 |

---

## Feature evolution by capability

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
→ historical Excel baseline
→ exact SKU/code
→ hard specs
→ normalized title
→ char fuzzy
→ main-image URL
→ dHash
→ three-state verdict
```

### State

```text
per-run / per-category JSON
→ global JSON history
→ reconstructed historical baseline
→ dynamic rolling baseline
→ fixed LOCALAPPDATA history center
→ SQLite single source of truth
→ health / ledgers / checkpoints / recovery
```

### Reliability

```text
simple retry
→ checkpoint
→ HTTP fallback / lower frequency
→ cooldown / bounded window
→ category routing
→ fail-closed state checks
```

---

## Important corrections along the way

1. **API order ≠ latest** → use `addTime`.
2. **5,000 import rows ≠ 5,000 products** → SKU/data rows grouped into ~1.6k products.
3. **URL different ≠ image different** → dHash.
4. **fuzzy match ≠ user intent** → display candidates and ask user to select.
5. **fuzzy search ≠ dedupe** → high recall first, high precision later.
6. **high SKU count ≠ failure cause** → actual error was duplicate final spec.
7. **latest N candidates ≠ N new products** → goal-seeking incremental loop.
8. **retrying harder ≠ more reliable** → request budget and routing.
9. **history inheritance ≠ version architecture** → external SQLite.
10. **Excel generated ≠ mall accepted** → PREPARED vs MALL_IMPORTED.
11. **candidate pool ≠ items actually fetched** → UI now focuses on target/deep-checked/new count.

---

## Deliberately not built

- tokenizer-first pipeline；
- vector DB / embedding merely for this catalog scale；
- heavy vision model/GPU；
- brand→category hardcoded encyclopedia；
- fuzzy top1 auto-selection；
- automatic live-to-customer listing；
- silent state reset on missing history。

这些不是“没做完”，而是明确的复杂度和风险边界。
