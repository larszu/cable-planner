import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PACKET_OPTIONS,
  buildPacketHtml,
  cellHtml,
  sheetFromTable,
  sheetsWithUndescribedColumns,
  type PacketSheet,
} from '../src/renderer/lib/documentPacket'
import { buildDocumentStamp } from '../src/renderer/lib/documentStamp'
import libQuelle from '../src/renderer/lib/documentPacket.ts?raw'
import panelQuelle from '../src/renderer/components/Export/PacketSection.tsx?raw'
import dialogQuelle from '../src/renderer/components/Export/ExportDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Ein Papierstapel, den man zusammenheften kann (Bedarf 115, P3).
//
//   > Stage plot print offers only two modes (grayscale text-only on white, or
//   > full colour with icons on dark), neither of which fits a packet; a
//   > 44-row patch list SPANS PAGES AND LOSES ITS REPEATING HEADER and colour
//   > chips.
//
// Belegt an `SoundDocs/sounddocs#121` (2026-04-23), „for users assembling
// documentation packets"; `Cryde/musicall#803` verlangt zusaetzlich, dass der
// Export die Farbe behaelt.
// ---------------------------------------------------------------------------

const sheet = (over: Partial<PacketSheet> = {}): PacketSheet => ({
  title: over.title ?? 'Zug-Liste',
  headers: over.headers ?? ['Von', 'Nach'],
  rows: over.rows ?? [['A', 'B']],
  ...(over.subtitle ? { subtitle: over.subtitle } : {}),
  ...(over.stamp ? { stamp: over.stamp } : {}),
})

// ── 1. Der Fehler aus dem Beleg ────────────────────────────────────────────

describe('der Spaltenkopf ueberlebt den Seitenumbruch', () => {
  it('setzt `display: table-header-group` auf den Tabellenkopf', () => {
    // DER gemeldete Fehler: „a 44-row patch list spans pages and loses its
    // repeating header". Ab Seite 2 stuende dort eine Zahlenkolonne ohne
    // Spaltennamen.
    const html = buildPacketHtml('Stapel', [sheet()])
    expect(html).toContain('table.data thead { display: table-header-group; }')
  })

  it('legt den Kopf in ein echtes <thead>', () => {
    // Ohne das greift die CSS-Regel nicht: sie beschreibt eine
    // Tabellenkopf-Gruppe, und die gibt es nur, wenn eine da ist.
    const html = buildPacketHtml('Stapel', [sheet({ headers: ['Von', 'Nach'] })])
    expect(html).toMatch(/<thead><tr><th>Von<\/th><th>Nach<\/th><\/tr><\/thead>/)
  })

  it('zerreisst keine Zeile im Umbruch', () => {
    expect(buildPacketHtml('Stapel', [sheet()])).toContain('page-break-inside: avoid')
  })
})

// ── 2. Eine Seite je Artefakt ──────────────────────────────────────────────

describe('der Stapel ist zusammenheftbar', () => {
  it('faengt jedes Blatt AUSSER dem ersten auf einer neuen Seite an', () => {
    const html = buildPacketHtml('Stapel', [sheet({ title: 'Eins' }), sheet({ title: 'Zwei' })])
    // Genau ein Umbruch bei zwei Blaettern: ein Umbruch vor dem ersten
    // erzeugte eine leere erste Seite.
    expect(html.match(/page-break-before:always/g) ?? []).toHaveLength(1)
    expect(html.indexOf('Eins')).toBeLessThan(html.indexOf('page-break-before:always'))
  })

  it('baut EIN Dokument und nicht eines je Blatt', () => {
    const html = buildPacketHtml('Stapel', [sheet({ title: 'Eins' }), sheet({ title: 'Zwei' })])
    expect(html.match(/<!doctype html>/gi) ?? []).toHaveLength(1)
    expect(html).toContain('Eins')
    expect(html).toContain('Zwei')
  })
})

// ── 3. Der Farbmodus ───────────────────────────────────────────────────────

describe('die Farbcodierung ueberlebt den Druck', () => {
  it('traegt eine Farbzelle IMMER ihren Namen', () => {
    // Der heikelste Punkt: ein Farbfeld, das im Graustufendruck zu einem
    // grauen Kaestchen wird, ist keine Information mehr — zwei Gruppen sehen
    // dann gleich aus.
    expect(cellHtml({ value: 'Bühne links', colour: '#c00' }, 'colour')).toContain('Bühne links')
    expect(cellHtml({ value: 'Bühne links', colour: '#c00' }, 'mono')).toBe('Bühne links')
  })

  it('druckt das Farbfeld nur im Farbmodus', () => {
    expect(cellHtml({ value: 'X', colour: '#c00' }, 'colour')).toContain('class="chip"')
    expect(cellHtml({ value: 'X', colour: '#c00' }, 'mono')).not.toContain('chip')
  })

  it('kommt ohne Farbe aus', () => {
    expect(cellHtml({ value: 'X' }, 'colour')).toBe('X')
  })

  it('behandelt gewoehnliche Zellen unveraendert', () => {
    expect(cellHtml('Text', 'colour')).toBe('Text')
    expect(cellHtml(42, 'mono')).toBe('42')
  })

  it('maskiert HTML in Werten und Farben', () => {
    // Ein Geraetename mit `<` ist erlaubt; er darf das Dokument nicht
    // aufbrechen.
    expect(cellHtml('<b>x</b>', 'colour')).toBe('&lt;b&gt;x&lt;/b&gt;')
    expect(cellHtml({ value: 'a', colour: '"><script>' }, 'colour')).not.toContain('<script>')
  })
})

// ── 4. Papier ist weiss ────────────────────────────────────────────────────

