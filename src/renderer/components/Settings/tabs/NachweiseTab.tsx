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
        title={t('nachweis.title', 'Nachweise')}
        description={t(
          'nachweis.intro',
          'Qualifikationen, Versicherungen und Unterweisungen dieser Person — mit Frist. Sie gehören zu Ihnen und nicht zum Plan; in eine Projektdatei kommen sie nie.',
        )}
      >
        {speicherVoll && (
          <PanelHint
            className="mb-2 text-cp-xs text-red-400"
            text={t(
              'nachweis.storageFull',
              'Der letzte Eintrag konnte nicht gespeichert werden — der Speicher ist voll. Er steht hier, wäre beim nächsten Start aber weg.',
            )}
          />
        )}

        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-cp-xs text-cp-text-muted">
            {format(t('nachweis.count', '{n} Nachweise'), { n: nachweise.length })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={nachweise.length === 0}
              onClick={packen}
              title={t(
                'nachweis.packHint',
                'Deckblatt fürs Nachweis-Paket: was beiliegt, bis wann es gilt, und was noch fehlt. Die Scans selbst legen Sie daneben — die Anwendung speichert sie nicht.',
              )}
              className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1.5 text-cp-xs enabled:hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={13} /> {t('nachweis.pack', 'Deckblatt')}
            </button>
            <button
              type="button"
              onClick={() => setForm(leer())}
              className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 text-cp-xs hover:bg-emerald-600"
            >
              <Plus size={14} /> {t('nachweis.add', 'Nachweis')}
            </button>
          </div>
        </div>

        {form && (
          <div className="mb-3 rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <label className="block text-cp-xs">
                {t('nachweis.art', 'Art')}
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
                {t('nachweis.bezeichnung', 'Bezeichnung')} <span className="text-red-400">*</span>
                <input
                  autoFocus
                  value={form.bezeichnung}
                  onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })}
                  placeholder={t('nachweis.bezeichnungPh', 'z. B. Sachkundenachweis PSAgA')}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs">
                {t('nachweis.aussteller', 'Aussteller')}
                <input
                  value={form.aussteller ?? ''}
                  onChange={(e) => setForm({ ...form, aussteller: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs">
                {t('nachweis.nummer', 'Nummer')}
                <input
                  value={form.nummer ?? ''}
                  onChange={(e) => setForm({ ...form, nummer: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs">
                {t('nachweis.ausgestellt', 'Ausgestellt am')}
                <input
                  type="date"
                  value={form.ausgestelltAm ?? ''}
                  onChange={(e) => setForm({ ...form, ausgestelltAm: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs">
                {t('nachweis.gueltigBis', 'Gültig bis')}
                <input
                  type="date"
                  value={form.gueltigBis ?? ''}
                  onChange={(e) => setForm({ ...form, gueltigBis: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-cp-xs md:col-span-2">
                {t('nachweis.datei', 'Dateiname des Scans')}
                <input
                  value={form.dateiName ?? ''}
                  onChange={(e) => setForm({ ...form, dateiName: e.target.value })}
                  placeholder={t('nachweis.dateiPh', 'z. B. psaga-2026.pdf')}
                  className={inputCls}
                />
              </label>
            </div>
            <PanelHint
              className="mt-2 text-cp-xs text-cp-text-muted"
              text={t(
                'nachweis.noExpiryHint',
                'Ohne „Gültig bis" gilt der Nachweis nicht als unbefristet, sondern als „keine Frist angegeben" — und das steht auch so auf dem Deckblatt.',
              )}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('common.cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                disabled={!form.bezeichnung.trim()}
                onClick={speichern}
                className="rounded bg-emerald-700 px-3 py-1 text-cp-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('common.save', 'Speichern')}
              </button>
            </div>
          </div>
        )}

        {nachweise.length === 0 ? (
          <div className="rounded border border-dashed border-cp-border py-8 text-center text-cp-xs text-cp-text-muted">
            {t('nachweis.empty', 'Noch keine Nachweise eingetragen.')}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {nachweise.map((n: Nachweis) => {
              const lage = nachweisLage(n, heute)
              const tage = tageBisFrist(n, heute)
              return (
                <li
                  key={n.id}
                  className="flex items-center gap-2 rounded border border-cp-border-muted bg-cp-surface-2 px-2 py-1 text-cp-xs"
                >
                  <span className={`rounded px-1.5 py-0.5 ${LAGE_TON[lage]}`}>
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
                          ? format(t('nachweis.inDays', ' (in {n} Tagen)'), { n: tage })
                          : ''}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...n })}
                    className="rounded px-1.5 py-0.5 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
                  >
                    {t('common.edit', 'Bearbeiten')}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeNachweis(n.id)}
                    title={t('common.delete', 'Löschen')}
                    className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-red-400"
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
        title={t('nachweis.warnTitle', 'Vorwarnzeit')}
        description={t(
          'nachweis.warnIntro',
          'Ab wie vielen Tagen vor Fristende gewarnt werden soll. Ohne Angabe wird nicht gewarnt — eine Vorgabe wäre eine Meinung darüber, wie lange eine Verlängerung dauert.',
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
            placeholder={t('nachweis.warnPh', 'keine Angabe')}
            className="w-32 rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text"
          />
          <span className="text-cp-xs text-cp-text-muted">{t('nachweis.days', 'Tage')}</span>
        </div>
        {vorwarnTage !== undefined && (
          <div className="mt-2 text-cp-xs text-cp-text-secondary">
            {bald.length === 0
              ? t('nachweis.noneSoon', 'Innerhalb dieser Frist läuft nichts ab.')
              : format(t('nachweis.someSoon', '{n} laufen innerhalb dieser Frist ab: {liste}'), {
                  n: bald.length,
                  liste: bald.map((n) => n.bezeichnung).join(', '),
                })}
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
