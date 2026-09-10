// ───────────────────────────────────────────────────────────────────────────
// B-52 TEIL 1 — die passiven Port-Traeger. Generische FORMEN, keine Produkte.
//
// ─── WARUM SIE EIN EIGENES MODUL BEKOMMEN ──────────────────────────────────
//
// Jedes andere Katalog-Modul dieses Repos ist ein HERSTELLER-Katalog: jeder
// Eintrag traegt eine `manufacturerUrl` und eine gemuenzte `deviceTypeId`,
// und die Hausregel im Kopf von `broadcastToolsCatalog.ts` lautet „KEINE
// erfundenen Ports — unsichere Geraete wurden nicht aufgenommen".
//
// Eine 6-fach-Steckdosenleiste ist aber kein Produkt mit Datenblatt, sondern
// eine Form. Sie in einen Hersteller-Katalog zu legen hiesse, ihr eine Quelle
// anzudichten, die es nicht gibt — und die Regel dort auszuhoehlen, indem der
// erste Eintrag ohne Beleg danebensteht. Deshalb hier, mit dem Unterschied im
// Kopf: **keine `manufacturerUrl`, keine Produkt-`deviceTypeId`.** Was hier
// steht, behauptet keine Herstellerangabe, sondern nur eine Bauform.
//
// ─── DER BEFUND, DER DAZU FUEHRTE ──────────────────────────────────────────
//
// Nutzer-Frage vom 2026-09-08: „es gibt noch keinen guten weg um
// stromverteiler in den plan einzuzeichnen und auch noch keine patchblenden
// und durchgangsbuchsen und keine mehrfachsteckdosen. sollten das geraete
// sein?"
//
// Nachgesehen — und der wichtigste Befund war eine Korrektur der Frage:
// Patchblenden GIBT ES (`isPatchPanel`, `lib/patchPanel.ts`, Issue #664).
// Nur legt sie ausschliesslich der Rack-Builder an
// (`components/Rack/PatchPanelCreateDialog.tsx`); der andere Weg ist, irgendein
// Geraet anzulegen und in den Eigenschaften ein Haekchen zu setzen. Wer auf
// dem Canvas plant und den Rack-Builder nie oeffnet, begegnet ihr nie. Kein
// Modell-Problem, ein Auffindbarkeits-Problem.
//
// Deshalb ist die Patchblende hier KEIN Neubau, sondern ein zweiter WEG zu
// demselben Ding: dasselbe Flag, dieselbe Ableitung in `patchPanel.ts`. Eine
// dritte Stelle, die eigene Patchblenden-Geraete erzeugt, waere
// `zwei-rechnungen`.
//
// ─── WARUM ES GERAETE SIND UND KEINE EIGENE OBJEKTART ──────────────────────
//
// Weil jede Rechnung dieser Anwendung an einem PORT AM GERAET beginnt:
// Kabelwege, Kommissionierliste, Patchliste, Adressplan, Laengen,
// Rack-Layout. Eine Steckdosenleiste ist genau „ein Eingang, n Ausgaenge";
// ein Verteiler dasselbe plus Absicherung je Abgang. Dass sie passiv sind,
// spricht nicht dagegen — die Patchblende ist es auch, und ihre Durchleitung
// wird aus der Bauart abgeleitet statt geschaltet.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Die Blindblende ohne Buchsen. Sie ist Rack-Geometrie und kein Knoten im
// Signalfluss; als Geraet gefuehrt fuellte sie den Plan mit etwas, das nichts
// verbindet.
//
// Und keine abgeleitete Absicherung. `absicherungA` steht nur dort, wo die
// Bauform sie festlegt — bei den Abgaengen eines Verteilers. Sie aus dem
// Steckertyp zu erschliessen („CEE16 also 16 A") waere ein Namensabgleich
// fuer eine folgenreiche Aussage (ADR-002): die Buchse sagt, was hineinpasst,
// nicht was davor haengt.
// ───────────────────────────────────────────────────────────────────────────
import type { ConnectorType, EquipmentTemplate, Port } from '../types/equipment'

