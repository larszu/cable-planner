import { describe, expect, it } from 'vitest'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import { DEFAULT_ENABLED, MODULES } from '../src/renderer/lib/modules'
import { hatInnenansicht, innenansichtRolle } from '../src/renderer/lib/switching'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import canvasSrc from '../src/renderer/components/Canvas/CanvasArea.tsx?raw'
import appSrc from '../src/renderer/App.tsx?raw'

// #1240 Stufe 2 — Einstieg in die Innenansicht.

const ausKatalog = (name: string): EquipmentItem => {
  const e = BLACKMAGIC_CATALOG.find((x) => x.template.name === name)!
  return { ...e.template, id: 'x', x: 0, y: 0, deviceTypeId: e.deviceTypeId } as unknown as EquipmentItem
}

describe('Innenansicht', () => {
  it('ist ein Modul und ab Werk aus', () => {
    expect(MODULES.some((m) => m.id === 'switching')).toBe(true)
    expect(DEFAULT_ENABLED.switching).toBe(false)
  })

  it('Mischer und Kreuzschiene sind getrennte Ansichten', () => {
    expect(innenansichtRolle(ausKatalog('Blackmagic ATEM 2 M/E Constellation 4K'))).toBe('mixer')
    expect(innenansichtRolle(ausKatalog('Blackmagic Smart Videohub 40x40'))).toBe('router')
  })

  it('gibt es auch ohne Profil, wenn das Geraet ein Mischer ist — gesperrt wird nichts', () => {
    const ohne = { id: 'm', name: 'Fremder Mischer', category: 'Video Mixer', inputs: [], outputs: [] } as unknown as EquipmentItem
    expect(innenansichtRolle(ohne)).toBe('mixer')
    const kamera = { id: 'c', name: 'Kamera', category: 'Cameras', inputs: [], outputs: [] } as unknown as EquipmentItem
    expect(hatInnenansicht(kamera)).toBe(false)
  })

  it('Doppelklick und Kontextmenue oeffnen sie nur mit Modul; sie liegt als Ebene im Canvas-Bereich', () => {
    expect(canvasSrc).toMatch(/innenansichtAn && hatInnenansicht\(eq\)/)
    expect(canvasSrc).toMatch(/innenansichtAn && !isLocation && hatInnenansicht/)
    expect(appSrc).toMatch(/<CanvasArea \/>\s*\{\/\*[^*]*\*\/\}\s*<Innenansicht \/>/)
  })
})
