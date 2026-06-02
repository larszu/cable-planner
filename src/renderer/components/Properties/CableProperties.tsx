import { Pencil, AlertTriangle } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { Icon } from '../shared/Icon'
import { cableCatalog } from '../../types/cableSpec'
import { useUiStore } from '../../store/uiStore'
import { cableTypePatchFromPorts } from '../../lib/cableInheritance'
import type { Cable } from '../../types/cable'
import type { EquipmentItem, Port } from '../../types/equipment'
import { ColorField } from '../shared/ColorField'
import { v4 as uuidv4 } from 'uuid'
import { RoutingToggle } from '../shared/RoutingToggle'
import { format, useTranslation } from '../../lib/i18n'
import { STANDARD_LAYERS, LAYER_STYLES } from '../../lib/cableLayers'
import { netKeyOf, netPeerCount } from '../../lib/offPageNet'

export const CableProperties = () => {
  const t = useTranslation()
  const selectedCableId = useProjectStore((state) => state.selectedCableId)
  const cable = useProjectStore((state) => state.project.cables.find((item) => item.id === selectedCableId))
  const equipment = useProjectStore((state) => state.project.equipment)
  const cables = useProjectStore((state) => state.project.cables)
  const updateCable = useProjectStore((state) => state.updateCable)
  const deleteCable = useProjectStore((state) => state.deleteCable)
  const openCableEdit = useUiStore((state) => state.openCableEdit)
  const cableLayersFromStore = useUiStore((state) => state.customLayers)

  if (!cable) {
    return (
      <div className="text-cp-xs text-slate-400">
        {t('cable.click.placeholder', 'Kabel anklicken um Eigenschaften zu sehen.')}
      </div>
    )
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
    <div className="space-y-2 text-cp-xs">
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
            title={t('cable.edit.typeStandard', 'Kabeltyp / Standard bearbeiten')}
            aria-label={t('cable.edit.typeStandard', 'Kabeltyp / Standard bearbeiten')}
          >
            <Icon icon={Pencil} size="xs" />
          </button>
        </div>
      )}
      {!spec && (
        <button
          type="button"
          onClick={() => openCableEdit(cable.id)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-slate-600 px-2 py-1 text-slate-400 hover:border-slate-400 hover:text-slate-200"
        >
          <Icon icon={Pencil} size="xs" /> Kabeltyp / Standard festlegen
        </button>
      )}
      {(() => {
        // v7.9.125 — Kabel-Typ vs. Port-Connector-Mismatch.
        // Greift nur wenn beide Ports existieren und das Kabel
        // kein Konverter-Kabel ist. Klick laesst den User den
        // Typ aus den aktuellen Ports uebernehmen ohne den
        // globalen Inheritance-Toggle zu touchen.
        if (!fromPort || !toPort || cable.needsConverter) return null
        const typePatch = cableTypePatchFromPorts(cable, equipment)
        if (!typePatch) return null
        return (
          <div className="flex items-center gap-2 rounded border border-amber-700/50 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200">
            <span className="flex-1 leading-snug">
              Kabel-Typ <strong>{cable.type}</strong> passt nicht zu den Ports
              ({fromPort.connectorType} ↔ {toPort.connectorType}).
            </span>
            <button
              type="button"
              onClick={() => updateCable(cable.id, typePatch)}
              className="shrink-0 rounded bg-amber-700/40 px-1.5 py-0.5 font-medium hover:bg-amber-600/60"
              title={`Kabel-Typ auf ${typePatch.type} setzen`}
            >
              → {typePatch.type}
            </button>
          </div>
        )
      })()}
      <label className="block">
        <span className="mb-1 block text-slate-300">{t('cable.field.name', 'Name')}</span>
        <input
          value={cable.name}
          onChange={(event) => updateCable(cable.id, { name: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>
      {/* v7.9.68 / #182 — Bei Wireless-Links macht "Länge" keinen Sinn;
          stattdessen "Max. Reichweite" eintragen. */}
      {cable.wireless ? (
        <label className="block">
          <span className="mb-1 block text-slate-300">{t('cable.field.maxReach', 'Max. Reichweite (m)')}</span>
          <input
            type="number"
            min={0}
            value={cable.maxRange ?? ''}
            placeholder={t('cable.field.maxReachPlaceholder', 'z.B. 100')}
            onChange={(event) => {
              const v = event.target.value
              updateCable(cable.id, { maxRange: v === '' ? undefined : Number(v) })
            }}
            className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          />
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-slate-300">{t('cable.field.length', 'Länge (m)')}</span>
          <input
            type="number"
            min={0}
            value={cable.length}
            onChange={(event) => updateCable(cable.id, { length: Number(event.target.value) })}
            className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          />
        </label>
      )}
      <ColorField
        label={t('cable.field.color', 'Farbe')}
        value={cable.color}
        onChange={(color) => updateCable(cable.id, { color })}
      />

      {/* v7.9.85 / #123 — Layer-Auswahl. Standard-Layer + Custom-Layer aus uiStore.
          v7.9.95: 'Other' ist jetzt ein vollwertiger Standard-Layer, daher
          kein leerer "ungrouped"-Eintrag mehr. Wenn das Feld doch leer ist
          (legacy), behandelt isCableVisibleByLayer es wie 'other'. */}
      <label className="block">
        <span className="mb-1 block text-slate-300">{t('cable.field.layer', 'Ebene (Layer)')}</span>
        <select
          value={cable.layer ?? 'other'}
          onChange={(event) =>
            updateCable(cable.id, { layer: event.target.value || undefined })
          }
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          title={t('cable.field.layerTitle', 'Wirkt mit dem Layer-Filter in der Toolbar (Ebenen-Chips)')}
        >
          {STANDARD_LAYERS.map((l) => (
            <option key={l} value={l}>
              {LAYER_STYLES[l].icon} {LAYER_STYLES[l].label}
            </option>
          ))}
          {cableLayersFromStore.length > 0 && (
            <optgroup label={t('cable.optgroup.custom', 'Custom')}>
              {cableLayersFromStore.map((l) => (
                <option key={l} value={l}>
                  ◆ {l}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      {/* #363 — Multicore/Snake-Zuordnung: Kabel mit gleichem Namen bilden
          ein Bündel. Datalist schlägt bereits vergebene Namen vor. */}
      <label className="block">
        <span className="mb-1 block text-slate-300">
          {t('cable.field.multicore', 'Multicore / Snake')}{' '}
          <span className="text-slate-500">({t('common.optional', 'optional')})</span>
        </span>
        <input
          list="cp-multicore-names"
          value={cable.multicoreName ?? ''}
          placeholder={t('cable.field.multicorePlaceholder', 'z. B. "Snake-1", "FOH-Loom"')}
          onChange={(event) =>
            updateCable(cable.id, { multicoreName: event.target.value.trim() || undefined })
          }
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          title={t(
            'cable.field.multicoreTitle',
            'Kabel mit gleichem Namen bilden ein physisches Bündel — die BOM zählt es als 1 Stück.',
          )}
        />
        <datalist id="cp-multicore-names">
          {[...new Set(cables.map((c) => c.multicoreName).filter((n): n is string => !!n))].map(
            (n) => (
              <option key={n} value={n} />
            ),
          )}
        </datalist>
      </label>

      {/* #368 — Tie-Line / Festverbindung (permanente Haus-/Dauerleitung). */}
      <label className="flex items-center gap-2 text-[12px] text-slate-300">
        <input
          type="checkbox"
          checked={!!cable.isTieLine}
          onChange={(event) => updateCable(cable.id, { isTieLine: event.target.checked || undefined })}
        />
        {t('cable.field.tieLine', 'Tie-Line / Festverbindung (permanent)')}
      </label>

      {/* #221 — Off-Page-/Pfeil-Connector. Statt einer Linie quer über den
          Plan wird an jedem Ende ein benanntes Connector-Symbol gezeichnet.
          Segmente mit gleichem Netznamen bilden ein gemeinsames Netz. */}
      <div className="rounded border border-slate-700 bg-slate-950/50 p-2 space-y-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!cable.offPage}
            onChange={(event) => {
              const on = event.target.checked
              updateCable(cable.id, {
                offPage: on || undefined,
                ...(on && !cable.netName ? { netName: cable.name } : {}),
              })
            }}
          />
          <span className="font-semibold">
            {t('cable.field.offPage', 'Off-Page-Verbindung (Pfeil-Connector)')}
          </span>
        </label>
        {cable.offPage && (
          <div className="pl-5 space-y-1">
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-400">
                {t('cable.field.netName', 'Netzname / Signalname')}
              </span>
              <input
                list="cp-offpage-nets"
                value={cable.netName ?? ''}
                placeholder={cable.name}
                onChange={(event) =>
                  updateCable(cable.id, { netName: event.target.value.trim() || undefined })
                }
                className="w-full rounded border border-slate-700 bg-slate-900 p-1.5 text-cp-xs"
              />
              <datalist id="cp-offpage-nets">
                {[
                  ...new Set(
                    cables
                      .filter((c) => c.offPage)
                      .map((c) => netKeyOf(c))
                      .filter((n): n is string => !!n),
                  ),
                ].map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
            {(() => {
              const peers = netPeerCount(cables, cable)
              const key = netKeyOf(cable)
              return (
                <p className={`text-[10px] ${peers > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                  {peers > 0
                    ? format(
                        t(
                          'cable.offPage.netPeers',
                          '{n} weitere(s) Segment(e) im Netz „{net}" — werden logisch verbunden.',
                        ),
                        { n: peers, net: key ?? '' },
                      )
                    : t(
                        'cable.offPage.netSolo',
                        'Erstes Segment. Ein zweites mit gleichem Netznamen verbindet sich automatisch.',
                      )}
                </p>
              )
            })()}
          </div>
        )}
      </div>

      {/* Endpoint editor — inline accordion (open by default) so users can
          re-route a cable from the properties panel without opening a dialog. */}
      <details open className="rounded border border-slate-700 bg-slate-950/50">
        <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800/40">
          <span className="font-semibold uppercase tracking-wide text-slate-400">
            {t('cable.field.connection', 'Verbindung')}
          </span>
          <span className="ml-2 text-slate-300">
            {fromDev?.name ?? '?'} · {fromPort?.name ?? cable.fromPortId}
            <span className="mx-1 text-slate-500">→</span>
            {toDev?.name ?? '?'} · {toPort?.name ?? cable.toPortId}
          </span>
        </summary>
        <div className="border-t border-slate-700 p-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-0.5 text-[10px] text-slate-400">{t('cable.fromDeviceShort', 'Von Gerät')}</div>
              <select
                aria-label={t('cable.aria.fromDevice', 'Quell-Gerät')}
                value={cable.fromEquipmentId}
                onChange={(e) => onSelectFromEquipment(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-cp-xs"
              >
                {sortedEquipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[10px] text-slate-400">{t('cable.portShort', 'Port')}</div>
              <select
                aria-label={t('cable.aria.fromPort', 'Quell-Port')}
                value={cable.fromPortId}
                onChange={(e) => updateCable(cable.id, { fromPortId: e.target.value })}
                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-cp-xs"
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
              <div className="mb-0.5 text-[10px] text-slate-400">{t('cable.toDeviceShort', 'Nach Gerät')}</div>
              <select
                aria-label={t('cable.aria.toDevice', 'Ziel-Gerät')}
                value={cable.toEquipmentId}
                onChange={(e) => onSelectToEquipment(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-cp-xs"
              >
                {sortedEquipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[10px] text-slate-400">{t('cable.portShort', 'Port')}</div>
              <select
                aria-label={t('cable.aria.toPort', 'Ziel-Port')}
                value={cable.toPortId}
                onChange={(e) => updateCable(cable.id, { toPortId: e.target.value })}
                className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-cp-xs"
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
            <div className="mt-2 flex items-center gap-1 rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-100">
              <Icon icon={AlertTriangle} size="xs" className="shrink-0" />
              {format(t('cable.warn.fromBusy', 'Quell-Port bereits durch „{name}" belegt.'), { name: fromConflict.name })}
            </div>
          )}
          {toConflict && (
            <div className="mt-1 flex items-center gap-1 rounded bg-amber-900/50 px-2 py-1 text-[11px] text-amber-100">
              <Icon icon={AlertTriangle} size="xs" className="shrink-0" />
              {format(t('cable.warn.toBusy', 'Ziel-Port bereits durch „{name}" belegt.'), { name: toConflict.name })}
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
        <span className="mb-1 block text-slate-300">{t('cable.field.routing', 'Routing')}</span>
        <RoutingToggle
          value={routing}
          onChange={(value) =>
            updateCable(cable.id, { routing: value, waypoints: undefined })
          }
        />
      </div>

      <label className="block">
        <span className="mb-1 block text-slate-300">{format(t('cable.field.strokeWidth', 'Stroke width ({width}px)'), { width: cable.strokeWidth ?? 2.5 })}</span>
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
        {/* v7.9.112 / Issue #234 — Label-Position als 4er-Picker statt
            3 Slots + separater Hide-Checkbox. Vierter Slot 'Aus'
            blendet das Label aus, kein 'ausblenden'-Toggle mehr noetig.
            Globaler Hide-Toggle gibt's zusaetzlich in der Toolbar. */}
        <div className="mb-1 flex items-center justify-between">
          <span className="text-slate-300">{t('cable.field.labelPosition', 'Label Position')}</span>
        </div>
        {(() => {
          // Issue #234 — kein extra "Aus"-Button mehr. Wenn keine
          // der drei Positionen aktiv ist, ist das Label ausgeblendet
          // (labelPosition='none'). Klick auf aktiven Toggle deaktiviert
          // ihn → Label verschwindet.
          const isHidden = cable.labelPosition === 'none'
          const activePos = cable.labelPosition ?? 'center'
          const positions = [
            { id: 'source' as const, label: '← Start' },
            { id: 'center' as const, label: 'Mitte' },
            { id: 'target' as const, label: 'End →' },
          ]
          return (
            <>
              <div className="flex gap-1">
                {positions.map((p) => {
                  const isActive =
                    !isHidden && cable.labelT === undefined && activePos === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        updateCable(cable.id, {
                          // Toggle: wenn schon aktiv → deaktivieren
                          // (labelPosition='none' = Label aus).
                          labelPosition: isActive ? 'none' : p.id,
                          labelT: undefined,
                          labelHidden: undefined,
                        })
                      }
                      title={
                        isActive
                          ? `${p.label} — Klick zum Ausblenden des Labels`
                          : `${p.label}`
                      }
                      className={`flex-1 rounded border px-2 py-1 text-cp-xs ${
                        isActive
                          ? 'border-sky-500 bg-sky-800 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              {isHidden && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Label ausgeblendet — Klick auf eine der drei Positionen
                  zeigt es wieder an.
                </p>
              )}
              <div className={`mt-2 flex items-center gap-2 text-[11px] ${isHidden ? 'opacity-40' : ''}`}>
                <span className="text-slate-500">{t('cable.field.labelSlider', 'Slider:')}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={isHidden}
                  value={
                    typeof cable.labelT === 'number'
                      ? cable.labelT
                      : (activePos === 'source'
                          ? 0.15
                          : activePos === 'target'
                            ? 0.85
                            : 0.5)
                  }
                  onChange={(e) =>
                    updateCable(cable.id, { labelT: Number(e.target.value) })
                  }
                  className="flex-1 accent-sky-500"
                  title={t('cable.field.labelSliderTitle', 'Feinjustierung des Labels entlang des Kabels (0=Start, 1=Ende)')}
                />
                <span className="w-10 text-right font-mono text-slate-400">
                  {Math.round(
                    (typeof cable.labelT === 'number'
                      ? cable.labelT
                      : activePos === 'source'
                        ? 0.15
                        : activePos === 'target'
                          ? 0.85
                          : 0.5) * 100,
                  )}
                  %
                </span>
                {typeof cable.labelT === 'number' && (
                  <button
                    type="button"
                    onClick={() => updateCable(cable.id, { labelT: undefined })}
                    className="rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700"
                    title={t('cable.field.labelSliderReset', 'Slider zurücksetzen — Preset wieder aktiv')}
                  >
                    reset
                  </button>
                )}
              </div>
            </>
          )
        })()}
      </div>

      {/* v7.9.127 — Per-Kabel Override fuer Endpoint-Labels (Pfeile
          ans andere Kabel-Ende). Default 'Auto' folgt dem Global-
          Toggle in Settings -> Editing. */}
      <div className="rounded border border-slate-800 bg-slate-950/40 p-1.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-slate-300">{t('cable.field.endpointLabels', 'Endpoint-Labels (→ zum anderen Ende)')}</span>
        </div>
        <div className="flex gap-1">
          {[
            { id: undefined, label: 'Auto', title: 'Folgt Settings → Editing → Endpoint-Labels einblenden' },
            { id: 'show' as const, label: '✓ Anzeigen', title: 'Immer anzeigen, unabhaengig vom Settings-Toggle' },
            { id: 'hide' as const, label: '✕ Ausblenden', title: 'Immer ausblenden, unabhaengig vom Settings-Toggle' },
          ].map((opt) => {
            const active = (cable.endpointLabels ?? undefined) === opt.id
            return (
              <button
                key={opt.label}
                type="button"
                title={opt.title}
                onClick={() => updateCable(cable.id, { endpointLabels: opt.id })}
                className={`flex-1 rounded px-1.5 py-1 text-[11px] ${
                  active
                    ? 'bg-emerald-700/40 text-emerald-100 ring-1 ring-emerald-500'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
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
        <label
          className="flex items-center gap-1"
          title={t('cable.field.bidirectionalTitle', 'Bidirektionales Kabel (z.B. USB, Ethernet, LWL) — Pfeile auf beiden Seiten')}
        >
          <input
            type="checkbox"
            checked={cable.bidirectional ?? false}
            onChange={(event) => updateCable(cable.id, { bidirectional: event.target.checked })}
          />
          Bidirektional ⇌
        </label>
      </div>

      <div className="rounded border border-slate-700 bg-slate-950/50 p-2 space-y-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={cable.wireless ?? false}
            onChange={(event) => updateCable(cable.id, { wireless: event.target.checked, dashed: event.target.checked ? true : cable.dashed })}
          />
          <span className="font-semibold">{t('cable.field.wireless', 'Wireless Verbindung (kein Kabel)')}</span>
        </label>
        {cable.wireless && (
          <div className="grid grid-cols-2 gap-2 pl-5">
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-400">{t('cable.field.frequencyLabel', 'Frequenz (z.B. 5.8 GHz)')}</span>
              <input
                value={cable.frequency ?? ''}
                onChange={(event) => updateCable(cable.id, { frequency: event.target.value || undefined })}
                placeholder={t('cable.field.frequencyPlaceholder', 'z.B. 5.8 GHz, 600 MHz')}
                className="w-full rounded border border-slate-700 bg-slate-900 p-1.5 text-cp-xs"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[10px] text-slate-400">{t('cable.field.channelLabel', 'Kanal / Channel')}</span>
              <input
                value={cable.wifiChannel ?? ''}
                onChange={(event) => updateCable(cable.id, { wifiChannel: event.target.value || undefined })}
                placeholder={t('cable.field.channelPlaceholder', 'z.B. 36, 6, 149')}
                className="w-full rounded border border-slate-700 bg-slate-900 p-1.5 text-cp-xs"
              />
            </label>
          </div>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-slate-300">{t('cable.field.notes', 'Notes')}</span>
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
        {t('cable.action.delete', 'Kabel löschen')}
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
  const t = useTranslation()

  if (!fromPort || !toPort) return null
  if (fromPort.connectorType === toPort.connectorType) return null

  const matches = customLibrary.filter(
    (tpl) =>
      !tpl.hidden &&
      (tpl.inputs ?? []).some((p) => p.connectorType === fromPort.connectorType) &&
      (tpl.outputs ?? []).some((p) => p.connectorType === toPort.connectorType),
  )

  const fromDev = equipment.find((e) => e.id === fromEquipmentId)
  const toDev = equipment.find((e) => e.id === toEquipmentId)

  return (
    <div className="mt-2 rounded border border-amber-700/60 bg-amber-900/30 px-2 py-1.5 text-[11px] text-amber-100">
      <div className="flex items-center gap-1">
        <Icon icon={AlertTriangle} size="xs" className="shrink-0" />
        {format(
          t('cable.warn.connectorMismatch', 'Connector-Typen passen nicht: {from} ↔ {to}'),
          { from: fromPort.connectorType, to: toPort.connectorType },
        )}
      </div>
      {matches.length > 0 ? (
        <>
          <div className="mt-1 text-amber-200">{t('cable.warn.converterSuggest', 'Passende Konverter aus deiner Library:')}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {matches.slice(0, 8).map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => {
                  if (!fromDev || !toDev) return
                  const matchingIn = tpl.inputs?.find((p) => p.connectorType === fromPort.connectorType)
                  const matchingOut = tpl.outputs?.find((p) => p.connectorType === toPort.connectorType)
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
                      ...tpl,
                      id: newId,
                      x: midX,
                      y: midY,
                      inputs: (tpl.inputs ?? []).map((p) =>
                        p.id === matchingIn.id ? { ...p, id: newInPortId } : { ...p, id: uuidv4() },
                      ),
                      outputs: (tpl.outputs ?? []).map((p) =>
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
                    source: newId,
                    sourceHandle: newOutPortId,
                    target: toEquipmentId,
                    targetHandle: toPort.id,
                  })
                  createCableFromPending({
                    name: `${tpl.name} → ${toDev.name}`,
                    color: '#94a3b8',
                    type: 'Custom',
                    length: 1,
                    notes: '',
                  })
                }}
                className="rounded bg-amber-800/60 px-1.5 py-0.5 text-amber-100 hover:bg-amber-700/80"
                title={format(
                  t('cable.warn.converterInsertTitle', '{name} einfügen — splittet das Kabel automatisch'),
                  { name: tpl.name },
                )}
              >
                + {t.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-1 text-amber-200/70">
          {t(
            'cable.warn.converterNone',
            'Kein passender Konverter in der Library. Eines z. B. via „+ Gerät" oder Rentman-Import anlegen.',
          )}
        </div>
      )}
    </div>
  )
}
