# Contributing to CablePlanner

Thanks for taking the time to contribute! 🎛️ CablePlanner is an
offline-first broadcast cable-planning desktop app (Electron + React +
TypeScript). This guide covers how to get set up, the conventions we
follow, and how to get a change merged.

## Code of Conduct

This project ships a [Code of Conduct](CODE_OF_CONDUCT.md). By
participating you agree to uphold it. Please report unacceptable
behaviour to **lars@zumpe.dev**.

## Ways to contribute

- 🐛 **Report a bug** — open a [bug report](https://github.com/larszu/cable-planner/issues/new/choose).
- 💡 **Request a feature** — open a [feature request](https://github.com/larszu/cable-planner/issues/new/choose).
- 🌍 **Improve translations** — German is the source language, English is
  the maintained translation (see *i18n* below).
- 🔧 **Send a pull request** — bug fixes, features, docs, tests.

## Development setup

**Prerequisites:** [Node.js](https://nodejs.org/) 20+ (CI builds on
Node 24) and npm.

```bash
git clone https://github.com/larszu/cable-planner.git
cd cable-planner
npm install

# Run the full Electron shell with hot-reload
npm run dev

# Renderer-only in a plain browser (desktop features inert) → localhost:5173
npm run dev:renderer
```

See [`docs/architecture.md`](docs/architecture.md) for the process model,
IPC channels, store/slice architecture and the **non-negotiable
invariants** — please read it before touching `main/`, the store, or the
project-file schema.

## Before you open a pull request

Run these locally — CI enforces the same gates:

```bash
# 1. Type-check must report 0 errors
npx tsc -p tsconfig.app.json --noEmit

# 2. Lint must pass
npm run lint

# 3. Production build must succeed
npm run build
```

> The TypeScript baseline is clean. Don't introduce new type errors.

## Commit & branch conventions

- **Branches:** feature branches off `main` (the harness uses
  `claude/<topic>`; humans can use `feat/<topic>`, `fix/<topic>`, …).
- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/)
  prefixes — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `i18n:`.
  - First line ≤ 72 chars, describing *what* changes. Add an issue
    reference `(#NNN)` when applicable.
  - German or English subject lines are both fine (the codebase is
    German); use English when the subject already needs English terms.
- **Pull-request title** = a meaningful summary of the whole PR
  (`<area>: <what changes> (#issue)`), **not** the branch slug. List the
  issues it closes in the body (`Closes #X, #Y`).

## Internationalisation (i18n)

- German strings are the **source language** and the always-present
  fallback: `t('key', 'Deutsche Form')`.
- Add the English translation to the `en` dictionary in
  `src/renderer/lib/i18n.ts`.
- Keep DE/EN in parity — there's a check script under `docs/i18n-check.mjs`.

## Reporting security issues

Please **do not** open public issues for vulnerabilities. See
[SECURITY.md](SECURITY.md) for the private disclosure process.

---

Not sure where to start? Open an issue describing what you'd like to do
and we'll help scope it. 🙌
