/**
 * Welche Dokumente einen Stand haben — und wie er berechnet wird.
 *
 * ADR-004, Inkrement 2. Der Stempel auf einem Blatt ist nur die halbe Antwort;
 * die andere Hälfte ist, denselben Stand *heute* ausrechnen zu können. Diese
 * Datei hält beide Enden zusammen: der Schlüssel ist derselbe Bezeichner, der im
 * Dateinamen steht (`pull-liste`, `kabel-schedule` …), und der Wert ist genau
 * die Ableitung, aus der das Dokument gebaut wurde.
 *
 * Getrennt von `documentStamp`, weil die Ableitungen ihrerseits den Stempel
 * importieren — hier laufen sie zusammen, dort nicht.
 */
import type { CablePlannerProject } from '../types/project'
import { documentFingerprint, planFingerprint } from './documentStamp'
import {
  pullListTable,
  terminationListTable,
  cableScheduleTable,
} from './installerLists'
import { assetRegisterTable } from './assetRegister'
import { handoverTable } from './handoverPackage'
import { deliveryTableForProject } from './deliveryParity'
import { runOfShowSheetForProject } from './encoderFeasibility'
import { tallyMapTableForProject } from './tallyMap'
import { deliveryPathTable } from './deliveryPath'
import { buildPtpPlan, ptpTable } from './ptpPlan'
import { crewSheetTableForProject } from './crewNetworkSheet'
import { spectrumTableForProject } from './spectrumPlan'
import { multicastTableForProject } from './multicastPlan'
import { fallbackTable } from './fallbackPlan'
import type { CsvTable } from './csv'

const ofTable =
  (derive: (project: CablePlannerProject) => CsvTable) =>
  (project: CablePlannerProject): string => {
    const table = derive(project)
    return documentFingerprint(table.headers, table.rows)
  }

/**
 * Dokument-Bezeichner → aktueller Stand.
 *
 * **`kabel-bom` fehlt hier bewusst.** Sein Inhalt hängt vom Reserve-Aufschlag ab,
 * den der Nutzer beim Export einstellt, und dieser Prozentsatz steht nicht im
 * Stempel. Ohne ihn liesse sich der Stand nicht reproduzieren — und ein
 * Vergleich gegen einen anders gerechneten Wert würde jedes Blatt als veraltet
 * ausweisen. Ein `unknown` ist die ehrlichere Antwort; siehe `docStandStatus`.
 */
