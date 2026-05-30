// One-shot fixer for double-encoded UTF-8 (mojibake) introduced when an
// already-UTF-8 file was saved by an editor that interpreted the bytes as
// Latin-1. Surgical: only replaces known mojibake tokens, never touches
// already-healthy chars. Safe to re-run.
const fs = require('fs')
const path = require('path')

const REPLACEMENTS = [
  // 3-byte UTF-8 sequences first (longest match wins)
  ['â€¦', '…'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€', '”'],
  ['â€“', '–'],
  ['â€”', '—'],
  ['â†’', '→'],
  ['â†'+'', '←'],
  ['â¬†', '⬆'],
  ['âŸ³', '⏳'],
  ['âœ“', '✓'],
  ['âœ—', '✗'],
  // 2-byte UTF-8 sequences (German + common punctuation)
  ['Ã¤', 'ä'], ['Ã¶', 'ö'], ['Ã¼', 'ü'],
  ['Ã„', 'Ä'], ['Ã–', 'Ö'], ['Ãœ', 'Ü'], ['ÃŸ', 'ß'],
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã ', 'à'],
  ['Ã¡', 'á'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'],
  ['Ã±', 'ñ'], ['Ã¢', 'â'], ['Ã§', 'ç'],
  ['Ã—', '×'], ['Ã·', '÷'],
  ['Â·', '·'], ['Â°', '°'], ['Â§', '§'],
  ['Â ', ' '], ['Âµ', 'µ'], ['Â´', '´'],
  ['Â¿', '¿'], ['Â¡', '¡'], ['Â®', '®'], ['Â©', '©'],
  ['Â²', '²'], ['Â³', '³'], ['Â¹', '¹'], ['Â¼', '¼'], ['Â½', '½'], ['Â¾', '¾'],
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function fixFile(p) {
  const before = fs.readFileSync(p, 'utf8')
  let after = before
  let hits = 0
  for (const [bad, good] of REPLACEMENTS) {
    const re = new RegExp(escapeRe(bad), 'g')
    const m = after.match(re)
    if (m) {
      hits += m.length
      after = after.replace(re, good)
    }
  }
  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8')
  }
  return { hits, changed: after !== before, before: before.length, after: after.length }
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node fix-mojibake.cjs <file> [<file>...]')
  process.exit(1)
}
let total = 0
for (const f of files) {
  const r = fixFile(f)
  total += r.hits
  console.log(
    (r.changed ? 'FIXED ' : 'clean ') +
      f +
      ' (replacements: ' + r.hits + ', ' + r.before + ' -> ' + r.after + ')',
  )
}
console.log('total replacements:', total)
