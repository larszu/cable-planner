import { describe, expect, it } from 'vitest'
import { normaliseTallyPositions } from '../src/renderer/lib/tallyPosition'
import { normaliseAddressLayers } from '../src/renderer/lib/addressTemplate'
import typQuelle from '../src/renderer/types/loadReport.ts?raw'
import appQuelle from '../src/renderer/App.tsx?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'

// ───────────────────────────────────────────────────────────────────────────
// ADR-005, Regel 3 — „Wer nicht bewahren kann, sagt es an der Stelle, an der
// es passiert." Der ADR nennt als naechsten Schritt ausdruecklich, die
// uebrigen Heilungsschritte in `healProjectPositions` je einzeln daraufhin
// anzusehen, ob sie ueberhaupt etwas verwerfen — und NUR die anzuschliessen,
// die es tun. („Ein Kanal, der Meldungen ueber Nicht-Verluste traegt, ist so
// schaedlich wie gar keiner.")
//
// Durchgegangen; zwei Schritte verwarfen ganze Datensaetze, und zwar wortlos:
//
//   1. `normaliseTallyPositions` — ein Datensatz ohne Rolle oder mit doppelter
//      Rolle. Er traegt die `checks`: die Beobachtungen, die jemand an der
//      Kamera aufgenommen hat. Danach steht die Position auf dem
//      Vor-Show-Blatt als „nie geprueft", und jemand laeuft denselben Weg
//      noch einmal — oder eben nicht.
//   2. `normaliseAddressLayers` — ein Bereich, dessen CIDR keiner ist, und
//      eine ganze Ebene ohne Id, die ALLE ihre Bereiche mitnimmt. Der Bereich
//      ist der Vorrat, aus dem jede Geraete-Adresse kommt.
//
// Nicht angeschlossen wurden die Schritte, die nichts verwerfen: der
// Gateway-Zeiger eines Segments und das Gateway eines Bereichs sind FELDER an
// einem Datensatz, der ueberlebt; `normaliseNamingScheme` faellt unter
// Einstellungen, nicht unter Nutzer-Datensaetze (steht so im Quelltext).
// ───────────────────────────────────────────────────────────────────────────

const sammle = () => {
  const drops: { reason: string; label: string }[] = []
  return { drops, on: (d: { reason: string; label: string }) => drops.push(d) }
}

describe('Tally-Positionen verschwinden nicht mehr wortlos', () => {
  it('meldet einen Datensatz ohne Rolle', () => {
    const s = sammle()
    const out = normaliseTallyPositions([{ transport: 'gpio', endpoint: '17' }], s.on)
    expect(out).toEqual([])
    expect(s.drops).toEqual([{ reason: 'missing-required', label: '17' }])
  })

  it('nimmt als Griff die Lampe, wenn es keinen Endpunkt gibt', () => {
    const s = sammle()
    normaliseTallyPositions([{ lamp: 'Bolt 4K links' }], s.on)
    expect(s.drops[0]).toEqual({ reason: 'missing-required', label: 'Bolt 4K links' })
  })

  it('meldet den zweiten Datensatz derselben Rolle', () => {
    const s = sammle()
    const out = normaliseTallyPositions(
      [
        { identityId: 'r1', transport: 'gpio' },
        { identityId: 'r1', transport: 'ndi' },
      ],
      s.on,
    )
    expect(out).toHaveLength(1)
    expect(out[0].transport).toBe('gpio')
    expect(s.drops).toEqual([{ reason: 'duplicate-id', label: 'r1' }])
  })

  it('meldet nichts, wenn nichts wegfaellt', () => {
    // Der Kanal darf keine Nicht-Verluste tragen — sonst gewoehnt sich der
    // Nutzer daran, das Banner wegzuklicken (ADR-005, woertlich).
    const s = sammle()
    normaliseTallyPositions([{ identityId: 'r1', transport: 'gpio', endpoint: '3' }], s.on)
    expect(s.drops).toEqual([])
  })

  it('laeuft ohne Rueckruf unveraendert', () => {
    expect(normaliseTallyPositions([{ transport: 'gpio' }])).toEqual([])
    expect(normaliseTallyPositions([{ identityId: 'r1' }])).toHaveLength(1)
  })
})

