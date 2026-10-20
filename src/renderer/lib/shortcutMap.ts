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
  labelKey: string
  fallback: string
}

export interface ShortcutGroup {
  id: string
  titleKey: string
  fallback: string
  items: ShortcutItem[]
}

const item = (id: string, keys: string[], fallback: string): ShortcutItem => ({
  id,
  keys,
  labelKey: `shortcutsHelp.${id}`,
  fallback,
})

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'file',
    titleKey: 'shortcutsHelp.file',
    fallback: 'File',
    items: [
      item('new', ['Mod', 'N'], 'New project'),
      item('open', ['Mod', 'O'], 'Open project'),
      item('save', ['Mod', 'S'], 'Save'),
      item('saveAs', ['Mod', 'Shift', 'S'], 'Save as'),
    ],
  },
  {
    id: 'edit',
    titleKey: 'shortcutsHelp.edit',
    fallback: 'Edit',
    items: [
      item('undo', ['Mod', 'Z'], 'Undo'),
      item('redo', ['Mod', 'Y'], 'Redo'),
      item('copy', ['Mod', 'C'], 'Copy'),
      item('paste', ['Mod', 'V'], 'Paste'),
      item('duplicate', ['Mod', 'D'], 'Duplicate'),
      item('selectAll', ['Mod', 'A'], 'Select all'),
      item('delete', ['Delete'], 'Delete selection'),
      item('escape', ['Escape'], 'Deselect / cancel'),
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
      item('toggleLibrary', ['Mod', 'B'], 'Show/hide library'),
      item('toggleProperties', ['Mod', 'I'], 'Show/hide properties'),
      item('jumpToPatches', ['P'], 'Open patch list'),
      item('toggleArrows', ['A'], 'Toggle arrow display'),
    ],
  },
]

export const ALL_SHORTCUTS: ShortcutItem[] = SHORTCUT_GROUPS.flatMap((g) => g.items)

export interface KeyLabels {
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
