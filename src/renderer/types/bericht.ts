// ───────────────────────────────────────────────────────────────────────────
// DIE FORM EINES BERICHTS (#880).
//
// Spalten ein- und ausblenden, umsortieren, gruppieren, sortieren, filtern —
// und das Ergebnis als Vorlage speichern.
//
// ═══════════════════════════════════════════════════════════════════════════
// SIE ARBEITET AUF `CsvTable` UND NICHT AUF EINEM NEUEN MODELL
// ═══════════════════════════════════════════════════════════════════════════
//
// Neun Listen liefern heute `CsvTable` (`lib/berichtsQuellen.ts`): Kopfzeile
// plus Zeilen. Das IST die gemeinsame Zeilen-/Spalten-Form, nach der #880
// fragt — ein zweites Modell darueber waere eine zweite Beschreibung
// derselben Tabelle, und die erste bliebe trotzdem die, aus der gedruckt
// wird.
//
// Daraus folgt der Zuschnitt: diese Datei nimmt eine `CsvTable` und eine
// Form und gibt eine `CsvTable` zurueck. Vorschau, CSV und Papier bekommen
// DASSELBE Ergebnis, weil es nur eines gibt — das vierte Kriterium aus #880
// („Vorschau entspricht dem Export") ist damit keine Absprache zwischen zwei
// Stellen, sondern eine Eigenschaft des Aufbaus.
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE SPALTE WIRD UEBER IHREN KOPF ANGESPROCHEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Kein Index. Ein Index verrutscht, sobald eine Liste eine Spalte dazwischen
// bekommt — und die Vorlage von gestern blendete danach die falsche aus, ohne
// dass es jemand merkt. Der Kopftext ist das Einzige, was beide Seiten
// kennen.
//
// Der Preis steht dazu: benennt eine Liste ihre Spalte um, findet die Vorlage
// sie nicht mehr. Dann gilt `heileForm` — die unbekannte Spalte faellt aus der
// Vorlage, die neue kommt sichtbar dazu. NICHT unsichtbar: eine Spalte, die
// niemand ausgeblendet hat, ist sichtbar, und eine stillschweigend
// verschwundene Spalte auf einer Ziehliste ist schlimmer als eine zuviel.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS DIE SORTIERUNG NICHT TUT
// ═══════════════════════════════════════════════════════════════════════════
//
// Sie raet keinen Typ. Eine Zelle ist Zahl ODER Text, und `localeCompare` mit
// `numeric: true` bringt „K2" vor „K10", ohne aus „K2" eine Zahl zu machen.
// Eine Spalte mit Laengen sortiert damit richtig, und eine mit Kabelnummern
// auch — ohne dass irgendwo steht, welche von beiden es ist.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CsvCell, CsvTable } from '../lib/csv'

export type Sortierrichtung = 'auf' | 'ab'

export interface Spaltenform {
  /** Der Kopftext der Spalte, wie die Liste ihn liefert. */
  kopf: string
  sichtbar: boolean
}

export interface Sortierschritt {
  kopf: string
  richtung: Sortierrichtung
}

export interface Berichtsform {
  /** Reihenfolge UND Sichtbarkeit. Was hier fehlt, entscheidet `heileForm`. */
  spalten: Spaltenform[]
  /** Nach welcher Spalte gruppiert wird. Leer heisst: eine Tabelle. */
  gruppeNach?: string
  sortierung: Sortierschritt[]
  /** Freitext je Spalte; eine Zeile bleibt, wenn JEDER Filter passt. */
  filter: Record<string, string>
}

/** Eine gespeicherte Form, mit Namen und der Liste, fuer die sie gilt. */
export interface Berichtsvorlage {
  id: string
  name: string
  /** Die Quelle aus `lib/berichtsQuellen.ts`. */
  quelleId: string
  form: Berichtsform
}

export const LEERE_FORM: Berichtsform = { spalten: [], sortierung: [], filter: {} }

/** Die Vorgabe-Form einer Tabelle: alle Spalten sichtbar, nichts sortiert. */
export const formAus = (tabelle: CsvTable): Berichtsform => ({
  spalten: tabelle.headers.map((kopf) => ({ kopf, sichtbar: true })),
  sortierung: [],
  filter: {},
})

