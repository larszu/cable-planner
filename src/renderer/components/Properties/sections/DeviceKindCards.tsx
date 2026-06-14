import { SlidersHorizontal } from 'lucide-react'
import { useUiStore } from '../../../store/uiStore'
import { Icon } from '../../shared/Icon'
import { GreenGoBeltpackSection } from './GreenGoBeltpackSection'
import { detectDeviceKind } from '../../../lib/deviceKind'
import type { EquipmentItem } from '../../../types/equipment'
import { useTranslation } from '../../../lib/i18n'

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
  const t = useTranslation()
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
          {t('props.deviceKind.greengo', 'GreenGo Intercom erkannt')}
        </div>
        <GreenGoBeltpackSection equipmentId={equipment.id} />
        <button
          type="button"
          onClick={() => openGreenGoExport()}
          className="w-full rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
        >
          {t('props.deviceKind.greengoExport', 'Intercom-Planung / .gg5 exportieren →')}
        </button>
      </div>
    )
  }

  if (deviceKind === 'videohub') {
    return (
      <div className="rounded border border-purple-700 bg-purple-900/30 p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-purple-300">
          {t('props.deviceKind.videohub', 'Blackmagic Videohub erkannt')}
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
            className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-purple-700 px-2 py-1 text-cp-xs font-semibold hover:bg-purple-600"
          >
            <Icon icon={SlidersHorizontal} size="xs" />
            {t('props.deviceKind.videohubConfigure', 'Videohub konfigurieren · Labels + Routing →')}
          </button>
        </div>
      </div>
    )
  }

  if (deviceKind === 'atem') {
    return (
      <div className="rounded border border-sky-700 bg-sky-900/30 p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-sky-300">
          {t('props.deviceKind.atem', 'Blackmagic ATEM erkannt')}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => openAtemDialog(equipment.id)}
            className="w-full rounded bg-sky-700 px-2 py-1 text-cp-xs hover:bg-sky-600"
            title={t('props.deviceKind.atemConnectTitle', 'Verbindet per UDP mit dem ATEM und überträgt Input-Namen.')}
          >
            {t('props.deviceKind.atemConnect', 'ATEM verbinden / Setup übertragen →')}
          </button>
          <button
            type="button"
            onClick={() => openAtemMvConfig(equipment.id)}
            className="w-full rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
            title={t(
              'props.deviceKind.atemMvTitle',
              'Multiviewer-Layout offline konfigurieren. Wird beim nächsten Connect übertragen.',
            )}
          >
            {t('props.deviceKind.atemMv', 'Multiviewer-Layout konfigurieren →')}
          </button>
          <button
            type="button"
            onClick={() => openAtemAudioConfig(equipment.id)}
            className="w-full rounded bg-fuchsia-700 px-2 py-1 text-cp-xs hover:bg-fuchsia-600"
            title={t(
              'props.deviceKind.atemAudioTitle',
              'ATEM Audio-Router offline planen (Routing-Matrix oder klassischer Mixer).',
            )}
          >
            {t('props.deviceKind.atemAudio', 'Audio-Router konfigurieren →')}
          </button>
        </div>
      </div>
    )
  }

  if (deviceKind === 'multiviewer') {
    return (
      <div className="rounded border border-emerald-700 bg-emerald-900/30 p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300">
          {t('props.deviceKind.multiviewer', 'Multiviewer erkannt')}
        </div>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded bg-cp-surface-4 px-2 py-1 text-cp-xs opacity-60"
          title={t('props.deviceKind.mvExportTitle', 'Multiviewer-Layout Export kommt in v0.4.0')}
        >
          {t('props.deviceKind.mvExport', 'Multiviewer Layout Export (v0.4.0)')}
        </button>
      </div>
    )
  }

  return null
}
