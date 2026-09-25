// ───────────────────────────────────────────────────────────────────────────
// Eigene Vorlagen einreichen (#878) — Ziel Datei ODER Geraetebibliothek.
//
// Die Pruefung davor ist dieselbe wie beim Datei-Weg (`baueEinreichung` →
// `pruefeVorlage`); was sie nicht besteht, erscheint hier mit Grund und geht
// weder in die Datei noch an den Server.
//
// Die Bibliothek verlangt Hersteller und Modell getrennt; die Vorlagen dieser
// App kennen nur einen Namen. Der Dialog schlaegt die Trennung vor (erstes
// Wort = Hersteller), der Nutzer korrigiert. Der Datenblattlink ist der der
// Vorlage — ohne ihn kaeme sie gar nicht bis hierher.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { format, useTranslation } from '../../lib/i18n'
import { backdropMouseDown } from '../../lib/modalRoot'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { cablePlannerApi } from '../../lib/bridge'
import { downloadBlob } from '../../lib/downloadBlob'
import { deviceUrl } from '../../lib/deviceLibraryClient'
import { effectiveServer, errorText, guessManufacturerModel, guidelinesUrl, proposalFor } from '../../lib/deviceLibrary'
import type { Einreichung } from '../../lib/vorlagenEinreichung'
import type { DeviceLibraryErrorCode } from '../../types/deviceLibrary'
import { useSettingsStore } from '../../store/settingsStore'
import { useDeviceLibraryStore } from '../../store/deviceLibraryStore'
import { useUiStore } from '../../store/uiStore'

type Ergebnis = { ok: true; slug: string } | { ok: false; text: string; code: DeviceLibraryErrorCode }

interface Zeile {
  auswahl: boolean
  manufacturer: string
  model: string
  ergebnis?: Ergebnis
}

const knopf = 'bg-cp-surface-3 px-3 py-1 text-cp-xs hover:bg-cp-surface-4 disabled:opacity-40'
const feld = 'min-w-0 flex-1 border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs'

