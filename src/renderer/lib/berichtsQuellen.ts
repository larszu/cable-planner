// ───────────────────────────────────────────────────────────────────────────
// Welche Listen es gibt (#880).
//
// ─── WARUM DIESE LISTE HIER STEHT UND NICHT IN EINER ANSICHT ───────────────
//
// Sie stand in `components/Export/PacketSection.tsx`, weil dort der
// Papierstapel zusammengeklickt wird. Mit dem Berichts-Editor gibt es einen
// ZWEITEN Ort, der dieselbe Frage stellt — „welche Listen kann dieses
// Programm ausgeben?" —, und zwei Abschriften derselben Antwort laufen beim
// naechsten Hinzufuegen auseinander: die neue Liste stuende im Stapel und
// fehlte im Editor, oder umgekehrt, und zwar lautlos.
//
// Die Beschriftung bleibt dabei die Quelle (englisch, E-28); uebersetzt wird
// sie an der Aufrufstelle ueber `packet.sheet.<id>` — derselbe Schluessel wie
// bisher, damit die vorhandenen Uebersetzungen weitergelten.
// ───────────────────────────────────────────────────────────────────────────
import { pullListTable, terminationListTable, cableScheduleTable } from './installerLists'
import { assetRegisterTable } from './assetRegister'
import { crewSheetTableForProject } from './crewNetworkSheet'
import { spectrumTableForProject } from './spectrumPlan'
import { deliveryTableForProject } from './deliveryParity'
import { tallyMapTableForProject } from './tallyMap'
import { handoverManifestTableForProject } from './postHandover'
import { frontplattenTable } from './frontplattenListe'
import { signalwegeTable } from './signalwegListe'
import { hausStreckenTable } from './hausStrecken'
import type { CsvTable } from './csv'
import type { CablePlannerProject } from '../types/project'

export interface BerichtsQuelle {
  id: string
  /** Quellsprachige Beschriftung; uebersetzt via `packet.sheet.<id>`. */
  label: string
  table: (p: CablePlannerProject) => CsvTable
}

export const BERICHTS_QUELLEN: ReadonlyArray<BerichtsQuelle> = [
  { id: 'pull-liste', label: 'Pull list', table: pullListTable },
  { id: 'termination-liste', label: 'Termination list', table: terminationListTable },
  { id: 'kabel-schedule', label: 'Cable schedule', table: cableScheduleTable },
  { id: 'asset-register', label: 'Asset register', table: assetRegisterTable },
  { id: 'crew-netz', label: 'Network sheet', table: crewSheetTableForProject },
  { id: 'spektrum-plan', label: 'Spectrum plan', table: spectrumTableForProject },
  { id: 'ausspielung', label: 'Delivery', table: deliveryTableForProject },
  { id: 'tally-karte', label: 'Tally map', table: tallyMapTableForProject },
  // Bedarf 62 — das Blatt, mit dem die Post die Karten wiederfindet.
  { id: 'post-uebergabe', label: 'Handover to post', table: handoverManifestTableForProject },
  // #879 — die Bohrliste. Sie geht durch denselben Editor wie jede andere
  // Liste; eine eigene Ansicht waere eine zweite Fassung derselben Tabelle.
  { id: 'frontplatten', label: 'Faceplates', table: frontplattenTable },
  { id: 'signalwege', label: 'Signal paths', table: signalwegeTable },
  { id: 'hausstrecken', label: 'House run occupancy', table: hausStreckenTable },
]

export const quelleNach = (id: string): BerichtsQuelle | undefined =>
  BERICHTS_QUELLEN.find((q) => q.id === id)
