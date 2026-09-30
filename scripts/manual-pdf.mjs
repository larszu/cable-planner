// Das Benutzerhandbuch als PDF setzen — aus derselben Markdown-Datei, die
// GitHub anzeigt, damit es nur eine Quelle gibt.
//
//   node scripts/manual-pdf.mjs            → docs/manual/*.pdf
//
// WARUM KEIN MARKDOWN-PAKET: das Handbuch nutzt eine kleine, feste Teilmenge
// (Überschriften, Absätze, Listen, Tabellen, Bilder, Codeblöcke). Dafür eine
// Abhängigkeit mitzuschleppen, die in keinem Build landet, lohnt nicht.
// Wer im Handbuch neue Syntax einführt, erweitert `blockHtml` hier.
//
// GESETZT NACH BRAND GUIDE 2.0 (Fassung 06.09.2026) — Maße und Regeln von dort,
// nicht nach Augenmaß:
// - Deckblatt und Rückseite wie Titel und Kontaktseite des Guides: Navy, oben
//   Kicker mit Stahlblau-Linie, Hauptlogo Off-White; der Claim „Im Fokus." mit
//   dem einzigen roten Punkt steht nur auf der Rückseite (ein Tally pro Fläche).
// - Innenseiten hell, A4 hoch: Rand 20 mm, unten 25 mm; Kopfzeile = Kopflinie
//   (Kicker links und rechts, Linie in Stahlblau) — ein Kopf pro Seite, deshalb
//   tragen die Kapitel keine eigene Linie und beginnen je auf neuer Seite.
// - Public Sans; Fließtext Regular 10 pt, Zwischentitel ExtraBold, Kicker Bold
//   Versalien mit +180 Laufweite. Kicker auf Weiß in Schiefer, weil Stahlblau
//   auf Weiß als Text nicht zulässig ist. Zeilen höchstens ~75 Zeichen.
// - Keine Rundungen, Schatten, Verläufe, Rahmen; Aufzählung mit Gedankenstrich;
//   Datum deutsch (TT.MM.JJJJ) auch in der englischen Fassung.
//
// Kopf- und Fußzeile sind @page-Randfelder (Chrome ab 131), nicht Chromes
// `displayHeaderFooter` — das lässt sich für Deck- und Rückseite nicht abschalten.
// Braucht ein installiertes Chrome (playwright `channel: 'chrome'`) und Netz
// für die Schrift von Google Fonts.

import { chromium } from 'playwright-core'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { slug } from './handbuch/slug.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'docs', 'manual')
const REPO = 'https://github.com/larszu/cable-planner/blob/main/docs/manual/'
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const logo = readFileSync(join(ROOT, 'src/renderer/assets/brand/lzm_hauptlogo_offwhite.svg'), 'utf8')

const AUSGABEN = [
  { quelle: 'manual.en.md', ziel: 'LZ-Cable-Planner-Manual-EN.pdf', lang: 'en', titel: 'User Manual', kontakt: 'Contact', lizenz: 'Free to use, proprietary licence.' },
  { quelle: 'handbuch.de.md', ziel: 'LZ-Cable-Planner-Handbuch-DE.pdf', lang: 'de', titel: 'Benutzerhandbuch', kontakt: 'Kontakt', lizenz: 'Kostenlos nutzbar, proprietär lizenziert.' },
]

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Relative Ziele zeigen im PDF ins Leere — Markdown-Links gehen auf GitHub, Bilder auf die Platte. */
const ziel = (href, bild) => {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return href
  if (bild) return pathToFileURL(resolve(DIR, href)).href
  return new URL(href, REPO).href
}

const inline = (text) => {
  const codes = []
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
  s = s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img alt="${alt}" src="${ziel(src, true)}">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) => `<a href="${ziel(href, false)}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`)
}

