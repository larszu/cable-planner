import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

vi.mock('../src/renderer/lib/promptDialog', () => ({ promptDialog: vi.fn() }))

import { promptDialog } from '../src/renderer/lib/promptDialog'
import { cableLengthSuffix } from '../src/renderer/lib/lastCableChoice'
import { addAnnotationAt } from '../src/renderer/lib/annotationAuthor'
import { useProjectStore } from '../src/renderer/store/projectStore'
import { useUiStore } from '../src/renderer/store/uiStore'
import { SprachVerkabelungDialog } from '../src/renderer/components/Canvas/SprachVerkabelungDialog'

describe('Kabel-Label ohne Laenge (#1081)', () => {
  it('laesst "(…m)" weg, wenn keine Laenge da ist', () => {
    expect(cableLengthSuffix(undefined)).toBe('')
    expect(cableLengthSuffix(null)).toBe('')
    expect(cableLengthSuffix(Number.NaN)).toBe('')
    expect(`SDI 3G${cableLengthSuffix(undefined)}`).toBe('SDI 3G')
  })
  it('haengt die Laenge an, wenn sie gesetzt ist', () => {
    expect(cableLengthSuffix(3)).toBe(' (3m)')
  })
  it('kein Label-Bauer schreibt die Laenge ungeprueft in Klammern', () => {
    const src = readFileSync('src/renderer/components/Canvas/CanvasArea.tsx', 'utf8')
    expect(src).not.toMatch(/\(\$\{item\.length\}m\)/)
  })
})

describe('Kabel per Sprache: Dialog im Portal', () => {
  it('rendert nach document.body, nicht in die Toolbar mit backdrop-filter', async () => {
    const toolbar = document.createElement('div')
    toolbar.style.backdropFilter = 'blur(8px)'
    document.body.appendChild(toolbar)
    const root = createRoot(toolbar)
    await act(async () => {
      root.render(createElement(SprachVerkabelungDialog, { open: true, onClose: () => {} }))
    })
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(toolbar.contains(dialog)).toBe(false)
    await act(async () => root.unmount())
    toolbar.remove()
  })
})

describe('Anmerkung aus dem Kontextmenue', () => {
  beforeEach(() => {
    vi.mocked(promptDialog).mockReset()
    useUiStore.getState().setAnnotationAuthor('')
  })

  it('fragt Namen und Text und haengt die Anmerkung ans Geraet', async () => {
    vi.mocked(promptDialog).mockResolvedValueOnce('Lars').mockResolvedValueOnce('Kabel fehlt')
    const a = await addAnnotationAt({ type: 'device', deviceId: 'eq-1' })
    expect(a?.author).toBe('Lars')
    expect(a?.anchor).toEqual({ type: 'device', deviceId: 'eq-1' })
    expect(useProjectStore.getState().project.annotations?.some((x) => x.id === a?.id)).toBe(true)
  })

  it('bricht ohne Text ab', async () => {
    useUiStore.getState().setAnnotationAuthor('Lars')
    vi.mocked(promptDialog).mockResolvedValueOnce(null)
    expect(await addAnnotationAt({ type: 'cable', cableId: 'c-1' })).toBeNull()
  })

  it('Geraete- und Kabelmenue bieten den Eintrag an', () => {
    for (const f of ['src/renderer/components/Canvas/CanvasArea.tsx', 'src/renderer/components/Canvas/CableContextMenu.tsx']) {
      expect(readFileSync(f, 'utf8')).toContain("'annotations.addFromMenu'")
    }
  })
})