export const DOCUMENT_STANDS: Record<string, (project: CablePlannerProject) => string> = {
  plan: planFingerprint,
  'pull-liste': ofTable(pullListTable),
  'termination-liste': ofTable(terminationListTable),
  'kabel-schedule': ofTable(cableScheduleTable),
  'asset-register': ofTable(assetRegisterTable),
  uebergabe: ofTable(handoverTable),
  // Initiative 9 — die Ausspielung. Reproduzierbar, weil ihr Inhalt allein aus
  // `project.deliveryDestinations` folgt: keine Nutzer-Einstellung beim Export
  // (anders als `kabel-bom` mit seinem Reserve-Aufschlag) und keine Sprache
  // (die Tabelle traegt kanonisches Deutsch, siehe `deliveryIssueText`).
  ausspielung: ofTable(deliveryTableForProject),
  // Bedarf 33 — das Ablaufblatt fuer den Showtag. Aus demselben Grund
  // reproduzierbar wie `ausspielung`: sein Inhalt folgt allein aus
  // `project.deliveryDestinations`, es traegt keine Nutzer-Einstellung und
  // kanonisches Deutsch. Der Stream-Key steht darauf als Verweis, nicht als
  // Wert -- der Fingerabdruck misst also nichts Geheimes.
  ablaufblatt: ofTable(runOfShowSheetForProject),
  // Bedarf 26 — die Tally-Karte. Der Bedarf nennt sie als erstes unter den
  // Blaettern, die bei einer spaeten Aenderung vergessen werden („multiviewer
  // window, comms position, TALLY, truck plan, check-in list"), und sie war
  // fuer die Impact-Liste unsichtbar. Reproduzierbar, weil `buildTallyMap`
  // allein aus `equipment`, `cables` und `sourceIdentities` ableitet: keine
  // Nutzer-Einstellung, keine Sprache.
  'tally-karte': ofTable(tallyMapTableForProject),
  // Bedarf 32 — der Ausspielweg. Reproduzierbar, weil `buildDeliveryChains`
  // allein aus `deliveryDestinations`, `equipment` und `cables` ableitet:
  // keine Nutzer-Einstellung beim Export, keine Sprache (die Befundtexte sind
  // kanonisches Deutsch, siehe `chainFindingText`) und kein Zufall.
  ausspielweg: ofTable(deliveryPathTable),
  // Bedarf 73 — der Zeit-Plan. Reproduzierbar aus demselben Grund: er folgt
  // allein aus den PTP-Feldern der Schnittstellen und den Standards an den
  // Kabeln. Die BEFUNDE stehen bewusst nicht in der Tabelle — sie tragen
  // Fliesstext, und ein Blatt, dessen Stand sich mit jeder Umformulierung
  // aendert, meldete jedes gedruckte Exemplar als veraltet.
  'ptp-plan': (project) =>
    ofTable(() => ptpTable(buildPtpPlan(project.equipment, project.cables)))(project),
  // Bedarf 77 — das Netz-Merkblatt fuer die Crew. Es IST ein Dokument und
  // keine Nachricht, und der Unterschied ist genau dieser Eintrag: ein Blatt
  // mit Bezeichner und Stand laesst sich mit „gilt das noch?" pruefen
  // (Bedarf 27), eine WhatsApp-Nachricht nicht.
  'crew-netz': ofTable(crewSheetTableForProject),
  // Bedarf 95 — alles, was funkt, in einem Blatt. Reproduzierbar: der Inhalt
  // folgt allein aus dem Rig-Plan, den drahtlosen Kabeln und den
  // Intercom-Zuordnungen. Die BEFUNDE stehen nicht drin -- sie tragen
  // Fliesstext aus `computeRfConflicts`.
  'spektrum-plan': ofTable(spectrumTableForProject),
  // Bedarf 72 — der Multicast-Adressplan. Reproduzierbar: die Fluesse folgen
  // aus dem Kabelgraph, die Adressen stehen im Projekt. Die BEFUNDE stehen
  // nicht in der Tabelle -- sie tragen Fliesstext, und ein Blatt, dessen Stand
  // sich mit jeder Umformulierung aendert, meldete jedes gedruckte Exemplar
  // als veraltet.
  'multicast-plan': ofTable(multicastTableForProject),
  // Bedarf 89 — das Sicherheitsnetz als Blatt mit Stand. Reproduzierbar: der
  // Inhalt folgt allein aus den Regeln und den Zielen. Die BEFUNDE stehen
  // nicht drin -- sie tragen Fliesstext.
  'ausweich-plan': ofTable(fallbackTable),
}

/**
 * Dokumente, die es GIBT, deren Stand aber nicht aus dem Plan allein
 * reproduzierbar ist — mit dem Grund im Klartext.
 *
 * Bis Roadmap-Initiative 5 stand diese Kenntnis nur im Kommentar über
 * `DOCUMENT_STANDS`. Ein Kommentar kann eine Impact-Liste nicht warnen: sie
 * hätte `kabel-bom` einfach nicht genannt, und Verschweigen sieht aus wie
 * „unberührt". Als Daten statt als Prosa kann `changeImpact` daraus ein
 * ausdrückliches `unknown` machen.
 *
 * Wer ein Dokument hier einträgt, sagt damit: es ist bekannt UND nicht
 * beurteilbar. Wer es reproduzierbar macht, verschiebt es nach
 * `DOCUMENT_STANDS` — beides gleichzeitig fängt der Guard in
 * `tests/changeImpact.test.ts`.
 */
