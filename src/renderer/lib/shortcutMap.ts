// #949 — single source of the shortcut overview: the list and the virtual
// keyboard in ShortcutsHelp both render from SHORTCUT_GROUPS.
//
// Key tokens: 'Mod' (Ctrl / ⌘), 'Shift', a printable character, or a named
// key ('Delete', 'Escape', 'ArrowUp' …). A layout key matches a token when
// the token is in its `chars` — that is how '?' lands on ß (QWERTZ) or
// / (QWERTY) and '+' on its own key (QWERTZ) or on = (QWERTY).

export interface ShortcutItem {
  id: string
  keys: string[]
  /** uiStore.hotkeys action; when set, the user's binding replaces `keys`. */
  action?: string
  labelKey: string
  fallback: string
}

export interface ShortcutGroup {
  id: string
  titleKey: string
  fallback: string
  items: ShortcutItem[]
}

const item = (id: string, keys: string[], fallback: string, action?: string): ShortcutItem => ({
  id,
  keys,
  action,
  labelKey: `shortcutsHelp.${id}`,
  fallback,
})

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'file',
    titleKey: 'shortcutsHelp.file',
    fallback: 'File',
    items: [
      item('new', ['Mod', 'N'], 'New project', 'newProject'),
      item('open', ['Mod', 'O'], 'Open project', 'openProject'),
      item('save', ['Mod', 'S'], 'Save', 'save'),
      item('saveAs', ['Mod', 'Shift', 'S'], 'Save as', 'saveAs'),
    ],
  },
  {
    id: 'edit',
    titleKey: 'shortcutsHelp.edit',
    fallback: 'Edit',
    items: [
      item('undo', ['Mod', 'Z'], 'Undo', 'undo'),
      item('redo', ['Mod', 'Y'], 'Redo', 'redo'),
      item('copy', ['Mod', 'C'], 'Copy'),
      item('paste', ['Mod', 'V'], 'Paste'),
      item('duplicate', ['Mod', 'D'], 'Duplicate'),
      item('selectAll', ['Mod', 'A'], 'Select all', 'selectAll'),
      item('delete', ['Delete'], 'Delete selection', 'deleteSelected'),
      item('escape', ['Escape'], 'Deselect / cancel', 'clearSelection'),
    ],
  },
  {
    id: 'canvas',
    titleKey: 'shortcutsHelp.canvas',
    fallback: 'Canvas & navigation',
    items: [
      item('palette', ['Mod', 'K'], 'Command palette'),
      item('find', ['Mod', 'F'], 'Find device'),
      item('quickAdd', ['Mod', '+'], 'New device at cursor'),
      item(
        'nudge',
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
        'Move device (Shift = larger steps)',
      ),
      item('help', ['?'], 'Show this overview'),
    ],
  },
  {
    id: 'panels',
    titleKey: 'shortcutsHelp.panels',
    fallback: 'Panels & view',
    items: [
      item('toggleLibrary', ['Mod', 'B'], 'Show/hide library', 'toggleLibrary'),
      item('toggleProperties', ['Mod', 'I'], 'Show/hide properties', 'toggleProperties'),
      item('jumpToPatches', ['P'], 'Open patch list', 'jumpToPatches'),
      item('toggleArrows', ['A'], 'Toggle arrow display', 'toggleArrows'),
    ],
  },
]

export const ALL_SHORTCUTS: ShortcutItem[] = SHORTCUT_GROUPS.flatMap((g) => g.items)

/** Hotkey combo string ('Ctrl+Shift+S', see lib/hotkeys) as key tokens. */
export const tokensFromCombo = (combo: string): string[] =>
  combo
    .split(/\+(?=.)/)
    .filter(Boolean)
    .map((p) => (p === 'Ctrl' || p === 'Meta' ? 'Mod' : p.length === 1 ? p.toUpperCase() : p))

/** Applies the user's bindings from uiStore.hotkeys; an emptied binding drops the item. */
export const withUserHotkeys = (
  groups: ShortcutGroup[],
  hotkeys: Record<string, string>,
): ShortcutGroup[] =>
  groups.map((g) => ({
    ...g,
    items: g.items.flatMap((it) => {
      if (!it.action || !(it.action in hotkeys)) return [it]
      const keys = tokensFromCombo(hotkeys[it.action])
      return keys.length ? [{ ...it, keys }] : []
    }),
  }))

