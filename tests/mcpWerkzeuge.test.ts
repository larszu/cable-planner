import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MCP_WERKZEUGE, beantworteWerkzeug } from '../src/renderer/lib/mcpWerkzeuge'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

// ---------------------------------------------------------------------------
// #872 Stufe 1 — was der MCP-Server antwortet.
//
// DIE TEUERSTE DEFEKTFORM HIER IST NICHT DER ABSTURZ, SONDERN DIE FALSCHE
// AUSKUNFT: ein Assistent, der eine andere Signalkette meldet als der Plan auf
// dem Bildschirm, wird geglaubt. Deshalb rechnet dieses Modul NICHTS selbst —
// es ruft `signalChains` und `runDrawingChecks` auf, dieselben Funktionen wie
// die Oberflaeche. Die Tests halten beides fest: die Form der Antwort und
// dass nichts geschrieben wird.
// ---------------------------------------------------------------------------

const port = (id: string, name: string, connectorType = 'BNC') => ({
  id,
  name,
  type: connectorType,
  connectorType,
}) as never

const geraet = (teil: Partial<EquipmentItem> & { id: string; name: string }): EquipmentItem =>
  ({
    category: 'Video',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 96,
    ...teil,
  }) as unknown as EquipmentItem

const kabel = (teil: Partial<Cable> & { id: string }): Cable =>
  ({
    fromEquipmentId: 'cam',
    fromPortId: 'cam-out',
    toEquipmentId: 'mix',
    toPortId: 'mix-in',
    type: 'BNC',
    ...teil,
  }) as unknown as Cable

const plan = (): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [
      geraet({ id: 'cam', name: 'Kamera 1', outputs: [port('cam-out', 'SDI Out')] }),
      geraet({
        id: 'mix',
        name: 'Mischer',
        category: 'Switcher',
        inputs: [port('mix-in', 'In 1')],
        outputs: [port('mix-out', 'PGM')],
      }),
      geraet({ id: 'mon', name: 'Monitor', inputs: [port('mon-in', 'SDI In')] }),
    ],
    cables: [
      kabel({ id: 'c1', name: 'Kamera 1 → Mischer', cableNumber: 'K001', length: 12 }),
      kabel({
        id: 'c2',
        name: 'PGM → Monitor',
        fromEquipmentId: 'mix',
        fromPortId: 'mix-out',
        toEquipmentId: 'mon',
        toPortId: 'mon-in',
      }),
    ],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

describe('#872 — die Werkzeuge', () => {
  it('kennt genau die fuenf Fragen aus Stufe 1', () => {
    expect([...MCP_WERKZEUGE]).toEqual([
      'list_devices',
      'device_ports',
      'trace_signal',
      'list_cables',
      'plan_findings',
    ])
  })

  it('antwortet auf ein unbekanntes Werkzeug mit einem Satz statt zu werfen', () => {
    // Der Server steht zwischen zwei Programmen. Eine Ausnahme dort wird zu
    // einem Stapelabzug statt zu einer Auskunft.
    const a = beantworteWerkzeug(plan(), 'delete_everything')
    expect(a.text).toContain('Unknown tool')
    expect(a.daten.known).toEqual([...MCP_WERKZEUGE])
  })
})

