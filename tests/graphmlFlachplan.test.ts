import { describe, expect, it } from 'vitest'
import { parseGraphmlText } from '../src/renderer/lib/graphml/parser'
import { buildImportPayload, resolveGraphml } from '../src/renderer/lib/graphml/semantics'

// Flat yEd installation plans as drawn by hand: a device is a body box
// with connector cells hanging OUTSIDE its edge, function cells inside,
// caption-only bodies under a whole table, vertical name strips, empty
// frames. Built after a real 1250-node show plan whose import found 1 of
// 176 cables before.

type Box = { id: string; x: number; y: number; w: number; h: number; text?: string }
type Line = { id: string; s: string; t: string; sx?: number; sy?: number; tx?: number; ty?: number }

const node = (b: Box) => `
    <node id="${b.id}"><data key="d6"><y:ShapeNode>
      <y:Geometry height="${b.h}" width="${b.w}" x="${b.x}" y="${b.y}"/>
      ${b.text ? `<y:NodeLabel>${b.text}</y:NodeLabel>` : ''}
    </y:ShapeNode></data></node>`

const edge = (e: Line) => `
    <edge id="${e.id}" source="${e.s}" target="${e.t}"><data key="d10"><y:PolyLineEdge>
      <y:Path sx="${e.sx ?? 0}" sy="${e.sy ?? 0}" tx="${e.tx ?? 0}" ty="${e.ty ?? 0}"/>
    </y:PolyLineEdge></data></edge>`

const doc = (boxes: Box[], lines: Line[], extra = '') => `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">
  <key for="node" id="d6" yfiles.type="nodegraphics"/>
  <key for="edge" id="d10" yfiles.type="edgegraphics"/>
  <graph edgedefault="directed" id="G">${boxes.map(node).join('')}${extra}${lines.map(edge).join('')}
  </graph>
</graphml>`

const rows = (prefix: string, x: number, y: number, w: number, labels: string[]): Box[] =>
  labels.map((text, i) => ({ id: `${prefix}${i}`, x, y: y + i * 20, w, h: 20, text }))

const boxes: Box[] = [
  // Mixer: body, input cells left outside, function cells inside, outputs right outside.
  { id: 'mix', x: 100, y: 0, w: 300, h: 200, text: 'Constellation HD' },
  ...rows('mixIn', 20, 0, 80, ['3G/SDI In 1', '3G/SDI In 2', '3G/SDI In 3']),
  ...rows('mixFn', 100, 0, 120, ['Cam 1', 'Cam 2', 'Cam 3']),
  ...rows('mixOut', 400, 0, 91, ['3G/SDI Out 1', '3G/SDI Out 2']),
  { id: 'mixIp', x: 280, y: 150, w: 110, h: 40, text: 'Net. 10.0.0.21' },
  // Matrix drawn as a table; the body is only a caption block below it.
  { id: 'hdrIn', x: 1000, y: -40, w: 80, h: 40, text: 'Input' },
  ...rows('hubIn', 1000, 0, 80, ['3G/SDI In 1', '3G/SDI In 2', '3G/SDI In 3']),
  ...rows('hubSrc', 1080, 0, 120, ['Mixer PGM', 'Mixer Cam 1', 'tba']),
  ...rows('hubOut', 1200, 0, 120, ['Output 1', 'Output 2', 'Output 3']),
  { id: 'hub', x: 1000, y: 60, w: 320, h: 60, text: 'Smart Videohub' },
  // Camera: vertical name strip over a body that still carries a stale caption.
  { id: 'camName', x: 0, y: 600, w: 40, h: 140, text: 'Camera Sony FX6' },
  { id: 'camBody', x: 0, y: 620, w: 160, h: 120, text: 'Old caption' },
  ...rows('camOut', 160, 620, 80, ['12G-SDI Out', 'HDMI 2.0']),
  // Computer: empty frame, name strip, software caption inside the frame.
  { id: 'macFrame', x: 600, y: 600, w: 160, h: 170 },
  { id: 'macName', x: 600, y: 600, w: 40, h: 170, text: 'Apple MacMini' },
  { id: 'macSw', x: 640, y: 700, w: 120, h: 40, text: 'ProPresenter 7' },
  ...rows('macOut', 760, 600, 80, ['HDMI Out', 'USB C 1']),
  // Patch panel: cables are drawn onto the empty strip, not onto the cells.
  { id: 'patch', x: 1600, y: 600, w: 300, h: 200, text: 'Patchfeld' },
  { id: 'patchStrip', x: 1520, y: 600, w: 80, h: 60 },
  ...rows('patchIn', 1440, 600, 80, ['3G/SDI In 1', '3G/SDI In 2', '3G/SDI In 3']),
  // A monitor drawn as nothing but one cell.
  { id: 'lone', x: 2400, y: 0, w: 164, h: 20, text: 'Monitor Regie' },
]

