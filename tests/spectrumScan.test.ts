import { describe, expect, it } from 'vitest'
import {
  SCAN_FINDING_LABEL,
  carrierCheckTable,
  checkCarriers,
  parseNumber,
  FREQ_ALIASES,
  LEVEL_ALIASES,
  parseScanCsv,
  peakNear,
  scanFindings,
  scanTable,
  scannedRange,
  toMhz,
} from '../src/renderer/lib/spectrumScan'
import { DEFAULT_OCCUPIED_DBM, VERDICT_LABEL } from '../src/renderer/types/spectrumScan'
import type { SpectrumEntry } from '../src/renderer/lib/spectrumPlan'
import { undescribedColumns } from '../src/renderer/lib/dataDictionary'
import typenQuelle from '../src/renderer/types/spectrumScan.ts?raw'
import libQuelle from '../src/renderer/lib/spectrumScan.ts?raw'
import planQuelle from '../src/renderer/lib/spectrumPlan.ts?raw'
import dialogQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Der Scan vor Ort, gegen den Plan gehalten (Bedarf 112, P3).
//
//   > Cheap analysers (tinySA, RF Explorer) are widely used for site scans,
//   > but their CSV is not readable by any coordination software, so engineers
//   > run CONVERSION SCRIPTS ON THE CRITICAL PATH OF LOAD-IN.
//
// Belegt an `erikkaashoek/tinySA#88`. Gebaut ist die LESE-Seite und der
// Abgleich; die vier Hersteller-Formate sind NICHT gebaut, weil fuer keines
// ein Schema im Korpus vorliegt — dieselbe Entscheidung wie beim
// Dante-Preset-XML (Bedarf 94).
// ---------------------------------------------------------------------------

const entry = (id: string, mhz: number, label = `Kanal ${id}`): SpectrumEntry => ({
  id,
  label,
  mhz,
  source: 'rig',
})

// ── 1. Die Datei lesen ─────────────────────────────────────────────────────

