import { useUiStore } from '../../../store/uiStore'
import { useTranslation } from '../../../lib/i18n'

/**
 * #306 — Geräte-Konfigurations-Zuordnung (Issue #80). Liest die
 * deviceConfigLibrary aus dem uiStore und zeigt zugeordnete + verfügbare
 * Konfigurationen für das aktuelle Equipment. Rendert null wenn die
 * Bibliothek leer ist (kein Mehrwert).
 */
export const DeviceConfigsBlock = ({ equipmentId }: { equipmentId: string }) => {
  const t = useTranslation()
  const library = useUiStore((s) => s.deviceConfigLibrary)
  const updateDeviceConfig = useUiStore((s) => s.updateDeviceConfig)
  const assigned = library.filter((e) => e.equipmentId === equipmentId)
  const unassigned = library.filter((e) => !e.equipmentId)
  if (library.length === 0) return null
  return (
    <div className="rounded border border-slate-700 bg-slate-900/40 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
        {t('props.deviceConfigs.title', 'Konfigurationen')}
      </div>
      {assigned.length === 0 ? (
        <div className="text-[11px] text-slate-500">
          {t('props.deviceConfigs.none', 'Keine Konfiguration zugeordnet.')}
        </div>
      ) : (
        <ul className="mb-2 space-y-1">
          {assigned.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded bg-slate-950 px-2 py-1 text-[11px]">
              <span className="flex-1 truncate" title={`${e.fileName} (${e.kind})`}>
                {e.name}
              </span>
              <span className="shrink-0 text-[10px] text-slate-500">{e.kind}</span>
              <button
                type="button"
                onClick={() => updateDeviceConfig(e.id, { equipmentId: undefined })}
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-red-700 hover:text-white"
                title={t('props.deviceConfigs.unassignTitle', 'Zuordnung lösen (Datei bleibt in der Bibliothek)')}
              >
                {t('props.deviceConfigs.unassign', 'Lösen')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {unassigned.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) updateDeviceConfig(e.target.value, { equipmentId })
          }}
          className="w-full rounded border border-slate-700 bg-slate-950 p-1 text-[11px]"
        >
          <option value="">
            {t('props.deviceConfigs.assignExisting', '+ Vorhandene Konfiguration zuordnen…')}
          </option>
          {unassigned.map((e) => (
            <option key={e.id} value={e.id}>
              {e.kind} · {e.name}
            </option>
          ))}
        </select>
      )}
      <div className="mt-1 text-[10px] text-slate-500">
        {t(
          'props.deviceConfigs.hint',
          'Neue Konfigurationen über Einstellungen → Konfigurationen hochladen.',
        )}
      </div>
    </div>
  )
}
