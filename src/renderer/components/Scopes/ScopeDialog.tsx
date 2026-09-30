import { useProjectStore } from '../../store/projectStore'
import { useScopeStore } from '../../store/scopeStore'
import { format, useTranslation } from '../../lib/i18n'
import { scopeQuellName } from '../../lib/scopes'
import { ModalShell } from '../shared/ModalShell'
import ScopeMonitor from './ScopeMonitor'

const KEINE: string[] = []

/**
 * larszu/lz-scopes#15 — das grosse Scope-Panel. Es entsteht aus dem Canvas
 * (Doppelklick auf die Plakette, *Signal messen* am Kabel, *Scopes
 * vergleichen* an der Auswahl) und ist keine eigene Ansicht der App.
 *
 * EIN STROM: Waveform, Vectorscope, Parade, Histogramm. MEHRERE: je Quelle
 * eine Parade nebeneinander — zum Angleichen mehrerer Kameras. Jede Kachel
 * hat ihre Scope-Wahl im Kopf.
 */
export default function ScopeDialog() {
  const t = useTranslation()
  const ids = useScopeStore((s) => s.dialog?.streamIds ?? KEINE)
  const schliesse = useScopeStore((s) => s.schliesse)
  const equipment = useProjectStore((s) => s.project.equipment)

  const quellen = ids.flatMap((id) => {
    for (const e of equipment) {
      const stream = e.streams?.find((s) => s.id === id)
      if (stream) return [{ stream, name: scopeQuellName(e.name, stream) }]
    }
    return []
  })
  const vergleich = quellen.length > 1
  const spalten = quellen.length <= 1 ? 1 : quellen.length <= 4 ? 2 : 3

  return (
    <ModalShell
      open
      onClose={schliesse}
      maxWidth="full"
      scrollBody={false}
      draggableKey="cable-planner:modal-pos:scopes"
      title={
        vergleich
          ? format(t('scopes.dialog.compare', 'Compare scopes · {n} sources'), { n: String(quellen.length) })
          : format(t('scopes.dialog.single', 'Scopes · {name}'), { name: quellen[0]?.name ?? '' })
      }
    >
      {quellen.length === 0 ? (
        <p className="text-cp-sm text-cp-text-muted">
          {t('scopes.dialog.gone', 'The stream is no longer in the plan.')}
        </p>
      ) : (
        <div
          className="grid gap-2"
          style={{ height: '70vh', gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)' }}
        >
          {quellen.map(({ stream, name }) => (
            <div key={stream.id} className="flex min-h-0 flex-col border border-cp-border">
              {vergleich && <div className="cp-panel-head text-cp-xs">{name}</div>}
              <ScopeMonitor
                key={`${stream.id}|${stream.url ?? ''}|${stream.protocol}`}
                stream={stream}
                name={name}
                scopes={vergleich ? ['parade'] : ['wf-luma', 'vector', 'parade', 'hist']}
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  )
}