describe('#872 — Geraete und Ports', () => {
  it('zaehlt und filtert', () => {
    const alle = beantworteWerkzeug(plan(), 'list_devices')
    expect(alle.daten.total).toBe(3)
    const gefiltert = beantworteWerkzeug(plan(), 'list_devices', { query: 'kam' })
    expect(gefiltert.daten.total).toBe(1)
  })

  it('paginiert und sagt, wie viele es insgesamt sind', () => {
    // Die Gesamtzahl gehoert in die Antwort: ein Modell, das zehn von
    // achthundert Zeilen sieht und es nicht weiss, sagt „das sind alle".
    const seite = beantworteWerkzeug(plan(), 'list_devices', { limit: 2, offset: 1 })
    expect(seite.daten.total).toBe(3)
    expect((seite.daten.devices as unknown[]).length).toBe(2)
    expect(seite.daten.offset).toBe(1)
  })

  it('findet ein Geraet ueber Id ODER Namen', () => {
    expect(beantworteWerkzeug(plan(), 'device_ports', { deviceId: 'mix' }).daten.found).toBe(true)
    expect(beantworteWerkzeug(plan(), 'device_ports', { deviceId: 'Mischer' }).daten.found).toBe(true)
  })

  it('sagt bei einem unbekannten Geraet „gibt es nicht" und liefert keine leere Liste', () => {
    const a = beantworteWerkzeug(plan(), 'device_ports', { deviceId: 'Nebelmaschine' })
    expect(a.daten.found).toBe(false)
    expect(a.text).toContain('No device')
  })
})

describe('#872 — die Signalkette kommt aus DERSELBEN Rechnung wie der Plan', () => {
  it('folgt der Kamera bis zum Monitor', () => {
    const a = beantworteWerkzeug(plan(), 'trace_signal', { deviceId: 'Kamera 1' })
    expect(a.daten.found).toBe(true)
    const ketten = a.daten.chains as Array<{ steps: Array<{ to: string }> }>
    expect(ketten.length).toBeGreaterThan(0)
    expect(JSON.stringify(ketten)).toContain('Mischer')
  })
})

describe('#872 — Kabel', () => {
  it('gibt beide Enden mit Namen und die Laenge', () => {
    const a = beantworteWerkzeug(plan(), 'list_cables', { query: 'K001' })
    const zeilen = a.daten.cables as Array<Record<string, unknown>>
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].from).toBe('Kamera 1')
    expect(zeilen[0].to).toBe('Mischer')
    expect(zeilen[0].lengthM).toBe(12)
  })

  it('eine Laenge, die niemand eingetragen hat, ist null und nicht 0', () => {
    // 0 m liest sich wie eine Messung. Auf einer Packliste ist das der
    // Unterschied zwischen „kein Kabel noetig" und „niemand hat nachgesehen".
    const a = beantworteWerkzeug(plan(), 'list_cables', { query: 'PGM' })
    expect((a.daten.cables as Array<Record<string, unknown>>)[0].lengthM).toBeNull()
  })
})

describe('#872 — der Plan-Check', () => {
  it('liefert die Zaehlungen der Fussleiste', () => {
    const a = beantworteWerkzeug(plan(), 'plan_findings')
    expect(typeof a.daten.errorCount).toBe('number')
    expect(typeof a.daten.warningCount).toBe('number')
    expect(a.text).toContain('errors')
  })

  it('filtert nach Schwere', () => {
    const nurFehler = beantworteWerkzeug(plan(), 'plan_findings', { severity: 'error' })
    const alle = (nurFehler.daten.findings as Array<{ severity: string }>).every(
      (f) => f.severity === 'error',
    )
    expect(alle).toBe(true)
  })
})

describe('#872 — nur lesend, und zwar nachweisbar', () => {
  it('die Quelldatei schreibt nichts', () => {
    // Stufe 1 ist read-only. Ein `set`, ein Store-Zugriff oder ein `fetch`
    // hier waere genau die Grenzueberschreitung, die #873 erst noch
    // entscheiden soll.
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'lib', 'mcpWerkzeuge.ts'),
      'utf8',
    )
    const ohneKommentare = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(ohneKommentare).not.toMatch(/useProjectStore|localStorage|fetch\(|\.setState\(/)
  })

  it('der Plan bleibt unveraendert', () => {
    const p = plan()
    const vorher = JSON.stringify(p)
    for (const w of MCP_WERKZEUGE) beantworteWerkzeug(p, w, { deviceId: 'mix' })
    expect(JSON.stringify(p)).toBe(vorher)
  })
})
