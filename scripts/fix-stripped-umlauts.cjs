// Fix words where the original umlaut got stripped to ASCII (e.g. "Gerat"
// instead of "Gerät", "Anderungen" instead of "Änderungen"). Uses word
// boundaries so we don't touch substrings inside other words.
//
// Run: node scripts/fix-stripped-umlauts.cjs <file> [<file>...]
const fs = require('fs')

const REPLACEMENTS = [
  // Compound words first (longer matches before shorter)
  [/\bRack-Gerat\b/g, 'Rack-Gerät'],
  // Single-word replacements
  [/\bGerat\b/g, 'Gerät'],
  [/\bGerate\b/g, 'Geräte'],
  [/\bAnderungen\b/g, 'Änderungen'],
  [/\bAnderung\b/g, 'Änderung'],
  [/\bverfugbar\b/g, 'verfügbar'],
  [/\bgewahlt\b/g, 'gewählt'],
  [/\bgultig\b/g, 'gültig'],
  [/\bgultige\b/g, 'gültige'],
  [/\bauswahlen\b/g, 'auswählen'],
  [/\babwahlen\b/g, 'abwählen'],
  // 'wahlen' is risky if used as English ("whales"). Run against DE files only.
  [/\bwahlen\b/g, 'wählen'],
  // 'fur' as standalone word in DE contexts (German "für")
  [/\bfur\b/g, 'für'],
  [/\bUbertragung\b/g, 'Übertragung'],
  [/\bubertragen\b/g, 'übertragen'],
  [/\bloschen\b/g, 'löschen'],
  [/\bgrosse\b/g, 'große'],
  [/\bzurucksetzen\b/g, 'zurücksetzen'],
  [/\bzuruck\b/g, 'zurück'],
  [/\bAusgewahlt\b/g, 'Ausgewählt'],
  [/\bausgewahlt\b/g, 'ausgewählt'],
  [/\bnachstes\b/g, 'nächstes'],
  [/\bnachste\b/g, 'nächste'],
  [/\bmochte\b/g, 'möchte'],
  [/\bkunftig\b/g, 'künftig'],
]

function fixFile(p) {
  const before = fs.readFileSync(p, 'utf8')
  let after = before
  let hits = 0
  const perPattern = []
  for (const [re, good] of REPLACEMENTS) {
    const m = after.match(re)
    if (m) {
      hits += m.length
      perPattern.push(`${m.length}× ${re.source} → ${good}`)
      after = after.replace(re, good)
    }
  }
  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8')
  }
  return { hits, changed: after !== before, perPattern }
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node fix-stripped-umlauts.cjs <file> [<file>...]')
  process.exit(1)
}
let total = 0
for (const f of files) {
  const r = fixFile(f)
  total += r.hits
  if (r.changed) {
    console.log(`FIXED ${f}: ${r.hits} replacements`)
    for (const line of r.perPattern) console.log('  ' + line)
  } else {
    console.log(`clean ${f}`)
  }
}
console.log('---\ntotal replacements:', total)
