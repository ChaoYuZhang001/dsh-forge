# DSH Gate adoption path

DSH Gate is useful when it is placed in an existing DSH workflow. It is not a
replacement for a plugin market, a Desktop shell, or the DSH installer.

## Who uses it

DSH Gate has three different consumers. They should not be described as one
generic end user:

1. Plugin authors add the Action and receive a compatibility, permission, and
   provenance Receipt on every pull request.
2. Market and Desktop operators consume the Provider manifest and page, then
   decide how a `pass`, `warn`, or `fail` result affects their own install UI.
3. Desktop users consume the evidence through that market UI. They do not need
   to install DSH Gate, and DSH Gate never changes their profile.

The first useful adoption loop is therefore one independent plugin repository
using the Action plus one independent market or Desktop consumer reading the
Provider. Broad end-user promotion comes after those two integrations exist.

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
      - uses: ChaoYuZhang001/dsh-gate@v0.4.0-alpha.3
        with:
          target: ${{ github.event.pull_request.head.repo.html_url || github.event.repository.html_url }}
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          smoke: 'false'
          github-token: ${{ github.token }}
```

The workflow selects the exact public pull-request head or pushed commit, so the
Receipt records immutable commit and package-blob provenance without checking
out or executing plugin code. The check is intentionally advisory for `warn`
and blocking for `fail`. A project can keep the Receipt artifact while
disabling uploads if its own CI retention policy requires that.

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

The included workflow calls the same site builder, deploys its artifact, and
then runs the anonymous HTTPS smoke used for release verification. The current
Provider deployment status and its open hosting gate are tracked in the
[Chinese release status](release-status.zh-CN.md). Use a host or edge
configuration that can set `Content-Type: application/json`; do not weaken the
Desktop contract or rename the standard endpoint to make a static host pass.

Prepare a static site artifact from the repository root:

```sh
npm ci --ignore-scripts
npm run build:provider-site -- https://provider.example/dsh-gate
```

The default output is `artifacts/provider-site/`. The builder accepts only a
credential-free HTTPS base URL without a query or fragment and only writes to a
child of the ignored `artifacts/` directory. It parses both catalog documents,
rewrites `transport.endpoint` to the exact `<base-url>/v1/plugins` contract,
and emits a Cloudflare Pages `_headers` file that declares both documents as
`application/json; charset=utf-8` with `nosniff`.

For Cloudflare Pages, use the same command as the project build command and set
the build output directory to `artifacts/provider-site`. Replace the example
base URL with the final public Pages URL before deploying. This repository does
not contain Cloudflare credentials and does not claim a Cloudflare deployment;
the generated artifact is only a prepared deployment option.

After deployment, verify it from outside the hosting control plane:

```sh
npm run verify:provider -- https://provider.example/dsh-gate/manifest.json
```

Only after that command passes and Desktop has consumed the same URL should an
operator share the manifest URL. In Desktop, the intended opt-in path is the
Community Market source screen: add a standard source, enter the verified
manifest URL, review it, and explicitly enable it. Do not use the current
GitHub Pages URL for this step because its extensionless response still has the
wrong media type.

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

For the practical promotion sequence, ready-to-use announcement copy, and
explicit "do not claim yet" boundaries, see the
[Chinese launch and adoption kit](launch-kit.zh-CN.md).

For the first public launch, report those integration counts and links rather
than catalog size. A useful launch example shows one failing or warning plugin
before the fix, the code change that resolves the result, and the passing
Receipt produced by the Action. That demonstrates a prevented compatibility or
permission problem; a screenshot of a large catalog does not.

## Current boundary

The repository contains a reviewable static preview and a verified Desktop
contract fixture. npm publication, a live HTTPS Provider, and an external
plugin adopting the Action are separate release steps; their current evidence
and state are maintained in the [Chinese release status](release-status.zh-CN.md)
and the linked GitHub issues.
