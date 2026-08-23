# 历史版本归档包

**中文** | [English](README.en.md)

这个目录用于**项目历史记录和求职作品审查**，不是生产二进制软件的下载渠道。

## 为什么不用 17 份完整约 47MB Release？

历史运行包反复携带几乎相同的 Node 可执行文件和依赖树。如果把每个完整二进制包全部提交 Git，会额外产生接近 800MB 的重复 runtime，让仓库难以 clone、diff 和审查。

因此每个被保留的正式版本使用一个**紧凑 version packet ZIP**，里面记录：

- 里程碑 / 版本说明；
- 原本地完整 artifact 文件名、大小和 SHA256；
- 该 Release 的源码 / 配置文件索引。

当前可维护源码仍以 `main` 为准；历史 packet 负责保存 artifact 身份与版本演化证据，而不重复携带完整 runtime 或用户业务状态。

这些 packet **不是可直接运行的 Release**。

## 已保存版本

| Packet | 里程碑 |
|---|---|
| `v1.0` | 指定分类导出 |
| `v1.1` | 多模式商品发现 + 全局历史 |
| `v1.2` | 多关键词 OR + 启动稳定性 |
| `v1.3` | 干净上传产物 |
| `v1.4` | 真实商城黄金导入格式 |
| `v1.5` | 最新商品工作流 |
| `v1.6` | `addTime` 真实上架时间 |
| `v1.7` | 分类最新 + retry/checkpoint |
| `v1.8` | 低频 / 请求预算控制 |
| `v1.9` | 五层商品实体去重 |
| `v2.0` | 动态基线 + 重复规格修复 |
| `v2.1` | 真正 N 个新品 |
| `v2.2` | 多目标模糊搜索 + 人工选号 |
| `v2.3` | 分类路由 + 持久历史中心 |
| `v2.4` | 单屏选号 UX |
| `v2.5` | GitHub + 外部 SQLite 状态架构 |
| `v2.6` | 运行账本、健康检查、checkpoint、恢复 |

`v2.5.1` 在聊天和代码演进中有明确 point-release 证据，但没有独立最终完整 artifact 被保留下来，因此不伪造 binary packet 或 SHA。

哈希与 artifact 对应关系见 [MANIFEST.md](MANIFEST.md)；完整版本路径见 [项目演化](../docs/PROJECT_EVOLUTION.md)；关键取舍见 [对话决策轨迹](../docs/DECISION_TRACE_FROM_DIALOGUE.md)。
