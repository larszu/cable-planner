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

describe('Eigenschaften-Leiste: der Kopf', () => {
  it('Name und Notiz stehen vor dem Katalog-Typ', () => {
    const name = IDENTITY.indexOf("t('eq.field.name'")
    const notiz = IDENTITY.indexOf("t('eq.field.notes'")
    const katalogTyp = IDENTITY.indexOf('<DeviceTypePicker')
    expect(name).toBeGreaterThan(-1)
    expect(notiz).toBeGreaterThan(-1)
    expect(katalogTyp).toBeGreaterThan(-1)
    expect(name).toBeLessThan(notiz)
    expect(notiz).toBeLessThan(katalogTyp)
  })

  it('die Notiz ist das Geraetefeld und liegt nicht mehr im Netzzugang', () => {
    expect(IDENTITY).toContain('{ notes: event.target.value }')
    // Der Netzzugang darf `notes` nicht mehr schreiben — sonst stuende dasselbe
    // Feld zweimal im Panel, und zwei Textfelder auf derselben Eigenschaft sind
    // schlimmer als ein schlecht platziertes.
    expect(NETZ).not.toContain('{ notes: event.target.value }')
  })

  it('die Anschluesse stehen im JSX vor allem ausser dem Kopf', () => {
    const identity = PANEL.indexOf('<IdentityBlock')
    const ports = PANEL.indexOf('<PortsSection')
    expect(identity).toBeGreaterThan(-1)
    expect(ports).toBeGreaterThan(identity)
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
      expect(PANEL.indexOf(spaeter), spaeter).toBeGreaterThan(ports)
    }
  })

  it('`ports` ist der erste Eintrag der gemerkten Reihenfolge', () => {
    const block = STORE.slice(STORE.indexOf('equipmentSectionOrder: ['))
    const liste = block.slice(0, block.indexOf('],'))
    const ids = [...liste.matchAll(/^\s*'([a-z-]+)',$/gm)].map((m) => m[1])
    expect(ids[0]).toBe('ports')
  })

  it('Bestandsnutzer bekommen die Umstellung, und zwar genau einmal', () => {
    // Die Vollstaendigkeits-Schleife in `load()` traegt nur FEHLENDE Abschnitte
    // nach; eine geaenderte Vorgabe-Reihenfolge erreicht damit niemanden, der
    // die App schon einmal geoeffnet hat — also gerade den nicht, der die
    // Meldung geschrieben hat.
    expect(STORE).toContain('parsed.portsVorangestellt !== true')
    // Und genau einmal: wer `ports` bewusst wegzieht, behaelt das.
    expect(STORE).toContain('merged.portsVorangestellt = true')
    // Die Vorgabe steht auf `true`, weil ein frischer Satz die Umstellung nicht
    // braucht. Deshalb MUSS gegen `parsed` geprueft werden, nicht gegen
    // `merged` — dort haette ein Bestandssatz ohne das Feld ebenfalls `true`.
    expect(STORE).toContain('portsVorangestellt: true,')
  })
})
