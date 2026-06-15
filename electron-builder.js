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
    target: [
      { target: 'dmg', arch: 'x64' },
      { target: 'dmg', arch: 'arm64' },
    ],
    artifactName: '${productName}-${version}-${arch}.${ext}',
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
