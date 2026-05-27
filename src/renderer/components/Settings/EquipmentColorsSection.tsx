import { useUiStore } from '../../store/uiStore'
import { SettingsCard } from './SettingsCard'

/**
 * #307 — Equipment-Karten-Farben-Konfiguration. Wird im AppearanceTab
 * eingebunden. Eigene Datei weil ~90 LOC selbständig genug sind.
 */
export const EquipmentColorsSection = () => {
  const equipmentColors = useUiStore((s) => s.equipmentColors)
  const setEquipmentColors = useUiStore((s) => s.setEquipmentColors)
  const resetEquipmentColors = useUiStore((s) => s.resetEquipmentColors)
  const defaultDeviceColor = useUiStore((s) => s.defaultDeviceColor)
  const setDefaultDeviceColor = useUiStore((s) => s.setDefaultDeviceColor)
  const roles: Array<{ key: keyof typeof equipmentColors.light; label: string; hint: string }> = [
    { key: 'body', label: 'Karten-Body', hint: 'Hintergrund der Geräte-Karte' },
    { key: 'header', label: 'Header-Strip', hint: 'Strip oben mit Name + IP' },
    { key: 'border', label: 'Rand', hint: '1-px Border um die Karte' },
    { key: 'text', label: 'Haupttext', hint: 'Geräte-Name + Port-Labels' },
    { key: 'subtext', label: 'Sekundär-Text', hint: 'Kategorie, IP, Connector-Typen' },
  ]
  return (
    <SettingsCard
      title="Geräte-Karten-Farben"
      description="Hintergrund/Text/Rand für Equipment-Knoten — pro Theme separat anpassbar. Defaults sind so gewählt dass die Karten klar vom Canvas-Hintergrund abstehen. Einzelne Geräte können in den Properties zusätzlich eine individuelle Farbe bekommen."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(['light', 'dark'] as const).map((theme) => (
          <div key={theme} className="rounded border border-slate-700 bg-slate-950/40 p-2">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-200">
                {theme === 'light' ? '☀ Hell' : '🌙 Dunkel'}
              </h4>
              <button
                type="button"
                onClick={() => resetEquipmentColors(theme)}
                className="rounded bg-slate-700 px-2 py-0.5 text-[10px] hover:bg-slate-600"
                title="Auf Default zurücksetzen"
              >
                ↺ Reset
              </button>
            </div>
            <div className="space-y-1.5">
              {roles.map((r) => (
                <label key={r.key} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300" title={r.hint}>{r.label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={equipmentColors[theme][r.key]}
                      onChange={(e) => setEquipmentColors(theme, { [r.key]: e.target.value })}
                      className="h-6 w-10 cursor-pointer rounded border border-slate-700 bg-slate-900 p-0.5"
                      title={r.hint}
                    />
                    <span className="font-mono text-[10px] text-slate-500">
                      {equipmentColors[theme][r.key]}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-slate-500">
        Hinweis: Geräte mit eigener Farbe (Properties → Gerätefarbe) überschreiben den Body-Wert
        weiterhin individuell.
      </div>
      {/* v7.9.63 / #172 — Default-Farbe für NEU hinzugefügte Geräte. */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-950/40 p-2">
        <div>
          <div className="text-xs font-semibold text-slate-200">Standard-Gerätefarbe</div>
          <div className="text-[10px] text-slate-500">
            Neu hinzugefügte Geräte starten mit dieser Farbe (Properties → Gerätefarbe lässt sich
            danach individuell ändern). Wenn leer: nutzt die Theme-Body-Farbe.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={defaultDeviceColor ?? '#475569'}
            onChange={(e) => setDefaultDeviceColor(e.target.value)}
            className="h-7 w-12 cursor-pointer rounded border border-slate-700 bg-slate-900 p-0.5"
          />
          {defaultDeviceColor && (
            <button
              type="button"
              onClick={() => setDefaultDeviceColor(undefined)}
              className="rounded bg-slate-700 px-2 py-0.5 text-[10px] hover:bg-slate-600"
            >
              ✕ Reset
            </button>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
