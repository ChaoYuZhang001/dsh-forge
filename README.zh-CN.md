# DSH Gate

[English](README.md) | [中文](README.zh-CN.md)

[![CI](https://github.com/ChaoYuZhang001/dsh-gate/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ChaoYuZhang001/dsh-gate/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ChaoYuZhang001/dsh-gate?include_prereleases&sort=semver)](https://github.com/ChaoYuZhang001/dsh-gate/releases)
[![License](https://img.shields.io/github/license/ChaoYuZhang001/dsh-gate)](LICENSE)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
插件的静态兼容性、权限和来源验证工具。

> DSH Gate 是社区开发者工具，不是 DeepSeek 官方产品。Receipt 通过不代表完成了安全审计。

## 插件作者从这里开始

把可直接复制的
[`dsh-gate.yml`](examples/github-actions/dsh-gate.yml) 放进插件仓库的
`.github/workflows/dsh-gate.yml`。下一个 Pull Request 就会得到检查摘要和经过脱敏的
JSON Receipt；不需要安装 DSH Gate，也不会读取真实 DSH Profile。

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

Action 会把 PR 头仓库或 push commit 的精确 SHA 作为远程数据读取，不需要 checkout，
不会运行远程包脚本；Receipt 会记录不可变 commit 和 package blob。检查表会写进工作流
Summary，`dsh-gate-receipt.json` 作为工件保留 14 天，并在结果为 `fail` 时阻止工作流通过。
完整的结果含义、状态徽章和可选 `dsh.gate` 声明见
[插件作者 60 秒接入指南](docs/plugin-author-quickstart.md)。

推广顺序、发布文案和采用门槛见
[发布与采用手册](docs/launch-kit.zh-CN.md)。

## 它解决什么问题

DSH Gate 在插件进入真实 Profile 之前检查：

- `dsh.bundle` 是否满足可安装合约；
- 官方 DSH peer range 是否接受选定的 DSH 基线；
- DSH `rc` 预发布版本所需的 semver 规则；
- 声明权限和高信号推断权限；
- 平台兼容性和源码来源；
- GitHub 目标对应的不可变 commit 和 package blob；
- `packages/`、`plugins/` 或 `apps/` 中唯一的插件包；
- 本地插件的可选 `npm pack --dry-run --ignore-scripts`；
- 不含绝对机器路径和用户数据的标准 JSON Receipt。

当前 alpha 不执行插件生命周期脚本，也不会修改 `~/.dsh`。

## 在生态中的位置

DSH Gate 不是第二个插件市场，也不是 Desktop 安装器。它位于公开插件源码和真实安装之间：

```text
插件仓库 -> 不可变源码快照 -> DSH Gate Receipt -> 市场决策 -> 用户明确确认安装
```

| 层 | 主要责任 | DSH Gate 的边界 |
| --- | --- | --- |
| Harness Runtime | 加载和运行插件 | 不替代 Runtime |
| 插件目录和市场 | 发现、排序和分发 | 使用验证证据，不拥有目录 |
| Desktop | 本地 UI 和 Profile 管理 | 使用 Provider 数据，不负责静默安装 |
| Forge/开发环境 | 创建、测试和隔离开发 | 验证产物，不复制真实 Profile |
| DSH Gate | 兼容性、权限、平台和来源证据 | 本仓库负责范围 |

插件作者在 Pull Request 中使用 Action；市场或 Desktop 可以在展示安装按钮前消费同一
Receipt 派生的 `pass`、`warn`、`fail`。普通用户不需要单独安装 DSH Gate。

## 本地开发和 CLI

npm registry 目前还没有发布 `dsh-gate`，因此下面是仓库源码用法，不是全局安装命令：

```sh
npm install
npm run build
node dist/cli/main.js verify fixtures/public/healthy-plugin --smoke
node dist/cli/main.js verify https://github.com/owner/plugin --dsh-version 0.1.0-rc.7 --json receipt.json
node dist/cli/main.js verify https://github.com/owner/monorepo --path packages/plugin --json receipt.json
node dist/cli/main.js matrix matrix-targets.json --concurrency 4
```

默认基线为 `0.1.0-rc.7`，对应公开 DSH 标签 `dsh-v0.1.0-rc.7`。
远程 GitHub API 达到匿名限额时，可以在环境中设置只读 `GITHUB_TOKEN`；它不会写入
Receipt。

## Monorepo

当仓库根目录不是插件时，DSH Gate 会扫描 `packages/`、`plugins/` 和 `apps/`。
只发现一个候选插件时自动选择；发现多个候选时直接失败，不会静默猜测。

```sh
node dist/cli/main.js verify https://github.com/owner/repository --ref main --path packages/plugin
node dist/cli/main.js verify https://github.com/owner/repository/tree/main/packages/plugin
```

GitHub Receipt 会记录请求 ref、解析后的 commit SHA、`package.json` 路径和 blob SHA、
仓库数字 ID、SPDX License 以及 archived 状态。远程源码只作为数据读取，不执行仓库代码。

## 兼容性矩阵和 Desktop Provider

[`matrix-targets.json`](matrix-targets.json) 是一组可审查的社区插件目标。
生成的 [`catalog/`](catalog/) 是公开证据和 Desktop Provider 预览，不是完整市场。

当前 GitHub Pages 能把 `manifest.json` 返回为 JSON，但扩展名为空的 `/v1/plugins`
仍返回 `application/octet-stream`，Desktop 会拒绝。不要把当前 Pages manifest 加进
Desktop。

为支持 `_headers` 的静态主机生成部署工件：

```sh
npm run build:provider-site -- https://provider.example/dsh-gate
```

默认输出到被忽略的 `artifacts/provider-site/`，包含 `manifest.json`、`v1/plugins`、
`_headers` 和 `.nojekyll`。生成成功不等于线上响应合约通过；部署后必须验证：

```sh
npm run verify:provider -- https://provider.example/dsh-gate/manifest.json
```

只有匿名 HTTPS 验证和 Desktop 实际消费都通过后，才能向用户公开该 manifest URL。

## 结果边界

- `pass`：选定基线和平台上的静态合约检查通过；不是安全背书。
- `warn`：存在需要维护者复核或补充声明的证据；工作流默认继续。
- `fail`：安装合约或所选兼容性条件不成立；工作流默认失败。

`fail` 条目会保留在矩阵中，市场不能把未解决结果静默转换成推荐。

## 公开与私有边界

公开仓库可以包含源码、Schema、测试、脱敏 Fixture、CI 规则和公开 Release Receipt。
不得提交 API Key、签名证书、`.env`、真实 `~/.dsh` Profile、用户对话、私有插件源码，
或包含机器绝对路径的原始日志。

详见 [SECURITY.md](SECURITY.md)、[CONTRIBUTING.md](CONTRIBUTING.md) 和
[发布策略](docs/release-policy.md)。

## 当前状态

当前版本为 `v0.4.0-alpha.3`。GitHub Action、兼容性矩阵、Desktop 1.0.0 线协议
Schema、严格合约测试和 fail-closed Provider smoke 已完成。符合 JSON 媒体类型的线上
Provider、npm 发布和独立外部插件采用仍是单独的发布门禁，尚未完成时不会宣称可用。

## License

MIT，见 [LICENSE](LICENSE)。
