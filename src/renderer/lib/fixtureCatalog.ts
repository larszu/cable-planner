// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  ERZEUGT — nicht von Hand aendern.                                    ║
// ║  Quelle: light-planner src/core/fixtureLibrary.ts                    ║
// ║  Nachziehen: npm run katalog:uebernahme                               ║
// ║  Pruefen:    npm run katalog:check                                    ║
// ╚═══════════════════════════════════════════════════════════════════════╝
//
// 84 Eintraege, davon 50 mit Datenblatt-Link.
//
// ─── DIESE EINTRAEGE HABEN ANSCHLUESSE ─────────────────────────────────────
//
// Anders als die Kameras, Objektive und Rigs: der light-planner beantwortet
// die Frage nach den Buchsen bereits. `integration/equipment.ts` setzt eine
// platzierte Leuchte in ein Kabel-Planer-Geraet um — DMX In, DMX Thru und eine
// Power-Buchse, deren Steckertyp aus `powerConnector` kommt. DIESE REGEL WIRD
// IMPORTIERT (`powerConnectorToCp`, `modesOf`), nicht nachgebaut: eine zweite
// Regel daneben hiesse, dass dieselbe Leuchte aus dem Licht-Plan Buchsen hat
// und aus der Bibliothek nicht.
//
// 50 Eintraege bekommen KEINE DMX-Buchse. Das ist eine Aussage und kein
// Versehen: eine konventionelle Leuchte am Dimmer hat keine. Ihr eine
// anzudichten hiesse, eine DMX-Leitung zum Stufenlinsenscheinwerfer zu planen.
//
// 73 Eintraege nennen keinen Netzstecker. Sie bekommen den Rueckfall aus
// `powerConnectorToCp` (PowerCON) — dieselbe Annahme wie im Licht-Plan, und
// damit dieselbe an beiden Stellen. Wer sie korrigiert, korrigiert sie in
// `fixtureLibrary.ts`; von dort holt sie der Generator.
//
// ─── ZWEI SORTEN LUECKE, UND SIE BEDEUTEN VERSCHIEDENES ────────────────────
//
// 34 Eintraege ohne Datenblatt-Link. Davon sind sieben
// `Generic`-Bauformen, die keinen Hersteller behaupten — bei ihnen ist die
// Leere die richtige Antwort. Die uebrigen sind offene Recherche: die
// Herstellerseite war aus der Arbeitsumgebung nicht erreichbar oder die
// Suche fand zum genannten Modellnamen keine Produktseite.
//
// Offen (Stand 2026-09-24):
//   Robert Juliat 714SX2 Suiveur 2,5kW
//   Generic 1 kW Fresnel
//   Generic 2 kW Fresnel
//   Generic PAR64 CP62 (NSP)
//   Generic PAR64 CP61 (MFL)
//   Generic PAR64 CP60 (WFL)
//   Generic PAR56 MFL 300W
//   ADJ Mega HEX Par
//   Chauvet Professional COLORdash Par H18IP
//   Elation SixPar 300
//   Generic LED PAR 54×3 W RGBW
//   Elation Proteus Maximus
//   Martin / Harman MAC Encore Performance CLD
//   Elation Fuze Max Profile
//   SGM P-6
//   ADJ Vizi Beam 12RX
//   Chauvet Professional Rogue R2 Spot
//   ADJ Focus Spot 6Z
//   Cameo OPUS S5
//   Cameo OTOS SP6
//   Cameo EVOS S3
//   Cameo EVOS W7
//   Robe Robin Pointe
//   Clay Paky Mythos 2
//   Clay Paky Sharpy
//   Mole-Richardson Molefay 4-Lite
//   Martin / Harman Atomic 3000 DMX
//   ARRI CYC 1250
//   ETC Desire D22
//   Philips / ColorKinetics ColorBlast 12
//   Robert Juliat Cyrano 2500W
//   Aputure LS 300x II
//   Elation KL Fresnel 6 FC
//   Elation KL Panel FC
//
// DREI MODELLNAMEN, DIE DER HERSTELLER SO NICHT FUEHRT — aufgefallen bei der
// Recherche, hier festgehalten statt stillschweigend angeglichen:
//   Aputure „LS 300x II"       — aputure.com fuehrt LS 300x und LS 300d II.
//   Chauvet „COLORdash Par H18IP" — die Seite kennt H18X und H18 XIP.
//   Chauvet „Rogue R2 Spot"    — die Seite kennt R2E Spot und R2X Spot.
// Ob die Bibliothek sich vertippt hat oder das Modell ausgelaufen ist, sagt
// keine der beiden Quellen. Geraten wird nichts.
//
// ─── VORSAETZE FEHLEN ABSICHTLICH ──────────────────────────────────────────
//
// 7 Vorsaetze (Fresnel-Linse, Softbox, Lantern, Torblende, Snoot)
// stehen im light-planner und kommen NICHT mit: sie fuehren weder Strom noch
// Daten. Im Kabelplan waeren sie Kaestchen ohne Anschluss, die jede Liste
// verlaengern und keine Frage beantworten.
import type { EquipmentTemplate } from '../types/equipment'

const LIGHT = 'Lighting'

