import type { EquipmentTemplate } from '../../types/equipment'
import { Star, Link, Eye, EyeOff, Download } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { Tooltip } from '../shared/Tooltip'
import { useProjectStore } from '../../store/projectStore'
import { clearCanvasSelection } from '../../lib/canvasViewport'
import { stampDeviceLibraryRef } from '../../lib/librarySync'
import { MIME_EQUIPMENT } from '../../lib/dragDropMimes'
import { format, useTranslation } from '../../lib/i18n'

interface LibraryItemProps {
  item: EquipmentTemplate
  onAdd: () => void
  onRemove?: () => void
  onToggleFavorite?: () => void
  onToggleHidden?: () => void
  onExport?: () => void
  /** #987 — Klick auf die Karte oeffnet die Eigenschaften der Vorlage im
   *  Inspector; ein eigener Bearbeiten-Knopf entfaellt. Ohne `onSelect`
   *  (Rentman-Eintraege haben keine Vorlage zum Bearbeiten) bleibt der Klick
   *  das Platzieren. Platzieren geht immer auch per Doppelklick und Drag. */
  onSelect?: () => void
  /** v7.9.106 / Issue #227 — Rentman-Item ohne Ports + gleichnamiges
   *  lokales Item mit Ports → Aktion zum Verknuepfen/Sync. Wenn gesetzt
   *  erscheint ein 🔗-Button rechts. */
  onLinkPorts?: () => void
  /** Display-Name des Match-Targets fuer den Verknuepfen-Tooltip. */
  linkTargetName?: string
}

