import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  PROVENANCE_SUFFIX,
  provenanceFilename,
  provenanceText,
  type DeviceConfigOrigin,
} from '../src/renderer/lib/deviceConfigProvenance'
import { fingerprint, type DocumentStamp } from '../src/renderer/lib/documentStamp'
import { parseVideohubLabelsTxt } from '../src/renderer/lib/exportVideohub'

// ---------------------------------------------------------------------------
// Bedarf 43 (P2) — eine Gerätekonfiguration, die sagt, woher sie kommt.
//
//   > The config the freelancer carries between clients BREAKS ON IMPORT, and
//   > the rebuild happens during load-in in front of the client.
//
// Der teuerste Fehler wäre hier, die Herkunft IN die Gerätedatei zu schreiben:
// eine Datei, die das Pult beim Laden zurückweist, ist beim Load-in schlimmer
// als eine ohne Herkunft. Das Blatt steht deshalb daneben — und diese Prüfung
// hält fest, dass es dabei bleibt.
// ---------------------------------------------------------------------------

const quelle = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const stamp = (over: Partial<DocumentStamp> = {}): DocumentStamp => ({
  project: 'Stadthalle Herbst',
  revision: 'Rev 2',
  drifted: false,
  printedAt: '2026-09-07T09:12:00.000Z',
  fingerprint: '7f3a91cc',
  ...over,
})

const origin = (over: Partial<DeviceConfigOrigin> = {}): DeviceConfigOrigin => ({
  device: 'Blackmagic Videohub',
  what: 'Anschluss-Beschriftungen',
  filename: '20260907_Videohub_001_labels.txt',
  stamp: stamp(),
  app: 'Cable Planner 1.4.2',
  ...over,
})

// ── 1. Die Gerätedatei bleibt unberührt ────────────────────────────────────

describe('die Konfigurationsdatei wird nicht angefasst', () => {
  it('das Blatt steht NEBEN der Datei, nicht in ihr', () => {
    // Der ganze Punkt des Moduls. Was ein fremder Importer an zusätzlichen
    // Zeilen, Feldern oder Kommentaren überliest, steht ohne die
    // Hersteller-Spezifikation nicht fest — und die liegt hier nicht vor.
    expect(provenanceFilename('routing.txt')).toBe('routing.txt.herkunft.txt')
    expect(PROVENANCE_SUFFIX).toBe('.herkunft.txt')
    const q = quelle('../src/renderer/lib/deviceConfigProvenance.ts')
    // Der Inhalt geht unverändert durch: kein Anhängen, kein Voranstellen.
    expect(q).toMatch(/downloadBlob\(origin\.filename, content, mimeType\)/)
    expect(q).not.toMatch(/content \+|\+ content|content\.replace/)
  })

  it('ersetzt die Endung nicht, sondern hängt an', () => {
    // Zwei Konfigurationen desselben Geräts in verschiedenen Formaten bekämen
    // sonst dasselbe Blatt, und eines überschriebe das andere im
    // Download-Ordner.
    expect(provenanceFilename('hub.txt')).not.toBe(provenanceFilename('hub.csv'))
  })

  it('eine echte Videohub-Datei bleibt danach dieselbe', () => {
    // Gegenprobe am eigenen Parser: der Inhalt, den der Export erzeugt, geht
    // unverändert weiter — das Blatt ist nirgends darin gelandet.
    const datei = 'Input, 1, Cam 1\nInput, 2, Cam 2\nOutput, 1, PGM\n'
    const gelesen = parseVideohubLabelsTxt(datei)
    expect(gelesen.inputs[0]).toBe('Cam 1')
    expect(provenanceText(origin(), datei)).not.toContain('Input, 1, Cam 1')
  })
})

// ── 2. Was auf dem Blatt steht ─────────────────────────────────────────────