describe('parseScanCsv', () => {
  it('liest eine Datei mit Ueberschrift und Komma', () => {
    const s = parseScanCsv('Frequency,Level\n500.0,-95\n500.1,-42\n')
    expect(s.points).toEqual([
      { mhz: 500.0, dbm: -95 },
      { mhz: 500.1, dbm: -42 },
    ])
    expect(s.unreadable).toBe(0)
  })

  it('liest Semikolon und Tabulator genauso', () => {
    expect(parseScanCsv('Frequenz;Pegel\n500,0;-95\n').points).toEqual([{ mhz: 500, dbm: -95 }])
    expect(parseScanCsv('Frequency\tLevel\n500\t-95\n').points).toEqual([{ mhz: 500, dbm: -95 }])
  })

  it('nimmt die EINHEIT aus der Ueberschrift und raet sie nicht an der Groesse', () => {
    // Eine Datei mit „500000000" in MHz gelesen waere eine halbe Milliarde
    // MHz. Der gefaehrliche Fall ist aber der GHz-Scan, dessen Zahlen in
    // beiden Einheiten plausibel aussehen — deshalb entscheidet die
    // Ueberschrift.
    expect(parseScanCsv('Frequency (Hz),Level\n500000000,-95\n').points[0].mhz).toBe(500)
    expect(parseScanCsv('Frequency (kHz),Level\n500000,-95\n').points[0].mhz).toBe(500)
    expect(parseScanCsv('Frequency (GHz),Level\n0.5,-95\n').points[0].mhz).toBe(500)
    expect(parseScanCsv('Frequency (MHz),Level\n500,-95\n').points[0].mhz).toBe(500)
    // Der Fall, an dem sich Ueberschrift und Groessen-Raterei trennen: eine
    // Hz-Datei mit einem KLEINEN Wert. Wer an der Groesse raet, liest 500 MHz;
    // die Ueberschrift sagt 500 Hz.
    expect(parseScanCsv('Frequency (Hz),Level\n500,-95\n').points[0].mhz).toBe(0.0005)
    // Und andersherum: ein 2-GHz-Scan mit kHz-Ueberschrift. Wer an der Groesse
    // raet, macht daraus 2 MHz statt 2000 — beides gueltige Zahlen, und die
    // falsche faellt erst auf, wenn der Abgleich jeden Traeger als
    // „nicht gemessen“ meldet.
    expect(parseScanCsv('Frequency (kHz),Level\n2000000,-95\n').points[0].mhz).toBe(2000)
  })

  it('liest eine Datei ganz OHNE Ueberschrift als Zahlenpaare in MHz', () => {
    // tinySA schreibt in der schlanken Einstellung nur Paare.
    const s = parseScanCsv('500.0,-95\n500.1,-42\n')
    expect(s.points).toHaveLength(2)
    expect(s.points[0].mhz).toBe(500)
  })

  it('zaehlt unlesbare Zeilen, statt sie zu verschweigen', () => {
    // Eine Messung, von der die Haelfte stillschweigend wegfiel, sieht aus
    // wie ein leeres Band.
    const s = parseScanCsv('Frequency,Level\n500,-95\nkaputt,-42\n500.2,\n')
    expect(s.points).toHaveLength(1)
    expect(s.unreadable).toBe(2)
  })

  it('gibt bei einer Ueberschrift ohne die beiden Spalten NICHTS aus', () => {
    // Und zaehlt jede Datenzeile als unlesbar: „0 Punkte, 0 verworfen" saehe
    // aus wie ein leeres Band.
    const s = parseScanCsv('Zeit;Temperatur\n10:00;21\n10:01;22\n')
    expect(s.points).toEqual([])
    expect(s.unreadable).toBe(2)
  })

  it('findet die Spalten auch mit Einheit in Klammern', () => {
    // Analyser schreiben „Frequency (Hz)". Eine Normalisierung, die die
    // Klammern stehen laesst, findet die Spalte nicht — und die Datei gilt
    // als unlesbar, obwohl sie mustergueltig ist.
    const s = parseScanCsv('Frequency (kHz);Level (dBm)\n500000;-95\n')
    expect(s.points).toEqual([{ mhz: 500, dbm: -95 }])
    expect(s.unreadable).toBe(0)
  })

  it('findet auch eine Ueberschrift, die NUR aus der Einheit besteht', () => {
    // Analyser schreiben ihre Spalten auch als „(MHz)" und „(dBm)". Ohne
    // Klammer-Normalisierung faende der Leser sie nicht — und die Datei
    // gaelte als unlesbar, obwohl sie mustergueltig ist.
    const s = parseScanCsv('(MHz);(dBm)\n500;-95\n')
    expect(s.points).toEqual([{ mhz: 500, dbm: -95 }])
  })

  it('findet die Spalten ueber die UEBERSCHRIFT, nicht ueber die Position', () => {
    // Eine Datei mit vertauschten Spalten ist dieselbe Datei. Positionsfest
    // gelesen waere daraus ein Scan bei -95 MHz mit 500 dBm geworden — beides
    // gueltige Zahlen, die in keiner Pruefung auffallen.
    const s = parseScanCsv('Level;Frequency\n-95;500\n')
    expect(s.points).toEqual([{ mhz: 500, dbm: -95 }])
  })

  it('gibt bei nur EINER erkannten Spalte nichts aus', () => {
    const s = parseScanCsv('MHz\n500\n')
    expect(s.points).toEqual([])
    expect(s.unreadable).toBe(1)
  })

  it('haelt die beiden Alias-Listen disjunkt', () => {
    // DIE Bedingung, die den Schutz „nicht dieselbe Spalte" ueberfluessig
    // macht: keine Ueberschrift kann beide Listen treffen, weil keine der
    // einen Praefix einer der anderen ist. Faellt das, muss der Schutz zurueck
    // — und dieser Test sagt es dann.
    const treffer = (h: string, list: readonly string[]) =>
      list.some((a) => h === a || h.startsWith(a))
    for (const f of FREQ_ALIASES) {
      expect(treffer(f, LEVEL_ALIASES), `${f} trifft auch die Pegel-Liste`).toBe(false)
    }
    for (const l of LEVEL_ALIASES) {
      expect(treffer(l, FREQ_ALIASES), `${l} trifft auch die Frequenz-Liste`).toBe(false)
    }
  })

  it('sortiert die Punkte aufsteigend', () => {
    const s = parseScanCsv('Frequency,Level\n500.2,-95\n500.0,-42\n')
    expect(s.points.map((p) => p.mhz)).toEqual([500.0, 500.2])
  })

  it('haelt den Dateinamen fest, wenn es einen gibt', () => {
    expect(parseScanCsv('Frequency,Level\n500,-95\n', 'scan.csv').fileName).toBe('scan.csv')
    expect('fileName' in parseScanCsv('Frequency,Level\n500,-95\n')).toBe(false)
  })
})

