#!/usr/bin/env node
/**
 * Handbuch-Aufnahmen: Eigenschaften (Inspector rechts).
 *
 *   node scripts/handbuch/bereiche/eigenschaften.mjs de
 *   node scripts/handbuch/bereiche/eigenschaften.mjs en
 *
 * Ausgaben: docs/manual/bilder/<sprache>/eigenschaften-<nn>-<name>.jpg,
 * eigenschaften.<sprache>.json (Schritte + Fehler) und
 * eigenschaften.<sprache>.texte.json (sichtbarer Text und Auswahllisten je
 * Schritt — Grundlage für die Kapiteltexte).
 *
 * Es werden nur ERFUNDENE Beispieldaten eingetippt. Nichts wird abgesendet,
 * hochgeladen oder mit einem Dienst verbunden; Stream-Adressen tragen keine
 * Zugangsdaten (die würden im Schlüsselbund des Rechners landen).
 */

import { starte } from '../app.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sprache = process.argv[2] ?? 'de'

// ── Beispieldateien ─────────────────────────────────────────────────────────
const png = (w, h, rgb) => {
  const zeile = Buffer.alloc(1 + w * 3)
  const roh = Buffer.alloc((1 + w * 3) * h)
  for (let y = 0; y < h; y += 1) {
    zeile[0] = 0
    for (let x = 0; x < w; x += 1) {
      zeile[1 + x * 3] = Math.min(255, rgb[0] + Math.round((x / w) * 60))
      zeile[2 + x * 3] = Math.min(255, rgb[1] + Math.round((y / h) * 60))
      zeile[3 + x * 3] = rgb[2]
    }
    zeile.copy(roh, y * (1 + w * 3))
  }
  const chunk = (typ, daten) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(daten.length)
    const t = Buffer.from(typ)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([t, daten])) >>> 0)
    return Buffer.concat([len, t, daten, crc])
  }
  const kopf = Buffer.alloc(13)
  kopf.writeUInt32BE(w, 0)
  kopf.writeUInt32BE(h, 4)
  kopf[8] = 8
  kopf[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', kopf),
    chunk('IDAT', deflateSync(roh)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const FOTO = { name: 'beispiel-foto.png', mimeType: 'image/png', buffer: png(320, 200, [40, 90, 150]) }

const HAUS = {
  format: 'avplan-facility',
  version: 2,
  gebaeude: {
    name: 'Beispielhaus',
    etagen: [
      { id: 'e0', name: 'Erdgeschoss', hoeheM: 0 },
      { id: 'e1', name: '1. Obergeschoss', hoeheM: 4.2 },
    ],
    raeume: [
      { id: 'r1', name: 'Saal', hausbezeichner: 'S1', etageId: 'e0' },
      { id: 'r2', name: 'Regie', hausbezeichner: 'R1', etageId: 'e1' },
    ],
    punkte: [
      { id: 'p1', bezeichnung: 'Dose S1-01', art: 'dose', raumId: 'r1', anschlussart: 'cee16', absicherungA: 16, dauerleistungW: 3600, geschaltet: true, hinweis: 'Beispieldaten' },
      { id: 'p2', bezeichnung: 'Einspeisung R1', art: 'einspeisung', raumId: 'r2', anschlussart: 'cee32', absicherungA: 32 },
    ],
    klinken: [
      { id: 'k1', system: 'knx', adresse: '1/1/5', bedeutung: 'Saallicht', richtung: 'schalten' },
      { id: 'k2', system: 'dali', adresse: 'A3', bedeutung: 'Status Saal', richtung: 'lesen' },
    ],
    strecken: [
      {
        id: 's1',
        bezeichnung: 'Strecke Saal - Regie',
        vonRaumId: 'r1',
        nachRaumId: 'r2',
        adern: [
          { nr: '1', stecker: 'LC', signal: 'SDI' },
          { nr: '2', stecker: 'LC', signal: 'Reserve' },
        ],
      },
    ],
  },
}
const dir = join(tmpdir(), 'cp-handbuch-eigenschaften')
mkdirSync(dir, { recursive: true })
const hausDatei = join(dir, 'beispielhaus.avfacility')
writeFileSync(hausDatei, JSON.stringify(HAUS))

// ── App und Werkzeuge ───────────────────────────────────────────────────────
const a = await starte({ sprache, breite: 1500, hoehe: 1300 })
const win = a.win
const f = a.folge('eigenschaften')
const texte = {}
const auswahl = {}
const T = (k) => a.text(k)
const insp = () => win.locator('aside.border-l').last()
const bib = () => win.locator('aside.border-r').first()
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pause = (ms = 500) => win.waitForTimeout(ms)

const S = async (name, tun, ziel = insp) => {
  const h = { loc: null }
  await f.schritt(
    name,
    async () => {
      if (tun) await tun()
      h.loc = typeof ziel === 'function' ? await ziel() : ziel
    },
    { ziel: () => h.loc },
  )
  try {
    if (h.loc && (await h.loc.count())) texte[name] = (await h.loc.first().innerText()).replace(/\n{2,}/g, '\n').slice(0, 5000)
  } catch {}
}
const optionen = async (name, loc) => {
  try {
    auswahl[name] = await loc.first().evaluate((s) => [...s.options].map((o) => o.textContent))
  } catch (e) {
    auswahl[name] = `FEHLER ${e.message.split('\n')[0]}`
  }
}
const still = async (fn) => {
  try {
    await fn()
  } catch (e) {
    console.log('  (still) ' + e.message.split('\n')[0])
  }
}

/** Die Kopfzeile (summary) eines Abschnitts nach ihrem Titel. */
const kopfIndex = async (titel, praefix = false) =>
  insp()
    .locator('summary')
    .evaluateAll(
      (els, [t, p]) => {
        const soll = t.toLowerCase()
        return els.findIndex((e) => {
          const span = e.querySelector('span.flex-1')
          const c = [span?.textContent, e.textContent].map((x) => (x ?? '').replace(/^[\s⠿≡]+/, '').trim().toLowerCase())
          return c.some((x) => x === soll) || (p && c[1].startsWith(soll))
        })
      },
      [titel, praefix],
    )
const kopf = async (titel, praefix = false) => {
  const i = await kopfIndex(titel, praefix)
  if (i < 0) throw new Error(`Abschnitt nicht gefunden: ${titel}`)
  return insp().locator('summary').nth(i)
}
const offen = async (titel, praefix = false) => {
  const k = await kopf(titel, praefix)
  const d = k.locator('xpath=..')
  if (!(await d.evaluate((e) => e.open))) {
    await k.click()
    await pause(400)
  }
}
const zuklappen = async (titel, praefix = false) => {
  const k = await kopf(titel, praefix)
  const d = k.locator('xpath=..')
  if (await d.evaluate((e) => e.open)) {
    await k.click()
    await pause(300)
  }
}
const sekDetails = async (titel, praefix = false) => (await kopf(titel, praefix)).locator('xpath=..')
/** Bildziel für einen Abschnitt: löst den details-Knoten beim Aufruf auf. */
const zielAbschnitt = (titel, praefix = false) => {
  const fn = () => sekDetails(titel, praefix)
  fn.vorbereiten = async () => {}
  return fn
}
/** Ein Schritt mit Bild des Abschnitts. */
const SA = (name, titel, tun, { praefix = false } = {}) => S(name, tun, zielAbschnitt(titel, praefix))

const knoten = (n) => win.locator('.react-flow__node').filter({ hasText: n }).first()
const waehleKnoten = async (n) => {
  await knoten(n).evaluate((e) => e.click())
  await pause(700)
}
const titelIns = async () => (await insp().locator('h2').first().innerText()).trim()
const alleAuf = () => insp().getByRole('button', { name: T('props.filter.expand'), exact: true }).click()
const alleZu = () => insp().getByRole('button', { name: T('props.filter.collapse'), exact: true }).click()
const knopf = (key, opt = {}) => insp().getByRole('button', { name: a.muster(key), ...opt }).first()
const ziehen = async (von, nach, dy = 0) => {
  const b1 = await von.boundingBox()
  const b2 = await nach.boundingBox()
  if (!b1 || !b2) throw new Error('Ziehen: keine Box')
  const x1 = b1.x + b1.width / 2
  const y1 = b1.y + b1.height / 2
  const x2 = b2.x + b2.width / 2
  const y2 = b2.y + b2.height / 2 + dy
  await win.mouse.move(x1, y1)
  await win.mouse.down()
  const n = 12
  for (let i = 1; i <= n; i += 1) {
    await win.mouse.move(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n)
    await win.waitForTimeout(30)
  }
  await win.mouse.up()
  await pause(500)
}
const dialogKnopf = async (regex) => {
  const k = a.dialog().getByRole('button', { name: regex }).first()
  await k.click()
  await pause(500)
}
const abbrechen = async () => {
  await still(async () => {
    const k = a.dialog().getByRole('button', { name: new RegExp(`^(${esc(T('common.cancel'))}|Cancel|Abbrechen)$`, 'i') }).first()
    if (await k.count()) await k.click()
    await pause(400)
  })
  await a.zu()
}

console.log(`\nEigenschaften (${sprache})`)

// ════════════════════════════════════════════════════════════════════════════
// 1. NICHTS AUSGEWÄHLT
// ════════════════════════════════════════════════════════════════════════════
await S('nichts-ausgewaehlt', async () => {
  await a.zu()
  await win.mouse.click(700, 800).catch(() => {})
  await pause(500)
})
await S('projektfoto-hinzugefuegt', async () => {
  await insp().locator('input[type=file]').first().setInputFiles(FOTO)
  await pause(1500)
})
await S('projektfoto-notiz', async () => {
  await insp().getByPlaceholder(T('foto.note')).first().fill('Beispielnotiz: Saal von der Empore')
  await pause(400)
})
await S('fenstermenue-offen', async () => {
  await insp().getByRole('button', { name: a.muster('panel.window.button') }).first().click()
  await pause(500)
}, () => a.menueFeld().or(win.locator('[role="menu"]')).last())
await a.zu()
await S('inspektor-eingeklappt', async () => {
  await win.getByRole('button', { name: T('inspector.collapse.hide') }).first().click()
  await pause(600)
}, () => win.locator('aside.border-l').last())
await S('inspektor-wieder-offen', async () => {
  await win.getByRole('button', { name: T('inspector.collapse.show') }).first().click()
  await pause(600)
})

// ════════════════════════════════════════════════════════════════════════════
// 2. GERÄT: KAMERA — fester Kopf, Anschlüsse, Filterleiste
// ════════════════════════════════════════════════════════════════════════════
await S('kamera-gewaehlt', async () => {
  await waehleKnoten('Camera 1')
})
await S('kopf-name-getippt', async () => {
  const feld = insp().locator('label').filter({ hasText: new RegExp(`^\\s*${esc(T('eq.field.name'))}`) }).locator('input').first()
  await feld.fill('Camera 1 links')
  await pause(400)
})
await S('kopf-name-zurueck', async () => {
  const feld = insp().locator('label').filter({ hasText: new RegExp(`^\\s*${esc(T('eq.field.name'))}`) }).locator('input').first()
  await feld.fill('Camera 1')
  await pause(400)
})
await S('kopf-kurzname-stift', async () => {
  await insp().getByRole('button', { name: T('eq.field.shortNameEdit') }).first().click()
  await pause(500)
})
await S('kopf-kurzname-getippt', async () => {
  await insp().locator('input.font-mono').first().fill('KAM1')
  await win.keyboard.press('Enter')
  await pause(500)
})
await S('kopf-kurzname-auto', async () => {
  await insp().getByRole('button', { name: T('eq.field.shortNameEdit') }).first().click()
  await pause(400)
  await insp().getByRole('button', { name: a.muster('eq.field.shortNameAuto') }).first().click({ timeout: 4000 }).catch(() => {})
  await win.keyboard.press('Escape')
  await pause(500)
})
await S('kopf-untertitel', async () => {
  await insp().getByPlaceholder(T('eq.field.subtitlePlaceholder')).first().fill('Bühne links')
  await pause(400)
})
await S('kopf-notiz', async () => {
  await insp().getByPlaceholder(a.muster('eq.field.notesPlaceholder')).first().fill('Beispielnotiz: Stativ steht hinter dem Vorhang.')
  await pause(400)
})

// ── Anschlüsse ──────────────────────────────────────────────────────────────
const portsTitel = () => T('portsSection.title')
const portsBild = zielAbschnitt(portsTitel())
await S('ports-abschnitt', async () => {
  await portsBild.vorbereiten()
}, portsBild)
const neuerPort = () => insp().locator('details').filter({ hasText: /./ }).locator('li').last()
await S('ports-eingang-hinzu', async () => {
  await insp().getByRole('button', { name: T('ports.add'), exact: true }).first().click()
  await pause(600)
  await portsBild.vorbereiten()
}, portsBild)
const karte = () => insp().locator('li').filter({ has: win.locator('select[aria-label]') }).first()
await S('ports-nummer-name', async () => {
  const k = karte()
  await k.locator('input[type=number]').first().fill('7')
  await k.getByPlaceholder(T('ports.namePlaceholder')).fill('Genlock In')
  await pause(400)
}, () => karte())
await still(() => optionen('anschlusstyp', karte().locator(`select[aria-label="${T('ports.aria.connector')}"]`)))
await still(() => optionen('signalstandard', karte().locator(`select[aria-label="${T('ports.aria.signal')}"]`)))
await still(() => optionen('portrichtung', karte().locator(`select[aria-label="${T('ports.aria.direction')}"]`)))
await still(() => optionen('portseite', karte().locator(`select[aria-label="${T('ports.aria.side')}"]`)))
await still(() => optionen('portgeschlecht', karte().locator(`select[aria-label="${T('ports.aria.gender')}"]`)))
await S('ports-anschlusstyp-bnc', async () => {
  await karte().locator(`select[aria-label="${T('ports.aria.connector')}"]`).selectOption('BNC')
  await pause(500)
}, () => karte())
await S('ports-signal-inhalt-richtung', async () => {
  const k = karte()
  await k.locator(`select[aria-label="${T('ports.aria.signal')}"]`).selectOption('SDI-3G')
  await k.getByPlaceholder(a.muster('ports.contentLabelPlaceholder')).fill('PGM')
  await k.locator(`select[aria-label="${T('ports.aria.direction')}"]`).selectOption('in')
  await k.locator(`select[aria-label="${T('ports.aria.side')}"]`).selectOption('left')
  await k.locator(`select[aria-label="${T('ports.aria.gender')}"]`).selectOption('female')
  await pause(500)
}, () => karte())
await S('ports-sdi-faehigkeiten', async () => {
  await karte().locator('details').filter({ hasText: /./ }).first().locator('summary').click()
  await pause(500)
}, () => karte())
await S('ports-sdi-quadlink-neu', async () => {
  const sel = karte().locator('details select').filter({ has: win.locator(`option[value="__new__"]`) }).first()
  await sel.selectOption('__new__')
  await pause(800)
}, () => a.dialog())
await abbrechen()
await S('ports-gruppe-neu', async () => {
  const sel = karte().locator(`select[aria-label="${T('ports.group.aria')}"]`)
  await sel.selectOption('__new__')
  await pause(600)
}, () => karte())
await still(() => optionen('portgruppe-art', karte().locator(`select[aria-label="${T('ports.group.kindAria')}"]`)))
await S('ports-gruppe-art-stereo', async () => {
  await karte().locator(`select[aria-label="${T('ports.group.kindAria')}"]`).selectOption('stereo')
  await pause(400)
  await still(() => optionen('portgruppe-rolle', karte().locator(`select[aria-label="${T('ports.group.roleAria')}"]`)))
  await karte().locator(`select[aria-label="${T('ports.group.roleAria')}"]`).selectOption({ index: 1 })
  await pause(400)
}, () => karte())
await S('ports-anschlusstyp-faser', async () => {
  await karte().locator(`select[aria-label="${T('ports.aria.connector')}"]`).selectOption('Fiber')
  await pause(600)
}, () => karte())
await S('ports-faser-duo', async () => {
  await karte().getByRole('button', { name: T('fibre.template2') }).click()
  await pause(600)
}, () => karte())
await optionen('faser-rolle', karte().locator('select').filter({ has: win.locator('option[value="tx"]') }))
await S('ports-faser-hinzu', async () => {
  await karte().getByRole('button', { name: a.muster('fibre.add') }).click()
  await pause(500)
  await karte().locator('select').filter({ has: win.locator('option[value="tx"]') }).first().selectOption('tx')
  await pause(400)
}, () => karte())
await S('ports-sfp-modul', async () => {
  const k = karte()
  await k.getByPlaceholder(T('ports.sfp.typePlaceholder')).fill('SFP+')
  await k.getByPlaceholder(T('ports.sfp.standardPlaceholder')).fill('10G-LR')
  await k.getByPlaceholder(a.muster('ports.sfp.wavelengthPlaceholder')).fill('1310')
  await k.getByPlaceholder(a.muster('ports.sfp.vendorPlaceholder')).fill('Beispielhersteller')
  await pause(400)
}, () => karte())
await still(() => optionen('sfp-steckverbinder', karte().locator('select').filter({ has: win.locator('option[value="MPO-MTP"]') })))
await still(() => optionen('sfp-faserklasse', karte().locator('select').filter({ has: win.locator('option[value="OM4"]') })))
await S('ports-eigener-anschlusstyp-dialog', async () => {
  await karte().locator(`select[aria-label="${T('ports.aria.connector')}"]`).selectOption('__new__')
  await pause(700)
}, () => a.dialog())
await abbrechen()
await S('ports-eingang-entfernt', async () => {
  await karte().getByRole('button', { name: T('ports.remove') }).click()
  await pause(600)
  await portsBild.vorbereiten()
}, portsBild)

// Listen tauschen
await S('ports-listen-tauschen-vorher', async () => {
  await portsBild.vorbereiten()
}, portsBild)
await S('ports-listen-getauscht', async () => {
  const griffe = insp().getByRole('button', { name: T('ports.listMove') })
  const ziel = insp().locator('summary').filter({ hasText: new RegExp(T('ports.title.outputs')) }).first()
  await ziehen(griffe.first(), ziel, 30)
  await portsBild.vorbereiten()
}, portsBild)
await S('ports-spiegeln-haken', async () => {
  await insp().getByRole('checkbox', { name: a.muster('ports.flip') }).click()
  await pause(500)
  await portsBild.vorbereiten()
}, portsBild)
await S('ports-spiegeln-canvas', async () => {
  await pause(300)
}, () => knoten('Camera 1'))
await still(async () => {
  await insp().getByRole('checkbox', { name: a.muster('ports.flip') }).click()
  await pause(400)
})

// ── Filterleiste, Auf-/Zuklappen, Reihenfolge ──────────────────────────────
await S('filter-leiste', async () => {
  await pause(200)
}, () => insp().locator('input').first().locator('xpath=..'))
await S('filter-dmx-getippt', async () => {
  await insp().getByPlaceholder(a.muster('props.filter.placeholder')).fill('dmx')
  await pause(600)
})
await S('filter-loeschen', async () => {
  await insp().getByRole('button', { name: T('props.filter.clear') }).first().click()
  await pause(500)
})
await S('alle-zugeklappt', async () => {
  await alleZu()
  await pause(600)
})
await S('alle-aufgeklappt', async () => {
  await alleAuf()
  await pause(900)
})
await alleZu()
await pause(500)
await S('abschnitt-reihenfolge-vorher', async () => {}, () => insp())
await S('abschnitt-reihenfolge-gezogen', async () => {
  const griff = insp().locator(`[role=button][aria-label="${T('props.section.dragAria')}"]`)
  const n = await griff.count()
  if (n < 3) throw new Error('zu wenige Griffe: ' + n)
  await ziehen(griff.nth(n - 1), griff.nth(1), -20)
})

// ════════════════════════════════════════════════════════════════════════════
// 3. ABSCHNITTE (Kamera)
// ════════════════════════════════════════════════════════════════════════════
await alleZu()
await pause(400)

const sektionen = [
  ['optional', T('opt.title')],
  ['fotos', T('foto.section')],
  ['flags', T('flags.title')],
  ['quelle', T('sourceIdentity.title')],
  ['netz', T('netAccess.title')],
  ['streams', T('streams.title')],
]
// Optionale Felder
await SA('opt-offen', T('opt.title'), () => offen(T('opt.title')))
await SA('opt-verifizieren-dialog', T('opt.title'), async () => {
  await insp().getByRole('button', { name: T('verify.button') }).first().click()
  await pause(700)
})
if (await a.dialog().count()) {
  await S('opt-verifizieren-name', async () => {
    await a.dialog().locator('input').first().fill('Beispielnutzer')
    await pause(300)
  }, () => a.dialog())
  await still(async () => {
    await a.dialog().getByRole('button').last().click()
    await pause(600)
  })
}
await SA('opt-verifiziert', T('opt.title'), async () => {
  await a.zu()
})
await SA('opt-miete-link-preis', T('opt.title'), async () => {
  await insp().getByPlaceholder(T('eq.field.rentPricePlaceholder')).fill('45')
  await insp().getByPlaceholder('EUR').fill('eur')
  await insp().getByPlaceholder('https://…').fill('https://example.com/datenblatt')
  await insp().getByPlaceholder(T('eq.field.priceEURPlaceholder')).fill('1200')
  await pause(500)
})
await SA('opt-symbol', T('opt.title'), async () => {
  await insp().locator('button[title*="📷"]').first().click()
  await pause(500)
})
await S('opt-symbol-canvas', async () => {}, () => knoten('Camera 1'))
await SA('opt-symbol-auto', T('opt.title'), async () => {
  await insp().locator(`button[title="${T('opt.iconAutoTitle')}"]`).first().click()
  await pause(400)
})
await zuklappen(T('opt.title'))

// Fotos
await SA('fotos-offen', T('foto.section'), () => offen(T('foto.section')))
await SA('fotos-hinzugefuegt', T('foto.section'), async () => {
  const d = await sekDetails(T('foto.section'))
  await d.locator('input[type=file]').first().setInputFiles(FOTO)
  await pause(1500)
})
await SA('fotos-notiz', T('foto.section'), async () => {
  const d = await sekDetails(T('foto.section'))
  await d.getByPlaceholder(T('foto.note')).first().fill('Aufbau am Vortag')
  await pause(400)
})
await zuklappen(T('foto.section'))

// Anzeige und Markierungen
await SA('flags-offen', T('flags.title'), () => offen(T('flags.title')))
await SA('flags-kompakt', T('flags.title'), async () => {
  await insp().getByRole('checkbox', { name: a.muster('eq.field.compact') }).check()
  await pause(500)
})
await S('flags-kompakt-canvas', async () => {}, () => knoten('Camera 1'))
await SA('flags-farbe-eingepackt', T('flags.title'), async () => {
  await insp().getByRole('checkbox', { name: a.muster('flags.packed') }).check()
  await pause(500)
})
await S('flags-eingepackt-canvas', async () => {}, () => knoten('Camera 1'))
await SA('flags-wandler-da', T('flags.title'), async () => {
  await insp().getByRole('checkbox', { name: a.muster('flags.converter') }).check()
  await insp().getByRole('checkbox', { name: a.muster('flags.da') }).check()
  await pause(500)
})
await still(() => optionen('rolle-timecode', insp().locator('label').filter({ hasText: T('roles.tc') }).locator('select')))
await still(() => optionen('rolle-einbettung', insp().locator('label').filter({ hasText: T('roles.embed') }).locator('select')))
await SA('flags-rollen', T('flags.title'), async () => {
  await insp().locator('label').filter({ hasText: T('roles.tc') }).locator('select').selectOption('source')
  await insp().locator('label').filter({ hasText: T('roles.tally') }).locator('select').selectOption('sink')
  await insp().locator('label').filter({ hasText: T('roles.embed') }).locator('select').selectOption('embedder')
  await pause(500)
})
await still(async () => {
  for (const k of ['eq.field.compact', 'flags.packed', 'flags.converter', 'flags.da']) {
    await insp().getByRole('checkbox', { name: a.muster(k) }).uncheck()
  }
  for (const k of ['roles.tc', 'roles.tally', 'roles.embed']) {
    await insp().locator('label').filter({ hasText: T(k) }).locator('select').selectOption('')
  }
})
await zuklappen(T('flags.title'))

// Rentman-Hinweis und Kategorie
await S('rentman-hinweis-kategorie', async () => {
  await pause(300)
}, () => insp().locator('label').filter({ hasText: T('eq.field.category') }).first().locator('xpath=..'))

// Signalquelle (Rolle)
await SA('quelle-offen', T('sourceIdentity.title'), () => offen(T('sourceIdentity.title')))
await still(() => optionen('rolle-auswahl', insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('sourceIdentity.role'))) }).locator('select')))
await SA('quelle-neue-rolle', T('sourceIdentity.title'), async () => {
  await insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('sourceIdentity.role'))) }).locator('select').selectOption('__new__')
  await pause(700)
})
await SA('quelle-name-nummer-umd', T('sourceIdentity.title'), async () => {
  const d = await sekDetails(T('sourceIdentity.title'))
  await d.locator('label').filter({ hasText: T('sourceIdentity.name') }).locator('input').fill('Kamera Links')
  await d.locator('label').filter({ hasText: T('sourceIdentity.number') }).locator('input').fill('1')
  await d.locator('input[type=number]').last().fill('1')
  await pause(700)
})
await SA('quelle-umd-ungueltig', T('sourceIdentity.title'), async () => {
  const d = await sekDetails(T('sourceIdentity.title'))
  await d.locator('input[type=number]').last().fill('999999')
  await pause(500)
})
await SA('quelle-rolle-entfernt', T('sourceIdentity.title'), async () => {
  const d = await sekDetails(T('sourceIdentity.title'))
  await d.getByRole('button', { name: a.muster('sourceIdentity.remove') }).click()
  await pause(600)
})
await zuklappen(T('sourceIdentity.title'))

