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
    <div className="rounded-cp-control border border-cp-border bg-cp-surface-3">
      <div className="border-b border-cp-border-muted bg-cp-surface-1 px-3 py-2 text-[11px] uppercase tracking-wide text-cp-text-muted">
        {t('export.routingListHeader', 'Routing-Liste')} · {totalOutputs} Outputs · {totalInputs} {t('export.inputsAvailable', 'Inputs verfuegbar')}
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
              className="flex items-center gap-2 rounded border border-cp-border-muted bg-cp-surface-1/40 px-2 py-1.5 hover:bg-cp-surface-2/50"
            >
              {/* Output-Nummer (mono, neutral) */}
              <span
                className="w-9 shrink-0 text-right font-mono text-[12px] font-semibold text-cp-text-muted"
                title={`Output ${oi + 1}`}
              >
                {oi + 1}
              </span>
              {/* Output-Label */}
              <span
                className="w-48 shrink-0 truncate text-[13px] font-semibold text-cp-text-bright"
                title={outLabel}
              >
                {outLabel}
              </span>
              {/* Lese-Richtung */}
              <span className="text-cp-text-faint" aria-hidden>
                ←
              </span>
              {/* Input-Dropdown */}
              <select
                value={routedIdx}
                onChange={(e) => onRoute(oi, parseInt(e.target.value, 10))}
                className="flex-1 min-w-0 rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-[13px] text-cp-text-bright focus:border-sky-500 focus:outline-none"
                title={`${t('export.selectInputForOutput', 'Input fuer Output')} ${oi + 1} (${outLabel}) ${t('export.selectVerb', 'waehlen')} — ${t('export.currentLabel', 'aktuell')}: ${routedIdx + 1} ${routedLabel}`}
              >
                {inputLabels.map((inLabel, ii) => (
                  <option key={ii} value={ii} className="bg-cp-surface-3 text-cp-text">
                    {ii + 1}: {inLabel}
                  </option>
                ))}
              </select>
              {/* Platzhalter fuer kuenftiges Lock-Icon */}
              <span
                className="w-7 shrink-0 text-center text-cp-text-dimmer"
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
