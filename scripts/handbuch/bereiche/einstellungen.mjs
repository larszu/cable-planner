// Einstellungen: jeder Reiter, lange Reiter in mehreren Bildern (gescrollt).
import { starte } from '../app.mjs'

// Die Reiterbeschriftung kommt aus `t(\`settings.tab.${id}\`, TAB_FALLBACK_LABEL[id])` —
// ein dynamischer Schlüssel, dessen Fallback im Code steht. Beide Fassungen zulassen.
const FALLBACK = { project: 'Projekt', modules: 'Module', appearance: 'Darstellung', editing: 'Bearbeiten',
  hotkeys: 'Hotkeys', integrations: 'Integrationen', deviceLibrary: 'Device library', mcp: 'MCP',
  configs: 'Konfigurationen', cableTypes: 'Cable types', stammdaten: 'Master data', schema: 'Kategorien & Felder',
  sync: 'Netzwerk-Sync', nachweise: 'Nachweise', advanced: 'Erweitert' }
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const REITER = ['project', 'appearance', 'editing', 'cableTypes', 'stammdaten', 'configs', 'deviceLibrary',
  'integrations', 'mcp', 'modules', 'nachweise', 'schema', 'sync', 'hotkeys', 'advanced']

const a = await starte({ sprache: process.argv[2] ?? 'de' })
const fehler = []
await a.palette('palette.settings')
for (const id of REITER) {
  try {
    const namen = [a.text(`settings.tab.${id}`), FALLBACK[id]].filter((n) => !n.startsWith('settings.'))
    await a.dialog().getByRole('button', { name: new RegExp(`^\\s*(${namen.map(esc).join('|')})\\s*$`) }).first().click()
    await a.win.waitForTimeout(700)
    await a.bild(`einstellungen-${id}`, a.dialog())
    // Den höchsten scrollbaren Bereich im Dialog nach unten schieben, je Bildschirm ein Bild.
    for (let teil = 2; teil <= 5; teil += 1) {
      const weiter = await a.dialog().evaluate((d) => {
        const kandidaten = [...d.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible')
        const el = kandidaten.sort((x, y) => y.scrollHeight - x.scrollHeight)[0]
        if (!el || el.scrollTop + el.clientHeight >= el.scrollHeight - 5) return false
        el.scrollTop += el.clientHeight - 60
        return true
      })
      if (!weiter) break
      await a.win.waitForTimeout(400)
      await a.bild(`einstellungen-${id}-${teil}`, a.dialog())
    }
  } catch (e) {
    fehler.push(`${id}: ${e.message}`)
  }
}
await a.ende()
if (fehler.length) console.log('Fehler:\n' + fehler.join('\n'))
