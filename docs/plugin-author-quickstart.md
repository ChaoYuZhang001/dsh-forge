# Plugin author quickstart

This path is for maintainers of public DeepSeek Harness plugin repositories.
It does not install DSH Gate or read a real DSH profile.

## 1. Add the workflow

Copy [`examples/github-actions/dsh-gate.yml`](../examples/github-actions/dsh-gate.yml)
to `.github/workflows/dsh-gate.yml` in the plugin repository:

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

The workflow grants read-only repository contents access. The automatically
provided `github.token` is used only for public GitHub API reads and is never
written to the Receipt. On a pull request, the target expression selects the
public head repository, including a fork, and the head commit SHA. On a push,
it selects the pushed repository and `github.sha`.

## 2. Read the result

The Action adds a table to the workflow Summary and keeps a sanitized
`dsh-gate-receipt.json` artifact for 14 days.

| Result | Meaning | Default workflow behavior |
| --- | --- | --- |
| `pass` | The selected static contract checks passed | Succeeds |
| `warn` | Evidence or an explicit declaration needs review | Succeeds |
| `fail` | The selected baseline or install contract is rejected | Fails |

`pass` is not a security audit. This workflow does not need a checkout. Remote
verification reads repository metadata and the selected `package.json` at the
exact commit as data; it does not execute remote code or run package lifecycle
scripts. The Receipt records the resolved commit and package blob.

## 3. Add a status badge

Replace `OWNER` and `REPOSITORY` after the workflow has run on the default
branch:

```md
[![DSH Gate](https://github.com/OWNER/REPOSITORY/actions/workflows/dsh-gate.yml/badge.svg)](https://github.com/OWNER/REPOSITORY/actions/workflows/dsh-gate.yml)
```

The badge proves only that the referenced workflow completed. Keep the Receipt
available when making a compatibility claim so readers can inspect its DSH
baseline, platform, source commit, package blob, and findings.

## 4. Declare plugin evidence when known

`dsh.gate` is optional alpha metadata. Declare only behavior that has actually
been reviewed; do not copy an empty permission list merely to remove a warning.

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    },
    "gate": {
      "compatibleWith": ">=0.1.0-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.2.0-0",
      "permissions": ["filesystem", "network"],
      "platforms": ["darwin-arm64", "darwin-x64", "linux-x64", "win32-x64"],
      "requiresRestart": false,
      "nativeBinaries": false
    }
  }
}
```

Allowed permission identifiers are `filesystem`, `shell`, `network`,
`secrets`, `subprocess`, and `native`. The declared range must explicitly admit
the DSH prerelease tuple; a broad stable range can still reject an `rc` build
under standard semver rules.

## Monorepositories

Set `package-path` when more than one DSH plugin exists:

```yaml
      - uses: ChaoYuZhang001/dsh-gate@v0.4.0-alpha.3
        with:
          target: ${{ github.event.pull_request.head.repo.html_url || github.event.repository.html_url }}
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          package-path: packages/my-plugin
          smoke: 'false'
          github-token: ${{ github.token }}
```

DSH Gate fails on ambiguous discovery instead of choosing a package silently.

## Request integration help

Maintainers of public plugin repositories can
[open an adoption request](https://github.com/ChaoYuZhang001/dsh-gate/issues/new?template=adoption.yml).
The form requires maintainer authorization and a public repository URL. Do not
include credentials, DSH Profiles, transcripts, private plugin source, or raw
logs with machine paths.
