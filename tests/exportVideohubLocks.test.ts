import { describe, expect, it } from 'vitest'
import { buildVideohubRoutingDump } from '../src/renderer/lib/exportVideohub'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ADR-005 (Verlustfrei oder laut), Inkrement 3.
//
// Der Dump schrieb `<n> U` fuer jeden Output. `U` ist im Videohub-Protokoll
// nicht "keine Angabe", sondern die Anweisung ZU ENTSPERREN — und der Dump ist
// ausdruecklich dafuer gedacht, in Fremdsoftware oder eine Telnet-Sitzung
// kopiert zu werden. Der Plan kennt aber gar keine Sperr-Absicht: er hat sich
// eine ausgedacht, und zwar die gefaehrliche Richtung.

const device = {
  name: 'Videohub 40x40',
  inputs: [],
  outputs: [],
} as unknown as Pick<EquipmentItem, 'name' | 'inputs' | 'outputs'>

const dump = (routing?: Record<number, number>) =>
  buildVideohubRoutingDump(device, {
    modelName: 'Smart Videohub 40x40',
    totalInputs: 4,
    totalOutputs: 4,
    routing,
  })

describe('Videohub-Dump — behauptet keinen Sperrzustand', () => {
  it('schreibt keinen VIDEO OUTPUT LOCKS-Block', () => {
    expect(dump()).not.toContain('VIDEO OUTPUT LOCKS')
  })

  it('schreibt insbesondere kein Entsperren-Kommando', () => {
    // Der eigentliche Schaden: nicht die fehlende Information, sondern die
    // erfundene. Ein `0 U` in einer Telnet-Sitzung hebt eine Sperre auf, die
    // einen Live-Ausgang schuetzt.
    const lines = dump().split('\r\n')
    expect(lines.filter((l) => /^\d+ U$/.test(l))).toEqual([])
  })

  it('schreibt das geplante Routing weiterhin vollstaendig', () => {
    // Weglassen heisst nicht Ausduennen: was der Plan WEISS, steht drin.
    const text = dump({ 0: 3, 1: 2 })
    const body = text.slice(text.indexOf('VIDEO OUTPUT ROUTING:'))
    expect(body).toContain('0 3')
    expect(body).toContain('1 2')
    expect(body).toContain('2 0')
    expect(body).toContain('3 0')
  })

  it('haelt die uebrigen Bloecke unveraendert', () => {
    const text = dump()
    expect(text).toContain('VIDEOHUB DEVICE:')
    expect(text).toContain('INPUT LABELS:')
    expect(text).toContain('OUTPUT LABELS:')
    expect(text).toContain('VIDEO OUTPUT ROUTING:')
  })
})
