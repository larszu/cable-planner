/**
 * v7.9.85 / #123 — Layer-Visibility-Chip-Strip in der Canvas-Toolbar.
 *
 * Zeigt einen kompakten Chip pro Top-Level-Layer (Video/Audio/Control/
 * Network/Power) plus alle User-Custom-Layer. Klick auf einen Chip
 * toggelt die Sichtbarkeit der Kabel auf diesem Layer.
 *
 * Drittes Plus-Chip am Ende öffnet einen kleinen Inline-Editor für
 * Custom-Layer (Add/Remove). Hover zeigt einen "Alle ein/aus"-Bulk-
 * Reset oben links als kleiner Reset-Pfeil.
 *
 * UX-Designer-Rationale:
 *  - Chip-Strip ist horizontal kompakt, fügt sich in die existierende
 *    Toolbar ein ohne Vertikal-Space zu fordern
 *  - Farbcodierte Indicator-Dots (passend zu LAYER_STYLES) damit der
 *    User SOFORT erkennt welche Spur welche Farbe hat
 *  - Aktiv = gedeckt-farbiger Background; Inaktiv = grau opak
 *  - Tooltip erklärt was passiert
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Diamond, Plus} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { Icon } from '../shared/Icon'
import { LAYER_STYLES, STANDARD_LAYERS, countCablesByLayer, type StandardLayer } from '../../lib/cableLayers'
import { promptDialog } from '../../lib/promptDialog'
import { confirmDialog } from '../../lib/confirmDialog'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { format, useTranslation } from '../../lib/i18n'
import { useLongPress } from '../../hooks/useLongPress'

/**
 * `teil`: die Leiste zeigt nur die Chips, die Verwaltung (eigene Ebene
 * anlegen, alle wieder einblenden) steht unter „Mehr" (2026-10-14).
 */
