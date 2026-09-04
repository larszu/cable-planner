# Dokumentation — Übersicht

Diese Seite ist das Inhaltsverzeichnis für `docs/`. Sie existiert, weil bis zum
2026-09-04 **zwölf von dreizehn** Dokumenten in diesem Ordner von keiner
Einstiegsseite aus verlinkt waren — auch nicht
[`self-hosted-relay.md`](self-hosted-relay.md), also ausgerechnet die Seite, die
jemand sucht, wenn die Zusammenarbeit über Mobilfunk nicht zustande kommt. Ein
Dokument, das nur findet, wer den Ordner durchblättert, ist praktisch nicht
vorhanden. `tests/dokuErreichbar.test.ts` hält das jetzt fest: jedes Dokument
unter `docs/` muss von einer Einstiegsseite aus über Links erreichbar sein.

## Betrieb & Einrichtung

- [`self-hosted-relay.md`](self-hosted-relay.md) — eigener Signaling-Relay und
  eigener TURN-Server für die Live-Zusammenarbeit über Mobilfunk oder zwischen
  zwei Netzen. Enthält die coturn-Einrichtung und das Eingabeformat der
  STUN-/TURN-Zeilen im Collab-Panel.

## Für Entwicklung

- [`architecture.md`](architecture.md) — Drei-Prozess-Modell, IPC-Domänen,
  Store-Aufbau, Build/Release und die nicht-verhandelbaren Invarianten.
  **Pflicht-Lektüre vor strukturellen Änderungen.**
- [`app-structure.html`](app-structure.html) — interaktive Modulübersicht
  (im Browser öffnen).
- [`comparison.html`](comparison.html) — Strukturvergleich mit kommerziellen und
  frei verfügbaren Alternativen.
- [`monorepo-plan.md`](monorepo-plan.md) — die Begründung hinter
  `av-planner-suite`; der Monorepo ist inzwischen umgesetzt.

## Domänen-Konzepte

Diese Dokumente begründen, warum ein Bereich so gebaut ist, wie er gebaut ist.
Der Status steht jeweils im Kopf des Dokuments — mehrere sind vollständig
umgesetzt und stehen hier als Begründung, nicht als Vorhaben.

- [`device-identity-concept.md`](device-identity-concept.md) — stabile
  Gerätetyp-Identität (Datenblatt-GUID) statt Namens-Heuristik.
- [`inventory-rental-readiness.md`](inventory-rental-readiness.md) — Lager- und
  Inventarverwaltung für Festinstallation und Vermietung.
- [`festinstallation-readiness.md`](festinstallation-readiness.md) — was fehlt,
  damit der Planer dauerhafte Festinstallationen dokumentiert statt nur
  Show-Verkabelung.
- [`drum-micing-and-field-builder-concept.md`](drum-micing-and-field-builder-concept.md)
  — Drum-Mikrofonierung und der Feld-Builder der Audio-Domäne.
- [`modular-ui-concept.md`](modular-ui-concept.md) — wie die Oberfläche mitwächst,
  ohne zur eierlegenden Wollmilchsau zu werden.

## Bestandsaufnahmen

Momentaufnahmen mit Datum. Sie werden nicht fortgeschrieben — wer sie liest,
liest den Stand des genannten Tages.

- [`ui-audit.md`](ui-audit.md) — UI/UX-Bestandsaufnahme und Härtungs-Tracker.
- [`ux-audit.md`](ux-audit.md) — Renderer-weite UX-Durchsicht (2026-05-29).
- [`issue-verification-2026-06.md`](issue-verification-2026-06.md) — 320
  geschlossene Issues gegen den Quellcode nachgeprüft (2026-06-22).

## Material

- [`screenshots/README.md`](screenshots/README.md) — Benennung und Aufnahme der
  README-Bilder.
- [`suite-mockup/README.md`](suite-mockup/README.md) — frühe Design-Studie einer
  gemeinsamen App-Shell.
