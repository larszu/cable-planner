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
/**
 * Die Bruecken-Domaenen, die ein GERAET oder ein Fremdsystem ansprechen.
 *
 * S-2 (2026-09-08) hat gezeigt, wo dieser Waechter seine Luecke hat — und es
 * war nicht die Regex-Form, die 2026-09-04 verbreitert wurde, sondern die
 * LISTE. `switcher` kam als neue Domaene dazu (Mischer und Kreuzschienen aus
 * dem Plan schalten), und der Waechter sah die Datei, die das tut, schlicht
 * nicht mehr: `HubSwitchDialog` war vorher ueber `videohub.` erfasst und
 * fiel mit dem Wechsel auf `switcher.` heraus. Ein Waechter, der beim
 * Umzug einer Datei leise aufhoert zu greifen, ist schlimmer als keiner.
 *
 * Deshalb steht die Liste jetzt neben ihrem Gegenstueck, und ein Test unten
 * haelt fest, dass beide zusammen ALLE Domaenen der Bruecke abdecken. Wer
 * eine neue anlegt, muss sie einordnen — zwei Zeilen — statt sie stillschweigend
 * durchrutschen zu lassen.
 */
const GERAETE_DOMAENEN = ['atem', 'videohub', 'switcher', 'netbox', 'rentman'] as const

/**
 * Die uebrigen Domaenen — ausdruecklich KEINE Geraete-Wege.
 *
 * Sie reden mit dem Dateisystem, dem Schluesselbund, dem eigenen
 * Mobil-Server oder dem Kollaborations-Relais. Keine davon liefert einen
 * Geraete-Befund, der als Absicht in den Plan rutschen koennte, und genau
 * darum geht es in diesem Test.
 */
const SONSTIGE_DOMAENEN = [
  'collabDiscovery',
  'credentials',
  'documentLog',
  'graphml',
  'library',
  'logs',
  'mobileShare',
  'print',
  'project',
  'receipt',
  'signaling',
  'streamKey',
  'sync',
  'updater',
] as const

