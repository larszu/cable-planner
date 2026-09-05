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
