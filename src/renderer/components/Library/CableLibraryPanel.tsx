import { useMemo, useState, type ReactNode } from 'react'
import { X, Pencil, ChevronDown, ChevronRight, RotateCcw, Check} from 'lucide-react'
import { Icon } from '../shared/Icon'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cableCatalog } from '../../types/cableSpec'
import type { CableSpec, SignalStandard } from '../../types/cableSpec'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { videoFormatById, pickCableStandardForFormat } from '../../types/videoFormat'
import { confirmDialog } from '../../lib/confirmDialog'
import { format, useTranslation } from '../../lib/i18n'
// #836 — der Editor liegt seit dem 2026-09-10 in `Cable/`, weil ihn jetzt auch
// der Einstellungen-Tab oeffnet. Anlegen gehoert dorthin; hier wird nur noch
// bearbeitet, was schon in der Liste steht.
import { CableTypeEditor } from '../Cable/CableTypeEditor'

/**
 * Group cables by their primary connector family. SDI cables are highlighted
 * based on the project's current default video format so the best-matching
 * SDI cable is obvious at a glance.
 */
const groupOf = (specId: string, connectorType: string): string => {
  if (specId.startsWith('sdi') || connectorType === 'BNC' || connectorType === 'SDI') return 'SDI'
  if (connectorType === 'HDMI') return 'HDMI'
  if (connectorType === 'DisplayPort') return 'DisplayPort'
  if (connectorType === 'Ethernet/RJ45') return 'Ethernet'
  if (connectorType === 'Fiber') return 'Fiber'
  if (connectorType === 'XLR') return 'Audio / XLR'
  if (connectorType === 'USB') return 'USB'
  if (
    connectorType === 'IEC 230V' ||
    connectorType === 'PowerCON' ||
    connectorType === 'Schuko 230V'
  )
    return 'Power'
  // v7.9.6 — User-defined connector types each get their own group so
  // a custom cable with a brand-new connector (e.g. "Speakon NL4")
  // shows under a "Speakon NL4" section instead of "Andere".
  if (connectorType && connectorType !== 'Custom') return connectorType
  return 'Andere'
}

const SortableCableGroup = ({
  group,
  children,
}: {
  group: string
  children: ReactNode
}) => {
  const t = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
  }
  return (
    <div ref={setNodeRef} style={style} className="rounded border border-cp-border bg-cp-surface-1">
      <span
        {...attributes}
        {...listeners}
        aria-label={t('cableLib.groupReorder', 'Move group')}
        title={t('cableLib.groupReorderTitle', 'Drag & drop to reorder')}
        role="button"
        tabIndex={0}
        className="absolute left-0.5 top-0.5 z-10 flex h-5 w-3 cursor-grab items-center justify-center text-cp-text-faint hover:text-cp-text-bright active:cursor-grabbing"
      >
        <svg width="6" height="12" viewBox="0 0 6 12" fill="currentColor">
          <circle cx="1.5" cy="2" r="1" />
          <circle cx="4.5" cy="2" r="1" />
          <circle cx="1.5" cy="6" r="1" />
          <circle cx="4.5" cy="6" r="1" />
          <circle cx="1.5" cy="10" r="1" />
          <circle cx="4.5" cy="10" r="1" />
        </svg>
      </span>
      {children}
    </div>
  )
}

