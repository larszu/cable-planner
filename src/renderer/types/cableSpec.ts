import type { ConnectorType } from './equipment'
import { einsetzen, type Platzhalterwerte } from '../lib/platzhalter'

/**
 * Signal sub-standards for the same physical connector (e.g. 3G vs 12G SDI on BNC).
 * Mismatched sub-standards on compatible connectors usually need a converter/scaler.
 */
export type SignalStandard =
  | 'SDI-SD'
  | 'SDI-HD'
  | 'SDI-3G'
  | 'SDI-6G'
  | 'SDI-12G'
  | 'HDMI-1.4'
  | 'HDMI-2.0'
  | 'HDMI-2.1'
  | 'DP-1.2'
  | 'DP-1.4'
  | 'DP-2.0'
  | 'Eth-100'
  | 'Eth-1G'
  | 'Eth-10G'
  | 'Analog-Audio'
  | 'AES3'
  | 'AES3id'
  | 'USB-2.0'
  | 'USB-3.x'
  | 'Power-230V'
  | 'Fiber-SM'
  | 'Fiber-MM'
  | 'Thunderbolt-3'
  | 'Thunderbolt-4'
  | 'MADI'
  | 'DVB-ASI'
  | 'SMPTE-297'
  | 'SMPTE-304M'
  | 'SMPTE-311M'
  | 'NDI'
  | 'NDI-HX'
  | 'Dante'
  | 'AES67'
  | 'ST2110-20'
  | 'ST2110-30'
  | 'ST2110-40'
  | 'SRT'
  | 'RTMP'
  | 'HLS'
  | 'Blackburst'
  | 'Tri-Level'
  | 'Word-Clock'
  | 'PTP'
  | 'LTC'
  | 'RF-UHF'
  | 'RF-VHF'
  | 'RF-2.4G'
  | 'RF-5G'
  | 'RS-232'
  | 'RS-422'
  | 'RS-485'
  | 'DMX512'
  | 'RDM'
  | 'Art-Net'
  | 'sACN'
  | 'CVBS'
  | 'Y/C'
  | 'YPbPr'
  | 'RGBHV'
  | 'MTC'
  | 'Tally'
  | 'GPI/GPO'
  | 'HDBaseT'
  | 'Generic'

/** All valid signal standard values in display order. */
export const ALL_SIGNAL_STANDARDS: SignalStandard[] = [
  'SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G',
  'HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1',
  'DP-1.2', 'DP-1.4', 'DP-2.0',
  'Eth-100', 'Eth-1G', 'Eth-10G',
  'Analog-Audio', 'AES3', 'AES3id', 'USB-2.0', 'USB-3.x',
  'Thunderbolt-3', 'Thunderbolt-4',
  'MADI', 'DVB-ASI', 'SMPTE-297', 'SMPTE-304M', 'SMPTE-311M',
  'NDI', 'NDI-HX', 'Dante', 'AES67', 'ST2110-20', 'ST2110-30', 'ST2110-40',
  'SRT', 'RTMP', 'HLS',
  'Blackburst', 'Tri-Level', 'Word-Clock', 'PTP', 'LTC',
  'RF-UHF', 'RF-VHF', 'RF-2.4G', 'RF-5G',
  'RS-232', 'RS-422', 'RS-485', 'DMX512', 'RDM', 'Art-Net', 'sACN',
  'CVBS', 'Y/C', 'YPbPr', 'RGBHV', 'MTC', 'Tally', 'GPI/GPO', 'HDBaseT',
  'Power-230V', 'Fiber-SM', 'Fiber-MM', 'Generic',
]

/** SDI standards ordered from lowest to highest bandwidth. */
export const SDI_STANDARDS: SignalStandard[] = ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G']

/**
 * Der hoechste anwendbare SDI-Standard aus der Liste — und wenn keiner dabei
 * ist, der mit der hoechsten bekannten Medien-Bandbreite.
 *
 * WAS HIER FALSCH WAR (gemessen 2026-09-04). Der Rueckfall lautete
 * `standards[standards.length - 1]` — das LETZTE Listenelement, also eine
 * Eigenschaft der Schreibreihenfolge in der Spec und keine fachliche Aussage.
 * Weil die Reihenfolge der ST-2110- und NDI-Specs mit dem KLEINSTEN Signal
 * endet, kippte der Vorgabewert genau in die falsche Richtung:
 *
 *   st2110-fiber  -> ST2110-40 (2 Mbps)   statt ST2110-20 (3000 Mbps)
 *   ndi-cat6a     -> NDI-HX   (20 Mbps)   statt NDI       (250 Mbps)
 *
 * Ein Plan mit zwanzig unberuehrten ST-2110-Links meldete damit 40 Mbps
 * Gesamtlast und bekam „1 GbE" empfohlen — eine Unterschaetzung um Faktor
 * 1500, ausgegeben ohne Vorbehalt in grosser Schrift.
 *
 * Der Vorgabewert ist der Wert, den die allermeisten Kabel behalten. Er muss
 * deshalb der wahrscheinliche Hauptweg sein: bei ST 2110 die Video-Essenz,
 * bei NDI der unkomprimierte Stream. Wo keiner der Standards eine bekannte
 * Bandbreite hat (reine Ethernet-, Steuer- oder Stromspecs), bleibt es beim
 * letzten Element wie bisher — dort gibt es nichts zu ordnen.
 */
export const pickHighestSdiStandard = (standards: SignalStandard[]): SignalStandard | undefined => {
  const sdi = [...SDI_STANDARDS].reverse().find((s) => standards.includes(s))
  if (sdi) return sdi
  let breitester: SignalStandard | undefined
  let breite = -1
  for (const s of standards) {
    const mbps = bandwidthMbpsForStandard(s)
    if (mbps !== undefined && mbps > breite) {
      breite = mbps
      breitester = s
    }
  }
  return breitester ?? standards[standards.length - 1]
}

