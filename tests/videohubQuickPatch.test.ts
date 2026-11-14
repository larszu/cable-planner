import { describe, expect, it } from 'vitest'
import {
  parseQuickPatch,
  quickPatchCommand,
  quickPatchUnbestaetigt,
} from '../src/renderer/lib/videohubQuickPatch'

// #1184 — Schnellpatch-Kuerzel.
describe('parseQuickPatch', () => {
  it('liest einen Block 1-basiert und liefert 0-basierte Kreuzpunkte', () => {
    const r = parseQuickPatch('i1o4o7o11', 12, 12)
    expect(r.errors).toEqual([])
    expect(r.bloecke).toEqual([{ input: 1, outputs: [4, 7, 11] }])
    expect(r.crosspoints).toEqual({ 3: 0, 6: 0, 10: 0 })
  })

  it('liest mehrere Bloecke, mit und ohne Trenner, Gross/Klein egal', () => {
    const r = parseQuickPatch('I2O1o2 i3o3, i4 o4;i5o5i6o6', 10, 10)
    expect(r.errors).toEqual([])
    expect(r.crosspoints).toEqual({ 0: 1, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 })
  })

  it('der spaetere Block gewinnt und der Doppelte wird gemeldet', () => {
    const r = parseQuickPatch('i1o4 i2o4', 4, 4)
    expect(r.crosspoints).toEqual({ 3: 1 })
    expect(r.doppelt).toEqual([4])
  })

  it('meldet Fehler und liefert dann keine Kreuzpunkte', () => {
    expect(parseQuickPatch('o4', 4, 4).errors[0].kind).toBe('ausgangOhneEingang')
    expect(parseQuickPatch('i1', 4, 4).errors[0].kind).toBe('eingangOhneAusgang')
    expect(parseQuickPatch('i9o1', 4, 4).errors[0]).toEqual({ kind: 'eingangAusserhalb', input: 9, max: 4 })
    expect(parseQuickPatch('i1o0', 4, 4).errors[0]).toEqual({ kind: 'ausgangAusserhalb', output: 0, max: 4 })
    const tipp = parseQuickPatch('i1o4o7o1l', 12, 12)
    expect(tipp.errors.map((e) => e.kind)).toEqual(['zeichen'])
    expect(tipp.crosspoints).toEqual({})
  })

  it('leere Eingabe ist kein Fehler', () => {
    expect(parseQuickPatch('  ', 4, 4)).toMatchObject({ errors: [], crosspoints: {} })
  })
})

describe('quickPatchCommand / quickPatchUnbestaetigt', () => {
  it('schreibt nur die getippten Kreuzpunkte, sortiert', () => {
    expect(quickPatchCommand({ 6: 0, 3: 0 })).toBe('VIDEO OUTPUT ROUTING:\n3 0\n6 0\n\n')
  })

  it('nennt die Ausgaenge, die der Hub nach dem Schalten nicht traegt', () => {
    expect(quickPatchUnbestaetigt({ 3: 0, 6: 0 }, { 3: 0, 6: 2 })).toEqual([7])
    expect(quickPatchUnbestaetigt({ 3: 0 }, { 3: 0 })).toEqual([])
  })
})
