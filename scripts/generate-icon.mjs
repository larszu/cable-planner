// Generate build/icon.png (1024x1024) and build/icon.ico from build/icon.svg.
// Run after editing build/icon.svg:  node scripts/generate-icon.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const svgPath = resolve(root, 'build/icon.svg')
const pngPath = resolve(root, 'build/icon.png')
const icoPath = resolve(root, 'build/icon.ico')

const svg = await readFile(svgPath)

// Master 1024px PNG — electron-builder uses this as cross-platform source.
await sharp(svg, { density: 384 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(pngPath)
console.log('wrote', pngPath)

// Multi-resolution ICO (Windows Explorer + installer header use these).
const sizes = [16, 24, 32, 48, 64, 128, 256]
const buffers = await Promise.all(
  sizes.map((size) =>
    sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
  ),
)
const ico = await pngToIco(buffers)
await writeFile(icoPath, ico)
console.log('wrote', icoPath, `(${sizes.join(',')} px)`)
