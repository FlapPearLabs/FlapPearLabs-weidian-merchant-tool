# FlapPearLabs Weidian Merchant Tool

**中文** | [English](README.en.md)

> **从一个加密 Windows 商家导出器出发，通过证据驱动逆向、黑盒验证、历史重建、商品实体去重和状态架构重构，演进为可持续使用的商品迁移系统。**

这个项目不是“写了一个微店爬虫”。它解决的是一个逐步暴露复杂度的真实商家问题：

> **如何从公开微店里找到真正想要、真正最新、真正没有导入过的商品，可靠地生成商城可接受的 Excel，并保证几千个商品的历史身份不会随着版本升级、网络失败或程序目录删除而丢失。**

项目起点是一份第三方 `微店商品导出器-v1.2.0-客户版`。我们没有直接重写，而是先把黑箱拆开，再一步步用真实证据修正自己的假设。最终系统从一次性导出器演化成了一个有 **商品发现、实体去重、持久状态、运行账本和恢复能力** 的本地商家工具。

---

## 1. 关键路径：这个项目真正是怎么长出来的

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
五层商品实体去重 + dHash 图片证据 + 人工复核
        ↓
“最新 N 个候选”重构为“找到 N 个真正新品”
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

完整记录：

- [关键路径（中文）](docs/CRITICAL_PATH.md) / [Critical Path (English)](docs/CRITICAL_PATH.en.md)
- [项目演化（中文）](docs/PROJECT_EVOLUTION.md) / [Project Evolution (English)](docs/PROJECT_EVOLUTION.en.md)
- [对话决策轨迹（中文）](docs/DECISION_TRACE_FROM_DIALOGUE.md) / [Decision Trace (English)](docs/DECISION_TRACE_FROM_DIALOGUE.en.md)

---

## 2. 真正值得展示的是这些决策

### 2.1 先把黑箱逆向明白，再决定重写什么

原包不是普通脚本。静态分析逐层确认：

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

先做文件普查、EXE 架构、DAT 容器、加载链、核心代码恢复，再继续到函数级和字段级数据流，而不是一上来从零重写。这样既保住遗留系统已经解决的真实兼容细节，也能明确区分“继承能力”和“后续项目贡献”。

### 2.2 外部系统不可见时，用探针和真实结果，不靠猜

静态恢复后仍有不确定项，就写只读 runtime probe 捕获真实商品列表、SKU、详情和分类行为。探针验证了价格/库存血缘，还定位出“分类读取 0 件”不是简单的分类 API 报错，而是首页没有再触发原作者等待的 category seed 请求。

目标商城同样没有内部源码，因此用真实成功/失败导入反推契约，而不是根据列名猜后台实现。

### 2.3 先把历史账算对：SKU 行数不等于商品数

历史后台曾显示 5,000+ 导入记录，而当前商城只有约 1,600 商品。没有直接推断“丢了三千多件”，而是把历史 Excel 全部拿出来重新对账：

- 7 份历史表：**5,278 个 SKU/data rows → 约 1,628 个商品组**；
- 8 批进一步归并：**1,729 raw groups → 1,721 个历史商品实体**。

这一步不是单纯修正统计口径。它第一次给后续去重建立了覆盖过去业务的**全量历史事实底座**。

人工筛重会随着商品数量增长越来越不现实；程序多做几十万甚至上百万次本地比较，远比让人每次重新检查 1,700、5,000、10,000 件商品便宜。因此我们明确选择：**优先降低人工复杂度，不为了省 CPU 牺牲去重可靠性。**

### 2.4 五层商品实体去重，而不是“标题哈希”

最终每个完整候选都可以结合五类证据：

1. 精确 `itemId / skuId / 商品编码`；
2. 容量、重量、数量、尺寸、色号、型号等硬规格；
3. 标题标准化；
4. 字符 2/3-gram、字符集合、编辑距离与词序容错；
5. 主图 URL + Chrome Canvas 64-bit dHash。

