import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// NETGEAR M4250 (AV Line) — verwaltete Switches fuer AV-over-IP.
//
// Der zweite Teil der Netzwerk-Luecke aus #878. Luminex deckt die Tour ab,
// die M4250 die Festinstallation: sie sind ab Werk auf Dante, NDI, AES67 und
// sACN vorkonfiguriert und stehen in nahezu jedem AV-Schrank.
//
// ─── EINE ZEILE DER TABELLE, VIER SORTEN ANSCHLUSS ─────────────────────────
//
// Das Blatt fuehrt je Modell vier Spalten, und sie bedeuten Verschiedenes:
//
//   „8 ports PoE+ (220W)"        Kupfer MIT Speisung — daran haengt das Budget
//   „2 additional ports 1G"      Kupfer OHNE Speisung. Gleiche Buchse, keine
//                                Leistung. Wer hier eine Kamera ansteckt,
//                                sucht danach den Fehler am Netzteil.
//   „2 ports SFP / SFP+"         Glasfaser-Einschub, Uplink
//   „1 x Fixed (C14)" / „External Power Adapter"
//
// Die zweite Spalte ist der Grund, diese Eintraege ueberhaupt von Hand zu
// schreiben: eine Portzahl „10" verwischt genau den Unterschied, auf den es
// beim Stecken ankommt.
//
// ─── DAS PoE-BUDGET IST ABGABE, NICHT AUFNAHME ─────────────────────────────
//
// „220W" ist, was der Switch an die Geraete abgeben kann — nicht, was er aus
// der Steckdose zieht. `powerWatts` bleibt deshalb leer; das Budget steht im
// `notes`-Feld als das, was es ist. Wer es als Aufnahme in die Stromrechnung
// stellt, plant eine Phase zu knapp.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Die Bauform des Netzteil-Eingangs bei den Tischgeraeten. Das Blatt sagt nur
// „1 x External Power Adapter" und nennt den Stecker nicht. Er steht deshalb
// als `Custom` und nicht als `DC Barrel` — auch wenn es wahrscheinlich einer
// ist. Wahrscheinlich ist keine Angabe.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const poe = (n: number) => port(`Port ${n} (1G, PoE+)`, 'Ethernet/RJ45', 'Ethernet (PoE)')
const kupfer = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const sfp = (name: string) => port(name, 'SFP', 'Ethernet')
const sfpPlus = (name: string) => port(name, 'SFP+', 'Ethernet')
const c14 = () => port('AC In (IEC C14)', 'IEC 230V', 'Power')
const netzteil = () => port('DC In (externes Netzteil)', 'Custom', 'Power')
const oob = () => port('Out-of-band Mgmt (1G, rear)', 'Ethernet/RJ45', 'Ethernet')
const konsoleRj = () => port('Console (RS-232 auf RJ45, rear)', 'Ethernet/RJ45', 'Serial')

const NET = 'Networking'

// DIE ADRESSE STEHT BEI JEDEM EINTRAG AUSGESCHRIEBEN und nicht als Konstante:
// `catalogSourceUrls.test.ts` vergleicht die Quellen-Zeile ueber dem Eintrag
// mit dem `manufacturerUrl`-LITERAL darunter. Eine Konstante oder ein
// Zeilenumbruch macht den Beleg fuer den Waechter unsichtbar.

interface NetgearEntry {
  deviceTypeId: string
  match: string[]
  networkKind: 'switch'
  template: EquipmentTemplate
}

