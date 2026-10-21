import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Welle 4c — Nachtrag der Geräte, die frühere Läufe mit „kein Datenblatt“ oder
// „403“ übersprungen haben (Lynx Technik, Lightware, IDK).
//
// ─── WOHER DIE BLÄTTER KOMMEN ──────────────────────────────────────────────
//
// lynx-technik.com antwortet weiterhin 403; lynx-usa.com (LYNX Technik Inc.)
// liefert dieselben Datenblätter, aber nur hinter einer Browser-Prüfung —
// die Blätter wurden im Browser gelesen. PDM 1284 B liegt bei Canford, PDM
// 1284 D bei einem Händler-Bildserver; beides Original-Blätter von LYNX.
// Lightware: A&E-Spezifikation (assets.prod.pim.lightware.com), Quick Start
// Guide (dvsgroup.com), MX-Frame-Produktbroschüre (rentex.com) und das VINX-
// Handbuch (av.digis.ru). IDK: Spec-Sheets direkt von idkav.com.
//
// ─── MODELLNAMEN, DIE ANDERS HEISSEN ALS GESUCHT ───────────────────────────
//
// VINX: Encoder ist der VINX-120AP-HDMI-ENC, Decoder der VINX-110AP-HDMI-DEC
// (nicht umgekehrt).
// „MX33x33DVI-Pro“ / „MX65x65DVI“: die MX-Serie ist modular. Gebaut als
// MX-FR33L bzw. MX-FR65R mit Single-Link-DVI-Karten (MX-DVID-IB / -OB, je 8
// Ports) plus TEST-Eingang und PREVIEW-Ausgang der MX-CPU2 — so entstehen
// 33x33 und 65x65.
// „IDK FDX-32x32(-HDMI2.0)“: der aktuelle 32x32-Rahmen ist der FDX-S32U.
// Eingetragen in der Standard-Bestückung 8x FDX-SIV4UH + 8x FDX-SOV4UH
// (32x HDMI rein/raus), ohne Audiokarte und ohne Redundanz-Netzteil.
//
// ─── WAS NOCH FEHLT ────────────────────────────────────────────────────────
//
// MX2-32x32-HDMI20-A-R: die 8 „Independent analog audio“-Ports nennt die
// A&E-Spezifikation ohne Richtung — sie stehen nicht im Eintrag.
// Netzbuchsen nur, wo das Blatt den Stecker nennt; sonst Spannung in `notes`.
//
// Weiter übersprungen: keines. Versucht und gescheitert:
//   https://www.lynx-technik.com/products/yellobrik/… (403)
//   https://assets.prod.pim.lightware.com/…/MX2-8x8-HDMI20-Audio-L_AE_Specification.pdf (403)
//   https://assets.prod.pim.lightware.com/…/MX33x33DVI-Pro_AE_Specification.pdf (403)
//   web.archive.org (zeitweise offline)
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const n = (count: number, f: (i: number) => Port): Port[] => Array.from({ length: count }, (_, i) => f(i + 1))

const ROUTER = 'Video Router'
const CONV = 'Converter'
const IP = 'IP/NDI'

