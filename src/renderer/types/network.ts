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

// ───────────────────────────────────────────────────────────────────────────
// BEDARF 73 — die Zeit. „First-class timing/PTP fields in the plan."
//
//   > PTP domain number, grandmaster and boundary-clock topology live
//   > nowhere. No Excel network-documentation template in the German or
//   > English source set has a column for them.
//
// Und der Schaden steht in derselben Zeile, mit Zahlen:
//
//   > ST 2059-2 defaults to domain 127 while AES67 commonly uses domain 0,
//   > so mixed 2110/AES67 rigs receive packets with wrong media clocks.
//
// Das ist die Sorte Regel, gegen die ein Mensch blind verstoesst und die ein
// Werkzeug umsonst durchsetzt — dieselbe Bauform wie der IGMP-Widerspruch in
// `venueNetworkRequest` (Bedarf 23), und aus demselben Grund hier: der Plan
// weiss, welche Essenz ueber welches Geraet laeuft, also kann er die Frage
// stellen. Beantworten kann er sie nicht, und er tut es auch nicht.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Das PTP-Profil, unter dem eine Schnittstelle laeuft.
 *
 * `unspecified` ist der ehrliche Normalfall und KEIN Fehler: ein Geraet, das
 * niemand angefasst hat, sagt nicht, in welchem Profil es steht. Es zu raten
 * waere hier besonders teuer — die beiden Profile setzen VERSCHIEDENE
 * Vorgabe-Domaenen (127 gegen 0), und wer das falsch raet, erzeugt genau den
 * Widerspruch, den diese Felder aufdecken sollen.
 */
export type PtpProfile =
  /** SMPTE ST 2059-2 — Vorgabe-Domaene 127. */
  | 'st2059-2'
  /** AES67 (Media Profile) — in der Praxis Domaene 0. */
  | 'aes67'
  /** IEEE 1588 Default Profile. */
  | 'default'
  | 'unspecified'

export const PTP_PROFILES: ReadonlyArray<PtpProfile> = [
  'st2059-2',
  'aes67',
  'default',
  'unspecified',
]

/**
 * Die Vorgabe-Domaene je Profil — als BELEG, nicht als Vorbelegung.
 *
 * Nichts in dieser Anwendung setzt daraus eine Domaene an ein Geraet. Die
 * Zahl steht hier, damit ein Befund sie NENNEN kann („Profil ST 2059-2, aber
 * Domaene 0 — die Vorgabe des Profils ist 127"), und der Leser sieht, woher
 * die Erwartung kommt. Eine stille Vorbelegung waere eine Behauptung ueber
 * ein Geraet, das niemand befragt hat.
 */
export const PTP_PROFILE_DEFAULT_DOMAIN: Readonly<Record<PtpProfile, number | null>> = {
  'st2059-2': 127,
  aes67: 0,
  default: 0,
  unspecified: null,
}

/**
 * Die Rolle im Zeit-Baum.
 *
 * `boundary` ist eigens dabei, weil der Bedarf die TOPOLOGIE nennt und nicht
 * nur die Zahl: ein Boundary-Clock-Switch trennt zwei Domaenen und ist damit
 * die Antwort auf den Widerspruch, den diese Felder aufdecken. Ohne ihn im
 * Modell saehe jeder gemischte Aufbau nach Fehler aus, auch der richtig
 * gebaute.
 */
export type PtpRole = 'grandmaster' | 'boundary' | 'slave' | 'unspecified'

export const PTP_ROLES: ReadonlyArray<PtpRole> = [
  'grandmaster',
  'boundary',
  'slave',
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
   * BEDARF 73 — die PTP-Domaene, in der diese Schnittstelle laeuft.
   *
   * An der SCHNITTSTELLE und nicht am Geraet: ein redundanter 2110-Aufbau
   * faehrt rot und blau bewusst in getrennten Domaenen, und ein Geraet mit
   * einer Steuer-NIC im Haus-Netz hat dort ueberhaupt keine. Ein Feld am
   * Geraet muesste sich fuer eine davon entscheiden.
   */
  ptpDomain?: number
  ptpProfile?: PtpProfile
  ptpRole?: PtpRole
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
  n.vlanId === undefined && !n.switchEquipmentId && !n.switchPort &&
  // BEDARF 73: die PTP-Felder zaehlen mit. Ohne sie waere eine Schnittstelle,
  // an der jemand NUR die Domaene eingetragen hat, „leer" — und `deviceInterfaces`
  // wirft leere Schnittstellen weg. Die Eingabe waere beim naechsten Laden
  // verschwunden, ohne dass irgendwo etwas steht.
  n.ptpDomain === undefined && !n.ptpProfile && !n.ptpRole &&
  // BEDARF 72: die ROLLE zaehlt genauso mit, und aus demselben Grund.
  // Aufgefallen beim Multicast-Adressplan, der das zweite 2022-7-Bein aus
  // `media-primary` PLUS `media-secondary` ableitet: waehrend der Planung hat
  // noch keine der beiden Karten eine Adresse — es steht nur die Rolle da.
  // Ohne diese Zeile war so eine Schnittstelle „leer", `deviceInterfaces`
  // warf sie weg und `normaliseNetworkInterface` gab `null` zurueck. Das
  // Sekundaernetz war beim naechsten Laden verschwunden, und der Adressplan
  // haette anschliessend behauptet, dieser Fluss brauche nur EIN Bein.
  //
  // `unspecified` zaehlt NICHT mit: das ist die Abwesenheit einer Angabe, und
  // Schnittstelle 0 traegt sie immer. Wuerde sie mitzaehlen, waere nie eine
  // Schnittstelle leer und jedes Geraet bekaeme eine erfundene NIC 0.
  (!n.role || n.role === 'unspecified')
