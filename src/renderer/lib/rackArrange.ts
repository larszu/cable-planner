// v7.9.50 — Ein Rack (Black-Box mit `rackInternalSnapshot`) darf nicht in
// ein neues Rack gepackt werden: das ergaebe endlose Verschachtelung ohne
// Bedeutung. Werkzeugleiste und Kontextmenue (#1034) fragen dieselbe Regel.
type RackCandidate = { id: string; rackInternalSnapshot?: unknown }

export const selectionContainsRack = (ids: readonly string[], equipment: readonly RackCandidate[]): boolean =>
  ids.some((id) => !!equipment.find((e) => e.id === id)?.rackInternalSnapshot)

export const canArrangeInRack = (ids: readonly string[], equipment: readonly RackCandidate[]): boolean =>
  ids.length > 0 && !selectionContainsRack(ids, equipment)