export interface KeyLabels {
  alt: string
  mod: string
  shift: string
  del: string
  esc: string
}

const ARROW: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

export const formatKey = (key: string, labels: KeyLabels): string => {
  if (key === 'Mod') return labels.mod
  if (key === 'Shift') return labels.shift
  if (key === 'Alt') return labels.alt
  if (key === 'Delete') return labels.del
  if (key === 'Escape') return labels.esc
  return ARROW[key] ?? key
}

/** Arrow keys are alternatives, not a chord. */
export const formatCombo = (keys: string[], labels: KeyLabels): string =>
  keys
    .map((key) => formatKey(key, labels))
    .join(keys.every((key) => key.startsWith('Arrow')) ? ' ' : '+')

export const keyLabelsFor = (mac: boolean, t: (k: string, f: string) => string): KeyLabels => ({
  mod: mac ? '⌘' : t('shortcut.mod', 'Ctrl'),
  shift: mac ? '⇧' : t('shortcut.shift', 'Shift'),
  del: t('shortcut.del', 'Del'),
  esc: t('shortcut.esc', 'Esc'),
  alt: mac ? '⌥' : t('shortcut.alt', 'Alt'),
})

// --- Virtual keyboard -------------------------------------------------------

export type LayoutId = 'qwertz' | 'qwerty'

export interface LayoutKey {
  /** Unique within the layout. */
  code: string
  /** Keycap text; null = modifier/named key, rendered via formatKey. */
  label: string | null
  /** Tokens this key produces (incl. shifted characters). */
  chars: string[]
  /** Width in key units. */
  w?: number
}

const key = (code: string, label: string | null, chars: string[], w?: number): LayoutKey => ({
  code,
  label,
  chars,
  w,
})
const chars = (s: string) => [...s].map((c) => key(c, c, [c]))

const bottomRow = [
  key('Mod', null, ['Mod'], 1.5),
  key('Alt', null, ['Alt'], 1.25),
  key('Space', '', [' '], 6),
  key('ArrowLeft', null, ['ArrowLeft']),
  key('ArrowUp', null, ['ArrowUp']),
  key('ArrowDown', null, ['ArrowDown']),
  key('ArrowRight', null, ['ArrowRight']),
]

export const KEYBOARD_LAYOUTS: Record<LayoutId, LayoutKey[][]> = {
  qwertz: [
    [
      key('Escape', null, ['Escape'], 1.5),
      ...chars('1234567890'),
      key('ß', 'ß ?', ['ß', '?']),
      key('Delete', null, ['Delete'], 1.5),
    ],
    [...chars('QWERTZUIOPÜ'), key('+', '+ *', ['+', '*'])],
    [...chars('ASDFGHJKLÖÄ#')],
    [key('Shift', null, ['Shift'], 2), ...chars('YXCVBNM,.-')],
    bottomRow,
  ],
  qwerty: [
    [
      key('Escape', null, ['Escape'], 1.5),
      ...chars('1234567890-'),
      key('=', '= +', ['=', '+']),
      key('Delete', null, ['Delete'], 1.5),
    ],
    [...chars('QWERTYUIOP[]')],
    [...chars("ASDFGHJKL;'")],
    [key('Shift', null, ['Shift'], 2), ...chars('ZXCVBNM,.'), key('/', '/ ?', ['/', '?'])],
    bottomRow,
  ],
}

/** QWERTZ follows the German UI; every other language gets QWERTY. */
export const layoutForLanguage = (lang: string): LayoutId => (lang === 'de' ? 'qwertz' : 'qwerty')

/** Shortcuts per keycap code for one layout. */
export const shortcutsByKey = (
  layout: LayoutKey[][],
  items: ShortcutItem[] = ALL_SHORTCUTS,
): Map<string, ShortcutItem[]> => {
  const map = new Map<string, ShortcutItem[]>()
  for (const k of layout.flat()) {
    const hits = items.filter((it) => it.keys.some((tok) => k.chars.includes(tok)))
    if (hits.length) map.set(k.code, hits)
  }
  return map
}
