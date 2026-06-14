import { useMemo, useState } from 'react'
import { Zap, Link, Square, SquareCheck } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { format, useTranslation } from '../../lib/i18n'

interface ChecklistItem {
  id: string
  name: string
  category: string
  checked: boolean
  qty?: number
  parentId?: string | null
  /** When set, shown as a "Template erkannt" badge next to the item. */
  templateMatch?: string
  /** v7.9.128 — How the templateMatch was found, drives badge wording:
   *  - 'rentmanId': Lokales Template hat denselben rentmanId → wird
   *    beim Re-Import unsichtbar gemerged (Metadata-Update), Ports
   *    bleiben erhalten.
   *  - 'nameOnly': Lokales Template hat den gleichen Namen aber
   *    KEINEN passenden rentmanId. Trigger fuer Konflikt-Dialog —
   *    User waehlt was passieren soll (lokal behalten + Rentman-ID
   *    anhaengen ist der Default-Empfohlene).
   *  - 'catalog': Match gegen built-in Katalog (Blackmagic,
   *    Ubiquiti, Monitor, Camera, Misc, GreenGo).
   *  - undefined: kein Match. */
  templateMatchKind?: 'rentmanId' | 'nameOnly' | 'catalog'
  /** Rentman-Art der Zeile (defensiv geparst). Kommentar = kein Gerät. */
  kind?: 'device' | 'virtual' | 'physical' | 'comment'
  contentsCount?: number
}

interface EquipmentChecklistProps {
  items: ChecklistItem[]
  onToggle: (id: string) => void
  onSetAll?: (checked: boolean) => void
  onQtyChange?: (id: string, qty: number) => void
  onSetAllChildren?: (parentId: string, checked: boolean) => void
  /**
   * #335: Per-Kombination "Als Rack importieren". Markierte Sets werden beim
   * Import zu einem Cable-Planner-Rack (Kombi-Name = Rack-Name, Kombi-ID am
   * Rack, Inhalte als Rack-Geräte mit eigenen Rentman-IDs) statt zu einzelnen
   * Templates.
   */
  rackSetIds?: Set<string>
  onSetAsRack?: (parentId: string, asRack: boolean) => void
  /** Stufe 3 — "Nur Hauptgerät": Auswahl auf das eine signal-relevante Teil
   *  der Kombination setzen (Zubehör überspringen). */
  onSetMainOnly?: (parentId: string) => void
  /**
   * Issue #33: Per-row "link to existing local device" mapping. When
   * provided, each row gets a dropdown of local equipment (without a
   * Rentman ID yet). Selecting one writes that Rentman id onto the
   * existing equipment so the user can claim a manually-built device
   * during a later Rentman re-fetch instead of getting a duplicate.
   */
  linkableEquipment?: Array<{ id: string; name: string }>
  onLinkExisting?: (rentmanItemId: string, localEquipmentId: string) => void
  /** Map of Rentman item id → local equipment id that has been linked (for badge). */
  linkedMap?: Record<string, string>
}

