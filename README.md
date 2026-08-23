# FlapPearLabs Weidian Merchant Tool

> **从一个加密 Windows 商家导出器出发，通过证据驱动逆向、黑盒验证、历史重建、商品实体去重和状态架构重构，演进为可持续使用的商品迁移系统。**

这个项目不是“写了一个微店爬虫”。它解决的是一个逐步暴露复杂度的真实商家问题：

> **如何从公开微店里找到真正想要、真正最新、真正没有导入过的商品，可靠地生成商城可接受的 Excel，并保证几千个商品的历史身份不会随着版本升级、网络失败或程序目录删除而丢失。**

项目起点是一份第三方 `微店商品导出器-v1.2.0-客户版`。我们没有直接重写，而是先把黑箱拆开，再一步步用真实证据修正自己的假设。最终系统从一次性导出器演化成了一个有 **商品发现、实体去重、持久状态、运行账本和恢复能力** 的本地商家工具。

---

## 1. Critical Path：这个项目真正是怎么长出来的

```text
第三方黑箱 Windows 工具
        ↓
静态逆向：EXE / DAT / 启动链 / Node / Playwright / ExcelJS
        ↓
函数级恢复 → 字段级数据流 → 微店 JSON 到 31 列 Excel 的 lineage
        ↓
运行时探针：捕获真实商品列表 / SKU / 详情 / 分类行为
        ↓
黑盒商城验证：用真实成功/失败 Excel 锁定导入契约
        ↓
分类 / 关键词 / 指定商品 / addTime 最新商品
        ↓
历史 Excel 全量对账：5,278 SKU 行并不是 5,278 个商品
        ↓
重建约 1.6k～1.7k 历史商品实体基线
        ↓
五层商品实体去重 + dHash 图片证据 + 人工 Review
        ↓
“最新 N 候选”重构为“找到 N 个真正新品”
        ↓
多目标模糊搜索 → 候选展示 → 人工选号 → 只抓所选商品 → 再去重
        ↓
商品类型词段 → 当前店铺真实分类路由 → 低置信才全店兜底
        ↓
历史从版本目录 JSON → 固定历史中心 → SQLite 单一状态源
        ↓
GitHub / Release / SQLite 生命周期分离
        ↓
运行账本 / 导出批次 / 高水位 / 健康锚点 / checkpoint / 恢复
```

完整细节见：

- [Critical Path](docs/CRITICAL_PATH.md)
- [Project Evolution](docs/PROJECT_EVOLUTION.md)
- [Decision Trace from Dialogue](docs/DECISION_TRACE_FROM_DIALOGUE.md)

---

## 2. 最重要的不是功能，而是这些决策

### 2.1 先逆向明白，再决定重写什么

原包并不是普通脚本。静态分析逐层确认：

```text
8KB .NET Framework C# launcher
        ↓
解密 launcher.dat / engine.dat
        ↓
PowerShell + minified ESM JavaScript
        ↓
Node.js + Playwright + ExcelJS
        ↓
微店公开 H5 API
        ↓
31 列商城 Excel
```

我们先做文件普查、EXE 架构、DAT 容器、加载链、核心代码恢复，再深入到函数级和字段级数据流，而不是一上来重写。这样保住了原系统已经解决的真实兼容细节，同时知道哪些能力是继承的、哪些是后续新增的。

### 2.2 不相信“看起来合理”，相信真实商城结果

商城内部实现不可见，所以不能凭列名猜规则。我们用真实成功导入样本锁定：

- 31 列；
- 第 1 行表头，第 2 行开始真实商品；
- H「商品分类」留空；
- AB「商品状态」=`放置仓库`；
- 中文标题/规格原文保留；
- 上传表不混入模板说明和示例行。

同样地，450 行导入中 2 行失败，一开始很像“SKU 数量过大”，但我们没有发明 30/50 SKU 上限。拿到失败数据后确认根因是 **`规格已存在`**，最终定位到两条重复规格，450 → 448，和商城实际 448 成功 / 2 失败完全一致。

### 2.3 先把历史账算对：SKU 行数 ≠ 商品数

历史后台曾显示 5,000+ 导入记录，而当前商城只有约 1,600 商品。我们没有直接推断“丢了 3,000 多件”。

