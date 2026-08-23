# Decision Log — High-Leverage Product & Engineering Decisions

每条记录保存：**问题 → 容易走的捷径 → 用户/证据提出的纠正 → 最终设计 → 为什么**。

## D00 — Establish evidence levels before modifying an inherited black box

对未知第三方工具，先按 `VERIFIED / INFERRED / UNKNOWN` 管理结论；静态恢复优先，不修改原包、不把猜测写成事实。

逆向路径：文件 → EXE → DAT → load chain → recovered runtime → Playwright/API → Excel → runtime probe。

---

## D01 — Reverse-engineer first; do not rewrite an unknown working tool

**Rejected:** 直接从零复制表面功能。

**Chosen:** 恢复 boot chain、business runtime、API path 和 Excel lineage，再决定哪些地方重构。

**Why:** 真实兼容细节已经存在于遗留系统中；先理解能减少重新制造边界 bug。

---

## D02 — Use read-only probes when static reasoning reaches an external-system boundary

静态恢复后仍不知道真实 API shape / 页面 category seed / 商城当前存量时，不继续猜，写只读探针捕获真实 JSON。

**Principle:** 最小只读实验 > 长篇推理。

---

## D03 — Treat a real successful mall import as the golden contract

商城内部不可见时，真实成功 workbook 比字段语义更可信。最终锁定 31 列、row2 data、分类空、`放置仓库`、中文文本保留。

---

## D04 — Stop automation at `放置仓库`

价格、库存、折扣、分类和内容仍需商家确认。自动化的正确边界不是“全部自动上线”，而是把高重复劳动自动化后保留最后业务审核。

---

## D05 — Reconcile historical Excel at product level before building dedupe

**Problem:** 5,000+ 导入记录 vs ~1,600 current products 看似巨大缺口。

**Rejected:** 直接推断几千商品丢失。

**Evidence:** 5,278 SKU/data rows grouping 后 ≈1,628 products；8 批进一步构成 1,721 historical entities。

**Impact:** 得到覆盖“工具出现以前”的历史基线，后续所有新抓取都可以对真正全历史去重。

---

## D06 — Optimize human effort before CPU effort

用户明确纠正早期“用索引减少比较”的方向：程序多算几十万/上百万次没关系，真正会随着商品数爆炸的是人工筛重。

因此不采用激进 candidate pruning 决定新品；完整候选和完整历史充分比较。

---

## D07 — Product identity is multi-evidence, not a title hash

最终五类证据：

1. exact itemId / skuId / product code；
2. hard specs；
3. normalized title；
4. character-level fuzzy / order tolerance；
5. image dHash。

输出三态：`DUPLICATE_CONFIRMED / NEW_CONFIRMED / REVIEW_REQUIRED`。

---

## D08 — Do not trust image URLs as image identity

同一图片可能经过 CDN 换域名、换分辨率、JPEG/WebP 重编码。URL 相同可作强证据，URL 不同不能推出图片不同。

因此复用 Chrome Canvas 计算 64-bit dHash 和 Hamming distance，并缓存结果。

**Evidence hierarchy:** hard-spec conflict vetoes image similarity。

---

## D09 — Deliberately reject tokenizer/embedding until real errors justify them

用户主动追问 tokenizer / 自定义词典是否会过度工程化。

**Rejected:** tokenizer、embedding、vector DB、heavy vision stack 作为默认方案。

**Chosen:** regex hard specs + compact aliases + char n-grams + char bag + edit distance + dHash + human review。

**Why:** catalog scale 可控，允许少量 review；复杂度应该由真实误判样本购买。

---

## D10 — Separate discovery, intent confirmation, deep fetch, and dedupe

```text
multi-target fuzzy search
→ ranked candidate lists
→ human selects IDs
→ only selected products get full detail/SKU
→ high-precision historical dedupe
```

搜索高召回，去重高精度；模糊 top1 不能替用户确认意图。

---

## D11 — Use type fragments for low-risk category routing, not brand hardcoding

没有建立 Tommy/CK/Hollister 品牌百科表，而是用“卫衣/短裤/人字拖/面霜”等高信息量商品类型词和当前真实分类评分。

high → top category；medium → top 1–2；low → full-shop fallback。

**Why:** routing 只缩小请求面，不负责最终商品身份，因此适合简单、可解释、有 fallback 的 heuristic。

---

## D12 — Real latest means `addTime`, not API list order

真实列表发现 API 顺序与 `addTime` 不严格一致。

因此 latest = lightweight `itemId/itemName/addTime` index → sort → expensive fetch only for chosen candidates。

---

## D13 — Control request budget instead of retrying harder

大量全店扫描和激进 retry 触发 socket hang up / HTTP2 错误。

**Decision:** category-latest、bounded windows、cooldowns、continuous-failure stop、category routing。

---

## D14 — Do not convert correlation into a mall rule

450 行中失败 2 行，同时两个 SPU SKU 很多，曾出现“设 30 SKU 阈值并拆商品”的诱人方案。

真实失败数据是 `规格已存在`；回放找到两个 duplicate final spec strings。

**Fix:** spec canonicalization；450 → 448；不拆 SPU。

---

## D15 — Define incremental output in business terms

用户要“100 个真正新品”，不是“检查 100 个候选”。

因此继续深抓和去重直到 `NEW_CONFIRMED == N` 或候选 horizon 耗尽。

---

## D16 — UI should show business progress, not scary internal candidate-pool numbers

目标只要 5 个新品时，200/148 这种内部候选数字让用户误以为会抓几百件；实际可能只深核 15 件。

**Decision:** 主 UI 只强调 target / deep checked / new found；内部池保留在诊断日志。

---

## D17 — “Sibling-version history inheritance” is a migration shim, not architecture

早期版本会在附近 v1.8/v2.0/v2.3/v2.4 中寻找最大/最新 JSON 历史。

用户明确指出：如果删掉旧版本，系统仍应正常。

**Decision:** fixed LOCALAPPDATA center → v2.5 SQLite single source of truth；永久取消 sibling scanning。

---

## D18 — Separate GitHub / Release / SQLite lifecycles

第一版甚至把 `.git` 放进可删除 v2.5 目录；用户发现删程序会连 Git 仓库一起删，进一步暴露生命周期混淆。

最终：

```text
GitHub = source/version history
Release ZIP = disposable executable snapshot
SQLite = persistent merchant business state
```

---

## D19 — Export success is not mall-import success

Excel QA PASS 只能证明 `PREPARED`，不能证明商城已接受。

v2.6 用显式 operator confirmation 转成 `MALL_IMPORTED`。

---

## D20 — Detect state regression and fail closed

SQLite 状态丢失/回滚不能静默从空历史继续。

v2.6 加：`quick_check`、foreign-key check、internal high-water、external health anchor、daily/checkpoint backups、run/export ledgers、explicit recovery。
