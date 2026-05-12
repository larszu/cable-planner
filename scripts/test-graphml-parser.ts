// Direct test of the TS parser against real yEd files. Verifies:
//   - Recursive nested-graph traversal preserves parent::child IDs
//   - Label extraction works
//   - Key registry resolves attr.name correctly
//   - Edge endpoints validate
//
// Run: npx tsx scripts/test-graphml-parser.ts <path-to-graphml>

import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { parseGraphmlText } from '../src/renderer/lib/graphml/parser'

const file = process.argv[2]
if (!file) {
  console.error('Usage: npx tsx scripts/test-graphml-parser.ts <path-to-graphml>')
  process.exit(2)
}

const xml = readFileSync(file, 'utf-8')

const t0 = performance.now()
const { document: doc, warnings } = parseGraphmlText(xml)
const t1 = performance.now()

console.log(`File: ${file}`)
console.log(`Size: ${xml.length} bytes`)
console.log(`Parse time: ${(t1 - t0).toFixed(0)} ms`)
console.log(`Description: ${doc.description ?? '(none)'}`)
console.log(`Stats: ${doc.stats.nodeCount} nodes, ${doc.stats.edgeCount} edges, ${doc.stats.groupCount} groups`)
console.log(`Keys: ${doc.keys.length} declared`)
console.log(`Warnings: ${warnings.length}`)
const warnTypes = new Map<string, number>()
for (const w of warnings) warnTypes.set(w.code, (warnTypes.get(w.code) ?? 0) + 1)
for (const [code, n] of warnTypes) console.log(`  ${code}: ${n}`)

console.log('\n=== Top-level (root) nodes ===')
const rootNodes = doc.nodes.filter((n) => !n.parentId)
console.log(`count: ${rootNodes.length}`)
console.log('first 5 with labels:')
const withLabels = rootNodes.filter((n) => n.labels.length > 0).slice(0, 5)
withLabels.forEach((n) => {
  const main = n.labels[0]?.text
  const ip = n.labels.find((l) => /^ip[:\s]/i.test(l.text))?.text
  console.log(`  ${n.id} [${n.shapeType}/${n.shapePrimitive ?? '?'}] children=${n.childIds.length} name=${JSON.stringify(main)} ip=${JSON.stringify(ip)}`)
})

console.log('\n=== Container nodes (have children) ===')
const containers = doc.nodes.filter((n) => n.childIds.length > 0)
console.log(`count: ${containers.length}`)
containers.slice(0, 3).forEach((n) => {
  const main = n.labels[0]?.text
  console.log(`  ${n.id} (${n.childIds.length} children) ${JSON.stringify(main)}`)
  n.childIds.slice(0, 3).forEach((cid) => {
    const c = doc.nodes.find((x) => x.id === cid)
    console.log(`    ${cid}: labels=${JSON.stringify(c?.labels.map((l) => l.text))}`)
  })
})

console.log('\n=== Edges sample (first 3) ===')
doc.edges.slice(0, 3).forEach((e) => {
  console.log(`  ${e.id}: ${e.sourceId} -> ${e.targetId}`)
  console.log(`    data: ${JSON.stringify(e.data)}`)
  console.log(`    labels: ${JSON.stringify(e.labels)}`)
  console.log(`    line: color=${e.lineColor} type=${e.lineType}`)
})

console.log('\n=== Data field population ===')
const counts: Record<string, number> = {}
for (const n of doc.nodes) {
  for (const k of Object.keys(n.data)) counts[k] = (counts[k] ?? 0) + 1
}
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
sorted.slice(0, 15).forEach(([k, v]) => console.log(`  ${k}: ${v} nodes`))
if (sorted.length === 0) console.log('  (no node data fields populated)')

const ecounts: Record<string, number> = {}
for (const e of doc.edges) {
  for (const k of Object.keys(e.data)) ecounts[k] = (ecounts[k] ?? 0) + 1
}
console.log('Edge data:')
Object.entries(ecounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([k, v]) => console.log(`  ${k}: ${v} edges`))
if (Object.keys(ecounts).length === 0) console.log('  (no edge data populated)')

// Sample unique values for important fields
console.log('\n=== Unique values seen on edges ===')
for (const field of ['VideoStandard', 'CableType', 'CableLength', 'Supplier', 'SignalName']) {
  const vals = new Set<string>()
  for (const e of doc.edges) if (e.data[field]) vals.add(e.data[field])
  if (vals.size > 0) {
    console.log(`  ${field}: ${[...vals].slice(0, 10).join(', ')}`)
  }
}