输出不是被迫二选一，而是：

```text
DUPLICATE_CONFIRMED
NEW_CONFIRMED
REVIEW_REQUIRED
```

### 2.5 图片 URL 只是定位符，不是图片身份

历史 Excel 本来就有 CDN 图片 URL，但不同 CDN、分辨率、JPEG/WebP 重编码都可能让 URL 和文件字节变化，而画面仍然是同一张图。

因此复用已有 Playwright/Chrome：

```text
图片 URL
→ Chrome 下载并解码
→ Canvas 缩成 9×8 灰度图
→ Node 计算 64-bit dHash
→ Hamming Distance
→ 缓存结果
```

同一画面 PNG → JPEG 的回归测试得到 **Hamming Distance = 0**。dHash 成为和标题独立的一条视觉证据，但绝不能覆盖硬规格冲突：30ml 和 60ml 即使共用同一宣传图，也必须视为不同商品。

v2.5 起，dHash 缓存统一进入 SQLite `image_hashes`，不再跟着版本目录散落。

### 2.6 明知道可以上 tokenizer / embedding，但主动不做

我们认真讨论过中文 tokenizer、自定义词典、embedding、向量库和更重的视觉模型。最终没有把它们加入默认架构，不是因为技术上做不到，而是因为当前业务规模、错误成本和人工兜底条件不值得购买这些复杂度。

最终保持：

```text
硬规格正则
+ 少量别名
+ 标题归一化
+ 字符 n-gram / bag / edit distance
+ dHash
+ REVIEW_REQUIRED
```

原则是：**真实误判样本出现以后再购买复杂度，而不是为了“看起来更 AI”先堆技术。**

### 2.7 搜索、意图确认、深抓、去重必须分层

“我想找 Hollister 女士浅灰色卫衣”不是精确数据库键。最终流程变成：

```text
多个自然语言目标
→ 高召回模糊排序
→ 每个目标展示候选列表
→ 人工输入编号确认意图
→ 只深抓选中的商品详情/SKU
→ 高精度五层历史去重
→ 真正新品进入商城 Excel
```

模糊 top1 不能替用户决定“你就是想要这个商品”。搜索和去重有不同错误代价，不能混成一个算法。

### 2.8 先判断“大概是什么商品”，再路由分类

v2.2 的模糊找货能用，但全店 2,000+ 商品扫描成本高。v2.3 没有建立 `Tommy → 衣服`、`CK → 鞋` 这种品牌硬编码，而是抽取“卫衣、短裤、牛仔、人字拖、面霜”等高信息量商品类型词段，再和**当前店铺真实分类名称**评分：

```text
高置信 → 最佳分类
中置信 → 前 1～2 个分类
低置信 → 不乱猜，回退全店
```

真实五个服饰目标全部高置信路由到 `衣服鞋帽`，把搜索面从 2,000+ 降到约 660～680，而且多个目标共享一次分类扫描。

路由只负责降低请求量，不负责最终商品身份，所以允许简单、可解释并带 fallback。

### 2.9 “最新 N 个候选”不等于“N 个新品”

如果最新 100 个候选中 80 个已经导入过，商家真正需要的不是剩下 20 个，而是继续向后找，直到凑够 100 个真正新品。

v2.1 因此改成 goal-seeking loop：逐件深抓、逐件去重，只有 `NEW_CONFIRMED` 才增加新品计数，达到 N 立即停止。

### 2.10 不和限流硬刚，建立请求预算

全店精确扫描和激进 retry 曾触发 socket hang up / HTTP2 错误。正确方向不是无限增加 retry，而是：分类最新、有限窗口、渐进冷却、连续失败主动停止，以及后来的分类路由。

### 2.11 “兄弟姐妹继承历史”能兼容升级，但不是长期架构

