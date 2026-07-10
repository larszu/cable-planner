import { useMemo, useRef, useState } from 'react'
import { X, Plus, Trash2, Check, AlertTriangle, Radio } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation, format } from '../../lib/i18n'
import { WIRELESS_CATALOG, wirelessBodies, wirelessById } from '../../lib/wirelessCatalog'
import { compatibleCapsules, compatibleBodypackMics } from '../../lib/wirelessCompat'
import { emptyWirelessRig, deriveRig } from '../../lib/wirelessRig'
import type { WirelessRigPlan, WirelessChannel } from '../../types/wirelessRig'

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
  const setRig = useProjectStore((s) => s.setWirelessRig)

  const counter = useRef(0)
  const nextId = () => `wc${Date.now().toString(36)}-${counter.current++}`

  const plan: WirelessRigPlan = rig ?? emptyWirelessRig()
  const commit = (next: WirelessRigPlan) => setRig(next)

  const bodies = useMemo(() => wirelessBodies(), [])
  const derivation = useMemo(() => deriveRig(plan), [plan])
  const conflictIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of derivation.rfConflicts) for (const id of c.ids) s.add(id)
    return s
  }, [derivation])

  const [freqDraft, setFreqDraft] = useState<Record<string, string>>({})

  if (!open) return null

  const addChannel = () => {
    const n = plan.channels.length + 1
    commit({ ...plan, channels: [...plan.channels, { id: nextId(), label: `${t('wireless.channel', 'Kanal')} ${n}` }] })
  }
  const updateChannel = (id: string, patch: Partial<WirelessChannel>) =>
    commit({ ...plan, channels: plan.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
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
        <span className="flex items-center gap-1 text-emerald-500" title={t('wireless.compatOk', 'kompatibel')}>
          <Check size={13} />
        </span>
      )
    if (compat === 'incompatible')
      return (
        <span className="flex items-center gap-1 text-cp-danger" title={t('wireless.compatBad', 'Body und Mic passen nicht zusammen')}>
          <AlertTriangle size={13} />
        </span>
      )
    return <span className="text-cp-text-faint">—</span>
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-cp-border bg-cp-bg shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-cp-border-muted px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-cp-lg font-semibold">
            <Radio size={18} /> {t('wireless.title', 'Funkstrecken / Gesang')}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text"
            aria-label={t('common.close', 'Schließen')}
          >
            <X size={18} />
          </button>
        </header>

        {/* Toolbar + Zusammenfassung */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-cp-border-muted px-4 py-2 text-cp-sm">
          <button
            type="button"
            onClick={addChannel}
            className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 text-cp-xs hover:bg-emerald-600"
          >
            <Plus size={14} /> {t('wireless.addChannel', 'Kanal')}
          </button>
          <span className="rounded bg-cp-surface-3 px-2 py-1 text-cp-xs text-cp-text-secondary">
            {format(t('wireless.summary', '{n} Kanäle'), { n: derivation.channelCount })}
          </span>
          {derivation.incompatibleCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-cp-danger/20 px-2 py-1 text-cp-xs text-cp-danger">
              <AlertTriangle size={12} /> {format(t('wireless.incompat', '{n} inkompatibel'), { n: derivation.incompatibleCount })}
            </span>
          )}
          {derivation.rfConflicts.length > 0 && (
            <span className="flex items-center gap-1 rounded bg-cp-warn/20 px-2 py-1 text-cp-xs text-cp-warn">
              <AlertTriangle size={12} /> {format(t('wireless.rfConflicts', '{n} RF-Konflikte'), { n: derivation.rfConflicts.length })}
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 text-cp-sm">
          {plan.channels.length === 0 ? (
            <div className="rounded border border-dashed border-cp-border py-12 text-center text-cp-text-muted">
              {t('wireless.empty', 'Noch keine Kanäle. Lege einen Kanal an und weise Body + Kapsel/Headset zu.')}
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-cp-border">
              <table className="w-full border-collapse text-left">
                <thead className="bg-cp-surface-2 text-cp-text-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.channel', 'Kanal')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.body', 'Sender (Body)')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.mic', 'Kapsel / Headset')}</th>
                    <th className="px-2 py-1.5 text-center font-medium" title={t('wireless.compat', 'Kompatibilität')}>✓</th>
                    <th className="px-2 py-1.5 font-medium">{t('wireless.freq', 'Frequenz (MHz)')}</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {derivation.rows.map(({ channel, compat }) => {
                    const micOptions = micOptionsFor(channel.bodyDeviceTypeId)
                    const rfHit = conflictIds.has(channel.id)
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
                            <option value="">{t('wireless.pickBody', '— Body wählen —')}</option>
                            <optgroup label={t('wireless.handheld', 'Handsender')}>
                              {bodies.filter((b) => b.role === 'handheldBody').map((b) => (
                                <option key={b.deviceTypeId} value={b.deviceTypeId}>{b.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label={t('wireless.bodypack', 'Taschensender')}>
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
                            <option value="">{t('wireless.pickMic', '— kompatible wählen —')}</option>
                            {/* Aktuelle (evtl. inkompatible) Zuordnung sichtbar halten. */}
                            {channel.micDeviceTypeId && !micOptions.some((m) => m.deviceTypeId === channel.micDeviceTypeId) && (
                              <option value={channel.micDeviceTypeId}>
                                {wirelessById(channel.micDeviceTypeId)?.name ?? '?'} ({t('wireless.incompatShort', 'inkompatibel')})
                              </option>
                            )}
                            {micOptions.map((m) => (
                              <option key={m.deviceTypeId} value={m.deviceTypeId}>{m.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">{compatBadge(compat)}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.001"
                            value={freqDraft[channel.id] ?? (channel.frequencyMhz != null ? String(channel.frequencyMhz) : '')}
                            onChange={(e) => setFreqDraft((d) => ({ ...d, [channel.id]: e.target.value }))}
                            onBlur={(e) => {
                              const v = e.target.value.trim()
                              updateChannel(channel.id, { frequencyMhz: v === '' ? undefined : Number(v) })
                              setFreqDraft((d) => { const n = { ...d }; delete n[channel.id]; return n })
                            }}
                            placeholder="z.B. 502.375"
                            className={`${inputCls} w-28 ${rfHit ? 'border-cp-warn' : ''}`}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => removeChannel(channel.id)}
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
            </div>
          )}

          {/* RF-Koordination */}
          {derivation.rfConflicts.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex items-center gap-2 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-secondary">
                <AlertTriangle size={13} className="text-cp-warn" /> {t('wireless.rfTitle', 'RF-Koordination — Konflikte')}
              </div>
              <ul className="space-y-1 rounded border border-cp-warn/40 bg-cp-warn/5 p-2 text-cp-xs">
                {derivation.rfConflicts.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="rounded bg-cp-surface-3 px-1.5 py-0.5 text-[10px] text-cp-text-muted">
                      {c.kind === 'spacing' ? t('wireless.kindSpacing', 'Abstand') : c.kind === 'imd3-2tx' ? 'IMD3·2' : 'IMD3·3'}
                    </span>
                    <span className="text-cp-text-secondary">{c.message}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-cp-text-muted">
                {t('wireless.rfHint', 'Geprüft: Trägerabstand + Intermodulation 3. Ordnung (2- und 3-Sender). Grundkoordination wie in Wireless Workbench — kein Ersatz für einen Spektrum-Scan vor Ort.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
