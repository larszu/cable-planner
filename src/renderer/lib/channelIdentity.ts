// ───────────────────────────────────────────────────────────────────────────
// Wem eine Spalte gehört, und welcher Name gilt (Bedarfe 110, 111, 113; P3).
//
// Drei Belege, ein Mechanismus. Alle drei sind mit „minutes" beziffert und
// deshalb leicht zu übersehen — und alle drei kosten genau dann Zeit, wenn
// niemand mehr Zeit hat: beim Aufbau, vor fremdem Publikum, mit dem Rider in
// der Hand.
//
// ─── BEDARF 110 — ZWEI EIGENTÜMER, ZWEI SPALTEN ────────────────────────────
//
//   > A single column headed 'Quelle / Mikrofon' conflates venue
//   > infrastructure with band equipment. Importing a WING snapshot writes
//   > stagebox inputs into the microphone column, DESTROYING manually entered
//   > mic info.
//
// (`computi71/bandregie#81`, als Fehler gemeldet: der Stagebox-Eingang
// „A1/A2" gehört dem Haus und steht in der Pult-Datei; das Mikrofon „SM57,
// DI, Kondensator" gehört der Band und steht in KEINER Pult-Datei. „A rider
// needs both.")
//
// Dieser Planer hat die beiden Angaben strukturell schon getrennt — die
// Quelle ist ein Gerät im Plan, der Ziel-Port hängt am Kabel. Was fehlte, ist
// die AUSSAGE, welche Spalte wem gehört. Ohne sie ist die Trennung ein
// Zufall der Datenherkunft und kein Versprechen: der Nächste, der einen
// Import baut, sieht zwei Textspalten und keine Regel.
//
// `columnOwner` schreibt die Regel hin, und `IMPORTABLE_FIELDS` sagt, was ein
// Import überhaupt anfassen darf. Das ist der Satz aus dem Beleg —
// „import must populate only the input field" — als Datum statt als Vorsatz.
//
// ─── BEDARF 111 — DIE NUMMER, DIE DRAUSSEN ETWAS BEDEUTET ──────────────────
//
//   > The port is 'where the signal is plugged in' and 'the only number that
//   > means anything on their console'; the channel number is internal to the
//   > band and meaningless to venue staff; SHOWING BOTH IMPLIES BOTH MATTER.
//
// (`computi71/bandregie#82`.) Die Haus-Sicht führte bis hierher beide
// Nummern nebeneinander. Das ist keine Vollständigkeit, sondern eine
// Aufforderung: wer zwei Nummern sieht, gleicht sie ab. Die Haus-Sicht führt
// ab jetzt den PORT; die interne Kanalnummer erscheint dort nur, wo es keinen
// Port gibt — und dann BENANNT („Ch 7 (kein Port)"), damit sie nicht wie
// einer aussieht.
//
// ─── BEDARF 113 — EIN NAME, EINMAL ENTSCHIEDEN ─────────────────────────────
//
//   > Dante naming weirdness means that channel names are always 01, 02 etc.,
//   > friendly names are e.g. 'Broadcast L' / 'Broadcast R'. Dante Controller
//   > shows green checkmarks but CANNOT IDENTIFY the targeted channels.
//
// (`chris-ritsen/network-audio-controller#11`.) Eine Kanalnummer ist kein
// Name. Sie sieht aus wie einer, sie steht an derselben Stelle, und sie sagt
// nichts — weder am Pult noch im Multitrack noch auf dem Etikett. Wo sie als
// Name auftritt, ist der Name in Wahrheit verloren gegangen.
//
// `channelName` ist die eine Stelle, die das entscheidet, und `isBareNumber`
// die Prüfung, die es erkennt. Die Antwort der Bedarfs-Datenbank sagt es als
// Bauanweisung: „Naming is the join key across the whole audio chain."
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { ChannelRow } from './channelList'
import type { CsvCell, CsvTable } from './csv'

// ── Bedarf 110 — wem gehört welche Spalte ──────────────────────────────────

/**
 * Wer eine Angabe verantwortet.
 *
 * `venue`  Das Haus. Steht in der Pult-/Stagebox-Welt und kommt aus einem
 *          Import oder vom Haustechniker.
 * `band`   Die Band. Steht in keiner Pult-Datei und wird von Hand gepflegt —
 *          deshalb ist sie das, was ein Import zerstören kann.
 * `plan`   Dieser Planer selbst (laufende Nummer, Kabellänge, Position).
 */
export type ColumnOwner = 'venue' | 'band' | 'plan'

/**
 * Wem welches Feld einer Kanalzeile gehört.
 *
 * Vollständig über `ChannelRow` — ein neues Feld ohne Eintrag hier fällt im
 * Test auf. Genau das ist der Zweck: die Frage „darf ein Import das
 * überschreiben" muss bei JEDEM Feld beantwortet sein, nicht bei denen, an
 * die jemand gedacht hat.
 */
