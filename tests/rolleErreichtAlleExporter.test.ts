import { describe, expect, it } from 'vitest'
import atemDialogSrc from '../src/renderer/components/Atem/AtemDialog.tsx?raw'
import videohubDialogSrc from '../src/renderer/components/Export/VideohubExportDialog.tsx?raw'
import exportVideohubSrc from '../src/renderer/lib/exportVideohub.ts?raw'

// ───────────────────────────────────────────────────────────────────────────
// Kein zweiter Ausgabeweg, der die Rolle nicht kennt.
//
// WARUM ES DAS GIBT. B-28 war nicht "ein Exporter vergass die Rolle", sondern
// "fuenf Wege lasen denselben Portnamen, und keiner davon die Rolle": Vorschau,
// .txt, Label-PDF, TCP-Push und die Tabelle in der Oberflaeche. Repariert
// wurden alle fuenf, indem sie EINE Aufloesung lesen.
//
// Damit ist die Reparatur genau so haltbar wie die naechste hinzugefuegte
// Zeile. Dieselbe Sitzung hat das schon einmal gemessen (B-29): die
// Port-Beschriftung war auf eine Stelle zusammengezogen, mit Guard -- und der
// Guard globte `src/renderer/**`, waehrend `src/mobile/` danebenlag und roh
// `{p.name}` rendere. Eine Engstelle ohne Pruefung ist eine Absichtserklaerung.
//
// DIE REGEL. In den drei Dateien, die Videohub-/ATEM-Labels erzeugen, darf
// `portDisplayLabel(` nur dort stehen, wo auch die Rollen-Karte gelesen wird.
// Wer bewusst daran vorbei will, schreibt den Grund als Marke an die Stelle
// (`B-28: Ausgang, keine Rolle`) -- nicht in eine Ausnahmeliste in diesem
// Test. Eine Liste hier waere der Kenntnisstand von heute; die Marke steht
// dort, wo jemand sie beim Schreiben der Zeile liest.
// ───────────────────────────────────────────────────────────────────────────

const DATEIEN: Array<[string, string]> = [
  ['components/Atem/AtemDialog.tsx', atemDialogSrc],
  ['components/Export/VideohubExportDialog.tsx', videohubDialogSrc],
  ['lib/exportVideohub.ts', exportVideohubSrc],
]

const MARKE = 'B-28: Ausgang, keine Rolle'

/**
 * Reine Kommentarzeilen fallen raus; der Rest bleibt MIT Zeilennummern
 * stehen. `stripComments` waere hier falsch: die Marke IST ein Kommentar,
 * und ein Strippen verschoebe ausserdem die Nummern gegen die Rohdatei --
 * gemessen an genau dieser Stelle, die Meldung zeigte Zeile 142 fuer eine
 * Zeile, die in der Datei bei 146 steht.
 */
const istKommentar = (zeile: string): boolean =>
  /^\s*(\/\/|\*|\/\*)/.test(zeile)

describe('Jeder Label-Ausgabeweg liest die Rollen-Karte', () => {
  it.each(DATEIEN)('%s', (_name, quelle) => {
    const roh = quelle.split('\n')

    const verstoesse: string[] = []
    roh.forEach((zeile, i) => {
      if (istKommentar(zeile)) return
      if (!zeile.includes('portDisplayLabel(')) return
      if (zeile.includes('roleLabels')) return
      // Marke an der Zeile selbst oder in den zwei Zeilen darueber.
      const umfeld = roh.slice(Math.max(0, i - 2), i + 1).join('\n')
      if (umfeld.includes(MARKE)) return
      verstoesse.push(`Zeile ${i + 1}: ${zeile.trim()}`)
    })

    expect(
      verstoesse,
      `portDisplayLabel() ohne Rollen-Karte. Entweder die Karte lesen ` +
        `(\`roleLabels.get(port.id) ?? portDisplayLabel(port)\`) oder — wenn ` +
        `der Port wirklich keine Quell-Rolle haben kann — die Marke ` +
        `"${MARKE}" mit Begruendung danebenschreiben.`,
    ).toEqual([])
  })

  it('die Marke misst etwas — sie kommt genau einmal vor', () => {
    // Gegenprobe gegen die bequeme Reparatur: wer den Guard mit Marken
    // zuschuettet, macht ihn wertlos. Faellt diese Zeile, ist die Frage nicht
    // "Zahl erhoehen", sondern "warum hat der dritte Ausgang keine Rolle".
    const treffer = DATEIEN.reduce(
      (n, [, quelle]) => n + quelle.split(MARKE).length - 1,
      0,
    )
    expect(treffer).toBe(1)
  })

  it('die Rollen-Karte kommt aus der Ableitung, nicht aus einer zweiten Kopie', () => {
    for (const [name, quelle] of DATEIEN) {
      if (!quelle.includes('roleLabels')) continue
      const importiertKarte = /import \{[^}]*roleLabelsByPort[^}]*\} from/.test(quelle)
      if (name === 'lib/exportVideohub.ts') {
        // Rein: bekommt die Karte durchgereicht, baut sie nicht. Der
        // Doku-Kommentar dort NENNT `roleLabelsByPort` -- deshalb wird auf
        // die Import-Anweisung geprueft, nicht auf das blosse Vorkommen.
        expect(importiertKarte, `${name} baut die Karte selbst`).toBe(false)
        continue
      }
      expect(importiertKarte, `${name} baut die Karte selbst statt sie abzuleiten`).toBe(true)
    }
  })
})
