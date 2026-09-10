import { describe, expect, it } from 'vitest'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import { gruppenBefunde } from '../src/renderer/lib/portGroups'
import {
  istVorgabename,
  vorschlagBeiVorgabename,
} from '../src/renderer/lib/portDefaultName'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// #838 — Zwei Folgearbeiten aus #832, und beide haben dieselbe Form: eine
// Angabe, die es gibt, wird an der Stelle nicht gelesen, an der sie zaehlt.
//
// ─── 1 · DIE GRUPPE, DIE NIEMAND MEHR OEFFNET ──────────────────────────────
//
// `gruppenBefunde()` rechnet seit #832 richtig — angezeigt wurde das Ergebnis
// aber NUR in der Eigenschaften-Leiste, also nur solange jemand genau dieses
// Geraet offen hat. Der teure Fall ist der andere: eine Gruppe, die vor
// Wochen halb angelegt wurde. Ein Powerlock-Satz ohne PE (`erwartet 5, ist
// 4`) faellt so bis in den Saal nicht auf.
//
// ─── 2 · `In 5` IST EIN NAME UND KEINE VORGABE ─────────────────────────────
//
// `renameIfDefault` (#175) benennt beim Steckertyp-Wechsel um, solange der
// Name auf `Input 1` / `In 3` / `Out 4` passt. Wer einen Port BEWUSST `In 5`
// nennt, ist davon nicht zu unterscheiden und verliert ihn. Die Regel bleibt
// — sie fragt jetzt zuerst `nameFromUser`.
//
// Die Regel stand als Closure in `PortList.tsx` und war von hier aus
// unerreichbar. Dass dieser Test existiert, ist der halbe Fix.
// ---------------------------------------------------------------------------

const port = (teil: Partial<Port> & { id: string }): Port =>
  ({ name: teil.id, connectorType: 'BNC', ...teil }) as Port

const geraet = (teil: Partial<EquipmentItem> & { id: string }): EquipmentItem =>
  ({
    name: teil.id,
    type: 'other',
    category: 'Sonstiges',
    x: 0,
    y: 0,
    inputs: [],
    outputs: [],
    ...teil,
  }) as EquipmentItem

const powerlock = (rollen: string[]): Port[] =>
  rollen.map((r, i) =>
    port({
      id: `pl-${i}`,
      portGroup: 'PL-IN',
      portGroupKind: 'powerlock',
      portGroupRole: r,
    }),
  )

describe('Port-Gruppen stehen im Plan-Check', () => {
  it('meldet den Powerlock-Satz ohne PE — der Fall, um den es geht', () => {
    const e = geraet({ id: 'v1', name: 'Verteiler A', inputs: powerlock(['L1', 'L2', 'L3', 'N']) })
    const befunde = runDrawingChecks({ equipment: [e], cables: [] }).findings
    const treffer = befunde.filter((f) => f.category === 'Port group')
    expect(treffer).toHaveLength(1)
    expect(treffer[0].severity).toBe('warning')
    // Der Geraetename steht davor: auf dem Blatt liegen die Befunde aller
    // Geraete nebeneinander, und `Gruppe PL-IN` allein sagt nicht, welches.
    expect(treffer[0].message).toContain('Verteiler A')
    expect(treffer[0].message).toContain('4 of 5')
    expect(treffer[0].equipmentId).toBe('v1')
  })

  it('schweigt beim vollstaendigen Satz — die Gegenprobe', () => {
    const e = geraet({
      id: 'v1',
      inputs: powerlock(['L1', 'L2', 'L3', 'N', 'PE']),
    })
    const befunde = runDrawingChecks({ equipment: [e], cables: [] }).findings
    expect(befunde.filter((f) => f.category === 'Port group')).toEqual([])
  })

  it('prueft jede Seite fuer sich — zwei halbe Gruppen sind zwei Befunde', () => {
    // Zusammengeschuettet waeren `SP-1` auf beiden Seiten EINE Gruppe mit zwei
    // Mitgliedern, also vollstaendig — und der Plan meldete nichts, obwohl
    // links wie rechts ein Kanal fehlt. Eine Gruppe ueber Ein- und Ausgaenge
    // hinweg waere ohnehin keine Gruppe, sondern eine Durchschleife.
    const halb = (id: string) => [port({ id, portGroup: 'SP-1', portGroupKind: 'stereo' })]
    const e = geraet({ id: 'm1', name: 'Mischer', inputs: halb('a'), outputs: halb('b') })
    const treffer = runDrawingChecks({ equipment: [e], cables: [] }).findings.filter(
      (f) => f.category === 'Port group',
    )
    expect(treffer).toHaveLength(2)
    expect(treffer.map((f) => f.id)).toEqual([
      'port-group-groesse:m1:inputs:SP-1',
      'port-group-groesse:m1:outputs:SP-1',
    ])
    expect(treffer.filter((f) => f.message.includes(' IN ·'))).toHaveLength(1)
    expect(treffer.filter((f) => f.message.includes(' OUT ·'))).toHaveLength(1)
  })

  it('der Satz steht EINMAL — der Plan-Check formuliert ihn nicht neu', () => {
    // Die Eigenschaften-Leiste und das gedruckte Blatt zeigen denselben
    // Befund. Formulierte ihn jede Seite selbst, liefen die beiden Fassungen
    // beim naechsten Umbau auseinander — deshalb traegt der Befund seinen
    // Satz mit sich, und der Plan-Check setzt nur den Geraetenamen davor.
    const ports = powerlock(['L1', 'L2', 'L3', 'N'])
    const [b] = gruppenBefunde(ports)
    expect(b.schluessel).toBe('ports.group.sizeMismatch')
    expect(b.werte).toEqual({ group: 'PL-IN', is: 4, expected: 5 })

    const e = geraet({ id: 'v1', name: 'Verteiler A', inputs: ports })
    const [f] = runDrawingChecks({ equipment: [e], cables: [] }).findings.filter(
      (x) => x.category === 'Port group',
    )
    expect(f.message.endsWith(b.text)).toBe(true)
  })
})

