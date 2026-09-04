import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Initiative 11, Schritt 2 — den Beleg aus dem Kommentar in ein Feld heben.
//
// DER BEFUND AUS DEM SCOPING. Neun der siebzehn Kataloge tragen einen
// Datenblatt-Link je Eintrag — als `// Quelle: <url>`-Kommentar. Der Text
// dazu: „an earlier reading of this ground reported that provenance was
// absent and would have to be gathered. That understated it. The evidence is
// largely *there*. What is missing is its shape."
//
// WAS DIE MESSUNG DARAN GEAENDERT HAT. Auch das war noch zu duester: nicht
// nur der Beleg ist da, die FORM ist es auch. `EquipmentItem.manufacturerUrl`
// existiert seit langem, ist in `modelFields` als Modell-Eigenschaft gefuehrt,
// wird in der Eigenschaften-Leiste als „Hersteller-Link … Oeffnen" gerendert
// und von `exportDevicePdf` als klickbare Zeile gedruckt.
//
// Es fehlte also weder der Beleg noch das Feld — es fehlte, dass die Kataloge
// das Feld FUELLEN. 253 Datenblatt-Links lagen in Kommentaren, wo kein Code
// sie erreicht, waehrend das Feld, das sie angezeigt haette, leer blieb. Der
// Kopf von `micCatalog.ts` sagt sogar „Quellen-URL je Eintrag" — die Absicht
// stand da, nur nicht als Datum.
//
// Ein zusaetzliches `provenance`-Feld daneben zu bauen waere ein zweiter Ort
// fuer dieselbe Wahrheit gewesen. Zwei Orte laufen auseinander — das hat der
// Zugangsdaten-Rundgang in diesem Repo schon einmal vorgefuehrt.
//
// WAS DER NUTZER DAVON HAT, und das ist der Punkt, nicht die Registry: wer an
// einer Port-Zahl zweifelt, kommt mit einem Klick auf das Datenblatt, statt
// auf nichts. Das Feld war schon verdrahtet; es war nur nie befuellt.
// ---------------------------------------------------------------------------

const LIB = resolve(__dirname, '..', 'src', 'renderer', 'lib')

const catalogs = (): string[] =>
  readdirSync(LIB).filter((f) => /Catalog\.ts$/.test(f))

/** `// Quelle: <url>` — die Zeile, die den Beleg bisher allein trug. */
const QUELLE = /^\s*\/\/\s*Quelle:\s*(\S+)\s*$/
const TEMPLATE_OPEN = /^\s*template:\s*\{\s*$/
const MANUFACTURER = /^\s*manufacturerUrl:\s*'([^']+)',?\s*$/

interface Pair {
  file: string
  line: number
  comment: string
  field: string | null
}

/**
 * Jede Quelle-Angabe mit dem `manufacturerUrl` des Eintrags, zu dem sie
 * gehoert. „Gehoert zu" heisst: das naechste `template: {` nach dem
 * Kommentar — dieselbe Zuordnung, mit der die Uebernahme gemacht wurde.
 */
const pairs = (): Pair[] => {
  const out: Pair[] = []
  for (const file of catalogs()) {
    const lines = readFileSync(join(LIB, file), 'utf8').split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const m = QUELLE.exec(lines[i])
      if (!m) continue
      let field: string | null = null
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j += 1) {
        if (!TEMPLATE_OPEN.test(lines[j])) continue
        const f = MANUFACTURER.exec(lines[j + 1] ?? '')
        field = f ? f[1] : null
        break
      }
      out.push({ file, line: i + 1, comment: m[1], field })
    }
  }
  return out
}

