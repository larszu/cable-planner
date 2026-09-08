import { useCanvasFlowMode } from '../../hooks/useCanvasFlow'
import { useSettingsStore } from '../../store/settingsStore'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTranslation } from '../../lib/i18n'

/**
 * Die Betriebsart des Canvas — Schema oder Live.
 *
 * SIE IST PFLICHT UND NICHT ZIERDE. Die Bewegung auf den Kanten sieht in
 * beiden Betriebsarten gleich aus; ohne diese Anzeige gäbe es für den
 * Betrachter keinen Unterschied zwischen „so ist es geplant" und „so ist es
 * gerade". Genau das ist die Bedingung, unter der die Animation gebaut werden
 * durfte (ADR-003, und die Auflage aus E-23).
 *
 * SIE STEHT AM CANVAS UND NICHT AN DER KANTE. An dreihundert Kanten wäre es
 * dreihundertmal dasselbe zu lesen, und der Plan wäre unlesbar. Was eine
 * EINZELNE Kante gemeldet hat, steht in ihrer Eigenschaften-Ansicht.
 *
 * WARUM SIE AUCH DAS ALTER ZEIGT. „Live" ohne Zeitangabe ist dieselbe
 * Behauptung wie eine laufende Animation ohne Beleg — nur in Textform. Reißt
 * die Verbindung ab, fällt der Canvas aufs Schema zurück (Eigentümer-
 * Entscheidung), und dieser Streifen sagt, wie lange das her ist.
 */
export function FlowModeChip() {
  const t = useTranslation()
  const { live, ageMs, motion } = useCanvasFlowMode()
  const gewuenscht = useSettingsStore((s) => s.canvasMotion)
  const setMotion = useSettingsStore((s) => s.setCanvasMotion)
  const systemReduziert = useReducedMotion()

  const sekunden = ageMs === null ? null : Math.round(ageMs / 1000)
  const titel = live
    ? t('canvas.flow.liveTitle', 'Beobachteter Zustand aus Mischer/Router.')
    : ageMs === null
      ? t('canvas.flow.schemaTitle', 'Der geplante Weg. Es besteht keine Verbindung zu einer Anlage.')
      : t(
          'canvas.flow.fellBackTitle',
          'Die Live-Verbindung ist abgerissen — gezeigt wird wieder der geplante Weg.',
        )

  return (
    <button
      type="button"
      onClick={() => setMotion(!gewuenscht)}
      title={`${titel} ${
        systemReduziert
          ? t('canvas.flow.systemReduced', 'Das System hat Bewegung abgestellt; die Anzeige bleibt ruhig.')
          : gewuenscht
            ? t('canvas.flow.toggleOff', 'Klick: Bewegung ausschalten.')
            : t('canvas.flow.toggleOn', 'Klick: Bewegung einschalten.')
      }`}
      className="av-focus flex items-center gap-1.5 rounded-full border border-cp-border px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-3"
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: live ? 'var(--cp-ok, #22c55e)' : 'var(--cp-text-faint, #64748b)' }}
      />
      <span>{live ? t('canvas.flow.live', 'Live') : t('canvas.flow.schema', 'Schema')}</span>
      {live && sekunden !== null && (
        <span className="tabular-nums text-cp-text-muted">{`· ${sekunden} s`}</span>
      )}
      {!live && sekunden !== null && (
        <span className="text-cp-text-muted">
          {t('canvas.flow.lostContact', '· Verbindung weg')}
        </span>
      )}
      {!motion && (
        <span className="text-cp-text-muted">{t('canvas.flow.still', '· ruhig')}</span>
      )}
    </button>
  )
}
