import { useMemo, useState } from 'react'
import { format, useTranslation } from '../../lib/i18n'
import {
  parseQuickPatch,
  quickPatchCommand,
  type QuickPatchError,
} from '../../lib/videohubQuickPatch'
import type { VideohubCrosspoints } from '../../types/equipment'

/**
 * #1184 — Schnellpatch: tippen statt klicken. Ein Feld, darunter die
 * Vorschau (was auf was geht, mit den Namen aus der Matrix) und der
 * Befehl, der an den Hub ginge. Ausgeloest wird erst per Knopf —
 * Enter uebernimmt in den Plan, nie live.
 */
export const VideohubQuickPatch = ({
  totalInputs,
  totalOutputs,
  inputLabels,
  outputLabels,
  lockedOutputs,
  onApplyPlan,
  onPatchLive,
  busy,
}: {
  totalInputs: number
  totalOutputs: number
  inputLabels: string[]
  outputLabels: string[]
  /** 0-basierte Ausgaenge, die laut zuletzt gelesenem Hub-Status von einem
   *  anderen Client gesperrt sind. */
  lockedOutputs: ReadonlySet<number>
  onApplyPlan: (crosspoints: VideohubCrosspoints) => void
  /** Fehlt, wenn keine Steuerung moeglich ist (Browser ohne Desktop-Bruecke). */
  onPatchLive?: (crosspoints: VideohubCrosspoints) => void
  busy?: boolean
}) => {
  const t = useTranslation()
  const [text, setText] = useState('')
  const r = useMemo(() => parseQuickPatch(text, totalInputs, totalOutputs), [text, totalInputs, totalOutputs])
  const anzahl = Object.keys(r.crosspoints).length
  const gesperrt = Object.keys(r.crosspoints)
    .map(Number)
    .filter((o) => lockedOutputs.has(o))
    .map((o) => o + 1)
  const fehlerText = (e: QuickPatchError): string => {
    switch (e.kind) {
      case 'zeichen':
        return format(t('videohub.quick.errChar', 'Unexpected "{c}" at position {pos}.'), { c: e.zeichen, pos: e.at + 1 })
      case 'ausgangOhneEingang':
        return t('videohub.quick.errOutputFirst', 'An output (o…) needs an input (i…) before it.')
      case 'eingangOhneAusgang':
        return format(t('videohub.quick.errNoOutput', 'Input {n} has no output.'), { n: e.input })
      case 'eingangAusserhalb':
        return format(t('videohub.quick.errInputRange', 'Input {n} does not exist (1–{max}).'), { n: e.input, max: e.max })
      case 'ausgangAusserhalb':
        return format(t('videohub.quick.errOutputRange', 'Output {n} does not exist (1–{max}).'), { n: e.output, max: e.max })
      case 'leer':
        return t('videohub.quick.errEmpty', 'Nothing to patch.')
    }
  }
  const name = (labels: string[], i: number) => labels[i - 1]?.trim()
  const uebernehmen = () => {
    if (anzahl === 0) return
    onApplyPlan(r.crosspoints)
    setText('')
  }

  return (
    <div className="mb-2 space-y-1 text-cp-xs">
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-cp-text-secondary">{t('videohub.quick.label', 'Quick patch')}</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') uebernehmen()
          }}
          placeholder="i1o4o7o11 i2o5"
          spellCheck={false}
          className="min-w-0 flex-1 border border-cp-border bg-cp-surface-1 p-1 font-mono"
          title={t(
            'videohub.quick.title',
            'i<input>o<output>o<output>… — e.g. i1o4o7 routes input 1 to outputs 4 and 7. Several blocks in a row. Enter applies to the plan.',
          )}
        />
        <button
          type="button"
          onClick={uebernehmen}
          disabled={anzahl === 0}
          className="bg-cp-surface-2 px-2 py-1 hover:bg-cp-surface-4 disabled:opacity-50"
        >
          {t('videohub.quick.applyPlan', 'Apply to plan')}
        </button>
        {onPatchLive && (
          <button
            type="button"
            onClick={() => onPatchLive(r.crosspoints)}
            disabled={anzahl === 0 || gesperrt.length > 0 || busy}
            className="bg-cp-accent px-2 py-1 text-cp-accent-text hover:bg-cp-accent-hover disabled:opacity-50"
            title={t(
              'videohub.quick.liveTitle',
              'Sends only these crosspoints to the hub, then reads the routing back as confirmation. The plan stays unchanged.',
            )}
          >
            {t('videohub.quick.patchLive', 'Patch live')}
          </button>
        )}
      </label>
      {text.trim() && (
        <div className="border border-cp-border-muted bg-cp-surface-3/40 p-1.5">
          {r.errors.length > 0 ? (
            <ul className="text-cp-danger">
              {r.errors.map((e, i) => (
                <li key={i}>{fehlerText(e)}</li>
              ))}
            </ul>
          ) : (
            <>
              <ul className="space-y-0.5 text-cp-text">
                {r.bloecke.map((b, i) => (
                  <li key={i}>
                    <span className="font-mono">In {b.input}</span>
                    {name(inputLabels, b.input) && <span className="text-cp-text-muted"> ({name(inputLabels, b.input)})</span>}
                    {' → '}
                    {b.outputs.map((o, j) => (
                      <span key={j}>
                        {j > 0 && ', '}
                        <span className="font-mono">Out {o}</span>
                        {name(outputLabels, o) && <span className="text-cp-text-muted"> ({name(outputLabels, o)})</span>}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              {r.doppelt.length > 0 && (
                <div className="text-cp-warn">
                  {format(t('videohub.quick.duplicate', 'Output(s) {list} appear more than once; the later block wins.'), {
                    list: r.doppelt.join(', '),
                  })}
                </div>
              )}
              {gesperrt.length > 0 && (
                <div className="text-cp-warn">
                  {format(t('videohub.quick.locked', 'Output(s) {list} are locked on the hub by another client — not patched live.'), {
                    list: gesperrt.join(', '),
                  })}
                </div>
              )}
              {onPatchLive && (
                <pre className="mt-1 whitespace-pre-wrap font-mono text-cp-text-faint" aria-label={t('videohub.quick.command', 'Command to the hub')}>
                  {quickPatchCommand(r.crosspoints).trim()}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
