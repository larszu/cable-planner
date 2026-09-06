import { useMemo } from 'react'
import { AlertTriangle, Download, Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { downloadBlob } from '../../lib/downloadBlob'
import { toCsv } from '../../lib/csv'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import {
  ROLE_TEXT,
  segmentFindings,
  segmentReachTable,
  segmentTable,
  segmentViews,
  vlansInUse,
} from '../../lib/networkSegments'
import { NETWORK_INTERFACE_ROLES, type NetworkInterfaceRole } from '../../types/network'
import type { NetworkSegment } from '../../types/networkSegment'

/**
 * BEDARF 116 — die Segmente als Gegenstand des Plans.
 *
 *   > A systems tech must reach VuNET, the mixer app, Dante Controller, Lake
 *   > Controller and Shure WWB ON SEPARATE VLANs FROM ONE MACHINE, while
 *   > keeping amp control off Dante PTP […]
 *
 * Die VLAN-Id steht seit Bedarf 19/24 an jeder Schnittstelle. Hier bekommt sie
 * einen Namen, einen Zweck und eine geplante Zeit — und erst damit lässt sich
 * fragen, ob eine Schnittstelle im richtigen Segment liegt.
 *
 * Der Knopf „VLANs aus dem Plan übernehmen" legt Datensätze für die Ids an,
 * die schon benutzt werden. Er füllt NICHT den Zweck: den kennt nur der
 * Mensch, und geraten wäre er die stille Zusage, gegen die dieser Bedarf
 * überhaupt gebaut ist.
 */
export const SegmentsPanel = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const gespeichert = useProjectStore((s) => s.project.networkSegments)
  const segments = useMemo(() => gespeichert ?? [], [gespeichert])
  const setNetworkSegments = useProjectStore((s) => s.setNetworkSegments)

  const views = useMemo(() => segmentViews(equipment, segments), [equipment, segments])
  const findings = useMemo(() => segmentFindings(equipment, segments), [equipment, segments])
  const fehlend = useMemo(
    () => vlansInUse(equipment).filter((v) => !segments.some((s) => s.vlanId === v)),
    [equipment, segments],
  )

  const patch = (vlanId: number, p: Partial<NetworkSegment>) =>
    setNetworkSegments(segments.map((s) => (s.vlanId === vlanId ? { ...s, ...p } : s)))

  const uebernehmen = () =>
    setNetworkSegments(
      [...segments, ...fehlend.map((vlanId) => ({ vlanId, name: '', purpose: 'unspecified' as const }))]
        .sort((a, b) => a.vlanId - b.vlanId),
    )

  const entfernen = (vlanId: number) =>
    setNetworkSegments(segments.filter((s) => s.vlanId !== vlanId))

  const laden = (suffix: string, table: { headers: string[]; rows: unknown[][] }) =>
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, suffix, 'csv'),
      toCsv(table.headers, table.rows as never),
      'text/csv;charset=utf-8',
    )

  const inputCls = 'rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-cp-xs'

  return (
    <div className="rounded border border-cp-border bg-cp-surface-2 p-2 text-cp-xs">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-cp-text-secondary">
          {t('segment.title', 'Segmente (VLAN, Zweck, Zeit, Weg hinein)')}
        </span>
        {fehlend.length > 0 && (
          <button
            type="button"
            onClick={uebernehmen}
            className="inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3"
          >
            <Icon icon={Plus} size="xs" />
            {format(
              t('segment.adopt', '{n} VLAN(s) aus dem Plan übernehmen'),
              { n: fehlend.length },
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => laden('segmente', segmentTable(equipment, segments))}
          className="ml-auto inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3"
        >
          <Icon icon={Download} size="xs" />
          {t('segment.export', 'Segmente')}
        </button>
        <button
          type="button"
          onClick={() => laden('segment-zugang', segmentReachTable(equipment, segments))}
          className="inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3"
        >
          <Icon icon={Download} size="xs" />
          {t('segment.exportReach', 'Wer steht wo')}
        </button>
      </div>

      <p className="mb-2 text-cp-text-muted">
        {t(
          'segment.hint',
          'Eine VLAN-Nummer allein sagt niemandem, ob Dante dort hin darf. Der Zweck wird nicht geraten — er entscheidet, welche Schnittstelle hier falsch liegt.',
        )}
      </p>

      {views.length === 0 ? (
        <p className="text-cp-text-muted">
          {t('segment.empty', 'Noch keine VLAN-Id an einer Schnittstelle vergeben.')}
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-cp-text-secondary">
              <th className="px-1 py-1">{t('segment.col.vlan', 'VLAN')}</th>
              <th className="px-1 py-1">{t('segment.col.name', 'Segment')}</th>
              <th className="px-1 py-1">{t('segment.col.purpose', 'Zweck')}</th>
              <th className="px-1 py-1">{t('segment.col.ptp', 'PTP-Domäne')}</th>
              <th className="px-1 py-1">{t('segment.col.gateway', 'Weg hinein')}</th>
              <th className="px-1 py-1">{t('segment.col.members', 'Schnittstellen')}</th>
              <th className="px-1 py-1" />
            </tr>
          </thead>
          <tbody>
            {views.map((v) => (
              <tr key={v.vlanId} className="border-t border-cp-border-muted">
                <td className="px-1 py-1 font-mono">{v.vlanId}</td>
                <td className="px-1 py-1">
                  {v.segment ? (
                    <input
                      value={v.segment.name}
                      onChange={(e) => patch(v.vlanId, { name: e.target.value })}
                      placeholder={t('segment.namePh', 'Dante Prim')}
                      className={`w-28 ${inputCls}`}
                    />
                  ) : (
                    <span className="text-cp-warn">{t('segment.notKept', 'nicht hinterlegt')}</span>
                  )}
                </td>
                <td className="px-1 py-1">
                  {v.segment && (
                    <select
                      value={v.segment.purpose}
                      onChange={(e) =>
                        patch(v.vlanId, { purpose: e.target.value as NetworkInterfaceRole })
                      }
                      className={inputCls}
                    >
                      {NETWORK_INTERFACE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`nic.role.${r}`, ROLE_TEXT[r])}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-1 py-1">
                  {v.segment && (
                    <input
                      type="number"
                      min={0}
                      max={127}
                      value={v.segment.ptpDomain ?? ''}
                      onChange={(e) => {
                        const roh = e.target.value.trim()
                        const zahl = roh === '' ? undefined : Number(roh)
                        patch(v.vlanId, {
                          ptpDomain:
                            zahl !== undefined && Number.isInteger(zahl) && zahl >= 0 && zahl <= 127
                              ? zahl
                              : undefined,
                        })
                      }}
                      className={`w-16 ${inputCls} font-mono`}
                    />
                  )}
                </td>
                <td className="px-1 py-1">
                  {v.segment && (
                    <select
                      value={v.segment.gatewayEquipmentId ?? ''}
                      onChange={(e) =>
                        patch(v.vlanId, { gatewayEquipmentId: e.target.value || undefined })
                      }
                      className={inputCls}
                    >
                      <option value="">{t('segment.noGateway', 'nur direkt am Segment')}</option>
                      {equipment.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-1 py-1 font-mono">{v.members.length}</td>
                <td className="px-1 py-1">
                  {v.segment && (
                    <button
                      type="button"
                      onClick={() => entfernen(v.vlanId)}
                      title={t('segment.remove', 'Segment-Datensatz entfernen')}
                      className="rounded border border-cp-border px-1 py-0.5 hover:bg-cp-surface-3"
                    >
                      <Icon icon={Trash2} size="xs" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {findings.length > 0 && (
        <ul className="mt-2 flex max-h-40 flex-col gap-0.5 overflow-auto">
          {findings.map((f, idx) => (
            <li
              key={`${f.kind}:${f.vlanId}:${idx}`}
              className={`flex items-start gap-1 ${
                f.severity === 'error' ? 'text-cp-danger' : 'text-cp-warn'
              }`}
            >
              <Icon icon={AlertTriangle} size="xs" />
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
