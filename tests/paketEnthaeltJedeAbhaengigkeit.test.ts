// ───────────────────────────────────────────────────────────────────────────
// Jedes Paket, das der Main-Prozess zur Laufzeit verlangt, steht auch in
// `dependencies`.
//
// WARUM ES DAS GIBT. `src/main/signalingServer.ts:165` macht
// `require('ws')` — und `ws` stand weder in `dependencies` noch in
// `devDependencies` (gemessen 2026-09-05). Im Installer war es trotzdem
// enthalten, aber nur aus Versehen: `y-webrtc` zieht es transitiv mit, und
// electron-builder verpackt den ganzen Produktions-Baum. Fiele diese
// transitive Kante weg (ein y-webrtc-Update, ein anderer WebSocket-Client),
// waere der LAN-Signaling-Relay im ausgelieferten Build tot — mit einem
// `Cannot find module 'ws'` erst beim Klick auf „Zusammenarbeit starten",
// nicht beim Bauen.
//
// In der Suite ist derselbe Fall bereits eingetreten: `apps/shell` verpackt
// Cables Main-Prozess mit, hat aber `y-webrtc` gar nicht als Abhaengigkeit —
// dort fehlte `ws` im Paket wirklich.
//
// WIE ER PRUEFT. Er liest die Quellen unter `src/main/` (nicht `dist/`, damit
// er ohne Build laeuft), sammelt jeden nackten Import-/Require-Namen und
// verlangt, dass er in `dependencies` steht. Node-Builtins und relative Pfade
// fallen raus; `devDependencies` zaehlen NICHT — electron-builder verpackt nur
// den Produktions-Baum, ein Dev-Eintrag waere im Installer nicht vorhanden.
//
// WAS ER NICHT PRUEFT: den Renderer. Der wird von Vite gebuendelt, dort landet
// alles im Bundle und eine fehlende Deklaration faellt schon beim Bauen auf.
// Hier geht es um den Prozess, der zur Laufzeit `require` sagt.
// ───────────────────────────────────────────────────────────────────────────
import { builtinModules } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const paket = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const BUILTIN = new Set([...builtinModules, 'electron'])

/** Paketname aus einem Import-Spezifizierer: `@scope/pkg/sub` -> `@scope/pkg`. */
const paketName = (spez: string): string =>
  spez.startsWith('@') ? spez.split('/').slice(0, 2).join('/') : spez.split('/')[0]

type Fund = { paket: string; datei: string }

const nackteImporte = (verzeichnis: string): Fund[] => {
  const funde: Fund[] = []
  const lauf = (d: string) => {
    for (const eintrag of readdirSync(d)) {
      const pfad = join(d, eintrag)
      if (statSync(pfad).isDirectory()) {
        lauf(pfad)
        continue
      }
      if (!/\.(ts|cts|mts|js|cjs|mjs)$/.test(eintrag)) continue
      const inhalt = readFileSync(pfad, 'utf8')
      const treffer = [
        ...inhalt.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g),
        ...inhalt.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
        ...inhalt.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
      ]
      for (const t of treffer) {
        const spez = t[1]
        if (spez.startsWith('.') || spez.startsWith('node:')) continue
        const name = paketName(spez)
        if (BUILTIN.has(name)) continue
        funde.push({ paket: name, datei: relative(ROOT, pfad) })
      }
    }
  }
  lauf(verzeichnis)
  return funde
}

describe('der Installer enthaelt jedes Paket, das main zur Laufzeit braucht', () => {
  const funde = nackteImporte(join(ROOT, 'src', 'main'))

  it('findet ueberhaupt Importe', () => {
    // Ein leerer Suchlauf ist gruen und wertlos — etwa nach einem Umbau der
    // Verzeichnisstruktur.
    expect(new Set(funde.map((f) => f.paket)).size).toBeGreaterThan(3)
  })

  it('jedes davon steht in dependencies', () => {
    const deps = paket.dependencies ?? {}
    const fehlend = [...new Map(funde.filter((f) => !deps[f.paket]).map((f) => [f.paket, f])).values()]
    expect(
      fehlend.map((f) => `${f.paket}  (verlangt in ${f.datei})`),
      'Diese Pakete verlangt der Main-Prozess zur Laufzeit, aber sie stehen nicht in ' +
        '`dependencies`. Im Installer sind sie dann hoechstens zufaellig vorhanden — ' +
        'als transitive Abhaengigkeit von etwas anderem. Faellt die Kante weg, bricht ' +
        'die Funktion erst beim Nutzer, nicht beim Bauen.',
    ).toEqual([])
  })

  it('keines davon steckt nur in devDependencies', () => {
    // Der haeufigste Weg, den Test „zu beruhigen": ins falsche Feld eintragen.
    // electron-builder verpackt nur den Produktions-Baum — im Installer fehlte
    // das Paket dann weiterhin, und der Test waere gruen.
    const dev = paket.devDependencies ?? {}
    const deps = paket.dependencies ?? {}
    const falsch = [...new Set(funde.map((f) => f.paket))].filter((n) => dev[n] && !deps[n])
    expect(falsch, 'Gehoert nach `dependencies`, nicht `devDependencies`.').toEqual([])
  })
})