// Netzwerk und Zugang
await SA('netz-offen', T('netAccess.title'), () => offen(T('netAccess.title')))
await SA('netz-adresse-kennungen', T('netAccess.title'), async () => {
  const d = await sekDetails(T('netAccess.title'))
  await d.getByPlaceholder('192.168.1.10', { exact: true }).fill('192.168.10.21')
  await d.getByPlaceholder(T('eq.field.serialPlaceholder')).fill('SN-0042')
  await d.getByPlaceholder('AV-0421').fill('AV-0421')
  await d.getByPlaceholder('INV-2026-017').fill('INV-2026-017')
  await pause(500)
})
await SA('netz-maske-gateway-vlan-mac', T('netAccess.title'), async () => {
  const d = await sekDetails(T('netAccess.title'))
  await d.getByPlaceholder(a.muster('eq.field.subnetPlaceholder')).fill('255.255.255.0')
  await d.getByPlaceholder('192.168.1.1', { exact: true }).first().fill('192.168.10.1')
  await d.getByPlaceholder('10', { exact: true }).fill('10')
  await d.getByPlaceholder('00:1A:2B:3C:4D:5E').fill('00:1A:2B:3C:4D:5E')
  await pause(500)
})
await SA('netz-zugang', T('netAccess.title'), async () => {
  const d = await sekDetails(T('netAccess.title'))
  await d.locator('label').filter({ hasText: T('eq.field.username') }).locator('input').fill('admin')
  await d.locator('input[type=password]').fill('Beispiel-Passwort')
  await pause(500)
})
await SA('netz-passwort-sichtbar', T('netAccess.title'), async () => {
  const d = await sekDetails(T('netAccess.title'))
  await d.getByRole('button', { name: T('eq.field.passwordShow') }).click()
  await pause(500)
})
await SA('netz-schnittstelle-hinzu', T('netAccess.title'), async () => {
  const d = await sekDetails(T('netAccess.title'))
  await d.getByRole('button', { name: a.muster('nic.add') }).click()
  await pause(700)
})
await still(() => optionen('schnittstelle-rolle', insp().locator(`select[aria-label="${T('nic.role')}"]`)))
await still(() => optionen('ptp-profil', insp().locator(`select[aria-label="${T('nic.ptpProfile')}"]`)))
await still(() => optionen('ptp-rolle', insp().locator(`select[aria-label="${T('nic.ptpRole')}"]`)))
await still(() => optionen('erste-schnittstelle-rolle', insp().locator('label').filter({ hasText: T('nic.primaryRole') }).locator('select')))
await SA('netz-schnittstelle-gefuellt', T('netAccess.title'), async () => {
  const d = await sekDetails(T('netAccess.title'))
  await d.getByPlaceholder(a.muster('nic.label')).fill('Dante Sec')
  await d.locator(`select[aria-label="${T('nic.role')}"]`).selectOption({ index: 2 })
  await d.getByPlaceholder('10.0.1.10').fill('10.0.1.21')
  await d.getByPlaceholder('255.255.255.0', { exact: true }).last().fill('255.255.255.0')
  await d.getByPlaceholder('VLAN').fill('20')
  await d.getByPlaceholder(T('nic.ptpDomain')).fill('0')
  await d.locator(`select[aria-label="${T('nic.ptpProfile')}"]`).selectOption('aes67')
  await d.locator(`select[aria-label="${T('nic.ptpRole')}"]`).selectOption('slave')
  await pause(500)
})
await zuklappen(T('netAccess.title'))

