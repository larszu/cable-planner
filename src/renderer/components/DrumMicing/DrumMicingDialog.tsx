import { useMemo, useRef, useState } from 'react'
import { X, Plus, Trash2, Zap, AlertTriangle, Wrench, Check } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { micTemplates } from '../../lib/micCatalog'
import {
  emptyDrumKit,
  applyTechnique,
  deriveDrumChannels,
  deriveDrumBom,
  drumBomToText,
  DRUM_TECHNIQUES,
} from '../../lib/drumMicing'
import type { DrumKitPlan, DrumMicPlacement, DrumTechnique, DrumZone } from '../../types/drumKit'

// ─────────────────────────────────────────────────────────────────────────────
// #Drum-Mikrofonierung — visuelles Schlagzeug (SVG-Draufsicht), Mic-Platzierung,
// Technik-Presets und live abgeleitete Kanalliste + Phantom-Bedarf.
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<DrumZone['kind'], string> = {
  kick: '#b45309',
  snare: '#0369a1',
  tom: '#4d7c0f',
  hihat: '#a16207',
  ride: '#7c3aed',
  crash: '#9333ea',
  overhead: '#0891b2',
  room: '#64748b',
}

const ZONE_R: Record<DrumZone['kind'], number> = {
  kick: 34,
  snare: 22,
  tom: 24,
  hihat: 20,
  ride: 22,
  crash: 22,
  overhead: 16,
  room: 14,
}

