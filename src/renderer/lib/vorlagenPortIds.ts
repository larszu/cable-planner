import type { Port } from '../types/equipment'

/**
 * #1224 — Eindeutige Port-Ids fuer den Vorlagen-Inspector.
 *
 * Die eingebauten Kataloge legen ihre Ports mit `id: ''` an; erst
 * `addEquipment` vergibt beim Platzieren frische Ids. Fuer den Plan reicht
 * das — der Inspector einer Vorlage aber fuehrt die Port-Liste nach Id: als
 * React-Key, als dnd-kit-Id, fuer Auf-/Zuklappen und fuer `updatePort` /
 * `removePort`. Mit lauter leeren Ids hatten alle Zeilen denselben Key; beim
 * Wechsel auf eine andere Vorlage behielt React Zeilen der vorigen
 * (gemeldet: Name neu, Ports alt), und Aendern oder Entfernen EINES Ports
 * traf alle.
 *
 * Fehlende und doppelte Ids werden hier ersetzt, und zwar deterministisch
 * aus dem Vorlagennamen: so sind die Keys zweier Vorlagen nie gleich, und
 * dieselbe Vorlage behaelt sie ueber jedes Rendern. Gespeichert werden sie
 * erst mit der ersten Aenderung; platzierte Geraete bekommen ohnehin neue.
 */
export const vorlagenPortsMitIds = (ports: readonly Port[], praefix: string): Port[] => {
  // Erst die Ids festhalten, die bleiben (jeweils das erste Vorkommen),
  // dann die neuen so waehlen, dass sie keiner davon gleichen.
  const gesehen = new Set<string>()
  const behalten = ports.map((p) => {
    if (!p.id || gesehen.has(p.id)) return false
    gesehen.add(p.id)
    return true
  })
  return ports.map((p, i) => {
    if (behalten[i]) return p
    let id = `${praefix}#${i}`
    for (let n = 1; gesehen.has(id); n++) id = `${praefix}#${i}.${n}`
    gesehen.add(id)
    return { ...p, id }
  })
}
