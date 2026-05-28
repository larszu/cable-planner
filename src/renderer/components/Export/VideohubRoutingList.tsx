import { useTranslation } from '../../lib/i18n'

interface Props {
  totalInputs: number
  totalOutputs: number
  inputLabels: string[]
  outputLabels: string[]
  routing: Record<number, number>
  onRoute: (output: number, input: number) => void
}

/**
 * v7.9.129 — Listen-Ansicht der Videohub-Routing-Tabelle.
 *
 * Eine alternative Darstellung zur Crosspoint-Matrix: pro Output
 * eine eigene Zeile mit Dropdown fuer den verbundenen Input.
 * Layout-Ideen aus VideoHubSim (github.com/videojedi/VideoHubSim,
 * MIT) — Nummer + Output-Label in Coral/Rot, Arrow, Dropdown mit
 * dem aktuellen Input-Label in Gruen, Platz fuer kuenftige Lock-
 * Buttons rechts. Implementation in unserem React/Tailwind-Stack.
 *
 * Vorteile gegenueber Matrix:
 *  - Volle Lesbarkeit aller Labels ohne Resize
 *  - Dropdown zeigt ALLE Inputs mit Nummer + voller Name
 *  - Funktioniert ohne horizontalen Scroll selbst bei 288×288
 *  - Erlaubt parallel Output-Search/Filter (Folge-Iteration)
 *
 * Bindings identisch zur Matrix-Variante: gleiche Props, gleiche
 * routing-Map, gleicher onRoute-Callback. User kann zwischen
 * beiden Views umschalten ohne State-Verlust.
 */
export const VideohubRoutingList = ({
  totalInputs,
  totalOutputs,
  inputLabels,
  outputLabels,
  routing,
  onRoute,
}: Props) => {
  const t = useTranslation()
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-900 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400">
        Routing-Liste · {totalOutputs} Outputs · {totalInputs} Inputs verfuegbar
      </div>
      <div
        className="space-y-1 overflow-auto p-2"
        style={{ maxHeight: '40rem' }}
      >
        {outputLabels.map((outLabel, oi) => {
          const routedIdx = routing[oi] ?? 0
          const routedLabel = inputLabels[routedIdx] ?? `Input ${routedIdx + 1}`
          return (
            <div
              key={oi}
              className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5 hover:bg-slate-800/50"
            >
              {/* Output-Nummer (mono, neutral) */}
              <span
                className="w-9 shrink-0 text-right font-mono text-[12px] font-semibold text-slate-400"
                title={`Output ${oi + 1}`}
              >
                {oi + 1}
              </span>
              {/* Output-Label */}
              <span
                className="w-48 shrink-0 truncate text-[13px] font-semibold text-slate-200"
                title={outLabel}
              >
                {outLabel}
              </span>
              {/* Lese-Richtung */}
              <span className="text-slate-500" aria-hidden>
                ←
              </span>
              {/* Input-Dropdown */}
              <select
                value={routedIdx}
                onChange={(e) => onRoute(oi, parseInt(e.target.value, 10))}
                className="flex-1 min-w-0 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[13px] text-slate-200 focus:border-sky-500 focus:outline-none"
                title={`Input fuer Output ${oi + 1} (${outLabel}) waehlen — aktuell: ${routedIdx + 1} ${routedLabel}`}
              >
                {inputLabels.map((inLabel, ii) => (
                  <option key={ii} value={ii} className="bg-slate-950 text-slate-100">
                    {ii + 1}: {inLabel}
                  </option>
                ))}
              </select>
              {/* Platzhalter fuer kuenftiges Lock-Icon */}
              <span
                className="w-7 shrink-0 text-center text-slate-700"
                aria-hidden
                title={t('videohub.lockSoon', 'Lock (folgt in spaeterer Iteration)')}
              >
                ⬚
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
