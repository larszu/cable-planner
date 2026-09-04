import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

// ---------------------------------------------------------------------------
// Initiative 10 — von der Praxis zur REGEL.
//
// WAS VORHER FEHLTE. `cable#647` hat die drei Stellen geheilt, an denen ein
// Geraete-Befund still zur Absicht wurde, und `tests/atemLiveCompare.test.ts`
// nennt sie namentlich. Genau das war der Rest, den die Neu-Ableitung
// benannt hat: die Invariante galt an drei geprueften Stellen — eine VIERTE
// waere ohne Zwang durchgekommen, weil ein Guard, der Dateien beim Namen
// nennt, keine neue findet.
//
// WIE DIE LUECKE GEMESSEN WURDE — UND WAS DABEI SCHIEFGING. Beim Zaehlen der
// Schnittmenge „liest ein Geraet UND schreibt in den Projekt-Store" ergab ein
// ad-hoc-grep DREI Dateien, und das waren zufaellig genau die drei geheilten.
// Ein bequemes Ergebnis — und falsch: das Muster suchte nach
// `updateEquipment` und ein paar Setter-Namen und uebersah damit
// `applyNetboxImport`. Die richtige Zahl ist VIER.
//
// Das ist der Fehler, den dieser Test verhindert, einmal am eigenen Leib
// vorgefuehrt: ein Muster, das die Stellen erraet, uebersieht die, an die
// niemand gedacht hat. Deshalb faengt der Test hier BEWUSST ZU BREIT — jede
// Datei, die ein Geraet liest und den Projekt-Store ueberhaupt anfasst, muss
// eingetragen sein, auch wenn sie nur liest. Eine Datei zu viel einzuordnen
// kostet zwei Zeilen; eine zu wenig kostet den Fehler.
//
// WAS DIE EINORDNUNG VERLANGT. Nicht „ist das ok?", sondern die konkrete
// Frage: WO landet der abgelesene Wert? Wer eine neue Datei hier eintraegt,
// muss sie beantwortet haben.
// ---------------------------------------------------------------------------

const RENDERER = resolve(__dirname, '..', 'src', 'renderer')

/**
 * Ein Aufruf gegen ein Geraet oder ein Fremdsystem.
 *
 * WARUM OHNE VERBEN-LISTE (nachgemessen 2026-09-04). Hier stand
 * `\.(read|get)[A-Za-z]*` — und das widersprach der Ansage des Kommentars
 * oben, der Test fange „BEWUSST ZU BREIT". Er fing zu eng: die echten
 * Lesewege heissen auch `atem.discover`, `videohub.discover`, `atem.onEvent`
 * und `netbox.fetchSnapshot`, und keiner davon faengt mit `read` oder `get`
 * an.
 *
 * Gemessen: die enge Fassung traf 7 von 8 Dateien mit solchen Aufrufen — und
 * die vier oben genannten Wege fielen nur deshalb nicht durchs Raster, weil
 * dieselben Dateien ZUFAELLIG auch ein `getState`/`readState` enthalten. Der
 * Guard hielt also, aber nicht durch Konstruktion. Wer `videohub.discover` in
 * eine neue Datei schreibt, faellt heute durch.
 *
 * Deshalb jetzt jedes Verb. Eine Datei zu viel einzuordnen kostet zwei
 * Zeilen — genau das sagt der Kommentar oben, und jetzt tut der Regex es auch.
 */
const READS_DEVICE = /cablePlannerApi\.(atem|videohub|netbox|rentman)\.[A-Za-z]/

/**
 * Beruehrt den Projekt-Store ueberhaupt. Absichtlich das grobe Kriterium:
 * eine feinere Unterscheidung zwischen Lesen und Schreiben ist genau die
 * Stelle, an der die Messung oben danebengegriffen hat.
 *
 * `useCanvasProjectStore` steht seit 2026-09-04 mit drin. Nachgemessen aendert
 * das HEUTE nichts — beide Fassungen treffen dieselben 131 Dateien —, weil der
 * Importpfad `store/projectStoreContext` die Zeichenkette `projectStore`
 * ohnehin enthaelt. Genau das ist der Grund, es hinzuschreiben: der Guard hing
 * an der Schreibweise eines Importpfades, nicht am Bezeichner. Wer den Kontext
 * einmal aus einem anders benannten Modul re-exportiert, faellt sonst durch,
 * und niemand merkt es — die Zahl 131 sagt nichts darueber, ob die 132. Datei
 * gefunden wird.
 */
const TOUCHES_PLAN = /useProjectStore|useCanvasProjectStore|projectStore|ProjectStore/

type Verdict =
  /** Befund und Absicht sind getrennt: der gelesene Wert landet NICHT im Plan. */
  | 'getrennt'
  /** Schreibt in den Plan, aber nur additiv — ersetzt keinen geplanten Wert. */
  | 'additiv'
  /** Liest den Store nur, schreibt nicht hinein. */
  | 'liest-nur'

interface Site {
  file: string
  verdict: Verdict
  /** Warum. Muss den naechsten Leser ueberzeugen, nicht den Autor. */
  reason: string
}

