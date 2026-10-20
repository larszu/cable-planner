// #ux — Tastaturkürzel-Übersicht.
//
// Öffnet mit "?" (Shift+/) und über das Hilfe-Menü (CustomEvent
// 'cp:open-shortcuts-help'). Zwei Ansichten aus derselben Quelle
// (lib/shortcutMap): virtuelle Tastatur (#949) und Liste.
import { useEffect, useMemo, useState } from 'react'
import { Keyboard, List } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { useTranslation } from '../../lib/i18n'
import { useUiStore } from '../../store/uiStore'
import {
  KEYBOARD_LAYOUTS,
  SHORTCUT_GROUPS,
  formatCombo,
  formatKey,
  keyLabelsFor,
  layoutForLanguage,
  shortcutsByKey,
  type KeyLabels,
  type ShortcutItem,
} from '../../lib/shortcutMap'

const isMac =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

type View = 'keyboard' | 'list'

const Kbd = ({ children }: { children: string }) => (
  <kbd className="shrink-0 rounded-cp-control border border-cp-border bg-cp-surface-2 px-2 py-0.5 text-cp-xs text-cp-text">
    {children}
  </kbd>
)

const ShortcutRows = ({ items, labels }: { items: ShortcutItem[]; labels: KeyLabels }) => {
  const t = useTranslation()
  return (
    <ul className="space-y-1">
      {items.map((it) => (
        <li key={it.id} className="flex items-center justify-between gap-3 text-cp-sm">
          <span className="text-cp-text-secondary">{t(it.labelKey, it.fallback)}</span>
          <Kbd>{formatCombo(it.keys, labels)}</Kbd>
        </li>
      ))}
    </ul>
  )
}

const KeyboardView = ({ labels }: { labels: KeyLabels }) => {
  const t = useTranslation()
  const lang = useUiStore((s) => s.language)
  const layout = KEYBOARD_LAYOUTS[layoutForLanguage(lang)]
  const byKey = useMemo(() => shortcutsByKey(layout), [layout])
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const active = hover ?? pinned
  const activeItems = active ? (byKey.get(active) ?? []) : []

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto flex min-w-[34rem] max-w-[46rem] flex-col gap-1" role="group">
          {layout.map((row, i) => (
            <div key={i} className="flex gap-1">
              {row.map((k) => {
                const assigned = byKey.has(k.code)
                const selected = active === k.code
                const text = k.label ?? formatKey(k.code, labels)
                return (
                  <button
                    key={k.code}
                    type="button"
                    disabled={!assigned}
                    aria-pressed={assigned ? pinned === k.code : undefined}
                    aria-label={text || t('shortcutsHelp.space', 'Space')}
                    onMouseEnter={() => assigned && setHover(k.code)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => assigned && setHover(k.code)}
                    onBlur={() => setHover(null)}
                    onClick={() => setPinned((p) => (p === k.code ? null : k.code))}
                    style={{ flexGrow: k.w ?? 1, flexBasis: 0 }}
                    className={`h-9 min-w-0 truncate rounded-cp-s border px-1 text-cp-xs transition-colors ${
                      selected
                        ? 'border-cp-accent bg-cp-accent text-white'
                        : assigned
                          ? 'border-cp-accent bg-cp-accent-soft text-cp-text hover:border-cp-accent'
                          : 'border-cp-border-muted bg-cp-surface-1 text-cp-text-faint'
                    }`}
                  >
                    {text}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div
        className="min-h-[5rem] rounded-cp-card border border-cp-border-muted bg-cp-surface-2 p-3"
        aria-live="polite"
      >
        {activeItems.length ? (
          <ShortcutRows items={activeItems} labels={labels} />
        ) : (
          <p className="text-cp-sm text-cp-text-muted">
            {t(
              'shortcutsHelp.keyboardHint',
              'Highlighted keys have actions. Hover or click a key to see them.',
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export const ShortcutsHelp = () => {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('keyboard')

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

  const labels = keyLabelsFor(isMac, t)
  const views: { id: View; icon: typeof Keyboard; label: string }[] = [
    {
      id: 'keyboard',
      icon: Keyboard,
      label: t('shortcutsHelp.viewKeyboard', 'Keyboard'),
    },
    { id: 'list', icon: List, label: t('shortcutsHelp.viewList', 'List') },
  ]

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('shortcutsHelp.title', 'Keyboard shortcuts')}
      titleIcon={<Icon icon={Keyboard} size="sm" />}
      maxWidth="lg"
    >
      <div
        className="mb-3 inline-flex rounded-cp-control border border-cp-border p-0.5"
        role="tablist"
      >
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-cp-s px-3 text-cp-sm ${
              view === v.id
                ? 'bg-cp-accent text-white'
                : 'text-cp-text-secondary hover:bg-cp-surface-2'
            }`}
          >
            <Icon icon={v.icon} size="sm" />
            {v.label}
          </button>
        ))}
      </div>
      {view === 'keyboard' ? (
        <KeyboardView labels={labels} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((g) => (
            <div key={g.id}>
              <h3 className="mb-2 text-cp-sm font-semibold text-cp-text-secondary">
                {t(g.titleKey, g.fallback)}
              </h3>
              <ShortcutRows items={g.items} labels={labels} />
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  )
}