v2.3/v2.4 为了兼容升级，会在附近旧版本目录里找最大/最新历史再继承。这个方案能工作，但删除 v1.8 / v2.0 / v2.3 不应该威胁业务历史。

v2.5 因此明确拆成三个生命周期：

```text
GitHub       = 代码和版本历史
Release ZIP  = 可删除的运行快照
SQLite       = 永久业务状态
```

商品实体、同店历史、dHash 和事件统一进入：

```text
%LOCALAPPDATA%\WeidianMerchantTool\data\state.sqlite3
```

以后版本直接打开同一数据库，不再扫描旧版本“兄弟姐妹”。

### 2.12 内部候选池不应该吓到用户

目标只要 5 个新品时，终端曾显示 200 / 148 这类内部候选数量，让人误以为程序要抓几百件；实际可能核验到第 15 件就已经找到 5 个新品并停止。

因此主界面应该显示：

```text
目标新品 5
已深度核验 X
已找到 Y/5
```

内部候选池放诊断日志，而不是成为用户理解业务的数字。

### 2.13 程序运行成功不等于业务成功

生成并 QA 通过 Excel 只证明批次 `PREPARED`，不证明商城真的接受了它。v2.6 把状态拆成：

```text
PREPARED
→ 用户确认商城实际导入
→ MALL_IMPORTED
```

同时加入运行账本、导出批次、高水位、SQLite `quick_check`、外部健康锚点、daily/checkpoint backup 和显式恢复。

---

## 3. 版本演化

| 版本 | 主题 | 关键变化 |
|---|---|---|
| **Pre-v1.0** | 黑箱逆向与证据链 | EXE/DAT/启动链、JS/PowerShell 恢复、函数级/字段级 lineage、运行时 API 探针 |
| **v1.0** | 分类抓取 | 读取真实店铺分类并按 `cateId` 抓指定分类 |
| **v1.1** | 可控商品选择 | 分类 / 全店关键词 / 分类+关键词 / 指定 ID/链接 + 全局历史 |
| **v1.2** | 搜索语义 | 多关键词 AND → OR；别名和失败窗口稳定性 |
| **v1.3** | 干净上传产物 | 上传 Excel 与辅助文件分离；清除模板说明/示例污染 |
| **v1.4** | 商城契约验证 | 真实成功样本锁定 31 列、空分类、`放置仓库` |
| **v1.5** | 最新商品 | 独立 latest workflow，不要求先全量搬店 |
| **v1.6** | 真实上架时间 | `addTime`；轻量时间索引与详情/SKU抓取分离 |
| **v1.7** | 分类最新 / 重试实验 | 分类+latest、断点、重试；暴露激进扫描风险 |
| **v1.8** | 请求预算 | 低频、冷却、有限窗口，分类最新成为日常路径 |
| **v1.9** | 商品实体去重 | 1,721 历史实体 + 五层证据 + 三态输出 + dHash |
| **v2.0** | 动态历史 / 失败根因 | `规格已存在` 修复；QA 通过才推进历史 |
| **v2.1** | 真正增量 | 从“前 N 个候选”升级为“找到 N 个真正新品” |
| **v2.2** | 多目标模糊找货 | 多描述、模糊排序、分页展示、人工选号、只抓所选商品 |
| **v2.3** | 分类路由 | 商品类型词段 → 真实分类；低置信全店兜底；固定历史中心 |
| **v2.4** | 终端 UX | 单屏原位选号 |
| **v2.5** | 状态架构 | GitHub / Release / SQLite 分离；取消兄弟版本继承 |
| **v2.5.1** | 增量 UX 修正 | 隐藏 200/148 内部候选主展示；目标/核验/新品进度；ZIP 临时目录保护 |
| **v2.6** | 运行正确性 | runs/export_batches、商城确认、高水位、健康锚点、checkpoint、恢复 |

历史 compact packet 位于 [`archive/version-packets/`](archive/version-packets/)。v2.5.1 有明确演进记录，但当前没有单独保存最终完整 artifact，因此不伪造 binary SHA 或 packet。