export const LayerVisibilityChips = ({ teil = 'alles' }: { teil?: 'alles' | 'chips' | 'verwaltung' } = {}) => {
  const chips = teil !== 'verwaltung'
  const verwaltung = teil !== 'chips'
  const t = useTranslation()
  const layerVisibility = useUiStore((s) => s.layerVisibility)
  const setLayerVisibility = useUiStore((s) => s.setLayerVisibility)
  const resetLayerVisibility = useUiStore((s) => s.resetLayerVisibility)
  const customLayers = useUiStore((s) => s.customLayers)
  const addCustomLayer = useUiStore((s) => s.addCustomLayer)
  const removeCustomLayer = useUiStore((s) => s.removeCustomLayer)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuHuelle = useRef<HTMLDivElement | null>(null)

  /**
   * KLICK DANEBEN UND ESCAPE SCHLIESSEN — nicht nur die Maus, die hinausfaehrt.
   *
   * Bis B-77 kannte dieses Menue genau EINEN Weg zu: `onMouseLeave`. Wer
   * keine Maus hat, hatte keinen. Auf einem Tablet blieb die Klappe stehen,
   * bis man einen ihrer beiden Eintraege ausloeste; mit der Tastatur ging sie
   * gar nicht mehr weg.
   *
   * Und sie blieb nicht nur stehen, sie VERDECKTE: `bedienbar:check` in der
   * Suite meldete bei 390 und 768 px zwei bis drei Bedienpunkte der Leiste
   * darunter („Power", „Other", „Lock", „Finalise", „Badges") als „liegen
   * unter einem anderen Element" — die 224 px breite Klappe lag darauf.
   * Gemessen war damit beides auf einmal: dass sie nicht zugeht, und was das
   * kostet.
   *
   * Dieselbe Regel wie fuer jeden Dialog dieser App (B-44).
   */
  useEffect(() => {
    if (!menuOpen) return
    const daneben = (e: MouseEvent) => {
      if (menuHuelle.current && !menuHuelle.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', daneben)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', daneben)
      document.removeEventListener('keydown', esc)
    }
  }, [menuOpen])
  // v7.9.93 — Counter pro Layer. #1189: die Zahl steht jetzt IM Chip,
  // nicht nur im Tooltip — „25 Strom, 0 DMX" sieht man nur beim Hinsehen,
  // nicht beim Darueberfahren.
  const cables = useProjectStore((s) => s.project.cables)
  const counts = useMemo(() => countCablesByLayer(cables), [cables])
  const soloLayer = useUiStore((s) => s.soloLayer)

  /** #1189 — Klick blendet aus/ein, Doppelklick oder Alt-Klick schaltet die
   *  Ebene einsam (nur sie sichtbar); dasselbe noch einmal holt alle zurueck.
   *  Der Doppelklick schaltet vorher zweimal um und landet damit wieder beim
   *  Ausgangszustand — das Einsam-Schalten setzt danach auf. */
  const chipHandlers = (layer: string, visible: boolean) => ({
    onClick: (e: React.MouseEvent) => {
      if (e.altKey) soloLayer(layer)
      else setLayerVisibility(layer, !visible)
    },
    onDoubleClick: () => soloLayer(layer),
  })

  const allOn = STANDARD_LAYERS.every((l) => layerVisibility[l] !== false) &&
    customLayers.every((l) => layerVisibility[l] !== false)

  const handleAddCustom = async () => {
    const name = (await promptDialog(
      t('canvas.layerChips.customLayerPrompt', 'Create custom layer (e.g. "intercom", "lighting")'),
      '',
    ))?.trim()
    if (!name) return
    addCustomLayer(name)
  }


  // B-44 — das Entfernen eines eigenen Layers haengt bisher am Rechtsklick,
  // und den gibt es auf einem Tablet nicht. Die Aktion steht deshalb einmal
  // hier und wird von beiden Wegen gerufen; zwei Fassungen derselben
  // Rueckfrage waeren die Defektform `zwei-rechnungen`.
  const bindeLangenDruck = useLongPress()
  const langerDruck = (layer: string) => bindeLangenDruck(() => entfernen(layer))

  const entfernen = (layer: string) => {
    void (async () => {
      const ok = await confirmDialog(
        format(t('canvas.layerChips.removeCustom', 'Remove custom layer "{layer}"?'), {
          layer,
        }),
        { destructive: true, okLabel: t('common.delete', 'Delete') },
      )
      if (ok) removeCustomLayer(layer)
    })()
  }
  return (
    /* GEMESSEN am 2026-09-10 (390x844): dieser Streifen lief ohne
       `flex-wrap` bis Pixel 726 auf einer 390 Pixel breiten Anzeige — er
       hing weit ueber die Werkzeugleiste hinaus, und die Leiste selbst
       konnte nichts dagegen tun: SIE bricht um (`flexWrap` in
       `CanvasToolbar.tsx`), aber ein einzelnes Flex-Kind bricht nicht von
       allein. Auf dem Schirmbild des Nutzers endete die Reihe mitten im
       Wort „Control". `min-w-0` gehoert dazu: ohne das darf das Kind unter
       seine Inhaltsbreite gar nicht erst schrumpfen.
       Der Ausdruck-Dialog setzt denselben Umbruch schon aussen herum. */
    <div
      ref={menuHuelle}
      className="relative flex min-w-0 flex-wrap items-center gap-1"
      role="group"
      aria-label={t('canvas.layerChips.layers', 'Layers')}
      title={t(
        'canvas.layerChips.layerStripTitle',
        'Layer visibility (only cables are filtered, devices stay)',
      )}
    >
      {/* Design-Vertrag 2026-10, Runde „ruhiger" (2026-10-14): die Chips sind
          einfarbig neutral, aktiv im Akzent-weich. Die Signalart steht nur
          noch als kleiner Farbpunkt im Chip — vorher trug jeder Chip Rahmen,
          Flaeche und Schrift in seiner Gewerkfarbe, fuenf bunte Kaesten in
          einer Reihe, die lauter waren als der Plan darunter. */}
      {chips && (STANDARD_LAYERS as readonly StandardLayer[]).map((layer) => {
        const style = LAYER_STYLES[layer]
        const visible = layerVisibility[layer] !== false
        const count = counts[layer] ?? 0
        return (
          <button
            key={layer}
            type="button"
            aria-pressed={visible}
            {...chipHandlers(layer, visible)}
            title={format(
              t(
                'canvas.layerChips.chipTitleSolo',
                '{label} — {count} cables · {state} · double-click: only this layer',
              ),
              {
                label: style.label,
                count,
                state: visible
                  ? t('canvas.layerChips.visibleHide', 'visible (click to hide)')
                  : t('canvas.layerChips.hiddenShow', 'hidden (click to show)'),
              },
            )}
            className="cp-chip"
          >
            <span className="cp-chip__dot" style={{ color: style.color }} aria-hidden="true" />
            <span>{style.label}</span>
            <span className="tabular-nums text-cp-text-muted">{count}</span>
          </button>
        )
      })}
      {chips && customLayers.map((layer) => {
        const visible = layerVisibility[layer] !== false
        return (
          <button
            key={layer}
            type="button"
            aria-pressed={visible}
            {...chipHandlers(layer, visible)}
            onContextMenu={(e) => {
              e.preventDefault()
              entfernen(layer)
            }}
            /* B-44 — derselbe Weg fuer Geraete ohne Rechtsklick. Der Haken
               bricht ab, sobald der Zeiger wandert: dann war es ein Zug. */
            {...langerDruck(layer)}
            title={format(
              t(
                'canvas.layerChips.customTitleSolo',
                '{layer} (custom) — {count} cables · double-click: only this layer · right-click to remove',
              ),
              { layer, count: counts[layer] ?? 0 },
            )}
            className="cp-chip"
          >
            <Icon icon={Diamond} size="xs" />
            <span>{layer}</span>
            <span className="tabular-nums text-cp-text-muted">{counts[layer] ?? 0}</span>
          </button>
        )
      })}
      {verwaltung && (<>
      {/* „⋯" allein sagt niemandem, dass dahinter das Anlegen einer eigenen
          Ebene und das Zuruecksetzen aller Ebenen steckt (Nutzer-Rueckmeldung
          2026-09-07). Der Knopf traegt jetzt das Wort. */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        title={t('canvas.layerChips.menuTitle', 'Layer management (create custom / reset all)')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="cp-chip cp-chip--plain"
      >
        <span>{t('canvas.layerChips.menuButton', 'Layers')}</span>
        <span aria-hidden="true">⋯</span>
      </button>
      {menuOpen && (
        <div
          /* `role="menu"` (B-77): der Knopf verspricht mit
             `aria-haspopup="menu"` ein Menue. Hier stand ein nackter `div`,
             und seine Eintraege waren nackte Knoepfe — ein Screenreader
             wurde angekuendigt und fand dann keines. `bedienbar:check` in der
             Suite meldete „der Klick oeffnet keine Klappe", weil er genau an
             dieser Zusage misst. */
          role="menu"
          onMouseLeave={() => setMenuOpen(false)}
          className="absolute right-0 top-8 z-50 w-56 overflow-hidden border border-cp-border bg-cp-surface-raised text-cp-xs text-cp-text"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              void handleAddCustom()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-cp-surface-2"
          >
            <Icon icon={Plus} size="xs" />
            <span>{t('canvas.layerChips.addCustom', 'Create custom layer…')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              resetLayerVisibility()
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-cp-surface-2"
            disabled={allOn}
            style={{ opacity: allOn ? 0.5 : 1 }}
          >
            <Icon icon={Eye} size="xs" />
            <span>{t('canvas.layerChips.resetAll', 'Show all layers again')}</span>
          </button>
        </div>
      )}
      </>)}
    </div>
  )
}
