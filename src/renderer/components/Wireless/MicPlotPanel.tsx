import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Users, Download, CopyPlus } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useTranslation } from '../../lib/i18n'
import { unitLabel } from '../../lib/unitIdentity'
import {
  MIC_FINDING_LABEL,
  carryForward,
  micFindings,
  performerLabel,
  previousSession,
  sessionTable,
  sessionsInOrder,
} from '../../lib/micAssignment'
import { EMPTY_MIC_PLOT, type MicPlot } from '../../types/micAssignment'
import { csvFromTable } from '../../lib/documentStamp'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { downloadBlob } from '../../lib/downloadBlob'

/**
 * BEDARF 114 — wer trägt heute welche Strecke.
 *
 *   > Which pack, capsule, battery and frequency is on which person is
 *   > tracked on a paper card or in someone's head, and has to be REDONE FOR
 *   > EVERY SESSION of a run.
 *
 * Sitzt IM Funkstrecken-Dialog und nicht in einem eigenen: der Kanalplan
 * darüber ist die Quelle für Frequenz und Kapsel, und wer zuordnet, sieht
 * beides ohne Fensterwechsel. Der Bedarf beschreibt genau die Reibung, die ein
 * zweites Fenster wieder einführen würde.
 *
 * Das Kopfbild ist ein VERWEIS — siehe `types/micAssignment.ts`. Diese
 * Oberfläche zeigt den Verweis und lädt kein Bild: ein Projektfile geht per
 * Mail an Haus, Verleih und Freelancer.
 */
