import { useMemo, useRef, useState } from 'react'
import { X, Plus, Trash2, Check, AlertTriangle, Radio, Download, Printer, Table2 } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation, format } from '../../lib/i18n'
import { WIRELESS_CATALOG, wirelessBodies, wirelessById } from '../../lib/wirelessCatalog'
import { compatibleCapsules, compatibleBodypackMics } from '../../lib/wirelessCompat'
import { emptyWirelessRig, deriveRig } from '../../lib/wirelessRig'
import { collectTransmitters } from '../../lib/spectrumPlan'
import { rfConflictText } from '../../lib/rfCoordination'
import type { WirelessRigPlan, WirelessChannel } from '../../types/wirelessRig'
import { MicPlotPanel } from './MicPlotPanel'
import { selectableBands, bandId, bandById, type RfBand } from '../../lib/rfBands'
import { RF_COUNTRY_TABLES, countryTable } from '../../lib/rfCountryTables'
import { wirelessRigTable, channelBandStatus } from '../../lib/wirelessRigExport'
import { csvFromTable } from '../../lib/documentStamp'
import { buildPacketHtml, sheetFromTable } from '../../lib/documentPacket'
import { printHtmlDocument } from '../../lib/printHtml'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { downloadBlob } from '../../lib/downloadBlob'
import { PanelHint } from '../shared/PanelHint'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import { Icon } from '../shared/Icon'

// ─────────────────────────────────────────────────────────────────────────────
// Funkstrecken / Gesang — Kanalplan: je Kanal Body + kompatible Kapsel/Headset +
// Frequenz. Nur kompatible Mics werden zur Auswahl angeboten (Fassung/Stecker
// müssen passen), inkompatible Alt-Zuordnungen werden markiert. RF-Koordination
// meldet Trägerabstand + Intermodulation 3. Ordnung (WWB-Prinzip).
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = 'rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-sm'

