# Contributing

## Development

```sh
npm install
npm test
```

Pull requests should add or update tests for verifier behavior. Public fixtures must be synthetic, licensed for redistribution, and free of credentials and user data.

## Pull request boundary

- Keep changes focused; do not rewrite generated or unrelated files.
- Never add `.env`, credentials, certificates, real DSH profiles, or raw logs.
- Do not execute arbitrary plugin install scripts in CI.
- Describe the DSH baseline and platform used for new compatibility behavior.
- A green CI run is evidence for the covered checks, not a security endorsement.
