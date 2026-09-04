// ───────────────────────────────────────────────────────────────────────────
// Der Ausspielweg zählt im Netz-Budget mit (B-10).
//
// GEMESSENER AUSGANGSZUSTAND (2026-09-04). Das Modell kannte nur die
// PRODUKTIONS-Haelfte des Netzes: NDI, NDI-HX, Dante, AES67 und
// ST 2110-20/30/40 sind vollwertige `SignalStandard`-Mitglieder mit
// Bandbreite, Netz-Budget und Plan-Pruefungen. `SRT`, `RTMP` und `HLS` kamen
// im gesamten Quelltext NICHT VOR -- obwohl an ihnen jeder Stream-Job haengt.
//
// Der Schaden lag nicht darin, dass etwas falsch gerechnet wurde, sondern
// darin, WAS in der Summe fehlte: der Uplink ist der Weg, der neben zwanzig
// NDI-Quellen als Erstes klemmt, und er war im Budget schlicht nicht
// vorhanden. Ein Plan konnte "1 GbE reicht" sagen und dabei den einzigen
// Weg uebersehen, der das Haus verlaesst.
//
// WAS DIESE DATEI PRUEFT. Nicht "die Zahlen stimmen" -- es sind Richtwerte
// fuer einen 1080p50-Weg und als solche im Quelltext gekennzeichnet. Geprueft
// wird, dass die drei Standards ERREICHBAR sind: waehlbar am Kabel, mit einer
// Bandbreite hinterlegt, und als LAST gezaehlt statt als Kapazitaet.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import {
  cableCatalog,
  ALL_SIGNAL_STANDARDS,
  bandwidthMbpsForStandard,
  linkCapacityMbpsForStandard,
  pickHighestSdiStandard,
  type SignalStandard,
} from '../src/renderer/types/cableSpec'

const DELIVERY: SignalStandard[] = ['SRT', 'RTMP', 'HLS']

describe('Delivery-Standards sind erreichbar', () => {
  it('stehen in der Auswahlliste der Oberflaeche', () => {
    // `ALL_SIGNAL_STANDARDS` ist die Liste, aus der die Standard-Auswahl am
    // Kabel gerendert wird. Ein Typ-Mitglied ohne Eintrag hier waere im Code
    // vorhanden und fuer den Nutzer unerreichbar -- die Form, die diese
    // Sitzung mehrfach gefunden hat.
    for (const std of DELIVERY) expect(ALL_SIGNAL_STANDARDS).toContain(std)
  })

  it('haben eine Bandbreite und zaehlen damit im Budget', () => {
    for (const std of DELIVERY) {
      expect(bandwidthMbpsForStandard(std), `${std} ohne Bandbreite`).toBeGreaterThan(0)
    }
  })

  it('zaehlen als LAST, nicht als Leitungs-Kapazitaet', () => {
    // Derselbe Kategoriefehler wie bei Eth-100/1G/10G: ein Ausspielweg TEILT
    // sich das Netz, er IST nicht das Netz. Stuende er in
    // `linkCapacityMbpsForStandard`, wuerde der Rechner ihn ueberspringen
    // (`continue`) und die Last waere wieder zu niedrig.
    for (const std of DELIVERY) expect(linkCapacityMbpsForStandard(std)).toBeUndefined()
  })

  it('es gibt ein Katalog-Kabel, das sie traegt', () => {
    const uplink = cableCatalog.find((c) => c.id === 'stream-uplink-cat6')
    expect(uplink, 'Katalog-Eintrag stream-uplink-cat6 fehlt').toBeDefined()
    for (const std of DELIVERY) expect(uplink!.standards).toContain(std)
    expect(uplink!.notesKey).toBeTruthy()
  })

  it('der Vorgabewert des Uplink-Kabels ist der breiteste Weg, nicht der letzte', () => {
    // Dieselbe Falle wie bei ST 2110 und NDI (siehe
    // `netzBudgetLastNichtKapazitaet.test.ts`): `pickHighestSdiStandard`
    // faellt ohne SDI-Mitglied auf den breitesten BEKANNTEN Standard zurueck.
    // Bei diesem Kabel muss das SRT sein (12) und nicht RTMP (6) -- und schon
    // gar nicht ein Eth-Standard, der gar keine Medienlast traegt.
    const uplink = cableCatalog.find((c) => c.id === 'stream-uplink-cat6')!
    expect(pickHighestSdiStandard(uplink.standards)).toBe('SRT')
  })
})

describe('Die Produktions-Haelfte bleibt unberuehrt', () => {
  it('kein Ethernet-Standard hat durch diese Aenderung eine Last bekommen', () => {
    const ethernet = ALL_SIGNAL_STANDARDS.filter((s) => s.startsWith('Eth-'))
    expect(ethernet.filter((s) => bandwidthMbpsForStandard(s) !== undefined)).toEqual([])
  })

  it('die bekannten Produktions-Bandbreiten stehen unveraendert', () => {
    expect(bandwidthMbpsForStandard('ST2110-20')).toBe(3000)
    expect(bandwidthMbpsForStandard('NDI')).toBe(250)
    expect(bandwidthMbpsForStandard('Dante')).toBe(49)
  })
})
