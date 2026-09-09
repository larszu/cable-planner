import type { GreenGoConfig, GreenGoGroup, GreenGoUser } from '../types/greengo'

/**
 * Generates a minimal but valid GreenGo .gg5 JSON configuration file
 * from the cable-planner GreenGoConfig.
 *
 * The output can be loaded directly into the GreenGo Manager software
 * (v5.x). Device assignments and hardware registration are left for the
 * operator to complete inside the GreenGo Manager.
 */

// ── helpers ─────────────────────────────────────────────────────────────────

const randomHex8 = (): string => {
  const arr = new Uint8Array(4)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('')
}

const timestamp = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const defaultAudioProfile1 = () => ({
  Source: 0,
  Active: '--',
  SideTone: { Value: -12, min: -40, max: 0 },
  Gain: { Value: 35, min: 10, max: 60 },
  Compressor: 1,
  GateThreshold: -50,
  GateHold: 1,
  OutputLimiter: -6,
  HeadsetBias: 0,
  MicPower: 0,
  SpeakerDim: 0,
  LineOutLevel: { Value: -99, min: -40, max: 0 },
  SpeakerLevel: { Value: -99, min: -40, max: 0 },
  HeadsetLevel: { Value: 0, min: -40, max: 0 },
  MainLevel: { Value: 0, min: -40, max: 12 },
})

const defaultAudioProfile2 = () => ({
  Source: '--',
  Active: '--',
  SideTone: { Value: '--', min: -40, max: 0 },
  Gain: { Value: '--', min: 0, max: 0 },
  Compressor: '--',
  GateThreshold: '--',
  GateHold: '--',
  OutputLimiter: '--',
  HeadsetBias: '--',
  MicPower: '--',
  SpeakerDim: '--',
  LineOutLevel: { Value: '--', min: -40, max: 0 },
  SpeakerLevel: { Value: '--', min: -40, max: 0 },
  HeadsetLevel: { Value: '--', min: -40, max: 0 },
  MainLevel: { Value: '--', min: -40, max: 12 },
})

/**
 * Die Tastenkarte einer Station aus dem Plan bauen (E-2, Schritt 3).
 *
 * ZWEI WISSENSSTAENDE, EINE RECHNUNG. Kennt der Plan die Tastenpositionen
 * (`user.keys`, seit E-2 Schritt 2), kommen sie von dort. Kennt er sie nicht,
 * fuellt sich die Karte von Taste 1 an in Array-Reihenfolge — genau das, was
 * dieser Bauer frueher IMMER tat. Das ist jetzt kein eigener Zweig mehr,
 * sondern der Entartungsfall derselben Rechnung: ohne `keys` liegt nichts,
 * also ist jede Taste frei, also fuellt die Schleife unten sie der Reihe nach.
 *
 * Eine Gruppe in `groupIds` OHNE Taste ist ein realer Zustand (siehe
 * `types/greengo.ts`) und bekommt die erste freie Taste der ersten Seite. Ist
 * die Karte voll, bleibt sie ohne — verdraengt wird nichts.
 */
const buildButtonFunctions = (user: GreenGoUser): Record<string, Record<string, number>> => {
  const leereSeite = (): Record<string, number> => {
    const seite: Record<string, number> = {}
    for (let i = 1; i <= 18; i++) seite[String(i)] = 0
    return seite
  }
  // Seite 1 und 2 gibt es immer — eine .gg5 ohne sie waere unvollstaendig.
  const seiten: Record<string, Record<string, number>> = { '1': leereSeite(), '2': leereSeite() }
  for (const k of user.keys ?? []) {
    if (!Number.isInteger(k.page) || k.page < 1) continue
    if (!Number.isInteger(k.button) || k.button < 1) continue
    if (!Number.isInteger(k.groupId) || k.groupId <= 0) continue
    const nr = String(k.page)
    if (!seiten[nr]) seiten[nr] = leereSeite()
    // Eine Taste jenseits der 18 wird MITGEFUEHRT statt beschnitten: sie kam
    // aus einem Preset, das mehr Tasten kennt, als dieses Modell annimmt.
    seiten[nr][String(k.button)] = k.groupId
  }
  const platziert = new Set<number>()
  for (const seite of Object.values(seiten)) {
    for (const gid of Object.values(seite)) if (gid > 0) platziert.add(gid)
  }
  const frei = Object.keys(seiten['1'])
    .filter((taste) => seiten['1'][taste] === 0)
    .sort((a, b) => Number(a) - Number(b))
  for (const gid of user.groupIds) {
    if (!Number.isInteger(gid) || gid <= 0 || platziert.has(gid)) continue
    const taste = frei.shift()
    if (taste === undefined) break // Karte voll.
    seiten['1'][taste] = gid
    platziert.add(gid)
  }
  return seiten
}

