#!/usr/bin/env node
// docs/redact-screenshots.mjs
//
// Schwärzt Kundendaten in den README-Screenshots und legt die sauberen
// Bilder unter docs/screenshots/ ab — ohne dass die Rohbilder zu jemandem
// übertragen werden müssen. Läuft lokal mit `sharp` (bereits Dev-Dependency).
//
// Workflow
//   1) npm install                         (falls noch nicht geschehen)
//   2) Roh-PNGs nach docs/screenshots/_raw/ legen, benannt wie die Ziel-
//      Slots aus dem README:
//        hero.png  export.png  patch-sheets.png  patch-pdf.png  bom.png
//        properties.png  (canvas.gif separat — GIFs schneidet das Skript nicht)
//   3) node docs/redact-screenshots.mjs
//   4) docs/screenshots/<name> prüfen. Liegt eine Box daneben? Werte in
//      DEFAULTS / PER_FILE justieren (Bruchteile 0..1) und erneut laufen.
//   5) git add docs/screenshots/*.png && commit + push  (Rohbilder NICHT
//      committen — _raw/ ist via .gitignore ausgeschlossen).
//
// Koordinaten sind BRUCHTEILE der jeweiligen Bildgröße → auflösungs-
// unabhängig. Default: zentrale Box in der App-Kopfzeile (Projektname steht
// mittig) + unteren Streifen abschneiden (entfernt Statusleiste inkl.
// "Rentman: …"-Zeile UND eine evtl. sichtbare OS-Taskleiste).

import sharp from 'sharp'
import { readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'screenshots')
const RAW = join(DIR, '_raw')

// ── Konfiguration ────────────────────────────────────────────────────────
// blackBoxes: Rechtecke {x,y,w,h} (Bruchteile) → werden übermalt.
// cropBottom: Bruchteil der Höhe, der unten abgeschnitten wird (0 = aus).
const DEFAULTS = {
  blackBoxes: [
    // Projektname mittig in der App-Kopfzeile (oberste ~5 %).
    { x: 0.34, y: 0.0, w: 0.32, h: 0.05 },
  ],
  cropBottom: 0.07,
}
const PER_FILE = {
  // Export-Dialog: zusätzlich der Inline-Hinweis "Datei wird unter
  // <Projektname> heruntergeladen" (mittig, ~40 % Höhe).
  'export.png': {
    blackBoxes: [
      { x: 0.34, y: 0.0, w: 0.32, h: 0.05 },
      { x: 0.30, y: 0.40, w: 0.18, h: 0.02 },
    ],
    cropBottom: 0.07,
  },
  // PDF-Screenshot ist ein Acrobat-Fenster ohne App-Chrome; echte Geräte-/
  // Personennamen sind verstreut und NICHT zuverlässig
  // automatisch schwärzbar. Empfehlung: aus einem neutralen Demo-Projekt
  // neu erzeugen oder manuell überprüfen. Hier nur ein leerer Default.
  'patch-pdf.png': { blackBoxes: [], cropBottom: 0 },
}
// ──────────────────────────────────────────────────────────────────────────

async function redactOne(name) {
  const cfg = { ...DEFAULTS, ...(PER_FILE[name] ?? {}) }
  const img = sharp(join(RAW, name))
  const { width: W = 0, height: H = 0 } = await img.metadata()
  const rects = (cfg.blackBoxes ?? [])
    .map(
      (b) =>
        `<rect x="${Math.round(b.x * W)}" y="${Math.round(b.y * H)}" width="${Math.round(
          b.w * W,
        )}" height="${Math.round(b.h * H)}" fill="rgb(15,23,42)"/>`,
    )
    .join('')
  let pipe = img.composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${rects}</svg>`), top: 0, left: 0 }])
  const cropPx = Math.round((cfg.cropBottom ?? 0) * H)
  if (cropPx > 0) pipe = pipe.extract({ left: 0, top: 0, width: W, height: H - cropPx })
  await pipe.png({ compressionLevel: 9 }).toFile(join(DIR, name))
  console.log(`✓ ${name}  ${W}×${H}${cropPx ? ` → ${W}×${H - cropPx}` : ''}  (${cfg.blackBoxes?.length ?? 0} Box(en))`)
}

if (!existsSync(RAW)) {
  console.error(`Kein Roh-Ordner gefunden: ${RAW}\nLege die Roh-PNGs dort ab (Dateinamen = Ziel-Slots) und starte erneut.`)
  process.exit(1)
}
mkdirSync(DIR, { recursive: true })
const files = readdirSync(RAW).filter((f) => extname(f).toLowerCase() === '.png')
if (files.length === 0) {
  console.error(`Keine PNGs in ${RAW}.`)
  process.exit(1)
}
console.log(`Schwärze ${files.length} Bild(er) aus _raw/ …\n`)
for (const f of files) {
  try {
    await redactOne(f)
  } catch (e) {
    console.error(`✗ ${f}: ${e instanceof Error ? e.message : String(e)}`)
  }
}
console.log('\nFertig. docs/screenshots/*.png prüfen, dann committen (Rohbilder bleiben in _raw/, ungetrackt).')
