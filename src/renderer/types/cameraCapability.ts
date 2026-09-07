// ───────────────────────────────────────────────────────────────────────────
// BEDARF 103 (P3) — „Per-model, not per-vendor, capability truth."
//
// Der Schaden, woertlich aus der Bedarfs-Datenbank:
//
//   > Within one vendor's own PTZ line, CONTROLS EXIST IN SOFTWARE AND DO
//   > NOTHING ON THE MODEL: colour-temperature increase/decrease dead on
//   > AW-UE150A, red/blue gain dead on AW-UE160. The vendor's own docs warn
//   > that not all models support all actions, variables and feedbacks.
//
// Belege: die Einschraenkungs-Erklaerung in der HELP.md von
// `companion-module-panasonic-cameras`, dazu die Ausgaben `#83` (geschlossen
// 2026-08) und `#56` (geschlossen „not planned", 2026-07) im selben Repo.
//
// ─── DREI WERTE UND NICHT ZWEI ─────────────────────────────────────────────
//
// `supported`, `unsupported`, `unknown`. Der dritte ist der wichtigste und der
// Grund, warum diese Datei ueberhaupt existiert: die Oberflaeche eines
// Steuerungs-Werkzeugs zeigt heute JEDE Funktion, weil sie zum Hersteller
// gehoert — und der Bediener erfaehrt erst am Geraet, dass sie an DIESEM
// Modell tot ist. Ein zweiwertiges Feld haette dieselbe Wirkung: was nicht
// als „geht" eingetragen ist, saehe aus wie „geht nicht", und aus einer
// fehlenden Datenblatt-Angabe wuerde eine Behauptung.
//
// UNKNOWN IST NICHT SUPPORTED, und `unknown` ist auch nicht `unsupported`.
// Wer aus einer Luecke eine Aussage macht, hat den Bedarf umgedreht.
//
// ─── KEIN EINTRAG OHNE FUNDSTELLE ──────────────────────────────────────────
//
// Jede Zeile der Tabelle traegt `source` — die Stelle, an der die Aussage
// steht. `tests/cameraCapability.test.ts` haelt das fest: wer ein Modell aus
// dem Gedaechtnis ergaenzt, faellt dort auf. Eine geratene Faehigkeits-Zeile
// ist schlimmer als keine: sie sieht aus wie ein Datenblatt.
// ───────────────────────────────────────────────────────────────────────────

/** Ob ein Modell eine Steuerfunktion kann. */
export type ControlSupport = 'supported' | 'unsupported' | 'unknown'

export const CONTROL_SUPPORT_LABEL: Readonly<Record<ControlSupport, string>> = {
  supported: 'unterstützt',
  unsupported: 'nicht unterstützt',
  unknown: 'nicht belegt',
}

/**
 * Die Steuerfunktionen, um die es geht.
 *
 * Bewusst KEINE Hersteller-Kommandos, sondern das, was in der Regie gesagt
 * wird. Ein Kommandoname gehoerte in die Bruecke, die das Geraet anspricht;
 * hier steht die Planungsfrage „kann diese Kamera das".
 */
export type CameraControl =
  | 'pan-tilt'
  | 'zoom'
  | 'focus'
  | 'iris'
  | 'gain'
  | 'shutter'
  | 'nd-filter'
  | 'white-balance'
  | 'colour-temperature'
  | 'red-gain'
  | 'blue-gain'
  | 'detail'
  | 'preset-recall'
  | 'preset-store'

export const CAMERA_CONTROL_LABEL: Readonly<Record<CameraControl, string>> = {
  'pan-tilt': 'Schwenken und Neigen',
  zoom: 'Zoom',
  focus: 'Schärfe',
  iris: 'Blende',
  gain: 'Verstärkung',
  shutter: 'Verschluss',
  'nd-filter': 'ND-Filter',
  'white-balance': 'Weißabgleich',
  'colour-temperature': 'Farbtemperatur',
  'red-gain': 'Rot-Anteil',
  'blue-gain': 'Blau-Anteil',
  detail: 'Detail',
  'preset-recall': 'Preset abrufen',
  'preset-store': 'Preset speichern',
}

/** Was ein Modell laut Fundstelle kann und was nicht. */
export interface CameraCapability {
  /** Modellname, wie ihn die Fundstelle nennt. */
  model: string
  /**
   * Nur die Funktionen, ueber die eine AUSSAGE vorliegt. Alles andere ist
   * `unknown` — und das entsteht durch Weglassen, nicht durch einen Eintrag.
   */
  controls: Partial<Record<CameraControl, ControlSupport>>
  /** Wo die Aussage steht. Pflicht: ohne Fundstelle keine Zeile. */
  source: string
}
