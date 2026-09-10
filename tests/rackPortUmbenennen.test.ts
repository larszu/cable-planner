import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { portsGleich } from '../src/renderer/lib/portsGleich'
import type { Port } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// #833 — „Name ändern von Geräte Port: Neuer Name wird nicht automatisch
// gespeichert" (Meldung des Eigentümers, 2026-09-10).
//
// GEMESSEN, bevor gebaut wurde. Drei Stellen binden ein Eingabefeld an
// `port.name`, und nur eine verlor die Eingabe:
//
//   PortList (Eigenschaften-Leiste)   schreibt je Tastendruck durch
//                                     `updateEquipment` — der globale
//                                     Autosave nimmt es mit. In Ordnung.
//   ModeEditorDialog                  Entwurf bis „Speichern", so gewollt
//                                     und im Kopf der Datei erklärt.
//   Verkabelungs-Sicht des Racks      DER FEHLER. Sie zeigt die ECHTEN
//                                     `EquipmentProperties` in einem
//                                     Scratch-Store, und der hat
//                                     ausdrücklich KEINEN Autosave. Der
//                                     Rückweg zum Builder-Draft trug bisher
//                                     nur Name und x/y — Ports nicht.
//
// Der Name stand also im Feld, sah gespeichert aus, und war beim nächsten
// Öffnen weg. Genau die Form, die am teuersten ist: das Werkzeug meldet
// Erfolg und hat nichts getan.
// ---------------------------------------------------------------------------

const port = (teil: Partial<Port> & { id: string }): Port =>
  ({
    name: teil.id,
    connectorType: 'BNC',
    ...teil,
  }) as Port

describe('Wann eine Port-Änderung zurückgemeldet wird', () => {
  it('meldet einen neuen Namen', () => {
    const vorher = [port({ id: 'p1', name: 'Input 1' })]
    const nachher = [port({ id: 'p1', name: 'Kamera 1' })]
    expect(portsGleich(vorher, nachher, [], [])).toBe(false)
  })

  it('meldet auch einen anderen Steckertyp oder Standard', () => {
    // Beides steht im Rack-Preset und beides ginge sonst genauso verloren.
    expect(
      portsGleich([port({ id: 'p1' })], [port({ id: 'p1', connectorType: 'XLR' })], [], []),
    ).toBe(false)
    expect(
      portsGleich(
        [],
        [],
        [port({ id: 'p1', standard: 'SDI' })],
        [port({ id: 'p1', standard: 'HDMI' })],
      ),
    ).toBe(false)
  })

  it('meldet einen hinzugefügten oder entfernten Port', () => {
    expect(portsGleich([port({ id: 'p1' })], [port({ id: 'p1' }), port({ id: 'p2' })], [], [])).toBe(
      false,
    )
    expect(portsGleich([port({ id: 'p1' }), port({ id: 'p2' })], [port({ id: 'p1' })], [], [])).toBe(
      false,
    )
  })

  it('trennt Eingänge von Ausgängen', () => {
    // Sonst hielte ein Ausgang „In 1" eine Änderung am gleichnamigen Eingang
    // für erledigt.
    expect(portsGleich([port({ id: 'p1' })], [], [], [port({ id: 'p1' })])).toBe(false)
  })

  it('schweigt bei einer NEUEN LISTE mit demselben Inhalt', () => {
    // DIE GEGENPROBE, und der Grund für diese Funktion. `updateEquipment`
    // baut die Port-Listen bei jeder Änderung neu — auch wenn nur jemand das
    // Gerät zieht. Ein Referenz-Vergleich (`prev.inputs !== next.inputs`)
    // wäre dann bei JEDEM Zug-Bild wahr und schriebe den Draft im Takt der
    // Bildwiederholung um.
    const a = [port({ id: 'p1', name: 'Kamera 1' })]
    const b = [port({ id: 'p1', name: 'Kamera 1' })]
    expect(a).not.toBe(b)
    expect(portsGleich(a, b, [], [])).toBe(true)
  })

  it('schweigt bei leeren Listen', () => {
    expect(portsGleich([], [], [], [])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Der Rückweg besteht aus drei Gliedern. Fehlt eines, ist die Kette still
// unterbrochen — und still ist genau die Eigenschaft, die den Fehler so lange
// hat stehen lassen.
// ---------------------------------------------------------------------------

const lies = (...pfad: string[]) =>
  readFileSync(resolve(__dirname, '..', 'src', 'renderer', ...pfad), 'utf8')

describe('Der Rückweg vom Scratch-Store in den Builder-Draft', () => {
  it('die Verkabelungs-Sicht meldet Port-Änderungen', () => {
    const src = lies('components', 'Rack', 'RackInternalCanvas.tsx')
    expect(src).toMatch(/import \{ portsGleich \} from '\.\.\/\.\.\/lib\/portsGleich'/)
    expect(src).toMatch(/onPlacementPortsChanged\?\s*:/)
    expect(src).toMatch(/onPlacementPortsChanged\(eq\.id, \{ inputs: eq\.inputs, outputs: eq\.outputs \}\)/)
  })

  it('das Overlay reicht sie durch', () => {
    const src = lies('components', 'Rack', 'RackInternalWireOverlay.tsx')
    expect(src).toMatch(/onPlacementPortsChanged=\{onPlacementPortsChanged\}/)
  })

  it('der Builder schreibt sie in den Draft', () => {
    // `updatePlacement` ist die einzige Stelle, an der ein Port-Name den
    // Dialog überlebt: `presetFromDraft` liest `inputs`/`outputs` von dort.
    const src = lies('components', 'Rack', 'RackBuilderDialog.tsx')
    expect(src).toMatch(
      /onPlacementPortsChanged=\{\(placementId, ports\) => \{[\s\S]{0,400}?updatePlacement\(placementId, \{ inputs: ports\.inputs, outputs: ports\.outputs \}\)/,
    )
  })
})
