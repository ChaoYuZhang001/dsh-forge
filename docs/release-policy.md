# Release policy

## Public artifacts

Source, schemas, tests, sanitized fixtures, generated documentation, checksums, SBOMs, Action metadata, and the compiled Action distribution may be public. Release tags must match the package version, for example `v0.3.0-alpha.1`.

## Protected material

Signing certificates, npm publishing credentials, API keys, private plugin fixtures, enterprise configuration, and unreleased vulnerability details stay outside Git. CI secrets belong in GitHub Actions Secrets; they are never written into logs or committed files.

## Release gates

Every release must pass `npm test`, secret scanning, package-content inspection, and a clean fixture verification. Releases are created from tags only. Unsigned desktop artifacts, when eventually added, must be labeled unsigned.

The reusable Action must be tested from committed `dist/` files without a build step. Stable major Action aliases such as `v0` may only be moved after the immutable release tag succeeds; consumers should prefer an immutable full tag or commit SHA.

Third-party Actions used by repository workflows or the reusable Action must be pinned to a full commit SHA with the release version recorded in a comment.
