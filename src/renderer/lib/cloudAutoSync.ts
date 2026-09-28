// #871 — gebundene Projekte speichern sich selbst in die Cloud.
//
// Nur wenn das offene Projekt ausdruecklich in die Cloud gelegt wurde
// (`project.cloud`). 30 Sekunden nach der letzten Aenderung, nicht bei jedem
// Tastendruck: das Kontingent des Servers zaehlt Speichervorgaenge je Stunde.
// Scheitert es (offline, abgemeldet), bleibt es still — die lokale Datei ist
// gespeichert wie immer, und die naechste Aenderung versucht es erneut.
import { hasDesktopBridge } from './bridge'
import { mergeProjects, pushToCloud, cloudApi, type PushResult } from './cloud'
import { effectiveServer } from './deviceLibraryUrl'
import { mcpDigest } from './mcpWerkzeuge'
import { useProjectStore } from '../store/projectStore'
import { useSettingsStore } from '../store/settingsStore'
import type { CablePlannerProject } from '../types/project'

export const CLOUD_DEBOUNCE_MS = 30_000

/** Etikett in der Revisionsliste — welche Art Geraet gespeichert hat. */
export const cloudDevice = (): string => {
  const ua = globalThis.navigator?.userAgent ?? ''
  const os = /iPad|iPhone/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : ''
  return [hasDesktopBridge ? 'Cable Planner' : 'Browser', os].filter(Boolean).join(' · ')
}

let running: Promise<PushResult> | null = null

/** Jetzt speichern; das Ergebnis (neue Revision oder Zusammenfuehrung) landet im Store. */
export const syncCloudNow = async (server: string): Promise<PushResult> => {
  if (running) return running
  running = (async () => {
    const store = useProjectStore.getState()
    const before = store.project
    // Mit den vorberechneten Antworten der Lese-Werkzeuge: so kann der
    // Remote-MCP (#874) Fragen zu dieser Revision beantworten.
    const r = await pushToCloud(cloudApi, server, before, { device: cloudDevice(), digest: mcpDigest })
    const now = useProjectStore.getState()
    // Waehrend der Anfrage weitergearbeitet: das Zusammengefuehrte ist dann
    // nicht mehr der Stand auf dem Bildschirm — noch einmal dreiseitig.
    if (r.merged) now.applyCloudProject(now.project === before ? r.merged : { ...mergeProjects(before, now.project, r.merged), cloud: r.binding })
    else if (!r.unchanged || !before.cloud) now.setCloudBinding(r.binding)
    return r
  })()
  try {
    return await running
  } finally {
    running = null
  }
}

/** Unterscheiden sich die Staende nur in der Cloud-Verbindung selbst? */
const onlyBindingChanged = (a: CablePlannerProject, b: CablePlannerProject): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof CablePlannerProject>
  for (const k of keys) if (k !== 'cloud' && a[k] !== b[k]) return false
  return true
}

/** Beim Start der App einmal aufrufen; liefert die Abmeldung. */
export const startCloudAutoSync = (): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const unsub = useProjectStore.subscribe((state, prev) => {
    if (state.project === prev.project || !state.project.cloud) return
    if (onlyBindingChanged(state.project, prev.project)) return
    // Ein anderes Projekt geoeffnet: das neue wird nicht mit dem Stand des
    // alten verwechselt — erst seine eigene naechste Aenderung zaehlt.
    if (state.project.cloud.projectId !== prev.project.cloud?.projectId) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      const server = effectiveServer(useSettingsStore.getState().deviceLibraryUrl)
      if (useProjectStore.getState().project.cloud?.server !== server) return
      void syncCloudNow(server).catch(() => undefined)
    }, CLOUD_DEBOUNCE_MS)
  })
  return () => {
    unsub()
    if (timer) clearTimeout(timer)
  }
}
