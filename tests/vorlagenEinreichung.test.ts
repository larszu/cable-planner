// ───────────────────────────────────────────────────────────────────────────
// Eigene Vorlagen einreichen (#878, Punkte 2–4).
//
// Die beiden Aussagen, die hier haengen:
//
//  * OHNE QUELLE GEHT NICHTS RAUS. Eine Vorlage ohne Datenblatt-Link kann
//    niemand nachpruefen — und in einem Plan sieht sie spaeter aus wie eine
//    gepruefte.
//  * OHNE LEISTUNGSANGABE SCHON. Ein passiver Splitter hat keine, ein
//    PoE-Geraet nimmt sie aus dem Netz. Sie zu erzwingen hiesse, eine Zahl zu
//    erfinden, damit ein Formular zufrieden ist.
//
// Und der vierte Punkt des Issues ist hier eine FOLGE und keine eigene
// Pruefung: das Tauschen ordnet ueber `(connectorType, Label)` zu — genau die
// beiden Felder verlangt die Pruefung je Port.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  EINREICHUNG_FORMAT,
  EINREICHUNG_VERSION,
  baueEinreichung,
  einreichbar,
  istLink,
  pruefeVorlage,
} from '../src/renderer/lib/vorlagenEinreichung'
import type { EquipmentTemplate, Port } from '../src/renderer/types/equipment'

const port = (id: string, name: string, connectorType = 'BNC'): Port =>
  ({ id, name, connectorType }) as Port

const vorlage = (over: Partial<EquipmentTemplate> = {}): EquipmentTemplate =>
  ({
    name: 'AJA FS-HDR',
    category: 'Video',
    manufacturerUrl: 'https://www.aja.com/products/fs-hdr',
    powerWatts: 45,
    inputs: [port('i1', 'SDI 1')],
    outputs: [port('o1', 'SDI OUT 1')],
  }) as unknown as EquipmentTemplate & Partial<EquipmentTemplate> as EquipmentTemplate

const mit = (over: Partial<EquipmentTemplate>): EquipmentTemplate =>
  ({ ...vorlage(), ...over }) as EquipmentTemplate

describe('istLink', () => {
  it('nimmt eine abrufbare Stelle an', () => {
    expect(istLink('https://www.aja.com/x')).toBe(true)
    expect(istLink('www.blackmagicdesign.com/products')).toBe(true)
  })

  it('lehnt einen Satz ab', () => {
    // „Steht im Handbuch" ist keine Quelle: niemand kann es aufschlagen.
    expect(istLink('steht im Handbuch')).toBe(false)
    expect(istLink('')).toBe(false)
    expect(istLink(undefined)).toBe(false)
  })
})

