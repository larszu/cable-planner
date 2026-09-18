// ───────────────────────────────────────────────────────────────────────────
// Der Schalter fuer den MCP-Server (#872).
//
// ─── AUS ALS VORGABE, UND ZWAR SICHTBAR ────────────────────────────────────
//
// Hier steht kein Haken, der still auf „an" steht. Wer den Server
// einschaltet, oeffnet einen Weg, auf dem ein anderes Programm den ganzen
// Plan lesen kann — auf demselben Rechner, aber immerhin. Diese Seite sagt
// deshalb in einem Satz, WAS offensteht und WAS nicht (geschrieben wird
// nichts, Stufe 1), und sie zeigt den Befehl zum Einrichten, damit niemand
// das Token von Hand abschreibt.
// ───────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { Copy, Play, RefreshCw, Square } from 'lucide-react'
import { cablePlannerApi, hasDesktopBridge, type McpStatus } from '../../../lib/bridge'
import { useTranslation, format } from '../../../lib/i18n'
import { useProjectStore } from '../../../store/projectStore'
import { PanelHint } from '../../shared/PanelHint'
import { Icon } from '../../shared/Icon'

/**
 * #873 — was Claude am Plan geaendert hat.
 *
 * Er steht HIER und nicht im Undo-Stapel: dessen Eintraege sind ganze
 * Plan-Zustaende ohne Namen (`projectHistory`), und ein Etikett dort hiesse,
 * den Undo-Mechanismus umzubauen. Diese Liste beantwortet dieselbe Frage —
 * „was hat das Ding an meinem Plan gemacht?" — und ueberlebt den Stapel.
 */
