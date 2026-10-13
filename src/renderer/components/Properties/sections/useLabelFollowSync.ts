import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { cablePlannerApi } from '../../../lib/bridge'
import { labelFollowLinks, type FollowStatus } from '../../../lib/atemLabelFollow'

const LEER: FollowStatus = { running: false, hubs: [], log: [] }

/** Der Laufzustand im Hauptprozess, für jede Komponente gleich. */
export const useFollowStatus = (): FollowStatus => {
  const [status, setStatus] = useState<FollowStatus>(LEER)
  useEffect(() => {
    let aktiv = true
    void cablePlannerApi.atemLabelFollow.status().then((s) => aktiv && setStatus(s))
    const ab = cablePlannerApi.atemLabelFollow.onStatus(setStatus)
    return () => {
      aktiv = false
      ab()
    }
  }, [])
  return status
}

/**
 * Hält die Verbindungen im Hauptprozess aktuell, solange das Folgen läuft —
 * sonst schriebe ein umgesteckter Plan weiter an den alten ATEM-Eingang.
 * Einmal in `App` eingehängt, unabhängig davon, ob das Eigenschaftsfenster
 * offen ist.
 */
export const useLabelFollowSync = () => {
  const status = useFollowStatus()
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const links = useMemo(() => labelFollowLinks(equipment, cables), [equipment, cables])
  const schluessel = JSON.stringify(links)
  useEffect(() => {
    if (!status.running) return
    void cablePlannerApi.atemLabelFollow.update(JSON.parse(schluessel))
    // Nur bei geänderten Links, nicht bei jedem Statuswechsel.
  }, [schluessel, status.running])
}
