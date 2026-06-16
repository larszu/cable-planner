import { v4 as uuidv4 } from 'uuid'
import type { CablePlannerProject } from '../types/project'

/**
 * #ux — Beispiel-/Demo-Plan für Neueinsteiger.
 *
 * Wird aus dem Empty-State der leeren Canvas geladen ("Beispielprojekt laden").
 * Zeigt einen kleinen, realistischen Broadcast-Aufbau, damit man sofort sieht,
 * wie ein fertiger Plan aussieht (Geräte + verbundene Kabel) statt vor einer
 * leeren Fläche zu stehen.
 *
 * Bewusst klein gehalten: 2 Kameras → Bildmischer → Multiviewer & Regie-Monitor.
 * Jeder Aufruf erzeugt frische UUIDs, damit mehrfaches Laden sauber bleibt und
 * keine ID-Kollisionen entstehen.
 */
export const createDemoProject = (): CablePlannerProject => {
  const now = new Date().toISOString()

  // Geräte- + Port-IDs vorab, damit die Kabel gültige Endpunkte referenzieren.
  const cam1 = uuidv4()
  const cam1Out = uuidv4()
  const cam2 = uuidv4()
  const cam2Out = uuidv4()
  const mix = uuidv4()
  const mixIn1 = uuidv4()
  const mixIn2 = uuidv4()
  const mixIn3 = uuidv4()
  const mixIn4 = uuidv4()
  const mixPgm = uuidv4()
  const mixMv = uuidv4()
  const mv = uuidv4()
  const mvIn = uuidv4()
  const mon = uuidv4()
  const monIn = uuidv4()

  return {
    metadata: {
      name: 'Beispiel: Kleines Studio-Setup',
      description:
        'Demo-Plan: 2 Kameras → Bildmischer → Multiviewer & Regie-Monitor. ' +
        'Zum Ausprobieren — einfach Geräte/Kabel anklicken oder löschen.',
      createdAt: now,
      updatedAt: now,
      defaultVideoFormat: '1080p50',
      defaultPowerStandard: 'eu-230-1ph',
      defaultLightingControl: 'dmx512',
    },
    equipment: [
      {
        id: cam1,
        name: 'Kamera 1',
        category: 'Kameras',
        inputs: [],
        outputs: [{ id: cam1Out, name: 'SDI Out', type: 'BNC', connectorType: 'BNC', direction: 'out' }],
        x: 80,
        y: 80,
        width: 200,
        height: 130,
        nodeColor: '#0f4c81',
      },
      {
        id: cam2,
        name: 'Kamera 2',
        category: 'Kameras',
        inputs: [],
        outputs: [{ id: cam2Out, name: 'SDI Out', type: 'BNC', connectorType: 'BNC', direction: 'out' }],
        x: 80,
        y: 320,
        width: 200,
        height: 130,
        nodeColor: '#0f4c81',
      },
      {
        id: mix,
        name: 'Bildmischer',
        category: 'Mischer',
        inputs: [
          { id: mixIn1, name: 'In 1', type: 'BNC', connectorType: 'BNC', direction: 'in' },
          { id: mixIn2, name: 'In 2', type: 'BNC', connectorType: 'BNC', direction: 'in' },
          { id: mixIn3, name: 'In 3', type: 'BNC', connectorType: 'BNC', direction: 'in' },
          { id: mixIn4, name: 'In 4', type: 'BNC', connectorType: 'BNC', direction: 'in' },
        ],
        outputs: [
          { id: mixPgm, name: 'PGM Out', type: 'BNC', connectorType: 'BNC', direction: 'out' },
          { id: mixMv, name: 'Multiview Out', type: 'BNC', connectorType: 'BNC', direction: 'out' },
        ],
        x: 460,
        y: 170,
        width: 240,
        height: 210,
        nodeColor: '#7c3aed',
      },
      {
        id: mv,
        name: 'Multiviewer',
        category: 'Monitor',
        inputs: [{ id: mvIn, name: 'SDI In', type: 'BNC', connectorType: 'BNC', direction: 'in' }],
        outputs: [],
        x: 880,
        y: 80,
        width: 210,
        height: 140,
      },
      {
        id: mon,
        name: 'Regie-Monitor',
        category: 'Monitor',
        inputs: [{ id: monIn, name: 'SDI In', type: 'BNC', connectorType: 'BNC', direction: 'in' }],
        outputs: [],
        x: 880,
        y: 320,
        width: 210,
        height: 140,
      },
    ],
    cables: [
      {
        id: uuidv4(),
        name: 'CAM 1 → Mischer',
        type: 'BNC',
        length: 12,
        color: '#3b82f6',
        fromEquipmentId: cam1,
        fromPortId: cam1Out,
        toEquipmentId: mix,
        toPortId: mixIn1,
        notes: '',
        routing: 'orthogonal',
        arrowEnd: true,
        layer: 'video',
      },
      {
        id: uuidv4(),
        name: 'CAM 2 → Mischer',
        type: 'BNC',
        length: 18,
        color: '#3b82f6',
        fromEquipmentId: cam2,
        fromPortId: cam2Out,
        toEquipmentId: mix,
        toPortId: mixIn2,
        notes: '',
        routing: 'orthogonal',
        arrowEnd: true,
        layer: 'video',
      },
      {
        id: uuidv4(),
        name: 'PGM → Regie-Monitor',
        type: 'BNC',
        length: 6,
        color: '#ef4444',
        fromEquipmentId: mix,
        fromPortId: mixPgm,
        toEquipmentId: mon,
        toPortId: monIn,
        notes: '',
        routing: 'orthogonal',
        arrowEnd: true,
        layer: 'video',
      },
      {
        id: uuidv4(),
        name: 'Multiview → Multiviewer',
        type: 'BNC',
        length: 6,
        color: '#22c55e',
        fromEquipmentId: mix,
        fromPortId: mixMv,
        toEquipmentId: mv,
        toPortId: mvIn,
        notes: '',
        routing: 'orthogonal',
        arrowEnd: true,
        layer: 'video',
      },
    ],
    locations: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }
}