describe('Adressbereiche verschwinden nicht mehr wortlos', () => {
  it('meldet einen Bereich, dessen CIDR keiner ist — mit dem CIDR als Griff', () => {
    // Der CIDR schlaegt den Schluessel: „media" steht in jeder zweiten Ebene,
    // „10.0.5.0/33" genau einmal in der Datei.
    const s = sammle()
    const out = normaliseAddressLayers(
      [{ id: 'l1', name: 'Haus', ranges: [{ id: 'r1', key: 'media', cidr: '10.0.5.0/33' }] }],
      s.on,
    )
    expect(out[0].ranges).toEqual([])
    expect(s.drops).toEqual([{ reason: 'missing-required', label: '10.0.5.0/33' }])
  })

  it('nimmt den Namen als Griff, wo es einen gibt', () => {
    const s = sammle()
    normaliseAddressLayers(
      [{ id: 'l1', ranges: [{ id: 'r1', name: 'Medien primaer', cidr: 'unsinn' }] }],
      s.on,
    )
    expect(s.drops[0].label).toBe('Medien primaer')
  })

  it('meldet eine ganze Ebene ohne Id — sie nimmt alle ihre Bereiche mit', () => {
    const s = sammle()
    const out = normaliseAddressLayers(
      [{ name: 'Venue-Vorgabe', ranges: [{ id: 'r1', cidr: '10.0.0.0/8' }] }],
      s.on,
    )
    expect(out).toEqual([])
    expect(s.drops).toEqual([{ reason: 'missing-required', label: 'Venue-Vorgabe' }])
  })

  it('meldet nichts fuer einen Bereich, der durchgeht', () => {
    const s = sammle()
    const out = normaliseAddressLayers(
      [{ id: 'l1', ranges: [{ id: 'r1', key: 'media', cidr: '10.0.5.0/24' }] }],
      s.on,
    )
    expect(out[0].ranges).toHaveLength(1)
    expect(s.drops).toEqual([])
  })

  it('meldet NICHT, wenn nur das Gateway ausserhalb liegt — der Bereich bleibt', () => {
    // Ein Feld an einem ueberlebenden Datensatz ist kein verworfener
    // Datensatz. Diese Zeile haelt die Grenze fest, an der der Kanal aufhoert.
    const s = sammle()
    const out = normaliseAddressLayers(
      [{ id: 'l1', ranges: [{ id: 'r1', cidr: '10.0.5.0/24', gateway: '10.9.9.1' }] }],
      s.on,
    )
    expect(out[0].ranges).toHaveLength(1)
    expect(out[0].ranges[0].gateway).toBeUndefined()
    expect(s.drops).toEqual([])
  })
})

describe('der Bericht kann die neuen Sorten benennen', () => {
  it('kennt beide Sorten im Typ', () => {
    expect(typQuelle).toContain("| 'tally-position'")
    expect(typQuelle).toContain("| 'address-range'")
  })

  it('kennt den Grund „Verweis zeigt ins Leere" — und begruendet ihn', () => {
    expect(typQuelle).toContain("| 'dangling-ref'")
    // Nicht bloss vorhanden: der Typ muss sagen, warum das NICHT
    // `missing-required` ist. Sonst waehlt der naechste Aufrufer nach Gefuehl.
    const block = typQuelle.slice(
      typQuelle.indexOf("| 'dangling-ref'") - 1200,
      typQuelle.indexOf("| 'dangling-ref'"),
    )
    expect(block).toContain('missing-required')
  })

  it('beschriftet jede Sorte und jeden Grund — erzwungen durch den Typ', () => {
    // `satisfies Record<LoadDropKind, …>` macht eine vergessene Sorte zum
    // Typfehler statt zu einer Zeile, die die falsche Sorte benennt.
    expect(appQuelle).toContain('satisfies Record<LoadDropKind, [string, string]>')
    expect(appQuelle).toContain('satisfies Record<LoadDropReason, [string, string]>')
    expect(appQuelle).toContain("'tally-position': [")
    expect(appQuelle).toContain("'address-range': [")
    expect(appQuelle).toContain("'dangling-ref': [")
  })

  it('hat die Ternaer-Kette mit dem Default „Signalquelle" abgeloest', () => {
    // Der letzte Zweig der alten Kette war der Fall-Through: eine neue Sorte
    // ohne Eintrag wurde stillschweigend zur „Signalquelle".
    expect(appQuelle).not.toContain("d.kind === 'delivery-destination'")
    expect(appQuelle).toContain('dropArtLabel(t, d.kind)')
  })

  it('reicht den Rueckruf in beide Normalisierungen', () => {
    expect(storeQuelle).toMatch(/normaliseAddressLayers\(project\.addressLayers,\s*\(d\)/)
    expect(storeQuelle).toMatch(/kind: 'address-range'/)
  })
})