export const NETGEAR_AV_CATALOG: NetgearEntry[] = [

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf
  {
    match: ['netgearm42509g1fpoe', 'gsm4210pd', 'm42509g1fpoe'],
    deviceTypeId: '6f18b3e0-5c47-4a92-8d61-0b93e7a25c48',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf',
      name: 'NETGEAR M4250-9G1F-PoE+ (GSM4210PD)',
      category: NET,
      // Blatt: 8 Ports PoE+ (110 W) · 1 weiterer 1G-Port · 1 Port SFP ·
      // externes Netzteil · Konsole USB-C vorn · 1G Out-of-band hinten.
      inputs: [netzteil(), port('Console (USB-C, front)', 'USB-C', 'Serial'), oob()],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => poe(i + 1)),
        kupfer('Port 9 (1G, ohne PoE)'),
        sfp('SFP 1'),
      ],
      notes:
        'Tischgerät 210 x 40 x 140 mm · 20 Gbit/s · PoE-Budget 110 W (130 W mit stärkerem Netzteil) — Abgabe, nicht Aufnahme',
      width: 260,
      height: 340,
    },
  },

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf
  {
    match: ['netgearm42508g2xfpoe', 'gsm4210px', 'm42508g2xfpoe'],
    deviceTypeId: 'a72c96d4-1e08-4b35-9f27-3d50c8b164e9',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf',
      name: 'NETGEAR M4250-8G2XF-PoE+ (GSM4210PX)',
      category: NET,
      // Blatt: 8 Ports PoE+ (220 W) · 2 Ports SFP+ (1G/10G) · externes
      // Netzteil · USB-A hinten fuer Speicher · KEIN zusaetzlicher
      // Kupferport, anders als beim 9G1F.
      inputs: [
        netzteil(),
        port('Console (USB-C, front)', 'USB-C', 'Serial'),
        port('Storage (USB-A, rear)', 'USB Type A', 'USB'),
        oob(),
      ],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => poe(i + 1)),
        sfpPlus('SFP+ 1'),
        sfpPlus('SFP+ 2'),
      ],
      notes:
        'Tischgerät 210 x 40 x 140 mm · 56 Gbit/s · PoE-Budget 220 W (254 W mit stärkerem Netzteil) — Abgabe, nicht Aufnahme',
      width: 260,
      height: 340,
    },
  },

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf
  {
    match: ['netgearm425010g2fpoe', 'gsm4212p', 'm425010g2fpoe'],
    deviceTypeId: 'c095f7a2-8b63-4d14-a850-7e26b9c3f051',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf',
      name: 'NETGEAR M4250-10G2F-PoE+ (GSM4212P)',
      category: NET,
      // Blatt: 8 Ports PoE+ (125 W) · 2 weitere 1G-Ports OHNE PoE ·
      // 2 Ports SFP · fester C14 mit Netzschalter · 1 HE.
      inputs: [c14(), konsoleRj(), oob()],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => poe(i + 1)),
        kupfer('Port 9 (1G, ohne PoE)'),
        kupfer('Port 10 (1G, ohne PoE)'),
        sfp('SFP 1'),
        sfp('SFP 2'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '440 x 43.2 x 200 mm · 24 Gbit/s · PoE-Budget 125 W — Abgabe, nicht Aufnahme',
      width: 260,
      height: 380,
    },
  },

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf
  {
    match: ['netgearm425010g2xfpoe', 'gsm4212px', 'm425010g2xfpoe'],
    deviceTypeId: '4d31a8c6-7f50-4e29-b163-9c08d5e27a34',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf',
      name: 'NETGEAR M4250-10G2XF-PoE+ (GSM4212PX)',
      category: NET,
      // Blatt: wie GSM4212P, aber PoE-Budget 240 W und SFP+ (1G/10G) statt
      // SFP. 60 Gbit/s.
      inputs: [c14(), konsoleRj(), oob()],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => poe(i + 1)),
        kupfer('Port 9 (1G, ohne PoE)'),
        kupfer('Port 10 (1G, ohne PoE)'),
        sfpPlus('SFP+ 1'),
        sfpPlus('SFP+ 2'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '440 x 43.2 x 200 mm · 60 Gbit/s · PoE-Budget 240 W — Abgabe, nicht Aufnahme',
      width: 260,
      height: 380,
    },
  },

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf
  {
    match: ['netgearm425026g4fpoe', 'gsm4230p', 'm425026g4fpoe'],
    deviceTypeId: 'e8604b17-2d95-4c83-9a70-1f36c5b80e42',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf',
      name: 'NETGEAR M4250-26G4F-PoE+ (GSM4230P)',
      category: NET,
      // Blatt: 24 Ports PoE+ (300 W) · 2 weitere 1G-Ports OHNE PoE ·
      // 4 Ports SFP · C14 · 1 HE, 257 mm tief.
      inputs: [c14(), konsoleRj(), oob()],
      outputs: [
        ...Array.from({ length: 24 }, (_, i) => poe(i + 1)),
        kupfer('Port 25 (1G, ohne PoE)'),
        kupfer('Port 26 (1G, ohne PoE)'),
        ...Array.from({ length: 4 }, (_, i) => sfp(`SFP ${i + 1}`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '440 x 43.2 x 257 mm · 60 Gbit/s · PoE-Budget 300 W — Abgabe, nicht Aufnahme',
      width: 280,
      height: 560,
    },
  },

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf
  {
    match: ['netgearm425026g4xfpoe', 'gsm4230px', 'm425026g4xfpoe'],
    deviceTypeId: '2a75e903-6c18-4f47-85b2-0d94a6e13c7f',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf',
      name: 'NETGEAR M4250-26G4XF-PoE+ (GSM4230PX)',
      category: NET,
      // Blatt: 24 Ports PoE+ (480 W) · 2 weitere 1G-Ports · 4 Ports SFP+
      // (1G/10G) · C14 · 1 HE, 400 mm tief. 132 Gbit/s.
      inputs: [c14(), konsoleRj(), oob()],
      outputs: [
        ...Array.from({ length: 24 }, (_, i) => poe(i + 1)),
        kupfer('Port 25 (1G, ohne PoE)'),
        kupfer('Port 26 (1G, ohne PoE)'),
        ...Array.from({ length: 4 }, (_, i) => sfpPlus(`SFP+ ${i + 1}`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '440 x 43.2 x 400 mm · 132 Gbit/s · PoE-Budget 480 W — Abgabe, nicht Aufnahme',
      width: 280,
      height: 560,
    },
  },

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf
  {
    match: ['netgearm425040g8xfpoe', 'gsm4248px', 'm425040g8xfpoe'],
    deviceTypeId: '9c42d06b-3e81-4a75-b039-5f7c2e84a916',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4250/M4250_Datasheet.pdf',
      name: 'NETGEAR M4250-40G8XF-PoE+ (GSM4248PX)',
      category: NET,
      // Blatt: 40 Ports PoE+ (960 W) · 8 Ports SFP+ (1G/10G) · C14 ·
      // 1 HE, 400 mm tief. 240 Gbit/s. KEINE zusaetzlichen Kupferports.
      inputs: [c14(), konsoleRj(), oob()],
      outputs: [
        ...Array.from({ length: 40 }, (_, i) => poe(i + 1)),
        ...Array.from({ length: 8 }, (_, i) => sfpPlus(`SFP+ ${i + 1}`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '440 x 43.2 x 400 mm · 240 Gbit/s · PoE-Budget 960 W — Abgabe, nicht Aufnahme',
      width: 280,
      height: 700,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const netgearAvTemplates: EquipmentTemplate[] = NETGEAR_AV_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