export interface CableSpec {
  id: string
  name: string
  connectorType: ConnectorType
  /** Connectors this cable can also mate with directly (same physical connector). */
  compatibleConnectors?: ConnectorType[]
  standards: SignalStandard[]
  /** Typical maximum cable length in meters (signal integrity). */
  maxLengthMeters?: number
  color: string
  /**
   * User-supplied notes (free text). Used for custom CableSpec definitions the
   * user adds via the catalog UI — they own this string and it stays in
   * whatever language they typed it.
   */
  notes?: string
  /**
   * Built-in catalog entries use a translation key instead of an inline
   * `notes` string, so the description follows the active UI language
   * without changing the underlying portable spec definition.
   *
   * Always resolve it together with `notesSource` — see below.
   */
  notesKey?: string
  /**
   * The ENGLISH source text for `notesKey`, right next to the key.
   *
   * ─── WARUM DAS FELD UEBERHAUPT EXISTIERT ─────────────────────────────
   *
   * Weil der Aufruf sonst keinen Rueckfall hat. Bis 2026-09-10 stand in
   * `CableDialog` woertlich `t(spec.notesKey, '')` — ein LEERER Fallback.
   * Seit E-28 ist Englisch die Quellsprache und steht deshalb NICHT mehr
   * als Woerterbuch in der Registry (`lib/i18n.ts` sagt das ausdruecklich).
   * Fuer jede Sprache ausser Deutsch lieferte der Aufruf damit den leeren
   * String.
   *
   * Das blieb nicht in der Anzeige: `CableDialog` schreibt das Ergebnis in
   * `Cable.notes`, also in die PROJEKTDATEI. Ein englischer Nutzer bekam
   * also nicht bloss eine leere Beschreibung zu sehen — er bekam sie leer
   * in seine eigenen Daten geschrieben, waehrend ein deutscher Nutzer den
   * Text hatte.
   *
   * Der uebliche Weg dieses Repos (`t(key, 'English text')`) war hier nicht
   * gangbar: der Schluessel ist DYNAMISCH (`t(spec.notesKey, …)`), der Text
   * kann also nicht an der Aufrufstelle stehen. Er steht deshalb hier, wo
   * der Schluessel steht — dieselbe Zeile, dasselbe Objekt, und damit kann
   * das eine nicht mehr ohne das andere wandern.
   */
  notesSource?: string
}

/**
 * Built-in catalogue of common A/V & power cables.
 * These serve as presets when creating cable connections and carry the spec
 * info needed for compatibility checks.
 */
