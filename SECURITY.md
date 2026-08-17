# Security Policy

## Scope

DSH Forge is a static verifier and packaging smoke tool. It does not execute plugin lifecycle scripts in the alpha and it is not a sandbox or a security audit.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose credentials, execute untrusted code, or bypass a verification boundary. Use GitHub's private security advisory flow for this repository when available. If that flow is unavailable, contact the repository owner through the GitHub profile and include a minimal reproduction without secrets.

Please do not include API keys, cookies, user transcripts, private plugin source, or raw machine paths in a report.

## Public receipts

Receipts must be normalized. Remove absolute paths, environment variables, tokens, prompts, private URLs, and raw command output before publishing them.
