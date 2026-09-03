import { describe, expect, it } from 'vitest'
import { bitsToMask, maskToBits, networkAddress } from '../src/renderer/lib/subnet'
import netboxMappingSrc from '../src/renderer/lib/netboxMapping.ts?raw'

// ---------------------------------------------------------------------------
// Die Praefixlaenge stand in der Antwort und wurde weggeworfen.
//
// NetBox liefert die primaere Adresse als CIDR — `10.0.5.7/26`. Der Import
// behielt `split('/')[0]` und liess `subnetMask` leer. Pruefung 17 in
// `drawingChecks.ts` faellt dann auf `e.subnetMask || '255.255.255.0'` zurueck
// und rechnet auf einer ERFUNDENEN /24 weiter.
//
// Das ist derselbe Fehler wie ueberall sonst an diesem Tag: ein Wert, den
// niemand bestaetigt hat, rechnet als Tatsache weiter. Nur ist er hier
// besonders aergerlich, weil die richtige Angabe zwei Zeichen weiter rechts
// stand.
//
// Der Schaden geht in BEIDE Richtungen und das ist der Punkt:
//   - /26: zwei Adressen im selben echten Subnetz liegen unter der geratenen
//     /24 zusammen — eine echte Fehlkonfiguration wird NICHT gemeldet.
//   - /22: Gateway und Geraet liegen unter der geratenen /24 auseinander —
//     eine Warnung erscheint, die es nicht geben duerfte.
// ---------------------------------------------------------------------------

describe('bitsToMask', () => {
  it('kehrt maskToBits um', () => {
    for (const bits of [8, 16, 22, 24, 26, 30, 32, 0]) {
      expect(maskToBits(bitsToMask(bits)), `${bits}`).toBe(bits)
    }
  })

  it('nennt die ueblichen Masken beim Namen', () => {
    expect(bitsToMask(24)).toBe('255.255.255.0')
    expect(bitsToMask(26)).toBe('255.255.255.192')
    expect(bitsToMask(22)).toBe('255.255.252.0')
  })

  it('gibt null statt einer erfundenen Maske', () => {
    expect(bitsToMask(null)).toBeNull()
    expect(bitsToMask(undefined)).toBeNull()
    expect(bitsToMask(33)).toBeNull()
    expect(bitsToMask(-1)).toBeNull()
    expect(bitsToMask(24.5)).toBeNull()
  })
})

describe('was die geratene /24 anrichtet', () => {
  it('/26: die erfundene Maske verschweigt eine echte Trennung', () => {
    // .7 und .70 liegen in verschiedenen /26-Netzen, aber in derselben /24.
    expect(networkAddress('10.0.5.7', '255.255.255.192')).not.toBe(
      networkAddress('10.0.5.70', '255.255.255.192'),
    )
    expect(networkAddress('10.0.5.7', '255.255.255.0')).toBe(
      networkAddress('10.0.5.70', '255.255.255.0'),
    )
  })

  it('/22: die erfundene Maske erfindet eine Trennung', () => {
    // .5.7 und .6.1 liegen in derselben /22, aber in verschiedenen /24.
    expect(networkAddress('10.0.5.7', '255.255.252.0')).toBe(
      networkAddress('10.0.6.1', '255.255.252.0'),
    )
    expect(networkAddress('10.0.5.7', '255.255.255.0')).not.toBe(
      networkAddress('10.0.6.1', '255.255.255.0'),
    )
  })
})

describe('der Import traegt die Laenge mit', () => {
  it('setzt subnetMask aus dem CIDR-Praefix', () => {
    expect(netboxMappingSrc).toContain('bitsToMask(maskToBits(primaryIp.split')
    expect(netboxMappingSrc).toContain('subnetMask: mask')
  })

  it('erfindet keine Maske, wenn NetBox keine liefert', () => {
    // Ohne `/` bleibt das Feld leer — lieber keine Angabe als eine geratene.
    // Genau das ist der Unterschied zum Fallback in Pruefung 17.
    expect(netboxMappingSrc).toContain("primaryIp && primaryIp.includes('/')")
  })
})
