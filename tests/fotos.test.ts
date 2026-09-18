// ───────────────────────────────────────────────────────────────────────────
// Fotos im Plan (#884) — die drei Zusagen, die sich messen lassen.
//
// 1. Ein Foto wird kleingerechnet, und zwar nur nach unten.
// 2. Die Sicherungskopie im Browser traegt die DATENSAETZE, nicht die
//    BILDER — das ist der ganze Grund fuer die zweite Ablage, und wenn es
//    jemand rueckgaengig macht, ist die Kopie nach zehn Fotos tot.
// 3. Ein Foto, dessen Bild fehlt, verschwindet nicht: es bleibt als leerer
//    Rahmen stehen und sagt damit, dass es eines gab.
// ───────────────────────────────────────────────────────────────────────────
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FOTO_BUDGET_BYTES,
  FOTO_KANTE_MAX,
  fotoMasse,
  fotosOhneZiel,
  fotosZu,
  hatBild,
  mitBilddaten,
  ohneBilddaten,
} from '../src/renderer/lib/fotoMasse'
import { zielMasse } from '../src/renderer/lib/fotoAufnahme'
import { scheduleProjectAutosave } from '../src/renderer/store/projectAutosave'
import { STORAGE_KEYS } from '../src/renderer/lib/storageKeys'
import type { Foto } from '../src/renderer/types/foto'
import type { CablePlannerProject } from '../src/renderer/types/project'

const foto = (id: string, ueber: Partial<Foto> = {}): Foto => ({
  id,
  dataUri: 'data:image/jpeg;base64,AAAA',
  breite: 1600,
  hoehe: 1200,
  bytes: 4,
  quelle: 'planer',
  hinzugefuegtAm: '2026-09-18T10:00:00.000Z',
  ...ueber,
})

describe('Zielmasse beim Aufnehmen', () => {
  it('rechnet die lange Kante auf das Mass herunter, Seitenverhaeltnis bleibt', () => {
    const { breite, hoehe } = zielMasse(4000, 3000)
    expect(breite).toBe(FOTO_KANTE_MAX)
    expect(hoehe).toBe(1200)
  })

  it('rechnet die HOCHkante genauso — nicht immer die Breite', () => {
    const { breite, hoehe } = zielMasse(3000, 4000)
    expect(hoehe).toBe(FOTO_KANTE_MAX)
    expect(breite).toBe(1200)
  })

  it('vergroessert nichts', () => {
    // Ein hochgerechnetes Bild hat mehr Pixel und nicht mehr Inhalt — und es
    // saehe im Bericht aus wie eine bessere Aufnahme.
    expect(zielMasse(800, 600)).toEqual({ breite: 800, hoehe: 600 })
  })

  it('kommt mit einem leeren Bild klar, statt durch null zu teilen', () => {
    expect(zielMasse(0, 0)).toEqual({ breite: 0, hoehe: 0 })
  })
})

describe('Masse und Zuordnung', () => {
  it('summiert die hinterlegten Groessen, statt die Zeichenketten zu messen', () => {
    const m = fotoMasse([foto('a', { bytes: 10 }), foto('b', { bytes: 5 })])
    expect(m).toEqual({ anzahl: 2, bytes: 15, ueberBudget: false })
  })

  it('meldet das Budget erst, wenn es ueberschritten IST', () => {
    expect(fotoMasse([foto('a', { bytes: FOTO_BUDGET_BYTES })]).ueberBudget).toBe(false)
    expect(fotoMasse([foto('a', { bytes: FOTO_BUDGET_BYTES + 1 })]).ueberBudget).toBe(true)
  })

  it('findet die Fotos zu einem Geraet und die ohne Ziel', () => {
    const fotos = [
      foto('a', { zeigtAuf: { equipmentId: 'e1' } }),
      foto('b', { zeigtAuf: { cableId: 'c1' } }),
      foto('c'),
    ]
    expect(fotosZu(fotos, { equipmentId: 'e1' }).map((f) => f.id)).toEqual(['a'])
    expect(fotosZu(fotos, { cableId: 'c1' }).map((f) => f.id)).toEqual(['b'])
    expect(fotosOhneZiel(fotos).map((f) => f.id)).toEqual(['c'])
  })
})

describe('Bilder trennen und wieder einsetzen', () => {
  it('nimmt die Bilddaten heraus und laesst den Datensatz stehen', () => {
    const [ohne] = ohneBilddaten([foto('a', { notiz: 'Patchfeld' })])
    expect(ohne.dataUri).toBe('')
    expect(ohne.notiz).toBe('Patchfeld')
    expect(hatBild(ohne)).toBe(false)
  })

  it('setzt ein, was die Ablage hergibt — und laesst den Rest als leeren Rahmen', () => {
    const fotos = ohneBilddaten([foto('a'), foto('b')])
    const zurueck = mitBilddaten(fotos, new Map([['a', 'data:image/jpeg;base64,XYZ']]))
    expect(zurueck[0].dataUri).toBe('data:image/jpeg;base64,XYZ')
    expect(zurueck[1].dataUri).toBe('')
    // Und vor allem: es sind immer noch ZWEI.
    expect(zurueck).toHaveLength(2)
  })

  it('ueberschreibt ein vorhandenes Bild nicht mit einem aelteren aus der Ablage', () => {
    const zurueck = mitBilddaten([foto('a')], new Map([['a', 'data:image/jpeg;base64,ALT']]))
    expect(zurueck[0].dataUri).toBe('data:image/jpeg;base64,AAAA')
  })
})

describe('die Sicherungskopie traegt die Fotos NICHT', () => {
  const projekt = (fotos: Foto[]): CablePlannerProject =>
    ({
      metadata: { name: 'p', description: '', createdAt: '', updatedAt: '' },
      equipment: [],
      cables: [],
      canvasState: { x: 0, y: 0, zoom: 1 },
      fotos,
    }) as unknown as CablePlannerProject

  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('schreibt die Datensaetze ohne Bilddaten', () => {
    // Die Rechnung dahinter steht in `lib/fotoMasse.ts`: mit Bilddaten waere
    // die Kopie nach zehn bis vierundzwanzig Fotos tot, und zwar leise.
    scheduleProjectAutosave(projekt([foto('a', { dataUri: 'data:image/jpeg;base64,GROSS' })]))
    vi.runAllTimers()
    const roh = localStorage.getItem(STORAGE_KEYS.projectAutosave) ?? ''
    expect(roh).not.toContain('GROSS')
    // Der Datensatz steht trotzdem drin — sonst waere das Foto nach einem
    // Absturz spurlos weg.
    expect(roh).toContain('"id":"a"')
  })
})