describe('parseNumber', () => {
  it('liest deutsches und englisches Dezimaltrennzeichen', () => {
    expect(parseNumber('500,5')).toBe(500.5)
    expect(parseNumber('500.5')).toBe(500.5)
    expect(parseNumber('1.234,5')).toBe(1234.5)
    expect(parseNumber('1,234.5')).toBe(1234.5)
  })

  it('liefert null statt NaN', () => {
    // Ein NaN rechnet in jedem Vergleich falsch, ohne je aufzufallen.
    expect(parseNumber('kaputt')).toBeNull()
    expect(parseNumber('')).toBeNull()
    expect(parseNumber(undefined)).toBeNull()
  })
})

describe('toMhz', () => {
  it('rechnet nach der Ueberschrift', () => {
    expect(toMhz(500_000_000, 'frequencyhz')).toBe(500)
    expect(toMhz(500_000, 'freqkhz')).toBe(500)
    expect(toMhz(0.5, 'fghz')).toBe(500)
    expect(toMhz(500, 'mhz')).toBe(500)
    expect(toMhz(500, 'frequency')).toBe(500)
  })

  it('verwechselt mhz/khz/ghz nicht mit dem blossen „hz"', () => {
    // „mhz" enthaelt „hz" — eine Pruefung in der falschen Reihenfolge machte
    // aus 500 MHz 0,0005 MHz.
    expect(toMhz(500, 'mhz')).toBe(500)
    expect(toMhz(500, 'khz')).toBe(0.5)
  })
})

// ── 2. Die gemessene Spanne ────────────────────────────────────────────────

describe('scannedRange', () => {
  it('nennt Anfang und Ende', () => {
    const s = parseScanCsv('Frequency,Level\n470,-95\n608,-90\n')
    expect(scannedRange(s)).toEqual({ fromMhz: 470, toMhz: 608 })
  })

  it('sagt null bei leerem Scan statt „0 bis 0"', () => {
    expect(scannedRange({ points: [], unreadable: 0 })).toBeNull()
  })
})

describe('peakNear', () => {
  const s = parseScanCsv('Frequency,Level\n502.3,-95\n502.4,-40\n502.5,-88\n')

  it('findet die Spitze im Fenster', () => {
    // Ein Scan ist diskret: er hat keinen Punkt bei genau 502,375. Ohne
    // Fenster faende eine Traegerpruefung nie einen Messpunkt.
    expect(peakNear(s, 502.375, 0.1)).toBe(-40)
  })

  it('sagt null ausserhalb des gemessenen Bereichs', () => {
    expect(peakNear(s, 614, 0.1)).toBeNull()
    // Und genauso in einer LUECKE innerhalb des Bereichs: beides heisst „hier
    // ist nicht gemessen worden", und beides ergibt sich aus derselben
    // Schleife. Ein eigener Bereichs-Check waere eine zweite Definition
    // desselben Begriffs.
    const mitLuecke = parseScanCsv('Frequency,Level\n500,-95\n560,-90\n')
    expect(peakNear(mitLuecke, 530, 0.1)).toBeNull()
  })

  it('laesst das Fenster ueber den Rand hinausreichen', () => {
    // Ein Traeger 0,05 MHz neben dem letzten Messpunkt ist gemessen — der
    // Scan endet nicht mitten in der Luft.
    expect(peakNear(s, 502.55, 0.1)).toBe(-88)
  })
})

// ── 3. Drei Urteile, und das dritte ist der Punkt ──────────────────────────

