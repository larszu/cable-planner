export default {
  appId: 'net.cableplanner.app',
  productName: 'Cable Planner',
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
  },
  win: {
    target: ['nsis', 'portable'],
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
  },
  portable: {
    artifactName: '${productName}-${version}-portable.${ext}',
  },
}
