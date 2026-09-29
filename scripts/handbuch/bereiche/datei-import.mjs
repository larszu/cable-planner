// Datei-Menü, erster Teil: Projekt anlegen/öffnen/speichern und alle Importe.
// Rentman und NetBox sind Module — app.mjs schaltet alle Module ein.
import { writeFileSync } from 'node:fs'
import { starte } from '../app.mjs'

const sprache = process.argv[2] ?? 'de'
const a = await starte({ sprache })
const texte = {}
const fehler = []

/** Dialog aufnehmen, dann jeden Reiter darin einzeln. */
const dialogMitReitern = async (name) => {
  await a.bild(`datei-import-${name}`, a.dialog())
  texte[name] = await a.dialogText()
  const reiter = a.dialog().getByRole('tab')
  const n = await reiter.count()
  for (let i = 1; i < n; i += 1) {
    await reiter.nth(i).click().catch(() => {})
    await a.win.waitForTimeout(500)
    await a.bild(`datei-import-${name}-reiter${i + 1}`, a.dialog())
    texte[`${name}-reiter${i + 1}`] = await a.dialogText()
  }
}

const schritt = async (name, fn) => {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    fehler.push(`${name}: ${e.message.split('\n')[0]}`)
  }
  await a.zu()
}

await schritt('menue', async () => {
  await a.menue('app.menu.file')
  await a.bild('datei-import-menue', a.menueFeld())
})
await schritt('vorlagen', async () => {
  await a.menue('app.menu.file', 'app.menu.file.newFromTemplate')
  await dialogMitReitern('vorlagen')
})
await schritt('graphml', async () => {
  await a.menue('app.menu.file', 'app.menu.file.importGraphml')
  await dialogMitReitern('graphml')
})
await schritt('csv', async () => {
  await a.menue('app.menu.file', 'app.menu.tools.csvImport')
  await dialogMitReitern('csv')
})
await schritt('rentman', async () => {
  await a.menue('app.menu.file', 'app.menu.tools.rentmanImport')
  await dialogMitReitern('rentman')
})
await schritt('netbox', async () => {
  await a.menue('app.menu.file', 'app.menu.tools.netboxImport')
  await dialogMitReitern('netbox')
})

writeFileSync(new URL(`./datei-import.${sprache}.json`, import.meta.url), JSON.stringify(texte, null, 2))
await a.ende()
if (fehler.length) console.log('Fehler:\n' + fehler.join('\n'))
