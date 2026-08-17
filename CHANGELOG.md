# Changelog

## 0.4.0-alpha.3 - 2026-08-18

- Added a fail-closed live Provider smoke for HTTPS, JSON media types, response limits, schema conformance, and semantic limits.
- Wired the smoke into the Pages deployment and documented the current extensionless-file MIME incompatibility with Desktop.
- Kept npm publication, profile installation, and a conforming live Provider as separate release gates.

## 0.4.0-alpha.2 - 2026-08-18

- Pinned the DSH Desktop Community Market 1.0.0 source and provider-page schemas to a reviewed Desktop commit.
- Added strict AJV and semantic conformance tests for generated catalog output and hostile provider input.
- Added the plugin-author, market-operator, and release adoption path documentation.
- Added an opt-in GitHub Pages workflow for publishing the catalog Provider after Pages is enabled and its HTTPS responses are verified.
- Kept npm publication, profile installation, and live Provider availability as separate release gates.

## 0.4.0-alpha.1 - 2026-08-18

- Renamed the public package and Action identity to `dsh-gate`.
- Added a deterministic compatibility matrix for a curated list of public DSH plugins.
- Added resolved commit/package provenance, stable counts, Markdown output, and machine-readable matrix schemas.
- Added generated Desktop Community Market Provider manifest and `/v1/plugins` payloads with visible verification status and declared capabilities.
- Pinned the Desktop Community Market 1.0.0 wire schemas with source commit and MIT attribution, and added strict AJV conformance coverage for generated output and hostile provider input.
- Added a scheduled GitHub Actions workflow that uploads matrix and catalog evidence without installing or mutating a DSH profile.
- Kept the catalog payload as an undeployed preview until an HTTPS JSON provider with the required content type is configured.

## 0.3.0-alpha.1 - 2026-08-18

- Added deterministic DSH package discovery under `packages/`, `plugins/`, and `apps/`.
- Added explicit `--path` and GitHub `/tree/<ref>/<package-path>` targeting.
- Added resolved commit SHA, package blob SHA, repository ID, license, archived state, and package path to Receipt schema `0.2`.
- Added GitHub request timeouts and retries for HTTP 429 and transient server failures.
- Added sanitized monorepo fixtures and ambiguity tests; multiple plugin packages require an explicit path.
- Kept remote verification static and never executed repository or package lifecycle code.

## 0.2.0-alpha.1 - 2026-08-18

- Added a reusable GitHub Action with workflow Summary output and a sanitized Receipt artifact.
- Added an Action consumer smoke test that runs the committed distribution without a build step.
- Added success and failure gate coverage plus a release-managed `v0` Action alias.
- Pinned the Receipt artifact uploader to the immutable `v7.0.1` commit.
- Updated repository workflows to the current Node 24-based checkout and setup actions, pinned by commit.
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