describe('pruefeVorlage', () => {
  it('laesst eine vollstaendige Vorlage durch', () => {
    expect(pruefeVorlage(vorlage())).toEqual([])
    expect(einreichbar(vorlage())).toBe(true)
  })

  it('blockiert ohne Quelle', () => {
    const b = pruefeVorlage(mit({ manufacturerUrl: undefined }))
    expect(b[0]!.art).toBe('ohne-quelle')
    expect(b[0]!.blockiert).toBe(true)
  })

  it('blockiert eine Quelle, die kein Link ist', () => {
    const b = pruefeVorlage(mit({ manufacturerUrl: 'Datenblatt vom Vertrieb' }))
    expect(b.some((x) => x.art === 'quelle-kein-link' && x.blockiert)).toBe(true)
  })

  it('blockiert einen Port ohne Steckertyp', () => {
    // Das Tauschen faellt sonst auf den positionalen Rueckfall — und der
    // verkabelt im Zweifel den falschen Anschluss.
    const b = pruefeVorlage(mit({ inputs: [{ id: 'i1', name: 'SDI 1' } as Port] }))
    expect(b.some((x) => x.art === 'port-ohne-steckertyp' && x.blockiert)).toBe(true)
    expect(b.find((x) => x.art === 'port-ohne-steckertyp')!.portId).toBe('i1')
  })

  it('blockiert einen Port ohne Label', () => {
    const b = pruefeVorlage(mit({ inputs: [port('i1', '')] }))
    expect(b.some((x) => x.art === 'port-ohne-label' && x.blockiert)).toBe(true)
  })

  it('sieht auch die Eingaenge und nicht nur die Ausgaenge', () => {
    // Ein Geraet, dessen Ausgaenge vollstaendig sind und dessen Eingaenge
    // nicht, verkabelt sich beim Tausch zur Haelfte falsch.
    const b = pruefeVorlage(mit({ inputs: [{ id: 'i9', name: 'HDMI' } as Port] }))
    expect(b.find((x) => x.art === 'port-ohne-steckertyp')!.portId).toBe('i9')
  })

  it('blockiert ohne Ports', () => {
    expect(pruefeVorlage(mit({ inputs: [], outputs: [] })).some((x) => x.art === 'ohne-ports')).toBe(true)
  })

  it('blockiert ohne Namen und ohne Kategorie', () => {
    expect(pruefeVorlage(mit({ name: '  ' })).some((x) => x.art === 'ohne-namen')).toBe(true)
    expect(pruefeVorlage(mit({ category: '' })).some((x) => x.art === 'ohne-kategorie')).toBe(true)
  })

  it('NENNT die fehlende Leistungsangabe und verlangt sie nicht', () => {
    // Ein passiver Splitter hat keine. Eine Zahl zu erzwingen hiesse, eine zu
    // erfinden, damit ein Formular zufrieden ist.
    const b = pruefeVorlage(mit({ powerWatts: undefined }))
    const leistung = b.find((x) => x.art === 'leistung-offen')!
    expect(leistung.blockiert).toBe(false)
    expect(einreichbar(mit({ powerWatts: undefined }))).toBe(true)
  })

  it('meldet zwei Ports mit gleichem Typ UND gleichem Label, ohne zu blockieren', () => {
    // Das Tauschen nimmt dann den ersten freien — das ist eine Unschaerfe und
    // kein Fehler, und sie gehoert in die Einreichung statt verschwiegen.
    const b = pruefeVorlage(mit({ inputs: [port('i1', 'SDI'), port('i2', 'SDI')] }))
    const doppelt = b.find((x) => x.art === 'port-label-doppelt')!
    expect(doppelt.blockiert).toBe(false)
  })

  it('stellt blockierende Befunde nach vorn', () => {
    const b = pruefeVorlage(mit({ manufacturerUrl: undefined, powerWatts: undefined }))
    expect(b[0]!.blockiert).toBe(true)
    expect(b[b.length - 1]!.blockiert).toBe(false)
  })
})

describe('baueEinreichung', () => {
  const meta = { app: 'cable-planner', appVersion: '9.0.2', jetzt: new Date('2026-09-18T12:00:00Z') }

  it('traegt Format und Version', () => {
    const e = baueEinreichung([vorlage()], meta)
    expect(e.format).toBe(EINREICHUNG_FORMAT)
    expect(e.version).toBe(EINREICHUNG_VERSION)
    expect(e.exportedAt).toBe('2026-09-18T12:00:00.000Z')
  })

  it('nimmt mit, was durchgeht, und nennt, was nicht', () => {
    const e = baueEinreichung([vorlage(), mit({ name: 'Ohne Beleg', manufacturerUrl: undefined })], meta)
    expect(e.eintraege).toHaveLength(1)
    expect(e.uebersprungen).toHaveLength(1)
    expect(e.uebersprungen[0]!.name).toBe('Ohne Beleg')
    expect(e.uebersprungen[0]!.gruende[0]).toMatch(/source/i)
  })

  it('schreibt das Uebersprungene IN DIE DATEI', () => {
    // Wer sie weitergibt, gibt mit weiter, dass etwas fehlt. Eine
    // Einreichung, die still die Haelfte weglaesst, sieht vollstaendig aus.
    const e = baueEinreichung([mit({ manufacturerUrl: undefined })], meta)
    expect(JSON.stringify(e)).toContain('uebersprungen')
    expect(e.eintraege).toHaveLength(0)
  })

  it('nimmt die nicht blockierenden Hinweise mit', () => {
    const e = baueEinreichung([mit({ powerWatts: undefined })], meta)
    expect(e.eintraege[0]!.hinweise.join(' ')).toMatch(/not stated/i)
  })

  it('laesst den Absender weg, wenn niemand ihn nennt', () => {
    expect('absender' in baueEinreichung([vorlage()], meta)).toBe(false)
    expect(baueEinreichung([vorlage()], { ...meta, absender: '  L. Z. ' }).absender).toBe('L. Z.')
  })
})