const READS_DEVICE = new RegExp(`cablePlannerApi\\.(${GERAETE_DOMAENEN.join('|')})\\.[A-Za-z]`)

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
  /**
   * Der gelesene Wert landet im Plan — aber ausdruecklich als NOTIZ.
   *
   * S-4 (2026-09-08) hat den ersten Fall dieser Art gebracht, und er ist
   * keiner der drei bisherigen: `SwitchingSection` holt bei Companion die
   * Liste der dort eingerichteten Verbindungen, und wer eine davon anklickt,
   * schreibt ihren Namen ins Geraet. Das ist weder `getrennt` (der Wert
   * landet sehr wohl im Plan) noch `additiv` (ein zweiter Klick ersetzt den
   * ersten).
   *
   * Was es zulaessig macht, ist etwas anderes: das Feld STEUERT NICHTS. Kein
   * Befehl, keine Adresse, kein Kreuzpunkt haengt daran — es steht in der
   * Oberflaeche als Merkzettel, welche Companion-Verbindung zu der
   * Schaltflaeche gehoert, und die Oberflaeche schreibt daneben, dass
   * Companion das nicht prueft. Faellt die Notiz falsch aus, weil jemand die
   * Schaltflaeche in Companion umgebaut hat, ist sie falsch beschriftet und
   * sonst nichts.
   *
   * Diese Einordnung ist deshalb an eine Bedingung geknuepft, und ein Test
   * unten haelt sie fest: sobald ein Notiz-Feld irgendwo in die
   * Befehls-Bildung geraet, ist es keine Notiz mehr — dann faellt der Test,
   * und die Datei braucht eine andere Einordnung oder das Feld eine andere
   * Behandlung.
   */
  | 'notiz'

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
    file: 'components/Canvas/HubSwitchDialog.tsx',
    verdict: 'additiv',
    reason:
      'B-42 Inkrement 3, der EINGRIFF (2026-09-08). Diese Datei liest kein ' +
      'Geraet, sie SCHREIBT eines: sie schickt einer laufenden Kreuzschiene ' +
      'oder einem Mischer genau die Kreuzpunkte, ueber die der gewaehlte Weg ' +
      'laeuft — seit S-2 ueber `switcher:send` und damit ueber einen Treiber ' +
      'je Protokoll statt ueber den Videohub-Kanal. Was in den ' +
      'Projekt-Store geht, ist ausschliesslich der BELEG darueber ' +
      '(`recordHubSwitch` -> `project.hubSwitches`), angehaengt und nie ' +
      'ersetzt — samt der gescheiterten Versuche, weil „wer hat geschaltet?" ' +
      'auch die beantwortet. An `videohubRouting.planned` wird NICHTS ' +
      'geschrieben, auch nicht „zum Gleichziehen": der Plan ist die Absicht, ' +
      'die Kreuzschiene ein Zustand, und zoege das Senden den Plan mit, gaebe ' +
      'es hinterher keine Abweichung mehr zu sehen (ADR-001). ' +
      '`tests/hubSwitch.test.ts` haelt das als negative Zusicherung fest.',
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
    file: 'components/Properties/sections/SwitchingSection.tsx',
    verdict: 'notiz',
    reason:
      'S-4 (2026-09-08), Companion. Die Datei liest ein Fremdsystem — ' +
      '`switcher.companionConnections` fragt eine laufende Companion-Instanz, ' +
      'welche Geraete dort eingerichtet sind — und ein Klick auf einen Eintrag ' +
      'schreibt `connectionLabel`/`connectionModule` ins Geraet. Der Wert ' +
      'landet also im Plan, und das ist Absicht: ohne ihn steht im Dialog nur ' +
      '„Seite 1, Zeile 2, Spalte 3" und niemand weiss mehr, wofuer die ' +
      'Schaltflaeche gebaut war. Zulaessig ist es, weil das Feld NICHTS ' +
      'steuert: die Schrittfolge in `companionSchritte` liest ausschliesslich ' +
      'Knopf-Koordinaten, Variablennamen und Nummern: die Notiz kommt darin ' +
      'nicht vor. Sie ist ein Merkzettel, keine Zusicherung, und die ' +
      'Oberflaeche sagt genau das daneben — Companion prueft sie nicht, und ' +
      'wer die Schaltflaeche dort umbaut, macht die Zeile falsch, ohne dass ' +
      'sich am Gesendeten etwas aendert. Alles Uebrige, was diese Datei in den ' +
      'Plan schreibt (Protokoll, Adressen, Vorlage, Variablen), ist erklaerte ' +
      'Eingabe des Nutzers und kein abgelesener Wert.',
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
    file: 'hooks/useVideohubLinkFeed.ts',
    verdict: 'getrennt',
    reason:
      'Der Kreuzpunkt-Zustand des Routers fuer die Kanten-Anzeige im Canvas ' +
      '(2026-09-08). Dieselbe Bauform wie `useAtemTallyFeed`: er liest den ' +
      'Plan (Hub-Geraet, Kabel) und den Router und schreibt in keinen von ' +
      'beiden — das Ergebnis geht in den nicht persistierten `liveStore`. ' +
      'Dazu die Grenze, die `videohubLinks` einhaelt: der Hub meldet ' +
      'Kreuzpunkte und NICHTS ueber anliegendes Signal, also liefert er ' +
      '`routed` und nie `carrying`. Was der Hub tut, ist eine Beobachtung; ' +
      'was im Plan steht, eine Absicht — derselbe Satz, den ' +
      '`VideohubExportDialog` schon traegt.',
  },
  {
    file: 'hooks/useAtemTallyFeed.ts',
    verdict: 'getrennt',
    reason:
      'Der Mischer-Zustand fuer die Tally-Anzeige im Canvas (2026-09-08). Er ' +
      'liest den Plan (fuer die Zuordnung Eingang -> Geraet ueber ' +
      '`buildTallyMap`) und den Mischer — und schreibt in KEINEN von beiden. ' +
      'Das Ergebnis geht in `liveStore`, einen eigenen, nicht persistierten ' +
      'Store ohne Historie. Genau darum gibt es ihn: im `projectStore` liefe ' +
      'eine Ablesung durch Undo/Redo, die Autospeicherung und in die ' +
      'Projektdatei — eine Beobachtung, die als Absicht gespeichert wird, ist ' +
      'der Fehler, den ADR-003 und E-4 benennen. Die Trennung ist hier also ' +
      'nicht nachtraeglich hergestellt, sondern die Bauform.',
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

  it('jede Bruecken-Domaene ist eingeordnet — Geraet oder nicht', () => {
    // DIE LUECKE, DIE S-2 AUFGEDECKT HAT. Der Waechter hing an einer
    // handgeschriebenen Domaenen-Liste, und `switcher` fehlte darin: die
    // Datei, die aus dem Plan heraus schaltet, war fuer ihn unsichtbar,
    // sobald sie vom `videohub`- auf den `switcher`-Kanal wechselte.
    //
    // Die Regex zu verbreitern haette die Zahl der eingeordneten Dateien
    // verdreifacht und dabei Datei-I/O und Kollaboration mit hineingezogen —
    // die haben mit „ein Geraete-Befund wird zur Absicht" nichts zu tun. Also
    // bleibt die Liste, aber sie ist jetzt BELEGT: beide Listen zusammen
    // muessen die Bruecke vollstaendig abdecken. Wer eine Domaene anlegt,
    // ordnet sie ein — zwei Zeilen — statt sie durchrutschen zu lassen.
    const preload = readFileSync(resolve(__dirname, '..', 'src', 'main', 'preload.cts'), 'utf8')
    const domaenen = [...preload.matchAll(/^ {2}([a-zA-Z]+): \{$/gm)].map((m) => m[1]).sort()
    expect(domaenen.length).toBeGreaterThanOrEqual(15)
    const eingeordnet = [...GERAETE_DOMAENEN, ...SONSTIGE_DOMAENEN].sort()
    expect(eingeordnet).toEqual(domaenen)
  })

  it('die Companion-Notiz steuert nichts — sonst waere sie keine', () => {
    // Die Bedingung, unter der `notiz` ueberhaupt eine zulaessige Einordnung
    // ist, als negative Zusicherung: die beiden Felder duerfen ueberall
    // vorkommen, wo etwas ANGEZEIGT wird, und nirgends, wo ein Befehl
    // entsteht. Das ist per Quelltext-Suche belegbar, weil es eine Abwesenheit
    // ist — die Anwesenheit eines Aufrufs waere es nicht.
    const befehlsbildung = [
      join(RENDERER, 'lib', 'companionControl.ts'),
      join(RENDERER, 'lib', 'controlActions.ts'),
    ]
    for (const datei of befehlsbildung) {
      const src = readFileSync(datei, 'utf8')
      // Die Deklaration im Interface ist erlaubt; jede LESENDE Verwendung
      // nicht. Deshalb faellt die Feld-Definition (`connectionLabel?:`) raus
      // und alles andere zaehlt.
      const verwendungen = [...src.matchAll(/connection(Label|Module)(\??:)?/g)].filter(
        (m) => m[2] !== '?:',
      )
      expect(verwendungen, `${datei} baut mit der Notiz einen Befehl`).toEqual([])
    }
  })

  it('der Schalt-Weg zaehlt als Geraete-Weg', () => {
    // Er SCHREIBT sogar an ein Geraet — das ist die folgenreichere Richtung.
    expect(GERAETE_DOMAENEN as readonly string[]).toContain('switcher')
    expect(measured()).toContain('components/Canvas/HubSwitchDialog.tsx')
  })
})