/**
 * Die Form auf die Tabelle von heute ziehen.
 *
 * Spalten, die es nicht mehr gibt, fallen aus der Form; neue kommen SICHTBAR
 * ans Ende. Sortierung, Gruppierung und Filter, die auf eine verschwundene
 * Spalte zeigen, fallen ebenfalls weg — sie wuerden sonst stillschweigend
 * nichts tun, und eine Vorlage, die nicht tut, was sie anzeigt, ist schlimmer
 * als eine, die es zugibt.
 */
export const heileForm = (form: Berichtsform, tabelle: CsvTable): Berichtsform => {
  const vorhanden = new Set(tabelle.headers)
  const behalten = form.spalten.filter((s) => vorhanden.has(s.kopf))
  const bekannt = new Set(behalten.map((s) => s.kopf))
  const neu = tabelle.headers
    .filter((h) => !bekannt.has(h))
    .map((kopf) => ({ kopf, sichtbar: true }))
  const spalten = [...behalten, ...neu]
  const filter: Record<string, string> = {}
  for (const [kopf, text] of Object.entries(form.filter)) {
    if (vorhanden.has(kopf) && text.trim()) filter[kopf] = text
  }
  return {
    spalten,
    gruppeNach: form.gruppeNach && vorhanden.has(form.gruppeNach) ? form.gruppeNach : undefined,
    sortierung: form.sortierung.filter((s) => vorhanden.has(s.kopf)),
    filter,
  }
}

const alsText = (zelle: CsvCell): string =>
  zelle === null || zelle === undefined ? '' : String(zelle)

/**
 * Zwei Zellen vergleichen, ohne einen Typ zu erfinden.
 *
 * `numeric: true` ordnet „K2" vor „K10" und „7" vor „42", und beides bleibt
 * das, was es ist. Leere Zellen stehen ans ENDE, unabhaengig von der
 * Richtung: eine fehlende Angabe ist kein kleiner Wert, und sie oben zu
 * zeigen hiesse, die Liste mit dem zu beginnen, was niemand ausgefuellt hat.
 */
const vergleiche = (a: CsvCell, b: CsvCell): number => {
  const x = alsText(a).trim()
  const y = alsText(b).trim()
  if (!x && !y) return 0
  if (!x) return 1
  if (!y) return -1
  return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' })
}

export interface GeformterBericht {
  tabelle: CsvTable
  /**
   * Die Gruppen, falls gruppiert: Titel plus Zeilenzahl, in der Reihenfolge
   * der Zeilen. Die Zeilen selbst stehen in `tabelle` — eine zweite Kopie je
   * Gruppe waere dieselbe Tabelle noch einmal.
   */
  gruppen?: Array<{ titel: string; zeilen: number }>
}

/**
 * Die Form anwenden: filtern, sortieren, gruppieren, Spalten waehlen.
 *
 * Die Reihenfolge ist keine Willkuer. Gefiltert wird ZUERST, weil eine
 * Gruppe, die durch den Filter leer wird, gar nicht erst als Ueberschrift
 * erscheinen soll. Sortiert wird VOR dem Spaltenschnitt, damit auch nach
 * einer ausgeblendeten Spalte sortiert werden kann — wer nach Raum ordnet und
 * den Raum nicht drucken will, bekommt sonst eine Liste in zufaelliger
 * Reihenfolge.
 */
