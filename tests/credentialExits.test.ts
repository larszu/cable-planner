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
import { stripComments } from './support/stripComments'
import { deviceFilePayload, groupFilePayload } from '../src/renderer/lib/itemExport'
import type { EquipmentTemplate, GroupPreset } from '../src/renderer/types/equipment'

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

// ───────────────────────────────────────────────────────────────────────────
// Kein Renderer-Ausgang schreibt roh nach draussen.
//
// WARUM ES DAS GIBT (gemessen 2026-09-04, Doku-gegen-Code-Audit).
// `lib/credentialKeys.ts` nennt in seinem Kopfkommentar die Ausgaenge, fuer
// die es gilt: "der `.avplan`-Export und der Push in die geteilte
// Bibliothek". Es gab einen dritten, den der Renderer selbst baut und der
// nicht in dieser Liste stand: `SharedSyncPanel.handlePush` schrieb Projekt,
// Bibliothek und Gruppen-Presets ROH in denselben Team-Ordner.
//
// Der Schaden war der teuerste, den diese Form haben kann: wer beim
// .avplan-Export ausdruecklich "Zugangsdaten entfernen" waehlte, hatte sie
// trotzdem im Team-Ordner, sobald irgendwer Push drueckte. Die Zusicherung
// war also nicht nur unvollstaendig, sie war irrefuehrend.
//
// WARUM ALS BERECHNETE PRUEFUNG UND NICHT ALS DRITTE ZEILE IM KOMMENTAR.
// Genau die Liste war der Fehler. Ein Kommentar, der die Ausgaenge aufzaehlt,
// ist der Kenntnisstand seines Autors; der vierte Ausgang, den jemand in vier
// Wochen anlegt, faellt hier auf, ohne dass er diese Datei kennen muss.
// ───────────────────────────────────────────────────────────────────────────
const rendererQuellen = import.meta.glob('../src/renderer/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/**
 * Ein Ausgang im Sinne dieser Pruefung ist ein Schreibaufruf, der ein GANZES
 * Modell serialisiert -- nicht jeder `downloadBlob`. Die CSV- und
 * PDF-Ableitungen sind einzeln oben mit Kanarienvogel-Werten geprueft; sie
 * hier nochmal zu verlangen, wuerde die Pruefung mit Fehltreffern
 * zuschuetten, bis jemand sie abschaltet.
 */
const AUSGANG =
  /(?:cablePlannerApi\.sync\.writeFile|api\.writeFile|downloadBlob)\s*\([^;]{0,200}?JSON\.stringify\(\s*(?:raus\()?\s*(project|customLibrary|groupPresets|avplan|payload)\b/s

/**
 * Ein Speicherweg in die EIGENE Datei des Nutzers ist kein Ausgang: dort die
 * Zugangsdaten zu entfernen waere Datenverlust, nicht Schutz. Wer so einen
 * Weg baut, schreibt die Marke an die Stelle -- nicht in eine Ausnahmeliste
 * hier, denn genau eine solche Liste war der Fehler, den diese Pruefung
 * abloest.
 */
const MARKE = 'zugangsdaten: eigener speicherweg'

describe('Zugangsdaten verlassen den Rechner nur durch die Regel', () => {
  it('jeder Renderer-Ausgang kennt stripCredentials', () => {
    const verstoesse: string[] = []

    for (const [pfad, quelle] of Object.entries(rendererQuellen)) {
      if (!AUSGANG.test(stripComments(quelle))) continue
      if (/stripCredentials|credentialChoiceDialog/.test(quelle)) continue
      if (quelle.toLowerCase().includes(MARKE)) continue
      verstoesse.push(pfad.replace('../src/renderer/', ''))
    }

    expect(
      verstoesse,
      'Diese Dateien schreiben Projekt-/Bibliotheks-Daten nach draussen, ohne ' +
        'die Zugangsdaten-Regel zu kennen. Entweder `stripCredentials` (mit ' +
        '`credentialChoiceDialog`, wo der Nutzer es entscheiden soll) benutzen ' +
        '-- oder, wenn wirklich kein Modell hinausgeht, den Ausgang so bauen, ' +
        'dass er es nicht mehr durchreicht.',
    ).toEqual([])
  })

  it('die drei Sync-Schreibwege laufen einzeln durch den Filter', () => {
    // Die Datei-Ebene reicht hier nicht. Beim ersten Entwurf dieser Pruefung
    // habe ich den Filter am Projekt-Write versuchsweise entfernt und der
    // Guard blieb GRUEN -- weil die Datei den Import weiterhin trug. Eine
    // Zusicherung, die einen Rueckschritt nicht bemerkt, ist keine.
    const panel = stripComments(
      rendererQuellen['../src/renderer/components/Sync/SharedSyncPanel.tsx'],
    )
    const writes = [...panel.matchAll(/sync\.writeFile\(([\s\S]{0,160}?)\)\s*\n/g)]
    expect(writes.length, 'Schreibwege im Sync-Panel nicht gefunden').toBe(3)
    for (const [, args] of writes) {
      expect(args, `Schreibweg ohne Filter: ${args.trim().slice(0, 80)}`).toMatch(
        /JSON\.stringify\(\s*raus\(/,
      )
    }
  })

  it('gestrippt heisst gestrippt — an der Nutzlast gemessen, nicht am Text', () => {
    // Kanarienvogel wie oben: die reinen Nutzlast-Bauer von `itemExport`
    // werden direkt aufgerufen. Wer den Filter dort herausnimmt, faellt hier,
    // egal was die Datei sonst importiert.
    const geheim = { name: 'Switch', username: USER, password: SECRET } as unknown as EquipmentTemplate
    const roh = JSON.stringify(deviceFilePayload(geheim, false, ''))
    const strip = JSON.stringify(deviceFilePayload(geheim, true, ''))
    expect(roh).toContain(SECRET)
    expect(strip).not.toContain(SECRET)
    expect(strip).not.toContain(USER)

    const preset = { name: 'Rack', items: [geheim] } as unknown as GroupPreset
    expect(JSON.stringify(groupFilePayload(preset, false, ''))).toContain(SECRET)
    expect(JSON.stringify(groupFilePayload(preset, true, ''))).not.toContain(SECRET)
  })

  it('der Kopfkommentar von credentialKeys.ts nennt alle drei Ausgaenge', () => {
    // Die Liste bleibt -- sie erklaert, WOFUER die Datei da ist. Sie darf nur
    // nicht die einzige Absicherung sein. Faellt diese Zeile, ist die Frage
    // nicht "Kommentar anpassen", sondern "welcher Ausgang ist dazugekommen".
    const kopf = rendererQuellen['../src/renderer/lib/credentialKeys.ts']
    expect(kopf, 'credentialKeys.ts nicht gefunden').toBeTruthy()
    expect(kopf).toMatch(/geteilte[nr]? Ordner|Sync/)
  })
})
