import { useProjectStore } from '../../store/projectStore'

export const LocationProperties = () => {
  const selectedId = useProjectStore((state) => state.selectedLocationId)
  const location = useProjectStore((state) =>
    (state.project.locations ?? []).find((l) => l.id === selectedId),
  )
  const updateLocation = useProjectStore((state) => state.updateLocation)
  const deleteLocation = useProjectStore((state) => state.deleteLocation)
  const deleteLocationWithContents = useProjectStore(
    (state) => state.deleteLocationWithContents,
  )

  if (!location) return null

  return (
    <div className="space-y-3 text-xs">
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Location</div>
        <label className="block">
          Name
          <input
            value={location.name}
            onChange={(e) => updateLocation(location.id, { name: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          Breite
          <input
            type="number"
            value={Math.round(location.width)}
            onChange={(e) =>
              updateLocation(location.id, { width: Math.max(40, Number(e.target.value) || 0) })
            }
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
          />
        </label>
        <label className="block">
          Höhe
          <input
            type="number"
            value={Math.round(location.height)}
            onChange={(e) =>
              updateLocation(location.id, { height: Math.max(40, Number(e.target.value) || 0) })
            }
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          Stockwerk
          <input
            value={location.floor ?? ''}
            placeholder="z.B. EG, 1.OG"
            onChange={(e) => updateLocation(location.id, { floor: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
          />
        </label>
        <label className="block">
          Farbe
          <input
            type="color"
            value={location.color}
            onChange={(e) => updateLocation(location.id, { color: e.target.value })}
            className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
          />
        </label>
      </div>

      <div>
        <label className="block">
          Notizen
          <textarea
            value={location.notes ?? ''}
            onChange={(e) => updateLocation(location.id, { notes: e.target.value })}
            rows={2}
            className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-950 p-1.5"
          />
        </label>
      </div>

      {/* "Geräte beim Verschieben mitnehmen" is temporarily hidden while the
          group-drag selection logic is being reworked. The store field and the
          CanvasArea.onNodeDragStart implementation remain intact. */}

      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Nur den Rahmen "${location.name}" löschen? Geräte bleiben erhalten.`)) {
              deleteLocation(location.id)
            }
          }}
          className="w-full rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          title="Entfernt nur den Rahmen — Geräte darin bleiben auf dem Canvas."
        >
          Nur Rahmen löschen
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                `Rahmen "${location.name}" UND alle darin enthaltenen Geräte samt deren Kabel löschen?`,
              )
            ) {
              deleteLocationWithContents(location.id)
            }
          }}
          className="w-full rounded bg-red-700 px-2 py-1 text-xs hover:bg-red-600"
        >
          Rahmen + Inhalt löschen
        </button>
      </div>

      <p className="text-[10px] italic text-slate-500">
        Tipp: Der Rahmen bewegt sich standardmäßig unabhängig. Aktiviere „Geräte mitnehmen",
        wenn alle enthaltenen Geräte beim Verschieben des Rahmens mitwandern sollen.
      </p>
    </div>
  )
}