export const MicPlotPanel = () => {
  const t = useTranslation()
  const rig = useProjectStore((s) => s.project.wirelessRig)
  const plot = useProjectStore((s) => s.project.micPlot) ?? EMPTY_MIC_PLOT
  const setPlot = useProjectStore((s) => s.setMicPlot)
  const projectName = useProjectStore((s) => s.project.metadata.name)
  const units = useInventoryStore((s) => s.units)

  const counter = useRef(0)
  const nextId = (p: string) => `${p}${Date.now().toString(36)}-${counter.current++}`

  // Der Stichtag kommt EINMAL aus der Uhr und wird durchgereicht — sonst
  // beantwortet dieselbe Zeile in zwei Zellen zwei verschiedene Zeitpunkte.
  const jetzt = new Date().toISOString()

  const sessions = useMemo(() => sessionsInOrder(plot), [plot])
  const [sessionId, setSessionId] = useState<string>('')
  const aktuelle = sessions.find((s) => s.id === sessionId) ?? sessions[0]

  const packLabelOf = useMemo(
    () => (unitId: string) => {
      const u = units.find((x) => x.id === unitId)
      // Bedarf 107 — die Haus-Sicht: der Lagerist ruft die Hausreferenz.
      return u ? unitLabel(u, 'house') : t('micPlot.packGone', 'Einheit entfernt')
    },
    [units, t],
  )

  const befunde = useMemo(
    () => (aktuelle ? micFindings(plot, rig, aktuelle.id) : []),
    [plot, rig, aktuelle],
  )
  const zuordnungen = useMemo(
    () => (aktuelle ? plot.assignments.filter((a) => a.sessionId === aktuelle.id) : []),
    [plot, aktuelle],
  )

  const commit = (next: MicPlot) => setPlot(next)

  const addSession = () => {
    const id = nextId('ms')
    commit({
      ...plot,
      sessions: [...plot.sessions, { id, label: `${t('micPlot.session', 'Session')} ${plot.sessions.length + 1}` }],
    })
    setSessionId(id)
  }

  const addPerformer = () => {
    if (!aktuelle || !rig?.channels[0]) return
    const id = nextId('mp')
    // EIN commit, nicht zwei: zwei Aufrufe rechnen beide auf demselben alten
    // `plot`, und der zweite wirft den ersten weg.
    commit({
      ...plot,
      performers: [...plot.performers, { id }],
      assignments: [
        ...plot.assignments,
        { sessionId: aktuelle.id, performerId: id, channelId: rig.channels[0].id, origin: 'manual' },
      ],
    })
  }

  const uebernehmen = () => {
    if (!aktuelle) return
    const vorige = previousSession(plot, aktuelle.id)
    if (!vorige) return
    const neu = carryForward(plot, vorige.id, aktuelle.id)
    if (neu.length === 0) return
    commit({ ...plot, assignments: [...plot.assignments, ...neu] })
  }

  const exportieren = () => {
    if (!aktuelle) return
    downloadBlob(
      buildExportFilenameWithSuffix(projectName || 'cable-planner', 'mic-plot', 'csv'),
      csvFromTable(sessionTable(plot, rig, aktuelle.id, jetzt, packLabelOf)),
      'text/csv;charset=utf-8',
    )
  }

  const inputCls =
    'rounded border border-cp-border bg-cp-surface-1 px-1.5 py-1 text-cp-xs text-cp-text'

  const vorige = aktuelle ? previousSession(plot, aktuelle.id) : undefined

  return (
    <div className="mt-4 border-t border-cp-border-muted pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-secondary">
          <Users size={13} /> {t('micPlot.title', 'Mic-Plot — wer trägt welche Strecke')}
        </span>
        <select
          value={aktuelle?.id ?? ''}
          onChange={(e) => setSessionId(e.target.value)}
          aria-label={t('micPlot.session', 'Session')}
          className={inputCls}
        >
          {sessions.length === 0 && <option value="">{t('micPlot.noSession', '— keine Session —')}</option>}
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {[s.date, s.label].filter(Boolean).join(' · ') || s.id}
            </option>
          ))}
        </select>
        <button type="button" onClick={addSession} className="rounded bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4">
          <Plus size={12} className="mr-1 inline" />
          {t('micPlot.addSession', 'Session')}
        </button>
        {/* BEDARF 114 — die Arbeit, die der Beleg beschreibt: „has to be redone
            for every session of a run". Übernommen wird, was übernehmbar ist;
            jede Zeile trägt danach „übernommen" und nicht „bestätigt". */}
        <button
          type="button"
          onClick={uebernehmen}
          disabled={!vorige}
          title={t(
            'micPlot.carryHint',
            'Die Zuordnungen der vorigen Session als Vorschlag übernehmen. Der Akku-Zeitpunkt wird NICHT übernommen — der von gestern ist der einzige Wert, der mit Sicherheit falsch ist.',
          )}
          className="rounded bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4 disabled:opacity-40"
        >
          <CopyPlus size={12} className="mr-1 inline" />
          {t('micPlot.carry', 'Aus voriger übernehmen')}
        </button>
        <button
          type="button"
          onClick={exportieren}
          disabled={!aktuelle || zuordnungen.length === 0}
          className="rounded bg-purple-700 px-2 py-1 text-cp-xs hover:bg-purple-600 disabled:opacity-40"
        >
          <Download size={12} className="mr-1 inline" />
          {t('micPlot.export', 'Session-Blatt')}
        </button>
      </div>

      {/* BEDARF 114 — was an den Zuordnungen nicht stimmt. Steht ÜBER der
          Liste: eine Doppelbelegung fällt sonst erst auf, wenn jemand
          spricht. */}
      {befunde.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1 text-cp-xs">
          {befunde.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="text-amber-300/90">
              <strong>{MIC_FINDING_LABEL[f.kind]}</strong> — {f.text}
            </li>
          ))}
        </ul>
      )}

      {!aktuelle ? (
        <p className="text-cp-xs text-cp-text-muted">
          {t(
            'micPlot.empty',
            'Noch keine Session. Der Kanalplan oben gehört der Produktion; wer welche Strecke trägt, ändert sich je Vorstellung — dafür ist dieser Abschnitt.',
          )}
        </p>
      ) : (
        <>
          <table className="w-full text-cp-xs">
            <thead className="text-cp-text-secondary">
              <tr>
                <th className="px-2 py-1 text-left">{t('micPlot.person', 'Person')}</th>
                <th className="px-2 py-1 text-left">{t('micPlot.role', 'Funktion')}</th>
                <th className="px-2 py-1 text-left">{t('micPlot.channel', 'Kanal')}</th>
                <th className="px-2 py-1 text-left">{t('micPlot.pack', 'Sender')}</th>
                <th className="px-2 py-1 text-left">{t('micPlot.battery', 'Akku eingelegt')}</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {zuordnungen.map((a) => {
                const p = plot.performers.find((x) => x.id === a.performerId)
                const patch = (next: Partial<typeof a>) =>
                  commit({
                    ...plot,
                    assignments: plot.assignments.map((x) =>
                      x.sessionId === a.sessionId && x.performerId === a.performerId ? { ...x, ...next } : x,
                    ),
                  })
                const patchPerson = (next: { name?: string; role?: string }) =>
                  commit({
                    ...plot,
                    performers: plot.performers.map((x) => (x.id === p?.id ? { ...x, ...next } : x)),
                  })
                return (
                  <tr key={`${a.sessionId}-${a.performerId}`} className="border-t border-cp-border-muted">
                    <td className="px-2 py-1">
                      <input
                        value={p?.name ?? ''}
                        onChange={(e) => patchPerson({ name: e.target.value })}
                        placeholder={performerLabel(p)}
                        className={`${inputCls} w-36`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={p?.role ?? ''}
                        onChange={(e) => patchPerson({ role: e.target.value })}
                        placeholder={t('micPlot.rolePh', 'z. B. Moderation')}
                        className={`${inputCls} w-32`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        value={a.channelId}
                        onChange={(e) => patch({ channelId: e.target.value })}
                        className={inputCls}
                      >
                        {/* Ein Kanal, den der Rig-Plan nicht mehr führt, bleibt
                            sichtbar — still auf einen anderen zu springen wäre
                            eine stumme Umbuchung. */}
                        {!rig?.channels.some((c) => c.id === a.channelId) && (
                          <option value={a.channelId}>{t('micPlot.channelGone', 'Kanal entfernt')}</option>
                        )}
                        {(rig?.channels ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                            {c.frequencyMhz != null ? ` · ${c.frequencyMhz} MHz` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select
                        value={a.packUnitId ?? ''}
                        onChange={(e) => patch({ packUnitId: e.target.value || undefined })}
                        className={inputCls}
                      >
                        <option value="">{t('micPlot.packNone', '— nicht benannt —')}</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {unitLabel(u, 'house')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      {/* Kein „voll"-Haken: der sagt nichts über die
                          Restlaufzeit, und ein Haken, den niemand widerlegen
                          kann, wird geglaubt. */}
                      <button
                        type="button"
                        onClick={() => patch({ batteryFittedAt: new Date().toISOString() })}
                        className="rounded bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4"
                      >
                        {a.batteryFittedAt
                          ? new Date(a.batteryFittedAt).toLocaleTimeString()
                          : t('micPlot.batterySet', 'jetzt')}
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() =>
                          commit({
                            ...plot,
                            assignments: plot.assignments.filter(
                              (x) => !(x.sessionId === a.sessionId && x.performerId === a.performerId),
                            ),
                          })
                        }
                        className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300"
                        title={t('common.delete', 'Löschen')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addPerformer}
            disabled={!rig?.channels.length}
            title={
              rig?.channels.length
                ? undefined
                : t('micPlot.needChannel', 'Erst einen Kanal im Rig-Plan anlegen — die Zuordnung zeigt auf ihn.')
            }
            className="mt-2 rounded bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4 disabled:opacity-40"
          >
            <Plus size={12} className="mr-1 inline" />
            {t('micPlot.addPerson', 'Person')}
          </button>
        </>
      )}
    </div>
  )
}