export const cableCatalog: CableSpec[] = [
  {
    id: 'xlr-3pin-audio',
    name: 'XLR 3-pin Audio',
    connectorType: 'XLR',
    standards: ['Analog-Audio', 'AES3'],
    maxLengthMeters: 100,
    color: '#38bdf8',
    notesKey: 'catalog.cable.xlr-3pin-audio.notes',
    notesSource:
      'Balanced analog audio or AES3 (digital). Gender: male → female.',
  },
  {
    id: 'sdi-3g',
    name: 'SDI 3G (1080p50/60)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G'],
    maxLengthMeters: 100,
    color: '#f59e0b',
    notesKey: 'catalog.cable.sdi-3g.notes',
    notesSource:
      'Works for SD/HD/3G. Use 75Ω coax (Belden 1694A or similar).',
  },
  {
    id: 'sdi-6g',
    name: 'SDI 6G (4K30 4:2:0)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G'],
    maxLengthMeters: 70,
    color: '#f97316',
    notesKey: 'catalog.cable.sdi-6g.notes',
    notesSource:
      '6G needs higher-quality coax; mix with 3G only via down-converter.',
  },
  {
    id: 'sdi-12g',
    name: 'SDI 12G (4K60)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G'],
    maxLengthMeters: 50,
    color: '#ef4444',
    notesKey: 'catalog.cable.sdi-12g.notes',
    notesSource:
      'Use 4K-rated 12G coax (e.g. Belden 4694R). Downscale to 3G requires a scaler/converter.',
  },
  {
    id: 'hdmi-2.0',
    name: 'HDMI 2.0 (4K60 4:4:4)',
    connectorType: 'HDMI',
    standards: ['HDMI-1.4', 'HDMI-2.0'],
    maxLengthMeters: 10,
    color: '#a855f7',
    notesKey: 'catalog.cable.hdmi-2.0.notes',
    notesSource:
      'Passive copper limited to ~10 m; use optical HDMI for longer runs.',
  },
  {
    id: 'hdmi-2.1',
    name: 'HDMI 2.1 (8K/4K120)',
    connectorType: 'HDMI',
    standards: ['HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1'],
    maxLengthMeters: 5,
    color: '#c084fc',
    notesKey: 'catalog.cable.hdmi-2.1.notes',
    notesSource:
      'Ultra-high speed cables required; pairing with HDMI 1.4 device limits to 1.4.',
  },
  {
    id: 'dp-1.4',
    name: 'DisplayPort 1.4',
    connectorType: 'DisplayPort',
    standards: ['DP-1.2', 'DP-1.4'],
    maxLengthMeters: 3,
    color: '#8b5cf6',
  },
  {
    id: 'cat6',
    name: 'Ethernet Cat6 (1G)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G'],
    maxLengthMeters: 100,
    color: '#22c55e',
  },
  {
    id: 'cat6a',
    name: 'Ethernet Cat6a (10G)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G', 'Eth-10G'],
    maxLengthMeters: 100,
    color: '#16a34a',
    notesKey: 'catalog.cable.cat6a.notes',
    notesSource:
      'Required for 10GBASE-T over full 100 m runs.',
  },
  {
    id: 'ndi-cat6a',
    name: 'NDI über Cat6a (1G/10G)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-1G', 'Eth-10G', 'NDI', 'NDI-HX'],
    maxLengthMeters: 100,
    color: '#22c55e',
    notesKey: 'catalog.cable.ndi-cat6a.notes',
    notesSource:
      'NDI / NDI-HX over standard Gigabit Ethernet. Keep NDI and Dante on separate VLANs/links to avoid congestion.',
  },
  {
    id: 'dante-cat6',
    name: 'Dante / AES67 (Cat6)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G', 'Dante', 'AES67'],
    maxLengthMeters: 100,
    color: '#14b8a6',
    notesKey: 'catalog.cable.dante-cat6.notes',
    notesSource:
      'Dante / AES67 audio-over-IP. Requires PTP clocking; QoS/DSCP recommended on managed switches.',
  },
  {
    // B-10 — die Ausspiel-Haelfte. Physisch dasselbe Cat6-Kabel wie
    // `cat6a`; getrennt gefuehrt, damit der Weg im Netz-Budget als
    // Ausspielung erkennbar ist und nicht als weiteres Produktionssignal.
    id: 'stream-uplink-cat6',
    name: 'Stream-Uplink (SRT/RTMP/HLS)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G', 'SRT', 'RTMP', 'HLS'],
    maxLengthMeters: 100,
    color: '#a855f7',
    notesKey: 'catalog.cable.stream-uplink-cat6.notes',
    notesSource:
      'Outbound stream leg: SRT (contribution, with retransmit reserve), RTMP (platform ingest) or HLS (delivery ladder). Physically the same Cat6 as any other link — kept separate so the network budget shows the uplink as delivery, not as another production source. The budget figures are guide values for one 1080p50 path.',
  },
  {
    id: 'st2110-fiber',
    name: 'SMPTE ST 2110 (Fiber)',
    connectorType: 'Fiber',
    standards: ['Fiber-SM', 'Fiber-MM', 'ST2110-20', 'ST2110-30', 'ST2110-40'],
    maxLengthMeters: 300,
    color: '#0ea5e9',
    notesKey: 'catalog.cable.st2110-fiber.notes',
    notesSource:
      'SMPTE ST 2110 (-20 video / -30 audio / -40 ANC) over fiber. Needs a PTP grandmaster; typically 10/25/100 GbE.',
  },
  {
    id: 'blackburst-bnc',
    name: 'Referenz Blackburst / Tri-Level (BNC)',
    connectorType: 'BNC',
    standards: ['Blackburst', 'Tri-Level'],
    maxLengthMeters: 100,
    color: '#64748b',
    notesKey: 'catalog.cable.blackburst-bnc.notes',
    notesSource:
      'Reference sync (black burst / tri-level) over 75Ω coax. Distribute from one sync generator; feed every genlock-capable device.',
  },
  {
    id: 'wordclock-bnc',
    name: 'Word Clock (BNC)',
    connectorType: 'BNC',
    standards: ['Word-Clock'],
    maxLengthMeters: 50,
    color: '#94a3b8',
    notesKey: 'catalog.cable.wordclock-bnc.notes',
    notesSource:
      'Word clock for digital audio. Daisy-chain with 75Ω termination at the end; one master clock per domain.',
  },
  {
    id: 'ltc-bnc',
    name: 'LTC Timecode (BNC)',
    connectorType: 'BNC',
    standards: ['LTC'],
    maxLengthMeters: 100,
    color: '#94a3b8',
    notesKey: 'catalog.cable.ltc-bnc.notes',
    notesSource:
      'LTC longitudinal timecode (SMPTE 12M): an audio-band signal distributed over 75Ω coax (BNC), or via balanced XLR / LEMO into cameras and recorders. A master clock or sync generator typically feeds genlock and timecode together.',
  },
  {
    id: 'ptp-cat6',
    name: 'PTP / Referenz (Ethernet)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-1G', 'PTP'],
    maxLengthMeters: 100,
    color: '#0891b2',
    notesKey: 'catalog.cable.ptp-cat6.notes',
    notesSource:
      'PTP (IEEE 1588) timing for ST 2110 / AES67. One grandmaster per PTP domain; enable boundary clocks on switches.',
  },
  {
    id: 'fiber-sm-lc',
    name: 'Fiber SM (LC)',
    connectorType: 'Fiber',
    standards: ['Fiber-SM'],
    maxLengthMeters: 10000,
    color: '#eab308',
    notesKey: 'catalog.cable.fiber-sm-lc.notes',
    notesSource:
      'Single-mode (yellow jacket). Long distance (>300 m).',
  },
  {
    id: 'fiber-mm-lc',
    name: 'Fiber MM OM4 (LC)',
    connectorType: 'Fiber',
    standards: ['Fiber-MM'],
    maxLengthMeters: 400,
    color: '#facc15',
    notesKey: 'catalog.cable.fiber-mm-lc.notes',
    notesSource:
      'Multi-mode (aqua jacket). Short haul in racks/venue.',
  },
  {
    id: 'usb3',
    name: 'USB 3.x',
    connectorType: 'USB',
    standards: ['USB-2.0', 'USB-3.x'],
    maxLengthMeters: 3,
    color: '#64748b',
  },
  {
    id: 'iec-230v',
    name: 'IEC C13/C14 230V',
    connectorType: 'IEC 230V',
    standards: ['Power-230V'],
    maxLengthMeters: 5,
    color: '#475569',
    notesKey: 'catalog.cable.iec-230v.notes',
    notesSource:
      'Standard device power cable ("kettle lead").',
  },
  {
    id: 'powercon-tru1',
    name: 'powerCON TRUE1',
    connectorType: 'PowerCON',
    standards: ['Power-230V'],
    maxLengthMeters: 25,
    color: '#0ea5e9',
    notesKey: 'catalog.cable.powercon-tru1.notes',
    notesSource:
      'Locking, touring-grade power. Do not mix with classic powerCON (grey/blue).',
  },
  {
    id: 'schuko-230v',
    name: 'Schuko 230V',
    connectorType: 'Schuko 230V',
    standards: ['Power-230V'],
    maxLengthMeters: 25,
    color: '#334155',
  },
  {
    id: 'thunderbolt-3',
    name: 'Thunderbolt 3 (40Gbps)',
    connectorType: 'USB-C',
    standards: ['Thunderbolt-3', 'USB-2.0', 'USB-3.x'],
    maxLengthMeters: 2,
    color: '#7c3aed',
    notesKey: 'catalog.cable.thunderbolt-3.notes',
    notesSource:
      'USB-C connector, passive up to 2 m. Active TB3 cable up to ~50 cm. Forward-compatible with Thunderbolt 4.',
  },
  {
    id: 'thunderbolt-4',
    name: 'Thunderbolt 4 (40Gbps, zertifiziert)',
    connectorType: 'USB-C',
    standards: ['Thunderbolt-4', 'Thunderbolt-3', 'USB-2.0', 'USB-3.x'],
    maxLengthMeters: 2,
    color: '#6d28d9',
    notesKey: 'catalog.cable.thunderbolt-4.notes',
    notesSource:
      'Same bandwidth as TB3 but stricter certification (2× DP 1.4, 40 Gbps, 100 W PD).',
  },
  {
    id: 'madi-bnc',
    name: 'MADI Koax (BNC, 75Ω)',
    connectorType: 'BNC',
    standards: ['MADI', 'AES3'],
    maxLengthMeters: 200,
    color: '#0891b2',
    notesKey: 'catalog.cable.madi-bnc.notes',
    notesSource:
      'MADI AES10 over 75Ω coax. Up to 64 ch at 48 kHz or 56 ch at 96 kHz.',
  },
  {
    id: 'aes3id-bnc',
    name: 'AES3id (BNC, 75Ω)',
    connectorType: 'BNC',
    standards: ['AES3id'],
    maxLengthMeters: 100,
    color: '#0891b2',
    notesKey: 'catalog.cable.aes3id-bnc.notes',
    notesSource:
      'AES3id: AES3 digital audio over 75Ω unbalanced coax (BNC) — the BNC variant of AES/EBU. One stereo pair per coax, with longer reach than balanced AES3 over XLR. Common on routers and broadcast gear.',
  },
  {
    id: 'dvb-asi',
    name: 'DVB-ASI (BNC, 75Ω)',
    connectorType: 'BNC',
    standards: ['DVB-ASI'],
    maxLengthMeters: 100,
    color: '#2563eb',
    notesKey: 'catalog.cable.dvb-asi.notes',
    notesSource:
      'DVB-ASI: MPEG transport stream over 75Ω coax (BNC), up to 270 Mbit/s. Encoder/mux/modulator/playout interconnect in headends and OB trucks.',
  },
  {
    id: 'madi-optical',
    name: 'MADI Optisch (ST/SC Fiber)',
    connectorType: 'Fiber',
    standards: ['MADI', 'Fiber-MM'],
    maxLengthMeters: 2000,
    color: '#06b6d4',
    notesKey: 'catalog.cable.madi-optical.notes',
    notesSource:
      'MADI AES10 over optical fibre. Long reach, galvanically isolated.',
  },
  {
    id: 'smpte-297',
    name: 'SMPTE ST 297 — Optisches SDI (Glasfaser)',
    connectorType: 'Fiber',
    standards: ['SMPTE-297', 'SDI-HD', 'SDI-3G', 'Fiber-SM'],
    maxLengthMeters: 10000,
    color: '#f59e0b',
    notesKey: 'catalog.cable.smpte-297.notes',
    notesSource:
      'SMPTE ST 297: serial digital video (SDI) transported optically over fibre. No power — a pure optical SDI link with long reach.',
  },
  // #376 — SMPTE 304M (Hybrid-Fiber-Kamerakabel) ist KEIN Triax. Triax ist
  // ein analog-orientiertes Single-Coax-System (Damar & Hagen, Fischer),
  // SMPTE 304M traegt Fiber+Strom+Steuerung in einem genormten Stecker
  // (LEMO 3K.93C/311 oder Neutrik Dragonfly). Beide werden jetzt separat
  // gefuehrt.
  {
    id: 'smpte-304m-lemo',
    name: 'SMPTE 304M Hybrid-Fiber (LEMO 3K.93C / 311)',
    connectorType: 'LEMO 3K.93C (SMPTE 304M)',
    standards: ['SMPTE-304M', 'SMPTE-311M', 'SDI-HD', 'SDI-3G'],
    maxLengthMeters: 2000,
    color: '#d97706',
    notesKey: 'catalog.cable.smpte-304m-lemo.notes',
    notesSource:
      'SMPTE 304M hybrid camera cable with LEMO 3K.93C (also called LEMO 311) connector — EBU/broadcast-standard fibre + copper hybrid for studio cameras.',
  },
  {
    id: 'smpte-304m-dragonfly',
    name: 'SMPTE 304M Hybrid-Fiber (Neutrik Dragonfly)',
    connectorType: 'Neutrik Dragonfly (SMPTE 304M)',
    standards: ['SMPTE-304M', 'SMPTE-311M', 'SDI-HD', 'SDI-3G'],
    maxLengthMeters: 2000,
    color: '#b45309',
    notesKey: 'catalog.cable.smpte-304m-dragonfly.notes',
    notesSource:
      'SMPTE 304M hybrid camera cable with Neutrik opticalCON Dragonfly connector — ruggedised touring/stage variant compatible with LEMO 3K.93C via adapter.',
  },
  {
    id: 'triax-dh',
    name: 'Triax (Damar & Hagen)',
    connectorType: 'Triax (Damar & Hagen)',
    standards: ['SDI-HD', 'Analog-Audio'],
    maxLengthMeters: 1500,
    color: '#a16207',
    notesKey: 'catalog.cable.triax-dh.notes',
    notesSource:
      'Damar & Hagen triax — analog single-coax for HDTV cameras. Carries video, intercom, talkback, power. Mechanically incompatible with Fischer triax.',
  },
  {
    id: 'triax-fischer',
    name: 'Triax (Fischer)',
    connectorType: 'Triax (Fischer)',
    standards: ['SDI-HD', 'Analog-Audio'],
    maxLengthMeters: 1500,
    color: '#854d0e',
    notesKey: 'catalog.cable.triax-fischer.notes',
    notesSource:
      'Fischer triax — analog single-coax for HDTV cameras (alternative to Damar & Hagen). Same signals; different connector.',
  },
  {
    id: 'triax-camera',
    name: 'Triax-Kamerakabel (analog/koaxial)',
    connectorType: 'Triax',
    standards: ['Generic'],
    maxLengthMeters: 300,
    color: '#b45309',
    notesKey: 'catalog.cable.triax-camera.notes',
    notesSource:
      'Triaxial (coaxial) camera cable for studio/OB cameras: carries video, return, intercom/talkback, genlock and power over one triax — analogue, distinct from the SMPTE fibre camera cables.',
  },
  {
    id: 'serial-rs422',
    name: 'Serielle Steuerung RS-232/422/485 (DB9)',
    connectorType: 'DB9',
    standards: ['RS-232', 'RS-422', 'RS-485'],
    maxLengthMeters: 1200,
    color: '#fbbf24',
    notesKey: 'catalog.cable.serial-rs422.notes',
    notesSource:
      'Serial device control. RS-232 ~15 m point-to-point; RS-422/485 differential up to ~1200 m (VTR Sony 9-pin, PTZ/VISCA, router/matrix control).',
  },
  {
    id: 'vga-de15',
    name: 'VGA (DE-15)',
    connectorType: 'VGA',
    standards: ['RGBHV'],
    maxLengthMeters: 15,
    color: '#6366f1',
    notesKey: 'catalog.cable.vga-de15.notes',
    notesSource:
      'Analog RGBHV computer/projector video over 15-pin D-Sub. Keep runs short; quality drops past ~10-15 m.',
  },
  {
    id: 'dvi-cable',
    name: 'DVI (Single/Dual-Link)',
    connectorType: 'DVI',
    standards: ['RGBHV', 'Generic'],
    maxLengthMeters: 5,
    color: '#818cf8',
    notesKey: 'catalog.cable.dvi-cable.notes',
    notesSource:
      'DVI-D (digital), DVI-A (analog) or DVI-I (both). Passive copper limited to ~5 m; single vs dual-link sets the max resolution.',
  },
  {
    id: 'dsub-db25-audio',
    name: 'DB25 Mehrkanal-Audio (AES59 / TASCAM)',
    connectorType: 'DB25',
    standards: ['Analog-Audio', 'AES3'],
    maxLengthMeters: 30,
    color: '#fb7185',
    notesKey: 'catalog.cable.dsub-db25-audio.notes',
    notesSource:
      'DB25 multi-channel audio per AES59 ("TASCAM" pinout): 8 balanced analog or 4 AES3 pairs on one connector.',
  },
  {
    id: 'dmx-5pin',
    name: 'DMX512 / RDM (5-pol XLR)',
    connectorType: 'DMX 5-pol (XLR)',
    compatibleConnectors: ['DMX 3-pol (XLR)'],
    standards: ['DMX512', 'RDM'],
    maxLengthMeters: 300,
    color: '#fb923c',
    notesKey: 'catalog.cable.dmx-5pin.notes',
    notesSource:
      'DMX512-A / RDM lighting control, 512 channels per universe. 5-pin XLR is the standard; terminate the last fixture with 120Ω.',
  },
  {
    id: 'artnet-sacn',
    name: 'Art-Net / sACN (Ethernet)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G', 'Art-Net', 'sACN'],
    maxLengthMeters: 100,
    color: '#fdba74',
    notesKey: 'catalog.cable.artnet-sacn.notes',
    notesSource:
      'Art-Net / sACN (E1.31): many DMX universes over Ethernet. Use a dedicated/managed network; multicast for sACN.',
  },
  {
    id: 'composite-cinch',
    name: 'Composite / FBAS (Cinch)',
    connectorType: 'Cinch/RCA',
    compatibleConnectors: ['BNC'],
    standards: ['CVBS'],
    maxLengthMeters: 50,
    color: '#eab308',
    notesKey: 'catalog.cable.composite-cinch.notes',
    notesSource:
      'Composite video (CVBS/FBAS) over one line — Cinch/RCA or 75Ω BNC. Legacy/consumer, single picture.',
  },
  {
    id: 's-video',
    name: 'S-Video (Y/C)',
    connectorType: 'S-Video',
    standards: ['Y/C'],
    maxLengthMeters: 10,
    color: '#ca8a04',
    notesKey: 'catalog.cable.s-video.notes',
    notesSource:
      'S-Video (Y/C): separate luma and chroma over a mini-DIN-4 — better than composite, legacy.',
  },
  {
    id: 'component-ypbpr',
    name: 'Component YPbPr (3× Cinch/BNC)',
    connectorType: 'Cinch/RCA',
    compatibleConnectors: ['BNC'],
    standards: ['YPbPr'],
    maxLengthMeters: 30,
    color: '#a16207',
    notesKey: 'catalog.cable.component-ypbpr.notes',
    notesSource:
      'Analog component YPbPr over three lines (Cinch or BNC). Carries HD analog; legacy in modern plants.',
  },
  {
    id: 'tally-gpi',
    name: 'Tally / GPI-GPO (DB9 / Kontakt)',
    connectorType: 'DB9',
    standards: ['Tally', 'GPI/GPO'],
    maxLengthMeters: 100,
    color: '#f59e0b',
    notesKey: 'catalog.cable.tally-gpi.notes',
    notesSource:
      'Tally (red = on-air/PGM, green = preview) and GPI/GPO contact closures for record triggers, cues, lamps. Often D-Sub or terminal blocks.',
  },
  {
    id: 'hdbaset-cat6a',
    name: 'HDBaseT (Video/Audio/Steuerung/PoH über Cat)',
    connectorType: 'Ethernet/RJ45',
    standards: ['HDBaseT', 'Eth-1G'],
    maxLengthMeters: 100,
    color: '#2dd4bf',
    notesKey: 'catalog.cable.hdbaset-cat6a.notes',
    notesSource:
      'HDBaseT: video (up to 4K), audio, control (RS-232/IR), Ethernet and power (PoH) over one Cat6/6a run up to ~100 m.',
  },
  {
    id: 'hdmi-aoc',
    name: 'HDMI AOC (Active Optical, bis ~100 m)',
    connectorType: 'HDMI',
    standards: ['HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1'],
    maxLengthMeters: 100,
    color: '#a855f7',
    notesKey: 'catalog.cable.hdmi-aoc.notes',
    notesSource:
      'Active Optical HDMI: integrated fibre carries HDMI far beyond passive copper (~100 m). Directional (source → sink); not bidirectional.',
  },
  {
    id: 'dp-aoc',
    name: 'DisplayPort AOC (Active Optical, bis ~50 m)',
    connectorType: 'DisplayPort',
    standards: ['DP-1.2', 'DP-1.4', 'DP-2.0'],
    maxLengthMeters: 50,
    color: '#8b5cf6',
    notesKey: 'catalog.cable.dp-aoc.notes',
    notesSource:
      'Active Optical DisplayPort for long runs (~50 m) past the ~3 m passive limit. Directional, source → sink.',
  },
  {
    id: 'usbc-aoc',
    name: 'USB-C AOC (Active Optical, bis ~30 m)',
    connectorType: 'USB-C',
    standards: ['USB-3.x'],
    maxLengthMeters: 30,
    color: '#7c3aed',
    notesKey: 'catalog.cable.usbc-aoc.notes',
    notesSource:
      'Active Optical USB-C (USB 3.x / DP-Alt-Mode video) for ~30 m runs. Directional; bus power is limited on AOC.',
  },
]

