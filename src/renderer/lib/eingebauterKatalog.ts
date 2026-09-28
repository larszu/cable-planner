// ───────────────────────────────────────────────────────────────────────────
// Der eingebaute Katalog — die Vorlagen, die jede Installation beim Start in
// ihre Bibliothek bekommt (`runLibraryMigration` in `projectStore`).
//
// Eine Liste statt dreier: der Start saet sie, das automatische Hochladen
// erkennt an ihr, was NICHT eigen ist (unveraenderte Katalog-Vorlagen gehen
// ueber `npm run library:publish`, nicht von jedem Rechner einzeln), und das
// Skript veroeffentlicht sie. Importe mit `.ts`-Endung, weil das Skript die
// Datei direkt in Node laedt.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment.ts'
import { blackmagicTemplates } from './blackmagicCatalog.ts'
import { ubiquitiTemplates } from './ubiquitiCatalog.ts'
import { monitorTemplates } from './monitorCatalog.ts'
import { cameraTemplates } from './cameraCatalog.ts'
import { miscTemplates } from './miscCatalog.ts'
import { greengoTemplates } from './greengoCatalog.ts'
import { ajaTemplates } from './ajaCatalog.ts'
import { rossTemplates } from './rossCatalog.ts'
import { lynxTemplates } from './lynxCatalog.ts'
import { switcherTemplates } from './switcherCatalog.ts'
import { avNetworkTemplates } from './avNetworkCatalog.ts'
import { broadcastToolsTemplates } from './broadcastToolsCatalog.ts'
import { audioTemplates } from './audioCatalog.ts'
import { wirelessAudioTemplates } from './wirelessAudioCatalog.ts'
import { micTemplates } from './micCatalog.ts'
import { mediaStationTemplates } from './mediaStationCatalog.ts'
import { passiveTemplates } from './passiveCatalog.ts'
import { decimatorTemplates } from './decimatorCatalog.ts'
import { bromptonTemplates } from './bromptonCatalog.ts'
import { clearcomTemplates } from './clearcomCatalog.ts'
import { luminexTemplates } from './luminexCatalog.ts'
import { netgearAvTemplates } from './netgearAvCatalog.ts'
import { lightwareTemplates } from './lightwareCatalog.ts'
// Uebernahme aus den Schwester-Planern (2026-09-24, `npm run katalog:uebernahme`).
// Diese vier sind ERZEUGT; sie tragen `portsUnknown`, weil ihre Quellen keine
// Anschluesse kennen — ausser den Lichtgeraeten, deren DMX- und Power-Buchsen
// der light-planner selbst ableitet.
import { cameraBodyTemplates } from './cameraBodyCatalog.ts'
import { lensTemplates } from './lensCatalog.ts'
import { rigTemplates } from './rigCatalog.ts'
import { fixtureTemplates } from './fixtureCatalog.ts'

export const EINGEBAUTER_KATALOG: readonly EquipmentTemplate[] = [...blackmagicTemplates, ...ubiquitiTemplates, ...monitorTemplates, ...cameraTemplates, ...miscTemplates, ...greengoTemplates, ...ajaTemplates, ...rossTemplates, ...lynxTemplates, ...switcherTemplates, ...avNetworkTemplates, ...broadcastToolsTemplates, ...audioTemplates, ...wirelessAudioTemplates, ...micTemplates, ...mediaStationTemplates, ...passiveTemplates, ...decimatorTemplates, ...bromptonTemplates, ...clearcomTemplates, ...luminexTemplates, ...netgearAvTemplates, ...lightwareTemplates, ...cameraBodyTemplates, ...lensTemplates, ...rigTemplates, ...fixtureTemplates]