export const COLUMN_OWNER: Readonly<Record<keyof ChannelRow, ColumnOwner>> = {
  ch: 'plan',
  cableId: 'plan',
  // Die Quelle IST das Mikrofon/die DI — Equipment der Band.
  source: 'band',
  sourceKind: 'band',
  sourcePort: 'band',
  // Ziel und Ziel-Port sind Stagebox/Pult — Infrastruktur des Hauses.
  destination: 'venue',
  destinationPort: 'venue',
  connector: 'band',
  lengthM: 'plan',
  x: 'plan',
  y: 'plan',
}

export const columnOwner = (feld: keyof ChannelRow): ColumnOwner => COLUMN_OWNER[feld]

/**
 * Was ein Import überhaupt schreiben darf.
 *
 * Der Beleg zu Bedarf 110 ist ein FEHLERBERICHT: ein Import hat die von Hand
 * gepflegte Mikrofon-Angabe mit einem Stagebox-Eingang überschrieben. Diese
 * Liste ist die Antwort darauf, und sie ist bewusst eine Erlaubnis-Liste und
 * keine Verbots-Liste: was hier nicht steht, darf nicht geschrieben werden,
 * auch wenn es später dazukommt.
 */
export const IMPORTABLE_FIELDS: ReadonlyArray<keyof ChannelRow> = ['destination', 'destinationPort']

/** Ob ein Import dieses Feld schreiben darf. */
export const mayImportWrite = (feld: keyof ChannelRow): boolean =>
  IMPORTABLE_FIELDS.includes(feld)

/**
 * Einen Import auf die erlaubten Felder beschneiden.
 *
 * Die Engstelle für jeden Weg, der von aussen in eine Kanalzeile schreibt.
 * Sie wirft nicht und meldet nicht — sie lässt weg, und was sie weggelassen
 * hat, steht in `refused`, damit der Aufrufer es sagen kann statt es zu
 * verschweigen.
 *
 * HEUTE HAT SIE KEINEN AUFRUFER, und das ist kein Versehen: die beiden
 * Import-Wege dieser Anwendung — die Szenendatei des Pults (Bedarf 92) und
 * die Dante-Matrix (Bedarf 94) — sind ausdrücklich LESER und schreiben nicht
 * in den Plan zurück. Sie steht trotzdem hier, weil die Bedarfs-Datenbank
 * genau das verlangt: „Cheap schema decision to take NOW". Der gemeldete
 * Fehler entstand nicht dadurch, dass jemand die Regel gebrochen hätte,
 * sondern dadurch, dass es keine gab, als der erste Import gebaut wurde.
 *
 * `tests/channelIdentity.test.ts` hält beides fest: dass die Leser heute
 * nicht schreiben, und dass der erste Schreiber hier durchmuss.
 */
export interface ImportPatchResult {
  patch: Partial<ChannelRow>
  refused: Array<keyof ChannelRow>
}

export function limitImportPatch(patch: Partial<ChannelRow>): ImportPatchResult {
  const out: Partial<ChannelRow> = {}
  const refused: Array<keyof ChannelRow> = []
  for (const key of Object.keys(patch) as Array<keyof ChannelRow>) {
    if (mayImportWrite(key)) (out as Record<string, unknown>)[key] = patch[key]
    else refused.push(key)
  }
  return { patch: out, refused }
}

// ── Bedarf 113 — ein Name, einmal entschieden ──────────────────────────────

/** Was dasteht, wo gar kein Name ist. */
export const NO_NAME = 'unbenannt'

/**
 * Ob eine Zeichenfolge nur eine Nummer ist — mit oder ohne führende Null,
 * mit oder ohne „Ch"/„CH"/„Kanal" davor.
 *
 * „01" ist der Dante-Fall aus dem Beleg. „Ch 7" ist derselbe Fehler mit
 * Vorsatz: beides sieht an der Stelle eines Namens aus wie einer und sagt
 * nichts, was nicht schon in der Kanalnummer stünde.
 */
export function isBareNumber(text: string | undefined): boolean {
  const t = (text ?? '').trim()
  if (!t) return false
  return /^(?:ch|kanal|in|input)?[\s.:-]*\d{1,3}$/i.test(t)
}

/**
 * Der EINE Name eines Kanals — für Pult, Etikett, Dante und Multitrack.
 *
 * Reihenfolge: der Name der Quelle, wenn er einer ist; sonst die Art
 * („Kondensator", „DI"), weil sie mehr sagt als eine Nummer; sonst
 * `unbenannt`. Eine blosse Nummer gilt NICHT als Name — sie ist genau das,
 * was der Beleg als Verlust beschreibt.
 */
export function channelName(row: ChannelRow): string {
  const quelle = row.source.trim()
  if (quelle && !isBareNumber(quelle)) return quelle
  const art = (row.sourceKind ?? '').trim()
  if (art && !isBareNumber(art)) return art
  return NO_NAME
}

// ── Bedarf 111 — die Nummer, die draussen etwas bedeutet ───────────────────

