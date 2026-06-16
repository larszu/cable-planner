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

  const mod = isMac ? '⌘' : t('shortcut.mod', 'Strg')
  const shift = isMac ? '⇧' : t('shortcut.shift', 'Umsch')

  const groups: { title: string; items: [string, string][] }[] = [
    {
      title: t('shortcutsHelp.file', 'Datei'),
      items: [
        [`${mod}+N`, t('shortcutsHelp.new', 'Neues Projekt')],
        [`${mod}+O`, t('shortcutsHelp.open', 'Projekt öffnen')],
        [`${mod}+S`, t('shortcutsHelp.save', 'Speichern')],
        [`${mod}+${shift}+S`, t('shortcutsHelp.saveAs', 'Speichern unter')],
        [`${mod}+P`, t('shortcutsHelp.print', 'Drucken')],
      ],
    },
    {
      title: t('shortcutsHelp.edit', 'Bearbeiten'),
      items: [
        [`${mod}+Z`, t('shortcutsHelp.undo', 'Rückgängig')],
        [`${mod}+Y`, t('shortcutsHelp.redo', 'Wiederholen')],
        [`${mod}+C`, t('shortcutsHelp.copy', 'Kopieren')],
        [`${mod}+V`, t('shortcutsHelp.paste', 'Einfügen')],
        [`${mod}+D`, t('shortcutsHelp.duplicate', 'Duplizieren')],
        [`${mod}+A`, t('shortcutsHelp.selectAll', 'Alles auswählen')],
        [t('shortcut.del', 'Entf'), t('shortcutsHelp.delete', 'Auswahl löschen')],
        [t('shortcut.esc', 'Esc'), t('shortcutsHelp.escape', 'Abwählen / Abbrechen')],
      ],
    },
    {
      title: t('shortcutsHelp.canvas', 'Canvas & Navigation'),
      items: [
        [`${mod}+K`, t('shortcutsHelp.palette', 'Befehlspalette')],
        [`${mod}+F`, t('shortcutsHelp.find', 'Gerät suchen')],
        [`${mod}++`, t('shortcutsHelp.quickAdd', 'Neues Gerät an Mausposition')],
        ['↑ ↓ ← →', t('shortcutsHelp.nudge', 'Gerät verschieben (Umsch = große Schritte)')],
        ['?', t('shortcutsHelp.help', 'Diese Übersicht anzeigen')],
      ],
    },
  ]

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('shortcutsHelp.title', 'Tastaturkürzel')}
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