export const LibraryItem = ({
  item,
  onAdd,
  onRemove,
  onToggleFavorite,
  onToggleHidden,
  onExport,
  onSelect,
  onLinkPorts,
  linkTargetName,
}: LibraryItemProps) => {
  const t = useTranslation()
  // Currently linked Rentman project — used to colour-code rentman badges
  // so users can distinguish "from active Rentman project" vs "from another
  // Rentman project" vs "purely local" at a glance.
  const linkedRentmanProjectId = useProjectStore(
    (state) => state.project.metadata.rentmanProjectId,
  )

  const isSelected = useProjectStore((state) => !!onSelect && state.selectedTemplateName === item.name)

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    clearCanvasSelection()
    // v7.9.33 — Stempelt den aktuellen Library-File-Stand auf das
    // platzierte Gerät. Update-Prompt beim Projekt-Öffnen vergleicht
    // gegen den dann aktuellen Folder-Stand.
    const payload = JSON.stringify(stampDeviceLibraryRef(item))
    event.dataTransfer.setData(MIME_EQUIPMENT, payload)
    event.dataTransfer.effectAllowed = 'copy'
  }

  const addFromClick = () => {
    clearCanvasSelection()
    onAdd()
  }

  const isFromActiveRentman =
    !!item.rentmanSource &&
    !!linkedRentmanProjectId &&
    item.rentmanSource === linkedRentmanProjectId
  const isFromOtherRentman = !!item.rentmanSource && !isFromActiveRentman

  // Left-edge accent strip lets the user see the source at a glance even
  // when the item is in a deep accordion.
  const accentClass = isFromActiveRentman
    ? 'border-l-2 border-l-orange-500'
    : isFromOtherRentman
      ? 'border-l-2 border-l-slate-500'
      : 'border-l-2 border-l-sky-700/60'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={(event) => {
        event.stopPropagation()
        if (onSelect) onSelect()
        else addFromClick()
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (onSelect) addFromClick()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          addFromClick()
        }
      }}
      className={`group flex w-full flex-wrap cursor-grab items-start justify-between gap-2 border ${accentClass} px-2 py-2 text-left text-cp-base active:cursor-grabbing ${
        item.hidden
          ? 'border-cp-border-muted bg-cp-surface-3 opacity-60 hover:opacity-100'
          : 'border-cp-border bg-cp-surface-1 hover:bg-cp-surface-2'
      } ${isSelected ? 'ring-1 ring-cp-accent' : ''}`}
      title={
        isFromActiveRentman
          ? format(
              t(
                'library.item.titleActiveRentman',
                'From active Rentman project{suffix} — click or drag & drop onto canvas',
              ),
              { suffix: item.rentmanProjectName ? ` "${item.rentmanProjectName}"` : '' },
            )
          : isFromOtherRentman
            ? format(
                t(
                  'library.item.titleOtherRentman',
                  'From Rentman project{suffix} — click or drag & drop onto canvas',
                ),
                { suffix: item.rentmanProjectName ? ` "${item.rentmanProjectName}"` : '' },
              )
            : t('library.item.titleLocal', 'Local device — click for properties, double-click or drag & drop onto canvas')
      }
    >
      {/* ─── `min-w-[8rem]` UND NICHT `min-w-0` (2026-09-28) ──────────────────
          Gemeldet mit einem Bild: in der Bibliothek stand „Allen &…" und
          darunter „Audio · 36 i…" — der Name war auf zwei Zeichen geschrumpft,
          waehrend fuenf Knoepfe daneben in voller Groesse standen.

          NACHGEMESSEN bei der Vorgabebreite der Leiste (260 px): die Karte ist
          225 px breit, die Knopfreihe 168 px, und fuer den Namen blieben
          DREISSIG Pixel — bei 242 px Bedarf. `min-w-0` erlaubt einem
          Flex-Kind, bis auf null zu schrumpfen, und genau das tat es.

          Die Knoepfe sind nicht zu breit: 32 px ist die Trefferflaeche, unter
          die sie nach WCAG 2.2 nicht duerfen (#951). Fuenf davon passen neben
          einen lesbaren Namen erst ab rund 300 px Kartenbreite — die Leiste
          darf aber bis auf 180 px herunter (`PANEL_LIMITS.library`).

          Also bekommt der Name eine UNTERGRENZE statt keiner: passt daneben
          keine Knopfreihe mehr, bricht sie dank `flex-wrap` am aeusseren
          Behaelter in die naechste Zeile. Die Karte wird in einer schmalen
          Leiste dauerhaft hoeher — und zwar dauerhaft und nicht erst beim
          Darueberfahren: die Reihe steht auf `opacity: 0` und nicht auf
          `display: none`, belegt ihren Platz also auch unberuehrt. Nichts
          springt, wenn die Maus ueber die Liste faehrt. */}
      <div className="min-w-[8rem] flex-1">
        <div className="truncate font-medium">
          {item.favorite && (
            <span className="mr-1 inline-flex text-amber-300">
              <Icon icon={Star} size="xs" className="fill-current" />
            </span>
          )}
          {isFromActiveRentman && (
            <span
              className="mr-1 bg-orange-600 px-1 text-cp-xs font-bold text-white"
              title={format(
                t('library.item.badgeActiveRentman', 'From active Rentman project{suffix}'),
                { suffix: item.rentmanProjectName ? `: ${item.rentmanProjectName}` : '' },
              )}
            >
              R
            </span>
          )}
          {isFromOtherRentman && (
            <span
              className="mr-1 bg-cp-surface-5 px-1 text-cp-xs font-bold text-cp-text-bright"
              title={format(
                t('library.item.badgeOtherRentman', 'From Rentman project{suffix}'),
                { suffix: item.rentmanProjectName ? `: ${item.rentmanProjectName}` : '' },
              )}
            >
              R
            </span>
          )}
          {!item.rentmanSource && (
            <span
              className="mr-1 bg-sky-800/80 px-1 text-cp-xs font-bold text-sky-100"
              title={t('library.item.badgeLocal', 'Local device (not from Rentman)')}
            >
              L
            </span>
          )}
          {item.name}
        </div>
        <div className="truncate text-cp-xs text-cp-text-muted">
          {item.category} · {item.inputs.length} in / {item.outputs.length} out
          {isFromOtherRentman && item.rentmanProjectName && (
            <span className="ml-1 text-cp-text-faint">· {item.rentmanProjectName}</span>
          )}
        </div>
        {/* #1038 — Klick markiert nur (Eigenschaften, #987); ohne diesen
            Hinweis wirkte er wirkungslos, weil auf dem Canvas nichts erscheint. */}
        {isSelected && (
          <div className="text-cp-xs text-cp-text-secondary" data-testid="library-place-hint">
            {t('library.item.placeHint', 'Double-click or drag to place it')}
          </div>
        )}
      </div>
      {/* #901 hatte hier `shrink-0`, damit der Name kuerzt und nicht die
          Knoepfe gestaucht werden. Das bleibt die Absicht — nur liegt sie
          jetzt eine Ebene tiefer.

          WARUM (2026-09-28, nachgemessen): bei der KLEINSTEN Leistenbreite
          (180 px, `PANEL_LIMITS.library`) ist die Karte 145 px breit. Fuenf
          Knoepfe brauchen 168 px. Eine Reihe, die nicht schrumpfen DARF und
          nicht umbrechen KANN, stand damit 33 px ueber den Rand hinaus — der
          rote Loeschknopf lag halb ausserhalb der Karte.

          `flex-wrap` an der Reihe loest das, ohne die Absicht aufzugeben:
          gestaucht wird immer noch nichts (`[&>*]:shrink-0` haelt jeden Knopf
          auf seiner Groesse, und 32 px ist die Untergrenze nach WCAG 2.2, vgl.
          #951) — die Knoepfe rutschen stattdessen in eine weitere Zeile. Die
          Karte wird hoeher, und das ist der richtige Preis: hoeher kann man
          lesen, abgeschnitten nicht.

          `ml-auto` und `justify-end`: bricht die Reihe unter den Namen, steht
          sie sonst links und laesst rechts eine Luecke. */}
      <div className="flex flex-wrap justify-end ml-auto gap-0.5 [&>*]:shrink-0 cp-hover-actions">
        {onToggleFavorite && (
          <Tooltip
            label={
              item.favorite
                ? t('library.item.unfavorite', 'Remove favorite')
                : t('library.item.favorite', 'Mark as favorite')
            }
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleFavorite()
              }}
              className={` px-1 text-cp-xs ${
                item.favorite
                  ? 'bg-amber-700 text-amber-100 hover:bg-amber-600'
                  : 'bg-cp-surface-4 text-cp-text-secondary hover:bg-cp-surface-5'
              }`}
              aria-label={
                item.favorite
                  ? t('library.item.unfavorite', 'Remove favorite')
                  : t('library.item.favorite', 'Mark as favorite')
              }
            >
              <Icon icon={Star} size="xs" className={item.favorite ? 'fill-current' : ''} />
            </button>
          </Tooltip>
        )}
        {onToggleHidden && (
          <Tooltip
            label={
              item.hidden
                ? t('library.item.show', 'Show again')
                : t('library.item.hide', 'Hide')
            }
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleHidden()
              }}
              className={` px-1 text-cp-xs ${
                item.hidden
                  ? 'bg-cp-surface-5 text-cp-text-bright hover:bg-slate-500'
                  : 'bg-cp-surface-4 text-cp-text-secondary hover:bg-cp-surface-5'
              }`}
              aria-label={
                item.hidden
                  ? t('library.item.show', 'Show again')
                  : t('library.item.hide', 'Hide')
              }
            >
              <Icon icon={item.hidden ? Eye : EyeOff} size="xs" />
            </button>
          </Tooltip>
        )}
        {onExport && (
          <Tooltip
            label={t(
              'library.item.exportTitle',
              'Export as file (copy to Downloads folder)',
            )}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onExport()
              }}
              className="bg-cp-surface-4 px-1 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-5"
              aria-label={t('library.item.exportAria', 'Export')}
            >
              <Icon icon={Download} size="xs" />
            </button>
          </Tooltip>
        )}
        {onLinkPorts && (
          <Tooltip
            label={
              linkTargetName
                ? format(
                    t(
                      'library.item.linkNamed',
                      'Link with local device "{name}" (take over ports)',
                    ),
                    { name: linkTargetName },
                  )
                : t(
                    'library.item.linkSameName',
                    'Link with same-named local device (take over ports)',
                  )
            }
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onLinkPorts()
              }}
              className="bg-emerald-700 px-1 text-cp-xs text-emerald-100 hover:bg-emerald-600"
              aria-label={t('library.item.linkAria', 'Link')}
            >
              <Icon icon={Link} size="xs" />
            </button>
          </Tooltip>
        )}
        {onRemove && (
          <Tooltip label={t('library.item.removeTitle', 'Remove from library')}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
              className="bg-red-700 px-1 text-cp-xs hover:bg-red-600"
              aria-label={t('library.item.removeTitle', 'Remove from library')}
            >
              ×
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
