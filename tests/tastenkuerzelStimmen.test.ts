import { describe, expect, it } from 'vitest'
import uiStoreSrc from '../src/renderer/store/uiStore.ts?raw'
import hotkeysSrc from '../src/renderer/lib/hotkeys.ts?raw'
import appSrc from '../src/renderer/App.tsx?raw'
import helpSrc from '../src/renderer/components/Layout/ShortcutsHelp.tsx?raw'

// Die Tastatur-Oberflaeche wird an VIER Stellen beschrieben, und sie waren sich
// nicht einig (gemessen 2026-09-04):
//
//   Bindungen   `uiStore.ts` hotkeys                 14 Eintraege
//   Namen       `hotkeys.ts` HOTKEY_ACTION_LABEL     14 -- speist den Einstellungen-Tab
//   Handler     `App.tsx`    hotkeyHandlers          11
//   Hilfe       `ShortcutsHelp.tsx`                  18
//
// Konkret gelogen hat die Hilfe an zwei Stellen: `Strg+P` (Drucken) und
// `Strg+A` (Alles auswaehlen) hatten im ganzen Repo keinen Handler, keine
// Hotkey-Aktion und keinen Menue-Accelerator -- `main/index.ts:310` setzt das
// Applikationsmenue auf `null`, es gibt also gar keine. Bei `Strg+A` versprach
// zusaetzlich das Bearbeiten-Menue dasselbe Kuerzel ein zweites Mal.
//
// Umgekehrt boten die Einstellungen drei Aktionen zum Neubelegen an, die keinen
// Handler haben: `useHotkeys` prueft `handlers[action]` und ueberspringt sie
// still. Man kann ihnen eine Taste zuweisen, und sie tut nichts.
//
// Dieser Test rechnet die vier Listen aus dem Quelltext aus, statt sie zu
// behaupten. Wer eine Zeile in der Hilfe ergaenzt, muss sagen, wo sie behandelt
// wird -- genau das haette `Strg+P` nie ueberstanden.

/**
 * Die Schluessel eines Objekt-Literals `name: { a: '…', b: '…' }`.
 *
 * Der Block endet an der ersten Zeile, die nur `}` oder `},` enthaelt --
 * `HOTKEY_ACTION_LABEL` schliesst ohne Komma auf Spaltenebene 0, `hotkeys`
 * mit Komma und Einrueckung. Die erste Fassung kannte nur die Komma-Form und
 * fand deshalb eine der beiden Listen gar nicht.
 */
const keysOf = (src: string, name: string): string[] => {
  const block = new RegExp(
    `${name}:\\s*(?:Record<string, string> = )?\\{([\\s\\S]*?)\\n\\s*\\},?\\n`,
  ).exec(src)
  if (!block) return []
  return [...block[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1])
}

const bindungen = keysOf(uiStoreSrc, 'hotkeys')
const namen = keysOf(hotkeysSrc, 'export const HOTKEY_ACTION_LABEL')

/**
 * `hotkeyHandlers` ist kein einfaches Literal, sondern ein `useMemo(() => ({…}))`
 * -- der Block endet auf `}),`, nicht auf `},`. Deshalb ein eigener Ausschnitt
 * statt `keysOf`. (Die erste Fassung dieses Tests nahm `keysOf`, fand nichts,
 * und meldete daraufhin JEDE Bindung als handlerlos -- ein Guard, der zu viel
 * meldet, ist genauso unbrauchbar wie einer, der zu wenig meldet.)
 */
