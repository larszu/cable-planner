import { useCallback, useEffect, useState } from 'react'
import { Radio } from 'lucide-react'
import { cablePlannerApi } from '../../lib/bridge'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { CompanionStandSection } from './CompanionStandSection'
import { Icon } from '../shared/Icon'
import {
  LAUSCHER_LAGE_LABEL,
  OSC_LAUSCHER_AUS,
  empfangsText,
  type LauscherZustand,
  type OscEmpfang,
} from '../../types/showControl'

/**
 * Die MITSCHRIFT eingehender OSC-Nachrichten (E-23).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DIESES PANEL NICHT IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Es ist kein Anlagen-Monitor. Die Bedarfs-Datenbank verbietet ausdrücklich
 * ein „live monitoring dashboard, which would make the suite responsible for
 * a false all-clear", und die Entscheidung E-23 hat daraus die Bedingung
 * gemacht, unter der der eingehende Teil überhaupt gebaut werden durfte:
 *
 *   Was aus einer eingehenden Nachricht auf den Schirm kommt, ist eine
 *   EMPFANGSMELDUNG und nie ein Anlagenzustand.
 *
 * Deshalb steht hier eine Liste mit Zeitpunkt, Absender und ALTER — und
 * keine Ampel, kein „bereit", kein Gerätename, der aus einer Adresse
 * geraten wäre. „Cue 12 um 14:22:07 von 10.0.0.5 empfangen (vor 3 s)" sagt
 * genau so viel, wie der Plan weiss. „Kamera 3 bereit" sagte mehr.
 *
 * Das Alter ist keine Zierde: eine Zeile von vor zwei Stunden sieht ohne es
 * aus wie eine von eben — und genau daraus würde jemand einen Zustand lesen.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * UND WARUM DER NICHT-GEBUNDEN-FALL GROSS DASTEHT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ein stiller Nicht-Empfang sieht aus wie „keine Cues". Das ist die
 * Entwarnung durch die Hintertür, und sie ist der Grund für die vierte
 * Auflage aus E-23. Der Zustand steht deshalb oben, in Warnfarbe, mit dem
 * Grund im Klartext.
 */
