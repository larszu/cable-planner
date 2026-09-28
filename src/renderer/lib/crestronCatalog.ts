import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Crestron — Streaming, Extender, Schalter, Audio-Prozessor.
//
// ─── WARUM DIESE DATEI HEUTE ERST ENTSTEHT ─────────────────────────────────
//
// Sie war schon einmal versucht und abgebrochen, und der Abbruch war richtig:
// „Die Crestron-Geräte konnte ich nicht anlegen: www.crestron.com ist in
// dieser Umgebung gesperrt … Jeder Katalogeintrag braucht aber ein
// tatsächlich geöffnetes Datenblatt, deshalb trage ich keine Ports aus dem
// Gedächtnis ein."
//
// Das ist die Regel aus `docs/device-identity-concept.md`, wörtlich befolgt.
// Aus dieser Umgebung antwortet `crestron.com` mit 200, die Blätter liegen
// unten. Sechs Geräte, jedes mit geöffnetem Blatt.
//
// ─── WAS DABEI HERAUSKAM, UND NICHT IM GEDAECHTNIS GESTANDEN HAETTE ────────
//
// 1. DM-NVX-350 UND -351 HABEN DIESELBEN ANSCHLUESSE. Der Unterschied steht
//    nicht an der Rueckseite, sondern in der Tonverarbeitung: nur der -351
//    mischt ein Mehrkanal-Signal auf Stereo herunter (Fussnote 6 beim -350:
//    „A 2-channel downmix signal from a multichannel surround sound source
//    requires the use of a Crestron DM-NVX-351"). Zwei Eintraege mit
//    identischer Portliste sind hier deshalb kein Versehen.
//
// 2. DER HD-TX-USB-2000-C IST DIE HAELFTE EINES PAARS. Das Blatt heisst
//    `HD-EXT-USB-2000-C` und beschreibt Sender UND Empfaenger; nur der Sender
//    steht hier, weil nur er gefragt war. Wichtiger: der DC-Eingang des
//    Senders speist BEIDE Geraete („This connection powers both the receiver
//    and transmitter"), es gibt also kein zweites Netzteil zu planen.
//
// 3. DREI ANSCHLUESSE SIND PAARE, VON DENEN NUR EINER BENUTZT WERDEN DARF.
//    AUDIO IN, COM und IR OUT liegen je zweimal an: als 3,5-mm-Klinke UND als
//    Klemmblock, intern parallel. Das Blatt sagt dazu „only one should be
//    used". Beide als getrennte Ports zu fuehren waere falsch (es sind nicht
//    zwei Wege), nur einen zu fuehren auch (man kann den anderen stecken).
//    Sie stehen deshalb als EIN Port, dessen Name beide Bauformen nennt.
//
// 4. DAS DSP-1283 HAT ZWEI NETZWERKWELTEN UND EINE TELEFONBUCHSE. Dante
//    primaer/sekundaer, dazu ein getrennter LAN-Port, ein getrennter
//    VoIP-Port und eine RJ11-POTS-Buchse. Vier RJ-Buchsen, die gleich
//    aussehen und Verschiedenes tun — genau der Fall, fuer den dieser Planer
//    da ist.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Die Anzeigen, Tasten und LEDs („Controls and Indicators" der Blaetter). Ein
// Taster ist kein Anschluss; er kommt in keinen Kabelplan.
//
// Beim HD-MD4X1-4K-E fuehrt das Blatt einen „SERVICE"-USB-A-Anschluss mit dem
// Zusatz „For factory use only". Er steht trotzdem drin, weil er physisch da
// ist — aber mit genau diesem Zusatz im Namen, damit niemand ihn einplant.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const hdmi = (name: string) => port(name, 'HDMI', 'HDMI')
const rj45 = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const sfp = (name: string) => port(name, 'SFP', 'Ethernet')
const klemme = (name: string, pins: number) =>
  port(name, pins === 3 ? 'Phoenix/Euroblock' : 'Terminal Block', 'Audio')
const dcFass = (name: string) => port(name, 'DC Barrel', 'Power')

const STREAM = 'Networking'
const AUDIO = 'Audio'
const VIDEO = 'Video'

interface CrestronEntry {
  deviceTypeId: string
  match: string[]
  networkKind?: 'switch' | 'router'
  template: EquipmentTemplate
}

// DIE ADRESSE STEHT BEI JEDEM EINTRAG AUSGESCHRIEBEN und nicht als Konstante:
// `catalogSourceUrls.test.ts` vergleicht die Quellen-Zeile ueber dem Eintrag
// mit dem `manufacturerUrl`-LITERAL darunter. Eine Konstante oder ein
// Zeilenumbruch macht den Beleg fuer den Waechter unsichtbar.

