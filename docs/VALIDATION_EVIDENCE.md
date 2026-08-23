# Validation Evidence

这份文档只记录有证据支持的结论，并区分真实运行、离线回归/压力测试和环境限制。

## 1. Legacy-package static recovery

纯静态阶段确认：

- 8KB `.NET Framework 4.0` C# protected launcher；
- `engine.dat / launcher.dat` 使用受保护容器，恢复出 PowerShell 与 ESM JavaScript runtime；
- engine 恢复后约 29KB minified JS，格式化到约 1,390 行后可读；
- Node.js + Playwright + ExcelJS；
- 微店公开 H5 list/category/SKU/detail 数据链；
- 31-column mall workbook model。

这些结果不等于恢复原作者 Git source、comments 或真实变量名；仓库只声称恢复了运行时逻辑和语义级结构。

## 2. Runtime probe evidence

Windows 只读 capture 拿到真实 list/SKU/detail response：

- 商品列表链可用；
- SKU 详情链可用；
- 商品详情和图片链可用；
- 列表价格与 SKU 最低价 /100 对齐；
- 列表库存与 SKU 库存求和对齐；
- 某些商品没有结构化 `attrList`，原 runtime 依赖 `skuInfo.title` fallback 形成 `[规格:...]`；
- 分类读取 0 件的根因不是分类 API 报错，而是首页没有触发原作者等待的 category seed 请求。

这是从“静态推断 API contract”升级到“真实 2026 runtime contract”的关键证据。

## 3. Mall import contract — real black-box validation

真实成功导入 workbook 证明：

- 31 headers in row 1；
- product data starts row 2；
- category blank；
- product status `放置仓库`；
- Chinese source text retained；
- template/helper/example rows不能混入真正上传表。

单商品 golden-template 实验成功进入商城后处理流程。

## 4. Historical Excel reconciliation: rows are not products

后台历史一度显示 5,000+，当前商品约 1,600。如果直接相减会得到错误结论。

实际解析：

- 7 份 distinct historical import files：**5,278 data/SKU rows ≈ 1,628 product groups**；
- 8 batches for baseline reconstruction：**1,729 raw groups → 1,721 title+carousel historical entities**。

因此巨大差异的核心是统计口径：SKU/data rows ≠ product/SPU count。

这批 Excel 也成为商品级去重的历史事实来源。

## 5. Five-layer dedupe — real v2.0 run

| Metric | Result |
|---|---:|
| Candidates | 100 |
| Automatic historical duplicates | 79 |
| Review required | 1 |
| Confirmed new | 20 |
| New-product SKU rows | 122 |
| 31-column QA | PASS |
| Required-field problems | 0 |
| Baseline | 1,721 → 1,741 |

79 automatic duplicates evidence mix：

- 52 exact item/SKU/code；
- 13 normalized-title exact without hard conflict；
- 12 normalized title + same main-image URL；
- 2 changed-title cases recovered by dHash evidence。

人工 Review 只有 1 件，说明保守三态在这批真实数据上把人工量压到很低。

## 6. Image URL vs dHash evidence

URL normalization 是一层证据，但不同 CDN 可以给同一画面不同地址。

Implementation regression：

```text
same synthetic image
→ PNG
→ re-encoded JPEG
→ Chrome Canvas decode
→ 64-bit dHash
→ Hamming Distance = 0
```

这验证 dHash 比文件字节和 URL 更接近“画面身份”。

Hard-spec conflict remains veto：30ml vs 60ml 即使图相同，也不能自动判重复。

v2.5 首次 SQLite 迁移观察到 **1,740 dHash** 被持久化到统一数据中心。

## 7. Mall failure root-cause regression

Observed mall result：

```text
450 rows submitted
448 success
2 failed
```

两个高-SKU SPU 曾让“SKU 数量上限”成为候选假设，但没有直接编码。

真实 failure CSV：`规格已存在`。

Replay：

```text
450 input SKU rows
→ 2 duplicated final mall specification strings
→ 448 canonical rows
```

精确解释实际 448/2，不需要人为拆 SPU。

## 8. Full-history stress test

```text
500 synthetic candidates
× 1,722 historical entities
≈ 861,000 pair comparisons
```

Result：

- 500/500 `NEW_CONFIRMED`；
- 0 false duplicates；
- 0 unnecessary reviews；
- ~25.9s in test Linux environment。

这支持“宁可 CPU 多比，不用激进索引牺牲可靠性”的业务取舍。

## 9. Fuzzy search + category routing — real v2.3 run

Five apparel-related target descriptions：

- all high-confidence routed to real `衣服鞋帽`；
- scan surface roughly 660～680 category items vs 2,000+ whole shop；
- multiple targets shared one category scan；
- user selected 5 candidates；
- five-layer dedupe blocked 1 historical duplicate；
- output **4 new products / 40 SKU rows**；
- history **1,741 → 1,745**。

这证明 routing layer 真实减少请求，并未绕过 human selection / final dedupe。

## 10. True-N-new behavior

Synthetic regression：

```text
candidate pool 300
80% duplicates
new target 20
```

在第 100 个候选处达到：80 duplicates + 20 new，立即停止；剩余 200 不再深抓。

这验证“目标新品数”与“候选池大小”解耦。

## 11. SQLite migration and state continuity

First v2.5 unified-data-center initialization：

- historical products: **1,745**；
- dHash: **1,740**；
- same-shop history: **104**；
- database outside version folder；
- daily backup created。

之后再次实际运行新增 5 件，重启后：

- products: **1,750**；
- dHash: **1,747**；
- same-shop history: **109**。

说明状态已跨程序进程持续，不再依赖旧 `历史中心` 或 sibling version folders。

## 12. v2.6 state correctness tests

v2.6 adds / tests：

- SQLite `quick_check` / foreign key check；
- product high-water rollback detection；
- external `health_anchor.json` rollback detection；
- `runs` ledger；
- `export_batches`；
- `PREPARED → MALL_IMPORTED` manual confirmation；
- checkpoint backup；
- recovery with emergency pre-restore backup。

## 13. Known limits / deliberately scoped claims

- 某些 ChatGPT/Linux 环境无法稳定访问 `thor.weidian.com`，不把失败的远程测试声称为 live E2E。
- 商城内部 importer 源码未知，契约来自真实黑盒成功/失败行为。
- category routing 只是 request-reduction heuristic；低置信必须 fallback。
- matcher 不声称消灭全部 ambiguity；`REVIEW_REQUIRED` 是设计的一部分。
- fuzzy matcher 不包装成“AI semantic search”；它是刻意保持轻量的字符级 retrieval。