const ids = new Set()
function blockHtml(md) {
  const zeilen = md.replace(/\r/g, '').split('\n')
  const out = []
  let i = 0
  const liste = (geordnet) => {
    const tag = geordnet ? 'ol' : 'ul'
    const muster = geordnet ? /^\d+\.\s+/ : /^-\s+/
    const punkte = []
    while (i < zeilen.length && (muster.test(zeilen[i]) || /^\s{2,}\S/.test(zeilen[i]) || (zeilen[i] === '' && /^\s{2,}\S/.test(zeilen[i + 1] ?? '')))) {
      if (muster.test(zeilen[i])) punkte.push([zeilen[i].replace(muster, '')])
      else punkte[punkte.length - 1].push(zeilen[i].replace(/^\s{2,3}/, ''))
      i++
    }
    return `<${tag}>${punkte.map((p) => `<li>${blockHtml(p.join('\n'))}</li>`).join('')}</${tag}>`
  }
  while (i < zeilen.length) {
    const z = zeilen[i]
    if (z.trim() === '') { i++; continue }
    if (z.startsWith('```')) {
      const code = []
      for (i++; i < zeilen.length && !zeilen[i].startsWith('```'); i++) code.push(zeilen[i])
      i++
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
      continue
    }
    const h = z.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      // ids wie GitHub, doppelte mit -1, -2 … — so zeigen die #-Links des Inhaltsverzeichnisses im PDF auf die Stelle.
      let id = slug(h[2])
      if (ids.has(id)) { let n = 1; while (ids.has(`${id}-${n}`)) n++; id = `${id}-${n}` }
      ids.add(id)
      out.push(`<h${h[1].length} id="${id}">${inline(h[2])}</h${h[1].length}>`); i++; continue
    }
    if (/^---+$/.test(z)) { out.push('<hr>'); i++; continue }
    if (/^-\s+/.test(z)) { out.push(liste(false)); continue }
    if (/^\d+\.\s+/.test(z)) { out.push(liste(true)); continue }
    if (z.startsWith('|')) {
      const rows = []
      while (i < zeilen.length && zeilen[i].startsWith('|')) rows.push(zeilen[i++])
      const zellen = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const [kopf, , ...rumpf] = rows
      out.push(`<table><thead><tr>${zellen(kopf).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rumpf
        .map((r) => `<tr>${zellen(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`)
      continue
    }
    const absatz = []
    while (i < zeilen.length && zeilen[i].trim() !== '' && !/^(#|```|\||-\s|\d+\.\s|---+$)/.test(zeilen[i])) absatz.push(zeilen[i++])
    if (absatz.length === 0) {
      // No branch above claimed this line, and the paragraph loop wouldn't
      // either (it matches its own stop pattern) — render it plainly and
      // move on, rather than loop forever on it.
      out.push(`<p>${inline(z)}</p>`)
      i++
      continue
    }
    const text = absatz.join(' ')
    out.push(/^!\[[^\]]*\]\([^)]+\)$/.test(text) ? `<figure>${inline(text)}</figure>` : `<p>${inline(text)}</p>`)
  }
  return out.join('\n')
}