const handler = (() => {
  const m = /const hotkeyHandlers = useMemo\(\s*\(\) => \(\{([\s\S]*?)\n\s*\}\),/.exec(appSrc)
  if (!m) return []
  return [...m[1].matchAll(/^\s{6}(\w+):/gm)].map((x) => x[1])
})()

/**
 * Aktionen, die eine Bindung und einen Namen haben, aber bewusst KEINEN
 * Handler. Wer hier etwas eintraegt, sagt: das ist bekannt und der Grund
 * steht daneben. Ein leerer Eintrag ist keine Erklaerung.
 */
const OHNE_HANDLER: Record<string, string> = {
  showLegend:
    'Es gibt keine Aktion dafuer. "Legende" ist im Code nur ein Tooltip der ' +
    'Toolbar (CanvasToolbar.tsx:1190), kein schaltbares Element. Eine zu ' +
    'erfinden waere eine neue Funktion, keine Reparatur.',
  toggleRouting:
    'EdgeRouting hat DREI Werte (orthogonal | straight | curved). Was ein ' +
    '"Toggle" zwischen dreien bedeutet, ist nicht ableitbar; die Reihenfolge ' +
    'waere geraten. setDefaultRouting existiert, die Semantik nicht.',
}

/**
 * Kuerzel, die in der Hilfe stehen, aber nicht aus der Hotkey-Registry kommen.
 * Jeder Eintrag nennt, WO er behandelt wird -- nachpruefbar, nicht behauptet.
 */
const AUSSERHALB_DER_REGISTRY: Record<string, string> = {
  'Mod+C': 'useCanvasKeyboardShortcuts — Kopieren',
  'Mod+V': 'useCanvasKeyboardShortcuts — Einfuegen',
  'Mod+D': 'useCanvasKeyboardShortcuts — Duplizieren',
  'Mod+K': 'CommandPalette — eigener keydown-Listener',
  'Mod+F': 'CanvasSearch — eigener keydown-Listener',
  'Mod++': 'useCanvasKeyboardShortcuts — Schnell-Anlage an Mausposition',
}

describe('Tastenkuerzel — die vier Listen stimmen ueberein', () => {
  it('findet alle vier Listen (sonst prueft der Test nichts)', () => {
    expect(bindungen.length, 'uiStore.hotkeys nicht gefunden').toBeGreaterThan(10)
    expect(namen.length, 'HOTKEY_ACTION_LABEL nicht gefunden').toBeGreaterThan(10)
    expect(handler.length, 'hotkeyHandlers nicht gefunden').toBeGreaterThan(8)
  })

  it('jede Bindung hat einen Namen und jeder Name eine Bindung', () => {
    // Der Einstellungen-Tab baut seine Zeilen aus HOTKEY_ACTION_LABEL
    // (HotkeysTab.tsx:72). Ein Name ohne Bindung waere dort eine leere Zeile,
    // eine Bindung ohne Namen eine unsichtbare Taste.
    expect([...bindungen].sort()).toEqual([...namen].sort())
  })

  it('jede Bindung hat einen Handler — oder steht mit Grund auf der Ausnahmeliste', () => {
    const stumm = bindungen.filter((a) => !handler.includes(a) && !(a in OHNE_HANDLER))
    expect(stumm, `Bindung ohne Handler und ohne Begruendung: ${stumm.join(', ')}`).toEqual([])
  })

  it('die Ausnahmeliste enthaelt nichts, was inzwischen einen Handler hat', () => {
    // Sonst wird die Liste zum Friedhof und verdeckt echte Fortschritte.
    const ueberholt = Object.keys(OHNE_HANDLER).filter((a) => handler.includes(a))
    expect(ueberholt, `hat inzwischen einen Handler: ${ueberholt.join(', ')}`).toEqual([])
  })

  it('jedes Mod+X in der Hilfe ist entweder registriert oder nachweisbar erklaert', () => {
    // Das ist der Test, den `Strg+P` nicht ueberstanden haette: um es stehen zu
    // lassen, haette jemand hinschreiben muessen, wo es behandelt wird.
    const combos = [...helpSrc.matchAll(/\$\{mod\}\+(?:\$\{shift\}\+)?(\+|\w)/g)].map(
      (m) => `Mod+${m[1].toUpperCase()}`,
    )
    expect(combos.length, 'keine Mod+X-Zeilen in der Hilfe gefunden').toBeGreaterThan(5)

    const ausRegistry = new Set(
      [...uiStoreSrc.matchAll(/^\s*\w+:\s*'Ctrl\+(?:Shift\+)?(\+|\w)'/gm)].map(
        (m) => `Mod+${m[1].toUpperCase()}`,
      ),
    )
    const unerklaert = [...new Set(combos)].filter(
      (c) => !ausRegistry.has(c) && !(c in AUSSERHALB_DER_REGISTRY),
    )
    expect(
      unerklaert,
      `in der Hilfe versprochen, aber nirgends registriert und nicht erklaert: ${unerklaert.join(', ')}`,
    ).toEqual([])
  })

  it('die Erklaerungsliste behauptet nichts, was die Hilfe gar nicht zeigt', () => {
    const inHilfe = new Set(
      [...helpSrc.matchAll(/\$\{mod\}\+(?:\$\{shift\}\+)?(\+|\w)/g)].map(
        (m) => `Mod+${m[1].toUpperCase()}`,
      ),
    )
    const verwaist = Object.keys(AUSSERHALB_DER_REGISTRY).filter((c) => !inHilfe.has(c))
    expect(verwaist, `erklaert, steht aber nicht in der Hilfe: ${verwaist.join(', ')}`).toEqual([])
  })
})