/** Katalog-Eintrag: stabile Geraetetyp-Id plus Vorlage. `match` traegt die
 *  normalisierten Namensformen, ueber die ein Import ohne GUID aufloest. */
export interface FixtureEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const FIXTURE_CATALOG: FixtureEntry[] = [
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/
  {
    match: ['etcsourcefour19', 'sourcefour19'],
    deviceTypeId: '117a0db0-bf94-5669-a8db-f98eec23542b',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/',
      name: 'ETC Source Four 19°',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 750,
      weightKg: 7.7,
      notes: '17800 lm · beam 19° · 3200 K · CRI 100 · power Stage Pin / Schuko · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'Schuko 230V' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/
  {
    match: ['etcsourcefour26', 'sourcefour26'],
    deviceTypeId: 'cadbf972-fc25-5f3b-bbec-37d6f045df45',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/',
      name: 'ETC Source Four 26°',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 750,
      weightKg: 7.5,
      notes: '17800 lm · beam 26° · 3200 K · CRI 100 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/
  {
    match: ['etcsourcefour36', 'sourcefour36'],
    deviceTypeId: '7c31f263-34a4-53e6-a2fc-b9021179636b',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/',
      name: 'ETC Source Four 36°',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 750,
      weightKg: 7.3,
      notes: '17800 lm · beam 36° · 3200 K · CRI 100 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/
  {
    match: ['etcsourcefour50', 'sourcefour50'],
    deviceTypeId: '93c2bdf8-9df5-5589-a8d3-69b1b2a08e9a',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/',
      name: 'ETC Source Four 50°',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 750,
      weightKg: 7.1,
      notes: '17800 lm · beam 50° · 3200 K · CRI 100 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/
  {
    match: ['etcsourcefourzoom1530', 'sourcefourzoom1530'],
    deviceTypeId: '8361ab74-939f-5071-b03f-9bffa34eeb14',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/',
      name: 'ETC Source Four Zoom 15–30°',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 750,
      weightKg: 8.6,
      notes: '17800 lm · zoom 15-30° · 3200 K · CRI 100 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/
  {
    match: ['etcsourcefourzoom2550', 'sourcefourzoom2550'],
    deviceTypeId: 'ed76dda0-30af-5de5-8d1b-ede79b54781d',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/Source-Four/',
      name: 'ETC Source Four Zoom 25–50°',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 750,
      weightKg: 8.6,
      notes: '17800 lm · zoom 25-50° · 3200 K · CRI 100 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Lighting-Fixtures/Source-Four-LED-Series-3/Features.aspx
  {
    match: ['etcsourcefourleds3', 'sourcefourleds3'],
    deviceTypeId: '3827c007-b78d-5586-83e3-7fd27ac6fd59',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Lighting-Fixtures/Source-Four-LED-Series-3/Features.aspx',
      name: 'ETC Source Four LED S3',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 171,
      weightKg: 8.4,
      notes: '8667 lm · beam 26° · 2700-6500 K · CRI 95 · power powerCON TRUE1 · DMX 5 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['robertjuliat714sx2suiveur25kw', '714sx2suiveur25kw'],
    deviceTypeId: '36cf4ce9-9cf3-55c3-9035-01e9662d1a00',
    template: {
      name: 'Robert Juliat 714SX2 Suiveur 2,5kW',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 2500,
      weightKg: 23,
      notes: '68000 lm · zoom 8-16° · 3200 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['generic1kwfresnel', '1kwfresnel'],
    deviceTypeId: '53c7d6dc-e989-52ad-aca1-ee4ced02752c',
    template: {
      name: 'Generic 1 kW Fresnel',
      category: LIGHT,
      subtitle: 'fresnel',
      powerWatts: 1000,
      weightKg: 5.5,
      notes: '20000 lm · zoom 15-55° · 3200 K · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['generic2kwfresnel', '2kwfresnel'],
    deviceTypeId: '579f8203-79d9-57a6-b43e-e1a37b586f12',
    template: {
      name: 'Generic 2 kW Fresnel',
      category: LIGHT,
      subtitle: 'fresnel',
      powerWatts: 2000,
      weightKg: 10.2,
      notes: '44000 lm · zoom 12-60° · 3200 K · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Lighting-Fixtures/ColorSource/Fixtures.aspx
  {
    match: ['etccolorsourcefresnel', 'colorsourcefresnel'],
    deviceTypeId: '9823f454-4794-53f2-886f-76359a8a8c41',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Lighting-Fixtures/ColorSource/Fixtures.aspx',
      name: 'ETC ColorSource Fresnel',
      category: LIGHT,
      subtitle: 'fresnel',
      powerWatts: 125,
      weightKg: 5.2,
      notes: '3250 lm · zoom 15-50° · 2700-6500 K · CRI 92 · DMX 5 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['genericpar64cp62nsp', 'par64cp62nsp'],
    deviceTypeId: '23a92221-e667-5ae8-b89b-acc78b22703e',
    template: {
      name: 'Generic PAR64 CP62 (NSP)',
      category: LIGHT,
      subtitle: 'par',
      powerWatts: 1000,
      weightKg: 3.5,
      notes: '33000 lm · beam 12° · 3200 K · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['genericpar64cp61mfl', 'par64cp61mfl'],
    deviceTypeId: 'af2dea42-9c11-58a6-ac10-d07f5de91b12',
    template: {
      name: 'Generic PAR64 CP61 (MFL)',
      category: LIGHT,
      subtitle: 'par',
      powerWatts: 1000,
      weightKg: 3.5,
      notes: '33000 lm · beam 21° · 3200 K · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['genericpar64cp60wfl', 'par64cp60wfl'],
    deviceTypeId: 'bd59620e-48b1-5188-af1d-732e7cbf6c8b',
    template: {
      name: 'Generic PAR64 CP60 (WFL)',
      category: LIGHT,
      subtitle: 'par',
      powerWatts: 1000,
      weightKg: 3.5,
      notes: '33000 lm · beam 48° · 3200 K · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['genericpar56mfl300w', 'par56mfl300w'],
    deviceTypeId: '3418a9a5-3676-5c63-86f0-52efacfc3d3d',
    template: {
      name: 'Generic PAR56 MFL 300W',
      category: LIGHT,
      subtitle: 'par',
      powerWatts: 300,
      weightKg: 1.5,
      notes: '6600 lm · beam 20° · 3200 K · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['adjmegahexpar', 'megahexpar'],
    deviceTypeId: 'd9d01f71-235a-5ca4-88f6-6dbf71dd9e2b',
    template: {
      name: 'ADJ Mega HEX Par',
      category: LIGHT,
      subtitle: 'wash',
      powerWatts: 30,
      weightKg: 1.4,
      notes: '680 lm · beam 25° · RGBW · DMX 12 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['chauvetprofessionalcolordashparh18ip', 'colordashparh18ip'],
    deviceTypeId: '498f378e-66e0-561b-a7da-cd452b787a43',
    template: {
      name: 'Chauvet Professional COLORdash Par H18IP',
      category: LIGHT,
      subtitle: 'wash',
      powerWatts: 180,
      weightKg: 4.8,
      notes: '5736 lm · beam 22° · RGBW · DMX 14 ch · IP65 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['elationsixpar300', 'sixpar300'],
    deviceTypeId: '4fce52ce-2ae3-5d18-9519-61f35969da2b',
    template: {
      name: 'Elation SixPar 300',
      category: LIGHT,
      subtitle: 'wash',
      powerWatts: 220,
      weightKg: 8.1,
      notes: '4200 lm · beam 15° · RGBW · DMX 10 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['genericledpar543wrgbw', 'ledpar543wrgbw'],
    deviceTypeId: '865b9eb1-8650-5879-a480-6b5a1a9557a9',
    template: {
      name: 'Generic LED PAR 54×3 W RGBW',
      category: LIGHT,
      subtitle: 'wash',
      powerWatts: 162,
      weightKg: 2.8,
      notes: '3200 lm · beam 25° · RGBW · DMX 8 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/ColorSource-PAR/Features.aspx
  {
    match: ['etccolorsourcepar', 'colorsourcepar'],
    deviceTypeId: '14841d82-3944-5554-bcaa-d78e53c21e27',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/ColorSource-PAR/Features.aspx',
      name: 'ETC ColorSource PAR',
      category: LIGHT,
      subtitle: 'wash',
      powerWatts: 90,
      weightKg: 3.8,
      notes: '3250 lm · beam 25° · 2700-6500 K · CRI 92 · DMX 5 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.martin.com/en-US/products/mac-aura-xb
  {
    match: ['martinharmanmacauraxb', 'macauraxb'],
    deviceTypeId: 'b9c15eff-71e6-59ef-8dcc-13889e69dca6',
    template: {
      manufacturerUrl: 'https://www.martin.com/en-US/products/mac-aura-xb',
      name: 'Martin / Harman MAC Aura XB',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 270,
      weightKg: 6.6,
      notes: '6000 lm · zoom 11-58° · RGBW · DMX 23 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.robe.cz/ledwash-600
  {
    match: ['roberobin600ledwash', 'robin600ledwash'],
    deviceTypeId: 'e17deb7a-ba83-5452-b75f-d83329009e19',
    template: {
      manufacturerUrl: 'https://www.robe.cz/ledwash-600',
      name: 'Robe Robin 600 LEDWash',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 270,
      weightKg: 9.7,
      notes: '9500 lm · zoom 15-60° · RGBW · DMX 18 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.robe.cz/ledbeam-150
  {
    match: ['roberobinledbeam150', 'robinledbeam150'],
    deviceTypeId: 'cb9b8289-30d9-5e1f-8163-d77fa8a3393e',
    template: {
      manufacturerUrl: 'https://www.robe.cz/ledbeam-150',
      name: 'Robe Robin LEDBeam 150',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 220,
      weightKg: 5.7,
      notes: '2842 lm · zoom 3.8-60° · 2700-8000 K · DMX 22 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://chauvetprofessional.com/product/rogue-r2-wash/
  {
    match: ['chauvetprofessionalroguer2wash', 'roguer2wash'],
    deviceTypeId: '7eb958a6-fc82-5c22-8e83-c353cb5a13c6',
    template: {
      manufacturerUrl: 'https://chauvetprofessional.com/product/rogue-r2-wash/',
      name: 'Chauvet Professional Rogue R2 Wash',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 270,
      weightKg: 10.1,
      notes: '8200 lm · zoom 12-49° · RGBW · DMX 21 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.martin.com/en-US/products/mac-aura-pxl
  {
    match: ['martinharmanmacaurapxl', 'macaurapxl'],
    deviceTypeId: '62fbb53f-3959-5cec-ae1b-4c0571afd8db',
    template: {
      manufacturerUrl: 'https://www.martin.com/en-US/products/mac-aura-pxl',
      name: 'Martin / Harman MAC Aura PXL',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 560,
      weightKg: 15.6,
      notes: '10500 lm · zoom 6-59° · 2000-10000 K · DMX 32 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://glp.de/en/products/entertainment-lighting/moving-lights/impression-x4-en
  {
    match: ['glpimpressionx4', 'impressionx4'],
    deviceTypeId: 'b667bdda-06fa-5056-90b0-ef6e4e2247ed',
    template: {
      manufacturerUrl: 'https://glp.de/en/products/entertainment-lighting/moving-lights/impression-x4-en',
      name: 'GLP impression X4',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 350,
      weightKg: 7.9,
      notes: '5085 lm · zoom 7-50° · RGBW · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.robe.cz/spiider
  {
    match: ['roberobinspiider', 'robinspiider'],
    deviceTypeId: 'b0f59594-2c1b-5dd5-ad65-4d194c992ff8',
    template: {
      manufacturerUrl: 'https://www.robe.cz/spiider',
      name: 'Robe Robin Spiider',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 600,
      weightKg: 13.3,
      notes: '11000 lm · zoom 4-50° · 2700-8000 K · DMX 49 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.martin.com/en-US/products/mac-viper-profile
  {
    match: ['martinharmanmacviperprofile', 'macviperprofile'],
    deviceTypeId: '5b75c0ef-1bb2-5899-8f3e-d4b9dfa8fdb1',
    template: {
      manufacturerUrl: 'https://www.martin.com/en-US/products/mac-viper-profile',
      name: 'Martin / Harman MAC Viper Profile',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 1000,
      weightKg: 37.2,
      notes: '26000 lm · zoom 10-44° · 6000 K · DMX 26 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.robe.cz/t1-profile
  {
    match: ['roberobint1profile', 'robint1profile'],
    deviceTypeId: 'c11d9434-c6cb-5c14-8fe4-332ea5919548',
    template: {
      manufacturerUrl: 'https://www.robe.cz/t1-profile',
      name: 'Robe Robin T1 Profile',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 468,
      weightKg: 24.5,
      notes: '12600 lm · zoom 5-50° · RGBW · DMX 35 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://chauvetprofessional.com/product/maverick-mk3-profile/
  {
    match: ['chauvetprofessionalmaverickmk3profile', 'maverickmk3profile'],
    deviceTypeId: '58adbee0-480e-5f7a-877d-c299560561fb',
    template: {
      manufacturerUrl: 'https://chauvetprofessional.com/product/maverick-mk3-profile/',
      name: 'Chauvet Professional Maverick MK3 Profile',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 6-46° · 6800 K · DMX 38 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.ayrton.eu/produit/ghibli/
  {
    match: ['ayrtonghibli', 'ghibli'],
    deviceTypeId: 'a5b53e3e-687b-5ec5-b8f9-7c96145e300c',
    template: {
      manufacturerUrl: 'https://www.ayrton.eu/produit/ghibli/',
      name: 'Ayrton Ghibli',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 7-56° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.ayrton.eu/produit/diablo/
  {
    match: ['ayrtondiablo', 'diablo'],
    deviceTypeId: 'f436bb46-92cb-57ce-aaf1-7e8a43dd94eb',
    template: {
      manufacturerUrl: 'https://www.ayrton.eu/produit/diablo/',
      name: 'Ayrton Diablo',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 7-53° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.ayrton.eu/produit/khamsin/
  {
    match: ['ayrtonkhamsins', 'khamsins'],
    deviceTypeId: '1286a06d-2bfe-5135-871d-f03c55130a47',
    template: {
      manufacturerUrl: 'https://www.ayrton.eu/produit/khamsin/',
      name: 'Ayrton Khamsin-S',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 7-58° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.ayrton.eu/produit/domino-lt/
  {
    match: ['ayrtondominolt', 'dominolt'],
    deviceTypeId: '07e17c59-7c9b-58d6-a95e-7c0737f846b6',
    template: {
      manufacturerUrl: 'https://www.ayrton.eu/produit/domino-lt/',
      name: 'Ayrton Domino LT',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 3.5-53° · 6800 K · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.ayrton.eu/produit/mistral/
  {
    match: ['ayrtonmistral', 'mistral'],
    deviceTypeId: '498acb9f-b21c-584c-9e39-5b7b66baa529',
    template: {
      manufacturerUrl: 'https://www.ayrton.eu/produit/mistral/',
      name: 'Ayrton Mistral',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 7-53° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.ayrton.eu/produit/perseo-profile/
  {
    match: ['ayrtonperseoprofile', 'perseoprofile'],
    deviceTypeId: 'd4848bc8-de5d-5dfc-876a-051b6e2494fa',
    template: {
      manufacturerUrl: 'https://www.ayrton.eu/produit/perseo-profile/',
      name: 'Ayrton Perseo Profile',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 7-56° · 6800 K · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.ayrton.eu/produit/karif-lt/
  {
    match: ['ayrtonkariflt', 'kariflt'],
    deviceTypeId: '59fb96b2-7908-53e2-85f6-7c52e9a58238',
    template: {
      manufacturerUrl: 'https://www.ayrton.eu/produit/karif-lt/',
      name: 'Ayrton Karif LT',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 2.8-47° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.ayrton.eu/produit/bora/
  {
    match: ['ayrtonboras', 'boras'],
    deviceTypeId: '451fe6f2-a4a6-5d59-8c10-225d28fd9fdc',
    template: {
      manufacturerUrl: 'https://www.ayrton.eu/produit/bora/',
      name: 'Ayrton Bora-S',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 8-64° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Lighting-Fixtures/Source-Four-LED-Series-3/Features.aspx
  {
    match: ['etcsourcefourledseries3lustrx8', 'sourcefourledseries3lustrx8'],
    deviceTypeId: 'f46ff924-31b9-530c-95a7-13d7d75aec9c',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Lighting-Fixtures/Source-Four-LED-Series-3/Features.aspx',
      name: 'ETC Source Four LED Series 3 Lustr X8',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · beam 10° · 6800 K · CRI 90 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.etcconnect.com/workarea/DownloadAsset.aspx?id=10737484146
  {
    match: ['etccolorsourcespot', 'colorsourcespot'],
    deviceTypeId: '412d5d24-9480-578a-ac80-84416e683ede',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/workarea/DownloadAsset.aspx?id=10737484146',
      name: 'ETC ColorSource Spot',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · beam 10° · 6800 K · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://chauvetprofessional.com/product/maverick-storm-1-wash/
  {
    match: ['chauvetprofessionalmaverickstorm1wash', 'maverickstorm1wash'],
    deviceTypeId: '7e8d8404-888f-572b-9123-0ff5823d8248',
    template: {
      manufacturerUrl: 'https://chauvetprofessional.com/product/maverick-storm-1-wash/',
      name: 'Chauvet Professional Maverick Storm 1 Wash',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 11-42° · 6800 K · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['elationproteusmaximus', 'proteusmaximus'],
    deviceTypeId: '05f103da-1fe7-55b3-900b-9c1cae1bf020',
    template: {
      name: 'Elation Proteus Maximus',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 5.5-55° · 6800 K · DMX 37 ch · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.robe.cz/products/iforte-ltx
  {
    match: ['robeiforteltx', 'iforteltx'],
    deviceTypeId: 'eb40e6c0-2d0e-52ca-9d3c-cd242c9d8e8d',
    template: {
      manufacturerUrl: 'https://www.robe.cz/products/iforte-ltx',
      name: 'Robe iForte LTX',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 3.5-52° · 6800 K · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['martinharmanmacencoreperformancecld', 'macencoreperformancecld'],
    deviceTypeId: '3a895c44-3452-5682-ae78-690461071774',
    template: {
      name: 'Martin / Harman MAC Encore Performance CLD',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 12-48° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.martin.com/en-US/products/mac-aura-xip
  {
    match: ['martinharmanmacauraxip', 'macauraxip'],
    deviceTypeId: 'e81f83e0-cc1c-52f4-a695-3ca096a2f860',
    template: {
      manufacturerUrl: 'https://www.martin.com/en-US/products/mac-aura-xip',
      name: 'Martin / Harman MAC Aura XIP',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 8-60° · 6800 K · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['elationfuzemaxprofile', 'fuzemaxprofile'],
    deviceTypeId: 'd33df562-e105-5c2a-823c-fb4dbc46aaab',
    template: {
      name: 'Elation Fuze Max Profile',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 5.5-52° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['sgmp6', 'p6'],
    deviceTypeId: '31d2f286-288a-5c98-9c97-45d3a8d96c96',
    template: {
      name: 'SGM P-6',
      category: LIGHT,
      subtitle: 'flood',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · beam 10° · 6800 K · IP66 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['adjvizibeam12rx', 'vizibeam12rx'],
    deviceTypeId: '4378a04e-cdaf-5a5b-9e50-a9817c7324a8',
    template: {
      name: 'ADJ Vizi Beam 12RX',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · beam 10° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://astera-led.com/products/ax1-pixeltube/
  {
    match: ['asteraax1pixeltube', 'ax1pixeltube'],
    deviceTypeId: '8f891f4e-4d42-5695-aa6f-ccfff3676426',
    template: {
      manufacturerUrl: 'https://astera-led.com/products/ax1-pixeltube/',
      name: 'Astera AX1 PixelTube',
      category: LIGHT,
      subtitle: 'cyc',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · beam 10° · 6800 K · IP65 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['chauvetprofessionalroguer2spot', 'roguer2spot'],
    deviceTypeId: 'd737359b-76ef-5778-b939-de0be15e435c',
    template: {
      name: 'Chauvet Professional Rogue R2 Spot',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · beam 10° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://chauvetprofessional.com/product/colordash-par-h12x-ip/
  {
    match: ['chauvetprofessionalcolordashparh12xip', 'colordashparh12xip'],
    deviceTypeId: 'ba49326f-4dec-59c3-9efb-bb761ea74ed1',
    template: {
      manufacturerUrl: 'https://chauvetprofessional.com/product/colordash-par-h12x-ip/',
      name: 'Chauvet Professional COLORdash Par H12X IP',
      category: LIGHT,
      subtitle: 'par',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · beam 10° · 2800-10000 K · IP65 · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.robe.cz/ledbeam-350
  {
    match: ['robeledbeam350', 'ledbeam350'],
    deviceTypeId: '775edb32-e844-5ef5-a53b-6c36ebfc640f',
    template: {
      manufacturerUrl: 'https://www.robe.cz/ledbeam-350',
      name: 'Robe LEDBeam 350',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 4-50° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://elationlighting.com/kl-panel-xl
  {
    match: ['elationklpanelxl', 'klpanelxl'],
    deviceTypeId: 'c602414a-c103-5d08-aceb-b220104a1fb4',
    template: {
      manufacturerUrl: 'https://elationlighting.com/kl-panel-xl',
      name: 'Elation KL Panel XL',
      category: LIGHT,
      subtitle: 'led-panel',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · beam 10° · 2000-10000 K · CRI 95 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['adjfocusspot6z', 'focusspot6z'],
    deviceTypeId: 'f0b70451-b5fa-523a-a6a7-b3003808d003',
    template: {
      name: 'ADJ Focus Spot 6Z',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 9-28° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://chauvetprofessional.com/product/rogue-r1-beamwash/
  {
    match: ['chauvetprofessionalroguer1beamwash', 'roguer1beamwash'],
    deviceTypeId: '7c222cb4-33ee-5a97-94a1-fa78f2a3f29b',
    template: {
      manufacturerUrl: 'https://chauvetprofessional.com/product/rogue-r1-beamwash/',
      name: 'Chauvet Professional Rogue R1 BeamWash',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 3.4-67.7° · 2800-10000 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['cameoopuss5', 'opuss5'],
    deviceTypeId: '206ee8d8-6385-5e93-8225-aab31681c806',
    template: {
      name: 'Cameo OPUS S5',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 6-46° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.cameolight.com/en/solutions/rental/moving-lights/beam-moving-heads/20662/opus-h5
  {
    match: ['cameoopush5', 'opush5'],
    deviceTypeId: '659988f9-e127-5919-a768-a76d31ea6572',
    template: {
      manufacturerUrl: 'https://www.cameolight.com/en/solutions/rental/moving-lights/beam-moving-heads/20662/opus-h5',
      name: 'Cameo OPUS H5',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 2-42° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.cameolight.com/en/series/otos-series/26039/otos-h5
  {
    match: ['cameootosh5', 'otosh5'],
    deviceTypeId: 'c4e53a9f-0d16-5bc4-9a92-cefe301e90a5',
    template: {
      manufacturerUrl: 'https://www.cameolight.com/en/series/otos-series/26039/otos-h5',
      name: 'Cameo OTOS H5',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 2-42° · 6800 K · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['cameootossp6', 'otossp6'],
    deviceTypeId: 'ef967c1f-6fb1-52e2-be2b-76db0e9450cf',
    template: {
      name: 'Cameo OTOS SP6',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 7-50° · 6800 K · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['cameoevoss3', 'evoss3'],
    deviceTypeId: '53dbe488-28cc-50d9-bb22-293d7105b705',
    template: {
      name: 'Cameo EVOS S3',
      category: LIGHT,
      subtitle: 'moving-spot',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 10-38° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['cameoevosw7', 'evosw7'],
    deviceTypeId: '64cd7e39-c26c-5546-8a90-71a5655328b7',
    template: {
      name: 'Cameo EVOS W7',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 7-50° · 2700-8000 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.cameolight.com/en/solutions/rental/moving-lights/beam-moving-heads/29085/otos-b5
  {
    match: ['cameootosb5', 'otosb5'],
    deviceTypeId: '069a3592-38bd-5e5a-98b7-c92b1c2f6b4f',
    template: {
      manufacturerUrl: 'https://www.cameolight.com/en/solutions/rental/moving-lights/beam-moving-heads/29085/otos-b5',
      name: 'Cameo OTOS B5',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 2-24° · 6800 K · IP65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.cameolight.com/en/solutions/dj-musicians/moving-lights/moving-heads/17232/movo-beam-z100
  {
    match: ['cameomovobeamz100', 'movobeamz100'],
    deviceTypeId: 'db86199c-9846-5e5e-bcec-0e091c00f5ed',
    template: {
      manufacturerUrl: 'https://www.cameolight.com/en/solutions/dj-musicians/moving-lights/moving-heads/17232/movo-beam-z100',
      name: 'Cameo MOVO BEAM Z100',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 4-30° · 6800 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://www.robe.cz/megapointe
  {
    match: ['roberobinmegapointe', 'robinmegapointe'],
    deviceTypeId: 'c745018b-fc13-5728-9d96-d859e935961f',
    template: {
      manufacturerUrl: 'https://www.robe.cz/megapointe',
      name: 'Robe Robin MegaPointe',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 307,
      weightKg: 42.5,
      notes: '8200 lm · zoom 3-45° · 6800 K · DMX 30 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['roberobinpointe', 'robinpointe'],
    deviceTypeId: '85ef7824-019c-5025-a06e-13812288c7db',
    template: {
      name: 'Robe Robin Pointe',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 470,
      weightKg: 15,
      notes: '9870 lm · zoom 2.5-20° · 7000 K · CRI 75 · DMX 30 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['claypakymythos2', 'mythos2'],
    deviceTypeId: '679a8cda-3b99-5110-9856-0f5de2bf1329',
    template: {
      name: 'Clay Paky Mythos 2',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 440,
      weightKg: 32,
      notes: '23000 lm · zoom 4-50° · 7000 K · DMX 26 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['claypakysharpy', 'sharpy'],
    deviceTypeId: '5e60456d-aa2b-5369-9e18-b1daec7db55c',
    template: {
      name: 'Clay Paky Sharpy',
      category: LIGHT,
      subtitle: 'moving-beam',
      powerWatts: 189,
      weightKg: 19,
      notes: '7950 lm · beam 3.8° · 8000 K · DMX 16 ch · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['molerichardsonmolefay4lite', 'molefay4lite'],
    deviceTypeId: '10ca3253-1c46-5247-9caf-3ec6837d8a44',
    template: {
      name: 'Mole-Richardson Molefay 4-Lite',
      category: LIGHT,
      subtitle: 'blinder',
      powerWatts: 2600,
      weightKg: 6.8,
      notes: '65000 lm · beam 90° · 3200 K · mount baby',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['martinharmanatomic3000dmx', 'atomic3000dmx'],
    deviceTypeId: 'bf3fc067-dc05-5340-8e3c-500abaf50757',
    template: {
      name: 'Martin / Harman Atomic 3000 DMX',
      category: LIGHT,
      subtitle: 'blinder',
      powerWatts: 3000,
      weightKg: 7.2,
      notes: '200000 lm · beam 120° · 5600 K · DMX 4 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/ColorSource-CYC/Features.aspx
  {
    match: ['etccolorsourcecyc', 'colorsourcecyc'],
    deviceTypeId: '77004e9d-fb4e-593a-aa6a-5de69f04217b',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/ColorSource-CYC/Features.aspx',
      name: 'ETC ColorSource CYC',
      category: LIGHT,
      subtitle: 'cyc',
      powerWatts: 133,
      weightKg: 4.67,
      notes: '4117 lm · beam 115° · 2700-6500 K · CRI 92 · DMX 6 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['arricyc1250', 'cyc1250'],
    deviceTypeId: '6b471748-ebfd-5fb1-8763-224490b6552e',
    template: {
      name: 'ARRI CYC 1250',
      category: LIGHT,
      subtitle: 'cyc',
      powerWatts: 1250,
      weightKg: 7.4,
      notes: '28000 lm · beam 130° · 3200 K · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['etcdesired22', 'desired22'],
    deviceTypeId: '0b29f3b9-fa3e-58ee-af28-22f9b9257ea2',
    template: {
      name: 'ETC Desire D22',
      category: LIGHT,
      subtitle: 'flood',
      powerWatts: 22,
      weightKg: 2.9,
      notes: '707 lm · beam 24° · RGBW · CRI 95 · DMX 5 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.etcconnect.com/Products/Entertainment-Fixtures/Desire-D40/Features.aspx
  {
    match: ['etcdesired40', 'desired40'],
    deviceTypeId: '2e17484d-da93-50be-92c5-99c918b7d9db',
    template: {
      manufacturerUrl: 'https://www.etcconnect.com/Products/Entertainment-Fixtures/Desire-D40/Features.aspx',
      name: 'ETC Desire D40',
      category: LIGHT,
      subtitle: 'flood',
      powerWatts: 100,
      weightKg: 4.1,
      notes: '2593 lm · beam 24° · RGBW · CRI 95 · DMX 5 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['philipscolorkineticscolorblast12', 'colorblast12'],
    deviceTypeId: '1aed3908-60da-5a51-a50a-51678aaa57b9',
    template: {
      name: 'Philips / ColorKinetics ColorBlast 12',
      category: LIGHT,
      subtitle: 'flood',
      powerWatts: 48,
      weightKg: 3,
      notes: '1200 lm · beam 10° · RGBW · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  {
    match: ['robertjuliatcyrano2500w', 'cyrano2500w'],
    deviceTypeId: 'fe0a02b4-2b8e-5091-9168-74210a327026',
    template: {
      name: 'Robert Juliat Cyrano 2500W',
      category: LIGHT,
      subtitle: 'followspot',
      powerWatts: 2500,
      weightKg: 65,
      notes: '68000 lm · zoom 7-14° · 6000 K · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [],
    },
  },
  // Quelle: https://aputure.com/en-US/products/ls-600x-pro
  {
    match: ['aputurels600xpro', 'ls600xpro'],
    deviceTypeId: 'bd60702e-1376-5293-9f71-6bb6091a08cd',
    template: {
      manufacturerUrl: 'https://aputure.com/en-US/products/ls-600x-pro',
      name: 'Aputure LS 600x Pro',
      category: LIGHT,
      subtitle: 'led-panel',
      powerWatts: 600,
      weightKg: 5.16,
      notes: '36000 lm · beam 55° · 2700-6500 K · CRI 96 · power Neutrik TRUE1 · DMX 8 ch · mount bowens',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['aputurels300xii', 'ls300xii'],
    deviceTypeId: '4fbfbbe1-3400-5d06-bb72-8a481e7851da',
    template: {
      name: 'Aputure LS 300x II',
      category: LIGHT,
      subtitle: 'led-panel',
      powerWatts: 350,
      weightKg: 3.45,
      notes: '18000 lm · beam 55° · 2700-6500 K · CRI 96 · power Neutrik TRUE1 · DMX 4 ch · mount bowens',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.elationlighting.com/products/kl-fresnel-8-fc
  {
    match: ['elationklfresnel8fc', 'klfresnel8fc'],
    deviceTypeId: 'c2314f8d-c3e2-506f-a8de-c1167c89d725',
    template: {
      manufacturerUrl: 'https://www.elationlighting.com/products/kl-fresnel-8-fc',
      name: 'Elation KL Fresnel 8 FC',
      category: LIGHT,
      subtitle: 'fresnel',
      powerWatts: 514,
      weightKg: 10.5,
      notes: '16505 lm · zoom 10.4-50.8° · 2700-6500 K · CRI 92 · power powerCON TRUE1 · DMX 18 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['elationklfresnel6fc', 'klfresnel6fc'],
    deviceTypeId: 'd2062df8-0698-5123-a476-ecf9ad5d1809',
    template: {
      name: 'Elation KL Fresnel 6 FC',
      category: LIGHT,
      subtitle: 'fresnel',
      powerWatts: 220,
      weightKg: 7,
      notes: '7200 lm · zoom 12-60° · 2000-10000 K · CRI 95 · power powerCON TRUE1 · DMX 18 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  {
    match: ['elationklpanelfc', 'klpanelfc'],
    deviceTypeId: '4a58b27f-dcc4-505d-b156-bf5f06141d38',
    template: {
      name: 'Elation KL Panel FC',
      category: LIGHT,
      subtitle: 'led-panel',
      powerWatts: 295,
      weightKg: 13,
      notes: '24000 lm · beam 64° · 2000-10000 K · CRI 95 · power powerCON TRUE1 · DMX 16 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.elationlighting.com/products/kl-profile-fc
  {
    match: ['elationklprofilefc', 'klprofilefc'],
    deviceTypeId: '048c31ba-130e-557a-be80-b73a9d4b6e75',
    template: {
      manufacturerUrl: 'https://www.elationlighting.com/products/kl-profile-fc',
      name: 'Elation KL Profile FC',
      category: LIGHT,
      subtitle: 'profile',
      powerWatts: 305,
      weightKg: 9.5,
      notes: '10600 lm · zoom 6-50° · 2400-8500 K · CRI 94 · power powerCON TRUE1 · DMX 24 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.elationlighting.com/products/kl-par-fc
  {
    match: ['elationklparfc', 'klparfc'],
    deviceTypeId: '97d7c9cd-c369-546c-9de6-d86fd87c61dd',
    template: {
      manufacturerUrl: 'https://www.elationlighting.com/products/kl-par-fc',
      name: 'Elation KL PAR FC',
      category: LIGHT,
      subtitle: 'par',
      powerWatts: 280,
      weightKg: 7.7,
      notes: '11000 lm · beam 11° · 1750-10000 K · CRI 93 · power powerCON TRUE1 · DMX 16 ch · mount clamp',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.elationlighting.com/products/fuze-wash-z350
  {
    match: ['elationfuzewashz350', 'fuzewashz350'],
    deviceTypeId: '676ac255-ca48-57d7-8704-0095093c92db',
    template: {
      manufacturerUrl: 'https://www.elationlighting.com/products/fuze-wash-z350',
      name: 'Elation Fuze Wash Z350',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 399,
      weightKg: 20.4,
      notes: '13000 lm · zoom 6-46° · 2700-8000 K · CRI 80 · power powerCON TRUE1 · DMX 28 ch · 30 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
  // Quelle: https://www.elationlighting.com/fuze-par-z120-ip
  {
    match: ['elationfuzeparz120ip', 'fuzeparz120ip'],
    deviceTypeId: 'd251500e-6016-5baa-bdd2-1f8418705de3',
    template: {
      manufacturerUrl: 'https://www.elationlighting.com/fuze-par-z120-ip',
      name: 'Elation Fuze Par Z120 IP',
      category: LIGHT,
      subtitle: 'moving-wash',
      powerWatts: 157,
      weightKg: 8.6,
      notes: '4500 lm · zoom 7-55° · 2700-8000 K · CRI 80 · power powerCON TRUE1 · DMX 20 ch · 65 · mount yoke',
      width: 200,
      height: 140,
      inputs: [
        { id: '', name: 'DMX In', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
        { id: '', name: 'Power', type: 'Power', connectorType: 'PowerCON' },
      ],
      outputs: [
        { id: '', name: 'DMX Thru', type: 'DMX', connectorType: 'DMX 5-pol (XLR)' },
      ],
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const fixtureTemplates: EquipmentTemplate[] =
  FIXTURE_CATALOG.map((e) => ({ ...e.template, deviceTypeId: e.deviceTypeId }))
