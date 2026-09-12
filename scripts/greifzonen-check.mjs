/**
 * DER GRIFF GEHOERT DEM KABEL, AUF DAS MAN ZEIGT.
 *
 * ─── WAS GEMELDET WURDE (Nutzer, 2026-09-12) ───────────────────────────────
 *
 * „Es hat sich in der GitHub page von Cable planner ein zweites Kabel
 * verschoben, wenn ich ein anderes bearbeitet habe. Das muss vor kurzem
 * kaputt gegangen sein und soll so nicht sein."
 *
 * ─── WAS DIESER LAUF MISST ─────────────────────────────────────────────────
 *
 * Er legt eine dichte Szene auf die Flaeche (neun Geraete, acht Kabel, die
 * sich kreuzen und streckenweise nebeneinander laufen), tastet JEDE gezeichnete
 * Kabellinie an 39 Stellen ab und fragt an jeder Stelle:
 *
 *     Liegt hier der GRIFF EINES ANDEREN Kabels obenauf?
 *
 * Der Griff ist die unsichtbare Zone, an der sich ein Abschnitt ziehen laesst
 * (`CableWaypoints`, `<g class="cp-kabelgriff" data-kabel-id=…>`). Liegt der
 * Griff von Kabel B auf der Linie von Kabel A, dann bewegt ein Zug auf A das
 * Kabel B — genau die Meldung. Erlaubt sind null solche Stellen.
 *
 * GEMESSEN vor der Korrektur: 30 von 312 abgetasteten Stellen trugen den Griff
 * eines fremden Kabels obenauf, und reproduziert war es auch im Zug selbst:
 * gezogen an Kabel 3, bewegt hat sich Kabel 7. Nach der Korrektur (Griffe nur
 * am ausgewaehlten Kabel): 0.
 *
 * ─── WAS ER NICHT MISST ────────────────────────────────────────────────────
 *
 * Die AUSWAHL. Ueber jeder Linie liegt zusaetzlich ReactFlows eigener
 * `react-flow__edge-interaction`-Pfad, und der ist breiter als der Strich;
 * gemessen liegt er nach der Korrektur an 33 der 312 Stellen von einem fremden
 * Kabel obenauf — die 30 Stellen, an denen vorher ein fremder Griff lag, sind
 * darin aufgegangen. Ein
 * Klick dort waehlt das fremde Kabel aus — sichtbar, mit Namen in der
 * Eigenschaftsleiste, und ohne dass sich etwas bewegt. Dieser Lauf zaehlt das
 * getrennt und urteilt nicht darueber: „falsch ausgewaehlt" ist ein
 * Aerger, „unbemerkt verschoben" ein Datenverlust.
 *
 * Er misst ausserdem nur DIESE eine Szene. Sie ist so gebaut, dass Kabel sich
 * kreuzen und parallel laufen — wer die Zahl auf beliebige Plaene verallgemeinert,
 * verallgemeinert eine Stichprobe.
 *
 * Aufruf: `xvfb-run -a npm run greifzonen:check` (Linux/headless).
 */
import { _electron as electron } from 'playwright-core'
import { erststartOverlayWeg } from './lib/erststartOverlay.mjs'

/** Die Messszene. Absichtlich im Skript und nicht im Beispielprojekt: das
 *  Beispiel soll einladend sein, diese Szene soll eng sein. */
const szene = () => {
  const equipment = []
  for (let spalte = 0; spalte < 3; spalte += 1) {
    for (let zeile = 0; zeile < 3; zeile += 1) {
      const id = `dev-${spalte}-${zeile}`
      equipment.push({
        id,
        name: `Device ${spalte}${zeile}`,
        category: 'Other',
        x: 120 + spalte * 420,
        y: 100 + zeile * 260,
        inputs: [0, 1, 2, 3].map((i) => ({
          id: `${id}-in${i}`, name: `In ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'in',
        })),
        outputs: [0, 1, 2, 3].map((i) => ({
          id: `${id}-out${i}`, name: `Out ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'out',
        })),
      })
    }
  }
  const paare = [
    ['dev-0-0', 'dev-1-1'], ['dev-0-1', 'dev-1-0'], ['dev-0-2', 'dev-1-2'],
    ['dev-1-0', 'dev-2-2'], ['dev-1-1', 'dev-2-0'], ['dev-1-2', 'dev-2-1'],
    ['dev-0-0', 'dev-2-0'], ['dev-0-2', 'dev-2-2'],
  ]
  const jetzt = new Date().toISOString()
  return {
    metadata: {
      name: 'Greifzonen-Messszene', description: '', createdAt: jetzt, updatedAt: jetzt,
      defaultVideoFormat: '1080p50', defaultPowerStandard: 'eu-230-1ph', defaultLightingControl: 'dmx512',
    },
    equipment,
    cables: paare.map(([von, nach], i) => ({
      id: `cab-${i}`, name: `Kabel ${i}`, type: 'BNC', length: 10, color: '#3b82f6',
      fromEquipmentId: von, fromPortId: `${von}-out${i % 4}`,
      toEquipmentId: nach, toPortId: `${nach}-in${i % 4}`,
      notes: '', routing: 'orthogonal', arrowEnd: true, layer: 'video',
    })),
    locations: [],
    canvasState: { x: 0, y: 0, zoom: 0.6 },
  }
}

