import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { VIDEO_FORMATS, type VideoFormatId } from '../../../types/videoFormat'
import {
  DYNAMIKEN,
  FARBRAEUME,
  FARBTIEFEN,
  type Dynamik,
  type Farbraum,
  type Farbtiefe,
  type SenkenFormat,
  type Senkenprofil,
} from '../../../types/displayCapability'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'

/**
 * Das virtuelle EDID einer Senke (B-47).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DAS VON HAND EINGETRAGEN WIRD
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Eine ausgelesene EDID ist eine 128-Byte-Struktur mit Erweiterungsblöcken,
 * und ihre Feldbedeutungen stehen in einer Spezifikation, die aus dieser
 * Umgebung nicht erreichbar ist. Sie aus dem Gedächtnis zu entziffern wäre
 * schlimmer als bei einem Protokoll: ein falsch gelesenes Byte ergibt keine
 * Fehlermeldung, sondern eine plausible Zahl. Ein Gerät bekäme „nimmt
 * 2160p60 an", weil ein Offset um eins daneben lag.
 *
 * Und aus `resolution` abzuleiten wäre derselbe Fehlschluss: zwei Monitore
 * mit „3840x2160" können verschiedene Bildwiederholraten, Farbtiefen und
 * HDR-Fassungen annehmen.
 *
 * Also: erklärt, mit Herkunft im Klartext. Leere Listen heissen „dazu ist
 * nichts erklärt" und führen zu „offen" — nicht zu einem stillen „na klar".
 */
export const SinkProfileSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const profil = equipment.senkenprofil

  const setze = (teil: Partial<Senkenprofil>) => {
    if (!profil) return
    updateEquipment(equipment.id, { senkenprofil: { ...profil, ...teil } })
  }

  const setzeFormat = (i: number, teil: Partial<SenkenFormat>) =>
    setze({ formate: (profil?.formate ?? []).map((f, j) => (j === i ? { ...f, ...teil } : f)) })

  const kippe = <W,>(liste: W[], wert: W): W[] =>
    liste.includes(wert) ? liste.filter((x) => x !== wert) : [...liste, wert]

  const summary = profil
    ? t('sink.summaryN', '{n} Format(e) erklärt').replace('{n}', String(profil.formate.length))
    : t('sink.none', 'nicht erklärt')

  return (
    <SortableSection id="sink-profile" title={t('sink.title', 'Formatprofil (Senke)')} subtitle={summary}>
      <label className="flex items-center gap-2 text-cp-xs">
        <input
          type="checkbox"
          checked={!!profil}
          onChange={(e) =>
            updateEquipment(equipment.id, {
              senkenprofil: e.target.checked ? { herkunft: '', formate: [] } : undefined,
            })
          }
        />
        <span className="text-cp-text-secondary">
          {t('sink.declare', 'Für dieses Gerät ist erklärt, welche Formate es annimmt')}
        </span>
      </label>

      {!profil ? (
        <PanelHint
          className="mt-2 text-cp-xs text-cp-text-muted"
          text={t(
            'sink.noneHint',
            'Ohne Profil sagt der Plan „nicht erklärt" statt „passt" — er behauptet nicht, dass das Bild ankommt, und auch nicht, dass es das nicht tut.',
          )}
        />
      ) : (
        <>
          <label className="mt-3 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">
              {t('sink.herkunft', 'Herkunft (Pflicht)')}
            </span>
            <input
              className={`w-full rounded border bg-cp-surface-2 px-2 py-1 text-cp-text ${
                profil.herkunft.trim() ? 'border-cp-border' : 'border-cp-danger'
              }`}
              value={profil.herkunft}
              placeholder={t(
                'sink.herkunftPlaceholder',
                'Handbuch, Seite … · am Gerät ausgelesen am … · vom Hersteller bestätigt',
              )}
              onChange={(e) => setze({ herkunft: e.target.value })}
            />
          </label>
          {!profil.herkunft.trim() && (
            <PanelHint
              className="mt-1 text-cp-xs text-cp-danger"
              text={t(
                'sink.herkunftMissing',
                'Ohne Herkunft wird das Profil beim nächsten Laden verworfen. „Aus dem Handbuch, Seite 41" und „hat der Kollege mal gesagt" sind zwei verschiedene Auskünfte — die Anzeige zeigt beide gleich.',
              )}
            />
          )}

          <div className="mt-3 space-y-2">
            {profil.formate.map((f, i) => (
              <div key={`${f.formatId}-${i}`} className="rounded border border-cp-border bg-cp-surface-2 p-2">
                <div className="flex items-center gap-2">
                  <select
                    className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-1 px-1 py-1 text-cp-xs"
                    value={f.formatId}
                    onChange={(e) => setzeFormat(i, { formatId: e.target.value as VideoFormatId })}
                    aria-label={t('sink.format', 'Format')}
                  >
                    {VIDEO_FORMATS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded bg-red-700 px-1.5 py-1 text-[10px] hover:bg-red-600"
                    onClick={() =>
                      setze({ formate: profil.formate.filter((_, j) => j !== i) })
                    }
                    aria-label={t('common.delete', 'Löschen')}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-cp-xs">
                  {FARBTIEFEN.map((b) => (
                    <label key={b} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={f.farbtiefen.includes(b)}
                        onChange={() => setzeFormat(i, { farbtiefen: kippe<Farbtiefe>(f.farbtiefen, b) })}
                      />
                      <span className="text-cp-text-secondary">{b} bit</span>
                    </label>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-cp-xs">
                  {FARBRAEUME.map((r) => (
                    <label key={r} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={f.farbraeume.includes(r)}
                        onChange={() => setzeFormat(i, { farbraeume: kippe<Farbraum>(f.farbraeume, r) })}
                      />
                      <span className="text-cp-text-secondary">{r}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-cp-xs">
                  {DYNAMIKEN.map((d) => (
                    <label key={d} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={f.dynamik.includes(d)}
                        onChange={() => setzeFormat(i, { dynamik: kippe<Dynamik>(f.dynamik, d) })}
                      />
                      <span className="text-cp-text-secondary">{d}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-2 rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
            onClick={() =>
              setze({
                formate: [
                  ...profil.formate,
                  // Die drei Listen starten LEER und nicht mit „8 bit, RGB,
                  // SDR". Eine Vorbelegung sähe aus wie eine Angabe des
                  // Nutzers, und der Plan-Check bestätigte sie danach.
                  {
                    formatId: VIDEO_FORMATS[0].id,
                    farbtiefen: [],
                    farbraeume: [],
                    dynamik: [],
                  },
                ],
              })
            }
          >
            {t('sink.addFormat', '+ Format')}
          </button>

          <PanelHint
            className="mt-2 text-cp-xs text-cp-text-muted"
            text={t(
              'sink.emptyAxisHint',
              'Eine leere Zeile heisst „dazu ist nichts erklärt": der Plan urteilt darüber nicht und sagt „offen". Ein Häkchen zu setzen ist eine Zusicherung — setzen Sie es nur, wo Sie es belegen können.',
            )}
          />
          <label className="mt-3 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">{t('sink.notiz', 'Notiz')}</span>
            <input
              className="w-full rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
              value={profil.notiz ?? ''}
              onChange={(e) => setze({ notiz: e.target.value || undefined })}
            />
          </label>
        </>
      )}
    </SortableSection>
  )
}
