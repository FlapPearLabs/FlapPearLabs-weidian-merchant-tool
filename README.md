# FlapPearLabs Weidian Merchant Tool

> **Evidence-driven product migration, fuzzy discovery, five-layer entity deduplication, and persistent merchant state.**

这是一个从真实商家商品迁移需求出发、经过逆向分析、黑盒验证和连续版本演化形成的 Windows 商家工具。它把公开微店商品转换为商城可批量导入的 31 列 Excel，并进一步解决“找什么商品”“是不是已经导入过”“历史如何跨版本永久保存”“运行失败后如何审计与恢复”等问题。

## Why this project matters

起点不是从零 Demo，而是一份已经在实际业务中使用过的第三方 **微店商品导出器 v1.2.0 客户版**。项目先做证据驱动逆向，确认启动链、微店数据来源和 Excel 转换逻辑，再用真实商城导入成功/失败样本逐步重构。

```text
legacy black-box exporter
        ↓
verified mall-import pipeline
        ↓
controlled product discovery
        ↓
entity-level deduplication
        ↓
true incremental acquisition
        ↓
fuzzy search + human selection
        ↓
category routing / request-budget control
        ↓
persistent SQLite business state
        ↓
health ledger / checkpoints / recovery
```

## Core capabilities

- 分类、标题关键词、分类+关键词、指定商品 ID/链接、最新上架等多种采集模式。
- 基于 `addTime` 的真实上架时间排序；轻量索引与昂贵详情/SKU/图片抓取分离。
- 多目标自然语言模糊找货：文本归一化 + 2/3-gram + 字符相似 + 编辑距离，支持分页选号。
- 智能分类路由：先缩小到真实店铺分类，低置信度才全店兜底。
- **五层商品实体去重**：精确 ID/SKU → 硬规格冲突 → 标题标准化 → 字符级模糊 → 主图 dHash。
- 三态裁决：`DUPLICATE_CONFIRMED / NEW_CONFIRMED / REVIEW_REQUIRED`。
- 商城真实 `规格已存在` 失败回放与导出前重复规格修复。
- 真正增量：目标是“凑够 N 个真正新品”，不是“取 N 个候选后剩多少算多少”。
- v2.5+：GitHub 管代码、Release 无状态、本机 SQLite 管业务历史。
- v2.6：运行账本、导出批次、商城确认、高水位、健康锚点、checkpoint 和恢复。

## Evidence, not claims

| Evidence | Result |
|---|---:|
| 7 份不同历史导入表 | 5,278 SKU 行 ≈ 1,628 个实际商品 |
| 8 批历史归并 | 1,729 商品组 → 1,721 历史实体 |
| v2.0 真实 100 候选运行 | 79 自动重复 / 1 Review / 20 新品 |
| 上述 20 个新品 | 122 SKU，31 列检查通过，必填问题 0 |
| 450 行商城失败回放 | 根因是 2 个重复规格，不是“SKU 太多” |
| 五层压力测试 | 500 × 1,722 ≈ 861,000 对比较；500/500 新品无误判 |
| v2.3 实际模糊找货 | 选 5，挡 1 历史，导出 4 新品 / 40 SKU |
| v2.5 首次 SQLite 迁移 | 1,745 历史商品 / 1,740 dHash / 104 同店历史 |

## Architecture

```text
GitHub repository
  └─ source / tests / docs / historical version packets

Release ZIP
  └─ disposable runtime; no user state; no .git

%LOCALAPPDATA%\WeidianMerchantTool\
  ├─ data\state.sqlite3       # persistent business truth
  ├─ backups\                # daily + checkpoint backups
  ├─ cache\                  # disposable scan checkpoints
  └─ logs\                   # runtime logs

%USERPROFILE%\Documents\微店商品导出器\每日导出\
  └─ mall-import Excel deliverables
```

See [ARCHITECTURE.md](ARCHITECTURE.md).

## Project record / portfolio path

- [Version evolution](docs/PROJECT_EVOLUTION.md) — v1.0 → v2.6 功能与架构演化。
- [Decision log](docs/DECISION_LOG.md) — 真正改变项目方向的关键决策。
- [Validation evidence](docs/VALIDATION_EVIDENCE.md) — 真实运行、失败回放、回归与压力测试。
- [Origin & provenance](docs/ORIGIN_AND_PROVENANCE.md) — 第三方起点与本项目贡献边界。
- [Portfolio / interview notes](docs/PORTFOLIO_NOTES.md) — 简历表述与面试故事。
- [Historical version packets](archive/README.md) — v1.0～v2.6 每个正式版本的压缩记录包。

## Repository hygiene

- 不提交 `state.sqlite3`、真实商品历史、dHash 用户缓存、同店历史或商城 Excel 输出。
- 不重新分发第三方原始客户端。
- 历史版本用小型 packet 保存版本说明、完整本地 artifact 的 SHA256 与源文件索引；不把 17 份近 47MB 的重复 Node/runtime 直接塞进 Git。
- 用户特定店铺配置、机器路径和运行态数据不进入版本记录。

## Current version

`v2.6.0`

当前里程碑已经不是“能不能抓和导出”，而是 **state correctness**：能否反复运行、升级版本、知道发生了什么、区分“准备好 Excel”和“商城已确认导入”，并在历史状态异常时阻止静默倒退和提供明确恢复路径。
