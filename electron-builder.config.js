export default {
  appId: 'net.cableplanner.app',
  productName: 'Cable Planner',
  files: ['dist/**/*', 'package.json'],
  directories: {
    buildResources: 'build',
  },
  mac: {
    target: ['dmg'],
  },
  win: {
    target: ['nsis'],
  },
}
