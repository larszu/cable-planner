// ───────────────────────────────────────────────────────────────────────────
// Schaden mit Zuordnung (Bedarf 68, P2).
//
// WAS DER BEDARF SAGT:
//
//   > Damage evidence is photos in a WhatsApp thread plus a paper condition
//   > form; the load-out list was ticked in the dark or does not exist. With
//   > 24-hour reporting windows commonly cited, an undocumented load-out
//   > becomes an UNCHARGED, UNATTRIBUTABLE loss.
//
//   > Damage capture belongs on the device already in their hand AT CHECK-IN,
//   > and the valuable field is THE ATTRIBUTION (job, person, time,
//   > container), not the photo. Feeds the invoice-or-absorb decision
//   > directly.
//
// Beleg: grokability/snipe-it#13153 (2023-06, offen, zuletzt 2025-10) — der
// Wunsch, dass ein Reparatur-Datensatz festhaelt, WEM das Geraet zugeordnet
// war und WO es stand, ausdruecklich „to see whether particular
// people/locations tend to break devices more often".
//
// ─── WARUM DIE ZUORDNUNG NICHT AM SCHADEN HAENGT ───────────────────────────
//
// `CheckoutDamage` traegt nur die Zeile und den Text. Job, Person, Zeit und
// Container stehen im VORGANG, an dem der Schaden haengt. Sie dort noch einmal
// zu speichern ergaebe vier Felder, die von der ersten Korrektur am Vorgang an
// falsch waeren — und ein Beleg, der sich selbst widerspricht, ist keiner.
//
// Diese Datei leitet sie deshalb ab. Das ist der ganze Trick: der Bedarf nennt
// die Zuordnung „the valuable field", und sie kostet kein einziges
// gespeichertes Byte.
//
// ─── WAS HIER NICHT ENTSTEHT ───────────────────────────────────────────────
//
// Keine Schuldzuweisung. Die Auswertung nach Person und Ort ist das, was der
// Beleg woertlich verlangt, und sie sagt „hier haeuft es sich" — nicht „der
// war es". Ein Werkzeug, das aus drei Vorfaellen ein Urteil macht, wird beim
// vierten nicht mehr gefuettert, und dann ist die Datenlage schlechter als
// vorher.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CheckoutRecord } from '../types/checkout'
import type { CsvCell, CsvTable } from './csv'

export interface DamageEntry {
  recordId: string
  /** Was beschaedigt ist. */
  label: string
  /** Etiketten-Code, wenn das Objekt einen traegt. */
  code?: string
  note: string
  // ── Die Zuordnung, abgeleitet aus dem Vorgang ────────────────────────────
  /** Die Show, wenn sie benannt war. Leer, wenn nicht — und das steht dann da. */
  job: string
  /** An wen ausgegeben war (Person, Truck, Kunde). */
  person: string
  /** Der Container, in dem es unterwegs war. */
  container: string
  /** Zeitpunkt der Rueckgabe (ISO), also wann der Schaden aufgenommen wurde. */
  at: string
}

const UNBEKANNT = 'nicht benannt'

/**
 * Alle Schaeden aller abgeschlossenen Vorgaenge, mit ihrer Zuordnung.
 *
 * Neueste zuerst: wer das Fenster oeffnet, will wissen, was gerade
 * zurueckkam — die Rechnung dafuer geht diese Woche raus.
 */
export const damageEntries = (records: CheckoutRecord[]): DamageEntry[] => {
  const out: DamageEntry[] = []
  for (const r of records) {
    for (const d of r.in?.damaged ?? []) {
      out.push({
        recordId: r.id,
        label: d.line.label,
        ...(d.line.code ? { code: d.line.code } : {}),
        note: d.note,
        // Fehlt eine Angabe, steht das DA statt wegzufallen. „Wir wissen nicht,
        // auf welcher Show" ist die Auskunft, die den naechsten Vorgang
        // besser macht; eine leere Zelle ist keine.
        job: r.out.projectName?.trim() || UNBEKANNT,
        person: r.out.to.trim() || UNBEKANNT,
        container: r.nodeLabel,
        at: r.in?.at ?? '',
      })
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at) || a.label.localeCompare(b.label, 'de'))
}

export interface DamageTally {
  key: string
  count: number
}

/**
 * Wo es sich haeuft — nach Person oder nach Container.
 *
 * Genau die Frage aus dem Beleg: „to see whether particular people/locations
 * tend to break devices more often". Die Antwort ist eine ZAEHLUNG, kein
 * Urteil; wer daraus eine Schuld macht, hat die Zahl missverstanden.
 *
 * Ohne Vorfaelle eine leere Liste — und der Aufrufer zeigt dann nichts, statt
 * „0 Schaeden" zu melden.
 */
export const damageTally = (
  records: CheckoutRecord[],
  nach: 'person' | 'container' | 'job',
): DamageTally[] => {
  const zaehler = new Map<string, number>()
  for (const e of damageEntries(records)) {
    const k = nach === 'person' ? e.person : nach === 'container' ? e.container : e.job
    zaehler.set(k, (zaehler.get(k) ?? 0) + 1)
  }
  return [...zaehler.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'de'))
}

/**
 * Das Blatt fuer die Entscheidung „berechnen oder tragen".
 *
 * Der Bedarf nennt sie beim Namen („feeds the invoice-or-absorb decision
 * directly"), und dafuer braucht sie genau diese Spalten: was, woran, wem,
 * wann. Kanonisches Deutsch, weil das Blatt einen Stand traegt.
 */
export const damageTable = (records: CheckoutRecord[]): CsvTable => ({
  headers: ['Zurueck am', 'Objekt', 'Etiketten-Code', 'Schaden', 'Show', 'Ausgegeben an', 'Container'],
  rows: damageEntries(records).map((e): CsvCell[] => [
    e.at.slice(0, 10),
    e.label,
    e.code ?? 'kein Etikett',
    e.note,
    e.job,
    e.person,
    e.container,
  ]),
})
