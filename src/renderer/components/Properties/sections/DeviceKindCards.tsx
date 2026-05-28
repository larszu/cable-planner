import { useUiStore } from '../../../store/uiStore'
import { GreenGoBeltpackSection } from './GreenGoBeltpackSection'
import { detectDeviceKind } from '../../../lib/deviceKind'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — Device-Kind-Karten (GreenGo / Videohub / ATEM / Multiviewer)
 * aus EquipmentProperties.tsx ausgelagert. Jede Karte oeffnet den
 * passenden Spezial-Dialog (Intercom, Videohub-Export, ATEM-Setup,
 * MV-Config, Audio-Router).
 *
 * detectDeviceKind ist die Single-Source-of-Truth dafuer, welche
 * Karte gezeigt wird — pro Equipment wird maximal eine sichtbar.
 */
export const DeviceKindCards = ({ equipment }: { equipment: EquipmentItem }) => {
  const openVideohubExport = useUiStore((state) => state.openVideohubExport)
  const openGreenGoExport = useUiStore((state) => state.openGreenGoExport)
  const openAtemDialog = useUiStore((state) => state.openAtemDialog)
  const openAtemMvConfig = useUiStore((state) => state.openAtemMvConfig)
  const openAtemAudioConfig = useUiStore((state) => state.openAtemAudioConfig)
  const deviceKind = detectDeviceKind(equipment)

  if (deviceKind === 'greengo') {
    return (
      <div className="rounded border border-emerald-700 bg-emerald-900/30 p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300">
          GreenGo Intercom erkannt
        </div>
        <GreenGoBeltpackSection equipmentId={equipment.id} />
        <button
          type="button"
          onClick={() => openGreenGoExport()}
          className="w-full rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
        >
          Intercom-Planung / .gg5 exportieren →
        </button>
      </div>
    )
  }

  if (deviceKind === 'videohub') {
    return (
      <div className="rounded border border-purple-700 bg-purple-900/30 p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-purple-300">
          Blackmagic Videohub erkannt
        </div>
        <div className="flex flex-col gap-1">
          {/* v7.9.128 — Vereinheitlicht: ein einziger Eintrag zum
              Videohub-Tool. Im Dialog selber kann der User offline
              Labels + Routing aufbauen und das Hub-Push (Labels,
              Routing, Beides, oder gar nicht) als separate Aktion
              ausloesen wenn er im Netz ist. */}
          <button
            type="button"
            onClick={() => openVideohubExport(equipment.id, true)}
            className="w-full rounded bg-purple-700 px-2 py-1 text-xs font-semibold hover:bg-purple-600"
          >
            🎚 Videohub konfigurieren · Labels + Routing →
          </button>
        </div>
      </div>
    )
  }

  if (deviceKind === 'atem') {
    return (
      <div className="rounded border border-sky-700 bg-sky-900/30 p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-sky-300">
          Blackmagic ATEM erkannt
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => openAtemDialog(equipment.id)}
            className="w-full rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
            title="Verbindet per UDP mit dem ATEM und überträgt Input-Namen."
          >
            ATEM verbinden / Setup übertragen →
          </button>
          <button
            type="button"
            onClick={() => openAtemMvConfig(equipment.id)}
            className="w-full rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
            title="Multiviewer-Layout offline konfigurieren. Wird beim nächsten Connect übertragen."
          >
            Multiviewer-Layout konfigurieren →
          </button>
          <button
            type="button"
            onClick={() => openAtemAudioConfig(equipment.id)}
            className="w-full rounded bg-fuchsia-700 px-2 py-1 text-xs hover:bg-fuchsia-600"
            title="ATEM Audio-Router offline planen (Routing-Matrix oder klassischer Mixer)."
          >
            Audio-Router konfigurieren →
          </button>
        </div>
      </div>
    )
  }

  if (deviceKind === 'multiviewer') {
    return (
      <div className="rounded border border-emerald-700 bg-emerald-900/30 p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300">
          Multiviewer erkannt
        </div>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded bg-slate-700 px-2 py-1 text-xs opacity-60"
          title="Multiviewer-Layout Export kommt in v0.4.0"
        >
          Multiviewer Layout Export (v0.4.0)
        </button>
      </div>
    )
  }

  return null
}
