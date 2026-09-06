import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2, AlertTriangle, Radio, Eye, EyeOff, Download, Cpu, FileText, Route } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation, format } from '../../lib/i18n'
import { cablePlannerApi } from '../../lib/bridge'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { csvFromTable, stampForRows } from '../../lib/documentStamp'
import { checkDelivery, deliveryTable, deliveryTableForProject, type DeliveryIssue } from '../../lib/deliveryParity'
import { srtLatencyAdvice, uplinkBudget } from '../../lib/transportParams'
import {
  ENCODERS,
  checkEncoderFeasibility,
  runOfShowSheet,
  runOfShowSheetForProject,
  type FeasibilityFinding,
} from '../../lib/encoderFeasibility'
import {
  buildDeliveryChains,
  deliveryPathTable,
  type ChainFinding,
  type DeliveryChain,
} from '../../lib/deliveryPath'
import {
  DELIVERY_PLATFORMS,
  DEFAULT_ENCODING,
  platformByKey,
  type DeliveryDestination,
} from '../../types/delivery'

// ─────────────────────────────────────────────────────────────────────────────
// Die Ausspielung (Initiative 9). Ein Register der Ziele: Plattform, Ingest,
// Stream-Key, Encoding, Ausweichweg — plus die Pruefungen, die daran haengen.
//
// DER STREAM-KEY WIRD HIER GEZEIGT UND GESPEICHERT, ABER NIE INS PROJEKT
// GESCHRIEBEN. Er geht ueber `streamKey:*` in den OS-Schluesselbund; das
// Projekt traegt nur die Tatsache, dass einer da ist — und die wird beim
// Oeffnen NACHGEFRAGT statt aus der Datei geglaubt (`refresh` unten). Ein aus
// einer fremden Datei uebernommenes Haekchen waere genau die falsche
// Gewissheit, gegen die ADR-003 geschrieben ist.
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = 'rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-sm'

