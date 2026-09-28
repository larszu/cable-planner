import { describe, expect, it } from 'vitest'
import { beantworteWerkzeug, mcpDigest, MCP_DIGEST_FORMAT } from '../src/renderer/lib/mcpWerkzeuge'
import { createDemoProject } from '../src/renderer/lib/demoProject'

// #874 — der Remote-MCP antwortet aus diesem Digest. Er muss dieselben
// Antworten tragen wie der lokale Server, sonst meldet Claude in der Cloud
// einen anderen Signalweg als auf dem Bildschirm.
describe('Digest fuer den Remote-MCP', () => {
  const p = createDemoProject()
  const d = mcpDigest(p) as {
    format: string
    devices: { id: string; ports: unknown[] }[]
    cables: { id: string }[]
    chains: Record<string, unknown[]>
    findings: { errorCount: number; findings: unknown[] }
  }

  it('traegt jede Signalkette, wie trace_signal sie meldet', () => {
    expect(d.format).toBe(MCP_DIGEST_FORMAT)
    expect(p.equipment.length).toBeGreaterThan(0)
    let mitKette = 0
    for (const e of p.equipment) {
      const lokal = beantworteWerkzeug(p, 'trace_signal', { deviceId: e.id }).daten.chains as unknown[]
      expect(d.chains[e.id] ?? []).toEqual(lokal)
      if (lokal.length) mitKette++
    }
    expect(mitKette).toBeGreaterThan(0)
  })

  it('traegt alle Geraete mit Anschluessen, alle Kabel und die ganze Planpruefung', () => {
    expect(d.devices).toHaveLength(p.equipment.length)
    const dp = beantworteWerkzeug(p, 'device_ports', { deviceId: p.equipment[0].id }).daten.ports
    expect(d.devices[0].ports).toEqual(dp)
    expect(d.cables).toHaveLength(p.cables.length)
    const pf = beantworteWerkzeug(p, 'plan_findings', {}).daten as { errorCount: number; total: number }
    expect(d.findings.errorCount).toBe(pf.errorCount)
    expect(d.findings.findings.length).toBe(pf.total)
  })
})
