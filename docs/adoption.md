# DSH Gate adoption path

DSH Gate is useful when it is placed in an existing DSH workflow. It is not a
replacement for a plugin market, a Desktop shell, or the DSH installer.

## Plugin authors

Add the reusable Action to pull requests and pushes. The Action reads the
repository as data, verifies the selected DSH baseline, and writes a sanitized
Receipt artifact. It never reads a real profile and never runs package
lifecycle scripts.

```yaml
name: DSH Gate

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
      - uses: ChaoYuZhang001/dsh-gate@v0.4.0-alpha.1
        with:
          target: .
          github-token: ${{ github.token }}
```

The check is intentionally advisory for `warn` and blocking for `fail`. A
project can keep the Receipt artifact while disabling uploads if its own CI
retention policy requires that.

## Market and Desktop operators

The generated `catalog/` directory is a provider payload, not a complete web
application. The repository includes a GitHub Pages deployment workflow in
`.github/workflows/pages.yml`; the repository administrator must enable Pages
with GitHub Actions as the source before the first deployment. A deployment
must present:

```text
https://<host>/<base>/manifest.json
https://<host>/<base>/v1/plugins
```

The manifest endpoint must declare the second URL, both responses must be
anonymous HTTPS JSON, and the server must return `application/json`. A static
deployment must copy `catalog/manifest.json` to `manifest.json` and
`catalog/v1/plugins` to `v1/plugins` at the site root. Do not publish the
manifest URL to users until those URLs have been checked from the same network
boundary as Desktop.

The included workflow performs that copy and validates both JSON documents, but
it cannot enable Pages or create a custom domain. Those are repository-owner
operations and must be verified separately.

The Desktop host remains responsible for source selection, caching, install
confirmation, and profile changes. DSH Gate only supplies evidence. `FAIL`
entries remain visible so a market cannot silently convert an unresolved result
into an install recommendation.

## Release gates

Before announcing a release or adding the source to a Desktop market:

1. Run `npm ci`, `npm test`, `npm pack --dry-run --ignore-scripts`, and the
   secret-boundary check on a clean candidate commit.
2. Confirm the provider manifest and page against the pinned Desktop schemas.
3. Confirm the provider serves the exact expected content type over HTTPS and
   has no credentials, query strings, redirects to private addresses, or
   remote scripts.
4. Record the source commit, DSH baseline, generated timestamp, and matrix
   counts in the release notes.
5. Keep the first rollout opt-in. Do not make DSH Gate or any partner source a
   default, fallback, or automatic installer.

## Adoption signals

The first useful signals are external and privacy-preserving:

- public plugin repositories adding the Action;
- merged pull requests that keep a Receipt artifact;
- market or Desktop integrations consuming the Provider contract;
- repeated warnings fixed by plugin authors;
- successful verification runs, measured by CI status rather than user content.

GitHub stars and catalog item counts are ecosystem signals, not proof that the
verification layer is being used. The project should not claim adoption until
at least one independent plugin repository and one independent catalog or
Desktop consumer use the output.

## Current boundary

The repository currently contains a reviewable static preview and a verified
Desktop contract fixture. npm publication, a live HTTPS Provider, and an
external plugin adopting the Action are separate release steps and must not be
described as complete until independently verified.
