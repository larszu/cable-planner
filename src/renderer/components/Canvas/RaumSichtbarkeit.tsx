/**
 * #915 — Etagen und Raeume ein- und ausblenden.
 *
 * Neben den Kabel-Ebenen, weil beide dieselbe Frage beantworten: was zeigt
 * das Bild gerade. Ein ausgeblendeter Raum nimmt seine Geraete mit; ein Kabel
 * zu ihm bleibt als Stummel am sichtbaren Ende stehen und sagt, wohin es
 * laeuft (CableEdge). Reine Ansicht (uiStore) — der Plan und jeder Export
 * bleiben vollstaendig.
 *
 * Erscheint nur, wenn es Rahmen gibt: ohne Raeume gibt es nichts auszublenden.
 */
import { useEffect, useRef, useState } from 'react'
import { Box, Layers } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { format, useTranslation } from '../../lib/i18n'
import { etagenSchluessel } from '../../lib/etagen'
import { Icon } from '../shared/Icon'
import type { Floor, LocationFrame } from '../../types/location'

const EMPTY_LOCATIONS: LocationFrame[] = []
const EMPTY_FLOORS: Floor[] = []

export const RaumSichtbarkeit = () => {
  const t = useTranslation()
  const locations = useProjectStore((s) => s.project.locations ?? EMPTY_LOCATIONS)
  const floors = useProjectStore((s) => s.project.floors ?? EMPTY_FLOORS)
  const ausRaeume = useUiStore((s) => s.ausgeblendeteRaeume)
  const ausEtagen = useUiStore((s) => s.ausgeblendeteEtagen)
  const toggleRaum = useUiStore((s) => s.toggleRaumSichtbar)
  const toggleEtage = useUiStore((s) => s.toggleEtageSichtbar)
  const alleZeigen = useUiStore((s) => s.alleRaeumeZeigen)
  const isLight = useUiStore((s) => s.canvasTheme) === 'light'
  const [offen, setOffen] = useState(false)
  const huelle = useRef<HTMLDivElement | null>(null)

  // Klick daneben und Escape schliessen (B-44/B-77, wie das Ebenen-Menue).
  useEffect(() => {
    if (!offen) return
    const daneben = (e: MouseEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('mousedown', daneben)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', daneben)
      document.removeEventListener('keydown', esc)
    }
  }, [offen])

  if (locations.length === 0) return null

  const verborgen = ausRaeume.length + ausEtagen.length
  const ohneEtage = locations.filter((l) => !l.floor?.trim())
  const gruppen: Array<{ etage: Floor | null; raeume: LocationFrame[] }> = [
    ...[...floors].reverse().map((f) => ({
      etage: f,
      raeume: locations.filter((l) => l.floor?.trim() && etagenSchluessel(l.floor) === etagenSchluessel(f.name)),
    })),
    ...(ohneEtage.length > 0 ? [{ etage: null, raeume: ohneEtage }] : []),
  ]

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={offen}
        title={t('canvas.rooms.title', 'Show or hide floors and rooms')}
        className={`inline-flex h-6 items-center gap-1 border px-2 text-cp-xs transition ${
          isLight
            ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        <Icon icon={Layers} size="xs" />
        <span>
          {verborgen > 0
            ? format(t('canvas.rooms.buttonHidden', 'Rooms ({n} hidden)'), { n: verborgen })
            : t('canvas.rooms.button', 'Rooms')}
        </span>
      </button>
      {offen && (
        <div
          role="menu"
          className={`absolute right-0 top-7 z-[60] max-h-96 w-64 overflow-y-auto border p-1 text-cp-xs ${
            isLight ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-700 bg-slate-900 text-slate-200'
          }`}
        >
          {gruppen.map(({ etage, raeume }) => {
            const key = etage ? etagenSchluessel(etage.name) : ''
            const etageAus = etage ? ausEtagen.includes(key) : false
            return (
              <div key={etage?.name ?? '\u0000ohne'} className="py-0.5">
                {etage ? (
                  <label className="flex cursor-pointer items-center gap-1 px-1 py-0.5 font-semibold">
                    <input type="checkbox" checked={!etageAus} onChange={() => toggleEtage(key)} />
                    {etage.name}
                  </label>
                ) : (
                  <div className="px-1 py-0.5 font-semibold text-cp-text-muted">
                    {t('canvas.rooms.noFloor', 'Without floor')}
                  </div>
                )}
                {raeume.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-center gap-1 py-0.5 pl-5 pr-1 ${etageAus ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={!etageAus && !ausRaeume.includes(r.id)}
                      disabled={etageAus}
                      onChange={() => toggleRaum(r.id)}
                    />
                    <span className="truncate">{r.name}</span>
                  </label>
                ))}
              </div>
            )
          })}
          {verborgen > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={alleZeigen}
              className="mt-1 w-full border-t border-cp-border-muted px-1 py-1 text-left hover:text-cp-accent"
            >
              {t('canvas.rooms.showAll', 'Show all')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** #916 — oeffnet die Gebaeude-3D-Ansicht. Nur mit Raeumen sinnvoll. */
export const Gebaeude3DKnopf = () => {
  const t = useTranslation()
  const hatRaeume = useProjectStore((s) => (s.project.locations?.length ?? 0) > 0)
  const oeffnen = useUiStore((s) => s.openGebaeude3d)
  const isLight = useUiStore((s) => s.canvasTheme) === 'light'
  if (!hatRaeume) return null
  return (
    <button
      type="button"
      onClick={oeffnen}
      title={t('gebaeude3d.open', 'Show rooms by floor in 3D, with the connections between them')}
      className={`inline-flex h-6 items-center gap-1 border px-2 text-cp-xs transition ${
        isLight
          ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200'
          : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
      }`}
    >
      <Icon icon={Box} size="xs" />
      <span>{t('gebaeude3d.button', '3D')}</span>
    </button>
  )
}