const app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'] })
const win = await app.firstWindow({ timeout: 30000 })
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(3500)

// Die Szene in den Autosave-Schluessel legen und neu laden: der Store liest
// ihn beim Hochfahren (`loadAutosavedProject` in `store/projectStore.ts`).
await win.evaluate((plan) => {
  localStorage.setItem('cable-planner:projectAutosave', plan)
}, JSON.stringify(szene()))
await win.reload()
await win.waitForLoadState('domcontentloaded')
await win.waitForTimeout(3500)
await erststartOverlayWeg(win, { lautScheitern: false })
await win.waitForTimeout(1200)

const kanten = await win.locator('.react-flow__edge').count()
if (kanten === 0) {
  throw new Error(
    'Keine Kabel auf der Flaeche — die Szene ist nicht angekommen, und eine ' +
      'Messung ohne Linien waere still gruen.',
  )
}

const befund = await win.evaluate(() => {
  const kanten = [...document.querySelectorAll('.react-flow__edge')]
  let stellen = 0
  let fremderGriff = 0
  let fremdeAuswahl = 0
  const beispiele = []
  for (const kante of kanten) {
    const id = (kante.getAttribute('data-testid') || '').replace('rf__edge-', '')
    const linie = kante.querySelector('path.react-flow__edge-path')
    if (!linie || !id) continue
    const laenge = linie.getTotalLength()
    const ctm = linie.getScreenCTM()
    if (!ctm || laenge === 0) continue
    for (let i = 1; i < 40; i += 1) {
      const punkt = linie.getPointAtLength((laenge * i) / 40)
      const x = punkt.x * ctm.a + punkt.y * ctm.c + ctm.e
      const y = punkt.x * ctm.b + punkt.y * ctm.d + ctm.f
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue
      const oben = document.elementsFromPoint(x, y).find((el) => el.closest('.react-flow__edge'))
      if (!oben) continue
      stellen += 1
      const griff = oben.closest('.cp-kabelgriff')
      const fremdeKante = (oben.closest('.react-flow__edge').getAttribute('data-testid') || '')
        .replace('rf__edge-', '')
      if (griff) {
        if (griff.getAttribute('data-kabel-id') !== id) {
          fremderGriff += 1
          if (beispiele.length < 8) {
            beispiele.push({
              linieVon: id,
              griffVon: griff.getAttribute('data-kabel-id'),
              x: Math.round(x),
              y: Math.round(y),
            })
          }
        }
      } else if (fremdeKante && fremdeKante !== id) {
        fremdeAuswahl += 1
      }
    }
  }
  return { stellen, fremderGriff, fremdeAuswahl, beispiele }
})

await app.close()

console.log(`Abgetastete Stellen auf gezeichneten Kabellinien: ${befund.stellen}`)
console.log(`Fremder GRIFF obenauf (bewegt ein anderes Kabel): ${befund.fremderGriff}`)
console.log(`Fremder AUSWAHL-Pfad obenauf (waehlt nur aus):    ${befund.fremdeAuswahl}`)

if (befund.fremderGriff > 0) {
  for (const b of befund.beispiele) {
    console.error(
      `✗ auf der Linie von ${b.linieVon} liegt bei (${b.x}, ${b.y}) der Griff von ${b.griffVon}`,
    )
  }
  console.error(
    `\n✗ ${befund.fremderGriff} Stelle(n): wer dort zieht, bewegt ein Kabel, auf das er ` +
      'nicht gezeigt hat. Griff-Zonen gehoeren an das AUSGEWAEHLTE Kabel ' +
      '(siehe Kopf von `src/renderer/components/Canvas/CableWaypoints.tsx`).',
  )
  process.exit(1)
}

console.log('\nGreifzonen fertig (0 Befunde)')