const ports = (
  base: string,
  n: number,
  connectorType: ConnectorType,
  extra: Partial<Port> = {},
): Port[] =>
  Array.from({ length: n }, (_, i) => ({
    id: '',
    name: n === 1 ? base : `${base} ${i + 1}`,
    type: connectorType,
    connectorType,
    ...extra,
  }))

/**
 * Eine Patchblende: n Buchsen hinten, n vorn, positionsweise durchverbunden.
 *
 * `isPatchPanel` ist dasselbe Flag, das der Rack-Builder setzt — damit greift
 * `lib/patchPanel.ts` unveraendert, und die Kette bricht an dieser Blende
 * genauso wenig wie an einer aus dem Rack.
 */
const blende = (name: string, n: number, connectorType: ConnectorType): EquipmentTemplate => ({
  name,
  category: 'Patch panels',
  isPatchPanel: true,
  width: 240,
  height: 80,
  inputs: ports('Rückseite', n, connectorType),
  outputs: ports('Frontseite', n, connectorType),
})

/** Eine Durchgangsbuchse: die Blende der Groesse 1. */
const durchgang = (name: string, connectorType: ConnectorType): EquipmentTemplate =>
  blende(name, 1, connectorType)

/** Eine Steckdosenleiste: ein Eingang, n Ausgaenge, keine Absicherung je Abgang. */
const leiste = (
  name: string,
  n: number,
  ein: ConnectorType,
  aus: ConnectorType,
): EquipmentTemplate => ({
  name,
  category: 'Power distribution',
  width: 240,
  height: 80,
  inputs: ports('Einspeisung', 1, ein),
  outputs: ports('Abgang', n, aus),
})

/**
 * Ein Verteiler: eine Einspeisung, mehrere abgesicherte Abgangsgruppen.
 *
 * Die Absicherung steht je Abgang und ist ANGEGEBEN — sie gehoert zur
 * Bauform des Verteilers, anders als bei der Leiste, wo davor nur der
 * Hausanschluss liegt.
 */
const verteiler = (
  name: string,
  ein: ConnectorType,
  abgaenge: { name: string; n: number; connectorType: ConnectorType; absicherungA: number }[],
): EquipmentTemplate => ({
  name,
  category: 'Power distribution',
  width: 240,
  height: 80,
  inputs: ports('Einspeisung', 1, ein),
  outputs: abgaenge.flatMap((a) =>
    ports(a.name, a.n, a.connectorType, { absicherungA: a.absicherungA }),
  ),
})

export const passiveTemplates: EquipmentTemplate[] = [
  blende('Patch panel 12x BNC', 12, 'BNC'),
  blende('Patch panel 24x BNC', 24, 'BNC'),
  blende('Patch panel 48x BNC', 48, 'BNC'),
  blende('Patch panel 24x RJ45', 24, 'Ethernet/RJ45'),
  blende('Patch panel 24x XLR', 24, 'XLR'),

  durchgang('Feed-through BNC', 'BNC'),
  durchgang('Feed-through XLR', 'XLR'),
  durchgang('Feed-through RJ45', 'Ethernet/RJ45'),

  leiste('Steckdosenleiste 6-fach', 6, 'Schuko 230V', 'Schuko 230V'),
  leiste('Steckdosenleiste 8-fach', 8, 'Schuko 230V', 'Schuko 230V'),
  leiste('IEC-Leiste 8-fach', 8, 'IEC 230V', 'IEC 230V'),

  verteiler('Distro CEE32', 'CEE32', [
    { name: 'Schuko', n: 6, connectorType: 'Schuko 230V', absicherungA: 16 },
    { name: 'CEE16', n: 2, connectorType: 'CEE16', absicherungA: 16 },
  ]),
  verteiler('Distro CEE63', 'CEE63', [
    { name: 'CEE32', n: 2, connectorType: 'CEE32', absicherungA: 32 },
    { name: 'CEE16', n: 4, connectorType: 'CEE16', absicherungA: 16 },
    { name: 'Schuko', n: 6, connectorType: 'Schuko 230V', absicherungA: 16 },
  ]),
]
