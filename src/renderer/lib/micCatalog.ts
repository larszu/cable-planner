// ───────────────────────────────────────────────────────────────────────────
// Mikrofon-Katalog (Kategorie "Mikrofone")
//
// Datenblatt-recherchierte Standard-Mikrofone (Broadcast/Live/Studio). Jeder
// Eintrag traegt die stabile Geraetetyp-GUID (GDTF/DIN-SPEC-15800-analog) und
// die Fachdaten in categoryProps (Wandlerprinzip, Richtcharakteristik,
// Speisung/Phantom, Kapsel, typ. Einsatz, Max SPL). Grundsatz: KEINE erfundenen
// Werte — unsichere Angaben (z.B. nicht offiziell spezifizierter Max SPL) werden
// weggelassen statt geraten. Quellen-URL je Eintrag.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment'

interface MicEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF-analog: FixtureTypeID). */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: MicEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const MIC_CATALOG: MicEntry[] = [
  // Shure SM57 — Instrumenten-Standard (Snare/Amp), extrem hoher SPL
  // Quelle: https://www.shure.com/en-US/microphones/sm57
  {
    match: ['sm57'],
    deviceTypeId: '8a940e24-1c9c-4571-a820-50cd7ce55ed1',
    template: {
      name: 'Shure SM57',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'snare', maxSplDb: 150, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure SM58 — Gesangs-Standard
  // Quelle: https://www.shure.com/en-US/microphones/sm58
  {
    match: ['sm58'],
    deviceTypeId: '4e75a4d0-7490-431f-8230-fef93fa265ef',
    template: {
      name: 'Shure SM58',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'vocal', maxSplDb: 150, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 52A — Kick-Drum-Mic, Max SPL 174 dB
  // Quelle: https://www.shure.com/en-US/microphones/beta_52a
  {
    match: ['beta 52'],
    deviceTypeId: '89800fa5-c02c-4592-ab60-1a829d36bbca',
    template: {
      name: 'Shure Beta 52A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'kick', maxSplDb: 174, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 91A — Grenzflaechen-Kondensator fuer Kick In
  // Quelle: https://www.shure.com/en-US/microphones/beta_91a
  {
    match: ['beta 91'],
    deviceTypeId: '875fe949-20d3-4c51-b83b-a729c73b363d',
    template: {
      name: 'Shure Beta 91A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'boundary', powering: 'p48', capsule: 'boundary', micApplication: 'kick', maxSplDb: 155, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 57A — Snare/Instrument, Superniere
  // Quelle: https://www.shure.com/en-US/microphones/beta_57a
  {
    match: ['beta 57'],
    deviceTypeId: 'a676a2b5-927a-49bf-bba4-7156001f02d0',
    template: {
      name: 'Shure Beta 57A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'snare', maxSplDb: 150, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure SM7B — Broadcast-/Gesangs-Grossmembran (dynamisch)
  // Quelle: https://www.shure.com/en-US/microphones/sm7b
  {
    match: ['sm7b'],
    deviceTypeId: '73c42067-1794-43de-80f6-9c1d683c1bff',
    template: {
      name: 'Shure SM7B',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MD421-II — Tom/Instrument-Klassiker, 5-Stufen-Bassrolloff
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/md-421-ii
  {
    match: ['md421'],
    deviceTypeId: '689107af-28fb-4bba-905a-21f00f0458e7',
    template: {
      name: 'Sennheiser MD421-II',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'tom', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e604 — Clip-Mic fuer Tom/Snare
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-604
  {
    match: ['e604'],
    deviceTypeId: '70c7cb6b-5485-4206-91fe-406c60d48e31',
    template: {
      name: 'Sennheiser e604',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'clip', micApplication: 'tom', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e602-II — Kick-Drum-Mic
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-602-ii
  {
    match: ['e602'],
    deviceTypeId: 'b25ecb84-34aa-415f-bf57-ff703b661aed',
    template: {
      name: 'Sennheiser e602-II',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'kick', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e906 — Gitarren-Amp-Mic, flach anlegbar
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-906
  {
    match: ['e906'],
    deviceTypeId: '7b5ecf9a-52e9-4bcd-ac0e-a6d5524aa40f',
    template: {
      name: 'Sennheiser e906',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'guitar', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix D6 — Kick-Drum-Mic
  // Quelle: https://audixusa.com/products/d6
  {
    match: ['audix', 'd6'],
    deviceTypeId: 'fd5e9328-d8a2-4570-b731-da13c389c8d5',
    template: {
      name: 'Audix D6',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'kick', maxSplDb: 144, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix i5 — Snare/Instrument
  // Quelle: https://audixusa.com/products/i5
  {
    match: ['audix', 'i5'],
    deviceTypeId: 'a3c7f751-ed7f-4293-9567-b11fee957c6f',
    template: {
      name: 'Audix i5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'snare', maxSplDb: 140, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix D2 — Rack-Tom-Mic
  // Quelle: https://audixusa.com/products/d2
  {
    match: ['audix', 'd2'],
    deviceTypeId: '0182d60e-9ac4-4a90-9b4b-891f86441b52',
    template: {
      name: 'Audix D2',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'tom', maxSplDb: 144, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix D4 — Floor-Tom/Kick-Mic
  // Quelle: https://audixusa.com/products/d4
  {
    match: ['audix', 'd4'],
    deviceTypeId: '5a46a127-a8a0-40fa-a19a-a3aa4fd68a29',
    template: {
      name: 'Audix D4',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'tom', maxSplDb: 144, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic M 88 TG — Hyperniere fuer Kick/Bass/Gesang
  // Quelle: https://www.beyerdynamic.com/m-88-tg.html
  {
    match: ['m 88', 'm88'],
    deviceTypeId: 'c9e76a8c-5ea3-491d-8901-e2fccc62e7b8',
    template: {
      name: 'Beyerdynamic M 88 TG',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'kick', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic M 201 TG — Dynamisches Kleinmembran-Instrumentenmic
  // Quelle: https://www.beyerdynamic.com/m-201-tg.html
  {
    match: ['m 201', 'm201'],
    deviceTypeId: '69334b49-e804-4d7d-8690-60aeaaedad0a',
    template: {
      name: 'Beyerdynamic M 201 TG',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'smallDiaphragm', micApplication: 'instrument', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice RE20 — Broadcast-/Kick-Grossmembran, Variable-D
  // Quelle: https://www.electrovoice.com/product/re20/
  {
    match: ['re20'],
    deviceTypeId: '12ecf8e2-dcd4-4bab-b088-cf30933774a7',
    template: {
      name: 'Electro-Voice RE20',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann KM 184 — Kleinmembran-Overhead-Standard
  // Quelle: https://www.neumann.com/en-us/products/microphones/km-184/
  {
    match: ['km 184', 'km184'],
    deviceTypeId: 'b5746bf5-52c9-4e6d-940e-a66aeafcf236',
    template: {
      name: 'Neumann KM 184',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', maxSplDb: 138, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C451 B — Kleinmembran fuer OH/HiHat, Pad+Rolloff
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C451B.html
  {
    match: ['c451'],
    deviceTypeId: '52f6db37-35e5-4a93-bc8a-78dc3a0f9c8f',
    template: {
      name: 'AKG C451 B',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', maxSplDb: 155, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NT5 — Kleinmembran-Overhead (Paar)
  // Quelle: https://rode.com/en-us/microphones/studio-condenser/nt5
  {
    match: ['nt5'],
    deviceTypeId: '853cbd16-325c-49ea-a209-26ea2782bab3',
    template: {
      name: 'Rode NT5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', maxSplDb: 143, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // sE Electronics sE8 — Kleinmembran-Overhead, sehr hoher Max SPL
  // Quelle: https://seelectronics.com/se8-series/
  {
    match: ['se8'],
    deviceTypeId: '77f17f29-0429-4d90-992d-f59ba291ba5e',
    template: {
      name: 'sE Electronics sE8',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', maxSplDb: 159, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4011 — Referenz-Kleinmembran
  // Quelle: https://www.dpamicrophones.com/pencil/4011a-cardioid-microphone/
  {
    match: ['4011'],
    deviceTypeId: 'cd7ecb76-49b1-4de9-9928-1901976d3f09',
    template: {
      name: 'DPA 4011',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', maxSplDb: 158, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 2011 — Twin-Diaphragm-Kompakt-Kondensator
  // Quelle: https://www.dpamicrophones.com/compact/2011-twin-diaphragm-cardioid-microphone/
  {
    match: ['2011'],
    deviceTypeId: 'b92cd58f-1ee4-4410-bbfb-8bd799f65371',
    template: {
      name: 'DPA 2011',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', maxSplDb: 153, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure SM81 — Kleinmembran OH/Akustik
  // Quelle: https://www.shure.com/en-US/microphones/sm81
  {
    match: ['sm81'],
    deviceTypeId: 'dea02a2a-a993-496e-9f73-639428cb1615',
    template: {
      name: 'Shure SM81',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', maxSplDb: 146, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann U 87 Ai — Grossmembran-Studiostandard, Multipattern
  // Quelle: https://www.neumann.com/en-us/products/microphones/u-87-ai/
  {
    match: ['u 87', 'u87'],
    deviceTypeId: '17dcf897-5088-493f-84a4-ff8dbbc4f5d6',
    template: {
      name: 'Neumann U 87 Ai',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', maxSplDb: 127, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann TLM 103 — Grossmembran fuer Gesang/Sprache
  // Quelle: https://www.neumann.com/en-us/products/microphones/tlm-103/
  {
    match: ['tlm 103', 'tlm103'],
    deviceTypeId: '6e1337a3-bcf5-4158-826f-8cc0f0923c32',
    template: {
      name: 'Neumann TLM 103',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', maxSplDb: 138, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C414 XLII — Grossmembran, 9 Charakteristiken
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C414XLII.html
  {
    match: ['c414'],
    deviceTypeId: 'bde47578-29ef-432f-8781-af950060a85e',
    template: {
      name: 'AKG C414 XLII',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'instrument', maxSplDb: 158, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NT1 (5th Gen) — Rauscharme Grossmembran
  // Quelle: https://rode.com/en-us/microphones/studio-condenser/nt1-5th-generation
  {
    match: ['nt1'],
    deviceTypeId: '76bfc7fb-2690-4063-991a-7cc0fafbeaab',
    template: {
      name: 'Rode NT1 (5th Gen)',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', maxSplDb: 132, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Royer R-121 — Baendchen fuer Gitarren-Amp/Room
  // Quelle: https://royerlabs.com/r-121/
  {
    match: ['r-121', 'r121'],
    deviceTypeId: 'fff78597-0ff5-4229-bdd8-5219e2ad489d',
    template: {
      name: 'Royer R-121',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'guitar', maxSplDb: 135, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AEA R84 — Grossbaendchen fuer Room/Instrument
  // Quelle: https://www.aearibbonmics.com/products/r84/
  {
    match: ['r84'],
    deviceTypeId: 'ac855de2-31e0-4000-8425-3513a2dc676c',
    template: {
      name: 'AEA R84',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'room', maxSplDb: 165, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Coles 4038 — Studio-Baendchen fuer Overheads/Blaeser
  // Quelle: https://www.coleselectroacoustics.com/4038-studio-ribbon-microphone/
  {
    match: ['4038'],
    deviceTypeId: '3f8c13df-97b8-46b0-9856-2d8e10aff957',
    template: {
      name: 'Coles 4038',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'overhead', maxSplDb: 125, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MKH 416 — Broadcast-Richtrohr (RF-Kondensator)
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mkh-416-p48u3
  {
    match: ['mkh 416', 'mkh416'],
    deviceTypeId: 'ecc06dd3-18a9-44ba-ac10-d395de9c23f2',
    template: {
      name: 'Sennheiser MKH 416',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'shotgun', powering: 'p48', capsule: 'shotgun', micApplication: 'broadcast', maxSplDb: 130, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NTG3 — Richtrohr fuer Film/Broadcast
  // Quelle: https://rode.com/en-us/microphones/shotgun/ntg3
  {
    match: ['ntg3'],
    deviceTypeId: '1c9236bf-a901-47aa-b769-ba5d6df17cd2',
    template: {
      name: 'Rode NTG3',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'shotgun', powering: 'p48', capsule: 'shotgun', micApplication: 'broadcast', maxSplDb: 130, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MKE 2 — Lavalier (Kugel), auch als Anstecker
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mke-2
  {
    match: ['mke 2', 'mke2'],
    deviceTypeId: 'bc3f364f-0f83-4e0e-92de-9046c2ae1940',
    template: {
      name: 'Sennheiser MKE 2',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'Mini-XLR', connectorType: 'Mini-XLR', gender: 'male' }],
      categoryProps: { transducer: 'electret', polarPattern: 'omni', powering: 'plugin', capsule: 'lavalier', micApplication: 'broadcast', maxSplDb: 142, connectorOut: 'miniXlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4060 — Miniatur-Lavalier (Kugel)
  // Quelle: https://www.dpamicrophones.com/lavalier/4060-series-miniature-omnidirectional-microphone/
  {
    match: ['4060'],
    deviceTypeId: '2c903fcb-03d6-46aa-b38d-2cd7314afdb9',
    template: {
      name: 'DPA 4060',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'Mini-XLR', connectorType: 'Mini-XLR', gender: 'male' }],
      categoryProps: { transducer: 'electret', polarPattern: 'omni', powering: 'plugin', capsule: 'lavalier', micApplication: 'broadcast', maxSplDb: 134, connectorOut: 'miniXlr' },
      width: 180, height: 120,
    },
  },
  // Crown PZM-30D — Grenzflaeche fuer Konferenz/Room/Kick In
  // Quelle: https://www.crownaudio.com/en/products/pzm-30d
  {
    match: ['pzm-30', 'pzm30'],
    deviceTypeId: 'f9ea943b-a891-43ec-99c9-bbf16909aef3',
    template: {
      name: 'Crown PZM-30D',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'boundary', powering: 'p48', capsule: 'boundary', micApplication: 'room', maxSplDb: 150, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
]

/** Flat list of all built-in mic templates (seeded into the library). */
export const micTemplates: EquipmentTemplate[] = MIC_CATALOG.map(withTypeId)

/** Return a matching mic template for a given equipment name, or null. */
export const matchMicTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of MIC_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  const isBrandKnown = lower.includes('shure') ||
    lower.includes('sm57') ||
    lower.includes('sm58') ||
    lower.includes('sm7b') ||
    lower.includes('beta 5') ||
    lower.includes('beta 9') ||
    lower.includes('sennheiser') ||
    lower.includes('md421') ||
    lower.includes('e60') ||
    lower.includes('e90') ||
    lower.includes('mkh') ||
    lower.includes('mke') ||
    lower.includes('audix') ||
    lower.includes('beyerdynamic') ||
    lower.includes('m 88') ||
    lower.includes('m 201') ||
    lower.includes('electro-voice') ||
    lower.includes('re20') ||
    lower.includes('neumann') ||
    lower.includes('km 184') ||
    lower.includes('tlm') ||
    lower.includes('u 87') ||
    lower.includes('akg') ||
    lower.includes('c451') ||
    lower.includes('c414') ||
    lower.includes('rode') ||
    lower.includes('nt5') ||
    lower.includes('nt1') ||
    lower.includes('ntg') ||
    lower.includes('se electronics') ||
    lower.includes('se8') ||
    lower.includes('dpa') ||
    lower.includes('4011') ||
    lower.includes('2011') ||
    lower.includes('4060') ||
    lower.includes('royer') ||
    lower.includes('r-121') ||
    lower.includes('aea') ||
    lower.includes('r84') ||
    lower.includes('coles') ||
    lower.includes('4038') ||
    lower.includes('crown') ||
    lower.includes('pzm')
  if (!isBrandKnown) return null
  for (const entry of MIC_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
