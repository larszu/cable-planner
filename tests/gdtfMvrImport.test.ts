import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { parseGdtf, parseGdtfXml } from '../src/renderer/lib/gdtf/gdtf'
import { parseAdresse, parseMvr, parseMvrXml } from '../src/renderer/lib/gdtf/mvr'
import { findeVorlage, mvrGeraete, mvrTypen, steckerAusGdtf, vorlageAusGdtf } from '../src/renderer/lib/gdtf/zuordnung'
import type { EquipmentTemplate } from '../src/renderer/types/equipment'

// Ein Geraet mit 16-bit-Dimmer, Fussabdruck 5, und ein Pixel-Balken mit vier
// Zellen zu je 3 Kanaelen ueber GeometryReference (5 + 4*3 = 17).
const GDTF = `<?xml version="1.0" encoding="UTF-8"?>
<GDTF DataVersion="1.2">
 <FixtureType Name="Bar 4" ShortName="B4" LongName="Pixel Bar 4" Manufacturer="Acme" FixtureTypeID="0A1B2C3D-0000-4000-8000-000000000001" Thumbnail="thumbnail" Description="Test bar">
  <PhysicalDescriptions><Properties><Weight Value="4.2"/></Properties></PhysicalDescriptions>
  <Geometries>
   <Geometry Name="Body">
    <WiringObject Name="Power In" ConnectorType="PowerconTRUE1" ComponentType="Consumer" SignalType="Power" ElectricalPayLoad="180"/>
    <WiringObject Name="Power Out" ConnectorType="powerCONTRUE1TOP" ComponentType="PowerSource" SignalType="Power"/>
    <WiringObject Name="DMX In" ConnectorType="XLR5" ComponentType="Input" SignalType="DMX512"/>
    <WiringObject Name="DMX Out" ConnectorType="XLR5" ComponentType="Output" SignalType="DMX512"/>
    <WiringObject Name="Net" ConnectorType="RJ45" ComponentType="NetworkInOut" SignalType="Protocol"/>
    <WiringObject Name="F1" ConnectorType="Fuse" ComponentType="Fuse"/>
    <GeometryReference Name="Cell 1" Geometry="Cell"><Break DMXOffset="6" DMXBreak="1"/></GeometryReference>
    <GeometryReference Name="Cell 2" Geometry="Cell"><Break DMXOffset="9" DMXBreak="1"/></GeometryReference>
    <GeometryReference Name="Cell 3" Geometry="Cell"><Break DMXOffset="12" DMXBreak="1"/></GeometryReference>
    <GeometryReference Name="Cell 4" Geometry="Cell"><Break DMXOffset="15" DMXBreak="1"/></GeometryReference>
   </Geometry>
   <Geometry Name="Cell"><Beam Name="CellBeam"/></Geometry>
  </Geometries>
  <DMXModes>
   <DMXMode Name="Basic" Geometry="Body"><DMXChannels>
    <DMXChannel DMXBreak="1" Offset="1,2" Geometry="Body"/>
    <DMXChannel DMXBreak="1" Offset="3" Geometry="Body"/>
    <DMXChannel DMXBreak="1" Offset="4" Geometry="Body"/>
    <DMXChannel DMXBreak="1" Offset="5" Geometry="Body"/>
    <DMXChannel DMXBreak="1" Offset="None" Geometry="Body"/>
   </DMXChannels></DMXMode>
   <DMXMode Name="Pixel" Geometry="Body"><DMXChannels>
    <DMXChannel DMXBreak="1" Offset="1,2" Geometry="Body"/>
    <DMXChannel DMXBreak="1" Offset="5" Geometry="Body"/>
    <DMXChannel DMXBreak="1" Offset="1" Geometry="CellBeam"/>
    <DMXChannel DMXBreak="1" Offset="3" Geometry="CellBeam"/>
   </DMXChannels></DMXMode>
  </DMXModes>
 </FixtureType>
</GDTF>`

const gdtfZip = () => zipSync({ 'description.xml': strToU8(GDTF), 'thumbnail.png': new Uint8Array([137, 80, 78, 71]) })

