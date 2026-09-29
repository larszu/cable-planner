// Alle Handbuch-Bilder neu aufnehmen — jeder Bereich, beide Sprachen,
// nacheinander (parallele Electron-Instanzen verdrängen sich gegenseitig).
//
//   npm run build && node scripts/handbuch/aufnehmen.mjs [bereich …]

import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BEREICHE = join(dirname(fileURLToPath(import.meta.url)), 'bereiche')
const wahl = process.argv.slice(2)
const skripte = readdirSync(BEREICHE)
  .filter((f) => f.endsWith('.mjs'))
  .filter((f) => wahl.length === 0 || wahl.includes(f.replace(/\.mjs$/, '')))

const fehlgeschlagen = []
for (const f of skripte) {
  for (const sprache of ['de', 'en']) {
    console.log(`── ${f} ${sprache}`)
    try {
      execFileSync(process.execPath, [join(BEREICHE, f), sprache], { stdio: 'inherit', timeout: 20 * 60_000 })
    } catch (e) {
      fehlgeschlagen.push(`${f} ${sprache}: ${e.message.split('\n')[0]}`)
    }
  }
}

if (fehlgeschlagen.length) {
  console.log('FEHLGESCHLAGEN:\n' + fehlgeschlagen.join('\n'))
  process.exitCode = 1
}
