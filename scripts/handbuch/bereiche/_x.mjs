import { starte } from '../app.mjs'
const a = await starte({ sprache: 'de' })
const w = a.win
const info = await w.evaluate(() => {
  const o = {}
  for (const k of ['cable-planner:customLibrary','cable-planner:projectAutosave','cable-planner:groupPresets','cable-planner:libMigration']) {
    const v = localStorage.getItem(k); o[k] = v ? v.slice(0, 400) + ' ... len=' + v.length : null
  }
  return o
})
console.log(JSON.stringify(info, null, 1))
await a.klick('library.tab.equipment')
await a.klickText(/Rentman/)
await w.waitForTimeout(500)
const lib = w.locator('aside:has(.spaltenkopf)').first()
await a.bild('_z1', lib)
console.log(await lib.innerText())
await a.klick('library.rentman.linkProject')
await w.waitForTimeout(2500)
console.log('DLG', await a.dialogText())
await a.bild('_z2')
await a.zu()
await a.klick('library.rentman.view.catalog')
await a.klick('library.rentman.catalogLoad')
await w.waitForTimeout(1500)
console.log(await lib.innerText())
await a.bild('_z3', lib)
await a.ende()
console.log('FERTIG')
