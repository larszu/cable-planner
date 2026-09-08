import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

// ---------------------------------------------------------------------------
// B-44 Teil 3 — der Umbruch.
//
// Rueckmeldung des Eigentuemers, 2026-09-08: „Und auch nicht alles ist
// responsive."
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE MESSUNG, DIE ZWEIMAL DIE FALSCHE FRAGE STELLTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Der Backlog-Eintrag sagte: „63 feste `max-w-*` und dazu KEINE einzige
// Breakpoint-Fassung im ganzen Renderer." Die Zahl stimmt. Sie misst nur die
// falsche Eigenschaft.
//
// In Tailwind heisst `max-w-2xl` „HOECHSTENS so breit". Zusammen mit
// `w-full` schrumpft das Element auf einem schmalen Geraet sehr wohl — und
// genau das macht `ModalShell` mit jedem Dialog, der ihn benutzt. Ein
// fehlender Breakpoint ist dort KEIN Fehler. 31 der 63 stehen mit `w-full`
// im selben `className`; fuer sie war nie etwas zu tun.
//
// Auch die eine „echte Pixelbreite" (`w-[560px]` in `App.tsx`) war keine:
// sie steht neben `max-w-[92vw]` und schrumpft.
//
// DIE RICHTIGE FRAGE IST NICHT „gibt es eine feste Breite", SONDERN:
// kann breiter Inhalt irgendwohin ausweichen? Dieser Waechter stellt sie —
// und er zaehlt keine Breiten mehr.
// ---------------------------------------------------------------------------

const RENDERER = resolve(__dirname, '..', 'src', 'renderer')

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const voll = join(dir, eintrag)
    return statSync(voll).isDirectory()
      ? dateien(voll)
      : /\.tsx$/.test(eintrag)
        ? [voll]
        : []
  })

const quellen = () =>
  dateien(RENDERER).map((f) => ({
    datei: relative(RENDERER, f).split(sep).join('/'),
    text: readFileSync(f, 'utf8'),
  }))

describe('Breiter Inhalt kann ausweichen', () => {
  it('jede Tabelle hat einen Scrollbereich', () => {
    // Eine breite Tabelle ohne eigenen Scrollbereich schiebt das GANZE Blatt
    // zur Seite: der Dialog wird breiter als das Fenster, und die Knoepfe
    // unten rechts sind nicht mehr erreichbar. Das ist derselbe Fehler wie
    // beim Export-Dialog seinerzeit, nur waagerecht.
    const ohne = quellen()
      .filter((q) => q.text.includes('<table'))
      .filter((q) => !/overflow-x-auto|overflow-auto|overflow-x-scroll/.test(q.text))
      .map((q) => q.datei)
    expect(
      ohne,
      'Diese Dateien zeichnen eine Tabelle, die nirgendwohin ausweichen kann. ' +
        '`block overflow-x-auto` an das <table> — dann scrollt sie in sich ' +
        'selbst, statt das Blatt zu schieben.',
    ).toEqual([])
  })

  it('ein mehrspaltiges Raster mit Eingabefeldern hat einen Umbruchpunkt', () => {
    // Und NUR mit Eingabefeldern: ein `grid-cols-3` aus drei Haekchen darf
    // dreispaltig bleiben, das passt auch schmal. Ein Raster aus drei
    // Eingabefeldern passt nicht — jedes wird dann so schmal, dass man den
    // Inhalt nicht mehr lesen kann.
    //
    // Der Waechter fragt deshalb, WAS im Raster steht, statt Raster zu
    // zaehlen. Die erste Fassung dieses Befundes zaehlte, und sie zaehlte
    // dabei die falsche Eigenschaft (siehe Kopf).
    const ohne = quellen()
      .filter((q) => /(?<![:\w-])grid-cols-[3-9]\b/.test(q.text))
      .filter((q) => /<(input|select|textarea)\b/.test(q.text))
      .filter((q) => !/\b(?:sm|md|lg|xl):grid-cols-/.test(q.text))
      .map((q) => q.datei)
    expect(
      ohne,
      'Diese Dateien stellen Eingabefelder in ein Raster ohne Umbruchpunkt. ' +
        '`grid-cols-1 sm:grid-cols-N` — schmal untereinander, breit wie geplant.',
    ).toEqual([])
  })
})

describe('Was ausdruecklich KEIN Befund ist', () => {
  it('eine feste max-w zusammen mit w-full schrumpft — und das ist in Ordnung', () => {
    // Diese Zusicherung haelt die BEGRUENDUNG fest, warum der Waechter oben
    // keine Breiten zaehlt. Faellt `w-full` aus `ModalShell` heraus, schrumpft
    // kein Dialog mehr — und dann ist die Zahl aus dem Backlog auf einmal
    // doch ein Befund. Der Waechter merkt es.
    const shell = readFileSync(
      join(RENDERER, 'components', 'shared', 'ModalShell.tsx'),
      'utf8',
    )
    const panel = shell
      .split('\n')
      .find((z) => z.includes('cp-modal-panel'))
    expect(panel, 'ModalShell hat kein Panel mehr?').toBeTruthy()
    expect(
      panel,
      'Das Dialog-Panel braucht `w-full` neben seiner max-w — sonst schrumpft ' +
        'kein Dialog mehr, und jede feste Breite im Repo wird zum Befund.',
    ).toContain('w-full')
    expect(panel).toMatch(/MAX_WIDTH_CLASS\[/)
  })
})
