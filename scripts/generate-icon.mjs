// Generate the app icon set from build/icon.svg (master, with signet "lz.")
// and public/favicon.svg (pictogram only). Run after editing either SVG:
//   node scripts/generate-icon.mjs
// Below 48 px the signet is unreadable, so the ICO takes those sizes from the
// favicon (Brand Guide 2.0: icon under 48 px without the tally dot).
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const at = (p) => resolve(root, p)

const gross = await readFile(at('build/icon.svg'))
const klein = await readFile(at('public/favicon.svg'))
const png = (svg, size) => sharp(svg, { density: 300 }).resize(size, size).png({ compressionLevel: 9 })

for (const [file, size] of [
  ['build/icon.png', 1024],
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
]) {
  await png(gross, size).toFile(at(file))
  console.log('wrote', file)
}

const sizes = [16, 24, 32, 48, 64, 128, 256]
const ico = await pngToIco(await Promise.all(sizes.map((n) => png(n < 48 ? klein : gross, n).toBuffer())))
await writeFile(at('build/icon.ico'), ico)
console.log('wrote build/icon.ico', `(${sizes.join(',')} px)`)
