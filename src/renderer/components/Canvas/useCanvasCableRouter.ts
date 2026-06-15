import { useEffect } from 'react'
import type { StoreApi } from 'zustand'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
import { routeCableWithAStar, type HandleSide, type PixelRect } from '../../lib/routeCableWithAStar'
import { setCableRouter } from '../../lib/canvasViewport'
import type { ProjectState } from '../../store/projectStore'
import type { Cable } from '../../types/cable'
import type { EquipmentItem } from '../../types/equipment'

/**
 * #468 — A*-Router-Registrierung aus CanvasArea (CanvasContent) ausgelagert.
 * Verhaltensneutral: identischer Effect, nur als Hook gekapselt. Registriert
 * routeOne/routeAll im ID-gekeyten Router-Stack (siehe canvasViewport +
 * Issue #515), erfasst die aktuelle Szene pro Aufruf via Store-getState().
 */
export function useCanvasCableRouter(
  routerId: string,
  projectStoreInstance: StoreApi<ProjectState>,
  updateCable: (id: string, patch: Partial<Cable>) => void,
  mode: 'main' | 'rack',
  equipment: EquipmentItem[],
): void {
  useEffect(() => {
    // Compute the layout geometry of one equipment item, matching the
    // visual rendering in EquipmentNode. Returns the equipment's
    // bounding rect plus precomputed port positions so we can place
    // the cable's source/target on the exact handle centres.
    const layoutOf = (eq: EquipmentItem) => {
      // #501-Folgefix — EINE Geometrie-Quelle: an den geteilten Helper
      // computeEquipmentLayout delegieren (Header inkl. IP/Subtitle/Beltpack,
      // Port-Side-Bucketing, snapUp-Breite). Vorher stand hier eine veraltete
      // Kopie (HEADER 62/48, PADDING 8, Port-Y über Array-Index statt Slot),
      // wodurch A*-geroutete Kabel von den echten Handles abwichen.
      const greengoConfig = projectStoreInstance.getState().project.greengoConfig
      const layout = computeEquipmentLayout(eq, greengoConfig)
      const handleAt = (
        portId: string,
        type: 'source' | 'target',
      ): { side: HandleSide; pos: { x: number; y: number } } | null => {
        const p = layout.portPos(portId, type)
        return p ? { side: p.side, pos: { x: p.x, y: p.y } } : null
      }
      return { width: layout.width, height: layout.height, handleAt }
    }

    const routeOne = (cableId: string): boolean => {
      const proj = projectStoreInstance.getState().project
      const cable = proj.cables.find((c) => c.id === cableId)
      if (!cable) return false
      const srcEq = proj.equipment.find((e) => e.id === cable.fromEquipmentId)
      const tgtEq = proj.equipment.find((e) => e.id === cable.toEquipmentId)
      if (!srcEq || !tgtEq) return false
      const srcLayout = layoutOf(srcEq)
      const tgtLayout = layoutOf(tgtEq)
      const srcHandle = srcLayout.handleAt(cable.fromPortId, 'source')
      const tgtHandle = tgtLayout.handleAt(cable.toPortId, 'target')
      if (!srcHandle || !tgtHandle) return false
      const obstacles: PixelRect[] = proj.equipment.map((eq) => {
        const l = layoutOf(eq)
        return { x: eq.x, y: eq.y, width: l.width, height: l.height, id: eq.id }
      })
      const waypoints = routeCableWithAStar({
        source: srcHandle.pos,
        target: tgtHandle.pos,
        sourceSide: srcHandle.side,
        targetSide: tgtHandle.side,
        obstacles,
        sourceEquipmentId: cable.fromEquipmentId,
        targetEquipmentId: cable.toEquipmentId,
        // v7.9.118 / Issue #223 — Im Rack-Mode kleineres Obstacle-
        // Padding, weil Rack-Geraete in 1HE-Schritten direkt aneinander
        // stehen. Default 2 (= 40 px) wuerde den Korridor zwischen
        // benachbarten Geraeten komplett sperren → A* loopt ums Rack.
        // 0 Padding ist akzeptabel hier — die Geraete-Aussenkanten
        // sind Snap-Grid-aligned, ein Kabel direkt an der Kante stoert
        // visuell weniger als ein Riesen-Umweg.
        ...(mode === 'rack' ? { obstaclePadCells: 0 } : {}),
      })
      // v7.9.115 / Issue #223 — Wenn A* keinen Pfad findet (dichtes
      // Rack, blockierter Korridor), schweigend zurueck auf
      // ReactFlow's Standard-Orthogonal-Routing fallen. Vorher gab's
      // ein 'A*-Routing fehlgeschlagen'-Modal das den User blockierte.
      // Mit waypoints=undefined nutzt CableEdge den buildPath-Pfad
      // (orthogonalWaypoints aus pathfinding.ts) der immer eine Linie
      // zwischen den Handles findet, selbst wenn nicht optimal.
      if (!waypoints) {
        updateCable(cable.id, { waypoints: undefined })
        return true
      }
      updateCable(cable.id, { waypoints: waypoints.length > 0 ? waypoints : undefined })
      return true
    }

    const routeAll = (): number => {
      const proj = projectStoreInstance.getState().project
      let ok = 0
      for (const c of proj.cables) {
        if (routeOne(c.id)) ok += 1
      }
      return ok
    }

    setCableRouter(routerId, { routeOne, routeAll })
    return () => setCableRouter(routerId, null)
    // projectStoreInstance + mode sind stabil; equipment triggert Re-Routing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerId, equipment, updateCable])
}
