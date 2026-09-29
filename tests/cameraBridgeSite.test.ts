import { describe, expect, it } from 'vitest'
import { buildSite, cameraConfigOf, planOf, streamUrlOf } from '../src/renderer/lib/cameraBridgeSite'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const cam = (over: Partial<EquipmentItem>): EquipmentItem =>
  ({
    id: 'c', name: 'CAM', category: 'Cameras', inputs: [], outputs: [],
    x: 0, y: 0, width: 100, height: 60,
    ...over,
  }) as unknown as EquipmentItem

describe('cameraBridgeSite', () => {
  it('maps the control path onto the bridge fields per mode and takes the first playable stream', () => {
    const d = cam({
      ipAddress: '10.0.0.5', cameraControlPath: 'visca', cameraControlPort: 52381, username: 'u', password: 'p',
      streams: [
        { id: 's0', protocol: 'ndi', direction: 'send', url: 'NDI Source' },
        { id: 's1', protocol: 'rtsp', direction: 'send', url: 'rtsp://10.0.0.5/1' },
      ],
    })
    expect(cameraConfigOf(d)).toEqual({
      connectionMode: 'visca', label: 'CAM', camHost: '10.0.0.5', camPort: 52381, camUser: 'u', camPass: 'p', streamUrl: 'rtsp://10.0.0.5/1',
    })
    expect(streamUrlOf(d)).toBe('rtsp://10.0.0.5/1')
    expect(cameraConfigOf(cam({ ipAddress: '10.0.0.6', cameraControlPath: 'canon-ccapi' }))).toEqual({
      connectionMode: 'canon-ccapi', label: 'CAM', canonHost: '10.0.0.6',
    })
    expect(cameraConfigOf(cam({ cameraControlPath: 'none' }))).toBeNull()
    expect(cameraConfigOf(cam({}))).toBeNull()
  })

  it('carries heading, lens and shots as the plan, in the bridge\'s field names', () => {
    const d = cam({
      multicamId: 'mc-1',
      optik: { objektivModell: 'Zoom', brennweiteMinMm: 4.3, brennweiteMaxMm: 129, panGrad: 90, neigungGrad: -5 },
      kameraPresets: [
        { nummer: 2, name: 'Wide', panGrad: 100, neigungGrad: -10, brennweiteMm: 4.3, fokusM: 5, gespeichertAm: 'x' },
        { nummer: 1, name: 'Lectern', panGrad: 80, neigungGrad: -8, brennweiteMm: 40, fokusM: 8, gespeichertAm: 'x' },
      ],
    })
    expect(planOf(d)).toEqual({
      id: 'mc-1', label: 'CAM', pan: 90, tilt: -5,
      lens: { model: 'Zoom', focalMinMm: 4.3, focalMaxMm: 129 },
      presets: [
        { number: 1, name: 'Lectern', pan: 80, tilt: -8, focalMm: 40, focusM: 8, savedAt: 'x' },
        { number: 2, name: 'Wide', pan: 100, tilt: -10, focalMm: 4.3, focusM: 5, savedAt: 'x' },
      ],
    })
    expect(planOf(cam({}))).toBeUndefined()
  })

  it('keeps existing slot numbers, hands out the next free ones, and says why a camera stays behind', () => {
    const build = buildSite(
      [
        cam({ id: 'a', name: 'A', ipAddress: '10.0.0.1', cameraControlPath: 'http-cgi', cameraControlFamily: 'sony', bridgeCameraNumber: 3 }),
        cam({ id: 'b', name: 'B', ipAddress: '10.0.0.2', cameraControlPath: 'visca' }),
        cam({ id: 'c', name: 'C', cameraControlPath: 'visca' }),
        cam({ id: 'd', name: 'D', ipAddress: '10.0.0.4' }),
        cam({ id: 'e', name: 'not a camera', category: 'Monitors', ipAddress: '10.0.0.9', cameraControlPath: 'visca' }),
      ],
      'Room',
    )
    expect(build.site.kind).toBe('lz-site')
    expect(build.site.cameras.map((c) => c.cameraNumber)).toEqual([1, 3])
    expect(build.site.cameras[1].config).toMatchObject({ connectionMode: 'http-cgi', cgiFamily: 'sony', ccuId: 3 })
    expect(build.assigned).toEqual({ b: 1 })
    expect(build.skipped).toEqual([
      { id: 'c', name: 'C', reason: 'no-address' },
      { id: 'd', name: 'D', reason: 'no-control-path' },
    ])
  })
})
