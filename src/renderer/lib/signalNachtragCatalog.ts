import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Welle 3c — LANG-AG-Geräte, die in langBroadcastCatalog.ts und
// langImageCatalog.ts übersprungen wurden.
//
// Neue Regel: Hersteller-Datenblätter/Handbücher als PDF auf Händler- oder
// Verleihseiten sind zulässig (keine reinen Shopseiten, nie die gesperrten
// Händler wie markertek, bhphotovideo, thomann usw.).
//
// ─── ÜBERSPRUNGEN ──────────────────────────────────────────────────────────
//
// Lynx PDM 1284B, PDM 1284D, PVD 1800, CHD 1812, OTX 1712 / ORX 1702:
//   kein Datenblatt-PDF gefunden (lynx-technik.com antwortet 403).
// Lightware MX2-32x32-Audio-R, MX33x33DVI-Pro, MX65x65: kein lesbares Blatt.
// Lightware MX2-8x8-Audio-L: ret.de-PDF liefert HTML statt PDF.
// Lightware VINX-110AP/120AP: nur Sammelbroschüre, kein Blatt je Modell.
// IDK FDX-32x32-HDMI2.0, IDK IMP-S41U: kein Datenblatt gefunden.
// Ophit MSV 2, Apantac HDMI-DP-UHD: Quellen nur auf markertek (gesperrt).
// ATEN VS-194: nur Shopseiten gefunden.
// Lindy 42345: nur Shopseite, Gerätetyp darin widersprüchlich.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

interface Wave3cEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const SIGNAL_NACHTRAG_CATALOG: Wave3cEntry[] = [
  // Quelle: https://lynx-usa.com/wp-content/uploads/2015/05/PDM1383-rev05.pdf
  {
    match: ['pdm1383', 'yellobrikpdm1383', 'lynxpdm1383'],
    deviceTypeId: '2e4ff03f-a41e-4cde-a50d-30fa055b8bec',
    template: {
      manufacturerUrl: 'https://lynx-usa.com/wp-content/uploads/2015/05/PDM1383-rev05.pdf',
      name: 'Lynx Technik PDM 1383',
      category: 'Converter',
      // Blatt: 1x SDI In, 1x SDI Out (BNC), 4 Audio In + 4 Audio Out auf
      // EINEM 25-pol. SubD; Fiber-I/O nur mit optionalem SFP.
      inputs: [
        port('3G-SDI In', 'BNC', 'SDI'),
        port('Analog Audio In 1–4 (SubD 25)', 'DB25', 'Audio'),
        port('Fiber In (SFP, optional)', 'SFP', 'Fiber'),
        port('Power In (+12 V DC)', 'DC Barrel', 'Power'),
      ],
      outputs: [
        port('3G-SDI Out', 'BNC', 'SDI'),
        port('Analog Audio Out 1–4 (SubD 25)', 'DB25', 'Audio'),
        port('Fiber Out (SFP, optional)', 'SFP', 'Fiber'),
      ],
      isRackDevice: false,
      notes: 'yellobrik · 128 x 90 x 22 mm · +12 V DC, 4,8 W · Audio-Embedder/De-Embedder bis 3G',
      width: 200,
      height: 180,
    },
  },

  // Quelle: https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/MX2-48x48-HDMI20-A-R_AE_Specification.pdf
  {
    match: ['mx248x48hdmi20ar', 'mx248x48audior', 'mx248x48'],
    deviceTypeId: '5a96706b-c85a-4478-83a3-12bd9d139956',
    template: {
      manufacturerUrl: 'https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/MX2-48x48-HDMI20-A-R_AE_Specification.pdf',
      name: 'Lightware MX2-48x48-HDMI20-A-R',
      category: 'Video Router',
      // Blatt: 48 HDMI 2.0 rein/raus, je 16 analoge Audio-Ein-/Ausgänge
      // (5-pol. Phoenix), LAN, RS-232 (D-SUB 9), USB mini-B, 2x powerCON.
      inputs: [
        ...Array.from({ length: 48 }, (_, i) => port(`HDMI In ${i + 1}`, 'HDMI', 'HDMI')),
        ...Array.from({ length: 16 }, (_, i) => port(`Analog Audio In ${i + 1}`, 'Phoenix/Euroblock', 'Audio')),
        port('LAN', 'Ethernet/RJ45', 'Ethernet'),
        port('RS-232', 'DB9', 'Control'),
        port('USB (mini-B)', 'USB Mini-B', 'USB'),
        port('AC In 1 (100–240 V)', 'powerCON Input', 'Power'),
        port('AC In 2 (100–240 V)', 'powerCON Input', 'Power'),
      ],
      outputs: [
        ...Array.from({ length: 48 }, (_, i) => port(`HDMI Out ${i + 1}`, 'HDMI', 'HDMI')),
        ...Array.from({ length: 16 }, (_, i) => port(`Analog Audio Out ${i + 1}`, 'Phoenix/Euroblock', 'Audio')),
      ],
      isRackDevice: true,
      rackUnits: 8,
      notes: '19" 8 HE · 440.5 x 355 x 280.2 mm · 100–240 V AC, redundant · 108 W / 203 W',
      width: 320,
      height: 1400,
    },
  },
]

/** Die Vorlagen allein — für die Bibliotheks-Saat in `projectStore`. */
export const wave3cTemplates: EquipmentTemplate[] = SIGNAL_NACHTRAG_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
