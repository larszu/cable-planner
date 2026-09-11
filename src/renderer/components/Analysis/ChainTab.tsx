import { useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { PanelHint } from '../shared/PanelHint'
import {
  PASS_THROUGH_LABEL,
  signalChains,
  type ChainEnd,
  type SignalChain,
} from '../../lib/signalChain'

/**
 * ISSUE #664, Anzeige-Haelfte — „mehrere Ebenen der Verkabelung anzeigbar
 * machen fuer Festinstallationen".
 *
 * Die Patchliste zeigt KABEL, eine Zeile je Steckverbindung. In einer
 * Festinstallation liegen zwischen Kamera und Mischer aber Wandanschluss,
 * Steigleitung und zwei Blenden — und keine der Zeilen sagt, was am anderen
 * Ende haengt. Diese Seite zeigt den Weg als Ganzes.
 *
 * WAS HIER GERECHNET WIRD: nichts. `signalChain.ts` setzt die Kette zusammen,
 * diese Datei stellt sie dar. Auch das Ende kommt von dort: ob ein Weg am
 * Zielgeraet endet oder ob die Ableitung aufgegeben hat, sieht man sonst
 * nicht auseinander — und es bedeutet das Gegenteil.
 */
const ENDE_TON: Readonly<Record<ChainEnd, string>> = {
  ziel: 'text-cp-text-muted',
  'nicht-verkabelt': 'text-cp-warn',
  mehrdeutig: 'text-cp-warn',
  'zu-lang': 'text-cp-warn',
  schleife: 'text-cp-danger',
}

const Kette = ({ chain }: { chain: SignalChain }) => {
  const t = useTranslation()
  const erst = chain.steps[0]
  return (
    <li className="border border-cp-border-muted bg-cp-surface-2 p-2">
      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-cp-xs">
        <span className="font-medium text-cp-text">{erst.fromEquipmentName}</span>
        <span className="text-cp-text-muted">{erst.fromPortName}</span>
        {chain.steps.map((s) => (
          <span key={s.cableId} className="flex items-baseline gap-1">
            <span className="text-cp-text-faint">
              &ndash;[{s.cableLabel}]&rarr;
            </span>
            <span className={s.through ? 'text-cp-text-secondary' : 'font-medium text-cp-text'}>
              {s.toEquipmentName}
            </span>
            <span className="text-cp-text-muted">{s.toPortName}</span>
            {s.through && (
              <span className="bg-cp-surface-3 px-1 text-cp-text-faint">
                {PASS_THROUGH_LABEL[s.through]}
              </span>
            )}
          </span>
        ))}
      </div>
      <div className={`mt-0.5 text-cp-xs ${ENDE_TON[chain.end]}`}>
        {chain.end === 'ziel'
          ? t('analysis.chain.endTarget', 'End device reached')
          : chain.endNote}
      </div>
    </li>
  )
}

export const ChainTab = () => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)

  const chains = useMemo(() => signalChains(equipment, cables), [equipment, cables])
  const offen = chains.filter((c) => c.end !== 'ziel').length

  return (
    <div className="flex flex-col gap-2 text-cp-sm">
      <PanelHint
        text={t(
          'analysis.chain.hint',
          'Paths crossing at least one intermediate stage — patch panel, converter, distribution amp, switched router crosspoint. Direct connections live in the patch list and are deliberately absent here. Where a path does not reach an end device, the reason is stated: nothing is guessed.',
        )}
      />
      {chains.length === 0 ? (
        <p className="text-cp-xs text-cp-text-muted">
          {t(
            'analysis.chain.none',
            'No multi-stage path in this plan. A device becomes a patch panel through the category „Patchfelder“ or the checkbox under „Display & flags“.',
          )}
        </p>
      ) : (
        <>
          <p className="text-cp-xs text-cp-text-secondary">
            {chains.length} {t('analysis.chain.count', 'multi-stage paths')}
            {offen > 0 && (
              <span className="text-cp-warn">
                {' '}
                &middot; {offen} {t('analysis.chain.openCount', 'without a reached end device')}
              </span>
            )}
          </p>
          <ul className="flex flex-col gap-1">
            {chains.map((c) => (
              <Kette key={c.id} chain={c} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