const buildButtonStatus = (): Record<string, Record<string, number>> => {
  const page = (): Record<string, number> => {
    const result: Record<string, number> = {}
    for (let i = 1; i <= 18; i++) result[String(i)] = 0
    return result
  }
  return { '1': page(), '2': page() }
}

const defaultUserSettings = () => ({
  ActiveTime: 1,
  ToneLevel: -12,
  AlertTone: 0,
  ReplyMode: 2,
  PriorityDim: -6,
  PopupMode: 3,
  CueTimeout: 3,
  Isolate: 0,
  RoomId: { Type: 0, Id: 0 },
  RoomDim: -12,
  RoomPan: 0,
})

const defaultSecurity = () => ({
  Pincode: '',
  ChannelLevel: 1,
  MenuAccess: 1,
  ConfigClone: 1,
  UserSelect: 1,
  Channel: 1,
  Special: 1,
  UserSettings: 1,
  Audio: 1,
  Device: 1,
})

// ── User builder ─────────────────────────────────────────────────────────────

const buildUser = (user: GreenGoUser): Record<string, unknown> => ({
  myId: String(user.id),
  Name: user.name,
  DisplayName: user.displayName ?? '',
  Mode: 0,
  badge: 0,
  status: 3,
  Description: '',
  Color: user.color ?? 0,
  devices: [],
  Channels: {},
  SpecialChannels: {},
  DeviceProfiles: {
    Page: '--',
    ScreenIntensity: 5,
    ScreenTime: 3,
    LedIntensity: 4,
    LedTime: 0,
    Buzzer: 1,
  },
  ScriptSettings: { Id: '--', status: '--' },
  ButtonFunctions: buildButtonFunctions(user),
  AudioProfile: {
    '1': defaultAudioProfile1(),
    '2': defaultAudioProfile2(),
  },
  Gpio: {
    Input1: { Function: '--', Value: '--', Nc: '--' },
    Input2: { Function: '--', Value: '--', Nc: '--' },
    Output1: { Function: '--', Value: '--', Nc: '--' },
    Output2: { Function: '--', Value: '--', Nc: '--' },
  },
  LineInOut: {
    Input: {
      Active: '--',
      Gain: { Value: 0, min: -6, max: 24 },
      Source: '--',
      Compressor: 1,
      GateThreshold: -50,
      GateHold: 0,
    },
    Output: {
      Assign: { Type: 0, Id: 0 },
      Level: { Value: 0, min: -40, max: 12 },
      Limiter: 0,
      Loopback: { Value: -99, min: -40, max: 0 },
    },
  },
  buttonStatus: buildButtonStatus(),
  Settings: defaultUserSettings(),
  Security: defaultSecurity(),
  FlexList: [],
})

// ── Group builder ─────────────────────────────────────────────────────────────

const buildGroupMember = (
  userId: number,
  channel: number,
): Record<string, unknown> => ({
  type: 0,
  id: String(userId),
  myId: `0_${userId}_${channel}`,
  channel,
  status: 3,
  parent: '',
  children: [],
})