describe('checkCarriers', () => {
  const s = parseScanCsv('Frequency,Level\n500,-95\n502.4,-40\n505,-92\n')

  it('nennt einen gemessenen freien Traeger frei', () => {
    expect(checkCarriers(s, [entry('a', 500)])[0].verdict).toBe('clear')
  })

  it('nennt einen Traeger auf gemessener Energie belegt', () => {
    const c = checkCarriers(s, [entry('b', 502.4)])[0]
    expect(c.verdict).toBe('occupied')
    expect(c.peakDbm).toBe(-40)
  })

  it('sagt „nicht gemessen" statt „frei", wo der Scan nicht hinreicht', () => {
    // DIE Regel dieses Moduls. Ein Scan von 500–505 MHz sagt ueber 614 MHz
    // gar nichts, und das ist keine Entwarnung.
    const c = checkCarriers(s, [entry('c', 614)])[0]
    expect(c.verdict).toBe('not-scanned')
    expect(c.peakDbm).toBeUndefined()
    expect(VERDICT_LABEL['not-scanned']).not.toContain('frei')
  })

  it('folgt der eingestellten Schwelle', () => {
    // Was „belegt" heisst, haengt an Antenne, Vorverstaerker und Abstand —
    // keine dieser Angaben steht in der Datei.
    expect(checkCarriers(s, [entry('a', 500)], -100)[0].verdict).toBe('occupied')
    expect(checkCarriers(s, [entry('b', 502.4)], -20)[0].verdict).toBe('clear')
  })

  it('nimmt die Voreinstellung, wenn keine Schwelle kommt', () => {
    expect(DEFAULT_OCCUPIED_DBM).toBe(-70)
    expect(checkCarriers(s, [entry('b', 502.4)])[0].verdict).toBe('occupied')
  })
})

// ── 4. Befunde ─────────────────────────────────────────────────────────────

describe('scanFindings', () => {
  const s = parseScanCsv('Frequency,Level\n500,-95\n502.4,-40\n505,-92\n')

  it('meldet Traeger auf gemessener Energie mit Namen und Frequenz', () => {
    const c = checkCarriers(s, [entry('b', 502.4, 'Lead Vox')])
    const f = scanFindings(s, c).find((x) => x.kind === 'carrier-occupied')
    expect(f?.text).toContain('Lead Vox')
    expect(f?.text).toContain('502.4')
    expect(f?.entryIds).toEqual(['b'])
  })

  it('meldet Traeger ausserhalb der Messung MIT der Spanne', () => {
    const c = checkCarriers(s, [entry('c', 614)])
    const f = scanFindings(s, c).find((x) => x.kind === 'outside-scan')
    expect(f?.text).toContain('500')
    expect(f?.text).toContain('505')
    expect(f?.text).toContain(VERDICT_LABEL['not-scanned'])
  })

  it('meldet eine Datei, aus der nichts lesbar war — und nichts sonst', () => {
    const leer = parseScanCsv('Zeit;Temperatur\n10:00;21\n')
    const f = scanFindings(leer, checkCarriers(leer, [entry('a', 500)]))
    expect(f.map((x) => x.kind)).toEqual(['nothing-readable'])
    expect(f[0].text).toContain(VERDICT_LABEL['not-scanned'])
  })

  it('meldet eine halb gelesene Datei', () => {
    const halb = parseScanCsv('Frequency,Level\n500,-95\nkaputt,-42\n')
    expect(scanFindings(halb, []).map((x) => x.kind)).toContain('partial-read')
  })

  it('schweigt bei sauberer Datei und freien Traegern', () => {
    expect(scanFindings(s, checkCarriers(s, [entry('a', 500)]))).toEqual([])
  })

  it('haelt fuer jede Befundart eine lesbare Ueberschrift bereit', () => {
    for (const k of ['carrier-occupied', 'outside-scan', 'nothing-readable', 'partial-read'] as const) {
      expect(SCAN_FINDING_LABEL[k].length).toBeGreaterThan(10)
    }
  })
})

// ── 5. Die Blätter ─────────────────────────────────────────────────────────

