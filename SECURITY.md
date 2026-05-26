# Security Policy

## Reporting A Vulnerability

Please report security issues through GitHub private vulnerability reporting for this repository:

https://github.com/radustefandumitru/AgenticSupercharge/security/advisories/new

Use private reporting for anything involving installer behavior, supply-chain risk, path traversal, unintended file deletion, secret exposure, or writes outside the documented skill/instruction roots.

Please do not open a public issue for a vulnerability until there is a fix or a coordinated disclosure decision.

## Scope

In scope:

- `install.sh`, `update.sh`, `uninstall.sh`, `verify.sh`
- `bin/agentic-supercharge.js`
- `lib/installer.js`
- public docs, manifest source definitions, and packaged local skills

Out of scope:

- Bugs or malicious content in upstream third-party skill repositories
- Personal MCP configs, API keys, OAuth sessions, browser profiles, or local tool credentials
- User-modified forks or private local snapshots not present in the public repository

## Security Model

AgenticSupercharge is non-destructive by default. It installs skills into documented roots, writes managed instruction blocks between explicit markers, and marks managed skill folders with `.agentic-supercharge.json`.

Default installs use verified pinned source refs and pinned package versions. Users can opt into live upstream refs and latest package specs with `--allow-upstream-drift`.
