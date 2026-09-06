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
  ARCHIVE_FINDING_LABEL,
  archiveFindingText,
  archiveTable,
  assessArchive,
} from '../../lib/archiveIsolation'
import {
  FALLBACK_FINDING_LABEL,
  assessFallback,
  fallbackSkeleton,
  fallbackTable,
} from '../../lib/fallbackPlan'
import type { FallbackRule } from '../../types/fallback'
import {
  EVENT_METADATA_FINDING_LABEL,
  assessEventMetadata,
  eventMetadataTable,
} from '../../lib/eventMetadata'
import {
  TRANSMISSION_FINDING_LABEL,
  assessTransmission,
  transmissionRecordTable,
} from '../../lib/transmissionRecord'
import {
  TRANSMISSION_EVENT_LABEL,
  TRANSMISSION_SOURCE_LABEL,
  type TransmissionEvent,
  type TransmissionEventKind,
  type TransmissionSource,
} from '../../types/transmissionRecord'
import { JOB_BASIS_LABEL } from '../../lib/jobHandover'
import type {
  DestinationMetadataOverride,
  EventMetadata,
  EventPrivacy,
} from '../../types/eventMetadata'
import {
  DELIVERY_PLATFORMS,
  DEFAULT_ENCODING,
  platformByKey,
  type ArchiveAnswer,
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
  const setArchive = useProjectStore((s) => s.setArchiveRecording)
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
  // BEDARF 90 — die Archiv-Aufzeichnung. Sie gehoert hierher und nicht in die
  // Analyse: die Frage entsteht erst, wenn es eine Ausspielung gibt, die sie
  // mitreissen koennte, und sie wird an derselben Stelle beantwortet, an der
  // die Encoder benannt werden.
  const archive = useMemo(() => assessArchive(project), [project])
  // BEDARF 89 — das Sicherheitsnetz. Auch hier: die Frage entsteht erst, wenn
  // es eine Ausspielung gibt, die geschuetzt werden koennte.
  const setFallbackPlan = useProjectStore((s) => s.setFallbackPlan)
  // BEDARF 88 — die Veranstaltungsangaben. Wie ueberall in diesem Dialog:
  // die Bewertung ist die Engstelle, die Oberflaeche liest nur ab.
  const setEventMetadata = useProjectStore((s) => s.setEventMetadata)
  const meta = useMemo(() => assessEventMetadata(project), [project])
  // BEDARF 87 — der Sendebericht. Auch hier: die Bewertung ist die Engstelle.
  const setTransmissionRecord = useProjectStore((s) => s.setTransmissionRecord)
  const sendung = useMemo(() => assessTransmission(project), [project])
  const fallback = useMemo(() => assessFallback(project), [project])
  const [sceneDraft, setSceneDraft] = useState('')
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

  // BEDARF 90 — das Archiv-Blatt. Klein, aber ein Beleg: „wir haben gefragt,
  // und das war die Antwort" ist genau das, was nach dem Abbau fehlt.
  const exportArchive = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'archiv-aufzeichnung', 'csv'),
      csvFromTable(archiveTable(archive)),
      'text/csv',
    )
  }

  // Ein Setter fuer den ganzen Plan (siehe metaSlice): Szenenliste, Waechter
  // und Regeln haengen aneinander.
  const patchFallback = (patch: Partial<typeof fallback.plan>) =>
    setFallbackPlan({ ...fallback.plan, ...patch })

  const addRule = (destinationId: string) => {
    const id = `fb-${destinationId}`
    if (fallback.plan.rules.some((r) => r.id === id)) return
    patchFallback({ rules: [...fallback.plan.rules, { id, destinationId }] })
  }
  const patchRule = (id: string, patch: Partial<FallbackRule>) =>
    patchFallback({
      rules: fallback.plan.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })
  const removeRule = (id: string) =>
    patchFallback({ rules: fallback.plan.rules.filter((r) => r.id !== id) })

  // Die Szenenliste wird EINGEFUEGT, nicht gelesen: der Planer oeffnet keine
  // Szenensammlung. Zeilen- oder kommagetrennt, weil beides aus einem
  // Encoder-Fenster kommt.
  const applyScenes = () => {
    const namen = [
      ...new Set(
        sceneDraft
          .split(/[\n,;]+/)
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ]
    if (!namen.length) return
    patchFallback({ scenes: namen })
    setSceneDraft('')
  }

  const patchEvent = (patch: Partial<EventMetadata>) => {
    const event: EventMetadata = { ...meta.plan.event, ...patch }
    // Leere Schlagwortlisten wieder loswerden, damit `normaliseEventMetadata`
    // das Objekt als leer erkennen und ganz verwerfen kann.
    if (event.tags && event.tags.length === 0) delete event.tags
    setEventMetadata({ event, overrides: meta.plan.overrides })
  }

  const overrideOf = (destinationId: string): DestinationMetadataOverride | undefined =>
    meta.plan.overrides.find((o) => o.destinationId === destinationId)

  /**
   * Eine Abweichung setzen — und sie wieder ENTFERNEN, wenn nichts mehr drin
   * steht. Ein leerer Ueberschreiber traegt sonst dauerhaft den Befund
   * `override-inert`, nur weil jemand einmal ins Feld getippt und es wieder
   * geleert hat.
   */
  const patchOverride = (destinationId: string, patch: Partial<DestinationMetadataOverride>) => {
    const current = overrideOf(destinationId) ?? { destinationId }
    const next: DestinationMetadataOverride = { ...current, ...patch, destinationId }
    const leer = !next.title && !next.description && !next.privacy && !next.reason
    const rest = meta.plan.overrides.filter((o) => o.destinationId !== destinationId)
    setEventMetadata({
      event: meta.plan.event,
      overrides: leer ? rest : [...rest, next],
    })
  }

  const exportEventMetadata = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'event-metadaten', 'csv'),
      csvFromTable(eventMetadataTable(project)),
      'text/csv',
    )
  }

  const patchRecord = (events: TransmissionEvent[], summary?: string) => {
    const naechste = summary === undefined ? sendung.record.summary : summary
    const leer = events.length === 0 && !(naechste ?? '').trim()
    setTransmissionRecord(
      leer ? undefined : { events, ...(naechste?.trim() ? { summary: naechste } : {}) },
    )
  }

  /**
   * Einen Eintrag anlegen — mit LEEREM Zeitpunkt.
   *
   * Die Anwendung setzt hier bewusst keine Uhrzeit: ein Bericht, dessen Zeiten
   * die Anwendung vergibt, saehe aus, als haette sie zugesehen. Den Zeitpunkt
   * traegt der Mensch ein, der dabei war.
   */
  const addTransmissionEvent = () => {
    patchRecord([
      ...sendung.events,
      { id: crypto.randomUUID(), at: '', kind: 'note', text: '', source: 'unstated' },
    ])
  }

  const patchTransmissionEvent = (id: string, patch: Partial<TransmissionEvent>) =>
    patchRecord(sendung.events.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  const removeTransmissionEvent = (id: string) =>
    patchRecord(sendung.events.filter((e) => e.id !== id))

  const exportTransmission = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'sendebericht', 'csv'),
      csvFromTable(transmissionRecordTable(project)),
      'text/csv',
    )
  }

  const exportFallback = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'ausweich-plan', 'csv'),
      csvFromTable(fallbackTable(project)),
      'text/csv',
    )
  }
  const exportSkeleton = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'ausweich-geruest', 'json'),
      fallbackSkeleton(project),
      'application/json',
    )
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

          {/* BEDARF 90 — die Archiv-Aufzeichnung. Nur sichtbar, wenn es
              überhaupt ein Ausspielziel gibt: ohne Übertragung gibt es nichts,
              was die Aufzeichnung mitreißen könnte, und die Frage dort zu
              stellen wäre eine Warnung ohne Anlass. */}
          {list.length > 0 && (
            <div className="mb-4 rounded border border-cp-border-muted bg-cp-surface-2 p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-cp-sm">
                <span className="font-medium text-cp-text">
                  {t('delivery.archive.title', 'Unabhängige Archiv-Aufzeichnung')}
                </span>
                <select
                  value={archive.answer}
                  onChange={(e) => {
                    const answer = e.target.value as ArchiveAnswer
                    if (answer === 'not-stated') return setArchive(undefined)
                    setArchive({
                      answer,
                      ...(answer === 'device' && project.archiveRecording?.equipmentId
                        ? { equipmentId: project.archiveRecording.equipmentId }
                        : {}),
                      ...(project.archiveRecording?.note
                        ? { note: project.archiveRecording.note }
                        : {}),
                    })
                  }}
                  aria-label={t('delivery.archive.answer', 'Antwort')}
                  className={inputCls}
                >
                  <option value="not-stated">
                    {t('delivery.archive.notStated', '— noch nicht beantwortet —')}
                  </option>
                  <option value="device">{t('delivery.archive.onDevice', 'auf diesem Gerät')}</option>
                  <option value="none-by-choice">
                    {t('delivery.archive.none', 'bewusst keine')}
                  </option>
                </select>
                {archive.answer === 'device' && (
                  <select
                    value={project.archiveRecording?.equipmentId ?? ''}
                    onChange={(e) =>
                      setArchive({
                        answer: 'device',
                        ...(e.target.value ? { equipmentId: e.target.value } : {}),
                        ...(project.archiveRecording?.note
                          ? { note: project.archiveRecording.note }
                          : {}),
                      })
                    }
                    aria-label={t('delivery.archive.device', 'Aufzeichnendes Gerät')}
                    className={inputCls}
                  >
                    <option value="">{t('delivery.archive.pick', '— Gerät wählen —')}</option>
                    {encoderChoices.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                )}
                {archive.answer !== 'not-stated' && (
                  <input
                    value={project.archiveRecording?.note ?? ''}
                    onChange={(e) =>
                      setArchive({
                        answer: archive.answer,
                        ...(project.archiveRecording?.equipmentId
                          ? { equipmentId: project.archiveRecording.equipmentId }
                          : {}),
                        ...(e.target.value ? { note: e.target.value } : {}),
                      })
                    }
                    placeholder={
                      archive.answer === 'none-by-choice'
                        ? t('delivery.archive.whyPh', 'Warum keine? (Webinar ohne Nachverwertung …)')
                        : t('delivery.archive.notePh', 'Anmerkung (Medium, Kartenwechsel …)')
                    }
                    aria-label={t('delivery.archive.note', 'Anmerkung')}
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                )}
                <button
                  type="button"
                  onClick={exportArchive}
                  className="flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <FileText size={13} /> {t('delivery.archive.export', 'Blatt')}
                </button>
              </div>
              {archive.findings.length > 0 && (
                <ul className="flex flex-col gap-1 text-cp-xs">
                  {archive.findings.map((f, i) => (
                    <li key={`${f.kind}-${i}`} className="text-amber-300/90">
                      <strong>{ARCHIVE_FINDING_LABEL[f.kind]}</strong> — {archiveFindingText(f)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* BEDARF 88 — die Angaben zur Veranstaltung. Nur sichtbar, wenn es
              ein Ziel gibt: ohne Ausspielung hat der Titel keine Plattform,
              auf der er getippt würde, und der Abschnitt wäre eine Frage ohne
              Anlass — dieselbe Regel wie beim Archiv und beim Sicherheitsnetz. */}
          {list.length > 0 && (
            <div className="mb-4 rounded border border-cp-border-muted bg-cp-surface-2 p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-cp-sm">
                <span className="font-medium text-cp-text">
                  {t('delivery.event.title', 'Angaben zur Veranstaltung')}
                </span>
                <button
                  type="button"
                  onClick={exportEventMetadata}
                  title={t(
                    'delivery.event.exportHint',
                    'Ein Blatt zum Abtippen — je Ziel eine Zeile mit Titel, Beginn und Sichtbarkeit',
                  )}
                  className="flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <FileText size={13} /> {t('delivery.event.export', 'Blatt')}
                </button>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <input
                  value={meta.plan.event.title ?? ''}
                  onChange={(e) => patchEvent({ title: e.target.value || undefined })}
                  placeholder={t('delivery.event.titlePh', 'Titel der Veranstaltung')}
                  aria-label={t('delivery.event.titleLabel', 'Titel')}
                  className={inputCls}
                />
                <select
                  value={meta.plan.event.privacy}
                  onChange={(e) => patchEvent({ privacy: e.target.value as EventPrivacy })}
                  aria-label={t('delivery.event.privacy', 'Sichtbarkeit')}
                  className={inputCls}
                >
                  <option value="not-stated">
                    {t('delivery.event.privacy.notStated', '— Sichtbarkeit nicht angegeben —')}
                  </option>
                  <option value="public">{t('delivery.event.privacy.public', 'öffentlich')}</option>
                  <option value="unlisted">
                    {t('delivery.event.privacy.unlisted', 'nicht gelistet')}
                  </option>
                  <option value="private">{t('delivery.event.privacy.private', 'privat')}</option>
                </select>
                {/* Ein `datetime-local`-Feld stünde hier nahe — und wäre genau
                    der Fehler aus dem Bedarf: es liefert „2026-09-12T19:00"
                    ohne Offset, und der Plan sähe aus, als wüsste er die
                    Zeitzone. Das Textfeld nimmt den Offset auf, wenn jemand
                    ihn hat, und der Befund sagt es laut, wenn nicht. */}
                <input
                  value={meta.plan.event.scheduledStart ?? ''}
                  onChange={(e) => patchEvent({ scheduledStart: e.target.value || undefined })}
                  placeholder={t('delivery.event.startPh', 'Beginn, z. B. 2026-09-12T19:00+02:00')}
                  aria-label={t('delivery.event.start', 'Geplanter Beginn')}
                  className={inputCls}
                />
                <input
                  value={meta.plan.event.timezone ?? ''}
                  onChange={(e) => patchEvent({ timezone: e.target.value || undefined })}
                  placeholder={t('delivery.event.tzPh', 'Angesagt in, z. B. Europe/Berlin')}
                  aria-label={t('delivery.event.tz', 'Zeitzone')}
                  className={inputCls}
                />
                <input
                  value={meta.plan.event.thumbnailRef ?? ''}
                  onChange={(e) => patchEvent({ thumbnailRef: e.target.value || undefined })}
                  placeholder={t('delivery.event.thumbPh', 'Vorschaubild — Dateiname, nicht das Bild')}
                  aria-label={t('delivery.event.thumb', 'Vorschaubild')}
                  className={inputCls}
                />
                <input
                  value={(meta.plan.event.tags ?? []).join(', ')}
                  onChange={(e) =>
                    patchEvent({
                      tags: e.target.value
                        .split(',')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder={t('delivery.event.tagsPh', 'Schlagworte, durch Komma getrennt')}
                  aria-label={t('delivery.event.tags', 'Schlagworte')}
                  className={inputCls}
                />
              </div>
              <textarea
                value={meta.plan.event.description ?? ''}
                onChange={(e) => patchEvent({ description: e.target.value || undefined })}
                placeholder={t('delivery.event.descPh', 'Beschreibungstext für die Plattform-Formulare')}
                aria-label={t('delivery.event.desc', 'Beschreibung')}
                rows={2}
                className={`${inputCls} mb-2 w-full`}
              />
              <div className="mb-2 flex flex-col gap-1">
                <span className="text-cp-xs text-cp-text-muted">
                  {t(
                    'delivery.event.overrides',
                    'Bewusste Abweichungen je Ziel — leer heißt „gilt wie am Projekt".',
                  )}
                </span>
                {meta.resolved.map((r) => (
                  <div key={r.destinationId} className="flex flex-wrap items-center gap-1.5">
                    <span className="min-w-[7rem] text-cp-xs text-cp-text-secondary">
                      {r.destinationName}
                    </span>
                    <input
                      value={overrideOf(r.destinationId)?.title ?? ''}
                      onChange={(e) =>
                        patchOverride(r.destinationId, { title: e.target.value || undefined })
                      }
                      placeholder={t('delivery.event.ovTitlePh', 'abweichender Titel')}
                      aria-label={`${t('delivery.event.ovTitle', 'Abweichender Titel')} — ${r.destinationName}`}
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                    <input
                      value={overrideOf(r.destinationId)?.reason ?? ''}
                      onChange={(e) =>
                        patchOverride(r.destinationId, { reason: e.target.value || undefined })
                      }
                      placeholder={t('delivery.event.ovReasonPh', 'warum abweichend?')}
                      aria-label={`${t('delivery.event.ovReason', 'Begründung')} — ${r.destinationName}`}
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                  </div>
                ))}
              </div>
              {meta.findings.length > 0 && (
                <ul className="flex flex-col gap-1 text-cp-xs">
                  {meta.findings.map((f, i) => (
                    <li key={`${f.kind}-${i}`} className="text-amber-300/90">
                      <strong>{EVENT_METADATA_FINDING_LABEL[f.kind]}</strong> — {f.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* BEDARF 87 — der Sendebericht. Nur sichtbar, wenn es ein Ziel gibt:
              ohne Ausspielung gab es keine Sendung, über die zu berichten
              wäre. */}
          {list.length > 0 && (
            <div className="mb-4 rounded border border-cp-border-muted bg-cp-surface-2 p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-cp-sm">
                <span className="font-medium text-cp-text">
                  {t('delivery.record.title', 'Sendebericht')}
                </span>
                {/* Woraus der Bericht spricht — derselbe Zustand wie bei der
                    Übergabe (Bedarf 84). Er steht hier und nicht nur in den
                    Befunden, weil er entscheidet, ob „Abweichung" überhaupt
                    etwas heißen kann. */}
                <span className="rounded border border-cp-border-muted px-1.5 py-0.5 text-cp-xs text-cp-text-secondary">
                  {JOB_BASIS_LABEL[sendung.basis]}
                </span>
                <button
                  type="button"
                  onClick={addTransmissionEvent}
                  className="flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <Plus size={13} /> {t('delivery.record.add', 'Eintrag')}
                </button>
                <button
                  type="button"
                  onClick={exportTransmission}
                  title={t(
                    'delivery.record.exportHint',
                    'Der Verlauf als Blatt — jede Zeile trägt, woher die Angabe stammt. Dieser Plan misst nichts.',
                  )}
                  className="flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <FileText size={13} /> {t('delivery.record.export', 'Blatt')}
                </button>
              </div>
              <p className="mb-2 text-cp-xs leading-snug text-cp-text-muted">
                {t(
                  'delivery.record.hint',
                  'Was die Sendung getan hat, soweit jemand es aufgeschrieben hat. Keine Messung: Zeitpunkt und Herkunft trägt der Mensch ein, der dabei war.',
                )}
              </p>
              {sendung.events.length > 0 && (
                <div className="mb-2 flex flex-col gap-1">
                  {sendung.events.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center gap-1.5">
                      <input
                        value={e.at}
                        onChange={(ev) => patchTransmissionEvent(e.id, { at: ev.target.value })}
                        placeholder={t('delivery.record.atPh', '2026-09-12T19:04+02:00')}
                        aria-label={t('delivery.record.at', 'Zeitpunkt')}
                        className={`${inputCls} w-[13rem]`}
                      />
                      <select
                        value={e.kind}
                        onChange={(ev) =>
                          patchTransmissionEvent(e.id, {
                            kind: ev.target.value as TransmissionEventKind,
                          })
                        }
                        aria-label={t('delivery.record.kind', 'Was')}
                        className={inputCls}
                      >
                        {Object.keys(TRANSMISSION_EVENT_LABEL).map((k) => (
                          <option key={k} value={k}>
                            {TRANSMISSION_EVENT_LABEL[k as TransmissionEventKind]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={e.destinationId ?? ''}
                        onChange={(ev) =>
                          patchTransmissionEvent(e.id, {
                            destinationId: ev.target.value || undefined,
                          })
                        }
                        aria-label={t('delivery.record.dest', 'Ziel')}
                        className={inputCls}
                      >
                        <option value="">{t('delivery.record.whole', '— ganze Sendung —')}</option>
                        {list.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      {/* Die Herkunft steht NEBEN dem Text, nicht am Rand: sie
                          entscheidet, wie belastbar die Zeile ist, wenn der
                          Bericht beim Kunden liegt. */}
                      <select
                        value={e.source}
                        onChange={(ev) =>
                          patchTransmissionEvent(e.id, {
                            source: ev.target.value as TransmissionSource,
                          })
                        }
                        aria-label={t('delivery.record.source', 'Herkunft')}
                        className={inputCls}
                      >
                        {Object.keys(TRANSMISSION_SOURCE_LABEL).map((k) => (
                          <option key={k} value={k}>
                            {TRANSMISSION_SOURCE_LABEL[k as TransmissionSource]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={e.observedBy ?? ''}
                        onChange={(ev) =>
                          patchTransmissionEvent(e.id, {
                            observedBy: ev.target.value || undefined,
                          })
                        }
                        placeholder={t('delivery.record.byPh', 'von wem?')}
                        aria-label={t('delivery.record.by', 'Beobachtet von')}
                        className={`${inputCls} w-[8rem]`}
                      />
                      <input
                        value={e.text}
                        onChange={(ev) => patchTransmissionEvent(e.id, { text: ev.target.value })}
                        placeholder={t('delivery.record.textPh', 'Was war zu sehen?')}
                        aria-label={t('delivery.record.text', 'Beschreibung')}
                        className={`${inputCls} min-w-0 flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => removeTransmissionEvent(e.id)}
                        aria-label={t('delivery.record.remove', 'Eintrag entfernen')}
                        className="text-cp-text-muted hover:text-cp-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                value={sendung.record.summary ?? ''}
                onChange={(e) => patchRecord(sendung.events, e.target.value)}
                placeholder={t(
                  'delivery.record.summaryPh',
                  'Zusammenfassung für den Kunden — bewusst von Hand, nicht erzeugt',
                )}
                aria-label={t('delivery.record.summary', 'Zusammenfassung')}
                rows={2}
                className={`${inputCls} mb-2 w-full`}
              />
              {sendung.deviations.length > 0 && (
                <ul className="mb-2 flex flex-col gap-1 text-cp-xs text-cp-text-secondary">
                  {sendung.deviations.map((d) => (
                    <li key={d.section}>
                      <strong>{d.label}</strong> — {d.detail}
                    </li>
                  ))}
                </ul>
              )}
              {sendung.findings.length > 0 && (
                <ul className="flex flex-col gap-1 text-cp-xs">
                  {sendung.findings.map((f, i) => (
                    <li key={`${f.kind}-${i}`} className="text-amber-300/90">
                      <strong>{TRANSMISSION_FINDING_LABEL[f.kind]}</strong> — {f.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* BEDARF 89 — das Sicherheitsnetz. Nur sichtbar, wenn es ein Ziel
              gibt: ohne Ausspielung gibt es nichts zu schützen, und der
              Abschnitt wäre eine Frage ohne Anlass. */}
          {list.length > 0 && (
            <div className="mb-4 rounded border border-cp-border-muted bg-cp-surface-2 p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-cp-sm">
                <span className="font-medium text-cp-text">
                  {t('delivery.fb.title', 'Ausweichverhalten (Sicherheitsnetz)')}
                </span>
                <button
                  type="button"
                  onClick={exportFallback}
                  className="ml-auto flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <FileText size={13} /> {t('delivery.fb.export', 'Blatt')}
                </button>
                <button
                  type="button"
                  onClick={exportSkeleton}
                  title={t(
                    'delivery.fb.skeletonHint',
                    'Gerüst zum Abtippen, keine einspielbare Konfiguration — das NOALBS-Schema hängt an deiner Version',
                  )}
                  className="flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <Download size={13} /> {t('delivery.fb.skeleton', 'Gerüst')}
                </button>
              </div>

              <p className="mb-2 text-cp-xs text-cp-text-muted">
                {t(
                  'delivery.fb.intro',
                  'Der teure Fehler ist nicht das Netz, das nicht auslöst — es ist das Netz, das grundlos auslöst und die Show auf eine Tafel parkt, während die Strecke läuft. Szenennamen stehen im Encoder, im Wächter und im Kopf des Operators; hier stehen sie einmal, und der Abgleich kostet nichts.',
                )}
              </p>

              <div className="mb-2 flex flex-wrap items-end gap-2 text-cp-sm">
                <label className="flex flex-col gap-0.5">
                  <span className="text-cp-xs text-cp-text-muted">
                    {t('delivery.fb.watcher', 'Wächter läuft auf')}
                  </span>
                  <select
                    value={fallback.plan.watcherEquipmentId ?? ''}
                    onChange={(e) =>
                      patchFallback({ watcherEquipmentId: e.target.value || undefined })
                    }
                    aria-label={t('delivery.fb.watcher', 'Wächter läuft auf')}
                    className={inputCls}
                  >
                    <option value="">{t('delivery.fb.watcherNone', '— nicht benannt —')}</option>
                    {encoderChoices.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-0.5">
                  <span className="text-cp-xs text-cp-text-muted">
                    {t('delivery.fb.stats', 'Statistik-Quelle, wie der Wächter sie sieht')}
                  </span>
                  <input
                    value={fallback.plan.statsUrl ?? ''}
                    onChange={(e) => patchFallback({ statsUrl: e.target.value || undefined })}
                    placeholder="http://10.0.0.20/stat"
                    aria-label={t('delivery.fb.stats', 'Statistik-Quelle, wie der Wächter sie sieht')}
                    className={`${inputCls} w-full`}
                  />
                </label>
              </div>

              <div className="mb-2 flex flex-wrap items-end gap-2 text-cp-sm">
                <label className="flex flex-1 flex-col gap-0.5">
                  <span className="text-cp-xs text-cp-text-muted">
                    {format(
                      t('delivery.fb.scenes', 'Szenen im Encoder ({n} hinterlegt)'),
                      { n: String(fallback.plan.scenes.length) },
                    )}
                  </span>
                  <input
                    value={sceneDraft}
                    onChange={(e) => setSceneDraft(e.target.value)}
                    placeholder={t(
                      'delivery.fb.scenesPh',
                      'Namen einfügen, durch Komma oder Zeilenumbruch getrennt',
                    )}
                    aria-label={t('delivery.fb.scenes', 'Szenen im Encoder')}
                    className={`${inputCls} w-full`}
                  />
                </label>
                <button
                  type="button"
                  onClick={applyScenes}
                  className="rounded border border-cp-border px-2 py-1.5 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  {t('delivery.fb.scenesApply', 'Übernehmen')}
                </button>
              </div>
              {fallback.plan.scenes.length > 0 && (
                <div className="mb-2 text-cp-xs text-cp-text-faint">
                  {fallback.plan.scenes.join(' · ')}
                </div>
              )}

              <ul className="flex flex-col gap-1.5">
                {list.map((d) => {
                  const rule = fallback.plan.rules.find((r) => r.destinationId === d.id)
                  if (!rule) {
                    return (
                      <li key={d.id} className="flex items-center gap-2 text-cp-xs">
                        <span className="flex-1 text-cp-text-muted">{d.name}</span>
                        <button
                          type="button"
                          onClick={() => addRule(d.id)}
                          className="rounded border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text"
                        >
                          <Plus size={11} className="inline" />{' '}
                          {t('delivery.fb.protect', 'Absichern')}
                        </button>
                      </li>
                    )
                  }
                  return (
                    <li
                      key={d.id}
                      className="rounded border border-cp-border-muted bg-cp-surface-3 p-2"
                    >
                      <div className="mb-1 flex items-center gap-2 text-cp-sm">
                        <span className="flex-1 font-medium text-cp-text">{d.name}</span>
                        <button
                          type="button"
                          onClick={() => removeRule(rule.id)}
                          aria-label={t('delivery.fb.remove', 'Regel entfernen')}
                          className="text-cp-text-muted hover:text-cp-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-cp-xs">
                        {(
                          [
                            ['sceneNormal', t('delivery.fb.sceneNormal', 'Normalbetrieb')],
                            ['sceneLow', t('delivery.fb.sceneLow', 'Niedrige Bitrate')],
                            ['sceneOffline', t('delivery.fb.sceneOffline', 'Offline')],
                          ] as const
                        ).map(([feld, label]) => (
                          <label key={feld} className="flex flex-col gap-0.5">
                            <span className="text-cp-text-muted">{label}</span>
                            <input
                              value={rule[feld] ?? ''}
                              onChange={(e) => patchRule(rule.id, { [feld]: e.target.value || undefined })}
                              aria-label={`${d.name} — ${label}`}
                              className={`${inputCls} w-36`}
                            />
                          </label>
                        ))}
                        <label className="flex flex-col gap-0.5">
                          <span className="text-cp-text-muted">
                            {t('delivery.fb.low', 'Schwelle niedrig')}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={rule.lowKbps ?? ''}
                            onChange={(e) =>
                              patchRule(rule.id, { lowKbps: Number(e.target.value) || undefined })
                            }
                            aria-label={`${d.name} — ${t('delivery.fb.low', 'Schwelle niedrig')}`}
                            className={`${inputCls} w-24`}
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-cp-text-muted">
                            {t('delivery.fb.offline', 'Schwelle offline')}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={rule.offlineKbps ?? ''}
                            onChange={(e) =>
                              patchRule(rule.id, { offlineKbps: Number(e.target.value) || undefined })
                            }
                            aria-label={`${d.name} — ${t('delivery.fb.offline', 'Schwelle offline')}`}
                            className={`${inputCls} w-24`}
                          />
                        </label>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {fallback.findings.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-cp-xs">
                  {fallback.findings.map((f, i) => (
                    <li key={`${f.kind}-${i}`} className="text-amber-300/90">
                      <strong>{FALLBACK_FINDING_LABEL[f.kind]}</strong> — {f.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
