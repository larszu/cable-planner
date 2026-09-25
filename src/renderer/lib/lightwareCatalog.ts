import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Lightware Taurus UCX — universelle Umschalter fuer Besprechungsraeume.
//
// Aus der Konverter-Luecke von #878 (Lightware, 23 offene Modelle). Zwei
// Geraete aus der Reihe, beide mit der vollstaendigen Anschlusstabelle ihres
// Produkt-Kurzblatts als Beleg.
//
// ─── DER GRUND, WARUM GERADE DIESE ZWEI ZUERST ─────────────────────────────
//
// Sie sind die Probe auf das Stecker-Vokabular, das am 2026-09-24 dazukam.
// Die Tabelle nennt DREI verschiedene Phoenix-Klemmen an einem Geraet:
// „RS232 Connector 2x 3Pol Phoenix", „Room Occupancy Sensor Connector 3Pol
// Phoenix", „GPIO Connector 8Pol Phoenix". Vor der Erweiterung waeren alle
// drei `Custom` gewesen — drei verschiedene Klemmen unter einem Namen, und
// die Patchliste haette sie nicht auseinandergehalten.
//
// Die POLZAHL steht deshalb im Namen des Anschlusses und nicht im Steckertyp:
// `Phoenix/Euroblock` ist die Bauform, „3-polig" und „8-polig" sind das, was
// man beim Konfektionieren wissen muss.
//
// ─── USB IST HIER NICHT EIN ANSCHLUSS, SONDERN SIEBEN ──────────────────────
//
// Das Blatt trennt sie nach ZWECK, und die Unterscheidung ist der halbe
// Nutzen des Geraets: zwei USB-C fuer die Rechner (mit Ladefunktion), ein
// USB-B fuer denselben Zweck ohne C, ein Mini-USB-B fuer den Service, ein
// USB-A „reserved for future developments", vier USB-A fuer die Peripherie.
// Als „9 x USB" gefuehrt waere es eine Zahl ohne Auskunft.
//
// ─── DIE LADELEISTUNG IST ABGABE, DIE AUFNAHME STEHT DANEBEN ───────────────
//
// „charging function up to 100W (120W total)" ist, was das Geraet an die
// Rechner abgibt. Was es zieht, steht als eigene Zeile: „Powering External
// 160W power supply · Power consumption (max) 150 W". NUR die 150 W stehen
// in `powerWatts` — die 120 W Ladeleistung sind ein Teil davon und kein
// Zusatz.
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
const usbC = (name: string) => port(name, 'USB-C', 'USB')
const usbA = (name: string) => port(name, 'USB Type A', 'USB')
const usbB = (name: string) => port(name, 'USB Type B', 'USB')
const lan = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const phoenix = (name: string) => port(name, 'Phoenix/Euroblock', 'Control')
const netzteil = () => port('DC In (externes 160-W-Netzteil)', 'Custom', 'Power')

const CONV = 'Converter'

