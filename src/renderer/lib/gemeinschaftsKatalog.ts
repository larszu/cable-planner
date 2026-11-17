// ───────────────────────────────────────────────────────────────────────────
// ERZEUGT von `scripts/library-fetch.mjs` — nicht von Hand aendern.
// Lauf: `npm run library:fetch` · Veraltet? `npm run library:fetch:check`
//
// Geraete, die die GEMEINSCHAFT in der Bibliothek angelegt und bestaetigt hat
// (Status `confirmed` oder besser). Sie liegen hier eingecheckt, damit jede
// Installation sie bekommt — auch ohne Konto und offline. Wer angemeldet ist,
// bekommt ueber den Abgleich im Programm ausserdem den tagesaktuellen Stand.
//
// Was aus DIESEM Repo stammt, steht hier NICHT: es stuende sonst zweimal im
// Katalog. `gemeinschaft` haelt fest, woher ein Eintrag kommt.
//
// Noch leer: der erste Lauf braucht den Schluessel aus dem Repo-Secret und
// laeuft deshalb in `library-sync.yml`, nicht auf einem Entwicklerrechner.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment.ts'

export const gemeinschaftsTemplates: readonly EquipmentTemplate[] = []
