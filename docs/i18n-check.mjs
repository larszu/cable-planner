#!/usr/bin/env node
// docs/i18n-check.mjs — i18n-Paritäts-Report (Phase 4).
//
// Deutsch ist Quell-/Fallback-Sprache (Inline-Fallback in t('key', 'DE')),
// Englisch lebt im `en`-Dict in src/renderer/lib/i18n.ts. Dieses Skript
// meldet:
//   (a) Keys, die im Code via t('key', …) / translate(…, 'key', …) benutzt
//       werden, aber im en-Dict FEHLEN → englische Nutzer sehen den
//       deutschen Fallback. (Das ist die eigentliche „Lücke".)
//   (b) en-Dict-Keys, die nirgends STATISCH referenziert werden → evtl.
//       verwaist ODER nur dynamisch (t(`…${x}`)) erreichbar.
//
// Aufruf:  node docs/i18n-check.mjs
// Exit-Code 1, wenn (a) nicht leer ist (CI-tauglich).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const I18N = join(SRC, 'renderer/lib/i18n.ts')

// 1. en-Dict-Keys aus i18n.ts (nur der `const en` Block).
const i18nSrc = readFileSync(I18N, 'utf8')
const enStart = i18nSrc.indexOf('const en: Dict = {')
const enEnd = i18nSrc.indexOf('\n}', enStart)
const enBlock = i18nSrc.slice(enStart, enEnd)
const enKeys = new Set([...enBlock.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]))

// 2. Alle Source-Dateien (ohne i18n.ts selbst).
const files = []
;(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (['.ts', '.tsx'].includes(extname(p)) && !p.endsWith('i18n.ts')) files.push(p)
  }
})(SRC)

// 3. Statisch referenzierte Keys aus t('key', …) und translate(…, 'key', …).
const used = new Set()
const dynamicFiles = new Set()
const keyRe = /\bt\(\s*['"]([^'"]+)['"]/g
const translateRe = /\btranslate\(\s*[^,]+,\s*['"]([^'"]+)['"]/g
const dynRe = /\bt\(\s*`/
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(keyRe)) used.add(m[1])
  for (const m of src.matchAll(translateRe)) used.add(m[1])
  if (dynRe.test(src)) dynamicFiles.add(f.replace(ROOT + '/', ''))
}

// 4. Report.
const missingEn = [...used].filter((k) => !enKeys.has(k)).sort()
const orphanEn = [...enKeys].filter((k) => !used.has(k)).sort()

console.log(`i18n-Check — ${enKeys.size} en-Keys, ${used.size} statisch benutzte Keys\n`)
console.log(`(a) Benutzt, aber NICHT im en-Dict (${missingEn.length}) — EN zeigt DE-Fallback:`)
for (const k of missingEn) console.log('   -', k)
console.log(`\n(b) Im en-Dict, aber nirgends statisch referenziert (${orphanEn.length}) — verwaist oder nur dynamisch:`)
for (const k of orphanEn) console.log('   -', k)
if (dynamicFiles.size) {
  console.log(`\n(i) ${dynamicFiles.size} Datei(en) mit dynamischen t(\`…\`)-Keys (manuell prüfen):`)
  for (const f of [...dynamicFiles].sort()) console.log('   -', f)
}
process.exitCode = missingEn.length > 0 ? 1 : 0