// Streams
await SA('streams-offen', T('streams.title'), () => offen(T('streams.title')))
await SA('streams-hinzu', T('streams.title'), async () => {
  const d = await sekDetails(T('streams.title'))
  await d.getByRole('button', { name: a.muster('streams.add') }).click()
  await pause(600)
})
await still(() => optionen('stream-protokoll', insp().locator(`select[aria-label="${T('streams.protocol')}"]`)))
await still(() => optionen('stream-richtung', insp().locator(`select[aria-label="${T('streams.direction')}"]`)))
await SA('streams-gefuellt', T('streams.title'), async () => {
  const d = await sekDetails(T('streams.title'))
  await d.getByPlaceholder(a.muster('streams.label')).fill('Main')
  const url = d.locator(`input[aria-label="${T('streams.url')}"]`)
  await url.fill('rtsp://192.168.10.21:554/stream1')
  await url.blur()
  await d.getByPlaceholder(T('streams.port')).fill('554')
  await d.getByPlaceholder(T('streams.codec')).fill('H.264')
  await d.getByPlaceholder(a.muster('streams.format')).fill('1080p50')
  await pause(700)
})
await SA('streams-vorschau-adresse', T('streams.title'), async () => {
  const d = await sekDetails(T('streams.title'))
  const v = d.locator(`input[aria-label="${T('streams.previewUrl')}"]`)
  await v.fill('http://192.168.10.21/snapshot.jpg')
  await v.blur()
  await pause(700)
})
await zuklappen(T('streams.title'))