export const DeliveryDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.deliveryOpen)
  const setOpen = useUiStore((s) => s.setDeliveryOpen)
  const destinations = useProjectStore((s) => s.project.deliveryDestinations)
  const add = useProjectStore((s) => s.addDeliveryDestination)
  const update = useProjectStore((s) => s.updateDeliveryDestination)
  const remove = useProjectStore((s) => s.removeDeliveryDestination)
  const project = useProjectStore((s) => s.project)
  const projectName = project.metadata.name

  const list = useMemo(() => destinations ?? [], [destinations])
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [uplinkMbps, setUplinkMbps] = useState(50)

  // Beim Oeffnen den Schluesselbund fragen, statt der Datei zu glauben.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      for (const d of list) {
        try {
          const has = await cablePlannerApi.streamKey.has(d.id)
          if (!cancelled && has !== !!d.hasStreamKey) update(d.id, { hasStreamKey: has })
        } catch {
          /* Kein Schluesselbund (Browser ohne Storage) — dann bleibt es beim Stand. */
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // Bewusst nur an `open`: die Schleife schreibt in denselben Store, aus dem
    // `list` kommt — mit `list` in den Abhaengigkeiten liefe sie endlos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const report = useMemo(() => checkDelivery(list), [list])
  const budget = useMemo(
    () => uplinkBudget(uplinkMbps, report.primaryKbps),
    [uplinkMbps, report.primaryKbps],
  )
  // Bedarf 36: je Encoder ein eigener Befundsatz. NICHT zusammengeworfen — wer
  // vMix fährt, interessiert die OBS-Zeile nicht, und umgekehrt.
  const feasibility = useMemo(
    () => ENCODERS.map((e) => ({ encoder: e, findings: checkEncoderFeasibility(list, e) })),
    [list],
  )
  // Bedarf 32: der Weg vom Programm-Signal bis zur Plattform, abgeleitet aus
  // demselben Kabelgraph wie die Label-Ableitung. Nichts davon wird
  // gespeichert ausser dem einen Zeiger auf das Geraet.
  const chains = useMemo(() => buildDeliveryChains(project), [project])
  const chainById = useMemo(
    () => new Map<string, DeliveryChain>(chains.map((c) => [c.destinationId, c])),
    [chains],
  )
  // Die Auswahl zeigt ALLE Geraete des Plans, nicht nur die, die nach einem
  // Encoder aussehen. Es gibt keine Encoder-Kategorie im Katalog, und eine
  // geratene Filterung liesse genau das Geraet verschwinden, das jemand als
  // „Streaming-PC" oder „Sonstiges" angelegt hat.
  const encoderChoices = useMemo(
    () => [...project.equipment].sort((a, b) => a.name.localeCompare(b.name)),
    [project.equipment],
  )
  const deviceName = (id?: string): string =>
    id ? (project.equipment.find((e) => e.id === id)?.name ?? id) : ''

  if (!open) return null

  const issuesFor = (id: string): DeliveryIssue[] => report.issues.filter((i) => i.destinationId === id)

  const issueText = (i: DeliveryIssue): string => {
    switch (i.kind) {
      case 'backup-mismatch':
        return format(
          t('delivery.issue.backupMismatch', 'Backup weicht ab: {field} ist {actual}, muss {expected} sein'),
          { field: String(i.field), actual: i.actual ?? '', expected: i.expected ?? '' },
        )
      case 'backup-orphan':
        return t('delivery.issue.backupOrphan', 'Backup-Zeiger führt ins Leere')
      case 'backup-cycle':
        return t('delivery.issue.backupCycle', 'Backup-Zeiger laufen im Kreis')
      case 'no-backup':
        return t('delivery.issue.noBackup', 'Kein Ausweichweg')
      case 'missing-url':
        return t('delivery.issue.missingUrl', 'Keine Ingest-URL')
      case 'missing-key':
        return t('delivery.issue.missingKey', 'Kein Stream-Key hinterlegt')
      case 'over-platform-bitrate':
        return format(
          t('delivery.issue.overBitrate', 'Bitrate {actual} über der Plattform-Grenze {expected}'),
          { actual: i.actual ?? '', expected: i.expected ?? '' },
        )
      case 'keyframe-mismatch':
        return format(t('delivery.issue.keyframe', 'Keyframe-Abstand {actual}, verlangt ist {expected}'), {
          actual: i.actual ?? '',
          expected: i.expected ?? '',
        })
      case 'needs-port-forward':
        return t('delivery.issue.portForward', 'SRT-Listener: Portfreigabe nötig')
    }
  }

  // Ausgeschriebener switch statt `t(`delivery.enc.${f.kind}`)`: ein dynamisch
  // zusammengesetzter Schluessel ist fuer den i18n-Deckungs-Guard unsichtbar
  // und faellt im EN-Betrieb still auf den nackten Slug zurueck.
  const feasibilityText = (f: FeasibilityFinding): string => {
    switch (f.kind) {
      case 'too-many-destinations':
        return format(
          t('delivery.encoder.tooMany', '{n} gleichzeitige Ziele, das Werkzeug führt {max}'),
          { n: f.values?.[0] ?? '', max: f.values?.[1] ?? '' },
        )
      case 'per-destination-quality-unsupported':
        return t(
          'delivery.encoder.noPerDestination',
          'Der Plan verlangt je Ziel eine eigene Qualität — dieses Werkzeug sendet allen dieselbe',
        )
      case 'per-destination-quality-unknown':
        return t(
          'delivery.encoder.perDestinationUnknown',
          'Der Plan verlangt je Ziel eine eigene Qualität — ob dieses Werkzeug das kann, ist ungeklärt',
        )
      case 'must-match-differs':
        return format(
          t('delivery.encoder.mustMatch', '{field} muss über alle Ziele gleich sein, ist aber {values}'),
          { field: String(f.field ?? ''), values: (f.values ?? []).join(' / ') },
        )
    }
  }

  // Ausgeschriebener switch, aus demselben Grund wie bei `feasibilityText`:
  // ein zusammengesetzter Schluessel ist fuer den i18n-Deckungs-Guard
  // unsichtbar und faellt im EN-Betrieb still auf den nackten Slug zurueck.
  const chainFindingLabel = (f: ChainFinding): string => {
    switch (f.kind) {
      case 'no-encoder':
        return t('delivery.chain.noEncoder', 'Kein Encoder im Plan benannt')
      case 'encoder-gone':
        return t('delivery.chain.encoderGone', 'Benanntes Gerät steht nicht mehr im Plan')
      case 'encoder-unfed':
        return format(
          t('delivery.chain.encoderUnfed', '{device} hat an keinem Programm-Eingang ein Kabel'),
          { device: f.values?.[0] ?? '' },
        )
      case 'feed-ambiguous':
        return format(
          t('delivery.chain.feedAmbiguous', 'Mehrere verkabelte Programm-Eingänge: {ports}'),
          { ports: (f.values ?? []).join(' / ') },
        )
      case 'backup-shares-encoder':
        return format(
          t(
            'delivery.chain.backupSharesEncoder',
            'Backup läuft über dasselbe Gerät wie der Primärweg ({device})',
          ),
          { device: f.values?.[0] ?? '' },
        )
    }
  }

  /** Die Kette als eine Zeile. Nur was bekannt ist — kein Platzhalter, der
   *  wie eine Antwort aussieht. */
  const chainLine = (c: DeliveryChain): string => {
    const parts: string[] = []
    if (c.source) {
      parts.push(
        c.source.hops > 0
          ? `${c.source.name} ${format(t('delivery.path.hops', '(über {n})'), { n: c.source.hops })}`
          : c.source.name,
      )
    }
    if (c.encoder) parts.push(c.encoder.name)
    parts.push(c.transport)
    parts.push(c.destinationName)
    return parts.join(' → ')
  }

  const addDestination = () => {
    add({ name: t('delivery.newName', 'Neues Ziel'), platform: 'custom', encoding: { ...DEFAULT_ENCODING } })
  }

  const saveKey = async (d: DeliveryDestination) => {
    const draft = keyDraft[d.id] ?? ''
    try {
      const ok = await cablePlannerApi.streamKey.save(d.id, draft)
      update(d.id, { hasStreamKey: ok })
    } catch {
      /* ignore */
    }
    setKeyDraft((s) => ({ ...s, [d.id]: '' }))
    setRevealed((s) => ({ ...s, [d.id]: false }))
  }

  const revealKey = async (d: DeliveryDestination) => {
    if (revealed[d.id]) {
      setRevealed((s) => ({ ...s, [d.id]: false }))
      setKeyDraft((s) => ({ ...s, [d.id]: '' }))
      return
    }
    try {
      const value = await cablePlannerApi.streamKey.get(d.id)
      setKeyDraft((s) => ({ ...s, [d.id]: value ?? '' }))
    } catch {
      /* ignore */
    }
    setRevealed((s) => ({ ...s, [d.id]: true }))
  }

  // Der Stempel steht auf dem Blatt (ADR-004, Inkrement 3): eine Liste, die
  // per Mail wandert, muss sagen koennen, welchem Stand sie entspricht.
  const exportCsv = () => {
    const csv = csvFromTable(
      deliveryTable(list),
      stampForRows(project, deliveryTableForProject, new Date()),
      'ausspielung',
    )
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'ausspielung', 'csv'), csv, 'text/csv')
  }

  // Bedarf 33, der Teil ohne fremdes Schema: das Blatt, das am Showtag neben
  // dem Encoder liegt. Der Stream-Key steht darauf als VERWEIS auf den
  // Schluesselbund, nie als Wert — ein Regieplatz ist der letzte Ort dafuer.
  const exportRunOfShow = () => {
    const csv = csvFromTable(
      runOfShowSheet(list),
      stampForRows(project, runOfShowSheetForProject, new Date()),
      'ablaufblatt',
    )
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'ablaufblatt', 'csv'), csv, 'text/csv')
  }

  // Bedarf 32: das Blatt, das der Bedarf vermisst — „no artefact shows the
  // delivery path". Mit Stempel wie jede andere Liste.
  const exportPath = () => {
    const csv = csvFromTable(
      deliveryPathTable(project),
      stampForRows(project, deliveryPathTable, new Date()),
      'ausspielweg',
    )
    downloadBlob(buildExportFilenameWithSuffix(projectName, 'ausspielweg', 'csv'), csv, 'text/csv')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-cp-border bg-cp-surface-1 shadow-xl">
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-cp-base font-semibold text-cp-text">
            <Radio size={16} /> {t('delivery.title', 'Ausspielung')}
          </h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCsv} className="flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text">
              <Download size={13} /> CSV
            </button>
            <button
              type="button"
              onClick={exportRunOfShow}
              title={t('delivery.runOfShowHint', 'Ein Blatt für den Showtag — Stream-Keys stehen darauf nur als Verweis auf den Schlüsselbund')}
              className="flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
            >
              <FileText size={13} /> {t('delivery.runOfShow', 'Ablaufblatt')}
            </button>
            <button
              type="button"
              onClick={exportPath}
              title={t(
                'delivery.path.hint',
                'Der Weg vom Programm-Signal bis zur Plattform — Quelle, Encoder, Transport, Ziel',
              )}
              className="flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
            >
              <Route size={13} /> {t('delivery.path.title', 'Ausspielweg')}
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close', 'Schließen')} className="text-cp-text-muted hover:text-cp-text">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-cp-sm leading-snug text-cp-text-secondary">
            {t(
              'delivery.intro',
              'Wohin gesendet wird, mit welchen Parametern, und welcher Weg der Ausweichweg ist. Der Stream-Key liegt im Schlüsselbund des Rechners, nie in der Projektdatei — eine .avplan geht per Mail.',
            )}
          </p>

          {/* Uplink-Budget: die 40-%-Kopfraum-Regel, mit Rechnung daneben. */}
          <div className="mb-4 rounded border border-cp-border-muted bg-cp-surface-2 p-2.5">
            <div className="flex flex-wrap items-center gap-2 text-cp-sm">
              <label className="text-cp-text-secondary" htmlFor="uplink">
                {t('delivery.uplink', 'Uplink (Mbit/s)')}
              </label>
              <input
                id="uplink"
                type="number"
                min={1}
                value={uplinkMbps}
                onChange={(e) => setUplinkMbps(Math.max(1, Number(e.target.value) || 1))}
                className={`${inputCls} w-20`}
              />
              <span className={budget.fits ? 'text-cp-text-secondary' : 'text-cp-danger'}>
                {format(t('delivery.budget', '{planned} kbit/s geplant, {usable} kbit/s nutzbar'), {
                  planned: report.primaryKbps,
                  usable: budget.usable.value,
                })}
              </span>
            </div>
            <p className="mt-1 text-cp-xs text-cp-text-muted">
              {budget.usable.formula} · {budget.usable.source}
            </p>
          </div>

          {/* Bedarf 36 — kann das Werkzeug, was der Plan verlangt? Der Block
              erscheint nur, wenn es etwas zu sagen gibt: unter zwei
              Primaerwegen ist die Frage gegenstandslos, und ein Kasten, der
              dann „alles in Ordnung" meldet, verlernt sich. */}
          {feasibility.some((f) => f.findings.length > 0) && (
            <div className="mb-4 rounded border border-cp-warn/40 bg-cp-surface-2 p-2.5">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-cp-sm font-medium text-cp-text">
                <Cpu size={14} /> {t('delivery.encoder.title', 'Encoder-Machbarkeit')}
              </h3>
              <ul className="flex flex-col gap-2">
                {feasibility
                  .filter((f) => f.findings.length > 0)
                  .map(({ encoder, findings }) => (
                    <li key={encoder.id}>
                      <div className="text-cp-sm text-cp-text-secondary">{encoder.label}</div>
                      <ul className="flex flex-col gap-0.5">
                        {findings.map((f, idx) => (
                          <li
                            key={`${f.kind}-${String(f.field ?? idx)}`}
                            className="flex items-start gap-1 text-cp-xs text-cp-warn"
                          >
                            <AlertTriangle size={12} className="mt-0.5 flex-none" />
                            <span>
                              {feasibilityText(f)}
                              {/* Seit Bedarf 32 zaehlt die Pruefung je Geraet.
                                  Ohne diesen Zusatz saehen zwei Gruppen gleich
                                  aus und niemand wuesste, welche Maschine
                                  gemeint ist. */}
                              {f.deviceId && (
                                <span className="ml-1 text-cp-text-secondary">
                                  {format(t('delivery.encoder.onDevice', 'auf {device}'), {
                                    device: deviceName(f.deviceId),
                                  })}
                                </span>
                              )}
                              {/* Die Fundstelle steht dabei: ein Befund ueber
                                  fremde Software ohne Beleg ist eine Behauptung. */}
                              <span className="ml-1 text-cp-text-faint">({f.source})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {list.length === 0 ? (
            <p className="py-6 text-center text-cp-sm text-cp-text-muted">
              {t('delivery.empty', 'Noch kein Ausspielziel. Lege eins an.')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((d) => {
                const issues = issuesFor(d.id)
                const chain = chainById.get(d.id)
                const advice = d.transport === 'SRT' ? srtLatencyAdvice(d.srt?.measuredRttMs) : null
                return (
                  <li key={d.id} className="rounded border border-cp-border bg-cp-surface-2 p-2.5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        value={d.name}
                        onChange={(e) => update(d.id, { name: e.target.value })}
                        aria-label={t('delivery.col.name', 'Ziel')}
                        className={`${inputCls} min-w-[10rem] flex-1 font-medium`}
                      />
                      <select
                        value={d.platform}
                        onChange={(e) => {
                          const p = platformByKey(e.target.value)
                          update(d.id, {
                            platform: e.target.value,
                            ...(p?.transport ? { transport: p.transport } : {}),
                            ...(p?.ingestUrl ? { ingestUrl: p.ingestUrl } : {}),
                          })
                        }}
                        aria-label={t('delivery.col.platform', 'Plattform')}
                        className={inputCls}
                      >
                        {DELIVERY_PLATFORMS.map((p) => (
                          <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                      </select>
                      <select
                        value={d.transport}
                        onChange={(e) => update(d.id, { transport: e.target.value as DeliveryDestination['transport'] })}
                        aria-label={t('delivery.col.transport', 'Transport')}
                        className={inputCls}
                      >
                        <option value="RTMP">RTMP</option>
                        <option value="SRT">SRT</option>
                        <option value="HLS">HLS</option>
                      </select>
                      <select
                        value={d.encoderEquipmentId ?? ''}
                        onChange={(e) => update(d.id, { encoderEquipmentId: e.target.value || undefined })}
                        aria-label={t('delivery.path.encoder', 'Encoder im Plan')}
                        title={t(
                          'delivery.path.encoderHint',
                          'Welches Gerät des Plans dieses Ziel beliefert — daraus leitet sich der Ausspielweg ab',
                        )}
                        className={inputCls}
                      >
                        <option value="">{t('delivery.path.noEncoder', '— kein Encoder benannt —')}</option>
                        {encoderChoices.map((e) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                        {/* Ein Zeiger auf ein geloeschtes Geraet bleibt sichtbar,
                            statt still auf „kein Encoder" zu springen — sonst
                            sieht der Nutzer nie, dass da mal etwas stand. */}
                        {d.encoderEquipmentId &&
                          !encoderChoices.some((e) => e.id === d.encoderEquipmentId) && (
                            <option value={d.encoderEquipmentId}>
                              {t('delivery.path.encoderGoneOption', '(Gerät nicht mehr im Plan)')}
                            </option>
                          )}
                      </select>
                      <select
                        value={d.backupOfId ?? ''}
                        onChange={(e) => update(d.id, { backupOfId: e.target.value || undefined })}
                        aria-label={t('delivery.col.backupOf', 'Backup von')}
                        className={inputCls}
                      >
                        <option value="">{t('delivery.notABackup', '— eigener Weg —')}</option>
                        {list.filter((o) => o.id !== d.id).map((o) => (
                          <option key={o.id} value={o.id}>
                            {format(t('delivery.backupOfOption', 'Backup von {name}'), { name: o.name })}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        aria-label={t('delivery.remove', 'Ziel entfernen')}
                        title={t('delivery.removeHint', 'Entfernt das Ziel und seinen Stream-Key aus dem Schlüsselbund')}
                        className="text-cp-text-faint hover:text-cp-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        value={d.ingestUrl ?? ''}
                        onChange={(e) => update(d.id, { ingestUrl: e.target.value })}
                        placeholder={t('delivery.col.ingest', 'Ingest-URL')}
                        aria-label={t('delivery.col.ingest', 'Ingest-URL')}
                        className={`${inputCls} min-w-[14rem] flex-1`}
                      />
                      <input
                        type={revealed[d.id] ? 'text' : 'password'}
                        value={keyDraft[d.id] ?? ''}
                        onChange={(e) => setKeyDraft((s) => ({ ...s, [d.id]: e.target.value }))}
                        placeholder={
                          d.hasStreamKey
                            ? t('delivery.keyStored', 'Key hinterlegt — zum Ersetzen tippen')
                            : t('delivery.keyEmpty', 'Stream-Key')
                        }
                        aria-label={t('delivery.col.key', 'Stream-Key')}
                        className={`${inputCls} min-w-[12rem] flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => void revealKey(d)}
                        aria-label={t('delivery.reveal', 'Key anzeigen')}
                        className="text-cp-text-faint hover:text-cp-text"
                      >
                        {revealed[d.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveKey(d)}
                        className="rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                      >
                        {t('delivery.saveKey', 'Key speichern')}
                      </button>
                    </div>

                    <div className="mb-1 flex flex-wrap items-center gap-2 text-cp-sm">
                      {(
                        [
                          ['width', t('delivery.enc.width', 'Breite')],
                          ['height', t('delivery.enc.height', 'Höhe')],
                          ['fps', t('delivery.enc.fps', 'fps')],
                          ['videoBitrateKbps', t('delivery.enc.videoBitrate', 'Video kbit/s')],
                          ['keyframeSec', t('delivery.enc.keyframe', 'Keyframe s')],
                          ['audioSampleRate', t('delivery.enc.sampleRate', 'Audio Hz')],
                          ['audioBitrateKbps', t('delivery.enc.audioBitrate', 'Audio kbit/s')],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field} className="flex items-center gap-1 text-cp-text-muted">
                          {label}
                          <input
                            type="number"
                            min={1}
                            value={d.encoding[field]}
                            onChange={(e) =>
                              update(d.id, {
                                encoding: { ...d.encoding, [field]: Math.max(1, Number(e.target.value) || 1) },
                              })
                            }
                            aria-label={label}
                            className={`${inputCls} w-20`}
                          />
                        </label>
                      ))}
                      <label className="flex items-center gap-1 text-cp-text-muted">
                        {t('delivery.enc.videoCodec', 'Video-Codec')}
                        <select
                          value={d.encoding.videoCodec}
                          onChange={(e) =>
                            update(d.id, {
                              encoding: { ...d.encoding, videoCodec: e.target.value as 'H.264' | 'HEVC' | 'AV1' },
                            })
                          }
                          aria-label={t('delivery.enc.videoCodec', 'Video-Codec')}
                          className={inputCls}
                        >
                          <option>H.264</option>
                          <option>HEVC</option>
                          <option>AV1</option>
                        </select>
                      </label>
                    </div>

                    {d.transport === 'SRT' && (
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-cp-sm">
                        <label className="flex items-center gap-1 text-cp-text-muted">
                          {t('delivery.srt.mode', 'SRT-Modus')}
                          <select
                            value={d.srt?.mode ?? 'caller'}
                            onChange={(e) =>
                              update(d.id, {
                                srt: { ...(d.srt ?? {}), mode: e.target.value as 'caller' | 'listener' | 'rendezvous' },
                              })
                            }
                            aria-label={t('delivery.srt.mode', 'SRT-Modus')}
                            className={inputCls}
                          >
                            <option value="caller">caller</option>
                            <option value="listener">listener</option>
                            <option value="rendezvous">rendezvous</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1 text-cp-text-muted">
                          {t('delivery.srt.rtt', 'gemessene RTT (ms)')}
                          <input
                            type="number"
                            min={0}
                            value={d.srt?.measuredRttMs ?? ''}
                            onChange={(e) =>
                              update(d.id, {
                                srt: {
                                  ...(d.srt ?? { mode: 'caller' as const }),
                                  measuredRttMs: Number(e.target.value) || undefined,
                                },
                              })
                            }
                            aria-label={t('delivery.srt.rtt', 'gemessene RTT (ms)')}
                            className={`${inputCls} w-24`}
                          />
                        </label>
                        {advice && (
                          <div className="w-full text-cp-xs text-cp-text-muted">
                            {advice.fromRtt && (
                              <div>
                                {format(t('delivery.srt.fromRtt', 'aus RTT: {v} ms — {formula} ({source})'), {
                                  v: advice.fromRtt.value,
                                  formula: advice.fromRtt.formula,
                                  source: advice.fromRtt.source,
                                })}
                              </div>
                            )}
                            <div>
                              {format(t('delivery.srt.fixed', 'fester Praxiswert: {low}–{high} ms ({source})'), {
                                low: advice.fixed.low.value,
                                high: advice.fixed.high.value,
                                source: advice.fixed.low.source,
                              })}
                            </div>
                            {advice.disagreement && (
                              <div className="mt-0.5 text-cp-warn">{advice.disagreement}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {issues.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {issues.map((i, idx) => (
                          <li key={`${i.kind}-${String(i.field ?? idx)}`} className="flex items-start gap-1 text-cp-xs text-cp-warn">
                            <AlertTriangle size={12} className="mt-0.5 flex-none" />
                            <span>{issueText(i)}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Bedarf 32 — der Weg als eine Zeile, direkt an dem Ziel,
                        um das es geht. Ein eigener Kasten weiter oben waere
                        weiter weg von der Auswahl, die ihn bestimmt. */}
                    {chain && (
                      <div className="mt-1.5 border-t border-cp-border-muted pt-1.5">
                        <div className="flex items-start gap-1 text-cp-xs text-cp-text-muted">
                          <Route size={12} className="mt-0.5 flex-none" />
                          <span>{chainLine(chain)}</span>
                        </div>
                        {chain.findings.length > 0 && (
                          <ul className="mt-0.5 flex flex-col gap-0.5">
                            {chain.findings.map((f) => (
                              <li key={f.kind} className="flex items-start gap-1 text-cp-xs text-cp-warn">
                                <AlertTriangle size={12} className="mt-0.5 flex-none" />
                                <span>{chainFindingLabel(f)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-cp-border px-4 py-2.5">
          <button
            type="button"
            onClick={addDestination}
            className="flex items-center gap-1 rounded border border-cp-border px-2.5 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
          >
            <Plus size={14} /> {t('delivery.add', 'Ziel hinzufügen')}
          </button>
          <span className="text-cp-xs text-cp-text-muted">
            {format(t('delivery.summary', '{n} Ziele, {i} Befunde'), { n: list.length, i: report.issues.length })}
          </span>
        </div>
      </div>
    </div>
  )
}
