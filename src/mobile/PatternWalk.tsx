import { useCallback, useEffect, useState } from 'react'
import { format, uebersetzer } from './i18n'

/**
 * Der Prüfbild-Rundgang am Telefon (B-42, Inkrement 2b).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS HIER STEHT — UND WAS AUSDRÜCKLICH KEINE RÜCKMELDUNG IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Je Ankunftsort: welcher Name laut Plan auf dem Bild stehen müsste. Das ist
 * die ERWARTUNG und nichts sonst. Diese App hat keinen Videoeingang; sie
 * sieht nicht, was auf dem Monitor steht, und ein Telefon, das eine
 * Erwartung wie eine Rückmeldung darstellt, ist genau die Falle aus
 * Invariante 16 — man liest „KAMERA 1", hält es für bestätigt und hat in
 * Wahrheit den Plan zweimal gelesen.
 *
 * Deshalb steht über der Liste, dass es der Plan ist, und die Antwort kommt
 * von dem Menschen, der davor steht.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DER GESEHENE NAME EIN EIGENES FELD IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * „Falsches Bild" sagt: irgendetwas stimmt nicht. „Es steht KAMERA 3 drauf"
 * sagt WAS nicht stimmt — und weil das Prüfbild den Namen seiner Quelle
 * trägt, ist diese eine Angabe der ganze Unterschied zwischen einem Befund
 * und einer Fehlersuche. Am Rechner macht `lib/patternDiagnose.ts` daraus
 * „diese beiden Ausgänge sind vertauscht".
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE OFFENEN WEGE STEHEN MIT DRIN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Wege, die der Plan nicht zu Ende kennt, mit ihrem Grund. Eine Liste, die
 * nur die sauberen Wege zeigt, schickt jemanden an sieben Monitore und
 * verschweigt den achten — und genau dort versteht später niemand, warum
 * kein Bild kommt.
 */

const t = uebersetzer()

export interface PatternShareStop {
  id: string
  equipmentId: string
  equipmentName: string
  portId: string
  portName: string
  weg: string
  erwartung: string
  hinweis: string
  befund: string
  geprueft: boolean
}

export interface PatternSharePlan {
  quelleId: string
  quellName: string
  stand: string
  ziele: PatternShareStop[]
  offen: PatternShareStop[]
}

/**
 * Die vier Beobachtungen — dieselben wie am Rechner.
 *
 * `wert` ist die Angabe, die ueber die Leitung geht, und bleibt deshalb
 * deutsch: der Server und `lib/patternDiagnose.ts` kennen genau diese vier
 * Zeichenketten. `schluessel`/`label` sind die Beschriftung und werden
 * uebersetzt. Die beiden zu vermischen hiesse, eine Sprachumstellung zu einer
 * Protokolländerung zu machen.
 */
export const BEOBACHTUNGEN = [
  { wert: 'stimmt', schluessel: 'mobile.walk.obsOk', label: 'matches' },
  { wert: 'falsches-bild', schluessel: 'mobile.walk.obsOther', label: 'different image…' },
  { wert: 'kein-bild', schluessel: 'mobile.walk.obsNone', label: 'no image' },
  { wert: 'kein-monitor', schluessel: 'mobile.walk.obsNoMonitor', label: 'no monitor' },
] as const

export type Beobachtung = (typeof BEOBACHTUNGEN)[number]['wert']

interface Props {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
  showId: string | null
  /** Ob der Schreibweg offen ist. Zu heisst: melden geht nicht. */
  schreibbar: boolean
  onClose: () => void
}

