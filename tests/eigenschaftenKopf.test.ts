import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Was in der Eigenschaften-Leiste GANZ OBEN steht.
 *
 * WARUM ES DAS GIBT. Gemeldet am 2026-09-28: „die eigenschaften zeile im cable
 * planner ist unübersichtlich. ganz oben muss name und notiz zum gerät stehen,
 * dann die inputs und outputs und darunter erst der ganze rest."
 *
 * Nachgesehen stimmte keines der drei:
 *   • Der NAME stand an vierter Stelle — darueber die Geraete-Art-Karte und der
 *     Katalog-Typ, eine Suchliste ueber mehr als 1800 Modelle.
 *   • Die NOTIZ (`equipment.notes`, das einzige freie Textfeld am Geraet) lag im
 *     Abschnitt „Netzzugang", unter Benutzername und Passwort. Vier Klicks.
 *   • Die ANSCHLUESSE standen an JSX-Stelle 24 von 31, hinter Verbrauch,
 *     Stromkreis, Adapter, DMX, Haus, Formatprofil und Abmessungen.
 *
 * WARUM DAS EIN TEST AM QUELLTEXT IST UND KEIN GERENDERTES PANEL. Die
 * Reihenfolge entsteht aus ZWEI Stellen, die nichts voneinander wissen: die
 * JSX-Folge in `EquipmentProperties` und `equipmentSectionOrder` im UI-Store
 * (`SortableSection` setzt daraus `order: index`). Ein Rendertest wuerde eine
 * Verschiebung sehen, aber nicht, welche der beiden Stellen sie verursacht hat
 * — und genau das ist die Falle: `ports` nach vorn zu setzen wirkt nur, solange
 * `PortsSection` auch im JSX oben steht, weil beide im Band `order: 0` liegen
 * und dort die DOM-Folge entscheidet.
 */
const lies = (...teile: string[]) => readFileSync(join(process.cwd(), ...teile), 'utf8')

const PANEL = lies('src', 'renderer', 'components', 'Properties', 'EquipmentProperties.tsx')
const IDENTITY = lies('src', 'renderer', 'components', 'Properties', 'sections', 'IdentityBlock.tsx')
const STORE = lies('src', 'renderer', 'store', 'uiStore.ts')
const NETZ = lies('src', 'renderer', 'components', 'Properties', 'sections', 'NetworkAccessSection.tsx')

const PORTS = lies('src', 'renderer', 'components', 'Properties', 'sections', 'PortsSection.tsx')

