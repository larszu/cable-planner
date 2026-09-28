import { describe, expect, it } from 'vitest'
import {
  normaliseStreams,
  streamAdresse,
  streamsTable,
  streamUrlOhneZugang,
  trenneZugang,
  vorschauQuelle,
  vorschauStream,
  zugangsSchluessel,
} from '../src/renderer/lib/streamEndpoints'
import { ipWithVlan, vlanTag } from '../src/renderer/lib/vlanAnzeige'
import { undescribedColumns } from '../src/renderer/lib/dataDictionary'
import { buildAssetRows } from '../src/renderer/lib/assetRegister'
import { buildAddressPlan } from '../src/renderer/lib/addressPlan'
import { steckbriefHtml, steckbriefStandTable } from '../src/renderer/lib/steckbrief'
import { datenblattFelder } from '../src/renderer/lib/geraeteDatenblatt'
import { beantworteWerkzeug } from '../src/renderer/lib/mcpWerkzeuge'
import { ffmpegArgs, isLocalAddress, mergeStreamSecrets, parseStreamUrl } from '../src/main/util/streamUrl'
import { fetchSnapshot } from '../src/main/services/streamSnapshot'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { StreamEndpoint } from '../src/renderer/types/stream'
import storeQuelle from '../src/renderer/store/streamPreviewStore.ts?raw'
import kachelQuelle from '../src/renderer/components/Canvas/StreamPreviewTile.tsx?raw'
import preloadQuelle from '../src/main/preload.cts?raw'

// ---------------------------------------------------------------------------
// Nachtrag #946 — was #947 offen liess: VLAN in Listen/Blaettern/MCP, geheime
// Query-Parameter, Schluesselbund, ffmpeg-Standbild, nur lokales Netz, kein
// Abruf beim Oeffnen einer Datei.
// ---------------------------------------------------------------------------

const geraet = (teil: Partial<EquipmentItem> & { id: string; name: string }): EquipmentItem =>
  ({ category: 'Video', inputs: [], outputs: [], x: 0, y: 0, width: 200, height: 96, ...teil }) as EquipmentItem

const stream = (teil: Partial<StreamEndpoint> = {}): StreamEndpoint => ({
  id: 'cam#stream-1',
  protocol: 'rtsp',
  direction: 'send',
  url: 'rtsp://10.0.0.5:554/stream1',
  ...teil,
})

const projekt = (equipment: EquipmentItem[]): CablePlannerProject =>
  ({
    metadata: { name: 'T', description: '', createdAt: '', updatedAt: '' },
    equipment,
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

describe('VLAN neben der IP', () => {
  it('nur, wenn eine eingetragen ist — keine Fuellung', () => {
    expect(ipWithVlan('10.0.0.5', 20)).toBe('10.0.0.5 · VLAN 20')
    expect(ipWithVlan('10.0.0.5', undefined)).toBe('10.0.0.5')
    expect(ipWithVlan('', 20)).toBe('')
    expect(vlanTag(undefined)).toBe('')
  })

  it('Asset-Register und Adressplan tragen sie', () => {
    const a = geraet({ id: 'a', name: 'A', ipAddress: '10.0.0.2', managementVlanId: 30 })
    const b = geraet({ id: 'b', name: 'B', ipAddress: '10.0.0.3' })
    expect(buildAssetRows(projekt([a, b])).map((r) => r.vlan)).toEqual([30, ''])
    const plan = buildAddressPlan([a, b])
    expect(plan.rows.find((r) => r.id === 'a')?.vlanId).toBe(30)
  })
})

describe('Zugangsdaten verlassen die Adresse', () => {
  it('auch geheime Query-Parameter wie die SRT-Passphrase', () => {
    expect(trenneZugang('srt://10.0.0.9:9000?mode=caller&passphrase=abcdefghij&latency=200')).toEqual({
      url: 'srt://10.0.0.9:9000?mode=caller&latency=200',
      zugang: { query: [['passphrase', 'abcdefghij']] },
    })
    expect(streamUrlOhneZugang('http://cam/snap.jpg?token=xyz')).toBe('http://cam/snap.jpg')
  })

  it('beim Laden einer Datei ebenso', () => {
    const s = normaliseStreams([{ id: 'a', protocol: 'srt', direction: 'send', url: 'srt://h:9000?passphrase=geheim123' }])
    expect(JSON.stringify(s)).not.toContain('geheim123')
  })

  it('der Main-Prozess setzt genau das wieder ein, was der Renderer herausgenommen hat', () => {
    for (const u of [
      'rtsp://admin:geheim@10.0.0.5:554/stream1',
      'srt://10.0.0.9:9000?passphrase=abcdefghij',
      'http://user:pw@192.168.1.20/video.mjpg?token=xyz#frag',
    ]) {
      const { url, zugang } = trenneZugang(u)
      expect(trenneZugang(mergeStreamSecrets(url, JSON.stringify(zugang)))).toEqual({ url, zugang })
    }
  })

  it('der Schluesselbund-Account ist fuer main gueltig, auch mit # in der Stream-Id', () => {
    expect(zugangsSchluessel('geraet-1#stream-ab12', 'url')).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
    expect(zugangsSchluessel('x', 'url')).not.toBe(zugangsSchluessel('x', 'previewUrl'))
  })

  it('die Bruecke kennt keinen Weg, der den Klartext an den Renderer gibt', () => {
    const block = /streamCredential: \{([\s\S]*?)\n {2}\},/.exec(preloadQuelle)?.[1] ?? ''
    expect(block).toContain('has:')
    expect(block).not.toMatch(/\bget:/)
  })

  it('fetchSnapshot schickt Basic-Auth nur, wenn main sie mitgibt — und folgt dann keiner Weiterleitung', async () => {
    let init: RequestInit | undefined
    const holen = (async (_u: string, i: RequestInit) => {
      init = i
      return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } })
    }) as unknown as typeof fetch
    await fetchSnapshot('http://cam/s.jpg', holen, () => new Date(), 'Basic YTpi')
    expect(init?.headers).toEqual({ authorization: 'Basic YTpi' })
    expect(init?.redirect).toBe('error')
  })
})

