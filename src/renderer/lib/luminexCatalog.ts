import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Luminex GigaCore — Ethernet-Switches fuer die Veranstaltungstechnik.
//
// #878 nennt „Netzwerk" als Zielbereich, und `docs/katalog-luecken.md` hielt
// fest, dass er bei uns an EINEM Haus haengt (Ubiquiti). GigaCore ist in der
// Branche der andere Name: Switches mit etherCON-Buchsen, PoE ueber
// Steckmodul, und ab Werk auf Dante, sACN und Art-Net eingestellt.
//
// ─── WAS EINEN AV-SWITCH VON EINEM IT-SWITCH UNTERSCHEIDET ─────────────────
//
// Die Buchse. Das Spezifikationsblatt sagt es fuer die ganze Reihe:
// „12 x 10/100/1000Mbps shielded Neutrik Ethercon connectors — 10 on the
// front, 2 at the rear". Ein etherCON ist ein RJ45 in einer verriegelnden
// Huelse; das Kabel ist dasselbe, der Stecker nicht, und auf Tour ist genau
// das der Unterschied.
//
// VORN UND HINTEN STEHEN GETRENNT DA. Zehn Buchsen vorn, zwei hinten — wer
// das Geraet ins Rack schraubt, muss wissen, welche zwei er von hinten
// erreicht. Eine Liste aus zwoelf gleichen Zeilen sagt das nicht.
//
// ─── DER STROM IST DREI ANSCHLUESSE, NICHT EINER ───────────────────────────
//
// Die 14R und die 16Xt fuehren neben dem IEC-Eingang zwei weitere Buchsen:
// „1 x redundant power input on Molex Micro-Fit 6 pins connector" UND
// „1 x redundant PoE input" auf derselben Bauform. Das ist der Anschluss fuer
// das externe Netzteil (RPSU) — zweimal, fuer Netz und PoE getrennt. Wer nur
// den IEC zeichnet, plant die Redundanz weg, fuer die das Geraet gekauft
// wurde.
//
// Die Molex-Bauform steht als `Custom`: sie ist ein Geraetesteckverbinder und
// kein Stecker, den jemand konfektioniert. Ihn zu einem der vorhandenen Typen
// zu erklaeren waere eine Falschaussage in der Stueckliste.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Die Leistungsaufnahme. Das Blatt nennt sie fuer keines der Geraete; es
// nennt das PoE-BUDGET („Up to 160W spread on the ten front ports"), und das
// ist etwas anderes — es ist die Leistung, die das Geraet ABGIBT. Sie steht
// im `notes`-Feld als das, was sie ist.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const ec = (name: string) => port(name, 'etherCON', 'Ethernet')
const rj = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const sfp = (name: string) => port(name, 'SFP', 'Ethernet')
const sfpPlus = (name: string) => port(name, 'SFP+', 'Ethernet')
const iec = () => port('IEC Inlet (mit Sicherung)', 'IEC 230V', 'Power')
/** Der RPSU-Anschluss. Molex Micro-Fit, 6-polig — Geraetesteckverbinder. */
const rpsu = (name: string) => port(name, 'Custom', 'Power')

const NET = 'Networking'

// DAS GEMEINSAME SPEZIFIKATIONSBLATT der Reihe 12 / 14R / 16Xt / 16RFO steht
// bei jedem der vier Eintraege AUSGESCHRIEBEN und nicht als Konstante.
//
// Das ist Absicht und keine Nachlaessigkeit: `catalogSourceUrls.test.ts` liest
// die Quellen-Zeile ueber dem Eintrag und vergleicht sie mit dem
// `manufacturerUrl`-LITERAL in der Zeile darunter. Eine Konstante dazwischen
// macht den Beleg fuer den Waechter unsichtbar — er faellt dann still durch,
// und genau dagegen ist er geschrieben. Aus demselben Grund steht die Adresse
// jeweils auf EINER Zeile: ein Umbruch macht sie ebenso unsichtbar.

interface LuminexEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
  networkKind?: 'switch' | 'router'
}

