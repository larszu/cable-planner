/**
 * Phone-friendly viewer launcher.
 *
 * Workflow:
 *   1. User clicks "📱 Handy-Zugriff" in the topbar → this dialog opens.
 *   2. The dialog starts a tiny HTTP server in the Electron main process
 *      (see src/main/services/mobileShareServer.ts) on a free LAN port.
 *   3. The server hands out the bundled mobile.html + the currently-
 *      loaded project. The dialog renders a QR code with the LAN URL —
 *      the field tech scans it with their phone and sees the read-only
 *      viewer in the browser, no app install needed.
 *   4. While the server is running, the renderer pushes any project
 *      mutation to the server (debounced) so the phone always sees the
 *      latest state on refresh.
 *
 * Der Rueckkanal: entgegen einer frueheren Fassung dieses Kommentars hat
 * der Server sehr wohl Schreib-Endpunkte — POST /checks (Haekchen),
 * POST /cables (neu angelegte Kabel), POST /pending-changes
 * (Feld-Rueckmeldungen) und POST /pattern-checks (die Sichtpruefung vom
 * Pruefbild-Rundgang, B-42 Inkrement 2b). Alle vier aendern das Projekt
 * am Desktop.
 * Jeder von ihnen verlangt das Token aus der QR-Code-URL (`authed`),
 * und `stripSecrets` entfernt Passwoerter/Schluessel, bevor das Projekt
 * das Geraet verlaesst. Der Weg ist also abgesichert — aber er ist da,
 * und der Sicherheits-Hinweis im Dialog muss ihn benennen: wer den
 * QR-Code hat, kann den Plan aendern, nicht nur ansehen.
 *
 * The server stops when the user clicks "Stop" or when the desktop app
 * closes (Electron tears down the http server with the process).
 */

import { useEffect, useMemo, useState } from 'react'
import { Smartphone, Clipboard, Check, Radio } from 'lucide-react'
import QRCode from 'qrcode'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { cablePlannerApi, hasDesktopBridge } from '../../lib/bridge'
import { format, useTranslation } from '../../lib/i18n'
import { anlagenZugangscodes } from '../../lib/anlagenZugangscodes'
import { PanelHint } from '../shared/PanelHint'

interface WithheldAddress {
  address: string
  reach: string
  reason: string
}

interface ShareStatus {
  running: boolean
  port: number
  urls: string[]
  hasProject: boolean
  /**
   * BEDARF 133 — Adressen, unter denen der Rechner erreichbar ist und die
   * NICHT angeboten werden.
   *
   * Sie werden GEZEIGT und nicht verschwiegen: eine zurueckgehaltene Adresse,
   * die niemand nennt, ist fuer den Nutzer dasselbe wie eine, die es nicht
   * gibt — und dann sucht er den Fehler in der Netzwerktechnik.
   */
  withheld: WithheldAddress[]
}

