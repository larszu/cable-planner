import { describe, expect, it } from 'vitest'
import {
  formAus,
  heileForm,
  normalisiereBerichtsvorlage,
  wendeForm,
  type Berichtsform,
} from '../src/renderer/types/bericht'
import type { CsvTable } from '../src/renderer/lib/csv'

// ---------------------------------------------------------------------------
// #880 — die Form eines Berichts.
//
// GEMESSEN, bevor gebaut wurde: neun Listen liefern `CsvTable`, und keine
// einzige Stelle im Repo blendete je eine Spalte aus, gruppierte oder
// sortierte. Die Form arbeitet deshalb AUF `CsvTable` — Vorschau, CSV und
// Papier bekommen dasselbe Ergebnis, weil es nur eines gibt.
// ---------------------------------------------------------------------------

const tabelle: CsvTable = {
  headers: ['Nr.', 'Raum', 'Typ', 'Länge (m)'],
  rows: [
    ['K10', 'Regie', 'BNC', 12],
    ['K2', 'Halle', 'BNC', 7],
    ['K3', 'Halle', 'Fiber', 42],
    ['K4', '', 'Fiber', null],
  ],
}

const form = (teil: Partial<Berichtsform> = {}): Berichtsform => ({
  ...formAus(tabelle),
  ...teil,
})

describe('#880 — Spalten', () => {
  it('blendet aus, was unsichtbar ist', () => {
    const f = form()
    f.spalten = f.spalten.map((s) => (s.kopf === 'Raum' ? { ...s, sichtbar: false } : s))
    expect(wendeForm(tabelle, f).tabelle.headers).toEqual(['Nr.', 'Typ', 'Länge (m)'])
  })

  it('folgt der Reihenfolge der Form und nicht der der Tabelle', () => {
    const f = form({
      spalten: [
        { kopf: 'Typ', sichtbar: true },
        { kopf: 'Nr.', sichtbar: true },
        { kopf: 'Raum', sichtbar: false },
        { kopf: 'Länge (m)', sichtbar: false },
      ],
    })
    const ergebnis = wendeForm(tabelle, f).tabelle
    expect(ergebnis.headers).toEqual(['Typ', 'Nr.'])
    expect(ergebnis.rows[0]).toEqual(['BNC', 'K10'])
  })
})

describe('#880 — die Vorlage von gestern trifft die Liste von heute', () => {
  it('nimmt eine verschwundene Spalte aus der Form', () => {
    const geheilt = heileForm(form({ spalten: [{ kopf: 'Gibt es nicht', sichtbar: false }] }), tabelle)
    expect(geheilt.spalten.map((s) => s.kopf)).toEqual(['Nr.', 'Raum', 'Typ', 'Länge (m)'])
  })

  it('nimmt eine NEUE Spalte SICHTBAR auf', () => {
    // Nicht unsichtbar: eine Spalte, die niemand ausgeblendet hat, ist
    // sichtbar. Eine stillschweigend fehlende Spalte auf einer Ziehliste ist
    // schlimmer als eine zuviel.
    const alt = form({ spalten: [{ kopf: 'Nr.', sichtbar: true }] })
    expect(heileForm(alt, tabelle).spalten.find((s) => s.kopf === 'Typ')?.sichtbar).toBe(true)
  })

  it('wirft Sortierung, Gruppe und Filter weg, die ins Leere zeigen', () => {
    const alt = form({
      gruppeNach: 'Weg',
      sortierung: [{ kopf: 'Weg', richtung: 'ab' }],
      filter: { Weg: 'x' },
    })
    const geheilt = heileForm(alt, tabelle)
    expect(geheilt.gruppeNach).toBeUndefined()
    expect(geheilt.sortierung).toEqual([])
    expect(geheilt.filter).toEqual({})
  })
})

