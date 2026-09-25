import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Clear-Com Encore — analoge Partyline-Intercom.
//
// #878: „Zwei Bereiche haengen an je einem Hersteller. […] Intercom
// ausschliesslich aus `greengo`. Ein Bereich mit einem Haus ist kein
// bestueckter Bereich."
//
// ─── DIE QUELLE IST DAS HANDBUCH, NICHT DAS PRODUKTBLATT ───────────────────
//
// Clear-Com fuehrt beides. Das Produktblatt (`datasheets/Encore/…`) nennt
// Leistungsdaten und Stationszahlen, aber die ANSCHLUESSE nur im Fliesstext.
// Die vollstaendige Tabelle „Rear Panel Connectors / Front Panel Connectors"
// steht im Handbuch (`manuals/Encore/…`). `manufacturerUrl` zeigt deshalb
// dorthin: das ist das Blatt, aus dem diese Portlisten stammen.
//
// ─── WAS EINE PARTYLINE IM KABELPLAN IST ───────────────────────────────────
//
// Eine Zweidraht-Leitung, auf der Audio UND Speisung laufen — die Handbuecher
// sagen es woertlich: „One wire carries the DC power from a main [station]".
// Die XLR-3-Buchsen einer Station sind deshalb KEINE Ausgaenge im Sinne einer
// Signalrichtung, sondern Abgriffe auf denselben Bus. Sie stehen hier als
// Ausgaenge, weil man dort ein Kabel ansteckt und weil die Station die Quelle
// der Speisung ist; die Richtung im Plan ist eine Konvention und keine
// Behauptung ueber den Signalfluss.
//
// MEHRERE BUCHSEN JE KANAL, und das ist der Grund, sie einzeln zu fuehren:
// die MS-702 hat „(6) XLR-3M (3 per channel)". Wer nur zwei Kanaele zeichnet,
// sieht nicht, dass vier Beltpacks ohne T-Stueck drankommen.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Die Leistungsaufnahme in Watt. Die Blaetter nennen „Input Power: <= 60VA" —
// Scheinleistung. VA ist nicht Watt, und den Leistungsfaktor nennt kein
// Blatt. Die Angabe steht deshalb im `notes`-Feld, wie sie dasteht.
//
// Die Funk-Familien (FreeSpeak, FreeSpeak Edge) und die Matrix (Eclipse HX)
// fehlen: dort ist die Anschlussliste nicht in einem einzigen Blatt
// zusammengefasst, sondern ueber Basisstation, Antenne und Transceiver
// verteilt. Sie gehoeren in einen eigenen Durchgang, nicht in einen halben.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

/** Eine Partyline-Buchse. XLR-3, Audio und 28 V Speisung auf derselben Ader. */
const pl = (name: string) => port(name, 'XLR 3 Male', 'Partyline')
const klinke = (name: string) => port(name, 'Jack 6.35 mm TRS', 'Analog Audio')
const netz = () => port('AC Power (IEC 320)', 'IEC 230V', 'Power')

const IC = 'Intercom'