/** Same physical connector families that can be connected directly without an adapter. */
const CONNECTOR_FAMILIES: ConnectorType[][] = [
  ['IEC 230V', 'PowerCON', 'Schuko 230V', 'C7 Eurostecker'], // all 230V, but NOT directly compatible without adapter
  // #832 — Alle Klinken sind EINE Familie: es gibt einen Adapter zwischen
  // ihnen, und das ist genau die Aussage dieser Tabelle. Sie sind deshalb
  // NICHT `DIRECTLY_MATING` — 3,5 mm passt nicht in 6,3 mm, und ein Werkzeug,
  // das das durchgehen laesst, meldet eine Verbindung, die im Aufbau nicht
  // zusammengeht.
  [
    'Klinke',
    'Jack 6.35 mm TS',
    'Jack 6.35 mm TRS',
    'Jack 3.5 mm TS',
    'Jack 3.5 mm TRS',
    'Jack 3.5 mm TRRS',
    'Jack 2.5 mm TRS',
    'Jack 6.35 mm',
    'Jack 3.5 mm',
  ],
]

/** Connectors that are physically identical and plug into each other directly. */
const DIRECTLY_MATING: ConnectorType[][] = [
  // BNC and historic 'SDI' were separate entries; they are now unified under 'BNC'.
  //
  // #832 — Gleiche GROESSE steckt zusammen, unterschiedliche Beschaltung
  // hindert nicht: ein TS-Stecker geht in eine TRS-Buchse (der Ring liegt
  // dann auf Masse). Das ist mechanisch wahr und elektrisch folgenreich —
  // die Folge meldet `checkBalanceMismatch`, nicht diese Tabelle.
  ['Jack 6.35 mm TS', 'Jack 6.35 mm TRS', 'Jack 6.35 mm'],
  ['Jack 3.5 mm TS', 'Jack 3.5 mm TRS', 'Jack 3.5 mm TRRS', 'Jack 3.5 mm'],
  // `Klinke` steht in KEINER dieser Gruppen. Der generische Wert sagt nicht,
  // welche Groesse gemeint ist; ihn mit einer bestimmten zusammenzustecken
  // hiesse zu raten, welche.
]

