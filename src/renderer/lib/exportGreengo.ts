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

/** Build 18-button function map. Buttons that map to a group get the group ID,
 * remaining buttons are 0 (unassigned). */
const buildButtonFunctions = (groupIds: number[]): Record<string, Record<string, number>> => {
  const page = (assignedIds: number[]): Record<string, number> => {
    const result: Record<string, number> = {}
    for (let i = 1; i <= 18; i++) {
      result[String(i)] = assignedIds[i - 1] ?? 0
    }
    return result
  }
  return { '1': page(groupIds), '2': page([]) }
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
  ButtonFunctions: buildButtonFunctions(user.groupIds),
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
const USER_FIELDS_FROM_PLAN = ['myId', 'Name', 'DisplayName', 'Color', 'ButtonFunctions'] as const

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
const mergeKeyedSection = (
  presetSection: unknown,
  built: Record<string, unknown>,
  fieldsFromPlan: readonly string[],
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
  out.Users = mergeKeyedSection(out.Users, usersSection, USER_FIELDS_FROM_PLAN)
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
