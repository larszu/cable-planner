// Linien zeichnen, ohne dass der Plan dabei stehenbleibt.
//
// NUTZER-MELDUNG: „wenn man reingezoomt ist, dass er beim Linien zeichnen sich
// etwas aufgehaengt hat. also nicht abgestuerzt sondern nur aufgehaengt."
//
// GEMESSEN im Entwicklungsbau an 48 Geraeten und 117 Kabeln: jeder Knick hielt
// den Hauptthread 237 ms an (ein Long-Task), weil `addPendingWaypoint` das
// `pendingCable`-Objekt ersetzt und damit jedes Geraet und jede Kante neu
// zeichnete — `NodeRenderer` allein 95 ms, 768 Port-Griffe. Nach der Umstellung
// auf die schmalen Abonnements: 0 ms, kein Long-Task.
//
// Diese Datei haelt den Grund fest, nicht die Millisekunden: dass die Werte,
// die Geraet und Canvas abonnieren, sich beim Knicken NICHT aendern.
import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { useUiStore } from '../src/renderer/store/uiStore'
import { istStartBuchse, startBuchseAm } from '../src/renderer/lib/pendingCableSicht'

const GERAET = 'geraet-1'
const BUCHSE = 'buchse-7'

describe('die abonnierten Werte aendern sich beim Knicken nicht', () => {
  beforeEach(() => {
    useUiStore.getState().clearPendingCable()
  })

  it('die Startbuchse bleibt dieselbe, egal wie viele Knicke dazukommen', () => {
    const ui = useUiStore.getState()
    ui.startPendingCable({ nodeId: GERAET, handleId: BUCHSE, handleType: 'source' })
    const vorher = startBuchseAm(useUiStore.getState().pendingCable, GERAET)
    expect(vorher).not.toBeNull()

    for (let i = 0; i < 5; i++) useUiStore.getState().addPendingWaypoint({ x: i * 20, y: i * 20 })
    expect(useUiStore.getState().pendingCable?.waypoints).toHaveLength(5)

    // Der Wert, den `EquipmentNode` abonniert — unveraendert.
    expect(startBuchseAm(useUiStore.getState().pendingCable, GERAET)).toBe(vorher)
    // Und das Objekt selbst ist ein anderes: genau daran hing das Neuzeichnen.
    expect(useUiStore.getState().pendingCable).not.toBe(ui.pendingCable)
  })

  it('ein Geraet ohne Startbuchse sieht waehrend des Zeichnens durchgehend null', () => {
    useUiStore.getState().startPendingCable({ nodeId: GERAET, handleId: BUCHSE, handleType: 'source' })
    expect(startBuchseAm(useUiStore.getState().pendingCable, 'geraet-2')).toBeNull()
    useUiStore.getState().addPendingWaypoint({ x: 10, y: 10 })
    expect(startBuchseAm(useUiStore.getState().pendingCable, 'geraet-2')).toBeNull()
  })

  it('„wird gezeichnet" bleibt wahr, waehrend Knicke kommen und gehen', () => {
    const zeichnet = () => !!useUiStore.getState().pendingCable
    useUiStore.getState().startPendingCable({ nodeId: GERAET, handleId: BUCHSE, handleType: 'target' })
    expect(zeichnet()).toBe(true)
    useUiStore.getState().addPendingWaypoint({ x: 1, y: 1 })
    expect(zeichnet()).toBe(true)
    useUiStore.getState().removeLastPendingWaypoint()
    expect(zeichnet()).toBe(true)
    useUiStore.getState().rejectPendingCableEnd('inputToInput')
    expect(zeichnet()).toBe(true)
    useUiStore.getState().clearPendingCable()
    expect(zeichnet()).toBe(false)
  })

  it('die Startbuchse unterscheidet Eingang und Ausgang', () => {
    useUiStore.getState().startPendingCable({ nodeId: GERAET, handleId: BUCHSE, handleType: 'source' })
    const schluessel = startBuchseAm(useUiStore.getState().pendingCable, GERAET)
    expect(istStartBuchse(schluessel, BUCHSE, 'source')).toBe(true)
    expect(istStartBuchse(schluessel, BUCHSE, 'target')).toBe(false)
    expect(istStartBuchse(schluessel, 'andere-buchse', 'source')).toBe(false)
    expect(istStartBuchse(null, BUCHSE, 'source')).toBe(false)
  })
})

describe('niemand am Canvas abonniert das ganze pendingCable-Objekt', () => {
  // Die Umstellung waere in einer Zeile wieder weg: `useUiStore((s) =>
  // s.pendingCable)` liest sich harmlos. Nur `PendingCableOverlay` darf das —
  // es zeichnet die Knicke und muss sie deshalb sehen.
  const erlaubt = new Set(['PendingCableOverlay.tsx'])
  const dateien = [
    'src/renderer/components/Canvas/EquipmentNode.tsx',
    'src/renderer/components/Canvas/CanvasArea.tsx',
    'src/renderer/components/Canvas/PendingCableOverlay.tsx',
  ]

  for (const datei of dateien) {
    it(`${datei.split('/').pop()} abonniert hoechstens, OB gezeichnet wird`, () => {
      const quelle = readFileSync(datei, 'utf8')
      // Gesucht ist die eine Form, an der es hing: das OBJEKT als Ergebnis des
      // Selektors. `startBuchseAm(s.pendingCable, id)` daraus abzuleiten ist
      // erlaubt — das Ergebnis ist ein String und aendert sich beim Knicken nicht.
      const treffer = quelle.match(/useUiStore\(\s*\((?:s|state)\)\s*=>\s*(?:s|state)\.pendingCable\s*\)/g) ?? []
      if (erlaubt.has(datei.split('/').pop() as string)) {
        expect(treffer.length).toBeLessThanOrEqual(1)
      } else {
        expect(treffer).toEqual([])
      }
    })
  }
})
