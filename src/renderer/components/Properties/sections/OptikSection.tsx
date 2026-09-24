/**
 * #910 — Objektiv und Einstellung einer Kamera aus dem MultiCam-Plan.
 *
 * Nur lesend: der Kameraplan fuehrt diese Angaben, und der naechste Abgleich
 * (#909) schriebe eine Aenderung hier wieder zurueck. Geaendert wird dort,
 * wo die Kamera geplant wird.
 *
 * Erscheint nur, wenn es etwas zu sagen gibt — Optik oder der Hinweis, dass
 * die Kamera im MultiCam-Plan nicht mehr steht.
 */
import { Aperture, AlertTriangle } from 'lucide-react'
import { useTranslation } from '../../../lib/i18n'
import { Icon } from '../../shared/Icon'
import { objektivName, zoombereich } from '../../../lib/kameraOptik'
import type { EquipmentItem } from '../../../types/equipment'

const zahl = (n: number): string => String(Math.round(n * 10) / 10)

export const OptikSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const o = equipment.optik
  if (!o && !equipment.multicamRemoved) return null

  const zeilen: Array<[string, string]> = []
  if (o) {
    const name = objektivName(o)
    const bereich = zoombereich(o)
    if (name) zeilen.push([t('props.optik.lens', 'Lens'), name])
    if (bereich) zeilen.push([t('props.optik.range', 'Focal range'), bereich])
    if (o.brennweiteMm !== undefined) zeilen.push([t('props.optik.focal', 'Set focal length'), `${zahl(o.brennweiteMm)} mm`])
    if (o.extender !== undefined) zeilen.push([t('props.optik.extender', 'Extender'), `${zahl(o.extender)}x`])
    if (o.objektivMount) zeilen.push([t('props.optik.lensMount', 'Lens mount'), o.objektivMount])
    if (o.kameraMount) zeilen.push([t('props.optik.bodyMount', 'Body mount'), o.kameraMount])
    if (o.hoeheM !== undefined) zeilen.push([t('props.optik.height', 'Height'), `${zahl(o.hoeheM)} m`])
  }

  return (
    <details className="border border-cp-border-muted" open>
      <summary className="cursor-pointer px-2 py-1 text-cp-xs font-medium text-cp-text">
        <Icon icon={Aperture} size="xs" className="mr-1 inline" />
        {t('props.optik.title', 'Optics (MultiCam plan)')}
      </summary>
      <div className="flex flex-col gap-1 px-2 pb-2 text-cp-xs">
        {equipment.multicamRemoved && (
          <p className="text-cp-warn">
            <Icon icon={AlertTriangle} size="xs" className="mr-1 inline" />
            {t(
              'props.optik.removed',
              'This camera is no longer in the MultiCam plan. It stays here because cables may hang on it — delete it yourself if it is gone.',
            )}
          </p>
        )}
        {zeilen.length > 0 && (
          <table className="block overflow-x-auto w-full border-collapse">
            <tbody>
              {zeilen.map(([label, wert]) => (
                <tr key={label} className="border-b border-cp-border-muted">
                  <td className="py-0.5 pr-2 text-cp-text-muted">{label}</td>
                  <td className="py-0.5 text-right text-cp-text">{wert}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-cp-text-faint">
          {t('props.optik.source', 'Set in the MultiCam planner; the next camera import updates it.')}
        </p>
      </div>
    </details>
  )
}