// Lebenszyklus (Modul Festinstallation / Vermietung)
await SA('lebenszyklus-offen', T('lifecycle.section'), () => offen(T('lifecycle.section')))
await still(() => optionen('lz-status', insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('lifecycle.status'))) }).locator('select')))
await still(() => optionen('lz-eigentum', insp().locator('label').filter({ hasText: T('lifecycle.ownership') }).locator('select')))
await still(() => optionen('lz-art', insp().locator('select').filter({ has: win.locator('option[value="inspection"]') })))
await SA('lebenszyklus-status-garantie', T('lifecycle.section'), async () => {
  const d = await sekDetails(T('lifecycle.section'))
  await d.locator('select').first().selectOption({ index: 2 })
  await d.locator('input[type=date]').first().fill('2028-06-30')
  await d.locator('input[type=number]').first().fill('365')
  await pause(500)
})
await SA('lebenszyklus-lager', T('lifecycle.section'), async () => {
  const d = await sekDetails(T('lifecycle.section'))
  await d.locator('label').filter({ hasText: T('lifecycle.ownership') }).locator('select').selectOption({ index: 1 })
  await d.locator('label').filter({ hasText: T('lifecycle.purchaseDate') }).locator('input').fill('2025-03-01')
  await d.getByPlaceholder(a.muster('lifecycle.stockLocationPh')).fill('Lager A, Regal 3.2')
  await d.locator('label').filter({ hasText: T('lifecycle.supplier') }).locator('input').fill('Beispiellieferant')
  await pause(500)
})
await SA('lebenszyklus-historie', T('lifecycle.section'), async () => {
  const d = await sekDetails(T('lifecycle.section'))
  await d.getByPlaceholder(T('lifecycle.history.placeholder')).fill('Objektiv gereinigt')
  await d.getByRole('button', { name: a.muster('common.add') }).last().click()
  await pause(600)
})
await zuklappen(T('lifecycle.section'))

// Optik (nur mit MultiCam-Daten) und steuerbare Funktionen
await S('optik-sichtbar', async () => {
  const n = await insp().locator('summary').filter({ hasText: T('props.optik.title') }).count()
  texte['optik-sichtbar-anzahl'] = n
  if (n === 0) throw new Error('Optik-Abschnitt nicht sichtbar (kein MultiCam-Plan geladen)')
})
await SA('kamerasteuerung', T('props.cameraControls.title'), () => offen(T('props.cameraControls.title')))
await zuklappen(T('props.cameraControls.title'))

// Stromverbrauch
await SA('strom-offen', T('power.title'), () => offen(T('power.title')))
await SA('strom-werte', T('power.title'), async () => {
  const d = await sekDetails(T('power.title'))
  await d.getByPlaceholder(T('power.voltagePlaceholder')).fill('230')
  await d.getByPlaceholder(T('power.currentPlaceholder')).fill('1.5')
  await pause(500)
})
await zuklappen(T('power.title'))

// Schaltbild (Strom)
await SA('stromkreis-offen', T('circuit.title'), () => offen(T('circuit.title')))
await still(() => optionen('stromkreis-rolle', insp().locator('label').filter({ hasText: T('circuit.kind') }).locator('select')))
await SA('stromkreis-rolle', T('circuit.title'), async () => {
  await insp().locator('label').filter({ hasText: T('circuit.kind') }).locator('select').selectOption({ index: 1 })
  await pause(600)
})
await SA('stromkreis-klemme', T('circuit.title'), async () => {
  const d = await sekDetails(T('circuit.title'))
  const s = d.locator('select').nth(1)
  if (await s.count()) await s.selectOption({ index: 1 })
  await pause(500)
})
await still(async () => {
  await insp().locator('label').filter({ hasText: T('circuit.kind') }).locator('select').selectOption('')
})
await zuklappen(T('circuit.title'))