const CSS = (a) => `
:root { --navy:#1D324F; --off:#F6F5F0; --eis:#E1ECEF; --stahl:#8C9CB3; --schiefer:#5C6B85; --tally:#D6402E; }
@page {
  size: A4; margin: 20mm 20mm 25mm 20mm;
  @top-left { content: 'LZ CABLE PLANNER'; }
  @top-center { content: ''; }
  @top-right { content: '${a.titel.toUpperCase()}'; }
  @bottom-left { content: 'LARS ZUMPE MEDIENPRODUKTION'; }
  @bottom-center { content: 'VERSION ${version}'; }
  @bottom-right { content: counter(page, decimal-leading-zero); }
}
@page {
  @top-left { font: 700 6.5pt 'Public Sans'; letter-spacing: .18em; color: var(--schiefer);
    vertical-align: bottom; padding-bottom: 2.5mm; margin-bottom: 8mm; border-bottom: .5pt solid var(--stahl); }
  @top-center { vertical-align: bottom; margin-bottom: 8mm; border-bottom: .5pt solid var(--stahl); }
  @top-right { font: 700 6.5pt 'Public Sans'; letter-spacing: .18em; color: var(--schiefer); text-align: right;
    vertical-align: bottom; padding-bottom: 2.5mm; margin-bottom: 8mm; border-bottom: .5pt solid var(--stahl); }
  @bottom-left { font: 700 6pt 'Public Sans'; letter-spacing: .18em; color: var(--schiefer);
    vertical-align: top; padding-top: 2.5mm; margin-top: 10mm; border-top: .5pt solid var(--stahl); }
  @bottom-center { font: 700 6pt 'Public Sans'; letter-spacing: .18em; color: var(--schiefer);
    vertical-align: top; padding-top: 2.5mm; margin-top: 10mm; border-top: .5pt solid var(--stahl); }
  @bottom-right { font: 700 6pt 'Public Sans'; letter-spacing: .18em; color: var(--schiefer); text-align: right;
    vertical-align: top; padding-top: 2.5mm; margin-top: 10mm; border-top: .5pt solid var(--stahl); }
}
@page vollflaeche { margin: 0;
  @top-left { content: none; } @top-center { content: none; } @top-right { content: none; }
  @bottom-left { content: none; } @bottom-center { content: none; } @bottom-right { content: none; } }
* { border-radius: 0; box-shadow: none; }
html { background: #fff; }
body { font-family: 'Public Sans', system-ui, 'Segoe UI', Roboto, Arial, sans-serif; color: var(--navy);
  font-size: 10pt; line-height: 1.5; margin: 0; hyphens: manual; }

.flaeche { page: vollflaeche; background: var(--navy); color: var(--off); width: 210mm; height: 297mm;
  padding: 20mm 20mm 25mm; box-sizing: border-box; display: flex; flex-direction: column; break-after: page; }
.flaeche.rueck { break-after: auto; break-before: page; }
.flaeche .kopf { font-weight: 700; font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; color: var(--stahl);
  padding-bottom: 3mm; border-bottom: .5pt solid var(--stahl); }
.flaeche .kopf b { color: var(--off); }
.flaeche .logo svg { display: block; width: 80mm; height: auto; }
.flaeche .logo svg path { fill: var(--off); }
.flaeche .titel { margin-top: 55mm; }
.flaeche .titel .logo { margin-bottom: 22mm; }
.flaeche h1.headline { display: block; font-weight: 900; text-transform: uppercase; letter-spacing: -.015em;
  font-size: 40pt; line-height: 1; margin: 0 0 6mm; }
.flaeche .sub { font-weight: 500; font-size: 13pt; line-height: 1.4; max-width: 125mm; }
.flaeche .fuss { margin-top: auto; display: flex; justify-content: space-between; font-weight: 700; font-size: 6.5pt;
  letter-spacing: .2em; text-transform: uppercase; color: var(--stahl); padding-top: 3mm; border-top: .5pt solid var(--stahl); }
.flaeche .claim { margin-top: 45mm; font-weight: 900; font-style: italic; text-transform: uppercase;
  letter-spacing: -.015em; font-size: 40pt; line-height: 1; }
.flaeche .claim i { font-style: inherit; color: var(--tally); }
.flaeche .adresse { margin-top: 14mm; font-size: 9.5pt; line-height: 1.8; }
.flaeche .adresse b { font-weight: 700; }
.flaeche .adresse .meta { color: var(--stahl); }
.flaeche .rueck-logo { margin-top: auto; margin-bottom: 8mm; }
.flaeche .rueck-logo svg { width: 60mm; }
.flaeche .fuss.klein { font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 7pt; }

h1 { display: none; }
h2 { font-weight: 800; font-size: 18pt; line-height: 1.2; margin: 0 0 5mm; break-before: page; break-after: avoid; }
.toc h2 { break-before: auto; }
h3 { font-weight: 800; font-size: 12pt; margin: 7mm 0 2mm; break-after: avoid; }
h4 { font-weight: 700; font-size: 10.5pt; margin: 5mm 0 1.5mm; break-after: avoid; }
h5 { font-weight: 700; font-size: 10pt; margin: 4mm 0 1mm; break-after: avoid; color: var(--schiefer); }
h6 { font-weight: 700; font-size: 9.5pt; margin: 3mm 0 .5mm; break-after: avoid; color: var(--schiefer); font-style: italic; }
p, li { max-width: 125mm; }
p { margin: 0 0 2.5mm; }
ul, ol { margin: 0 0 3mm; padding-left: 5mm; }
ol { padding-left: 7mm; }
ul { list-style: none; }
ul > li { position: relative; }
ul > li::before { content: '–'; position: absolute; left: -4.5mm; color: var(--schiefer); }
li { margin-bottom: 1mm; }
li > p { margin: 0 0 1mm; }
a { color: var(--navy); }
strong { font-weight: 700; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; background: var(--eis); padding: 0 1mm; }
pre { background: var(--eis); padding: 3mm; white-space: pre-wrap; word-break: break-all; max-width: 125mm; }
pre code { padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 2mm 0 5mm; font-size: 9pt; break-inside: avoid; }
th { background: var(--eis); text-align: left; font-weight: 700; font-size: 6.5pt; letter-spacing: .18em; text-transform: uppercase; }
th, td { padding: 1.8mm 2mm; border-bottom: .5pt solid var(--stahl); vertical-align: top; }
figure { margin: 3mm 0 5mm; break-inside: avoid; }
figure img { display: block; width: auto; max-width: 100%; max-height: 190mm; }
hr { display: none; }
.toc { break-after: page; }
.toc ol li { margin-bottom: 1.5mm; }
.toc ul { margin: 1mm 0 2mm; }
.toc ul li { margin-bottom: .5mm; font-size: 9pt; }
.toc a { text-decoration: none; }
`

