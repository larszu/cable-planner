// ───────────────────────────────────────────────────────────────────────────
// Das Netzwerk-Budget rechnet LAST, nicht Leitungs-Kapazitaet.
//
// Zwei Fehler, die sich nicht aufhoben, sondern die Zahl in beide Richtungen
// unbrauchbar machten (gemessen 2026-09-04):
//
//   (a) `bandwidthMbpsForStandard` lieferte fuer Eth-100/1G/10G die
//       LINK-KAPAZITAET (100/1000/10000), und der Rechner summierte sie als
//       Last. Ein einziges gezeichnetes Cat6a-Kabel ergab „10 Gbps Gesamt"
//       und die Empfehlung „10 GbE" — bei null Mediensignalen.
//
//   (b) `pickHighestSdiStandard` fiel ohne SDI-Mitglied auf das LETZTE
//       Listenelement zurueck. Weil die ST-2110- und NDI-Specs mit dem
//       kleinsten Signal enden, war der Vorgabewert der schmalste statt des
//       breitesten: ST2110-40 (2 Mbps) statt ST2110-20 (3000).
//
// Ein Plan mit zwanzig unberuehrten ST-2110-Links meldete damit 40 Mbps und
// bekam „1 GbE" empfohlen, waehrend danebenliegende Netzwerkkabel je 10 Gbps
// Phantomlast einbrachten.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import {
  cableCatalog,
  ALL_SIGNAL_STANDARDS,
  bandwidthMbpsForStandard,
  linkCapacityMbpsForStandard,
  pickHighestSdiStandard,
} from '../src/renderer/types/cableSpec'

describe('Kapazitaet zaehlt nicht als Last', () => {
  it('kein Ethernet-Standard liefert eine Medien-Bandbreite', () => {
    // Die FORM des Fehlers, nicht seine drei Auspraegungen: wer morgen
    // Eth-25G ergaenzt, faellt hier auf, nicht erst im Rechner.
    const ethernet = ALL_SIGNAL_STANDARDS.filter((s) => s.startsWith('Eth-'))
    expect(ethernet.length).toBeGreaterThan(0)
    expect(ethernet.filter((s) => bandwidthMbpsForStandard(s) !== undefined)).toEqual([])
  })

  it('die Kapazitaet ist dafuer weiterhin abfragbar', () => {
    expect(linkCapacityMbpsForStandard('Eth-10G')).toBe(10000)
    expect(linkCapacityMbpsForStandard('Eth-1G')).toBe(1000)
    expect(linkCapacityMbpsForStandard('Eth-100')).toBe(100)
  })

  it('und die beiden Begriffe ueberschneiden sich nirgends', () => {
    const doppelt = ALL_SIGNAL_STANDARDS.filter(
      (s) => bandwidthMbpsForStandard(s) !== undefined && linkCapacityMbpsForStandard(s) !== undefined,
    )
    expect(doppelt).toEqual([])
  })

  it('die Medien-Standards behalten ihre Werte', () => {
    expect(bandwidthMbpsForStandard('NDI')).toBe(250)
    expect(bandwidthMbpsForStandard('ST2110-20')).toBe(3000)
    expect(bandwidthMbpsForStandard('Dante')).toBe(49)
  })
})

describe('der Vorgabewert ist der wahrscheinliche Hauptweg', () => {
  const spec = (id: string) => {
    const s = cableCatalog.find((x) => x.id === id)
    expect(s, `Spec ${id} fehlt`).toBeDefined()
    return s!
  }

  it('ST 2110 auf Faser defaultet auf die Video-Essenz, nicht auf ANC', () => {
    expect(pickHighestSdiStandard(spec('st2110-fiber').standards)).toBe('ST2110-20')
  })

  it('NDI ueber Cat6a defaultet auf NDI, nicht auf NDI-HX', () => {
    expect(pickHighestSdiStandard(spec('ndi-cat6a').standards)).toBe('NDI')
  })

  it('ein SDI-Mitglied gewinnt weiterhin, und zwar das hoechste', () => {
    expect(pickHighestSdiStandard(['SDI-HD', 'SDI-12G', 'SDI-3G'])).toBe('SDI-12G')
  })

  it('ohne jede bekannte Bandbreite bleibt es beim letzten Element', () => {
    // Reine Steuer-/Stromspecs — dort gibt es nichts zu ordnen.
    expect(pickHighestSdiStandard(['RS-422', 'DMX512'])).toBe('DMX512')
  })

  it('keine Spec defaultet mehr auf ihren schmalsten Medien-Standard', () => {
    // Der eigentliche Befund, als Regel ueber ALLE Specs statt ueber zwei.
    for (const s of cableCatalog) {
      const gewaehlt = pickHighestSdiStandard(s.standards)
      const gewaehlteBreite = bandwidthMbpsForStandard(gewaehlt)
      if (gewaehlteBreite === undefined) continue
      const breiteste = Math.max(
        ...s.standards.map((x) => bandwidthMbpsForStandard(x) ?? -1),
      )
      expect(gewaehlteBreite, `${s.id} defaultet auf ${gewaehlt}`).toBe(breiteste)
    }
  })
})
