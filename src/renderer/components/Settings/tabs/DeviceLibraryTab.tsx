// ───────────────────────────────────────────────────────────────────────────
// Einstellungen → Geraetebibliothek (devices.zumpelars.de).
//
// Drei Dinge: welcher Server, wer angemeldet ist, und der Abgleich. Ein
// Konto legt man auf der Website an (E-Mail bestaetigen, Richtlinien
// annehmen) — hier gibt es nur den Link dorthin, keine zweite Registrierung.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type FormEvent } from 'react'
import { ExternalLink, LogOut, RefreshCw, RotateCcw } from 'lucide-react'
import { cablePlannerApi, hasDesktopBridge } from '../../../lib/bridge'
import { format, useTranslation } from '../../../lib/i18n'
import { DEFAULT_DEVICE_LIBRARY_URL, forgotPasswordUrl, registerUrl } from '../../../lib/deviceLibraryClient'
import { effectiveServer, errorText, normalizeServerUrl } from '../../../lib/deviceLibrary'
import { useSettingsStore } from '../../../store/settingsStore'
import { useDeviceLibraryStore } from '../../../store/deviceLibraryStore'
import { SettingsCard } from '../SettingsCard'
import { Icon } from '../../shared/Icon'

const knopf =
  'inline-flex items-center gap-1 bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4 disabled:opacity-40'
const feld = 'w-full border border-cp-border bg-cp-surface-3 p-2 text-cp-xs'

