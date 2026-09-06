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