// Adapter
await SA('adapter-offen', T('adapter.title'), () => offen(T('adapter.title')))
await SA('adapter-haken', T('adapter.title'), async () => {
  await insp().getByRole('checkbox', { name: a.muster('adapter.isAdapter') }).check()
  await pause(600)
})
await still(() => optionen('adapter-richtung', insp().locator('label').filter({ hasText: T('adapter.richtung') }).locator('select')))
await still(() => optionen('adapter-speisung', insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('adapter.speisung'))) }).locator('select')))
await SA('adapter-gefuellt', T('adapter.title'), async () => {
  const d = await sekDetails(T('adapter.title'))
  await d.locator('label').filter({ hasText: T('adapter.von') }).locator('select').selectOption('HDMI')
  await d.locator('label').filter({ hasText: T('adapter.nach') }).locator('select').selectOption('BNC')
  await d.locator('label').filter({ hasText: T('adapter.richtung') }).locator('select').selectOption({ index: 1 })
  await d.locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('adapter.speisung'))) }).locator('select').selectOption({ index: 1 })
  await d.locator('label').filter({ hasText: T('adapter.grenze') }).locator('select').selectOption('SDI-3G')
  await d.getByPlaceholder(a.muster('adapter.setztVorausPlaceholder')).fill('Beispielanforderung')
  await d.locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('adapter.notiz'))) }).locator('input').fill('Beispielnotiz')
  await pause(600)
})
await SA('adapter-kann', T('adapter.title'), async () => {
  const d = await sekDetails(T('adapter.title'))
  await d.getByPlaceholder(a.muster('adapter.kannPlaceholder')).fill('DisplayPort Alternate Mode, USB-PD')
  await pause(500)
})
await still(async () => {
  await insp().getByRole('checkbox', { name: a.muster('adapter.isAdapter') }).uncheck()
  await insp().getByPlaceholder(a.muster('adapter.kannPlaceholder')).fill('')
})
await zuklappen(T('adapter.title'))

// DMX
await SA('dmx-offen', T('dmx.title'), () => offen(T('dmx.title'), false))
await SA('dmx-haken', T('dmx.title'), async () => {
  await insp().getByRole('checkbox', { name: a.muster('dmx.isDmxDevice') }).check()
  await pause(600)
})
await SA('dmx-modus-hinzu', T('dmx.title'), async () => {
  await insp().getByRole('button', { name: a.muster('dmx.addMode') }).click()
  await pause(600)
})
await still(() => optionen('dmx-herkunft', insp().locator('select[title]').filter({ has: win.locator('option[value="gdtf"]') })))
await SA('dmx-gefuellt', T('dmx.title'), async () => {
  const d = await sekDetails(T('dmx.title'))
  await d.getByPlaceholder('Robe').fill('Beispielhersteller')
  await d.getByPlaceholder('Robin MegaPointe').fill('Beispielmodell')
  await d.locator('input[type=radio]').first().check()
  await d.locator('ul input[type=number]').first().fill('24')
  await d.locator('label').filter({ hasText: T('dmx.universe') }).locator('input').fill('2')
  await d.locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('dmx.address'))) }).locator('input').fill('101')
  await pause(600)
})
await SA('dmx-festgesetzt', T('dmx.title'), async () => {
  await insp().getByRole('checkbox', { name: a.muster('dmx.pinned') }).check()
  await pause(500)
})
await still(async () => {
  await insp().getByRole('checkbox', { name: a.muster('dmx.isDmxDevice') }).uncheck()
})
await zuklappen(T('dmx.title'))

// Hausanschluss
await SA('haus-offen', T('haus.title'), () => offen(T('haus.title')))
await SA('haus-geladen', T('haus.title'), async () => {
  const d = await sekDetails(T('haus.title'))
  await d.locator('input[type=file]').setInputFiles(hausDatei)
  await pause(900)
})
await still(() => optionen('haus-punkt', insp().locator('label').filter({ hasText: T('haus.punkt') }).locator('select')))
await still(() => optionen('haus-klinke', insp().locator('label').filter({ hasText: T('haus.klinke') }).locator('select')))
await SA('haus-zugeordnet', T('haus.title'), async () => {
  await insp().locator('label').filter({ hasText: T('haus.punkt') }).locator('select').selectOption('p1')
  await insp().locator('label').filter({ hasText: T('haus.klinke') }).locator('select').selectOption('k1')
  await pause(600)
})
await zuklappen(T('haus.title'))

// Senkenprofil
await SA('senke-offen', T('sink.title'), () => offen(T('sink.title')))
await SA('senke-haken', T('sink.title'), async () => {
  await insp().getByRole('checkbox', { name: a.muster('sink.declare') }).check()
  await pause(600)
})
await SA('senke-format-hinzu', T('sink.title'), async () => {
  await insp().getByRole('button', { name: a.muster('sink.addFormat') }).click()
  await pause(700)
})
await still(() => optionen('senke-format', insp().locator(`select[aria-label="${T('sink.format')}"]`)))
await SA('senke-gefuellt', T('sink.title'), async () => {
  const d = await sekDetails(T('sink.title'))
  await d.locator('input[type=text], input:not([type])').first().fill('Datenblatt Beispielmonitor').catch(() => {})
  const boxen = d.locator('input[type=checkbox]')
  const n = await boxen.count()
  for (let i = 1; i < Math.min(n, 4); i += 1) await boxen.nth(i).check()
  await pause(500)
})
await still(async () => {
  await insp().getByRole('checkbox', { name: a.muster('sink.declare') }).uncheck()
})
await zuklappen(T('sink.title'))

// Abmessungen
await SA('masse-offen', T('dims.title'), () => offen(T('dims.title')))
await SA('masse-gefuellt', T('dims.title'), async () => {
  await insp().getByPlaceholder(T('dims.widthPlaceholder')).fill('482')
  await insp().getByPlaceholder(T('dims.heightPlaceholder')).fill('44')
  await insp().getByPlaceholder(T('dims.depthPlaceholder')).fill('400')
  await pause(500)
})
await zuklappen(T('dims.title'))

// Betriebsarten
await SA('modi-offen', T('props.modes.title'), () => offen(T('props.modes.title')))
await S('modi-editor-neu', async () => {
  await insp().getByRole('button', { name: a.muster('modes.newEditor') }).click()
  await pause(800)
}, () => a.dialog())
await S('modi-editor-gefuellt', async () => {
  const d = a.dialog()
  await d.getByPlaceholder(a.muster('modeEditor.namePlaceholder')).fill('12G Single-Link')
  await d.getByPlaceholder(a.muster('modeEditor.descPlaceholder')).fill('Beispielbeschreibung')
  await d.getByRole('button', { name: a.muster('modeEditor.seedBtn') }).click().catch(() => {})
  await pause(500)
}, () => a.dialog())
await S('modi-editor-anschluss-hinzu', async () => {
  await a.dialog().getByRole('button', { name: new RegExp('\\+\\s*' + esc(T('modeEditor.addPort'))) }).first().click()
  await pause(500)
}, () => a.dialog())
await S('modi-angelegt', async () => {
  await a.dialog().getByRole('button', { name: a.muster('modeEditor.createBtn') }).click()
  await pause(700)
  await a.zu()
}, zielAbschnitt(T('props.modes.title')))
await SA('modi-aus-anschluessen', T('props.modes.title'), async () => {
  await insp().getByRole('button', { name: a.muster('modes.quickSave') }).click()
  await pause(700)
})
await S('modi-aus-anschluessen-dialog', async () => {}, () => a.dialog())
await still(async () => {
  await a.dialog().locator('input').first().fill('4K-Betrieb')
  await a.dialog().getByRole('button').last().click()
  await pause(700)
})
await SA('modi-liste', T('props.modes.title'), async () => {
  await a.zu()
})
await SA('modi-loeschen-dialog', T('props.modes.title'), async () => {
  await insp().getByRole('button', { name: T('modes.deleteTitle') }).last().click()
  await pause(700)
})
await S('modi-loeschen-frage', async () => {}, () => a.dialog())
await abbrechen()
await zuklappen(T('props.modes.title'))

// Bibliothek speichern
await SA('bib-speichern-offen', T('libSave.title'), () => offen(T('libSave.title')))
await S('bib-speichern-vorlage-frage', async () => {
  await insp().getByRole('button', { name: a.muster('libSave.btnSave') }).first().click()
  await pause(700)
}, () => a.dialog())
await abbrechen()
await S('bib-speichern-neu-frage', async () => {
  await insp().getByRole('button', { name: T('libSave.newBtn') }).first().click()
  await pause(700)
}, () => a.dialog())
await abbrechen()
await zuklappen(T('libSave.title'))

