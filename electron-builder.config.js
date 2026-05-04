// electron-builder config. Signing is enabled automatically when CSC_LINK +
// CSC_KEY_PASSWORD are set (see scripts/generate-cert.ps1). Without those
// env vars the build is unsigned.
const year = new Date().getFullYear()

export default {
  appId: 'net.cableplanner.app',
  productName: 'Cable Planner',
  copyright: `Copyright © ${year} Lars Zumpe`,
  files: ['dist/**/*', 'package.json'],
  directories: {
    buildResources: 'build',
    output: 'release',
  },
  npmRebuild: false,
  mac: {
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
    target: ['nsis', 'portable'],
    artifactName: '${productName}-${version}-${arch}.${ext}',
    icon: 'build/icon.ico',
    // electron-builder picks up CSC_LINK / CSC_KEY_PASSWORD automatically.
    signtoolOptions: {
      publisherName: ['Lars Zumpe'],
      signingHashAlgorithms: ['sha256'],
    },
    // SmartScreen reputation needs a CA-issued cert; self-signed will still
    // trigger "Unknown publisher". See scripts/generate-cert.ps1.
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
