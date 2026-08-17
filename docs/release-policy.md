# Release policy

## Public artifacts

Source, schemas, tests, sanitized fixtures, generated documentation, checksums, and SBOMs may be public. Release tags must match the package version, for example `v0.1.0-alpha.1`.

## Protected material

Signing certificates, npm publishing credentials, API keys, private plugin fixtures, enterprise configuration, and unreleased vulnerability details stay outside Git. CI secrets belong in GitHub Actions Secrets; they are never written into logs or committed files.

## Release gates

Every release must pass `npm test`, secret scanning, package-content inspection, and a clean fixture verification. Releases are created from tags only. Unsigned desktop artifacts, when eventually added, must be labeled unsigned.
