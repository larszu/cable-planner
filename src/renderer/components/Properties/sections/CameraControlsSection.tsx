/**
 * BEDARF 103 — welche Steuerfunktionen dieses Kamera-MODELL wirklich kann.
 *
 * Die Massnahme verlangt „show unsupported paint functions as DISABLED in
 * planning documents". Genau das tut dieser Abschnitt: er steht am Geraet im
 * Plan, nicht in einer Hersteller-Liste, und er nennt drei Zustaende statt
 * zwei — „unterstützt", „nicht unterstützt" und „nicht belegt".
 *
 * DER DRITTE IST DER WICHTIGE. Ein Werkzeug, das nur zwei kennt, macht aus
 * einer fehlenden Datenblatt-Angabe eine Behauptung; und die Behauptung, die
 * dabei herauskommt, ist die falsche Richtung — der Bedarf beschreibt
 * Oberflaechen, die JEDE Funktion zeigen, weil sie zum Hersteller gehoert.
 *
 * Der Abschnitt erscheint NUR an Kameras und nur, wenn es etwas zu sagen gibt
 * (eine belegte Zeile oder der Hinweis, dass nichts belegt ist). Ein
 * aufklappbares Feld an jedem Stativ waere Laerm.
 */
import { Camera } from 'lucide-react'
import { useTranslation } from '../../../lib/i18n'
import { Icon } from '../../shared/Icon'
import { capabilityFor, controlRows, modelOf } from '../../../lib/cameraCapability'
import {
  CAMERA_CONTROL_LABEL,
  CONTROL_SUPPORT_LABEL,
  type ControlSupport,
} from '../../../types/cameraCapability'
import type { EquipmentItem } from '../../../types/equipment'

const TON: Readonly<Record<ControlSupport, string>> = {
  supported: 'text-cp-text',
  unsupported: 'text-cp-danger line-through',
  unknown: 'text-cp-text-muted',
}

export const CameraControlsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  if (!/kamera|camera/i.test(equipment.category ?? '')) return null

  const model = modelOf(equipment)
  const eintrag = capabilityFor(model)
  const zeilen = controlRows(model)

  return (
    <details className="rounded border border-cp-border-muted">
      <summary className="cursor-pointer px-2 py-1 text-cp-xs font-medium text-cp-text">
        <Icon icon={Camera} size="xs" className="mr-1 inline" />
        {t('props.cameraControls.title', 'Steuerbare Funktionen')}
      </summary>
      <div className="flex flex-col gap-1 px-2 pb-2 text-cp-xs">
        <p className="text-cp-text-muted">
          {eintrag
            ? eintrag.source
            : t(
                'props.cameraControls.noSource',
                'Zu diesem Modell liegt keine Fähigkeits-Aussage vor. „Nicht belegt" heißt nicht „geht nicht" — es heißt, dass niemand es nachgesehen hat.',
              )}
        </p>
        <table className="w-full border-collapse">
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.control} className="border-b border-cp-border-muted">
                <td className={`py-0.5 pr-2 ${TON[z.support]}`}>
                  {CAMERA_CONTROL_LABEL[z.control]}
                </td>
                <td className={`py-0.5 text-right ${TON[z.support]}`}>
                  {CONTROL_SUPPORT_LABEL[z.support]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
