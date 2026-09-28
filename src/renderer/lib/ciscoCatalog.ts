import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Cisco — Catalyst 9300/9300X und Nexus 93108TC-EX.
//
// Der dritte Teil der Netzwerk-Luecke aus #878: Luminex deckt die Tour ab,
// NETGEAR M4250 die AV-Festinstallation, Cisco das Haus-Netz, in dem beides
// haengt.
//
// ─── WARUM DIE UPLINKS HIER LEER BLEIBEN ───────────────────────────────────
//
// Das Blatt sagt bei beiden Catalyst nicht „4x SFP+", sondern „Modular
// uplinks": die Buchsen sitzen auf einem Netzwerkmodul, das getrennt bestellt
// wird (C9300-NM-4G, -8X, -4M, -2Y, -2Q). Ein Switch ohne Modul hat KEINE
// Uplink-Buchse.
//
// Vier oder acht Glasfaserports einzutragen, die je nach Bestellung da sind
// oder nicht, waere genau die Sorte plausible Erfindung, die dieser Katalog
// nicht fuehrt. Der Modulsteckplatz steht deshalb als das da, was er ist —
// ein Steckplatz — und die verfuegbaren Module stehen namentlich in `notes`.
// Wer sein Modul kennt, traegt die Ports am Geraet nach; wer es nicht kennt,
// sieht hier, dass die Frage offen ist, statt eine falsche Antwort zu sehen.
//
// ─── PoE IST ABGABE, NICHT AUFNAHME ────────────────────────────────────────
//
// Dieselbe Regel wie im NETGEAR-Katalog: „830W" beim C9300-24U ist, was der
// Switch mit dem mitgelieferten 1100-W-Netzteil an die Geraete abgeben kann.
// `powerWatts` bleibt leer, das Budget steht in `notes` als das, was es ist.
//
// ─── ZWEI NETZTEILE, UND BEIDE ZAEHLEN ─────────────────────────────────────
//
// Die Catalyst haben zwei Netzteil-Steckplaetze, ab Werk ist einer bestueckt.
// Beide stehen als Port, denn genau das ist die Frage im Stromplan: liegen
// hier eine oder zwei Zuleitungen. Steckplatz 2 traegt den Zusatz „leer ab
// Werk", damit niemand zwei Kabel plant, die es nicht gibt.
//
// ─── DER NEXUS IST KEIN AV-GERAET, UND DAS STEHT DA ─────────────────────────
//
// 93108TC-EX ist ein Rechenzentrums-Switch: 48x 10GBASE-T und 6x QSFP28,
// keine Speisung. Er steht hier, weil er in der Lueckenliste stand und in
// Haeusern wirklich vorkommt — aber ohne PoE plant man daran keine Kamera.
//
// ─── WAS DIESE DATEI NICHT FUEHRT ──────────────────────────────────────────
//
// Die Netzwerkmodule (C9300-NM-*) als eigene Eintraege. Sie sind
// Erweiterungskarten ohne eigene Speisung; in diesem Planer waeren sie
// Geraete ohne Ort. Sie gehoeren an das Geraet, in dem sie sitzen — solange
// es dafuer kein Feld gibt, stehen sie in `notes`.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const kupfer = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const poe = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet (PoE)')
const qsfp28 = (name: string) => port(name, 'QSFP28', 'Ethernet')
const c14 = (name: string) => port(name, 'IEC 230V', 'Power')

const NET = 'Networking'

interface CiscoEntry {
  deviceTypeId: string
  match: string[]
  networkKind: 'switch'
  template: EquipmentTemplate
}

// DIE ADRESSE STEHT BEI JEDEM EINTRAG AUSGESCHRIEBEN und nicht als Konstante:
// `catalogSourceUrls.test.ts` vergleicht die Quellen-Zeile ueber dem Eintrag
// mit dem `manufacturerUrl`-LITERAL darunter. Eine Konstante oder ein
// Zeilenumbruch macht den Beleg fuer den Waechter unsichtbar.

