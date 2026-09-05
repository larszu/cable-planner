// electron-builder config. Signing is enabled automatically when CSC_LINK +
// CSC_KEY_PASSWORD are set (see scripts/generate-cert.ps1). Without those
// env vars the build is unsigned.
const year = new Date().getFullYear()

export default {
  appId: 'net.cableplanner.app',
  productName: 'Cable Planner',
  copyright: `Copyright © ${year} Lars Zumpe`,
  // #pre-sale — Auto-Update-Quelle. electron-builder bettet daraus die
  // app-update.yml ins Paket ein; electron-updater (siehe updaterService.ts)
  // prüft damit die GitHub-Releases dieses Repos. release.yml lädt latest*.yml
  // + Blockmaps bereits ans Release; `--publish never` dort heißt nur "nicht
  // doppelt hochladen" — die publish-CONFIG bleibt im Paket eingebettet.
  publish: [{ provider: 'github', owner: 'larszu', repo: 'cable-planner', releaseType: 'release' }],
  files: ['dist/**/*', 'package.json'],
  // DIE VERPACKTE package.json DARF KEIN `type: module` TRAGEN.
  //
  // Gemessen an der ausgelieferten Suite-App `v0.1.1`, die beim Start
  // abstuerzt -- dieselbe Konstellation steckt hier:
  //
  //   ReferenceError: exports is not defined in ES module scope
  //   ... app.asar/package.json contains "type": "module"
  //   at app.asar/index.js:5:23
  //
  // `index.js` ist nicht unser Code, sondern der Einsprung-Shim, den
  // `@electron/universal` bei `mergeASARs: false` erzeugt: er waehlt zur
  // Laufzeit zwischen `app-x64.asar` und `app-arm64.asar`. Der Shim ist
  // CommonJS (`exports`, `require`), heisst `index.js` -- und daneben legt
  // @electron/universal eine KOPIE UNSERER package.json. Steht dort
  // `type: module`, parst Node den Shim als ESM und die App ist tot, bevor
  // eine Zeile eigener Code laeuft.
  //
  // `@electron/universal@3.x` behebt das (es schreibt dann `index.mjs`), ist
  // hier aber nicht zu haben: `app-builder-lib` pinnt 2.0.3 exakt, und ein
  // npm-`overrides` liesse sich nur mit einer vollstaendigen Neuaufloesung
  // des Lockfiles anwenden.
  //
  // `extraMetadata` aendert NUR die verpackte package.json, nicht die im
  // Repo: `eslint.config.js`, `vite.config.ts` und diese Datei bleiben ESM.
  // Was dadurch ESM verliert, bekommt es zurueck: `scripts/mark-main-esm.mjs`
  // legt bei jedem `build:main` ein `dist/main/package.json` mit
  // `type: module` ab -- der Main-Prozess ist der einzige Node-geladene
  // ESM-Code im Paket.
  extraMetadata: { type: 'commonjs' },
  directories: {
    buildResources: 'build',
    output: 'release',
  },
  // #pre-sale — OS-Dateiverknüpfung: Doppelklick auf eine .cableplan-/.cpviewer-
  // Datei startet die App (Handling in main: open-file/argv → project:open-external).
  // Ohne explizites `icon` nutzt electron-builder das App-Icon (build/icon.*) —
  // wir haben (noch) kein eigenes Dokument-Icon und vermeiden so ein fehlendes
  // .icns auf macOS, das den Build sonst abbrechen ließe.
  fileAssociations: [
    {
      ext: 'cableplan',
      name: 'Cable Planner Project',
      description: 'Cable Planner Projekt',
      role: 'Editor',
    },
    {
      ext: 'cpviewer',
      name: 'Cable Planner Viewer',
      description: 'Cable Planner Viewer (read-only)',
      role: 'Viewer',
    },
  ],
  // npmRebuild defaults to true. We explicitly do NOT set it to false here:
  // skipping the rebuild leaves native modules (keytar, @julusian/freetype2)
  // built against Node's ABI rather than Electron's, which on Windows caused
  // electron-builder to silently produce zero EXE artifacts in CI (the job
  // succeeded but the upload step found no *.exe to attach to the release).
  mac: {
    category: 'public.app-category.productivity',
    // Universal-Build (arm64 + x64 in einer .app): läuft auf Apple Silicon
    // nativ — kein Rosetta, keine „Intel-App"-Warnung auf neuen macOS-Versionen
    // — und weiterhin auf Intel-Macs. Ein Download statt getrennter DMGs, damit
    // niemand versehentlich den Intel-Build lädt.
    // dmg = das, was der Nutzer herunterlaedt. zip = das, was der eingebaute
    // Auto-Updater braucht: Squirrel.Mac (electron-updater) kann ein Update
    // NUR aus einem zip einspielen, und `latest-mac.yml` zeigt auf genau diese
    // Datei. Mit dmg allein laeuft `checkForUpdatesAndNotify()` in ein 404 --
    // die Funktion ist eingebaut und im Release nicht bedienbar.
    target: [
      { target: 'dmg', arch: 'universal' },
      { target: 'zip', arch: 'universal' },
    ],
    artifactName: '${productName}-${version}-${arch}.${ext}',
    // OHNE DIESE ZEILE GIBT ES KEIN macOS-ARTEFAKT. Gemessen an v8.3.3
    // (Lauf 30617724085, 2026-07-31): der Universal-Build bricht ab mit
    //   Detected file ".../@julusian/freetype2/prebuilds/
    //   freetype2-darwin-arm64/node-napi-v7.node" that's the same in both
    //   x64 and arm64 builds and not covered by the x64ArchFiles rule
    // und da `release` auf `needs: build` steht, wurde danach auch die
    // fertige Windows-.exe nie ans Release gehaengt: v8.3.3 hat NULL Assets.
    //
    // WARUM. `@julusian/freetype2` liefert seine Binaries nicht gebaut,
    // sondern fertig aus — ein Verzeichnis je Plattform+Arch unter
    // `prebuilds/`, ausgewaehlt zur Laufzeit von `pkg-prebuilds/bindings.js`
    // ueber `os.arch()`. Beide Teil-Builds (x64 und arm64) enthalten deshalb
    // denselben vollstaendigen `prebuilds/`-Baum, Byte fuer Byte gleich.
    // `@electron/universal` erwartet bei einer Mach-O-Datei, die in beiden
    // Builds identisch ist, eine ausdrueckliche Ansage — sonst koennte es
    // ebenso gut ein vergessenes Rebuild sein — und bricht ab. `lipo` waere
    // hier auch falsch: die Auswahl passiert ueber den PFAD, nicht ueber eine
    // Fat-Binary.
    //
    // Der Name der Option ist irrefuehrend („x64ArchFiles"), ihre Wirkung ist
    // genau die richtige: „identisch ist in Ordnung, eine Kopie behalten".
    // Sie greift ausschliesslich im Gleichheitsfall — unterscheiden sich die
    // beiden Dateien, laeuft weiterhin lipo. Das Muster deckt bewusst die
    // FORM ab (per Pfad benannte Prebuild-Verzeichnisse), nicht das eine
    // Paket: das naechste Paket dieser Bauart faellt sonst genauso um.
    // `tests/macUniversalBuild.test.ts` haelt das fest.
    x64ArchFiles: '**/prebuilds/*darwin*/**',
    // OHNE DIESE ZEILE BRICHT DER UNIVERSAL-BUILD EINE STUFE SPAETER AB.
    // Gemessen am Suite-Tag v0.1.1 (Lauf 33974015212, 2026-09-05), der genau
    // hier gestorben ist, nachdem `x64ArchFiles` die erste Huerde geraeumt
    // hatte:
    //
    //   ⨯ pattern is too long
    //     at assertValidPattern (@electron/asar/.../minimatch.js:281)
    //     at shouldUnpackPath   (@electron/asar/src/asar.ts:158)
    //     at mergeASARs         (@electron/universal/src/asar-utils.ts:216)
    //
    // WARUM. `mergeASARs` baut fuer die entpackten Dateien EIN einziges
    // Glob-Muster -- `{pfad1,pfad2,…}` mit absoluten Pfaden -- und reicht es
    // an minimatch, das bei 64 KiB abriegelt. Die Zahl der entpackten Dateien
    // ist hier nicht klein: electron-builder entpackt bei einem nativen Modul
    // nicht die .node-Datei, sondern das GANZE Paketverzeichnis
    // (`unpackDetector.detectUnpackedDirs` -> `autoUnpackDirs.add(
    // moduleRootPath)`). `@julusian/freetype2` bringt seinen kompletten
    // C++-Quellbaum mit: 553 Dateien. Mit keytar zusammen sind es 586, und
    // das Muster wird 72.642 Zeichen lang -- nachgemessen, nicht geschaetzt.
    //
    // Das ist upstream nicht behoben: auch `@electron/universal@3.0.6` baut
    // dieselbe Glob (asar-utils.ts:241). Und es ist nichts, was man kleiner
    // konfigurieren koennte -- dieses Projekt setzt gar kein `asarUnpack`,
    // die 586 Dateien kommen ausschliesslich aus der automatischen
    // Native-Erkennung.
    //
    // `mergeASARs: false` umgeht den Aufruf. Sind die beiden Teil-Archive
    // gleich -- und das sind sie hier, weil alles Arch-Spezifische entpackt
    // neben dem Archiv liegt --, bleibt es bei EINEM `app.asar` wie bisher;
    // unterscheiden sie sich, legt @electron/universal `app-x64.asar` und
    // `app-arm64.asar` mit einem kleinen Einsprung-Archiv an. Der lipo-Lauf
    // ueber die Mach-O-Dateien und `x64ArchFiles` laufen in beiden Faellen
    // vorher. `tests/macUniversalBuild.test.ts` misst die Musterlaenge und
    // haelt fest, dass diese Zeile stehen bleibt, solange sie noch reisst.
    mergeASARs: false,
    icon: 'build/icon.png',
    // Ad-hoc sign the app so macOS Gatekeeper doesn't reject the binary
    // outright with "Cable Planner is damaged and can't be opened" on
    // Apple Silicon. arm64 macOS refuses to load completely-unsigned
    // binaries; a placeholder ("-") signature is enough for the OS to
    // accept the binary structure. Users still see the standard
    // "unidentified developer" prompt on first launch and need to
    // right-click → Open (no paid Apple Developer ID required).
    identity: '-',
    hardenedRuntime: false,
    gatekeeperAssess: false,
  },
  win: {
    target: [
      { target: 'nsis', arch: 'x64' },
      { target: 'portable', arch: 'x64' },
    ],
    artifactName: '${productName}-${version}-${arch}.${ext}',
    icon: 'build/icon.ico',
    // No code-signing: electron-builder skips signtool when CSC_LINK is unset.
    // SmartScreen will show "Unknown publisher" until a CA-issued cert is
    // wired up via CSC_LINK + CSC_KEY_PASSWORD (see scripts/generate-cert.ps1).
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    installerHeaderIcon: 'build/icon.ico',
    shortcutName: 'Cable Planner',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  portable: {
    artifactName: '${productName}-${version}-portable.${ext}',
  },
}