export const connectorsAreDirectlyMating = (a: ConnectorType, b: ConnectorType): boolean => {
  if (a === b) return true
  return DIRECTLY_MATING.some((group) => group.includes(a) && group.includes(b))
}

export const connectorsShareFamily = (a: ConnectorType, b: ConnectorType): boolean => {
  if (a === b) return true
  return CONNECTOR_FAMILIES.some((group) => group.includes(a) && group.includes(b))
}

export type CompatibilityLevel = 'ok' | 'warn' | 'error'

export interface CompatibilityResult {
  level: CompatibilityLevel
  message: string
  /**
   * Schluessel und Werte dieses Satzes — uebersetzt wird beim Anzeigen, nicht
   * hier (siehe Kopf von `types/adapter.ts`): `format(tr(b.schluessel, b.message), b.werte)`.
   */
  schluessel: string
  werte: Platzhalterwerte
}

/**
 * Decide whether a cable can connect the two given connector types and whether
 * a converter/scaler is likely required.
 */
export const checkCableCompatibility = (
  from: ConnectorType,
  to: ConnectorType,
  cable: CableSpec,
): CompatibilityResult => {
  const cableConnector = cable.connectorType
  const acceptable = new Set<ConnectorType>([cableConnector, ...(cable.compatibleConnectors ?? [])])

  const fromOk = acceptable.has(from)
  const toOk = acceptable.has(to)

  if (!fromOk || !toOk) {
    return {
      level: 'error',
      schluessel: 'cableSpec.cannotConnect',
      werte: { cable: cable.name, connector: cableConnector, from, to },
      message: einsetzen(
          'Cable "{cable}" ({connector}) cannot connect {from} to {to}.',
          { cable: cable.name, connector: cableConnector, from, to },
        ),
    }
  }

  if (!connectorsAreDirectlyMating(from, to)) {
    return {
      level: 'warn',
      schluessel: 'cableSpec.needsAdapter',
      werte: { from, to },
      message: einsetzen(
          '{from} and {to} use similar signalling but need an adapter.',
          { from, to },
        ),
    }
  }

  return {
    level: 'ok',
    schluessel: 'cableSpec.matches',
    werte: { cable: cable.name, from, to },
    message: einsetzen('{cable} matches {from} ↔ {to}.', {
      cable: cable.name,
      from,
      to,
    }),
  }
}