interface ClearcomEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const CLEARCOM_CATALOG: ClearcomEntry[] = [

  // Quelle: https://clearcom.com/DownloadCenter/manuals/Encore/Clear-Com_MS-702_Manual.pdf
  {
    match: ['clearcomms702', 'ms702'],
    deviceTypeId: '2b7f4c90-1e63-4a85-9d02-6f38b5c1e074',
    template: {
      manufacturerUrl: 'https://clearcom.com/DownloadCenter/manuals/Encore/Clear-Com_MS-702_Manual.pdf',
      name: 'Clear-Com MS-702',
      category: IC,
      // Handbuch, Rear Panel Connectors: (6) XLR-3M (3 je Kanal) · Announce
      // Out (1) XLR-3M · Announce Relay (1) 6,35-mm-Klinke · Program (1)
      // XLR-3F · Hot Mic/IFB (1) 6,35-mm-Klinke · IEC 320.
      // Front: Panel Mic 6,35-mm-Klinke · Headset (1) XLR-5F.
      //
      // DAS HEADSET IST HIER FUENFPOLIG, bei der CS-702 und der SB-704
      // vierpolig. Zwei Kanaele brauchen zwei Hoerer-Adern; wer das
      // gleichsetzt, bringt das falsche Headset mit.
      inputs: [
        port('Program In', 'XLR 3 Female', 'Analog Audio'),
        klinke('Hot Mic / IFB'),
        port('Panel Mic (front)', 'Jack 6.35 mm TRS', 'Mic'),
        port('Headset (front)', 'XLR 5 Female', 'Headset'),
        netz(),
      ],
      outputs: [
        pl('Intercom CH A 1'),
        pl('Intercom CH A 2'),
        pl('Intercom CH A 3'),
        pl('Intercom CH B 1'),
        pl('Intercom CH B 2'),
        pl('Intercom CH B 3'),
        port('Announce Out', 'XLR 3 Male', 'Analog Audio'),
        klinke('Announce Relay'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '2 Kanäle · Netzteil <= 60 VA · Partyline 30 V DC',
      width: 260,
      height: 320,
    },
  },

  // Quelle: https://clearcom.com/DownloadCenter/manuals/Encore/Clear-Com_CS-702_Manual.pdf
  {
    match: ['clearcomcs702', 'cs702'],
    deviceTypeId: '8e05a3d7-4c19-4b26-a7f1-0d92e6b34c58',
    template: {
      manufacturerUrl: 'https://clearcom.com/DownloadCenter/manuals/Encore/Clear-Com_CS-702_Manual.pdf',
      name: 'Clear-Com CS-702',
      category: IC,
      // Handbuch: wie MS-702 auf der Partyline-Seite, aber OHNE Hot-Mic/IFB
      // und mit anderem Front-Anschluss: Panel Mic ist eine 3,5-mm-Buchse,
      // Headset (1) XLR-4M.
      inputs: [
        port('Program In', 'XLR 3 Female', 'Analog Audio'),
        port('Panel Mic (front)', 'Jack 3.5 mm TRS', 'Mic'),
        port('Headset (front)', 'XLR 4 Male', 'Headset'),
        netz(),
      ],
      outputs: [
        pl('Intercom CH A 1'),
        pl('Intercom CH A 2'),
        pl('Intercom CH A 3'),
        pl('Intercom CH B 1'),
        pl('Intercom CH B 2'),
        pl('Intercom CH B 3'),
        port('Announce Out', 'XLR 3 Male', 'Analog Audio'),
        klinke('Announce Relay'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '2 Kanäle · Netzteil <= 60 VA',
      width: 260,
      height: 300,
    },
  },

  // Quelle: https://clearcom.com/DownloadCenter/manuals/Encore/Clear-Com_SB-704_Manual.pdf
  {
    match: ['clearcomsb704', 'sb704', 'clearcompartylineintercom4channelswitchboardmainstation'],
    deviceTypeId: 'c341e806-9b57-4d72-8a05-1e6f2b9d4c37',
    template: {
      manufacturerUrl: 'https://clearcom.com/DownloadCenter/manuals/Encore/Clear-Com_SB-704_Manual.pdf',
      name: 'Clear-Com SB-704',
      category: IC,
      // Handbuch, Rear Panel Connectors: Switched Intercom (10) XLR-3M ·
      // Intercom (4) XLR-3M (1 je Kanal) · Announce Out (1) XLR-3M ·
      // Program In (1) XLR-3F · Hot Mic/IFB (1) Klinke · External Speaker
      // (1) Klinke · Accessory (1) DB-15F · IEC 320.
      // Front: Panel Mic Klinke · Headset (1) XLR-4M.
      //
      // ZEHN GESCHALTETE LEITUNGEN NEBEN VIER FESTEN — das ist der
      // Unterschied zur MS-704 und der Grund, warum das Geraet
      // „Switchboard" heisst.
      inputs: [
        port('Program In', 'XLR 3 Female', 'Analog Audio'),
        klinke('Hot Mic / IFB'),
        port('Panel Mic (front)', 'Jack 6.35 mm TRS', 'Mic'),
        port('Headset (front)', 'XLR 4 Male', 'Headset'),
        port('Accessory (DB-15F)', 'DB15', 'GPIO'),
        netz(),
      ],
      outputs: [
        ...Array.from({ length: 4 }, (_, i) => pl(`Intercom CH ${String.fromCharCode(65 + i)}`)),
        ...Array.from({ length: 10 }, (_, i) => pl(`Switched Intercom ${i + 1}`)),
        port('Announce Out', 'XLR 3 Male', 'Analog Audio'),
        klinke('External Speaker'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '4 Kanäle + 10 geschaltete Leitungen · bis 40 Ein-Kanal-Beltpacks, 10 Sprechstellen oder 12 Headset-Stationen',
      width: 260,
      height: 420,
    },
  },

  // Quelle: https://clearcom.com/DownloadCenter/datasheets/Encore/RS-702_Beltpack_Datasheet.pdf
  {
    match: ['clearcomrs702', 'rs702'],
    deviceTypeId: '5d92c718-0a46-4e83-b1f7-3c80d5e69a24',
    template: {
      manufacturerUrl: 'https://clearcom.com/DownloadCenter/datasheets/Encore/RS-702_Beltpack_Datasheet.pdf',
      name: 'Clear-Com RS-702',
      category: IC,
      // Blatt, Connectors: „Intercom Line: (2) 6-pin XLR–M–F" und
      // „Headset: 4-pin XLR–M". Zwei Leitungsbuchsen, also durchschleifbar.
      //
      // DIE SECHSPOLIGE XLR IST EIN SCHALTCRAFT-LAYOUT, und das Blatt warnt
      // ausdruecklich: „Neutrik 6-pin XLR connectors must include 'S' in the
      // part number". Ein Neutrik ohne S passt mechanisch und belegt die
      // Pins anders — das steht im `notes`-Feld, weil es genau die Sorte
      // Angabe ist, wegen der jemand vor Ort ratlos dasteht.
      inputs: [
        port('Intercom Line In (XLR-6)', 'XLR 6 Female', 'Partyline'),
        port('Headset (XLR-4M)', 'XLR 4 Male', 'Headset'),
      ],
      outputs: [port('Intercom Line Thru (XLR-6)', 'XLR 6 Male', 'Partyline')],
      notes:
        '2 Kanäle · Speisung über die Leitung, Pin 2 = +28 V DC · 6-pol XLR im Switchcraft-Layout (Neutrik nur mit „S" in der Bestellnummer)',
      width: 240,
      height: 200,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const clearcomTemplates: EquipmentTemplate[] = CLEARCOM_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
