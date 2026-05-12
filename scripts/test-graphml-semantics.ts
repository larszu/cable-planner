// End-to-end smoke test: parse + semantic resolve. Verifies the full
// pipeline against real yEd files. Run:
//   npx tsx scripts/test-graphml-semantics.ts <path-to-graphml>

import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { parseGraphmlText } from '../src/renderer/lib/graphml/parser'
import { resolveGraphml } from '../src/renderer/lib/graphml/semantics'

const file = process.argv[2]
if (!file) {
  console.error('Usage: npx tsx scripts/test-graphml-semantics.ts <path-to-graphml>')
  process.exit(2)
}

const xml = readFileSync(file, 'utf-8')

const t0 = performance.now()
const { document, warnings } = parseGraphmlText(xml)
const t1 = performance.now()
const preview = resolveGraphml(document)
const t2 = performance.now()

console.log(`File: ${file}`)
console.log(`Size: ${xml.length} bytes`)
console.log(`Parse: ${(t1 - t0).toFixed(0)} ms`)
console.log(`Resolve: ${(t2 - t1).toFixed(0)} ms`)
console.log(`Source: ${document.stats.nodeCount} nodes, ${document.stats.edgeCount} edges`)
console.log(`Resolved: ${preview.devices.length} devices, ${preview.cables.length} cables`)
console.log(`Skipped: ${preview.skippedNodes.length} nodes, ${preview.unresolvedEdges.length} edges`)
console.log(`Warnings: ${warnings.length}`)

const byConf = { high: 0, medium: 0, low: 0 }
for (const d of preview.devices) byConf[d.confidence] += 1
console.log(`\nDevice confidence: high=${byConf.high} medium=${byConf.medium} low=${byConf.low}`)

console.log('\n=== Top 8 devices by port count ===')
const sortedByPorts = [...preview.devices]
  .sort((a, b) => b.inputs.length + b.outputs.length - (a.inputs.length + a.outputs.length))
  .slice(0, 8)
sortedByPorts.forEach((d) => {
  console.log(`  ${d.confidence.padEnd(6)} ${d.name.padEnd(50)} ${d.inputs.length}in/${d.outputs.length}out IP=${d.ipAddress ?? '-'} cat=${d.category}`)
})

console.log('\n=== Devices without ports (medium confidence) ===')
preview.devices
  .filter((d) => d.inputs.length + d.outputs.length === 0)
  .slice(0, 6)
  .forEach((d) => console.log(`  ${d.name} (${d.graphmlId}) [${d.size?.width}x${d.size?.height}]`))

console.log('\n=== Cable sample (first 6) ===')
preview.cables.slice(0, 6).forEach((c) => {
  console.log(`  ${c.inferredCableType.padEnd(15)} raw="${c.rawCableType ?? '-'}" std="${c.videoStandard ?? '-'}" len=${c.cableLengthMeters ?? '-'}m`)
  console.log(`    ${c.sourceDeviceImportKey.replace('graphml:', '')} ${c.sourcePortImportKey.split('|').slice(-1)}  →  ${c.targetDeviceImportKey.replace('graphml:', '')} ${c.targetPortImportKey.split('|').slice(-1)}`)
})

console.log('\n=== Cable type histogram ===')
const ctypes = new Map<string, number>()
for (const c of preview.cables) ctypes.set(c.inferredCableType, (ctypes.get(c.inferredCableType) ?? 0) + 1)
for (const [t, n] of [...ctypes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t}: ${n}`)
}

console.log('\n=== Connector type histogram (on resolved ports) ===')
const ptypes = new Map<string, number>()
for (const d of preview.devices) {
  for (const p of [...d.inputs, ...d.outputs]) {
    ptypes.set(p.connectorType, (ptypes.get(p.connectorType) ?? 0) + 1)
  }
}
for (const [t, n] of [...ptypes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t}: ${n}`)
}

if (preview.unresolvedEdges.length > 0) {
  console.log('\n=== First 5 unresolved edges ===')
  preview.unresolvedEdges.slice(0, 5).forEach((e) => {
    console.log(`  ${e.id}: ${e.sourceId} → ${e.targetId}  data=${JSON.stringify(e.data)}`)
  })
}