const lines: Line[] = [
  { id: 'e0', s: 'mixOut0', t: 'hubIn0' },
  { id: 'e1', s: 'mixOut1', t: 'hubIn1' },
  // Matrix output labelled with its destination ("Mixer In 3"-style) feeds back.
  { id: 'e2', s: 'hubOut0', t: 'mixIn2' },
  // Arrow drawn backwards: from the camera input to the camera output.
  { id: 'e3', s: 'mixIn0', t: 'camOut0' },
  { id: 'e4', s: 'macOut0', t: 'mixIn1' },
  // Onto the patch strip at its centre (y=630), which is row 2 (620-640).
  { id: 'e5', s: 'hubOut1', t: 'patchStrip' },
  { id: 'e6', s: 'hubOut2', t: 'lone' },
  { id: 'e7', s: 'macOut1', t: 'patchStrip', tx: 0, ty: -20 },
  // Re-entry: the mixer's own output back into its input.
  { id: 'e8', s: 'mixOut1', t: 'mixIn2' },
]

const legend = `
    <node id="leg"><data key="d6"><y:GroupNode>
      <y:Geometry height="200" width="300" x="-2000" y="2000"/>
      <y:NodeLabel>Kabellegende Video</y:NodeLabel>
    </y:GroupNode></data>
      <graph id="leg:">
        <node id="leg::a"><data key="d6"><y:ShapeNode><y:Geometry height="30" width="55" x="-1990" y="2040"/><y:NodeLabel>SDI A</y:NodeLabel></y:ShapeNode></data></node>
        <node id="leg::b"><data key="d6"><y:ShapeNode><y:Geometry height="30" width="55" x="-1800" y="2040"/><y:NodeLabel>SDI B</y:NodeLabel></y:ShapeNode></data></node>
        <edge id="leg::e0" source="leg::a" target="leg::b"/>
      </graph>
    </node>`

const preview = () => resolveGraphml(parseGraphmlText(doc(boxes, lines, legend)).document)
const byName = (p: ReturnType<typeof preview>, name: string) => {
  const d = p.devices.find((x) => x.name === name)
  if (!d) throw new Error(`device "${name}" missing; have ${p.devices.map((x) => x.name).join(', ')}`)
  return d
}
const cableBetween = (p: ReturnType<typeof preview>, edgeId: string) => {
  const c = p.cables.find((x) => x.graphmlEdgeId === edgeId)
  if (!c) throw new Error(`cable ${edgeId} missing`)
  const port = (devKey: string, portKey: string) => {
    const d = p.devices.find((x) => x.importKey === devKey)!
    return `${d.name}:${[...d.inputs, ...d.outputs].find((x) => x.importKey === portKey)!.name}`
  }
  return `${port(c.sourceDeviceImportKey, c.sourcePortImportKey)} -> ${port(c.targetDeviceImportKey, c.targetPortImportKey)}`
}

