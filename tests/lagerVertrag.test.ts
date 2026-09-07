import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { stripComments } from './support/stripComments'

// ---------------------------------------------------------------------------
// DIE TUER ZUM LAGER IST EINE TUER UND KEIN VORHANG (ADR-006).
//
// ADR-006 schneidet „Lager & Logistik" aus dem Planer heraus und nennt die
// Reihenfolge ausdruecklich: erst die Fragen, dann das Paket, dann das Repo.
// `src/renderer/lager/index.ts` ist Schritt eins und zwei — die abschliessende
// Liste dessen, was der Plan das Lager fragt.
//
// EINE SOLCHE LISTE HAELT NUR, WENN SIE GEMESSEN WIRD. Der Vertrag ist eine
// Datei mit Re-Exports; niemand merkt, wenn die naechste Komponente wieder
// `../../store/inventoryStore` importiert, weil das genauso gut funktioniert.
// Nach drei solchen Importen ist der Umzug wieder ein Grossumbau, und zwar
// unbemerkt — genau die Sorte Verfall, gegen die ADR-006 Punkt 2 geschrieben
// ist („Bricht dabei etwas, bricht es sichtbar und an einer Stelle").
//
// WARUM DIE DOMAENE HIER AUFGEZAEHLT STEHT und nicht gerechnet wird: Die
// Zugehoerigkeit eines Moduls zum Lager ist eine ENTSCHEIDUNG, keine
// Messgroesse. `handoverPackage.ts` heisst „Uebergabe" und ist
// Festinstallation; `actionItems.ts` liest das Lager und gehoert dem Plan;
// `mergeDefined` ist in der Lager-Datei entstanden und ist trotzdem
// allgemein. Ein Automatismus ueber Dateinamen oder Import-Ketten haette alle
// drei falsch einsortiert. Was hier gerechnet wird, ist die Einhaltung —
// welche Datei welchen Import traegt, und das ist eine Tatsache.
//
// Wer ein Modul zur Domaene hinzufuegt, traegt es in DOMAENE ein; wer eines
// herausnimmt, streicht es. Beides ist eine bewusste Handlung mit einem Diff.
// ---------------------------------------------------------------------------

const WURZEL = resolve(__dirname, '..', 'src', 'renderer')
const TUER = 'lager/index.ts'

/**
 * Die Lager-Domaene, wie ADR-006 sie schneidet — 21 Rechenmodule, zwei
 * Stores, drei Typdateien, die Oberflaeche.
 */
const DOMAENE = new Set([
  'lib/assetIdentity.ts',
  'lib/containerCheckout.ts',
  'lib/custodyPeriod.ts',
  'lib/damageRegister.ts',
  'lib/erpReconcile.ts',
  'lib/faultHistory.ts',
  'lib/handoverSignature.ts',
  'lib/inventoryAudit.ts',
  'lib/inventoryCommitment.ts',
  'lib/inventoryCoverage.ts',
  'lib/inventoryMerge.ts',
  'lib/inventoryPortable.ts',
  'lib/inventoryPrint.ts',
  'lib/inventoryReport.ts',
  'lib/inventoryScan.ts',
  'lib/ownership.ts',
  'lib/packList.ts',
  'lib/planBom.ts',
  'lib/storageMoves.ts',
  'lib/storageTree.ts',
  'lib/unitIdentity.ts',
  'store/inventoryStore.ts',
  'store/checkoutStore.ts',
  'store/storageMoveStore.ts',
  'types/inventory.ts',
  'types/checkout.ts',
  'types/storageMove.ts',
  'components/Inventory/InventoryDialog.tsx',
  'components/Inventory/ScannerModal.tsx',
])

const dateien = (dir: string): string[] => {
  const out: string[] = []
  for (const eintrag of readdirSync(dir)) {
    const voll = join(dir, eintrag)
    if (statSync(voll).isDirectory()) out.push(...dateien(voll))
    else if (/\.tsx?$/.test(eintrag)) out.push(voll)
  }
  return out
}

const IMPORT = /(?:import|export)\s+(?:type\s+)?(?:[\w*{][^;]*?\s+from\s+)?['"](\.[^'"]+)['"]/g

/** Welches Domaenen-Modul meint dieser relative Import — oder keines? */
const zielInDerDomaene = (datei: string, ziel: string): string | null => {
  const roh = resolve(join(datei, '..'), ziel)
  for (const endung of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    const kandidat = relative(WURZEL, roh + endung).split(sep).join('/')
    if (DOMAENE.has(kandidat)) return kandidat
  }
  return null
}

interface Verstoss {
  datei: string
  ziel: string
}

const verstoesse = (): Verstoss[] => {
  const gefunden: Verstoss[] = []
  for (const voll of dateien(WURZEL)) {
    const rel = relative(WURZEL, voll).split(sep).join('/')
    if (rel === TUER) continue
    if (DOMAENE.has(rel)) continue
    if (rel.startsWith('lager/')) continue
    const quelle = stripComments(readFileSync(voll, 'utf8'))
    for (const treffer of quelle.matchAll(IMPORT)) {
      const ziel = zielInDerDomaene(voll, treffer[1])
      if (ziel) gefunden.push({ datei: rel, ziel })
    }
  }
  return gefunden
}

describe('Der Lager-Vertrag ist die einzige Tuer (ADR-006)', () => {
  it('kein Modul ausserhalb der Domaene greift an der Tuer vorbei', () => {
    const offen = verstoesse()
    const text = offen.map((v) => `${v.datei} -> ${v.ziel}`).sort()
    expect(text).toEqual([])
  })

  it('die Domaene ist vollstaendig aufgezaehlt — jede genannte Datei existiert', () => {
    // Ein Tippfehler in DOMAENE macht den Test still wirkungslos: das Modul
    // faellt aus der Menge, und jeder Import darauf gilt als erlaubt.
    const fehlend = [...DOMAENE].filter((rel) => {
      try {
        return !statSync(join(WURZEL, rel)).isFile()
      } catch {
        return true
      }
    })
    expect(fehlend).toEqual([])
  })

  it('die Tuer rechnet nicht selbst', () => {
    // ADR-006 Punkt 4: „Nichts wird zweimal gerechnet." Der Vertrag reicht
    // durch — er hat kein Recht, aus Bestand und Bedarf selbst eine Zahl zu
    // machen, denn diese Zahl gaebe es dann zweimal. Erlaubt sind
    // Re-Exports und die duennen Store-Haken.
    const quelle = stripComments(
      readFileSync(join(WURZEL, TUER), 'utf8'),
    )
    // Kein Schleifen-, Rechen- oder Verzweigungs-Konstrukt.
    expect(quelle).not.toMatch(/\bfor\b|\bwhile\b|\.map\(|\.filter\(|\.reduce\(/)
    expect(quelle).not.toMatch(/\bif\s*\(/)
  })

  it('jeder Store-Haken liest genau einen Selektor', () => {
    // Ein Haken, der ein frisches Objekt zurueckgibt (`{ items, units }`),
    // zeichnet jede lesende Komponente bei JEDER Store-Aenderung neu — der
    // Vertrag waere dann nicht kostenlos, sondern eine Bremse. Deshalb: ein
    // Feld je Haken, dieselbe Referenz wie vorher.
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
