// ───────────────────────────────────────────────────────────────────────────
// Mikrofon-Katalog (Kategorie "Mikrofone")
//
// Datenblatt-recherchierte Standard-Mikrofone (Broadcast/Live/Studio). Jeder
// Eintrag traegt die stabile Geraetetyp-GUID (GDTF/DIN-SPEC-15800-analog) und
// die Fachdaten in categoryProps (Wandlerprinzip, Richtcharakteristik,
// Speisung/Phantom, Kapsel, typ. Einsatz, Max SPL, Klangfarbe, Naheffekt).
//
// Der Naheffekt (proximityEffect) ist aus dem Polar-Muster abgeleitet — das ist
// Physik, kein Raten (DPA Mic-University: Acht > Hyper/Super > Niere > breite
// Niere; Kugel/Grenzflaeche keiner). tonalCharacter/Max SPL nur wo belegt.
// Grundsatz: unsichere Angaben weglassen statt raten. Quellen-URL je Eintrag.
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
  // Shure SM57
  // Quelle: https://www.shure.com/en-US/microphones/sm57
  {
    match: ['sm57'],
    deviceTypeId: '8a940e24-1c9c-4571-a820-50cd7ce55ed1',
    template: {
      name: 'Shure SM57',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'moderate', maxSplDb: 150, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure SM58
  // Quelle: https://www.shure.com/en-US/microphones/sm58
  {
    match: ['sm58'],
    deviceTypeId: '4e75a4d0-7490-431f-8230-fef93fa265ef',
    template: {
      name: 'Shure SM58',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 150, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 52A
  // Quelle: https://www.shure.com/en-US/microphones/beta_52a
  {
    match: ['beta 52'],
    deviceTypeId: '89800fa5-c02c-4592-ab60-1a829d36bbca',
    template: {
      name: 'Shure Beta 52A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'kick', proximityEffect: 'strong', maxSplDb: 174, tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 91A
  // Quelle: https://www.shure.com/en-US/microphones/beta_91a
  {
    match: ['beta 91'],
    deviceTypeId: '875fe949-20d3-4c51-b83b-a729c73b363d',
    template: {
      name: 'Shure Beta 91A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'boundary', powering: 'p48', capsule: 'boundary', micApplication: 'kick', proximityEffect: 'none', maxSplDb: 155, tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 57A
  // Quelle: https://www.shure.com/en-US/microphones/beta_57a
  {
    match: ['beta 57'],
    deviceTypeId: 'a676a2b5-927a-49bf-bba4-7156001f02d0',
    template: {
      name: 'Shure Beta 57A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'strong', maxSplDb: 150, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure SM7B
  // Quelle: https://www.shure.com/en-US/microphones/sm7b
  {
    match: ['sm7b'],
    deviceTypeId: '73c42067-1794-43de-80f6-9c1d683c1bff',
    template: {
      name: 'Shure SM7B',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MD421-II
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/md-421-ii
  {
    match: ['md421'],
    deviceTypeId: '689107af-28fb-4bba-905a-21f00f0458e7',
    template: {
      name: 'Sennheiser MD421-II',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'tom', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e604
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-604
  {
    match: ['e604'],
    deviceTypeId: '70c7cb6b-5485-4206-91fe-406c60d48e31',
    template: {
      name: 'Sennheiser e604',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'clip', micApplication: 'tom', proximityEffect: 'moderate', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e602-II
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-602-ii
  {
    match: ['e602'],
    deviceTypeId: 'b25ecb84-34aa-415f-bf57-ff703b661aed',
    template: {
      name: 'Sennheiser e602-II',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'kick', proximityEffect: 'moderate', tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e906
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-906
  {
    match: ['e906'],
    deviceTypeId: '7b5ecf9a-52e9-4bcd-ac0e-a6d5524aa40f',
    template: {
      name: 'Sennheiser e906',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'guitar', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix D6
  // Quelle: https://audixusa.com/products/d6
  {
    match: ['audix', 'd6'],
    deviceTypeId: 'fd5e9328-d8a2-4570-b731-da13c389c8d5',
    template: {
      name: 'Audix D6',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'kick', proximityEffect: 'moderate', maxSplDb: 144, tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix i5
  // Quelle: https://audixusa.com/products/i5
  {
    match: ['audix', 'i5'],
    deviceTypeId: 'a3c7f751-ed7f-4293-9567-b11fee957c6f',
    template: {
      name: 'Audix i5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'moderate', maxSplDb: 140, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix D2
  // Quelle: https://audixusa.com/products/d2
  {
    match: ['audix', 'd2'],
    deviceTypeId: '0182d60e-9ac4-4a90-9b4b-891f86441b52',
    template: {
      name: 'Audix D2',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'tom', proximityEffect: 'strong', maxSplDb: 144, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix D4
  // Quelle: https://audixusa.com/products/d4
  {
    match: ['audix', 'd4'],
    deviceTypeId: '5a46a127-a8a0-40fa-a19a-a3aa4fd68a29',
    template: {
      name: 'Audix D4',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'tom', proximityEffect: 'strong', maxSplDb: 144, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic M 88 TG
  // Quelle: https://www.beyerdynamic.com/m-88-tg.html
  {
    match: ['m 88', 'm88'],
    deviceTypeId: 'c9e76a8c-5ea3-491d-8901-e2fccc62e7b8',
    template: {
      name: 'Beyerdynamic M 88 TG',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'kick', proximityEffect: 'strong', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic M 201 TG
  // Quelle: https://www.beyerdynamic.com/m-201-tg.html
  {
    match: ['m 201', 'm201'],
    deviceTypeId: '69334b49-e804-4d7d-8690-60aeaaedad0a',
    template: {
      name: 'Beyerdynamic M 201 TG',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'smallDiaphragm', micApplication: 'instrument', proximityEffect: 'strong', tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice RE20
  // Quelle: https://www.electrovoice.com/product/re20/
  {
    match: ['re20'],
    deviceTypeId: '12ecf8e2-dcd4-4bab-b088-cf30933774a7',
    template: {
      name: 'Electro-Voice RE20',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann KM 184
  // Quelle: https://www.neumann.com/en-us/products/microphones/km-184/
  {
    match: ['km 184', 'km184'],
    deviceTypeId: 'b5746bf5-52c9-4e6d-940e-a66aeafcf236',
    template: {
      name: 'Neumann KM 184',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 138, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C451 B
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C451B.html
  {
    match: ['c451'],
    deviceTypeId: '52f6db37-35e5-4a93-bc8a-78dc3a0f9c8f',
    template: {
      name: 'AKG C451 B',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 155, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NT5
  // Quelle: https://rode.com/en-us/microphones/studio-condenser/nt5
  {
    match: ['nt5'],
    deviceTypeId: '853cbd16-325c-49ea-a209-26ea2782bab3',
    template: {
      name: 'Rode NT5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 143, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // sE Electronics sE8
  // Quelle: https://seelectronics.com/se8-series/
  {
    match: ['se8'],
    deviceTypeId: '77f17f29-0429-4d90-992d-f59ba291ba5e',
    template: {
      name: 'sE Electronics sE8',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 159, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4011
  // Quelle: https://www.dpamicrophones.com/pencil/4011a-cardioid-microphone/
  {
    match: ['4011'],
    deviceTypeId: 'cd7ecb76-49b1-4de9-9928-1901976d3f09',
    template: {
      name: 'DPA 4011',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 158, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 2011
  // Quelle: https://www.dpamicrophones.com/compact/2011-twin-diaphragm-cardioid-microphone/
  {
    match: ['2011'],
    deviceTypeId: 'b92cd58f-1ee4-4410-bbfb-8bd799f65371',
    template: {
      name: 'DPA 2011',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 153, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure SM81
  // Quelle: https://www.shure.com/en-US/microphones/sm81
  {
    match: ['sm81'],
    deviceTypeId: 'dea02a2a-a993-496e-9f73-639428cb1615',
    template: {
      name: 'Shure SM81',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 146, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann U 87 Ai
  // Quelle: https://www.neumann.com/en-us/products/microphones/u-87-ai/
  {
    match: ['u 87', 'u87'],
    deviceTypeId: '17dcf897-5088-493f-84a4-ff8dbbc4f5d6',
    template: {
      name: 'Neumann U 87 Ai',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 127, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann TLM 103
  // Quelle: https://www.neumann.com/en-us/products/microphones/tlm-103/
  {
    match: ['tlm 103', 'tlm103'],
    deviceTypeId: '6e1337a3-bcf5-4158-826f-8cc0f0923c32',
    template: {
      name: 'Neumann TLM 103',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 138, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C414 XLII
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C414XLII.html
  {
    match: ['c414'],
    deviceTypeId: 'bde47578-29ef-432f-8781-af950060a85e',
    template: {
      name: 'AKG C414 XLII',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 158, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NT1 (5th Gen)
  // Quelle: https://rode.com/en-us/microphones/studio-condenser/nt1-5th-generation
  {
    match: ['nt1'],
    deviceTypeId: '76bfc7fb-2690-4063-991a-7cc0fafbeaab',
    template: {
      name: 'Rode NT1 (5th Gen)',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 132, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Royer R-121
  // Quelle: https://royerlabs.com/r-121/
  {
    match: ['r-121', 'r121'],
    deviceTypeId: 'fff78597-0ff5-4229-bdd8-5219e2ad489d',
    template: {
      name: 'Royer R-121',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'guitar', proximityEffect: 'strong', maxSplDb: 135, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AEA R84
  // Quelle: https://www.aearibbonmics.com/products/r84/
  {
    match: ['r84'],
    deviceTypeId: 'ac855de2-31e0-4000-8425-3513a2dc676c',
    template: {
      name: 'AEA R84',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'room', proximityEffect: 'strong', maxSplDb: 165, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Coles 4038
  // Quelle: https://www.coleselectroacoustics.com/4038-studio-ribbon-microphone/
  {
    match: ['4038'],
    deviceTypeId: '3f8c13df-97b8-46b0-9856-2d8e10aff957',
    template: {
      name: 'Coles 4038',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'overhead', proximityEffect: 'strong', maxSplDb: 125, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MKH 416
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mkh-416-p48u3
  {
    match: ['mkh 416', 'mkh416'],
    deviceTypeId: 'ecc06dd3-18a9-44ba-ac10-d395de9c23f2',
    template: {
      name: 'Sennheiser MKH 416',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'shotgun', powering: 'p48', capsule: 'shotgun', micApplication: 'broadcast', proximityEffect: 'moderate', maxSplDb: 130, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NTG3
  // Quelle: https://rode.com/en-us/microphones/shotgun/ntg3
  {
    match: ['ntg3'],
    deviceTypeId: '1c9236bf-a901-47aa-b769-ba5d6df17cd2',
    template: {
      name: 'Rode NTG3',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'shotgun', powering: 'p48', capsule: 'shotgun', micApplication: 'broadcast', proximityEffect: 'moderate', maxSplDb: 130, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MKE 2
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mke-2
  {
    match: ['mke 2', 'mke2'],
    deviceTypeId: 'bc3f364f-0f83-4e0e-92de-9046c2ae1940',
    template: {
      name: 'Sennheiser MKE 2',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'Mini-XLR', connectorType: 'Mini-XLR', gender: 'male' }],
      categoryProps: { transducer: 'electret', polarPattern: 'omni', powering: 'plugin', capsule: 'lavalier', micApplication: 'broadcast', proximityEffect: 'none', maxSplDb: 142, connectorOut: 'miniXlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4060
  // Quelle: https://www.dpamicrophones.com/lavalier/4060-series-miniature-omnidirectional-microphone/
  {
    match: ['4060'],
    deviceTypeId: '2c903fcb-03d6-46aa-b38d-2cd7314afdb9',
    template: {
      name: 'DPA 4060',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'Mini-XLR', connectorType: 'Mini-XLR', gender: 'male' }],
      categoryProps: { transducer: 'electret', polarPattern: 'omni', powering: 'plugin', capsule: 'lavalier', micApplication: 'broadcast', proximityEffect: 'none', maxSplDb: 134, tonalCharacter: 'neutral', connectorOut: 'miniXlr' },
      width: 180, height: 120,
    },
  },
  // Crown PZM-30D
  // Quelle: https://www.crownaudio.com/en/products/pzm-30d
  {
    match: ['pzm-30', 'pzm30'],
    deviceTypeId: 'f9ea943b-a891-43ec-99c9-bbf16909aef3',
    template: {
      name: 'Crown PZM-30D',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'boundary', powering: 'p48', capsule: 'boundary', micApplication: 'room', proximityEffect: 'none', maxSplDb: 150, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure SM7dB
  // Quelle: https://www.shure.com/en-US/microphones/sm7db
  {
    match: ['sm7db'],
    deviceTypeId: '6bc9665f-20c0-4f46-8ba6-a02f09e642a8',
    template: {
      name: 'Shure SM7dB',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 58A
  // Quelle: https://www.shure.com/en-US/microphones/beta_58a
  {
    match: ['beta 58'],
    deviceTypeId: '994e1b29-1fad-45f7-b3e0-3212d494b1bc',
    template: {
      name: 'Shure Beta 58A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 87A
  // Quelle: https://www.shure.com/en-US/microphones/beta_87a
  {
    match: ['beta 87a'],
    deviceTypeId: 'c5840ffa-7fc5-45a1-a9b1-315e20ea9ea4',
    template: {
      name: 'Shure Beta 87A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'super', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 87C
  // Quelle: https://www.shure.com/en-US/microphones/beta_87c
  {
    match: ['beta 87c'],
    deviceTypeId: '84c00ce5-e379-4c18-8b33-e0c5100a2164',
    template: {
      name: 'Shure Beta 87C',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure KSM9
  // Quelle: https://www.shure.com/en-US/microphones/ksm9
  {
    match: ['ksm9'],
    deviceTypeId: '7f9ffe8d-7084-477f-ad34-5194185f5e88',
    template: {
      name: 'Shure KSM9',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 151, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure KSM8 Dualdyne
  // Quelle: https://www.shure.com/en-US/microphones/ksm8
  {
    match: ['ksm8'],
    deviceTypeId: 'd21ef7a5-957b-4535-8a4e-df89db12504c',
    template: {
      name: 'Shure KSM8 Dualdyne',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure KSM32
  // Quelle: https://www.shure.com/en-US/microphones/ksm32
  {
    match: ['ksm32'],
    deviceTypeId: '023c9c13-2db3-40f6-9ab1-70cb49b00219',
    template: {
      name: 'Shure KSM32',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 154, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure KSM44A
  // Quelle: https://www.shure.com/en-US/microphones/ksm44a
  {
    match: ['ksm44'],
    deviceTypeId: '0c690c16-0e3a-44de-a11b-6c097b93c92a',
    template: {
      name: 'Shure KSM44A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 132, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure KSM137
  // Quelle: https://www.shure.com/en-US/microphones/ksm137
  {
    match: ['ksm137'],
    deviceTypeId: '87defdf9-01de-47b5-bcf7-85ad17220076',
    template: {
      name: 'Shure KSM137',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 170, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure KSM141
  // Quelle: https://www.shure.com/en-US/microphones/ksm141
  {
    match: ['ksm141'],
    deviceTypeId: 'e2c227bf-c1cc-411e-96c2-f1515a79d6b5',
    template: {
      name: 'Shure KSM141',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 170, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 98A/C
  // Quelle: https://www.shure.com/en-US/microphones/beta_98ad_c
  {
    match: ['beta 98'],
    deviceTypeId: '84872411-f3c3-4c5f-bb6a-80c5036256a5',
    template: {
      name: 'Shure Beta 98A/C',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'clip', micApplication: 'tom', proximityEffect: 'moderate', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 181
  // Quelle: https://www.shure.com/en-US/microphones/beta_181
  {
    match: ['beta 181'],
    deviceTypeId: '91cb8399-2c62-4d9c-8808-892c1e21c06d',
    template: {
      name: 'Shure Beta 181',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 155, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure SM86
  // Quelle: https://www.shure.com/en-US/microphones/sm86
  {
    match: ['sm86'],
    deviceTypeId: '1831a767-e608-4b19-8d1a-fc6791a5e68a',
    template: {
      name: 'Shure SM86',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 147, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Super 55
  // Quelle: https://www.shure.com/en-US/microphones/super_55
  {
    match: ['super 55'],
    deviceTypeId: 'd6312206-b78f-423b-92a8-951693975cb5',
    template: {
      name: 'Shure Super 55',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure Beta 56A
  // Quelle: https://www.shure.com/en-US/microphones/beta_56a
  {
    match: ['beta 56'],
    deviceTypeId: 'd10a7391-892a-4c5b-9103-7c0902bfc771',
    template: {
      name: 'Shure Beta 56A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure PGA57
  // Quelle: https://www.shure.com/en-US/microphones/pga57
  {
    match: ['pga57'],
    deviceTypeId: '48ca03e5-07b7-41c1-ab7e-75c3d08d9068',
    template: {
      name: 'Shure PGA57',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Shure MV7 (XLR)
  // Quelle: https://www.shure.com/en-US/microphones/mv7
  {
    match: ['mv7'],
    deviceTypeId: '1bfeda62-b05e-4ed6-a998-1b4c23e59050',
    template: {
      name: 'Shure MV7 (XLR)',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MD 441-U
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/md-441-u
  {
    match: ['md 441', 'md441'],
    deviceTypeId: 'd7ab6cde-ad39-4463-8b74-d459cc60d549',
    template: {
      name: 'Sennheiser MD 441-U',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'strong', tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e835
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-835
  {
    match: ['e835'],
    deviceTypeId: 'ede7ebb4-0b1e-4fc5-aef3-9c84ec51b691',
    template: {
      name: 'Sennheiser e835',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e845
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-845
  {
    match: ['e845'],
    deviceTypeId: '73de6b51-0318-4945-b4b1-c6d24db7f514',
    template: {
      name: 'Sennheiser e845',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e865
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-865
  {
    match: ['e865'],
    deviceTypeId: '7810bfd5-2a50-4a77-89ec-69b3d2506dcc',
    template: {
      name: 'Sennheiser e865',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'super', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e935
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-935
  {
    match: ['e935'],
    deviceTypeId: '8318ddc1-6859-429c-87ed-a100c19665f4',
    template: {
      name: 'Sennheiser e935',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e945
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-945
  {
    match: ['e945'],
    deviceTypeId: '90bccac1-1fcf-46b6-aa27-42e6bbcc5239',
    template: {
      name: 'Sennheiser e945',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e901
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-901
  {
    match: ['e901'],
    deviceTypeId: 'e71bbe8d-1128-4a90-a685-a5150e143562',
    template: {
      name: 'Sennheiser e901',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'boundary', powering: 'p48', capsule: 'boundary', micApplication: 'kick', proximityEffect: 'none', maxSplDb: 150, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e902
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-902
  {
    match: ['e902'],
    deviceTypeId: '144a5a28-9163-4ae0-91b0-1755055e6e64',
    template: {
      name: 'Sennheiser e902',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'kick', proximityEffect: 'moderate', tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e905
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-905
  {
    match: ['e905'],
    deviceTypeId: '45e48422-339d-4148-93d3-bf6dc7efcf7e',
    template: {
      name: 'Sennheiser e905',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser e908 B
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/e-908-b
  {
    match: ['e908'],
    deviceTypeId: 'd044b76e-33c0-4d9a-a4c0-b16af5cea84b',
    template: {
      name: 'Sennheiser e908 B',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'clip', micApplication: 'instrument', proximityEffect: 'moderate', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MD 46
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/md-46
  {
    match: ['md 46', 'md46'],
    deviceTypeId: '1e7bc52c-feec-4aaf-90ab-e9a600843db7',
    template: {
      name: 'Sennheiser MD 46',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MK 4
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mk-4
  {
    match: ['mk 4', 'mk4'],
    deviceTypeId: '5f22cf68-efef-451c-8c48-d45f1a98aaa3',
    template: {
      name: 'Sennheiser MK 4',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 140, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MKH 8040
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mkh-8040
  {
    match: ['mkh 8040', '8040'],
    deviceTypeId: '5b2b3c22-f012-49f8-baf7-6f0a6b20683d',
    template: {
      name: 'Sennheiser MKH 8040',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 142, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MKH 50
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mkh-50-p48
  {
    match: ['mkh 50', 'mkh50'],
    deviceTypeId: '4711941b-cc9c-476d-ae2d-1fca312c0e21',
    template: {
      name: 'Sennheiser MKH 50',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'super', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'broadcast', proximityEffect: 'strong', maxSplDb: 134, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MKH 40
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mkh-40-p48
  {
    match: ['mkh 40', 'mkh40'],
    deviceTypeId: 'bd6ef8cf-87a4-4f64-a4a4-a43908d86d79',
    template: {
      name: 'Sennheiser MKH 40',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 134, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MKE 600
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/mke-600
  {
    match: ['mke 600', 'mke600'],
    deviceTypeId: 'a707e6d1-1eff-4295-ba7f-75305b4dbecc',
    template: {
      name: 'Sennheiser MKE 600',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'shotgun', powering: 'battery', capsule: 'shotgun', micApplication: 'broadcast', proximityEffect: 'moderate', maxSplDb: 132, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann TLM 102
  // Quelle: https://www.neumann.com/en-us/products/microphones/tlm-102/
  {
    match: ['tlm 102', 'tlm102'],
    deviceTypeId: 'c702e4aa-3e7c-4dc7-9890-8cb041284cc1',
    template: {
      name: 'Neumann TLM 102',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 144, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann TLM 107
  // Quelle: https://www.neumann.com/en-us/products/microphones/tlm-107/
  {
    match: ['tlm 107', 'tlm107'],
    deviceTypeId: '92700896-d86b-4332-a620-4c0c406b1d3d',
    template: {
      name: 'Neumann TLM 107',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 141, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann TLM 170 R
  // Quelle: https://www.neumann.com/en-us/products/microphones/tlm-170-r/
  {
    match: ['tlm 170'],
    deviceTypeId: 'a88e81a4-b28c-468e-9d47-9b484c8e14fe',
    template: {
      name: 'Neumann TLM 170 R',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 144, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann KM 185
  // Quelle: https://www.neumann.com/en-us/products/microphones/km-185/
  {
    match: ['km 185', 'km185'],
    deviceTypeId: '6b029879-b105-4b55-8c14-0453ab069ddf',
    template: {
      name: 'Neumann KM 185',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'hyper', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'strong', maxSplDb: 138, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann U 47 fet
  // Quelle: https://www.neumann.com/en-us/products/microphones/u-47-fet/
  {
    match: ['u 47 fet', 'u47 fet'],
    deviceTypeId: '2773662d-6478-4d03-8b54-a392cb11e2b2',
    template: {
      name: 'Neumann U 47 fet',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann KMS 105
  // Quelle: https://www.neumann.com/en-us/products/microphones/kms-105/
  {
    match: ['kms 105', 'kms105'],
    deviceTypeId: 'fc2855fc-4ff4-417f-bd39-ffadf5b3f22e',
    template: {
      name: 'Neumann KMS 105',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'super', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', maxSplDb: 150, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann KMS 104
  // Quelle: https://www.neumann.com/en-us/products/microphones/kms-104/
  {
    match: ['kms 104', 'kms104'],
    deviceTypeId: '178047af-41ff-4747-9774-0678a9be19e5',
    template: {
      name: 'Neumann KMS 104',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 150, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann M 149 Tube
  // Quelle: https://www.neumann.com/en-us/products/microphones/m-149-tube/
  {
    match: ['m 149', 'm149'],
    deviceTypeId: 'ae49c1ec-c02d-4ef7-835e-25bb4119c98a',
    template: {
      name: 'Neumann M 149 Tube',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 120, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann BCM 705
  // Quelle: https://www.neumann.com/en-us/products/microphones/bcm-705/
  {
    match: ['bcm 705', 'bcm705'],
    deviceTypeId: '49e0d574-cc45-4972-9ea4-20ed0d1c35e9',
    template: {
      name: 'Neumann BCM 705',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Neumann TLM 193
  // Quelle: https://www.neumann.com/en-us/products/microphones/tlm-193/
  {
    match: ['tlm 193', 'tlm193'],
    deviceTypeId: 'b8ee7382-6d39-4ea9-9d91-84201b6dcaf6',
    template: {
      name: 'Neumann TLM 193',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 130, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C414 XLS
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C414XLS.html
  {
    match: ['c414 xls'],
    deviceTypeId: '640a2f35-1388-4ad4-962d-5091a2033e97',
    template: {
      name: 'AKG C414 XLS',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 158, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C214
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C214.html
  {
    match: ['c214'],
    deviceTypeId: '24c120a8-0626-4a46-b0ee-90a396ade81e',
    template: {
      name: 'AKG C214',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 156, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG D112 MkII
  // Quelle: https://www.akg.com/microphones/dynamic-microphones/D112MKII.html
  {
    match: ['d112'],
    deviceTypeId: '942c855b-d188-4860-bdcd-f4ba08a133bc',
    template: {
      name: 'AKG D112 MkII',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', maxSplDb: 160, tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG D12 VR
  // Quelle: https://www.akg.com/microphones/dynamic-microphones/D12VR.html
  {
    match: ['d12'],
    deviceTypeId: 'e1706715-99dc-4922-9a17-1a4e9befa8ad',
    template: {
      name: 'AKG D12 VR',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', maxSplDb: 164, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG D5
  // Quelle: https://www.akg.com/microphones/dynamic-microphones/D5.html
  {
    match: ['akg d5'],
    deviceTypeId: '7a2e71de-1981-403a-9d69-355749cbd33b',
    template: {
      name: 'AKG D5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', maxSplDb: 147, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG D40
  // Quelle: https://www.akg.com/microphones/dynamic-microphones/D40.html
  {
    match: ['akg d40'],
    deviceTypeId: '64261931-cc6c-474b-89c7-ef8b8f539509',
    template: {
      name: 'AKG D40',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'instrument', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C1000 S
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C1000S.html
  {
    match: ['c1000'],
    deviceTypeId: 'ad4cd9fd-a0d1-45d4-aca1-c12d1108119d',
    template: {
      name: 'AKG C1000 S',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'battery', capsule: 'smallDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 137, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C3000
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C3000.html
  {
    match: ['c3000'],
    deviceTypeId: 'de81b3de-f9cf-4084-a991-e73a1947ed8c',
    template: {
      name: 'AKG C3000',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 150, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C12 VR
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C12VR.html
  {
    match: ['c12'],
    deviceTypeId: 'ee435947-8496-405f-b90a-fced0bdc5f9b',
    template: {
      name: 'AKG C12 VR',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 128, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AKG C519 ML
  // Quelle: https://www.akg.com/microphones/condenser-microphones/C519ML.html
  {
    match: ['c519'],
    deviceTypeId: '4331d3e5-c687-4fc6-a7b8-04db51bbe8bd',
    template: {
      name: 'AKG C519 ML',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'clip', micApplication: 'instrument', proximityEffect: 'moderate', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NT1-A
  // Quelle: https://rode.com/en-us/microphones/studio-condenser/nt1-a
  {
    match: ['nt1-a', 'nt1a'],
    deviceTypeId: '410a2fbd-641b-4658-994f-243bfd1ea7b6',
    template: {
      name: 'Rode NT1-A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 137, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NT2-A
  // Quelle: https://rode.com/en-us/microphones/studio-condenser/nt2-a
  {
    match: ['nt2-a', 'nt2a'],
    deviceTypeId: '64982e0e-626f-40ff-ad6d-ed5c09a3285a',
    template: {
      name: 'Rode NT2-A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 147, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NTK
  // Quelle: https://rode.com/en-us/microphones/studio-condenser/ntk
  {
    match: ['ntk'],
    deviceTypeId: 'be9fd8a1-7efc-4818-bb14-51840b935d69',
    template: {
      name: 'Rode NTK',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 158, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NTG5
  // Quelle: https://rode.com/en-us/microphones/shotgun/ntg5
  {
    match: ['ntg5'],
    deviceTypeId: '15424ef7-48ab-406d-ab33-37c68edbcc26',
    template: {
      name: 'Rode NTG5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'shotgun', powering: 'p48', capsule: 'shotgun', micApplication: 'broadcast', proximityEffect: 'moderate', maxSplDb: 131, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode NTG4+
  // Quelle: https://rode.com/en-us/microphones/shotgun/ntg4-plus
  {
    match: ['ntg4'],
    deviceTypeId: '048af6d5-a67d-4279-b46f-0d3a57a7c996',
    template: {
      name: 'Rode NTG4+',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'shotgun', powering: 'battery', capsule: 'shotgun', micApplication: 'broadcast', proximityEffect: 'moderate', maxSplDb: 131, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode Broadcaster
  // Quelle: https://rode.com/en-us/microphones/broadcast/broadcaster
  {
    match: ['broadcaster'],
    deviceTypeId: 'a7593df1-1997-4124-8265-cba33ac578f4',
    template: {
      name: 'Rode Broadcaster',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', maxSplDb: 142, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode Procaster
  // Quelle: https://rode.com/en-us/microphones/broadcast/procaster
  {
    match: ['procaster'],
    deviceTypeId: 'f89937dc-3d62-4d17-93bf-73fb595c7643',
    template: {
      name: 'Rode Procaster',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode PodMic
  // Quelle: https://rode.com/en-us/microphones/broadcast/podmic
  {
    match: ['podmic'],
    deviceTypeId: 'd78e38c0-1101-4afa-8eda-88d2b9644037',
    template: {
      name: 'Rode PodMic',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Rode M5
  // Quelle: https://rode.com/en-us/microphones/studio-condenser/m5
  {
    match: ['rode m5', 'm5 '],
    deviceTypeId: '905c2566-bc55-44f7-9bf4-4b334dbcbf9f',
    template: {
      name: 'Rode M5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 140, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT4040
  // Quelle: https://www.audio-technica.com/en-us/at4040
  {
    match: ['at4040'],
    deviceTypeId: '89914527-63b2-4a84-a769-c07e7e827f08',
    template: {
      name: 'Audio-Technica AT4040',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 155, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT4050
  // Quelle: https://www.audio-technica.com/en-us/at4050
  {
    match: ['at4050'],
    deviceTypeId: 'ede280ca-645c-451a-bcf6-141008d4cb42',
    template: {
      name: 'Audio-Technica AT4050',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 149, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT4033
  // Quelle: https://www.audio-technica.com/en-us/at4033a
  {
    match: ['at4033'],
    deviceTypeId: '9dfb4d9e-64ac-4175-ae71-bcf221ee14c0',
    template: {
      name: 'Audio-Technica AT4033',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 145, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT4047
  // Quelle: https://www.audio-technica.com/en-us/at4047-svsm
  {
    match: ['at4047'],
    deviceTypeId: '0a81ddd4-afae-4273-ad5e-dc8f63773e02',
    template: {
      name: 'Audio-Technica AT4047',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 149, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT2020
  // Quelle: https://www.audio-technica.com/en-us/at2020
  {
    match: ['at2020'],
    deviceTypeId: 'ce325785-ecb2-4f5a-bc6e-d5d160b17faf',
    template: {
      name: 'Audio-Technica AT2020',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 144, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT2035
  // Quelle: https://www.audio-technica.com/en-us/at2035
  {
    match: ['at2035'],
    deviceTypeId: '5a13a164-993a-4df1-9871-af0b144aaccd',
    template: {
      name: 'Audio-Technica AT2035',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 158, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT4060
  // Quelle: https://www.audio-technica.com/en-us/at4060a
  {
    match: ['at4060'],
    deviceTypeId: 'ab3e9720-7ee4-427e-b4b6-707c7fb9eac8',
    template: {
      name: 'Audio-Technica AT4060',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 150, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT5040
  // Quelle: https://www.audio-technica.com/en-us/at5040
  {
    match: ['at5040'],
    deviceTypeId: '57471618-0535-44bd-accf-a2e0fb7a86c3',
    template: {
      name: 'Audio-Technica AT5040',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 142, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica ATM650
  // Quelle: https://www.audio-technica.com/en-us/atm650
  {
    match: ['atm650'],
    deviceTypeId: 'a2cb67ba-b4e2-4f50-84c4-e6aac67c13cb',
    template: {
      name: 'Audio-Technica ATM650',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica ATM250
  // Quelle: https://www.audio-technica.com/en-us/atm250
  {
    match: ['atm250'],
    deviceTypeId: 'b901fa91-0923-41ce-a0f6-d73ea369db9e',
    template: {
      name: 'Audio-Technica ATM250',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'kick', proximityEffect: 'strong', tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica ATM350
  // Quelle: https://www.audio-technica.com/en-us/atm350a
  {
    match: ['atm350'],
    deviceTypeId: '1c16c1a8-2521-418a-84a0-4823498d195c',
    template: {
      name: 'Audio-Technica ATM350',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'clip', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 159, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica BP40
  // Quelle: https://www.audio-technica.com/en-us/bp40
  {
    match: ['bp40'],
    deviceTypeId: 'ba77d3c9-4b41-430c-bbef-633a236c6635',
    template: {
      name: 'Audio-Technica BP40',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'strong', maxSplDb: 148, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AE2500
  // Quelle: https://www.audio-technica.com/en-us/ae2500
  {
    match: ['ae2500'],
    deviceTypeId: '099dd425-15d0-452b-8375-b6578138641f',
    template: {
      name: 'Audio-Technica AE2500',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', maxSplDb: 148, connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AE6100
  // Quelle: https://www.audio-technica.com/en-us/ae6100
  {
    match: ['ae6100'],
    deviceTypeId: '5eabefec-37a4-4b68-9bc8-c6b6913f41a0',
    template: {
      name: 'Audio-Technica AE6100',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audio-Technica AT8035
  // Quelle: https://www.audio-technica.com/en-us/at8035
  {
    match: ['at8035'],
    deviceTypeId: '06db2a59-3769-4d29-b9e3-5db101d0f257',
    template: {
      name: 'Audio-Technica AT8035',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'shotgun', powering: 'battery', capsule: 'shotgun', micApplication: 'broadcast', proximityEffect: 'moderate', maxSplDb: 126, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4006A
  // Quelle: https://www.dpamicrophones.com/pencil/4006a-omnidirectional-microphone/
  {
    match: ['4006'],
    deviceTypeId: 'd2c16a68-d162-4cd7-b214-4a5ebb101744',
    template: {
      name: 'DPA 4006A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'omni', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'none', maxSplDb: 143, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4007
  // Quelle: https://www.dpamicrophones.com/pencil/4007a-omnidirectional-microphone/
  {
    match: ['4007'],
    deviceTypeId: '5d74d6cf-b13c-4665-b9ee-fde621b8a0f9',
    template: {
      name: 'DPA 4007',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'omni', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'none', maxSplDb: 168, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4015
  // Quelle: https://www.dpamicrophones.com/pencil/4015a-wide-cardioid-microphone/
  {
    match: ['4015'],
    deviceTypeId: '60cca762-ba61-4a19-9ce4-4cd1779d5006',
    template: {
      name: 'DPA 4015',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'sub', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'low', maxSplDb: 158, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4018
  // Quelle: https://www.dpamicrophones.com/pencil/4018a-supercardioid-microphone/
  {
    match: ['4018'],
    deviceTypeId: 'd2e400b3-6e7a-4613-adb4-4bba5f35aedf',
    template: {
      name: 'DPA 4018',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'super', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'instrument', proximityEffect: 'strong', maxSplDb: 158, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 2028
  // Quelle: https://www.dpamicrophones.com/handheld/2028-vocal-microphone/
  {
    match: ['2028'],
    deviceTypeId: 'b4bd805d-63a1-4346-ad6e-979d5f59f206',
    template: {
      name: 'DPA 2028',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'super', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', maxSplDb: 160, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4099
  // Quelle: https://www.dpamicrophones.com/instrument/4099-instrument-microphone/
  {
    match: ['4099'],
    deviceTypeId: 'aacdd1e5-d616-42c2-8cd3-02642e7cbef4',
    template: {
      name: 'DPA 4099',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'Mini-XLR', connectorType: 'Mini-XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'super', powering: 'p48', capsule: 'clip', micApplication: 'instrument', proximityEffect: 'strong', maxSplDb: 142, tonalCharacter: 'neutral', connectorOut: 'miniXlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4055
  // Quelle: https://www.dpamicrophones.com/instrument/4055-kick-drum-microphone/
  {
    match: ['4055'],
    deviceTypeId: 'b774113e-0d83-4e93-9e41-048183407cf6',
    template: {
      name: 'DPA 4055',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', maxSplDb: 165, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // DPA 4066
  // Quelle: https://www.dpamicrophones.com/headset/4066-omnidirectional-headset-microphone/
  {
    match: ['4066'],
    deviceTypeId: '86cf7b7e-4af8-412c-9346-5b9202276828',
    template: {
      name: 'DPA 4066',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'Mini-XLR', connectorType: 'Mini-XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'omni', powering: 'plugin', capsule: 'lavalier', micApplication: 'broadcast', proximityEffect: 'none', maxSplDb: 144, tonalCharacter: 'neutral', connectorOut: 'miniXlr' },
      width: 180, height: 120,
    },
  },
  // DPA 6060
  // Quelle: https://www.dpamicrophones.com/lavalier/6060-subminiature-microphone/
  {
    match: ['6060'],
    deviceTypeId: 'b8c2f3ba-4ee2-4a80-b99b-a06787f66d24',
    template: {
      name: 'DPA 6060',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'Mini-XLR', connectorType: 'Mini-XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'omni', powering: 'plugin', capsule: 'lavalier', micApplication: 'broadcast', proximityEffect: 'none', maxSplDb: 144, tonalCharacter: 'neutral', connectorOut: 'miniXlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic M 160
  // Quelle: https://www.beyerdynamic.com/m-160.html
  {
    match: ['m 160', 'm160'],
    deviceTypeId: 'cd86e679-b98d-4f52-9bac-0927d4da312e',
    template: {
      name: 'Beyerdynamic M 160',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'hyper', powering: 'none', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'strong', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic M 130
  // Quelle: https://www.beyerdynamic.com/m-130.html
  {
    match: ['m 130', 'm130'],
    deviceTypeId: 'd3cf9c45-e7c0-4840-bc3f-e24df0a70ea5',
    template: {
      name: 'Beyerdynamic M 130',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'smallDiaphragm', micApplication: 'room', proximityEffect: 'strong', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic TG V70
  // Quelle: https://www.beyerdynamic.com/tg-v70.html
  {
    match: ['tg v70', 'v70'],
    deviceTypeId: '09dd65bd-63cb-44ac-b42a-d4d626ddb03d',
    template: {
      name: 'Beyerdynamic TG V70',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic TG V90r
  // Quelle: https://www.beyerdynamic.com/tg-v90r.html
  {
    match: ['tg v90', 'v90r'],
    deviceTypeId: 'e29956dc-9161-4af0-8251-c19c29f7ca12',
    template: {
      name: 'Beyerdynamic TG V90r',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic MC 930
  // Quelle: https://www.beyerdynamic.com/mc-930.html
  {
    match: ['mc 930', 'mc930'],
    deviceTypeId: '9f284b07-e2e1-4619-869f-c07d84bbb162',
    template: {
      name: 'Beyerdynamic MC 930',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 143, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Beyerdynamic TG D57c
  // Quelle: https://www.beyerdynamic.com/tg-d57c.html
  {
    match: ['tg d57', 'd57c'],
    deviceTypeId: 'b05ca53f-d0cb-4be8-b2f8-749fac607617',
    template: {
      name: 'Beyerdynamic TG D57c',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'clip', micApplication: 'tom', proximityEffect: 'moderate', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice RE320
  // Quelle: https://www.electrovoice.com/product/re320/
  {
    match: ['re320'],
    deviceTypeId: 'b8dbca4a-f087-443a-a94f-222825ac6423',
    template: {
      name: 'Electro-Voice RE320',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice RE27 N/D
  // Quelle: https://www.electrovoice.com/product/re27nd/
  {
    match: ['re27'],
    deviceTypeId: '469ad7bf-3ee0-4009-a611-ecc596ae0174',
    template: {
      name: 'Electro-Voice RE27 N/D',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice RE16
  // Quelle: https://www.electrovoice.com/product/re16/
  {
    match: ['re16'],
    deviceTypeId: '64b482fc-ef47-4416-a6a8-a58a6d0c8cc1',
    template: {
      name: 'Electro-Voice RE16',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'broadcast', proximityEffect: 'strong', tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice ND46
  // Quelle: https://www.electrovoice.com/product/nd46/
  {
    match: ['nd46'],
    deviceTypeId: '78a3db54-8a10-4466-bb0b-567249477634',
    template: {
      name: 'Electro-Voice ND46',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'instrument', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice ND68
  // Quelle: https://www.electrovoice.com/product/nd68/
  {
    match: ['nd68'],
    deviceTypeId: '57ce171c-aa5a-4bf1-a281-7e568a0251ca',
    template: {
      name: 'Electro-Voice ND68',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'kick', proximityEffect: 'strong', tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice ND76
  // Quelle: https://www.electrovoice.com/product/nd76/
  {
    match: ['nd76'],
    deviceTypeId: '3d0ec5ac-5d0d-4770-84c8-103b8c545204',
    template: {
      name: 'Electro-Voice ND76',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice ND44
  // Quelle: https://www.electrovoice.com/product/nd44/
  {
    match: ['nd44'],
    deviceTypeId: '682999f1-9faa-454a-a750-498086cc3817',
    template: {
      name: 'Electro-Voice ND44',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'tom', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Electro-Voice 635A
  // Quelle: https://www.electrovoice.com/product/635a/
  {
    match: ['635a'],
    deviceTypeId: '10da51e4-1f7d-4b18-b3af-a750ee4040ec',
    template: {
      name: 'Electro-Voice 635A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'omni', powering: 'none', capsule: 'handheld', micApplication: 'broadcast', proximityEffect: 'none', tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Telefunken M80
  // Quelle: https://telefunken-elektroakustik.com/m80
  {
    match: ['m80'],
    deviceTypeId: 'fa805565-3503-4c04-9e4b-bd7864dcd488',
    template: {
      name: 'Telefunken M80',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Telefunken M81
  // Quelle: https://telefunken-elektroakustik.com/m81
  {
    match: ['m81'],
    deviceTypeId: '6907db1b-0522-420c-9657-f36a37b92a77',
    template: {
      name: 'Telefunken M81',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Telefunken TF11
  // Quelle: https://telefunken-elektroakustik.com/tf11-fet
  {
    match: ['tf11'],
    deviceTypeId: 'af593f01-a123-4604-9139-19dfba10afc8',
    template: {
      name: 'Telefunken TF11',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 130, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Telefunken U47
  // Quelle: https://telefunken-elektroakustik.com/u47
  {
    match: ['telefunken u47', 'tf u47'],
    deviceTypeId: '14e3ff1c-dccf-4516-80d6-a561c4cf1819',
    template: {
      name: 'Telefunken U47',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Telefunken ELA M 251
  // Quelle: https://telefunken-elektroakustik.com/ela-m-251e
  {
    match: ['ela m 251', 'm 251'],
    deviceTypeId: 'aa848cfe-a11e-4f9d-ac01-bea6d5ecbece',
    template: {
      name: 'Telefunken ELA M 251',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Warm Audio WA-47
  // Quelle: https://warmaudio.com/wa-47/
  {
    match: ['wa-47', 'wa47'],
    deviceTypeId: '3636d4de-acf4-412f-b69e-f14b2ef43548',
    template: {
      name: 'Warm Audio WA-47',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 140, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Warm Audio WA-87 R2
  // Quelle: https://warmaudio.com/wa-87-r2/
  {
    match: ['wa-87', 'wa87'],
    deviceTypeId: 'b70b235f-774f-46af-b78a-7762835146a4',
    template: {
      name: 'Warm Audio WA-87 R2',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 125, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Warm Audio WA-251
  // Quelle: https://warmaudio.com/wa-251/
  {
    match: ['wa-251', 'wa251'],
    deviceTypeId: 'a6d15dbb-a14e-4460-8b06-cba545b6cb1e',
    template: {
      name: 'Warm Audio WA-251',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Warm Audio WA-14
  // Quelle: https://warmaudio.com/wa-14/
  {
    match: ['wa-14', 'wa14'],
    deviceTypeId: '3be3a2ba-60b1-469a-858a-46d3b0bc26c9',
    template: {
      name: 'Warm Audio WA-14',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 140, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Aston Origin
  // Quelle: https://www.astonmics.com/EN/product/origin
  {
    match: ['aston origin'],
    deviceTypeId: 'f474ecb1-3b14-4bee-961a-2e9b6f676868',
    template: {
      name: 'Aston Origin',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 127, tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Aston Spirit
  // Quelle: https://www.astonmics.com/EN/product/spirit
  {
    match: ['aston spirit'],
    deviceTypeId: 'fe3e5871-6f81-4da8-ae98-33adfeac8cc5',
    template: {
      name: 'Aston Spirit',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 138, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Aston Stealth
  // Quelle: https://www.astonmics.com/EN/product/stealth
  {
    match: ['aston stealth'],
    deviceTypeId: '93ea5b00-41aa-47d5-8171-9bd8cd7db5a6',
    template: {
      name: 'Aston Stealth',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Lewitt LCT 440 Pure
  // Quelle: https://www.lewitt-audio.com/microphones/lct/lct-440-pure
  {
    match: ['lct 440', 'lct440'],
    deviceTypeId: '4f569f1f-8e0b-4eac-8ee7-257da07b4466',
    template: {
      name: 'Lewitt LCT 440 Pure',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 140, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Lewitt LCT 640 TS
  // Quelle: https://www.lewitt-audio.com/microphones/lct/lct-640-ts
  {
    match: ['lct 640', 'lct640'],
    deviceTypeId: 'b49aee16-3b09-47cf-abef-f8223324501a',
    template: {
      name: 'Lewitt LCT 640 TS',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'moderate', maxSplDb: 130, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Lewitt MTP 550 DM
  // Quelle: https://www.lewitt-audio.com/microphones/mtp/mtp-550-dm
  {
    match: ['mtp 550', 'mtp550'],
    deviceTypeId: 'e3336d62-36ed-4036-91cc-65f2fc85ef1c',
    template: {
      name: 'Lewitt MTP 550 DM',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Lewitt DTP 640 REX
  // Quelle: https://www.lewitt-audio.com/microphones/dtp/dtp-640-rex
  {
    match: ['dtp 640', 'dtp640'],
    deviceTypeId: '4a9d4440-08a3-407b-a17f-62fda43abedf',
    template: {
      name: 'Lewitt DTP 640 REX',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Earthworks SR40V
  // Quelle: https://earthworksaudio.com/vocal-microphones/sr40v/
  {
    match: ['sr40v'],
    deviceTypeId: '97dc95b7-4294-411a-bbdc-8547991ddf00',
    template: {
      name: 'Earthworks SR40V',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'hyper', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', maxSplDb: 145, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Earthworks SR314
  // Quelle: https://earthworksaudio.com/vocal-microphones/sr314/
  {
    match: ['sr314'],
    deviceTypeId: '85f0a3a4-d32a-4900-8efc-1b5ef4b9ec03',
    template: {
      name: 'Earthworks SR314',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 145, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Earthworks DM20
  // Quelle: https://earthworksaudio.com/drum-microphones/dm20/
  {
    match: ['dm20'],
    deviceTypeId: '5805ca72-0a78-462d-a9e8-d262eabd4e98',
    template: {
      name: 'Earthworks DM20',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'hyper', powering: 'p48', capsule: 'clip', micApplication: 'tom', proximityEffect: 'strong', maxSplDb: 150, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Earthworks QTC40
  // Quelle: https://earthworksaudio.com/measurement-microphones/qtc40/
  {
    match: ['qtc40'],
    deviceTypeId: 'b4944dfa-5665-4580-aa72-65fef8667b23',
    template: {
      name: 'Earthworks QTC40',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'omni', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'none', maxSplDb: 145, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Royer R-10
  // Quelle: https://royerlabs.com/r-10/
  {
    match: ['r-10', 'r10'],
    deviceTypeId: '29b8f4e5-71d7-4bc9-a036-ce30480398f8',
    template: {
      name: 'Royer R-10',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'guitar', proximityEffect: 'strong', maxSplDb: 160, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Royer R-122 MKII
  // Quelle: https://royerlabs.com/r-122-mkii/
  {
    match: ['r-122', 'r122'],
    deviceTypeId: 'c39d9441-4b53-4021-bbe2-285611da9b8f',
    template: {
      name: 'Royer R-122 MKII',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'room', proximityEffect: 'strong', maxSplDb: 135, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Royer SF-12
  // Quelle: https://royerlabs.com/sf-12/
  {
    match: ['sf-12', 'sf12'],
    deviceTypeId: '338ea49a-1005-4181-a1ec-ccbc54c6216d',
    template: {
      name: 'Royer SF-12',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'overhead', proximityEffect: 'strong', maxSplDb: 130, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AEA R88
  // Quelle: https://www.aearibbonmics.com/products/r88/
  {
    match: ['r88'],
    deviceTypeId: 'f1739e26-cc58-4a7b-8790-3e5334ca55b4',
    template: {
      name: 'AEA R88',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'fig8', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'room', proximityEffect: 'strong', maxSplDb: 141, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // AEA KU5A
  // Quelle: https://www.aearibbonmics.com/products/ku5a/
  {
    match: ['ku5a', 'ku5'],
    deviceTypeId: '01b6ee94-b51a-474e-8a3f-c44ef98976dd',
    template: {
      name: 'AEA KU5A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'ribbon', polarPattern: 'super', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'strong', maxSplDb: 141, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Blue Bluebird SL
  // Quelle: https://www.bluemic.com/en-us/products/bluebird-sl/
  {
    match: ['bluebird'],
    deviceTypeId: 'b9c3db76-ab94-4979-9769-7cd9d9539a15',
    template: {
      name: 'Blue Bluebird SL',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 138, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Blue Baby Bottle SL
  // Quelle: https://www.bluemic.com/en-us/products/baby-bottle-sl/
  {
    match: ['baby bottle'],
    deviceTypeId: '6fc15ee8-c282-46a3-b2c2-f91aaca06c4b',
    template: {
      name: 'Blue Baby Bottle SL',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 134, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sennheiser MD 21
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/microphones/md-21-u
  {
    match: ['md 21', 'md21'],
    deviceTypeId: 'f85ab718-da3e-497c-8ad8-db0f4526fd8f',
    template: {
      name: 'Sennheiser MD 21',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'omni', powering: 'none', capsule: 'handheld', micApplication: 'broadcast', proximityEffect: 'none', tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // beyerdynamic TG D70
  // Quelle: https://www.beyerdynamic.com/tg-d70.html
  {
    match: ['tg d70', 'd70'],
    deviceTypeId: '59f69f19-a4a6-4203-a8e5-3982d13bd87e',
    template: {
      name: 'beyerdynamic TG D70',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sontronics STC-3X
  // Quelle: https://www.sontronics.com/products/stc-3x
  {
    match: ['stc-3x', 'stc3x'],
    deviceTypeId: '8ef0598f-54fc-4adb-b4d1-4856fb2f7e25',
    template: {
      name: 'Sontronics STC-3X',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 130, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Sontronics DM-1B
  // Quelle: https://www.sontronics.com/products/dm-1b
  {
    match: ['dm-1b', 'dm1b'],
    deviceTypeId: 'f3e16f75-e6c8-4e9a-b85f-7dedffff0519',
    template: {
      name: 'Sontronics DM-1B',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix OM5
  // Quelle: https://audixusa.com/products/om5
  {
    match: ['om5'],
    deviceTypeId: '759b3ff1-b431-4d8e-a12c-4c5550805879',
    template: {
      name: 'Audix OM5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix OM7
  // Quelle: https://audixusa.com/products/om7
  {
    match: ['om7'],
    deviceTypeId: '970153ef-ed5d-4cc3-8dd2-6ae1b1037729',
    template: {
      name: 'Audix OM7',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix f5
  // Quelle: https://audixusa.com/products/f5
  {
    match: ['audix f5', 'audix', 'f5'],
    deviceTypeId: '57b8be38-e113-41fa-95c2-e09fdcbea4cf',
    template: {
      name: 'Audix f5',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'hyper', powering: 'none', capsule: 'handheld', micApplication: 'snare', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix ADX51
  // Quelle: https://audixusa.com/products/adx51
  {
    match: ['adx51'],
    deviceTypeId: '1eb08000-7c89-4045-99ec-d283191cc28d',
    template: {
      name: 'Audix ADX51',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'smallDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 132, tonalCharacter: 'bright', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Audix SCX25A
  // Quelle: https://audixusa.com/products/scx25a
  {
    match: ['scx25'],
    deviceTypeId: 'd4190e9c-2761-42cf-84ce-6eb7e2ecbf15',
    template: {
      name: 'Audix SCX25A',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'overhead', proximityEffect: 'moderate', maxSplDb: 135, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Heil PR 40
  // Quelle: https://heilsound.com/product/pr-40/
  {
    match: ['pr 40', 'pr40'],
    deviceTypeId: '23bc1288-7c3a-42af-bc1e-65e9477dee3d',
    template: {
      name: 'Heil PR 40',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'broadcast', proximityEffect: 'moderate', tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Heil PR 30
  // Quelle: https://heilsound.com/product/pr-30/
  {
    match: ['pr 30', 'pr30'],
    deviceTypeId: 'c174e7b8-f4c4-4554-963f-49c736401ace',
    template: {
      name: 'Heil PR 30',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'instrument', proximityEffect: 'strong', tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Heil PR 48
  // Quelle: https://heilsound.com/product/pr-48/
  {
    match: ['pr 48', 'pr48'],
    deviceTypeId: '27c2f6fa-d8b4-4820-8057-526c55247216',
    template: {
      name: 'Heil PR 48',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'cardioid', powering: 'none', capsule: 'largeDiaphragm', micApplication: 'kick', proximityEffect: 'moderate', tonalCharacter: 'scooped', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Miktek PM10
  // Quelle: https://miktekaudio.com/product/pm10/
  {
    match: ['pm10'],
    deviceTypeId: '6c7c1710-8fe1-4754-8cf9-4c6b337ca668',
    template: {
      name: 'Miktek PM10',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'dynamic', polarPattern: 'super', powering: 'none', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', tonalCharacter: 'present', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Austrian Audio OC818
  // Quelle: https://austrian.audio/product/oc818/
  {
    match: ['oc818'],
    deviceTypeId: '9133d8c4-8daa-4a7b-a8e1-637a33fd9b71',
    template: {
      name: 'Austrian Audio OC818',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 148, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Austrian Audio OC18
  // Quelle: https://austrian.audio/product/oc18/
  {
    match: ['oc18'],
    deviceTypeId: '7efc36c2-d3da-41cb-b070-8d6b97df0e49',
    template: {
      name: 'Austrian Audio OC18',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 148, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Austrian Audio OD505
  // Quelle: https://austrian.audio/product/od505/
  {
    match: ['od505'],
    deviceTypeId: '8a78f174-2a67-49f0-9e80-c1272a303d31',
    template: {
      name: 'Austrian Audio OD505',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'super', powering: 'p48', capsule: 'handheld', micApplication: 'vocal', proximityEffect: 'strong', maxSplDb: 150, tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Slate ML-1
  // Quelle: https://slatedigital.com/ml-1/
  {
    match: ['ml-1', 'ml1'],
    deviceTypeId: '38ab041d-e91c-4f91-bc0c-1f4c3ef10eef',
    template: {
      name: 'Slate ML-1',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'neutral', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Mojave MA-201 fet
  // Quelle: https://www.mojaveaudio.com/products/ma-201fet/
  {
    match: ['ma-201', 'ma201'],
    deviceTypeId: 'a163371d-77ce-4dfc-b33c-7fd6f1be9eb8',
    template: {
      name: 'Mojave MA-201 fet',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 125, tonalCharacter: 'warm', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Mojave MA-300
  // Quelle: https://www.mojaveaudio.com/products/ma-300/
  {
    match: ['ma-300', 'ma300'],
    deviceTypeId: '260ee646-9547-49b9-98b3-899b64a8cfa0',
    template: {
      name: 'Mojave MA-300',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 120, tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Bock Audio 251
  // Quelle: https://www.bockaudio.com/251.html
  {
    match: ['bock 251'],
    deviceTypeId: 'c229d048-da5c-4367-9096-ecc616efffdd',
    template: {
      name: 'Bock Audio 251',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'multi', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', tonalCharacter: 'vintage', connectorOut: 'xlr' },
      width: 180, height: 120,
    },
  },
  // Manley Reference Cardioid
  // Quelle: https://www.manley.com/microphones/mrefc
  {
    match: ['manley reference'],
    deviceTypeId: '128f860d-485e-43eb-81cc-618fa5f24fb2',
    template: {
      name: 'Manley Reference Cardioid',
      category: 'Mikrofone',
      inputs: [],
      outputs: [{ id: '', name: 'Mic Out', type: 'XLR', connectorType: 'XLR', gender: 'male' }],
      categoryProps: { transducer: 'condenser', polarPattern: 'cardioid', powering: 'p48', capsule: 'largeDiaphragm', micApplication: 'vocal', proximityEffect: 'moderate', maxSplDb: 150, tonalCharacter: 'vintage', connectorOut: 'xlr' },
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
  const isBrandKnown = lower.includes('20') ||
    lower.includes('21') ||
    lower.includes('40') ||
    lower.includes('403') ||
    lower.includes('404') ||
    lower.includes('60') ||
    lower.includes('635a') ||
    lower.includes('adx') ||
    lower.includes('ae2') ||
    lower.includes('ae6') ||
    lower.includes('aea') ||
    lower.includes('akg') ||
    lower.includes('aston') ||
    lower.includes('at20') ||
    lower.includes('at40') ||
    lower.includes('at50') ||
    lower.includes('at80') ||
    lower.includes('atm') ||
    lower.includes('audio-technica') ||
    lower.includes('audix') ||
    lower.includes('austrian') ||
    lower.includes('baby bottle') ||
    lower.includes('bcm') ||
    lower.includes('beta ') ||
    lower.includes('beyerdynamic') ||
    lower.includes('blue') ||
    lower.includes('bluebird') ||
    lower.includes('bock') ||
    lower.includes('bp40') ||
    lower.includes('broadcaster') ||
    lower.includes('c1') ||
    lower.includes('c2') ||
    lower.includes('c3') ||
    lower.includes('c4') ||
    lower.includes('c519') ||
    lower.includes('coles') ||
    lower.includes('crown') ||
    lower.includes('d112') ||
    lower.includes('d12') ||
    lower.includes('d40') ||
    lower.includes('d5') ||
    lower.includes('dm-1') ||
    lower.includes('dm20') ||
    lower.includes('dpa') ||
    lower.includes('dtp') ||
    lower.includes('e6') ||
    lower.includes('e60') ||
    lower.includes('e8') ||
    lower.includes('e9') ||
    lower.includes('earthworks') ||
    lower.includes('ela m') ||
    lower.includes('electro-voice') ||
    lower.includes('f5') ||
    lower.includes('heil') ||
    lower.includes('km 1') ||
    lower.includes('kms') ||
    lower.includes('ksm') ||
    lower.includes('ku5') ||
    lower.includes('lct') ||
    lower.includes('lewitt') ||
    lower.includes('m 130') ||
    lower.includes('m 149') ||
    lower.includes('m 160') ||
    lower.includes('m 201') ||
    lower.includes('m 251') ||
    lower.includes('m 69') ||
    lower.includes('m 88') ||
    lower.includes('m80') ||
    lower.includes('m81') ||
    lower.includes('ma-2') ||
    lower.includes('ma-3') ||
    lower.includes('manley') ||
    lower.includes('mc 9') ||
    lower.includes('md 2') ||
    lower.includes('md 4') ||
    lower.includes('md4') ||
    lower.includes('miktek') ||
    lower.includes('mk 4') ||
    lower.includes('mke') ||
    lower.includes('mkh') ||
    lower.includes('ml-1') ||
    lower.includes('mojave') ||
    lower.includes('mtp') ||
    lower.includes('mv7') ||
    lower.includes('nd4') ||
    lower.includes('nd6') ||
    lower.includes('nd7') ||
    lower.includes('neumann') ||
    lower.includes('nt1') ||
    lower.includes('nt2') ||
    lower.includes('nt5') ||
    lower.includes('ntg') ||
    lower.includes('ntk') ||
    lower.includes('oc1') ||
    lower.includes('oc8') ||
    lower.includes('od505') ||
    lower.includes('om5') ||
    lower.includes('om7') ||
    lower.includes('pga') ||
    lower.includes('pm10') ||
    lower.includes('podmic') ||
    lower.includes('pr 3') ||
    lower.includes('pr 4') ||
    lower.includes('procaster') ||
    lower.includes('pzm') ||
    lower.includes('qtc') ||
    lower.includes('r-1') ||
    lower.includes('r-12') ||
    lower.includes('r-8') ||
    lower.includes('r84') ||
    lower.includes('r88') ||
    lower.includes('re1') ||
    lower.includes('re2') ||
    lower.includes('re3') ||
    lower.includes('rode') ||
    lower.includes('rode m5') ||
    lower.includes('royer') ||
    lower.includes('scx') ||
    lower.includes('sennheiser') ||
    lower.includes('sf-') ||
    lower.includes('shure') ||
    lower.includes('slate') ||
    lower.includes('sm5') ||
    lower.includes('sm7') ||
    lower.includes('sm8') ||
    lower.includes('sontronics') ||
    lower.includes('sr31') ||
    lower.includes('sr40') ||
    lower.includes('stc-') ||
    lower.includes('super 55') ||
    lower.includes('telefunken') ||
    lower.includes('tf11') ||
    lower.includes('tg d') ||
    lower.includes('tg v') ||
    lower.includes('tlm') ||
    lower.includes('u 4') ||
    lower.includes('u 8') ||
    lower.includes('u47') ||
    lower.includes('wa-') ||
    lower.includes('warm audio')
  if (!isBrandKnown) return null
  for (const entry of MIC_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
