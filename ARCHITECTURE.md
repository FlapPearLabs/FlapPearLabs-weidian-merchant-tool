# 架构说明 — v2.6+

**中文** | [English](ARCHITECTURE.en.md)

## 1. 三种生命周期

| 关注对象 | 单一事实源 | 生命周期 |
|---|---|---|
| 源代码 / 决策 / 版本历史 | GitHub | 长期 |
| 运行程序 | Release ZIP | 可替换、可删除 |
| 商家商品身份历史 | `state.sqlite3` | 永久用户数据 |
| dHash 缓存 | `state.sqlite3:image_hashes` | 持久派生数据 |
| 同店历史 | `state.sqlite3:global_history` | 永久用户数据 |
| 运行/导出审计 | SQLite `runs` / `export_batches` | 追加式运营状态 |
| 扫描 checkpoint | `%LOCALAPPDATA%/.../cache` | 可丢弃 |
| 商城导入 Excel | Documents/微店商品导出器/每日导出 | 用户交付物 |

**程序版本目录永远不拥有业务历史真相。**

## 2. 商品采集架构

```text
微店 URL
  ↓
轻量商品列表 / 分类 API
  ↓
[分类 / 关键词 / 指定ID / 最新 / 模糊搜索]
  ↓
可选：分类路由
  ↓
候选展示 / 人工选号
  ↓
只保留选中的 itemId
  ↓
完整详情 + SKU + 图片证据
  ↓
商品实体去重
  ↓
商城 Excel
```

轻量阶段优先读取：

```text
itemId
itemName
addTime
category metadata
```

只有真正需要的候选才进入详情、SKU、规格、价格、库存、详情图和主图等深抓阶段。这一拆分同时服务于 `addTime` 最新判断、模糊找货和请求预算控制。

## 3. 搜索不是去重

```text
搜索：高召回
“用户大概想找什么？”
        ↓
人工确认意图
        ↓
去重：高精度
“它是不是历史上同一个商品实体？”
```

搜索允许模糊和近似；去重必须保守，并允许返回 `REVIEW_REQUIRED`。

## 4. 分类路由

路由层只负责缩小搜索空间。它从标题中提取高信息量商品类型词段，再与当前店铺真实分类名称评分：

```text
高置信 → 最佳分类
中置信 → 前 1～2 个分类
低置信 → 全店兜底
```

它刻意不做品牌→分类硬编码，也不负责决定最终商品身份。

## 5. 五层商品实体判断

完整候选与历史商品比较时使用：

1. **精确证据**：itemId / skuId / 商品编码；
2. **硬规格**：容量、重量、数量、尺寸、色号、型号；硬冲突直接否决“同商品”；
3. **标题标准化**：Unicode、大小写、标点、单位、部分噪声归一；
4. **字符级模糊**：2/3-gram、字符 bag、编辑距离和词序容错；
5. **图片证据**：标准化主图 URL + Chrome Canvas 64-bit dHash / Hamming distance。

最终结果只有三种：

```text
DUPLICATE_CONFIRMED
NEW_CONFIRMED
REVIEW_REQUIRED
```

### 为什么需要 dHash

CDN URL 是定位符，不是图片身份。两个不同 URL、不同图片文件格式，仍可能解码成同一画面。现有 Playwright/Chrome 负责 JPEG/PNG/WebP 解码，Canvas 将图像归一到 9×8，Node 计算 64-bit dHash，因此不需要额外引入 OpenCV、TensorFlow 或 GPU。

## 6. 历史基线构建

历史商城 Excel 必须按商品级而不是按行理解：

```text
SKU/data rows
→ 按 SPU / 商品组聚合
→ 合并确定的历史重复
→ canonical historical baseline
```

因此 5,278 个历史数据行不等于 5,278 个商品。

## 7. SQLite Schema 2

- `meta`：Schema、初始化信息、高水位；
- `products`：供去重使用的历史商品实体；
- `image_hashes`：图片 URL → 64-bit dHash / 图片失败缓存；
- `global_history`：按店铺记录来源 itemId 历史；
- `events`：状态变化事件；
- `runs`：目标数、扫描/深核数、重复/Review/新品、运行前后历史数；
- `export_batches`：Excel 批次及 `PREPARED / MALL_IMPORTED` 状态。

## 8. 健康检查与恢复

启动时检查：

1. SQLite `quick_check`；
2. foreign-key integrity；
3. 数据库内部商品历史高水位是否单调；
4. 数据库外 `health_anchor.json` 是否发现整库回滚。

历史成功推进后创建 checkpoint；每日备份独立保留。显式恢复前先做 emergency backup，再把健康锚点重置到用户明确选定的恢复点。

**失败策略：fail closed。** 历史缺失、损坏或明显倒退时禁止静默创建空历史继续运行。

## 9. 升级契约

1. v2.5 只进行一次 legacy JSON → SQLite 转换；
2. v2.6+ 直接打开同一数据库；
3. Schema 采用可重复执行的原地迁移；
4. 不再扫描任何旧版本“兄弟目录”；
5. Release ZIP 不包含 `.git`、SQLite、用户历史 JSON、dHash 用户缓存或商城业务 Excel。