/** Geoeffnet ueber `mountModal` (siehe `LocalEquipmentTab`). */
export const DeviceLibrarySubmitDialog = ({ paket, total, onClose }: { paket: Einreichung; total: number; onClose: () => void }) => {
  const t = useTranslation()
  const server = effectiveServer(useSettingsStore((s) => s.deviceLibraryUrl))
  const session = useDeviceLibraryStore((s) => s.session)
  const refreshSession = useDeviceLibraryStore((s) => s.refreshSession)
  const [zeilen, setZeilen] = useState<Zeile[]>(() =>
    paket.eintraege.map((e) => ({ auswahl: true, ...guessManufacturerModel(e.vorlage.name) })),
  )
  const [busy, setBusy] = useState(false)
  const { panelRef, titleId, dialogProps } = useDialogA11y(true, onClose)

  useEffect(() => {
    void refreshSession(server)
  }, [server, refreshSession])

  const signedIn = session === 'signed-in' || session === 'unverified'
  const setZeile = (i: number, patch: Partial<Zeile>) =>
    setZeilen((z) => z.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const bereit = zeilen.filter((z) => z.auswahl && !z.ergebnis?.ok && z.manufacturer.trim() && z.model.trim())

  const senden = async () => {
    setBusy(true)
    try {
      for (let i = 0; i < zeilen.length; i += 1) {
        const z = zeilen[i]
        if (!z.auswahl || z.ergebnis?.ok || !z.manufacturer.trim() || !z.model.trim()) continue
        const { core, facet } = proposalFor(paket.eintraege[i].vorlage, z)
        const r = await cablePlannerApi.deviceLibrary.propose(server, core, facet)
        setZeile(i, { ergebnis: r.ok ? { ok: true, slug: r.value.slug } : { ok: false, text: errorText(r, t), code: r.code } })
        if (!r.ok && r.code === 'not-signed-in') {
          await refreshSession(server)
          break
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const alsDatei = () =>
    downloadBlob('cable-planner-devices.submission.json', JSON.stringify(paket, null, 2), 'application/json')

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={backdropMouseDown(onClose)}
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col border border-cp-border bg-cp-surface-1 text-cp-text"
      >
        <header id={titleId} className="border-b border-cp-border-muted px-4 py-2 text-cp-base font-semibold">
          {t('library.submit.title', 'Submit templates')}
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-cp-xs">
          <p>
            {format(t('library.submit.summary', '{n} of {total} templates can be submitted.'), {
              n: paket.eintraege.length,
              total,
            })}
          </p>
          {paket.uebersprungen.length > 0 && (
            <ul className="space-y-0.5 text-cp-warn">
              {paket.uebersprungen.map((u) => (
                <li key={u.name}>— {u.name}: {u.gruende[0] ?? ''}</li>
              ))}
            </ul>
          )}

          {paket.eintraege.length > 0 && (
            <>
              <p className="text-cp-text-muted">
                {t(
                  'deviceLibrary.submitNames',
                  'The device library lists manufacturer and model separately. Check the split suggested from the template name.',
                )}
              </p>
              <ul className="space-y-2">
                {paket.eintraege.map((e, i) => {
                  const z = zeilen[i]
                  return (
                    <li key={`${e.vorlage.name}-${i}`} className="border border-cp-border-muted p-2">
                      <label className="flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={z.auswahl}
                          disabled={busy || z.ergebnis?.ok}
                          onChange={(ev) => setZeile(i, { auswahl: ev.target.checked })}
                        />
                        <span className="truncate">{e.vorlage.name}</span>
                      </label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <input
                          value={z.manufacturer}
                          onChange={(ev) => setZeile(i, { manufacturer: ev.target.value })}
                          disabled={busy || z.ergebnis?.ok}
                          placeholder={t('deviceLibrary.manufacturer', 'Manufacturer')}
                          aria-label={t('deviceLibrary.manufacturer', 'Manufacturer')}
                          className={feld}
                        />
                        <input
                          value={z.model}
                          onChange={(ev) => setZeile(i, { model: ev.target.value })}
                          disabled={busy || z.ergebnis?.ok}
                          placeholder={t('deviceLibrary.model', 'Model')}
                          aria-label={t('deviceLibrary.model', 'Model')}
                          className={feld}
                        />
                      </div>
                      <div className="mt-1 truncate text-cp-text-faint">
                        {format(t('deviceLibrary.datasheet', 'Datasheet: {url}'), { url: e.vorlage.manufacturerUrl ?? '' })}
                      </div>
                      {e.hinweise.map((h) => (
                        <div key={h} className="text-cp-text-muted">{h}</div>
                      ))}
                      {z.ergebnis?.ok && (
                        <div className="mt-1 flex items-center gap-2 text-cp-accent">
                          {t('deviceLibrary.submitted', 'Submitted — it is visible to others once a moderator approves it.')}
                          <a
                            href={deviceUrl(server, z.ergebnis.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <Icon icon={ExternalLink} size="xs" /> {t('deviceLibrary.devicePage', 'Page')}
                          </a>
                        </div>
                      )}
                      {z.ergebnis && !z.ergebnis.ok && (
                        <div className="mt-1 text-cp-danger" role="alert">
                          {z.ergebnis.text}
                          {z.ergebnis.code === 'guidelines-outdated' && (
                            <>
                              {' '}
                              <a
                                href={guidelinesUrl(server)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-cp-accent hover:underline"
                              >
                                <Icon icon={ExternalLink} size="xs" /> {t('deviceLibrary.guidelines', 'Open guidelines')}
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {paket.eintraege.length > 0 && !signedIn && session !== 'unknown' && (
            <div className="border border-cp-border-muted bg-cp-surface-2 p-2 text-cp-text-muted">
              {t(
                'deviceLibrary.submitSignIn',
                'To send templates to the device library, sign in first. Saving a submission file works without an account.',
              )}{' '}
              <button
                type="button"
                className="text-cp-accent hover:underline"
                onClick={() => {
                  onClose()
                  useUiStore.getState().openSettings('deviceLibrary')
                }}
              >
                {t('deviceLibrary.openSettings', 'Sign in…')}
              </button>
            </div>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-cp-border-muted px-4 py-2">
          <button type="button" onClick={onClose} className={knopf}>
            {t('common.close', 'Close')}
          </button>
          <button type="button" onClick={alsDatei} disabled={paket.eintraege.length === 0} className={knopf}>
            {t('deviceLibrary.saveFile', 'Save submission file')}
          </button>
          <button
            type="button"
            onClick={() => void senden()}
            disabled={busy || !signedIn || bereit.length === 0}
            className="bg-cp-accent px-3 py-1 text-cp-xs text-white disabled:opacity-40"
          >
            {busy
              ? t('deviceLibrary.sending', 'Sending…')
              : format(t('deviceLibrary.send', 'Send {n} to device library'), { n: bereit.length })}
          </button>
        </footer>
      </div>
    </div>
  )
}