// Katalog
await SA('katalog-offen', T('eq.catalogue.title'), () => offen(T('eq.catalogue.title')))
await SA('katalog-manuell', T('eq.catalogue.title'), async () => {
  const d = await sekDetails(T('eq.catalogue.title'))
  await d.locator('summary').filter({ hasText: T('eq.catalogue.choose') }).click()
  await pause(500)
})
await SA('katalog-suche', T('eq.catalogue.title'), async () => {
  const d = await sekDetails(T('eq.catalogue.title'))
  await d.getByPlaceholder(a.muster('eq.field.deviceTypeFilter')).fill('camera')
  await pause(600)
})
await zuklappen(T('eq.catalogue.title'))

// Gerät ersetzen
await SA('ersetzen-offen', T('replaceDevice.title'), () => offen(T('replaceDevice.title')))
await SA('ersetzen-liste', T('replaceDevice.title'), async () => {
  await insp().getByRole('button', { name: a.muster('replaceDevice.btn') }).click()
  await pause(700)
})
await SA('ersetzen-suche', T('replaceDevice.title'), async () => {
  await insp().getByPlaceholder(a.muster('replaceDevice.searchPlaceholder')).fill('camera')
  await pause(700)
})
await S('ersetzen-bestaetigung', async () => {
  const d = await sekDetails(T('replaceDevice.title'))
  await d.locator('ul li button').first().click()
  await pause(800)
}, () => a.dialog())
await abbrechen()
await zuklappen(T('replaceDevice.title'))

// Druck / Dokumentation
await SA('druck-offen', T('printSection.title'), () => offen(T('printSection.title')))
await S('datenblatt-dialog', async () => {
  await insp().getByRole('button', { name: a.muster('printSection.datasheetBtn') }).click()
  await pause(1200)
}, () => a.dialog())
await S('datenblatt-alle', async () => {
  await a.dialog().getByRole('button', { name: T('datasheet.selectAll'), exact: true }).click()
  await pause(500)
}, () => a.dialog())
await S('datenblatt-keine', async () => {
  await a.dialog().getByRole('button', { name: T('datasheet.selectNone'), exact: true }).click()
  await pause(500)
}, () => a.dialog())
await S('datenblatt-gefuellte', async () => {
  await a.dialog().getByRole('button', { name: T('datasheet.selectFilled'), exact: true }).click()
  await pause(500)
}, () => a.dialog())
await still(async () => {
  await a.zu()
})
await zuklappen(T('printSection.title'))

// ════════════════════════════════════════════════════════════════════════════
// 4. MISCHER: Schaltung, Reihenfolge der Anschlüsse, Rack
// ════════════════════════════════════════════════════════════════════════════
await S('mischer-gewaehlt', async () => {
  await waehleKnoten('Vision mixer')
})
await alleZu()
await SA('schaltung-offen', T('switching.title'), () => offen(T('switching.title')))
await still(() => optionen('schaltung-protokoll', insp().locator('label').filter({ hasText: T('switching.protocol') }).locator('select')))
await SA('schaltung-kreuzpunkt', T('switching.title'), async () => {
  const d = await sekDetails(T('switching.title'))
  const sel = d.locator('label').filter({ has: win.locator('option', { hasText: T('switching.unset') }) }).locator('select')
  await sel.first().selectOption({ index: 1 })
  await pause(600)
})
const protokollWahl = async (wert) => {
  await insp().locator('label').filter({ hasText: T('switching.protocol') }).locator('select').selectOption(wert)
  await pause(700)
}
await SA('schaltung-protokoll-atem', T('switching.title'), () => protokollWahl('atem'))
await still(() => optionen('schaltung-ziel', insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('switching.target'))) }).locator('select')))
await SA('schaltung-protokoll-text', T('switching.title'), () => protokollWahl('text'))
await still(() => optionen('schaltung-zeilenanfang', insp().locator('label').filter({ hasText: T('switching.textStart') }).locator('select')))
await still(() => optionen('schaltung-zeilenende', insp().locator('label').filter({ hasText: T('switching.textEnd') }).locator('select')))
await SA('schaltung-text-vorlage', T('switching.title'), async () => {
  const d = await sekDetails(T('switching.title'))
  await d.getByPlaceholder('.S{level}{out},{in}').fill('ROUTE {out} {in}')
  await pause(600)
})
await SA('schaltung-protokoll-companion', T('switching.title'), () => protokollWahl('companion'))
await SA('schaltung-protokoll-videohub', T('switching.title'), () => protokollWahl('videohub'))
await SA('schaltung-protokoll-keins', T('switching.title'), () => protokollWahl(''))
await zuklappen(T('switching.title'))

await SA('rack-offen', T('props.rack.title'), () => offen(T('props.rack.title')))
await SA('rack-haken', T('props.rack.title'), async () => {
  await insp().getByRole('checkbox', { name: a.muster('props.rack.isRack') }).check()
  await pause(700)
})
await still(() => optionen('rack-ansicht', insp().locator('label').filter({ hasText: T('props.rack.view') }).locator('select')))
await SA('rack-hoehe-ansicht', T('props.rack.title'), async () => {
  const d = await sekDetails(T('props.rack.title'))
  await d.locator('input[type=number]').first().fill('2')
  await d.locator('label').filter({ hasText: T('props.rack.view') }).locator('select').selectOption('both')
  await pause(700)
})
await zuklappen(T('props.rack.title'))

// Anschlüsse umsortieren (Mischer hat mehrere Eingänge)
await SA('ports-mischer', T('portsSection.title'), async () => {})
await SA('ports-umsortiert', T('portsSection.title'), async () => {
  const griffe = insp().locator(`button[aria-label^="${T('ports.reorderAria').split('{')[0]}"]`)
  const n = await griffe.count()
  if (n < 2) throw new Error('zu wenige Anschlussgriffe: ' + n)
  await ziehen(griffe.nth(0), griffe.nth(1), 30)
})

// ════════════════════════════════════════════════════════════════════════════
// 5. MONITOR, MULTIVIEWER, BIBLIOTHEKSGERÄTE
// ════════════════════════════════════════════════════════════════════════════
await S('monitor-gewaehlt', async () => {
  await waehleKnoten('Control room monitor')
})
await SA('monitor-anzeige-block', T('display.title'), async () => {
  await alleZu()
  await offen(T('display.title'))
})
await SA('monitor-anzeige-gefuellt', T('display.title'), async () => {
  await insp().getByPlaceholder('1920x1080').fill('3840x2160')
  await insp().getByPlaceholder('27', { exact: true }).fill('32')
  await pause(500)
})
await S('monitor-spezifikation', async () => {
  const k = await kopf(T('catprops.title'), true)
  await k.click()
  await pause(600)
}, () => insp().locator('details').filter({ has: win.locator('xpath=./summary').filter({ hasText: new RegExp('^\\s*' + esc(T('catprops.title'))) }) }).first())

await S('multiviewer-gewaehlt', async () => {
  await waehleKnoten('Multiviewer')
})

// aus der Bibliothek holen
const bibSuche = async (suche) => {
  await a.zu()
  const eingabe = bib().locator('input').first()
  await eingabe.fill(suche)
  await pause(1000)
}
const ausBib = async (suche, re) => {
  await bibSuche(suche)
  const treffer = bib().locator('div[draggable="true"][role="button"]').filter({ hasText: re }).first()
  await treffer.click()
  await pause(900)
  await win.locator('.react-flow__node').last().evaluate((e) => e.click())
  await pause(700)
}
const bibTreffer = []
const holeGeraet = async (name, kandidaten, pruefung) => {
  for (const [suche, re] of kandidaten) {
    try {
      await ausBib(suche, re)
      const t = await titelIns()
      bibTreffer.push(`${suche}: ${t}`)
      if (!pruefung || (await pruefung())) break
    } catch (e) {
      bibTreffer.push(`${suche}: FEHLER ${e.message.split('\n')[0]}`)
    }
  }
  await S(name, async () => {}, insp)
}
await holeGeraet('atem-gewaehlt', [['ATEM', /ATEM/i]])
await S('atem-karte', async () => {
  await alleZu()
}, () => insp())
await holeGeraet('videohub-gewaehlt', [['Videohub', /Videohub/i]])
await holeGeraet('greengo-gewaehlt', [['GreenGo', /Green.?Go|XTBB|BPXSP|WBPX/i], ['Green-GO', /Green.?Go/i]])
await holeGeraet(
  'switch-gewaehlt',
  [['Netgear', /Netgear/i], ['UniFi', /UniFi|USW/i], ['Cisco', /Cisco/i], ['Switch', /\bSwitch\b/i]],
  async () => (await insp().locator('summary').filter({ hasText: new RegExp(esc(T('net.switchConfig')) + '|' + esc(T('net.routerConfig')), 'i') }).count()) > 0,
)
await SA('switch-konfiguration', T('net.switchConfig'), async () => {
  await alleZu()
  await offen(T('net.switchConfig')).catch(async () => offen(T('net.routerConfig')))
})
await SA('switch-vlan-hinzu', T('net.switchConfig'), async () => {
  await insp().getByRole('button', { name: T('net.addVlan') }).click()
  await pause(600)
})
await holeGeraet('patchfeld-gewaehlt', [['Patch', /Patch/i]])
await holeGeraet('ledprozessor-gewaehlt', [['Novastar', /Novastar/i], ['Brompton', /Brompton/i], ['LED', /LED/i]])
await holeGeraet('mikrofon-gewaehlt', [['Shure', /Shure/i], ['Sennheiser', /Sennheiser/i], ['Mic', /mic/i]])
await S('mikrofon-spezifikation', async () => {
  const k = await kopf(T('catprops.title'), true)
  await k.click()
  await pause(600)
}, () => insp().locator('details').filter({ has: win.locator('xpath=./summary').filter({ hasText: new RegExp('^\\s*' + esc(T('catprops.title'))) }) }).first())
texte['bibliothek-treffer'] = bibTreffer

