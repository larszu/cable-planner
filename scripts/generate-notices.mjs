#!/usr/bin/env node
/**
 * #pre-sale — Generiert THIRD-PARTY-LICENSES.md aus allen PRODUKTIONS-
 * Dependencies (transitiv). Pflicht-Attribution: für MIT/BSD/Apache/ISC u.a.
 * müssen Lizenztext + Copyright-Notices der gebündelten Pakete reproduziert
 * werden. Eigener App-Code bleibt davon unberührt (App-Lizenz: MIT).
 *
 * Quelle des Baums: `npm ls --omit=dev --all --json`. Lizenztext: LICENSE*-
 * Datei im jeweiligen node_modules/<pkg>, sonst das `license`-Feld.
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { maxBuffer: 64 * 1024 * 1024 }).toString())
const pkgs = new Map() // name -> {versions:Set, license, repo, author}
const walk = (deps) => {
  if (!deps) return
  for (const [name, info] of Object.entries(deps)) {
    if (!pkgs.has(name)) pkgs.set(name, { versions: new Set() })
    if (info.version) pkgs.get(name).versions.add(info.version)
    walk(info.dependencies)
  }
}
walk(tree.dependencies)

const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'LICENCE', 'LICENSE-MIT', 'COPYING']
const readMeta = (name) => {
  const dir = join('node_modules', name)
  const pjPath = join(dir, 'package.json')
  if (!existsSync(pjPath)) return null
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'))
  const license = typeof pj.license === 'string' ? pj.license : (pj.license?.type || (Array.isArray(pj.licenses) ? pj.licenses.map((l) => l.type).join('/') : 'UNKNOWN'))
  const repo = typeof pj.repository === 'string' ? pj.repository : pj.repository?.url || pj.homepage || ''
  const author = typeof pj.author === 'string' ? pj.author : pj.author?.name || ''
  let text = ''
  try {
    const f = readdirSync(dir).find((n) => LICENSE_FILES.includes(n))
    if (f) text = readFileSync(join(dir, f), 'utf8').trim()
  } catch { /* ignore */ }
  return { license, repo: repo.replace(/^git\+/, '').replace(/\.git$/, ''), author, text }
}

const names = [...pkgs.keys()].sort((a, b) => a.localeCompare(b))
const licenseCounts = {}
let unresolved = 0
const out = []
out.push('# Third-Party Licenses')
out.push('')
out.push(`Cable Planner (eigener Code: MIT) bündelt die folgenden Open-Source-Pakete.`)
out.push(`Diese Datei reproduziert deren Lizenz-/Copyright-Notices wie von den`)
out.push(`jeweiligen Lizenzen gefordert. Automatisch generiert via`)
out.push('`scripts/generate-notices.mjs` aus dem Produktions-Dependency-Baum.')
out.push('')
out.push(`Stand: ${new Date().toISOString().slice(0, 10)} · ${names.length} Pakete`)
out.push('')
out.push('---')
out.push('')
const body = []
for (const name of names) {
  const meta = readMeta(name)
  const versions = [...pkgs.get(name).versions].sort().join(', ')
  if (!meta) { unresolved++; body.push(`## ${name} (${versions})\n\n_Lizenz-Metadaten nicht auflösbar._\n`); continue }
  licenseCounts[meta.license] = (licenseCounts[meta.license] || 0) + 1
  body.push(`## ${name} (${versions})`)
  body.push('')
  body.push(`- **License:** ${meta.license}`)
  if (meta.author) body.push(`- **Author:** ${meta.author}`)
  if (meta.repo) body.push(`- **Source:** ${meta.repo}`)
  body.push('')
  if (meta.text) {
    body.push('```')
    body.push(meta.text.length > 6000 ? meta.text.slice(0, 6000) + '\n…(gekürzt)…' : meta.text)
    body.push('```')
  }
  body.push('')
}
// Lizenz-Übersicht (SPDX-Zusammenfassung) oben einfügen
out.push('## Lizenz-Übersicht')
out.push('')
for (const [lic, n] of Object.entries(licenseCounts).sort((a, b) => b[1] - a[1])) out.push(`- ${lic}: ${n}`)
out.push('')
out.push('---')
out.push('')
const md = out.join('\n') + '\n' + body.join('\n')
writeFileSync('THIRD-PARTY-LICENSES.md', md)
console.log(`THIRD-PARTY-LICENSES.md geschrieben: ${names.length} Pakete, ${unresolved} ohne Metadaten`)
console.log('Lizenz-Verteilung:', JSON.stringify(licenseCounts))
