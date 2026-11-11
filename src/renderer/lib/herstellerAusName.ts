// ───────────────────────────────────────────────────────────────────────────
// Hersteller und Modell aus einem Vorlagennamen.
//
// Die Vorlagen dieser App tragen nur einen Namen („Blackmagic ATEM Mini
// Pro"); die Geraetebibliothek fuehrt Hersteller und Modell getrennt — und
// erkennt daran dasselbe Geraet ueber alle Planner hinweg. Eine falsche
// Trennung legt also ein zweites Geraet an, statt die Ansicht an das
// vorhandene zu haengen. Deshalb eine Liste der Hersteller, deren Name aus
// mehr als einem Wort besteht oder im Katalog anders geschrieben ist als in
// der Bibliothek; sonst gilt das erste Wort.
//
// Keine Abhaengigkeiten ausser Typen: `scripts/library-publish.mjs` laedt
// diese Datei direkt in Node.
// ───────────────────────────────────────────────────────────────────────────

interface Regel {
  /** Wie der Name beginnt (ohne Beachtung der Gross-/Kleinschreibung). */
  praefix: string
  hersteller: string
  /** Der Praefix gehoert zum Modellnamen („UniFi Switch 24" ist ein Ubiquiti-Modell). */
  praefixImModell?: boolean
}

const REGELN: Regel[] = [
  { praefix: 'Blackmagic Design', hersteller: 'Blackmagic Design' },
  { praefix: 'Blackmagic', hersteller: 'Blackmagic Design' },
  // Zweiwortige Namen, die sonst am ersten Leerzeichen zerfallen. Gemessen
  // am 11.11.2026 gegen den multicam-Katalog: „Grass Valley LDX 100" wurde
  // zu Hersteller „Grass" und Modell „Valley LDX 100" — und damit zu einem
  // zweiten Geraet neben dem, das multicam unter „Grass Valley" einreicht.
  // Betroffen waren 11 Kameras von Grass Valley, 8 von Z CAM, 8 von OM
  // System, 3 von SLR Magic und eine von Phase One.
  { praefix: 'Grass Valley', hersteller: 'Grass Valley' },
  { praefix: 'Phase One', hersteller: 'Phase One' },
  { praefix: 'SLR Magic', hersteller: 'SLR Magic' },
  { praefix: 'OM System', hersteller: 'OM System' },
  { praefix: 'Z CAM', hersteller: 'Z CAM' },
  { praefix: 'Clay Paky', hersteller: 'Clay Paky' },
  // AVerMedia ist die Firma, AVer die Marke auf den Geraeten; die
  // Bibliothek fuehrt sie unter AVer (av-device-library `hersteller.ts`).
  { praefix: 'AVerMedia', hersteller: 'AVer' },
  // „Chauvet Professional" bleibt vollstaendig: Chauvet fuehrt daneben die
  // Linie „Chauvet DJ", und ein blosses „Chauvet" waere keines von beidem.
  { praefix: 'Chauvet Professional', hersteller: 'Chauvet Professional' },
  { praefix: 'Chauvet DJ', hersteller: 'Chauvet DJ' },
  { praefix: 'UniFi', hersteller: 'Ubiquiti', praefixImModell: true },
  { praefix: 'Allen & Heath', hersteller: 'Allen & Heath' },
  { praefix: 'Warm Audio', hersteller: 'Warm Audio' },
  { praefix: 'Austrian Audio', hersteller: 'Austrian Audio' },
  { praefix: 'Ross Video', hersteller: 'Ross Video' },
  { praefix: 'Lynx Technik', hersteller: 'Lynx Technik' },
  { praefix: 'sE Electronics', hersteller: 'sE Electronics' },
  { praefix: 'TC Electronics', hersteller: 'TC Electronic' },
  { praefix: 'TC Electronic', hersteller: 'TC Electronic' },
  { praefix: 'Jünger Audio', hersteller: 'Jünger Audio' },
  { praefix: 'GreenGo', hersteller: 'Green-GO' },
  { praefix: 'Green-GO', hersteller: 'Green-GO' },
  // Eigenbau: die Medien-Station stammt aus `larszu/pi-media-station`
  // (siehe Kopf von `mediaStationCatalog.ts`) — Hersteller ist die Firma.
  { praefix: 'LZ', hersteller: 'Lars Zumpe Medienproduktion', praefixImModell: true },
]

/**
 * Namen ohne Hersteller: passive Bauformen (B-52). Hier wird nichts
 * geraten — das erste Wort („Patch", „Power") waere als Hersteller eine
 * Erfindung, und die Bibliothek fuehrte es danach als solchen.
 */
const OHNE_HERSTELLER = ['Patch', 'Feed-through', 'Power', 'Powerlock', 'Distro', 'IEC']

const beginntMit = (name: string, praefix: string) =>
  name.toLowerCase().startsWith(praefix.toLowerCase()) &&
  (name.length === praefix.length || name[praefix.length] === ' ')

/** `manufacturer: ''` heisst: nicht zu bestimmen, der Nutzer muss ihn nennen. */
export function herstellerAusName(name: string): { manufacturer: string; model: string } {
  const s = name.trim().replace(/\s+/g, ' ')
  if (OHNE_HERSTELLER.some((p) => beginntMit(s, p))) return { manufacturer: '', model: s }
  const regel = [...REGELN].sort((a, b) => b.praefix.length - a.praefix.length).find((r) => beginntMit(s, r.praefix))
  if (regel) {
    const rest = s.slice(regel.praefix.length).trim()
    return { manufacturer: regel.hersteller, model: regel.praefixImModell ? s : rest }
  }
  const i = s.indexOf(' ')
  if (i < 0) return { manufacturer: '', model: s }
  return { manufacturer: s.slice(0, i), model: s.slice(i + 1) }
}
