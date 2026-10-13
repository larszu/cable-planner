import { useMemo } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation, format } from '../../../lib/i18n'
import { cablePlannerApi } from '../../../lib/bridge'
import type { EquipmentItem } from '../../../types/equipment'
import {
  labelFollowConfig,
  labelFollowLinks,
  labelFollowRows,
  type LabelFollowHinweis,
} from '../../../lib/atemLabelFollow'
import { PanelHint } from '../../shared/PanelHint'
import { useFollowStatus } from './useLabelFollowSync'

/**
 * Am Videohub: ATEM-Eingänge übernehmen den Namen der geschalteten Quelle.
 * Ein Schalter, die gefundenen Verbindungen zum Abwählen, Start/Stopp.
 */
export const LabelFollowPanel = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const alleGeraete = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const status = useFollowStatus()
  const config = labelFollowConfig(equipment)

  const rows = useMemo(
    () => labelFollowRows(alleGeraete, cables).filter((r) => r.hubId === equipment.id),
    [alleGeraete, cables, equipment.id],
  )

  const hinweisText = (h: LabelFollowHinweis): string =>
    h === 'hub-ip'
      ? t('labelFollow.missingHubIp', 'Videohub has no IP address')
      : h === 'atem-ip'
        ? t('labelFollow.missingAtemIp', 'ATEM has no IP address')
        : t('labelFollow.missingAtemInput', 'source number missing on the ATEM input (Switching → Numbers)')

  const setzeAusnahme = (portId: string, folgt: boolean) => {
    const aus = new Set(config.excludedOutputs ?? [])
    if (folgt) aus.delete(portId)
    else aus.add(portId)
    updateEquipment(equipment.id, {
      labelFollow: { enabled: config.enabled, ...(aus.size ? { excludedOutputs: [...aus] } : {}) },
    })
  }

  const starten = async () => {
    await cablePlannerApi.atemLabelFollow.start(labelFollowLinks(alleGeraete, cables))
  }

  return (
    <div className="mt-3 border-t border-cp-border-muted pt-2">
      <label className="flex items-center gap-2 text-cp-xs text-cp-text">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) =>
            updateEquipment(equipment.id, {
              labelFollow: e.target.checked
                ? { ...config, enabled: true }
                : config.excludedOutputs?.length
                  ? { ...config, enabled: false }
                  : undefined,
            })
          }
        />
        {t('labelFollow.toggle', 'ATEM input names follow this Videohub’s routing')}
      </label>
      <PanelHint
        className="mt-1 text-cp-xs text-cp-text-muted"
        text={t(
          'labelFollow.hint',
          'When an output is switched, the ATEM input wired to it takes the name of the new Videohub source (long name up to 20 characters, short name 4). Which output feeds which input comes from the cables in the plan. Only names are written; nothing is switched.',
        )}
      />
      {config.enabled && (
        <>
          {rows.length === 0 ? (
            <PanelHint
              className="mt-1 text-cp-xs text-cp-warn"
              text={t(
                'labelFollow.noLinks',
                'No output of this Videohub is cabled to an ATEM input. The ATEM needs the control protocol “Blackmagic ATEM”.',
              )}
            />
          ) : (
            <div className="mt-2 space-y-1">
              {rows.map((r) => (
                <label key={`${r.hubOutputPortId}-${r.atemId}-${r.atemInputName}`} className="flex items-start gap-2 text-cp-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!r.excluded}
                    onChange={(e) => setzeAusnahme(r.hubOutputPortId, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="text-cp-text">
                      {r.hubOutputName} {'→'} {r.atemName} {r.atemInputName}
                      {r.atemInput !== null ? ` (${r.atemInput})` : ''}
                    </span>
                    {r.hinweis && <span className="block text-cp-warn">{hinweisText(r.hinweis)}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 text-cp-xs">
            {status.running ? (
              <button
                type="button"
                onClick={() => void cablePlannerApi.atemLabelFollow.stop()}
                className="av-focus border border-cp-border px-2 py-1 hover:bg-cp-surface-3"
              >
                {t('labelFollow.stop', 'Stop following')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void starten()}
                disabled={!rows.some((r) => r.link && !r.excluded)}
                className="av-focus border border-cp-border px-2 py-1 hover:bg-cp-surface-3 disabled:opacity-40"
              >
                {t('labelFollow.start', 'Start following')}
              </button>
            )}
            <span className="text-cp-text-muted">
              {status.running
                ? format(t('labelFollow.running', 'running — {n} Videohub(s) connected'), {
                    n: status.hubs.filter((h) => h.connected).length,
                  })
                : t('labelFollow.stopped', 'not running')}
            </span>
          </div>
          {status.log.length > 0 && (
            <div className="mt-1 max-h-24 overflow-y-auto font-mono text-cp-xs text-cp-text-muted">
              {status.log.slice(-6).map((z, i) => (
                <div key={i}>{z}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