---

## 4. 核心实证

| 证据 | 结果 |
|---|---:|
| 历史 Excel 对账 | **5,278 SKU/data rows → 约 1,628 个商品组** |
| 历史实体归并 | **1,729 raw groups → 1,721 entities** |
| v2.0 真实 100 候选 | **79 重复 / 1 Review / 20 新品** |
| 上述 20 个新品 | **122 SKU；31 列 QA PASS；必填问题 0** |
| 商城失败回放 | **448 成功 / 2 失败 → 恰好 2 个重复最终规格** |
| dHash 回归 | 同一画面 PNG vs JPEG：**Hamming Distance = 0** |
| 全历史压力测试 | **500 × 1,722 ≈ 861k** 次比较；500/500 新品正确确认 |
| v2.3 真实分类路由 | 5 个目标 → `衣服鞋帽`；选 5，挡 1 历史，导出 **4 新品 / 40 SKU** |
| v2.5 SQLite 首次初始化 | **1,745 商品 / 1,740 dHash / 104 同店历史** |
| 后续真实运行 | 历史跨进程继续 **1,745 → 1,750** |

详见 [验证证据（中文）](docs/VALIDATION_EVIDENCE.md) / [Validation Evidence (English)](docs/VALIDATION_EVIDENCE.en.md)。

---

## 5. 当前架构

```text
GitHub repository
  ├─ source / tests / 中英文文档
  └─ compact historical version packets

Release ZIP
  └─ disposable runtime; no user state; no .git

%LOCALAPPDATA%\WeidianMerchantTool\
  ├─ data\state.sqlite3
  ├─ data\health_anchor.json
  ├─ backups\
  ├─ cache\
  └─ logs\
```

SQLite Schema 2 包含 `products`、`image_hashes`、`global_history`、`events`、`runs`、`export_batches` 等状态。

---

## 6. 求职展示入口

| 中文 | English |
|---|---|
| [架构](ARCHITECTURE.md) | [Architecture](ARCHITECTURE.en.md) |
| [版本演化](docs/PROJECT_EVOLUTION.md) | [Project Evolution](docs/PROJECT_EVOLUTION.en.md) |
| [关键路径](docs/CRITICAL_PATH.md) | [Critical Path](docs/CRITICAL_PATH.en.md) |
| [关键决策](docs/DECISION_LOG.md) | [Decision Log](docs/DECISION_LOG.en.md) |
| [对话决策轨迹](docs/DECISION_TRACE_FROM_DIALOGUE.md) | [Decision Trace](docs/DECISION_TRACE_FROM_DIALOGUE.en.md) |
| [验证证据](docs/VALIDATION_EVIDENCE.md) | [Validation Evidence](docs/VALIDATION_EVIDENCE.en.md) |
| [求职与面试笔记](docs/PORTFOLIO_NOTES.md) | [Portfolio & Interview Notes](docs/PORTFOLIO_NOTES.en.md) |
| [项目来源与贡献边界](docs/ORIGIN_AND_PROVENANCE.md) | [Origin & Provenance](docs/ORIGIN_AND_PROVENANCE.en.md) |
| [版本变更](CHANGELOG.md) | [Changelog](CHANGELOG.en.md) |
| [数据安全](SECURITY.md) | [Data Handling](SECURITY.en.md) |

---

## 7. 公开仓库边界

仓库明确不提交：

- `state.sqlite3`；
- 真实商品历史 / dHash 用户缓存 / 同店历史；
- 商城业务 Excel；
- 用户特定店铺配置、Cookie、Token；
- 第三方原始客户端二进制。

项目不会把继承来的原始导出器冒充成从零原创，也不会把字符级模糊搜索包装成“LLM 语义搜索”。重点展示的是不断发生的：**假设 → 证据 → 纠正 → 更安全设计**。

## 当前版本

**v2.6.0**