export const LUMINEX_CATALOG: LuminexEntry[] = [

  // Quelle: https://www.luminex.be/wp-content/uploads/doccenter/gigacore_specifications_rev3-1.pdf
  {
    match: ['luminexgigacore12', 'gigacore12'],
    deviceTypeId: '7a2e5c81-3f94-4d60-b827-0c916e4a3d52',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.luminex.be/wp-content/uploads/doccenter/gigacore_specifications_rev3-1.pdf',
      name: 'Luminex GigaCore 12',
      category: NET,
      // Blatt: 12 x etherCON (10 vorn, 2 hinten) · 2 x SFP · 1 x serieller
      // RJ45-Konsolenport · 1 x RJ45-Erweiterungsport · 1 x IEC.
      // KEIN RPSU-Anschluss — das haben erst 14R und 16Xt.
      inputs: [iec(), port('Console (seriell, RJ45)', 'Ethernet/RJ45', 'Serial')],
      outputs: [
        ...Array.from({ length: 10 }, (_, i) => ec(`Port ${i + 1} (front)`)),
        ec('Port 11 (rear)'),
        ec('Port 12 (rear)'),
        sfp('SFP 1'),
        sfp('SFP 2'),
        rj('Expansion (RJ45)'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '32 Gbit/s · PoE 802.3af optional (Modul LU 01 00051-GC12), bis 160 W auf die zehn Frontports · PTP v2 · IGMP-Snooping ab Werk an',
      width: 260,
      height: 380,
    },
  },

  // Quelle: https://www.luminex.be/wp-content/uploads/doccenter/gigacore_specifications_rev3-1.pdf
  {
    match: ['luminexgigacore14r', 'gigacore14r'],
    deviceTypeId: 'd60b4f27-8a13-4e95-9c40-2b785d1e6f03',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.luminex.be/wp-content/uploads/doccenter/gigacore_specifications_rev3-1.pdf',
      name: 'Luminex GigaCore 14R',
      category: NET,
      // Blatt: 12 x etherCON (10 vorn, 2 hinten) · 4 x SFP · 1 x serieller
      // RJ45-Konsolenport · 1 x IEC · 1 x redundanter Netzeingang UND
      // 1 x redundanter PoE-Eingang, beide Molex Micro-Fit 6-polig.
      inputs: [
        iec(),
        rpsu('RPSU Mains (Molex Micro-Fit 6)'),
        rpsu('RPSU PoE (Molex Micro-Fit 6)'),
        port('Console (seriell, RJ45)', 'Ethernet/RJ45', 'Serial'),
      ],
      outputs: [
        ...Array.from({ length: 10 }, (_, i) => ec(`Port ${i + 1} (front)`)),
        ec('Port 11 (rear)'),
        ec('Port 12 (rear)'),
        ...Array.from({ length: 4 }, (_, i) => sfp(`SFP ${i + 1}`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '32 Gbit/s · PoE 802.3af optional (Modul LU 01 00051-GC14/16), bis 160 W auf die zehn Frontports · zwei Lüfter · PTP v2',
      width: 260,
      height: 400,
    },
  },

  // Quelle: https://www.luminex.be/wp-content/uploads/doccenter/gigacore_specifications_rev3-1.pdf
  {
    match: ['luminexgigacore16xt', 'gigacore16xt'],
    deviceTypeId: '1c83f5b9-6d27-4a08-be51-97d034e2a6b8',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.luminex.be/wp-content/uploads/doccenter/gigacore_specifications_rev3-1.pdf',
      name: 'Luminex GigaCore 16Xt',
      category: NET,
      // Blatt: wie 14R (12 x etherCON, 4 x SFP, Konsole, IEC, zwei
      // RPSU-Eingaenge).
      inputs: [
        iec(),
        rpsu('RPSU Mains (Molex Micro-Fit 6)'),
        rpsu('RPSU PoE (Molex Micro-Fit 6)'),
        port('Console (seriell, RJ45)', 'Ethernet/RJ45', 'Serial'),
      ],
      outputs: [
        ...Array.from({ length: 10 }, (_, i) => ec(`Port ${i + 1} (front)`)),
        ec('Port 11 (rear)'),
        ec('Port 12 (rear)'),
        ...Array.from({ length: 4 }, (_, i) => sfp(`SFP ${i + 1}`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '32 Gbit/s · PoE 802.3af optional, bis 160 W auf die zehn Frontports · zwei Lüfter',
      width: 260,
      height: 400,
    },
  },

  // Quelle: https://www.luminex.be/wp-content/uploads/doccenter/gigacore_specifications_rev3-1.pdf
  {
    match: ['luminexgigacore16rfo', 'gigacore16rfo'],
    deviceTypeId: 'f4917e35-2b68-4c1d-a073-5e8c62b940df',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.luminex.be/wp-content/uploads/doccenter/gigacore_specifications_rev3-1.pdf',
      name: 'Luminex GigaCore 16RFO',
      category: NET,
      // Blatt: 12 x etherCON (10 vorn, 2 hinten) · 4 SLOTS fuer robuste
      // Glasfaser-Steckverbinder nach D-Bauform (4 vorn, 4 hinten — also
      // acht Einbauplaetze fuer vier Strecken) · 1 x serieller RJ45 ·
      // 2 x Neutrik powerCON TRUE1 In/Out statt IEC.
      //
      // DER STROM GEHT HIER DURCH, anders als bei den Geschwistern: powerCON
      // TRUE1 In UND Out. Das ist der Unterschied zwischen „ein Kabel je
      // Geraet" und „eine Kette".
      inputs: [
        port('powerCON TRUE1 In', 'powerCON TRUE1', 'Power'),
        port('Console (seriell, RJ45)', 'Ethernet/RJ45', 'Serial'),
      ],
      outputs: [
        ...Array.from({ length: 10 }, (_, i) => ec(`Port ${i + 1} (front)`)),
        ec('Port 11 (rear)'),
        ec('Port 12 (rear)'),
        // Das Blatt sagt „4 x slots for D type compliant rugged fibre
        // connector" — es nennt also die BAUFORM des Einbauplatzes (D-Serie)
        // und nicht das Fabrikat. `Fiber` ist deshalb richtig und
        // `opticalCON` waere geraten: in einen D-Ausschnitt passt auch ein
        // anderes Fabrikat.
        ...Array.from({ length: 4 }, (_, i) => port(`Fibre Slot ${i + 1} (front, D-Typ)`, 'Fiber', 'Fiber')),
        ...Array.from({ length: 4 }, (_, i) => port(`Fibre Slot ${i + 5} (rear, D-Typ)`, 'Fiber', 'Fiber')),
        port('powerCON TRUE1 Out', 'powerCON TRUE1', 'Power'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '32 Gbit/s · Strom-Durchschleifung über powerCON TRUE1 · PoE 802.3af optional (Modul LU 01 00051-GC16 RFO), bis 160 W auf die zehn Frontports',
      width: 260,
      height: 440,
    },
  },

  // Quelle: https://www.luminex.be/wp-content/uploads/2023/06/Product-specification-sheet-GigaCore-16i-v1.0.0.pdf
  {
    match: ['luminexgigacore16i', 'gigacore16i'],
    deviceTypeId: '3e57b0a4-9c82-4f16-8d25-6a19c4e73b08',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.luminex.be/wp-content/uploads/2023/06/Product-specification-sheet-GigaCore-16i-v1.0.0.pdf',
      name: 'Luminex GigaCore 16i',
      category: NET,
      // Blatt: „GigaCore 16i-12x1G-4x10G(SFP+)" — zwoelf 1G-Kupferports mit
      // RJ45 und vier unabhaengige SFP+-Ports. Halbe 19-Zoll-Breite, fuer die
      // Festinstallation gedacht; deshalb RJ45 und nicht etherCON.
      inputs: [iec()],
      outputs: [
        ...Array.from({ length: 12 }, (_, i) => rj(`Port ${i + 1} (1G)`)),
        ...Array.from({ length: 4 }, (_, i) => sfpPlus(`SFP+ ${i + 1} (10G)`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        'halbe 19"-Breite · PoE++ optional, 90 W je Port, Budget bis 450 W · PTP v2 ab Werk · Araneo-Verwaltung',
      width: 260,
      height: 400,
    },
  },

  // Quelle: https://www.luminex.be/wp-content/uploads/2023/05/Prelimary_Product-specification-sheet-GigaCore-16t-v1.0.0.pdf
  {
    match: ['luminexgigacore16t', 'gigacore16t'],
    deviceTypeId: '9b40d182-5e73-4a29-bc06-8f2153d7e94c',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.luminex.be/wp-content/uploads/2023/05/Prelimary_Product-specification-sheet-GigaCore-16t-v1.0.0.pdf',
      name: 'Luminex GigaCore 16t',
      category: NET,
      // Blatt: „8 x 1Gbps copper ports with rugged EtherCON connectors. An
      // additional 8 x 1Gbps copper ports with RJ45 connectors".
      //
      // ACHT UND ACHT, UND SIE SIND NICHT DASSELBE: die etherCON gehen nach
      // draussen, die RJ45 bleiben im Rack. Wer sie als sechzehn gleiche
      // Ports fuehrt, steckt das Tourkabel in die falsche Reihe.
      inputs: [iec()],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => ec(`etherCON ${i + 1} (1G)`)),
        ...Array.from({ length: 8 }, (_, i) => rj(`RJ45 ${i + 1} (1G)`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        'PoE++ optional, 90 W je Port, Budget bis 500 W (1000 W im Doppelbetrieb) · AVB/MILAN ab Werk · E-Ink-Anzeige',
      width: 260,
      height: 400,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const luminexTemplates: EquipmentTemplate[] = LUMINEX_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