/**
 * For SDI specifically: flag speed mismatches that require a scaler.
 */
export const checkSdiStandardMismatch = (
  fromStandard: SignalStandard | undefined,
  toStandard: SignalStandard | undefined,
): CompatibilityResult | null => {
  const sdi = new Set<SignalStandard>(['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G'])
  if (!fromStandard || !toStandard) return null
  if (!sdi.has(fromStandard) || !sdi.has(toStandard)) return null
  if (fromStandard === toStandard)
    return {
      level: 'ok',
      schluessel: 'cableSpec.standardMatched',
      werte: { standard: fromStandard },
      message: einsetzen('{standard} matched.', {
        standard: fromStandard,
      }),
    }

  const rank: Record<string, number> = {
    'SDI-SD': 1,
    'SDI-HD': 2,
    'SDI-3G': 3,
    'SDI-6G': 4,
    'SDI-12G': 5,
  }
  const a = rank[fromStandard]
  const b = rank[toStandard]
  if (a !== b) {
    return {
      level: 'warn',
      schluessel: 'cableSpec.sdiSpeedMismatch',
      werte: { from: fromStandard, to: toStandard },
      message: einsetzen(
          'SDI speed mismatch ({from} ↔ {to}). A scaler/converter is required.',
          { from: fromStandard, to: toStandard },
        ),
    }
  }
  return null
}

