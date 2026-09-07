// ───────────────────────────────────────────────────────────────────────────
// Zeichnet dieses Geraet auf — und in welcher Form? (Bedarf 62)
//
// ─── WARUM DAS KEIN `DeviceKind` IST ───────────────────────────────────────
//
// `deviceKind.ts` fuehrt eine ROLLE: Videohub, ATEM, Multiviewer, GreenGo.
// Aufzeichnen ist keine Rolle, sondern eine FAEHIGKEIT — und die faellt nicht
// mit der Rolle zusammen:
//
//   • Ein ATEM Mini Pro ISO ist Mischer UND Recorder.
//   • Ein Atomos Shogun ist Monitor UND Recorder.
//   • Ein HyperDeck ist nur Recorder.
//
// Ein einzelnes Enum koennte fuer die ersten beiden nur eines von beidem
// sagen, und welches es sagt, entschiede der, der es zuerst eintraegt. Was
// dabei verloren ginge, faellt niemandem auf: der Mischer bliebe ein Mischer
// und die Aufzeichnung verschwaende aus dem Plan — genau die Spalte, die
// Bedarf 62 verlangt.
//
// ─── DIE ZWEI FORMEN SIND VERSCHIEDENE AUSKUENFTE ──────────────────────────
//
//   `per-input`   Ein Kanal JE EINGANG. Ein ATEM ISO schreibt pro Eingang
//                 eine Datei; die Kanalnummer IST die Eingangsnummer, und
//                 damit steht sie schon im Kabelgraph.
//   `per-device`  EINE Aufzeichnung dessen, was am Eingang anliegt
//                 (HyperDeck, Ki Pro, Shogun). Welche Rolle darin landet,
//                 sagt die Verkabelung — nicht das Geraet.
//
// Sie zusammenzuwerfen hiesse, fuer den HyperDeck eine Kanalnummer zu
// erfinden, die es nicht gibt.
//
// ─── AUFLOESUNGS-REIHENFOLGE ───────────────────────────────────────────────
//
// Dieselbe wie in `deviceKind.ts`: (1) stabile Geraetetyp-ID → Datenblatt-
// Tatsache aus dem Katalog; (2) Namens-Heuristik als Rueckfall fuer Geraete
// OHNE ID (von Hand angelegt, Rentman-/GraphML-Import ohne Katalog-Treffer).
// Die Heuristik schreibt nichts ins Modell — sie beantwortet eine Frage.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../types/equipment'
import { resolveDeviceType } from './deviceTypeRegistry'

export type RecordingCapability =
  /** Ein Aufnahmekanal je Eingang — die Kanalnummer ist die Eingangsnummer. */
  | 'per-input'
  /** Eine Aufzeichnung dessen, was am Eingang anliegt. */
  | 'per-device'

export const RECORDING_LABEL: Readonly<Record<RecordingCapability, string>> = {
  'per-input': 'Kanal je Eingang',
  'per-device': 'eine Aufzeichnung',
}

/**
 * Namen, die einen Recorder ohne Katalog-Eintrag erkennen lassen.
 *
 * Bewusst kurz und auf Modellfamilien beschraenkt, die nichts anderes sind:
 * ein Regex auf „record" allein traefe „Recorder-Kabel" und „Aufnahmeraum".
 * Der Rueckfall darf lieber schweigen als raten — ein erfundener
 * Aufnahmekanal auf einem Uebergabeblatt schickt die Post an eine Datei, die
 * es nicht gibt.
 */
const PER_DEVICE_NAME =
  /hyperdeck|ki\s?pro|kipro|\bhelo\b|shogun|ninja\s?v|\bsumo\s?19\b|odyssey\s?7q|pix-?e|\bblackjack\b/i

/** ATEM-Modelle mit ISO-Aufzeichnung tragen „ISO" im Modellnamen. */
const PER_INPUT_NAME = /\biso\b/i

/**
 * Zeichnet dieses Geraet auf?
 *
 * `null` heisst „nach allem, was der Plan hergibt: nein". Das ist eine
 * Auskunft und kein Schweigen — `postHandover` macht daraus die Zeile
 * „kein Recorder im Plan" statt einer leeren Zelle.
 */
export const detectRecording = (device: EquipmentItem): RecordingCapability | null => {
  const resolved = resolveDeviceType(device.deviceTypeId)
  // Katalog-Geraet: das Datenblatt entscheidet, auch wenn es „nein" sagt.
  // Ein Katalog-Treffer ohne `records` ist die AUSSAGE, dass dieses Modell
  // nicht aufzeichnet — die Heuristik darf sie nicht ueberstimmen.
  if (resolved) return resolved.records ?? null

  const name = device.name
  if (PER_INPUT_NAME.test(name) && /\batem\b/i.test(name)) return 'per-input'
  if (PER_DEVICE_NAME.test(name)) return 'per-device'
  return null
}
