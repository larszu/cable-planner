/**
 * Festinstallation / mitwachsende Doku — Lebenszyklus-Typen.
 *
 * Cable-Planner war ursprünglich auf den Show-Lebenszyklus zugeschnitten
 * (planen → aufbauen → abbauen). Für dauerhafte Festinstallationen ist der
 * Plan ein *lebendes Dokument*, das jede Move/Add/Change (MAC) überlebt.
 * Diese Typen tragen den Betriebs-Status, Mess-/Service-Historie und ein
 * attribuiertes Änderungsprotokoll. Alle Felder sind optional bzw. werden
 * beim Laden geheilt — alte Projekte bleiben gültig.
 */

/** Betriebs-Status eines Kabels/Geräts über den reinen "gebaut?"-Status hinaus. */
export type InstallStatus =
  | 'planned'
  | 'installed'
  | 'tested'
  | 'operational'
  | 'fault'
  | 'retired'

/** Anzeige-Reihenfolge der Status. */
export const INSTALL_STATUSES: InstallStatus[] = [
  'planned',
  'installed',
  'tested',
  'operational',
  'fault',
  'retired',
]

/** Deutsche Default-Labels (UI heilt EN über i18n nach). */
export const INSTALL_STATUS_LABEL: Record<InstallStatus, string> = {
  planned: 'Geplant',
  installed: 'Installiert',
  tested: 'Getestet',
  operational: 'In Betrieb',
  fault: 'Störung',
  retired: 'Außer Betrieb',
}

/**
 * Mess-/Zertifikats-Ergebnis einer Kabelstrecke (TIA-568/1152 Kupfer,
 * OLTS/OTDR Glas). Reicht als Garantie-/Abnahme-Nachweis (CABL/DOC in
 * AVIXA 10:2013).
 */
export interface CableTestResult {
  result: 'pass' | 'fail'
  /** Test-Standard / Limit, z.B. "TIA Cat 6A Perm. Link", "OLTS OM4". */
  standard?: string
  /** Worst-Case-Marge in dB. */
  marginDb?: number
  /** ISO-Datum des Tests. */
  testedAt?: string
  /** Prüfer. */
  testedBy?: string
  /** Referenz auf die Zertifikats-Datei (Fluke/LinkWare-Report etc.). */
  reportRef?: string
}

/** Einzelner Service-/Wartungs-Eintrag an einem Gerät. */
export interface ServiceRecord {
  id: string
  /** ISO-Datum. */
  date: string
  author: string
  kind: 'install' | 'inspection' | 'repair' | 'replacement' | 'note'
  summary: string
}

/** Art einer Änderung im Projekt-Änderungsprotokoll. */
export type ChangeLogKind =
  | 'add'
  | 'change'
  | 'move'
  | 'remove'
  | 'service'
  | 'status'
  | 'commission'

/**
 * Ein attribuierter Änderungs-Eintrag (MAC/IMACD). Macht aus dem Plan ein
 * nachvollziehbares lebendes Dokument: wer hat was wann geändert.
 */
export interface ChangeLogEntry {
  id: string
  /** ISO-Zeitstempel. */
  ts: string
  author: string
  kind: ChangeLogKind
  /** Worauf sich die Änderung bezieht (zur Navigation/Filterung). */
  target?: {
    type: 'cable' | 'equipment' | 'location' | 'project'
    id?: string
    name?: string
  }
  /** Kurze, menschenlesbare Zusammenfassung. */
  summary: string
}

/** Art einer Feld-Rückmeldung (vom Mobile-/Viewer-Light-Editor). */
export type PendingChangeKind = 'cable-edit' | 'equipment-edit' | 'issue' | 'note'

/**
 * Feld-Rückkanal: eine vom Mobile-Companion (oder Viewer) gemeldete, noch
 * NICHT angewandte Änderung. Der Techniker vor Ort korrigiert z.B. eine
 * Kabellänge oder meldet ein Problem; das landet als „pending" im Plan und
 * der Planer am Desktop übernimmt oder verwirft es. Beim Übernehmen wird der
 * `patch` auf das Ziel gemerged und ein `ChangeLogEntry` geschrieben — so
 * fließt Feldwissen kontrolliert ins lebende Dokument.
 */
export interface PendingChange {
  id: string
  /** ISO-Zeitstempel der Meldung. */
  ts: string
  /** Name des Melders (vor Ort), Fallback „Feld". */
  author: string
  /** Woher die Meldung kam. */
  source: 'mobile' | 'viewer' | 'desktop'
  kind: PendingChangeKind
  /** Worauf sich die Meldung bezieht (zum Anwenden + Navigieren). */
  target?: {
    type: 'cable' | 'equipment'
    id?: string
    name?: string
  }
  /** Menschenlesbare Zusammenfassung (wird im Review angezeigt). */
  summary: string
  /** Optionaler Feld-Patch, der beim Übernehmen auf das Ziel gemerged wird
   *  (nur whitelistete Felder werden tatsächlich angewandt). */
  patch?: Record<string, unknown>
}