const renderQrTo = async (url: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(url, {
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
  } catch {
    return ''
  }
}

/** Score addresses so we surface the most-likely-useful one first.
 *  Wi-Fi private ranges (192.168.*, 10.*, 172.16-31.*) usually beat
 *  link-local / VirtualBox / loopback. */
const scoreAddress = (url: string): number => {
  if (url.includes('127.0.0.1')) return -10
  if (/192\.168\./.test(url)) return 100
  if (/^http:\/\/10\./.test(url)) return 90
  if (/^http:\/\/172\.(1[6-9]|2[0-9]|3[01])\./.test(url)) return 80
  if (/169\.254\./.test(url)) return -20
  return 50
}

export const MobileShareDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.mobileShare.open)
  const close = useUiStore((s) => s.closeMobileShare)
  const [status, setStatus] = useState<ShareStatus>({
    running: false,
    port: 0,
    urls: [],
    hasProject: false,
    withheld: [],
  })
  const [busy, setBusy] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [selectedUrl, setSelectedUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  /**
   * BEDARF 109 — ob das Handy zurueckschreiben darf.
   *
   * Der Wert kommt VOM SERVER und wird nicht hier gehalten: der Dialog wird
   * geschlossen und wieder geoeffnet, der Server laeuft weiter. Ein
   * Anfangswert aus dem Bauch zeigte nach dem zweiten Oeffnen etwas anderes
   * an, als tatsaechlich gilt — und genau daran haengt die Frage, ob jemand
   * am Plan mitschreibt.
   */
  const [writeMode, setWriteModeState] = useState<'read-only' | 'contribute'>('read-only')
  /**
   * E-3 — der Zugriff auf die Anlagen-Zugangscodes.
   *
   * Wie `writeMode` kommt der Zustand VOM SERVER; der Token dagegen kommt
   * EINMAL beim Einschalten und wird hier gehalten, bis der Dialog schliesst.
   * Es gibt bewusst keinen Weg, ihn spaeter nachzuschlagen: ein Geheimnis,
   * das man jederzeit aufrufen kann, wandert in jeden Screenshot dieses
   * Dialogs. Wer ihn verliert, schaltet aus und wieder ein — und macht damit
   * zugleich den alten ungueltig, was richtig ist.
   */
  const [pinAn, setPinAn] = useState(false)
  const [pinToken, setPinToken] = useState('')
  const [pinAnzahl, setPinAnzahl] = useState(0)

  useEffect(() => {
    let lebt = true
    void cablePlannerApi.mobileShare.getWriteMode().then((r) => {
      if (lebt) setWriteModeState(r.writeMode)
    })
    if (hasDesktopBridge) {
      void cablePlannerApi.mobileShare.pincodeStatus().then((r) => {
        if (!lebt) return
        setPinAn(r.on)
        setPinAnzahl(r.count)
      })
    }
    return () => {
      lebt = false
    }
  }, [])

  // BEDARF 39 — die Feed-Adresse leitet sich aus der aktiven URL ab und wird
  // NICHT zweitverwaltet: eine zweite Adresse, die aus derselben Quelle
  // anders gebildet wird, geht beim naechsten Umbau auseinander. `webcal://`
  // statt `http://`, weil das am Handy das Abo oeffnet statt eine Datei zu
  // laden — genau der Unterschied, den der Bedarf verlangt.
  /**
   * E-3 — die Codes aus dem Roh-Dokument des Herstellers. Sie werden hier
   * GELESEN und nirgends abgelegt: von hier gehen sie ueber genau einen
   * IPC-Aufruf in den Hauptprozess und leben dort im Speicher, solange der
   * Schalter an ist.
   */
  //
  // Der Selektor gibt das ROH-DOKUMENT zurueck und nicht die fertige Liste:
  // `anlagenZugangscodes` baut bei jedem Aufruf ein neues Array, und ein
  // zustand-Selektor mit neuer Identitaet je Aufruf laesst
  // `useSyncExternalStore` bei JEDEM Render einen neuen Zustand sehen. Dieser
  // Dialog haengt dauerhaft in `App.tsx` (auch geschlossen), also traf das die
  // ganze App: der Canvas kam nicht mehr zur Ruhe, und „Beispielprojekt laden"
  // tat nichts mehr. Gefunden vom UI-Overflow-Lauf, nicht von den Unit-Tests.
  const basePreset = useProjectStore((st) => st.project.intercom?.vendor?.greengo?.basePreset)
  const codes = useMemo(() => anlagenZugangscodes(basePreset), [basePreset])

  const hatSchichten = useProjectStore(
    (st) => (st.project.crewPlan?.entries.length ?? 0) > 0,
  )
  const crewFeedUrl =
    hatSchichten && selectedUrl
      ? selectedUrl.replace(/^http:\/\//, 'webcal://').replace(/\/mobile\.html/, '/crew.ics')
      : ''

  // Initial status check whenever the dialog opens — the server may
  // already be running from a previous session in the same Electron
  // process.
  useEffect(() => {
    if (!open || !hasDesktopBridge) return
    void (async () => {
      const next = await cablePlannerApi.mobileShare.status()
      setStatus(next)
    })()
  }, [open])

  // Pick + render the primary URL whenever the server state changes.
  useEffect(() => {
    if (status.urls.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- QR/URL aus dem asynchronen Server-Status ableiten/zurücksetzen
      setQrDataUrl('')
      setSelectedUrl('')
      return
    }
    const sorted = [...status.urls].sort((a, b) => scoreAddress(b) - scoreAddress(a))
    const primary = selectedUrl && status.urls.includes(selectedUrl) ? selectedUrl : sorted[0]
    setSelectedUrl(primary)
    void renderQrTo(primary).then(setQrDataUrl)
  }, [status.urls, selectedUrl])

  const handleStart = async () => {
    setBusy(true)
    try {
      const result = await cablePlannerApi.mobileShare.start()
      setStatus({ ...result, running: true })
    } finally {
      setBusy(false)
    }
  }

  // BEDARF 133 — die ausdrueckliche Entscheidung. Sie gilt nur fuer diese
  // Sitzung: `stop` setzt sie im Main-Prozess zurueck, und wer den Rechner
  // morgen woanders aufstellt, faengt wieder beim LAN an.
  const handleAllowBeyondLan = async () => {
    setBusy(true)
    try {
      const result = await cablePlannerApi.mobileShare.setAllowBeyondLan(true)
      setStatus({ ...result, running: true })
    } finally {
      setBusy(false)
    }
  }

  const handleStop = async () => {
    setBusy(true)
    try {
      await cablePlannerApi.mobileShare.stop()
      setStatus({ running: false, port: 0, urls: [], hasProject: false, withheld: [] })
    } finally {
      setBusy(false)
    }
  }

  const copyUrl = async () => {
    if (!selectedUrl) return
    try {
      await navigator.clipboard.writeText(selectedUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('mobile.dialog.heading', 'Mobile access')}
      titleIcon={<Icon icon={Smartphone} size="sm" />}
      maxWidth="md"
      draggableKey="cable-planner:modal-pos:mobile-share"
    >
        <div className="space-y-3 text-cp-base">
          {!hasDesktopBridge && (
            <div className="rounded border border-amber-700 bg-amber-950/40 p-3 text-cp-xs text-amber-200">
              {t('mobile.dialog.desktopOnly1', 'This feature requires the desktop app (Electron). In the web browser the mobile viewer is reachable as static HTML in')}{' '}
              <code className="rounded bg-cp-surface-2 px-1">dist/renderer/mobile.html</code>{' '}
              {t('mobile.dialog.desktopOnly2', '.')}
            </div>
          )}

          <PanelHint
            className="text-cp-xs text-cp-text-muted"
            text={t('mobile.dialog.description', 'Starts a small web server on the local network. Scan the QR code with the phone → the mobile viewer opens in the browser and loads the current project. The server stops automatically when the app closes or via the Stop button.')}
          />

          {status.running ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 rounded border border-emerald-700 bg-emerald-950/30 p-3">
                {/* Drei Zustaende, nicht zwei. Laeuft der Server, ist aber
                    keine Adresse uebrig — jede wurde zurueckgehalten (Bedarf
                    133) —, dann pulste hier frueher ein Platzhalter, der nie
                    fertig wird: „niemand hat nachgesehen" statt „da ist
                    nichts". Der Zustand wird jetzt benannt. */}
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={t('mobile.dialog.qrAlt', 'QR code')} className="rounded bg-white p-2" />
                ) : status.urls.length === 0 ? (
                  <div className="flex h-[240px] w-[240px] items-center justify-center rounded border border-cp-border bg-cp-surface-2 p-3 text-center text-cp-xs text-cp-text-secondary">
                    {t('mobile.dialog.noAddress', 'No address shared — the server is running, but there is no local network it could be reached on.')}
                  </div>
                ) : (
                  <div className="h-[240px] w-[240px] animate-pulse rounded bg-cp-surface-2" />
                )}
                <div className="w-full">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-300">
                    {t('mobile.dialog.activeUrl', 'Active URL')}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      readOnly
                      value={selectedUrl}
                      className="flex-1 rounded border border-cp-border bg-cp-surface-3 px-2 py-1 font-mono text-[11px] text-cp-text"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => void copyUrl()}
                      className="rounded bg-cp-surface-4 px-2 py-1 text-[10px] hover:bg-cp-surface-5"
                      title={t('mobile.dialog.copyToClipboard', 'Copy to clipboard')}
                    >
                      <Icon icon={copied ? Check : Clipboard} size="xs" />
                    </button>
                  </div>
                </div>
              </div>
              {/* ── BEDARF 39 — der abonnierbare Crew-Kalender ──────────
                  „Serve a subscribable webcal:// feed from the local project
                  file rather than an .ics download." Die Adresse steht hier,
                  weil sie sonst niemand faende: sie ist dieselbe wie oben, nur
                  mit `/crew.ics` statt `/mobile.html` — und `webcal://` statt
                  `http://`, damit ein Klick am Handy das ABO oeffnet und nicht
                  den Download. Ohne Schichten im Plan wird sie nicht gezeigt:
                  ein Feed, der nichts traegt, liest sich als „hat frei". */}
              {crewFeedUrl && (
                <div className="w-full">
                  <div className="text-[10px] uppercase tracking-wide text-sky-300">
                    {t('mobile.dialog.crewFeed', 'Subscribe to the crew calendar')}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      readOnly
                      value={crewFeedUrl}
                      className="flex-1 rounded border border-cp-border bg-cp-surface-3 px-2 py-1 font-mono text-[11px] text-cp-text"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(crewFeedUrl)}
                      className="rounded bg-cp-surface-4 px-2 py-1 text-[10px] hover:bg-cp-surface-5"
                      title={t('mobile.dialog.copyToClipboard', 'Copy to clipboard')}
                    >
                      <Icon icon={Clipboard} size="xs" />
                    </button>
                  </div>
                  <div className="mt-0.5 text-[10px] text-cp-text-muted">
                    {t(
                      'mobile.dialog.crewFeedHint',
                      'Add it to your calendar as a subscription — it fetches the current state instead of going stale.',
                    )}
                  </div>
                </div>
              )}
              {status.urls.length > 1 && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-cp-text-muted">
                    {t('mobile.dialog.altUrls', 'Alternative LAN addresses (in case one is unreachable)')}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {status.urls.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setSelectedUrl(u)}
                        className={`rounded border px-2 py-0.5 text-[10px] font-mono ${
                          u === selectedUrl
                            ? 'border-sky-500 bg-sky-900 text-white'
                            : 'border-cp-border bg-cp-surface-1 text-cp-text-secondary hover:border-sky-700'
                        }`}
                      >
                        {u.replace(/^http:\/\//, '').replace('/mobile.html', '')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* ── BEDARF 133 — was NICHT angeboten wird, und warum ──────
                  „Managers also need multi-site and remote viewers, and
                  IMMEDIATELY WANT ACCESS CONTROL when they get it."
                  (cpvalente/ontime#1423)

                  Der Server bindet auf 0.0.0.0. Adressen jenseits des LANs
                  werden deshalb zurueckgehalten — aber GENANNT: eine
                  verschwiegene Adresse ist fuer den Nutzer dasselbe wie eine,
                  die es nicht gibt, und dann sucht er den Fehler in der
                  Netzwerktechnik. Wer sie braucht, schaltet sie frei und
                  liest dabei, was er tut. */}
              {status.withheld.length > 0 && (
                <div className="rounded border border-amber-700 bg-amber-950/40 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-amber-300">
                    {t('mobile.dialog.withheldTitle', 'Not shared')}
                  </div>
                  <div className="mb-1 flex flex-wrap gap-1">
                    {status.withheld.map((w) => (
                      <span
                        key={w.address}
                        className="rounded border border-amber-700 bg-cp-surface-1 px-2 py-0.5 font-mono text-[10px] text-amber-200"
                      >
                        {w.address}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] leading-snug text-cp-text-secondary">
                    {status.withheld[0].reason}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAllowBeyondLan()}
                    className="mt-1 rounded border border-amber-600 px-2 py-0.5 text-[10px] text-amber-200 hover:bg-amber-900/60"
                  >
                    {t('mobile.dialog.allowBeyondLan', 'Share anyway (this session only)')}
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-cp-text-muted">
                  {t('mobile.dialog.portLabel', 'Port')} {status.port} ·{' '}
                  {status.hasProject ? (
                    <span className="text-emerald-300">{t('mobile.dialog.projectSynced', 'Project synced')}</span>
                  ) : (
                    <span className="text-amber-300">{t('mobile.dialog.noProject', 'No project loaded')}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void handleStop()}
                  disabled={busy}
                  className="rounded bg-red-700 px-3 py-1 text-cp-xs text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {t('mobile.dialog.stop', 'Stop')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded border border-cp-border bg-cp-surface-3/40 p-6 text-center">
              <Icon icon={Radio} size={28} className="text-cp-text-faint" />
              <p className="text-cp-xs text-cp-text-muted">
                {t('mobile.dialog.stopped', 'Server is stopped. Click below to start the LAN server.')}
              </p>
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={busy || !hasDesktopBridge}
                className="rounded bg-sky-700 px-4 py-2 text-cp-base text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t('mobile.dialog.starting', 'Starting…') : t('mobile.dialog.startServer', 'Start LAN server')}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1 rounded border border-cp-border-muted p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-cp-xs font-medium text-cp-text">
                {t('mobile.dialog.writeMode', 'Feedback from the phone')}
              </span>
              {(['read-only', 'contribute'] as const).map((m) => (
                <label key={m} className="flex items-center gap-1 text-cp-xs">
                  <input
                    type="radio"
                    name="cp-write-mode"
                    checked={writeMode === m}
                    onChange={async () => {
                      // Der angezeigte Wert kommt aus der ANTWORT und nicht aus
                      // dem Klick: sonst zeigte der Dialog einen Zustand, den
                      // der Server womöglich nicht angenommen hat.
                      const r = await cablePlannerApi.mobileShare.setWriteMode(m)
                      setWriteModeState(r.writeMode)
                    }}
                  />
                  {m === 'read-only'
                    ? t('mobile.dialog.writeMode.read', 'Read only')
                    : t('mobile.dialog.writeMode.contribute', 'Send back ticks and cables')}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-cp-text-muted">
              {writeMode === 'read-only'
                ? t(
                    'mobile.dialog.writeMode.readHint',
                    'The three write routes are closed — the phone is refused on every write attempt. The plan is changed by the person at the desk.',
                  )
                : t(
                    'mobile.dialog.writeMode.contributeHint',
                    'Ticks, cables added on site and field reports go back into the project. Anyone with the QR code can change the plan.',
                  )}
            </p>
          </div>

          {/* E-3 — die Anlagen-Zugangscodes, hinter einem eigenen Token. */}
          <div className="flex flex-col gap-1 rounded border border-cp-border-muted p-2">
            <label className="flex items-center gap-2 text-cp-xs font-medium text-cp-text">
              <input
                type="checkbox"
                checked={pinAn}
                disabled={codes.length === 0}
                onChange={async () => {
                  const an = !pinAn
                  const r = await cablePlannerApi.mobileShare.setPincodeAccess(an)
                  setPinAn(an)
                  setPinToken(r.token)
                  const st = an
                    ? await cablePlannerApi.mobileShare.setPincodes(codes)
                    : { count: 0 }
                  setPinAnzahl(st.count)
                }}
              />
              {t('mobile.dialog.pincode', 'Make system access codes retrievable')}
            </label>
            {codes.length === 0 ? (
              <p className="text-[11px] text-cp-text-muted">
                {t(
                  'mobile.dialog.pincode.none',
                  'This project carries no intercom configuration with access codes.',
                )}
              </p>
            ) : pinAn && pinToken ? (
              <>
                <p className="text-[11px] text-cp-text-muted">
                  {t(
                    'mobile.dialog.pincode.hint',
                    'Type this code on the phone. It is NOT part of the QR code — whoever only has the link cannot reach the access data.',
                  )}
                </p>
                <code className="select-all rounded bg-cp-surface-2 px-2 py-1 font-mono text-cp-base tracking-widest text-cp-text">
                  {pinToken}
                </code>
                <p className="text-[11px] text-cp-text-muted">
                  {format(
                    t(
                      'mobile.dialog.pincode.count',
                      '{n} code(s) held. Every retrieval is recorded in the document register — with a timestamp, not with the value.',
                    ),
                    { n: pinAnzahl },
                  )}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-cp-text-muted">
                {format(
                  t(
                    'mobile.dialog.pincode.offHint',
                    'Off. {n} code(s) would be available — they leave this machine only once the switch is on.',
                  ),
                  { n: codes.length },
                )}
              </p>
            )}
          </div>

          <details className="text-[11px] text-cp-text-muted">
            <summary className="cursor-pointer hover:text-cp-text-secondary">{t('mobile.dialog.securityHeading', 'Security notes')}</summary>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>{t('mobile.dialog.security.writeBack', 'Whether the phone may write back is decided by the setting above. If it is set to \u201csend checks and cables back\u201d, anyone with the QR code can change the plan.')}</li>
              <li>{t('mobile.dialog.security.token', 'Every write path requires the token from the QR code. Passwords and keys are stripped from the project before it leaves the device.')}</li>
              <li>{t('mobile.dialog.security.pincode', 'The system access codes NEVER travel with the project. They live only in the desktop app\'s memory and only while the switch above is on; they are retrieved with a second code that is not part of the QR code.')}</li>
              <li>{t('mobile.dialog.security.bind', 'The server binds to the local network (0.0.0.0). If it is unclear who is on the network, prefer stopping it.')}</li>
              <li>{t('mobile.dialog.security.autostop', 'When the desktop app closes the server stops automatically.')}</li>
            </ul>
          </details>
        </div>
    </ModalShell>
  )
}
