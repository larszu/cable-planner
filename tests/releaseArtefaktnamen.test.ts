// ───────────────────────────────────────────────────────────────────────────
// Zwei Build-Ziele duerfen nicht auf dieselbe Datei schreiben.
//
// WARUM ES DAS GIBT. Gemessen am Suite-Release v0.1.0 (Lauf 33970319571,
// 2026-09-05): dort steht `artifactName` nur einmal unter `win`, und NSIS und
// Portable erben ihn beide. Im Log steht es woertlich —
//
//   • building  target=nsis     file=release\AV Planner Suite-0.1.0-x64.exe
//   • building  target=portable file=release\AV Planner Suite-0.1.0-x64.exe
//
// — und `ls release/` zeigt danach EINE .exe. Der Portable-Build hat den
// Installer ueberschrieben. Kein Fehler, keine Warnung: electron-builder baut
// beide Ziele brav, das zweite legt sich auf das erste, und im Release haengt
// eine Datei, wo zwei erwartet werden.
//
// Der Cable Planner hat den Zusammenstoss nur deshalb nicht, weil sein
// `portable`-Block einen eigenen Namen setzt. Das ist kein Zustand, auf den
// man sich verlassen sollte — es ist eine Zeile, die jemand einmal geschrieben
// hat und die beim naechsten neuen Ziel fehlt.
//
// WIE ER PRUEFT. Er loest die Namen so auf, wie electron-builder es tut:
// zielspezifischer Block (`nsis.artifactName`, `portable.artifactName`, …)
// schlaegt Plattform-Block (`win.artifactName`), Makros werden eingesetzt, und
// die Endung kommt vom Ziel. Danach muessen alle Namen einer Plattform
// verschieden sein. Gezaehlt wird ueber die Ziele in der Konfiguration, nicht
// ueber eine Liste hier.
//
// WAS ER NICHT PRUEFT: ob die Datei am Ende auch am Release haengt. Das
// entscheidet der Workflow, nicht diese Datei.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import konfiguration from '../electron-builder.js'

/** Endung je Ziel — so benennt electron-builder die Ausgabe. */
const ENDUNG: Record<string, string> = {
  nsis: 'exe',
  portable: 'exe',
  msi: 'msi',
  appx: 'appx',
  dmg: 'dmg',
  zip: 'zip',
  pkg: 'pkg',
  mas: 'pkg',
  AppImage: 'AppImage',
  deb: 'deb',
  rpm: 'rpm',
}

type Ziel = { target: string; arch?: string }
type Block = { target?: (Ziel | string)[]; artifactName?: string }

const konfig = konfiguration as Record<string, unknown> & {
  productName?: string
}

const einsetzen = (vorlage: string, ziel: Ziel): string =>
  vorlage
    .replaceAll('${productName}', konfig.productName ?? 'App')
    .replaceAll('${name}', konfig.productName ?? 'App')
    .replaceAll('${version}', '0.0.0')
    .replaceAll('${arch}', ziel.arch ?? 'x64')
    .replaceAll('${ext}', ENDUNG[ziel.target] ?? ziel.target)
    .replaceAll('${os}', 'os')

const zieleVon = (plattform: string): Ziel[] => {
  const block = konfig[plattform] as Block | undefined
  return (block?.target ?? []).map((z) => (typeof z === 'string' ? { target: z } : z))
}

const namenVon = (plattform: string): { ziel: string; datei: string }[] => {
  const block = konfig[plattform] as Block | undefined
  return zieleVon(plattform).map((ziel) => {
    // Genau die Reihenfolge, die electron-builder anwendet.
    const zielBlock = konfig[ziel.target] as { artifactName?: string } | undefined
    const vorlage =
      zielBlock?.artifactName ??
      block?.artifactName ??
      (konfig.artifactName as string | undefined) ??
      '${productName}-${version}-${arch}.${ext}'
    return { ziel: `${ziel.target}/${ziel.arch ?? 'x64'}`, datei: einsetzen(vorlage, ziel) }
  })
}

describe('kein Build-Ziel ueberschreibt das Artefakt eines anderen', () => {
  const plattformen = ['win', 'mac', 'linux'].filter((p) => zieleVon(p).length > 0)

  it('findet ueberhaupt Ziele', () => {
    // Ein leerer Suchlauf waere gruen und wertlos.
    expect(plattformen.length, 'Keine Build-Ziele in electron-builder.js gefunden.').toBeGreaterThan(0)
    expect(plattformen.flatMap(zieleVon).length).toBeGreaterThan(1)
  })

  for (const plattform of plattformen) {
    it(`${plattform}: jedes Ziel schreibt in eine eigene Datei`, () => {
      const namen = namenVon(plattform)
      const zusammenstoesse = namen
        .filter((a, i) => namen.some((b, j) => i !== j && a.datei === b.datei))
        .map((n) => `${n.ziel} -> ${n.datei}`)
      expect(
        zusammenstoesse,
        'Diese Ziele schreiben auf denselben Dateinamen. electron-builder baut beide ' +
          'ohne Warnung, das spaeter gebaute ueberschreibt das frueher gebaute, und im ' +
          'Release fehlt eines davon. Abhilfe: eigener `artifactName` im Ziel-Block ' +
          '(z. B. `portable: { artifactName: "${productName}-${version}-portable.${ext}" }`).',
      ).toEqual([])
    })
  }
})
