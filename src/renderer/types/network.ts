// ───────────────────────────────────────────────────────────────────────────
// Netzwerk-Schnittstellen je Geraet (Bedarf 19) und ihre Lage am Switch
// (Bedarf 24). Beide P1.
//
// WARUM DAS EIN EIGENES OBJEKT IST. Die Bedarfs-Datenbank beschreibt das
// Problem und warnt gleichzeitig vor dem Zeitpunkt:
//
//   > Spreadsheet IP plans have one IP column per device. Real AV devices have
//   > 2-4 NICs: Dante primary/secondary, 2110 red/blue media plus separate
//   > control, camera control vs tally vs media. Engineers work around it with
//   > extra columns or extra rows, and the two halves drift apart.
//   > … Getting this wrong at schema level is expensive to fix later.
//
// Belegt an SSL (Dante-Sekundaernetz) und Arista (ST 2110 rot/blau). Der Plan
// hatte genau die eine Spalte, ueber die sich die Quelle beschwert:
// `EquipmentItem.ipAddress`.
//
// ─── DIE EINE REGEL, DIE MAN KENNEN MUSS ───────────────────────────────────
//
// **Die Alt-Felder am Geraet SIND Schnittstelle 0.** `ipAddress`,
// `subnetMask`, `gateway` und `macAddress` bleiben, wo sie sind, und
// `networkInterfaces` haelt die Schnittstellen 1..n. Es gibt also weiterhin
// genau EIN Zuhause je Adresse — keine Spiegelung, keine zweite Wahrheit.
//
// Warum nicht alles umziehen: `ipAddress` steht an 95 Stellen in 36 Dateien,
// dazu 39-mal `subnetMask` und 49-mal VLAN-Bezuege. Ein Umzug in einem Schritt
// waere ein Umbau quer durch Import, Export, Analyse, NetBox, GraphML, Rentman,
// Mobile und Viewer — und jede uebersehene Stelle liest danach still `undefined`
// statt einer Adresse. Der cable-planner hat fuer genau diese Lage eine
// Bauform, die sich bewaehrt hat (ADR-001, Inkrement 2): eine **Engstelle**
// hochziehen, durch die alle gehen, statt 95 Aufrufer gleichzeitig anzufassen.
// Diese Engstelle ist `lib/networkInterfaces.ts#deviceInterfaces`.
//
// ─── WAS HIER BEWUSST NICHT STEHT ──────────────────────────────────────────
//
// Ein Weg, Konfiguration auf einen laufenden Switch zu schreiben. Die
// Bedarfs-Datenbank sagt es fuer Bedarf 24 ausdruecklich: „Do NOT push config
// to live switches — generating a paste-able description block is the
// defensible" Weg. Der Plan erzeugt die Beschriftung; wer sie einspielt, ist
// ein Mensch mit einer Konsole.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Wofuer eine Schnittstelle da ist.
 *
 * Genau die vier aus der Bedarfs-Datenbank („role: media-primary |
 * media-secondary | control | management"), plus `unspecified` fuer den
 * ehrlichen Fall: ein Altbestand-Geraet mit einer IP sagt nicht, wofuer sie
 * ist, und eine geratene Rolle waere schlimmer als keine — sie erschiene in
 * jeder Liste als Aussage.
 */
export type NetworkInterfaceRole =
  | 'media-primary'
  | 'media-secondary'
  | 'control'
  | 'management'
  | 'unspecified'

export const NETWORK_INTERFACE_ROLES: ReadonlyArray<NetworkInterfaceRole> = [
  'media-primary',
  'media-secondary',
  'control',
  'management',
  'unspecified',
]

export interface NetworkInterface {
  id: string
  /** Beschriftung am Geraet („NET 1", „Dante Sec", „SFP+ 2"). */
  label?: string
  role: NetworkInterfaceRole
  ipAddress?: string
  subnetMask?: string
  gateway?: string
  macAddress?: string
  /** VLAN-Id, in der die Schnittstelle liegt. */
  vlanId?: number
  /**
   * Der Switch, an dem sie haengt — als Geraete-Id im selben Plan, nicht als
   * Name. Ein Name veraltet beim Umbenennen; die Id nicht. Ist der Switch
   * geloescht, raeumt die Normalisierung den Zeiger weg, statt ihn stehen zu
   * lassen: ein Fehlzeiger sieht in der Port-Karte aus wie eine Belegung.
   */
  switchEquipmentId?: string
  /** Port-Bezeichnung am Switch, wie sie dort aufgedruckt ist („1/0/12"). */
  switchPort?: string
  /**
   * Der Port am EIGENEN Geraet, ueber den diese Schnittstelle laeuft — als
   * `Port.id`. Damit haengt die Schnittstelle am Kabelgraphen und nicht daneben:
   * genau das verlangt Bedarf 24 („Model switch, port, and the cable that
   * occupies it as part of the same connection graph").
   */
  portId?: string
}

/** Ist an dieser Schnittstelle ueberhaupt etwas eingetragen? Eine leere
 *  Schnittstelle ist kein Befund, sondern ein leeres Formular. */
export const interfaceIsEmpty = (n: NetworkInterface): boolean =>
  !n.ipAddress && !n.subnetMask && !n.gateway && !n.macAddress &&
  n.vlanId === undefined && !n.switchEquipmentId && !n.switchPort