/**
 * #390 — Nenn-Impedanz eines Signalstandards in Ω.
 *  75  = SDI / DVB-ASI / Video-BNC / AES3id / optisches SDI (SMPTE-297)
 *  50  = HF / Antenne (RF-*)
 *  110 = AES3 (AES/EBU über XLR)
 *  undefined = nicht impedanz-relevant (HDMI, Ethernet, Power, …).
 */
export const impedanceForStandard = (s: SignalStandard | undefined): 50 | 75 | 110 | undefined => {
  if (!s) return undefined
  if (
    s.startsWith('SDI') ||
    s === 'DVB-ASI' ||
    s === 'AES3id' ||
    s === 'CVBS' ||
    s === 'Y/C' ||
    s === 'YPbPr' ||
    s === 'SMPTE-297'
  )
    return 75
  if (s.startsWith('RF-')) return 50
  if (s === 'AES3') return 110
  return undefined
}

/**
 * #346 — Grobe Brutto-Bandbreite (Mbps) eines IP-/Netzwerk-Mediensignals,
 * für das Projekt-Netzwerk-Budget. Nur Standards, die sich ein Ethernet-/
 * IP-Netz teilen, liefern einen Wert; punkt-zu-punkt-Signale (SDI/HDMI/USB)
 * und Strom/Analog → undefined (zählen nicht ins Netzwerk-Budget).
 * Werte sind Richtwerte (1080p50/60, 48 kHz, 64 Kanäle).
 */
export const bandwidthMbpsForStandard = (s: SignalStandard | undefined): number | undefined => {
  switch (s) {
    case 'NDI':
      return 250 // NDI Full 1080p ~125–250
    case 'NDI-HX':
      return 20
    case 'Dante':
    case 'AES67':
    case 'ST2110-30':
      return 49 // 64ch @48k/24bit
    case 'ST2110-40':
      return 2 // ANC/Metadaten
    case 'ST2110-20':
      return 3000 // 1080p unkomprimiert (≈2160p → 12000)

    // ── Delivery / Contribution (B-10) ──────────────────────────────────
    //
    // Bis hierher kannte das Modell nur die PRODUKTIONS-Seite des Netzes:
    // NDI, Dante, ST 2110 — alles, was im Haus bleibt. Die Ausspiel-Haelfte
    // fehlte vollstaendig; `SRT`, `RTMP` und `HLS` kamen im Quelltext
    // nirgends vor, obwohl jeder Stream-Job an ihnen haengt.
    //
    // WAS DIESE ZAHLEN SIND UND WAS NICHT. Es sind Richtwerte fuer EINEN
    // 1080p50-Beitragsweg bei ueblicher Encoder-Einstellung, nicht die
    // Spitzenlast und nicht die Summe einer ABR-Leiter:
    //   SRT   12 Mbps — Beitrag mit Overhead/Retransmit-Reserve (8-10 netto)
    //   RTMP   6 Mbps — was YouTube/Twitch fuer 1080p als Richtwert nennen
    //   HLS   10 Mbps — Ausspiel-Leiter (mehrere Renditionen zusammen)
    // Wer eine 4K-Kette plant, setzt den Wert am Kabel selbst hoeher; das
    // Modell soll die Groessenordnung tragen, nicht eine Genauigkeit
    // behaupten, die es nicht hat.
    //
    // WARUM SIE TROTZDEM IN DIE LAST GEHOEREN. Ein Ausspielweg teilt sich
    // das Netz mit der Produktion — genau das ist die Regel im Docstring
    // oben. Ein Uplink, der neben zwanzig NDI-Quellen liegt, ist der Weg,
    // der als Erstes klemmt, und er fehlte in der Summe komplett.
    case 'SRT':
      return 12
    case 'RTMP':
      return 6
    case 'HLS':
      return 10
    default:
      // Eth-100/1G/10G stehen hier BEWUSST nicht mehr. Siehe unten.
      return undefined
  }
}

/**
 * Die Kapazitaet eines Ethernet-Links (Mbps) — was die Leitung KANN, nicht was
 * darueber laeuft.
 *
 * WARUM DAS GETRENNT IST (gemessen 2026-09-04). `bandwidthMbpsForStandard`
 * lieferte fuer Eth-100/1G/10G 100/1000/10000 zurueck, und das
 * Netzwerk-Budget im Rechner summiert seine Rueckgabewerte als LAST. Ein
 * einziges gezeichnetes Cat6a-Kabel ergab damit „10 Gbps Gesamt-Bandbreite"
 * und die Empfehlung „10 GbE" — bei null Mediensignalen im Plan. Zwei Kabel
 * ergaben 25 GbE. Die Empfehlung wurde davon getrieben, wie viele
 * Netzwerkkabel jemand gezeichnet hat, nicht davon, was darueber laeuft.
 *
 * Der Docstring der Funktion sagte die richtige Regel bereits — „nur
 * Standards, die sich ein Ethernet-/IP-Netz teilen" — und die drei
 * Eth-Faelle widersprachen ihr: ein Eth-1G-Kabel TEILT sich das Netz nicht,
 * es IST das Netz. Kapazitaet als Last zu zaehlen ist ein Kategoriefehler,
 * und er ist gross: Eth-10G ist das Vierzigfache eines NDI-Streams und
 * dominiert damit jeden realen Plan.
 *
 * Die Zahlen selbst sind nicht falsch, nur ihre Verwendung. Sie stehen
 * deshalb hier weiter — fuer den Aufrufer, der wissen will, ob die Summe der
 * Lasten in die gezeichneten Leitungen passt.
 */