describe('jeder Quellen-Kommentar steht auch als Feld im Eintrag', () => {
  it('traegt den Beleg an allen Stellen, die einen haben', () => {
    // Der Guard gegen das Auseinanderlaufen: wer die URL im Kommentar
    // aendert und das Feld vergisst (oder umgekehrt), kommt hier vorbei.
    // Genau diese Sorte Drift hat den Kommentar 253-mal zur einzigen
    // Fundstelle gemacht.
    const abweichend = pairs().filter((p) => p.field !== p.comment)
    expect(
      abweichend.map((p) => `${p.file}:${p.line} ${p.comment} != ${p.field}`),
    ).toEqual([])
  })

  it('findet ueberhaupt welche — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waere der Test auch dann gruen, wenn das
    // Muster nicht mehr passt und `pairs()` leer zurueckkommt.
    expect(pairs().length).toBe(253)
  })

  it('deckt die neun Kataloge ab, die Belege fuehren', () => {
    const files = new Set(pairs().map((p) => p.file))
    expect([...files].sort()).toEqual([
      'ajaCatalog.ts',
      'audioCatalog.ts',
      'avNetworkCatalog.ts',
      'broadcastToolsCatalog.ts',
      'lynxCatalog.ts',
      'micCatalog.ts',
      'rossCatalog.ts',
      'switcherCatalog.ts',
      'wirelessAudioCatalog.ts',
    ])
  })
})

describe('der Beleg kommt wirklich beim Geraet an', () => {
  it('loest ueber die Geraetetyp-ID auf den Datenblatt-Link auf', async () => {
    // Der Punkt der ganzen Uebernahme. Ohne diese Pruefung waere der Beleg
    // nur aus einem unerreichbaren Kommentar in ein unerreichbares Feld
    // gewandert: `OptionalFieldsSection` rendert `equipment.manufacturerUrl`,
    // und ein Geraet, das bloss einen Katalog-Typ REFERENZIERT, hat dort
    // nichts stehen. Gemessen, nicht angenommen — der DeviceTypePicker setzt
    // nur `deviceTypeId` und kopiert keine Template-Felder.
    const { resolveDeviceType } = await import('../src/renderer/lib/deviceTypeRegistry')
    const { MIC_CATALOG } = await import('../src/renderer/lib/micCatalog')
    const sm57 = MIC_CATALOG.find((e) => e.template.name === 'Shure SM57')
    expect(sm57).toBeDefined()
    const resolved = resolveDeviceType(sm57!.deviceTypeId)
    expect(resolved?.template.manufacturerUrl).toBe(
      'https://www.shure.com/en-US/microphones/sm57',
    )
  })

  it('zeigt den geerbten Link in der Eigenschaften-Leiste an', async () => {
    // Die zweite Haelfte: die Aufloesung nuetzt nichts, wenn sie niemand
    // anzeigt. Der Quelltext-Guard haelt fest, dass die Leiste auf den
    // Katalog-Typ zurueckfaellt — und dass ein eigener Eintrag am Geraet
    // weiter gewinnt, denn der ist die bewusste Ausnahme.
    const src = (
      await import('../src/renderer/components/Properties/sections/OptionalFieldsSection.tsx?raw')
    ).default
    expect(src).toContain('resolveDeviceType(equipment.deviceTypeId)')
    expect(src).toContain('!equipment.manufacturerUrl && inheritedUrl')
  })
})

describe('was der Test NICHT behauptet', () => {
  it('sagt, wie viele Kataloge weiterhin ohne Beleg dastehen', () => {
    // ADR-005 Regel 3 — melden, wo es passiert. Acht Kataloge fuehren keine
    // Quellen je Eintrag; das ist Schritt 3 der Initiative und echte
    // Recherche, nicht Mechanik. Diese Zahl hier festzuhalten heisst: die
    // Luecke ist bekannt und benannt, nicht uebersehen. Wer einen der acht
    // mit Quellen versieht, laesst diesen Test fallen und traegt ihn oben
    // in die Liste ein.
    const mitBeleg = new Set(pairs().map((p) => p.file))
    const ohne = catalogs().filter((f) => !mitBeleg.has(f))
    expect(ohne.sort()).toEqual([
      'blackmagicCatalog.ts',
      'cameraCatalog.ts',
      'connectorCatalog.ts',
      'greengoCatalog.ts',
      'miscCatalog.ts',
      'monitorCatalog.ts',
      'ubiquitiCatalog.ts',
      'wirelessCatalog.ts',
    ])
  })
})

