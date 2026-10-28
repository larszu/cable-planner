import { describe, expect, it } from 'vitest'
import {
  resolveTitleBlockScale,
  titleBlockRowVisible,
  titleBlockScale,
} from '../src/renderer/lib/titleBlockScale'

describe('titleBlockScale', () => {
  it('bleibt auf A3 und kleiner bei 1', () => {
    expect(titleBlockScale(1191, 842, 300)).toBe(1)
    expect(titleBlockScale(842, 595, 300)).toBe(1)
  })
  it('waechst mit der Blattflaeche (A0 = 4x A3-Kante)', () => {
    expect(titleBlockScale(3370, 2384, 300)).toBeCloseTo(2.83, 1)
  })
  it('wird nie breiter als knapp die halbe Blattbreite', () => {
    const k = titleBlockScale(1500, 20000, 300)
    expect(300 * k).toBeLessThanOrEqual(1500 * 0.45 + 1e-9)
  })
  it('rechnet CSS-px um', () => {
    expect(titleBlockScale(3370 * (4 / 3), 2384 * (4 / 3), 300, 4 / 3)).toBeCloseTo(2.83, 1)
  })
})

describe('resolveTitleBlockScale', () => {
  it('fester Faktor schlaegt Auto', () => {
    expect(resolveTitleBlockScale({ size: 2 }, 3370, 2384, 300)).toBe(2)
    expect(resolveTitleBlockScale({ size: 'auto' }, 3370, 2384, 300)).toBeCloseTo(2.83, 1)
  })
  it('fester Faktor sprengt das Blatt nicht', () => {
    expect(300 * resolveTitleBlockScale({ size: 3 }, 600, 400, 300)).toBeLessThanOrEqual(540)
  })
  it('abgewaehlte Zeilen sind unsichtbar', () => {
    expect(titleBlockRowVisible({ hidden: ['client'] }, 'client')).toBe(false)
    expect(titleBlockRowVisible(undefined, 'client')).toBe(true)
  })
})

describe('titleBlockRows', () => {
  const meta = {
    name: 'Show',
    description: '',
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z',
    revision: 'Rev 2',
  } as unknown as import('../src/renderer/types/project').ProjectMetadata
  const stamp = { fingerprint: 'abc123', drifted: false } as unknown as import('../src/renderer/lib/documentStamp').DocumentStamp

  it('liefert Revision und Stand, wenn es sie gibt', async () => {
    const { titleBlockRows } = await import('../src/renderer/lib/titleBlockContent')
    const rows = titleBlockRows(meta, stamp)
    expect(rows.find(([k]) => k === 'Revision')?.[1]).toBe('Rev 2')
    expect(rows.find(([k]) => k === 'Stand')?.[1]).toBe('#abc123')
  })
  it('laesst Stand ohne Stempel weg, Stammdaten zeigen —', async () => {
    const { titleBlockRows } = await import('../src/renderer/lib/titleBlockContent')
    const rows = titleBlockRows(meta)
    expect(rows.some(([k]) => k === 'Stand')).toBe(false)
    expect(rows.find(([k]) => k === 'Kunde')?.[1]).toBe('—')
  })
  it('respektiert abgewaehlte Zeilen', async () => {
    const { titleBlockRows } = await import('../src/renderer/lib/titleBlockContent')
    const rows = titleBlockRows({ ...meta, titleBlock: { hidden: ['revision'] } }, stamp)
    expect(rows.some(([k]) => k === 'Revision')).toBe(false)
  })
})