const MVR = `<?xml version="1.0" encoding="UTF-8"?>
<GeneralSceneDescription verMajor="1" verMinor="6">
 <Scene><Layers>
  <Layer name="Rig" uuid="L1"><ChildList>
   <GroupObject uuid="G1" name="Truss 1">
    <Matrix>{1,0,0}{0,1,0}{0,0,1}{1000,2000,6000}</Matrix>
    <ChildList>
     <Fixture uuid="F1" name="Bar A"><Matrix>{1,0,0}{0,1,0}{0,0,1}{500,0,0}</Matrix>
      <GDTFSpec>Acme@Bar 4@v1.gdtf</GDTFSpec><GDTFMode>Pixel</GDTFMode><FixtureID>101</FixtureID>
      <Addresses><Address break="0">2.1</Address></Addresses></Fixture>
     <Fixture uuid="F2" name="Bar B"><Matrix>{0,1,0}{-1,0,0}{0,0,1}{1500,0,0}</Matrix>
      <GDTFSpec>Acme@Bar 4@v1</GDTFSpec><GDTFMode>Basic</GDTFMode>
      <Addresses><Address Break="0">530</Address></Addresses></Fixture>
    </ChildList>
   </GroupObject>
   <Truss uuid="T1" name="Pipe"><GDTFSpec>Truss.gdtf</GDTFSpec></Truss>
   <Fixture uuid="F3" name="Unknown"><GDTFSpec>Other@Spot</GDTFSpec></Fixture>
  </ChildList></Layer>
 </Layers></Scene>
</GeneralSceneDescription>`

describe('GDTF lesen (#1206)', () => {
  it('liest Kopf, Modi mit Fussabdruck und Anschluesse', () => {
    const typ = parseGdtfXml(GDTF)
    expect(typ.name).toBe('Bar 4')
    expect(typ.manufacturer).toBe('Acme')
    expect(typ.fixtureTypeId).toBe('0A1B2C3D-0000-4000-8000-000000000001')
    expect(typ.weightKg).toBe(4.2)
    expect(typ.powerW).toBe(180)
    expect(typ.modi.map((m) => [m.name, m.kanaele])).toEqual([['Basic', 5], ['Pixel', 17]])
    expect(typ.anschluesse.map((a) => [a.name, a.rolle])).toEqual([
      ['Power In', 'in'], ['Power Out', 'out'], ['DMX In', 'in'], ['DMX Out', 'out'], ['Net', 'inout'],
    ])
  })

  it('liest das Archiv samt Vorschaubild', () => {
    const typ = parseGdtf(gdtfZip())
    expect(typ.thumbnailPng?.length).toBe(4)
  })

  it('baut eine Vorlage mit Steckern des Planers und DMX-Profil', () => {
    const v = vorlageAusGdtf(parseGdtfXml(GDTF), 'Acme@Bar 4@v1.gdtf')
    expect(v.name).toBe('Acme Pixel Bar 4')
    expect(v.inputs.map((p) => [p.name, p.connectorType, p.type, p.direction])).toEqual([
      ['Power In', 'powerCON TRUE1', 'Power', undefined],
      ['DMX In', 'DMX 5-pol (XLR)', 'DMX', undefined],
      ['Net', 'Ethernet/RJ45', 'Ethernet', 'bidirectional'],
    ])
    expect(v.outputs.map((p) => p.connectorType)).toEqual(['powerCON TRUE1', 'DMX 5-pol (XLR)'])
    expect(v.dmxProfil?.modi.map((m) => [m.id, m.kanaele, m.herkunft])).toEqual([
      ['gdtf:Basic', 5, 'gdtf'], ['gdtf:Pixel', 17, 'gdtf'],
    ])
  })

  it('nimmt ohne Anschlussliste DMX In/Thru an und sagt es', () => {
    const ohne = GDTF.replace(/<WiringObject[^>]*\/>/g, '')
    const v = vorlageAusGdtf(parseGdtfXml(ohne), 'x.gdtf')
    expect(v.inputs.map((p) => p.name)).toEqual(['DMX In'])
    expect(v.notes).toMatch(/assumed/)
  })

  it('bildet Stecker ab und laesst Unbekanntes stehen', () => {
    expect(steckerAusGdtf({ name: 'x', connectorType: 'NAC3FCA', rolle: 'in' })).toBe('PowerCON')
    expect(steckerAusGdtf({ name: 'x', connectorType: '16A-CEE', rolle: 'in' })).toBe('CEE16')
    expect(steckerAusGdtf({ name: 'Audio', connectorType: 'XLR3', rolle: 'in' })).toBe('XLR')
    expect(steckerAusGdtf({ name: 'DMX', connectorType: 'XLR3', rolle: 'in' })).toBe('DMX 3-pol (XLR)')
    expect(steckerAusGdtf({ name: 'x', connectorType: 'Loose End', rolle: 'in' })).toBe('Loose End')
  })
})

