import { describe, expect, it } from 'vitest'
import { klassifiziere } from '../scripts/quellsprache.mjs'
import { createDemoProject } from '../src/renderer/lib/demoProject'
import { DEMO_RACK_PRESET_ID, createDemoRackPreset } from '../src/renderer/lib/demoRack'
import { passiveTemplates } from '../src/renderer/lib/passiveCatalog'

// ---------------------------------------------------------------------------
// Das Beispiel bringt ein Rack mit — und beides steht in der Quellsprache.
//
// ─── DER BEFUND (gemessen 2026-09-10) ──────────────────────────────────────
//
// Rack-Vorlagen kommen ausschliesslich aus `localStorage`
// (`groupPresetsPersist.loadGroupPresets`: kein Eintrag -> `[]`). Eine frische
// Installation hatte deshalb keine, und die Rack-Karte sagte „No rack layout
// saved yet". An `components/Rack/` haengt die gesamte 3D-Ansicht samt
// `lib/exportRack.ts` — sichtbar erst, nachdem jemand selbst ein Rack gebaut
// hat. `docs/ui-audit.md` fuehrt genau das als offenen Punkt (`rack-3d.png`).
//
// Nebenbefund derselben Klasse: die `description` des Beispielprojekts war
// deutsch, waehrend der `name` daneben schon englisch war. Beides sind DATEN,
// und `npm run lang:check` liest `t()`-Aufrufe — es hat davon nie etwas
// gesehen. Es ist das Zweite, was ein neuer Nutzer liest.
//
// ─── WAS DIESER TEST HAELT ─────────────────────────────────────────────────
//
// Nicht „das Rack sieht gut aus" — das ist Geschmack. Sondern die drei
// Zusagen, die brechen koennen, ohne dass es jemand merkt: die Kabel treffen
// Ports, die Platzierungen passen ins Rack, und die Texte sind englisch.
// ---------------------------------------------------------------------------

describe('Das mitgelieferte Beispiel-Rack', () => {
  it('jeder Kabel-Endpunkt trifft einen Port seines Geraets', () => {
    // Die Kabel des Racks verweisen ueber NAMEN, nicht ueber Indizes in der
    // Port-Liste. Ein umbenannter Port laesst das Kabel still ins Leere
    // laufen — `placeGroupPreset` findet den Namen nicht und legt die
    // Verbindung gar nicht erst an.
    const rack = createDemoRackPreset()
    const fehlend: string[] = []
    for (const c of rack.cables) {
      const von = rack.items[c.fromItemIndex]
      const nach = rack.items[c.toItemIndex]
      if (!von || !nach) {
        fehlend.push(`${c.name}: Geraete-Index zeigt ins Leere`)
        continue
      }
      const hat = (item: typeof von, name: string) =>
        [...item.inputs, ...item.outputs].some((p) => p.name === name)
      if (!hat(von, c.fromPortName)) fehlend.push(`${c.name}: ${von.name} hat kein "${c.fromPortName}"`)
      if (!hat(nach, c.toPortName)) fehlend.push(`${c.name}: ${nach.name} hat kein "${c.toPortName}"`)
    }
    expect(fehlend).toEqual([])
  })

  it('jede Platzierung liegt im Rack und keine zwei ueberlappen auf derselben Seite', () => {
    const rack = createDemoRackPreset()
    const gesamt = rack.rack?.totalUnits ?? 0
    expect(gesamt).toBeGreaterThan(0)
    const belegt = new Map<string, Set<number>>()
    const fehler: string[] = []
    for (const p of rack.rack?.placements ?? []) {
      if (p.startUnit < 1 || p.startUnit + p.heightUnits - 1 > gesamt) {
        fehler.push(`Index ${p.itemIndex}: HE ${p.startUnit}..${p.startUnit + p.heightUnits - 1} von ${gesamt}`)
      }
      // 'full' belegt beide Tiefen; 'front'/'rear' je eine.
      const seiten = p.mountSide === 'full' || !p.mountSide ? ['front', 'rear'] : [p.mountSide]
      for (const seite of seiten) {
        const genommen = belegt.get(seite) ?? new Set<number>()
        for (let he = p.startUnit; he < p.startUnit + p.heightUnits; he += 1) {
          if (genommen.has(he)) fehler.push(`HE ${he} (${seite}) doppelt belegt`)
          genommen.add(he)
        }
        belegt.set(seite, genommen)
      }
    }
    expect(fehler).toEqual([])
  })

  it('jedes Geraet nennt so viele Hoeheneinheiten wie seine Platzierung', () => {
    // Zwei Zahlen fuer dieselbe Sache — `rackUnits` am Geraet und
    // `heightUnits` an der Platzierung. Sie laufen auseinander, sobald
    // jemand nur eine anfasst.
    const rack = createDemoRackPreset()
    for (const p of rack.rack?.placements ?? []) {
      expect(rack.items[p.itemIndex]?.rackUnits, `Index ${p.itemIndex}`).toBe(p.heightUnits)
    }
  })

  it('die Kennung ist fest — zweimal laden legt nichts doppelt an', () => {
    expect(createDemoRackPreset().id).toBe(DEMO_RACK_PRESET_ID)
    expect(createDemoRackPreset().id).toBe(createDemoRackPreset().id)
  })

  it('die Strom-Leiste heisst wie die ausgelieferte Vorlage', () => {
    // Der Name IST die Kennung (#837). Weicht er ab, steht im Rack ein Geraet,
    // das aussieht wie die Katalog-Vorlage und keine ist.
    const leiste = createDemoRackPreset().items.find((i) => i.category === 'Power')
    expect(leiste).toBeDefined()
    expect(passiveTemplates.some((t) => t.name === leiste?.name)).toBe(true)
  })
})

describe('Beispielprojekt und Beispiel-Rack stehen in der Quellsprache', () => {
  const texte = (): Array<{ wo: string; text: string }> => {
    const p = createDemoProject()
    const rack = createDemoRackPreset()
    return [
      { wo: 'metadata.name', text: p.metadata.name },
      { wo: 'metadata.description', text: p.metadata.description ?? '' },
      ...p.equipment.map((e) => ({ wo: `equipment ${e.id}`, text: e.name })),
      ...p.cables.map((c) => ({ wo: `cable ${c.id}`, text: c.name })),
      { wo: 'rack.name', text: rack.name },
      ...rack.items.map((i) => ({ wo: `rack item`, text: i.name })),
      ...rack.cables.map((c) => ({ wo: `rack cable`, text: c.name })),
    ]
  }

  it('kein Text ist deutsch', () => {
    const deutsch = texte()
      .filter((t) => klassifiziere(t.text) === 'de')
      .map((t) => `${t.wo}: ${t.text}`)
    expect(
      deutsch,
      'Deutscher Text im ausgelieferten Beispiel. Er ist das Erste, was ein ' +
        'neuer Nutzer sieht, und `npm run lang:check` findet ihn NICHT — er ' +
        'ist ein Datenwert und kein `t()`-Aufruf.',
    ).toEqual([])
  })

  it('die Pruefung sieht ueberhaupt etwas — Gegenprobe', () => {
    expect(texte().length).toBeGreaterThan(15)
    expect(klassifiziere('Demo-Plan mit zwei Kameras und einem Bildmischer für die Regie.')).toBe('de')
  })
})