export const DeviceLibraryTab = () => {
  const t = useTranslation()
  const setting = useSettingsStore((s) => s.deviceLibraryUrl)
  const setSetting = useSettingsStore((s) => s.setDeviceLibraryUrl)
  const server = effectiveServer(setting)

  const session = useDeviceLibraryStore((s) => s.session)
  const user = useDeviceLibraryStore((s) => s.user)
  const cache = useDeviceLibraryStore((s) => s.cache)
  const syncing = useDeviceLibraryStore((s) => s.syncing)
  const lastSync = useDeviceLibraryStore((s) => s.lastSync)
  const lastError = useDeviceLibraryStore((s) => s.lastError)
  const loadFor = useDeviceLibraryStore((s) => s.loadFor)
  const refreshSession = useDeviceLibraryStore((s) => s.refreshSession)
  const setSignedIn = useDeviceLibraryStore((s) => s.setSignedIn)
  const signOut = useDeviceLibraryStore((s) => s.signOut)
  const sync = useDeviceLibraryStore((s) => s.sync)

  const [url, setUrl] = useState(setting)
  const [urlStatus, setUrlStatus] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadFor(server)
    void refreshSession(server)
  }, [server, loadFor, refreshSession])

  const saveUrl = () => {
    if (url.trim() && !normalizeServerUrl(url)) {
      setUrlStatus(errorText({ code: 'invalid-url' }, t))
      return
    }
    const clean = normalizeServerUrl(url) ?? ''
    // Die Vorgabe wird nicht ausgeschrieben gespeichert: leer heisst
    // „Werksserver", und das bleibt so, auch wenn dessen Adresse wechselt.
    const next = clean === DEFAULT_DEVICE_LIBRARY_URL ? '' : clean
    setSetting(next)
    setUrl(next)
    setUrlStatus(t('deviceLibrary.urlSaved', 'Server address saved.'))
  }

  const restoreDefault = () => {
    setSetting('')
    setUrl('')
    setUrlStatus(t('deviceLibrary.urlRestored', 'Default server restored.'))
  }

  const submitSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const r = challenge
        ? await cablePlannerApi.deviceLibrary.verifySecondFactor(server, challenge, code)
        : await cablePlannerApi.deviceLibrary.signIn(server, login, password)
      if (r.kind === 'ok') {
        setSignedIn(r.user)
        setPassword('')
        setCode('')
        setChallenge(null)
      } else if (r.kind === 'second-factor') {
        setChallenge(r.challenge)
        setPassword('')
      } else {
        setMessage(errorText(r, t))
      }
    } finally {
      setBusy(false)
    }
  }

  const signedIn = session === 'signed-in' || session === 'unverified'

  return (
    <div className="space-y-3 text-cp-xs">
      <SettingsCard
        title={t('deviceLibrary.serverTitle', 'Server')}
        description={t(
          'deviceLibrary.serverDesc',
          'The shared device library the planner syncs templates from and submits templates to. Leave empty for the default server.',
        )}
      >
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={DEFAULT_DEVICE_LIBRARY_URL}
            aria-label={t('deviceLibrary.serverUrl', 'Server address')}
            className={`${feld} min-w-0 flex-1 font-mono`}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" onClick={saveUrl} className={knopf}>
            {t('common.save', 'Save')}
          </button>
          <button type="button" onClick={restoreDefault} disabled={!setting} className={knopf}>
            <Icon icon={RotateCcw} size="xs" /> {t('deviceLibrary.restoreDefault', 'Restore default')}
          </button>
        </div>
        <div className="mt-1 text-cp-text-muted">
          {format(t('deviceLibrary.serverActive', 'In use: {url}'), { url: server })}
          {urlStatus ? ` — ${urlStatus}` : ''}
        </div>
        {!hasDesktopBridge && (
          <div className="mt-1 text-cp-text-muted">
            {t(
              'deviceLibrary.webHint',
              'In the browser the sign-in is kept in this browser\'s storage. The desktop app keeps it in the system keychain.',
            )}
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title={t('deviceLibrary.accountTitle', 'Account')}
        description={t(
          'deviceLibrary.accountDesc',
          'The device library can only be used with an account. Accounts are created on the website: confirm your email address and accept the guidelines there.',
        )}
      >
        {signedIn ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-cp-text">
              {user
                ? format(t('deviceLibrary.signedInAs', 'Signed in as {name} ({email})'), {
                    name: user.username || user.email,
                    email: user.email,
                  })
                : t('deviceLibrary.signedInUnverified', 'Signed in — the server could not be reached to confirm the session.')}
            </span>
            <button
              type="button"
              onClick={() => void signOut(server)}
              className={knopf}
            >
              <Icon icon={LogOut} size="xs" /> {t('deviceLibrary.signOut', 'Sign out')}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void submitSignIn(e)} className="space-y-2">
            {challenge ? (
              <label className="block">
                {t('deviceLibrary.code', 'Two-factor code from your authenticator app')}
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`${feld} mt-1 font-mono`}
                />
              </label>
            ) : (
              <>
                <label className="block">
                  {t('deviceLibrary.login', 'Email or username')}
                  <input
                    type="text"
                    autoComplete="username"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className={`${feld} mt-1`}
                  />
                </label>
                <label className="block">
                  {t('deviceLibrary.password', 'Password')}
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${feld} mt-1`}
                  />
                </label>
              </>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={busy || (challenge ? !code.trim() : !login.trim() || !password)}
                className="bg-cp-accent px-3 py-1 text-cp-xs text-white disabled:opacity-40"
              >
                {challenge ? t('deviceLibrary.verify', 'Confirm code') : t('deviceLibrary.signIn', 'Sign in')}
              </button>
              {challenge && (
                <button
                  type="button"
                  onClick={() => {
                    setChallenge(null)
                    setCode('')
                  }}
                  className={knopf}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              )}
            </div>
            {message && <div className="text-cp-danger" role="alert">{message}</div>}
          </form>
        )}
        <div className="mt-2 flex flex-wrap gap-3">
          <a href={registerUrl(server)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cp-accent hover:underline">
            <Icon icon={ExternalLink} size="xs" /> {t('deviceLibrary.register', 'Create account')}
          </a>
          <a href={forgotPasswordUrl(server)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cp-accent hover:underline">
            <Icon icon={ExternalLink} size="xs" /> {t('deviceLibrary.forgot', 'Forgot password')}
          </a>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('deviceLibrary.syncTitle', 'Sync')}
        description={t(
          'deviceLibrary.syncDesc',
          'Fetches only what changed since the last sync. The devices appear read-only in the library under “Device library” and stay available offline.',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void sync(server)}
            disabled={syncing || !signedIn}
            className={knopf}
          >
            <Icon icon={RefreshCw} size="xs" />{' '}
            {syncing
              ? t('deviceLibrary.syncing', 'Updating…')
              : t('deviceLibrary.update', 'Update from device library')}
          </button>
          <span className="text-cp-text-muted">
            {format(t('deviceLibrary.cacheState', '{n} devices stored locally'), { n: cache.entries.length })}
            {cache.syncedAt
              ? ` — ${format(t('deviceLibrary.syncedAt', 'last updated {when}'), {
                  when: new Date(cache.syncedAt).toLocaleString(),
                })}`
              : ''}
          </span>
        </div>
        <DeviceLibrarySyncReport lastSync={lastSync} lastError={lastError} />
      </SettingsCard>
    </div>
  )
}

/** Ergebnis des letzten Abgleichs — auch im Bibliotheks-Panel verwendet. */
export const DeviceLibrarySyncReport = ({
  lastSync,
  lastError,
}: {
  lastSync: ReturnType<typeof useDeviceLibraryStore.getState>['lastSync']
  lastError: ReturnType<typeof useDeviceLibraryStore.getState>['lastError']
}) => {
  const t = useTranslation()
  if (lastError) {
    return (
      <div className="mt-2 text-cp-danger" role="alert">
        {errorText(lastError, t)}
      </div>
    )
  }
  if (!lastSync) return null
  return (
    <div className="mt-2 space-y-1 text-cp-text-muted">
      <div>
        {format(
          t('deviceLibrary.syncResult', '{added} new, {updated} updated, {removed} removed.'),
          { added: lastSync.added, updated: lastSync.updated, removed: lastSync.removed },
        )}
      </div>
      {lastSync.reset && (
        <div>{t('deviceLibrary.syncReset', 'The server was reset; the whole library was fetched again.')}</div>
      )}
      {lastSync.invalid > 0 && (
        <div className="text-cp-warn" title={lastSync.invalidNames.join('\n')}>
          {format(
            t('deviceLibrary.syncInvalid', '{n} entries skipped: they fail the template check of this app (ports, connector types, datasheet link).'),
            { n: lastSync.invalid },
          )}
        </div>
      )}
      {!lastSync.persisted && (
        <div className="text-cp-warn">
          {t('deviceLibrary.notPersisted', 'The local storage is full: the synced devices are only kept until the app restarts.')}
        </div>
      )}
    </div>
  )
}
