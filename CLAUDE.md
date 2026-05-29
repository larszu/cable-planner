# Cable Planner — Agent Guidance

Dieses Dokument hält fest, was bei automatisierten Beiträgen
(Claude Code) im Cable-Planner-Repo immer gilt. Es ergänzt den
System-Prompt und überschreibt nichts, was dort schon steht.

## Git-Workflow

### Branch-Namen

- Werden vom Harness gesetzt (Form `claude/<topic>`), nicht änderbar
  pro Session. Egal welcher Branch-Name landet — der **PR-Titel ist
  die maßgebliche Beschreibung** (siehe unten), nicht der Branch.

### Commit-Messages

- **Sprache**: Deutsch ist OK (gesamte Codebase + ARCHITECTURE.md
  sind deutsch). Englisch nur wenn der Subject schon englische
  Begriffe braucht (z. B. `fix(canvas): ReactFlow drag-end race`).
- **Form**: Conventional-Commit-Prefix (`feat:`, `fix:`, `chore:`,
  `docs:`, `refactor:`, `i18n:`) — bestehende History folgt dem.
- **Erste Zeile**: ≤ 72 Zeichen, beschreibt was sich ändert. Issue-
  Referenz `(#NNN)` am Ende wenn ein Issue gemeint ist.
- **Body**: kurze Bullet-Liste was tatsächlich passiert ist + warum.
- **Kein Trailer mehr**: die `https://claude.ai/code/session_...`
  Zeile am Ende war Habit aus dem System-Prompt-Default. **Ab jetzt
  weglassen** — sie macht das git-log unleserlich und ist für
  Außenstehende ohne Wert.

### Pull-Requests

Wenn ich PRs anlege (egal ob direkt oder du es manuell tust), gelten
diese Defaults damit der Merge-Commit auf `main` brauchbar ist:

- **PR-Titel** = aussagekräftige Zusammenfassung **des ganzen PRs**,
  nicht der Branch-Slug. Form: `<bereich>: <was sich ändert> (#issue)`
  - Gut: `i18n: complete English coverage + bilingual categories (#321)`
  - Schlecht: `Claude/cable connector type inheritance v5 v zu`
    (das ist der GitHub-Default aus dem Branch-Name — niemals so
    lassen!)
- **PR-Body**: kurze Übersicht der Sub-Änderungen + Liste der
  Issue-Nummern die geschlossen werden (`Closes #X, #Y`).

### GitHub Repo-Setting (einmalig manuell)

GitHub baut die Merge-Commit-Message standardmäßig aus dem
Branch-Slug. Das ist der Grund warum `main` heute `Claude/cable
connector type inheritance v5 v zu`-Messages hat. Einmalig ändern:

> Settings → General → Pull Requests → "Allow merge commits" →
> **Default commit message** auf **"Pull request title"** (oder
> "Pull request title and description") umstellen. Optional dasselbe
> für "Allow squash merging" wenn squash benutzt wird.

Danach ziehen die obigen PR-Titel-Conventions automatisch in die
Merge-Commits.

## Was nicht in den Commits stehen soll

- Generierte `https://claude.ai/code/session_...` Trailer
- "Co-authored by Claude" Trailer
- "Generated with..." Footnotes

## Author / Commit-Identität

Aktuell sind alle Bot-Commits unter `Claude <noreply@anthropic.com>`
authored, weil der Harness das global gesetzt hat. Falls du das
ändern willst, ist das **nicht über CLAUDE.md** möglich — der Author
kommt aus `git config user.name/email` im Sandbox-Container, das
müsste der Harness setzen. Workaround: nach dem Merge auf `main` ein
lokales `git commit --amend --author="Lars Zumpe <…>"` wenn dir das
wichtig ist.

## Sonstige Konventionen

- TS check vor jedem Push: `npx tsc -p tsconfig.app.json --noEmit`
  muss 0 Errors zeigen (alle 5 Baseline-Errors sind in commit
  `f87623a` gefixt — keine neuen einführen).
- i18n: Deutsche Strings = Quell-Sprache, immer als Fallback in
  `t(key, 'Deutsche Form')`. EN-Übersetzung im `en`-Dict in
  `src/renderer/lib/i18n.ts`.
- Architektur-Invarianten + Wo-was-hingehört siehe
  [`docs/architecture.md`](docs/architecture.md).