export const UNJUDGEABLE_DOCUMENTS: Record<string, string> = {
  'kabel-bom':
    'Der Inhalt hängt am Reserve-Aufschlag, den der Nutzer beim Export einstellt; ' +
    'dieser Prozentsatz steht nicht im Stempel.',
  // Bedarf 26 — was der Plan zwar erzeugt, aber nicht als EIN Dokument.
  //
  // Diese drei gibt es je GERAET: eine Label-Datei je Videohub, ein
  // Multiviewer-Layout je Mischer, eine Port-Karte je Switch. Das Register
  // fuehrt EINEN Stand je Bezeichner; ein gemeinsamer ergaebe einen Stand,
  // der beim zweiten Geraet nicht passt — schlimmer als keiner.
  //
  // Sie hier zu nennen ist der Punkt: bis hierher fehlten sie ganz, und
  // Verschweigen sieht in einer Impact-Liste aus wie „unberuehrt". Als
  // `unknown` sagen sie, was wahr ist — nachsehen muss ein Mensch. Wer sie
  // reproduzierbar machen will, braucht einen Bezeichner JE GERAET; das ist
  // ein eigener Schritt.
  'videohub-labels':
    'Es gibt eine Label-Datei je Videohub; das Register führt einen Stand je ' +
    'Bezeichner. Ein gemeinsamer Stand wäre beim zweiten Gerät falsch.',
  'atem-mv-layout':
    'Es gibt ein Multiviewer-Layout je Mischer, und die Fensterzahl ist eine ' +
    'Einstellung am Gerät, die nicht im Plan steht.',
  'switch-port-karte':
    'Es gibt eine Port-Karte je Switch; dieselbe Begründung wie bei den ' +
    'Videohub-Labels.',
  // Die Deckung haengt am LAGERBESTAND, und der steht nicht im Projekt: er
  // lebt projektuebergreifend im Lager-Store. Dieselbe Liste ergibt morgen
  // ein anderes Ergebnis, ohne dass sich am Plan etwas geaendert hat.
  stueckliste:
    'Der Inhalt hängt am Lagerbestand, der projektübergreifend lebt und nicht ' +
    'im Plan steht — dieselbe Liste ergibt morgen ein anderes Ergebnis.',
  // Bedarf 84 — die Grundlage der Übergabe. Der erste Wurf trug sie in
  // `DOCUMENT_STANDS`, und der Guard „keine Dokument-Ableitung hängt an der
  // Revisionsliste" hat das sofort gefangen — zu Recht: der Revisions-Vergleich
  // spannt einen Snapshot mit `revisions: []` auf, und ein revisions-abhängiger
  // Stand meldete danach JEDES Blatt als überholt, nur weil die Liste leer ist.
  // Eine erfundene Abweichung ist derselbe Schaden wie ein erfundener Zustand
  // (ADR-003). Dieselbe Begründung, aus der `buildHandoverManifest` seit jeher
  // draußen steht.
  'job-grundlage':
    'Der Zustand hängt an der Revisionsliste (As-Built). Der Revisions-Vergleich ' +
    'spannt Snapshots ohne diese Liste auf — ein Stand daraus meldete jedes Blatt ' +
    'als überholt, obwohl sich nichts geändert hat.',
}

/** Lesbarer Name eines Dokument-Bezeichners für Meldungen. */
export const DOCUMENT_LABELS: Record<string, string> = {
  plan: 'Plan',
  'pull-liste': 'Pull-Liste',
  'termination-liste': 'Termination-Liste',
  'kabel-schedule': 'Kabel-Schedule',
  'asset-register': 'Asset-Register',
  uebergabe: 'Übergabe-Dokument',
  'kabel-bom': 'Kabel-Stückliste',
  ausspielung: 'Ausspielung',
  ablaufblatt: 'Ablaufblatt',
  'tally-karte': 'Tally-Karte',
  ausspielweg: 'Ausspielweg',
  'ptp-plan': 'Zeit-Plan (PTP)',
  'crew-netz': 'Netz-Merkblatt (Crew)',
  'spektrum-plan': 'Spektrum-Plan',
  'multicast-plan': 'Multicast-Adressplan',
  'ausweich-plan': 'Ausweich-Plan (Sicherheitsnetz)',
  'job-grundlage': 'Grundlage der Übergabe',
  'videohub-labels': 'Videohub-Labels',
  'atem-mv-layout': 'Multiviewer-Layout',
  'switch-port-karte': 'Switch-Port-Karte',
  stueckliste: 'Stückliste',
}

/**
 * Der Stand, den `docId` heute hätte — oder `undefined`, wenn dieses Dokument
 * nicht reproduzierbar ist. `undefined` ist kein Fehler, sondern die Aussage
 * „das kann ich nicht ausrechnen"; der Aufrufer macht daraus ein `unknown`
 * statt einer Behauptung.
 */
export const currentStand = (
  docId: string,
  project: CablePlannerProject,
): string | undefined => DOCUMENT_STANDS[docId]?.(project)

/**
 * Sucht einen blossen Fingerabdruck in allen bekannten Dokumenten.
 *
 * Das ist der Rückweg ohne Kamera: auf dem Ausdruck steht `#a1b2c3d4` in der
 * Fussnote, jemand tippt die acht Zeichen ein, und die Antwort lautet „das ist
 * die Pull-Liste, und sie ist noch aktuell". Genau dafür sind es acht Zeichen
 * und kein SHA-256.
 */
export const findByStand = (
  stand: string,
  project: CablePlannerProject,
): { docId: string; label: string } | null => {
  const needle = stand.trim().replace(/^#/, '').toLowerCase()
  if (!/^[0-9a-f]{8}$/.test(needle)) return null
  for (const [docId, derive] of Object.entries(DOCUMENT_STANDS)) {
    if (derive(project).toLowerCase() === needle) {
      return { docId, label: DOCUMENT_LABELS[docId] ?? docId }
    }
  }
  return null
}
