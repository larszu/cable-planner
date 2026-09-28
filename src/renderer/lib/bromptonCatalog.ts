import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Brompton Technology — Tessera-LED-Prozessoren.
//
// #878 nennt LED-Prozessoren als den Bereich, der bei NULL stand („LED-
// Prozessoren fehlen ganz. Nicht duenn besetzt — es gibt die Kategorie
// nicht."). `ledProcessorCatalog.ts` hat ihn am 2026-09-23 mit zwei
// Eintraegen eroeffnet (darunter der Tessera SX40); hier kommen vier
// weitere Brompton dazu.
//
// ─── WAS EIN LED-PROZESSOR IM KABELPLAN IST ────────────────────────────────
//
// Ein Geraet mit WENIGEN Eingaengen und VIELEN gleichartigen Ausgaengen — und
// die Ausgaenge sind Ethernet, fuehren aber kein Netzwerk, sondern das
// Tessera-Protokoll zu den Kacheln. Sie stehen deshalb mit dem Signaltyp
// `Tessera` da und nicht als `Ethernet`: wer sie fuer Netzwerk-Ports haelt,
// haengt einen Switch dazwischen, und das Bild steht.
//
// ─── DIE BUCHSE IST NEUTRIK, NICHT RJ45 ────────────────────────────────────
//
// Die Blaetter sind da ausdruecklich: „Supports Neutrik etherCON Cat 6A /
// etherCON (CAT5e) connectors. Compatible with standard Cat6A / Cat5e RJ45
// connectors." Also etherCON — ein RJ45 in einer verriegelnden Huelse. Das
// Kabel ist dasselbe, der Stecker nicht, und auf Tour ist genau das der
// Unterschied. Ein eigener Steckertyp `etherCON` fehlt im Vokabular; die
// Buchse steht als `Ethernet/RJ45` (der RJ45-Stecker passt), das Wort
// etherCON im Kommentar der Helfer-Funktion.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Die Leistungsaufnahme in Watt. Die Blaetter nennen Spannung und Strom
// („100-240V AC, 1.2 - 0.6A"), also die AUFNAHME bei 100 V und bei 240 V. Eine
// Wattzahl daraus zu rechnen waere eine Scheingenauigkeit: 1.2 A bei 100 V
// sind 120 VA, und wie viel davon Wirkleistung ist, sagt kein Blatt.
// Stattdessen steht der Bereich im `notes`-Feld, wie er dasteht.
//
// Der M2 fehlt: unter `product/m2/` liegt kein Datenblatt-PDF (gemessen
// 2026-09-24). Ohne Blatt kein Eintrag.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

/** Ein Tessera-Ausgang. etherCON-Buchse, Tessera-Protokoll — nicht Netzwerk. */
const tessera = (name: string) => port(name, 'Ethernet/RJ45', 'Tessera')
const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const usb = (name: string) => port(name, 'USB', 'USB')
const dmxIn = () => port('DMX In (5-pol)', 'DMX 5-pol (XLR)', 'DMX')
const dmxThru = () => port('DMX Thru (5-pol)', 'DMX 5-pol (XLR)', 'DMX')
const mains = () => port('Mains In (100–240 V)', 'IEC 230V', 'Power')

const LED = 'LED Processing'

