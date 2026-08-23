# 数据与安全边界

**中文** | [English](SECURITY.en.md)

这个公开仓库不能包含商家的真实业务状态。

禁止提交：

- `state.sqlite3` 及 SQLite WAL/SHM 文件；
- 真实历史商品基线；
- dHash 用户缓存导出；
- 同店抓取/导出历史；
- 生成的真实商城业务 Excel；
- 含本机路径或商家运营数据的日志；
- 用户特定店铺配置、Cookie、Token、凭据；
- 继承的第三方原始客户端二进制。

持久业务状态固定保存在用户机器的 `%LOCALAPPDATA%\WeidianMerchantTool\`。Release 包应保持无状态、可替换、可删除。