export function PatternWalk({ apiFetch, showId, schreibbar, onClose }: Props) {
  const [plan, setPlan] = useState<PatternSharePlan | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [wer, setWer] = useState(() => {
    try {
      return localStorage.getItem('cp.pattern.wer') ?? ''
    } catch {
      return ''
    }
  })
  const [nameOffen, setNameOffen] = useState<string | null>(null)
  const [gesehenerName, setGesehenerName] = useState('')
  const [gemeldet, setGemeldet] = useState<Record<string, string>>({})

  const laden = useCallback(async () => {
    setLaedt(true)
    setFehler(null)
    try {
      const res = await apiFetch('/pattern.json')
      if (res.status === 503) {
        // 503 heisst „keine Quelle gewaehlt" und NICHT „nirgends erwartet".
        // Die beiden zu verwechseln schickte jemanden auf einen Rundgang
        // ohne Ziel.
        setPlan(null)
        setFehler(t('mobile.walk.noSource', 'No test source is selected at the computer.'))
        return
      }
      if (!res.ok) {
        setFehler(
          format(t('mobile.walk.loadFailedStatus', 'The plan could not be loaded ({status}).'), {
            status: res.status,
          }),
        )
        return
      }
      setPlan((await res.json()) as PatternSharePlan)
    } catch (e) {
      setFehler(
        e instanceof Error ? e.message : t('mobile.walk.loadFailed', 'The plan could not be loaded.'),
      )
    } finally {
      setLaedt(false)
    }
  }, [apiFetch])

  useEffect(() => {
    void laden()
  }, [laden])

  const melde = async (stop: PatternShareStop, gesehen: Beobachtung, name?: string) => {
    setNameOffen(null)
    setGesehenerName('')
    // Sofort anzeigen, dass es raus ist — der Techniker steht vor dem Gerät
    // und geht weiter, sobald er den Knopf gedrückt hat. Scheitert es, wird
    // die Anzeige unten wieder korrigiert; ein stiller Fehlschlag wäre
    // schlimmer als ein lauter.
    setGemeldet((v) => ({ ...v, [stop.id]: t('mobile.walk.sending', 'sending …') }))
    try {
      const res = await apiFetch('/pattern-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: showId,
          quelleId: plan?.quelleId,
          equipmentId: stop.equipmentId,
          portId: stop.portId,
          gesehen,
          ...(name ? { gesehenerName: name } : {}),
          ...(wer.trim() ? { by: wer.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        setGemeldet((v) => ({
          ...v,
          [stop.id]: format(
            t('mobile.walk.notArrivedStatus', 'did not arrive ({status}) {text}'),
            { status: res.status, text },
          ).trim(),
        }))
        return
      }
      setGemeldet((v) => ({ ...v, [stop.id]: t('mobile.walk.reported', 'reported') }))
    } catch (e) {
      setGemeldet((v) => ({
        ...v,
        [stop.id]:
          e instanceof Error
            ? format(t('mobile.walk.notArrivedError', 'did not arrive: {error}'), {
                error: e.message,
              })
            : t('mobile.walk.notArrived', 'did not arrive'),
      }))
    }
  }

  const merkeWer = (v: string) => {
    setWer(v)
    try {
      localStorage.setItem('cp.pattern.wer', v)
    } catch {
      /* Privater Modus — dann eben jedes Mal neu. */
    }
  }

  const karte = (stop: PatternShareStop, offen: boolean) => {
    const status = gemeldet[stop.id]
    return (
      <div key={stop.id} className="rounded border border-cp-border bg-cp-surface-1 p-3">
        <div className="text-sm font-semibold text-cp-text">{stop.equipmentName}</div>
        <div className="text-xs text-cp-text-muted">{stop.portName}</div>
        {offen ? (
          <div className="mt-1 text-xs text-cp-warn">{stop.hinweis}</div>
        ) : (
          <div className="mt-1 text-xs text-cp-text-secondary">
            {t('mobile.walk.expected', 'According to the plan this should read:')}{' '}
            <span className="font-semibold text-cp-text">{stop.erwartung}</span>
          </div>
        )}
        <div className="mt-1 text-cp-xs text-cp-text-faint">{stop.weg}</div>
        {stop.befund && (
          <div className="mt-1 text-cp-xs text-cp-text-muted">
            {format(t('mobile.walk.last', 'Last: {befund}'), { befund: stop.befund })}
          </div>
        )}
        {schreibbar ? (
          <>
            <div className="mt-2 flex flex-wrap gap-1">
              {BEOBACHTUNGEN.map((b) => (
                <button
                  key={b.wert}
                  type="button"
                  onClick={() =>
                    b.wert === 'falsches-bild'
                      ? setNameOffen((v) => (v === stop.id ? null : stop.id))
                      : void melde(stop, b.wert)
                  }
                  className="rounded border border-cp-border px-2 py-1 text-xs text-cp-text-secondary active:bg-cp-surface-3"
                >
                  {t(b.schluessel, b.label)}
                </button>
              ))}
            </div>
            {nameOffen === stop.id && (
              <div className="mt-2 flex gap-1">
                <input
                  autoFocus
                  value={gesehenerName}
                  onChange={(e) => setGesehenerName(e.target.value)}
                  placeholder={t('mobile.walk.seenNamePlaceholder', 'Which name is on it?')}
                  className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-xs text-cp-text"
                />
                <button
                  type="button"
                  disabled={!gesehenerName.trim()}
                  onClick={() => void melde(stop, 'falsches-bild', gesehenerName.trim())}
                  className="rounded border border-cp-border px-2 py-1 text-xs disabled:opacity-40"
                >
                  {t('mobile.walk.remember', 'remember')}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-2 text-cp-xs text-cp-text-faint">
            {t(
              'mobile.walk.readOnly',
              'The return path is closed — set "Sharing" to contribute at the computer.',
            )}
          </div>
        )}
        {status && <div className="mt-1 text-cp-xs text-cp-text-muted">{status}</div>}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cp-bg p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-cp-text">
          {t('mobile.walk.heading', 'Test-pattern walk')}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-cp-border px-2 py-1 text-xs text-cp-text-secondary"
        >
          {t('mobile.close', 'Close')}
        </button>
      </div>

      {/* PFLICHT-BESCHRIFTUNG, nicht Zierde: was unten steht, ist der PLAN.
          Diese App sieht nicht, was auf dem Monitor steht (Invariante 16). */}
      <p className="mb-2 rounded border border-cp-border bg-cp-surface-2 p-2 text-cp-xs text-cp-text-secondary">
        {t(
          'mobile.walk.disclaimer',
          'Below is what should arrive according to the plan — not what does arrive. ' +
            'This app sees no image. What you report is what you see on the monitor.',
        )}
      </p>

      <label className="mb-2 block text-xs text-cp-text-muted">
        {t('mobile.walk.who', 'Who is checking')}
        <input
          value={wer}
          onChange={(e) => merkeWer(e.target.value)}
          placeholder={t('mobile.walk.namePlaceholder', 'Name (optional)')}
          className="mt-1 w-full rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
        />
      </label>

      <div className="flex-1 space-y-2 overflow-auto pb-6">
        {laedt && (
          <div className="text-xs text-cp-text-faint">{t('mobile.loadingShort', 'loading …')}</div>
        )}
        {fehler && (
          <div className="rounded border border-cp-warn/50 p-2 text-xs text-cp-warn">
            {fehler}{' '}
            <button type="button" onClick={() => void laden()} className="underline">
              {t('mobile.walk.retry', 'try again')}
            </button>
          </div>
        )}
        {plan && (
          <>
            <div className="text-xs text-cp-text-secondary">
              {t('mobile.walk.source', 'Source:')}{' '}
              <span className="font-semibold text-cp-text">{plan.quellName}</span> ·{' '}
              {format(t('mobile.walk.stops', '{n} arrival points'), { n: plan.ziele.length })}
              {plan.offen.length > 0
                ? format(t('mobile.walk.openCount', ' · {n} open'), { n: plan.offen.length })
                : ''}
            </div>
            {plan.ziele.map((z) => karte(z, false))}
            {plan.offen.length > 0 && (
              <>
                <div className="pt-2 text-xs font-semibold text-cp-warn">
                  {t('mobile.walk.openHeading', 'Paths the plan does not follow to the end')}
                </div>
                {plan.offen.map((o) => karte(o, true))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