interface W4cEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const ROUTING_NACHTRAG_CATALOG: W4cEntry[] = [
  // Quelle: https://www.canford.de/ProductResources/resources/L/Lynx/Yellobrik/Lynx%20Yellobrik%20PDM%201284B-rev5%20AES%20Unbalanced%20Embed_DeEmbedder%20.pdf
  {
    match: ['lynxpdm1284b', 'pdm1284b', 'yellobrikpdm1284b'],
    deviceTypeId: '77aee18a-e774-49c5-b243-4be4802bfdf5',
    template: {
      manufacturerUrl: 'https://www.canford.de/ProductResources/resources/L/Lynx/Yellobrik/Lynx%20Yellobrik%20PDM%201284B-rev5%20AES%20Unbalanced%20Embed_DeEmbedder%20.pdf',
      name: 'Lynx Technik yellobrik PDM 1284 B',
      category: CONV,
      // Blatt: „4 x AES3id unbalanced inputs or outputs on 75 Ohm BNC
      // connectors“ — je Paar umschaltbar, deshalb als Eingänge geführt.
      inputs: [
        port('SDI In', 'BNC', 'SDI'),
        ...n(4, (i) => port(`AES ${i} In/Out (umschaltbar)`, 'BNC', 'AES')),
        port('Fiber In (SFP, Option)', 'SFP', 'Fiber'),
      ],
      outputs: [
        port('SDI Out', 'BNC', 'SDI'),
        port('Fiber Out (SFP, Option)', 'SFP', 'Fiber'),
      ],
      notes: 'Embedder/De-Embedder bis 3G · +12 V DC (Netzteil im Lieferumfang) · 105 x 95 x 22 mm',
      width: 200,
      height: 180,
    },
  },

  // Quelle: https://bpm-media.imgbolt.de/media/pdf/07/65/f6/EN_Lynx_PDM_1284D.pdf
  {
    match: ['lynxpdm1284d', 'pdm1284d', 'yellobrikpdm1284d'],
    deviceTypeId: '9c6ab459-f0ba-4131-8fc0-812a98b4870b',
    template: {
      manufacturerUrl: 'https://bpm-media.imgbolt.de/media/pdf/07/65/f6/EN_Lynx_PDM_1284D.pdf',
      name: 'Lynx Technik yellobrik PDM 1284 D',
      category: CONV,
      // Blatt: 4x AES3 symmetrisch rein UND 4x raus, alle auf EINER 25-pol.
      // SubD (110 Ohm); Schraubklemmen-Adapter liegt bei.
      inputs: [
        port('SDI In', 'BNC', 'SDI'),
        port('AES In 1–4 (SubD 25)', 'DB25', 'AES'),
        port('Fiber In (SFP, Option)', 'SFP', 'Fiber'),
      ],
      outputs: [
        port('SDI Out', 'BNC', 'SDI'),
        port('AES Out 1–4 (SubD 25)', 'DB25', 'AES'),
        port('Fiber Out (SFP, Option)', 'SFP', 'Fiber'),
      ],
      notes: 'Embedder/De-Embedder bis 3G · AES-Ein- und Ausgänge teilen sich die SubD-25 · +12 V DC · 105 x 95 x 22 mm',
      width: 200,
      height: 160,
    },
  },

  // Quelle: https://lynx-usa.com/wp-content/uploads/2025/07/PVD1800-rev09-1.pdf
  {
    match: ['lynxpvd1800', 'pvd1800', 'yellobrikpvd1800'],
    deviceTypeId: 'aaa4a5c9-3dca-4ffc-9e74-542e7eac0b9f',
    template: {
      manufacturerUrl: 'https://lynx-usa.com/wp-content/uploads/2025/07/PVD1800-rev09-1.pdf',
      name: 'Lynx Technik yellobrik PVD 1800',
      category: CONV,
      inputs: [
        port('SDI In', 'BNC', 'SDI'),
        port('Reference In', 'BNC', 'Genlock'),
        port('Fiber I/O (SFP, Option)', 'SFP', 'Fiber'),
        port('GPI (4x)', 'Ethernet/RJ45', 'GPI'),
        port('USB (yelloGUI)', 'USB Mini-B', 'USB'),
      ],
      outputs: [
        port('SDI Out 1', 'BNC', 'SDI'),
        port('SDI Out 2', 'BNC', 'SDI'),
      ],
      notes: '3G Frame Sync + Up/Down/Cross · bis 30 Frames Delay · +12 V DC, 5,8 W (ohne SFP) · 138 x 90 x 22 mm',
      width: 200,
      height: 200,
    },
  },

  // Quelle: https://lynx-usa.com/wp-content/uploads/2015/02/CHD1812-1_DS_rev12.pdf
  {
    match: ['lynxchd1812', 'chd1812', 'yellobrikchd1812'],
    deviceTypeId: '23aebb5f-44af-40e9-a148-b60f5b487dd8',
    template: {
      manufacturerUrl: 'https://lynx-usa.com/wp-content/uploads/2015/02/CHD1812-1_DS_rev12.pdf',
      name: 'Lynx Technik yellobrik CHD 1812',
      category: CONV,
      inputs: [
        port('HDMI In', 'HDMI', 'HDMI'),
        port('Reference In', 'BNC', 'Genlock'),
        port('Audio In L', 'Jack 6.35 mm TRS', 'Audio'),
        port('Audio In R', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      outputs: [
        port('SDI Out 1', 'BNC', 'SDI'),
        port('SDI Out 2', 'BNC', 'SDI'),
        port('Fiber Out (SFP, Option)', 'SFP', 'Fiber'),
      ],
      notes: 'HDMI → 3G-SDI mit Frame Sync · Audio symmetrisch oder unsymmetrisch (Cinch-Adapter beiliegend) · +12 V DC, 4,7 W · 138 x 90 x 22 mm',
      width: 200,
      height: 180,
    },
  },

  // Quelle: https://lynx-usa.com/wp-content/uploads/2015/05/OTX1712-2_DS_rev12.pdf
  {
    match: ['lynxotx1712', 'otx1712', 'otx17122', 'yellobrikotx1712'],
    deviceTypeId: 'feeda4ca-b01e-42ba-b8cf-f1be4c3c390f',
    template: {
      manufacturerUrl: 'https://lynx-usa.com/wp-content/uploads/2015/05/OTX1712-2_DS_rev12.pdf',
      name: 'Lynx Technik yellobrik OTX 1712',
      category: CONV,
      // Blatt: Analog-Sync/FBAS rein, passiver Loop (unbenutzt mit 75 Ohm
      // abschließen), Glasfaser über SFP (LC, ST oder SC je Variante).
      inputs: [port('Analog Sync/Video In', 'BNC', 'Analog Video')],
      outputs: [
        port('Loop Out (passiv)', 'BNC', 'Analog Video'),
        port('Fiber Out (SFP)', 'SFP', 'Fiber'),
      ],
      notes: 'Black Burst, Tri-Level, NTSC/PAL · 10 km SM / 300 m MM · +12 V DC, 3,4 W · 140 x 42 x 22 mm',
      width: 200,
      height: 140,
    },
  },

  // Quelle: https://lynx-usa.com/wp-content/uploads/2015/05/ORX1702-1_DS-rev07.pdf
  {
    match: ['lynxorx1702', 'orx1702', 'orx17021', 'yellobrikorx1702'],
    deviceTypeId: '81c5f98d-daee-4cf1-a089-319f091731ef',
    template: {
      manufacturerUrl: 'https://lynx-usa.com/wp-content/uploads/2015/05/ORX1702-1_DS-rev07.pdf',
      name: 'Lynx Technik yellobrik ORX 1702',
      category: CONV,
      inputs: [port('Fiber In (SFP)', 'SFP', 'Fiber')],
      outputs: [
        port('Analog Sync/Video Out 1', 'BNC', 'Analog Video'),
        port('Analog Sync/Video Out 2', 'BNC', 'Analog Video'),
      ],
      notes: 'Gegenstück zum OTX 1712 · LC/ST/SC Singlemode oder LC Multimode · +12 V DC, 3,5 W · 140 x 42 x 22 mm',
      width: 200,
      height: 140,
    },
  },

  // Quelle: https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/MX2-32x32-HDMI20-A-R_AE_Specification.pdf
  {
    match: ['lightwaremx232x32hdmi20ar', 'mx232x32hdmi20ar', 'mx232x32audior', 'mx232x32hdmi20audior'],
    deviceTypeId: 'b4957c7a-7559-4093-af8f-f2c67793ee1f',
    template: {
      manufacturerUrl: 'https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/MX2-32x32-HDMI20-A-R_AE_Specification.pdf',
      name: 'Lightware MX2-32x32-HDMI20-A-R',
      category: ROUTER,
      // Blatt: Analog-Audio-Einbettung an HDMI-Eingang 1–16, De-Embedding an
      // HDMI-Ausgang 1–8, je 5-pol. Phoenix. Redundant: zwei powerCON.
      inputs: [
        ...n(32, (i) => port(`HDMI In ${i}`, 'HDMI', 'HDMI')),
        ...n(16, (i) => port(`Audio In ${i} (zu HDMI In ${i})`, 'Phoenix/Euroblock', 'Audio')),
        port('LAN', 'etherCON', 'Ethernet'),
        port('RS-232', 'DB9', 'RS-232'),
        port('USB (Front)', 'USB Mini-B', 'USB'),
        port('AC In 1', 'PowerCON', 'Power'),
        port('AC In 2', 'PowerCON', 'Power'),
      ],
      outputs: [
        ...n(32, (i) => port(`HDMI Out ${i}`, 'HDMI', 'HDMI')),
        ...n(8, (i) => port(`Audio Out ${i} (von HDMI Out ${i})`, 'Phoenix/Euroblock', 'Audio')),
      ],
      isRackDevice: true,
      rackUnits: 8,
      notes: '32x32 HDMI 2.0, HDCP 2.3 · 100–240 V AC, redundant · 8 HE, 440,5 x 355 x 280,2 mm · 8 unabhängige Analog-Audio-Ports ohne Richtungsangabe nicht eingetragen',
      width: 360,
      height: 1400,
    },
  },

  // Quelle: https://dvsgroup.com/f/media/150
  {
    match: ['lightwaremx28x8hdmi20audiol', 'mx28x8hdmi20audiol', 'mx28x8audiol'],
    deviceTypeId: 'a92fc17c-94f5-4be3-a815-bc3fdc8deb42',
    template: {
      manufacturerUrl: 'https://dvsgroup.com/f/media/150',
      name: 'Lightware MX2-8x8-HDMI20-Audio-L',
      category: ROUTER,
      // Quick Start Guide: -Audio-Modelle haben je HDMI-Eingang einen 5-pol.
      // Phoenix-Audioeingang und je HDMI-Ausgang einen Audioausgang. Nicht-R:
      // IEC-Netz, RS-232 3-pol. Phoenix, LAN RJ45.
      inputs: [
        ...n(8, (i) => port(`HDMI In ${i}`, 'HDMI', 'HDMI')),
        ...n(8, (i) => port(`Audio In ${i}`, 'Phoenix/Euroblock', 'Audio')),
        port('LAN', 'Ethernet/RJ45', 'Ethernet'),
        port('RS-232', 'Phoenix/Euroblock', 'RS-232'),
        port('USB (Front)', 'USB Mini-B', 'USB'),
        port('AC In', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(8, (i) => port(`HDMI Out ${i}`, 'HDMI', 'HDMI')),
        ...n(8, (i) => port(`Audio Out ${i}`, 'Phoenix/Euroblock', 'Audio')),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '8x8 HDMI 2.0 mit analoger Audio-Ein-/Ausbettung · 100–240 V AC',
      width: 300,
      height: 520,
    },
  },

  // Quelle: https://www.rentex.com/wp-content/uploads/2016/08/Lightware-MX-FR33L-Product-Brief.pdf
  {
    match: ['lightwaremx33x33dvipro', 'mx33x33dvipro', 'mx33x33dvi', 'lightwaremxfr33l', 'mxfr33l'],
    deviceTypeId: '6df3d58e-ddfe-4c8b-bf94-56c8e6b1caa6',
    template: {
      manufacturerUrl: 'https://www.rentex.com/wp-content/uploads/2016/08/Lightware-MX-FR33L-Product-Brief.pdf',
      name: 'Lightware MX-FR33L (33x33 DVI)',
      category: ROUTER,
      // Bestückung: 4x MX-DVID-IB + 4x MX-DVID-OB (je 8 DVI-D) = 32x32, dazu
      // TEST-Eingang und PREVIEW-Ausgang der MX-CPU2 = 33x33.
      inputs: [
        ...n(32, (i) => port(`DVI In ${i}`, 'DVI', 'DVI')),
        port('DVI Test In 33 (CPU2)', 'DVI', 'DVI'),
        port('Genlock In', 'BNC', 'Genlock'),
        port('LAN', 'Ethernet/RJ45', 'Ethernet'),
        port('RS-232', 'DB9', 'RS-232'),
        port('USB (Front)', 'USB', 'USB'),
        port('AC In', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(32, (i) => port(`DVI Out ${i}`, 'DVI', 'DVI')),
        port('DVI Preview Out 33 (CPU2)', 'DVI', 'DVI'),
        port('Genlock Loop', 'BNC', 'Genlock'),
        port('Alarm Out (SMPTE 269M)', 'BNC', 'Alarm'),
      ],
      isRackDevice: true,
      rackUnits: 6,
      notes: 'Modularer Rahmen, hier Single-Link-DVI-Bestückung · ein Netzteil, nicht redundant · 26 W ohne Karten · 482 x 265,5 x 300 mm',
      width: 340,
      height: 1500,
    },
  },

  // Quelle: https://www.rentex.com/wp-content/uploads/2016/08/Lightware-MX-FR33L-Product-Brief.pdf
  {
    match: ['lightwaremx65x65dvi', 'mx65x65dvi', 'mx65x65dvipro', 'lightwaremxfr65r', 'mxfr65r'],
    deviceTypeId: '6b5edc25-7d2c-46b6-a9ab-937a4b298dc6',
    template: {
      manufacturerUrl: 'https://www.rentex.com/wp-content/uploads/2016/08/Lightware-MX-FR33L-Product-Brief.pdf',
      name: 'Lightware MX-FR65R (65x65 DVI)',
      category: ROUTER,
      // Bestückung: 8x MX-DVID-IB + 8x MX-DVID-OB (je 8 DVI-D) = 64x64, dazu
      // TEST/PREVIEW der MX-CPU2 = 65x65. Zwei Hot-Swap-Netzteile.
      inputs: [
        ...n(64, (i) => port(`DVI In ${i}`, 'DVI', 'DVI')),
        port('DVI Test In 65 (CPU2)', 'DVI', 'DVI'),
        port('Genlock In', 'BNC', 'Genlock'),
        port('LAN', 'Ethernet/RJ45', 'Ethernet'),
        port('RS-232', 'DB9', 'RS-232'),
        port('USB (Front)', 'USB', 'USB'),
        port('AC In PSU 1', 'IEC 230V', 'Power'),
        port('AC In PSU 2', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(64, (i) => port(`DVI Out ${i}`, 'DVI', 'DVI')),
        port('DVI Preview Out 65 (CPU2)', 'DVI', 'DVI'),
        port('Genlock Loop', 'BNC', 'Genlock'),
        port('Alarm Out (SMPTE 269M)', 'BNC', 'Alarm'),
      ],
      isRackDevice: true,
      rackUnits: 15,
      notes: 'Modularer Rahmen, hier Single-Link-DVI-Bestückung · 2 redundante Netzteile · 114 W ohne Karten · 482 x 665 x 392 mm',
      width: 340,
      height: 2800,
    },
  },

  // Quelle: https://av.digis.ru/upload/iblock/330/49628_VINX_UsersManual.pdf
  {
    match: ['lightwarevinx120aphdmienc', 'vinx120aphdmienc', 'vinx120ap'],
    deviceTypeId: '68ccd03d-4d7c-4354-9617-38d46984e557',
    template: {
      manufacturerUrl: 'https://av.digis.ru/upload/iblock/330/49628_VINX_UsersManual.pdf',
      name: 'Lightware VINX-120AP-HDMI-ENC',
      category: IP,
      // Handbuch: AV-Port als RJ45 ODER SFP-Slot (nur einer zugleich), PoE
      // über RJ45. RS-232 laut Produktübersicht D-SUB9 (Spezifikationsteil
      // nennt 3-pol. Phoenix — Übersicht mit Rückansicht hier maßgeblich).
      inputs: [
        port('HDMI In', 'HDMI', 'HDMI'),
        port('Audio In (unsymmetrisch)', 'Jack 3.5 mm TRS', 'Audio'),
        port('USB (Host)', 'USB Type B', 'USB'),
        port('RS-232', 'DB9', 'RS-232'),
        port('DC 12V In', 'DC Barrel', 'Power'),
      ],
      outputs: [
        port('AV Stream (PoE)', 'Ethernet/RJ45', 'Ethernet'),
        port('AV Stream (SFP)', 'SFP', 'Ethernet'),
        port('HDMI Out (lokal)', 'HDMI', 'HDMI'),
        port('Audio Out (Rückweg)', 'Jack 3.5 mm TRS', 'Audio'),
        port('IR Out', 'Jack 3.5 mm TS', 'IR'),
      ],
      notes: 'AV-over-IP Encoder 4K30 4:4:4, HDCP 2.2 · 12 V DC oder PoE (802.3at) · 4,4–7,5 W · 221 x 105,3 x 26 mm',
      width: 220,
      height: 220,
    },
  },

  // Quelle: https://av.digis.ru/upload/iblock/330/49628_VINX_UsersManual.pdf
  {
    match: ['lightwarevinx110aphdmidec', 'vinx110aphdmidec', 'vinx110ap'],
    deviceTypeId: '1fbbb500-ad69-4f3f-a736-5bd2581acf54',
    template: {
      manufacturerUrl: 'https://av.digis.ru/upload/iblock/330/49628_VINX_UsersManual.pdf',
      name: 'Lightware VINX-110AP-HDMI-DEC',
      category: IP,
      inputs: [
        port('AV Stream (PoE)', 'Ethernet/RJ45', 'Ethernet'),
        port('AV Stream (SFP)', 'SFP', 'Ethernet'),
        port('MIC In (Elektret, Rückweg)', 'Jack 3.5 mm TRS', 'Audio'),
        port('IR In', 'Jack 3.5 mm TRS', 'IR'),
        port('RS-232', 'DB9', 'RS-232'),
        port('DC 12V In', 'DC Barrel', 'Power'),
      ],
      outputs: [
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('Audio Out', 'Jack 3.5 mm TRS', 'Audio'),
        ...n(4, (i) => port(`USB ${i} (Gerät)`, 'USB Type A', 'USB')),
      ],
      notes: 'AV-over-IP Decoder 4K30 4:4:4, HDCP 2.2, skaliert · 12 V DC oder PoE (802.3at) · 3,6–5,2 W · 221 x 105,3 x 26 mm',
      width: 220,
      height: 240,
    },
  },

  // Quelle: https://www.idkav.com/content/documents/specsheets/fdx-s32u_s_ver.1.7.0_en.pdf
  {
    match: ['idkfdx32x32', 'fdx32x32', 'fdx32x32hdmi20', 'idkfdxs32u', 'fdxs32u'],
    deviceTypeId: 'f9af0e0c-ddfa-4492-8657-c257fb06d9bd',
    template: {
      manufacturerUrl: 'https://www.idkav.com/content/documents/specsheets/fdx-s32u_s_ver.1.7.0_en.pdf',
      name: 'IDK FDX-S32U',
      category: ROUTER,
      // Standard-Bestückung: 8x FDX-SIV4UH (je 4 HDMI rein) + 8x FDX-SOV4UH
      // (je 4 HDMI raus). Audiokarte und Redundanz-Netzteil sind Optionen.
      inputs: [
        ...n(32, (i) => port(`HDMI In ${i}`, 'HDMI', 'HDMI')),
        port('LAN', 'Ethernet/RJ45', 'Ethernet'),
        port('RS-232C', 'Phoenix/Euroblock', 'RS-232'),
      ],
      outputs: [
        ...n(32, (i) => port(`HDMI Out ${i}`, 'HDMI', 'HDMI')),
        port('Instant Alert (Kontakt)', 'Phoenix/Euroblock', 'Alarm'),
      ],
      isRackDevice: true,
      rackUnits: 5,
      notes: 'Modular 32x32, 4K60 HDCP 2.2 · Bestückung 8x FDX-SIV4UH + 8x FDX-SOV4UH · 100–240 V AC, ca. 42 W · 430 x 221 x 400 mm',
      width: 340,
      height: 1400,
    },
  },

  // Quelle: https://www.idkav.com/content/documents/specsheets/imp-s_s_ver.1.1.0_en.pdf
  {
    match: ['idkimps41u', 'imps41u'],
    deviceTypeId: '1e5ea103-b77c-411d-aa95-1aafb8cf732d',
    template: {
      manufacturerUrl: 'https://www.idkav.com/content/documents/specsheets/imp-s_s_ver.1.1.0_en.pdf',
      name: 'IDK IMP-S41U',
      category: ROUTER,
      inputs: [
        ...n(4, (i) => port(`HDMI In ${i}`, 'HDMI', 'HDMI')),
        port('LAN', 'Ethernet/RJ45', 'Ethernet'),
        port('RS-232C', 'Phoenix/Euroblock', 'RS-232'),
        ...n(5, (i) => port(`Kontakt/Tally ${i}`, 'Phoenix/Euroblock', 'GPI')),
      ],
      outputs: [
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('Analog Audio Out (5-pol.)', 'Phoenix/Euroblock', 'Audio'),
        port('LED-Versorgung Tally (5 V)', 'Phoenix/Euroblock', 'Power'),
      ],
      notes: '4x1 HDMI 4K60, HDCP 2.2, De-Embedding · DC 5 V 1,1 A, 7 W · 210 x 42 x 140 mm',
      width: 220,
      height: 300,
    },
  },
]

/** Die Vorlagen allein — für die Bibliotheks-Saat in `projectStore`. */
export const w4cTemplates: EquipmentTemplate[] = ROUTING_NACHTRAG_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