把全部历史导入 Excel 拉出来后发现：

- 7 份历史表：**5,278 个数据/SKU 行**；
- 按商品级 grouping 后约 **1,628 个商品组**；
- 8 批进一步归并：**1,729 raw groups → 1,721 历史商品实体**。

这一步非常关键：一旦重建出完整历史商品基线，去重就不再依赖“从今天开始记”的临时账本，而可以覆盖客户过去已经搬过的商品。

人工去重随着商品量增长会迅速变得不可接受；程序即使多做几十万到上百万次比较，仍然比让人每次在 1,700、5,000、10,000 件商品里重新找重复便宜得多。因此我们明确选择：**优先减少人工复杂度，不为了省 CPU 牺牲去重可靠性。**

### 2.4 图片 URL 只是证据，不是图片身份

历史 Excel 本来就包含 CDN 图片 URL。第一层可以做 URL 归一化和同 URL 命中，但我们不信任 URL 本身：

```text
微店 A: cdn-a/.../abc.jpg
微店 B: cdn-b/.../xyz.webp
```

地址完全不同，画面仍可能是同一张商品图。

因此我们复用已有 Playwright / Chrome：

```text
图片 URL
→ Chrome 下载并解码 JPEG / PNG / WebP
→ Canvas 缩成 9×8 灰度图
→ Node 计算 64-bit dHash
→ Hamming Distance
→ 缓存结果
```

同一画面 PNG → JPEG 的回归测试得到 **Hamming Distance = 0**。dHash 由此成为与标题独立的第五层证据；但图片永远不能覆盖硬规格冲突，例如 30ml 与 60ml 即使共用同一张宣传图，也必须判不同商品。

v2.5 起 dHash 不再散落在版本目录 JSON，而统一进入 SQLite `image_hashes` 表。

### 2.5 明知道可以上 tokenizer / embedding，但主动不做

我们认真讨论过中文 tokenizer、自定义词典、embedding、向量库甚至视觉模型。

最终决定没有上这些，不是因为不会，而是因为当前业务规模和错误成本不支持这种复杂度：

- 规格可以用确定性正则抽取；
- 品牌只需要小规模别名归一化；
- 中文词序交换可以用字符 2/3-gram、字符 bag、编辑距离处理；
- 边界案例允许 `REVIEW_REQUIRED` 给人看一眼；
- `100 × 1700 = 17 万`、`200 × 5000 = 100 万` 对本地程序并不昂贵。

因此最终方案是：

```text
精确 ID/SKU
+ 硬规格
+ 标题归一化
+ 字符级模糊
+ 图片 dHash
+ 人工 Review
```

而不是为了“看起来更 AI”引入 tokenizer / embedding / 大模型视觉栈。

### 2.6 搜索、选号、抓取、去重是四个不同职责

“我想找 Hollister 女士浅灰色卫衣”不是一个精确数据库查询。

最终交互被拆成：

```text
多个自然语言目标
→ 高召回模糊搜索
→ 每个目标展示相似候选列表
→ 人输入编号做最终意图确认
→ 只对选中的商品抓详情/SKU
→ 五层历史去重
→ 真正新品进入商城 Excel
```

搜索的目标是 **尽量别漏**；去重的目标是 **尽量别错杀**。把两件事分开，避免让模糊搜索自动替用户决定“你就是想要这个商品”。

### 2.7 先从词段判断“大概是什么”，路由到分类，再搜索

v2.2 的模糊找货能用，但全店 2,000+ 商品扫描成本高。我们没有为品牌建立硬编码表，而是做一个很薄的商品类型路由层：

```text
卫衣 / 外套 / 短裤 / 牛仔 / 女装
→ 衣服鞋帽

人字拖 / 凉鞋 / 运动鞋
→ 鞋类

面霜 / 精华 / 护肤
→ 护肤/化妆品
```

这些词段再与**当前店铺真实分类名称**评分：

```text
高置信 → 只搜最佳分类
中置信 → 搜前 1～2 个分类
低置信 → 不乱猜，回退全店
```

真实回放中 5 个服饰目标全部高置信路由到 `衣服鞋帽`，请求面从全店 **2,000+** 降到分类约 **660～680**，而且 5 个目标共享一次分类扫描。