// ════════════════════════════════════════════════════════════════════════════
// 6. KABEL
// ════════════════════════════════════════════════════════════════════════════
const kabelTitel = T('inspector.title.cable').split('{')[0]
const waehleKabel = async (i) => {
  await a.zu()
  await win.mouse.click(700, 1000).catch(() => {})
  const kanten = win.locator('.react-flow__edge')
  const n = await kanten.count()
  if (n <= i) throw new Error(`nur ${n} Kanten`)
  for (const sel of ['path.react-flow__edge-interaction', 'path.react-flow__edge-path', 'path']) {
    const p = kanten.nth(i).locator(sel).first()
    if (!(await p.count())) continue
    await p.evaluate((e) => {
      e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    })
    await pause(700)
    if ((await titelIns()).startsWith(kabelTitel.trim())) return
  }
  throw new Error('Kabel nicht gewählt: ' + (await titelIns()))
}
await S('kabel-gewaehlt', async () => {
  await waehleKabel(0)
})
await still(() => optionen('kabel-lage', insp().locator('label').filter({ hasText: T('cable.field.layer') }).locator('select')))
await S('kabel-name-quelle-ziel', async () => {
  await insp().getByRole('button', { name: a.muster('cable.field.sourceDest') }).first().click()
  await pause(500)
})
await S('kabel-laenge-farbe', async () => {
  await insp().locator('label').filter({ hasText: T('cable.field.length') }).locator('input').fill('25')
  await pause(500)
})
await S('kabel-lage-auswahl', async () => {
  await insp().locator('label').filter({ hasText: T('cable.field.layer') }).locator('select').selectOption({ index: 1 })
  await pause(500)
})
await S('kabel-typ-standard-knopf', async () => {
  await pause(200)
})
await S('kabel-lebenszyklus-offen', async () => {
  const k = await kopf(T('lifecycle.cableSection'), true)
  const d = k.locator('xpath=..')
  if (!(await d.evaluate((e) => e.open))) await k.click()
  await pause(600)
}, async () => (await sekDetails(T('lifecycle.cableSection'), true)))
await still(() => optionen('kabel-lz-status', insp().locator('details').filter({ hasText: T('lifecycle.cableSection') }).locator('select').first()))
await S('kabel-lebenszyklus-gefuellt', async () => {
  const d = await sekDetails(T('lifecycle.cableSection'), true)
  await d.locator('select').first().selectOption({ index: 2 })
  await d.locator('label').filter({ hasText: T('lifecycle.pathway') }).locator('input').fill('Kabelkanal 3')
  await d.getByPlaceholder('CM / CMR / CMP / LSZH').fill('LSZH')
  await d.locator('label').filter({ hasText: T('lifecycle.termFrom') }).locator('input').fill('BNC')
  await d.locator('label').filter({ hasText: T('lifecycle.termTo') }).locator('input').fill('BNC')
  await pause(500)
}, async () => (await sekDetails(T('lifecycle.cableSection'), true)))
await S('kabel-messergebnis', async () => {
  const d = await sekDetails(T('lifecycle.cableSection'), true)
  await d.locator('select').filter({ has: win.locator('option[value="pass"]') }).selectOption('pass')
  await d.getByPlaceholder(T('lifecycle.margin')).fill('3.2')
  await d.getByPlaceholder(a.muster('lifecycle.testStd')).fill('Beispielgrenzwert')
  await d.getByPlaceholder(T('lifecycle.reportRef')).fill('bericht-001.pdf')
  await pause(500)
}, async () => (await sekDetails(T('lifecycle.cableSection'), true)))
await S('kabel-multicore', async () => {
  await insp().getByPlaceholder(a.muster('cable.field.multicorePlaceholder')).fill('Snake-1')
  await pause(400)
})
await S('kabel-adern-offen', async () => {
  const k = await kopf(T('adern.cableSection'), true)
  const d = k.locator('xpath=..')
  if (!(await d.evaluate((e) => e.open))) await k.click()
  await pause(600)
}, async () => (await sekDetails(T('adern.cableSection'), true)))
await S('kabel-ader-hinzu', async () => {
  const d = await sekDetails(T('adern.cableSection'), true)
  await d.getByRole('button', { name: a.muster('adern.cable.add') }).click()
  await pause(600)
}, async () => (await sekDetails(T('adern.cableSection'), true)))
await still(() => optionen('kabel-ader-rolle', insp().locator(`select[aria-label="${T('adern.cable.rolle')}"]`)))
await S('kabel-ader-gefuellt', async () => {
  const d = await sekDetails(T('adern.cableSection'), true)
  await d.locator(`select[aria-label="${T('adern.cable.rolle')}"]`).selectOption({ index: 1 })
  await d.getByPlaceholder(a.muster('adern.cable.farbe')).fill('braun')
  await d.getByPlaceholder(a.muster('adern.cable.grund')).fill('Beispielgrund')
  await pause(500)
}, async () => (await sekDetails(T('adern.cableSection'), true)))
await S('kabel-haken-fest-offpage', async () => {
  await insp().getByRole('checkbox', { name: a.muster('cable.field.tieLine') }).check()
  await insp().getByRole('checkbox', { name: a.muster('cable.field.offPage') }).check()
  await pause(700)
})
await S('kabel-offpage-netzname', async () => {
  await insp().locator('input[list="cp-offpage-nets"]').fill('PGM-Netz')
  await pause(500)
})
await still(async () => {
  await insp().getByRole('checkbox', { name: a.muster('cable.field.offPage') }).uncheck()
})
await S('kabel-signalweg-zeigen', async () => {
  await insp().getByRole('button', { name: a.muster('signalweg.show') }).click()
  await pause(900)
})
await S('kabel-signalweg-canvas', async () => {}, () => win.locator('.react-flow').first())
await S('kabel-signalweg-ausblenden', async () => {
  await insp().getByRole('button', { name: a.muster('signalweg.hide') }).click()
  await pause(700)
})
await S('kabel-verbindung-offen', async () => {
  const k = await kopf(T('cable.field.connection'), true)
  await pause(300)
}, async () => (await sekDetails(T('cable.field.connection'), true)))
await still(() => optionen('kabel-von-anschluss', insp().locator(`select[aria-label="${T('cable.aria.fromPort')}"]`)))
await S('kabel-routing', async () => {
  await insp().getByRole('button', { name: /Linie|Line/ }).first().click().catch(() => {})
  await pause(600)
})
await still(async () => {
  await insp().getByRole('button', { name: /Kurve|Curve/ }).first().click()
  await pause(500)
})
await S('kabel-routing-kurve', async () => {}, () => win.locator('.react-flow').first())
await S('kabel-linienstaerke', async () => {
  await insp().locator('input[type=range]').first().fill('5')
  await pause(500)
})
await S('kabel-beschriftung-position', async () => {
  await insp().getByRole('button', { name: /←\s*(Start|Anfang)/ }).first().click()
  await pause(500)
})
await S('kabel-beschriftung-ausgeblendet', async () => {
  await insp().getByRole('button', { name: /←\s*(Start|Anfang)/ }).first().click()
  await pause(500)
})
await S('kabel-beschriftung-regler', async () => {
  await insp().getByRole('button', { name: T('cable.label.center') }).first().click()
  await insp().locator('input[type=range]').nth(1).fill('0.3')
  await pause(500)
})
await S('kabel-endpunktbeschriftung', async () => {
  await insp().getByRole('button', { name: /✓/ }).first().click()
  await pause(500)
})
await S('kabel-strichel-pfeil', async () => {
  await insp().getByRole('checkbox', { name: a.muster('cable.field.dashed') }).check()
  await insp().getByRole('checkbox', { name: a.muster('cable.field.arrowStart') }).check()
  await pause(500)
})
await S('kabel-bidirektional', async () => {
  await insp().getByRole('checkbox', { name: a.muster('cable.field.bidirectional') }).check()
  await pause(500)
})
await S('kabel-funk', async () => {
  await insp().getByRole('checkbox', { name: a.muster('cable.field.wireless') }).check()
  await pause(700)
})
await S('kabel-funk-felder', async () => {
  await insp().getByPlaceholder(a.muster('cable.field.frequencyPlaceholder')).fill('5.8 GHz')
  await insp().getByPlaceholder(a.muster('cable.field.channelPlaceholder')).fill('36')
  await insp().getByPlaceholder(a.muster('cable.field.maxReachPlaceholder')).fill('100')
  await pause(500)
})
await still(async () => {
  await insp().getByRole('checkbox', { name: a.muster('cable.field.wireless') }).uncheck()
})
await S('kabel-notiz', async () => {
  await insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('cable.field.notes'))) }).locator('textarea').fill('Beispielnotiz zum Kabel')
  await pause(400)
})
await S('kabel-typ-standard-dialog', async () => {
  const k = insp().getByRole('button', { name: /Set cable type|Kabeltyp/ }).first()
  const k2 = insp().locator('button[aria-label]').filter({ has: win.locator('svg') }).first()
  await (await k.count() ? k : k2).click()
  await pause(900)
}, () => a.dialog())
await a.zu()

