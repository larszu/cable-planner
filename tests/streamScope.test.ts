import { describe, expect, it } from 'vitest'
import { ffmpegArgs, ffmpegRawArgs, ffprobeArgs } from '../src/main/util/streamUrl'
import {
  FrameSplitter,
  decodeParams,
  outputSize,
  parseFfmpegBanner,
  parseFfprobeJson,
  parseScopeRequest,
  scopeInfo,
} from '../src/main/util/streamScope'

// larszu/lz-scopes#15 — die reinen Teile des Scope-Transports im Main-Prozess.

describe('ffmpeg fuer die Scopes', () => {
  const o = { width: 960, height: 540, depth: 8 as const, decodeMatrix: 'bt709', decodeRange: 'limited' as const }

  it('setzt die Matrix ausdruecklich und liefert Rohbilder', () => {
    const a = ffmpegRawArgs('rtsp', 'rtsp://10.0.0.5/s', o)
    expect(a).toContain('scale=960:540:flags=area:in_color_matrix=bt709:in_range=limited')
    expect(a.slice(a.indexOf('-pix_fmt'), a.indexOf('-pix_fmt') + 2)).toEqual(['-pix_fmt', 'rgba'])
    expect(a).toContain('rawvideo')
    expect(a).not.toContain('mjpeg')
    expect(a.slice(a.indexOf('-rtsp_transport'), a.indexOf('-rtsp_transport') + 2)).toEqual(['-rtsp_transport', 'tcp'])
  })

  it('16 bit heisst rgba64le', () => {
    const a = ffmpegRawArgs('srt', 'srt://10.0.0.5:9000', { ...o, depth: 16 })
    expect(a).toContain('rgba64le')
    expect(a).not.toContain('-rtsp_transport')
  })

  it('Standbild und Probe nehmen dieselben Eingangsoptionen', () => {
    expect(ffmpegArgs('rtsp', 'rtsp://h/s')).toContain('-rtsp_transport')
    expect(ffprobeArgs('rtsp', 'rtsp://h/s')).toContain('-rtsp_transport')
    expect(ffprobeArgs('hls', 'http://h/a.m3u8')).not.toContain('-rtsp_transport')
  })
})

describe('Probe lesen', () => {
  it('ffprobe-JSON', () => {
    const p = parseFfprobeJson(
      JSON.stringify({
        streams: [
          { width: 3840, height: 2160, codec_name: 'hevc', avg_frame_rate: '50/1', color_transfer: 'smpte2084', color_primaries: 'bt2020', color_space: 'bt2020nc', color_range: 'tv', pix_fmt: 'yuv420p10le' },
        ],
      }),
    )
    expect(p).toMatchObject({ width: 3840, height: 2160, fps: 50, transfer: 'smpte2084', matrix: 'bt2020nc', range: 'tv' })
    expect(parseFfprobeJson('{"streams":[]}')).toBeNull()
    expect(parseFfprobeJson('kaputt')).toBeNull()
  })

  it('ffmpeg-Stream-Zeile ohne ffprobe', () => {
    const b = parseFfmpegBanner(
      '  Stream #0:0: Video: h264 (High), yuv420p(tv, bt709, progressive), 1920x1080 [SAR 1:1 DAR 16:9], 25 fps, 25 tbr',
    )
    expect(b).toMatchObject({ width: 1920, height: 1080, codec: 'h264', matrix: 'bt709', range: 'tv', fps: 25 })
    const hdr = parseFfmpegBanner('Stream #0:0: Video: hevc, yuv420p10le(tv, bt2020nc/bt2020/smpte2084), 3840x2160, 50 fps')
    expect(hdr).toMatchObject({ matrix: 'bt2020nc', primaries: 'bt2020', transfer: 'smpte2084' })
    expect(parseFfmpegBanner('no video here')).toBeNull()
  })
})

describe('Matrix und Groesse', () => {
  it('ungetaggtes HD ist BT.709, ungetaggtes SD BT.601', () => {
    expect(decodeParams({ matrix: 'unknown', range: 'unknown', height: 1080 }).decodeMatrix).toBe('bt709')
    expect(decodeParams({ matrix: 'unknown', range: 'unknown', height: 576 }).decodeMatrix).toBe('bt601')
    expect(decodeParams({ matrix: 'bt2020nc', range: 'pc', height: 2160 })).toEqual({ decodeMatrix: 'bt2020', decodeRange: 'full' })
    expect(decodeParams({ matrix: 'smpte170m', range: 'tv', height: 1080 }).decodeMatrix).toBe('bt601')
  })

  it('passt ein, haelt das Seitenverhaeltnis, gerade Kanten', () => {
    expect(outputSize(1920, 1080, 960)).toEqual({ width: 960, height: 540 })
    expect(outputSize(1280, 720, 0)).toEqual({ width: 1280, height: 720 })
    expect(outputSize(720, 576, 960)).toEqual({ width: 720, height: 576 })
    expect(outputSize(1921, 1081, 0).width % 2).toBe(0)
  })

  it('Info fuer den Renderer', () => {
    const i = scopeInfo({ width: 1920, height: 1080, fps: 25, transfer: 'bt709', primaries: 'bt709', matrix: 'unknown', range: 'tv' }, 960, 16)
    expect(i).toMatchObject({ width: 960, height: 540, sourceWidth: 1920, sourceHeight: 1080, depth: 16, decodeMatrix: 'bt709' })
  })
})

describe('FrameSplitter', () => {
  it('schneidet beliebige Stuecke in ganze Bilder, jedes ein eigener Puffer', () => {
    const f = new FrameSplitter(4)
    expect(f.push(Buffer.from([1, 2, 3]))).toEqual([])
    const a = f.push(Buffer.from([4, 5, 6, 7, 8, 9, 10]))
    expect(a.map((b) => [...new Uint8Array(b)])).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ])
    expect(a[0].byteLength).toBe(4)
    const b = f.push(Buffer.from([11, 12]))
    expect(b.map((x) => [...new Uint8Array(x)])).toEqual([[9, 10, 11, 12]])
  })
})

describe('Anfrage aus dem Renderer', () => {
  const gut = { id: 'abc', credentialId: 'cam_1-url', protocol: 'rtsp', url: ' rtsp://10.0.0.5/s ', depth: 16, width: 5000 }

  it('nimmt eine saubere Anfrage an und deckelt die Breite', () => {
    expect(parseScopeRequest(gut)).toEqual({ id: 'abc', credentialId: 'cam_1-url', protocol: 'rtsp', url: 'rtsp://10.0.0.5/s', depth: 16, width: 1920 })
    expect(parseScopeRequest({ ...gut, depth: 12, width: undefined })).toMatchObject({ depth: 8, width: 960 })
  })

  it('lehnt Ids ab, die ein Schluesselbund-Account nicht sein darf', () => {
    expect(parseScopeRequest({ ...gut, id: 'a b' })).toBeNull()
    expect(parseScopeRequest({ ...gut, credentialId: '../x' })).toBeNull()
    expect(parseScopeRequest({ ...gut, url: '' })).toBeNull()
    expect(parseScopeRequest(null)).toBeNull()
  })
})
