import { describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LibraryItem } from '../src/renderer/components/Library/LibraryItem'
import { ProjectMetaDialog } from '../src/renderer/components/Project/ProjectMetaDialog'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { EquipmentTemplate } from '../src/renderer/types/equipment'

const tpl = { name: 'ATEM Mini', category: 'Video Mixers', inputs: [], outputs: [] } as unknown as EquipmentTemplate
const noop = () => {}

describe('#1038 — markierter Bibliothekseintrag sagt, wie man platziert', () => {
  it('zeigt den Hinweis nur am markierten Eintrag', () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    const root = createRoot(host)
    useProjectStore.setState({ selectedTemplateName: undefined })
    act(() => root.render(createElement(LibraryItem, { item: tpl, onAdd: noop, onSelect: noop })))
    expect(host.innerHTML).not.toContain('library-place-hint')
    act(() => useProjectStore.setState({ selectedTemplateName: 'ATEM Mini' }))
    expect(host.innerHTML).toContain('Double-click or drag to place it')
    act(() => root.unmount())
  })
})

describe('#1039 — eigenes Geraet startet nicht in „Cameras"', () => {
  it('Vorgabe und Reset stehen auf Other', () => {
    const src = readFileSync('src/renderer/components/Library/LibraryPanel.tsx', 'utf8')
    expect(src).not.toMatch(/setCategory\('Cameras'\)|useState\('Cameras'\)/)
    expect(src).toContain("useState('Other')")
  })
})

describe('#1040 — neues Projekt in einem Dialog', () => {
  const dialog = (discardWarning?: boolean) =>
    renderToStaticMarkup(
      createElement(ProjectMetaDialog, {
        open: true,
        mode: 'new',
        discardWarning,
        initial: {} as never,
        onCancel: noop,
        onConfirm: noop,
      }),
    )

  it('traegt die Verwerfen-Warnung im Formular', () => {
    expect(dialog(true)).toContain('discards the current one')
    expect(dialog(false)).not.toContain('discards the current one')
  })

  it('App fragt nicht mehr vorab per confirmDialog', () => {
    const src = readFileSync('src/renderer/App.tsx', 'utf8')
    expect(src).not.toContain('app.newProject.confirm')
  })
})