const buildGroup = (group: GreenGoGroup, users: GreenGoUser[]): Record<string, unknown> => {
  const members: Record<string, unknown> = {}
  const memberUsers = users.filter((u) => u.groupIds.includes(group.id))
  memberUsers.forEach((u, idx) => {
    const channel = idx + 1
    const key = `0_${u.id}_${channel}`
    members[key] = buildGroupMember(u.id, channel)
  })
  return {
    myId: String(group.id),
    Name: group.name,
    badge: 0,
    status: memberUsers.length > 0 ? 3 : 0,
    DisplayName: '',
    Description: '',
    Color: group.color ?? 0,
    members,
    audioLevel: [-80, -80, 0],
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Die Felder in `Settings`, die aus dem Plan kommen — und NUR die.
 *
 * Alles andere in `Settings` gehoert der Anlage: `configId` identifiziert die
 * Konfiguration, `ConfigPassword`/`AdminPassword` sind die Zugaenge zum
 * System. Sie beim Export neu zu wuerfeln haette dem Nutzer die eigene Anlage
 * ausgesperrt — das ist der Grund, warum die Liste hier steht und nicht als
 * Spread irgendwo im Code.
 */
const SETTINGS_FROM_PLAN = ['Name', 'Description', 'SampleRate', 'MulticastAddress'] as const

/**
 * EDITOR-Weg: in ein geladenes Roh-Dokument hineinschreiben.
 *
 * Ueberschrieben wird genau das, was der Plan besitzt — Stationen, Gruppen und
 * die vier Settings-Felder aus `SETTINGS_FROM_PLAN`. Raeume, Templates,
 * Geraete-Registrierungen, Tastenbelegungen, Netz-Einstellungen und die
 * Passwoerter bleiben unangetastet.
 *
 * Das ist die Antwort auf den Kommentar in `importGreengo`: „Bis der
 * Round-Trip sie bewahrt, muss er wenigstens sagen, was er nicht gelesen hat."
 */
/**
 * Die Felder EINER Station, die aus dem Plan kommen. Alles andere gehoert der
 * Anlage: `devices` ist die Hardware-Registrierung, `Channels` /
 * `SpecialChannels` sind die Tastenbelegungen, `Security.Pincode` der Zugang,
 * `AudioProfile` das Einmessen. Der Generator schreibt sie aus Konstanten —
 * auf einer echten Anlage ist das der halbe Einmessvorgang.
 *
 * Spiegelbild von `READ_USER_FIELDS` in `importGreengo`: was der Parser liest,
 * darf der Export zurueckschreiben. Der Guard in tests/greengoPreset.test.ts
 * haelt die beiden Listen deckungsgleich.
 */
const USER_FIELDS_FROM_PLAN = ['myId', 'Name', 'DisplayName', 'Color'] as const

/**
 * Felder, die der Plan ERGAENZT statt sie zu ersetzen — die dritte Kategorie.
 *
 * DER BEFUND. `ButtonFunctions` stand bis hierher in der Liste oben und wurde
 * damit bei jedem Export ueberschrieben. Das war der letzte verbliebene
 * Datenverlust im Editor-Weg, und ausgerechnet der einzige, vor dem der
 * Import-Hinweis nicht warnt: das Feld steht in `READ_USER_FIELDS`, also
 * meldet `unreadFields` es per Konstruktion nie als ungelesen.
 *
 * WARUM DER PLAN LANGE NICHT ENTSCHEIDEN DURFTE. Er kannte die
 * Tastenpositionen gar nicht. `GreenGoUser` fuehrte nur `groupIds` — eine
 * MENGE von Gruppen; der Parser las `ButtonFunctions` nur als Rueckfallweg,
 * um diese Menge zu fuellen, und warf die Positionen dabei weg. Der Generator
 * erfand sie beim Export neu, positionsweise aus der Array-Reihenfolge, und
 * setzte Seite 2 auf lauter Nullen.
 *
 * Auf einem Beltpack ist das die Tastenbelegung. Der Verlust faellt nicht am
 * Bildschirm auf, sondern in der Probe.
 *
 * WAS SICH GEAENDERT HAT (E-2, Schritt 2+3). Der Plan kennt sie jetzt:
 * `GreenGoUser.keys` traegt Seite, Position und Gruppe, der Import liest sie
 * ueber alle Seiten. Damit greift ADR-005 Regel 2 — „eine Projektion darf
 * nicht ueberschreiben, was sie nicht modelliert" — fuer dieses Feld nicht
 * mehr: es IST jetzt modelliert.
 *
 * Es bleibt trotzdem in dieser dritten Kategorie und wandert nicht nach
 * `USER_FIELDS_FROM_PLAN`, denn beides kommt weiter vor:
 *
 *   * Ein Projekt aus der Zeit vor E-2 hat keine `keys`. Fuer dessen
 *     Stationen gilt die alte Regel unveraendert weiter — Positionen aus dem
 *     Preset, nie neu vergeben.
 *   * Und selbst wo der Plan die Karte kennt, kennt er nicht jeden Wert
 *     darauf: eine Taste, die etwas anderes traegt als eine Gruppen-Nummer,
 *     bleibt unangetastet stehen.
 *
 * Welche der beiden Regeln fuer eine Station gilt, entscheidet nicht diese
 * Liste, sondern `mergeRulesFor` — an der Station, die gerade dran ist.
 */
const USER_FIELDS_MERGED_FROM_PLAN = ['ButtonFunctions'] as const

/** Dasselbe fuer eine Gruppe. */
const GROUP_FIELDS_FROM_PLAN = ['myId', 'Name', 'Color', 'members'] as const

/**
 * Eine keys-indizierte Sektion fortschreiben statt ersetzen.
 *
 * Der erste Anlauf dieser Funktion hat `Users` komplett durch die
 * plan-gebaute Sektion ersetzt — und damit genau den Verlust wieder
 * eingebaut, gegen den der Editor-Weg gedacht ist. Aufgefallen ist es nur,
 * weil ein Test den Pincode einer importierten Station geprueft hat.
 *
 * Jetzt: eine Station, die es im Preset gibt, behaelt ihr Objekt und bekommt
 * nur die Plan-Felder ueberschrieben. Eine neue Station kommt vollstaendig
 * aus dem Generator — sie hat kein Vorbild, aus dem sich etwas bewahren
 * liesse. Eine geloeschte faellt weg.
 */
/**
 * Die Tastenkarte fortschreiben — und `planKenntPositionen` entscheidet, WIE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DER SCHALTER IST DER GANZE PUNKT (E-2, Schritt 3)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Hier stand bis E-2: „Positionen kommen aus dem Preset und werden nie neu
 * vergeben." Das war richtig, SOLANGE der Plan die Positionen nicht kannte:
 * ein Export, der sie aus der Array-Reihenfolge neu erfindet, verschiebt auf
 * dem Beltpack die Tasten unter den Fingern des Nutzers. Der Schutz sass
 * damals notgedrungen hier, im Roh-Dokument, weil das Modell nichts hatte,
 * woran er sonst haette haengen koennen.
 *
 * Seit Schritt 2 hat es das: `GreenGoUser.keys`. Der Schutz wandert damit vom
 * Roh-Dokument ins Modell, und diese Funktion darf endlich schreiben, was der
 * Plan weiss. Sie darf es aber nur DANN — und deshalb ist der Wissensstand
 * ein Argument und keine Annahme:
 *
 *   `planKenntPositionen = false` (Projekt von vor E-2, oder eine Station,
 *   die nie aus einem Preset kam): unveraendert die alte Regel. Nur Seite 1
 *   wird angefasst, Positionen bleiben, eine entfallene Gruppe wird auf ihrer
 *   Taste 0, eine neue kommt auf die erste freie.
 *
 *   `planKenntPositionen = true`: die Karte des Plans IST die Karte. Er hat
 *   sie aus genau diesem Preset gelesen und fuehrt sie seither mit; wer im
 *   Plan eine Taste verschiebt, will sie verschoben haben. Das gilt fuer alle
 *   Seiten, nicht nur die erste — Seite 2 ist dem Plan nicht laenger fremd.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WAS AUCH DANN NICHT ANGETASTET WIRD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Eine Taste, deren Wert dieses Modell nicht als Gruppen-Nummer lesen kann,
 * bleibt Wert fuer Wert stehen. Der Import filtert beim Lesen auf ganze Zahlen
 * > 0; alles andere — ein `'--'`, ein Objekt, eine Sonderfunktion, die eine
 * spaetere Firmware dort ablegt — hat er nie gesehen und darf der Export
 * folglich nicht ueberschreiben. Genau der Rest von ADR-005 Regel 2, der
 * weiter gilt.
 *
 * Und die letzte Regel bleibt in BEIDEN Faellen: eine Gruppe, die der Plan
 * kennt und die auf keiner Taste liegt, bekommt die erste freie Taste der
 * ersten Seite; ist keine frei, bleibt sie ohne. Verdraengt wird nie etwas.
 */
export const mergeButtonFunctions = (
  preset: unknown,
  fresh: unknown,
  planKenntPositionen = false,
): unknown => {
  if (!preset || typeof preset !== 'object') return fresh
  const pages = preset as Record<string, unknown>
  const alsSeite = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  const freshPages = alsSeite(fresh)

  /**
   * Versteht dieses Modell den Wert als Tastenbelegung? `0` heisst unbelegt
   * und zaehlt dazu; `'--'` oder ein Objekt nicht — die bleiben stehen.
   */
  const lesbar = (v: unknown): boolean => {
    if (typeof v === 'number') return Number.isInteger(v) && v >= 0
    if (typeof v !== 'string' || !v.trim()) return false
    const n = Number(v)
    return Number.isInteger(n) && n >= 0
  }
  const gid = (v: unknown): number => (lesbar(v) ? Number(v) : 0)

  // Die Gruppen, die der Plan heute fuer diese Station vorsieht — ueber ALLE
  // Seiten der frisch gebauten Karte. Nur Seite 1 zu lesen hiesse, eine Gruppe
  // auf Seite 2 fuer unbekannt zu halten und sie unten ein zweites Mal zu
  // platzieren.
  const planGroups = new Set<number>()
  for (const seite of Object.values(freshPages)) {
    for (const wert of Object.values(alsSeite(seite))) {
      const g = gid(wert)
      if (g > 0) planGroups.add(g)
    }
  }

  const out: Record<string, unknown> = { ...pages }

  if (planKenntPositionen) {
    for (const nr of new Set([...Object.keys(pages), ...Object.keys(freshPages)])) {
      const roh = pages[nr]
      if (!roh || typeof roh !== 'object') {
        // Eine Seite, die es im Preset nicht gibt: die des Plans ganz.
        out[nr] = alsSeite(freshPages[nr])
        continue
      }
      const alt = alsSeite(roh)
      const neu = alsSeite(freshPages[nr])
      const seite: Record<string, unknown> = {}
      for (const [taste, wert] of Object.entries(alt)) {
        seite[taste] = lesbar(wert) ? gid(neu[taste]) : wert
      }
      for (const [taste, wert] of Object.entries(neu)) {
        if (!(taste in seite) && gid(wert) > 0) seite[taste] = gid(wert)
      }
      out[nr] = seite
    }
  } else {
    // Die alte Regel: nur Seite 1, nur die Menge, Positionen unangetastet.
    const seite = { ...alsSeite(out['1']) }
    for (const [taste, wert] of Object.entries(seite)) {
      if (!lesbar(wert)) continue
      const g = gid(wert)
      if (g > 0 && !planGroups.has(g)) seite[taste] = 0
    }
    out['1'] = seite
  }

  // Gruppen ohne Taste auf die erste freie Taste der ersten Seite. „Schon
  // platziert" wird ueber ALLE Seiten geprueft — sonst bekaeme eine Gruppe,
  // die auf Seite 2 liegt, auf Seite 1 eine zweite Taste.
  const platziert = new Set<number>()
  for (const seite of Object.values(out)) {
    for (const wert of Object.values(alsSeite(seite))) {
      const g = gid(wert)
      if (g > 0) platziert.add(g)
    }
  }
  const page1 = { ...alsSeite(out['1']) }
  const frei = Object.keys(page1)
    .filter((taste) => lesbar(page1[taste]) && gid(page1[taste]) === 0)
    .sort((a, b) => Number(a) - Number(b))
  for (const g of planGroups) {
    if (platziert.has(g)) continue
    const taste = frei.shift()
    if (taste === undefined) break // Karte voll — lieber nichts verdraengen.
    page1[taste] = g
    platziert.add(g)
  }
  out['1'] = page1
  return out
}

type MergeRule = (preset: unknown, fresh: unknown, key: string) => unknown

/**
 * Die Zusammenfuehr-Regeln fuer die Stationen DIESES Plans.
 *
 * Eine Funktion und keine Konstante, weil die Regel fuer `ButtonFunctions`
 * von der einzelnen Station abhaengt: kennt der Plan ihre Tastenpositionen
 * (`keys`), schreibt er sie; kennt er sie nicht, bleiben sie im Preset. Die
 * Entscheidung faellt hier, weil hier beides zusammenkommt — der Schluessel
 * der Sektion und der Plan, in dem die Station steht.
 */
const mergeRulesFor = (config: GreenGoConfig): Record<string, MergeRule> => ({
  ButtonFunctions: (preset, fresh, key) => {
    const user = config.users.find((u) => String(u.id) === key)
    // `!== undefined` und nicht `.length > 0`: eine LEERE Karte ist auch
    // eine gelesene. Wer hier auf die Laenge prueft, faellt bei der Station,
    // deren letzte Taste geraeumt wurde, auf die alte Regel zurueck — und die
    // Belegung, die der Nutzer gerade entfernt hat, bliebe im Preset stehen.
    return mergeButtonFunctions(preset, fresh, user?.keys !== undefined)
  },
})

const mergeKeyedSection = (
  presetSection: unknown,
  built: Record<string, unknown>,
  fieldsFromPlan: readonly string[],
  mergedFields: readonly string[] = [],
  rules: Record<string, MergeRule> = {},
): Record<string, unknown> => {
  const previous =
    presetSection && typeof presetSection === 'object'
      ? (presetSection as Record<string, unknown>)
      : {}
  const keys = Array.isArray(built.keys) ? (built.keys as string[]) : []
  const out: Record<string, unknown> = { keys, badge: previous.badge ?? 0 }
  for (const key of keys) {
    const fresh = built[key]
    const old = previous[key]
    if (!old || typeof old !== 'object' || !fresh || typeof fresh !== 'object') {
      out[key] = fresh
      continue
    }
    const merged = { ...(old as Record<string, unknown>) }
    for (const field of fieldsFromPlan) {
      merged[field] = (fresh as Record<string, unknown>)[field]
    }
    // Die dritte Kategorie: zusammenfuehren statt ersetzen.
    for (const field of mergedFields) {
      const rule = rules[field]
      if (rule) merged[field] = rule(merged[field], (fresh as Record<string, unknown>)[field], key)
    }
    out[key] = merged
  }
  return out
}

const mergeIntoPreset = (
  preset: Record<string, unknown>,
  config: GreenGoConfig,
  usersSection: Record<string, unknown>,
  groupsSection: Record<string, unknown>,
): Record<string, unknown> => {
  // Tiefe Kopie: das Preset im Projekt darf der Export nicht veraendern.
  const out = JSON.parse(JSON.stringify(preset)) as Record<string, unknown>
  const settings =
    out.Settings && typeof out.Settings === 'object'
      ? (out.Settings as Record<string, unknown>)
      : {}
  const fromPlan: Record<string, unknown> = {
    Name: config.systemName,
    Description: config.description ?? '',
    SampleRate: config.sampleRate,
    MulticastAddress: config.multicastAddress,
  }
  for (const key of SETTINGS_FROM_PLAN) settings[key] = fromPlan[key]
  // Zeitstempel des Speicherns fortschreiben, falls das Preset einen fuehrt —
  // aber keinen erfinden, wo keiner stand.
  if ('savedAtTimestamp' in settings) settings.savedAtTimestamp = timestamp()
  out.Settings = settings
  // Fortschreiben, nicht ersetzen — sonst waeren Tastenbelegungen, Pincodes
  // und Geraete-Registrierungen der Stationen trotz Preset wieder weg.
  out.Users = mergeKeyedSection(
    out.Users,
    usersSection,
    USER_FIELDS_FROM_PLAN,
    USER_FIELDS_MERGED_FROM_PLAN,
    mergeRulesFor(config),
  )
  out.Groups = mergeKeyedSection(out.Groups, groupsSection, GROUP_FIELDS_FROM_PLAN)
  return out
}

/**
 * Build a .gg5 JSON string from a GreenGoConfig.
 * Returns a UTF-8 string that can be saved as `<name>.gg5`.
 *
 * ZWEI WEGE, und der Nutzer hat sie entschieden: liegt ein `basePreset` vor
 * (der Nutzer hat eine echte Anlagen-Konfiguration geladen), wird
 * HINEINGESCHRIEBEN; sonst wie bisher aus dem Plan ERZEUGT. Der Unterschied
 * ist kein Detail — der Generator-Weg fuellt Raeume, Templates, Geraete und
 * Netz aus Konstanten, und wer eine echte Anlage importiert und wieder
 * exportiert hat, bekam sie leer zurueck.
 */
export const buildGg5File = (config: GreenGoConfig): string => {
  const ts = timestamp()
  const configId = `${randomHex8().toLowerCase()}-${randomHex8().toLowerCase().slice(0, 8)}`

  // Users section
  const userKeys = config.users.map((u) => String(u.id))
  const usersSection: Record<string, unknown> = {
    keys: userKeys,
    badge: 0,
  }
  for (const user of config.users) {
    usersSection[String(user.id)] = buildUser(user)
  }

  // Groups section
  const groupKeys = config.groups.map((g) => String(g.id))
  const groupsSection: Record<string, unknown> = {
    keys: groupKeys,
    badge: 0,
  }
  for (const group of config.groups) {
    groupsSection[String(group.id)] = buildGroup(group, config.users)
  }

  const gg5: Record<string, unknown> = {
    Settings: {
      Name: config.systemName,
      Description: config.description ?? '',
      configId,
      ConfigPassword: `${randomHex8().toLowerCase()}-${randomHex8().toLowerCase()}-${randomHex8().toLowerCase()}-${randomHex8().toLowerCase()}`,
      ConfigPasswordSet: 0,
      AdminPassword: `${randomHex8().toLowerCase()}-${randomHex8().toLowerCase()}-${randomHex8().toLowerCase()}-${randomHex8().toLowerCase()}`,
      AdminPasswordSet: 0,
      SampleRate: config.sampleRate,
      MulticastAddress: config.multicastAddress,
      Colors: {},
      TechPincode: '0',
      createdAtTimestamp: ts,
      savedAtTimestamp: ts,
      fileCreatedVersion: '5.0.6-6684',
      fileCurrentVersion: '5.0.6-6684',
    },
    Monitor: { DeviceId: '', state: 0 },
    Users: usersSection,
    Groups: groupsSection,
    Rooms: { keys: [], badge: 0 },
    Templates: { keys: [], badge: 0 },
    Devices: { keys: [], badge: 0 },
    OtherConfigs: { keys: [] },
    Clients: { keys: [] },
    Network: { keys: [], badge: 0 },
    Binary: '',
    RemoteConnection: {
      hostname: '',
      Enable: 0,
      status: 0,
      connectionId: '',
      connectionPassword: '',
      RemoteClients: {},
    },
    State: { newBinary: 1, configChanged: 1, following: 0 },
    VersionInfo: {
      Version: '5.0.6',
      Branch: 'HEAD',
      Commit: '80d3d4b',
      BuildNr: '6684',
    },
    Dashboards: { keys: [] },
    Scripts: { keys: [], badge: 0 },
    UsbDevices: { keys: [], badge: 0 },
    WirelessPools: { keys: [] },
    WirelessAccessPoints: { keys: [] },
    WirelessClients: { keys: [] },
    Footer: {
      Config: { text: `Config: ${config.systemName}` },
    },
  }

  // EDITOR-Weg: das geladene Roh-Dokument gewinnt, der Plan schreibt nur
  // seine eigenen Teile hinein. Steht kein Preset da, bleibt es beim eben
  // gebauten `gg5` — dem GENERATOR-Weg.
  const out = config.basePreset
    ? mergeIntoPreset(config.basePreset, config, usersSection, groupsSection)
    : gg5
  return JSON.stringify(out, null, 1)
}