export const CRESTRON_CATALOG: CrestronEntry[] = [

  // Quelle: https://docs.crestron.com/en-us/9496/Content/Topics/Specifications/Specifications-350.htm
  {
    match: ['dmnvx350', 'crestrondmnvx350', 'nvx350'],
    deviceTypeId: '3b03c275-ba51-5485-9b25-6cd7333a0424',
    template: {
      manufacturerUrl: 'https://docs.crestron.com/en-us/9496/Content/Topics/Specifications/Specifications-350.htm',
      name: 'Crestron DM-NVX-350',
      category: STREAM,
      // Blatt: (2) HDMI IN · (1) HDMI OUT · Ethernet 1 (PoE++ Type 3 Class 5,
      // 60 W) · Ethernet 2 · Ethernet 3 = SFP · USB DEVICE Type B · USB HOST
      // Type A · AUDIO I/O 5-pol Klemme (Ein ODER Aus, nicht beides) ·
      // CONSOLE SERIAL auf RJ-45 · CONSOLE USB Type B · IR 1-2 auf EINER
      // 4-pol Klemme · COM 5-pol Klemme · 24VDC-Fass.
      inputs: [
        hdmi('HDMI Input 1'),
        hdmi('HDMI Input 2'),
        rj45('Ethernet 1 (1G, PoE++ Type 3 Class 5)'),
        rj45('Ethernet 2 (1G)'),
        sfp('Ethernet 3 (SFP, Modul separat)'),
        port('USB Device (Type B)', 'USB Type B', 'USB'),
        port('Console (RS-232 auf RJ-45)', 'Ethernet/RJ45', 'Serial'),
        port('Console (USB Type B)', 'USB Type B', 'Serial'),
        dcFass('24VDC 2.0A'),
      ],
      outputs: [
        hdmi('HDMI Output'),
        port('USB Host (Type A, 500 mA)', 'USB Type A', 'USB'),
        // EIN Port und nicht zwei: das Blatt nennt ihn „AUDIO I/O" und
        // schreibt dazu, er koenne Eingang ODER Ausgang sein, „not both".
        klemme('Audio I/O (5-pol, Ein ODER Aus)', 5),
        klemme('IR/Serial 1-2 (4-pol, zwei Ports auf einer Klemme)', 4),
        klemme('COM (RS-232, 5-pol)', 5),
      ],
      notes:
        '219 x 236 x 39 mm · 0,91 kg · Aufnahme 35 W typisch · PoE++ (IEEE 802.3bt Type 3 Class 5, 60 W) oder Netzteil PW-2420RU · Encoder ODER Decoder, umschaltbar · kein Downmix von Mehrkanal-Ton (dafür DM-NVX-351)',
      width: 260,
      height: 340,
    },
  },

  // Quelle: https://docs.crestron.com/en-us/9496/Content/Topics/Specifications/Specifications-351.htm
  {
    match: ['dmnvx351', 'crestrondmnvx351', 'nvx351'],
    deviceTypeId: 'f1909873-51a8-5c1b-a9bd-5d3fe182cbf1',
    template: {
      manufacturerUrl: 'https://docs.crestron.com/en-us/9496/Content/Topics/Specifications/Specifications-351.htm',
      name: 'Crestron DM-NVX-351',
      category: STREAM,
      // ANSCHLUSSGLEICH ZUM -350, und das ist nachgesehen und nicht
      // uebernommen: die Connectors-Tabelle des -351 fuehrt dieselben
      // Positionen in derselben Zahl. Der Unterschied ist der Downmix.
      inputs: [
        hdmi('HDMI Input 1'),
        hdmi('HDMI Input 2'),
        rj45('Ethernet 1 (1G, PoE++ Type 3 Class 5)'),
        rj45('Ethernet 2 (1G)'),
        sfp('Ethernet 3 (SFP, Modul separat)'),
        port('USB Device (Type B)', 'USB Type B', 'USB'),
        port('Console (RS-232 auf RJ-45)', 'Ethernet/RJ45', 'Serial'),
        port('Console (USB Type B)', 'USB Type B', 'Serial'),
        dcFass('24VDC 2.0A'),
      ],
      outputs: [
        hdmi('HDMI Output'),
        port('USB Host (Type A, 500 mA)', 'USB Type A', 'USB'),
        klemme('Audio I/O (5-pol, Ein ODER Aus)', 5),
        klemme('IR/Serial 1-2 (4-pol, zwei Ports auf einer Klemme)', 4),
        klemme('COM (RS-232, 5-pol)', 5),
      ],
      notes:
        'Anschlüsse identisch zum DM-NVX-350 — Unterschied ist die Tonverarbeitung: der -351 mischt Mehrkanal-Ton auf Stereo herunter · PoE++ (IEEE 802.3bt Type 3 Class 5, 60 W) oder Netzteil PW-2420RU',
      width: 260,
      height: 340,
    },
  },

  // Quelle: https://docs.crestron.com/en-us/9496/Content/Topics/Specifications/Specifications-D30.htm
  {
    match: ['dmnvxd30', 'crestrondmnvxd30', 'nvxd30'],
    deviceTypeId: 'cc4ad1e5-07eb-5f12-b3c1-150be570106b',
    template: {
      manufacturerUrl: 'https://docs.crestron.com/en-us/9496/Content/Topics/Specifications/Specifications-D30.htm',
      name: 'Crestron DM-NVX-D30',
      category: STREAM,
      // Blatt: reiner Decoder. EIN Ethernet (PoE+ Type 2 Class 4, 25,5 W) ·
      // (1) HDMI OUT · AUDIO 5-pol Klemme, NUR Ausgang (anders als beim -350,
      // wo derselbe Anschluss Ein oder Aus sein kann) · CONSOLE USB ist hier
      // MICRO-B, nicht Type B · IR 1-2 · COM · 24VDC 1.25A.
      // KEIN HDMI-Eingang, KEIN USB-Extender, KEIN SFP.
      inputs: [
        rj45('Ethernet (1G, PoE+ Type 2 Class 4)'),
        port('Console (USB Micro-B)', 'USB Micro-B', 'Serial'),
        dcFass('24VDC 1.25A'),
      ],
      outputs: [
        hdmi('HDMI Output'),
        klemme('Audio Out (5-pol, nur Ausgang)', 5),
        klemme('IR/Serial 1-2 (4-pol, zwei Ports auf einer Klemme)', 4),
        klemme('COM (RS-232, 5-pol)', 5),
      ],
      notes:
        'Nur Decoder · PoE+ (IEEE 802.3at Type 2 Class 4, 25,5 W) oder Netzteil PW-2412WU (separat) · Analogton nur als Ausgang',
      width: 260,
      height: 340,
    },
  },

  // Quelle: https://www.crestron.com/getmedia/8773a110-b45d-4917-9eb9-399ffd2b6c13/ss_hd-ext-usb-2000-c
  {
    match: ['hdtxusb2000c', 'crestronhdtxusb2000c', 'hdextusb2000c'],
    deviceTypeId: '823dcfb3-2eb1-5d2d-8fba-f8dee3e066ca',
    template: {
      manufacturerUrl: 'https://www.crestron.com/getmedia/8773a110-b45d-4917-9eb9-399ffd2b6c13/ss_hd-ext-usb-2000-c',
      name: 'Crestron HD-TX-USB-2000-C (Sender)',
      category: VIDEO,
      // Blatt „Connectors – Transmitter": HDMI IN · AUDIO IN (Klinke UND
      // 5-pol Klemme, parallel) · USB host Type A · USB device Micro-B ·
      // LAN (1) RJ45 10/100 · COM (Klinke UND 3-pol Klemme, parallel) ·
      // IR OUT (Klinke UND 2-pol Klemme, parallel) · HDBT OUT RJ45
      // geschirmt · 24VDC 1.25A.
      inputs: [
        hdmi('HDMI In'),
        // Klinke und Klemme sind INTERN PARALLEL („only one audio input
        // connection should be used"). Ein Port, beide Bauformen benannt.
        port('Audio In (3,5-mm-Klinke ODER 5-pol Klemme, parallel)', 'Jack 3.5 mm TRS', 'Audio'),
        port('USB Device (Micro-B)', 'USB Micro-B', 'USB'),
        dcFass('24VDC 1.25A (speist Sender UND Empfänger)'),
      ],
      outputs: [
        port('HDBT Out (RJ45 geschirmt, HDBaseT + PoE Class 3)', 'Ethernet/RJ45', 'HDBaseT'),
        port('USB Host (Type A, 1 A)', 'USB Type A', 'USB'),
        rj45('LAN (10/100)'),
        port('COM (RS-232, Klinke ODER 3-pol Klemme, parallel)', 'Jack 3.5 mm TRS', 'Serial'),
        port('IR Out (Klinke ODER 2-pol Klemme, parallel)', 'Jack 3.5 mm TS', 'IR'),
      ],
      notes:
        'Sender eines Punkt-zu-Punkt-Paars (Blatt: HD-EXT-USB-2000-C) · bis 100 m · 4K60 4:2:0 / 4K30 4:4:4 · 114 mm hoch, 776 g · das 24-V-Netzteil PW-2412WU speist Sender UND Empfänger · nicht vom Steuersystem ansprechbar, Signale werden durchgereicht',
      width: 240,
      height: 300,
    },
  },

  // Quelle: https://www.crestron.com/getmedia/55b11a5a-e5af-4030-9019-f609fa944194/ss_hd-md4x1-4k-e
  {
    match: ['hdmd4x14ke', 'crestronhdmd4x14ke'],
    deviceTypeId: '0f4348a2-68a3-5858-b88d-e2d68962fa01',
    template: {
      manufacturerUrl: 'https://www.crestron.com/getmedia/55b11a5a-e5af-4030-9019-f609fa944194/ss_hd-md4x1-4k-e',
      name: 'Crestron HD-MD4X1-4K-E',
      category: VIDEO,
      // Blatt: INPUT 1-4 (4) HDMI · OUTPUT (1) HDMI · LAN (1) RJ45 10/100 ·
      // 24 VDC 0.75 A · SERVICE (1) USB Type A „For factory use only".
      inputs: [
        hdmi('Input 1'),
        hdmi('Input 2'),
        hdmi('Input 3'),
        hdmi('Input 4'),
        rj45('LAN (10/100)'),
        dcFass('24VDC 0.75A'),
      ],
      outputs: [
        hdmi('Output'),
        // Steht drin, weil er physisch da ist — der Zusatz steht im Namen,
        // damit ihn niemand einplant.
        port('Service (USB Type A, nur Werk)', 'USB Type A', 'USB'),
      ],
      notes:
        '4 HDMI-Eingänge auf 1 Ausgang · Netzteil PW-2407WU mitgeliefert · 2x20-Zeichen-OLED für Menü und Signalinfo · abgekündigt (Crestron führt es unter Discontinued)',
      width: 240,
      height: 300,
    },
  },

  // Quelle: https://www.crestron.com/getmedia/48982f6b-606f-41c8-b081-20d45e64a03c/ss_dsp-1283_1
  {
    match: ['dsp1283', 'crestrondsp1283', 'aviadsp1283'],
    deviceTypeId: '46deec1e-d867-5f6e-8d51-05df6d6bfaec',
    template: {
      manufacturerUrl: 'https://www.crestron.com/getmedia/48982f6b-606f-41c8-b081-20d45e64a03c/ss_dsp-1283_1',
      name: 'Crestron Avia DSP-1283',
      category: AUDIO,
      // Blatt: MIC/LINE INPUTS 1-12 (12) 3-pol 3,5-mm-Klemmen, Phantom
      // +48 V je Kanal schaltbar · LINE OUTPUTS 1-8 (8) 3-pol Klemmen ·
      // USB Type B (USB-Audio) · DANTE PRI + DANTE SEC (je RJ45 1G) ·
      // VOIP (RJ45) · LAN (RJ45) · PHONE (RJ11, POTS) · IEC C14 ·
      // COMPUTER vorn (USB Type B, nur Einrichtung).
      inputs: [
        ...Array.from({ length: 12 }, (_, i) =>
          klemme(`Mic/Line In ${i + 1} (3-pol, +48 V schaltbar)`, 3),
        ),
        port('USB Audio (Type B)', 'USB Type B', 'USB'),
        rj45('Dante Primary (1G)'),
        rj45('Dante Secondary (1G)'),
        rj45('VoIP (SIP)'),
        rj45('LAN'),
        port('Phone (POTS)', 'RJ11', 'Telephone'),
        port('AC In (IEC C14)', 'IEC 230V', 'Power'),
        port('Computer (USB Type B, vorn, nur Einrichtung)', 'USB Type B', 'Serial'),
      ],
      outputs: Array.from({ length: 8 }, (_, i) => klemme(`Line Out ${i + 1} (3-pol)`, 3)),
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '12 Mic/Line ein, 8 Line aus · Echounterdrückung auf allen 12 Kanälen · Dante primär/sekundär, VoIP und LAN sind DREI getrennte RJ45 · 439 x 44 x 365 mm (483 mm mit Rackwinkeln) · 4,2 kg · 100-240 V, 1,8 A',
      width: 280,
      height: 700,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const crestronTemplates: EquipmentTemplate[] = CRESTRON_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