interface BromptonEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const BROMPTON_CATALOG: BromptonEntry[] = [


  // Quelle: https://www.bromptontech.com/wp-content/uploads/2025/07/Brompton-S8-Data-Sheet-Mar2025-EN.pdf
  {
    match: ['bromptontesseras8', 'tesseras8'],
    deviceTypeId: 'b73e0f62-9c14-4a58-8d07-1f6b3e9a2c54',
    template: {
      manufacturerUrl: 'https://www.bromptontech.com/wp-content/uploads/2025/07/Brompton-S8-Data-Sheet-Mar2025-EN.pdf',
      name: 'Brompton Tessera S8',
      category: LED,
      // Blatt: wie SX40 auf der Eingangsseite (HDMI 2.0, 12G-SDI, Sync, DMX,
      // 2x Management), aber ACHT 1-Gigabit-Ausgaenge statt vier 10G —
      // 4,5 Mio. Pixel statt 9.
      inputs: [
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('12G-SDI In', 'BNC', 'SDI'),
        port('Sync In (Bi/Tri-Level)', 'BNC', 'Genlock'),
        dmxIn(),
        eth('Management 1'),
        eth('Management 2'),
        usb('USB 3.0 (rear) 1'),
        usb('USB 3.0 (rear) 2'),
        mains(),
      ],
      outputs: [
        port('12G-SDI Thru (re-clocked)', 'BNC', 'SDI'),
        port('Sync Thru', 'BNC', 'Genlock'),
        dmxThru(),
        port('Monitor Out (DP++)', 'DisplayPort', 'DisplayPort'),
        ...Array.from({ length: 8 }, (_, i) => tessera(`Tessera 1G ${i + 1}`)),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes: '19" 2 HE · 482.6 x 88.9 x 406.4 mm · 100–240 V AC, 1.2–0.6 A · 4,5 Mio. Pixel',
      width: 280,
      height: 420,
    },
  },

  // Quelle: https://www.bromptontech.com/wp-content/uploads/2024/09/Brompton-S4-Data-Sheet-Sep2024-EN.pdf
  {
    match: ['bromptontesseras4', 'tesseras4'],
    deviceTypeId: 'e2947b08-6d51-4c39-ab72-0e5d8c3f6194',
    template: {
      manufacturerUrl: 'https://www.bromptontech.com/wp-content/uploads/2024/09/Brompton-S4-Data-Sheet-Sep2024-EN.pdf',
      name: 'Brompton Tessera S4',
      category: LED,
      // Blatt: EIN DVI-D-Eingang mit Thru, vier 1G-Tessera-Ausgaenge, EIN
      // Gigabit-Netzport (nicht zwei wie beim S8), kein DMX, kein Sync-Eingang
      // — der S4 kann nur „lock to source".
      inputs: [
        port('DVI-D In', 'DVI', 'DVI'),
        eth('Management'),
        usb('USB 2.0 (rear) 1'),
        usb('USB 2.0 (rear) 2'),
        mains(),
      ],
      outputs: [
        port('DVI-D Thru', 'DVI', 'DVI'),
        port('Monitor Out (DP++)', 'DisplayPort', 'DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => tessera(`Tessera 1G ${i + 1}`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '19" · 100–240 V AC, 0.4–0.2 A · 4 x 525K Pixel bei 8 bpc/60 Hz',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://www.bromptontech.com/wp-content/uploads/2024/09/Brompton-T1-Data-Sheet-Sep2024-EN.pdf
  {
    match: ['bromptontesserat1', 'tesserat1'],
    deviceTypeId: '4f80c5a1-3e76-4b92-85d4-7c1a0b6e9d38',
    template: {
      manufacturerUrl: 'https://www.bromptontech.com/wp-content/uploads/2024/09/Brompton-T1-Data-Sheet-Sep2024-EN.pdf',
      name: 'Brompton Tessera T1',
      category: LED,
      // Blatt: EIN DVI-D-Eingang mit Thru, EIN Tessera-Ausgang, DMX In & Thru,
      // ein Gigabit-Netzport. Das kleinste Geraet der Reihe.
      inputs: [
        port('DVI-D In', 'DVI', 'DVI'),
        dmxIn(),
        eth('Management'),
        usb('USB 2.0 (rear) 1'),
        usb('USB 2.0 (rear) 2'),
        mains(),
      ],
      outputs: [
        port('DVI-D Thru', 'DVI', 'DVI'),
        dmxThru(),
        port('Monitor Out (DP++)', 'DisplayPort', 'DisplayPort'),
        tessera('Tessera 1G'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '19" · 100–240 V AC, 0.4–0.2 A · bis 1920 x 1080 @ 60 Hz',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://www.bromptontech.com/wp-content/uploads/2026/03/Brompton-XD-Data-Sheet-Mar2026-EN.pdf
  {
    match: ['bromptontesseraxd10g', 'tesseraxd', 'xd10g'],
    deviceTypeId: '0a63d9f4-8b27-4e15-9c80-2d7f5a1e3b06',
    template: {
      manufacturerUrl: 'https://www.bromptontech.com/wp-content/uploads/2026/03/Brompton-XD-Data-Sheet-Mar2026-EN.pdf',
      name: 'Brompton Tessera XD 10G',
      category: LED,
      // Blatt: EIN 10G-Tessera-Kupfereingang „for connection from SX40" und
      // ZEHN 1G-Ausgaenge. Der XD ist kein Prozessor, sondern der Verteiler
      // dahinter — ein Eingang, zehn Ausgaenge.
      //
      // DER STROM GEHT DURCH: „PowerCON TRUE1 Input and Thru […] Rated at 5 XD
      // Units." Also fuenf Geraete an einem Kabel, und das steht in der
      // Stromrechnung.
      inputs: [
        tessera('Tessera 10G In (von SX40)'),
        port('powerCON TRUE1 In', 'Custom', 'Power'),
      ],
      outputs: [
        ...Array.from({ length: 10 }, (_, i) => tessera(`Tessera 1G ${i + 1}`)),
        port('powerCON TRUE1 Thru', 'Custom', 'Power'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '100–240 V AC, 0.4–0.2 A · Strom-Durchschleifung für bis zu 5 XD · je Ausgang 525K Pixel bei 8 bpc/60 Hz',
      width: 280,
      height: 340,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const bromptonTemplates: EquipmentTemplate[] = BROMPTON_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
