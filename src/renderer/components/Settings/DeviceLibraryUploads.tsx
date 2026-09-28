// ───────────────────────────────────────────────────────────────────────────
// Einstellungen → Device library → „My devices": was von den eigenen
// Vorlagen in der Bibliothek ist, je Vorlage, und die Hersteller/Modell-
// Trennung dazu. Die Trennung ist keine Formsache: an Hersteller + Modell
// erkennt die Bibliothek dasselbe Geraet ueber alle Planner hinweg.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { format, useTranslation } from '../../lib/i18n'
import { deviceUrl } from '../../lib/deviceLibraryClient'
import { errorText } from '../../lib/deviceLibrary'
import { fingerabdruck, uploadItemAus } from '../../lib/deviceLibraryItem'
import { eigeneVorlagen, namenFuer, type UploadEintrag } from '../../lib/deviceLibraryUpload'
import { useSettingsStore } from '../../store/settingsStore'
import { useProjectStore } from '../../store/projectStore'
import { useDeviceLibraryStore } from '../../store/deviceLibraryStore'
import { SettingsCard } from './SettingsCard'
import { Icon } from '../shared/Icon'

const knopf =
  'inline-flex items-center gap-1 bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4 disabled:opacity-40'
const feld = 'min-w-0 flex-1 border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs'

