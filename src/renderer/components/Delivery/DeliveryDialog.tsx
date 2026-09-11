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
import { COMPANION_SCHNITTSTELLE_HINWEIS } from '../../lib/companionVariablen'
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
import { PanelHint } from '../shared/PanelHint'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'

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

  // Phase 3 der UI-Pruefung: Escape, Fokus-Falle und Fokus-Rueckgabe aus dem
  // Haken. Vor dem bedingten Ausstieg, weil Haken nicht bedingt laufen.
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, () => setOpen(false))

  // B-44 — der Hintergrund schliesst, aus derselben Quelle wie ueberall.
  const backdrop = useBackdropClose(() => setOpen(false))

  if (!open) return null

  const issuesFor = (id: string): DeliveryIssue[] => report.issues.filter((i) => i.destinationId === id)

  const issueText = (i: DeliveryIssue): string => {
    switch (i.kind) {
      case 'backup-mismatch':
        return format(
          t('delivery.issue.backupMismatch', 'Backup differs: {field} is {actual}, must be {expected}'),
          { field: String(i.field), actual: i.actual ?? '', expected: i.expected ?? '' },
        )
      case 'backup-orphan':
        return t('delivery.issue.backupOrphan', 'Backup pointer leads nowhere')
      case 'backup-cycle':
        return t('delivery.issue.backupCycle', 'Backup pointers form a cycle')
      case 'no-backup':
        return t('delivery.issue.noBackup', 'No fallback path')
      case 'missing-url':
        return t('delivery.issue.missingUrl', 'No ingest URL')
      case 'missing-key':
        return t('delivery.issue.missingKey', 'No stream key stored')
      case 'over-platform-bitrate':
        return format(
          t('delivery.issue.overBitrate', 'Bitrate {actual} above the platform limit {expected}'),
          { actual: i.actual ?? '', expected: i.expected ?? '' },
        )
      case 'keyframe-mismatch':
        return format(t('delivery.issue.keyframe', 'Keyframe interval {actual}, required is {expected}'), {
          actual: i.actual ?? '',
          expected: i.expected ?? '',
        })
      case 'needs-port-forward':
        return t('delivery.issue.portForward', 'SRT listener: port forward required')
    }
  }

  // Ausgeschriebener switch statt `t(`delivery.enc.${f.kind}`)`: ein dynamisch
  // zusammengesetzter Schluessel ist fuer den i18n-Deckungs-Guard unsichtbar
  // und faellt im EN-Betrieb still auf den nackten Slug zurueck.
  const feasibilityText = (f: FeasibilityFinding): string => {
    switch (f.kind) {
      case 'too-many-destinations':
        return format(
          t('delivery.encoder.tooMany', '{n} simultaneous destinations, the tool handles {max}'),
          { n: f.values?.[0] ?? '', max: f.values?.[1] ?? '' },
        )
      case 'per-destination-quality-unsupported':
        return t(
          'delivery.encoder.noPerDestination',
          'The plan asks for per-destination quality \u2014 this tool sends all of them the same',
        )
      case 'per-destination-quality-unknown':
        return t(
          'delivery.encoder.perDestinationUnknown',
          'The plan asks for per-destination quality \u2014 whether this tool can do that is unresolved',
        )
      case 'must-match-differs':
        return format(
          t('delivery.encoder.mustMatch', '{field} must match across all destinations, but is {values}'),
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
        return t('delivery.chain.noEncoder', 'No encoder named in the plan')
      case 'encoder-gone':
        return t('delivery.chain.encoderGone', 'The named device is no longer in the plan')
      case 'encoder-unfed':
        return format(
          t('delivery.chain.encoderUnfed', '{device} has no cable on any programme input'),
          { device: f.values?.[0] ?? '' },
        )
      case 'feed-ambiguous':
        return format(
          t('delivery.chain.feedAmbiguous', 'Several cabled programme inputs: {ports}'),
          { ports: (f.values ?? []).join(' / ') },
        )
      case 'backup-shares-encoder':
        return format(
          t(
            'delivery.chain.backupSharesEncoder',
            'Backup runs through the same device as the primary path ({device})',
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
          ? `${c.source.name} ${format(t('delivery.path.hops', '(via {n})'), { n: c.source.hops })}`
          : c.source.name,
      )
    }
    if (c.encoder) parts.push(c.encoder.name)
    parts.push(c.transport)
    parts.push(c.destinationName)
    return parts.join(' → ')
  }

  const addDestination = () => {
    add({ name: t('delivery.newName', 'New destination'), platform: 'custom', encoding: { ...DEFAULT_ENCODING } })
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
    <div
      {...backdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden border border-cp-border bg-cp-surface-1"
      >
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-2.5">
          <h2 id={titleId} className="flex items-center gap-2 text-cp-base font-semibold text-cp-text">
            <Radio size={16} /> {t('delivery.title', 'Delivery')}
          </h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCsv} className="flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text">
              <Download size={13} /> CSV
            </button>
            <button
              type="button"
              onClick={exportRunOfShow}
              title={t('delivery.runOfShowHint', 'One sheet for show day \u2014 stream keys appear on it only as a reference to the keychain')}
              className="flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
            >
              <FileText size={13} /> {t('delivery.runOfShow', 'Run sheet')}
            </button>
            <button
              type="button"
              onClick={exportPath}
              title={t(
                'delivery.path.hint',
                'The path from the programme feed to the platform — source, encoder, transport, destination',
              )}
              className="flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
            >
              <Route size={13} /> {t('delivery.path.title', 'Delivery path')}
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close', 'Close')} className="text-cp-text-muted hover:text-cp-text">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <PanelHint
            className="mb-3 text-cp-sm leading-snug text-cp-text-secondary"
            text={t(
              'delivery.intro',
              'Where the show is sent, with which parameters, and which path is the fallback. The stream key lives in this machine\u2019s keychain, never in the project file \u2014 an .avplan travels by e-mail.',
            )}
          />

          {/* BEDARF 90 — die Archiv-Aufzeichnung. Nur sichtbar, wenn es
              überhaupt ein Ausspielziel gibt: ohne Übertragung gibt es nichts,
              was die Aufzeichnung mitreißen könnte, und die Frage dort zu
              stellen wäre eine Warnung ohne Anlass. */}
          {list.length > 0 && (
            <div className="mb-4 border border-cp-border-muted bg-cp-surface-2 p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-cp-sm">
                <span className="font-medium text-cp-text">
                  {t('delivery.archive.title', 'Independent archive recording')}
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
                  aria-label={t('delivery.archive.answer', 'Answer')}
                  className={inputCls}
                >
                  <option value="not-stated">
                    {t('delivery.archive.notStated', '\u2014 not answered yet \u2014')}
                  </option>
                  <option value="device">{t('delivery.archive.onDevice', 'on this device')}</option>
                  <option value="none-by-choice">
                    {t('delivery.archive.none', 'deliberately none')}
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
                    aria-label={t('delivery.archive.device', 'Recording device')}
                    className={inputCls}
                  >
                    <option value="">{t('delivery.archive.pick', '\u2014 pick a device \u2014')}</option>
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
                        ? t('delivery.archive.whyPh', 'Why none? (webinar with no re-use \u2026)')
                        : t('delivery.archive.notePh', 'Note (medium, card swap \u2026)')
                    }
                    aria-label={t('delivery.archive.note', 'Note')}
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                )}
                <button
                  type="button"
                  onClick={exportArchive}
                  className="flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <FileText size={13} /> {t('delivery.archive.export', 'Sheet')}
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
            <div className="mb-4 border border-cp-border-muted bg-cp-surface-2 p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-cp-sm">
                <span className="font-medium text-cp-text">
                  {t('delivery.event.title', 'Event details')}
                </span>
                <button
                  type="button"
                  onClick={exportEventMetadata}
                  title={t(
                    'delivery.event.exportHint',
                    'A sheet to type from \u2014 one row per destination with title, start and visibility',
                  )}
                  className="flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <FileText size={13} /> {t('delivery.event.export', 'Sheet')}
                </button>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <input
                  value={meta.plan.event.title ?? ''}
                  onChange={(e) => patchEvent({ title: e.target.value || undefined })}
                  placeholder={t('delivery.event.titlePh', 'Event title')}
                  aria-label={t('delivery.event.titleLabel', 'Title')}
                  className={inputCls}
                />
                <select
                  value={meta.plan.event.privacy}
                  onChange={(e) => patchEvent({ privacy: e.target.value as EventPrivacy })}
                  aria-label={t('delivery.event.privacy', 'Visibility')}
                  className={inputCls}
                >
                  <option value="not-stated">
                    {t('delivery.event.privacy.notStated', '\u2014 visibility not stated \u2014')}
                  </option>
                  <option value="public">{t('delivery.event.privacy.public', 'public')}</option>
                  <option value="unlisted">
                    {t('delivery.event.privacy.unlisted', 'unlisted')}
                  </option>
                  <option value="private">{t('delivery.event.privacy.private', 'private')}</option>
                </select>
                {/* Ein `datetime-local`-Feld stünde hier nahe — und wäre genau
                    der Fehler aus dem Bedarf: es liefert „2026-09-12T19:00"
                    ohne Offset, und der Plan sähe aus, als wüsste er die
                    Zeitzone. Das Textfeld nimmt den Offset auf, wenn jemand
                    ihn hat, und der Befund sagt es laut, wenn nicht. */}
                <input
                  value={meta.plan.event.scheduledStart ?? ''}
                  onChange={(e) => patchEvent({ scheduledStart: e.target.value || undefined })}
                  placeholder={t('delivery.event.startPh', 'Start, e.g. 2026-09-12T19:00+02:00')}
                  aria-label={t('delivery.event.start', 'Scheduled start')}
                  className={inputCls}
                />
                <input
                  value={meta.plan.event.timezone ?? ''}
                  onChange={(e) => patchEvent({ timezone: e.target.value || undefined })}
                  placeholder={t('delivery.event.tzPh', 'Announced in, e.g. Europe/Berlin')}
                  aria-label={t('delivery.event.tz', 'Time zone')}
                  className={inputCls}
                />
                <input
                  value={meta.plan.event.thumbnailRef ?? ''}
                  onChange={(e) => patchEvent({ thumbnailRef: e.target.value || undefined })}
                  placeholder={t('delivery.event.thumbPh', 'Thumbnail \u2014 file name, not the image')}
                  aria-label={t('delivery.event.thumb', 'Thumbnail')}
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
                  placeholder={t('delivery.event.tagsPh', 'Tags, comma separated')}
                  aria-label={t('delivery.event.tags', 'Tags')}
                  className={inputCls}
                />
              </div>
              <textarea
                value={meta.plan.event.description ?? ''}
                onChange={(e) => patchEvent({ description: e.target.value || undefined })}
                placeholder={t('delivery.event.descPh', 'Description text for the platform forms')}
                aria-label={t('delivery.event.desc', 'Description')}
                rows={2}
                className={`${inputCls} mb-2 w-full`}
              />
              <div className="mb-2 flex flex-col gap-1">
                <span className="text-cp-xs text-cp-text-muted">
                  {t(
                    'delivery.event.overrides',
                    'Deliberate deviations per destination \u2014 empty means \u201csame as the project\u201d.',
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
                      placeholder={t('delivery.event.ovTitlePh', 'deviating title')}
                      aria-label={`${t('delivery.event.ovTitle', 'Deviating title')} — ${r.destinationName}`}
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                    <input
                      value={overrideOf(r.destinationId)?.reason ?? ''}
                      onChange={(e) =>
                        patchOverride(r.destinationId, { reason: e.target.value || undefined })
                      }
                      placeholder={t('delivery.event.ovReasonPh', 'why deviating?')}
                      aria-label={`${t('delivery.event.ovReason', 'Reason')} — ${r.destinationName}`}
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
            <div className="mb-4 border border-cp-border-muted bg-cp-surface-2 p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-cp-sm">
                <span className="font-medium text-cp-text">
                  {t('delivery.record.title', 'Transmission record')}
                </span>
                {/* Woraus der Bericht spricht — derselbe Zustand wie bei der
                    Übergabe (Bedarf 84). Er steht hier und nicht nur in den
                    Befunden, weil er entscheidet, ob „Abweichung" überhaupt
                    etwas heißen kann. */}
                <span className="border border-cp-border-muted px-1.5 py-0.5 text-cp-xs text-cp-text-secondary">
                  {JOB_BASIS_LABEL[sendung.basis]}
                </span>
                <button
                  type="button"
                  onClick={addTransmissionEvent}
                  className="flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <Plus size={13} /> {t('delivery.record.add', 'Entry')}
                </button>
                <button
                  type="button"
                  onClick={exportTransmission}
                  title={t(
                    'delivery.record.exportHint',
                    'The sequence as a sheet \u2014 every row states where the statement came from. This plan measures nothing.',
                  )}
                  className="flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <FileText size={13} /> {t('delivery.record.export', 'Sheet')}
                </button>
              </div>
              {/* PanelHint statt <p>: der Satz ist mit der englischen Fassung
                  ueber die 140-Zeichen-Grenze gewachsen, ab der `hinweisLaenge`
                  die einheitliche Form verlangt. Die deutsche Fassung lag knapp
                  darunter — die Regel galt also schon vorher, sie war nur nicht
                  ausgeloest. */}
              <PanelHint
                className="mb-2 text-cp-xs leading-snug text-cp-text-muted"
                text={t(
                  'delivery.record.hint',
                  'What the transmission did, as far as somebody wrote it down. Not a measurement: the time and the origin are entered by the person who was there.',
                )}
              />
              {sendung.events.length > 0 && (
                <div className="mb-2 flex flex-col gap-1">
                  {sendung.events.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center gap-1.5">
                      <input
                        value={e.at}
                        onChange={(ev) => patchTransmissionEvent(e.id, { at: ev.target.value })}
                        placeholder={t('delivery.record.atPh', '2026-09-12T19:04+02:00')}
                        aria-label={t('delivery.record.at', 'Time')}
                        className={`${inputCls} w-[13rem]`}
                      />
                      <select
                        value={e.kind}
                        onChange={(ev) =>
                          patchTransmissionEvent(e.id, {
                            kind: ev.target.value as TransmissionEventKind,
                          })
                        }
                        aria-label={t('delivery.record.kind', 'What')}
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
                        aria-label={t('delivery.record.dest', 'Destination')}
                        className={inputCls}
                      >
                        <option value="">{t('delivery.record.whole', '\u2014 whole transmission \u2014')}</option>
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
                        aria-label={t('delivery.record.source', 'Origin')}
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
                        placeholder={t('delivery.record.byPh', 'by whom?')}
                        aria-label={t('delivery.record.by', 'Observed by')}
                        className={`${inputCls} w-[8rem]`}
                      />
                      <input
                        value={e.text}
                        onChange={(ev) => patchTransmissionEvent(e.id, { text: ev.target.value })}
                        placeholder={t('delivery.record.textPh', 'What was visible?')}
                        aria-label={t('delivery.record.text', 'Description')}
                        className={`${inputCls} min-w-0 flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => removeTransmissionEvent(e.id)}
                        aria-label={t('delivery.record.remove', 'Remove entry')}
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
                  'Summary for the client \u2014 written by hand on purpose, not generated',
                )}
                aria-label={t('delivery.record.summary', 'Summary')}
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
            <div className="mb-4 border border-cp-border-muted bg-cp-surface-2 p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-cp-sm">
                <span className="font-medium text-cp-text">
                  {t('delivery.fb.title', 'Fallback behaviour (safety net)')}
                </span>
                <button
                  type="button"
                  onClick={exportFallback}
                  className="ml-auto flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <FileText size={13} /> {t('delivery.fb.export', 'Sheet')}
                </button>
                <button
                  type="button"
                  onClick={exportSkeleton}
                  title={t(
                    'delivery.fb.skeletonHint',
                    'A skeleton to copy by hand, not a config to load \u2014 the NOALBS schema depends on the version you run',
                  )}
                  className="flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <Download size={13} /> {t('delivery.fb.skeleton', 'Skeleton')}
                </button>
              </div>

              <PanelHint
                className="mb-2 text-cp-xs text-cp-text-muted"
                text={t(
                  'delivery.fb.intro',
                  'The expensive failure is not the net that never fires \u2014 it is the net that fires for no reason and parks the show on a slate while the stream is fine. Scene names live in the encoder, in the watchdog and in the operator\u2019s head; here they live once, and comparing them costs nothing.',
                )}
              />

              <div className="mb-2 flex flex-wrap items-end gap-2 text-cp-sm">
                <label className="flex flex-col gap-0.5">
                  <span className="text-cp-xs text-cp-text-muted">
                    {t('delivery.fb.watcher', 'Watchdog runs on')}
                  </span>
                  <select
                    value={fallback.plan.watcherEquipmentId ?? ''}
                    onChange={(e) =>
                      patchFallback({ watcherEquipmentId: e.target.value || undefined })
                    }
                    aria-label={t('delivery.fb.watcher', 'Watchdog runs on')}
                    className={inputCls}
                  >
                    <option value="">{t('delivery.fb.watcherNone', '\u2014 not stated \u2014')}</option>
                    {encoderChoices.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-0.5">
                  <span className="text-cp-xs text-cp-text-muted">
                    {t('delivery.fb.stats', 'Stats source, as the watchdog sees it')}
                  </span>
                  <input
                    value={fallback.plan.statsUrl ?? ''}
                    onChange={(e) => patchFallback({ statsUrl: e.target.value || undefined })}
                    placeholder="http://10.0.0.20/stat"
                    aria-label={t('delivery.fb.stats', 'Stats source, as the watchdog sees it')}
                    className={`${inputCls} w-full`}
                  />
                </label>
              </div>

              <div className="mb-2 flex flex-wrap items-end gap-2 text-cp-sm">
                <label className="flex flex-1 flex-col gap-0.5">
                  <span className="text-cp-xs text-cp-text-muted">
                    {format(
                      t('delivery.fb.scenes', 'Scenes in the encoder ({n} on file)'),
                      { n: String(fallback.plan.scenes.length) },
                    )}
                  </span>
                  <input
                    value={sceneDraft}
                    onChange={(e) => setSceneDraft(e.target.value)}
                    placeholder={t(
                      'delivery.fb.scenesPh',
                      'Paste names, separated by comma or newline',
                    )}
                    aria-label={t('delivery.fb.scenes', 'Scenes in the encoder ({n} on file)')}
                    className={`${inputCls} w-full`}
                  />
                </label>
                <button
                  type="button"
                  onClick={applyScenes}
                  className="border border-cp-border px-2 py-1.5 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  {t('delivery.fb.scenesApply', 'Apply')}
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
                          className="border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text"
                        >
                          <Plus size={11} className="inline" />{' '}
                          {t('delivery.fb.protect', 'Protect')}
                        </button>
                      </li>
                    )
                  }
                  return (
                    <li
                      key={d.id}
                      className="border border-cp-border-muted bg-cp-surface-3 p-2"
                    >
                      <div className="mb-1 flex items-center gap-2 text-cp-sm">
                        <span className="flex-1 font-medium text-cp-text">{d.name}</span>
                        <button
                          type="button"
                          onClick={() => removeRule(rule.id)}
                          aria-label={t('delivery.fb.remove', 'Remove rule')}
                          className="text-cp-text-muted hover:text-cp-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-cp-xs">
                        {(
                          [
                            ['sceneNormal', t('delivery.fb.sceneNormal', 'Normal')],
                            ['sceneLow', t('delivery.fb.sceneLow', 'Low bitrate')],
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
                            {t('delivery.fb.low', 'Low threshold')}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={rule.lowKbps ?? ''}
                            onChange={(e) =>
                              patchRule(rule.id, { lowKbps: Number(e.target.value) || undefined })
                            }
                            aria-label={`${d.name} — ${t('delivery.fb.low', 'Low threshold')}`}
                            className={`${inputCls} w-24`}
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-cp-text-muted">
                            {t('delivery.fb.offline', 'Offline threshold')}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={rule.offlineKbps ?? ''}
                            onChange={(e) =>
                              patchRule(rule.id, { offlineKbps: Number(e.target.value) || undefined })
                            }
                            aria-label={`${d.name} — ${t('delivery.fb.offline', 'Offline threshold')}`}
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
          <div className="mb-4 border border-cp-border-muted bg-cp-surface-2 p-2.5">
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
                {format(t('delivery.budget', '{planned} kbit/s planned, {usable} kbit/s usable'), {
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
            <div className="mb-4 border border-cp-warn/40 bg-cp-surface-2 p-2.5">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-cp-sm font-medium text-cp-text">
                <Cpu size={14} /> {t('delivery.encoder.title', 'Encoder feasibility')}
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
                                  {format(t('delivery.encoder.onDevice', 'on {device}'), {
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
              {t('delivery.empty', 'No delivery destination yet. Add one.')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((d) => {
                const issues = issuesFor(d.id)
                const chain = chainById.get(d.id)
                const advice = d.transport === 'SRT' ? srtLatencyAdvice(d.srt?.measuredRttMs) : null
                return (
                  <li key={d.id} className="border border-cp-border bg-cp-surface-2 p-2.5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        value={d.name}
                        onChange={(e) => update(d.id, { name: e.target.value })}
                        aria-label={t('delivery.col.name', 'Destination')}
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
                        aria-label={t('delivery.col.platform', 'Platform')}
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
                        aria-label={t('delivery.path.encoder', 'Encoder in the plan')}
                        title={t(
                          'delivery.path.encoderHint',
                          'Which device of the plan feeds this destination — the delivery path is derived from it',
                        )}
                        className={inputCls}
                      >
                        <option value="">{t('delivery.path.noEncoder', '— no encoder named —')}</option>
                        {encoderChoices.map((e) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                        {/* Ein Zeiger auf ein geloeschtes Geraet bleibt sichtbar,
                            statt still auf „kein Encoder" zu springen — sonst
                            sieht der Nutzer nie, dass da mal etwas stand. */}
                        {d.encoderEquipmentId &&
                          !encoderChoices.some((e) => e.id === d.encoderEquipmentId) && (
                            <option value={d.encoderEquipmentId}>
                              {t('delivery.path.encoderGoneOption', '(device no longer in the plan)')}
                            </option>
                          )}
                      </select>
                      <select
                        value={d.backupOfId ?? ''}
                        onChange={(e) => update(d.id, { backupOfId: e.target.value || undefined })}
                        aria-label={t('delivery.col.backupOf', 'Backup of')}
                        className={inputCls}
                      >
                        <option value="">{t('delivery.notABackup', '\u2014 own path \u2014')}</option>
                        {list.filter((o) => o.id !== d.id).map((o) => (
                          <option key={o.id} value={o.id}>
                            {format(t('delivery.backupOfOption', 'Backup of {name}'), { name: o.name })}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        aria-label={t('delivery.remove', 'Remove destination')}
                        title={t('delivery.removeHint', 'Removes the destination and its stream key from the keychain')}
                        className="text-cp-text-faint hover:text-cp-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        value={d.ingestUrl ?? ''}
                        onChange={(e) => update(d.id, { ingestUrl: e.target.value })}
                        placeholder={t('delivery.col.ingest', 'Ingest URL')}
                        aria-label={t('delivery.col.ingest', 'Ingest URL')}
                        className={`${inputCls} min-w-[14rem] flex-1`}
                      />
                      <input
                        type={revealed[d.id] ? 'text' : 'password'}
                        value={keyDraft[d.id] ?? ''}
                        onChange={(e) => setKeyDraft((s) => ({ ...s, [d.id]: e.target.value }))}
                        placeholder={
                          d.hasStreamKey
                            ? t('delivery.keyStored', 'Key stored \u2014 type to replace')
                            : t('delivery.keyEmpty', 'Stream key')
                        }
                        aria-label={t('delivery.col.key', 'Stream key')}
                        className={`${inputCls} min-w-[12rem] flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => void revealKey(d)}
                        aria-label={t('delivery.reveal', 'Show key')}
                        className="text-cp-text-faint hover:text-cp-text"
                      >
                        {revealed[d.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveKey(d)}
                        className="border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                      >
                        {t('delivery.saveKey', 'Save key')}
                      </button>
                    </div>

                    <div className="mb-1 flex flex-wrap items-center gap-2 text-cp-sm">
                      {(
                        [
                          ['width', t('delivery.enc.width', 'Width')],
                          ['height', t('delivery.enc.height', 'Height')],
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
                        {t('delivery.enc.videoCodec', 'Video codec')}
                        <select
                          value={d.encoding.videoCodec}
                          onChange={(e) =>
                            update(d.id, {
                              encoding: { ...d.encoding, videoCodec: e.target.value as 'H.264' | 'HEVC' | 'AV1' },
                            })
                          }
                          aria-label={t('delivery.enc.videoCodec', 'Video codec')}
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
                          {t('delivery.srt.mode', 'SRT mode')}
                          <select
                            value={d.srt?.mode ?? 'caller'}
                            onChange={(e) =>
                              update(d.id, {
                                srt: { ...(d.srt ?? {}), mode: e.target.value as 'caller' | 'listener' | 'rendezvous' },
                              })
                            }
                            aria-label={t('delivery.srt.mode', 'SRT mode')}
                            className={inputCls}
                          >
                            <option value="caller">caller</option>
                            <option value="listener">listener</option>
                            <option value="rendezvous">rendezvous</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1 text-cp-text-muted">
                          {t('delivery.srt.rtt', 'measured RTT (ms)')}
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
                            aria-label={t('delivery.srt.rtt', 'measured RTT (ms)')}
                            className={`${inputCls} w-24`}
                          />
                        </label>
                        {advice && (
                          <div className="w-full text-cp-xs text-cp-text-muted">
                            {advice.fromRtt && (
                              <div>
                                {format(t('delivery.srt.fromRtt', 'from RTT: {v} ms \u2014 {formula} ({source})'), {
                                  v: advice.fromRtt.value,
                                  formula: advice.fromRtt.formula,
                                  source: advice.fromRtt.source,
                                })}
                              </div>
                            )}
                            <div>
                              {format(t('delivery.srt.fixed', 'fixed practical value: {low}\u2013{high} ms ({source})'), {
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

                    {/* E-23 — wo dieses Ziel im Show-Control-Sinn liegt.
                        Der Plan BENENNT die Adresse und druckt sie; er
                        verschickt nichts. Sie steht hier neben dem Ziel, weil
                        sie zu ihm gehoert und nicht zu einer eigenen Liste. */}
                    <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      <label className="block text-cp-xs">
                        <span className="mb-0.5 block text-cp-text-muted">
                          {t('delivery.osc.address', 'OSC address')}
                        </span>
                        <input
                          className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1"
                          value={d.showControl?.oscAdresse ?? ''}
                          placeholder="/stream/haupt/start"
                          onChange={(e) =>
                            update(d.id, {
                              showControl: {
                                ...d.showControl,
                                oscAdresse: e.target.value || undefined,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="block text-cp-xs">
                        <span className="mb-0.5 block text-cp-text-muted">
                          {t('delivery.osc.page', 'Companion page')}
                        </span>
                        <input
                          type="number"
                          className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1"
                          value={d.showControl?.companionSeite ?? ''}
                          onChange={(e) =>
                            update(d.id, {
                              showControl: {
                                ...d.showControl,
                                companionSeite: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="block text-cp-xs">
                        <span className="mb-0.5 block text-cp-text-muted">
                          {t('delivery.osc.bank', 'Companion bank')}
                        </span>
                        <input
                          type="number"
                          className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1"
                          value={d.showControl?.companionPlatz ?? ''}
                          onChange={(e) =>
                            update(d.id, {
                              showControl: {
                                ...d.showControl,
                                companionPlatz: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                    {d.showControl?.companionSeite !== undefined && (
                      <div className="mt-1 text-cp-xs text-cp-text-muted">
                        {t('delivery.osc.companionOptIn', COMPANION_SCHNITTSTELLE_HINWEIS)}
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
            className="flex items-center gap-1 border border-cp-border px-2.5 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
          >
            <Plus size={14} /> {t('delivery.add', 'Add destination')}
          </button>
          <span className="text-cp-xs text-cp-text-muted">
            {format(t('delivery.summary', '{n} destinations, {i} findings'), { n: list.length, i: report.issues.length })}
          </span>
        </div>
      </div>
    </div>
  )
}
