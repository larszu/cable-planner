import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  MAX_BYTES,
  attachReceipt,
  readReceiptFile,
  receiptTargetPath,
} from '../src/main/services/receiptStore'
import mainSrc from '../src/main/services/receiptStore.ts?raw'
import rendererSrc from '../src/renderer/types/receipt.ts?raw'

const wurzeln: string[] = []
const projekt = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beleg-'))
  wurzeln.push(dir)
  const projectPath = path.join(dir, 'Herbstgala.avplan')
  await writeFile(projectPath, '{}', 'utf-8')
  return { dir, projectPath }
}

afterAll(async () => {
  for (const w of wurzeln) await rm(w, { recursive: true, force: true })
})

describe('der Zielpfad eines Belegs', () => {
  it('liegt neben dem Projekt und ist relativ gespeichert', () => {
    const { abs, rel } = receiptTargetPath('/tmp/jobs/Gala.avplan', 'abc123def456789', 'bon.jpg')
    expect(rel).toBe('Belege/abc123def456-bon.jpg')
    expect(abs).toBe(path.resolve('/tmp/jobs/Belege/abc123def456-bon.jpg'))
  })

  it('lässt sich durch einen Dateinamen nicht aus dem Projektordner tragen', () => {
    const { abs } = receiptTargetPath('/tmp/jobs/Gala.avplan', 'a'.repeat(16), '../../etc/passwd')
    expect(abs.startsWith(path.resolve('/tmp/jobs/Belege'))).toBe(true)
    expect(abs).not.toContain('etc')
  })

  it('lässt nur harmlose Zeichen im gespeicherten Namen stehen', () => {
    const { rel } = receiptTargetPath('/tmp/jobs/Gala.avplan', 'a'.repeat(16), 'bon:strom ?*<>|".jpg')
    const name = rel.slice('Belege/'.length)
    expect(name).toMatch(/^[\p{L}\p{N}._+-]+$/u)
  })

  it('macht aus einem Windows-Pfad im Dateinamen keinen Pfad', () => {
    // path.basename() sieht auf Linux keine Rückwärtsschrägstriche — der
    // gespeicherte Name landet aber auch auf Windows-Rechnern.
    const { rel } = receiptTargetPath('/tmp/jobs/Gala.avplan', 'a'.repeat(16), '..\\..\\Windows\\x.png')
    expect(rel).not.toContain('\\')
  })

  it('behält denselben Namen für denselben Inhalt', () => {
    const a = receiptTargetPath('/tmp/jobs/Gala.avplan', 'ffff0000aaaa1111', 'IMG_1.jpg')
    const b = receiptTargetPath('/tmp/jobs/Gala.avplan', 'ffff0000aaaa1111', 'IMG_1.jpg')
    expect(a.rel).toBe(b.rel)
  })
})

describe('einen Beleg übernehmen', () => {
  it('kopiert die Datei neben das Projekt und gibt einen Anhang zurück', async () => {
    const { dir, projectPath } = await projekt()
    const quelle = path.join(dir, 'quelle.txt')
    await writeFile(quelle, 'Taxi 24,50 EUR', 'utf-8')
    const r = await attachReceipt(projectPath, quelle, '2026-09-07T10:00:00Z')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.attachment.mediaType).toBe('text/plain')
    expect(r.attachment.bytes).toBe(14)
    expect(r.attachment.storedAs.startsWith('Belege/')).toBe(true)
    const kopiert = await readFile(path.join(dir, r.attachment.storedAs), 'utf-8')
    expect(kopiert).toBe('Taxi 24,50 EUR')
  })

  it('legt denselben Beleg nicht zweimal ab', async () => {
    const { projectPath, dir } = await projekt()
    const quelle = path.join(dir, 'bon.txt')
    await writeFile(quelle, 'Summe 9,90', 'utf-8')
    const a = await attachReceipt(projectPath, quelle, '2026-09-07T10:00:00Z')
    const b = await attachReceipt(projectPath, quelle, '2026-09-07T11:00:00Z')
    expect(a.ok && b.ok && a.attachment.storedAs).toBe(b.ok ? b.attachment.storedAs : '')
  })

  it('liest den Aufnahmezeitpunkt aus einem JPEG mit', async () => {
    const { projectPath, dir } = await projekt()
    // Ein JPEG mit genau einem EXIF-Feld — dieselbe Bauweise wie in
    // tests/exifDate.test.ts, hier nur, um den Weg durchs Modul zu zeigen.
    const daten = Buffer.from('2026:02:03 14:22:10\0', 'latin1')
    const tiff = Buffer.alloc(8 + 18 + 18 + daten.length)
    tiff.write('II', 0, 'latin1')
    tiff.writeUInt16LE(42, 2)
    tiff.writeUInt32LE(8, 4)
    tiff.writeUInt16LE(1, 8)
    tiff.writeUInt16LE(0x8769, 10)
    tiff.writeUInt16LE(4, 12)
    tiff.writeUInt32LE(1, 14)
    tiff.writeUInt32LE(26, 18)
    tiff.writeUInt16LE(1, 26)
    tiff.writeUInt16LE(0x9003, 28)
    tiff.writeUInt16LE(2, 30)
    tiff.writeUInt32LE(daten.length, 32)
    tiff.writeUInt32LE(44, 36)
    daten.copy(tiff, 44)
    const app1 = Buffer.alloc(4)
    app1.writeUInt16BE(0xffe1, 0)
    app1.writeUInt16BE(2 + 6 + tiff.length, 2)
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      app1,
      Buffer.from('Exif\0\0', 'latin1'),
      tiff,
    ])
    const quelle = path.join(dir, 'IMG_9911.jpg')
    await writeFile(quelle, jpeg)
    const r = await attachReceipt(projectPath, quelle, '2026-09-07T10:00:00Z')
    expect(r.ok && r.attachment.takenAt).toBe('2026-02-03T14:22:10')
  })
})

