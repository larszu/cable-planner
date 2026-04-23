import { useMemo, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { guessVideohubPresetKey } from '../../lib/deviceKind'
import {
  buildVideohubLabelTxt,
  buildVideohubRoutingDump,
  videohubPresets,
} from '../../lib/exportVideohub'
import { VideohubRoutingMatrix } from './VideohubRoutingMatrix'

interface Props {
  onClose: () => void
  preselectedDeviceId?: string
}

type Format = 'labels' | 'routing'

const buildDefaultRouting = (totalIn: number, totalOut: number): Record<number, number> => {
  const r: Record<number, number> = {}
  for (let i = 0; i < totalOut; i++) r[i] = i < totalIn ? i : 0
  return r
}

const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const VideohubExportDialog = ({ onClose, preselectedDeviceId }: Props) => {
  const equipment = useProjectStore((s) => s.project.equipment)
  const [deviceId, setDeviceId] = useState<string>(() => {
    if (preselectedDeviceId && equipment.some((e) => e.id === preselectedDeviceId)) {
      return preselectedDeviceId
    }
    // Default to the first device that looks like a Videohub
    const vh = equipment.find((e) => /videohub|crosspoint|crossbar|router/i.test(e.name))
    return vh?.id ?? equipment[0]?.id ?? ''
  })
  const [format, setFormat] = useState<Format>('routing')
  const initialDevice = equipment.find((e) => e.id === deviceId)
  const [presetKey, setPresetKey] = useState<string>(() =>
    initialDevice ? guessVideohubPresetKey(initialDevice) : 'smart-40x40-12g',
  )
  const [friendlyName, setFriendlyName] = useState<string>('')
  const [showMatrix, setShowMatrix] = useState(false)
  const [routing, setRouting] = useState<Record<number, number>>(() => {
    const key = initialDevice ? guessVideohubPresetKey(initialDevice) : 'smart-40x40-12g'
    const p = videohubPresets.find((x) => x.key === key) ?? videohubPresets[0]
    return buildDefaultRouting(p.inputs, p.outputs)
  })

  const device = equipment.find((e) => e.id === deviceId)
  const preset = videohubPresets.find((p) => p.key === presetKey) ?? videohubPresets[0]

  const preview = useMemo(() => {
    if (!device) return ''
    if (format === 'labels') {
      return buildVideohubLabelTxt(device, {
        totalInputs: preset.inputs,
        totalOutputs: preset.outputs,
      })
    }
    return buildVideohubRoutingDump(device, {
      modelName: preset.model,
      friendlyName: friendlyName.trim() || device.name,
      totalInputs: preset.inputs,
      totalOutputs: preset.outputs,
      routing,
    })
  }, [device, format, preset, friendlyName, routing])

  const handleExport = () => {
    if (!device) return
    const safeName = (device.name || 'Videohub').replace(/[^\w.-]+/g, '_')
    const ext = format === 'labels' ? 'txt' : 'txt'
    const suffix = format === 'labels' ? 'labels' : 'routing'
    downloadTextFile(`${safeName}_${preset.key}_${suffix}.${ext}`, preview)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(preview).catch(() => {
      /* ignore */
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Export → Blackmagic Videohub</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            Gerät auf dem Canvas
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              <option value="">— Gerät wählen —</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.inputs.length}/{e.outputs.length})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            Videohub-Modell
            <select
              value={presetKey}
              onChange={(e) => {
                const key = e.target.value
                setPresetKey(key)
                const p = videohubPresets.find((x) => x.key === key) ?? videohubPresets[0]
                setRouting(buildDefaultRouting(p.inputs, p.outputs))
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              {videohubPresets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.model} ({p.inputs}×{p.outputs})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            Format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              <option value="routing">Voller Routing-Dump (Protokoll 2.5)</option>
              <option value="labels">Nur Labels (Input, n, Name)</option>
            </select>
          </label>

          <label className="block">
            Friendly Name {format === 'labels' && <span className="text-slate-500">(ignoriert)</span>}
            <input
              value={friendlyName}
              placeholder={device?.name ?? ''}
              onChange={(e) => setFriendlyName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>
        </div>

        {device && (device.inputs.length > preset.inputs || device.outputs.length > preset.outputs) && (
          <div className="mb-2 rounded bg-amber-950 p-2 text-xs text-amber-300">
            Warnung: Das Gerät hat mehr Ports ({device.inputs.length} IN / {device.outputs.length} OUT)
            als das gewählte Modell ({preset.inputs}×{preset.outputs}). Überschüssige Ports werden
            abgeschnitten.
          </div>
        )}

        {format === 'routing' && (
          <div className="mb-3">
            <div className="mb-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMatrix((m) => !m)}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                {showMatrix ? '▼' : '▶'} Routing-Matrix
              </button>
              <span className="text-xs text-slate-500">
                {preset.inputs} Eing. × {preset.outputs} Ausg.
              </span>
              <button
                type="button"
                onClick={() => setRouting(buildDefaultRouting(preset.inputs, preset.outputs))}
                className="ml-auto rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
                title="Diagonal-Routing zurücksetzen (Ausgang N → Eingang N)"
              >
                ↺ Reset
              </button>
            </div>
            {showMatrix && (
              <VideohubRoutingMatrix
                totalInputs={preset.inputs}
                totalOutputs={preset.outputs}
                inputLabels={Array.from(
                  { length: preset.inputs },
                  (_, i) => device?.inputs[i]?.name ?? `In ${i + 1}`,
                )}
                outputLabels={Array.from(
                  { length: preset.outputs },
                  (_, i) => device?.outputs[i]?.name ?? `Out ${i + 1}`,
                )}
                routing={routing}
                onRoute={(output, input) => setRouting((r) => ({ ...r, [output]: input }))}
              />
            )}
          </div>
        )}

        <div className="mb-2 text-xs text-slate-400">Vorschau</div>
        <textarea
          readOnly
          value={preview}
          className="flex-1 min-h-[200px] rounded border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] text-slate-200"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!device}
            className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600 disabled:opacity-40"
          >
            In Zwischenablage
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!device}
            className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500 disabled:opacity-40"
          >
            Als Datei speichern
          </button>
        </div>
      </div>
    </div>
  )
}
