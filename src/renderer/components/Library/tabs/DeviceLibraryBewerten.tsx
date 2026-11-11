// ───────────────────────────────────────────────────────────────────────────
// Ein Gemeinschaftsgeraet bewerten: bestaetigen, beanstanden, aendern.
//
// WARUM IM PLANNER UND NICHT NUR AUF DER WEBSITE. Geprueft wird da, wo das
// Geraet steht. Wer beim Verkabeln sieht, dass die Vorlage eine Buchse zu
// viel hat, soll das im selben Fenster sagen koennen — jeder Umweg ueber den
// Browser kostet den Hinweis, und ein Hinweis, der nicht kommt, ist der
// Grund, warum Katalogdaten jahrelang falsch bleiben.
//
// EINE BESTAETIGUNG GILT FUER DIE VERSION, die hier liegt (`versionId`), nicht
// fuer „das Geraet". Nach einer Aenderung zaehlt neu. Liegt der eigene Stand
// zurueck, antwortet der Server `not-current-version` — lieber eine
// Fehlermeldung als eine Beglaubigung fuer Daten, die niemand gesehen hat.
//
// „Am Geraet" wiegt mehr als „gegen Datenblatt": verifiziert braucht drei
// Bestaetigungen UND mindestens eine am Geraet. Deshalb fragt der Dialog
// nach der Pruefart, statt einen Daumen anzubieten.
// ───────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { AlertTriangle, Check, Pencil } from 'lucide-react'
import { cablePlannerApi } from '../../../lib/bridge'
import { format, useTranslation } from '../../../lib/i18n'
import { errorText } from '../../../lib/deviceLibrary'
import { useProjectStore } from '../../../store/projectStore'
import { useDeviceLibraryStore } from '../../../store/deviceLibraryStore'
import { Icon } from '../../shared/Icon'
import type { ConfirmMethod } from '../../../lib/deviceLibraryClient'
import type { DeviceLibraryEntry } from '../../../types/deviceLibrary'

const knopf =
  'inline-flex items-center gap-1 border border-cp-border bg-cp-surface-1 px-1.5 py-0.5 text-cp-xs hover:bg-cp-surface-3 disabled:opacity-40'
const feld = 'w-full border border-cp-border bg-cp-surface-1 px-1.5 py-1 text-cp-xs text-cp-text'

/** Mindestlaenge des Beanstandungsgrunds — dieselbe wie im Server. */
export const GRUND_MIN = 10

type Form = 'confirm' | 'dispute' | null

