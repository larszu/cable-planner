import { describe, expect, it } from 'vitest'
import {
  buildDocQrPayload,
  parseDocQrPayload,
  parseQrPayload,
  docStandStatus,
} from '../src/renderer/lib/qrPayload'

// ADR-004, Inkrement 2 — der Rueckweg vom Blatt. Ein Etikett zeigt auf einen
// Datensatz, ein Dokument-Code auf ein Blatt und seinen Stand.

describe('buildDocQrPayload', () => {
  it('traegt Dokument, Stand und Revision', () => {
    expect(buildDocQrPayload('pull-liste', 'a1b2c3d4', 'Rev 2')).toBe(
      'cableplanner://doc/pull-liste?s=a1b2c3d4&r=Rev%202',
    )
  })

  it('laesst die Revision weg, wenn keine festgeschrieben ist', () => {
    expect(buildDocQrPayload('kabel-bom', 'deadbeef')).toBe(
      'cableplanner://doc/kabel-bom?s=deadbeef',
    )
  })

  it('kodiert Dokument-Ids mit Sonderzeichen', () => {
    const uri = buildDocQrPayload('a/b c', 'deadbeef')
    expect(uri).toContain('doc/a%2Fb%20c')
    expect(parseDocQrPayload(uri)?.docId).toBe('a/b c')
  })
})

describe('parseDocQrPayload', () => {
  it('liest den Round-Trip zurueck', () => {
    const ref = parseDocQrPayload(buildDocQrPayload('pull-liste', 'a1b2c3d4', 'Rev 2'))
    expect(ref).toEqual({ docId: 'pull-liste', stand: 'a1b2c3d4', revision: 'Rev 2' })
  })

  it('nimmt Deep-Link-Formen wie parseQrPayload', () => {
    expect(parseDocQrPayload('#doc/pull-liste?s=a1b2c3d4')?.stand).toBe('a1b2c3d4')
    expect(parseDocQrPayload('?lookup=doc/pull-liste&s=a1b2c3d4')?.docId).toBe('pull-liste')
  })

  it('verweigert einen Code ohne Stand, statt einen leeren zu behaupten', () => {
    // Ohne Stand gibt es nichts zu vergleichen. Ein DocRef mit stand:'' wuerde
    // gegen jeden echten Stand als "veraltet" ausgehen — eine erfundene Aussage.
    expect(parseDocQrPayload('cableplanner://doc/pull-liste')).toBeNull()
  })

  it('ist fuer Datensatz-Codes und Unsinn nicht zustaendig', () => {
    expect(parseDocQrPayload('cableplanner://cable/C-0001?l=x')).toBeNull()
    expect(parseDocQrPayload('C-0001')).toBeNull()
    expect(parseDocQrPayload('')).toBeNull()
  })
})

describe('parseQrPayload gegenueber Dokument-Codes', () => {
  it('reicht eine Dokument-URI nicht als Datensatz-ID durch', () => {
    // Ohne den Riegel fiele sie in den Klartext-Fall und der Lookup suchte die
    // ganze URI als Kabelnummer: "unbekannter Code" statt "Dokument-Code".
    expect(parseQrPayload('cableplanner://doc/pull-liste?s=a1b2c3d4')).toBeNull()
    expect(parseQrPayload('#doc/kabel-bom?s=deadbeef')).toBeNull()
  })

  it('laesst Datensatz-Codes unveraendert', () => {
    expect(parseQrPayload('cableplanner://cable/C-0001?l=Kamera')).toEqual({
      kind: 'cable',
      id: 'C-0001',
      label: 'Kamera',
    })
    expect(parseQrPayload('A-0042')).toEqual({ kind: 'equipment', id: 'A-0042' })
  })
})

describe('docStandStatus', () => {
  const ref = { docId: 'pull-liste', stand: 'a1b2c3d4' }

  it('erkennt das aktuelle Blatt', () => {
    expect(docStandStatus(ref, 'a1b2c3d4')).toBe('current')
    expect(docStandStatus(ref, 'A1B2C3D4')).toBe('current')
  })

  it('erkennt das veraltete Blatt', () => {
    expect(docStandStatus(ref, 'ffffffff')).toBe('stale')
  })

  it('sagt „unbekannt", wenn der aktuelle Stand nicht berechenbar ist', () => {
    // Die ehrliche dritte Antwort: wer nicht rechnen kann, darf ein Blatt weder
    // fuer aktuell noch fuer veraltet erklaeren.
    expect(docStandStatus(ref, undefined)).toBe('unknown')
    expect(docStandStatus(ref, '')).toBe('unknown')
  })
})
