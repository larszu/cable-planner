import { useUiStore } from '../../../store/uiStore'
import { useTranslation } from '../../../lib/i18n'
import { toolsForDevice, type DeviceToolId } from '../../../lib/deviceTools'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * Die Werkzeuge DIESES Geraets, im Inspector.
 *
 * Nutzer-Rueckmeldung 2026-09-07: „Die ganzen Tools müssten eigentlich besser
 * eingebaut werden da wo man sie auch wirklich braucht."
 *
 * Fuenf der 24 Menue-Eintraege sind Geraete-Werkzeuge: die drei ATEM-Dialoge,
 * Videohub und GreenGo. Wer sie brauchte, musste wissen, dass es sie gibt, sie
 * im Menue finden und drinnen erst das Geraet auswaehlen. Hier stehen sie an
 * dem Geraet, um das es geht — und nur dort.
 *
 * DIE ID GEHT MIT. `openAtemMvConfig`, `openVideohubExport` und
 * `openAtemAudioConfig` nehmen seit jeher eine `deviceId` entgegen; das Menue
 * rief sie nur nie damit auf. Der Dialog oeffnet sich damit auf dem richtigen
 * Geraet, statt eine Auswahl zu verlangen, die der Nutzer gerade getroffen hat.
 *
 * WELCHE Werkzeuge gelten, entscheidet `lib/deviceTools.ts` aus der
 * Datenblatt-Rolle. Diese Datei entscheidet nichts — sie oeffnet nur.
 */
export const DeviceToolsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const werkzeuge = toolsForDevice(equipment)
  // Kein leerer Abschnitt: die allermeisten Geraete tragen keine dieser vier
  // Rollen, und eine Ueberschrift ueber nichts ist eine Zeile, die jeder
  // ueberspringt und die trotzdem Platz kostet.
  if (werkzeuge.length === 0) return null

  const oeffnen: Record<DeviceToolId, () => void> = {
    'atem-mv': () => useUiStore.getState().openAtemMvConfig(equipment.id),
    'atem-audio': () => useUiStore.getState().openAtemAudioConfig(equipment.id),
    'atem-labels': () => useUiStore.getState().openAtemDialog(),
    videohub: () => useUiStore.getState().openVideohubExport(equipment.id),
    greengo: () => useUiStore.getState().openGreenGoExport(),
  }
  const beschriftung: Record<DeviceToolId, string> = {
    'atem-mv': t('app.menu.tools.atemMv', 'ATEM multiviewer layout…'),
    'atem-audio': t('app.menu.tools.atemAudio', 'ATEM audio routing…'),
    'atem-labels': t('app.menu.tools.atemLabels', 'ATEM input labels…'),
    videohub: t('app.menu.tools.videohub', 'Videohub routing / labels…'),
    greengo: t('app.menu.tools.greengo', 'GreenGo intercom…'),
  }

  return (
    <section className="mb-3 border border-cp-border bg-cp-surface-2/40 p-2">
      <div className="mb-1.5 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
        {t('props.deviceTools.title', 'Tools for this device')}
      </div>
      <div className="flex flex-col gap-1">
        {werkzeuge.map((id) => (
          <button
            key={id}
            type="button"
            onClick={oeffnen[id]}
            className="border border-cp-border bg-cp-surface-1 px-2 py-1 text-left text-cp-xs text-cp-text hover:border-sky-500 hover:bg-cp-surface-3"
          >
            {beschriftung[id]}
          </button>
        ))}
      </div>
    </section>
  )
}
