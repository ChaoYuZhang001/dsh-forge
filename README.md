# DSH Forge

Static compatibility and permission verification for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugins.

> DSH Forge is a community developer tool, not an official DeepSeek product. A passing receipt is not a security audit.

## What it does

DSH Forge checks a plugin before it is installed into a real profile:

- verifies the `dsh.bundle` install contract;
- checks official DSH peer ranges against a selected DSH baseline;
- applies the prerelease rule needed by DSH `rc` versions;
- reads declared and high-signal inferred permissions;
- records source provenance and platform compatibility;
- optionally runs `npm pack --dry-run --ignore-scripts` for a local package;
- emits a normalized JSON Receipt without absolute machine paths or user data.

The alpha never executes plugin lifecycle scripts and does not mutate `~/.dsh`.

## Quick start

```sh
npm install
npm run build
node dist/cli/main.js verify fixtures/public/healthy-plugin --smoke
node dist/cli/main.js verify https://github.com/owner/plugin --dsh-version 0.1.0-rc.7 --json receipt.json
```

The default baseline is `0.1.0-rc.7`, pinned to the public DSH tag `dsh-v0.1.0-rc.7`.

For GitHub API rate limits, set a read-only `GITHUB_TOKEN` in the environment. The token is used only for fetching public `package.json` content and is never written to a Receipt:

```sh
GITHUB_TOKEN=... node dist/cli/main.js verify https://github.com/owner/plugin
```

## Repository boundary

This public repository contains source, schemas, tests, sanitized fixtures, CI rules, and public release receipts. It must not contain API keys, signing certificates, `.env` files, real `~/.dsh` profiles, user transcripts, private plugin sources, or raw logs containing machine paths.

See [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [docs/release-policy.md](docs/release-policy.md).

## Status

`v0.1.0-alpha.1` is an intentionally narrow vertical slice: static verification plus a safe package dry-run. Transactional profile installation, rollback, and the desktop operator will build on this receipt contract in later releases.

## License

MIT. See [LICENSE](LICENSE).
