// ───────────────────────────────────────────────────────────────────────────
// Fotos an einem Gerät oder einem Kabel (#884).
//
// ─── WARUM NEBEN DEM REFERENZBILD UND NICHT STATT DESSEN ───────────────────
//
// `equipment.imageUrl` ist das REFERENZBILD des Typs: so sieht die Rückseite
// eines solchen Geräts aus. Ein Foto ist etwas anderes — so sah DIESE Kiste
// an DIESEM Tag aus. Das eine ersetzt das andere nicht; wer das Referenzbild
// mit dem Schadensfoto überschreibt, hat danach keines von beidem.
//
// ─── UND WARUM DIE BILDER HIER KLEINGERECHNET WERDEN ───────────────────────
//
// `pickImageAsDataUri` (für das Referenzbild) nimmt die Datei, wie sie ist —
// ein Logo hat 20 KB, das ist in Ordnung. Ein Telefonfoto hat 3–5 MB.
// `nimmFoto` rechnet deshalb auf 1600 px lange Kante herunter; die Rechnung
// dazu steht in `lib/fotoMasse.ts`.
// ───────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { Icon } from '../../shared/Icon'
import { useTranslation } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import { nimmFoto } from '../../../lib/fotoAufnahme'
import { fotosOhneZiel, fotosZu } from '../../../lib/fotoMasse'
import type { FotoZiel } from '../../../types/foto'

/**
 * Die Liste selbst — ohne Rahmen.
 *
 * Getrennt vom Abschnitt, weil die Kabel-Eigenschaften KEINE sortierbaren
 * Abschnitte haben: dort steht sie als gewöhnlicher Block. Zwei Fassungen
 * derselben Liste wären zwei Stellen, an denen ein Foto anders aussieht.
 */