export const WirelessRigDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.wirelessRigOpen)
  const setOpen = useUiStore((s) => s.setWirelessRigOpen)
  const rig = useProjectStore((s) => s.project.wirelessRig)
  const project = useProjectStore((s) => s.project)
  const setRig = useProjectStore((s) => s.setWirelessRig)

  const counter = useRef(0)
  const nextId = () => `wc${Date.now().toString(36)}-${counter.current++}`

  const plan: WirelessRigPlan = rig ?? emptyWirelessRig()
  const commit = (next: WirelessRigPlan) => setRig(next)

  const bodies = useMemo(() => wirelessBodies(), [])

  // BEDARF 95 — die uebrigen Sender des Plans. Ohne sie meldete diese Ansicht
  // „frei", waehrend daneben ein Kamera-Rueckweg auf einer Nachbarfrequenz
  // sendete. Nur die FREMDEN: die eigenen Kanaele bringt `deriveRig` selbst
  // mit, und sie doppelt einzuspeisen erzeugte Konflikte mit sich selbst.
  const fremde = useMemo(
    () =>
      collectTransmitters(project)
        .entries.filter((e) => e.source !== 'rig')
        .map((e) => ({ id: e.id, label: e.carrier ? `${e.label} (${e.carrier})` : e.label, mhz: e.mhz })),
    [project],
  )
  const derivation = useMemo(() => deriveRig(plan, undefined, fremde), [plan, fremde])
  const conflictIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of derivation.rfConflicts) for (const id of c.ids) s.add(id)
    return s
  }, [derivation])

  const [freqDraft, setFreqDraft] = useState<Record<string, string>>({})
  // #1002 — Laendertabelle auf Knopfdruck, Baender nur mit Herstellerquelle.
  const [showTable, setShowTable] = useState(false)
  const bandGroups = useMemo(() => {
    const m = new Map<string, RfBand[]>()
    for (const b of selectableBands()) {
      const g = `${b.mfr} ${b.line}`
      m.set(g, [...(m.get(g) ?? []), b])
    }
    return [...m.entries()]
  }, [])
  const table = countryTable(plan.country)

  // Phase 3 der UI-Pruefung: Escape, Fokus-Falle und Fokus-Rueckgabe aus dem
  // Haken. Vor dem bedingten Ausstieg, weil Haken nicht bedingt laufen.
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, () => setOpen(false))

  // B-44 — der Hintergrund schliesst, aus derselben Quelle wie ueberall.
  const backdrop = useBackdropClose(() => setOpen(false))

  if (!open) return null

  const addChannel = () => {
    const n = plan.channels.length + 1
    commit({ ...plan, channels: [...plan.channels, { id: nextId(), label: `${t('wireless.channel', 'Channel')} ${n}` }] })
  }
  const updateChannel = (id: string, patch: Partial<WirelessChannel>) =>
    commit({ ...plan, channels: plan.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const projectName = project.metadata.name || 'cable-planner'
  const exportCsv = () =>
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'funkstrecken', 'csv'),
      csvFromTable(wirelessRigTable(plan)),
      'text/csv;charset=utf-8',
    )
  const printList = () =>
    printHtmlDocument(
      buildPacketHtml(projectName, [
        sheetFromTable(
          t('wireless.listTitle', 'Wireless channel list'),
          wirelessRigTable(plan),
          undefined,
          table ? `${t(`wireless.country.${table.code}`, table.name)} · ${table.regulator}` : undefined,
        ),
      ]),
    )
  const removeChannel = (id: string) =>
    commit({ ...plan, channels: plan.channels.filter((c) => c.id !== id) })

  // Kompatible Mics für den gewählten Body (Kapseln ODER Headsets/Lavaliere).
  const micOptionsFor = (bodyId?: string) => {
    const body = bodyId ? wirelessById(bodyId) : undefined
    if (!body) return []
    if (body.role === 'handheldBody') return compatibleCapsules(body, WIRELESS_CATALOG)
    if (body.role === 'bodypackBody') return compatibleBodypackMics(body, WIRELESS_CATALOG)
    return []
  }

  const compatBadge = (compat: string) => {
    if (compat === 'ok')
      return (
        <span className="flex items-center gap-1 text-emerald-500" title={t('wireless.compatOk', 'compatible')}>
          <Check size={13} />
        </span>
      )
    if (compat === 'incompatible')
      return (
        <span className="flex items-center gap-1 text-cp-danger" title={t('wireless.compatBad', 'body and mic do not fit together')}>
          <AlertTriangle size={13} />
        </span>
      )
    return <span className="text-cp-text-faint">—</span>
  }

  return (
    <div
      {...backdrop}
      className="fixed inset-0 z-[200] flex items-center justify-center cp-scrim p-4"
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden border border-cp-border bg-cp-bg"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-cp-border-muted px-4 py-2.5">
          <h2 id={titleId} className="flex items-center gap-2 text-cp-lg font-semibold">
            <Radio size={18} /> {t('wireless.title', 'Wireless / vocals')}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2 py-1 text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text"
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </header>

        {/* Toolbar + Zusammenfassung */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-cp-border-muted px-4 py-2 text-cp-sm">
          <button
            type="button"
            onClick={addChannel}
            className="flex items-center gap-1 bg-cp-ok text-white px-2.5 py-1.5 text-cp-xs hover:brightness-110"
          >
            <Plus size={14} /> {t('wireless.addChannel', 'Channel')}
          </button>
          <span className="bg-cp-surface-3 px-2 py-1 text-cp-xs text-cp-text-secondary">
            {format(t('wireless.summary', '{n} channels'), { n: derivation.channelCount })}
          </span>
          {derivation.incompatibleCount > 0 && (
            <span className="flex items-center gap-1 bg-cp-danger/20 px-2 py-1 text-cp-xs text-cp-danger">
              <AlertTriangle size={12} /> {format(t('wireless.incompat', '{n} incompatible'), { n: derivation.incompatibleCount })}
            </span>
          )}
          {derivation.rfConflicts.length > 0 && (
            <span className="flex items-center gap-1 bg-cp-warn/20 px-2 py-1 text-cp-xs text-cp-warn">
              <AlertTriangle size={12} /> {format(t('wireless.rfConflicts', '{n} RF conflicts'), { n: derivation.rfConflicts.length })}
            </span>
          )}
          <span className="ml-auto" />
          <select
            value={plan.country ?? ''}
            onChange={(e) => commit({ ...plan, country: e.target.value || undefined })}
            aria-label={t('wireless.country', 'Country')}
            className={inputCls}
          >
            <option value="">{t('wireless.noCountry', '— country —')}</option>
            {RF_COUNTRY_TABLES.map((c) => (
              <option key={c.code} value={c.code}>{t(`wireless.country.${c.code}`, c.name)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            disabled={!table}
            aria-pressed={showTable}
            className="flex items-center gap-1 bg-cp-surface-3 px-2 py-1.5 text-cp-xs hover:bg-cp-surface-4 disabled:opacity-40"
          >
            <Table2 size={13} /> {t('wireless.freqTable', 'Frequency table')}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={plan.channels.length === 0}
            className="flex items-center gap-1 bg-cp-surface-3 px-2 py-1.5 text-cp-xs hover:bg-cp-surface-4 disabled:opacity-40"
          >
            <Download size={13} /> CSV
          </button>
          <button
            type="button"
            onClick={printList}
            disabled={plan.channels.length === 0}
            className="flex items-center gap-1 bg-cp-accent text-cp-accent-text px-2 py-1.5 text-cp-xs hover:bg-cp-accent-hover disabled:opacity-40"
          >
            <Printer size={13} /> {t('wireless.print', 'Print / PDF')}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 text-cp-sm">
          {showTable && table && (
            <div className="mb-4 overflow-x-auto border border-cp-border">
              <table className="w-full border-collapse text-left text-cp-xs">
                <thead className="bg-cp-surface-2 text-cp-text-muted">
                  <tr>
                    <th className="px-2 py-1 font-medium">MHz</th>
                    <th className="px-2 py-1 font-medium">{t('wireless.maxPower', 'Max. power')}</th>
                    <th className="px-2 py-1 font-medium">{t('wireless.use', 'Who may use')}</th>
                    <th className="px-2 py-1 font-medium">{t('wireless.conditions', 'Conditions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.ranges.map((r) => (
                    <tr key={`${r.fromMHz}-${r.toMHz}`} className="border-t border-cp-border-muted">
                      <td className="px-2 py-1 tabular-nums">{r.fromMHz}–{r.toMHz}</td>
                      <td className="px-2 py-1">{r.maxPower ?? '—'}</td>
                      <td className="px-2 py-1">
                        {r.use === 'professional'
                          ? t('wireless.useProfessional', 'professional production only')
                          : t('wireless.useGeneral', 'general public')}
                      </td>
                      <td className="px-2 py-1 text-cp-text-secondary">
                        {r.note}{' '}
                        <a href={r.source} target="_blank" rel="noreferrer" className="text-cp-accent underline">
                          {t('wireless.source', 'source')}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {plan.channels.length === 0 ? (
            <div className="border border-dashed border-cp-border py-12 text-center text-cp-text-muted">
              {t('wireless.empty', 'No channels yet. Add a channel and assign body + capsule/headset.')}
            </div>
          ) : (
            <div className="overflow-x-auto border border-cp-border">
              <table className="w-full border-collapse text-left">
                <thead className="bg-cp-surface-2 text-cp-text-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.channel', 'Channel')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.body', 'Transmitter (body)')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.mic', 'Capsule / headset')}</th>
                    <th className="px-2 py-1.5 text-center font-medium" title={t('wireless.compat', 'Compatibility')}>
                      <Icon icon={Check} size="xs" label={t('wireless.compat', 'Compatibility')} />
                    </th>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.band', 'Band')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.freq', 'Frequency (MHz)')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.bandwidth', 'Bandwidth (kHz)')}</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {derivation.rows.map(({ channel, compat }) => {
                    const micOptions = micOptionsFor(channel.bodyDeviceTypeId)
                    const rfHit = conflictIds.has(channel.id)
                    const band = bandById(channel.bandId)
                    const st = channelBandStatus(plan, channel.id)
                    const outside = st.inBand === false || st.allowed === false
                    return (
                      <tr key={channel.id} className={`border-t border-cp-border-muted ${rfHit ? 'bg-cp-warn/10' : ''}`}>
                        <td className="px-2 py-1.5">
                          <input
                            value={channel.label}
                            onChange={(e) => updateChannel(channel.id, { label: e.target.value })}
                            className={`${inputCls} w-32`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={channel.bodyDeviceTypeId ?? ''}
                            onChange={(e) => updateChannel(channel.id, { bodyDeviceTypeId: e.target.value || undefined, micDeviceTypeId: undefined })}
                            className={`${inputCls} w-48`}
                          >
                            <option value="">{t('wireless.pickBody', '— pick body —')}</option>
                            <optgroup label={t('wireless.handheld', 'Handheld transmitters')}>
                              {bodies.filter((b) => b.role === 'handheldBody').map((b) => (
                                <option key={b.deviceTypeId} value={b.deviceTypeId}>{b.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label={t('wireless.bodypack', 'Bodypack transmitters')}>
                              {bodies.filter((b) => b.role === 'bodypackBody').map((b) => (
                                <option key={b.deviceTypeId} value={b.deviceTypeId}>{b.name}</option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={channel.micDeviceTypeId ?? ''}
                            disabled={!channel.bodyDeviceTypeId}
                            onChange={(e) => updateChannel(channel.id, { micDeviceTypeId: e.target.value || undefined })}
                            className={`${inputCls} w-56 disabled:opacity-50`}
                          >
                            <option value="">{t('wireless.pickMic', '— pick compatible —')}</option>
                            {/* Aktuelle (evtl. inkompatible) Zuordnung sichtbar halten. */}
                            {channel.micDeviceTypeId && !micOptions.some((m) => m.deviceTypeId === channel.micDeviceTypeId) && (
                              <option value={channel.micDeviceTypeId}>
                                {wirelessById(channel.micDeviceTypeId)?.name ?? '?'} ({t('wireless.incompatShort', 'incompatible')})
                              </option>
                            )}
                            {micOptions.map((m) => (
                              <option key={m.deviceTypeId} value={m.deviceTypeId}>{m.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">{compatBadge(compat)}</td>
                        <td className="px-2 py-1.5">
                          <select
                            value={channel.bandId ?? ''}
                            onChange={(e) => updateChannel(channel.id, { bandId: e.target.value || undefined })}
                            aria-label={t('wireless.band', 'Band')}
                            className={`${inputCls} w-40`}
                          >
                            <option value="">—</option>
                            {bandGroups.map(([g, list]) => (
                              <optgroup key={g} label={g}>
                                {list.map((b) => (
                                  <option key={bandId(b)} value={bandId(b)}>
                                    {b.band} · {b.fromMHz}–{b.toMHz}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={band?.fromMHz}
                            max={band?.toMHz}
                            title={outside ? t('wireless.outside', 'Outside the selected band or not allowed in the selected country') : undefined}
                            step="0.001"
                            value={freqDraft[channel.id] ?? (channel.frequencyMhz != null ? String(channel.frequencyMhz) : '')}
                            onChange={(e) => setFreqDraft((d) => ({ ...d, [channel.id]: e.target.value }))}
                            onBlur={(e) => {
                              const v = e.target.value.trim()
                              updateChannel(channel.id, { frequencyMhz: v === '' ? undefined : Number(v) })
                              setFreqDraft((d) => { const n = { ...d }; delete n[channel.id]; return n })
                            }}
                            placeholder="z.B. 502.375"
                            className={`${inputCls} w-28 ${rfHit || outside ? 'border-cp-warn' : ''}`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step="25"
                            value={channel.bandwidthKhz ?? ''}
                            onChange={(e) =>
                              updateChannel(channel.id, {
                                bandwidthKhz: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            aria-label={t('wireless.bandwidth', 'Bandwidth (kHz)')}
                            placeholder="200"
                            className={`${inputCls} w-20`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => removeChannel(channel.id)}
                            className="p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300"
                            title={t('common.delete', 'Delete')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* RF-Koordination */}
          {derivation.rfConflicts.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex items-center gap-2 text-cp-xs font-semibold text-cp-text-secondary">
                <AlertTriangle size={13} className="text-cp-warn" /> {t('wireless.rfTitle', 'RF coordination — conflicts')}
              </div>
              <ul className="space-y-1 border border-cp-warn/40 bg-cp-warn/5 p-2 text-cp-xs">
                {derivation.rfConflicts.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="bg-cp-surface-3 px-1.5 py-0.5 text-cp-xs text-cp-text-muted">
                      {c.kind === 'spacing' ? t('wireless.kindSpacing', 'spacing') : c.kind === 'imd3-2tx' ? 'IMD3·2' : 'IMD3·3'}
                    </span>
                    <span className="text-cp-text-secondary">{rfConflictText(c, t)}</span>
                  </li>
                ))}
              </ul>
              <PanelHint
                className="mt-1 text-cp-xs text-cp-text-muted"
                text={t('wireless.rfHint', 'Checked: carrier spacing + 3rd-order intermodulation (2- and 3-transmitter). Basic coordination like Wireless Workbench — not a substitute for an on-site spectrum scan.')}
              />
            </div>
          )}

          {/* BEDARF 114 — der Kanalplan oben gehört der PRODUKTION, die
              Zuordnung darunter der VORSTELLUNG. Beides in einem Fenster,
              weil wer zuordnet, die Frequenz daneben braucht. */}
          <MicPlotPanel />
        </div>
      </div>
    </div>
  )
}