describe('Vorschau', () => {
  it('Standbild-Adresse zuerst, sonst der gesendete Strom per ffmpeg', () => {
    expect(vorschauQuelle(stream({ previewUrl: 'http://10.0.0.5/snap.jpg' }))).toMatchObject({ weg: 'http', feld: 'previewUrl' })
    expect(vorschauQuelle(stream())).toMatchObject({ weg: 'ffmpeg', feld: 'url' })
    expect(vorschauQuelle(stream({ direction: 'receive' }))).toBeNull()
    expect(vorschauQuelle(stream({ protocol: 'ndi', url: 'CAM-1' }))).toBeNull()
    expect(vorschauStream([stream({ showPreview: true })])?.id).toBe('cam#stream-1')
  })

  it('nur im lokalen Netz', () => {
    for (const a of ['10.1.2.3', '192.168.0.10', '172.16.0.1', '127.0.0.1', '169.254.1.1', '::1', 'fe80::1', 'fd00::5', '::ffff:10.0.0.1']) {
      expect(isLocalAddress(a), a).toBe(true)
    }
    for (const a of ['8.8.8.8', '172.32.0.1', '2001:db8::1', 'kamera.local']) {
      expect(isLocalAddress(a), a).toBe(false)
    }
  })

  it('liest Schema und Host, auch hinter Zugangsdaten und in eckigen Klammern', () => {
    expect(parseStreamUrl('rtsp://u:p@10.0.0.5:554/x')).toEqual({ scheme: 'rtsp', host: '10.0.0.5' })
    expect(parseStreamUrl('http://[fe80::1]:8080/v')).toEqual({ scheme: 'http', host: 'fe80::1' })
    expect(parseStreamUrl('CAM-1 (NDI-PC)')).toBeNull()
  })

  it('ffmpeg: ein Bild, ueber TCP bei RTSP', () => {
    const args = ffmpegArgs('rtsp', 'rtsp://10.0.0.5/s')
    expect(args).toContain('-rtsp_transport')
    expect(args.join(' ')).toContain('-frames:v 1')
    expect(ffmpegArgs('srt', 'srt://10.0.0.5:9000')).not.toContain('-rtsp_transport')
  })

  it('nichts startet beim Oeffnen einer Datei: die Freigabe ist Sitzungszustand', () => {
    expect(storeQuelle).not.toMatch(/persist|localStorage/)
    expect(kachelQuelle).toContain('!freigegeben')
  })
})

describe('Streams in Listen, Blaettern und MCP', () => {
  const kamera = geraet({
    id: 'cam',
    name: 'Kamera 1',
    ipAddress: '10.0.0.5',
    managementVlanId: 20,
    streams: [stream({ codec: 'H.264', format: '1920x1080p50', label: 'Main' })],
  })

  it('Tabelle mit VLAN, jede Spalte im Lexikon', () => {
    const table = streamsTable([kamera])
    expect(undescribedColumns(table.headers)).toEqual([])
    expect(table.rows[0]).toEqual(['Kamera 1', 'sendet', 'RTSP', 'rtsp://10.0.0.5:554/stream1', 20, 'H.264', '1920x1080p50', 'Main'])
  })

  it('haengt den Port nur an, wenn er nicht schon in der Adresse steht', () => {
    expect(streamAdresse(stream({ port: 554 }))).toBe('rtsp://10.0.0.5:554/stream1')
    expect(streamAdresse(stream({ protocol: 'ndi', url: 'CAM-1', port: 5961 }))).toBe('CAM-1 :5961')
  })

  it('Steckbrief und Datenblatt fuehren die Streams', () => {
    const p = projekt([kamera])
    expect(steckbriefHtml(p, { titel: 'T' })).toContain('rtsp://10.0.0.5:554/stream1')
    expect(steckbriefStandTable(p).rows.some((r) => r[1] === 'Stream')).toBe(true)
    expect((datenblattFelder(p, 'cam', {}) ?? []).find((f) => f.key === 'streams')?.wert).toBe('1')
  })

  it('MCP nennt IP mit VLAN und die Streams', () => {
    const a = beantworteWerkzeug(projekt([kamera]), 'device_ports', { deviceId: 'cam' })
    expect(a.daten.network).toEqual([{ label: null, role: 'unspecified', ip: '10.0.0.5', vlan: 20 }])
    expect((a.daten.streams as Array<Record<string, unknown>>)[0]).toMatchObject({ protocol: 'RTSP', vlan: 20, label: 'Main' })
  })
})