interface LightwareEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const LIGHTWARE_CATALOG: LightwareEntry[] = [

  // Quelle: https://assets.prod.pim.lightware.com/assets/File-Downloads/Marketing-Literature/Product-Brief/UCX-4x2-HC40_Product_Brief.pdf
  {
    match: ['lightwareucx4x2hc40', 'ucx4x2hc40', 'taurusucx4x2'],
    deviceTypeId: 'b8531d47-0f62-4e98-a14c-73d95e206b8f',
    template: {
      manufacturerUrl: 'https://assets.prod.pim.lightware.com/assets/File-Downloads/Marketing-Literature/Product-Brief/UCX-4x2-HC40_Product_Brief.pdf',
      name: 'Lightware UCX-4x2-HC40',
      category: CONV,
      // Blatt: IN 2x HDMI Typ A mit Schraubsicherung + 2x USB-C mit
      // Schraubsicherung · OUT 2x HDMI · Ethernet 3x 100Base-T RJ-45
      // (Secure Control, Utility AV, Configurable) · RS232 2x 3-pol Phoenix ·
      // Raumbelegungsmelder 3-pol Phoenix · GPIO 8-pol Phoenix ·
      // USB: 2x USB-C mit Ladefunktion, 1x Mini-USB-B (Service), 1x USB-A
      // (reserviert), 1x USB-B + 1x USB-C fuer Rechner, 4x USB-A fuer
      // Peripherie.
      //
      // DREI ETHERNET-BUCHSEN MIT DREI ROLLEN, und das Blatt benennt sie
      // einzeln. Sie zusammenzufassen hiesse, die Trennung wegzuwerfen, fuer
      // die das Geraet gekauft wird: Steuerung, AV-Nutzlast und frei
      // konfigurierbar liegen absichtlich auf verschiedenen Buchsen.
      inputs: [
        hdmi('HDMI In 1'),
        hdmi('HDMI In 2'),
        usbC('USB-C In 1 (Video + Daten + Laden)'),
        usbC('USB-C In 2 (Video + Daten + Laden)'),
        lan('Ethernet (Secure Control)'),
        lan('Ethernet (Utility AV)'),
        lan('Ethernet (Configurable)'),
        phoenix('RS-232 1 (3-polig)'),
        phoenix('RS-232 2 (3-polig)'),
        phoenix('Raumbelegungsmelder (3-polig)'),
        phoenix('GPIO (8-polig)'),
        usbB('USB-B (Host-Daten)'),
        usbB('Mini-USB-B (Service)'),
        netzteil(),
      ],
      outputs: [
        hdmi('HDMI Out 1'),
        hdmi('HDMI Out 2'),
        usbA('USB-A 1 (Peripherie)'),
        usbA('USB-A 2 (Peripherie)'),
        usbA('USB-A 3 (Peripherie)'),
        usbA('USB-A 4 (Peripherie)'),
        usbA('USB-A (reserviert)'),
      ],
      powerWatts: 150,
      weightKg: 0.918,
      notes:
        'Höhe 26 mm, lüfterlos · externes 160-W-Netzteil, Aufnahme max. 150 W · Ladeleistung an die Rechner bis 100 W je Port, 120 W gesamt (Teil der 150 W) · bis UHD 4K@60 4:4:4, 18 Gbit/s',
      width: 280,
      height: 520,
    },
  },

  // Quelle: https://assets.prod.pim.lightware.com/assets/File-Downloads/Marketing-Literature/Product-Brief/UCX-2x1-HC40_Product_Brief.pdf
  {
    match: ['lightwareucx2x1hc40', 'ucx2x1hc40', 'taurusucx2x1'],
    deviceTypeId: '4e920c85-6b37-4a01-9d58-2f7013ea6c49',
    template: {
      manufacturerUrl: 'https://assets.prod.pim.lightware.com/assets/File-Downloads/Marketing-Literature/Product-Brief/UCX-2x1-HC40_Product_Brief.pdf',
      name: 'Lightware UCX-2x1-HC40',
      category: CONV,
      // Blatt: IN 1x HDMI + 1x USB-C · OUT 1x HDMI · Ethernet NUR ZWEI
      // (Utility AV, Configurable) — die dritte, „Secure Control", hat nur
      // der 4x2. Wer beide Geraete fuer gleich haelt, plant eine
      // Steuerleitung ein, die es hier nicht gibt.
      //
      // RS232 ist hier 1x 3-pol Phoenix statt zwei.
      inputs: [
        hdmi('HDMI In'),
        usbC('USB-C In (Video + Daten + Laden)'),
        lan('Ethernet (Utility AV)'),
        lan('Ethernet (Configurable)'),
        phoenix('RS-232 (3-polig)'),
        phoenix('Raumbelegungsmelder (3-polig)'),
        phoenix('GPIO (8-polig)'),
        usbB('USB-B (Host-Daten)'),
        usbB('Mini-USB-B (LDC-Steuerung)'),
        netzteil(),
      ],
      outputs: [
        hdmi('HDMI Out'),
        usbA('USB-A 1 (Peripherie)'),
        usbA('USB-A 2 (Peripherie)'),
        usbA('USB-A (Service)'),
      ],
      powerWatts: 150,
      notes:
        'lüfterlos · externes 160-W-Netzteil, Aufnahme max. 150 W · Ladeleistung am USB-C bis 100 W (Teil der 150 W)',
      width: 280,
      height: 420,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const lightwareTemplates: EquipmentTemplate[] = LIGHTWARE_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
