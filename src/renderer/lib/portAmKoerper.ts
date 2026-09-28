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

export const portAmKoerper = (
  ziel: EquipmentItem,
  seite: 'input' | 'output',
  quelle: Pick<Port, 'connectorType' | 'type' | 'standard'>,
): { portId: string; patch: Partial<EquipmentItem> } | null => {
  if (!darfPortAmKoerperAnlegen(ziel)) return null
  const liste = seite === 'input' ? ziel.inputs : ziel.outputs
  const port: Port = {
    id: uuidv4(),
    name: `${seite === 'input' ? 'In' : 'Out'} ${liste.length + 1}`,
    type: quelle.type ?? quelle.connectorType,
    connectorType: quelle.connectorType,
    ...(quelle.standard ? { standard: quelle.standard } : {}),
  }
  const patch: Partial<EquipmentItem> =
    seite === 'input' ? { inputs: [...ziel.inputs, port] } : { outputs: [...ziel.outputs, port] }
  // Wer einen Port anlegt, hat die Belegung angefangen — wie in der
  // Ports-Sektion faellt die Unbekannt-Marke dann weg.
  if (ziel.portsUnknown) patch.portsUnknown = undefined
  return { portId: port.id, patch }
}