export const CISCO_CATALOG: CiscoEntry[] = [

  // Quelle: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html
  {
    match: ['c930024u', 'c930024um', 'ciscocatalyst930024u', 'catalyst930024u'],
    deviceTypeId: '6bbf7571-21cf-590c-bdd6-27ca73053454',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html',
      name: 'Cisco Catalyst 9300 24-Port UPOE (C9300-24U)',
      category: NET,
      // Blatt Tabelle 2: „24 ports Cisco UPOE" · „Modular uplinks" ·
      // „1100W AC". Tabelle 4: 830 W PoE mit dem Vorgabe-Netzteil.
      // Installationshandbuch, Rueckseiten-Legende: CONSOLE (RJ-45),
      // MGMT (RJ-45 10/100/1000), USB3.0-SSD, StackWise-480, StackPower,
      // zwei Netzteil-Steckplaetze, drei Luefter. Vorderseite: USB
      // Mini-Type-B Konsole, USB Type A Speicher, Netzwerkmodul-Steckplatz.
      inputs: [
        c14('AC In Netzteil 1 (IEC C14, 1100 W)'),
        c14('AC In Netzteil 2 (IEC C14, leer ab Werk)'),
        port('Console (USB Mini-B, vorn)', 'USB Mini-B', 'Serial'),
        port('Console (RS-232 auf RJ-45, hinten)', 'Ethernet/RJ45', 'Serial'),
        kupfer('MGMT (10/100/1000, out-of-band, hinten)'),
        port('USB Type A (Speicher, vorn)', 'USB Type A', 'USB'),
        port('USB 3.0 SSD (hinten)', 'USB 3 Type A', 'USB'),
      ],
      outputs: [
        ...Array.from({ length: 24 }, (_, i) => poe(`Port ${i + 1} (1G, UPOE 60 W)`)),
        // KEIN erfundener Uplink: das Blatt sagt „Modular uplinks".
        port('Netzwerkmodul-Steckplatz (Uplinks, Modul separat)', 'Generic', 'Ethernet'),
        port('StackWise-480', 'Multipin', 'Stacking'),
        port('StackPower', 'Multipin', 'Power'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '24x 1G Kupfer mit Cisco UPOE (60 W/Port) · PoE-Budget 830 W mit dem mitgelieferten 1100-W-Netzteil — Abgabe, nicht Aufnahme · Uplinks NUR über Netzwerkmodul: C9300-NM-4G (4x 1G SFP), -8X (8x 10G SFP+), -4M (4x mGig RJ45), -2Y (2x 25G SFP28), -2Q (2x 40G QSFP+) · 1 HE, 44 x 444 x 409 mm · zwei Netzteil-Steckplätze, einer ab Werk bestückt',
      width: 280,
      height: 700,
    },
  },

  // Quelle: https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html
  {
    match: ['c9300x48hxn', 'ciscocatalyst9300x48hxn', 'catalyst9300x48hxn'],
    deviceTypeId: '046833c5-b55d-500d-92d5-2d2121e15c5b',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html',
      name: 'Cisco Catalyst 9300X 48-Port UPOE+ (C9300X-48HXN)',
      category: NET,
      // Blatt Tabelle 2: „48 ports Cisco UPOE+, 8x 10G Multigigabit
      // (10G/5G/2.5G/1G/100M) + 40x 5G Multigigabit (5G/2.5G/1G/100M)" ·
      // „Modular uplinks" · „1100W AC". Tabelle 4: 690 W PoE mit dem
      // Vorgabe-Netzteil.
      //
      // DIE 48 PORTS SIND NICHT GLEICH — acht koennen 10G, vierzig nur 5G.
      // Das steht im Portnamen, weil genau daran eine Kamera mit 10G haengt
      // oder nicht.
      inputs: [
        c14('AC In Netzteil 1 (IEC C14, 1100 W)'),
        c14('AC In Netzteil 2 (IEC C14, leer ab Werk)'),
        port('Console (USB Mini-B, vorn)', 'USB Mini-B', 'Serial'),
        port('Console (RS-232 auf RJ-45, hinten)', 'Ethernet/RJ45', 'Serial'),
        kupfer('MGMT (10/100/1000, out-of-band, hinten)'),
        port('USB Type A (Speicher, vorn)', 'USB Type A', 'USB'),
        port('USB 3.0 SSD (hinten)', 'USB 3 Type A', 'USB'),
      ],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => poe(`Port ${i + 1} (mGig bis 10G, UPOE+ 90 W)`)),
        ...Array.from({ length: 40 }, (_, i) => poe(`Port ${i + 9} (mGig bis 5G, UPOE+ 90 W)`)),
        port('Netzwerkmodul-Steckplatz (Uplinks, Modul separat)', 'Generic', 'Ethernet'),
        port('StackWise-1T', 'Multipin', 'Stacking'),
        port('StackPower+', 'Multipin', 'Power'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '48x Multigigabit mit Cisco UPOE+ (90 W/Port), davon 8 bis 10G und 40 bis 5G · PoE-Budget 690 W mit dem mitgelieferten 1100-W-Netzteil — Abgabe, nicht Aufnahme · Uplinks NUR über Netzwerkmodul · 1 HE, 44 x 444 x 446 mm · zwei Netzteil-Steckplätze, einer ab Werk bestückt',
      width: 280,
      height: 700,
    },
  },

  // Quelle: https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus9000/hw/n93108tcex_hig/guide/b_c93108tcex_nxos_mode_hardware_install_guide/b_c93108tcex_nxos_mode_hardware_install_guide_chapter_01.html
  {
    match: ['n9kc93108tcex', 'nexus93108tcex', 'cisconexus93108tcex', '93108tcex'],
    deviceTypeId: '868d820a-a206-52a8-86f5-973d021b5c39',
    networkKind: 'switch',
    template: {
      manufacturerUrl: 'https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus9000/hw/n93108tcex_hig/guide/b_c93108tcex_nxos_mode_hardware_install_guide/b_c93108tcex_nxos_mode_hardware_install_guide_chapter_01.html',
      name: 'Cisco Nexus 93108TC-EX',
      category: NET,
      // Handbuch, Legende der Anschlussseite: „48 10GBASE-T downlink ports"
      // und „6 40/100-Gigabit QSFP28 optical uplink ports". Rueckseite:
      // Konsole (RS232), Out-of-band-Management EINMAL als RJ-45 UND einmal
      // als SFP, ein USB-Port, zwei Netzteile (1 + 1 Redundanz), vier
      // Luefter. Aufnahme laut Systemtabelle: 290 W typisch, 499 W maximal.
      //
      // KEINE SPEISUNG AN DEN PORTS — das ist der Unterschied zu allem
      // anderen in diesem Katalog und der Grund, warum daran keine Kamera
      // haengt.
      inputs: [
        c14('AC In Netzteil 1 (IEC C14)'),
        c14('AC In Netzteil 2 (IEC C14, Redundanz)'),
        port('Console (RS-232)', 'Ethernet/RJ45', 'Serial'),
        kupfer('MGMT (out-of-band, RJ-45)'),
        port('MGMT (out-of-band, SFP)', 'SFP', 'Ethernet'),
        port('USB (Sichern/Kopieren)', 'USB Type A', 'USB'),
      ],
      outputs: [
        ...Array.from({ length: 48 }, (_, i) => kupfer(`Port ${i + 1} (10GBASE-T, 100M/1G/10G)`)),
        ...Array.from({ length: 6 }, (_, i) => qsfp28(`Uplink ${i + 1} (QSFP28, 40G/100G)`)),
      ],
      isRackDevice: true,
      rackUnits: 1,
      powerWatts: 290,
      notes:
        '48x 10GBASE-T Kupfer OHNE PoE + 6x QSFP28 (40/100G) · Aufnahme 290 W typisch, 499 W maximal · 439 x 44 x 571 mm · 8,0 kg · zwei Netzteile (1 + 1 Redundanz), vier Lüfter · Rechenzentrums-Switch: keine Speisung an den Ports',
      width: 280,
      height: 700,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const ciscoTemplates: EquipmentTemplate[] = CISCO_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
