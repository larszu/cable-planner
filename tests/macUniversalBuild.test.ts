// ───────────────────────────────────────────────────────────────────────────
// Der macOS-Universal-Build laesst sich zusammenfuegen.
//
// WARUM ES DAS GIBT. `v8.3.3` hat NULL Assets. Kein DMG, keine EXE, nichts —
// und das steht seit dem 2026-07-31 unbemerkt so auf der Release-Seite. Der
// macOS-Job brach beim Verschmelzen der beiden Teil-Builds ab:
//
//   Detected file "Contents/Resources/app.asar.unpacked/node_modules/
//   @julusian/freetype2/prebuilds/freetype2-darwin-arm64/node-napi-v7.node"
//   that's the same in both x64 and arm64 builds and not covered by the
//   x64ArchFiles rule: "undefined"
//
// Weil der `release`-Job auf `needs: build` steht, riss der macOS-Fehler auch
// die bereits fertig gebaute Windows-.exe mit ins Nichts. Ein einziger nicht
// gesetzter Konfigurationswert hat damit ZWEI Plattformen um ihr Artefakt
// gebracht, und die Release-Seite sah dabei aus wie immer.
//
// `@julusian/freetype2` baut nichts, es liefert fertige Binaries aus: ein
// Verzeichnis je Plattform+Arch unter `prebuilds/`, zur Laufzeit ausgewaehlt
// von `pkg-prebuilds/bindings.js` ueber `os.arch()`. Beide Teil-Builds
// enthalten deshalb denselben vollstaendigen Baum, Byte fuer Byte gleich.
// `@electron/universal` verlangt fuer eine in beiden Builds identische
// Mach-O-Datei eine ausdrueckliche Ansage (`mac.x64ArchFiles`) — sonst waere
// ein vergessenes Rebuild nicht von einer absichtlich geteilten Datei zu
// unterscheiden.
//
// WIE ER PRUEFT. In BEIDE Richtungen, und das ist der Punkt:
//
//  1. Jede per Pfad ausgewaehlte darwin-Prebuild-Datei im Produktions-Baum
//     MUSS vom Muster gedeckt sein — sonst bricht der Build ab.
//  2. Jede pro Arch NEU GEBAUTE Datei (keytar & Co. unter `build/Release/`)
//     darf es NICHT sein. Der bequemste Weg, Fehler 1 loszuwerden, ist
//     `x64ArchFiles: '**/*.node'` — der Build wird gruen, und die
//     Universal-App traegt dann in beiden Architekturen die x64-Variante von
//     keytar. Das faellt nicht beim Bauen auf, sondern auf einem Apple-
//     Silicon-Rechner beim ersten Zugriff auf den Schluesselbund.
//
// Gemessen wird am echten `node_modules`, nicht an einer Liste hier: das
// naechste Paket dieser Bauart faellt damit von selbst auf. Der Abgleich
// laeuft mit `minimatch` und denselben Optionen, die `@electron/universal`
// benutzt (`matchBase: true`) — eine nachgebaute Pfadlogik wuerde raten.
//
// WAS ER NICHT PRUEFT: ob `lipo` die zusammengefuegten Binaries akzeptiert.
// Das braucht einen macOS-Runner; hier geht es um den Abbruch, der schon
// vorher passiert.
// ───────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { minimatch } from 'minimatch'
import { describe, expect, it } from 'vitest'
import konfiguration from '../electron-builder.js'

const ROOT = join(__dirname, '..')

/** So heisst die Datei spaeter IM Paket — genau diesen Pfad sieht der Merge. */
const imPaket = (relativZuNodeModules: string): string =>
  ['Contents', 'Resources', 'app.asar.unpacked', 'node_modules', relativZuNodeModules].join('/')

/** node-Aufloesung von Hand: von `start` aus die `node_modules` hochlaufen. */
const paketVerzeichnis = (name: string, start: string): string | null => {
  let verzeichnis = start
  for (;;) {
    const kandidat = join(verzeichnis, 'node_modules', name)
    if (existsSync(join(kandidat, 'package.json'))) return kandidat
    const oben = join(verzeichnis, '..')
    if (oben === verzeichnis) return null
    verzeichnis = oben
  }
}

/**
 * Der Baum, den electron-builder verpackt: `dependencies` transitiv,
 * `devDependencies` NICHT. Genau diese Grenze ist die entscheidende — ein
 * Prebuild-Paket, das nur ein Build-Werkzeug mitbringt, landet nie im
 * Installer und darf den Guard nicht beschaeftigen.
 */