export const DeviceLibraryUploads = ({ server, signedIn }: { server: string; signedIn: boolean }) => {
  const t = useTranslation()
  const auto = useSettingsStore((s) => s.deviceLibraryAutoUpload)
  const setAuto = useSettingsStore((s) => s.setDeviceLibraryAutoUpload)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const uploads = useDeviceLibraryStore((s) => s.uploads)
  const uploading = useDeviceLibraryStore((s) => s.uploading)
  const syncing = useDeviceLibraryStore((s) => s.syncing)
  const lastUpload = useDeviceLibraryStore((s) => s.lastUpload)
  const uploadError = useDeviceLibraryStore((s) => s.uploadError)
  const setNames = useDeviceLibraryStore((s) => s.setNames)
  const syncNow = useDeviceLibraryStore((s) => s.syncNow)

  const eigene = useMemo(() => eigeneVorlagen(customLibrary), [customLibrary])

  const zustandText = (e: UploadEintrag | undefined, geaendert: boolean): { text: string; klasse: string } => {
    if (!e) return { text: t('deviceLibrary.up.never', 'not uploaded yet'), klasse: 'text-cp-text-muted' }
    if (geaendert && e.zustand !== 'local-blocked') {
      return { text: t('deviceLibrary.up.changed', 'changed since the last upload'), klasse: 'text-cp-text-muted' }
    }
    if (e.zustand !== 'blocked' && e.zustand !== 'local-blocked' && e.zustand !== 'error') {
      if (e.moderation === 'pending') {
        return { text: t('deviceLibrary.up.pending', 'uploaded — waiting for moderation'), klasse: 'text-cp-text' }
      }
      if (e.moderation === 'approved') {
        return { text: t('deviceLibrary.up.approved', 'uploaded — live'), klasse: 'text-cp-accent' }
      }
    }
    switch (e.zustand) {
      case 'created':
      case 'edit-proposed':
      case 'pending-updated':
        return { text: t('deviceLibrary.up.pending', 'uploaded — waiting for moderation'), klasse: 'text-cp-text' }
      case 'approved':
        return { text: t('deviceLibrary.up.approved', 'uploaded — live'), klasse: 'text-cp-accent' }
      case 'in-sync':
        return { text: t('deviceLibrary.up.inSync', 'up to date'), klasse: 'text-cp-accent' }
      case 'blocked':
      case 'local-blocked':
        return { text: t('deviceLibrary.up.blocked', 'blocked — fix the points below'), klasse: 'text-cp-warn' }
      default:
        return {
          text: format(t('deviceLibrary.up.error', 'error: {error}'), { error: e.fehler ?? '' }),
          klasse: 'text-cp-danger',
        }
    }
  }

  const befundText = (b: string) =>
    b === 'manufacturer-missing'
      ? t('deviceLibrary.up.noManufacturer', 'Manufacturer missing — enter it above.')
      : b === 'model-missing'
        ? t('deviceLibrary.up.noModel', 'Model missing — enter it above.')
        : b

  return (
    <SettingsCard
      title={t('deviceLibrary.upTitle', 'My devices')}
      description={t(
        'deviceLibrary.upDesc',
        'Templates you created or changed are uploaded to the device library; unchanged built-in templates are published by the project itself. Uploads go to moderation first.',
      )}
    >
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        <span>
          {t('deviceLibrary.autoUpload', 'Upload my own devices automatically')}
          <span className="ml-1 text-cp-text-muted">
            {t('deviceLibrary.autoUploadHint', '(at start and after changing a template, while signed in)')}
          </span>
        </span>
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void syncNow(server, customLibrary)}
          disabled={!signedIn || uploading || syncing}
          className={knopf}
        >
          <Icon icon={RefreshCw} size="xs" />{' '}
          {uploading || syncing ? t('deviceLibrary.syncing', 'Updating…') : t('deviceLibrary.syncNow', 'Sync now')}
        </button>
        <span className="text-cp-text-muted">
          {t('deviceLibrary.syncNowHint', 'uploads what changed, then fetches updates')}
        </span>
      </div>
      {uploadError && (
        <div className="mt-2 text-cp-danger" role="alert">{errorText(uploadError, t)}</div>
      )}
      {lastUpload && !uploadError && (
        <div className="mt-2 text-cp-text-muted">
          {lastUpload.gesendet === 0 && lastUpload.blockiert === 0
            ? t('deviceLibrary.up.nothing', 'Nothing to upload — everything is as last sent.')
            : format(
                t('deviceLibrary.up.result', '{sent} sent: {pending} waiting for moderation, {live} live, {blocked} blocked, {errors} errors.'),
                {
                  sent: lastUpload.gesendet,
                  pending: lastUpload.wartet,
                  live: lastUpload.live,
                  blocked: lastUpload.blockiert,
                  errors: lastUpload.fehler,
                },
              )}
        </div>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-cp-text-secondary">
          {format(t('deviceLibrary.up.list', 'Own templates ({n})'), { n: eigene.length })}
        </summary>
        {eigene.length === 0 ? (
          <p className="mt-1 text-cp-text-muted">
            {t('deviceLibrary.up.none', 'No templates of your own yet — built-in templates you have not changed are not listed.')}
          </p>
        ) : (
          <ul className="mt-1 space-y-2">
            {eigene.map((v) => {
              const namen = namenFuer(uploads, v)
              const e = uploads.eintraege[v.name]
              const geaendert = !!e && e.hash !== fingerabdruck(uploadItemAus(v, namen))
              const z = zustandText(e, geaendert)
              return (
                <li key={v.name} className="border border-cp-border-muted p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate font-medium text-cp-text">{v.name}</span>
                    <span className={z.klasse}>{z.text}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <input
                      value={namen.manufacturer}
                      onChange={(ev) => setNames(server, v.name, { ...namen, manufacturer: ev.target.value })}
                      placeholder={t('deviceLibrary.manufacturer', 'Manufacturer')}
                      aria-label={format(t('deviceLibrary.manufacturerOf', 'Manufacturer of {name}'), { name: v.name })}
                      className={feld}
                    />
                    <input
                      value={namen.model}
                      onChange={(ev) => setNames(server, v.name, { ...namen, model: ev.target.value })}
                      placeholder={t('deviceLibrary.model', 'Model')}
                      aria-label={format(t('deviceLibrary.modelOf', 'Model of {name}'), { name: v.name })}
                      className={feld}
                    />
                  </div>
                  {!geaendert && e?.befunde?.map((b) => (
                    <div key={b} className="text-cp-warn">— {befundText(b)}</div>
                  ))}
                  {e?.slug && (
                    <a
                      href={deviceUrl(server, e.slug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-cp-accent hover:underline"
                    >
                      <Icon icon={ExternalLink} size="xs" /> {t('deviceLibrary.devicePage', 'Page')}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </details>
    </SettingsCard>
  )
}
