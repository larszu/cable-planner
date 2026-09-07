// ───────────────────────────────────────────────────────────────────────────
// BEDARF 103 — die Faehigkeits-Tabelle, nach MODELL und nicht nach Hersteller.
//
// Die Massnahme woertlich: „Capability table KEYED BY CAMERA MODEL, not
// connection mode; show unsupported paint functions as DISABLED in planning
// documents and in the bridge UI."
//
// ─── WARUM NACH MODELLNAME UND NICHT NACH `deviceTypeId` ───────────────────
//
// Der Katalog dieser Anwendung fuehrt 23 Kameras, und keine davon ist eine
// Panasonic-PTZ — die beiden Modelle, ueber die eine belegte Aussage
// vorliegt, haben hier keine Geraetetyp-Id. Eine Tabelle nach `deviceTypeId`
// waere also leer, und die einzige belegte Auskunft des ganzen Bedarfs fiele
// heraus.
//
// Der Modellname ist der Schluessel, den die FUNDSTELLE benutzt, und der
// Bedarf sagt genau das („keyed by camera model"). Wo ein Katalog-Eintrag
// existiert, wird sein Template-Name mitgeprueft — beide Wege laufen durch
// `normaliseModel`, damit die Schreibweise nicht zur zweiten Regel wird.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../types/equipment'
import {
  type CameraCapability,
  type CameraControl,
  type ControlSupport,
} from '../types/cameraCapability'
import { resolveDeviceType } from './deviceTypeRegistry'

/**
 * Schreibweisen zusammenfuehren: klein, ohne Bindestriche und Leerzeichen.
 *
 * „AW-UE150A", „aw ue150a" und „AWUE150A" sind dasselbe Modell. Ohne diese
 * eine Stelle entschiede die Schreibweise des Eintragenden darueber, ob die
 * Warnung erscheint — und sie erschiene genau dann nicht, wenn jemand den
 * Namen von Hand getippt hat.
 */
export const normaliseModel = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Die Tabelle. ZWEI Zeilen, und das ist kein Zwischenstand.
 *
 * Es sind genau die beiden Aussagen, die im Korpus belegt sind. Jede weitere
 * Zeile braucht eine Fundstelle; ohne sie waere sie eine Behauptung im
 * Gewand eines Datenblatts, und der Bedarf ist gegen genau diese Sorte
 * Behauptung geschrieben.
 *
 * Was hier NICHT steht, ist deshalb auch nicht „geht nicht", sondern
 * `unknown`. Der Unterschied ist der ganze Bedarf.
 */
export const CAMERA_CAPABILITIES: readonly CameraCapability[] = [
  {
    model: 'AW-UE150A',
    controls: { 'colour-temperature': 'unsupported' },
    source:
      'bitfocus/companion-module-panasonic-cameras — Farbtemperatur hoch/runter bleibt am Modell wirkungslos (Ausgabe #83, geschlossen 2026-08)',
  },
  {
    model: 'AW-UE160',
    controls: { 'red-gain': 'unsupported', 'blue-gain': 'unsupported' },
    source:
      'bitfocus/companion-module-panasonic-cameras — Rot-/Blau-Anteil bleibt am Modell wirkungslos (Ausgabe #56, geschlossen „not planned", 2026-07)',
  },
]

const byModel = new Map(CAMERA_CAPABILITIES.map((c) => [normaliseModel(c.model), c]))

/** Die belegte Zeile zu einem Modellnamen, wenn es eine gibt. */
export const capabilityFor = (model: string): CameraCapability | undefined =>
  byModel.get(normaliseModel(model))

/**
 * Der Modellname eines Plan-Geraets.
 *
 * Erst das Datenblatt (ueber die Geraetetyp-Id), dann der Name im Plan. Die
 * Reihenfolge ist dieselbe wie in `deviceKind.ts` und `recording.ts`: eine
 * Katalog-Tatsache schlaegt einen getippten Namen.
 */
export const modelOf = (device: Pick<EquipmentItem, 'name' | 'deviceTypeId'>): string =>
  (device.deviceTypeId ? resolveDeviceType(device.deviceTypeId)?.template.name : undefined) ??
  device.name

