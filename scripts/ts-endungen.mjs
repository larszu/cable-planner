// ───────────────────────────────────────────────────────────────────────────
// Ein Auflöser für endungslose TS-Importe.
//
// WARUM ES DAS GIBT. `katalog-uebernahme.mjs` liest die Quelldaten der
// Nachbar-Planer, indem es deren Module WIRKLICH IMPORTIERT — nicht, indem es
// ihren Quelltext mit einem Regex ausliest. Ein Regex haette dieselben Daten
// ein zweites Mal interpretiert und waere beim ersten berechneten Eintrag
// falsch gelegen (`rigs.ts` erzeugt acht Jimmy Jibs in einer Schleife).
//
// Diese Module importieren untereinander ohne Dateiendung (`from '../core/patch'`),
// weil Vite das aufloest. Node tut es nicht. Dieser Hook ergaenzt `.ts` und
// `/index.ts` — und NUR das: schlaegt beides fehl, gibt er den Fehler von Node
// zurueck, statt eine dritte Vermutung anzustellen.
// ───────────────────────────────────────────────────────────────────────────
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function resolve(spezifikator, kontext, naechster) {
  if (spezifikator.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(spezifikator)) {
    const basis = kontext.parentURL ? new URL(spezifikator, kontext.parentURL) : null
    if (basis) {
      const pfad = fileURLToPath(basis)
      for (const kandidat of [`${pfad}.ts`, `${pfad}.tsx`, `${pfad}/index.ts`]) {
        if (existsSync(kandidat)) {
          return naechster(pathToFileURL(kandidat).href, kontext)
        }
      }
    }
  }
  return naechster(spezifikator, kontext)
}
