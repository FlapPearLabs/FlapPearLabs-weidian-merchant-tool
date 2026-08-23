# FlapPearLabs Weidian Merchant Tool

微店商品筛选、模糊找货、五层去重与商城 Excel 导出工具。

## v2.5 架构基线

从 v2.5 开始，代码、运行包和用户业务数据彻底分离：

```text
GitHub repository
  └─ source / tests / docs

Release ZIP（无状态，可删除）
  └─ runtime / run.ps1 / config

%LOCALAPPDATA%\WeidianMerchantTool\
  ├─ data\state.sqlite3      # 唯一业务状态源
  ├─ backups\               # SQLite 每日备份
  ├─ cache\                 # 可丢弃缓存 / 断点
  └─ logs\                  # 运行日志
```

用户生成的 Excel 固定输出到：

```text
%USERPROFILE%\Documents\微店商品导出器\每日导出\
```

### 数据所有权规则

- Git / GitHub **只管理代码**。
- `state.sqlite3` **只保存在用户本机**，不进入 Git。
- 商品历史、SKU 身份、主图 dHash、同店抓取历史和事件记录都保存在 SQLite。
- Release ZIP 不包含 `.git`，也不包含任何用户历史快照。
- 从 v2.6、v2.7、v3.0 开始，下载解压后直接打开同一 `state.sqlite3`；确认新版正常后可以删除旧版目录。

### v2.4 → v2.5 一次性切换

仅 v2.5 首次运行时，会从旧固定数据目录：

```text
%LOCALAPPDATA%\WeidianMerchantTool\历史中心\
```

一次性导入 JSON 历史到 SQLite。它**不会扫描 v1.8/v2.0/v2.3/v2.4 等兄弟版本目录**。

如果旧固定历史中心不存在，v2.5 会 fail closed，不会用安装包种子或空数据库覆盖历史。

## 开发

Node.js 24+。

```powershell
cd runtime
pnpm install --frozen-lockfile
```

Windows 中国大陆网络需要 GitHub 代理时可运行：

```powershell
.\scripts\configure_git_clash_proxy.ps1
```

默认使用 Clash `127.0.0.1:7897`。

## 本地默认店铺（不进入 Git）

可复制 `config/default_shop.example.json` 为 `config/default_shop.local.json`，填写自己的店铺地址。该文件被 `.gitignore` 排除。