describe('#880 — Sortieren', () => {
  it('ordnet K2 vor K10, ohne aus K2 eine Zahl zu machen', () => {
    const f = form({ sortierung: [{ kopf: 'Nr.', richtung: 'auf' }] })
    expect(wendeForm(tabelle, f).tabelle.rows.map((r) => r[0])).toEqual(['K2', 'K3', 'K4', 'K10'])
  })

  it('dreht die Richtung um, laesst die Leeren aber hinten', () => {
    // Eine fehlende Angabe ist kein kleiner Wert. Sie oben zu zeigen hiesse,
    // die Liste mit dem zu beginnen, was niemand ausgefuellt hat.
    const f = form({ sortierung: [{ kopf: 'Länge (m)', richtung: 'ab' }] })
    expect(wendeForm(tabelle, f).tabelle.rows.map((r) => r[3])).toEqual([42, 12, 7, null])
  })

  it('sortiert auch nach einer AUSGEBLENDETEN Spalte', () => {
    // Wer nach Raum ordnet und den Raum nicht drucken will, bekommt sonst
    // eine Liste in zufaelliger Reihenfolge.
    const f = form({ sortierung: [{ kopf: 'Raum', richtung: 'auf' }] })
    f.spalten = f.spalten.map((s) => (s.kopf === 'Raum' ? { ...s, sichtbar: false } : s))
    const rows = wendeForm(tabelle, f).tabelle.rows
    expect(rows.map((r) => r[0])).toEqual(['K2', 'K3', 'K10', 'K4'])
  })

  it('sortiert mehrstufig in der Reihenfolge der Schritte', () => {
    const f = form({
      sortierung: [
        { kopf: 'Typ', richtung: 'auf' },
        { kopf: 'Länge (m)', richtung: 'ab' },
      ],
    })
    expect(wendeForm(tabelle, f).tabelle.rows.map((r) => r[0])).toEqual(['K10', 'K2', 'K3', 'K4'])
  })
})

describe('#880 — Filtern', () => {
  it('sucht im Text und achtet nicht auf Gross- und Kleinschreibung', () => {
    const f = form({ filter: { Raum: 'hal' } })
    expect(wendeForm(tabelle, f).tabelle.rows).toHaveLength(2)
  })

  it('verbindet mehrere Filter mit UND', () => {
    const f = form({ filter: { Raum: 'Halle', Typ: 'Fiber' } })
    expect(wendeForm(tabelle, f).tabelle.rows.map((r) => r[0])).toEqual(['K3'])
  })

  it('laesst einen leeren Filter die Liste in Ruhe', () => {
    expect(wendeForm(tabelle, form({ filter: { Raum: '   ' } })).tabelle.rows).toHaveLength(4)
  })
})

describe('#880 — Gruppieren', () => {
  it('stellt die Zeilen einer Gruppe zusammen und zaehlt sie', () => {
    const { tabelle: t, gruppen } = wendeForm(tabelle, form({ gruppeNach: 'Typ' }))
    expect(gruppen).toEqual([
      { titel: 'BNC', zeilen: 2 },
      { titel: 'Fiber', zeilen: 2 },
    ])
    expect(t.rows.map((r) => r[2])).toEqual(['BNC', 'BNC', 'Fiber', 'Fiber'])
  })

  it('macht aus den Zeilen ohne Wert eine EIGENE Gruppe', () => {
    // Sie einer bestehenden zuzuschlagen waere eine Behauptung ueber sie.
    const { gruppen } = wendeForm(tabelle, form({ gruppeNach: 'Raum' }))
    // Und sie steht HINTEN, wie die leeren Zellen beim Sortieren: eine
    // Liste beginnt nicht mit dem, was niemand ausgefuellt hat.
    expect(gruppen?.map((g) => g.titel)).toEqual(['Halle', 'Regie', ''])
  })

  it('zeigt keine Gruppe, die der Filter geleert hat', () => {
    const { gruppen } = wendeForm(tabelle, form({ gruppeNach: 'Typ', filter: { Typ: 'Fiber' } }))
    expect(gruppen?.map((g) => g.titel)).toEqual(['Fiber'])
  })
})

describe('#880 — die gespeicherte Vorlage', () => {
  it('verwirft eine ohne Namen oder ohne Liste', () => {
    expect(normalisiereBerichtsvorlage({ id: 'a', name: 'X' })).toBeUndefined()
    expect(normalisiereBerichtsvorlage({ id: 'a', quelleId: 'pull-liste' })).toBeUndefined()
  })

  it('liest Spalten, Sortierung und Filter zurueck und wirft Unlesbares weg', () => {
    const v = normalisiereBerichtsvorlage({
      id: 'a',
      name: 'Nur Nummern',
      quelleId: 'pull-liste',
      form: {
        spalten: [{ kopf: 'Nr.', sichtbar: false }, { kopf: 42 }],
        sortierung: [{ kopf: 'Nr.', richtung: 'ab' }, { kopf: 'Nr.', richtung: 'seitwaerts' }],
        filter: { Raum: 'Halle', Typ: '  ' },
      },
    })
    expect(v?.form.spalten).toEqual([{ kopf: 'Nr.', sichtbar: false }])
    expect(v?.form.sortierung).toEqual([{ kopf: 'Nr.', richtung: 'ab' }])
    expect(v?.form.filter).toEqual({ Raum: 'Halle' })
  })
})