describe('Ein getippter Port-Name gehoert dem Nutzer', () => {
  it('benennt einen Vorgabenamen weiter um — die Regel aus #175 bleibt', () => {
    const ports = [port({ id: 'p1', name: 'Input 1' })]
    expect(vorschlagBeiVorgabename(ports, 'p1', 'SDI')).toBe('SDI 1')
  })

  it('behaelt `In 5`, wenn es jemand selbst getippt hat', () => {
    // DER FALL AUS DEM ISSUE. Ohne das Merkmal ist `In 5` von einem
    // Vorgabenamen nicht zu unterscheiden — beides passt auf dasselbe Muster.
    const ports = [port({ id: 'p1', name: 'In 5', nameFromUser: true })]
    expect(vorschlagBeiVorgabename(ports, 'p1', 'SDI')).toBeNull()
    // Und die Gegenprobe: OHNE das Merkmal verliert er ihn weiter. Der Test
    // haelt damit fest, dass das Merkmal die Entscheidung traegt und nicht
    // etwa das Muster nebenher aufgeweicht wurde.
    expect(vorschlagBeiVorgabename([port({ id: 'p1', name: 'In 5' })], 'p1', 'SDI')).toBe(
      'SDI 5',
    )
  })

  it('nimmt die Nummer aus dem Namen und nicht aus der Position', () => {
    const ports = [port({ id: 'a', name: 'Camera' }), port({ id: 'p1', name: 'Input 3' })]
    expect(vorschlagBeiVorgabename(ports, 'p1', 'SDI')).toBe('SDI 3')
  })

  it('faellt auf die Position zurueck, wo der Name keine Nummer traegt', () => {
    const ports = [port({ id: 'a', name: 'Camera' }), port({ id: 'p1', name: 'In' })]
    expect(vorschlagBeiVorgabename(ports, 'p1', 'SDI')).toBe('SDI 2')
  })

  it('laesst einen echten Namen unangetastet, auch ohne Merkmal', () => {
    const ports = [port({ id: 'p1', name: 'Kamera links' })]
    expect(vorschlagBeiVorgabename(ports, 'p1', 'SDI')).toBeNull()
  })

  it('kennt die vier Vorgabeformen und sonst nichts', () => {
    for (const n of ['Input 1', 'Output 2', 'In 3', 'Out 4', 'in', 'OUT']) {
      expect(istVorgabename(n)).toBe(true)
    }
    for (const n of ['Kamera 1', 'SDI 1', 'Intercom In', 'In-Ear 2']) {
      expect(istVorgabename(n)).toBe(false)
    }
  })
})
