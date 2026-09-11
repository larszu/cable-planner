import { useMemo, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { SettingsCard } from '../SettingsCard'
import { PanelHint } from '../../shared/PanelHint'
import { useTranslation, format } from '../../../lib/i18n'
import { useNachweisStore, type NachweisEingabe } from '../../../store/nachweisStore'
import {
  NACHWEIS_ARTEN,
  NACHWEIS_ART_LABEL,
  NACHWEIS_LAGE_LABEL,
  type Nachweis,
  type NachweisArt,
} from '../../../types/nachweis'
import {
  laeuftBaldAb,
  nachweisDeckblatt,
  nachweisLage,
  nachweisPaket,
  tageBisFrist,
} from '../../../lib/nachweisPack'
import { toCsv } from '../../../lib/csv'
import { downloadBlob } from '../../../lib/downloadBlob'

/**
 * Die Nachweise dieser Person (Bedarf 120).
 *
 * WARUM DIESER TAB IN DEN EINSTELLUNGEN LIEGT UND NICHT IM PROJEKT. Ein
 * Nachweis gilt für den Menschen und überlebt jedes Projekt; in einer
 * `.avplan`, die an einen Kunden geht, hätte er nichts zu suchen. Er steht
 * deshalb dort, wo alles andere Rechner-Gebundene steht.
 *
 * DIE EINE STELLE, AN DER DIESE SEITE GEFÄHRLICH WÄRE, ist die Anzeige der
 * Lage: ein Eintrag ohne Frist darf nicht wie ein gültiger aussehen. Die drei
 * Zustände haben deshalb drei verschiedene Farben, und „keine Frist
 * angegeben" ist ausdrücklich KEIN Grün.
 */

const inputCls =
  'mt-0.5 w-full rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text'

const LAGE_TON: Record<keyof typeof NACHWEIS_LAGE_LABEL, string> = {
  'in-frist': 'bg-emerald-700/30 text-emerald-400',
  abgelaufen: 'bg-red-700/30 text-red-400',
  // Bewusst KEIN Gruen und kein Rot: „unbekannt" ist eine eigene Aussage und
  // sieht auch so aus. Gruen waere die Entwarnung durch die Hintertuer.
  'ohne-frist': 'bg-amber-600/30 text-amber-300',
}

type FormState = NachweisEingabe & { id?: string }

const leer = (): FormState => ({ art: 'qualifikation', bezeichnung: '' })

export const NachweiseTab = () => {
  const t = useTranslation()
  const nachweise = useNachweisStore((s) => s.nachweise)
  const vorwarnTage = useNachweisStore((s) => s.vorwarnTage)
  const speicherVoll = useNachweisStore((s) => s.speicherVoll)
  const addNachweis = useNachweisStore((s) => s.addNachweis)
  const updateNachweis = useNachweisStore((s) => s.updateNachweis)
  const removeNachweis = useNachweisStore((s) => s.removeNachweis)
  const setVorwarnTage = useNachweisStore((s) => s.setVorwarnTage)

  const [form, setForm] = useState<FormState | null>(null)

  // Der Stichtag wird EINMAL genommen und dann durchgereicht — sonst
  // beantworteten zwei Zeilen derselben Liste die Frage „gilt das noch" an
  // zwei verschiedenen Zeitpunkten.
  const heute = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const bald = useMemo(
    () => laeuftBaldAb(nachweise, heute, vorwarnTage),
    [nachweise, heute, vorwarnTage],
  )

  const speichern = () => {
    if (!form || !form.bezeichnung.trim()) return
    const { id, ...rest } = form
    if (id) updateNachweis(id, rest)
    else addNachweis(rest)
    setForm(null)
  }

  const packen = () => {
    const paket = nachweisPaket(nachweise, heute)
    const tabelle = nachweisDeckblatt(paket)
    downloadBlob('nachweise-deckblatt.csv', toCsv(tabelle.headers, tabelle.rows), 'text/csv')
  }

  return (
    <div className="flex flex-col gap-3">
      <SettingsCard
        title={t('nachweis.title', 'Credentials')}
        description={t(
          'nachweis.intro',
          'Qualifications, insurance and safety briefings held by this person, with expiry dates. They belong to you, not to the plan — they never go into a project file.',
        )}
      >
        {speicherVoll && (
          <PanelHint
            className="mb-2 text-cp-xs text-red-400"
            text={t(
              'nachweis.storageFull',
              'The last entry could not be saved — storage is full. It is shown here but would be gone on the next start.',
            )}
          />
        )}

        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-cp-xs text-cp-text-muted">
            {format(t('nachweis.count', '{n} credentials'), { n: nachweise.length })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={nachweise.length === 0}
              onClick={packen}
              title={t(
                'nachweis.packHint',
                'Cover sheet for the credential pack: what is enclosed, until when it is valid, and what is still missing. Put the scans next to it — the app does not store them.',
              )}
              className="flex items-center gap-1 bg-cp-surface-4 px-2.5 py-1.5 text-cp-xs enabled:hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={13} /> {t('nachweis.pack', 'Cover sheet')}
            </button>
            <button
              type="button"
              onClick={() => setForm(leer())}
              className="flex items-center gap-1 bg-emerald-700 px-2.5 py-1.5 text-cp-xs hover:bg-emerald-600"
            >
              <Plus size={14} /> {t('nachweis.add', 'Credential')}
            </button>
          </div>
        </div>

        {form && (
          <div className="mb-3 border border-cp-accent/40 bg-cp-surface-2 p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <label className="block text-cp-xs">
                {t('nachweis.art', 'Kind')}
                <select
                  value={form.art}
                  onChange={(e) => setForm({ ...form, art: e.target.value as NachweisArt })}
                  className={inputCls}
                >
                  {NACHWEIS_ARTEN.map((a) => (
                    <option key={a} value={a}>
                      {NACHWEIS_ART_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-cp-xs md:col-span-2">
                {t('nachweis.bezeichnung', 'Name')} <span className="text-red-400">*</span>
                <input
                  autoFocus
                  value={form.bezeichnung}
                  onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })}
                  placeholder={t('nachweis.bezeichnungPh', 'e.g. working-at-height certificate')}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs">
                {t('nachweis.aussteller', 'Issued by')}
                <input
                  value={form.aussteller ?? ''}
                  onChange={(e) => setForm({ ...form, aussteller: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs">
                {t('nachweis.nummer', 'Number')}
                <input
                  value={form.nummer ?? ''}
                  onChange={(e) => setForm({ ...form, nummer: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs">
                {t('nachweis.ausgestellt', 'Issued on')}
                <input
                  type="date"
                  value={form.ausgestelltAm ?? ''}
                  onChange={(e) => setForm({ ...form, ausgestelltAm: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs">
                {t('nachweis.gueltigBis', 'Valid until')}
                <input
                  type="date"
                  value={form.gueltigBis ?? ''}
                  onChange={(e) => setForm({ ...form, gueltigBis: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs md:col-span-2">
                {t('nachweis.datei', 'Scan file name')}
                <input
                  value={form.dateiName ?? ''}
                  onChange={(e) => setForm({ ...form, dateiName: e.target.value })}
                  placeholder={t('nachweis.dateiPh', 'e.g. height-2026.pdf')}
                  className={inputCls}
                />
              </label>
            </div>
            <PanelHint
              className="mt-2 text-cp-xs text-cp-text-muted"
              text={t(
                'nachweis.noExpiryHint',
                'Without a “valid until” date the credential does not count as open-ended — it counts as “no expiry stated”, and the cover sheet says exactly that.',
              )}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={!form.bezeichnung.trim()}
                onClick={speichern}
                className="bg-emerald-700 px-3 py-1 text-cp-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        )}

        {nachweise.length === 0 ? (
          <div className="border border-dashed border-cp-border py-8 text-center text-cp-xs text-cp-text-muted">
            {t('nachweis.empty', 'No credentials entered yet.')}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {nachweise.map((n: Nachweis) => {
              const lage = nachweisLage(n, heute)
              const tage = tageBisFrist(n, heute)
              return (
                <li
                  key={n.id}
                  className="flex items-center gap-2 border border-cp-border-muted bg-cp-surface-2 px-2 py-1 text-cp-xs"
                >
                  <span className={` px-1.5 py-0.5 ${LAGE_TON[lage]}`}>
                    {NACHWEIS_LAGE_LABEL[lage]}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <strong>{n.bezeichnung}</strong>
                    <span className="text-cp-text-muted"> · {NACHWEIS_ART_LABEL[n.art]}</span>
                    {n.gueltigBis && (
                      <span className="text-cp-text-muted">
                        {' '}
                        · {n.gueltigBis}
                        {tage !== undefined && tage >= 0
                          ? format(t('nachweis.inDays', ' (in {n} days)'), { n: tage })
                          : ''}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...n })}
                    className="px-1.5 py-0.5 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
                  >
                    {t('common.edit', 'Edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeNachweis(n.id)}
                    title={t('common.delete', 'Delete')}
                    className="p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard
        title={t('nachweis.warnTitle', 'Advance warning')}
        description={t(
          'nachweis.warnIntro',
          'How many days before expiry to warn. With no figure, nothing is reported — a default would be an opinion about how long a renewal takes.',
        )}
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={vorwarnTage ?? ''}
            onChange={(e) =>
              setVorwarnTage(e.target.value === '' ? undefined : Number(e.target.value))
            }
            placeholder={t('nachweis.warnPh', 'not stated')}
            className="w-32 border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text"
          />
          <span className="text-cp-xs text-cp-text-muted">{t('nachweis.days', 'days')}</span>
        </div>
        {vorwarnTage !== undefined && (
          <div className="mt-2 text-cp-xs text-cp-text-secondary">
            {bald.length === 0
              ? t('nachweis.noneSoon', 'Nothing expires within that window.')
              : format(t('nachweis.someSoon', '{n} expire within that window: {liste}'), {
                  n: bald.length,
                  liste: bald.map((n) => n.bezeichnung).join(', '),
                })}
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
