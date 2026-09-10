import { describe, expect, it, beforeEach } from 'vitest'
import { LEGACY_TEMPLATE_RENAMES, heileVorlagenName } from '../src/renderer/lib/templateRenames'
import { passiveTemplates } from '../src/renderer/lib/passiveCatalog'
import { STORAGE_KEYS } from '../src/renderer/lib/storageKeys'

// ---------------------------------------------------------------------------
// Der Name einer ausgelieferten Vorlage IST ihre Kennung (#837).
//
// Drei Vorlagen aus `passiveCatalog.ts` trugen deutsche Namen in einem Repo mit
// Quellsprache `en`. Sie umzubenennen ist die eine Haelfte; die andere ist die
// Migration, und ohne sie waere das Umbenennen ein SCHADEN statt einer
// Korrektur:
//
//   `projectStore.seedBuiltInLibrary` gleicht die mitgelieferten Vorlagen ueber
//   `byName` gegen die Bibliothek des Nutzers ab. Steht dort die alte deutsche
//   Vorlage, findet der Abgleich den neuen englischen Namen nicht — und legt
//   ihn ZUSAETZLICH an. Dasselbe Geraet zweimal in der Seitenleiste, und der
//   Nutzer muesste raten, welche seine Plaene benutzen.
//
// Dieselbe Bauform wie `LEGACY_CATEGORY_RENAMES` (#822/#835) und
// `LEGACY_CONNECTOR_RENAMES` (#832) — und derselbe Test wie dort: kein
// AUSGELIEFERTER Name darf ein SCHLUESSEL der Tabelle sein. Das ist
// entscheidbar, vollstaendig und braucht keine Wortliste: ein Name, der noch
// umbenannt wird, ist per Definition ein alter.
// ---------------------------------------------------------------------------

describe('Die Umbenennungstabelle der Vorlagen', () => {
  it('bildet jeden alten Namen auf einen neuen ab, der nicht selbst alt ist', () => {
    for (const [alt, neu] of Object.entries(LEGACY_TEMPLATE_RENAMES)) {
      expect(alt).not.toBe(neu)
      expect(
        LEGACY_TEMPLATE_RENAMES[neu],
        `"${alt}" -> "${neu}", aber "${neu}" wird selbst noch umbenannt — ` +
          'eine Kette, die nach einem Durchlauf noch nicht fertig ist.',
      ).toBeUndefined()
    }
  })

  it('kein ausgelieferter Vorlagen-Name steht als ALTER Name in der Tabelle', () => {
    // Die Zusicherung, die keine Sprachkenntnis braucht: was heute
    // ausgeliefert wird, darf nicht gleichzeitig etwas sein, das noch
    // umbenannt wird. Wer eine Vorlage umbenennt und den Eintrag vergisst,
    // faellt hier durch — nicht erst, wenn jemand zwei gleiche Eintraege in
    // der Seitenleiste meldet.
    const ausgeliefert = passiveTemplates.map((t) => t.name)
    const veraltet = ausgeliefert.filter((n) => n in LEGACY_TEMPLATE_RENAMES)
    expect(
      veraltet,
      'Diese ausgelieferten Vorlagen tragen einen Namen, den die Tabelle als ' +
        'ALT fuehrt. Entweder den Katalog auf den neuen Namen ziehen oder den ' +
        'Eintrag entfernen.',
    ).toEqual([])
  })

  it('laesst einen unbekannten Namen unveraendert', () => {
    expect(heileVorlagenName('Eigene Patchblende 3HE')).toBe('Eigene Patchblende 3HE')
  })

  it('zieht die drei umbenannten Leisten auf ihren heutigen Namen', () => {
    expect(heileVorlagenName('Steckdosenleiste 6-fach')).toBe('Power strip 6-way')
    expect(heileVorlagenName('Steckdosenleiste 8-fach')).toBe('Power strip 8-way')
    expect(heileVorlagenName('IEC-Leiste 8-fach')).toBe('IEC strip 8-way')
  })
})

describe('Die Bibliothek des Nutzers ueberlebt die Umbenennung', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('legt die umbenannte Vorlage nicht ein zweites Mal an', async () => {
    // Die Lage, um die es geht: der Nutzer hat die App vor der Umbenennung
    // benutzt, seine Bibliothek traegt den deutschen Namen — und dazu eine
    // eigene Aenderung (hier: eine Notiz), die nicht verlorengehen darf.
    const alt = {
      ...passiveTemplates.find((t) => t.name === 'Power strip 6-way')!,
      name: 'Steckdosenleiste 6-fach',
      notes: 'meine eigene Notiz',
    }
    localStorage.setItem(STORAGE_KEYS.customLibrary, JSON.stringify([alt]))

    const { loadCustomLibrary } = await import('../src/renderer/store/libraryPersist')
    const geladen = loadCustomLibrary()

    const treffer = geladen.filter((t) => t.name === 'Power strip 6-way')
    expect(treffer, 'genau eine Vorlage, nicht zwei').toHaveLength(1)
    expect(treffer[0].notes, 'die eigene Aenderung bleibt').toBe('meine eigene Notiz')
    expect(geladen.some((t) => t.name === 'Steckdosenleiste 6-fach')).toBe(false)
  })
})