export const linkCapacityMbpsForStandard = (
  s: SignalStandard | undefined,
): number | undefined => {
  switch (s) {
    case 'Eth-100':
      return 100
    case 'Eth-1G':
      return 1000
    case 'Eth-10G':
      return 10000
    default:
      return undefined
  }
}

/**
 * #367 — Praktische passive Maximal-Länge (m) je Signalstandard auf
 * Kupfer/Standardkabel. Darüber drohen Ausfälle → aktive Lösung (AOC,
 * HDBaseT, Extender, Glasfaser). undefined = keine relevante Längengrenze
 * (z. B. Netzwerk/Glasfaser/Strom/Analog-Audio). Richtwerte aus der Praxis.
 */
export const maxPassiveLengthM = (s: SignalStandard | undefined): number | undefined => {
  switch (s) {
    case 'HDMI-1.4':
      return 15
    case 'HDMI-2.0':
      return 10
    case 'HDMI-2.1':
      return 5
    case 'DP-1.2':
      return 5
    case 'DP-1.4':
      return 3
    case 'DP-2.0':
      return 2
    case 'USB-2.0':
      return 5
    case 'USB-3.x':
      return 3
    case 'Thunderbolt-3':
    case 'Thunderbolt-4':
      return 2 // passiv ~0,8 m, aktiv bis ~2 m
    case 'SDI-12G':
      return 70
    case 'SDI-6G':
      return 90
    case 'SDI-3G':
      return 120
    case 'SDI-HD':
      return 140
    default:
      return undefined
  }
}

/**
 * #390 — Warnung bei Impedanz-Mismatch entlang einer Verbindung
 * (z. B. 50Ω-HF-Kabel an 75Ω-SDI → Reflexionen/Return-Loss).
 */
export const checkImpedanceMismatch = (
  fromStandard: SignalStandard | undefined,
  toStandard: SignalStandard | undefined,
): CompatibilityResult | null => {
  const a = impedanceForStandard(fromStandard)
  const b = impedanceForStandard(toStandard)
  if (a == null || b == null || a === b) return null
  return {
    level: 'warn',
    schluessel: 'cableSpec.impedanceMismatch',
    werte: { a, b },
    message: einsetzen(
        'Impedance mismatch: {a}Ω ↔ {b}Ω. Reflections/return loss - use a matching cable/adapter.',
        { a, b },
      ),
  }
}

/**
 * #380 — Symmetrie eines Audio-Anschlusses: balanced (XLR/Mini-XLR/TT-Bantam)
 * vs. unbalanced (Cinch/SCART). undefined = nicht audio-symmetrie-relevant.
 *
 * ─── WAS SICH MIT #832 GEAENDERT HAT, UND WAS AUSDRUECKLICH NICHT ─────────
 *
 * Die Untertypen der Klinke beantworten die Frage NUR ZUR HAELFTE, und die
 * Haelfte wird beantwortet:
 *
 *   TS   zwei Leiter — unsymmetrisch. Eindeutig, immer.
 *   TRS  drei Leiter — symmetrisch ODER Stereo-unsymmetrisch. Am Line-Ausgang
 *        eines Pults das eine, an einer Kopfhoererbuchse das andere. Der
 *        Stecker sagt es nicht.
 *   TRRS vier Leiter — Stereo plus Mikrofon oder Steuerader. Symmetrie ist
 *        hier gar nicht die Frage.
 *
 * TS gibt deshalb `unbalanced` zurueck, TRS und TRRS weiter `undefined`. Das
 * ist keine Luecke, sondern die Auskunft: „daraus folgt es nicht". Wer TRS
 * pauschal als symmetrisch fuehrt, meldet an jeder Kopfhoererbuchse einen
 * Symmetrie-Bruch, der keiner ist — und nach dem dritten Fehlalarm liest
 * niemand mehr die echten.
 *
 * `Klinke` (ohne Angabe) bleibt `undefined`: dort ist nicht einmal die
 * Leiterzahl gesagt.
 */
export const balanceForConnector = (
  c: ConnectorType | undefined,
): 'balanced' | 'unbalanced' | undefined => {
  if (!c) return undefined
  if (c === 'XLR' || c === 'Mini-XLR' || c === 'TT/Bantam') return 'balanced'
  if (c === 'Cinch/RCA' || c === 'SCART') return 'unbalanced'
  if (c === 'Jack 6.35 mm TS' || c === 'Jack 3.5 mm TS') return 'unbalanced'
  return undefined
}

/**
 * #380 — Warnung beim Übergang symmetrisch ↔ unsymmetrisch (Brumm-/Pegel-
 * Probleme; ein DI/Übertrager wird empfohlen).
 */
export const checkBalanceMismatch = (
  from: ConnectorType | undefined,
  to: ConnectorType | undefined,
): CompatibilityResult | null => {
  const a = balanceForConnector(from)
  const b = balanceForConnector(to)
  if (!a || !b || a === b) return null
  return {
    level: 'warn',
    schluessel: 'cableSpec.balanceMismatch',
    werte: { from: from ?? '', to: to ?? '' },
    message: einsetzen(
        'Balanced ↔ unbalanced transition ({from} ↔ {to}). Use a DI box / transformer to avoid hum and level loss.',
        { from: from ?? '', to: to ?? '' },
      ),
  }
}
