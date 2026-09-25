// ───────────────────────────────────────────────────────────────────────────
// Signalwege als Liste — jede Kette mit Etage und Raum an jeder Station.
//
// Die Kette selbst rechnet `signalChain.ts`, und der Inspector zeigt sie je
// Kabel („Signalweg zeigen"). Fuer die Festinstallation fehlte das Blatt, das
// ALLE Wege auf einmal zeigt: welche Kamera ueber welches Wandfeld, welche
// Hausstrecke und welches Patchfeld auf welchem Mischer-Eingang ankommt, und
// in welchem Geschoss jede Station liegt. Gefunden am Beispiel „3 PTZ
// Saal → Regie": die Liste liess sich nur aus der Funktion selbst ziehen.
//
// Kanonisches Deutsch in den Kopfzeilen — das Blatt wird gestempelt, und ein
// Fingerabdruck ueber uebersetzten Text waere sprachabhaengig.
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../types/project'
import type { CsvCell, CsvTable } from './csv'
import { signalChains, PASS_THROUGH_LABEL, type SignalChain } from './signalChain'
import { ortVonGeraet } from './kabelOrt'

const ortText = (o: { etage?: string; raum?: string }): string =>
  [o.etage, o.raum].filter(Boolean).join(' · ')

export const SIGNALWEG_KOPF = [
  'Kette',
  'Quelle',
  'Von (Etage · Raum)',
  'Ziel',
  'Nach (Etage · Raum)',
  'Zwischenstationen',
  'Hausstrecken',
  'Ende',
  'Weg',
]

export const signalwegeTable = (project: CablePlannerProject): CsvTable => {
  const locations = project.locations ?? []
  const floors = project.floors ?? []
  const byId = new Map(project.equipment.map((e) => [e.id, e]))
  const kabelById = new Map(project.cables.map((c) => [c.id, c]))
  const ort = (id: string) => ortText(ortVonGeraet(byId.get(id), locations, floors))

  const ketten = signalChains(project.equipment, project.cables, { auchDirekte: true })
    // Stabil nach Quelle und Weg — die Reihenfolge der Kabel im Projekt ist
    // Bearbeitungsverlauf und darf das Blatt nicht umsortieren.
    .map((k) => ({ k, schluessel: `${k.steps[0].fromEquipmentName}\u0000${k.steps[0].fromPortName}\u0000${k.id}` }))
    .sort((a, b) => a.schluessel.localeCompare(b.schluessel))
    .map(({ k }) => k)

  const rows: CsvCell[][] = ketten.map((k: SignalChain, i) => {
    const erste = k.steps[0]
    const letzte = k.steps[k.steps.length - 1]
    const stationen = k.steps
      .filter((s) => s.through)
      .map((s) => `${s.toEquipmentName} (${PASS_THROUGH_LABEL[s.through!]})`)
    const hausstrecken = k.steps
      .map((s) => kabelById.get(s.cableId))
      .filter((c) => c && (c.isTieLine || c.hausStreckeId))
      .map((c) => (c!.hausAder ? `${c!.cableNumber || c!.name} (${c!.hausAder})` : c!.cableNumber || c!.name))
    const weg = [
      [ort(erste.fromEquipmentId), erste.fromEquipmentName, erste.fromPortName].filter(Boolean).join(' · '),
      ...k.steps.map(
        (s) => `—[${s.cableLabel}]→ ${[ort(s.toEquipmentId), s.toEquipmentName, s.toPortName].filter(Boolean).join(' · ')}`,
      ),
    ].join(' ')
    return [
      `K${i + 1}`,
      `${erste.fromEquipmentName} · ${erste.fromPortName}`,
      ort(erste.fromEquipmentId),
      `${letzte.toEquipmentName} · ${letzte.toPortName}`,
      ort(letzte.toEquipmentId),
      stationen.join(', '),
      hausstrecken.join(', '),
      k.end === 'ziel' ? '' : k.endNote,
      weg,
    ]
  })
  return { headers: [...SIGNALWEG_KOPF], rows }
}
