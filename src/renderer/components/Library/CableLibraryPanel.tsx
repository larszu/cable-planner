import { useMemo, useState, type ReactNode } from 'react'
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
import { ALL_SIGNAL_STANDARDS, cableCatalog } from '../../types/cableSpec'
import type { CableSpec, SignalStandard } from '../../types/cableSpec'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType } from '../../types/equipment'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { videoFormatById, pickCableStandardForFormat } from '../../types/videoFormat'
import { confirmDialog } from '../../lib/confirmDialog'

/** v7.8.6 — Editor dialog for creating / editing custom cable specs.
 *  Lives at the bottom of this file. Pure controlled form, no store
 *  access — caller passes an initial value (if editing) and a save
 *  callback. */
interface CableTypeEditorProps {
  open: boolean
  initial?: CableSpec | null
  /** Used to detect duplicate-name conflicts inside the dialog. */
  existingNames: string[]
  onCancel: () => void
  onSave: (spec: Omit<CableSpec, 'id'>) => void
}

const CableTypeEditor = ({
  open,
  initial,
  existingNames,
  onCancel,
  onSave,
}: CableTypeEditorProps) => {
  const [name, setName] = useState(initial?.name ?? '')
  const [connectorType, setConnectorType] = useState<ConnectorType>(
    initial?.connectorType ?? 'Custom',
  )
  const [compatible, setCompatible] = useState<ConnectorType[]>(
    initial?.compatibleConnectors ?? [],
  )
  const [standards, setStandards] = useState<SignalStandard[]>(
    initial?.standards ?? ['Generic'],
  )
  const [color, setColor] = useState(initial?.color ?? '#64748b')
  const [maxLength, setMaxLength] = useState<number | ''>(initial?.maxLengthMeters ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  // v7.9.2 — User-defined custom connector types and signal standards
  // are merged with the built-in lists so they can be selected
  // alongside XLR/BNC etc. New entries are created via the "+"
  // buttons next to each list (User-Issue: "muss man auch neue
  // steckertypen anlegen können").
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)
  const addCustomConnectorType = useUiStore((s) => s.addCustomConnectorType)
  const customSignalStandards = useUiStore((s) => s.customSignalStandards)
  const addCustomSignalStandard = useUiStore((s) => s.addCustomSignalStandard)
  const allConnectorTypeOptions = useMemo(
    () =>
      [...ALL_CONNECTOR_TYPES, ...customConnectorTypes.filter((c) => !ALL_CONNECTOR_TYPES.includes(c as ConnectorType))] as ConnectorType[],
    [customConnectorTypes],
  )
  const allSignalStandardOptions = useMemo(
    () =>
      [...ALL_SIGNAL_STANDARDS, ...customSignalStandards.filter((s) => !ALL_SIGNAL_STANDARDS.includes(s as SignalStandard))] as SignalStandard[],
    [customSignalStandards],
  )

  if (!open) return null

  const trimmedName = name.trim()
  const isEditing = !!initial
  const conflictsWithExisting =
    !!trimmedName &&
    !isEditing &&
    existingNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase())
  const canSave = trimmedName.length > 0 && standards.length > 0

  const submit = () => {
    if (!canSave) return
    const spec: Omit<CableSpec, 'id'> = {
      name: trimmedName,
      connectorType,
      compatibleConnectors: compatible.length > 0 ? compatible : undefined,
      standards,
      color,
      maxLengthMeters: typeof maxLength === 'number' && maxLength > 0 ? maxLength : undefined,
      notes: notes.trim() || undefined,
    }
    onSave(spec)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {isEditing ? 'Kabeltyp bearbeiten' : 'Neuer Kabeltyp'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-200"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2 text-xs">
          <label className="block">
            <span className="text-slate-400">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. CAT6a Patch 5m"
              autoFocus
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
            />
            {conflictsWithExisting && (
              <span className="mt-0.5 block text-[10px] text-amber-400">
                ⚠ Name existiert bereits — Speichern überschreibt den vorhandenen Eintrag.
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="flex items-center justify-between text-slate-400">
                <span>Stecker-Typ</span>
                <button
                  type="button"
                  onClick={() => {
                    const n = window.prompt('Neuer Stecker-Typ (z.B. "Speakon NL4"):')?.trim()
                    if (n) {
                      addCustomConnectorType(n)
                      setConnectorType(n as ConnectorType)
                    }
                  }}
                  className="rounded bg-emerald-700 px-1.5 text-[9px] text-emerald-100 hover:bg-emerald-600"
                  title="Neuen Stecker-Typ anlegen"
                >
                  +
                </button>
              </span>
              <select
                value={connectorType}
                onChange={(e) => setConnectorType(e.target.value as ConnectorType)}
                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              >
                {allConnectorTypeOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                    {customConnectorTypes.includes(c as string) ? ' (custom)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400">Kabel-Farbe</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-0.5 h-7 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
              />
            </label>
          </div>
          <div>
            <span className="text-slate-400">Auch kompatibel mit (optional)</span>
            <div className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-auto rounded border border-slate-700 bg-slate-950 p-1.5">
              {allConnectorTypeOptions.filter((c) => c !== connectorType).map((c) => {
                const on = compatible.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setCompatible((prev) =>
                        on ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      on
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <span className="flex items-center justify-between text-slate-400">
              <span>Signal-Standards</span>
              <button
                type="button"
                onClick={() => {
                  const n = window.prompt('Neuer Signal-Standard (z.B. "Dante Primary"):')?.trim()
                  if (n) {
                    addCustomSignalStandard(n)
                    setStandards((prev) => [...prev, n as SignalStandard])
                  }
                }}
                className="rounded bg-sky-700 px-1.5 text-[9px] text-sky-100 hover:bg-sky-600"
                title="Neuen Signal-Standard anlegen"
              >
                + Standard
              </button>
            </span>
            <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-auto rounded border border-slate-700 bg-slate-950 p-1.5">
              {allSignalStandardOptions.map((s) => {
                const on = standards.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setStandards((prev) =>
                        on ? prev.filter((x) => x !== s) : [...prev, s],
                      )
                    }
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      on
                        ? 'bg-sky-700 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    } ${customSignalStandards.includes(s as string) ? 'italic' : ''}`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            {standards.length === 0 && (
              <span className="mt-0.5 block text-[10px] text-red-400">
                Mindestens einen Standard auswählen.
              </span>
            )}
          </div>
          <label className="block">
            <span className="text-slate-400">Max. Länge (m) – optional</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={maxLength}
              onChange={(e) => {
                const v = e.target.value
                setMaxLength(v === '' ? '' : Math.max(0, Number(v)))
              }}
              placeholder="z.B. 100"
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="text-slate-400">Notiz (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="z.B. nur für indoor, geschirmt, …"
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {isEditing ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
    <div ref={setNodeRef} style={style} className="rounded border border-slate-700 bg-slate-900">
      <span
        {...attributes}
        {...listeners}
        aria-label="Gruppe verschieben"
        title="Per Drag&Drop verschieben"
        role="button"
        tabIndex={0}
        className="absolute left-0.5 top-0.5 z-10 flex h-5 w-3 cursor-grab items-center justify-center text-slate-500 hover:text-slate-200 active:cursor-grabbing"
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

  // Editor state — null = closed, undefined = "new", a CableSpec = edit.
  const [editing, setEditing] = useState<CableSpec | null | undefined>(null)
  const isEditorOpen = editing !== null
  const editorInitial = editing === undefined ? null : editing

  // Merged spec list = built-in catalogue + user's custom entries.
  const fullCatalog: CableSpec[] = useMemo(
    () => [...cableCatalog, ...customCableSpecs],
    [customCableSpecs],
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
          <h2 className="text-sm font-semibold">Kabel-Library</h2>
          <span className="text-[10px] text-slate-500">{cables.length} verbaut</span>
        </div>
        <button
          type="button"
          onClick={() => setEditing(undefined)}
          className="rounded bg-emerald-700 px-2 py-1 text-[11px] text-white hover:bg-emerald-600"
          title="Neuen Kabeltyp anlegen (eigenes Preset für die Library)"
        >
          + Neuer Kabeltyp
        </button>
      </div>
      <p className="mb-2 text-[11px] text-slate-400">
        Presets mit Stecker- und Signalinfos.
        {customCableSpecs.length > 0 && (
          <> {customCableSpecs.length} eigene{customCableSpecs.length === 1 ? 'r' : ''} Kabeltyp{customCableSpecs.length === 1 ? '' : 'en'}.</>
        )}
        {preferredSdi && (
          <>
            {' '}SDI-Empfehlung: <span className="font-semibold text-emerald-400">{preferredSdi}</span>.
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
                className="flex w-full items-center justify-between px-2 py-1.5 pl-5 text-left text-xs font-semibold hover:bg-slate-800"
              >
                <span className="flex items-center gap-1.5">
                  {group}
                  <span className="text-[10px] font-normal text-slate-500">({specs.length})</span>
                  {groupBuilt > 0 && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      groupPlanned > 0
                        ? groupBuilt >= groupPlanned
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'bg-red-900/60 text-red-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {groupBuilt}{groupPlanned > 0 ? `/${groupPlanned}` : ''}
                    </span>
                  )}
                </span>
                <span className="text-slate-500">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="space-y-1 border-t border-slate-800 p-1.5">
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
                        className={`rounded border px-2 py-1.5 text-xs ${
                          isRecommended
                            ? 'border-emerald-500 bg-emerald-950/40'
                            : isCustom
                              ? 'border-violet-700/60 bg-violet-950/30'
                              : 'border-slate-700 bg-slate-950'
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
                              className="rounded bg-violet-700/80 px-1 text-[9px] font-semibold uppercase text-violet-100"
                              title="Eigener Kabeltyp (lokal angelegt)"
                            >
                              Eigen
                            </span>
                          )}
                          {isRecommended && (
                            <span className="rounded bg-emerald-600 px-1 text-[9px] font-semibold uppercase text-white">
                              ✓
                            </span>
                          )}
                          {hasCount && (
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
                              planned > 0
                                ? built >= planned
                                  ? 'bg-emerald-900/60 text-emerald-300'
                                  : 'bg-red-900/60 text-red-300'
                                : 'bg-slate-700/80 text-slate-300'
                            }`}
                              title={planned > 0 ? `${built} verbaut / ${planned} Rentman geplant` : `${built} verbaut`}
                            >
                              {built}{planned > 0 ? `/${planned}` : ''}
                            </span>
                          )}
                          {isCustom && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditing(cable)}
                                className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600"
                                title="Kabeltyp bearbeiten"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await confirmDialog(
                                    `Kabeltyp "${cable.name}" löschen?`,
                                    {
                                      body:
                                        built > 0
                                          ? `Achtung: ${built} verbaute Kabel referenzieren diesen Typ. Sie behalten ihren Stecker/Standard, verlieren aber die Spec-Verknüpfung.`
                                          : 'Verbaute Kabel sind nicht betroffen.',
                                      okLabel: 'Löschen',
                                      destructive: true,
                                    },
                                  )
                                  if (ok) removeCustomCableSpec(cable.id)
                                }}
                                className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] text-red-200 hover:bg-red-800"
                                title="Kabeltyp löschen"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {cable.connectorType}
                          {cable.compatibleConnectors?.length
                            ? ` (+ ${cable.compatibleConnectors.join(', ')})`
                            : ''}
                          {cable.maxLengthMeters ? ` · max ${cable.maxLengthMeters} m` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {cable.standards.join(' · ')}
                        </div>
                        {cable.notes && (
                          <div className="mt-1 rounded bg-slate-900 p-1 text-[10px] italic text-slate-300">
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
            updateCustomCableSpec(editorInitial.id, spec)
          } else {
            addCustomCableSpec(spec)
          }
          setEditing(null)
        }}
      />
    </div>
  )
}