describe('der Beleg zeigt auf den Hersteller, nicht auf einen Haendler', () => {
  // Gemessen 2026-09-04 ueber alle 253 Belege: **einer** zeigt auf einen
  // Haendler. `audioCatalog.ts` fuehrt die Behringer X32 mit einem bei
  // Markertek liegenden Spec-PDF, waehrend der Eintrag direkt darunter (Wing)
  // auf `behringer.com` zeigt. Dasselbe Feld, derselbe Hersteller, dieselbe
  // Datei — zwei Sorten Quelle.
  //
  // Das Feld heisst `manufacturerUrl` und wird in der Eigenschaften-Leiste als
  // „Hersteller-Link" angeboten. Ein Haendler-Link dort ist kein kleiner
  // Schoenheitsfehler: Haendler-Seiten verschwinden, wenn ein Produkt aus dem
  // Sortiment faellt, und sie sagen dem Nutzer etwas anderes zu, als drauf
  // steht.
  //
  // WAS DIESER TEST NICHT KANN. Ob eine URL erreichbar ist, prueft er nicht —
  // die Hersteller-Domaenen sind aus dieser Umgebung nicht erreichbar
  // (gemessen: `blackmagicdesign.com`, `ui.com` und sogar `lynx-technik.com`,
  // dessen URLs hier bereits im Code stehen, laufen alle in den
  // Egress-Filter). Geprueft wird deshalb, was ohne Netz pruefbar ist: dass
  // die Domaene keinem bekannten Haendler gehoert.
  const HAENDLER = [
    'markertek.com', 'bhphotovideo.com', 'fullcompass.com', 'thomann.de',
    'sweetwater.com', 'newegg.com', 'amazon.com', 'amazon.de', 'ebay.com',
    'adorama.com', 'musicstore.de', 'soundpro.com', 'geartechs.com',
  ]

  /** Die eine bekannte Ausnahme — mit Grund, nicht als stille Duldung. */
  const AUSNAHME = new Map([
    [
      'https://www.markertek.com/Attachments/Specifications/Behringer/X32-Specifications.pdf',
      'Behringer X32: das Spec-PDF liegt bei Markertek. Ersetzt wird es erst ' +
        'durch eine GEPRUEFTE behringer.com-Adresse — eine geratene waere ' +
        'schlimmer als die haendlereigene, die wenigstens nachweislich das ' +
        'Datenblatt zeigt.',
    ],
  ])

  it('nennt jeden Haendler-Link, der nicht als Ausnahme begruendet ist', () => {
    const treffer = pairs()
      .map((p) => p.field)
      .filter((u): u is string => !!u)
      .filter((u) => HAENDLER.some((h) => new URL(u).host.replace(/^www\./, '').endsWith(h)))
      .filter((u) => !AUSNAHME.has(u))
    expect(treffer).toEqual([])
  })

  it('haelt fest, dass die Ausnahme noch gebraucht wird', () => {
    // Wird die X32-URL eines Tages ersetzt, faellt dieser Test — und die
    // Ausnahme oben verschwindet mit ihm, statt als Altlast stehenzubleiben.
    const alle = new Set(pairs().map((p) => p.field))
    for (const url of AUSNAHME.keys()) expect(alle.has(url)).toBe(true)
  })

  it('prueft alle Belege, nicht nur die mit Feld', () => {
    // Ohne diese Zusicherung waere der Haendler-Test auch dann gruen, wenn
    // `pairs()` nichts mehr faende.
    expect(pairs().filter((p) => p.field).length).toBe(253)
  })
})
