import { useState, useMemo } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'

/**
 * #404 — Recording-Speicherplatz-Rechner. Separates Tool unter
 * "Werkzeuge" + zusaetzlich in den Properties einbindbar wenn
 * Geraete-Kategorie === "Recorder" (siehe RecordingStorageSection).
 *
 * Berechnung: bitrate [Mbps] × duration [Stunden] × 3600 / 8 = MB
 *  → /1024 = GB; mal Anzahl Kanaele.
 *
 * Codec-Bitrate-Presets sind Richtwerte fuer typische Broadcast-
 * Workflows (siehe https://www.tek.com/document/datasheet/dnxhd-codec).
 */

interface CodecPreset {
  id: string
  label: string
  /** Default-Bitrate pro Channel in Mbps */
  mbps: number
}

// 'custom'-Label wird zur Laufzeit uebersetzt (siehe codecOptionLabel).
const CODEC_PRESETS: CodecPreset[] = [
  { id: 'prores-422-hq', label: 'ProRes 422 HQ (1080p25)', mbps: 220 },
  { id: 'prores-422', label: 'ProRes 422 (1080p25)', mbps: 147 },
  { id: 'prores-422-lt', label: 'ProRes 422 LT (1080p25)', mbps: 102 },
  { id: 'prores-4444', label: 'ProRes 4444 (1080p25)', mbps: 330 },
  { id: 'prores-422-uhd', label: 'ProRes 422 (2160p25)', mbps: 491 },
  { id: 'prores-422-hq-uhd', label: 'ProRes 422 HQ (2160p25)', mbps: 737 },
  { id: 'dnxhd-220', label: 'DNxHD 220 (1080p25)', mbps: 220 },
  { id: 'dnxhd-145', label: 'DNxHD 145 (1080p25)', mbps: 145 },
  { id: 'dnxhd-36', label: 'DNxHD 36 (Proxy)', mbps: 36 },
  { id: 'h264-1080p', label: 'H.264 1080p (high)', mbps: 25 },
  { id: 'h265-uhd', label: 'H.265 2160p (high)', mbps: 50 },
  { id: 'xdcamhd-422-50', label: 'XDCAM HD422 50', mbps: 50 },
  { id: 'avc-intra-100', label: 'AVC-Intra 100', mbps: 100 },
  { id: 'custom', label: 'Custom (eigene Bitrate)', mbps: 100 },
]