export const EquipmentChecklist = ({
  items,
  onToggle,
  onSetAll,
  onQtyChange,
  onSetAllChildren,
  rackSetIds,
  onSetAsRack,
  onSetMainOnly,
  linkableEquipment,
  onLinkExisting,
  linkedMap,
}: EquipmentChecklistProps) => {
  const t = useTranslation()
  // Build parent -> children map. Children whose parent is not in the visible list
  // are promoted to root level so they remain reachable.
  const { roots, childrenByParent } = useMemo(() => {
    const ids = new Set(items.map((i) => i.id))
    const map: Record<string, ChecklistItem[]> = {}
    const rootList: ChecklistItem[] = []
    for (const item of items) {
      if (item.parentId && ids.has(item.parentId)) {
        map[item.parentId] = map[item.parentId] ?? []
        map[item.parentId].push(item)
      } else {
        rootList.push(item)
      }
    }
    return { roots: rootList, childrenByParent: map }
  }, [items])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const grouped = roots.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const key = item.category || 'Uncategorized'
    acc[key] = acc[key] ?? []
    acc[key].push(item)
    return acc
  }, {})

  const hasAnySets = Object.keys(childrenByParent).length > 0

  const expandAll = () => setExpanded(new Set(Object.keys(childrenByParent)))
  const collapseAll = () => setExpanded(new Set())

  const QtyBadge = ({ item }: { item: ChecklistItem }) => {
    const tBadge = useTranslation()
    if (!item.qty || item.qty <= 1) return null
    if (onQtyChange && item.checked) {
      return (
        <input
          type="number"
          min={1}
          max={999}
          value={item.qty}
          onChange={(event) => onQtyChange(item.id, Number(event.target.value))}
          className="w-14 rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-right text-cp-xs"
          aria-label={tBadge('rentman.checklist.qtyAria', 'Quantity')}
          title={tBadge('rentman.checklist.qtyTitle', 'How many to add')}
        />
      )
    }
    return (
      <span className="rounded bg-cp-surface-4/60 px-1.5 py-0.5 text-[10px] text-cp-text-muted" title={tBadge('rentman.checklist.qtyInProject', 'Stückzahl im Rentman-Projekt')}>
        ×{item.qty}
      </span>
    )
  }

  return (
    <div className="max-h-72 space-y-3 overflow-auto rounded border border-cp-border p-2 text-cp-base">
      {(onSetAll || hasAnySets) && (
        <div className="flex flex-wrap gap-2 border-b border-cp-border pb-2 text-cp-xs">
          {onSetAll && (
            <>
              <button
                type="button"
                onClick={() => onSetAll(true)}
                className="rounded bg-cp-surface-4 px-2 py-1 hover:bg-cp-surface-5"
              >
                {t('rentman.checklist.selectAll', 'Alle auswählen')}
              </button>
              <button
                type="button"
                onClick={() => onSetAll(false)}
                className="rounded bg-cp-surface-4 px-2 py-1 hover:bg-cp-surface-5"
              >
                {t('rentman.checklist.deselectAll', 'Alle abwählen')}
              </button>
            </>
          )}
          {hasAnySets && (
            <>
              <button
                type="button"
                onClick={expandAll}
                className="rounded bg-cp-surface-4 px-2 py-1 hover:bg-cp-surface-5"
              >
                {t('rentman.checklist.expandAll', 'Alle Sets ausklappen')}
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded bg-cp-surface-4 px-2 py-1 hover:bg-cp-surface-5"
              >
                {t('rentman.checklist.collapseAll', 'Alle Sets einklappen')}
              </button>
            </>
          )}
        </div>
      )}
      {/* #498 — Kategorie-Gruppen alphabetisch (konsistent mit den
          Filter-Chips & der lokalen Library); innerhalb einer Kategorie bleibt
          die Rentman-Reihenfolge erhalten, Kombinationen mit ihren Teilen
          eingerückt. */}
      {Object.entries(grouped)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([category, categoryItems]) => (
        <div key={category}>
          <div className="mb-1 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-secondary">{category}</div>
          <div className="space-y-1">
            {categoryItems.map((item) => {
              const children = childrenByParent[item.id]
              const isSet = Boolean(children && children.length > 0)
              const isOpen = expanded.has(item.id)
              const allChildrenChecked = isSet && children!.every((c) => c.checked)
              // Kommentar-/Text-Zeile aus Rentman → kein Gerät, nicht
              // importierbar (kein Häkchen), nur als Notiz anzeigen.
              if (item.kind === 'comment') {
                return (
                  <div key={item.id} className="flex items-center gap-2 rounded bg-cp-surface-1/30 px-2 py-1 text-cp-xs">
                    <span className="w-5" />
                    <span className="shrink-0 rounded bg-cp-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cp-text-muted">
                      {t('rentman.checklist.kind.comment', 'Kommentar')}
                    </span>
                    <span className="flex-1 italic text-cp-text-muted">{item.name}</span>
                  </div>
                )
              }
              return (
                <div key={item.id}>
                  <div className="flex items-center gap-2">
                    {isSet ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="w-5 rounded bg-cp-surface-2 text-[10px] leading-none hover:bg-cp-surface-4"
                        aria-label={isOpen ? t('rentman.checklist.setCollapse', 'Set einklappen') : t('rentman.checklist.setExpand', 'Set ausklappen')}
                        title={isOpen ? t('rentman.checklist.setCollapse', 'Set einklappen') : t('rentman.checklist.setExpand', 'Set ausklappen')}
                      >
                        {isOpen ? '▾' : '▸'}
                      </button>
                    ) : (
                      <span className="w-5" />
                    )}
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => onToggle(item.id)}
                      />
                      <span className="flex-1">
                        {item.name}
                        {isSet && (() => {
                          const n = children!.length
                          if (item.kind === 'physical')
                            return (
                              <span className="ml-2 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-200" title={t('rentman.checklist.kind.physicalTitle', 'Physische Kombination — eine Bestandseinheit. Default: als 1 Gerät (oder Rack).')}>
                                {format(t('rentman.checklist.kind.physical', 'Physische Kombi · {n}'), { n })}
                              </span>
                            )
                          if (item.kind === 'virtual')
                            return (
                              <span className="ml-2 rounded bg-violet-900/60 px-1.5 py-0.5 text-[10px] font-medium text-violet-200" title={t('rentman.checklist.kind.virtualTitle', 'Virtuelle Kombination — loses Bündel; meist ist nur das Hauptgerät relevant.')}>
                                {format(t('rentman.checklist.kind.virtual', 'Virtuelle Kombi · {n}'), { n })}
                              </span>
                            )
                          return (
                            <span className="ml-2 rounded bg-cp-surface-4/60 px-1.5 py-0.5 text-[10px] text-cp-text-secondary">
                              {format(t('rentman.checklist.kind.set', 'Set · {n}'), { n })}
                            </span>
                          )
                        })()}
                        {isSet && onSetMainOnly && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onSetMainOnly(item.id)
                            }}
                            className="ml-2 rounded bg-sky-700/60 px-1.5 py-0.5 text-[10px] font-medium text-sky-100 hover:bg-sky-600/60"
                            title={t('rentman.checklist.mainOnlyTitle', 'Nur das Hauptgerät dieser Kombination importieren — Zubehör (Kabel/Akku/Stativ …) wird übersprungen.')}
                          >
                            {t('rentman.checklist.mainOnly', '+ nur Hauptgerät')}
                          </button>
                        )}
                        {isSet && onSetAsRack && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onSetAsRack(item.id, !rackSetIds?.has(item.id))
                            }}
                            className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              rackSetIds?.has(item.id)
                                ? 'bg-sky-700/70 text-sky-100'
                                : 'bg-cp-surface-4/60 text-cp-text-secondary hover:bg-cp-surface-5/60'
                            }`}
                            title={t(
                              'rentman.checklist.asRackTitle',
                              'Diese Kombination beim Import als Rack übernehmen (Inhalte behalten ihre Rentman-IDs).',
                            )}
                          >
                            {rackSetIds?.has(item.id)
                              ? t('rentman.checklist.asRackOn', '✓ als Rack')
                              : t('rentman.checklist.asRackOff', '+ als Rack')}
                          </button>
                        )}
                        {item.templateMatch && (() => {
                          // v7.9.128 — Drei verschiedene Badge-Styles
                          // damit der User direkt sieht ob das Item
                          // (a) schon mit demselben rentmanId in der
                          // Lib steht → unsichtbarer Re-Import (gruen,
                          // klar das nichts kollidiert), (b) nur per
                          // Name matched → Konflikt-Dialog kommt
                          // (amber, deutlich dass eine Entscheidung
                          // ansteht), (c) gegen Built-in-Katalog
                          // matched (slate, neutral). Fallback (= alte
                          // Variante) ist gruen wenn templateMatchKind
                          // nicht gesetzt ist.
                          const kind = item.templateMatchKind
                          if (kind === 'rentmanId') {
                            return (
                              <span
                                className="ml-2 rounded bg-emerald-800/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200"
                                title={format(t('rentman.checklist.badge.linkedTitle', 'Bereits in lokaler Bibliothek per Rentman-ID verknuepft mit "{name}". Re-Import aktualisiert nur Metadaten (Kategorie, Projekt-Link) — die lokale Port-Konfiguration bleibt erhalten.'), { name: item.templateMatch })}
                              >
                                {t('rentman.checklist.badge.linked', '✓ verknüpft')}
                              </span>
                            )
                          }
                          if (kind === 'nameOnly') {
                            return (
                              <span
                                className="ml-2 rounded bg-amber-800/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-100"
                                title={format(t('rentman.checklist.badge.nameOnlyTitle', 'Lokales Template "{name}" hat denselben Namen aber keinen Rentman-ID. Beim Import erscheint ein Konflikt-Dialog — Default ist die lokale Version (mit Ports) zu behalten und nur die Rentman-ID anzuhaengen.'), { name: item.templateMatch })}
                              >
                                <><Icon icon={Zap} size="xs" className="mr-1 inline-block align-text-bottom" />{t('rentman.checklist.badge.nameOnly', 'schon in Lib')}</>
                              </span>
                            )
                          }
                          if (kind === 'catalog') {
                            return (
                              <span
                                className="ml-2 rounded bg-cp-surface-4/60 px-1.5 py-0.5 text-[10px] font-medium text-cp-text-bright"
                                title={format(t('rentman.checklist.badge.catalogTitle', 'Match aus eingebautem Katalog ("{name}"). Wird beim Import automatisch als Template uebernommen.'), { name: item.templateMatch })}
                              >
                                {t('rentman.checklist.badge.catalog', '⊕ Katalog')}
                              </span>
                            )
                          }
                          // Fallback (alte Variante ohne kind-Feld)
                          return (
                            <span
                              className="ml-2 rounded bg-emerald-800/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200"
                              title={format(t('rentman.checklist.badge.fallbackTitle', 'Wird automatisch mit Vorlage "{name}" befuellt'), { name: item.templateMatch })}
                            >
                              ✓ {item.templateMatch}
                            </span>
                          )
                        })()}
                      </span>
                    </label>
                    <QtyBadge item={item} />
                    {onLinkExisting && linkableEquipment && (
                      (() => {
                        const linkedId = linkedMap?.[item.id]
                        const linkedDevice = linkedId
                          ? linkableEquipment.find((e) => e.id === linkedId)
                          : null
                        if (linkedDevice) {
                          return (
                            <span
                              className="rounded bg-sky-800/60 px-1.5 py-0.5 text-[10px] text-sky-100"
                              title={t('rentman.checklist.linkedTitle', 'Verknüpft mit lokalem Gerät — wird beim Import nicht doppelt angelegt')}
                            >
                              <Icon icon={Link} size="xs" className="mr-1 inline-block align-text-bottom" />{linkedDevice.name}
                            </span>
                          )
                        }
                        return (
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) onLinkExisting(item.id, e.target.value)
                            }}
                            className="rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-[10px] text-cp-text-secondary"
                            title={t('rentman.checklist.linkSelectTitle', 'Mit existierendem Gerät verknüpfen')}
                          >
                            <option value="">{t('rentman.checklist.linkPlaceholder', 'Verknüpfen…')}</option>
                            {linkableEquipment.map((e) => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                        )
                      })()
                    )}
                    {isSet && isOpen && onSetAllChildren && (
                      <button
                        type="button"
                        onClick={() => onSetAllChildren(item.id, !allChildrenChecked)}
                        className="rounded bg-cp-surface-4 px-1.5 py-0.5 text-[10px] hover:bg-cp-surface-5"
                        title={allChildrenChecked ? t('rentman.checklist.deselectChildren', 'Alle Kinder abwählen') : t('rentman.checklist.selectChildren', 'Alle Kinder auswählen')}
                      >
                        <span className="inline-flex items-center gap-1"><Icon icon={allChildrenChecked ? Square : SquareCheck} size="xs" />{allChildrenChecked ? t('rentman.checklist.childrenAllOff', 'alle') : t('rentman.checklist.childrenAllOn', 'alle')}</span>
                      </button>
                    )}
                  </div>
                  {isSet && isOpen && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-cp-border-muted pl-2">
                      {children!.map((child) => (
                        <label key={child.id} className="flex items-center gap-2 text-cp-text-secondary">
                          <input
                            type="checkbox"
                            checked={child.checked}
                            onChange={() => onToggle(child.id)}
                          />
                          <span className="flex-1">{child.name}</span>
                          <QtyBadge item={child} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
