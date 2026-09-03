import { describe, expect, it } from 'vitest'
import type { CablePlannerProject } from '../src/renderer/types/project'
import {
  pullListTable,
  terminationListTable,
  cableScheduleTable,
  cableBomTable,
} from '../src/renderer/lib/installerLists'
import { assetRegisterTable } from '../src/renderer/lib/assetRegister'
import { handoverTable } from '../src/renderer/lib/handoverPackage'
import { buildSourceMap } from '../src/renderer/lib/sourceMap'
import { buildTallyMap } from '../src/renderer/lib/tallyMap'
import { buildPlanBom } from '../src/renderer/lib/planBom'
import { planDiffCsv } from '../src/renderer/lib/planDiff'

// ---------------------------------------------------------------------------
// Der Rundgang: welcher Ausgang traegt Geraete-Zugangsdaten nach draussen?
//
// `EquipmentItem` fuehrt `username`/`password`. Beim Aufzaehlen der Felder
// fuer den Plan-Vergleich (#639) fiel auf, dass die Regel dagegen zwar
// existierte, aber nur an einem der Ausgaenge griff. Statt es beim einen
// gefundenen Fall zu belassen, sind hier ALLE reinen Ableitungen einmal
// gegen einen Kanarienvogel-Wert laufen gelassen worden — messen statt
// nachdenken, weil ein Ausgang, der das ganze Item durchreicht, es nirgends
// erwaehnt und darum von keiner Textsuche gefunden wird.
//
// Genau so ist `cableToAvPlan` aufgefallen: `const { avForeign, ...cabling }
// = project` schiebt die Geraete unveraendert in die `.avplan`-Datei. Das
// steht bewusst NICHT in diesem Test — es ist keine Luecke, sondern eine
// offene Frage: der Import liest `domains.cabling` als ganzes Projekt zurueck
// (`MenuBar.tsx`), ein Strippen waere also ein echter Verlust beim
// Round-Trip und damit ein ADR-005-Verstoss in die andere Richtung. Der
// Befund liegt beim Eigentuemer, siehe den Kommentar in `lib/avplan.ts` und
// `CREDENTIALS-IN-TEMPLATES.md` in der Suite.
//
// Dieser Test haelt fest, was ohne Entscheidung gilt: die Dokument-
// Ableitungen tragen sie nicht, und sie sollen es auch nie tun.
// ---------------------------------------------------------------------------

const SECRET = 'PASSWORT-KANARIENVOGEL'
const USER = 'BENUTZER-KANARIENVOGEL'

const project = {
  metadata: { name: 'Halle', description: '', createdAt: '', updatedAt: '' },
  equipment: [
    {
      id: 'A',
      name: 'Switch',
      category: 'Netzwerk',
      inputs: [{ id: 'A-in', name: 'IN 1', type: 'port', connectorType: 'RJ45' }],
      outputs: [{ id: 'A-out', name: 'OUT 1', type: 'port', connectorType: 'RJ45' }],
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      ipAddress: '10.0.0.2',
      username: USER,
      password: SECRET,
    },
  ],
  cables: [],
  canvasState: { x: 0, y: 0, zoom: 1 },
} as unknown as CablePlannerProject

/** Jede Ableitung, die ein Blatt, eine Datei oder eine Liste erzeugt. */
const derivations: Array<[string, () => unknown]> = [
  ['pullListTable', () => pullListTable(project)],
  ['terminationListTable', () => terminationListTable(project)],
  ['cableScheduleTable', () => cableScheduleTable(project)],
  ['cableBomTable', () => cableBomTable(project)],
  ['assetRegisterTable', () => assetRegisterTable(project)],
  ['handoverTable', () => handoverTable(project)],
  ['buildTallyMap', () => buildTallyMap(project)],
  ['buildPlanBom', () => buildPlanBom(project.equipment, [], [])],
  [
    'buildSourceMap',
    () => buildSourceMap(project, { appVersion: '0.0.0', exportedAt: '2026-01-01T00:00:00Z' }),
  ],
  ['planDiffCsv', () => planDiffCsv(project, project)],
]

describe('kein Dokument traegt Geraete-Zugangsdaten nach draussen', () => {
  for (const [name, run] of derivations) {
    it(`${name} schreibt weder Benutzer noch Passwort`, () => {
      const out = JSON.stringify(run())
      expect(out).not.toContain(SECRET)
      expect(out).not.toContain(USER)
    })
  }

  it('der Kanarienvogel wuerde auffallen, wenn eine Ableitung ihn durchreicht', () => {
    // Gegenprobe zum Test selbst: eine Ableitung, die das Item unveraendert
    // weitergibt, faellt hier auf. Ohne diese Zeile koennte die ganze Suite
    // gruen sein, weil der Wert nie im Projekt stand.
    const passthrough = JSON.stringify(project.equipment)
    expect(passthrough).toContain(SECRET)
    expect(passthrough).toContain(USER)
  })
})
