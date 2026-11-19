// ───────────────────────────────────────────────────────────────────────────
// ERZEUGT von `scripts/library-fetch.mjs` — nicht von Hand aendern.
// Lauf: `npm run library:fetch` (naechtlich in `library-fetch.yml`).
//
// Geraete, die die GEMEINSCHAFT in der Bibliothek angelegt und bestaetigt hat
// (Status `confirmed` oder besser). Sie liegen hier eingecheckt, damit jede
// Installation sie bekommt — auch ohne Konto und offline. Wer angemeldet ist,
// bekommt ueber den Abgleich im Programm ausserdem den tagesaktuellen Stand.
//
// Was aus DIESEM Repo stammt, steht hier NICHT: es stuende sonst zweimal im
// Katalog. `libraryRef` haelt fest, woher ein Eintrag kommt.
//
// Quelle: https://devices.zumpelars.de
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment.ts'

export const gemeinschaftsTemplates: readonly EquipmentTemplate[] = []
