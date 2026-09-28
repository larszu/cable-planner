/**
 * #914 — „Signalweg zeigen": hebt die ganze Kette, in der dieses Kabel liegt,
 * auf dem Canvas hervor und listet ihre Stationen mit Etage · Raum · Geraet
 * · Port (#912).
 *
 * Die Kette rechnet `signalChains` — dieselbe, die der Analyse-Dialog im Tab
 * „Kette" zeigt. Hier steht sie dort, wo man sie braucht: am Kabel.
 */
import { Route } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { format, useTranslation } from '../../lib/i18n'
import { signalwegFuerKabel } from '../../lib/signalweg'
import { endeText, kabelEnden } from '../../lib/kabelOrt'
import type { PassThroughKind } from '../../lib/signalChain'
import { Icon } from '../shared/Icon'
import type { Cable } from '../../types/cable'
import type { Floor, LocationFrame } from '../../types/location'

const EMPTY_LOCATIONS: LocationFrame[] = []
const EMPTY_FLOORS: Floor[] = []

export const SignalwegSection = ({ cable }: { cable: Cable }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const locations = useProjectStore((s) => s.project.locations ?? EMPTY_LOCATIONS)
  const floors = useProjectStore((s) => s.project.floors ?? EMPTY_FLOORS)
  const signalweg = useUiStore((s) => s.signalweg)
  const setSignalweg = useUiStore((s) => s.setSignalweg)
  const aktiv = signalweg?.cableId === cable.id

  const durch = (kind: PassThroughKind): string => {
    switch (kind) {
      case 'patch-panel':
        return t('signalweg.through.panel', 'patch panel / plate')
      case 'converter':
        return t('signalweg.through.converter', 'converter')
      case 'distribution-amp':
        return t('signalweg.through.da', 'distribution amp')
      case 'router':
        return t('signalweg.through.router', 'router')
      case 'mixer':
        return t('signalweg.through.mixer', 'mixer')
      case 'adapter':
        return t('signalweg.through.adapter', 'adapter')
    }
  }

  const umschalten = () => {
    if (aktiv) {
      setSignalweg(null)
      return
    }
    const weg = signalwegFuerKabel(equipment, cables, cable.id)
    if (weg) setSignalweg({ cableId: weg.cableId, kabelIds: weg.kabelIds, geraetIds: weg.geraetIds })
  }

  // Nur rechnen, wenn gezeigt wird: die Ketten laufen ueber den ganzen Plan.
  const ketten = aktiv ? (signalwegFuerKabel(equipment, cables, cable.id)?.ketten ?? []) : []
  const ctx = { equipment, locations, floors }
  const byId = new Map(cables.map((c) => [c.id, c]))

  return (
    <div className="border border-cp-border bg-cp-surface-3/50 p-2 text-cp-xs">
      <button
        type="button"
        onClick={umschalten}
        aria-pressed={aktiv}
        className={`inline-flex items-center gap-1 border px-2 py-1 font-medium ${
          aktiv ? 'border-cp-accent bg-cp-accent/15 text-cp-accent' : 'border-cp-border text-cp-text-secondary hover:text-cp-text'
        }`}
        title={t('signalweg.buttonTitle', 'Highlight the whole chain this cable is part of and dim the rest (Esc ends it)')}
      >
        <Icon icon={Route} size="xs" />
        {aktiv ? t('signalweg.hide', 'Hide signal path') : t('signalweg.show', 'Show signal path')}
      </button>
      {aktiv && ketten.length === 0 && (
        <p className="mt-1 text-cp-text-muted">
          {t('signalweg.onlyThis', 'This cable is not part of a longer chain.')}
        </p>
      )}
      {ketten.map((k, ki) => (
        <ol key={k.id} className="mt-2 flex flex-col gap-0.5">
          {ketten.length > 1 && (
            <li className="font-semibold text-cp-text-muted">
              {format(t('signalweg.branch', 'Branch {n} of {total}'), { n: ki + 1, total: ketten.length })}
            </li>
          )}
          <li className="text-cp-text">{endeText(kabelEnden(byId.get(k.steps[0]?.cableId) ?? cable, ctx).von)}</li>
          {k.steps.map((s) => {
            const c = byId.get(s.cableId)
            const nach = c ? kabelEnden(c, ctx).nach : undefined
            return (
              <li key={s.cableId} className="flex flex-col">
                <span className={`pl-3 ${s.cableId === cable.id ? 'font-semibold text-cp-accent' : 'text-cp-text-muted'}`}>
                  ↓ {s.cableLabel}
                  {c?.isTieLine ? ` · ${t('signalweg.tieLine', 'house run')}` : ''}
                </span>
                <span className="text-cp-text">
                  {nach ? endeText(nach) : `${s.toEquipmentName} · ${s.toPortName}`}
                  {s.through ? <span className="text-cp-text-faint"> ({durch(s.through)})</span> : null}
                </span>
              </li>
            )
          })}
          {k.endNote && <li className="text-cp-warn">{k.endNote}</li>}
        </ol>
      ))}
    </div>
  )
}
