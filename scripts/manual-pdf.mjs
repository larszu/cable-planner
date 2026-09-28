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
// Gesetzt nach Brand Guide 2.0 der Lars Zumpe Medienproduktion: Print hell,
// Public Sans, Navy-Deckblatt mit Hauptlogo, Kopflinie in Stahlblau, keine
// Rundungen, keine Schatten. Braucht ein installiertes Chrome (playwright
// `channel: 'chrome'`) und Netz für die Schrift von Google Fonts.
//
// KEINE SEITENZAHLEN: Chromes Fußzeile läuft auch über das Navy-Deckblatt, und
// das Inhaltsverzeichnis nennt Kapitel, keine Seiten.

import { chromium } from 'playwright-core'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'docs', 'manual')
const REPO = 'https://github.com/larszu/cable-planner/blob/main/docs/manual/'
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const logo = readFileSync(join(ROOT, 'src/renderer/assets/brand/lzm_hauptlogo_offwhite.svg'), 'utf8')

const AUSGABEN = [
  { quelle: 'manual.en.md', ziel: 'LZ-Cable-Planner-Manual-EN.pdf', lang: 'en', titel: 'User Manual', stand: 'Version' },
  { quelle: 'handbuch.de.md', ziel: 'LZ-Cable-Planner-Handbuch-DE.pdf', lang: 'de', titel: 'Benutzerhandbuch', stand: 'Version' },
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
    const h = z.match(/^(#{1,3})\s+(.*)$/)
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue }
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
    const text = absatz.join(' ')
    out.push(/^!\[[^\]]*\]\([^)]+\)$/.test(text) ? `<figure>${inline(text)}</figure>` : `<p>${inline(text)}</p>`)
  }
  return out.join('\n')
}

const CSS = `
:root { --navy:#1D324F; --deep:#132040; --offwhite:#F6F5F0; --eis:#E1ECEF; --stahl:#8C9CB3; --schiefer:#5C6B85; }
@page { size: A4; margin: 20mm 20mm 25mm 20mm; }
@page :first { margin: 0; }
* { border-radius: 0; box-shadow: none; }
html { background: #fff; }
body { font-family: 'Public Sans', system-ui, 'Segoe UI', Roboto, Arial, sans-serif; color: var(--navy);
  font-size: 10pt; line-height: 1.5; margin: 0; }
.cover { background: var(--navy); color: var(--offwhite); height: 297mm; padding: 25mm 20mm;
  box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.cover svg { width: 70mm; height: auto; fill: var(--offwhite); }
.cover svg path { fill: var(--offwhite); }
.kicker { font-weight: 700; text-transform: uppercase; letter-spacing: .18em; font-size: 8pt; color: var(--stahl); }
.cover .kicker { border-bottom: 0.5pt solid var(--stahl); padding-bottom: 3mm; }
.cover h1 { font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -.015em;
  font-size: 44pt; line-height: 1; margin: 6mm 0 4mm; }
.cover .sub { font-weight: 500; font-size: 14pt; max-width: 130mm; }
.cover .meta { font-size: 9pt; color: var(--stahl); }
h1 { display: none; }
h2 { font-weight: 800; font-size: 16pt; margin: 0 0 4mm; padding-top: 3mm; border-top: 0.5pt solid var(--stahl);
  margin-top: 9mm; page-break-after: avoid; }
h3 { font-weight: 800; font-size: 11.5pt; margin: 5mm 0 2mm; page-break-after: avoid; }
p, li { max-width: 165mm; }
p { margin: 0 0 2.5mm; }
ul, ol { margin: 0 0 3mm; padding-left: 5mm; }
ol { padding-left: 6mm; }
ul { list-style: none; }
ul > li { position: relative; }
ul > li::before { content: '–'; position: absolute; left: -4.5mm; color: var(--schiefer); }
li > p { margin: 0 0 1mm; }
a { color: var(--navy); }
code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; background: var(--eis); padding: 0 1mm; }
pre { background: var(--eis); padding: 3mm; white-space: pre-wrap; word-break: break-all; }
pre code { padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 2mm 0 4mm; font-size: 9pt; page-break-inside: avoid; }
th { background: var(--eis); text-align: left; font-weight: 700; }
th, td { padding: 1.5mm 2mm; border-bottom: 0.5pt solid var(--stahl); vertical-align: top; }
figure { margin: 3mm 0 4mm; page-break-inside: avoid; }
figure img { width: 100%; }
hr { display: none; }
.toc { page-break-after: always; }
.toc h2 { border-top: 0; margin-top: 0; }
.toc ol { padding-left: 7mm; }
`

function dokument({ quelle, lang, titel, stand }) {
  const md = readFileSync(join(DIR, quelle), 'utf8')
  // Erste Zeile ist der Titel, die zweite (Absatz) die Unterzeile — beide gehören aufs Deckblatt.
  const [, h1, rest] = md.match(/^#\s+(.*)\n+([\s\S]*)$/)
  const [unterzeile, ...danach] = rest.split(/\n\n/)
  // Der Verweis auf die andere Sprache gilt auf GitHub; im PDF führte er auf eine .md-Datei.
  let body = blockHtml(danach.slice(1).join('\n\n'))
  body = body.replace('<h2>', '<section class="toc"><h2>').replace(/(<\/ol>)/, '$1</section>')
  const datum = new Date().toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(h1)}</title>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,700;0,800;0,900;1,400;1,900&display=block" rel="stylesheet">
<style>${CSS}</style></head><body>
<section class="cover">
  <div>${logo}</div>
  <div>
    <div class="kicker">LZ Cable Planner</div>
    <h1 style="display:block">${titel}</h1>
    <div class="sub">${inline(unterzeile.replace(/\n/g, ' '))}</div>
  </div>
  <div class="meta">${stand} ${version} · ${datum} · Lars Zumpe Medienproduktion</div>
</section>
${body}
</body></html>`
}

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage({ colorScheme: 'light' })
  for (const a of AUSGABEN) {
    const html = join(DIR, `.${a.lang}.tmp.html`)
    writeFileSync(html, dokument(a))
    await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.pdf({
      path: join(DIR, a.ziel),
      format: 'A4',
      printBackground: true,
    })
    rmSync(html)
    console.log(`docs/manual/${a.ziel}`)
  }
} finally {
  await browser.close()
}