describe('das Herkunfts-Blatt', () => {
  it('nennt Datei, Gerät, Inhalt und den Plan', () => {
    const t = provenanceText(origin(), 'egal')
    expect(t).toContain('20260907_Videohub_001_labels.txt')
    expect(t).toContain('Blackmagic Videohub')
    expect(t).toContain('Anschluss-Beschriftungen')
    expect(t).toContain('Stadthalle Herbst')
    expect(t).toContain('Cable Planner 1.4.2')
  })

  it('rechnet die Prüfsumme über die KONFIGURATION, nicht über sich selbst', () => {
    // Sonst wäre sie zum Vergleichen wertlos: zwei verschiedene Konfigurationen
    // desselben Plans trügen dieselbe Zahl.
    const a = provenanceText(origin(), 'inhalt A')
    const b = provenanceText(origin(), 'inhalt B')
    expect(a).toContain(`#${fingerprint('inhalt A')}`)
    expect(b).toContain(`#${fingerprint('inhalt B')}`)
    expect(a).not.toBe(b)
  })

  it('sagt, dass der Plan seit der Revision weitergelaufen ist', () => {
    // „Rev 2" allein läse sich als *diese Datei ist Rev 2*. Weicht der Plan
    // ab, sagt das Blatt es hin — dieselbe Regel wie `stampLine`.
    expect(provenanceText(origin(), 'x')).toContain('Rev 2')
    expect(provenanceText(origin(), 'x')).not.toContain('Rev 2 + Änderungen')
    const gewandert = origin({ stamp: stamp({ drifted: true }) })
    expect(provenanceText(gewandert, 'x')).toContain('Rev 2 + Änderungen')
  })

  it('nennt eine fehlende Revision beim Namen', () => {
    // Eine leere Zeile läse sich als „noch nicht ausgefüllt". „Keine Revision
    // festgeschrieben" ist eine Aussage über den Plan.
    const ohne = origin({ stamp: stamp({ revision: undefined }) })
    expect(provenanceText(ohne, 'x')).toContain('keine Revision festgeschrieben')
  })

  it('sagt selbst, warum es nicht in der Datei steht', () => {
    // Wer das Blatt in einem halben Jahr findet, soll den Grund lesen können,
    // statt die Entscheidung für Nachlässigkeit zu halten.
    const t = provenanceText(origin(), 'x')
    expect(t).toContain('neben der Datei steht und nicht in ihr')
    expect(t).toContain('zurückweist')
  })

  it('ist rein — zweimal derselbe Text', () => {
    // Der Zeitpunkt kommt im Stempel herein und wird nicht hier geholt.
    expect(provenanceText(origin(), 'x')).toBe(provenanceText(origin(), 'x'))
    const q = quelle('../src/renderer/lib/deviceConfigProvenance.ts')
    expect(q).not.toMatch(/Date\.now\(\)|new Date\(\)|useProjectStore/)
  })
})

// ── 3. Die Reihenfolge und die Engstelle ───────────────────────────────────

describe('der Weg nach draußen', () => {
  it('gibt das Blatt ZUERST aus', () => {
    // Bricht der Browser die zweite Ausgabe ab, fehlt das Blatt — nicht die
    // Datei, die die Show braucht.
    const q = quelle('../src/renderer/lib/deviceConfigProvenance.ts')
    const blatt = q.indexOf('provenanceFilename(origin.filename)')
    const datei = q.indexOf('downloadBlob(origin.filename, content, mimeType)')
    expect(blatt).toBeGreaterThan(-1)
    expect(datei).toBeGreaterThan(blatt)
  })

  it('jede Gerätekonfiguration geht über dieselbe Stelle', () => {
    // Ein zweiter Weg daneben wäre eine Datei ohne Blatt, und die fällt
    // niemandem auf, bis sie in einem halben Jahr auf einem Laptop liegt.
    const sites: Array<[string, string]> = [
      ['../src/renderer/components/Export/VideohubExportDialog.tsx', 'Kreuzschienen-Routing'],
      ['../src/renderer/components/Export/GreenGoExportDialog.tsx', 'Intercom-Konfiguration'],
      ['../src/renderer/components/Atem/AtemAudioRouterDialog.tsx', 'Audio-Zuordnung'],
      ['../src/renderer/components/Export/ExportDialog.tsx', 'Geräteliste für die Tally-Karte'],
    ]
    for (const [datei, was] of sites) {
      const q = quelle(datei)
      expect(q, datei).toMatch(/exportDeviceConfig\(/)
      expect(q, datei).toContain(was)
    }
  })

  it('die unreine Stelle ist genau eine', () => {
    // Uhr, Store und App-Version stehen in `deviceConfigExport`, damit das
    // Blatt selbst prüfbar bleibt.
    const q = quelle('../src/renderer/lib/deviceConfigExport.ts')
    expect(q).toMatch(/useProjectStore\.getState\(\)\.project/)
    expect(q).toMatch(/stampForPlan\(project, new Date\(\)\)/)
    expect(q).toMatch(/APP_VERSION/)
  })
})