const CLASSIFIED: Site[] = [
  {
    file: 'components/Atem/AtemAudioRouterDialog.tsx',
    verdict: 'getrennt',
    reason:
      'cable#647: der Befund liegt in `live`, der Entwurf bleibt der Entwurf. ' +
      'Vorher mischte `setDraft({ matrix: live.matrix ?? draft?.matrix })` beides ' +
      'ohne Rueckfrage zusammen. Die Uebernahme ist jetzt ein eigener Klick.',
  },
  {
    file: 'components/Atem/AtemMvConfigDialog.tsx',
    verdict: 'getrennt',
    reason:
      'cable#647: der Befund liegt in `live`. Vorher ersetzte `setConfig(...)` die ' +
      'geplante Fensteraufteilung; die Rueckfrage davor griff nur bei ' +
      '`sourceId !== 0` und liess einen schwarz geplanten Multiviewer fallen.',
  },
  {
    file: 'components/Export/VideohubExportDialog.tsx',
    verdict: 'getrennt',
    reason:
      'ADR-003 Inkrement 0: der Status-Read geht nach `hubState`, das geplante ' +
      'Routing bleibt stehen. Die Datei begruendet es selbst — „Was der Hub tut, ' +
      'ist eine Beobachtung; was im Plan steht, eine Absicht."',
  },
  {
    file: 'components/Netbox/NetboxImportDialog.tsx',
    verdict: 'additiv',
    reason:
      '`applyNetboxImport` ist additiv per Konstruktion und sagt es im Slice: ' +
      '„nur angehaengt und ergaenzt, nie ersetzt oder geloescht". Vorhandene ' +
      'Geraete behalten jede manuelle Nacharbeit. Dass dabei `portsUnknown` ' +
      'faellt, ist richtig: es fiel, WEIL echte Ports gelesen wurden — genau ' +
      'die Bedingung, unter der die Unbekannt-Markierung nicht mehr gilt.',
  },
  {
    file: 'components/Settings/tabs/IntegrationsTab.tsx',
    verdict: 'getrennt',
    reason:
      'Kam mit dem breiteren Muster dazu (2026-09-04) und war vorher unsichtbar. ' +
      'Die Datei ruft ausschliesslich Token-Verwaltung auf — hasToken, saveToken, ' +
      'deleteToken, normalizeUrl, testConnection. Kein einziger dieser Aufrufe ' +
      'liefert einen Geraetewert, und keiner davon beruehrt den Plan: das ' +
      'Ergebnis von testConnection landet in lokalem useState und wird als ' +
      'Statuszeile angezeigt. Sie steht trotzdem hier, weil der Test bewusst zu ' +
      'breit faengt — und weil genau diese Datei belegt, dass er es vorher nicht ' +
      'tat.',
  },
  {
    file: 'components/Atem/AtemDialog.tsx',
    verdict: 'liest-nur',
    reason:
      'Ein einziger Selektor holt das Geraet fuer die IP-Vorbelegung. Der ' +
      'gelesene ATEM-State bleibt in lokalem `useState` und wird nie ' +
      'persistiert. Steht hier, weil der Test bewusst zu breit faengt.',
  },
]

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory()
      ? walk(full)
      : /\.tsx?$/.test(entry)
        ? [full]
        : []
  })

/** Die Schnittmenge, aus dem Quelltext gerechnet — nicht aus einer Liste. */
const measured = (): string[] =>
  walk(RENDERER)
    .filter((f) => {
      const src = readFileSync(f, 'utf8')
      return READS_DEVICE.test(src) && TOUCHES_PLAN.test(src)
    })
    .map((f) => relative(RENDERER, f).split(sep).join('/'))
    .sort()

describe('jede Stelle, die ein Geraet liest und den Plan beruehrt, ist eingeordnet', () => {
  it('kennt genau die gemessenen Dateien — keine mehr, keine weniger', () => {
    // Der eigentliche Zwang. Eine neue Datei in der Schnittmenge laesst diesen
    // Test fallen, und wer sie eintraegt, muss dabei sagen, wo der abgelesene
    // Wert landet. Das ist der Unterschied zwischen einer Regel und einer
    // Gewohnheit.
    expect(measured()).toEqual(CLASSIFIED.map((s) => s.file).sort())
  })

  it('gibt zu jeder Einordnung eine Begruendung, die etwas behauptet', () => {
    for (const site of CLASSIFIED) {
      expect(site.reason.length, site.file).toBeGreaterThan(80)
    }
  })

  it('ordnet keine Datei doppelt ein', () => {
    const files = CLASSIFIED.map((s) => s.file)
    expect(new Set(files).size).toBe(files.length)
  })
})

describe('die Messung selbst', () => {
  it('findet die Datei, die das ad-hoc-Muster uebersehen hat', () => {
    // Die Gegenprobe zum Fehler oben: `NetboxImportDialog` schreibt ueber
    // `applyNetboxImport` in den Plan, nicht ueber `updateEquipment`. Ein
    // Guard, der nach Setter-Namen sucht, uebersieht ihn — dieser hier nicht.
    expect(measured()).toContain('components/Netbox/NetboxImportDialog.tsx')
    const src = readFileSync(
      join(RENDERER, 'components', 'Netbox', 'NetboxImportDialog.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/updateEquipment/)
    expect(src).toMatch(/applyNetboxImport/)
  })

  it('faengt weit genug, um eine reine Lese-Stelle mitzunehmen', () => {
    // Wenn diese Zusicherung faellt, ist das Kriterium enger geworden — und
    // damit wieder eine Liste, die raet, statt einer, die misst.
    expect(measured()).toContain('components/Atem/AtemDialog.tsx')
  })

  it('nimmt eine Datei ohne Plan-Bezug NICHT mit', () => {
    // `MultiviewerLayoutView` liest den ATEM und fasst den Store nicht an;
    // sie gehoert nicht in die Liste und darf sie nicht aufblaehen.
    expect(measured()).not.toContain('components/Atem/MultiviewerLayoutView.tsx')
  })
})
