// ───────────────────────────────────────────────────────────────────────────
// Fremdes Material traegt bis aufs Blatt (Bedarfe 67 und 82, beide P2).
//
// WAS DIE BEIDEN BEDARFE SAGEN — dieselbe Sache aus zwei Rollen:
//
//   > Sub-hired gear arrives with the supplier's own e-mail, PDF PO and
//   > delivery note — outside the job file. Asset tools have no
//   > rented-vs-owned concept.                                    (Bedarf 67)
//
//   > at check-in the sub-hired item is a stranger: it goes back to the wrong
//   > supplier, goes back late (billing another week), or sits in the
//   > warehouse for a month.                                      (Bedarf 82)
//
// UND SIE SAGEN, WO DIE GRENZE LIEGT. Bedarf 82: „The achievable win is a flag
// on the inventory unit, NOT A SUPPLIER PORTAL. The corpus is right that
// sub-hire remains e-mail and that formalising it has defeated every ERP; mark
// ownership and return date inside the job and stop there."
//
// Hier entsteht deshalb kein Bestellwesen. Es entsteht: ein Datum am Artikel,
// ein Text, der ueberall mitfaehrt, und die eine Frage, an der das Geld haengt.
//
// ─── WAS BEDARF 67 ALS AUFGABE NENNT ───────────────────────────────────────
//
//   > packages/inventory-core ALREADY HAS ownership: owned/rented/subhire plus
//   > supplier — make sure it SURVIVES INTO every printed pack list, case
//   > label and check-in screen.
//
// Genau so war der Stand: `ownership` und `supplier` stehen seit langem im
// Modell und im Lager-Dialog, und keins der drei genannten Blaetter trug sie.
// Die Packliste gruppierte sogar nach MODELL ALLEIN — eigenes und fremdes
// Material desselben Typs fielen damit in dieselbe Zeile, und die Herkunft war
// nicht verloren, sondern strukturell nicht darstellbar.
//
// ─── DER SCHADEN IST NICHT DER VERLUST ─────────────────────────────────────
//
//   > The failure mode is not losing sub-hire gear, IT IS KEEPING IT THREE
//   > WEEKS TOO LONG.
//
// Deshalb ist `overdueSubhire` kein Nebenprodukt, sondern der Zweck. Ein
// Blatt, das sagt „Sub-Hire", ohne zu sagen „seit vier Tagen faellig", nennt
// die Tatsache und verschweigt die Rechnung.
//
// REIN: keine Uhr (der Stichtag kommt von aussen), kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { InventoryItem, InventoryOwnership } from '../types/inventory'

/** Kanonisches Deutsch fuer Blaetter — dieselbe Regel wie `deliveryIssueText`:
 *  der Stand eines Dokuments wird aus seinem Inhalt gerechnet, uebersetzte
 *  Zeilen ergaeben je Sprache einen anderen Stand. */
export const OWNERSHIP_LABEL: Record<InventoryOwnership, string> = {
  owned: 'Eigen',
  rented: 'Gemietet',
  subhire: 'Sub-Hire',
}

/** Traegt dieser Artikel fremdes Material? `undefined` gilt als eigenes:
 *  der Bestand ist alt und die meisten Positionen sind es auch. */
export const isForeign = (item: { ownership?: InventoryOwnership }): boolean =>
  item.ownership === 'rented' || item.ownership === 'subhire'

export type SubhireStatus =
  /** Eigenes Material — nichts zurueckzugeben. */
  | 'owned'
  /** Fremd, aber ohne Rueckgabedatum: die Frage ist offen, nicht beantwortet. */
  | 'no-date'
  /** Fremd, Datum liegt in der Zukunft. */
  | 'due'
  /** Fremd, Datum ist erreicht oder ueberschritten. */
  | 'overdue'

/**
 * Der Zustand eines Artikels in Bezug auf die Rueckgabe.
 *
 * `no-date` ist ein eigener Zustand und kein `due` mit leerem Datum: fremdes
 * Material ohne Termin ist genau das Stueck, das drei Wochen zu lange steht,
 * und ein Blatt, das es wie terminiertes behandelt, verschweigt das.
 */
export const subhireStatus = (
  item: { ownership?: InventoryOwnership; returnDue?: string },
  heute: string,
): SubhireStatus => {
  if (!isForeign(item)) return 'owned'
  const due = (item.returnDue ?? '').trim()
  if (!due) return 'no-date'
  // ISO-Datumsvergleich als Zeichenkette: `2026-09-12` < `2026-09-13`. Kein
  // `Date`, weil eine Zeitzone hier nichts zu suchen hat — der Stichtag ist
  // ein Kalendertag, kein Zeitpunkt.
  return due <= heute ? 'overdue' : 'due'
}

/**
 * Der Zusatz, der auf JEDEM Blatt neben der Position steht.
 *
 * Leer fuer eigenes Material — sonst traegt jede Zeile jeder Liste ein
 * „Eigen", und der Hinweis, auf den es ankommt, geht darin unter.
 */
export const ownershipNote = (
  item: { ownership?: InventoryOwnership; supplier?: string; returnDue?: string },
  heute: string,
): string => {
  const status = subhireStatus(item, heute)
  if (status === 'owned') return ''
  const teile: string[] = [OWNERSHIP_LABEL[item.ownership as InventoryOwnership]]
  const lieferant = (item.supplier ?? '').trim()
  // Ohne Lieferant steht es DA und wird nicht weggelassen: „es geht zurueck,
  // aber wir wissen nicht wohin" ist die Auskunft, die jemand braucht.
  teile.push(lieferant || 'Lieferant unbekannt')
  if (status === 'no-date') teile.push('kein Rueckgabedatum')
  else if (status === 'overdue') teile.push(`zurueck seit ${item.returnDue}`)
  else teile.push(`zurueck ${item.returnDue}`)
  return teile.join(' · ')
}

export interface OverdueLine {
  itemId: string
  model: string
  quantity: number
  supplier: string
  /** Leer bei `no-date`. */
  returnDue: string
  status: Extract<SubhireStatus, 'overdue' | 'no-date'>
}

/**
 * Was zurueckmuss und noch da ist.
 *
 * Fuehrt BEIDE Faelle: das ueberfaellige und das undatierte. Das zweite
 * wegzulassen waere die bequemere Liste und die falsche — undatiertes fremdes
 * Material ist genau das, was drei Wochen zu lange steht.
 *
 * Sortiert: ueberfaellig zuerst, darin das aelteste Datum zuerst, dann die
 * undatierten. Wer die Liste von oben abarbeitet, spart das meiste Geld.
 */
export const overdueSubhire = (items: InventoryItem[], heute: string): OverdueLine[] => {
  const out: OverdueLine[] = []
  for (const it of items) {
    const status = subhireStatus(it, heute)
    if (status !== 'overdue' && status !== 'no-date') continue
    out.push({
      itemId: it.id,
      model: it.model,
      quantity: it.quantity,
      supplier: (it.supplier ?? '').trim(),
      returnDue: status === 'overdue' ? (it.returnDue ?? '') : '',
      status,
    })
  }
  return out.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1
    if (a.status === 'overdue' && a.returnDue !== b.returnDue) {
      return a.returnDue.localeCompare(b.returnDue)
    }
    return a.model.localeCompare(b.model, 'de') || a.itemId.localeCompare(b.itemId)
  })
}
