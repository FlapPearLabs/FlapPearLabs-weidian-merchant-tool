# Critical Path — From Black Box to Stateful Merchant System

这份文档只保留项目中真正改变下一步方向的路径，不按“做了多少功能”记流水账。

## Stage 0 — 先回答：这个软件到底是什么？

### 输入

第三方 Windows 包 `微店商品导出器-v1.2.0-客户版`，包含 EXE、`engine.dat`、`launcher.dat`、Node runtime、Playwright/ExcelJS 依赖和 Excel 模板。

### 方法

静态优先，不修改原包：

```text
文件普查
→ SHA256 固化
→ EXE 架构
→ DAT 容器
→ 加载链
→ 代码恢复
→ Playwright / API
→ Excel
→ 动态验证
```

### 关键结果

- EXE 是小型 .NET Framework C# launcher，而不是核心业务程序；
- DAT 被恢复为可读 PowerShell / ESM JavaScript；
- engine 核心逻辑被格式化、函数级解释；
- 进一步做到字段级 lineage：微店 JSON 字段如何进入商城 Excel 列。

### 为什么是关键路径

没有这一步，任何“从零重写”都只是复制表面功能，无法知道原系统已经解决过哪些边界。

---

## Stage 1 — 静态推断不够：建立运行时探针

静态恢复后，又做真实 runtime contract capture：

```text
真实商品列表 response
真实 SKU response
真实详情 response
页面实际触发的分类行为
→ contract check
→ shape snapshot / baseline diff
```

探针确认了列表/SKU/详情链、价格/库存血缘，并定位“分类读取 0 件”不是分类 API 错，而是页面没有触发原作者等待的 category seed 请求。

这形成一个持续原则：**不知道外部系统真实行为时，打只读探针，不靠猜。**

---

## Stage 2 — 用真实商城导入建立 golden contract

目标商城没有可用源码/API 契约，因此采取黑盒验证：

```text
生成 Excel
→ 商城导入
→ 看实际成功/失败
→ 反推最小稳定契约
```

最终锁定 31 列、行结构、分类留空、`放置仓库` 等规则。

这一步把项目从“抓到了数据”推进到“数据真的能进入业务系统”。

---

## Stage 3 — 先做最基本的操作能力

在数据链和导入契约稳定后，才增加：

- 指定分类；
- 全店关键词；
- 分类 + 关键词；
- 指定商品 ID/链接；
- 全店最新；
- 分类最新。

关键词语义从 AND 修为 OR，因为“兰蔻、雅诗兰黛”这种商家输入代表“任意品牌命中”，而不是商品必须同时包含两者。

---

## Stage 4 — “最新”不能靠列表顺序，必须找真实时间证据

早期版本把接口倒序前 N 件近似为最新。

重新检查真实 API 后发现 `addTime`，而且接口顺序与 `addTime` 并不严格一致。

于是建立：

```text
轻量列表：itemId + itemName + addTime
→ 时间排序
→ 只对目标商品抓详情 / SKU / 图片
```

这也是后来所有“cheap index → expensive deep fetch”设计的来源。

---

## Stage 5 — 历史数量口径纠错，重建全量商品基线

商城历史显示 5,000+ 导入记录，但当前商品约 1,600。没有直接下结论“丢了 3,000 件”。

通过历史 Excel 对账确认大量是 SKU/data row：

```text
5,278 rows
→ product grouping
→ ≈ 1,628 product groups
```

进一步用 8 批历史构建：

```text
1,729 raw groups
→ 1,721 product entities
```

这一步改变了整个问题：

> 不再是“从今天开始记住我抓过什么”，而是“把客户过去已经迁移过的商品身份重新恢复出来”。

也正因为有了全历史，才值得做商品实体级去重。

---

## Stage 6 — 从字符串去重升级为商品实体判断

用户明确指出：人工去重会随商品规模持续恶化，程序多算一些没关系，不应为了算法速度牺牲稳定。

因此没有采用“索引没命中就当新品”的激进方案，而让完整候选与完整历史充分比较。

五类证据：