function dokument(a) {
  const { quelle, lang, titel, kontakt, lizenz } = a
  const md = readFileSync(join(DIR, quelle), 'utf8')
  // Erste Zeile ist der Titel, der erste Absatz die Unterzeile — beide gehören aufs Deckblatt.
  const [, h1, rest] = md.match(/^#\s+(.*)\n+([\s\S]*)$/)
  const [unterzeile, , ...danach] = rest.split(/\n\n/)
  // Der Verweis auf die andere Sprache (2. Absatz) führt im PDF auf eine .md-Datei.
  const inhalt = danach.join('\n\n')
  let body = blockHtml(inhalt)
  body = body.replace('<h2>', '<section class="toc"><h2>').replace(/(<\/ol>)/, '$1</section>')
  const heute = new Date()
  const datum = heute.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const monat = heute.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { month: 'long', year: 'numeric' })
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(h1)}</title>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,700;0,800;0,900;1,900&display=block" rel="stylesheet">
<style>${CSS(a)}</style></head><body>
<section class="flaeche">
  <div class="kopf">LZ Cable Planner · Version ${version} · <b>${monat}</b></div>
  <div class="titel">
    <div class="logo">${logo}</div>
    <h1 class="headline">${titel}</h1>
    <div class="sub">${inline(unterzeile.replace(/\n/g, ' '))}</div>
  </div>
  <div class="fuss"><span>www.zumpelars.de</span><span>info@zumpelars.de</span><span>github.com/larszu/cable-planner</span></div>
</section>
${body}
<section class="flaeche rueck">
  <div class="kopf">${kontakt}</div>
  <div class="claim">Im<br>Fokus<i>.</i></div>
  <div class="adresse">
    <b>Lars Zumpe</b><br>
    <span class="meta">Lars Zumpe Medienproduktion · Turmstraße 37 · 51645 Gummersbach</span><br>
    +49 151 2070 3235<br>info@zumpelars.de<br>www.zumpelars.de
  </div>
  <div class="rueck-logo logo">${logo}</div>
  <div class="fuss klein"><span>LZ Cable Planner · ${titel} · Version ${version} · ${datum}</span><span>${lizenz}</span></div>
</section>
</body></html>`
}

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage({ colorScheme: 'light' })
  for (const a of AUSGABEN) {
    const html = join(DIR, `.${a.lang}.tmp.html`)
    ids.clear()
    writeFileSync(html, dokument(a))
    await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.pdf({ path: join(DIR, a.ziel), preferCSSPageSize: true, printBackground: true, outline: true, tagged: true })
    rmSync(html)
    console.log(`docs/manual/${a.ziel}`)
  }
} finally {
  await browser.close()
}