let idCounter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`

const ZONE_KIND_LABEL: Record<DrumZone['kind'], string> = {
  kick: 'Kick',
  snare: 'Snare',
  tom: 'Tom',
  hihat: 'HiHat',
  ride: 'Ride',
  crash: 'Crash',
  overhead: 'Overhead',
  room: 'Room',
}

/** Default-Label für eine neue Zone (nummeriert, wenn die Art schon existiert). */
const defaultZoneLabel = (kind: DrumZone['kind'], zones: DrumZone[]): string => {
  const same = zones.filter((z) => z.kind === kind).length
  const base = ZONE_KIND_LABEL[kind]
  return same === 0 ? base : `${base} ${same + 1}`
}

export const DrumMicingDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.drumMicingOpen)
  const setOpen = useUiStore((s) => s.setDrumMicingOpen)
  const drumKit = useProjectStore((s) => s.project.drumKit)
  const setDrumKit = useProjectStore((s) => s.setDrumKit)

  const plan: DrumKitPlan = drumKit ?? emptyDrumKit()
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [editKit, setEditKit] = useState(false)
  const [newZoneKind, setNewZoneKind] = useState<DrumZone['kind']>('tom')
  const [newZoneLabel, setNewZoneLabel] = useState('')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragId = useRef<string | null>(null)

  const derivation = useMemo(() => deriveDrumChannels(plan), [plan])
  const bom = useMemo(() => deriveDrumBom(plan), [plan])
  const micById = useMemo(() => new Map(micTemplates.map((m) => [m.deviceTypeId!, m])), [])
  const [copied, setCopied] = useState(false)
  const copyBom = () => {
    void navigator.clipboard?.writeText(drumBomToText(plan)).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  if (!open) return null

  const commit = (next: DrumKitPlan) => setDrumKit(next)

  const micsForZone = (zoneId: string) => plan.mics.filter((m) => m.zoneId === zoneId)

  const addMicToZone = (zoneId: string) => {
    const zone = plan.zones.find((z) => z.id === zoneId)
    const placement: DrumMicPlacement = {
      id: nextId('mic'),
      zoneId,
      channelLabel: zone?.label,
    }
    commit({ ...plan, mics: [...plan.mics, placement], technique: 'custom' })
  }

  const setMicModel = (placementId: string, deviceTypeId: string) => {
    const tmpl = deviceTypeId ? micById.get(deviceTypeId) : undefined
    commit({
      ...plan,
      mics: plan.mics.map((m) =>
        m.id === placementId
          ? { ...m, micDeviceTypeId: deviceTypeId || undefined, micName: tmpl?.name }
          : m,
      ),
    })
  }

  const removeMic = (placementId: string) => {
    commit({ ...plan, mics: plan.mics.filter((m) => m.id !== placementId) })
  }

  const applyPreset = (tech: DrumTechnique) => {
    if (tech === 'custom') return
    const mics = applyTechnique(plan, tech, (zid) => nextId(`mic-${zid}`))
    commit({ ...plan, mics, technique: tech })
  }

  const clearAll = () => commit({ ...plan, mics: [], technique: 'custom' })

  const zoneMicCount = (zoneId: string) => micsForZone(zoneId).length

  // ── Kit-Bau: Zonen hinzufügen/umbenennen/löschen/verschieben ───────────────
  const addZone = () => {
    const label = newZoneLabel.trim() || defaultZoneLabel(newZoneKind, plan.zones)
    const zone: DrumZone = { id: nextId('zone'), label, kind: newZoneKind, x: 0.5, y: 0.5 }
    commit({ ...plan, zones: [...plan.zones, zone] })
    setNewZoneLabel('')
    setSelectedZone(zone.id)
  }
  const removeZone = (zoneId: string) => {
    commit({
      ...plan,
      zones: plan.zones.filter((z) => z.id !== zoneId),
      mics: plan.mics.filter((m) => m.zoneId !== zoneId), // Mics der Zone mit entfernen.
    })
    if (selectedZone === zoneId) setSelectedZone(null)
  }
  const renameZone = (zoneId: string, label: string) =>
    commit({ ...plan, zones: plan.zones.map((z) => (z.id === zoneId ? { ...z, label } : z)) })

  const moveZoneTo = (zoneId: string, clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
    commit({ ...plan, zones: plan.zones.map((z) => (z.id === zoneId ? { ...z, x, y } : z)) })
  }
  const onZonePointerDown = (zoneId: string) => (e: React.PointerEvent) => {
    if (!editKit) return
    e.preventDefault()
    dragId.current = zoneId
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (!editKit || !dragId.current) return
    moveZoneTo(dragId.current, e.clientX, e.clientY)
  }
  const onSvgPointerUp = () => {
    dragId.current = null
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-cp-border bg-cp-bg shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-cp-border-muted px-4 py-2.5">
          <h2 className="text-cp-lg font-semibold">
            {t('drum.title', 'Drum-Mikrofonierung')}
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

        {/* Technik-Presets */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-cp-border-muted px-4 py-2 text-cp-sm">
          <span className="text-cp-text-secondary">{t('drum.technique', 'Technik')}:</span>
          {(Object.keys(DRUM_TECHNIQUES) as (keyof typeof DRUM_TECHNIQUES)[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded border px-2 py-1 text-cp-xs ${
                plan.technique === key
                  ? 'border-cp-accent bg-cp-accent/15 text-cp-text'
                  : 'border-cp-border-muted text-cp-text-secondary hover:bg-cp-surface-2'
              }`}
            >
              {DRUM_TECHNIQUES[key].label.de}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditKit((v) => !v)}
            className={`ml-auto flex items-center gap-1 rounded border px-2 py-1 text-cp-xs ${
              editKit
                ? 'border-cp-accent bg-cp-accent/15 text-cp-text'
                : 'border-cp-border-muted text-cp-text-secondary hover:bg-cp-surface-2'
            }`}
          >
            {editKit ? <Check size={12} /> : <Wrench size={12} />}
            {editKit ? t('drum.editDone', 'Kit fertig') : t('drum.editKit', 'Kit bearbeiten')}
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded border border-cp-border-muted px-2 py-1 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-2"
          >
            {t('drum.clear', 'Alle Mics entfernen')}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1fr_320px]">
          {/* SVG-Kit */}
          <div className="min-h-0 overflow-auto bg-cp-surface-1/40 p-4">
            <svg
              ref={svgRef}
              viewBox="0 0 400 340"
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              className="mx-auto h-auto w-full max-w-lg select-none"
            >
              {plan.zones.map((z) => {
                const cx = z.x * 400
                const cy = z.y * 340
                const r = ZONE_R[z.kind]
                const count = zoneMicCount(z.id)
                const selected = selectedZone === z.id
                return (
                  <g
                    key={z.id}
                    onClick={() => setSelectedZone(z.id)}
                    onPointerDown={onZonePointerDown(z.id)}
                    className={editKit ? 'cursor-move' : 'cursor-pointer'}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={count > 0 ? ZONE_COLORS[z.kind] : 'transparent'}
                      fillOpacity={count > 0 ? 0.35 : 0}
                      stroke={ZONE_COLORS[z.kind]}
                      strokeWidth={selected ? 3 : 1.5}
                      strokeDasharray={count > 0 ? undefined : '4 3'}
                    />
                    <text x={cx} y={cy - r - 4} textAnchor="middle" className="fill-cp-text-secondary text-[9px]">
                      {z.label}
                    </text>
                    {count > 0 && (
                      <text x={cx} y={cy + 4} textAnchor="middle" className="fill-cp-text text-[11px] font-semibold">
                        {count > 1 ? `${count}×` : '●'}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
            <p className="mt-2 text-center text-cp-xs text-cp-text-faint">
              {t('drum.hint', 'Zone anklicken → rechts Mikrofon zuweisen. Presets oben setzen einen Startpunkt.')}
            </p>
          </div>

          {/* Rechte Spalte: gewählte Zone + Ableitungen */}
          <div className="flex min-h-0 flex-col overflow-y-auto border-t border-cp-border-muted md:border-l md:border-t-0">
            {/* Kit-Bau-Editor (nur im Bearbeiten-Modus) */}
            {editKit && (
              <div className="border-b border-cp-border-muted p-3">
                <h3 className="mb-2 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
                  {t('drum.kitEdit', 'Kit zusammenstellen')}
                </h3>
                <p className="mb-2 text-cp-xs text-cp-text-faint">
                  {t('drum.kitEditHint', 'Zonen im Bild per Drag verschieben. Unten hinzufügen/umbenennen/löschen.')}
                </p>
                <div className="mb-2 space-y-1">
                  {plan.zones.map((z) => (
                    <div key={z.id} className="flex items-center gap-1">
                      <span className="w-14 shrink-0 text-[10px] text-cp-text-faint">{ZONE_KIND_LABEL[z.kind]}</span>
                      <input
                        value={z.label}
                        onChange={(e) => renameZone(z.id, e.target.value)}
                        className="w-full rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-xs"
                      />
                      <button type="button" onClick={() => removeZone(z.id)} className="shrink-0 text-cp-danger" title={t('common.delete', 'Löschen')}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-1">
                  <select
                    value={newZoneKind}
                    onChange={(e) => setNewZoneKind(e.target.value as DrumZone['kind'])}
                    className="rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-xs"
                  >
                    {(Object.keys(ZONE_KIND_LABEL) as DrumZone['kind'][]).map((k) => (
                      <option key={k} value={k}>
                        {ZONE_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newZoneLabel}
                    onChange={(e) => setNewZoneLabel(e.target.value)}
                    placeholder={defaultZoneLabel(newZoneKind, plan.zones)}
                    className="w-full rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-xs"
                  />
                  <button type="button" onClick={addZone} className="flex shrink-0 items-center gap-1 rounded bg-sky-700 px-2 py-1 text-cp-xs text-white hover:bg-sky-600">
                    <Plus size={12} /> {t('drum.addZone', 'Zone')}
                  </button>
                </div>
              </div>
            )}

            {/* Zone-Editor */}
            <div className="border-b border-cp-border-muted p-3">
              {selectedZone ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-cp-sm font-semibold text-cp-text">
                      {plan.zones.find((z) => z.id === selectedZone)?.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => addMicToZone(selectedZone)}
                      className="flex items-center gap-1 rounded bg-sky-700 px-2 py-1 text-cp-xs text-white hover:bg-sky-600"
                    >
                      <Plus size={12} /> {t('drum.addMic', 'Mic')}
                    </button>
                  </div>
                  {micsForZone(selectedZone).length === 0 && (
                    <p className="text-cp-xs text-cp-text-faint">{t('drum.noMic', 'Noch kein Mikrofon auf dieser Zone.')}</p>
                  )}
                  {micsForZone(selectedZone).map((m) => {
                    const resolved = m.micDeviceTypeId ? micById.get(m.micDeviceTypeId) : undefined
                    const phantom = resolved?.categoryProps?.powering === 'p48'
                    return (
                      <div key={m.id} className="mb-1.5 rounded border border-cp-border-muted bg-cp-surface-2/40 p-1.5">
                        <div className="flex items-center gap-1">
                          <select
                            value={m.micDeviceTypeId ?? ''}
                            onChange={(e) => setMicModel(m.id, e.target.value)}
                            className="w-full rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-xs"
                          >
                            <option value="">{t('drum.pickMic', '— Mikrofon wählen —')}</option>
                            {micTemplates.map((tmpl) => (
                              <option key={tmpl.deviceTypeId} value={tmpl.deviceTypeId}>
                                {tmpl.name}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => removeMic(m.id)} className="shrink-0 text-cp-danger">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {phantom && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500">
                            <Zap size={10} /> {t('drum.phantom', '48V Phantom nötig')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              ) : (
                <p className="text-cp-xs text-cp-text-faint">{t('drum.selectZone', 'Zone im Kit anklicken.')}</p>
              )}
            </div>

            {/* Ableitungen */}
            <div className="p-3">
              <h3 className="mb-2 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
                {t('drum.summary', 'Kanalliste & Bedarf')}
              </h3>
              <div className="mb-2 flex flex-wrap gap-2 text-cp-xs">
                <span className="rounded bg-cp-surface-2 px-2 py-0.5 text-cp-text-secondary">
                  {derivation.channelCount} {t('drum.channels', 'Kanäle')}
                </span>
                <span className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-amber-500">
                  <Zap size={11} /> {derivation.phantomCount}× 48V
                </span>
                {derivation.unknownCount > 0 && (
                  <span className="flex items-center gap-1 rounded bg-cp-warn/15 px-2 py-0.5 text-cp-warn">
                    <AlertTriangle size={11} /> {derivation.unknownCount} {t('drum.unknown', 'ohne Mic')}
                  </span>
                )}
                {derivation.splRiskCount > 0 && (
                  <span
                    className="flex items-center gap-1 rounded bg-cp-danger/15 px-2 py-0.5 text-cp-danger"
                    title={t('drum.splHint', 'Max SPL < 140 dB an Kick/Snare — ein Snare-Schlag kann 156 dB überschreiten (DPA).')}
                  >
                    <AlertTriangle size={11} /> {derivation.splRiskCount}× {t('drum.spl', 'SPL grenzwertig')}
                  </span>
                )}
              </div>
              <table className="w-full text-cp-xs">
                <tbody>
                  {derivation.channels.map((c) => (
                    <tr key={c.channel} className="border-b border-cp-border-muted/50">
                      <td className="py-0.5 pr-1 text-cp-text-faint">{c.channel}</td>
                      <td className="py-0.5 pr-1 text-cp-text-secondary">{c.label}</td>
                      <td className="py-0.5 text-cp-text">
                        {c.micUnknown ? <span className="text-cp-warn">{t('drum.pending', '(Mic offen)')}</span> : c.micName}
                      </td>
                      <td className="py-0.5 text-right">
                        {c.splRisk && <AlertTriangle size={11} className="inline text-cp-danger" />}
                        {c.needsPhantom && <Zap size={11} className="ml-1 inline text-amber-500" />}
                        {c.stereoGroup && <span className="ml-1 text-cp-text-faint">⚭</span>}
                      </td>
                    </tr>
                  ))}
                  {derivation.channels.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-2 text-cp-text-faint">
                        {t('drum.emptyList', 'Noch keine Mikrofone platziert.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Materialliste (BOM) */}
              {bom.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
                      {t('drum.bom', 'Materialliste')}
                    </h3>
                    <button
                      type="button"
                      onClick={copyBom}
                      className="rounded border border-cp-border-muted px-2 py-0.5 text-[10px] text-cp-text-secondary hover:bg-cp-surface-2"
                    >
                      {copied ? t('drum.copied', 'kopiert ✓') : t('drum.copy', 'kopieren')}
                    </button>
                  </div>
                  <table className="w-full text-cp-xs">
                    <tbody>
                      {bom.map((r) => (
                        <tr key={r.item} className="border-b border-cp-border-muted/50">
                          <td className="w-8 py-0.5 text-cp-text-faint">{r.qty}×</td>
                          <td className="py-0.5 text-cp-text-secondary">{r.item}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
