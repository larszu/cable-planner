// #434 — Reine Merge-Logik der Workgroup-/Shared-Library (ohne Browser-/
// Store-/Bridge-Abhängigkeiten, damit unit-testbar). syncSharedLibrary in
// sharedLibrarySync.ts verdrahtet diese Funktionen mit den IPC-Primitiven.

import type { EquipmentTemplate, GroupPreset } from '../types/equipment'

/** Dateiname der geteilten Library im Sync-Ordner. */
export const SHARED_LIBRARY_FILE = 'cable-planner.library.json'

export interface SharedLibraryFile {
  type: 'cable-planner-shared-library'
  version: 1
  updatedAt: string
  devices: EquipmentTemplate[]
  groups: GroupPreset[]
  categories: string[]
}

/** Pfad + Dateiname plattformkorrekt verbinden (Windows `\\` vs. POSIX `/`). */
export const joinSyncPath = (dir: string, file: string): string => {
  const trimmed = dir.replace(/[\\/]+$/, '')
  const sep = trimmed.includes('\\') && !trimmed.includes('/') ? '\\' : '/'
  return `${trimmed}${sep}${file}`
}

/** Items aus `shared`, die in `local` (nach Name) FEHLEN, plus die Namen, die
 *  in beiden vorkommen aber unterschiedlichen Inhalt haben (Konflikte). */
export const diffByName = <T extends { name: string }>(
  local: ReadonlyArray<T>,
  shared: ReadonlyArray<T>,
): { add: T[]; conflicts: string[] } => {
  const localByName = new Map(local.map((x) => [x.name, x]))
  const add: T[] = []
  const conflicts: string[] = []
  for (const s of shared) {
    const l = localByName.get(s.name)
    if (!l) add.push(s)
    else if (JSON.stringify(l) !== JSON.stringify(s)) conflicts.push(s.name)
  }
  return { add, conflicts }
}

/** Vereinigung nach Name; bei Gleichheit gewinnt `local` (für Write-Back). */
export const unionByName = <T extends { name: string }>(
  local: ReadonlyArray<T>,
  shared: ReadonlyArray<T>,
): T[] => {
  const byName = new Map<string, T>()
  for (const s of shared) byName.set(s.name, s)
  for (const l of local) byName.set(l.name, l)
  return [...byName.values()]
}
