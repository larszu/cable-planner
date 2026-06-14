import { useState } from 'react'
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
  // Ein-/ausklappbar (wie SDI-Caps / Abmessungen). Default offen, wenn dem
  // Gerät schon Konfigurationen zugeordnet sind, sonst eingeklappt. <summary>
  // statt Form-Control, damit das Toggle auch im gesperrten Fieldset geht.
  const [open, setOpen] = useState(assigned.length > 0)
  if (library.length === 0) return null
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded border border-cp-border bg-cp-surface-1/40 [&_summary]:cursor-pointer"
    >
      <summary className="flex items-center gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wide text-cp-text-muted hover:text-cp-text-bright [&::-webkit-details-marker]:hidden">
        <span className="text-cp-text-faint">{open ? '▾' : '▸'}</span>
        <span className="flex-1">{t('props.deviceConfigs.title', 'Konfigurationen')}</span>
        {!open && assigned.length > 0 && (
          <span className="rounded bg-cp-surface-4/60 px-1 text-[11px] normal-case text-cp-text-bright">
            {assigned.length}
          </span>
        )}
      </summary>
      <div className="px-2 pb-2">
      {assigned.length === 0 ? (
        <div className="text-[11px] text-cp-text-muted">
          {t('props.deviceConfigs.none', 'Keine Konfiguration zugeordnet.')}
        </div>
      ) : (
        <ul className="mb-2 space-y-1">
          {assigned.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded bg-cp-surface-3 px-2 py-1 text-[11px]">
              <span className="flex-1 truncate" title={`${e.fileName} (${e.kind})`}>
                {e.name}
              </span>
              <span className="shrink-0 text-[10px] text-cp-text-muted">{e.kind}</span>
              <button
                type="button"
                onClick={() => updateDeviceConfig(e.id, { equipmentId: undefined })}
                className="rounded bg-cp-surface-2 px-1.5 py-0.5 text-[10px] text-cp-text-secondary hover:bg-red-700 hover:text-white"
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
          className="w-full rounded border border-cp-border bg-cp-surface-3 p-1 text-[11px]"
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
      <div className="mt-1 text-[10px] text-cp-text-muted">
        {t(
          'props.deviceConfigs.hint',
          'Neue Konfigurationen über Einstellungen → Konfigurationen hochladen.',
        )}
      </div>
      </div>
    </details>
  )
}