export const OscEmpfangPanel = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.oscOpen)
  const setOpen = useUiStore((s) => s.setOscOpen)
  const config = useProjectStore((s) => s.project.oscLauscher) ?? OSC_LAUSCHER_AUS
  const setConfig = useProjectStore((s) => s.setOscLauscher)

  const [zustand, setZustand] = useState<LauscherZustand>({ lage: 'aus' })
  const [meldungen, setMeldungen] = useState<OscEmpfang[]>([])
  // Die Uhr tickt in der ANZEIGE und nicht im Modell: das Alter ist eine
  // Sicht auf einen Zeitpunkt, kein gespeicherter Wert.
  const [jetzt, setJetzt] = useState(() => new Date().toISOString())

  const bruecke = cablePlannerApi.showControl

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setJetzt(new Date().toISOString()), 1000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    const ab = bruecke.onUpdate((p) => {
      setZustand(p.zustand)
      setMeldungen(p.meldungen)
    })
    void bruecke.state().then((p) => {
      setZustand(p.zustand)
      setMeldungen(p.meldungen)
    })
    return ab
  }, [bruecke])

  const anwenden = useCallback(
    async (naechste: typeof config) => {
      setConfig(naechste)
        setZustand(naechste.aktiv ? await bruecke.start(naechste) : await bruecke.stop())
    },
    [bruecke, setConfig],
  )

  if (!open) return null

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('osc.title', 'Received show-control messages')}
      titleIcon={<Icon icon={Radio} size="sm" />}
      maxWidth="2xl"
    >
      <PanelHint
        className="mb-3 text-cp-xs text-cp-text-muted"
        text={t(
          'osc.notAState',
          'This list is a transcript, not a system state. It says something arrived — not that anything is in order. This plan cannot give an all-clear.',
        )}
      />

      <div
        className={`mb-3 rounded border p-2 text-cp-xs ${
          zustand.lage === 'nicht-gebunden'
            ? 'border-cp-warn bg-cp-warn/10 text-cp-warn'
            : 'border-cp-border bg-cp-surface-2 text-cp-text-secondary'
        }`}
      >
        <div className="font-semibold">
          {t('osc.state', 'Listener')}: {LAUSCHER_LAGE_LABEL[zustand.lage]}
          {zustand.adresse ? ` — ${zustand.adresse}:${zustand.port ?? ''}` : ''}
        </div>
        {zustand.grund && <div className="mt-0.5">{zustand.grund}</div>}
        {zustand.lage === 'nicht-gebunden' && (
          <div className="mt-1">
            {t(
              'osc.notBoundHint',
              'While nothing is bound, nothing arrives here — not even when something is being sent. An empty list then does NOT mean "no cues".',
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-cp-xs sm:col-span-3">
          <input
            type="checkbox"
            checked={config.aktiv}
            onChange={(e) => void anwenden({ ...config, aktiv: e.target.checked })}
          />
          <span className="text-cp-text-secondary">
            {t('osc.enable', 'Listen for this project')}
          </span>
        </label>
        <label className="block text-cp-xs sm:col-span-2">
          <span className="mb-1 block text-cp-text-muted">
            {t('osc.address', 'Address to listen on')}
          </span>
          <input
            className="w-full rounded border border-cp-border bg-cp-surface-2 px-2 py-1"
            value={config.adresse}
            placeholder={t('osc.addressPlaceholder', 'e.g. 10.0.0.20 — no default')}
            onChange={(e) => setConfig({ ...config, adresse: e.target.value })}
            onBlur={() => void anwenden(config)}
          />
        </label>
        <label className="block text-cp-xs">
          <span className="mb-1 block text-cp-text-muted">{t('osc.port', 'Port')}</span>
          <input
            type="number"
            className="w-full rounded border border-cp-border bg-cp-surface-2 px-2 py-1"
            value={config.port}
            onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })}
            onBlur={() => void anwenden(config)}
          />
        </label>
      </div>
      <PanelHint
        className="mt-1 text-cp-xs text-cp-text-muted"
        text={t(
          'osc.addressHint',
          'There is deliberately no default: one that listens on every interface would be a decision nobody made — including on the customer network.',
        )}
      />

      <div className="mt-4 mb-1 flex items-center justify-between">
        <span className="text-cp-xs font-semibold text-cp-text">
          {t('osc.log', 'Transcript')}
        </span>
        <button
          type="button"
          className="rounded bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4"
          onClick={() => void bruecke?.clear().then(() => setMeldungen([]))}
        >
          {t('osc.clear', 'Clear')}
        </button>
      </div>
      {meldungen.length === 0 ? (
        <div className="rounded border border-cp-border-muted bg-cp-surface-2 p-3 text-cp-xs text-cp-text-muted">
          {t(
            'osc.empty',
            'Nothing received yet. That means: nothing arrived here — not that nothing was sent.',
          )}
        </div>
      ) : (
        <ul className="max-h-64 overflow-y-auto text-cp-xs">
          {meldungen.map((m, i) => (
            <li
              key={`${m.empfangenAm}-${i}`}
              className="border-b border-cp-border-muted py-1 text-cp-text-secondary last:border-b-0"
            >
              {empfangsText(m, jetzt)}
              {m.nutzlastBytes > 0 && (
                <span className="text-cp-text-faint">
                  {' '}
                  · {m.nutzlastBytes} {t('osc.payloadBytes', 'bytes payload')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Die ZWEITE Quelle (E-23). Sie steht bewusst unter der Mitschrift und
          nicht daneben: sie kommt nicht ueber den Draht, sondern aus einer
          Sitzung, die jemand gefuehrt hat — und traegt deshalb den Zeitpunkt
          des ABLESENS statt den des Empfangs. */}
      <CompanionStandSection />
    </ModalShell>
  )
}