/** Wie die interne Nummer aussieht, wenn sie ersatzweise draussen steht. */
export const NO_PORT_NOTE = 'kein Port'

/**
 * Was in der Haus-Sicht in der Nummern-Spalte steht.
 *
 * Der Port, wenn es einen gibt. Sonst die interne Kanalnummer — aber
 * BENANNT: „Ch 7 (kein Port)" ist eine Auskunft, „7" allein wäre eine
 * Port-Nummer, die es nicht gibt, und der Haustechniker sucht sie am Blech.
 */
export function venueNumber(row: ChannelRow): string {
  const port = row.destinationPort.trim()
  if (port) return port
  return `Ch ${row.ch} (${NO_PORT_NOTE})`
}

// ── Befunde ────────────────────────────────────────────────────────────────

export type ChannelIdentityKind = 'no-port' | 'bare-name' | 'port-duplicate' | 'no-name'

export const CHANNEL_IDENTITY_LABEL: Readonly<Record<ChannelIdentityKind, string>> = {
  'no-port': 'Kanal ohne Haus-Port',
  'bare-name': 'Nummer statt Name',
  'port-duplicate': 'Zwei Kanäle auf demselben Port',
  'no-name': 'Kanal ganz ohne Namen',
}

export interface ChannelIdentityFinding {
  kind: ChannelIdentityKind
  text: string
  channels: number[]
}

/**
 * Was an den Kanal-Identitäten nicht stimmt.
 *
 * Jeder Befund ist einer der drei Belege, rückwärts gelesen — und keiner
 * behauptet mehr, als im Plan steht.
 */
export function channelIdentityFindings(rows: readonly ChannelRow[]): ChannelIdentityFinding[] {
  const out: ChannelIdentityFinding[] = []

  const ohnePort = rows.filter((r) => !r.destinationPort.trim())
  if (ohnePort.length > 0) {
    out.push({
      kind: 'no-port',
      channels: ohnePort.map((r) => r.ch),
      text: `${ohnePort.length} Kanal/Kanäle haben keinen Haus-Port. Auf dem Blatt für den Haustechniker steht dort die interne Nummer mit dem Zusatz „${NO_PORT_NOTE}" — die einzige Nummer, die draußen etwas bedeutet, fehlt also und wird nicht erfunden.`,
    })
  }

  const nurNummer = rows.filter((r) => isBareNumber(r.source))
  if (nurNummer.length > 0) {
    out.push({
      kind: 'bare-name',
      channels: nurNummer.map((r) => r.ch),
      text: `${nurNummer.length} Kanal/Kanäle tragen als Quelle nur eine Nummer. Eine Nummer an der Stelle eines Namens sagt weder am Pult noch im Multitrack noch auf dem Etikett etwas — genau der Zustand, in dem Dante Controller grüne Haken zeigt und trotzdem niemand weiß, welcher Kanal gemeint ist.`,
    })
  }

  const ohneName = rows.filter((r) => channelName(r) === NO_NAME)
  if (ohneName.length > 0) {
    out.push({
      kind: 'no-name',
      channels: ohneName.map((r) => r.ch),
      text: `${ohneName.length} Kanal/Kanäle haben gar keinen Namen. Sie erscheinen überall als „${NO_NAME}"; unterscheidbar sind sie dann nur über ihren Port.`,
    })
  }

  const proPort = new Map<string, ChannelRow[]>()
  for (const r of rows) {
    const key = `${r.destination.trim().toLowerCase()}|${r.destinationPort.trim().toLowerCase()}`
    if (!r.destinationPort.trim()) continue
    proPort.set(key, [...(proPort.get(key) ?? []), r])
  }
  for (const [, gruppe] of proPort) {
    if (gruppe.length < 2) continue
    out.push({
      kind: 'port-duplicate',
      channels: gruppe.map((r) => r.ch),
      text: `${gruppe.length} Kanäle liegen auf „${gruppe[0].destination} ${gruppe[0].destinationPort}". Ein Eingang nimmt ein Signal; einer der beiden ist beim Abstecken übrig, und welcher, entscheidet sich erst im Saal.`,
    })
  }

  return out
}

/**
 * Wem welche Spalte gehört, als Blatt.
 *
 * Für den Rider: das Haus füllt die eine Hälfte, die Band die andere, und
 * wer eine Tabelle geerbt hat, in der beides in einer Spalte stand, sieht
 * hier, welche Angabe von wem nachzutragen ist.
 */
export const OWNER_LABEL: Readonly<Record<ColumnOwner, string>> = {
  venue: 'Haus',
  band: 'Band',
  plan: 'Plan',
}

export function channelOwnerTable(rows: readonly ChannelRow[]): CsvTable {
  return {
    headers: ['Port (Haus)', 'Name (Band)', 'Abnahme (Band)', 'Stecker (Band)', 'Ch (bandintern)'],
    rows: rows.map((r): CsvCell[] => [
      venueNumber(r),
      channelName(r),
      r.sourceKind ?? '',
      r.connector,
      r.ch,
    ]),
  }
}
