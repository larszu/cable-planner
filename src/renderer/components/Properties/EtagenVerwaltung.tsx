/**
 * #911 — Etagen verwalten: Reihenfolge (von unten nach oben), Name, Hoehe.
 *
 * Steht am Rahmen, weil man dort merkt, dass eine Etage fehlt oder falsch
 * heisst. Umbenennen zieht alle Rahmen der Etage mit; Entfernen nimmt den
 * Rahmen ihre Angabe — und sagt vorher, wie viele es trifft.
 */
import { ArrowDown, ArrowUp, Layers, Trash2 } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'
import { promptDialog } from '../../lib/promptDialog'
import { format, useTranslation } from '../../lib/i18n'
import { etagenAusHaus, etagenSchluessel, rahmenAufEtage } from '../../lib/etagen'
import { Icon } from '../shared/Icon'
import type { Floor } from '../../types/location'

const EMPTY_FLOORS: Floor[] = []
const EMPTY_LOCATIONS: never[] = []

export const EtagenVerwaltung = () => {
  const t = useTranslation()
  const floors = useProjectStore((s) => s.project.floors ?? EMPTY_FLOORS)
  const locations = useProjectStore((s) => s.project.locations ?? EMPTY_LOCATIONS)
  const setFloors = useProjectStore((s) => s.setFloors)
  const renameFloor = useProjectStore((s) => s.renameFloor)
  const removeFloor = useProjectStore((s) => s.removeFloor)
  const hausEtagen = useProjectStore((s) => s.project.hausAuskunft?.etagen)

  const verschiebe = (i: number, richtung: -1 | 1) => {
    const j = i + richtung
    if (j < 0 || j >= floors.length) return
    const next = [...floors]
    ;[next[i], next[j]] = [next[j], next[i]]
    setFloors(next)
  }

  /**
   * Nur schreiben, was sich wirklich aendert: ein Blur ohne Aenderung waere
   * sonst ein Undo-Schritt und ein „ungespeichert". Eine unlesbare Eingabe
   * („3,5 m") loescht die vorhandene Hoehe NICHT — sie bleibt stehen, und das
   * Feld zeigt sie wieder. Nur ein leeres Feld nimmt sie weg.
   */
  const setzeHoehe = (i: number, roh: string) => {
    const f = floors[i]
    if (!f) return
    const text = roh.trim().replace(',', '.').replace(/\s*m$/i, '')
    const wert = text === '' ? undefined : Number(text)
    if (wert !== undefined && !Number.isFinite(wert)) return
    if (wert === f.elevationM) return
    setFloors(floors.map((x, k) => (k !== i ? x : wert === undefined ? { name: x.name } : { name: x.name, elevationM: wert })))
  }

  const umbenennen = async (f: Floor) => {
    const neu = await promptDialog(t('floors.renamePrompt', 'New name for this floor'), f.name)
    if (!neu?.trim() || neu.trim() === f.name) return
    const vergeben = floors.some(
      (x) => etagenSchluessel(x.name) === etagenSchluessel(neu) && etagenSchluessel(x.name) !== etagenSchluessel(f.name),
    )
    if (vergeben) {
      await infoDialog(format(t('floors.nameTaken', 'A floor named "{name}" already exists.'), { name: neu.trim() }), {
        tone: 'warning',
      })
      return
    }
    renameFloor(f.name, neu)
  }

  const entfernen = async (f: Floor) => {
    const n = rahmenAufEtage(f.name, locations)
    if (n > 0) {
      const ok = await confirmDialog(
        format(t('floors.removeConfirm', 'Remove floor "{name}"? {n} frame(s) on it will have no floor.'), {
          name: f.name,
          n,
        }),
        { destructive: true },
      )
      if (!ok) return
    }
    removeFloor(f.name)
  }

  const neu = async () => {
    const name = await promptDialog(t('floors.newPrompt', 'Name of the new floor (e.g. "3rd floor")'))
    if (!name?.trim()) return
    setFloors([...floors, { name: name.trim() }])
  }

  return (
    <details className="border border-cp-border-muted">
      <summary className="cursor-pointer px-2 py-1 text-cp-xs font-medium text-cp-text">
        <Icon icon={Layers} size="xs" className="mr-1 inline" />
        {format(t('floors.title', 'Floors ({n})'), { n: floors.length })}
      </summary>
      <div className="flex flex-col gap-1 px-2 pb-2 text-cp-xs">
        <p className="text-cp-text-muted">
          {t('floors.hint', 'Bottom to top. The height is the floor level above the reference point in metres; the 3D view stacks rooms by it.')}
        </p>
        {[...floors].reverse().map((f) => {
          const i = floors.indexOf(f)
          return (
            <div key={f.name} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void umbenennen(f)}
                className="min-w-0 flex-1 truncate text-left text-cp-text hover:text-cp-accent"
                title={t('floors.renameTitle', 'Rename — all frames on this floor follow')}
              >
                {f.name}
              </button>
              <input
                type="text"
                inputMode="decimal"
                defaultValue={f.elevationM ?? ''}
                key={`${f.name}:${f.elevationM ?? ''}`}
                onBlur={(e) => {
                  setzeHoehe(i, e.target.value)
                  // Unlesbares nicht stehen lassen: das Feld zeigt, was gilt.
                  e.target.value = f.elevationM === undefined ? '' : String(f.elevationM)
                }}
                placeholder={t('floors.heightPlaceholder', 'm')}
                aria-label={format(t('floors.heightLabel', 'Height of {name} in metres'), { name: f.name })}
                className="w-14 border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-right"
              />
              <button
                type="button"
                onClick={() => verschiebe(i, 1)}
                disabled={i === floors.length - 1}
                className="p-0.5 text-cp-text-muted hover:text-cp-text disabled:opacity-30"
                aria-label={t('floors.up', 'Move up')}
              >
                <Icon icon={ArrowUp} size="xs" />
              </button>
              <button
                type="button"
                onClick={() => verschiebe(i, -1)}
                disabled={i === 0}
                className="p-0.5 text-cp-text-muted hover:text-cp-text disabled:opacity-30"
                aria-label={t('floors.down', 'Move down')}
              >
                <Icon icon={ArrowDown} size="xs" />
              </button>
              <button
                type="button"
                onClick={() => void entfernen(f)}
                className="p-0.5 text-cp-text-muted hover:text-cp-danger"
                aria-label={t('floors.remove', 'Remove floor')}
              >
                <Icon icon={Trash2} size="xs" />
              </button>
            </div>
          )
        })}
        {hausEtagen && hausEtagen.length > 0 && (
          <button
            type="button"
            onClick={() => setFloors(etagenAusHaus(floors, hausEtagen))}
            className="mt-1 self-start border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text"
            title={t(
              'floors.fromBuildingTitle',
              'Adds the floors the building statement lists and fills in missing heights. Heights already set here stay.',
            )}
          >
            {format(t('floors.fromBuilding', 'Take floors from the building statement ({n})'), { n: hausEtagen.length })}
          </button>
        )}
        <button
          type="button"
          onClick={() => void neu()}
          className="mt-1 self-start border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text"
        >
          {t('floors.add', 'Add floor…')}
        </button>
      </div>
    </details>
  )
}
