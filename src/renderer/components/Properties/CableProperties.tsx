import { useProjectStore } from '../../store/projectStore'
import { cableCatalog } from '../../types/cableSpec'
import { useUiStore } from '../../store/uiStore'
import type { Cable, CableRouting } from '../../types/cable'
import type { EquipmentItem, Port } from '../../types/equipment'
import { v4 as uuidv4 } from 'uuid'

const routings: { value: CableRouting; label: string }[] = [
  { value: 'orthogonal', label: 'Ortho' },
  { value: 'straight', label: 'Line' },
  { value: 'curved', label: 'Curve' },
]

export const CableProperties = () => {
  const selectedCableId = useProjectStore((state) => state.selectedCableId)
  const cable = useProjectStore((state) => state.project.cables.find((item) => item.id === selectedCableId))
  const equipment = useProjectStore((state) => state.project.equipment)
  const cables = useProjectStore((state) => state.project.cables)
  const updateCable = useProjectStore((state) => state.updateCable)
  const deleteCable = useProjectStore((state) => state.deleteCable)
  const openCableEdit = useUiStore((state) => state.openCableEdit)

  if (!cable) {
    return <div className="text-xs text-slate-400">Kabel anklicken um Eigenschaften zu sehen.</div>
  }

  const routing = cable.routing ?? 'orthogonal'
  const spec = cable.cableSpecId ? cableCatalog.find((c) => c.id === cable.cableSpecId) : undefined

  // Inline endpoint editor: like in the dialog, but writes through directly.
  const portsOf = (eq?: EquipmentItem): (Port & { _side: 'in' | 'out' })[] => {
    if (!eq) return []
    const ins = (eq.inputs ?? []).map((p) => ({ ...p, _side: 'in' as const }))
    const outs = (eq.outputs ?? []).map((p) => ({ ...p, _side: 'out' as const }))
    return [...outs, ...ins]
  }
  const findPort = (eqId: string, portId: string): Port | undefined => {
    const eq = equipment.find((e) => e.id === eqId)
    return eq?.outputs.find((p) => p.id === portId) ?? eq?.inputs.find((p) => p.id === portId)
  }
  const portConflict = (eqId: string, portId: string): Cable | undefined => {
    if (!eqId || !portId) return undefined
    return cables.find(
      (c) =>
        c.id !== cable.id &&
        ((c.fromEquipmentId === eqId && c.fromPortId === portId) ||
          (c.toEquipmentId === eqId && c.toPortId === portId)),
    )
  }
  const fromDev = equipment.find((e) => e.id === cable.fromEquipmentId)
  const toDev = equipment.find((e) => e.id === cable.toEquipmentId)
  const fromPort = findPort(cable.fromEquipmentId, cable.fromPortId)
  const toPort = findPort(cable.toEquipmentId, cable.toPortId)
  const fromConflict = portConflict(cable.fromEquipmentId, cable.fromPortId)
  const toConflict = portConflict(cable.toEquipmentId, cable.toPortId)
  const sortedEquipment = [...equipment].sort((a, b) => a.name.localeCompare(b.name))

  const onSelectFromEquipment = (id: string) => {
    const eq = equipment.find((e) => e.id === id)
    const first = eq?.outputs[0]?.id ?? eq?.inputs[0]?.id ?? ''
    updateCable(cable.id, { fromEquipmentId: id, fromPortId: first })
  }
  const onSelectToEquipment = (id: string) => {
    const eq = equipment.find((e) => e.id === id)
    const first = eq?.inputs[0]?.id ?? eq?.outputs[0]?.id ?? ''
    updateCable(cable.id, { toEquipmentId: id, toPortId: first })
  }

  return (
    <div className="space-y-2 text-xs">
      {/* Spec info bar */}
      {spec && (
        <div className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2 py-1.5">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: spec.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-200 truncate">{spec.name}</div>
            {cable.standard && (
              <div className="text-[10px] text-slate-400">{cable.standard}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => openCableEdit(cable.id)}
            className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] hover:bg-slate-600"
            title="Kabeltyp / Standard bearbeiten"
          >
            ✎
          </button>
        </div>
      )}
      {!spec && (
        <button
          type="button"
          onClick={() => openCableEdit(cable.id)}
          className="w-full rounded border border-dashed border-slate-600 px-2 py-1 text-slate-400 hover:border-slate-400 hover:text-slate-200"
        >
          ✎ Kabeltyp / Standard festlegen
        </button>
      )}
      <label className="block">
        <span className="mb-1 block text-slate-300">Name</span>
        <input
          value={cable.name}
          onChange={(event) => updateCable(cable.id, { name: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-slate-300">Length (m)</span>
        <input
          type="number"
          min={0}
          value={cable.length}
          onChange={(event) => updateCable(cable.id, { length: Number(event.target.value) })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-slate-300">Color</span>
        <input
          type="color"
          value={cable.color}
          onChange={(event) => updateCable(cable.id, { color: event.target.value })}
          className="h-9 w-full rounded border border-slate-700 bg-slate-900 p-1"
        />
      </label>

      {/* Endpoint editor — inline accordion (open by default) so users can
          re-route a cable from the properties panel without opening a dialog. */}
      <details open className="rounded border border-slate-700 bg-slate-950/50">
        <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800/40">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Verbindung</span>
          <span className="ml-2 text-slate-300">
            {fromDev?.name ?? '?'} · {fromPort?.name ?? cable.fromPortId}
            <span className="mx-1 text-slate-500">→</span>
            {toDev?.name ?? '?'} · {toPort?.name ?? cable.toPortId}
          </span>
        </summary>
        <div className="border-t border-slate-700 p-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-0.5 text-[10px] text-slate-500">Von Gerät</div>
              <select
                aria-label="Quell-Gerät"
                value={cable.fromEquipmentId}
                onChange={(e) => onSelectFromEquipment(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
              >
                {sortedEquipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[10px] text-slate-500">Port</div>
              <select
                aria-label="Quell-Port"
                value={cable.fromPortId}
                onChange={(e) => updateCable(cable.id, { fromPortId: e.target.value })}
                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
              >
                {portsOf(fromDev).map((p) => {
                  const inUse = !!portConflict(cable.fromEquipmentId, p.id)
                  return (
                    <option key={p.id} value={p.id}>
                      {p._side === 'out' ? '⇢ ' : '⇠ '}
                      {p.name} ({p.connectorType}){inUse ? ' • belegt' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-[10px] text-slate-500">Nach Gerät</div>
              <select
                aria-label="Ziel-Gerät"
                value={cable.toEquipmentId}
                onChange={(e) => onSelectToEquipment(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
              >
                {sortedEquipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[10px] text-slate-500">Port</div>
              <select
                aria-label="Ziel-Port"
                value={cable.toPortId}
                onChange={(e) => updateCable(cable.id, { toPortId: e.target.value })}
                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
              >
                {portsOf(toDev).map((p) => {
                  const inUse = !!portConflict(cable.toEquipmentId, p.id)
                  return (
                    <option key={p.id} value={p.id}>
                      {p._side === 'out' ? '⇢ ' : '⇠ '}
                      {p.name} ({p.connectorType}){inUse ? ' • belegt' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>
          {fromConflict && (
            <div className="mt-2 rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-100">
              ⚠ Quell-Port bereits durch „{fromConflict.name}" belegt.
            </div>
          )}
          {toConflict && (
            <div className="mt-1 rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-100">
              ⚠ Ziel-Port bereits durch „{toConflict.name}" belegt.
            </div>
          )}
          {/* #48 Converter-Vorschlag: Connector-Typ-Mismatch erkennen und passende
              Geräte aus der Library als klickbare Vorschläge listen. */}
          <ConnectorMismatchHint
            fromPort={fromPort}
            toPort={toPort}
            cableId={cable.id}
            fromEquipmentId={cable.fromEquipmentId}
            toEquipmentId={cable.toEquipmentId}
          />
        </div>
      </details>

      <div>
        <span className="mb-1 block text-slate-300">Routing</span>
        <div className="flex gap-1">
          {routings.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateCable(cable.id, { routing: opt.value, waypoints: undefined })}
              className={`flex-1 rounded border px-2 py-1 ${
                routing === opt.value
                  ? 'border-sky-500 bg-sky-800 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-slate-300">Stroke width ({cable.strokeWidth ?? 2.5}px)</span>
        <input
          type="range"
          min={1}
          max={8}
          step={0.5}
          value={cable.strokeWidth ?? 2.5}
          onChange={(event) => updateCable(cable.id, { strokeWidth: Number(event.target.value) })}
          className="w-full"
        />
      </label>

      <div>
        <span className="mb-1 block text-slate-300">Label Position</span>
        <div className="flex gap-1">
          {(['source', 'center', 'target'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => updateCable(cable.id, { labelPosition: pos })}
              className={`flex-1 rounded border px-2 py-1 capitalize ${
                (cable.labelPosition ?? 'center') === pos
                  ? 'border-sky-500 bg-sky-800 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {pos === 'source' ? '← Start' : pos === 'target' ? 'End →' : 'Mitte'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={cable.dashed ?? false}
            onChange={(event) => updateCable(cable.id, { dashed: event.target.checked })}
          />
          Dashed
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={cable.arrowStart ?? false}
            onChange={(event) => updateCable(cable.id, { arrowStart: event.target.checked })}
          />
          Arrow ◄
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={cable.arrowEnd ?? true}
            onChange={(event) => updateCable(cable.id, { arrowEnd: event.target.checked })}
          />
          Arrow ►
        </label>
      </div>

      <div className="rounded border border-slate-700 bg-slate-950/50 p-2 space-y-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={cable.wireless ?? false}
            onChange={(event) => updateCable(cable.id, { wireless: event.target.checked, dashed: event.target.checked ? true : cable.dashed })}
          />
          <span className="font-semibold">Wireless Verbindung (kein Kabel)</span>
        </label>
        {cable.wireless && (
          <div className="grid grid-cols-2 gap-2 pl-5">
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-400">Frequenz (z.B. 5.8 GHz)</span>
              <input
                value={cable.frequency ?? ''}
                onChange={(event) => updateCable(cable.id, { frequency: event.target.value || undefined })}
                placeholder="z.B. 5.8 GHz, 600 MHz"
                className="w-full rounded border border-slate-700 bg-slate-900 p-1.5 text-xs"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-400">Kanal / Channel</span>
              <input
                value={cable.wifiChannel ?? ''}
                onChange={(event) => updateCable(cable.id, { wifiChannel: event.target.value || undefined })}
                placeholder="z.B. 36, 6, 149"
                className="w-full rounded border border-slate-700 bg-slate-900 p-1.5 text-xs"
              />
            </label>
          </div>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-slate-300">Notes</span>
        <textarea
          value={cable.notes}
          onChange={(event) => updateCable(cable.id, { notes: event.target.value })}
          rows={2}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>

      <button
        type="button"
        onClick={() => deleteCable(cable.id)}
        className="w-full rounded bg-red-700 px-2 py-1 text-white hover:bg-red-600"
      >
        Delete Cable
      </button>
    </div>
  )
}

/**
 * Issue #48: Show a warning when the cable's two endpoints use different
 * connector types and surface library templates that can bridge them
 * (i.e. converters with at least one input matching the source connector
 * AND at least one output matching the target connector). Clicking a
 * converter inserts it on the canvas mid-way between the two devices and
 * splits the cable into source→converter and converter→target.
 */
const ConnectorMismatchHint = ({
  fromPort,
  toPort,
  cableId,
  fromEquipmentId,
  toEquipmentId,
}: {
  fromPort: Port | undefined
  toPort: Port | undefined
  cableId: string
  fromEquipmentId: string
  toEquipmentId: string
}) => {
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const equipment = useProjectStore((s) => s.project.equipment)
  const importEquipment = useProjectStore((s) => s.importEquipment)
  const updateCable = useProjectStore((s) => s.updateCable)
  const queueConnection = useProjectStore((s) => s.queueConnection)
  const createCableFromPending = useProjectStore((s) => s.createCableFromPending)

  if (!fromPort || !toPort) return null
  if (fromPort.connectorType === toPort.connectorType) return null

  const matches = customLibrary.filter(
    (t) =>
      !t.hidden &&
      (t.inputs ?? []).some((p) => p.connectorType === fromPort.connectorType) &&
      (t.outputs ?? []).some((p) => p.connectorType === toPort.connectorType),
  )

  const fromDev = equipment.find((e) => e.id === fromEquipmentId)
  const toDev = equipment.find((e) => e.id === toEquipmentId)

  return (
    <div className="mt-2 rounded border border-amber-700/60 bg-amber-900/30 px-2 py-1.5 text-[11px] text-amber-100">
      <div>
        ⚠ Connector-Typen passen nicht: <strong>{fromPort.connectorType}</strong> ↔{' '}
        <strong>{toPort.connectorType}</strong>
      </div>
      {matches.length > 0 ? (
        <>
          <div className="mt-1 text-amber-200">Passende Konverter aus deiner Library:</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {matches.slice(0, 8).map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => {
                  if (!fromDev || !toDev) return
                  const matchingIn = t.inputs?.find((p) => p.connectorType === fromPort.connectorType)
                  const matchingOut = t.outputs?.find((p) => p.connectorType === toPort.connectorType)
                  if (!matchingIn || !matchingOut) return
                  // Pre-mint the converter's equipment id and port ids so we
                  // can wire up the cable splits right after importEquipment.
                  // (addEquipment is set()-only and doesn't return the id; we
                  // build the EquipmentItem ourselves and use importEquipment
                  // which preserves explicit ids — this keeps the in-place
                  // wiring atomic instead of guessing the new id later.)
                  const newId = uuidv4()
                  const newInPortId = uuidv4()
                  const newOutPortId = uuidv4()
                  const midX = (fromDev.x + toDev.x) / 2
                  const midY = (fromDev.y + toDev.y) / 2
                  importEquipment([
                    {
                      ...t,
                      id: newId,
                      x: midX,
                      y: midY,
                      inputs: (t.inputs ?? []).map((p) =>
                        p.id === matchingIn.id ? { ...p, id: newInPortId } : { ...p, id: uuidv4() },
                      ),
                      outputs: (t.outputs ?? []).map((p) =>
                        p.id === matchingOut.id ? { ...p, id: newOutPortId } : { ...p, id: uuidv4() },
                      ),
                    },
                  ])
                  // Re-route original cable: source → converter input
                  updateCable(cableId, {
                    toEquipmentId: newId,
                    toPortId: newInPortId,
                  })
                  // Add second cable: converter output → original target
                  queueConnection({
                    fromEquipmentId: newId,
                    fromPortId: newOutPortId,
                    toEquipmentId,
                    toPortId: toPort.id,
                  })
                  createCableFromPending({
                    name: `${t.name} → ${toDev.name}`,
                    color: '#94a3b8',
                  })
                }}
                className="rounded bg-amber-800/60 px-1.5 py-0.5 text-amber-100 hover:bg-amber-700/80"
                title={`${t.name} einfügen — splittet das Kabel automatisch`}
              >
                + {t.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-1 text-amber-200/70">
          Kein passender Konverter in der Library. Eines z. B. via „+ Gerät" oder Rentman-Import anlegen.
        </div>
      )}
    </div>
  )
}
