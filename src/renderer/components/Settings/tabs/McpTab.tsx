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
import { claudeMcpAddBefehl, mcpCurlBeispiel, mcpJsonKonfig } from '../../../lib/mcpClientConfig'
import { useTranslation, format } from '../../../lib/i18n'
import { useSettingsStore } from '../../../store/settingsStore'
import { effectiveServer } from '../../../lib/deviceLibraryUrl'
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
  ausweichPort: false,
}

/** Ein Kopierblock: Text sichtbar, ein Knopf daneben. */
const Kopierblock = ({ titel, text, knopf }: { titel: string; text: string; knopf: string }) => {
  const t = useTranslation()
  const [kopiert, setKopiert] = useState(false)
  return (
    <div className="space-y-1">
      <div className="text-cp-text-secondary">{titel}</div>
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-cp-s bg-cp-surface-2 px-2 py-1 font-mono">
          {text}
        </pre>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setKopiert(true))
          }}
          className={knopf}
          title={t('mcp.copy', 'Copy')}
        >
          <Icon icon={Copy} size="xs" /> {kopiert ? t('mcp.copied', 'Copied') : t('mcp.copy', 'Copy')}
        </button>
      </div>
    </div>
  )
}

export const McpTab = () => {
  const t = useTranslation()
  const remoteMcpUrl = `${effectiveServer(useSettingsStore((st) => st.deviceLibraryUrl))}/mcp`
  const [status, setStatus] = useState<McpStatus>(LEER)
  const [token, setToken] = useState('')
  const [zeigeToken, setZeigeToken] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [port, setPort] = useState('')

  const laden = useCallback(async () => {
    if (!hasDesktopBridge) return
    setStatus(await cablePlannerApi.mcp.status())
  }, [])

  useEffect(() => {
    if (!hasDesktopBridge) return
    let lebt = true
    void Promise.all([cablePlannerApi.mcp.einstellungen(), cablePlannerApi.mcp.token()]).then(
      ([e, { token: wert }]) => {
        if (!lebt) return
        setPort(String(e.port))
        setToken(wert)
      },
    )
    return () => {
      lebt = false
    }
  }, [])

  const portSpeichern = async () => {
    setFehler(null)
    try {
      const e = await cablePlannerApi.mcp.setPort(Number(port))
      setPort(String(e.port))
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    }
  }

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

  const vorlagen = status.url && token

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
        {status.running && status.ausweichPort && (
          <span className="rounded-cp-s bg-cp-warn/15 px-1.5 py-0.5 text-cp-warn">
            {format(
              t(
                'mcp.fallbackPort',
                'Port {port} was busy - running on a random port. Saved client configs will not find it until {port} is free again.',
              ),
              { port },
            )}
          </span>
        )}
        {status.running && status.verbunden && (
          <span className="bg-cp-accent px-1.5 py-0.5 text-cp-accent-text">
            {t('mcp.connected', 'a client is asking')}
          </span>
        )}
      </div>

      <PanelHint
        className="text-cp-text-faint"
        text={t(
          'mcp.remembered',
          'The switch is remembered: if the server was on when the app closed, it starts again on the next launch, on the same port.',
        )}
      />

      <label className="flex flex-wrap items-center gap-2">
        <span className="text-cp-text-secondary">{t('mcp.port', 'Port')}</span>
        <input
          type="number"
          min={1024}
          max={65535}
          value={port}
          disabled={!hasDesktopBridge}
          onChange={(e) => setPort(e.target.value)}
          onBlur={() => void portSpeichern()}
          className="w-24 rounded-cp-control border border-cp-border bg-cp-surface-2 px-2 py-1"
        />
        <span className="text-cp-text-muted">
          {t('mcp.portHint', 'Takes effect when the server is restarted.')}
        </span>
      </label>

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
              'Place library and custom devices, connect and remove cables, set cable details and rack heights, save racks, rename devices - through the same store actions the canvas uses. Every call is ONE undo step and leaves a line under "What Claude changed" below. Switching devices (Videohub, ATEM) is never offered. Takes effect when the server is restarted.',
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

      {vorlagen && (
        <div className="space-y-2">
          <Kopierblock
            titel={t('mcp.setup', 'Add it to Claude Code')}
            text={claudeMcpAddBefehl(status.url, token)}
            knopf={knopf}
          />
          <Kopierblock
            titel={t('mcp.setupJson', 'JSON for .mcp.json or other clients')}
            text={mcpJsonKonfig(status.url, token)}
            knopf={knopf}
          />
          <Kopierblock
            titel={t('mcp.setupCurl', 'Without restarting the client: call it with curl')}
            text={mcpCurlBeispiel(status.url, token)}
            knopf={knopf}
          />
        </div>
      )}

      {/* #874 — claude.ai und die Claude-App erreichen keinen localhost. Fuer
          sie gibt es den Connector auf dem Server der Geraetebibliothek; er
          liest die Plaene, die in der Cloud liegen, und nur lesend. */}
      <div className="space-y-1 border-t border-cp-border-muted pt-3">
        <div className="text-cp-text-secondary">{t('mcp.remote.title', 'claude.ai and the Claude app')}</div>
        <PanelHint
          className="text-cp-text-muted"
          text={format(
            t(
              'mcp.remote.hint',
              'They cannot reach this computer. Put the project into the cloud (File → Cloud & share link…), then in claude.ai add a custom connector with {url} and sign in with your device library account. It reads cloud projects only, and never changes them.',
            ),
            { url: remoteMcpUrl },
          )}
        />
      </div>
    </div>
  )
}