describe('das Papier', () => {
  it('folgt dem gewaehlten Format', () => {
    expect(buildPacketHtml('S', [sheet()], { ...DEFAULT_PACKET_OPTIONS, paper: 'A3' })).toContain(
      '@page { size: A3;',
    )
    expect(buildPacketHtml('S', [sheet()], { ...DEFAULT_PACKET_OPTIONS, paper: 'Letter' })).toContain(
      '@page { size: Letter;',
    )
  })

  it('druckt schwarz auf weiss und nicht den dunklen Modus', () => {
    // „full colour with icons on dark" ist einer der beiden Modi, die der
    // Beleg als unbrauchbar nennt: er kostet Toner und macht die Kopie
    // unlesbar.
    const html = buildPacketHtml('S', [sheet()])
    expect(html).toContain('background: #fff')
    expect(html).toContain('color: #111')
  })
})

// ── 5. Das Lexikon ─────────────────────────────────────────────────────────

describe('das Spaltenlexikon', () => {
  it('faehrt vorgabegemaess mit', () => {
    // Ein Packet geht an jemanden, der die Spalten nicht kennt.
    expect(DEFAULT_PACKET_OPTIONS.glossary).toBe(true)
    expect(buildPacketHtml('S', [sheet({ headers: ['Von'] })])).toContain('class="glossary"')
  })

  it('laesst sich abschalten', () => {
    const html = buildPacketHtml('S', [sheet()], { ...DEFAULT_PACKET_OPTIONS, glossary: false })
    expect(html).not.toContain('class="glossary"')
  })

  it('nennt Blaetter mit unerklaerten Spalten', () => {
    const offen = sheetsWithUndescribedColumns([
      sheet({ title: 'Fremd', headers: ['Von', 'Erfundene Spalte'] }),
      sheet({ title: 'Sauber', headers: ['Von'] }),
    ])
    expect(offen).toEqual([{ title: 'Fremd', columns: ['Erfundene Spalte'] }])
  })
})

// ── 6. Der Stempel ─────────────────────────────────────────────────────────

describe('der Stempel', () => {
  // Der Stempel kommt fertig herein — gebaut wird er im Aufrufer, mit dessen
  // Uhr. Hier reicht ein Projekt-Rumpf.
  const projekt = { metadata: { name: 'Testshow' }, revisions: [] } as unknown as Parameters<
    typeof buildDocumentStamp
  >[0]
  const stamp = buildDocumentStamp(projekt, 'abc123', undefined, new Date('2026-09-06T10:00:00Z'))

  it('steht auf dem Blatt, wenn es einen gibt', () => {
    const html = buildPacketHtml('S', [sheet({ stamp })])
    expect(html).toContain('class="stamp"')
    expect(html).toContain('Testshow')
  })

  it('faellt weg, wo keiner uebergeben wurde — statt einen zu erfinden', () => {
    expect(buildPacketHtml('S', [sheet()])).not.toContain('class="stamp"')
  })

  it('wird nicht in diesem Modul gebaut', () => {
    // Die Uhr gehoert dem Aufrufer. Ein Modul, das seine eigene Zeit nimmt,
    // stempelt bei jedem Aufruf anders und macht den Vergleich unmoeglich.
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('Date.now')
  })
})

// ── 7. Ein Blatt aus einer Tabelle ─────────────────────────────────────────

describe('sheetFromTable', () => {
  it('uebernimmt Kopf und Zeilen', () => {
    const s = sheetFromTable('Titel', { headers: ['A'], rows: [['1']] })
    expect(s.title).toBe('Titel')
    expect(s.headers).toEqual(['A'])
    expect(s.rows).toEqual([['1']])
  })

  it('kopiert, statt die Quelle zu teilen', () => {
    // Sonst aendert ein spaeteres Sortieren im Stapel die Tabelle, aus der er
    // gebaut wurde.
    const table = { headers: ['A'], rows: [['1']] }
    const s = sheetFromTable('Titel', table)
    s.headers.push('B')
    expect(table.headers).toEqual(['A'])
  })

  it('laesst Stempel und Untertitel weg, wenn keine da sind', () => {
    const s = sheetFromTable('Titel', { headers: [], rows: [] })
    expect('stamp' in s).toBe(false)
    expect('subtitle' in s).toBe(false)
  })
})

// ── 8. Erreichbar ──────────────────────────────────────────────────────────

describe('der Stapel im Export-Dialog', () => {
  it('ist ein eigener Abschnitt', () => {
    expect(dialogQuelle).toContain("{section === 'packet' && <PacketSection />}")
    expect(dialogQuelle).toContain("packet: 'Unterlagen-Stapel',")
  })

  it('nimmt die Uhr EINMAL fuer den ganzen Stapel', () => {
    // Sonst traegt Blatt 1 eine andere Minute als Blatt 7, und der Stapel
    // sieht aus, als waere er ueber eine Stunde zusammengesucht worden.
    const block = panelQuelle.slice(panelQuelle.indexOf('const blaetter'), panelQuelle.indexOf('const unerklaert'))
    expect(block.match(/new Date\(\)/g) ?? []).toHaveLength(1)
  })

  it('stempelt aus DERSELBEN Ableitung, aus der es druckt', () => {
    expect(panelQuelle).toContain('stampForRows(project, k.table, jetzt)')
  })

  it('bietet nur Blaetter mit eintragbarem Stand an', () => {
    // Ein Blatt ohne Stand kaeme ohne Datum aus dem Drucker.
    expect(panelQuelle).toContain('DOCUMENT_STANDS[k.id]')
  })

  it('meldet unerklaerte Spalten, statt sie stumm zu drucken', () => {
    expect(panelQuelle).toContain('sheetsWithUndescribedColumns(blaetter)')
    expect(panelQuelle).toContain("t('packet.undescribed'")
  })
})
