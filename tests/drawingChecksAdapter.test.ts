import { describe, expect, it } from 'vitest'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

// ---------------------------------------------------------------------------
// B-46, Check 21 — der Adapter im Plan-Check.
//
// Der gefaehrliche Fall ist nicht der Adapter, der FEHLT — der faellt beim
// Aufbau auf. Es ist der, den der Plan als „passt" zeichnet, obwohl die Quelle
// es nicht kann. Deshalb pruefen die Zusicherungen hier vor allem, was der
// Check NICHT sagt.
// ---------------------------------------------------------------------------

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e',
  name: 'Gerät',
  category: 'Video',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const kabel = (over: Partial<Cable>): Cable => ({
  id: 'c',
  fromEquipmentId: 'a',
  fromPortId: 'a-out',
  toEquipmentId: 'b',
  toPortId: 'b-in',
  type: 'HDMI',
  ...over,
})

/** Rechner -> Adapter -> Monitor, mit den Steckern, die wirklich dranstecken. */
const strecke = (adapterUeber: Partial<EquipmentItem>, quelleKann?: string[]) => ({
  equipment: [
    eq({
      id: 'pc',
      name: 'Regie-Rechner',
      ...(quelleKann ? { kann: quelleKann } : {}),
      outputs: [{ id: 'pc-out', name: 'USB-C', type: 'USB-C', connectorType: 'USB-C' }],
    }),
    eq({
      id: 'ad',
      name: 'Adapter 1',
      inputs: [{ id: 'ad-in', name: 'in', type: 'USB-C', connectorType: 'USB-C' }],
      outputs: [{ id: 'ad-out', name: 'out', type: 'DisplayPort', connectorType: 'DisplayPort' }],
      ...adapterUeber,
    }),
    eq({
      id: 'mon',
      name: 'Monitor',
      inputs: [{ id: 'mon-in', name: 'DP', type: 'DisplayPort', connectorType: 'DisplayPort' }],
    }),
  ],
  cables: [
    kabel({ id: 'c1', fromEquipmentId: 'pc', fromPortId: 'pc-out', toEquipmentId: 'ad', toPortId: 'ad-in' }),
    kabel({ id: 'c2', fromEquipmentId: 'ad', fromPortId: 'ad-out', toEquipmentId: 'mon', toPortId: 'mon-in' }),
  ],
})

describe('Check 21 — der Adapter, den die Quelle nicht bedienen kann', () => {
  it('meldet die unbestaetigte Voraussetzung, statt nichts zu sagen', () => {
    const { findings } = runDrawingChecks(
      strecke({
        adapter: {
          von: 'USB-C',
          nach: 'DisplayPort',
          richtung: 'einweg',
          speisung: 'aktiv-aus-quelle',
          setztVoraus: 'DisplayPort Alternate Mode',
        },
      }),
    )
    const f = findings.filter((x) => x.category === 'Adapter')
    expect(f).toHaveLength(1)
    expect(f[0].id).toContain('adapter-offen')
    expect(f[0].message).toContain('DisplayPort Alternate Mode')
    expect(f[0].equipmentId).toBe('ad')
  })

  it('schweigt, sobald das Quellgerät es erklärt hat', () => {
    const { findings } = runDrawingChecks(
      strecke(
        {
          adapter: {
            von: 'USB-C',
            nach: 'DisplayPort',
            richtung: 'einweg',
            speisung: 'aktiv-aus-quelle',
            setztVoraus: 'DisplayPort Alternate Mode',
          },
        },
        ['DisplayPort Alternate Mode'],
      ),
    )
    expect(findings.filter((x) => x.category === 'Adapter')).toEqual([])
  })

  it('ein verkehrt herum gesteckter Einweg-Adapter ist ein FEHLER, kein Hinweis', () => {
    const { findings } = runDrawingChecks(
      strecke({
        // Die Seiten stehen verkehrt zu dem, woran der Adapter haengt.
        adapter: {
          von: 'DisplayPort',
          nach: 'USB-C',
          richtung: 'einweg',
          speisung: 'passiv',
        },
      }),
    )
    const f = findings.filter((x) => x.category === 'Adapter')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('error')
  })

  it('ein Adapter ohne Angaben ergibt einen Hinweis — und nicht nichts', () => {
    // „Nichts" hiesse auf dem Blatt „geprüft und in Ordnung". Genau das ist er
    // nicht: über ihn ist nichts bekannt.
    const { findings } = runDrawingChecks(
      strecke({
        adapter: { von: 'USB-C', nach: 'DisplayPort', richtung: 'unbekannt', speisung: 'unbekannt' },
      }),
    )
    const f = findings.filter((x) => x.category === 'Adapter')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('info')
  })

  it('ein Adapter, der nur an einer Seite hängt, wird gemeldet', () => {
    const { findings } = runDrawingChecks({
      equipment: [
        eq({
          id: 'ad',
          name: 'Adapter 1',
          inputs: [{ id: 'ad-in', name: 'in', type: 'USB-C', connectorType: 'USB-C' }],
          adapter: { von: 'USB-C', nach: 'DisplayPort', richtung: 'einweg', speisung: 'passiv' },
        }),
      ],
      cables: [],
    })
    const f = findings.filter((x) => x.category === 'Adapter')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('warning')
    expect(f[0].id).toContain('adapter-unverkabelt')
  })

  it('ein Gerät ohne Adapter-Angaben erzeugt gar keinen Adapter-Befund', () => {
    const { findings } = runDrawingChecks(strecke({}))
    expect(findings.some((x) => x.category === 'Adapter')).toBe(false)
  })
})
