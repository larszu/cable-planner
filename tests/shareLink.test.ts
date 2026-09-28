import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isSharedPlan, savedDate, shareUrlFromHash } from '../src/viewer/share'

describe('Lese-Link im Viewer (#870)', () => {
  it('nimmt die API-URL aus dem Fragment, nur https oder lokal', () => {
    const api = 'https://devices.zumpelars.de/api/public/share/abcdefghijklmnopqrstuvwx'
    expect(shareUrlFromHash(`#share=${encodeURIComponent(api)}`)?.href).toBe(api)
    expect(shareUrlFromHash('#share=' + encodeURIComponent('http://evil.example/x'))).toBeNull()
    expect(shareUrlFromHash('#share=' + encodeURIComponent('http://localhost:4186/api/public/share/x'))?.host).toBe('localhost:4186')
    expect(shareUrlFromHash('#share=javascript%3Aalert(1)')).toBeNull()
    expect(shareUrlFromHash('')).toBeNull()
  })

  it('erkennt nur eine Antwort des Servers mit Plan', () => {
    expect(isSharedPlan({ format: 'avplan-share', version: 1, name: 'x', rev: 1, savedAt: '', data: { equipment: [], cables: [] } })).toBe(true)
    expect(isSharedPlan({ format: 'avplan-share', data: {} })).toBe(false)
    expect(isSharedPlan(null)).toBe(false)
  })

  it('liest die Zeit des Servers als UTC', () => {
    expect(savedDate('2026-09-27 10:00:00').toISOString()).toBe('2026-09-27T10:00:00.000Z')
  })

  it('der Server-Link zielt auf genau diesen Viewer', () => {
    // av-device-library leitet /s/<token> auf SHARE_VIEWER_URL#share=… um.
    // Liegt der Viewer woanders, muss die Vorgabe dort mitziehen.
    expect(readFileSync('viewer.html', 'utf8')).toContain('src/viewer/main.tsx')
    expect(readFileSync('src/renderer/lib/appInfo.ts', 'utf8')).toContain("'https://larszu.github.io/cable-planner/'")
  })
})