export const DeviceLibraryBewerten = ({ entry, server, signedIn }: { entry: DeviceLibraryEntry; server: string; signedIn: boolean }) => {
  const t = useTranslation()
  const [form, setForm] = useState<Form>(null)
  const [method, setMethod] = useState<ConfirmMethod>('datasheet')
  const [firmware, setFirmware] = useState('')
  const [grund, setGrund] = useState('')
  const [busy, setBusy] = useState(false)
  const [sagen, setSagen] = useState('')
  const [fehler, setFehler] = useState('')
  const sync = useDeviceLibraryStore((s) => s.sync)
  const addCustomTemplate = useProjectStore((s) => s.addCustomTemplate)
  const customLibrary = useProjectStore((s) => s.customLibrary)

  // Ein Stand, der vor 11/2026 abgeglichen wurde, kennt die Versions-Id
  // nicht. Dann gibt es nichts zu bewerten — aber einen Satz, der sagt,
  // warum, statt eines Knopfes, der 404 liefert.
  const bewertbar = entry.versionId > 0

  const lauf = async (f: () => Promise<{ ok: boolean; code?: string; status?: number; message?: string }>, erfolg: string) => {
    setBusy(true)
    setFehler('')
    setSagen('')
    try {
      const r = await f()
      if (!r.ok) {
        setFehler(errorText(r as Parameters<typeof errorText>[0], t))
        return
      }
      setSagen(erfolg)
      setForm(null)
      // Status und Zahl kommen vom Server, nicht aus einer Vermutung hier.
      await sync(server)
    } finally {
      setBusy(false)
    }
  }

  /** Die Vorlage in die eigene Bibliothek kopieren, damit sie bearbeitbar
   *  ist. Beim naechsten Hochladen erkennt der Server Hersteller + Modell
   *  wieder und macht daraus einen AENDERUNGSVORSCHLAG an diesem Geraet —
   *  kein zweites Geraet mit demselben Namen. */
  const aendern = () => {
    setFehler('')
    if (customLibrary.some((v) => v.name === entry.template.name)) {
      setSagen(t('deviceLibrary.rate.alreadyOwn', 'You already have this device as your own template — edit it in “Local”.'))
      return
    }
    addCustomTemplate({ ...entry.template })
    setSagen(
      t(
        'deviceLibrary.rate.copied',
        'Copied to your own templates. Edit it under “Local”; the next upload sends it as a change proposal for this device.',
      ),
    )
  }

  return (
    <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={knopf} disabled={!signedIn || !bewertbar || busy} onClick={() => setForm(form === 'confirm' ? null : 'confirm')}>
          <Icon icon={Check} size="xs" /> {t('deviceLibrary.rate.confirm', 'Confirm')}
        </button>
        <button type="button" className={knopf} disabled={!signedIn || !bewertbar || busy} onClick={() => setForm(form === 'dispute' ? null : 'dispute')}>
          <Icon icon={AlertTriangle} size="xs" /> {t('deviceLibrary.rate.dispute', 'Report an error')}
        </button>
        <button type="button" className={knopf} onClick={aendern}>
          <Icon icon={Pencil} size="xs" /> {t('deviceLibrary.rate.change', 'Propose a change')}
        </button>
      </div>

      {!bewertbar && (
        <div className="text-cp-text-faint">
          {t('deviceLibrary.rate.noVersion', 'Update once: this entry comes from an older sync that did not carry the version.')}
        </div>
      )}

      {form === 'confirm' && (
        <div className="space-y-1 border border-cp-border-muted bg-cp-surface-2 p-1.5">
          <div className="text-cp-text-muted">
            {format(t('deviceLibrary.rate.confirmIntro', 'You confirm version {v} — the data as it is here.'), { v: entry.version })}
          </div>
          <label className="flex items-center gap-1">
            <input type="radio" name={`m-${entry.slug}`} checked={method === 'datasheet'} onChange={() => setMethod('datasheet')} />
            <span>{t('deviceLibrary.rate.datasheet', 'Checked against the datasheet')}</span>
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name={`m-${entry.slug}`} checked={method === 'hands-on'} onChange={() => setMethod('hands-on')} />
            <span>{t('deviceLibrary.rate.handsOn', 'Checked on the device itself')}</span>
          </label>
          <input
            type="text"
            value={firmware}
            onChange={(e) => setFirmware(e.target.value)}
            placeholder={t('deviceLibrary.rate.firmware', 'Firmware (optional)')}
            aria-label={t('deviceLibrary.rate.firmware', 'Firmware (optional)')}
            className={feld}
          />
          <button
            type="button"
            disabled={busy}
            className="bg-cp-accent px-2 py-0.5 text-cp-xs text-cp-accent-text disabled:opacity-40"
            onClick={() =>
              void lauf(
                () => cablePlannerApi.deviceLibrary.confirm(server, entry.versionId, { method, firmware: firmware.trim() }),
                t('deviceLibrary.rate.confirmed', 'Confirmation sent.'),
              )
            }
          >
            {t('deviceLibrary.rate.send', 'Send')}
          </button>
        </div>
      )}

      {form === 'dispute' && (
        <div className="space-y-1 border border-cp-border-muted bg-cp-surface-2 p-1.5">
          <div className="text-cp-text-muted">
            {t(
              'deviceLibrary.rate.disputeIntro',
              'An objection overrules every confirmation until moderation has settled it. Say what is wrong and where the correct value comes from.',
            )}
          </div>
          <textarea
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            rows={3}
            placeholder={t('deviceLibrary.rate.reason', 'e.g. “SDI out is 6G, not 3G — datasheet page 2.”')}
            aria-label={t('deviceLibrary.rate.reason', 'e.g. “SDI out is 6G, not 3G — datasheet page 2.”')}
            className={feld}
          />
          <button
            type="button"
            disabled={busy || grund.trim().length < GRUND_MIN}
            className="bg-cp-accent px-2 py-0.5 text-cp-xs text-cp-accent-text disabled:opacity-40"
            onClick={() =>
              void lauf(
                () => cablePlannerApi.deviceLibrary.dispute(server, entry.versionId, grund.trim()),
                t('deviceLibrary.rate.disputed', 'Objection sent. Moderation looks at it.'),
              )
            }
          >
            {t('deviceLibrary.rate.send', 'Send')}
          </button>
        </div>
      )}

      {sagen && <div className="text-cp-ok">{sagen}</div>}
      {fehler && (
        <div className="text-cp-danger" role="alert">
          {fehler}
        </div>
      )}
    </div>
  )
}
