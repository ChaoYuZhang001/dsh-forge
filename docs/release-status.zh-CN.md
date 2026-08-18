# DSH Gate 发布状态

> 最后核验：2026-08-18。本文只记录可复核的公开状态；采用手册中的稳定流程不随本页的状态文字变化。

## 当前阶段

`v0.4.0-alpha.3` 是 Alpha 预览版本，不是稳定版。当前公开 Release：

- [v0.4.0-alpha.3](https://github.com/ChaoYuZhang001/dsh-gate/releases/tag/v0.4.0-alpha.3)
- [主 CI run 32101439270](https://github.com/ChaoYuZhang001/dsh-gate/actions/runs/32101439270)，所有 job 成功

## 已交付

- GitHub Action 可对公开 DSH 插件执行兼容性、权限和来源检查，并生成脱敏 Receipt。
- 兼容性矩阵、Desktop Provider 合约、严格 Fixture 和 fail-closed Provider smoke 已纳入仓库和 CI。
- 已提供插件作者快速开始、中文采用手册和自助采用申请入口。
- 仓库是公开的社区项目，不是 DeepSeek 官方产品；Receipt 不是安全审计、认证或官方背书。

## 尚未闭环的发布门槛

| 门槛 | 当前状态 | 可复核证据和下一步 |
| --- | --- | --- |
| 线上 Provider | 未完成 | [Issue #14](https://github.com/ChaoYuZhang001/dsh-gate/issues/14)：当前 GitHub Pages 的扩展名为空的 `/v1/plugins` 返回错误的 JSON MIME；需要受维护者控制的 HTTPS 主机通过 Provider smoke，并由 Desktop 实际消费。 |
| 独立插件采用 | 未完成 | [Issue #15](https://github.com/ChaoYuZhang001/dsh-gate/issues/15)：尚无外部维护者合并 Action；不得把本仓库自己的 smoke 当作独立采用证据。 |
| GitHub Actions Marketplace | 未完成 | [Issue #20](https://github.com/ChaoYuZhang001/dsh-gate/issues/20)：发布需要仓库维护者在 GitHub 网页端完成 Marketplace 流程。 |
| npm 包 | 未完成 | 当前 npm registry 没有 `dsh-gate` 包；文档中的 CLI 用法是仓库源码用法，不是全局安装命令。 |

## 当前可以宣称的内容

- 这是一个可审查的 Alpha 社区开发者工具。
- 插件作者可以按 [插件作者快速开始](plugin-author-quickstart.md) 接入固定版本的 GitHub Action。
- 市场或 Desktop 维护者可以使用 Provider 构建和验证工具准备部署，但必须先通过匿名 HTTPS smoke 和实际 Desktop 消费验证。
- 第一版采用路径保持 opt-in，由 Desktop 负责缓存、确认和 Profile 修改。

## 当前不能宣称的内容

- 不能宣称已经有稳定版发布。
- 不能宣称 live Provider 已可供 Desktop 用户使用。
- 不能宣称已经形成独立生态采用。
- 不能宣称安全认证、DeepSeek 官方背书、默认市场源或自动安装能力。

## 更新规则

每次 Release、Provider 部署、独立插件合并采用 PR 或 Marketplace 状态变化后更新本页的核验日期、门槛表和证据链接。外部公告应引用本页和具体公开证据，不要复制过期的状态文字。