const formatGb = (gb: number): string => {
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(gb * 1024).toFixed(0)} MB`
}

interface RecordingStorageCalcCoreProps {
  /** Wenn gesetzt, wird die Channel-Anzahl fixiert (z.B. bei Properties-
   *  Einbindung von einem Recorder mit X Inputs). */
  fixedChannels?: number
  /** Wenn gesetzt, wird der Codec-Picker vorbefuellt (z.B. wenn dasGeraet
   *  einen eigenen Codec-Default mitbringt). */
  initialCodecId?: string
}

export const RecordingStorageCalcCore = ({
  fixedChannels,
  initialCodecId,
}: RecordingStorageCalcCoreProps) => {
  const t = useTranslation()
  const [codecId, setCodecId] = useState<string>(initialCodecId ?? 'prores-422')
  const [customMbps, setCustomMbps] = useState<number>(100)
  const [hours, setHours] = useState<number>(2)
  const [minutes, setMinutes] = useState<number>(0)
  const [channels, setChannels] = useState<number>(fixedChannels ?? 1)
  // Array-Dimensionierung: Redundanz + Reserve + Laufwerksgröße → Laufwerksanzahl.
  const [redundancy, setRedundancy] = useState<'none' | 'raid5' | 'raid6' | 'mirror'>('none')
  const [headroomPercent, setHeadroomPercent] = useState<number>(20)
  const [driveTb, setDriveTb] = useState<number>(4)

  const codec = CODEC_PRESETS.find((c) => c.id === codecId) ?? CODEC_PRESETS[0]
  const effectiveMbps = codecId === 'custom' ? customMbps : codec.mbps
  const totalDurationHours = hours + minutes / 60

  const result = useMemo(() => {
    const channelGB = (effectiveMbps * totalDurationHours * 3600) / 8 / 1024
    return {
      perChannel: channelGB,
      total: channelGB * channels,
    }
  }, [effectiveMbps, totalDurationHours, channels])

  // Laufwerks-Dimensionierung: Nutzbedarf inkl. Reserve, dann je nach
  // Redundanzschema die Roh-Laufwerksanzahl (RAID-5 +1, RAID-6 +2, Mirror ×2).
  const sizing = useMemo(() => {
    const totalTb = result.total / 1024
    const factor = 1 - Math.min(90, Math.max(0, headroomPercent)) / 100
    const usableNeededTb = factor > 0 ? totalTb / factor : totalTb
    const dataDrives = driveTb > 0 ? Math.max(1, Math.ceil(usableNeededTb / driveTb)) : 0
    const totalDrives =
      redundancy === 'mirror'
        ? dataDrives * 2
        : redundancy === 'raid5'
          ? dataDrives + 1
          : redundancy === 'raid6'
            ? dataDrives + 2
            : dataDrives
    return { usableNeededTb, dataDrives, totalDrives, rawTb: totalDrives * driveTb }
  }, [result.total, headroomPercent, driveTb, redundancy])

  return (
    <div className="space-y-3 p-4 text-cp-base">
      <p className="text-[11px] text-cp-text-muted">
        {t(
          'recStorage.intro',
          'Berechnet den Speicherplatzbedarf für eine Aufzeichnung: Codec-Bitrate × Dauer × Kanäle. Werte sind Richtwerte ohne Filesystem-Overhead.',
        )}
      </p>

      <label className="block">
        <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('recStorage.codec', 'Codec / Bitrate-Preset')}</span>
        <select
          value={codecId}
          onChange={(e) => setCodecId(e.target.value)}
          className="w-full rounded border border-cp-border bg-cp-surface-3 p-2"
        >
          {CODEC_PRESETS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id === 'custom' ? t('recStorage.codecCustom', 'Custom (eigene Bitrate)') : c.label}
              {c.id === 'custom' ? '' : ` — ${c.mbps} Mbps`}
            </option>
          ))}
        </select>
      </label>

      {codecId === 'custom' && (
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('recStorage.customMbps', 'Eigene Bitrate (Mbps)')}</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={customMbps}
            onChange={(e) => setCustomMbps(Math.max(1, Number(e.target.value) || 100))}
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-2"
          />
        </label>
      )}

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('recStorage.hours', 'Stunden')}</span>
          <input
            type="number"
            min={0}
            max={9999}
            value={hours}
            onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('recStorage.minutes', 'Minuten')}</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('recStorage.channels', 'Kanäle')}</span>
          <input
            type="number"
            min={1}
            max={256}
            value={channels}
            disabled={fixedChannels !== undefined}
            onChange={(e) => setChannels(Math.max(1, Math.min(256, Number(e.target.value) || 1)))}
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 disabled:opacity-50"
          />
          {fixedChannels !== undefined && (
            <span className="mt-0.5 block text-[10px] text-cp-text-muted">
              {t('recStorage.fixedFromDevice', 'aus Gerät übernommen')}
            </span>
          )}
        </label>
      </div>

      <div className="rounded border border-emerald-700 bg-emerald-950/30 p-3">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-cp-xs">
          <dt className="text-cp-text-faint">{t('recStorage.effectiveBitrate', 'Effektive Bitrate')}</dt>
          <dd className="font-mono text-cp-text-bright">{effectiveMbps} Mbps</dd>
          <dt className="text-cp-text-faint">{t('recStorage.duration', 'Dauer')}</dt>
          <dd className="font-mono text-cp-text-bright">
            {hours}h {minutes}min ({totalDurationHours.toFixed(2)} h)
          </dd>
          <dt className="text-cp-text-faint">{t('recStorage.perChannel', 'Pro Kanal')}</dt>
          <dd className="font-mono text-cp-text-bright">{formatGb(result.perChannel)}</dd>
          <dt className="text-cp-text-faint font-semibold">
            {t('recStorage.total', 'Gesamt')} ({channels}× {t('recStorage.channels', 'Kanäle')})
          </dt>
          <dd className="font-mono text-cp-xl text-emerald-200">{formatGb(result.total)}</dd>
          {/* Schreib-Durchsatz: kann der Datenträger das mitschreiben? */}
          <dt className="text-cp-text-faint">{t('recStorage.throughput', 'Schreibrate')}</dt>
          <dd className="font-mono text-cp-text-bright">
            {((effectiveMbps * channels) / 8).toFixed(0)} MB/s
            <span className="ml-2 text-[10px] text-cp-text-muted">
              {(effectiveMbps * channels) / 8 > 2000
                ? t('recStorage.tpNvmeArray', '→ NVMe-RAID nötig')
                : (effectiveMbps * channels) / 8 > 450
                  ? t('recStorage.tpSsdArray', '→ SSD / HDD-RAID')
                  : (effectiveMbps * channels) / 8 > 130
                    ? t('recStorage.tpHdd', '→ einzelne HDD grenzwertig')
                    : t('recStorage.tpOk', '→ unkritisch')}
            </span>
          </dd>
        </dl>
      </div>

      {/* Array-Dimensionierung: wie viele Laufwerke brauche ich? */}
      <div className="rounded border border-sky-700 bg-sky-950/20 p-3">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-cp-text-secondary">
          {t('recStorage.sizing', 'Array-Dimensionierung')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] text-cp-text-muted">{t('recStorage.redundancy', 'Redundanz')}</span>
            <select
              value={redundancy}
              onChange={(e) => setRedundancy(e.target.value as typeof redundancy)}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
            >
              <option value="none">{t('recStorage.redNone', 'Keine (JBOD)')}</option>
              <option value="raid5">RAID 5 (+1)</option>
              <option value="raid6">RAID 6 (+2)</option>
              <option value="mirror">{t('recStorage.redMirror', 'Mirror (×2)')}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-cp-text-muted">{t('recStorage.headroom', 'Reserve (%)')}</span>
            <input
              type="number"
              min={0}
              max={90}
              value={headroomPercent}
              onChange={(e) => setHeadroomPercent(Math.min(90, Math.max(0, Number(e.target.value) || 0)))}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-cp-text-muted">{t('recStorage.driveTb', 'Laufwerk (TB)')}</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={driveTb}
              onChange={(e) => setDriveTb(Math.max(0.5, Number(e.target.value) || 0.5))}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
            />
          </label>
        </div>
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-cp-xs">
          <dt className="text-cp-text-faint">{t('recStorage.usableNeeded', 'Nutzbedarf inkl. Reserve')}</dt>
          <dd className="font-mono text-cp-text-bright">{sizing.usableNeededTb.toFixed(2)} TB</dd>
          <dt className="text-cp-text-faint font-semibold">{t('recStorage.drivesNeeded', 'Laufwerke nötig')}</dt>
          <dd className="font-mono text-cp-xl text-sky-200">
            {sizing.totalDrives} × {driveTb} TB
            <span className="ml-2 text-[10px] text-cp-text-muted">
              ({t('recStorage.rawCapacity', 'roh')} {sizing.rawTb.toFixed(1)} TB)
            </span>
          </dd>
        </dl>
      </div>

      <details className="rounded border border-cp-border-muted bg-cp-surface-3/40">
        <summary className="cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-wide text-cp-text-muted">
          {t('recStorage.formulaHeader', 'Formel')}
        </summary>
        <code className="block px-3 py-2 text-[11px] text-cp-text-secondary">
          {t('recStorage.formulaLine1', '(Mbps × 3600 s × Stunden) ÷ 8 ÷ 1024 = GB pro Kanal')}
          <br />
          {t('recStorage.formulaLine2', 'GB pro Kanal × Kanäle = Gesamt')}
        </code>
      </details>
    </div>
  )
}

export const RecordingStorageCalculatorDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.recordingStorageCalc.open)
  const close = useUiStore((s) => s.closeRecordingStorageCalc)
  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('recStorage.title', '💾 Recording-Speicherplatz-Rechner')}
      titleIcon="🧮"
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:rec-storage-calc"
    >
      <RecordingStorageCalcCore />
    </ModalShell>
  )
}
