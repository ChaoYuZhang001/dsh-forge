# Changelog

## 0.2.0-alpha.1 - 2026-08-18

- Added a reusable GitHub Action with workflow Summary output and a sanitized Receipt artifact.
- Added an Action consumer smoke test that runs the committed distribution without a build step.
- Added success and failure gate coverage plus a release-managed `v0` Action alias.
- Pinned the Receipt artifact uploader to the immutable `v7.0.1` commit.
- Made `package.json` the single source for the CLI version and GitHub API User-Agent.
- Added the verifier version to every JSON Receipt for reproducible CI evidence.
- Kept verification static and continued to disable plugin lifecycle scripts.

## 0.1.0-alpha.2 - 2026-08-17

- Fixed cross-platform test discovery on Windows.
- Fixed Windows `npm pack --dry-run` invocation in the local smoke check.
- Kept the alpha receipt contract and static-only execution boundary unchanged.

## 0.1.0-alpha.1 - 2026-08-17

- Added static DSH bundle and peer compatibility verification.
- Added explicit prerelease semver handling for DSH `rc` baselines.
- Added declared and inferred permission findings.
- Added normalized JSON Receipts and local `npm pack --dry-run` smoke checks.
- Added public fixtures, schema, security boundary, and contribution rules.
