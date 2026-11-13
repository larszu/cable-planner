// ───────────────────────────────────────────────────────────────────────────
// Kabel auf den Geraetekoerper ziehen legt den passenden Port an (2026-09-28).
//
// Nutzer-Meldung: „man muss auch mit unvollstaendigen geraeten und infos
// schonmal arbeiten und planen koennen." Ein Geraet, das nur einen Namen
// hat (Strg+=, Bestandsaufnahme, Import ohne Komponenten), hatte keinen
// einzigen Griff — es liess sich nicht verkabeln. Ein Kabel, das man auf
// seinen Koerper fallen liess, wurde zum losen Ende daneben.
//
// Jetzt bekommt das Zielgeraet einen Port in der Gegenrichtung, mit dem
// Steckertyp der Quelle. Er ist so gut wie das, was der Nutzer gerade tut:
// er sagt „hier geht das Kabel rein".
//
// NICHT bei Katalog-Geraeten mit Belegung. Deren Ports kommen aus dem
// Datenblatt; einen dazuzuerfinden hiesse, ein Kabel an eine Buchse zu
// legen, die das Geraet nicht hat. Dort bleibt es beim losen Ende.
// ───────────────────────────────────────────────────────────────────────────
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentItem, Port } from '../types/equipment'
import { resolveDeviceType } from './deviceTypeRegistry'

/**
 * Katalog-Geraet heisst: die Id loest im eingebauten Katalog auf. Eine
 * selbst geminte Id (eigene Vorlage, `saveEquipmentAsTemplate`) zaehlt nicht —
 * deren Ports hat der Nutzer selbst eingetragen und darf sie erweitern.
 */
export const darfPortAmKoerperAnlegen = (ziel: Pick<EquipmentItem, 'deviceTypeId' | 'portsUnknown'>): boolean =>
  !resolveDeviceType(ziel.deviceTypeId) || !!ziel.portsUnknown

/**
 * #1228 — Ein bidirektionaler Port (RJ45, etherCON, Intercom …) hat keine
 * Gegenrichtung. Wer von ihm aus auf ein anderes Geraet zieht, will dort
 * einen bidirektionalen Port treffen. Landet das Kabel neben dem Griff auf
 * dem Koerper, wurde frueher trotzdem ein „Out N" angelegt (beobachtet:
 * zwei Geraete mit je einem bidirektionalen Eingang, nach dem Ziehen hatte
 * das zweite einen neuen Ausgang).
 *
 * Jetzt: zuerst einen freien bidirektionalen Port mit demselben Stecker am
 * Ziel nehmen; sonst einen bidirektionalen Port anlegen. Der neue Port
 * steht in der Eingangsliste, wie es der Port-Editor fuer „Ein-/Ausgang"
 * auch tut — die Seite ergibt sich ueber `direction`. Ist der gefundene
 * Port schon belegt, faengt `queueConnection` das mit dem Konflikt-Dialog ab.
 */
export const freierBidiPort = (
  ziel: Pick<EquipmentItem, 'inputs' | 'outputs'>,
  quelle: Pick<Port, 'connectorType'>,
  belegt: ReadonlySet<string> = new Set(),
): Port | undefined =>
  [...ziel.inputs, ...ziel.outputs].find(
    (p) => p.direction === 'bidirectional' && p.connectorType === quelle.connectorType && !belegt.has(p.id),
  )

export const portAmKoerper = (
  ziel: EquipmentItem,
  seite: 'input' | 'output',
  quelle: Pick<Port, 'connectorType' | 'type' | 'standard' | 'direction'>,
  belegt: ReadonlySet<string> = new Set(),
): { portId: string; patch: Partial<EquipmentItem> } | null => {
  const bidi = quelle.direction === 'bidirectional'
  if (bidi) {
    const vorhanden = freierBidiPort(ziel, quelle, belegt)
    if (vorhanden) return { portId: vorhanden.id, patch: {} }
    seite = 'input'
  }
  if (!darfPortAmKoerperAnlegen(ziel)) return null
  const liste = seite === 'input' ? ziel.inputs : ziel.outputs
  const port: Port = {
    id: uuidv4(),
    name: bidi ? `I/O ${liste.length + 1}` : `${seite === 'input' ? 'In' : 'Out'} ${liste.length + 1}`,
    type: quelle.type ?? quelle.connectorType,
    connectorType: quelle.connectorType,
    ...(quelle.standard ? { standard: quelle.standard } : {}),
    ...(bidi ? { direction: 'bidirectional' as const } : {}),
  }
  const patch: Partial<EquipmentItem> =
    seite === 'input' ? { inputs: [...ziel.inputs, port] } : { outputs: [...ziel.outputs, port] }
  // Wer einen Port anlegt, hat die Belegung angefangen — wie in der
  // Ports-Sektion faellt die Unbekannt-Marke dann weg.
  if (ziel.portsUnknown) patch.portsUnknown = undefined
  return { portId: port.id, patch }
}