// Adapter einsetzen: Anschluss am Monitor auf HDMI stellen, dann Kabel wählen
await S('kabel-adapter-vorbereitung-monitor', async () => {
  await waehleKnoten('Control room monitor')
  await alleZu()
  const ports = insp().getByRole('button', { name: T('ports.remove') })
  const sel = insp().locator(`select[aria-label="${T('ports.aria.connector')}"]`).first()
  await sel.selectOption('HDMI')
  await pause(700)
}, zielAbschnitt(T('portsSection.title')))
await S('kabel-adapter-vorschlag', async () => {
  const kanten = win.locator('.react-flow__edge')
  const n = await kanten.count()
  let gefunden = false
  for (let i = 0; i < n && !gefunden; i += 1) {
    await waehleKabel(i).catch(() => {})
    if (await insp().getByRole('button', { name: a.muster('adapter.insert') }).count()) gefunden = true
    else if (await insp().locator('text=/HDMI/').count()) gefunden = true
  }
  await pause(300)
})
await S('kabel-adapter-eingesetzt', async () => {
  const b = insp().getByRole('button', { name: new RegExp('^' + esc(T('adapter.insert')) + '$') }).first()
  if (!(await b.count())) throw new Error('Kein Einsetzen-Knopf')
  await b.click()
  await pause(900)
})

// Kabel löschen: nur die Schaltfläche zeigen
await S('kabel-loeschen-knopf', async () => {
  await insp().evaluate((e) => {
    const s = e.querySelector('.overflow-auto')
    if (s) s.scrollTop = s.scrollHeight
  })
  await pause(400)
})

// ════════════════════════════════════════════════════════════════════════════
// 7. RAHMEN
// ════════════════════════════════════════════════════════════════════════════
await S('rahmen-anlegen', async () => {
  await a.zu()
  await win.mouse.click(700, 1000).catch(() => {})
  await win.getByRole('button', { name: a.muster('toolbar.location.label') }).first().click()
  await pause(900)
  await win.locator('.react-flow__node-location').last().evaluate((e) => e.click())
  await pause(700)
})
await S('rahmen-eigenschaften', async () => {
  await pause(300)
})
await still(() => optionen('rahmen-etage', insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('location.field.floor'))) }).locator('select')))
await S('rahmen-name-groesse', async () => {
  await insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('location.field.name'))) }).locator('input').fill('Regie')
  await insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('location.field.width'))) }).locator('input').fill('600')
  await insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('location.field.height'))) }).locator('input').fill('400')
  await pause(500)
})
await S('rahmen-etage-neu-dialog', async () => {
  await insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('location.field.floor'))) }).locator('select').selectOption('\u0000neu')
  await pause(800)
}, () => a.dialog())
await still(async () => {
  await a.dialog().locator('input').first().fill('1. Obergeschoss')
  await a.dialog().getByRole('button').last().click()
  await pause(700)
})
await S('rahmen-etage-gesetzt', async () => {
  await a.zu()
  await pause(300)
})
await S('rahmen-steigschacht', async () => {
  await insp().getByRole('checkbox', { name: a.muster('location.field.riser') }).check()
  await pause(500)
})
await S('rahmen-notiz', async () => {
  await insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('location.field.notes'))) }).locator('textarea').fill('Beispielnotiz zum Rahmen')
  await pause(400)
})
await S('etagen-verwaltung-offen', async () => {
  const k = insp().locator('summary').filter({ hasText: /^\s*(Floors|Etagen)/ }).first()
  await k.click()
  await pause(600)
}, () => insp().locator('details').filter({ has: win.locator('xpath=./summary').filter({ hasText: /^\s*(Floors|Etagen)/ }) }).first())
await S('etagen-hoehe', async () => {
  const d = insp().locator('details').filter({ has: win.locator('xpath=./summary').filter({ hasText: /^\s*(Floors|Etagen)/ }) }).first()
  await d.locator('input[inputmode="decimal"]').first().fill('4,2')
  await d.locator('input[inputmode="decimal"]').first().blur()
  await pause(600)
}, () => insp().locator('details').filter({ has: win.locator('xpath=./summary').filter({ hasText: /^\s*(Floors|Etagen)/ }) }).first())
await S('etagen-neu-dialog', async () => {
  const d = insp().locator('details').filter({ has: win.locator('xpath=./summary').filter({ hasText: /^\s*(Floors|Etagen)/ }) }).first()
  await d.getByRole('button', { name: a.muster('floors.add') }).click()
  await pause(800)
}, () => a.dialog())
await abbrechen()
await S('rahmen-loeschknoepfe', async () => {
  await insp().evaluate((e) => {
    const s = e.querySelector('.overflow-auto')
    if (s) s.scrollTop = s.scrollHeight
  })
  await pause(400)
})
await S('rahmen-stueckliste-dialog', async () => {
  await insp().getByRole('button', { name: a.muster('location.action.bom') }).click()
  await pause(1000)
}, () => a.dialog())
await a.zu()
await S('rahmen-loeschen-frage', async () => {
  await insp().getByRole('button', { name: a.muster('location.action.deleteAll') }).click()
  await pause(700)
}, () => a.dialog())
await abbrechen()

// ════════════════════════════════════════════════════════════════════════════
// 8. VORLAGE (Eigenschaften einer Bibliotheksvorlage)
// ════════════════════════════════════════════════════════════════════════════
await S('vorlage-bearbeiten', async () => {
  await bibSuche('Sony')
  const item = bib().locator('div[draggable="true"][role="button"]').first()
  await item.getByRole('button', { name: T('library.template.editTitle') }).click({ force: true })
  await pause(900)
})
await S('vorlage-name-kategorie', async () => {
  await insp().locator('label').filter({ hasText: new RegExp('^\\s*' + esc(T('template.field.name'))) }).locator('input').fill('Beispielvorlage')
  await pause(500)
})
await S('vorlage-loeschen-frage', async () => {
  await insp().getByRole('button', { name: T('template.action.delete') }).click()
  await pause(700)
}, () => a.dialog())
await abbrechen()

// ════════════════════════════════════════════════════════════════════════════
// 9. MEHRFACHAUSWAHL
// ════════════════════════════════════════════════════════════════════════════
await S('mehrfach-zwei-gewaehlt', async () => {
  await a.zu()
  await win.mouse.click(700, 1100).catch(() => {})
  await pause(400)
  const mitte = async (n) => {
    const b = await knoten(n).boundingBox()
    return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 40) }
  }
  const p1 = await mitte('Camera 2')
  const p2 = await mitte('Vision mixer')
  await win.mouse.click(p1.x, p1.y)
  await pause(400)
  await win.keyboard.down('Control')
  await win.mouse.click(p2.x, p2.y)
  await win.keyboard.up('Control')
  await pause(900)
}, () => win.locator('body'))
await S('mehrfach-inspektor', async () => {}, insp)
await S('mehrfach-datenblatt-dialog', async () => {
  await win.getByRole('button', { name: T('inlineToolbar.datasheet') }).first().click()
  await pause(1200)
}, () => a.dialog())
await a.zu()

// Aufräumen: Projektfoto entfernen
await still(async () => {
  await win.mouse.click(700, 1000).catch(() => {})
  await pause(400)
  await insp().getByRole('button', { name: T('foto.remove') }).first().click()
})

f.speichern(new URL(`./eigenschaften.${sprache}.json`, import.meta.url))
writeFileSync(new URL(`./eigenschaften.${sprache}.texte.json`, import.meta.url), JSON.stringify({ texte, auswahl }, null, 2))
await a.ende()
console.log('FERTIG')