describe('yEd flat installation plan', () => {
  it('resolves every cable except the legend samples', () => {
    const p = preview()
    expect(p.cables.map((c) => c.graphmlEdgeId).sort()).toEqual(lines.map((l) => l.id).sort())
    expect(p.unresolvedEdges.map((e) => e.id)).toEqual(['leg::e0'])
  })

  it('creates exactly the drawn devices', () => {
    expect(preview().devices.map((d) => d.name).sort()).toEqual(
      ['Apple MacMini', 'Camera Sony FX6', 'Constellation HD', 'Monitor Regie', 'Patchfeld', 'Smart Videohub'].sort(),
    )
  })

  it('takes connector cells outside the body as ports, function cells as signal', () => {
    const mix = byName(preview(), 'Constellation HD')
    expect(mix.inputs.map((p) => [p.name, p.signal])).toEqual([
      ['3G/SDI In 1', 'Cam 1'],
      ['3G/SDI In 2', 'Cam 2'],
      ['3G/SDI In 3', 'Cam 3'],
    ])
    expect(mix.outputs.map((p) => p.name)).toEqual(['3G/SDI Out 1', '3G/SDI Out 2'])
    expect(mix.ipAddress).toBe('10.0.0.21')
  })

  it('reads a table above a caption block as one matrix, unused rows included', () => {
    const hub = byName(preview(), 'Smart Videohub')
    expect(hub.inputs.map((p) => [p.name, p.signal])).toEqual([
      ['3G/SDI In 1', 'Mixer PGM'],
      ['3G/SDI In 2', 'Mixer Cam 1'],
      ['3G/SDI In 3', undefined],
    ])
    expect(hub.outputs.map((p) => p.name)).toEqual(['Output 1', 'Output 2', 'Output 3'])
  })

  it('names a device after its vertical strip and keeps the body text as subtitle', () => {
    const cam = byName(preview(), 'Camera Sony FX6')
    expect(cam.subtitle).toBe('Old caption')
    expect(cam.outputs.map((p) => p.name)).toEqual(['12G-SDI Out', 'HDMI 2.0'])
  })

  it('does not split the software caption inside a computer frame into its own device', () => {
    const mac = byName(preview(), 'Apple MacMini')
    expect(mac.outputs.map((p) => p.name)).toEqual(['HDMI Out', 'USB C 1'])
  })

  it('wires cables port to port, turning backwards arrows around', () => {
    const p = preview()
    expect(cableBetween(p, 'e0')).toBe('Constellation HD:3G/SDI Out 1 -> Smart Videohub:3G/SDI In 1')
    expect(cableBetween(p, 'e2')).toBe('Smart Videohub:Output 1 -> Constellation HD:3G/SDI In 3')
    expect(cableBetween(p, 'e3')).toBe('Camera Sony FX6:12G-SDI Out -> Constellation HD:3G/SDI In 1')
    expect(cableBetween(p, 'e8')).toBe('Constellation HD:3G/SDI Out 2 -> Constellation HD:3G/SDI In 3')
    expect(cableBetween(p, 'e4')).toBe('Apple MacMini:HDMI Out -> Constellation HD:3G/SDI In 2')
  })

  it('snaps a cable drawn onto an empty strip to the port at its row', () => {
    expect(cableBetween(preview(), 'e5')).toBe('Smart Videohub:Output 2 -> Patchfeld:3G/SDI In 2')
    expect(cableBetween(preview(), 'e7')).toBe('Apple MacMini:USB C 1 -> Patchfeld:3G/SDI In 1')
  })

  it('carries the signal into the payload as contentLabel', () => {
    const payload = buildImportPayload(preview())
    const mix = payload.devices.find((d) => d.name === 'Constellation HD')!
    expect(mix.inputs[0].contentLabel).toBe('Cam 1')
    expect(payload.cables).toHaveLength(lines.length)
  })
})