1. 精确 itemId / skuId / 商品编码；
2. 容量、重量、数量、尺寸、色号、型号等硬规格；
3. 标题标准化；
4. 字符级模糊 / 换序容错；
5. Chrome Canvas + 64-bit dHash。

最终只输出：

```text
DUPLICATE_CONFIRMED
NEW_CONFIRMED
REVIEW_REQUIRED
```

---

## Stage 7 — 图片 URL 不可靠，所以比较像素结构

首先利用历史 Excel 的主图 URL 做 URL 归一化；但很快意识到不同 CDN、不同尺寸、JPEG/WebP 重编码可能改变 URL 和文件字节。

因此复用浏览器能力：

```text
URL
→ Chrome decode
→ Canvas 9×8
→ grayscale
→ 64-bit dHash
→ Hamming distance
```

dHash 进入缓存，v2.5 起进入 SQLite `image_hashes`。

硬规格拥有更高证据优先级，因此同图不同规格不会被误杀。

---

## Stage 8 — 明知可以上 NLP，但选择克制

讨论过 tokenizer、自定义词典、embedding、向量库、视觉模型。

用户反复追问“会不会过度工程化”“要务实，只要能用”。最终没有引入这些依赖，而选择：

- 规格正则；
- 少量品牌别名；
- 字符 n-gram / bag / edit；
- dHash；
- 人工 Review。

这不是技术能力不足，而是根据 catalog scale、错误成本和允许人工兜底做出的复杂度预算。

---

## Stage 9 — 真增量：业务目标不是 N 个候选，而是 N 个新品

如果前 100 个“最新候选”里 80 个已存在，商家真正想要的不是剩下 20 个，而是继续向后找满 100 个新品。

因此改成 goal-seeking loop：

```text
按时间拿候选
→ 深抓一个
→ 去重
→ NEW 数 +1
→ 满 N 立即停止
```

---

## Stage 10 — 模糊搜索：搜索、意图确认、抓取、去重分层

真实需求不是一个关键词，而是多个模糊描述。

最终设计：

```text
多个目标描述
→ 每个目标独立模糊排名
→ 展示前若干候选
→ 人工选号
→ 只抓选中的详情/SKU
→ 五层去重
```

没有让模糊算法自动替用户选商品，因为“找得像”和“就是你想要的”不是一回事。

---

## Stage 11 — 分类路由：先判断“大概是什么”，再决定去哪搜

v2.2 模糊搜索仍可能扫完整店铺。

于是增加一个低风险 routing layer：从标题里找高信息量商品类型词，映射到当前店铺真实分类。

真实 5 个服饰目标全部路由到 `衣服鞋帽`，把请求面从 2,000+ 缩到约 660～680。

路由错误不会直接导致业务错误：中置信搜两个分类，低置信回退全店，后面仍有人选号和五层去重。

---

## Stage 12 — 请求预算：不要“和限流硬刚”

全店精确扫描和激进重试带来 socket hang up / HTTP2 错误。

结论不是再加更多 retry，而是：

- 分类最新作为日常路径；
- 有限智能窗口；
- progressive cooldown；
- 连续失败主动停；
- 路由优先缩小搜索空间。

---

## Stage 13 — 历史不应该依赖旧程序“兄弟姐妹”

v2.3/v2.4 为兼容升级曾扫描旧版本目录继承历史。

用户直接指出这种设计不优雅：删除 v2.2 / v2.0 / v1.8 不应该破坏历史。

于是 v2.5 明确分离：

```text
GitHub = code history
Release ZIP = disposable runtime
SQLite = persistent merchant state
```

这不是小功能，而是一次生命周期重构。

---

## Stage 14 — 状态存在还不够，还必须可证明、可恢复

v2.6 又追问：SQLite 如果断档怎么办？

于是加入：

- `quick_check` / foreign-key check；
- internal high-water；
- external health anchor；
- `runs` ledger；
- `export_batches`；
- PREPARED / MALL_IMPORTED；
- daily + checkpoint backup；
- 显式恢复工具。

最终问题从“程序执行了吗”变成“业务状态是否连续、是否可解释、是否能恢复”。