/**
 * Kann dieses Modell diese Funktion?
 *
 * `unknown`, solange keine Fundstelle etwas anderes sagt — auch fuer ein
 * Modell, das gar nicht in der Tabelle steht. Das ist die tragende Zeile
 * dieser Datei.
 */
export const controlSupport = (model: string, control: CameraControl): ControlSupport =>
  capabilityFor(model)?.controls[control] ?? 'unknown'

export interface ControlRow {
  control: CameraControl
  support: ControlSupport
  /** Die Fundstelle, wenn die Aussage aus einer stammt. */
  source?: string
}

/**
 * Alle Funktionen eines Modells mit ihrem Stand.
 *
 * Gibt IMMER alle Funktionen zurueck, auch die unbelegten. Eine Liste, die
 * nur die belegten zeigt, saehe fuer ein unbekanntes Modell leer aus — und
 * „leer" liest sich als „kann nichts".
 */
export const controlRows = (model: string): ControlRow[] => {
  const eintrag = capabilityFor(model)
  return (Object.keys(CONTROL_ORDER) as CameraControl[]).map((control) => {
    const support = eintrag?.controls[control] ?? 'unknown'
    return {
      control,
      support,
      ...(eintrag && eintrag.controls[control] ? { source: eintrag.source } : {}),
    }
  })
}

/**
 * Die Reihenfolge der Funktionen auf jedem Blatt.
 *
 * Fest und nicht alphabetisch: Bewegung, dann Belichtung, dann Farbe, dann
 * Presets — so, wie jemand an einem Bedienpult sucht. Alphabetisch stuende
 * „Blende" zwischen „Blau-Anteil" und „Detail".
 */
const CONTROL_ORDER: Readonly<Record<CameraControl, number>> = {
  'pan-tilt': 0,
  zoom: 1,
  focus: 2,
  iris: 3,
  gain: 4,
  shutter: 5,
  'nd-filter': 6,
  'white-balance': 7,
  'colour-temperature': 8,
  'red-gain': 9,
  'blue-gain': 10,
  detail: 11,
  'preset-recall': 12,
  'preset-store': 13,
}

export type CapabilityFindingKind = 'model-unknown' | 'control-unsupported'

export const CAPABILITY_FINDING_LABEL: Readonly<Record<CapabilityFindingKind, string>> = {
  'model-unknown': 'Zu diesem Modell liegt keine Fähigkeits-Aussage vor',
  'control-unsupported': 'Diese Funktion ist an diesem Modell wirkungslos',
}

export interface CapabilityFinding {
  kind: CapabilityFindingKind
  equipmentId: string
  model: string
  control?: CameraControl
  detail?: string
}

/**
 * Was an den Kameras eines Plans zu den Steuerfunktionen zu sagen ist.
 *
 * `model-unknown` ist ein BEFUND und keine Warnung: er sagt nicht, dass etwas
 * falsch ist, sondern dass die Antwort fehlt. Ohne ihn saehe ein Plan voller
 * unbelegter Kameras genauso aus wie einer, dessen Modelle alle geprueft
 * sind.
 */
export const capabilityFindings = (
  devices: readonly Pick<EquipmentItem, 'id' | 'name' | 'deviceTypeId' | 'category'>[],
): CapabilityFinding[] => {
  const out: CapabilityFinding[] = []
  for (const d of devices) {
    // Die Kategorie und nicht ein Typfeld: `EquipmentItem` fuehrt die
    // Taxonomie in `category`, und der Katalog legt Kameras unter „Kameras" ab.
    if (!/kamera|camera/i.test(d.category ?? '')) continue
    const model = modelOf(d)
    const eintrag = capabilityFor(model)
    if (!eintrag) {
      out.push({ kind: 'model-unknown', equipmentId: d.id, model })
      continue
    }
    for (const [control, support] of Object.entries(eintrag.controls) as [
      CameraControl,
      ControlSupport,
    ][]) {
      if (support !== 'unsupported') continue
      out.push({
        kind: 'control-unsupported',
        equipmentId: d.id,
        model,
        control,
        detail: eintrag.source,
      })
    }
  }
  return out
}
