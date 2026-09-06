// ───────────────────────────────────────────────────────────────────────────
// Bedarf 28 — der Abgleich gegen die ERP-Reservierung, in BEIDE Richtungen.
//
// DER BEFUND benennt die Frage, die tatsaechlich gestellt wird:
//
//   > Equipment gets typed into the quote, the technical plan, the ERP
//   > reservation, the pick list, the truck list, the sub-hire PO, the
//   > check-in list and the invoice. The PM's real question is never „what
//   > does my plan contain" but „WHAT DOES MY PLAN CONTAIN THAT THE ERP
//   > PROJECT DOES NOT, and which side changed since we last agreed?"
//
// Und die Bedarfs-Datenbank sagt, was daraus folgt: „The valuable increment
// is the DIFF, not more export." Der Cable-Planner konnte bis hierher
// exportieren und importieren — beides in eine Richtung. Was fehlte, war die
// Gegenueberstellung.
//
// ─── DIE DREI ZEILEN, DIE NICHT ZAEHLEN ────────────────────────────────────
//
// Eine Rentman-Reservierung enthaelt mehr als Geraete, und jede dieser Zeilen
// mitzuzaehlen macht JEDEN Abgleich falsch:
//
//   `comment`      Eine Textzeile („Aufbau ab 8 Uhr"). Kein Geraet.
//   `isSetChild`   Der Inhalt einer Kombination — im Elternteil schon gezaehlt.
//                  Beides zu zaehlen verdoppelt das halbe Projekt.
//   Menge 0        Eine Zeile, die auf null gesetzt wurde, ist gestrichen.
//
// ─── WIE ZUGEORDNET WIRD ───────────────────────────────────────────────────
//
// Dieselbe Ordnung wie beim Lager-Resolver (`inventoryCoverage`) und beim
// Netz-Abgleich (`networkReconcile`): erst die Tatsache, dann der Vorschlag,
// und sonst gar nichts.
//
//   1. Ueber `rentmanId` am Plan-Geraet — das ist die Bruecke, die der Import
//      gesetzt hat, und damit eine TATSACHE.
//   2. Ueber den normalisierten Namen — ein VORSCHLAG, und er wird als solcher
//      ausgewiesen.
//
// EIN NAME, DER ZWEIMAL VORKOMMT, ORDNET NICHTS ZU. Dieselbe Regel wie bei
// `reconcileNetwork`: wo beide Seiten nicht eindeutig sind, ist die Zuordnung
// geraten, und eine geratene Zuordnung im Handelsabgleich kostet echtes Geld
// — sie erklaert eine Position fuer vorhanden, die es nicht ist.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { DemandLine } from './inventoryCoverage'
import { normaliseName } from './inventoryCoverage'
import type { EquipmentItem } from '../types/equipment'
import type { CsvCell, CsvTable } from './csv'

/**
 * Was dieser Abgleich von einer ERP-Zeile braucht.
 *
 * Strukturell und nicht als Import aus `components/Rentman/`: eine Bibliothek
 * darf nicht von einer Komponente abhaengen. `RentmanEquipment` passt darauf,
 * ohne dass eine der beiden Seiten die andere kennt.
 */
export interface ErpLine {
  /** Rentman-Geraete-Id (nicht die Zeilen-Id). */
  equipmentId: string
  name: string
  qty: number
  kind: 'device' | 'virtual' | 'physical' | 'comment'
  isSetChild: boolean
}

export type ErpVerdict =
  /** Beide Seiten haben es, in gleicher Menge. */
  | 'matched'
  /** Beide haben es, die Mengen weichen ab. */
  | 'quantity-differs'
  /** Der Plan verlangt es, die Reservierung kennt es nicht. */
  | 'only-in-plan'
  /** Reserviert, aber im Plan nicht verlangt. */
  | 'only-in-erp'

export type ErpBasis =
  /** Ueber `rentmanId` — eine Tatsache. */
  | 'rentman-id'
  /** Ueber den Namen — ein Vorschlag. */
  | 'name'
  /** Kein Gegenstueck. */
  | 'none'
  /** Der Name kommt mehrfach vor; zuordnen hiesse raten. */
  | 'ambiguous'

export interface ErpRow {
  verdict: ErpVerdict
  basis: ErpBasis
  label: string
  /** Menge laut Plan. `undefined`, wenn der Plan die Position nicht kennt. */
  planQty?: number
  /** Menge laut Reservierung. `undefined`, wenn sie sie nicht kennt. */
  erpQty?: number
}

export interface ErpReport {
  rows: ErpRow[]
  onlyInPlan: number
  onlyInErp: number
  differing: number
  /** Zeilen der Reservierung, die bewusst nicht gezaehlt wurden, mit Grund. */
  ignored: { label: string; reason: string }[]
}

/**
 * Zeilen der Reservierung, die ein Geraet sind — und die Begruendung fuer
 * jede, die es nicht ist. Die Begruendung wird MITGELIEFERT und nicht
 * verworfen: eine Reservierung mit vierzig Zeilen, von denen der Abgleich
 * zwoelf stillschweigend weglaesst, laesst niemanden nachvollziehen, warum
 * die Summe nicht stimmt.
 */
const teilen = (erp: ErpLine[]): { geraete: ErpLine[]; ignored: ErpReport['ignored'] } => {
  const geraete: ErpLine[] = []
  const ignored: ErpReport['ignored'] = []
  for (const l of erp) {
    if (l.kind === 'comment') {
      ignored.push({ label: l.name, reason: 'Kommentarzeile, kein Geraet' })
      continue
    }
    if (l.isSetChild) {
      ignored.push({ label: l.name, reason: 'Inhalt einer Kombination, im Elternteil gezaehlt' })
      continue
    }
    if (!(l.qty > 0)) {
      ignored.push({ label: l.name, reason: 'Menge 0 — gestrichene Zeile' })
      continue
    }
    geraete.push(l)
  }
  return { geraete, ignored }
}

