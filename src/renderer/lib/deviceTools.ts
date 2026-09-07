// ───────────────────────────────────────────────────────────────────────────
// WELCHES WERKZEUG GEHOERT AN WELCHES GERAET.
//
// Nutzer-Rueckmeldung 2026-09-07: „In Werkzeuge die ganzen Tools müssten
// eigentlich besser eingebaut werden da wo man sie auch wirklich braucht. Das
// sie nicht in einer langen Liste sind."
//
// FUENF DER 24 EINTRAEGE SIND GERAETE-WERKZEUGE. „ATEM Multiviewer-Layout",
// „ATEM Audio-Routing", „ATEM Input-Labels", „Videohub-Routing/Labels" und
// „GreenGo-Intercom" tun ohne ein solches Geraet im Plan nichts. Sie standen
// trotzdem dauerhaft in der Liste — auch in einem Plan ohne einen einzigen
// ATEM.
//
// UND DIE ZUORDNUNG IST BEREITS EINE TATSACHE, KEINE VERMUTUNG. Der
// `deviceTypeRegistry` loest die Geraetetyp-GUID autoritativ auf eine Rolle
// auf (`kind: 'videohub' | 'atem' | 'multiviewer' | 'greengo'`), und
// `detectDeviceKind` ist die Engstelle davor: Datenblatt zuerst,
// Namens-Heuristik nur fuer Geraete ohne GUID. Diese Datei baut darauf und
// erfindet keine zweite Erkennung — genau der Fehler, den `deviceKind.ts` im
// Kopf beschreibt („Namens-Heuristiken … ersetzt die ID-Aufloesung
// schrittweise").
//
// WAS SIE BEWUSST NICHT TUT: die Dialoge oeffnen. Sie sagt, WELCHE Werkzeuge
// gelten; das Oeffnen haengt am Store und gehoert in die Oberflaeche. So
// bleibt die Zuordnung rein und pruefbar, ohne dass ein Test einen Store
// hochziehen muss.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../types/equipment'
import { detectDeviceKind, type DeviceKind } from './deviceKind'

/** Die Geraete-Werkzeuge, die es gibt. Ein Eintrag = ein Dialog. */
export type DeviceToolId =
  | 'atem-mv'
  | 'atem-audio'
  | 'atem-labels'
  | 'videohub'
  | 'greengo'

export const DEVICE_TOOL_IDS: readonly DeviceToolId[] = [
  'atem-mv',
  'atem-audio',
  'atem-labels',
  'videohub',
  'greengo',
]

/**
 * Welche Werkzeuge zu welcher Geraete-Rolle gehoeren.
 *
 * EINE TABELLE UND KEINE if-Kette, damit die Zuordnung an EINER Stelle steht
 * und ein Test sie vollstaendig ablaufen kann. Wer eine sechste Rolle
 * einfuehrt, bekommt hier vom Typsystem einen Platz zugewiesen.
 *
 * `multiviewer` bekommt NUR das Layout: ein reiner Multiviewer hat kein
 * Audio-Routing und keine Eingangs-Beschriftung am Mischer — das waeren zwei
 * Knoepfe, die einen Dialog oeffnen, der ueber dieses Geraet nichts sagt.
 */
export const TOOLS_BY_KIND: Readonly<
  Record<NonNullable<DeviceKind>, readonly DeviceToolId[]>
> = {
  atem: ['atem-mv', 'atem-audio', 'atem-labels'],
  multiviewer: ['atem-mv'],
  videohub: ['videohub'],
  greengo: ['greengo'],
}

/**
 * Die Werkzeuge fuer EIN Geraet. Leer, wenn es keine der vier Rollen traegt —
 * das ist der Normalfall und keine Luecke.
 */
export function toolsForDevice(device: EquipmentItem): readonly DeviceToolId[] {
  const kind = detectDeviceKind(device)
  return kind ? TOOLS_BY_KIND[kind] : []
}

/**
 * Welche Geraete-Werkzeuge der PLAN ueberhaupt braucht.
 *
 * WOFUER: damit das Werkzeuge-Menue nur zeigt, was im Plan auch etwas
 * bewirkt. Ein Plan ohne ATEM soll keine drei ATEM-Zeilen tragen — sie sind
 * dort nicht bloss ungenutzt, sie sind die Haelfte des Grundes, warum die
 * Liste zu lang ist.
 *
 * Die Reihenfolge folgt `DEVICE_TOOL_IDS` und nicht der Geraeteliste: das
 * Menue soll sich nicht umsortieren, weil jemand ein Geraet verschoben hat.
 */
export function toolsInPlan(equipment: readonly EquipmentItem[]): readonly DeviceToolId[] {
  const gefunden = new Set<DeviceToolId>()
  for (const e of equipment) for (const t of toolsForDevice(e)) gefunden.add(t)
  return DEVICE_TOOL_IDS.filter((t) => gefunden.has(t))
}
