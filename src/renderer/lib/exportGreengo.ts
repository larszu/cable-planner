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
 * Build a .gg5 JSON string from a GreenGoConfig.
 * Returns a UTF-8 string that can be saved as `<name>.gg5`.
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

  return JSON.stringify(gg5, null, 1)
}
