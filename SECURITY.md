# Security Policy

## Supported versions

CablePlanner is shipped as desktop installers via
[GitHub Releases](https://github.com/larszu/cable-planner/releases).
Security fixes are made against the latest release line.

| Version | Supported          |
| ------- | ------------------ |
| 8.x     | :white_check_mark: |
| < 8.0   | :x:                |

Always run the [latest release](https://github.com/larszu/cable-planner/releases/latest).

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub
issues, discussions, or pull requests.**

Instead, report them privately via either:

1. **GitHub Security Advisories** — use the
   [*Report a vulnerability*](https://github.com/larszu/cable-planner/security/advisories/new)
   button on the repository's **Security** tab (preferred), or
2. **Email** — **lars@zumpe.dev** with the subject line
   `SECURITY: cable-planner`.

Please include:

- a description of the issue and its impact,
- steps to reproduce (proof-of-concept if possible),
- affected version(s) and platform (macOS / Windows),
- any suggested mitigation.

You can expect an initial acknowledgement within **5 business days**.
We'll keep you updated on the fix and coordinate a disclosure timeline
with you. Please give us reasonable time to release a fix before any
public disclosure.

## Security model notes

CablePlanner is **offline-first** and designed to limit exposure:

- Projects are plain local JSON files; nothing is uploaded by default.
- External integrations (Rentman, ATEM, Videohub, LAN mobile view) are
  **opt-in**.
- The Rentman API token is stored encrypted in the OS keychain
  (via `keytar`) — **no credentials are stored in source code or in
  project files**.
- The optional mobile build-day viewer serves over the **local network
  only**.

## Notes on installers

Releases are built in GitHub Actions. macOS DMGs are **ad-hoc signed**
(no paid Apple Developer certificate), so first launch shows the standard
"unidentified developer" prompt — right-click → **Open** to run.
Windows builds are unsigned and may trigger SmartScreen. Verify you
downloaded from the official
[releases page](https://github.com/larszu/cable-planner/releases).