export const wendeForm = (tabelle: CsvTable, roheForm: Berichtsform): GeformterBericht => {
  const form = heileForm(roheForm, tabelle)
  const index = new Map(tabelle.headers.map((h, i) => [h, i]))

  // (1) Filtern. Ein Filter passt, wenn der Text irgendwo in der Zelle steht;
  //     Gross- und Kleinschreibung zaehlen nicht. Mehrere Filter gelten
  //     zusammen (UND) — das ist die Art, wie jemand eine Liste einengt.
  const eintraege = Object.entries(form.filter).filter(([, text]) => text.trim())
  let zeilen = tabelle.rows
  if (eintraege.length > 0) {
    zeilen = zeilen.filter((zeile) =>
      eintraege.every(([kopf, text]) => {
        const i = index.get(kopf)
        if (i === undefined) return true
        return alsText(zeile[i]).toLowerCase().includes(text.trim().toLowerCase())
      }),
    )
  }

  // (2) Sortieren — mehrstufig, in der Reihenfolge der Schritte.
  if (form.sortierung.length > 0) {
    zeilen = [...zeilen].sort((a, b) => {
      for (const schritt of form.sortierung) {
        const i = index.get(schritt.kopf)
        if (i === undefined) continue
        // Die LEEREN bleiben hinten, auch absteigend. Die Richtung umzudrehen
        // wuerde sie nach oben holen — und eine Liste, die mit dem beginnt,
        // was niemand ausgefuellt hat, ist genau die, die man zuklappt.
        const leerA = !alsText(a[i]).trim()
        const leerB = !alsText(b[i]).trim()
        if (leerA !== leerB) return leerA ? 1 : -1
        if (leerA && leerB) continue
        const c = vergleiche(a[i], b[i])
        if (c !== 0) return schritt.richtung === 'ab' ? -c : c
      }
      return 0
    })
  }

  // (3) Gruppieren. Die Gruppe ist eine zweite Sortierstufe VOR den anderen,
  //     sonst stuenden die Zeilen einer Gruppe nicht beieinander. Zeilen ohne
  //     Wert bilden eine eigene Gruppe mit leerem Titel — sie zu einer
  //     bestehenden zu schlagen waere eine Behauptung ueber sie.
  let gruppen: GeformterBericht['gruppen']
  if (form.gruppeNach) {
    const i = index.get(form.gruppeNach)
    if (i !== undefined) {
      const eimer = new Map<string, CsvCell[][]>()
      for (const zeile of zeilen) {
        const schluessel = alsText(zeile[i]).trim()
        eimer.set(schluessel, [...(eimer.get(schluessel) ?? []), zeile])
      }
      const namen = [...eimer.keys()].sort(vergleiche)
      zeilen = namen.flatMap((n) => eimer.get(n) ?? [])
      gruppen = namen.map((n) => ({ titel: n, zeilen: (eimer.get(n) ?? []).length }))
    }
  }

  // (4) Spalten: Reihenfolge aus der Form, Unsichtbares faellt weg.
  const sichtbar = form.spalten.filter((s) => s.sichtbar)
  const spalten = sichtbar.map((s) => index.get(s.kopf)).filter((i): i is number => i !== undefined)
  return {
    tabelle: {
      headers: spalten.map((i) => tabelle.headers[i]),
      rows: zeilen.map((zeile) => spalten.map((i) => zeile[i])),
    },
    gruppen,
  }
}

// ─── SCHEMA-HEILUNG ────────────────────────────────────────────────────────

const istRichtung = (v: unknown): v is Sortierrichtung => v === 'auf' || v === 'ab'

export const normalisiereBerichtsvorlage = (roh: unknown): Berichtsvorlage | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const quelleId = typeof o.quelleId === 'string' ? o.quelleId.trim() : ''
  // Ohne Quelle gilt die Vorlage fuer keine Liste — sie stuende in jeder
  // Auswahl und formte nichts.
  if (!id || !name || !quelleId) return undefined
  const rohForm = (o.form ?? {}) as Record<string, unknown>
  const spalten = Array.isArray(rohForm.spalten)
    ? rohForm.spalten
        .map((s) => {
          const e = s as Record<string, unknown>
          return typeof e?.kopf === 'string' && e.kopf
            ? { kopf: e.kopf, sichtbar: e.sichtbar !== false }
            : undefined
        })
        .filter((s): s is Spaltenform => !!s)
    : []
  const sortierung = Array.isArray(rohForm.sortierung)
    ? rohForm.sortierung
        .map((s) => {
          const e = s as Record<string, unknown>
          return typeof e?.kopf === 'string' && e.kopf && istRichtung(e.richtung)
            ? { kopf: e.kopf, richtung: e.richtung }
            : undefined
        })
        .filter((s): s is Sortierschritt => !!s)
    : []
  const filter: Record<string, string> = {}
  if (rohForm.filter && typeof rohForm.filter === 'object') {
    for (const [kopf, text] of Object.entries(rohForm.filter as Record<string, unknown>)) {
      if (typeof text === 'string' && text.trim()) filter[kopf] = text
    }
  }
  return {
    id,
    name,
    quelleId,
    form: {
      spalten,
      gruppeNach: typeof rohForm.gruppeNach === 'string' && rohForm.gruppeNach
        ? rohForm.gruppeNach
        : undefined,
      sortierung,
      filter,
    },
  }
}
