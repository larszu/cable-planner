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
 * The server has no write endpoints; the phone view is read-only. The
 * server stops when the user clicks "Stop" or when the desktop app
 * closes (Electron tears down the http server with the process).
 */

import { useEffect, useState } from 'react'
import { Smartphone, Clipboard, Check, Radio } from 'lucide-react'
import QRCode from 'qrcode'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { useUiStore } from '../../store/uiStore'
import { cablePlannerApi, hasDesktopBridge } from '../../lib/bridge'
import { useTranslation } from '../../lib/i18n'

interface ShareStatus {
  running: boolean
  port: number
  urls: string[]
  hasProject: boolean
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
  })
  const [busy, setBusy] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [selectedUrl, setSelectedUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

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

  const handleStop = async () => {
    setBusy(true)
    try {
      await cablePlannerApi.mobileShare.stop()
      setStatus({ running: false, port: 0, urls: [], hasProject: false })
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
      title={t('mobile.dialog.heading', 'Handy-Zugriff')}
      titleIcon={<Icon icon={Smartphone} size="sm" />}
      maxWidth="md"
      draggableKey="cable-planner:modal-pos:mobile-share"
    >
        <div className="space-y-3 text-cp-base">
          {!hasDesktopBridge && (
            <div className="rounded border border-amber-700 bg-amber-950/40 p-3 text-cp-xs text-amber-200">
              {t('mobile.dialog.desktopOnly1', 'Diese Funktion benötigt die Desktop-App (Electron). Im Web-Browser ist der Mobile-Viewer als statisches HTML im')}{' '}
              <code className="rounded bg-cp-surface-2 px-1">dist/renderer/mobile.html</code>{' '}
              {t('mobile.dialog.desktopOnly2', 'erreichbar.')}
            </div>
          )}

          <p className="text-cp-xs text-cp-text-muted">
            {t('mobile.dialog.description', 'Startet einen kleinen Web-Server im lokalen Netzwerk. Scanne den QR-Code mit dem Handy → der Mobile-Viewer öffnet sich im Browser und lädt das aktuelle Projekt. Der Server stoppt automatisch beim Schließen der App oder über den Stop-Button.')}
          </p>

          {status.running ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 rounded border border-emerald-700 bg-emerald-950/30 p-3">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={t('mobile.dialog.qrAlt', 'QR-Code')} className="rounded bg-white p-2" />
                ) : (
                  <div className="h-[240px] w-[240px] animate-pulse rounded bg-cp-surface-2" />
                )}
                <div className="w-full">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-300">
                    {t('mobile.dialog.activeUrl', 'Aktive URL')}
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
                      title={t('mobile.dialog.copyToClipboard', 'In die Zwischenablage kopieren')}
                    >
                      <Icon icon={copied ? Check : Clipboard} size="xs" />
                    </button>
                  </div>
                </div>
              </div>
              {status.urls.length > 1 && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-cp-text-muted">
                    {t('mobile.dialog.altUrls', 'Alternative LAN-Adressen (falls eine nicht erreichbar ist)')}
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
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-cp-text-muted">
                  {t('mobile.dialog.portLabel', 'Port')} {status.port} ·{' '}
                  {status.hasProject ? (
                    <span className="text-emerald-300">{t('mobile.dialog.projectSynced', 'Projekt synchronisiert')}</span>
                  ) : (
                    <span className="text-amber-300">{t('mobile.dialog.noProject', 'Kein Projekt geladen')}</span>
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
                {t('mobile.dialog.stopped', 'Server ist gestoppt. Klicke unten, um den LAN-Server zu starten.')}
              </p>
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={busy || !hasDesktopBridge}
                className="rounded bg-sky-700 px-4 py-2 text-cp-base text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t('mobile.dialog.starting', 'Starte…') : t('mobile.dialog.startServer', 'LAN-Server starten')}
              </button>
            </div>
          )}

          <details className="text-[11px] text-cp-text-muted">
            <summary className="cursor-pointer hover:text-cp-text-secondary">{t('mobile.dialog.securityHeading', 'Hinweise zur Sicherheit')}</summary>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>{t('mobile.dialog.security.readOnly', 'Read-only: das Handy kann nur lesen, nichts schreiben.')}</li>
              <li>{t('mobile.dialog.security.bind', 'Der Server bindet auf das lokale Netzwerk (0.0.0.0). Wenn unklar ist, wer im Netz hängt, lieber stoppen.')}</li>
              <li>{t('mobile.dialog.security.autostop', 'Beim Schließen der Desktop-App stoppt auch der Server automatisch.')}</li>
            </ul>
          </details>
        </div>
    </ModalShell>
  )
}