describe('MVR lesen (#1206)', () => {
  it('verkettet Matrizen und liest Adressen in beiden Schreibweisen', () => {
    const s = parseMvrXml(MVR)
    expect(s.version).toBe('1.6')
    const a = s.objekte.find((o) => o.uuid === 'F1')!
    expect([a.x, a.y, a.z]).toEqual([1500, 2000, 6000])
    expect([a.universe, a.adresse]).toEqual([2, 1])
    expect(a.fixtureId).toBe('101')
    const b = s.objekte.find((o) => o.uuid === 'F2')!
    expect([b.universe, b.adresse]).toEqual([2, 18])
    expect(s.objekte.map((o) => o.art)).toEqual(['Fixture', 'Fixture', 'Truss', 'Fixture'])
  })

  it('parseAdresse', () => {
    expect(parseAdresse('1')).toEqual({ universe: 1, adresse: 1 })
    expect(parseAdresse('512')).toEqual({ universe: 1, adresse: 512 })
    expect(parseAdresse('513')).toEqual({ universe: 2, adresse: 1 })
    expect(parseAdresse('3.200')).toEqual({ universe: 3, adresse: 200 })
    expect(parseAdresse('x')).toBeUndefined()
  })

  it('ordnet Typen zu, legt fehlende an und platziert die Geraete', () => {
    const zip = zipSync({ 'GeneralSceneDescription.xml': strToU8(MVR), 'Acme@Bar 4@v1.gdtf': gdtfZip() })
    const szene = parseMvr(zip)
    const vorhanden: EquipmentTemplate = { name: 'Other Spot', category: 'Lighting', width: 200, height: 140, inputs: [], outputs: [] }
    const typen = mvrTypen(szene, [vorhanden])
    // Truss gehoert nicht in den Kabelplan.
    expect(typen.map((t) => [t.spec, t.anzahl])).toEqual([['Acme@Bar 4@v1.gdtf', 1], ['Acme@Bar 4@v1', 1], ['Other@Spot', 1]])
    expect(typen[0].gdtf?.name).toBe('Bar 4')
    expect(typen[1].gdtf?.name).toBe('Bar 4')
    expect(typen[2].vorhanden?.name).toBe('Other Spot')

    const wahl = new Map(typen.map((t) => [t.spec, t.vorhanden ?? t.neu]))
    const geraete = mvrGeraete(szene, wahl, { pxProMeter: 100, ursprung: { x: 0, y: 0 } })
    expect(geraete).toHaveLength(3)
    const a = geraete.find((g) => g.name === 'Bar A')!
    expect(a.dmxModusId).toBe('gdtf:Pixel')
    expect([a.dmxUniverse, a.dmxAdresse, a.dmxAdresseFestgesetzt]).toEqual([2, 1, true])
    // F3 liegt im Ursprung (0,0), F1 bei x=1500 mm → 150 px; y gespiegelt.
    expect([a.x, a.y]).toEqual([150, 0])
    const u = geraete.find((g) => g.name === 'Unknown')!
    expect([u.x, u.y]).toEqual([0, 200])
    // Jede Instanz bekommt eigene Port-Ids.
    const b = geraete.find((g) => g.name === 'Bar B')!
    expect(a.inputs[0].id).not.toBe(b.inputs[0].id)
  })

  it('findet eine Vorlage ueber die Typ-Id vor dem Namen', () => {
    const typ = parseGdtfXml(GDTF)
    const perId: EquipmentTemplate = { name: 'Mein Balken', deviceTypeId: typ.fixtureTypeId, category: 'Lighting', width: 1, height: 1, inputs: [], outputs: [] }
    const perName: EquipmentTemplate = { name: 'Acme Bar 4', category: 'Lighting', width: 1, height: 1, inputs: [], outputs: [] }
    expect(findeVorlage(typ, [perName, perId])?.name).toBe('Mein Balken')
    expect(findeVorlage(typ, [perName])?.name).toBe('Acme Bar 4')
    expect(findeVorlage(typ, [])).toBeUndefined()
  })
})
