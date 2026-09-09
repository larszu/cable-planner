// #ux — Tastaturkürzel-Übersicht.
//
// Listet die vorhandenen Shortcuts (aus MenuBar + useCanvasKeyboardShortcuts +
// Geräte-Suche) in einem Overlay. Öffnet mit "?" (Shift+/) und über das
// Hilfe-Menü (CustomEvent 'cp:open-shortcuts-help'). Mac zeigt ⌘/⇧ statt Strg/Umsch.
import { useEffect, useState } from 'react'
import { ModalShell } from '../shared/ModalShell'
import { useTranslation } from '../../lib/i18n'

const isMac =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

export const ShortcutsHelp = () => {
  const t = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return
      const el = document.activeElement
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing) return
      e.preventDefault()
      setOpen(true)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('cp:open-shortcuts-help', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('cp:open-shortcuts-help', onOpen)
    }
  }, [])

  const mod = isMac ? '⌘' : t('shortcut.mod', 'Ctrl')
  const shift = isMac ? '⇧' : t('shortcut.shift', 'Shift')

  const groups: { title: string; items: [string, string][] }[] = [
    {
      title: t('shortcutsHelp.file', 'File'),
      items: [
        [`${mod}+N`, t('shortcutsHelp.new', 'New project')],
        [`${mod}+O`, t('shortcutsHelp.open', 'Open project')],
        [`${mod}+S`, t('shortcutsHelp.save', 'Save')],
        [`${mod}+${shift}+S`, t('shortcutsHelp.saveAs', 'Save as')],
      ],
    },
    {
      title: t('shortcutsHelp.edit', 'Edit'),
      items: [
        [`${mod}+Z`, t('shortcutsHelp.undo', 'Undo')],
        [`${mod}+Y`, t('shortcutsHelp.redo', 'Redo')],
        [`${mod}+C`, t('shortcutsHelp.copy', 'Copy')],
        [`${mod}+V`, t('shortcutsHelp.paste', 'Paste')],
        [`${mod}+D`, t('shortcutsHelp.duplicate', 'Duplicate')],
        [`${mod}+A`, t('shortcutsHelp.selectAll', 'Select all')],
        [t('shortcut.del', 'Del'), t('shortcutsHelp.delete', 'Delete selection')],
        [t('shortcut.esc', 'Esc'), t('shortcutsHelp.escape', 'Deselect / cancel')],
      ],
    },
    {
      title: t('shortcutsHelp.canvas', 'Canvas & navigation'),
      items: [
        [`${mod}+K`, t('shortcutsHelp.palette', 'Command palette')],
        [`${mod}+F`, t('shortcutsHelp.find', 'Find device')],
        [`${mod}++`, t('shortcutsHelp.quickAdd', 'New device at cursor')],
        ['↑ ↓ ← →', t('shortcutsHelp.nudge', 'Move device (Shift = larger steps)')],
        ['?', t('shortcutsHelp.help', 'Show this overview')],
      ],
    },
    {
      title: t('shortcutsHelp.panels', 'Panels & view'),
      items: [
        [`${mod}+B`, t('shortcutsHelp.toggleLibrary', 'Show/hide library')],
        [`${mod}+I`, t('shortcutsHelp.toggleProperties', 'Show/hide properties')],
        ['P', t('shortcutsHelp.jumpToPatches', 'Open patch list')],
        ['A', t('shortcutsHelp.toggleArrows', 'Toggle arrow display')],
      ],
    },
  ]

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('shortcutsHelp.title', 'Keyboard shortcuts')}
      titleIcon="⌨️"
      maxWidth="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="mb-2 text-cp-sm font-semibold text-cp-text-secondary">{g.title}</h3>
            <ul className="space-y-1">
              {g.items.map(([combo, desc]) => (
                <li key={combo} className="flex items-center justify-between gap-3 text-cp-sm">
                  <span className="text-cp-text-secondary">{desc}</span>
                  <kbd className="shrink-0 rounded-cp-control border border-cp-border bg-cp-surface-2 px-2 py-0.5 text-cp-xs text-cp-text">
                    {combo}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ModalShell>
  )
}
