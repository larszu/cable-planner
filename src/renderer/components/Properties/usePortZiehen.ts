import {
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { verschiebePort, type PortListen } from '../../lib/portVerschieben'

const SENSOR_ZEIGER = { activationConstraint: { distance: 6 } } as const
const SENSOR_TASTATUR = { coordinateGetter: sortableKeyboardCoordinates } as const

/** Die Griffe der beiden Listen selbst (#958, nur im Geraete-Inspector). */
const LISTEN_GRIFFE = new Set(['in', 'out'])
const istListenZiel = (id: unknown) => String(id).startsWith('liste:')

/**
 * #1220 — EIN Zieh-Kontext fuer Eingaenge und Ausgaenge, damit ein Port die
 * Liste wechseln kann. Vorher hatte jede `PortList` ihren eigenen.
 *
 * Kollision: zuerst der Port unter dem Zeiger, dann die Liste unter dem
 * Zeiger (so nimmt auch eine leere Liste einen Port an), sonst der naechste
 * Port. Ein Listen-Griff zielt nur auf den anderen Listen-Griff.
 */
export const usePortZiehen = (
  listen: PortListen,
  onChange: (listen: PortListen) => void,
  onListenTausch?: () => void,
) => {
  const sensors = useSensors(useSensor(PointerSensor, SENSOR_ZEIGER), useSensor(KeyboardSensor, SENSOR_TASTATUR))

  const collisionDetection: CollisionDetection = (args) => {
    const alle = args.droppableContainers
    if (LISTEN_GRIFFE.has(String(args.active.id))) {
      return closestCenter({ ...args, droppableContainers: alle.filter((c) => LISTEN_GRIFFE.has(String(c.id))) })
    }
    const ziele = alle.filter((c) => !LISTEN_GRIFFE.has(String(c.id)))
    const ports = ziele.filter((c) => !istListenZiel(c.id))
    const aufPort = pointerWithin({ ...args, droppableContainers: ports })
    if (aufPort.length) return aufPort
    const aufListe = pointerWithin({ ...args, droppableContainers: ziele.filter((c) => istListenZiel(c.id)) })
    if (aufListe.length) return aufListe
    return closestCenter({ ...args, droppableContainers: ports })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const aktiv = String(active.id)
    const ziel = String(over.id)
    if (LISTEN_GRIFFE.has(aktiv)) {
      if (ziel !== aktiv && LISTEN_GRIFFE.has(ziel)) onListenTausch?.()
      return
    }
    const neu = verschiebePort(listen, aktiv, ziel)
    if (neu) onChange(neu)
  }

  return { sensors, collisionDetection, onDragEnd }
}