const produktionsBaum = (): { name: string; verzeichnis: string }[] => {
  const wurzel = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
  }
  const gesehen = new Set<string>()
  const treffer: { name: string; verzeichnis: string }[] = []
  const offen = Object.keys(wurzel.dependencies ?? {}).map((n) => ({ name: n, von: ROOT }))
  while (offen.length > 0) {
    const { name, von } = offen.pop()!
    const verzeichnis = paketVerzeichnis(name, von)
    if (!verzeichnis || gesehen.has(verzeichnis)) continue
    gesehen.add(verzeichnis)
    treffer.push({ name, verzeichnis })
    const pj = JSON.parse(readFileSync(join(verzeichnis, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    for (const kind of Object.keys(pj.dependencies ?? {})) offen.push({ name: kind, von: verzeichnis })
  }
  return treffer
}

const nodeDateien = (verzeichnis: string): string[] => {
  const treffer: string[] = []
  const lauf = (d: string) => {
    for (const eintrag of readdirSync(d)) {
      if (eintrag === 'node_modules') continue
      const pfad = join(d, eintrag)
      if (statSync(pfad).isDirectory()) lauf(pfad)
      else if (eintrag.endsWith('.node')) treffer.push(pfad)
    }
  }
  lauf(verzeichnis)
  return treffer
}

/**
 * Per Pfad ausgewaehlt heisst: ein `prebuilds`-Segment, und irgendein Segment
 * darunter nennt die Plattform. Solche Dateien sind in beiden Teil-Builds
 * identisch, weil nichts sie neu baut.
 */
const istPfadPrebuild = (segmente: string[]): boolean =>
  segmente.includes('prebuilds') &&
  segmente.some((s, i) => i > segmente.indexOf('prebuilds') && /darwin|win32|linux/.test(s))

type Fund = { pfad: string; segmente: string[] }

const mac =
  (konfiguration as { mac?: { target?: unknown[]; x64ArchFiles?: string; mergeASARs?: boolean } }).mac ?? {}
const muster = mac.x64ArchFiles

/**
 * Der Pfad ab dem LETZTEN `node_modules`-Segment -- genau so adressiert
 * electron-builder die Datei im Paket.
 *
 * Nicht `relative(ROOT/node_modules, …)`: das setzt voraus, dass die
 * Abhaengigkeiten direkt neben der `package.json` liegen. In der vendorten
 * Kopie unter `av-planner-suite/apps/cable-planner/` sind sie an die
 * Monorepo-Wurzel gehoistet, und der relative Pfad begann dann mit `../../..`
 * -- das Muster traf nichts mehr, und der Guard meldete faelschlich einen
 * Fehler (gemessen 2026-09-05, gefunden von genau dieser Kopie).
 */
const imBaum = (pfad: string): string[] => {
  const teile = pfad.split(sep)
  return teile.slice(teile.lastIndexOf('node_modules') + 1)
}

const alleNativen: Fund[] = produktionsBaum().flatMap(({ verzeichnis }) =>
  nodeDateien(verzeichnis).map((pfad) => {
    const segmente = imBaum(pfad)
    return { pfad: segmente.join('/'), segmente }
  }),
)

const darwinPrebuilds = alleNativen.filter(
  (f) => istPfadPrebuild(f.segmente) && f.segmente.some((s) => s.includes('darwin')),
)
const proArchGebaut = alleNativen.filter((f) => !istPfadPrebuild(f.segmente))

/**
 * minimatch lehnt Muster ueber 64 KiB ab (`MAX_PATTERN_LENGTH = 1024 * 64`).
 * Genau dagegen laeuft `mergeASARs`: es baut fuer ALLE entpackten Dateien EIN
 * Glob -- `{pfad1,pfad2,…}` mit absoluten Pfaden -- und gibt es an minimatch.
 */
const MUSTER_GRENZE = 1024 * 64

/**
 * Das Praefix, das `mergeASARs` den Pfaden voranstellt:
 * `fs.mkdtemp(path.join(os.tmpdir(), 'x64-'))`. Auf einem macOS-Runner ist
 * `os.tmpdir()` ein `/var/folders/…`-Pfad; hier steht ein typischer, damit die
 * Rechnung nicht vom lokalen `/tmp` abhaengt und die Laenge NICHT unterschaetzt
 * wird. Sie wird eher unterschaetzt als ueberschaetzt -- siehe unten.
 */
const TEMP_PRAEFIX = '/var/folders/6t/1lqm9rgn7wl4b6q0d5x3z9_c0000gn/T/x64-AbCdEf/'

/**
 * Was electron-builder entpackt, OHNE dass jemand es hinschreibt: sobald eine
 * Datei eines Moduls eine Bibliothek oder ausfuehrbar ist, wandert das GANZE
 * Modulverzeichnis aus dem Archiv --
 * `unpackDetector.detectUnpackedDirs` -> `autoUnpackDirs.add(moduleRootPath)`.
 * `@julusian/freetype2` bringt seinen kompletten C++-Quellbaum mit, und der
 * zaehlt damit vollstaendig mit.
 *
 * Das Ergebnis ist eine UNTERGRENZE: `asarUnpack` aus der Konfiguration kaeme
 * noch dazu. Fuer eine Untergrenze reicht das -- wer sie schon reisst, reisst
 * auch die echte Zahl.
 */
const istLibOderExe = (datei: string): boolean =>
  /\.(dll|exe|dylib|so|node)$/.test(datei)

const entpackteDateien = (): string[] => {
  const treffer: string[] = []
  for (const { verzeichnis } of produktionsBaum()) {
    const alle: string[] = []
    const lauf = (d: string) => {
      for (const eintrag of readdirSync(d)) {
        const pfad = join(d, eintrag)
        if (statSync(pfad).isDirectory()) {
          if (eintrag !== 'node_modules') lauf(pfad)
        } else alle.push(pfad)
      }
    }
    lauf(verzeichnis)
    if (alle.some(istLibOderExe)) treffer.push(...alle.map((p) => imBaum(p).join('/')))
  }
  return treffer
}

describe('der macOS-Universal-Build laesst sich zusammenfuegen', () => {
  it('die mac-Ziele enthalten einen Universal-Build', () => {
    // Die Voraussetzung dieses Guards, ausgesprochen statt stillschweigend
    // angenommen: nur beim Universal-Build laeuft der Merge, um den es hier
    // geht. Wer die Ziele bewusst aendert, aendert diese Datei mit — das ist
    // eine sichtbare Entscheidung, kein stilles Ueberspringen.
    const ziele = (mac.target ?? []) as { arch?: string }[]
    expect(ziele.some((z) => z.arch === 'universal')).toBe(true)
  })

  it('findet ueberhaupt native Module im Produktions-Baum', () => {
    // Ein leerer Suchlauf waere gruen und wertlos — etwa nach einem
    // Umbau der Abhaengigkeiten oder ohne `npm install`.
    expect(
      alleNativen.length,
      'Keine .node-Dateien im Produktions-Baum gefunden — lief `npm install`?',
    ).toBeGreaterThan(0)
    expect(
      darwinPrebuilds.length,
      'Keine per Pfad ausgewaehlten darwin-Prebuilds gefunden. Entweder liefert kein ' +
        'Paket mehr welche aus (dann darf dieser Guard weg) oder der Suchlauf greift daneben.',
    ).toBeGreaterThan(0)
  })

  it('jedes per Pfad ausgewaehlte darwin-Prebuild ist von x64ArchFiles gedeckt', () => {
    const ungedeckt = darwinPrebuilds
      .filter((f) => !muster || !minimatch(imPaket(f.pfad), muster, { matchBase: true }))
      .map((f) => f.pfad)
    expect(
      ungedeckt,
      'Diese Dateien sind in beiden Teil-Builds identisch und von `mac.x64ArchFiles` ' +
        `nicht gedeckt (Muster: ${JSON.stringify(muster)}). @electron/universal bricht ` +
        'daran ab — und weil der release-Job auf needs: build steht, faellt damit auch ' +
        'das Windows-Artefakt aus. Muster in electron-builder.js erweitern.',
    ).toEqual([])
  })

  it('bei zu vielen entpackten Dateien ist mergeASARs abgeschaltet', () => {
    // Die zweite Stufe, an der der Universal-Build reisst -- und sie kommt
    // ERST, wenn x64ArchFiles die erste geraeumt hat. Gemessen am Suite-Tag
    // v0.1.1 (2026-09-05): `pattern is too long`, geworfen von minimatch in
    // `shouldUnpackPath`, aufgerufen aus `mergeASARs`.
    //
    // Der Test verlangt nicht "wenig entpacken" -- das laesst sich hier nicht
    // steuern, die Dateien kommen aus der automatischen Native-Erkennung. Er
    // verlangt: wenn das Muster zu lang WIRD, muss `mergeASARs` aus sein.
    // Wird `@julusian/freetype2` eines Tages schlanker, faellt die Forderung
    // von selbst weg.
    const dateien = entpackteDateien()
    const laenge = `{${dateien.map((d) => TEMP_PRAEFIX + d).join(',')}}`.length

    expect(dateien.length, 'Keine entpackten Dateien gefunden -- lief `npm install`?').toBeGreaterThan(0)

    if (laenge >= MUSTER_GRENZE) {
      expect(
        mac.mergeASARs,
        `Das Merge-Muster waere mindestens ${laenge} Zeichen lang (${dateien.length} entpackte ` +
          `Dateien), minimatch riegelt bei ${MUSTER_GRENZE} ab. mergeASARs MUSS deshalb false ` +
          'bleiben, sonst bricht der Universal-Build mit "pattern is too long" ab -- und weil ' +
          'der release-Job auf needs: build steht, faellt dann auch das Windows-Artefakt aus.',
      ).toBe(false)
    }
  })

  it('die verpackte package.json bringt den Einsprung-Shim nicht um', () => {
    // Die DRITTE Stufe, an der der Universal-Build reisst -- und sie entsteht
    // erst durch `mergeASARs: false`. Gemessen an der ausgelieferten Suite-App
    // v0.1.1: `ReferenceError: exports is not defined in ES module scope`,
    // geworfen in `app.asar/index.js`.
    //
    // Das ist nicht unser Code: `@electron/universal` legt bei
    // `mergeASARs: false` einen CommonJS-Shim als `index.js` ab und daneben
    // eine KOPIE unserer package.json. Sagt die `type: module`, parst Node den
    // Shim als ESM, und die App stirbt vor der ersten eigenen Zeile.
    //
    // Ab `@electron/universal@3` schreibt es in dem Fall `index.mjs`; die
    // Forderung faellt dann von selbst weg, ohne dass jemand diese Datei
    // anfassen muss.
    // NICHT `join(ROOT, 'node_modules', ...)`: in der vendorten Kopie unter
    // `av-planner-suite/apps/cable-planner/` liegen die Abhaengigkeiten an der
    // Monorepo-Wurzel. Genau dieser Fehler steckte schon in der Pfad-Bildung
    // dieses Tests (#696) -- `paketVerzeichnis` laeuft die `node_modules`
    // hoch und trifft beide Lagen.
    const universalDir = paketVerzeichnis('@electron/universal', ROOT)
    expect(
      universalDir,
      '@electron/universal ist nicht auffindbar -- ohne das Paket hat diese Pruefung ' +
        'keine Grundlage, und sie darf dann nicht stillschweigend durchgehen.',
    ).not.toBeNull()
    const universalPaket = JSON.parse(
      readFileSync(join(universalDir!, 'package.json'), 'utf8'),
    ) as { version: string }
    const major = Number(universalPaket.version.split('.')[0])
    const universal = ((mac.target ?? []) as { arch?: string }[]).some((z) => z.arch === 'universal')
    if (!universal || mac.mergeASARs !== false || major >= 3) return

    const eigenes = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { type?: string }
    // `extraMetadata` gewinnt ueber die package.json im Repo -- genau dafuer
    // ist es da, und genau das landet spaeter im Archiv.
    const konfig = konfiguration as { extraMetadata?: { type?: string } }
    const effektiv = konfig.extraMetadata?.type ?? eigenes.type

    expect(
      effektiv,
      `@electron/universal@${universalPaket.version} legt bei mergeASARs:false einen ` +
        'CommonJS-Shim als `index.js` neben eine Kopie dieser package.json. Mit ' +
        '`type: module` startet die App nicht -- "exports is not defined in ES module ' +
        "scope\". Abhilfe: `extraMetadata: { type: 'commonjs' }`, und der ESM-Teil " +
        'bekommt seine eigene package.json (scripts/mark-main-esm.mjs).',
    ).not.toBe('module')
  })

  it('die pro Arch gebauten Module sind NICHT gedeckt', () => {
    // Die Gegenrichtung. `x64ArchFiles: '**/*.node'` macht den Build gruen und
    // die Universal-App kaputt: keytar laege dann in beiden Architekturen als
    // x64-Binary bei, und der Schluesselbund-Zugriff stirbt erst auf einem
    // Apple-Silicon-Rechner beim Nutzer.
    const faelschlichGedeckt = proArchGebaut
      .filter((f) => muster && minimatch(imPaket(f.pfad), muster, { matchBase: true }))
      .map((f) => f.pfad)
    expect(
      faelschlichGedeckt,
      'Diese Module baut @electron/rebuild pro Architektur neu; sie MUESSEN von lipo ' +
        'zusammengefuehrt werden. Deckt x64ArchFiles sie ab, wird stattdessen die ' +
        'x64-Variante fuer beide Architekturen behalten.',
    ).toEqual([])
  })
})
