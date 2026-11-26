// ───────────────────────────────────────────────────────────────────────────
// Videomischer-/Router-Katalog weiterer Hersteller (Panasonic, For-A, Roland, NewTek, Sony, Analog Way, Barco)
//
// Alle Port-Belegungen stammen aus offiziellen Hersteller-Datenblaettern /
// Produktseiten (Recherche 2026-07, Quellen-URL je Eintrag). Grundsatz:
// KEINE erfundenen Ports — unsichere Geraete wurden nicht aufgenommen.
// deviceTypeId = stabile Geraetetyp-GUID (GDTF/DIN-SPEC-15800-analog),
// einmalig gemintet, versionsstabil.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate, Port } from '../types/equipment'

const num = (base: string, n: number, connectorType: Port['connectorType'], bidi = false): Port[] =>
  Array.from({ length: n }, (_, i) => ({
    id: '',
    name: `${base} ${i + 1}`,
    type: connectorType,
    connectorType,
    ...(bidi ? { direction: 'bidirectional' as const } : {}),
  }))

interface SwitcherEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: SwitcherEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const SWITCHER_CATALOG: SwitcherEntry[] = [
  // Panasonic AV-UHS500 (2020) — Kompakter 4K/12G-SDI-Mischer; per Options-Units bis 16 SDI-In / 13 SDI-Out erweiterbar
  // Quelle: https://pro-av.panasonic.net/en/products/av-uhs500/spec.html
  {
    match: ['panasonic', 'av-uhs500'],
    deviceTypeId: 'd3671648-297a-4785-a48f-9ecdcab0f934',
    template: {
      manufacturerUrl: 'https://pro-av.panasonic.net/en/products/av-uhs500/spec.html',
      name: 'Panasonic AV-UHS500',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 8, 'BNC'),
        ...num('HDMI In', 2, 'HDMI'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 5, 'BNC'),
        ...num('HDMI Out', 2, 'HDMI'),
      ],
      width: 260, height: 252,
    },
  },

  // For-A HVS-490 (2016) — HANABI 2 M/E, 3G/HD/SD; Frame-Sync auf allen Inputs; erweiterbar bis 40 In / 22 Out
  // Quelle: https://www.for-a.com/products/hvs490/
  {
    match: ['for-a', 'hvs-490'],
    deviceTypeId: 'ce02f5e9-95c8-4910-a616-6147a312998b',
    template: {
      manufacturerUrl: 'https://www.for-a.com/products/hvs490/',
      name: 'For-A HVS-490',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 16, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 8, 'BNC'),
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
      ],
      width: 260, height: 348,
    },
  },

  // Roland V-8HD (2019) — Kompakter reiner HDMI-Mischer bis 1080p60, 18ch-Audiomischer
  // Quelle: https://proav.roland.com/global/products/v-8hd/
  {
    match: ['roland', 'v-8hd'],
    deviceTypeId: '7079510f-190f-4fe2-9efb-bf7bcef97244',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-8hd/',
      name: 'Roland V-8HD',
      category: 'Video Mixer',
      inputs: [
        ...num('HDMI In', 8, 'HDMI'),
        { id: '', name: 'Audio In (3.5mm)', type: 'Jack 3.5 mm', connectorType: 'Jack 3.5 mm' },
        { id: '', name: 'USB (Control)', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        ...num('HDMI Out', 3, 'HDMI'),
        { id: '', name: 'Phones (3.5mm)', type: 'Jack 3.5 mm', connectorType: 'Jack 3.5 mm' },
      ],
      width: 260, height: 220,
    },
  },

  // Roland V-60HD (2017) — Multi-Format-HD-Mischer, Smart Tally ueber LAN
  // Quelle: https://proav.roland.com/global/products/v-60hd/
  {
    match: ['roland', 'v-60hd'],
    deviceTypeId: 'f2786473-7eea-44e7-97a8-cbe63c6d8cc4',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-60hd/',
      name: 'Roland V-60HD',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 4, 'BNC'),
        ...num('HDMI In', 2, 'HDMI'),
        ...num('Audio In 1-2 (Combo XLR/TRS)', 2, 'XLR'),
        { id: '', name: 'LAN (Smart Tally)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 2, 'BNC'),
        ...num('HDMI Out', 2, 'HDMI'),
        { id: '', name: 'HDMI Multiview Out', type: 'HDMI', connectorType: 'HDMI' },
        ...num('Audio Out L/R', 2, 'XLR'),
        { id: '', name: 'Phones', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 204,
    },
  },

  // Roland V-160HD (2021) — Hybrid-Streaming-Mischer 8x SDI + 8x HDMI, 40ch-Audiomischer, USB-C-Streaming
  // Quelle: https://proav.roland.com/global/products/v-160hd/
  {
    match: ['roland', 'v-160hd'],
    deviceTypeId: '2983ce7e-e004-49c5-8411-709546aea466',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-160hd/',
      name: 'Roland V-160HD',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 8, 'BNC'),
        ...num('HDMI In', 8, 'HDMI'),
        ...num('Audio In 1-2 (Combo XLR/TRS)', 2, 'XLR'),
        ...num('Audio In 3/4 (RCA)', 2, 'Cinch/RCA'),
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 3, 'BNC'),
        ...num('HDMI Out', 3, 'HDMI'),
        { id: '', name: 'USB-C Stream Out', type: 'USB-C', connectorType: 'USB-C' },
        ...num('Audio Out L/R', 2, 'XLR'),
        ...num('Audio Out (RCA) L/R', 2, 'Cinch/RCA'),
        { id: '', name: 'Phones', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 396,
    },
  },

  // Sony MCX-500 (2016) — 4-Kanal-1-M/E-Mischer, 8 Anschluesse fuer 4 gleichzeitige Kanaele, RCP-Steuerung; Ports laut Datenblatt (sony.jp, pro.sony sperrt Abrufe)
  // Quelle: https://www.sony.jp/products/catalog/MCX-500_1701.pdf
  {
    match: ['sony', 'mcx-500'],
    deviceTypeId: 'ee3a295e-5ef1-44e1-96c3-5866ea062431',
    template: {
      manufacturerUrl: 'https://www.sony.jp/products/catalog/MCX-500_1701.pdf',
      name: 'Sony MCX-500',
      category: 'Video Mixer',
      inputs: [
        ...num('3G-SDI In', 4, 'BNC'),
        ...num('HDMI In', 2, 'HDMI'),
        ...num('Composite In', 2, 'BNC'),
        { id: '', name: 'Title RGB In', type: 'VGA', connectorType: 'VGA' },
        ...num('Audio In (XLR/TRS)', 2, 'XLR'),
        ...num('LAN', 2, 'Ethernet/RJ45'),
        { id: '', name: 'Tally (D-Sub 9)', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'USB', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        { id: '', name: 'SDI PGM Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI PGM Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'HDMI Multiviewer Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Composite Out', type: 'BNC', connectorType: 'BNC' },
        ...num('Audio Out', 2, 'Cinch/RCA'),
        { id: '', name: 'Phones', type: 'Jack 3.5 mm', connectorType: 'Jack 3.5 mm' },
      ],
      width: 260, height: 300,
    },
  },

  // Sony XVS-G1 (2020) — 2 M/E (max. 4), 24 In/12 Out Grundausbau (max. 44/24 mit XKS-G1110); Anschluesse laut Katalog 2025.3
  // Quelle: https://www.sony.jp/products/catalog/XVS-G1_2503.pdf
  {
    match: ['sony', 'xvs-g1'],
    deviceTypeId: 'c0b191b4-c93e-4fcc-9a06-e9a6a374c5d9',
    template: {
      manufacturerUrl: 'https://www.sony.jp/products/catalog/XVS-G1_2503.pdf',
      name: 'Sony XVS-G1',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 24, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN 1', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'LAN 2', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'GPI (D-sub 25)', type: 'DB25', connectorType: 'DB25' },
      ],
      outputs: [
        ...num('SDI Out', 12, 'BNC'),
        { id: '', name: 'Ref Loop Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Ref Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 508,
    },
  },

  // Sony XVS-9000 — BNC-Vollausbau „プライマリー入力160“ / „出力80“ laut XVS-Katalog 2022.2; Tally/GPI der 7000/6000 liegen in den Interface-Einheiten MKS-X7700/X2700
  // Quelle: https://www.sony.jp/products/catalog/PRODUCTION_SWITCHER_SYSTEM_2202.pdf
  {
    match: ['sony', 'xvs-9000'],
    deviceTypeId: '48d2ac55-9dc5-491d-9abe-94d3133d2e67',
    template: {
      manufacturerUrl: 'https://www.sony.jp/products/catalog/PRODUCTION_SWITCHER_SYSTEM_2202.pdf',
      name: 'Sony XVS-9000',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 160, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'MVS LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTL LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'GPI (D-sub 25)', type: 'DB25', connectorType: 'DB25' },
      ],
      outputs: [
        ...num('SDI Out', 80, 'BNC'),
        { id: '', name: 'Ref Loop Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 2684,
    },
  },

  // Sony XVS-7000 — BNC-Vollausbau „プライマリー入力112“ / „出力48“ laut XVS-Katalog 2022.2; Tally/GPI der 7000/6000 liegen in den Interface-Einheiten MKS-X7700/X2700
  // Quelle: https://www.sony.jp/products/catalog/PRODUCTION_SWITCHER_SYSTEM_2202.pdf
  {
    match: ['sony', 'xvs-7000'],
    deviceTypeId: '80b210eb-502d-4d5f-a05c-803db5050bf2',
    template: {
      manufacturerUrl: 'https://www.sony.jp/products/catalog/PRODUCTION_SWITCHER_SYSTEM_2202.pdf',
      name: 'Sony XVS-7000',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 112, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'MVS LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTL LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 48, 'BNC'),
        { id: '', name: 'Ref Loop Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 1900,
    },
  },

  // Sony XVS-6000 — BNC-Vollausbau „プライマリー入力64“ / „出力24“ laut XVS-Katalog 2022.2; Tally/GPI der 7000/6000 liegen in den Interface-Einheiten MKS-X7700/X2700
  // Quelle: https://www.sony.jp/products/catalog/PRODUCTION_SWITCHER_SYSTEM_2202.pdf
  {
    match: ['sony', 'xvs-6000'],
    deviceTypeId: 'c3b7d836-aa15-49aa-bc10-ce27821f0b58',
    template: {
      manufacturerUrl: 'https://www.sony.jp/products/catalog/PRODUCTION_SWITCHER_SYSTEM_2202.pdf',
      name: 'Sony XVS-6000',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 64, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'MVS LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTL LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 24, 'BNC'),
        { id: '', name: 'Ref Loop Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 1132,
    },
  },

  // Sony MVS-6530 — 48 In / 32 Out BNC, 4U; Anschluesse laut Spezifikationsblatt
  // Quelle: https://www.sony.jp/products/catalog/SPC_MVS-6530.pdf
  {
    match: ['sony', 'mvs-6530'],
    deviceTypeId: 'a4c830da-fcb8-4f64-aa28-678af356f2d9',
    template: {
      manufacturerUrl: 'https://www.sony.jp/products/catalog/SPC_MVS-6530.pdf',
      name: 'Sony MVS-6530',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 48, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'MVS LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTIL (SW) LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTIL (SCU) LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTIL (FM) LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        ...num('Remote RS-422', 4, 'DB9'),
        ...num('Remote S', 2, 'DB9'),
        ...num('Tally/GPI (D-sub 25)', 4, 'DB25'),
        { id: '', name: 'Serial Tally', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'S-BUS', type: 'BNC', connectorType: 'BNC' },
      ],
      outputs: [
        ...num('SDI Out', 32, 'BNC'),
        { id: '', name: 'Ref Loop Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 1100,
    },
  },

  // Sony MVS-3000A — 32 In / 16 Out BNC, 4U; Anschluesse laut Spezifikationsblatt
  // Quelle: https://www.sony.jp/products/catalog/SPC_MVS-3000A.pdf
  {
    match: ['sony', 'mvs-3000a'],
    deviceTypeId: '6563161f-5357-4f5d-8896-5a537947d149',
    template: {
      manufacturerUrl: 'https://www.sony.jp/products/catalog/SPC_MVS-3000A.pdf',
      name: 'Sony MVS-3000A',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 32, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'MVS LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTIL (SW) LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTIL (SCU) LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'UTIL (FM) LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        ...num('Remote RS-422', 4, 'DB9'),
        ...num('Remote S', 2, 'DB9'),
        ...num('Tally/GPI (D-sub 25)', 4, 'DB25'),
        { id: '', name: 'Serial Tally', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'S-BUS', type: 'BNC', connectorType: 'BNC' },
      ],
      outputs: [
        ...num('SDI Out', 16, 'BNC'),
        { id: '', name: 'Ref Loop Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 844,
    },
  },

  // Vizrt (NewTek) TriCaster 2 Elite (2019) — 32 externe Inputs gesamt (NDI + SDI), bis UHD60p; 2x UHD via Quad-Link-Gruppierung; Live Call Connect
  // Quelle: https://www.vizrt.com/products/tricaster/
  {
    match: ['tricaster', 'elite'],
    deviceTypeId: '3cc4a0b1-735f-46b8-b08b-7a2692c89135',
    template: {
      manufacturerUrl: 'https://www.vizrt.com/products/tricaster/',
      name: 'Vizrt (NewTek) TriCaster 2 Elite',
      category: 'Video Mixer',
      inputs: [
        ...num('3G-SDI In', 8, 'BNC'),
        { id: '', name: 'LAN (NDI)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('3G-SDI Out', 8, 'BNC'),
      ],
      width: 260, height: 204,
    },
  },

  // Barco E2 Gen 2 (2019) — Screen-Management/Praesentations-Switcher, 4 HE; Standardbestueckung (kartenbasiert, BTO abweichend); bis 4K60 4:4:4, verlinkbar mit S3-4K/Ex
  // Quelle: https://assets.barco.com/m/1da1a218bfbbede6/original/E2-Gen-2-en-Spec-sheet.pdf
  {
    match: ['barco', 'e2'],
    deviceTypeId: '3c49815f-6ce9-4792-8818-a1e70d2c3f97',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/1da1a218bfbbede6/original/E2-Gen-2-en-Spec-sheet.pdf',
      name: 'Barco E2 Gen 2',
      category: 'Video Mixer',
      inputs: [
        ...num('HDMI In', 12, 'HDMI'),
        ...num('DisplayPort In', 12, 'DisplayPort'),
        ...num('SDI In', 4, 'BNC'),
        { id: '', name: 'Genlock In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Genlock Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('HDMI Out', 13, 'HDMI'),
        { id: '', name: 'DisplayPort Out', type: 'DisplayPort', connectorType: 'DisplayPort' },
        ...num('SDI Out', 4, 'BNC'),
      ],
      width: 260, height: 556,
    },
  },

  // Analog Way Aquilon RS alpha (AQL-RS-ALPHA) — kleinstes Modell der RS-Reihe,
  // Grundbestueckung: 8x HDMI 2.0 in, 4x HDMI 2.0 out, 2x Multiviewer HDMI;
  // Karten tauschbar (SDI, DP, NDI, ST 2110 …) — hier die Grundbestueckung.
  // Framelock-BNC mit Loop, Dante primaer/sekundaer, Steuer-Ethernet.
  // Leistung widerspruechlich (Datenblatt 400 W, Quick-Start 540 W) → notes.
  // Quelle: https://www.analogway.com/products/aquilon-rs-alpha
  {
    match: ['aquilon', 'alpha'],
    deviceTypeId: 'c0c2877f-8520-4742-815c-7ac077da9a21',
    template: {
      manufacturerUrl: 'https://www.analogway.com/products/aquilon-rs-alpha',
      name: 'Analog Way Aquilon RS alpha',
      category: 'Video Mixer',
      inputs: [
        ...num('HDMI 2.0 In', 8, 'HDMI'),
        { id: '', name: 'Framelock / Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Dante Primary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Dante Secondary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Control (Ethernet)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      outputs: [
        ...num('HDMI 2.0 Out', 4, 'HDMI'),
        ...num('Multiviewer Out (HDMI)', 2, 'HDMI'),
        { id: '', name: 'Framelock Loop', type: 'BNC', connectorType: 'BNC' },
      ],
      notes: 'Leistung max. 400 W (Datenblatt) bzw. 540 W (Quick-Start-Guide) · Ein-/Ausgangskarten tauschbar, hier Grundbestückung',
      width: 280, height: 260,
    },
  },

  // Vizrt (NewTek) TriCaster Mini 4K — keine SDI/HDMI-Eingaenge am Geraet:
  // 8 NDI-Quellen, davon vier ueber die PoE+-Ports (HDMI-Wandler), 2x GbE,
  // 4x Mini-DisplayPort, Audio auf 6,35-mm-Klinke. Die Herstellerseite ist
  // abgeschaltet; Beleg ist ihre Archivkopie.
  // Quelle: https://web.archive.org/web/20250125084503/https://www.vizrt.com/products/tricaster/tricaster-mini-4k/tech-specs/
  {
    match: ['tricaster', 'mini', '4k'],
    deviceTypeId: 'e96379ac-e90b-411a-a390-fcebe3696a5f',
    template: {
      manufacturerUrl: 'https://web.archive.org/web/20250125084503/https://www.vizrt.com/products/tricaster/tricaster-mini-4k/tech-specs/',
      name: 'Vizrt (NewTek) TriCaster Mini 4K',
      category: 'Video Mixer',
      inputs: [
        ...num('NDI 1-4 (PoE+)', 4, 'Ethernet/RJ45', true),
        ...num('LAN (1 GbE)', 2, 'Ethernet/RJ45', true),
        { id: '', name: 'Mic In (6.35 mm)', type: 'Jack 6.35 mm', connectorType: 'Jack 6.35 mm' },
        ...num('Line In (6.35 mm)', 2, 'Jack 6.35 mm'),
      ],
      outputs: [
        ...num('Mini DisplayPort Out', 4, 'Custom'),
        ...num('Line Out (6.35 mm)', 2, 'Jack 6.35 mm'),
        { id: '', name: 'Phones (6.35 mm)', type: 'Jack 6.35 mm', connectorType: 'Jack 6.35 mm' },
      ],
      notes: 'PoE-Budget 60 W (Abgabe, keine Aufnahme) · Ausgänge des Mischers nur als NDI',
      width: 260, height: 200,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const switcherTemplates: EquipmentTemplate[] = SWITCHER_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchSwitcherTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of SWITCHER_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('panasonic av-') ||
    lower.includes('av-uhs') ||
    lower.includes('av-hs') ||
    lower.includes('for-a') ||
    lower.includes('hvs-') ||
    lower.includes('roland v-') ||
    lower.includes('v-160hd') ||
    lower.includes('v-60hd') ||
    lower.includes('v-8hd') ||
    lower.includes('tricaster') ||
    lower.includes('mcx-500') ||
    lower.includes('aquilon') ||
    lower.includes('barco e2') ||
    lower.includes('barco s3')
  if (!isBrandKnown) return null
  for (const entry of SWITCHER_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
