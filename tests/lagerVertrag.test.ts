import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { stripComments } from './support/stripComments'

// ---------------------------------------------------------------------------
// DIE TUER ZUM LAGER IST EINE TUER UND KEIN VORHANG (ADR-006).
//
// ADR-006 schneidet „Lager & Logistik" aus dem Planer heraus und nennt die
// Reihenfolge ausdruecklich: erst die Fragen, dann das Paket, dann das Repo.
// `src/renderer/lager/` ist das Paket, `lager/index.ts` sind die Fragen — die
// abschliessende Liste dessen, was der Plan das Lager fragt.
//
// DIE DOMAENE IST DER ORDNER. Eine Datei gehoert zum Lager, wenn sie unter
// `lager/` liegt — nicht, weil eine Liste in diesem Test sie nennt. Das ist
// der Unterschied zwischen einer Behauptung und einer Tatsache: eine
// aufgezaehlte Domaene faellt beim ersten Tippfehler still auseinander, ein
// Ordner nicht. Wer ein Modul hinzunimmt, verschiebt es; das ist ein Diff, den
// man sieht.
//
// EINE TUER HAELT NUR, WENN SIE GEMESSEN WIRD. Der Vertrag ist eine Datei mit
// Re-Exports; niemand merkt, wenn die naechste Komponente wieder
// `../../lager/store/inventoryStore` importiert, weil das genauso gut
// funktioniert. Nach drei solchen Importen ist der Umzug ins eigene Repo
// wieder ein Grossumbau, und zwar unbemerkt — genau die Sorte Verfall, gegen
// die ADR-006 Punkt 2 geschrieben ist („Bricht dabei etwas, bricht es sichtbar
// und an einer Stelle").
// ---------------------------------------------------------------------------

const WURZEL = resolve(__dirname, '..', 'src', 'renderer')
const LAGER = 'lager'
const TUER = 'lager/index.ts'

const dateien = (dir: string): string[] => {
  const out: string[] = []
  for (const eintrag of readdirSync(dir)) {
    const voll = join(dir, eintrag)
    if (statSync(voll).isDirectory()) out.push(...dateien(voll))
    else if (/\.tsx?$/.test(eintrag)) out.push(voll)
  }
  return out
}

const relativ = (voll: string): string => relative(WURZEL, voll).split(sep).join('/')

const IMPORT = /(?:import|export)\s+(?:type\s+)?(?:[\w*{][^;]*?\s+from\s+)?['"](\.[^'"]+)['"]/g

/** Welche Datei meint dieser relative Import — relativ zu `src/renderer`? */
const zielDatei = (datei: string, ziel: string): string | null => {
  const roh = resolve(join(datei, '..'), ziel)
  for (const endung of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    try {
      if (statSync(roh + endung).isFile()) return relativ(roh + endung)
    } catch {
      /* naechste Endung */
    }
  }
  return null
}

const vorbeiAnDerTuer = (): string[] => {
  const gefunden: string[] = []
  for (const voll of dateien(WURZEL)) {
    const rel = relativ(voll)
    if (rel.startsWith(`${LAGER}/`) || rel === TUER) continue
    const quelle = stripComments(readFileSync(voll, 'utf8'))
    for (const treffer of quelle.matchAll(IMPORT)) {
      const ziel = zielDatei(voll, treffer[1])
      if (ziel && ziel.startsWith(`${LAGER}/`) && ziel !== TUER) {
        gefunden.push(`${rel} -> ${ziel}`)
      }
    }
  }
  return gefunden.sort()
}

describe('Der Lager-Vertrag ist die einzige Tuer (ADR-006)', () => {
  it('kein Modul ausserhalb von lager/ greift an der Tuer vorbei', () => {
    expect(vorbeiAnDerTuer()).toEqual([])
  })

  it('das Lager ist nicht leer und traegt seine Rechenschicht', () => {
    // Ohne diese Zusicherung waere der erste Test auch dann gruen, wenn der
    // Ordner verschwaende: „niemand importiert an der Tuer vorbei" ist bei
    // null Modulen trivial wahr.
    const drin = dateien(join(WURZEL, LAGER)).map(relativ)
    expect(drin.length).toBeGreaterThanOrEqual(25)
    expect(drin).toContain('lager/lib/inventoryCoverage.ts')
    expect(drin).toContain('lager/store/inventoryStore.ts')
    expect(drin).toContain('lager/types/inventory.ts')
    expect(drin).toContain('lager/ui/InventoryDialog.tsx')
  })

  it('die drei bewussten Ausnahmen sind NICHT im Lager', () => {
    // Jede haette man mit einem Blick auf den Namen hineinsortiert; jede
    // waere dann nach dem Umzug aus einem fremden Repo zu holen.
    //
    //   pickFile        generischer Datei-Dialog, fuenf Aufrufer quer durch
    //                   den Planer. Im Lager-Import entstanden, keine
    //                   Lager-Frage.
    //   mergeDefined    „Die Regel ist nicht auf das Lager beschraenkt" —
    //                   steht so in ihrem eigenen Kommentar; templateSlice
    //                   benutzt sie aus demselben Grund.
    //   handoverPackage klingt nach Ausgabeschein, ist das Uebergabe-Paket
    //                   der Festinstallation (die andere Domaene aus
    //                   ADR-006, Issues #665-#667).
    //   actionItems     liest das Lager, gehoert aber dem Plan: es zaehlt
    //                   auch Netz- und Geld-Befunde zusammen.
    for (const bleibt of [
      'lib/pickFile.ts',
      'lib/mergeDefined.ts',
      'lib/handoverPackage.ts',
      'lib/actionItems.ts',
    ]) {
      expect(statSync(join(WURZEL, bleibt)).isFile(), bleibt).toBe(true)
    }
  })

  it('die Tuer rechnet nicht selbst', () => {
    // ADR-006 Punkt 4: „Nichts wird zweimal gerechnet." Der Vertrag reicht
    // durch — er hat kein Recht, aus Bestand und Bedarf selbst eine Zahl zu
    // machen, denn diese Zahl gaebe es dann zweimal. Erlaubt sind
    // Re-Exports und die duennen Store-Haken.
    const quelle = stripComments(readFileSync(join(WURZEL, TUER), 'utf8'))
    expect(quelle).not.toMatch(/\bfor\b|\bwhile\b|\.map\(|\.filter\(|\.reduce\(/)
    expect(quelle).not.toMatch(/\bif\s*\(/)
  })

  it('jeder Store-Haken IST ein Selektor', () => {
    // Ein Haken, der ein frisches Objekt zurueckgibt (`{ items, units }`),
    // zeichnet jede lesende Komponente bei JEDER Store-Aenderung neu — der
    // Vertrag waere dann nicht kostenlos, sondern eine Bremse.
    const quelle = stripComments(readFileSync(join(WURZEL, TUER), 'utf8'))
    const haken = [...quelle.matchAll(/export const (use\w+)([^\n]*)/g)]
    expect(haken.length).toBeGreaterThanOrEqual(4)
    for (const [, name, rumpf] of haken) {
      if (name === 'useTypBestaetigen') continue
      // Verankert am ZEILENENDE: „enthaelt einen Selektor" genuegt nicht —
      // `() => ({ items: useInventoryStore((s) => s.items) })` enthaelt einen
      // und ist trotzdem genau der Haken, der jede Aenderung durchschlagen
      // laesst. Der Rumpf muss der Selektor SEIN.
      expect(rumpf, name).toMatch(/=> use\w+Store\(\(s\) => s\.\w+\)$/)
    }
  })
})
