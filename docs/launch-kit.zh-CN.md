# DSH Gate 发布与采用手册

> 面向插件作者、市场维护者和 Desktop 集成者；普通用户无需单独安装 DSH Gate。
>
> 本文是长期公开的采用指南。当前版本、线上 Provider 和外部采用状态以[发布状态](release-status.zh-CN.md)和具体 GitHub 证据为准。

这不是“再做一个插件市场”。DSH Gate 的一句话定位是：

> 在 DeepSeek Harness 插件进入真实 Profile 或 Desktop 市场之前，给出可复核的兼容性、权限和源码来源证据。

## 谁会用

| 人 | 看到的入口 | 实际动作 | 得到的结果 |
| --- | --- | --- | --- |
| 插件作者 | GitHub Action | 复制一个工作流到 `.github/workflows/dsh-gate.yml` | 每个 PR/push 都有 `pass`、`warn` 或 `fail` Receipt |
| 市场或 Desktop 维护者 | Provider `manifest.json` | 部署静态 Provider，并在 Desktop 社区市场添加 manifest URL | 在展示安装按钮前读取同一份验证结果 |
| 普通用户 | Desktop 市场 | 查看结果、权限和来源后明确确认安装 | 不需要安装 DSH Gate，也不会被静默改 Profile |

普通用户不是 CLI 的目标用户。推广的第一步应当是获得一个独立插件仓库采用 Action，第二步是让一个独立市场或 Desktop 消费 Provider，最后才是面向用户宣传“可验证安装”。

## 别人怎么开始

### 插件作者：60 秒接入

在插件仓库新增工作流：

```yaml
name: DSH plugin compatibility

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: ChaoYuZhang001/dsh-gate@v0.4.0-alpha.3
        with:
          target: ${{ github.event.pull_request.head.repo.html_url || github.event.repository.html_url }}
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          smoke: 'false'
          github-token: ${{ github.token }}
```

他们不需要安装 npm 包，不需要提供 DSH Profile，也不会运行插件生命周期脚本。生产仓库应把版本替换为经过审查的完整 release tag 或 immutable commit SHA。`warn` 允许维护者复核后继续，`fail` 默认阻止工作流；Receipt 是证据，不是安全审计或官方背书。

### 市场或 Desktop 维护者

1. 用 `npm run build:provider-site -- https://<host>/<base>` 生成静态工件。
2. 把 `manifest.json` 和精确的 `v1/plugins` 部署到支持 JSON 响应头的 HTTPS 主机。
3. 在同一网络边界运行 `npm run verify:provider -- https://<host>/<base>/manifest.json`。
4. 让 Desktop 的 Community Market source 使用已验证的 manifest URL，并记录一次实际消费证据。

线上 Provider 是否可用不由本地工件生成成功决定。发布 manifest URL 前，应先查看[发布状态](release-status.zh-CN.md)，确认匿名 HTTPS smoke 和 Desktop 实际消费均已通过。

### 普通用户

普通用户只需要在 Desktop 市场中查看插件的兼容性、权限和来源证据，再明确点击安装。DSH Gate 不提供独立安装器，不读取用户 Profile，也不应成为默认或静默安装路径。

## 推广顺序

### 1. 先推广“接入动作”，不是推广“目录数量”

首条 CTA 应是“给你的 DSH 插件加一条只读兼容性检查”，链接到 [插件作者快速开始](plugin-author-quickstart.md)。目录项目数、Stars 和 Forks 都不能替代外部采用证据。

适合发布的位置：

- `deepseek-harness` 相关 GitHub Discussions、Issue 或生态仓库的贡献指南；
- 已公开的 DSH 插件仓库，在获得维护者同意后提交一个小型集成 PR；
- DSH Desktop/Forge 的社区市场或开发者频道，发布 Provider 消费说明；
- DSH Gate 自己的 Release notes，附上一个真实 Receipt 和完整 workflow 链接。

不要群发未经请求的 PR，不要把 `pass` 写成“安全认证”，也不要在 live Provider 尚未通过时宣传“打开 Desktop 就能安装”。

### 2. 用一个可复现案例证明价值

发布案例必须包含：

1. 外部插件仓库和采用 PR；
2. PR 合并前的 `warn`/`fail` 结果；
3. 维护者做的修复或声明；
4. 合并后的 Receipt、commit SHA 和 workflow run。

这比“我们已经收录很多插件”的截图更能说明 DSH Gate 防止了什么问题。

### 3. 再推广 Desktop 消费

Provider 通过匿名 HTTPS JSON smoke 和 Desktop 实际消费后，发布一条用户路径：

```text
打开 Desktop -> 社区市场 -> 添加已验证 manifest URL -> 查看 Receipt -> 明确确认安装
```

第一版保持 opt-in；不要修改 Desktop 默认源、不要自动安装、不要把 `warn` 隐藏成推荐。

## 可直接使用的发布文案

### 面向插件作者

> 你的 DSH 插件可以在每个 PR 上自动检查 DSH 版本兼容性、权限声明和 GitHub 源码来源。复制一份 DSH Gate Action 即可开始；它只读公开源码，不读取 Profile，也不运行生命周期脚本。通过结果是可复核 Receipt，不是安全背书。

### 面向 Desktop/市场维护者

> DSH Gate 提供一个固定的 `manifest.json` + `/v1/plugins` Provider 合约。市场可以在展示安装动作前读取同一份兼容性和来源证据，仍由 Desktop 负责缓存、确认和 Profile 修改。

### 面向普通用户

> 安装前先看兼容版本、权限和源码来源。DSH Gate 把这些信息展示给市场，但不会替你静默安装或修改 Profile。

## 发布门槛和指标

在以下证据齐全前，项目状态只能写“alpha / preview”：

- 一个独立插件仓库合并了 Action，并有公开成功或诚实失败的 workflow run；
- 一个独立市场或 Desktop 消费了线上 Provider；
- Provider 两个端点都返回 `application/json` 或 `application/*+json`；
- `npm run verify:provider` 和 Desktop 实际消费均通过；
- Release、Action 和 Provider 的版本/commit 可追溯。

发布后只跟踪与采用相关的公开指标：独立插件采用数、合并 PR 数、Provider 消费者数、重复验证运行数，以及被作者修复的 `warn`/`fail` 数。Stars、Forks 和目录条目数只能作为辅助信号。

## 文档状态边界

本文只描述稳定的公开采用流程、发布门槛和对外文案。Alpha 当前是否满足这些门槛，以及哪些能力可以对外宣传，统一见[发布状态](release-status.zh-CN.md)；发布公告应同时附上具体 Release、workflow、Provider smoke 或采用 PR 证据。