describe('was abgelehnt wird, wird benannt abgelehnt', () => {
  it('nimmt ohne gespeichertes Projekt nichts an', async () => {
    const r = await attachReceipt(undefined, '/tmp/egal.jpg', '2026-09-07T10:00:00Z')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('no-project-path')
  })

  it('nimmt keine ausführbare Datei als Beleg', async () => {
    const { projectPath, dir } = await projekt()
    const quelle = path.join(dir, 'skript.sh')
    await writeFile(quelle, 'echo hi', 'utf-8')
    const r = await attachReceipt(projectPath, quelle, '2026-09-07T10:00:00Z')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('unsupported-type')
  })

  it('nimmt kein Verzeichnis', async () => {
    const { projectPath, dir } = await projekt()
    const r = await attachReceipt(projectPath, dir, '2026-09-07T10:00:00Z')
    expect(r.ok).toBe(false)
    // Ein Verzeichnis hat keine erlaubte Endung — das faellt zuerst auf.
    if (!r.ok) expect(['unsupported-type', 'not-a-file']).toContain(r.reason)
  })

  it('nimmt keine Datei über der Grenze', async () => {
    const { projectPath, dir } = await projekt()
    const quelle = path.join(dir, 'riesig.pdf')
    await writeFile(quelle, Buffer.alloc(MAX_BYTES + 1))
    const r = await attachReceipt(projectPath, quelle, '2026-09-07T10:00:00Z')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('too-large')
  })
})

describe('einen Beleg zurückholen', () => {
  it('gibt den Inhalt und bei Text auch den Wortlaut zurück', async () => {
    const { projectPath, dir } = await projekt()
    const quelle = path.join(dir, 'bon.txt')
    await writeFile(quelle, 'Summe 12,00', 'utf-8')
    const a = await attachReceipt(projectPath, quelle, '2026-09-07T10:00:00Z')
    if (!a.ok) throw new Error('Anhang fehlgeschlagen')
    const c = await readReceiptFile(projectPath, a.attachment.storedAs)
    expect(c.ok).toBe(true)
    if (c.ok) expect(c.text).toBe('Summe 12,00')
  })

  it('sagt „fehlt", wenn der Belege-Ordner nicht mitgereist ist', async () => {
    const { projectPath } = await projekt()
    const c = await readReceiptFile(projectPath, 'Belege/abc-nicht-da.jpg')
    expect(c.ok).toBe(false)
    if (!c.ok) expect(c.reason).toBe('missing')
  })

  it('liest nichts außerhalb des Projektverzeichnisses', async () => {
    const { projectPath } = await projekt()
    const c = await readReceiptFile(projectPath, '../../../etc/passwd')
    expect(c.ok).toBe(false)
    if (!c.ok) expect(c.reason).toBe('outside-project')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Main und Renderer teilen in dieser App keine Typen — main kennt
// `src/renderer/` nicht. `ReceiptAttachment` steht deshalb zweimal da, und
// zwei Abschriften laufen auseinander. Dieser Test ist die Klammer: wer
// drueben ein Feld ergaenzt und hier nicht, faellt hier auf und nicht erst
// beim Nutzer, dessen Beleg dann ein Feld verliert.
// ───────────────────────────────────────────────────────────────────────────
const felderVon = (quelle: string, name: string): string[] => {
  const i = quelle.indexOf(`interface ${name} {`)
  if (i < 0) throw new Error(`${name} nicht gefunden`)
  const koerper = quelle.slice(i, quelle.indexOf('\n}', i))
  return [...koerper.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]).sort()
}

describe('die beiden Abschriften des Belegs', () => {
  it('tragen dieselben Felder in main und im Renderer', () => {
    expect(felderVon(rendererSrc, 'ReceiptAttachment')).toEqual(
      felderVon(mainSrc, 'ReceiptAttachment'),
    )
  })

  it('nennen dieselben Ablehnungsgründe', () => {
    const gruende = (q: string) =>
      [...q.slice(q.indexOf('type AttachRefusal =')).matchAll(/'([a-z-]+)'/g)]
        .map((m) => m[1])
        .slice(0, 6)
        .sort()
    expect(gruende(rendererSrc)).toEqual(gruende(mainSrc))
  })
})