const McpNachweis = () => {
  const t = useTranslation()
  const log = useProjectStore((s) => s.project.mcpLog) ?? []
  if (log.length === 0) return null
  return (
    <div className="space-y-1">
      <div className="text-cp-text-secondary">{t('mcp.trace', 'What Claude changed')}</div>
      <ul className="max-h-40 space-y-0.5 overflow-auto border border-cp-border-muted p-2">
        {[...log].reverse().map((e) => (
          <li key={e.id} className="text-cp-text-muted">
            <span className="font-mono text-cp-text-faint">{e.zeit.slice(0, 16).replace('T', ' ')}</span>{' '}
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

const LEER: McpStatus = {
  running: false,
  port: 0,
  url: '',
  verbunden: false,
  schreibenErlaubt: false,
}

export const McpTab = () => {
  const t = useTranslation()
  const [status, setStatus] = useState<McpStatus>(LEER)
  const [token, setToken] = useState('')
  const [zeigeToken, setZeigeToken] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    if (!hasDesktopBridge) return
    setStatus(await cablePlannerApi.mcp.status())
  }, [])

  useEffect(() => {
    // Der Status trägt die Angabe „ein Client hat gefragt"; sie veraltet,
    // also wird sie nachgesehen, solange diese Seite offen ist.
    //
    // Der erste Blick liegt im Timeout und nicht direkt im Effekt: ein
    // `setState` unmittelbar im Effekt loest eine zweite Renderrunde aus,
    // bevor die erste auf dem Schirm ist (`react-hooks/set-state-in-effect`).
    const sofort = window.setTimeout(() => void laden(), 0)
    const uhr = window.setInterval(() => void laden(), 5000)
    return () => {
      window.clearTimeout(sofort)
      window.clearInterval(uhr)
    }
  }, [laden])

  const starten = async () => {
    setFehler(null)
    try {
      const s = await cablePlannerApi.mcp.start()
      setStatus(s)
      setToken(s.token)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    }
  }

  const stoppen = async () => {
    await cablePlannerApi.mcp.stop()
    setStatus(LEER)
  }

  const tokenHolen = async () => {
    const { token: wert } = await cablePlannerApi.mcp.token()
    setToken(wert)
    setZeigeToken(true)
  }

  const neuesToken = async () => {
    const { token: wert } = await cablePlannerApi.mcp.resetToken()
    setToken(wert)
    setZeigeToken(true)
  }

  const befehl =
    status.url && token
      ? `claude mcp add --transport http cable-planner ${status.url} --header "Authorization: Bearer ${token}"`
      : ''

  const knopf =
    'inline-flex items-center gap-1 bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4'

  return (
    <div className="space-y-3 text-cp-xs">
      <PanelHint
        className="text-cp-text-muted"
        text={t(
          'mcp.hint',
          'Lets Claude ask this plan: devices, ports, signal paths, cables and what the plan check says. It only READS - nothing in the plan can be changed through it. The server listens on 127.0.0.1 only and needs the pairing token below.',
        )}
      />

      {!hasDesktopBridge && (
        <div className="border border-cp-border-muted bg-cp-surface-2 p-3 text-cp-text-muted">
          {t('mcp.desktopOnly', 'The local server needs the desktop app.')}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status.running ? (
          <button type="button" onClick={() => void stoppen()} className={knopf}>
            <Icon icon={Square} size="xs" /> {t('mcp.stop', 'Stop server')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void starten()}
            disabled={!hasDesktopBridge}
            className={`${knopf} disabled:opacity-40`}
          >
            <Icon icon={Play} size="xs" /> {t('mcp.start', 'Start server')}
          </button>
        )}
        <span className={status.running ? 'text-emerald-400' : 'text-cp-text-muted'}>
          {status.running
            ? format(t('mcp.running', 'Listening on {url}'), { url: status.url })
            : t('mcp.stopped', 'Off')}
        </span>
        {status.running && status.verbunden && (
          <span className="bg-cp-accent px-1.5 py-0.5 text-white">
            {t('mcp.connected', 'a client is asking')}
          </span>
        )}
      </div>

      {/* #873 — der ZWEITE Schalter. „Claude darf lesen" und „Claude darf
          aendern" sind zwei Entscheidungen; wer nur fragen wollte, soll nicht
          aus Versehen dem Aendern zugestimmt haben. */}
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={status.schreibenErlaubt}
          disabled={!hasDesktopBridge}
          onChange={async (e) => setStatus(await cablePlannerApi.mcp.setSchreibmodus(e.target.checked))}
        />
        <span>
          <span className="text-cp-text">
            {t('mcp.write', 'Claude may also change the plan')}
          </span>
          <span className="block text-cp-text-muted">
            {t(
              'mcp.writeHint',
              'Connect and remove cables, set cable details, rename devices - through the same store actions the canvas uses. Every call is ONE undo step and leaves a line under "What Claude changed" below. Switching devices (Videohub, ATEM) is never offered. Takes effect when the server is restarted.',
            )}
          </span>
        </span>
      </label>

      {fehler && (
        <div className="border border-cp-danger/60 bg-cp-danger/10 px-2 py-1 text-cp-danger">
          {fehler}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void tokenHolen()} className={knopf} disabled={!hasDesktopBridge}>
            {t('mcp.showToken', 'Show pairing token')}
          </button>
          <button type="button" onClick={() => void neuesToken()} className={knopf} disabled={!hasDesktopBridge}>
            <Icon icon={RefreshCw} size="xs" /> {t('mcp.newToken', 'New token')}
          </button>
          {zeigeToken && token && (
            <code className="break-all bg-cp-surface-2 px-2 py-1 font-mono">{token}</code>
          )}
        </div>
        <PanelHint
          className="text-cp-text-faint"
          text={t(
            'mcp.tokenHint',
            'The token lives in the operating system credential store, not in the settings file. A new token takes effect when the server is restarted, and every client has to be told the new one.',
          )}
        />
      </div>

      <McpNachweis />

      {befehl && (
        <div className="space-y-1">
          <div className="text-cp-text-secondary">{t('mcp.setup', 'Add it to Claude Code')}</div>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all bg-cp-surface-2 px-2 py-1 font-mono">
              {befehl}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(befehl)}
              className={knopf}
              title={t('mcp.copy', 'Copy')}
            >
              <Icon icon={Copy} size="xs" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