export const CableLibraryPanel = () => {
  const t = useTranslation()
  const defaultVideoFormat = useProjectStore(
    (s) => s.project.metadata.defaultVideoFormat,
  )
  const cables = useProjectStore((s) => s.project.cables)
  const rentmanCablePlan = useProjectStore((s) => s.project.metadata.rentmanCablePlan)
  // v7.8.6 — custom cable types live in uiStore.customCableSpecs.
  const customCableSpecs = useUiStore((s) => s.customCableSpecs)
  const addCustomCableSpec = useUiStore((s) => s.addCustomCableSpec)
  const updateCustomCableSpec = useUiStore((s) => s.updateCustomCableSpec)
  const removeCustomCableSpec = useUiStore((s) => s.removeCustomCableSpec)
  // v7.9.7 — Override layer for built-in cable specs. Lets users
  // rename / recolor / edit catalogue entries without touching the
  // shared cableCatalog. Custom specs keep using their own update path.
  const cableSpecOverrides = useUiStore((s) => s.cableSpecOverrides)
  const setCableSpecOverride = useUiStore((s) => s.setCableSpecOverride)
  const clearCableSpecOverride = useUiStore((s) => s.clearCableSpecOverride)

  // Editor state — null = closed, undefined = "new", a CableSpec = edit.
  const [editing, setEditing] = useState<CableSpec | null | undefined>(null)
  const isEditorOpen = editing !== null
  const editorInitial = editing === undefined ? null : editing

  // Merged spec list = built-in catalogue (with overrides applied) +
  // user's custom entries. Overrides are merged at display time so
  // future catalogue updates flow through for untouched fields.
  const fullCatalog: CableSpec[] = useMemo(
    () => [
      ...cableCatalog.map((spec) => {
        const ov = cableSpecOverrides[spec.id]
        return ov ? { ...spec, ...ov, id: spec.id } : spec
      }),
      ...customCableSpecs,
    ],
    [customCableSpecs, cableSpecOverrides],
  )

  const preferredSdi: SignalStandard | undefined = useMemo(() => {
    const f = videoFormatById(defaultVideoFormat)
    if (!f) return undefined
    return pickCableStandardForFormat(f)
  }, [defaultVideoFormat])

  /** Count canvas cables per cableSpecId */
  const builtBySpecId = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cables) {
      if (!c.cableSpecId) continue
      map.set(c.cableSpecId, (map.get(c.cableSpecId) ?? 0) + 1)
    }
    return map
  }, [cables])

  /** Sum Rentman planned quantities per specId by matching connector type */
  const plannedBySpecId = useMemo(() => {
    if (!rentmanCablePlan) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const [key, qty] of Object.entries(rentmanCablePlan)) {
      const [type] = key.split('|')
      // Match against specs by connectorType (catalog + custom)
      for (const spec of fullCatalog) {
        if (spec.connectorType === type || spec.id.startsWith(type.toLowerCase())) {
          map.set(spec.id, (map.get(spec.id) ?? 0) + qty)
        }
      }
    }
    return map
  }, [rentmanCablePlan, fullCatalog])

  // v7.9.6 — User-defined group order persists in uiStore. Unknown
  // groups land at the end so adding a new connector type doesn't
  // hide it. Sort is applied at render time so reordering reacts
  // immediately without rebuilding the underlying catalog.
  const cableGroupOrder = useUiStore((s) => s.cableGroupOrder)
  const setCableGroupOrder = useUiStore((s) => s.setCableGroupOrder)

  const grouped = useMemo(() => {
    const map = new Map<string, CableSpec[]>()
    for (const cable of fullCatalog) {
      const g = groupOf(cable.id, cable.connectorType)
      const list = map.get(g) ?? []
      list.push(cable)
      map.set(g, list)
    }
    const entries = Array.from(map.entries())
    const orderIndex = new Map(cableGroupOrder.map((g, i) => [g, i]))
    entries.sort(([a], [b]) => {
      const ai = orderIndex.get(a)
      const bi = orderIndex.get(b)
      if (ai !== undefined && bi !== undefined) return ai - bi
      if (ai !== undefined) return -1
      if (bi !== undefined) return 1
      return a.localeCompare(b)
    })
    return entries
  }, [fullCatalog, cableGroupOrder])

  const groupIds = useMemo(() => grouped.map(([g]) => g), [grouped])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = groupIds.indexOf(active.id as string)
    const newIndex = groupIds.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    setCableGroupOrder(arrayMove(groupIds, oldIndex, newIndex))
  }

  const allSpecNames = useMemo(() => fullCatalog.map((c) => c.name), [fullCatalog])

  // Start with all groups collapsed - power users open what they need.
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (g: string) => setOpen((o) => ({ ...o, [g]: !o[g] }))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
        <div className="flex items-center gap-2">
          <h2 className="text-cp-base font-semibold">{t('cableLib.title', 'Cable library')}</h2>
          <span className="text-cp-xs text-cp-text-muted">{format(t('cableLib.installedCount', '{n} installed'), { n: cables.length })}</span>
        </div>
        {/*
          #836 — Das ANLEGEN eines Kabeltyps sitzt jetzt in den Einstellungen.
          Meldung des Eigentuemers: „Neue kabeltypen anlegen muss eigentlich in
          den Einstellungen sein und nicht links in der Geräte seitenleiste."

          Der Weg dorthin bleibt hier stehen, statt ersatzlos zu verschwinden:
          wer den Knopf gesucht hat, findet sonst nur eine Luecke und haelt die
          Funktion fuer weg. Er OEFFNET die Einstellungen direkt auf dem
          richtigen Tab — ein Verweis, der den Leser suchen laesst, ist kaum
          besser als keiner.
        */}
        <button
          type="button"
          onClick={() => useUiStore.getState().openSettings('cableTypes')}
          className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          title={t('cableLib.manageTitle', 'Cable types are managed in the settings')}
        >
          {t('cableLib.manage', 'Manage cable types…')}
        </button>
      </div>
      <p className="mb-2 text-cp-xs text-cp-text-muted">
        {t('cableLib.presetsInfo', 'Presets with connector and signal info.')}
        {customCableSpecs.length > 0 && (
          <> {format(
            customCableSpecs.length === 1
              ? t('cableLib.customCountOne', '{n} custom cable type.')
              : t('cableLib.customCountMany', '{n} custom cable types.'),
            { n: customCableSpecs.length },
          )}</>
        )}
        {preferredSdi && (
          <>
            {' '}{t('cableLib.sdiRecommendation', 'SDI recommendation:')} <span className="font-semibold text-emerald-400">{preferredSdi}</span>.
          </>
        )}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
       <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
      <div className="flex-1 min-h-0 space-y-1 overflow-auto">
        {grouped.map(([group, specs]) => {
          const isOpen = open[group] ?? false
          const groupBuilt = specs.reduce((sum, s) => sum + (builtBySpecId.get(s.id) ?? 0), 0)
          const groupPlanned = specs.reduce((sum, s) => sum + (plannedBySpecId.get(s.id) ?? 0), 0)
          return (
            <SortableCableGroup key={group} group={group}>
              <button
                type="button"
                onClick={() => toggle(group)}
                className="flex w-full items-center justify-between px-2 py-1.5 pl-5 text-left text-cp-xs font-semibold hover:bg-cp-surface-2"
              >
                <span className="flex items-center gap-1.5">
                  {group}
                  <span className="text-cp-xs font-normal text-cp-text-muted">({specs.length})</span>
                  {groupBuilt > 0 && (
                    <span className={`rounded px-1.5 py-0.5 text-cp-xs font-bold ${
                      groupPlanned > 0
                        ? groupBuilt >= groupPlanned
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'bg-red-900/60 text-red-300'
                        : 'bg-cp-surface-4 text-cp-text-secondary'
                    }`}>
                      {groupBuilt}{groupPlanned > 0 ? `/${groupPlanned}` : ''}
                    </span>
                  )}
                </span>
                <Icon
                  icon={isOpen ? ChevronDown : ChevronRight}
                  size="xs"
                  className="text-cp-text-faint"
                />
              </button>
              {isOpen && (
                <div className="space-y-1 border-t border-cp-border-muted p-1.5">
                  {specs.map((cable) => {
                    const isRecommended =
                      preferredSdi !== undefined &&
                      group === 'SDI' &&
                      cable.standards.includes(preferredSdi) &&
                      cable.standards[cable.standards.length - 1] === preferredSdi
                    const isCustom = cable.id.startsWith('custom-cable:')
                    const built = builtBySpecId.get(cable.id) ?? 0
                    const planned = plannedBySpecId.get(cable.id) ?? 0
                    const hasCount = built > 0 || planned > 0
                    return (
                      <div
                        key={cable.id}
                        className={`rounded border px-2 py-1.5 text-cp-xs ${
                          isRecommended
                            ? 'border-emerald-500 bg-emerald-950/40'
                            : isCustom
                              ? 'border-violet-700/60 bg-violet-950/30'
                              : 'border-cp-border bg-cp-surface-3'
                        }`}
                        title={cable.notes ?? ''}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: cable.color }}
                          />
                          <span className="font-medium flex-1">{cable.name}</span>
                          {isCustom && (
                            <span
                              className="rounded bg-violet-700/80 px-1 text-cp-xs font-semibold uppercase text-violet-100"
                              title={t('cableLib.customBadge', 'Custom cable type (created locally)')}
                            >
                              {t('cableLib.customBadgeLabel', 'Custom')}
                            </span>
                          )}
                          {!isCustom && cableSpecOverrides[cable.id] && (
                            <span
                              className="rounded bg-amber-700/70 px-1 text-cp-xs font-semibold uppercase text-amber-100"
                              title={t('cableLib.overrideBadge', 'Built-in spec with local override (reset via edit dialog)')}
                            >
                              {t('cableLib.overrideBadgeLabel', 'Modified')}
                            </span>
                          )}
                          {isRecommended && (
                            <span className="rounded bg-emerald-600 px-1 text-cp-xs font-semibold uppercase text-white">
                              <Icon icon={Check} size="xs" />
                            </span>
                          )}
                          {hasCount && (
                            <span className={`rounded px-1.5 py-0.5 text-cp-xs font-bold tabular-nums ${
                              planned > 0
                                ? built >= planned
                                  ? 'bg-emerald-900/60 text-emerald-300'
                                  : 'bg-red-900/60 text-red-300'
                                : 'bg-cp-surface-4/80 text-cp-text-secondary'
                            }`}
                              title={planned > 0 ? `${built} verbaut / ${planned} Rentman geplant` : `${built} verbaut`}
                            >
                              {built}{planned > 0 ? `/${planned}` : ''}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditing(cable)}
                            className="rounded bg-cp-surface-4 px-1.5 py-0.5 text-cp-xs text-cp-text-bright hover:bg-cp-surface-5"
                            title={isCustom
                              ? t('cableLib.edit', 'Edit cable type')
                              : t('cableLib.editOverride', 'Adjust cable type locally (override)')}
                            aria-label={isCustom
                              ? t('cableLib.edit', 'Edit cable type')
                              : t('cableLib.editOverride', 'Adjust cable type locally (override)')}
                          >
                            <Icon icon={Pencil} size="xs" />
                          </button>
                          {!isCustom && cableSpecOverrides[cable.id] && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await confirmDialog(
                                  format(
                                    t('cableLib.resetOverride.confirm', 'Reset override for "{name}"?'),
                                    { name: cable.name },
                                  ),
                                  {
                                    body: t(
                                      'cableLib.resetOverride.body',
                                      'The original built-in values will be restored.',
                                    ),
                                    okLabel: t('cableLib.resetOverride.ok', 'Reset'),
                                  },
                                )
                                if (ok) clearCableSpecOverride(cable.id)
                              }}
                              className="rounded bg-amber-800/70 px-1.5 py-0.5 text-cp-xs text-amber-100 hover:bg-amber-700"
                              title={t('cableLib.removeOverride', 'Remove override (reset to default)')}
                            >
                              <Icon icon={RotateCcw} size="xs" />
                            </button>
                          )}
                          {isCustom && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await confirmDialog(
                                  format(
                                    t('cableLib.deleteSpec.confirm', 'Delete cable type "{name}"?'),
                                    { name: cable.name },
                                  ),
                                  {
                                    body:
                                      built > 0
                                        ? format(
                                            t(
                                              'cableLib.deleteSpec.bodyInUse',
                                              'Warning: {n} installed cables reference this type. They keep their connector/standard but lose the spec link.',
                                            ),
                                            { n: built },
                                          )
                                        : t(
                                            'cableLib.deleteSpec.bodyUnused',
                                            'Installed cables are not affected.',
                                          ),
                                    okLabel: t('common.delete', 'Delete'),
                                    destructive: true,
                                  },
                                )
                                if (ok) removeCustomCableSpec(cable.id)
                              }}
                              className="rounded bg-red-900/60 px-1.5 py-0.5 text-cp-xs text-red-200 hover:bg-red-800"
                              title={t('cableLib.deleteSpec', 'Delete cable type')}
                            >
                              <Icon icon={X} size="sm" />
                            </button>
                          )}
                        </div>
                        <div className="mt-0.5 text-cp-xs text-cp-text-muted">
                          {cable.connectorType}
                          {cable.compatibleConnectors?.length
                            ? ` (+ ${cable.compatibleConnectors.join(', ')})`
                            : ''}
                          {cable.maxLengthMeters ? ` · max ${cable.maxLengthMeters} m` : ''}
                        </div>
                        <div className="text-cp-xs text-cp-text-muted">
                          {cable.standards.join(' · ')}
                        </div>
                        {cable.notes && (
                          <div className="mt-1 rounded bg-cp-surface-1 p-1 text-cp-xs italic text-cp-text-secondary">
                            {cable.notes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </SortableCableGroup>
          )
        })}
      </div>
       </SortableContext>
      </DndContext>

      <CableTypeEditor
        open={isEditorOpen}
        initial={editorInitial}
        existingNames={allSpecNames}
        onCancel={() => setEditing(null)}
        onSave={(spec) => {
          if (editorInitial) {
            const isCustomSpec = editorInitial.id.startsWith('custom-cable:')
            if (isCustomSpec) {
              updateCustomCableSpec(editorInitial.id, spec)
            } else {
              // Built-in cable → speichere als Override damit der globale
              // cableCatalog unverändert bleibt und der User per ↺ jederzeit
              // auf den Default zurücksetzen kann.
              setCableSpecOverride(editorInitial.id, spec)
            }
          } else {
            addCustomCableSpec(spec)
          }
          setEditing(null)
        }}
      />
    </div>
  )
}
