import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { istNochRuhig } from '../src/renderer/hooks/useLongPress'

// `?raw` liefert bei einer CSS-Datei im Test-Lauf einen leeren String —
// die Datei geht durch die Stil-Pipeline. Also direkt lesen.
//
// UND OHNE KOMMENTARE. Die erste Fassung prueft die Datei mitsamt ihrer
// Erklaerung — und die Erklaerung ueber der Klasse nennt `@media (pointer:
// coarse)` woertlich. Die Gegenprobe (Regel entfernen) blieb deshalb GRUEN:
// der Waechter fand seinen eigenen Kommentar. Eine Zusicherung, die den Text
// prueft statt der Regel, ist keine.
const cssSrc = readFileSync(
  resolve(__dirname, '..', 'src', 'renderer', 'index.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '')

// ---------------------------------------------------------------------------
// B-44 Teil 2 — eine Funktion ohne Touch-Weg ist auf einem Tablet nicht
// vorhanden.
//
// Rueckmeldung des Eigentuemers, 2026-09-08: „Die ganze Anwendung ist auch
// noch nicht touch optimiert."
//
// GEMESSEN, bevor gebaut wurde:
//   • DREI Bedienreihen standen auf `opacity-0` und wurden nur durch
//     `group-hover` sichtbar — Bibliotheks-Eintrag, Rack-Karte, Gruppen-Karte.
//     Dort sitzen „Bearbeiten" und „Loeschen".
//   • DREI Funktionen hingen ausschliesslich am Rechtsklick — Kabel-Wegpunkt,
//     Ebenen-Chip, Seitenverweis-Knoten.
//   • NULL Ersatz: kein `onTouchStart`, kein Zeiger-Ereignis, kein langer
//     Druck. Nirgends.
//
// Das ist keine Frage der Bequemlichkeit. Wer ein Tablet benutzt, hat diese
// sechs Funktionen schlicht nicht.
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

describe('Was nur beim Darueberfahren erscheint, erscheint auf Touch trotzdem', () => {
  it('kein Bedienelement versteckt sich hinter `group-hover:opacity-100`', () => {
    // Die Regel liegt in `index.css` als `.cp-hover-actions` — dort steht die
    // `@media (pointer: coarse)`-Ausnahme, und dort gehoert sie hin: sie ist
    // eine Regel und keine Gestaltung einer einzelnen Karte.
    const funde = quellen()
      .filter((q) => q.text.includes('opacity-0') && q.text.includes('group-hover:opacity-100'))
      .map((q) => q.datei)
    expect(
      funde,
      'Diese Dateien blenden Bedienelemente per Hover ein. Auf einem Zeigegeraet ' +
        'ohne Hover sind sie damit nicht vorhanden. `cp-hover-actions` benutzen — ' +
        'die Klasse macht sie unter `pointer: coarse` sichtbar.',
    ).toEqual([])
  })

  it('die Klasse gibt es, und sie kennt den groben Zeiger', () => {
    // Ohne diese beiden Zeilen waere die Regel oben eine Umbenennung: die
    // Elemente blieben unsichtbar, nur mit anderem Klassennamen.
    expect(cssSrc).toMatch(/\.cp-hover-actions\s*\{/)
    expect(cssSrc).toMatch(/@media \(pointer: coarse\)/)
    const block = cssSrc.slice(cssSrc.indexOf('@media (pointer: coarse)'))
    expect(block).toMatch(/cp-hover-actions/)
    expect(block).toMatch(/opacity:\s*1/)
  })

  it('und die Tastatur kommt weiterhin hin', () => {
    // `:focus-within` muss bleiben: wer sich mit Tab hineinbewegt, saehe
    // sonst nichts — dieselbe Luecke, nur fuer eine andere Bedienart.
    expect(cssSrc).toMatch(/focus-within .cp-hover-actions|\.cp-hover-actions:focus-within/)
  })
})

describe('Was am Rechtsklick haengt, haengt nicht nur daran', () => {
  /**
   * Die eine Stelle, die den langen Druck NICHT bekommt — mit Grund.
   *
   * Am Kabel-Wegpunkt sitzt auf demselben `pointerdown` bereits das ZIEHEN.
   * Ein langer Druck daneben hiesse: wer den Punkt anfasst und einen Moment
   * zoegert, bevor er zieht, hat ihn geloescht. Das ist ein zerstoerender
   * Fehlgriff, und er waere haeufig.
   *
   * Der Weg dorthin ist deshalb ein anderer und noch offen (B-44): auf einem
   * groben Zeiger ein sichtbarer kleiner Loeschgriff am Punkt, statt einer
   * verborgenen Geste. Bis dahin steht die Luecke hier — benannt, nicht
   * vergessen.
   */
  const OHNE_LANGEN_DRUCK = ['components/Canvas/CableWaypoints.tsx']

  it('jede andere Rechtsklick-Funktion hat einen zweiten Weg', () => {
    const nurRechtsklick = quellen()
      .filter((q) => /onContextMenu=\{\(e\) => \{/.test(q.text))
      .filter((q) => !q.text.includes('useLongPress'))
      .map((q) => q.datei)
      .filter((d) => !OHNE_LANGEN_DRUCK.includes(d))
    expect(
      nurRechtsklick,
      'Diese Dateien binden eine Funktion an den Rechtsklick, ohne zweiten Weg. ' +
        'Auf einem Tablet gibt es sie damit nicht. `useLongPress` benutzen — oder ' +
        'hier mit Grund eintragen, wie beim Kabel-Wegpunkt.',
    ).toEqual([])
  })

  it('die benannte Ausnahme ist auch wirklich eine', () => {
    // Sonst bliebe sie stehen, nachdem sie geloest wurde — und der naechste
    // haelt eine erledigte Sache fuer offen.
    for (const datei of OHNE_LANGEN_DRUCK) {
      const text = readFileSync(join(RENDERER, ...datei.split('/')), 'utf8')
      expect(text, `${datei} hat den langen Druck jetzt — Ausnahme streichen`).not.toContain(
        'useLongPress',
      )
      expect(text, `${datei} hat kein Kontextmenue mehr — Ausnahme streichen`).toMatch(
        /onContextMenu/,
      )
    }
  })
})

describe('Der lange Druck unterscheidet Abfrage und Zug', () => {
  it('ein zitternder Finger bleibt eine Abfrage', () => {
    expect(istNochRuhig({ x: 100, y: 100 }, { x: 104, y: 103 }, 10)).toBe(true)
  })

  it('ein Zug ist keine Abfrage', () => {
    // Der ganze Sinn der Bedingung: auf einem Canvas ist „gedrueckt halten"
    // der Anfang von fast allem. Ein Menue, das bei jedem begonnenen Zug
    // aufgeht, ist schlimmer als keines.
    expect(istNochRuhig({ x: 100, y: 100 }, { x: 140, y: 100 }, 10)).toBe(false)
    expect(istNochRuhig({ x: 100, y: 100 }, { x: 100, y: 140 }, 10)).toBe(false)
  })

  it('misst schraeg und nicht nur achsenweise', () => {
    // 8 und 8 sind je fuer sich unter 10, zusammen aber 11,3 — eine Messung
    // je Achse liesse genau die diagonalen Zuege durch.
    expect(istNochRuhig({ x: 0, y: 0 }, { x: 8, y: 8 }, 10)).toBe(false)
  })
})