describe('die Blaetter', () => {
  const s = parseScanCsv('Frequency,Level\n502.4,-40\n')

  it('nennt Urteil und Spitzenpegel', () => {
    const t = carrierCheckTable(checkCarriers(s, [entry('b', 502.4, 'Lead Vox')]))
    expect(t.headers).toEqual([
      'Was funkt',
      'Quelle',
      'Frequenz (MHz)',
      'Urteil',
      'Spitzenpegel (dBm)',
    ])
    expect(t.rows[0][3]).toBe(VERDICT_LABEL.occupied)
    expect(t.rows[0][4]).toBe(-40)
  })

  it('schreibt „nicht gemessen" in die Pegel-Spalte statt einer leeren Zelle', () => {
    const t = carrierCheckTable(checkCarriers(s, [entry('c', 614)]))
    expect(t.rows[0][4]).toBe(VERDICT_LABEL['not-scanned'])
  })

  it('gibt die Messpunkte selbst aus', () => {
    const t = scanTable(s)
    expect(t.headers).toEqual(['Frequenz (MHz)', 'Pegel (dBm)'])
    expect(t.rows[0]).toEqual([502.4, -40])
  })

  it('hat fuer jede Spalte einen Lexikon-Eintrag', () => {
    expect(undescribedColumns(carrierCheckTable([]).headers)).toEqual([])
    expect(undescribedColumns(scanTable(s).headers)).toEqual([])
  })
})

// ── 6. Ein Scan ist kein Sender ────────────────────────────────────────────

describe('die Grenze', () => {
  it('geht NICHT als Quelle in den Spektrum-Plan ein', () => {
    // Was dort steht, sind Traeger, aus denen Intermodulation gerechnet wird.
    // Eine Messung ist ein Pegelverlauf, dessen Spitzen auch eine Reflexion
    // sein koennen — sie als Sender einzuspeisen erzeugte IM3 aus Rauschen.
    expect(planQuelle).not.toContain('spectrumScan')
    expect(planQuelle).not.toContain("'scan'")
    expect(typenQuelle).toContain('IM3-Produkte aus Rauschen')
  })

  it('baut KEIN Hersteller-Format nach', () => {
    // Fuer keines der vier liegt ein Schema im Korpus vor. Ein Exporter nach
    // Vermutung saehe aus, als koennte er es.
    for (const name of ['wwb', 'wsm', 'ias', 'wirelessmanager']) {
      expect(libQuelle.toLowerCase()).not.toContain(`export function ${name}`)
    }
    expect(typenQuelle).toContain('Korpus ein Schema vor')
  })

  it('bleibt rein', () => {
    expect(libQuelle).not.toContain('Date.now')
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useProjectStore')
    expect(libQuelle).not.toContain('fetch(')
  })
})

// ── 7. Erreichbar ──────────────────────────────────────────────────────────

describe('der RF-Reiter', () => {
  it('liest den Scan ein und leert das Dateifeld', () => {
    // Sonst laesst sich dieselbe Datei nicht zweimal waehlen — und nach einem
    // zweiten Scan heisst sie oft gleich.
    expect(dialogQuelle).toContain('parseScanCsv(text, f.name)')
    // Verankert am Scan-Leser und NICHT an `accept="…"`: der Dante-Import
    // (Bedarf 94) steht im selben Dialog mit demselben `accept`, und eine
    // Suche darauf fand seine Zeile noch, nachdem diese hier weg war.
    const scanBlock = dialogQuelle.slice(
      dialogQuelle.indexOf("t('scan.import'"),
      dialogQuelle.indexOf('parseScanCsv(text, f.name)'),
    )
    expect(scanBlock).toContain("e.target.value = ''")
  })

  it('macht die Schwelle einstellbar statt sie festzuschreiben', () => {
    expect(dialogQuelle).toContain('setSchwelle(Number(e.target.value))')
    expect(dialogQuelle).toContain('scan.thresholdHint')
  })

  it('zeigt die gemessene Spanne neben der Punktzahl', () => {
    // Ohne sie liest jemand „nicht gemessen" und weiss nicht, wo die Messung
    // aufhoert.
    expect(dialogQuelle).toContain('scanSpanne.fromMhz')
    expect(dialogQuelle).toContain('scanSpanne.toMhz')
  })

  it('speist den Scan nicht in den Spektrum-Plan ein', () => {
    expect(dialogQuelle).toContain('checkCarriers(scan, spectrum.entries, schwelle)')
    expect(dialogQuelle).not.toMatch(/buildSpectrumPlan\([^)]*scan/)
  })
})
