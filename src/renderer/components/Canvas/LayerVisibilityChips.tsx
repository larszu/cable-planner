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
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { Icon } from '../shared/Icon'
import { LAYER_STYLES, STANDARD_LAYERS, topLayer, type StandardLayer } from '../../lib/cableLayers'
import { promptDialog } from '../../lib/promptDialog'
import { confirmDialog } from '../../lib/confirmDialog'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { format, useTranslation } from '../../lib/i18n'

export const LayerVisibilityChips = () => {
  const t = useTranslation()
  const layerVisibility = useUiStore((s) => s.layerVisibility)
  const setLayerVisibility = useUiStore((s) => s.setLayerVisibility)
  const resetLayerVisibility = useUiStore((s) => s.resetLayerVisibility)
  const customLayers = useUiStore((s) => s.customLayers)
  const addCustomLayer = useUiStore((s) => s.addCustomLayer)
  const removeCustomLayer = useUiStore((s) => s.removeCustomLayer)
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = canvasTheme === 'light'
  const [menuOpen, setMenuOpen] = useState(false)
  // v7.9.93 — Counter pro Layer: zeigt dem User auf einen Blick wie
  // viele Kabel auf welchem Layer liegen. Macht das Feature sichtbar:
  // wenn alle Counter "0" sind weiß der User dass keine Layer-
  // Zuordnung im Projekt existiert (z.B. altes Projekt vor v7.9.85).
  // v7.9.95: Kabel ohne layer-Feld landen im 'other'-Bucket, damit das
  // 'other'-Chip die Custom/Undefined-Kabel sichtbar macht.
  const cables = useProjectStore((s) => s.project.cables)
  const layerCounts = (() => {
    const counts: Record<string, number> = {}
    for (const c of cables) {
      const top = topLayer(c.layer) ?? c.layer ?? 'other'
      counts[top] = (counts[top] ?? 0) + 1
    }
    return { counts, total: cables.length }
  })()

  const allOn = STANDARD_LAYERS.every((l) => layerVisibility[l] !== false) &&
    customLayers.every((l) => layerVisibility[l] !== false)

  const handleAddCustom = async () => {
    const name = (await promptDialog(
      t('canvas.layerChips.customLayerPrompt', 'Custom-Layer anlegen (z.B. "intercom", "lighting")'),
      '',
    ))?.trim()
    if (!name) return
    addCustomLayer(name)
  }

  return (
    <div className="relative flex items-center gap-1">
      <span
        className={`select-none text-[9px] uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-400'}`}
        title={t(
          'canvas.layerChips.layerStripTitle',
          'Layer-Sichtbarkeit (nur Kabel werden gefiltert, Geräte bleiben)',
        )}
      >
        {t('canvas.layerChips.layers', 'Ebenen')}
      </span>
      {(STANDARD_LAYERS as readonly StandardLayer[]).map((layer) => {
        const style = LAYER_STYLES[layer]
        const visible = layerVisibility[layer] !== false
        const count = layerCounts.counts[layer] ?? 0
        return (
          <button
            key={layer}
            type="button"
            onClick={() => setLayerVisibility(layer, !visible)}
            title={format(
              t(
                'canvas.layerChips.chipTitle',
                '{label} — {count} Kabel · {state}',
              ),
              {
                label: style.label,
                count,
                state: visible
                  ? t('canvas.layerChips.visibleHide', 'sichtbar (klick: ausblenden)')
                  : t('canvas.layerChips.hiddenShow', 'ausgeblendet (klick: einblenden)'),
              },
            )}
            className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium transition"
            style={{
              borderColor: visible ? style.color : isLight ? '#cbd5e1' : '#334155',
              background: visible
                ? isLight
                  ? `${style.color}22`
                  : `${style.color}33`
                : 'transparent',
              color: visible ? style.color : isLight ? '#94a3b8' : '#475569',
              opacity: visible ? 1 : 0.6,
              textDecoration: visible ? 'none' : 'line-through',
            }}
          >
            <span className="text-[11px]">{style.icon}</span>
            <span>{style.label}</span>
            {count > 0 && (
              <span
                className="rounded-full px-1 text-[8px] font-semibold"
                style={{
                  background: visible ? `${style.color}55` : isLight ? '#cbd5e1' : '#334155',
                  color: visible ? '#fff' : isLight ? '#475569' : '#94a3b8',
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
      {customLayers.map((layer) => {
        const visible = layerVisibility[layer] !== false
        return (
          <button
            key={layer}
            type="button"
            onClick={() => setLayerVisibility(layer, !visible)}
            onContextMenu={(e) => {
              e.preventDefault()
              void (async () => {
                const ok = await confirmDialog(
                  format(t('canvas.layerChips.removeCustom', 'Custom-Layer "{layer}" entfernen?'), {
                    layer,
                  }),
                  { destructive: true, okLabel: t('common.delete', 'Löschen') },
                )
                if (ok) removeCustomLayer(layer)
              })()
            }}
            title={format(
              t('canvas.layerChips.customTitle', '{layer} (custom) — Rechtsklick zum Entfernen'),
              { layer },
            )}
            className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium transition"
            style={{
              borderColor: visible ? '#94a3b8' : isLight ? '#cbd5e1' : '#334155',
              background: visible
                ? isLight
                  ? '#cbd5e122'
                  : '#94a3b833'
                : 'transparent',
              color: visible ? (isLight ? '#475569' : '#cbd5e1') : isLight ? '#94a3b8' : '#475569',
              opacity: visible ? 1 : 0.6,
              textDecoration: visible ? 'none' : 'line-through',
            }}
          >
            <span>◆</span>
            <span>{layer}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        title={t('canvas.layerChips.menuTitle', 'Layer-Verwaltung (Custom anlegen / alle zurücksetzen)')}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] transition ${
          isLight
            ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        ⋯
      </button>
      {menuOpen && (
        <div
          onMouseLeave={() => setMenuOpen(false)}
          className={`absolute right-0 top-7 z-50 w-56 overflow-hidden rounded border text-cp-xs shadow-2xl ${
            isLight ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-700 bg-slate-900 text-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              void handleAddCustom()
            }}
            className={`flex w-full items-center gap-2 border-b px-3 py-2 text-left ${
              isLight ? 'border-slate-200 hover:bg-slate-100' : 'border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span>➕</span>
            <span>{t('canvas.layerChips.addCustom', 'Custom-Layer anlegen…')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              resetLayerVisibility()
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
              isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'
            }`}
            disabled={allOn}
            style={{ opacity: allOn ? 0.5 : 1 }}
          >
            <Icon icon={Eye} size="xs" />
            <span>{t('canvas.layerChips.resetAll', 'Alle Ebenen wieder einblenden')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
