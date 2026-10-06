import { starte } from '../app.mjs'
const S = '/private/tmp/claude-501/-Users-larszumpe/12f0f693-b544-4eb3-a60a-27e5d3a1fe46/scratchpad/ex/'
const a = await starte({ sprache: 'de', hoehe: 1100 })
await a.menue('app.menu.file', 'app.menu.file.newFromTemplate')
console.log(await a.dialogText())
await a.win.screenshot({ path: S + 'tpl.png' })
await a.ende()
console.log('FERTIG')