关键设计是：路由只负责 **缩小搜索空间**，不负责决定商品身份，所以可以允许它“差不多聪明”；最终仍有人选号和五层去重兜底。

### 2.8 “兄弟姐妹继承历史”能工作，但不应该成为长期架构

v2.3/v2.4 为兼容升级，会搜索附近旧版本目录，比较哪个历史更大/更新，再继承。这能救迁移，却很不优雅：删除 v1.8 / v2.0 / v2.3 等旧程序目录不应该威胁业务历史。

因此 v2.5 做了架构切换：

```text
GitHub       = 代码和版本历史
Release ZIP  = 可删除的运行快照
SQLite       = 永久业务状态
```

商品实体、同店历史、dHash 和事件全部进入版本目录外的：

```text
%LOCALAPPDATA%\WeidianMerchantTool\data\state.sqlite3
```

从此 v2.6 / v2.7 / v2.8 只打开同一数据库；旧程序目录可以删，历史不迁、不找“兄弟姐妹”。

### 2.9 “程序运行成功”不等于“业务成功”

生成 Excel 只证明批次准备完成，不证明商城已经实际导入。因此 v2.6 把：

```text
PREPARED
→ 用户确认商城实际导入
→ MALL_IMPORTED
```

分成两个状态，同时增加运行账本、导出批次、高水位、SQLite `quick_check`、外部健康锚点、daily/checkpoint backup 和显式恢复。

---

## 3. Product / Engineering Evolution

| Version | 主题 | 关键变化 |
|---|---|---|
| **Pre-v1.0** | 黑箱逆向与证据链 | EXE/DAT/启动链、JS/PowerShell 恢复、函数级/字段级 lineage、运行时 API 探针 |
| **v1.0** | 分类抓取 | 读取真实店铺分类并按 `cateId` 抓指定分类 |
| **v1.1** | 可控商品选择 | 分类 / 全店关键词 / 分类+关键词 / 指定 ID/链接 + 全局历史 |
| **v1.2** | 搜索语义 | 多关键词 AND → OR；别名和失败窗口稳定性 |
| **v1.3** | 干净上传产物 | 上传 Excel 与辅助文件分离；清除模板说明/示例污染 |
| **v1.4** | 商城契约验证 | 用真实成功样本锁定 31 列、空分类、`放置仓库` |
| **v1.5** | 最新商品 | 独立 latest workflow，不要求先全量搬店 |
| **v1.6** | 真实上架时间 | 用 `addTime`，轻量时间索引与详情/SKU抓取分离 |
| **v1.7** | 分类最新 / 稳定扫描 | 分类+latest、断点、重试；暴露激进扫描的网络风险 |
| **v1.8** | 请求预算 | 低频、冷却、有限窗口，分类最新成为日常路径 |
| **v1.9** | 商品实体去重 | 1,721 历史实体 + 五层证据 + 三态输出 + dHash |
| **v2.0** | 动态历史 / 失败根因 | `规格已存在` 修复；QA 通过才推进历史 |
| **v2.1** | 真正增量 | 从“前 N 个候选”升级为“找到 N 个真正新品” |
| **v2.2** | 多目标模糊找货 | 多描述、模糊排序、分页展示、人工选号、只抓所选商品 |
| **v2.3** | 分类路由 | 商品类型词段 → 真实分类；低置信才全店；固定历史中心 |
| **v2.4** | 终端 UX | 单屏原位选号，不让候选列表无限刷屏 |
| **v2.5** | 状态架构 | GitHub / Release / SQLite 分离；取消兄弟版本继承 |
| **v2.5.1** | 增量 UX 修正 | 目标 5 件时不再把 200/148 内部候选当成业务数量刷屏；主界面改看目标/核验/新品进度；增加 ZIP 临时目录启动保护 |
| **v2.6** | 运行正确性 | runs/export_batches、商城确认、高水位、健康锚点、checkpoint、恢复 |

每个正式版本均有 compact archive packet：[`archive/version-packets/`](archive/version-packets/)。

---

## 4. Real Evidence

