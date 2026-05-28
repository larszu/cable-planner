import { useGreenGoBeltpack } from '../../../lib/greengoSync'

/**
 * #306 — GreenGo-Beltpack-Konfiguration pro Equipment. Aus
 * EquipmentProperties ausgelagert. Rendert eine kompakte Card im
 * Properties-Panel mit Name + User-Slot-Zuordnung + Gruppen-Chips.
 */
export const GreenGoBeltpackSection = ({ equipmentId }: { equipmentId: string }) => {
  const { config, info, rename, assignUser } = useGreenGoBeltpack(equipmentId)
  if (!config || config.users.length === 0) {
    return (
      <div className="mb-2 text-[10px] text-emerald-300/60">
        Keine GreenGo-Konfiguration im Projekt. Öffne den Intercom-Planer oder lade ein
        Preset, um Beltpacks zu definieren.
      </div>
    )
  }
  // List of all users for the assignment dropdown. We label them by name
  // and decorate with the linked equipment id if any (so the user can
  // see at a glance which slots are already taken).
  return (
    <div className="mb-2 rounded bg-emerald-950/40 p-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-emerald-300">
        <span>Beltpack</span>
        {info?.groupNames && info.groupNames.length > 0 && (
          <span
            className="font-normal normal-case text-emerald-400/80"
            title={`Gruppen: ${info.groupNames.join(', ')}`}
          >
            {info.groupNames.length} Gruppe{info.groupNames.length === 1 ? '' : 'n'}
          </span>
        )}
      </div>
      <label className="block">
        <span className="mb-1 block text-emerald-200/70">Name</span>
        <input
          type="text"
          value={info?.user.name ?? ''}
          disabled={!info}
          placeholder={info ? '' : 'Erst zuordnen ↓'}
          onChange={(event) => rename(event.target.value)}
          className="w-full rounded border border-emerald-700 bg-emerald-950 p-1 text-xs text-emerald-50 disabled:opacity-50"
          title="Änderungen werden sofort in den Intercom-Plan und das .gg5-Export geschrieben"
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-emerald-200/70">Zugewiesener User-Slot</span>
        <select
          value={info?.user.id ?? ''}
          onChange={(event) => {
            const v = event.target.value
            assignUser(v === '' ? null : Number(v))
          }}
          className="w-full rounded border border-emerald-700 bg-emerald-950 p-1 text-xs text-emerald-50"
        >
          <option value="">(kein Slot zugewiesen)</option>
          {config.users.map((u) => {
            const takenBy = u.equipmentId && u.equipmentId !== equipmentId
            return (
              <option key={u.id} value={u.id}>
                {u.id}. {u.name}
                {takenBy ? ' (anderem Gerät zugewiesen)' : ''}
              </option>
            )
          })}
        </select>
      </label>
      {info?.groupNames && info.groupNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {info.groupNames.map((g) => (
            <span
              key={g}
              className="rounded bg-emerald-700/40 px-1.5 py-0.5 text-emerald-100"
              title="Gruppen werden im Intercom-Planer bearbeitet"
            >
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