/**
 * Wie oft ein Name vorkommt. Gezaehlt und nicht bloss gefiltert: „kommt
 * zweimal vor" und „kommt gar nicht vor" sind zwei verschiedene Auskuenfte,
 * und wer die Doppelten vorher wegwirft, kann sie nicht mehr auseinander
 * halten. Genau daran ist die erste Fassung dieser Datei gescheitert — sie
 * meldete den mehrdeutigen Namen als „kein Gegenstueck".
 */
const nameCount = <T>(items: T[], key: (t: T) => string): Map<string, number> => {
  const zaehler = new Map<string, number>()
  for (const it of items) zaehler.set(key(it), (zaehler.get(key(it)) ?? 0) + 1)
  return zaehler
}

/**
 * Plan gegen Reservierung.
 *
 * `equipment` wird gebraucht, um von einer Bedarfszeile auf die
 * `rentmanId` ihrer Plan-Geraete zu kommen — das ist die Bruecke, die der
 * Import gesetzt hat.
 */
export const reconcileErp = (
  demand: DemandLine[],
  equipment: EquipmentItem[],
  erp: ErpLine[],
): ErpReport => {
  const { geraete, ignored } = teilen(erp)

  const erpById = new Map(geraete.map((l) => [l.equipmentId, l]))
  const erpNamen = nameCount(geraete, (l) => normaliseName(l.name))
  const planNamen = nameCount(demand, (d) => normaliseName(d.label))
  const eqById = new Map(equipment.map((e) => [e.id, e]))

  const rows: ErpRow[] = []
  const getroffen = new Set<string>()

  for (const d of demand) {
    // (1) Die Tatsache: eine `rentmanId` an einem der Plan-Geraete dieser
    //     Zeile. Sie stammt aus dem Import und ist keine Vermutung.
    const ids = new Set(
      d.equipmentIds.map((id) => eqById.get(id)?.rentmanId).filter((v): v is string => !!v),
    )
    let treffer: ErpLine | undefined
    let basis: ErpBasis = 'none'
    for (const id of ids) {
      const l = erpById.get(id)
      if (l) {
        treffer = l
        basis = 'rentman-id'
        break
      }
    }

    // (2) Der Vorschlag: der Name, aber nur wenn er auf BEIDEN Seiten
    //     eindeutig ist. Sonst ist die Zuordnung geraten.
    if (!treffer) {
      const name = normaliseName(d.label)
      const imErp = erpNamen.get(name) ?? 0
      const imPlan = planNamen.get(name) ?? 0
      if (imErp === 1 && imPlan === 1) {
        treffer = geraete.find((l) => normaliseName(l.name) === name)
        basis = 'name'
      } else if (imErp > 1 || (imErp === 1 && imPlan > 1)) {
        // Es GIBT ein Gegenstueck, nur nicht eindeutig. Das ist eine andere
        // Auskunft als „gibt es nicht" -- und die brauchbarere: sie sagt, wo
        // ein Mensch hinschauen muss.
        basis = 'ambiguous'
      }
    }

    if (!treffer) {
      rows.push({ verdict: 'only-in-plan', basis, label: d.label, planQty: d.quantity })
      continue
    }
    getroffen.add(treffer.equipmentId)
    rows.push({
      verdict: treffer.qty === d.quantity ? 'matched' : 'quantity-differs',
      basis,
      label: d.label,
      planQty: d.quantity,
      erpQty: treffer.qty,
    })
  }

  // Die andere Richtung — der halbe Bedarf, den ein reiner Export nie zeigt:
  // reserviert und bezahlt, aber im Plan nicht verlangt.
  for (const l of geraete) {
    if (getroffen.has(l.equipmentId)) continue
    rows.push({ verdict: 'only-in-erp', basis: 'none', label: l.name, erpQty: l.qty })
  }

  rows.sort(
    (a, b) => RANG[a.verdict] - RANG[b.verdict] || a.label.localeCompare(b.label, 'de'),
  )

  return {
    rows,
    onlyInPlan: rows.filter((r) => r.verdict === 'only-in-plan').length,
    onlyInErp: rows.filter((r) => r.verdict === 'only-in-erp').length,
    differing: rows.filter((r) => r.verdict === 'quantity-differs').length,
    ignored,
  }
}

/** Was zuerst zu klaeren ist, steht oben: fehlendes Material vor
 *  Mengenabweichung vor Ueberzaehligem vor dem, was stimmt. */
const RANG: Record<ErpVerdict, number> = {
  'only-in-plan': 0,
  'quantity-differs': 1,
  'only-in-erp': 2,
  matched: 3,
}

const URTEIL: Record<ErpVerdict, string> = {
  'only-in-plan': 'nur im Plan',
  'quantity-differs': 'Menge weicht ab',
  'only-in-erp': 'nur in der Reservierung',
  matched: 'stimmt',
}

const BASIS: Record<ErpBasis, string> = {
  'rentman-id': 'ueber Rentman-Id (Tatsache)',
  name: 'ueber den Namen (Vorschlag)',
  none: '',
  ambiguous: 'Name mehrfach — nicht zugeordnet',
}

/** Der Abgleich als Blatt. Kanonisches Deutsch — er wandert als CSV. */
export const erpReconcileTable = (report: ErpReport): CsvTable => ({
  headers: ['Befund', 'Position', 'Plan', 'Reservierung', 'Zuordnung'],
  rows: report.rows.map((r): CsvCell[] => [
    URTEIL[r.verdict],
    r.label,
    r.planQty ?? '',
    r.erpQty ?? '',
    BASIS[r.basis],
  ]),
})