| 证据 | 结果 |
|---|---:|
| 第三方原包静态恢复 | .NET launcher + 加密 DAT → 可读 PowerShell / ESM JS，核心业务链被还原 |
| 运行时探针 | 商品列表 / SKU / 详情链真实可用；确认价格与库存字段血缘 |
| 7 份历史导入 Excel | **5,278 SKU/data rows → ≈1,628 product groups** |
| 8 批历史归并 | **1,729 raw groups → 1,721 historical entities** |
| v2.0 100 候选真实运行 | **79 自动重复 / 1 Review / 20 新品** |
| 20 个新品展开 | **122 SKU rows；31 列 QA PASS；必填问题 0** |
| 450 行商城失败回放 | **448 成功 / 2 失败 → 恰好 2 个重复最终规格** |
| dHash 回归 | 同一画面 PNG vs JPEG：**Hamming Distance = 0** |
| 全历史压力测试 | **500 × 1,722 ≈ 861k** pair comparisons；500/500 新品无误判 |
| v2.3 真实分类路由 | 5 个目标 → `衣服鞋帽`；选 5，挡 1 历史，导出 **4 新品 / 40 SKU** |
| v2.5 SQLite 首次迁移 | **1,745 商品 / 1,740 dHash / 104 同店历史** |
| v2.5 后续运行 | 历史继续 **1,745 → 1,750**，证明状态跨进程持续存在 |

详见 [Validation Evidence](docs/VALIDATION_EVIDENCE.md)。

---

## 5. Current Architecture

```text
GitHub repository
  ├─ source / tests / docs
  └─ compact historical version packets

Release ZIP
  └─ disposable runtime; no user state; no .git

%LOCALAPPDATA%\WeidianMerchantTool\
  ├─ data\state.sqlite3
  ├─ data\health_anchor.json
  ├─ backups\
  ├─ cache\
  └─ logs\

%USERPROFILE%\Documents\微店商品导出器\每日导出\
  └─ mall-import Excel deliverables
```

SQLite Schema 2 的核心表：

- `products` — 历史商品实体；
- `image_hashes` — URL → dHash / failure cache；
- `global_history` — 同店 itemId 历史；
- `events` — 状态变化事件；
- `runs` — 每次运行目标、深抓数、重复、新品、历史前后值；
- `export_batches` — Excel 准备完成和商城实际确认状态。

---

## 6. Why this is useful as a portfolio project

它展示的不是单一技术，而是：

- **Inherited-system reverse engineering**：从黑箱恢复业务链和数据 lineage；
- **Evidence-driven product engineering**：真实成功/失败样本优先于猜测；
- **Data reconciliation**：从 SKU 行数纠正到商品实体口径，并重建全历史；
- **Entity resolution**：结构化字段、字符相似、图片感知共同决策；
- **Human-in-the-loop design**：搜索高召回、人工确认意图、去重高精度；
- **Pragmatic AI trade-offs**：知道 tokenizer / embedding 能做，但根据业务规模主动不做；
- **Reliability under external constraints**：request budget、冷却、探针、checkpoint；
- **State architecture**：区分 source history、release lifecycle 和 merchant state；
- **Operational correctness**：运行成功、Excel生成、商城导入是三个不同层次的事实。

### 求职入口

- [Portfolio & Interview Notes](docs/PORTFOLIO_NOTES.md)
- [Decision Trace from Dialogue](docs/DECISION_TRACE_FROM_DIALOGUE.md)
- [Origin & Contribution Boundary](docs/ORIGIN_AND_PROVENANCE.md)

---

## 7. Repository hygiene / claim boundary

这是公开作品仓库，因此明确不提交：

- `state.sqlite3`；
- 真实商品历史 / dHash 用户缓存 / 同店历史；
- 商城业务 Excel；
- 用户特定店铺配置；
- 第三方原始客户端二进制。

`archive/version-packets/` 保存的是 compact project-history packets：版本功能、原完整 artifact 身份/SHA256 和源文件索引，而不是重复提交 17 份约 47MB 的 Node runtime。

项目贡献边界详见 [ORIGIN_AND_PROVENANCE.md](docs/ORIGIN_AND_PROVENANCE.md)。

---

## Current version

**v2.6.0**

当前问题已经从“能不能抓商品”升级为：

> **如何让一个真实商家在不断新增商品、不断升级程序、外部 API 不稳定、商城导入不可见的条件下，仍然拥有可解释、可持续、不会静默倒退的商品身份和迁移状态。**