describe('Eigenschaften-Leiste: der Kopf', () => {
  it('Name, Kurzname, Untertitel — der Katalog-Typ nicht im Kopf', () => {
    const name = IDENTITY.indexOf("t('eq.field.name'")
    const kurz = IDENTITY.indexOf("t('eq.field.shortName'")
    const untertitel = IDENTITY.indexOf("t('eq.field.subtitle'")
    expect(name).toBeGreaterThan(-1)
    expect(name).toBeLessThan(kurz)
    expect(kurz).toBeLessThan(untertitel)
    // Der Katalog-Typ wird automatisch vergeben und steht in `CatalogueSection`.
    expect(IDENTITY).not.toContain('<DeviceTypePicker')
    expect(PANEL.indexOf('<CatalogueSection')).toBeGreaterThan(PANEL.indexOf('<PortsSection'))
  })

  it('der Kurzname ist zugeklappt eine Zeile mit Stift, kein Feld (#956)', () => {
    // Der Stift oeffnet das Feld; ohne ihn steht nur der wirksame Wert da.
    expect(IDENTITY).toContain("t('eq.field.shortNameEdit'")
    expect(IDENTITY).toContain('effectiveShortName(equipment)')
    expect(IDENTITY).toContain('kurznameOffen ? (')
  })

  it('die Notiz ist das Geraetefeld und liegt nicht mehr im Netzzugang', () => {
    expect(IDENTITY).toContain('{ notes: event.target.value }')
    // Der Netzzugang darf `notes` nicht mehr schreiben — sonst stuende dasselbe
    // Feld zweimal im Panel, und zwei Textfelder auf derselben Eigenschaft sind
    // schlimmer als ein schlecht platziertes.
    expect(NETZ).not.toContain('{ notes: event.target.value }')
  })

  it('die Anschluesse stehen im JSX direkt unter dem Kopf, davor die Notiz nicht (#957)', () => {
    const identity = PANEL.indexOf('<IdentityBlock')
    const ports = PANEL.indexOf('<PortsSection')
    const notiz = PANEL.indexOf('<NotesBlock')
    expect(identity).toBeGreaterThan(-1)
    expect(ports).toBeGreaterThan(identity)
    expect(notiz).toBeGreaterThan(ports)
    // Alles andere kommt danach. Die Liste ist ausgeschrieben und nicht
    // gerechnet: ein neuer Abschnitt soll diesen Test dazu zwingen, dass jemand
    // eine Entscheidung trifft, statt ihn stillschweigend mitzunehmen.
    for (const spaeter of [
      '<DeviceKindCards',
      '<OptionalFieldsSection',
      '<FotoSection',
      '<DisplayFlagsSection',
      '<RentmanSyncBadge',
      '<DisplayPropertiesBlock',
      '<CategoryPropsSection',
      '<SourceIdentitySection',
      '<NetworkAccessSection',
      '<LifecycleSection',
      '<OptikSection',
      '<CameraControlsSection',
      '<PowerConsumptionSection',
      '<CircuitSection',
      '<AdapterSection',
      '<DmxSection',
      '<HausSection',
      '<SinkProfileSection',
      '<SwitchingSection',
      '<DimensionsSection',
      '<NetworkConfigSection',
      '<ModesSection',
      '<RackSection',
      '<LibrarySaveSection',
      '<ReplaceDeviceSection',
      '<RackInstanceCard',
      '<DeviceToolsSection',
      '<DeviceConfigsBlock',
      '<PrintSection',
    ]) {
      expect(PANEL.indexOf(spaeter), spaeter).toBeGreaterThan(notiz)
    }
  })

  it('die Anschluesse sind FEST — kein Griff, nicht in der gemerkten Reihenfolge (#957)', () => {
    // „Immer oben" ist keine Vorgabe, die ein Griff wieder aufheben darf.
    expect(PORTS).toMatch(/<SortableSection[\s\S]*?\bfest\b[\s\S]*?>/)
    const block = STORE.slice(STORE.indexOf('equipmentSectionOrder: ['))
    const liste = block.slice(0, block.indexOf('],'))
    const ids = [...liste.matchAll(/^\s*'([a-z-]+)',$/gm)].map((m) => m[1])
    expect(ids).not.toContain('ports')
    // Ein Bestandssatz mit altem `ports`-Eintrag verliert ihn beim Laden.
    expect(STORE).toContain('cleaned.filter((id) => bekannt.has(id))')
    expect(STORE).not.toContain('portsVorangestellt')
  })

  it('Inputs und Outputs tauschen ist dasselbe wie Ports spiegeln (#958)', () => {
    // Zwei Listen, ein Zustand: die Reihenfolge im Panel folgt `portsFlipped`,
    // und ein Zug am Griff schaltet genau diese Eigenschaft.
    expect(PORTS).toContain("gespiegelt ? ['out', 'in'] : ['in', 'out']")
    expect(PORTS).toContain('if (over && active.id !== over.id) setGespiegelt(!gespiegelt)')
  })

  it('das Gateway der ersten Schnittstelle ist im Netzzugang eintragbar (#961)', () => {
    expect(NETZ).toContain("t('net.gateway'")
    expect(NETZ).toContain('{ gateway: event.target.value || undefined }')
  })
})

/**
 * Die schwebende Suchleiste bleibt im Fenster.
 *
 * WARUM ES DAS GIBT. `ui:overflow` meldete am 2026-09-28 bei 1280 x 800:
 * „Reihe 818px breit, Inhalt 1172px — unerreichbar: Gerät suchen…". Gemerkt
 * war `x: 1012` — bei 1500 px Fensterbreite ist die Zeichenflaeche 1038 px
 * breit und das passt knapp, bei 1280 px ist sie 818 px breit und 1012 liegt
 * 194 px draussen. Weg war damit auch der Schliess-Knopf.
 *
 * Der Zieh-Vorgang begrenzt die Lage (`maxX`/`maxY`) — aber nur WAEHREND des
 * Ziehens. Was danach mit dem Fenster passiert, wusste niemand.
 */
describe('die schwebende Suchleiste', () => {
  const SUCHE = lies('src', 'renderer', 'components', 'Canvas', 'CanvasSearch.tsx')

  it('prueft die gemerkte Lage gegen die gemessene Flaeche', () => {
    // Gemessen, nicht geraten: am `offsetParent`, demselben Bezug, auf den
    // `left`/`top` sich beziehen.
    expect(SUCHE).toContain('new ResizeObserver(messen)')
    expect(SUCHE).toContain('pos.x + eigen.w <= flaeche.w')
    expect(SUCHE).toContain('pos.y + eigen.h <= flaeche.h')
  })

  it('faellt auf die Vorgabe zurueck, statt an den Rand zu rutschen', () => {
    // Der erste Versuch schob sie nur ins Fenster — dort lag sie auf der
    // Werkzeugleiste und verdeckte „Schematic" und „Circuit". Die Vorgabe
    // weicht ihr aus, weil sie deren Unterkante MISST.
    expect(SUCHE).toContain('const eigeneLage = pos && passt')
    expect(SUCHE).toContain('toolbarBottom > 0 ? toolbarBottom + 8 : 12')
  })

  it('schreibt beim Verkleinern nicht in den Speicher', () => {
    // Wer sein Fenster kurz verkleinert, soll seine Lage nicht verlieren.
    // `setPos` darf deshalb nur aus dem Ziehen kommen — es steht genau
    // einmal im Quelltext, in `onMove`.
    expect(SUCHE.match(/setPos\(/g) ?? []).toHaveLength(1)
  })
})
