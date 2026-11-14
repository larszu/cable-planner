/**
 * #1180 — Kabelausstattung je Abschnitt: Geflecht, Wellrohr, Gewebeband,
 * Schrumpfschlauch, mit Anfang und Laenge ab Ende A.
 *
 * Zugeklappt, solange nichts eingetragen ist.
 */
import { Trash2 } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { AUSSTATTUNGS_ARTEN, abschnittLaenge } from '../../lib/kabelAusstattung'
import { ausstattungsArtText } from '../../lib/kabelAusstattungText'
import type { Cable, KabelAusstattung } from '../../types/cable'


const zahl = (v: string): number | undefined => {
  if (v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export const AusstattungSection = ({ cable }: { cable: Cable }) => {
  const t = useTranslation()
  const updateCable = useProjectStore((s) => s.updateCable)
  const liste = cable.ausstattung ?? []
  const setze = (next: KabelAusstattung[]) => updateCable(cable.id, { ausstattung: next.length > 0 ? next : undefined })
  const aendere = (i: number, patch: Partial<KabelAusstattung>) =>
    setze(liste.map((a, j) => (j === i ? { ...a, ...patch } : a)))

  return (
    <details className="border border-cp-border bg-cp-surface-3/40" open={liste.length > 0}>
      <summary className="cursor-pointer select-none px-2 py-1.5 text-cp-xs font-semibold text-cp-text-muted hover:bg-cp-surface-2/40">
        {t('ausstattung.section', 'Coverings')}
      </summary>
      <div className="space-y-2 border-t border-cp-border p-2">
        {liste.map((a, i) => {
          const l = abschnittLaenge(a, cable.length)
          return (
            <div key={i} className="space-y-1 border-b border-cp-border-muted pb-2">
              <div className="flex gap-1">
                <select
                  value={a.art}
                  onChange={(e) => aendere(i, { art: e.target.value as KabelAusstattung['art'] })}
                  className="flex-1 border border-cp-border bg-cp-surface-1 p-1"
                >
                  {AUSSTATTUNGS_ARTEN.map((art) => (
                    <option key={art} value={art}>
                      {ausstattungsArtText(art, t)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title={t('ausstattung.remove', 'Remove covering')}
                  onClick={() => setze(liste.filter((_, j) => j !== i))}
                  className="p-1 text-cp-text-muted hover:text-cp-danger"
                >
                  <Icon icon={Trash2} size="xs" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                <label className="block">
                  <span className="block text-cp-text-faint">{t('ausstattung.from', 'From A (m)')}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    value={a.vonM ?? ''}
                    placeholder="0"
                    onChange={(e) => aendere(i, { vonM: zahl(e.target.value) })}
                    className="w-full border border-cp-border bg-cp-surface-1 p-1"
                  />
                </label>
                <label className="block">
                  <span className="block text-cp-text-faint">{t('ausstattung.length', 'Length (m)')}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.05}
                    value={a.laengeM ?? ''}
                    placeholder={l !== undefined ? String(l) : t('ausstattung.toEnd', 'to B')}
                    onChange={(e) => {
                      const n = zahl(e.target.value)
                      aendere(i, { laengeM: n && n > 0 ? n : undefined })
                    }}
                    className="w-full border border-cp-border bg-cp-surface-1 p-1"
                  />
                </label>
                <label className="block">
                  <span className="block text-cp-text-faint">{t('ausstattung.material', 'Material')}</span>
                  <input
                    value={a.material ?? ''}
                    onChange={(e) => aendere(i, { material: e.target.value || undefined })}
                    className="w-full border border-cp-border bg-cp-surface-1 p-1"
                  />
                </label>
              </div>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setze([...liste, { art: 'braid' }])}
          className="border border-cp-border bg-cp-surface-2 px-2 py-1 hover:bg-cp-surface-3"
        >
          {t('ausstattung.add', '+ Covering')}
        </button>
      </div>
    </details>
  )
}
