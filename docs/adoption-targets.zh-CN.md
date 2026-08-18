# 首批采用候选

这是一份基于公开 GitHub 数据的只读候选名单，不代表这些项目已经同意采用
DSH Gate，也不代表 DSH Gate 为它们背书。数据核对日期：2026-08-18。

## 优先联系的插件作者

| 优先级 | 仓库 | 公开信号 | 为什么适合首批验证 | 预期接入方式 |
| --- | --- | --- | --- | --- |
| A | [ZSeven-W/dsh-openpencil](https://github.com/ZSeven-W/dsh-openpencil) | 113 Stars、4 Forks；最近更新 2026-08-16；有 `cordis.patch.yml`、CI 和发布工作流 | 有明确 DSH peer 依赖，且有完整 CI，适合验证 PR 检查不会干扰发布 | 先在 PR 上运行 Action，`warn` 结果由维护者复核 |
| A | [sugarforever/dsh-lark](https://github.com/sugarforever/dsh-lark) | 14 Stars、3 Forks；最近更新 2026-08-17；有测试、CI 和发布工作流 | 真实第三方集成插件，权限和来源 Receipt 有可解释价值 | 在 PR/push 上加入只读 Action |
| B | [tensorlakeai/dsh-tensorlake-sandbox](https://github.com/tensorlakeai/dsh-tensorlake-sandbox) | 6 Stars、2 Forks；有 `cordis.patch.yml` 和 DSH peer 依赖 | 企业/基础设施场景可证明平台兼容性和权限声明的价值 | 先运行不上传 Receipt 的试验工作流，再由维护者决定保留 |
| B | [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) | 公开市场项目；有 DSH peer 依赖、测试和发布工作流 | 同时是插件包和潜在市场消费者，适合验证“验证层不替代市场”边界 | 先作为插件作者采用 Action，再讨论 Provider 消费 |

这些仓库的版本、分支和 Stars 会变化；联系前必须重新读取目标仓库当前的
`package.json`、工作流和维护者偏好，不能直接复制本表中的旧 SHA 或状态。

## 优先合作的分发方

这些项目不是首批 Action 采用者，而是潜在的目录/市场消费方：

- [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)：大型插件目录，适合讨论在条目中展示 Receipt 链接；
- [AdamPlatin123/awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins)：强调实际验证和筛选，适合讨论结果字段映射；
- [bradeGithub/DSH-Plugins-Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace)：有市场 UI，适合验证 Provider 或 Receipt 消费；
- [like-study1/Oh-My-DSH](https://github.com/like-study1/Oh-My-DSH)：自动同步目录，适合讨论来源追踪和失效更新。

分发方的需求不是“再收录一个列表”，而是把 `pass`、`warn`、`fail` 和不可变来源
显示给用户，同时保留它们自己的排序、审核和安装决策。

## 联系和集成规则

1. 先在本仓库记录目标和公开证据，不自动向第三方发送消息。
2. 获得维护者明确同意后，提交最小集成 PR；不得批量开 PR。
3. 使用完整 release tag 或 immutable commit，权限保持 `contents: read`。
4. 不读取或提交目标仓库的真实 Profile、凭据、对话、私有插件或原始日志。
5. PR 合并后记录 workflow run、Receipt 状态和目标 commit；失败或警告也如实记录。

## 首批采用的成功标准

不以 Stars、Forks 或目录条目数作为成功标准。第一阶段只需要：

- 一个 A 级插件作者合并 Action；
- 一个公开 workflow run 产生可审查 Receipt；
- 一个分发方或 Desktop 消费者在不静默安装的前提下读取同一份证据；
- 维护者能说明至少一个 `warn` 或 `fail` 如何帮助修复兼容性、权限或来源问题。

完成这些条件后，才有资格扩大联系范围或发布面向普通用户的宣传。
