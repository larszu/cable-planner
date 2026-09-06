import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Lightbulb } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { downloadBlob } from '../../lib/downloadBlob'
import { toCsv } from '../../lib/csv'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import {
  TALLY_VERDICT_LABEL,
  buildTallyCheck,
  lastCheck,
  preShowTallyTable,
  tallyPositionFindings,
  tallyVerdict,
} from '../../lib/tallyPosition'
import {
  TALLY_OBSERVATION_LABEL,
  TALLY_TRANSPORT_LABEL,
  type TallyObservation,
  type TallyTransport,
} from '../../types/tallyPosition'

/**
 * BEDARF 105 — die Vor-Show-Liste fuer das Tally.
 *
 *   > Tally is trusted until it lies; software tally over NDI/TSL misreports,
 *   > blinks, or needs port workarounds […]
 *
 * Die Karte darueber sagt, WAS der Plan ableitet (Rolle → Eingang → Adresse).
 * Diese Haelfte sagt, was NIEMAND ableiten kann: ueber welchen Weg das Tally
 * an den Platz kommt, wo die Lampe sitzt, und was jemand beim Hinsehen
 * gesehen hat.
 *
 * Der Knopf heisst „gesehen", nicht „in Ordnung". Er schreibt eine
 * Beobachtung mit Zeitstempel — die Uhr wird hier genommen, weil hier die
 * Beobachtung gemacht wird; `lib/tallyPosition.ts` bleibt rein.
 */

const TRANSPORTS: TallyTransport[] = ['tsl-umd-v31', 'gpio', 'ndi', 'switcher-native', 'unknown']
const OBSERVATIONS: TallyObservation[] = [
  'not-checked',
  'red',
  'green',
  'off',
  'blinking',
  'wrong-colour',
  'wrong-position',
]

