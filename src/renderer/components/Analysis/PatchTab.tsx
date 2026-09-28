import { useMemo, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { PanelHint } from '../shared/PanelHint'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { csvFromTable } from '../../lib/documentStamp'
import {
  STAGE_LABEL,
  TRACE_END_LABEL,
  TRACE_SOURCE_LABEL,
  buildPortTrace,
  portTraceTable,
  type PortTraceRow,
} from '../../lib/portTrace'

/**
 * Die Anschlussliste — Anzeige-Haelfte zur Nutzer-Frage vom 2026-09-23:
 * welches Geraet haengt auf welchem Kabel an welchem Patchfeld und von dort
 * auf welchem Port welches Switches.
 *
 * WAS HIER GERECHNET WIRD: nichts. `portTrace.ts` laeuft den Kabelgraphen und
 * setzt die Zeile zusammen; diese Datei stellt sie dar. Auch das Ende kommt
 * von dort — ob eine Zeile am Switch ankommt oder ob die Verfolgung aufgegeben
 * hat, sieht man sonst nicht auseinander, und es bedeutet das Gegenteil.
 *
 * GRUPPIERT NACH SWITCH und nicht nach Geraet: wer diese Liste braucht, steht
 * vor einem Rack und hat EINEN Switch vor sich. Die Geraete-Sicht gibt es
 * schon — sie heisst Eigenschaften-Leiste.
 */

const ENDE_TON: Readonly<Record<PortTraceRow['end'], string>> = {
  switch: 'text-cp-text-muted',
  'nicht-verkabelt': 'text-cp-warn',
  'anderes-gerät': 'text-cp-text-muted',
  mehrdeutig: 'text-cp-warn',
  'zu-lang': 'text-cp-warn',
  schleife: 'text-cp-danger',
  'ohne-kabel': 'text-cp-text-faint',
}

/** Der Weg als Kette von Kaestchen — dieselbe Leseform wie im Reiter
 *  „Signalwege", damit niemand zwei Darstellungen derselben Sache lernt. */
const Weg = ({ row }: { row: PortTraceRow }) => (
  <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
    <span className="text-cp-text-muted">{row.devicePort ?? '—'}</span>
    {row.stages.map((s) => (
      <span key={s.cableId} className="flex items-baseline gap-1">
        <span className="text-cp-text-faint">&ndash;[{s.cableLabel}]&rarr;</span>
        <span className="text-cp-text-secondary">{s.deviceName}</span>
        <span className="text-cp-text-muted">
          {s.inPort}/{s.outPort}
        </span>
        <span className="bg-cp-surface-3 px-1 text-cp-text-faint">{STAGE_LABEL[s.kind]}</span>
      </span>
    ))}
    {row.switchPort && (
      <span className="flex items-baseline gap-1">
        <span className="text-cp-text-faint">
          &ndash;[{(row.stages.length > 0 ? row.lastCableLabel : row.firstCableLabel) ?? '?'}]&rarr;
        </span>
        <span className="font-medium text-cp-text">{row.switchPort}</span>
      </span>
    )}
  </div>
)

export const PatchTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const segments = useProjectStore((s) => s.project.networkSegments)

  const [suche, setSuche] = useState('')
  const [nurOffene, setNurOffene] = useState(false)

  const alle = useMemo(
    () => buildPortTrace(equipment, cables, segments ?? []),
    [equipment, cables, segments],
  )

  const gezeigt = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return alle.filter((r) => {
      if (nurOffene && r.end === 'switch' && !r.conflict) return false
      if (!q) return true
      return [
        r.deviceName,
        r.ipAddress,
        r.macAddress,
        r.switchName,
        r.switchPort,
        r.nicLabel,
        r.segmentName,
        r.firstCableLabel,
        ...r.stages.map((s) => s.deviceName),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [alle, suche, nurOffene])

  /** Nach Switch gebuendelt. Zeilen ohne Switch bekommen einen eigenen Block
   *  und stehen hinten — sie sind die offenen Punkte, nicht der Anfang. */
  const gruppen = useMemo(() => {
    const m = new Map<string, { titel: string; rows: PortTraceRow[] }>()
    for (const r of gezeigt) {
      const key = r.switchId ?? ''
      const vorhanden = m.get(key)
      if (vorhanden) vorhanden.rows.push(r)
      else m.set(key, { titel: r.switchName ?? '', rows: [r] })
    }
    return [...m.values()]
  }, [gezeigt])

  const offen = alle.filter((r) => r.end !== 'switch' || r.conflict).length

  const exportCsv = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'anschlussliste', 'csv'),
      csvFromTable(portTraceTable(gezeigt)),
      'text/csv',
    )
  }

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <PanelHint
        className="mb-2 text-cp-xs text-[var(--cp-text-muted)]"
        text={t(
          'analysis.patch.intro',
          'One row per network interface: from the device port, along the cable, through every patch panel with both its port numbers, into the switch port — with IP, subnet, VLAN and MAC beside it. The path is walked through the cables; a switch port typed into the network form by hand is shown as its own source, and where the two disagree the contradiction stays visible.',
        )}
      />

      {alle.length === 0 ? (
        <p className="text-cp-xs text-[var(--cp-text-muted)]">
          {t(
            'analysis.patch.none',
            'Nothing to trace: this plan holds no device with a network interface or a cable leading to a switch.',
          )}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t('analysis.patch.search', 'Device, IP, switch, patch panel …')}
              className="min-w-48 flex-1 border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text"
            />
            <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary">
              <input
                type="checkbox"
                checked={nurOffene}
                onChange={(e) => setNurOffene(e.target.checked)}
              />
              {t('analysis.patch.onlyOpen', 'Only open ones')}
            </label>
            <button
              type="button"
              onClick={exportCsv}
              className="border border-cp-border px-2 py-1 text-cp-xs text-cp-text-secondary hover:text-cp-text"
            >
              CSV
            </button>
          </div>

          <p className="text-cp-xs text-cp-text-secondary">
            {format(t('analysis.patch.count', '{gezeigt} of {alle} connections'), {
              gezeigt: gezeigt.length,
              alle: alle.length,
            })}
            {offen > 0 && (
              <span className="text-cp-warn">
                {' '}
                &middot;{' '}
                {format(t('analysis.patch.openCount', '{n} without a reached switch port'), {
                  n: offen,
                })}
              </span>
            )}
          </p>

          {gruppen.map((g) => (
            <div key={g.titel || 'ohne'} className="space-y-1">
              <h4 className="text-cp-xs font-semibold text-cp-text">
                {g.titel || t('analysis.patch.noSwitch', 'Without a reached switch')}
                <span className="ml-2 font-normal text-cp-text-muted">{g.rows.length}</span>
              </h4>
              <table className="block w-full overflow-x-auto text-cp-xs">
                <thead>
                  <tr className="border-b border-[var(--cp-border)] text-left text-[var(--cp-text-muted)]">
                    <th className="py-1 pr-2">{t('analysis.patch.device', 'Device')}</th>
                    <th className="py-1 pr-2">{t('analysis.patch.nic', 'Interface')}</th>
                    <th className="py-1 pr-2">IP</th>
                    <th className="py-1 pr-2">VLAN</th>
                    <th className="py-1 pr-2">{t('analysis.patch.path', 'Path')}</th>
                    <th className="py-1 pr-2">{t('analysis.patch.switchPort', 'Switch port')}</th>
                    <th className="py-1">{t('analysis.patch.source', 'Source')}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.key} className="border-b border-[var(--cp-border-muted)] align-top">
                      <td className="py-1 pr-2">
                        <span className="text-cp-text">{r.deviceName}</span>
                        {r.rack && (
                          <span className="ml-1 text-cp-text-faint">{r.rack}</span>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-cp-text-secondary">
                        {r.nicLabel ?? (r.nicId ? r.role : '—')}
                      </td>
                      <td className="py-1 pr-2 text-cp-text-secondary">
                        {r.cidr ?? r.ipAddress ?? '—'}
                      </td>
                      <td className="py-1 pr-2 text-cp-text-secondary">
                        {r.vlanId ?? '—'}
                        {r.segmentName && (
                          <span className="ml-1 text-cp-text-faint">{r.segmentName}</span>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        <Weg row={r} />
                        {r.end !== 'switch' && (
                          <div className={`mt-0.5 ${ENDE_TON[r.end]}`}>{r.endNote}</div>
                        )}
                        {r.conflict && <div className="mt-0.5 text-cp-warn">{r.conflict}</div>}
                      </td>
                      <td className="py-1 pr-2">
                        {r.switchPort ? (
                          <span className="font-medium text-cp-text">{r.switchPort}</span>
                        ) : (
                          <span className={ENDE_TON[r.end]}>{TRACE_END_LABEL[r.end]}</span>
                        )}
                      </td>
                      <td className="py-1 text-cp-text-faint">{TRACE_SOURCE_LABEL[r.source]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
