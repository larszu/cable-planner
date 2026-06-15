/**
 * #pre-sale — Doppelklick-Öffnen von Projektdateien aus dem OS.
 *
 * Reine Helfer ohne Electron-Window-Abhängigkeit:
 *  - findProjectPathInArgv: zieht den Datei-Pfad aus einem process.argv
 *    (Windows/Linux reichen die Datei als Kommandozeilen-Argument durch).
 *  - setPendingLaunchPath/takePendingLaunchPath: puffern den beim Kaltstart
 *    übergebenen Pfad, bis der Renderer bereit ist und ihn per IPC abholt
 *    (project:get-launch-file). „take" leert den Puffer (genau einmal laden).
 *
 * Das eigentliche Lesen/Senden + Recent-Liste liegt in projectIpc.ts
 * (openExternalProject / project:get-launch-file), damit writeRecent dort
 * an einer Stelle bleibt und kein Import-Zyklus entsteht.
 */
const PROJECT_EXTS = ['.cableplan', '.json', '.cpviewer']

export const isProjectFile = (filePath: string): boolean => {
  const lower = filePath.toLowerCase()
  return PROJECT_EXTS.some((ext) => lower.endsWith(ext))
}

/**
 * Findet den ersten Projekt-Datei-Pfad in einem argv-Array. argv[0] ist die
 * Executable und wird übersprungen; Flags (beginnen mit '-') ignoriert.
 */
export const findProjectPathInArgv = (argv: readonly string[]): string | null => {
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue
    if (isProjectFile(arg)) return arg
  }
  return null
}

let pendingLaunchPath: string | null = null

/** Puffert einen Pfad fürs spätere Abholen durch den Renderer (Kaltstart). */
export const setPendingLaunchPath = (filePath: string | null): void => {
  if (filePath && isProjectFile(filePath)) pendingLaunchPath = filePath
}

/** Liefert den gepufferten Pfad und leert den Puffer (einmaliges Laden). */
export const takePendingLaunchPath = (): string | null => {
  const p = pendingLaunchPath
  pendingLaunchPath = null
  return p
}