export const TallyPreShowPanel = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const setTallyPosition = useProjectStore((s) => s.setTallyPosition)
  const recordTallyCheck = useProjectStore((s) => s.recordTallyCheck)

  const rollen = useMemo(() => project.sourceIdentities ?? [], [project.sourceIdentities])
  const positionen = useMemo(() => project.tallyPositions ?? [], [project.tallyPositions])
  const byId = useMemo(
    () => new Map(positionen.map((p) => [p.identityId, p])),
    [positionen],
  )

  const befunde = useMemo(
    () => tallyPositionFindings(rollen, positionen),
    [rollen, positionen],
  )

  // Der Entwurf der Beobachtung steht je Rolle, bis jemand „gesehen" drueckt.
  // Ein Dropdown, das sofort schreibt, legte beim Durchklicken drei
  // Beobachtungen ins Protokoll — und das Protokoll ist genau das, woran man
  // spaeter „gestern ging es" abliest.
  const [entwurf, setEntwurf] = useState<
    Record<string, { onProgram: TallyObservation; onPreview: TallyObservation }>
  >({})
  const entwurfVon = (id: string) =>
    entwurf[id] ?? { onProgram: 'not-checked' as TallyObservation, onPreview: 'not-checked' as TallyObservation }

  const festhalten = (id: string) => {
    const e = entwurfVon(id)
    if (e.onProgram === 'not-checked' && e.onPreview === 'not-checked') return
    recordTallyCheck(id, buildTallyCheck(new Date().toISOString(), e.onProgram, e.onPreview))
    setEntwurf((v) => {
      const { [id]: _weg, ...rest } = v
      return rest
    })
  }

  const listeLaden = () => {
    const table = preShowTallyTable(rollen, positionen)
    downloadBlob(
      buildExportFilenameWithSuffix(project.metadata?.name, 'tally-vorshow', 'csv'),
      toCsv(table.headers, table.rows),
      'text/csv;charset=utf-8',
    )
  }

  const selectCls = 'rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-cp-xs'

  if (rollen.length === 0) return null

  return (
    <div className="flex shrink-0 flex-col gap-2 rounded border border-cp-border bg-cp-surface-2 p-2">
      <div className="flex items-center gap-2">
        <Icon icon={Lightbulb} size="xs" />
        <span className="text-cp-xs font-semibold text-cp-text-secondary">
          {t('tallyPos.title', 'Vor-Show-Prüfung: Weg, Lampe, und was zu sehen war')}
        </span>
        <button
          type="button"
          onClick={listeLaden}
          className="ml-auto inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 text-cp-xs hover:bg-cp-surface-3"
        >
          <Icon icon={Download} size="xs" />
          {t('tallyPos.export', 'Vor-Show-Liste')}
        </button>
      </div>

      <p className="text-cp-xs text-cp-text-muted">
        {t(
          'tallyPos.hint',
          'Der Plan sagt nie, dass ein Tally funktioniert — er hält fest, was jemand gesehen hat, und wann. Eine Position ohne Prüfung heißt „nicht geprüft", nicht „in Ordnung".',
        )}
      </p>

      <div className="overflow-auto">
        <table className="w-full border-collapse text-cp-xs">
          <thead>
            <tr className="text-left text-cp-text-secondary">
              <th className="px-1 py-1">{t('tallyPos.col.role', 'Position')}</th>
              <th className="px-1 py-1">{t('tallyPos.col.transport', 'Weg')}</th>
              <th className="px-1 py-1">{t('tallyPos.col.endpoint', 'Adresse')}</th>
              <th className="px-1 py-1">{t('tallyPos.col.lamp', 'Lampe')}</th>
              <th className="px-1 py-1">{t('tallyPos.col.program', 'Programm')}</th>
              <th className="px-1 py-1">{t('tallyPos.col.preview', 'Vorschau')}</th>
              <th className="px-1 py-1">{t('tallyPos.col.verdict', 'Zuletzt')}</th>
              <th className="px-1 py-1" />
            </tr>
          </thead>
          <tbody>
            {rollen.map((rolle) => {
              const pos = byId.get(rolle.id)
              const e = entwurfVon(rolle.id)
              const urteil = tallyVerdict(pos)
              const check = lastCheck(pos)
              return (
                <tr key={rolle.id} className="border-t border-cp-border-muted">
                  <td className="px-1 py-1">{rolle.name}</td>
                  <td className="px-1 py-1">
                    <select
                      value={pos?.transport ?? 'unknown'}
                      onChange={(ev) =>
                        setTallyPosition(rolle.id, { transport: ev.target.value as TallyTransport })
                      }
                      className={selectCls}
                    >
                      {TRANSPORTS.map((w) => (
                        <option key={w} value={w}>
                          {t(`tallyPos.transport.${w}`, TALLY_TRANSPORT_LABEL[w])}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      value={pos?.endpoint ?? ''}
                      onChange={(ev) => setTallyPosition(rolle.id, { endpoint: ev.target.value })}
                      placeholder={t('tallyPos.endpointPh', 'IP / Pin / Quelle')}
                      className="w-28 rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 font-mono"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      value={pos?.lamp ?? ''}
                      onChange={(ev) => setTallyPosition(rolle.id, { lamp: ev.target.value })}
                      placeholder={t('tallyPos.lampPh', 'Kamerakopf')}
                      className="w-28 rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={e.onProgram}
                      onChange={(ev) =>
                        setEntwurf((v) => ({
                          ...v,
                          [rolle.id]: { ...e, onProgram: ev.target.value as TallyObservation },
                        }))
                      }
                      className={selectCls}
                    >
                      {OBSERVATIONS.map((o) => (
                        <option key={o} value={o}>
                          {t(`tallyPos.obs.${o}`, TALLY_OBSERVATION_LABEL[o])}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={e.onPreview}
                      onChange={(ev) =>
                        setEntwurf((v) => ({
                          ...v,
                          [rolle.id]: { ...e, onPreview: ev.target.value as TallyObservation },
                        }))
                      }
                      className={selectCls}
                    >
                      {OBSERVATIONS.map((o) => (
                        <option key={o} value={o}>
                          {t(`tallyPos.obs.${o}`, TALLY_OBSERVATION_LABEL[o])}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className={`px-1 py-1 ${
                      urteil === 'lying' || urteil === 'dark'
                        ? 'text-cp-danger'
                        : urteil === 'unchecked'
                          ? 'text-cp-warn'
                          : 'text-cp-text-secondary'
                    }`}
                  >
                    {t(`tallyPos.verdict.${urteil}`, TALLY_VERDICT_LABEL[urteil])}
                    {check ? ` · ${check.at.slice(0, 10)}` : ''}
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => festhalten(rolle.id)}
                      disabled={e.onProgram === 'not-checked' && e.onPreview === 'not-checked'}
                      className="rounded bg-emerald-700 px-2 py-0.5 hover:bg-emerald-600 disabled:opacity-40"
                    >
                      {t('tallyPos.record', 'gesehen')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {befunde.length > 0 && (
        <ul className="flex max-h-32 flex-col gap-0.5 overflow-auto text-cp-xs">
          {befunde.map((b, idx) => (
            <li
              key={`${b.kind}:${b.subject}:${idx}`}
              className={`flex items-start gap-1 ${
                b.severity === 'error' ? 'text-cp-danger' : 'text-cp-warn'
              }`}
            >
              <Icon icon={AlertTriangle} size="xs" />
              <span>{b.message}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-cp-xs text-cp-text-faint">
        {format(
          t('tallyPos.count', '{checked} von {total} Positionen geprüft.'),
          {
            checked: rollen.filter((r) => tallyVerdict(byId.get(r.id)) !== 'unchecked').length,
            total: rollen.length,
          },
        )}
      </p>
    </div>
  )
}
