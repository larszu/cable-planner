import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Christie — aktuelle Projektoren (Griffyn, Sapphire, Eclipse, M 4K, HS, GS,
// Jazz, Korus, Inspire, Captiva). Ports nur aus den Datenblaettern.
//
// Ohne Blatt kein Eintrag: Crimson, Boxer, D4K40-RGB, D20/D13-HS, DWU19-HS
// sind End-of-Production; DWU960ST-iS (nur Objektivvariante) und alle
// LANG-Geraete fremder Marken (Disguise, Analog Way, Novastar, ROE, INFiLED,
// Lightware MX2, Haivision, Datapath …) — dafuer wurde kein Datenblatt geholt.
// Bei Eclipse G3, Sapphire und M-Serie nennt das Blatt keine Control-Ports.
// Christie Link als QSFP, SDVoE als SFP+ (Blatt nennt den Steckertyp nicht).
// ───────────────────────────────────────────────────────────────────────────

const P = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const PROJ = 'Projectors'

interface ChristieEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const CHRISTIE_LANG_CATALOG: ChristieEntry[] = [
  // Quelle: https://www.christiedigital.com/globalassets/resources/public/Griffyn-4K50-RGB-data-sheet.pdf
  {
    match: ['christiegriffyn4k50rgb', 'griffyn4k50rgb', 'griffyn4k50'],
    deviceTypeId: 'a75bc349-e259-452e-bf75-25dd4d966d3e',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/Griffyn-4K50-RGB-data-sheet.pdf',
      name: 'Christie Griffyn 4K50-RGB',
      category: PROJ,
      inputs: [
        P('HDMI 2.1 In','HDMI','HDMI'),
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DisplayPort 1.4 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.4 In 2','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 2','DisplayPort','DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => P(`12G-SDI In ${i + 1}`, 'BNC', 'SDI')),
        P('SDVoE','SFP+','SDVoE'),
        P('Christie Link In (QSFP+)','QSFP','Fiber'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control/Web UI)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('GPIO','Generic','GPIO'),
        P('Mains In (IEC 60309 30 A)','Generic','Power'),
      ],
      outputs: [
        P('Christie Link Out (QSFP+)','QSFP','Fiber'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '50.000 ISO / 44.500 ANSI lm · 4096x2160 3DLP 1,38" · RGB-Reinlaser · 89,3 kg · 200–240 V 19 A, 2.800 W typ./3.800 W max · alle Eingänge fest verbaut, keine Optionskarten',
      width: 280,
      height: 480,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/Griffyn-4K35-RGB-data_sheet.pdf
  {
    match: ['christiegriffyn4k35rgb', 'griffyn4k35rgb', 'griffyn4k35'],
    deviceTypeId: '39fe4e97-d960-4a29-bec4-6c53f7e860b2',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/Griffyn-4K35-RGB-data_sheet.pdf',
      name: 'Christie Griffyn 4K35-RGB',
      category: PROJ,
      inputs: [
        P('HDMI 2.1 In','HDMI','HDMI'),
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DisplayPort 1.4 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.4 In 2','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 2','DisplayPort','DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => P(`12G-SDI In ${i + 1}`, 'BNC', 'SDI')),
        P('SDVoE','SFP+','SDVoE'),
        P('Christie Link In (QSFP+)','QSFP','Fiber'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control/Web UI)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('GPIO','Generic','GPIO'),
        P('Mains In (IEC C20)','IEC C20','Power'),
      ],
      outputs: [
        P('Christie Link Out (QSFP+)','QSFP','Fiber'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '36.500 ISO / 32.500 ANSI lm · 4096x2160 3DLP 1,38" · RGB-Reinlaser · 81 kg · 200–240 V 14 A, 1.800 W typ./2.800 W max · keine Optionskarten',
      width: 280,
      height: 480,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/sapphire-4k40-rgbh-datasheet.pdf
  {
    match: ['christiesapphire4k40rgbh', 'sapphire4k40rgbh', 'sapphire4k40'],
    deviceTypeId: '10d96b8f-db15-43a7-a45c-75f9c368118a',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/sapphire-4k40-rgbh-datasheet.pdf',
      name: 'Christie Sapphire 4K40-RGBH',
      category: PROJ,
      inputs: [
        P('HDMI 2.1 In','HDMI','HDMI'),
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DisplayPort 1.4 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.4 In 2','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 2','DisplayPort','DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => P(`12G-SDI In ${i + 1}`, 'BNC', 'SDI')),
        P('SDVoE','SFP+','SDVoE'),
        P('Christie Link In (QSFP+)','QSFP','Fiber'),
        P('3D Sync In','BNC','Genlock'),
        P('Mains In (IEC 60309 30 A)','Generic','Power'),
      ],
      outputs: [
        P('Christie Link Out (QSFP+)','QSFP','Fiber'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '40.950 ISO / 36.400 ANSI lm · 4096x2160 3DLP 1,38" · Hybrid RGB-Laser · 92 kg · 200–240 V 20 A, 2.900 W typ./4.000 W max · Control-Ports im Blatt nicht aufgeführt, daher nicht eingetragen',
      width: 280,
      height: 420,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/eclipse-g3-data-sheet.pdf
  {
    match: ['christieeclipseg3', 'eclipseg3'],
    deviceTypeId: '6a0b8629-2f61-4ac0-bfc3-3b4541dd5b9c',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/eclipse-g3-data-sheet.pdf',
      name: 'Christie Eclipse G3',
      category: PROJ,
      inputs: [
        P('HDMI 2.1 In','HDMI','HDMI'),
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DisplayPort 1.4 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.4 In 2','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 2','DisplayPort','DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => P(`12G-SDI In ${i + 1}`, 'BNC', 'SDI')),
        P('SDVoE','SFP+','SDVoE'),
        P('Christie Link In (QSFP+)','QSFP','Fiber'),
        P('Christie Link (QSFP+ 2, In oder Out)','QSFP','Fiber'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: '30.000 ANSI lm · 4096x2160 6DLP · RGB-Reinlaser · 188 kg + Chiller 73 kg · Laser 200–240 V 24 A, Elektronik 100–240 V (C14) · 3.367 W typ./5.350 W max + Chiller 2.160 W · QSFP+ wahlweise 2 In oder 1 In/1 Out; Steuer-/Sync-Ports im Blatt nicht aufgeführt',
      width: 280,
      height: 400,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/M-4K15-RGB-data_sheet.pdf
  {
    match: ['christiem4k15rgb', 'm4k15rgb'],
    deviceTypeId: '71559cd6-75d2-4137-8a95-b160bf006ed3',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/M-4K15-RGB-data_sheet.pdf',
      name: 'Christie M 4K15 RGB',
      category: PROJ,
      inputs: [
        P('HDMI 2.1 In','HDMI','HDMI'),
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DisplayPort 1.4 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.4 In 2','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 2','DisplayPort','DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => P(`12G-SDI In ${i + 1}`, 'BNC', 'SDI')),
        P('SDVoE','SFP+','SDVoE'),
        P('Christie Link In (QSFP+)','QSFP','Fiber'),
        P('3D Sync In','BNC','Genlock'),
      ],
      outputs: [
        P('Christie Link Out (QSFP+)','QSFP','Fiber'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '15.750 ISO / 14.000 ANSI lm · 3840x2160 (Pixel-Shift) 3DLP 0,95" · RGB-Reinlaser · 38,1 kg · 100–240 V, 827 W typ./1.200 W max · keine Optionskarten; Control-Ports im Blatt nicht aufgeführt',
      width: 280,
      height: 400,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/M-4K15-RGB-data_sheet.pdf
  {
    match: ['christiem4k+15rgb', 'm4k+15rgb'],
    deviceTypeId: 'c7983a27-47ae-41f6-90c6-c4f697379088',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/M-4K15-RGB-data_sheet.pdf',
      name: 'Christie M 4K+15 RGB',
      category: PROJ,
      inputs: [
        P('HDMI 2.1 In','HDMI','HDMI'),
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DisplayPort 1.4 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.4 In 2','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 2','DisplayPort','DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => P(`12G-SDI In ${i + 1}`, 'BNC', 'SDI')),
        P('SDVoE','SFP+','SDVoE'),
        P('Christie Link In (QSFP+)','QSFP','Fiber'),
        P('3D Sync In','BNC','Genlock'),
      ],
      outputs: [
        P('Christie Link Out (QSFP+)','QSFP','Fiber'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '15.750 ISO / 14.000 ANSI lm · 3840x2400 (Pixel-Shift) 3DLP 0,96" · RGB-Reinlaser · 38,1 kg · 100–240 V, 827 W typ./1.200 W max · keine Optionskarten; Control-Ports im Blatt nicht aufgeführt',
      width: 280,
      height: 400,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/M-4K25-RGB-datasheet.pdf
  {
    match: ['christiem4k25rgb', 'm4k25rgb'],
    deviceTypeId: 'e248c861-37cf-48ca-833d-508e12484541',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/M-4K25-RGB-datasheet.pdf',
      name: 'Christie M 4K25 RGB',
      category: PROJ,
      inputs: [
        P('HDMI 2.1 In','HDMI','HDMI'),
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DisplayPort 1.4 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.4 In 2','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 2','DisplayPort','DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => P(`12G-SDI In ${i + 1}`, 'BNC', 'SDI')),
        P('Christie Link In (QSFP+)','QSFP','Fiber'),
        P('3D Sync In','BNC','Genlock'),
        P('Mains In (IEC C14, C13-Lock-Kabel)','IEC 230V','Power'),
      ],
      outputs: [
        P('Christie Link Out (QSFP+)','QSFP','Fiber'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '25.300 ISO / 22.500 ANSI lm · 3840x2160 (Pixel-Shift) 3DLP 0,95" · RGB-Reinlaser · 41,7 kg · 200–240 V 9 A, 1.540 W typ./1.800 W max · kein SDVoE laut Blatt; Control-Ports im Blatt nicht aufgeführt',
      width: 280,
      height: 400,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/M-4K25-RGB-datasheet.pdf
  {
    match: ['christiem4k+25rgb', 'm4k+25rgb'],
    deviceTypeId: 'ed3cdd6d-5e2b-454d-a4a3-4cf8257586a4',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/M-4K25-RGB-datasheet.pdf',
      name: 'Christie M 4K+25 RGB',
      category: PROJ,
      inputs: [
        P('HDMI 2.1 In','HDMI','HDMI'),
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DisplayPort 1.4 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.4 In 2','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 1','DisplayPort','DisplayPort'),
        P('DisplayPort 1.2 In 2','DisplayPort','DisplayPort'),
        ...Array.from({ length: 4 }, (_, i) => P(`12G-SDI In ${i + 1}`, 'BNC', 'SDI')),
        P('Christie Link In (QSFP+)','QSFP','Fiber'),
        P('3D Sync In','BNC','Genlock'),
        P('Mains In (IEC C14, C13-Lock-Kabel)','IEC 230V','Power'),
      ],
      outputs: [
        P('Christie Link Out (QSFP+)','QSFP','Fiber'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '25.300 ISO / 22.500 ANSI lm · 3840x2400 (Pixel-Shift) 3DLP 0,96" · RGB-Reinlaser · 41,7 kg · 200–240 V 9 A, 1.540 W typ./1.800 W max · kein SDVoE laut Blatt; Control-Ports im Blatt nicht aufgeführt',
      width: 280,
      height: 400,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/christie-4K13-4K22-HS-data-sheet.pdf
  {
    match: ['christie4k13hs', '4k13hs'],
    deviceTypeId: '16f78267-0392-4d86-9310-d17bacb3430e',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/christie-4K13-4K22-HS-data-sheet.pdf',
      name: 'Christie 4K13-HS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('12G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('12G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '14.800 ISO / 12.500 ANSI lm · 3840x2160 Pixel-Shift (1920x1080 nativ) 1-DLP 0,95" · Laser-Phosphor BoldColor+ · 43,5 kg · 100–240 V, 1.030 W',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/christie-4K13-4K22-HS-data-sheet.pdf
  {
    match: ['christie4k22hs', '4k22hs'],
    deviceTypeId: '894f6ab7-ed21-4f52-9135-9a9794668a82',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/christie-4K13-4K22-HS-data-sheet.pdf',
      name: 'Christie 4K22-HS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('12G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('12G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '22.500 ISO / 19.000 ANSI lm · 3840x2160 Pixel-Shift 1-DLP 0,95" · Laser-Phosphor BoldColor+ · 43,5 kg · 100–240 V, 1.553 W',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/dwu15-hs-datasheet.pdf
  {
    match: ['christiedwu15hs', 'dwu15hs'],
    deviceTypeId: '82c2a860-ff51-4a0f-94c9-e2344328e4a9',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/dwu15-hs-datasheet.pdf',
      name: 'Christie DWU15-HS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('3G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('3G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '15.750 ISO / 14.000 ANSI lm · 1920x1200 1-DLP 0,96" · Laser-Phosphor BoldColor+ · 41,6 kg · 100–240 V, 1.030 W · WLAN-Dongle optional',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/dwu19-hs-dwu23-hs-datasheet.pdf
  {
    match: ['christiedwu23hs', 'dwu23hs'],
    deviceTypeId: 'd7197041-5a46-4875-94ab-a39462ddb80d',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/dwu19-hs-dwu23-hs-datasheet.pdf',
      name: 'Christie DWU23-HS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('3G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('3G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '23.650 ISO / 21.000 ANSI lm · 1920x1200 1-DLP 0,96" · Laser-Phosphor BoldColor+ · 41,6 kg · 200–240 V 8,5 A, 1.604 W · WLAN-Dongle optional',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/gs-series-datasheet-dwu880-dwu1100-dwu1400.pdf
  {
    match: ['christiedwu880gs', 'dwu880gs'],
    deviceTypeId: '8fff7e56-8648-431c-aded-2200203c6f50',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/gs-series-datasheet-dwu880-dwu1100-dwu1400.pdf',
      name: 'Christie DWU880-GS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DVI-D In','DVI','DVI'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('3G-SDI In','BNC','SDI'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232 In','DB9','RS232'),
        P('Wired Remote (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '9.500 ISO / 8.000 ANSI lm · 1920x1200 1-DLP 0,67" · Laser-Phosphor · 19 kg · 100–240 V, 620 W max',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/gs-series-datasheet-dwu880-dwu1100-dwu1400.pdf
  {
    match: ['christiedwu1100gs', 'dwu1100gs'],
    deviceTypeId: 'a7134091-0962-41a3-a85b-54e3b19ddf71',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/gs-series-datasheet-dwu880-dwu1100-dwu1400.pdf',
      name: 'Christie DWU1100-GS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DVI-D In','DVI','DVI'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('3G-SDI In','BNC','SDI'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232 In','DB9','RS232'),
        P('Wired Remote (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '11.850 ISO / 10.000 ANSI lm · 1920x1200 1-DLP 0,67" · Laser-Phosphor · 19–22,8 kg (Blatt nennt zwei Werte) · 100–240 V, 800 W max',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/gs-series-datasheet-dwu880-dwu1100-dwu1400.pdf
  {
    match: ['christiedwu1400gs', 'dwu1400gs'],
    deviceTypeId: '0adb4c38-531a-4e06-94c2-66dec231a649',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/gs-series-datasheet-dwu880-dwu1100-dwu1400.pdf',
      name: 'Christie DWU1400-GS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('DVI-D In','DVI','DVI'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('3G-SDI In','BNC','SDI'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232 In','DB9','RS232'),
        P('Wired Remote (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
      ],
      isRackDevice: false,
      notes: '14.250 ISO / 12.000 ANSI lm · 1920x1200 1-DLP 0,67" · Laser-Phosphor · 22,8 kg · 100–240 V, 985 W max',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/jazz-series-data_sheet.pdf
  {
    match: ['christiedwu1800js', 'dwu1800js'],
    deviceTypeId: '675fba84-1083-4d9d-8c95-23990108847b',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/jazz-series-data_sheet.pdf',
      name: 'Christie DWU1800-JS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('3G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('3G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '17.800 ISO / 15.000 ANSI lm · 1920x1200 1-DLP 0,8" HEP · Laser-Phosphor · 29,4 kg · 930 W (Normal)',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/jazz-series-data_sheet.pdf
  {
    match: ['christiedwu2400js', 'dwu2400js'],
    deviceTypeId: 'b61890d5-bed1-4cb0-8ee6-a32209dc0bf4',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/jazz-series-data_sheet.pdf',
      name: 'Christie DWU2400-JS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('3G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('3G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '23.750 ISO / 20.000 ANSI lm · 1920x1200 1-DLP 0,8" HEP · Laser-Phosphor · 29,4 kg · 1.290 W (Normal)',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/jazz-series-data_sheet.pdf
  {
    match: ['christie4k1600js', '4k1600js'],
    deviceTypeId: '6da3035e-c0b6-44bc-a498-8bbb4e5d2d0f',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/jazz-series-data_sheet.pdf',
      name: 'Christie 4K1600-JS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('12G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('12G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '16.600 ISO / 14.000 ANSI lm · 3840x2400 (4K UHD+) 1-DLP 0,8" HEP · Laser-Phosphor · 29,4 kg · 1.020 W (Normal)',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/jazz-series-data_sheet.pdf
  {
    match: ['christie4k2100js', '4k2100js'],
    deviceTypeId: 'e4be6170-5635-4343-8cb6-93424a1f3803',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/jazz-series-data_sheet.pdf',
      name: 'Christie 4K2100-JS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('12G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('12G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '21.350 ISO / 18.000 ANSI lm · 3840x2400 (4K UHD+) 1-DLP 0,8" HEP · Laser-Phosphor · 29,4 kg · 1.340 W (Normal)',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/korus-series-data_sheet.pdf
  {
    match: ['christie4k1000ks', '4k1000ks'],
    deviceTypeId: 'ac21b7db-1f2d-45b7-98ec-f2369ec07402',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/korus-series-data_sheet.pdf',
      name: 'Christie 4K1000-KS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('12G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('12G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '10.050 ISO / 8.500 ANSI lm · 3840x2400 (4K UHD+) 1-DLP 0,8" HEP · Laser-Phosphor · 17,25 kg · 656 W (Normal) · 3D-Sync In/Out per BNC',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/korus-series-data_sheet.pdf
  {
    match: ['christie4k1400ks', '4k1400ks'],
    deviceTypeId: '47dbfe35-44b8-4980-98cc-5079474e1183',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/korus-series-data_sheet.pdf',
      name: 'Christie 4K1400-KS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0b In 1 (rear)','HDMI','HDMI'),
        P('HDMI 2.0b In 2 (bottom)','HDMI','HDMI'),
        P('12G-SDI In','BNC','SDI'),
        P('DisplayPort In','DisplayPort','DisplayPort'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('USB (Type A)','USB Type A','USB'),
        P('3D Sync In','BNC','Genlock'),
        P('Ethernet (Control)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Remote In (3.5 mm)','Jack 3.5 mm TRS','Control'),
      ],
      outputs: [
        P('12G-SDI Loop Out','BNC','SDI'),
        P('HDMI Monitor Out','HDMI','HDMI'),
        P('3D Sync Out','BNC','Genlock'),
        P('12 VDC Out (DC-Jack, 200 mA)','DC Barrel','Power'),
      ],
      isRackDevice: false,
      notes: '14.250 ISO / 12.000 ANSI lm · 3840x2400 (4K UHD+) 1-DLP 0,8" HEP · Laser-Phosphor · 17,25 kg · 755 W (Normal) · 3D-Sync In/Out per BNC',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/4k860-is-data_sheet.pdf
  {
    match: ['christie4k860is', '4k860is'],
    deviceTypeId: '1f46f269-971e-4e5c-a98e-5d6b500e325f',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/4k860-is-data_sheet.pdf',
      name: 'Christie 4K860-iS',
      category: PROJ,
      inputs: [
        P('HDMI 2.0 In 1','HDMI','HDMI'),
        P('HDMI 2.0 In 2','HDMI','HDMI'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('3D Sync In','BNC','Genlock'),
        P('USB-B (Service)','USB Type B','USB'),
        P('Ethernet (RJ45)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Wired Remote (3.5 mm)','Jack 3.5 mm','Control'),
      ],
      outputs: [
        P('3D Sync Out','BNC','Genlock'),
        P('HDMI Out','HDMI','HDMI'),
        P('12 V Trigger','Jack 3.5 mm','Trigger'),
        P('Audio Out (3.5 mm)','Jack 3.5 mm','Audio'),
        P('USB-A (5 V Power)','USB Type A','Power'),
      ],
      isRackDevice: false,
      notes: '8.500 ISO / 7.200 ANSI lm · 3840x2160 1-DLP 0,65" · Laser-Phosphor · 15 kg · 530 W',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/Christie-Inspire-Series-data-sheet.pdf
  {
    match: ['christiedwu760is', 'dwu760is'],
    deviceTypeId: '439480f8-2d39-4a18-ae54-a78dd486a47f',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/Christie-Inspire-Series-data-sheet.pdf',
      name: 'Christie DWU760-iS',
      category: PROJ,
      inputs: [
        P('HDMI 1.4a In','HDMI','HDMI'),
        P('HDMI 2.0 In','HDMI','HDMI'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('3D Sync In','BNC','Genlock'),
        P('VGA In','VGA','VGA'),
        P('Audio In (3.5 mm)','Jack 3.5 mm','Audio'),
        P('Ethernet (RJ45)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Wired Remote (3.5 mm)','Jack 3.5 mm','Control'),
      ],
      outputs: [
        P('3D Sync Out','BNC','Genlock'),
        P('HDMI Out','HDMI','HDMI'),
        P('12 V Trigger','DC Barrel','Trigger'),
        P('Audio Out (3.5 mm)','Jack 3.5 mm','Audio'),
        P('USB-A (5 V Power)','USB Type A','Power'),
      ],
      isRackDevice: false,
      notes: '7.150 ISO / 6.000 ANSI lm · 1920x1200 1-DLP 0,67" · Laser-Phosphor · 13,5–13,7 kg · 415 W bei 110 V',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/Christie-Inspire-Series-data-sheet.pdf
  {
    match: ['christiedwu860is', 'dwu860is'],
    deviceTypeId: 'bd33e180-f3c2-4e17-9dd0-277ec39c793c',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/Christie-Inspire-Series-data-sheet.pdf',
      name: 'Christie DWU860-iS',
      category: PROJ,
      inputs: [
        P('HDMI 1.4a In','HDMI','HDMI'),
        P('HDMI 2.0 In','HDMI','HDMI'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('3D Sync In','BNC','Genlock'),
        P('VGA In','VGA','VGA'),
        P('Audio In (3.5 mm)','Jack 3.5 mm','Audio'),
        P('Ethernet (RJ45)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Wired Remote (3.5 mm)','Jack 3.5 mm','Control'),
      ],
      outputs: [
        P('3D Sync Out','BNC','Genlock'),
        P('HDMI Out','HDMI','HDMI'),
        P('12 V Trigger','DC Barrel','Trigger'),
        P('Audio Out (3.5 mm)','Jack 3.5 mm','Audio'),
        P('USB-A (5 V Power)','USB Type A','Power'),
      ],
      isRackDevice: false,
      notes: '8.500 ISO / 7.200 ANSI lm · 1920x1200 1-DLP 0,67" · Laser-Phosphor · 13,5–13,7 kg · 505 W bei 220 V',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/Christie-Inspire-Series-data-sheet.pdf
  {
    match: ['christiedwu960is', 'dwu960is'],
    deviceTypeId: '4f911ab0-ae63-4c64-943c-56d953b41480',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/Christie-Inspire-Series-data-sheet.pdf',
      name: 'Christie DWU960-iS',
      category: PROJ,
      inputs: [
        P('HDMI 1.4a In','HDMI','HDMI'),
        P('HDMI 2.0 In','HDMI','HDMI'),
        P('HDBaseT In','Ethernet/RJ45','HDBaseT'),
        P('3D Sync In','BNC','Genlock'),
        P('VGA In','VGA','VGA'),
        P('Audio In (3.5 mm)','Jack 3.5 mm','Audio'),
        P('Ethernet (RJ45)','Ethernet/RJ45','Ethernet'),
        P('RS232','DB9','RS232'),
        P('Wired Remote (3.5 mm)','Jack 3.5 mm','Control'),
      ],
      outputs: [
        P('3D Sync Out','BNC','Genlock'),
        P('HDMI Out','HDMI','HDMI'),
        P('12 V Trigger','DC Barrel','Trigger'),
        P('Audio Out (3.5 mm)','Jack 3.5 mm','Audio'),
        P('USB-A (5 V Power)','USB Type A','Power'),
      ],
      isRackDevice: false,
      notes: '9.600 ISO / 8.100 ANSI lm · 1920x1200 1-DLP 0,67" · Laser-Phosphor · 13,5–13,7 kg · 545 W bei 110 V',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/captiva-dwu500s-data-sheet.pdf
  {
    match: ['christiecaptivadwu500s', 'captivadwu500s', 'dwu500s'],
    deviceTypeId: '5a57c7b1-3864-44e4-9f15-a05fd9bdb7dc',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/captiva-dwu500s-data-sheet.pdf',
      name: 'Christie Captiva DWU500S',
      category: PROJ,
      inputs: [
        P('HDMI In 1','HDMI','HDMI'),
        P('HDMI In 2','HDMI','HDMI'),
        P('VGA In','VGA','VGA'),
        P('VGA Audio In (3.5 mm)','Jack 3.5 mm','Audio'),
        P('Mic In','Generic','Audio'),
        P('RS232 In','DB9','RS232'),
        P('Ethernet 100BaseT','Ethernet/RJ45','Ethernet'),
      ],
      outputs: [
        P('VGA Monitor Out','VGA','VGA'),
        P('Audio Out (3.5 mm)','Jack 3.5 mm','Audio'),
        P('USB A (5 V/1.5 A Power)','USB Type A','Power'),
      ],
      isRackDevice: false,
      notes: '5.000 ISO / 4.500 ANSI lm · 1920x1200 1-DLP 0,67" · Laser · 5,8 kg · 100–240 V, 350 W max · 10-W-Lautsprecher',
      width: 280,
      height: 260,
    },
  },

]