export const FotoListe = ({ ziel }: { ziel?: FotoZiel }) => {
  const t = useTranslation()
  const alle = useProjectStore((s) => s.project.fotos)
  const addFoto = useProjectStore((s) => s.addFoto)
  const removeFoto = useProjectStore((s) => s.removeFoto)
  const updateFoto = useProjectStore((s) => s.updateFoto)
  const feld = useRef<HTMLInputElement>(null)
  const [laeuft, setLaeuft] = useState(false)

  // OHNE Ziel ist kein Sonderfall, sondern die dritte Ebene: ein Foto, das
  // auf nichts zeigt, gehört dem Projekt („so sah die Halle aus"). Genau da
  // landet auch ein Foto vom Telefon, bei dem niemand ein Gerät gewählt hat
  // — es darf nicht unsichtbar sein, nur weil es keine Kiste nennt.
  const fotos = ziel ? fotosZu(alle, ziel) : fotosOhneZiel(alle)

  const aufnehmen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateien = [...(e.target.files ?? [])]
    // Zurücksetzen, damit dieselbe Datei ein zweites Mal gewählt werden kann
    // — ohne das passiert beim zweiten Versuch nichts, und das sieht aus wie
    // ein Fehlschlag.
    e.target.value = ''
    if (dateien.length === 0) return
    setLaeuft(true)
    for (const datei of dateien) {
      const aufnahme = await nimmFoto(datei, new Date().toISOString(), 'planer', ziel)
      if (aufnahme) addFoto(aufnahme.foto)
    }
    setLaeuft(false)
  }

  return (
    <div className="space-y-2">
        {fotos.length === 0 && (
          <p className="text-cp-xs text-cp-text-muted">
            {t('foto.none', 'No photos yet. A photo answers questions no field has.')}
          </p>
        )}
        {fotos.map((f) => (
          <div key={f.id} className="flex items-start gap-2">
            {f.dataUri ? (
              <a
                href={f.dataUri}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-h-24 max-w-[120px] shrink-0 overflow-hidden border border-cp-border"
                title={t('foto.full', 'Open at full size')}
              >
                <img src={f.dataUri} alt="" className="max-h-24 max-w-[120px] object-contain" />
              </a>
            ) : (
              // Der Datensatz OHNE sein Bild: nach einem Absturz steht er da,
              // bis die Ablage nachliefert. Ein leerer Rahmen sagt „hier war
              // eines"; ein stiller Wegfall sagte gar nichts.
              <div className="flex h-24 w-[120px] shrink-0 items-center justify-center border border-dashed border-cp-border text-center text-cp-xs text-cp-text-muted">
                {t('foto.missing', 'image not loaded')}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                value={f.notiz ?? ''}
                placeholder={t('foto.note', 'Note')}
                onChange={(e) => updateFoto(f.id, { notiz: e.target.value || undefined })}
                className="w-full border border-cp-border bg-cp-surface-3 px-1.5 py-1 text-cp-xs"
              />
              <span className="text-cp-xs text-cp-text-faint">
                {f.breite} × {f.hoehe} ·{' '}
                {f.quelle === 'handy' ? t('foto.fromPhone', 'from the phone') : t('foto.fromPlanner', 'from the planner')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeFoto(f.id)}
              className="shrink-0 border border-cp-border p-1 hover:bg-red-700 hover:text-white"
              title={t('foto.remove', 'Remove photo')}
            >
              <Icon icon={X} className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => feld.current?.click()}
          disabled={laeuft}
          // 44 px hoch und nicht 32 wie die Nachbarknoepfe: dieser hier wird
          // im Aufbau mit dem Finger getroffen, oft auf einem Tablet und mit
          // Handschuh. `scripts/ui-targets.mjs` zaehlt die Flaechen unter der
          // Marke und deckelt sie — eine neue darunter waere ein Schritt
          // zurueck gewesen, und der Deckel anzuheben hiesse, ihn zu machen.
          //
          // MIT AUSRUFEZEICHEN, und das ist kein Schmuck: `index.css` setzt
          // `button { min-height: var(--ziel) }` = 32 px als UNGESCHICHTETE
          // Regel (B-76). Ungeschichtetes CSS gewinnt in Tailwind 4 gegen
          // jede Utility-Klasse — `min-h-11` allein blieb wirkungslos, und
          // zwar unsichtbar: gebaut war die Regel, gegolten hat sie nie.
          // Gemessen im Browser: 32 px vorher, 44 px hiermit.
          className="inline-flex min-h-11! items-center gap-1 bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
        >
          <Icon icon={Camera} className="h-3 w-3" />
          {laeuft ? t('foto.working', 'Scaling…') : t('foto.add', 'Add photo…')}
        </button>
      <input
        ref={feld}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={aufnehmen}
      />
    </div>
  )
}

/**
 * Die Fotos des PROJEKTS — die, die auf nichts zeigen.
 *
 * Sie stehen in der Eigenschaften-Leiste, wenn nichts ausgewählt ist: das
 * ist die eine Stelle, an der das Projekt selbst der Gegenstand ist.
 */
export const ProjektFotos = () => {
  const t = useTranslation()
  const alle = useProjectStore((s) => s.project.fotos)
  const anzahl = fotosOhneZiel(alle).length
  return (
    <div className="border border-cp-border-muted bg-cp-surface-1/40 p-3">
      <div className="mb-2 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
        {t('foto.projectSection', 'Photos of the project')}
        {anzahl > 0 ? ` (${anzahl})` : ''}
      </div>
      <FotoListe />
    </div>
  )
}

/** Derselbe Inhalt als sortierbarer Abschnitt — für die Geräte-Leiste. */
export const FotoSection = ({ ziel, id }: { ziel: FotoZiel; id: string }) => {
  const t = useTranslation()
  const alle = useProjectStore((s) => s.project.fotos)
  const anzahl = fotosZu(alle, ziel).length
  return (
    <SortableSection
      id={id}
      title={t('foto.section', 'Photos')}
      subtitle={anzahl > 0 ? String(anzahl) : undefined}
    >
      <FotoListe ziel={ziel} />
    </SortableSection>
  )
}
