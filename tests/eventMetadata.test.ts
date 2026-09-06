import { describe, expect, it } from 'vitest'
import {
  EVENT_METADATA_FINDING_LABEL,
  assessEventMetadata,
  eventMetadataTable,
  normaliseEventMetadata,
  resolveEventMetadata,
} from '../src/renderer/lib/eventMetadata'
import { PRIVACY_LABEL, type EventMetadataPlan } from '../src/renderer/types/eventMetadata'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { DeliveryDestination } from '../src/renderer/types/delivery'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import dialogQuelle from '../src/renderer/components/Delivery/DeliveryDialog.tsx?raw'
import typenQuelle from '../src/renderer/types/eventMetadata.ts?raw'
import libQuelle from '../src/renderer/lib/eventMetadata.ts?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'

// ---------------------------------------------------------------------------
// Die Angaben zur Veranstaltung, einmal getippt (Bedarf 88, P2).
//
//   > Event metadata (title, description, thumbnail, scheduled start, privacy)
//   > entered once and reconciled across platforms.
//
// Der Bedarf zieht die Grenze selbst: „integration with platform APIs is out
// of scope for an offline-first planning tool". Also kein Hochladen, keine
// Rueckmeldung, keine erfundenen Plattform-Grenzen — ein Satz Angaben, die
// ausdruecklichen Abweichungen, und ein Blatt zum Abtippen.
// ---------------------------------------------------------------------------

const ziel = (id: string, name: string, over: Partial<DeliveryDestination> = {}): DeliveryDestination =>
  ({
    id,
    name,
    platform: 'youtube',
    transport: 'RTMP',
    encoding: {
      width: 1920,
      height: 1080,
      fps: 25,
      videoCodec: 'H.264',
      videoBitrateKbps: 6000,
      keyframeSec: 2,
      audioCodec: 'AAC',
      audioSampleRate: 48000,
      audioBitrateKbps: 128,
    },
    ...over,
  }) as DeliveryDestination

const projekt = (
  dests: DeliveryDestination[],
  eventMetadata?: EventMetadataPlan,
): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    deliveryDestinations: dests,
    ...(eventMetadata ? { eventMetadata } : {}),
  }) as CablePlannerProject

const arten = (p: CablePlannerProject): string[] =>
  assessEventMetadata(p).findings.map((f) => f.kind)

/**
 * Der Abschnitt IM RENDER-BAUM, nicht der Kommentar ueber dem Handler.
 *
 * Erste Fassung schnitt auf `indexOf('BEDARF 88')` — und traf damit den
 * Kommentar ueber `setEventMetadata` weiter oben in der Datei, der VOR dem
 * Kommentar zu Bedarf 89 steht. Ergebnis war ein leerer Ausschnitt, gegen den
 * jede Behauptung durchgefallen waere (hier) oder, bei umgekehrter Anordnung,
 * jede durchgegangen. Deshalb die JSX-Marken und die Laengenpruefung: ein
 * Ausschnitt, der nichts enthaelt, ist kein bestandener Test.
 */
const renderAbschnitt = (): string => {
  const von = dialogQuelle.indexOf('{/* BEDARF 88')
  const bis = dialogQuelle.indexOf('{/* BEDARF 89')
  expect(von).toBeGreaterThan(-1)
  expect(bis).toBeGreaterThan(von)
  return dialogQuelle.slice(von, bis)
}

// ── 1. Die Aufloesung ──────────────────────────────────────────────────────

describe('resolveEventMetadata — die eine Engstelle', () => {
  it('nimmt den Projektwert, wenn das Ziel nichts anderes sagt', () => {
    const r = resolveEventMetadata(
      { privacy: 'public', title: 'Jahreskonzert' },
      ziel('a', 'YouTube'),
      undefined,
    )
    expect(r.title).toBe('Jahreskonzert')
    expect(r.titleFrom).toBe('project')
    expect(r.privacy).toBe('public')
    expect(r.privacyFrom).toBe('project')
  })

  it('laesst die Abweichung gewinnen — und nennt sie als Herkunft', () => {
    const r = resolveEventMetadata(
      { privacy: 'public', title: 'Jahreskonzert' },
      ziel('a', 'YouTube'),
      { destinationId: 'a', title: 'Annual Concert', privacy: 'unlisted', reason: 'EN-Kanal' },
    )
    expect(r.title).toBe('Annual Concert')
    expect(r.titleFrom).toBe('override')
    expect(r.privacy).toBe('unlisted')
    expect(r.privacyFrom).toBe('override')
    expect(r.reason).toBe('EN-Kanal')
  })

  it('behandelt ein LEERES Feld der Abweichung als „hier nichts anderes"', () => {
    // Der Unterschied ist nicht kosmetisch: waere ein leeres Feld ein
    // Ueberschreiber, verloere das Ziel seinen Titel, sobald jemand das
    // Abweichungsfeld einmal angefasst und wieder geleert hat.
    const r = resolveEventMetadata(
      { privacy: 'public', title: 'Jahreskonzert' },
      ziel('a', 'YouTube'),
      { destinationId: 'a', title: '   ' },
    )
    expect(r.title).toBe('Jahreskonzert')
    expect(r.titleFrom).toBe('project')
  })

  it('nennt „nirgends", wenn weder Projekt noch Ziel etwas sagen', () => {
    const r = resolveEventMetadata({ privacy: 'not-stated' }, ziel('a', 'YouTube'), undefined)
    expect(r.title).toBe('')
    expect(r.titleFrom).toBe('none')
    expect(r.privacyFrom).toBe('none')
  })
})

// ── 2. Die Befunde ─────────────────────────────────────────────────────────

describe('assessEventMetadata — die Befunde', () => {
  it('meldet fehlende Angaben, sobald es ein Ziel gibt', () => {
    expect(arten(projekt([ziel('a', 'YouTube')]))).toContain('no-metadata')
  })

  it('schweigt, solange es kein Ziel gibt — der Befund haette keinen Anlass', () => {
    expect(arten(projekt([]))).not.toContain('no-metadata')
  })

  it('meldet Angaben ohne Ziel — das Blatt haette keine Zeile', () => {
    expect(arten(projekt([], { event: { privacy: 'public', title: 'X' }, overrides: [] }))).toContain(
      'no-destinations',
    )
  })

  it('meldet einen Beginn ohne Zeitzone und raet keine dazu', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      event: { privacy: 'public', title: 'X', scheduledStart: '2026-09-12T19:00' },
      overrides: [],
    })
    expect(arten(p)).toContain('start-unzoned')
    // Der Wert bleibt, wie er ist. Eine hier ergaenzte Zone waere geraten.
    expect(assessEventMetadata(p).plan.event.scheduledStart).toBe('2026-09-12T19:00')
  })

  it('nimmt einen Beginn MIT Offset an', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      event: { privacy: 'public', title: 'X', scheduledStart: '2026-09-12T19:00+02:00' },
      overrides: [],
    })
    expect(arten(p)).not.toContain('start-unzoned')
    expect(arten(p)).not.toContain('start-timeless')
  })

  it('unterscheidet „nur Datum" von „ohne Zone"', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      event: { privacy: 'public', title: 'X', scheduledStart: '2026-09-12' },
      overrides: [],
    })
    expect(arten(p)).toContain('start-timeless')
    expect(arten(p)).not.toContain('start-unzoned')
  })

  it('meldet eine nicht angegebene Sichtbarkeit und setzt KEINEN Vorgabewert', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      event: { privacy: 'not-stated', title: 'X' },
      overrides: [],
    })
    expect(arten(p)).toContain('privacy-not-stated')
    // „oeffentlich" zu raten schaltete im Zweifel die Generalprobe ins Netz.
    expect(assessEventMetadata(p).resolved[0].privacy).toBe('not-stated')
  })

  it('meldet eine Abweichung ohne Begruendung', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      event: { privacy: 'public', title: 'X' },
      overrides: [{ destinationId: 'a', title: 'Y' }],
    })
    expect(arten(p)).toContain('override-unexplained')
  })

  it('schweigt, wenn die Abweichung begruendet ist', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      event: { privacy: 'public', title: 'X' },
      overrides: [{ destinationId: 'a', title: 'Y', reason: 'EN-Kanal' }],
    })
    expect(arten(p)).not.toContain('override-unexplained')
  })

  it('meldet eine Abweichung, die nichts abweicht', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      event: { privacy: 'public', title: 'X' },
      overrides: [{ destinationId: 'a', reason: 'steht hier seit letztem Jahr' }],
    })
    expect(arten(p)).toContain('override-inert')
    // …und dann NICHT zusaetzlich „ohne Begruendung": das waere derselbe
    // Sachverhalt zweimal, und der zweite Satz widerspraeche dem ersten.
    expect(arten(p)).not.toContain('override-unexplained')
  })

  it('behaelt eine Abweichung auf ein geloeschtes Ziel und benennt sie', () => {
    const p = projekt([ziel('a', 'YouTube')], {
      event: { privacy: 'public', title: 'X' },
      overrides: [{ destinationId: 'weg', title: 'Y' }],
    })
    expect(arten(p)).toContain('override-orphan')
  })

  it('meldet einen Ausweichweg, der andere Angaben traegt als sein Primaerweg', () => {
    const p = projekt([ziel('a', 'Haupt'), ziel('b', 'Backup', { backupOfId: 'a' })], {
      event: { privacy: 'public', title: 'X' },
      overrides: [{ destinationId: 'b', title: 'Anders', reason: 'Versehen' }],
    })
    const f = assessEventMetadata(p).findings.find((x) => x.kind === 'backup-differs')
    expect(f).toBeTruthy()
    expect(f?.destinationId).toBe('b')
    expect(f?.text).toContain('Titel')
  })

  it('schweigt, wenn Ausweichweg und Primaerweg dasselbe tragen', () => {
    const p = projekt([ziel('a', 'Haupt'), ziel('b', 'Backup', { backupOfId: 'a' })], {
      event: { privacy: 'public', title: 'X' },
      overrides: [],
    })
    expect(arten(p)).not.toContain('backup-differs')
  })

  it('gibt jeder Befundart eine Beschriftung', () => {
    for (const kind of Object.keys(EVENT_METADATA_FINDING_LABEL)) {
      expect(EVENT_METADATA_FINDING_LABEL[kind as never]).toBeTruthy()
    }
  })
})

// ── 3. Das Blatt ───────────────────────────────────────────────────────────

describe('eventMetadataTable — das Blatt zum Abtippen', () => {
  it('gibt jeder leeren Zelle einen NAMEN statt sie leer zu lassen', () => {
    const t = eventMetadataTable(projekt([ziel('a', 'YouTube')]))
    expect(t.rows).toHaveLength(1)
    const zeile = t.rows[0].map(String)
    expect(zeile).toContain('kein Titel')
    expect(zeile).toContain('kein Beginn')
    expect(zeile).toContain('nicht benannt')
    expect(zeile).toContain('keine')
    // Eine leere Zelle liest sich auf Papier als „nichts einzutragen".
    expect(zeile.every((z) => z.trim() !== '')).toBe(true)
  })

  it('traegt die Herkunft jedes Werts, damit niemand eine Abweichung „zurechtkorrigiert"', () => {
    const t = eventMetadataTable(
      projekt([ziel('a', 'YouTube')], {
        event: { privacy: 'public', title: 'X' },
        overrides: [{ destinationId: 'a', title: 'Y', reason: 'EN-Kanal' }],
      }),
    )
    expect(t.headers).toContain('Titel aus')
    const zeile = t.rows[0].map(String)
    expect(zeile).toContain('Y')
    expect(zeile).toContain('Abweichung')
    expect(zeile).toContain('EN-Kanal')
  })

  it('schreibt „—" fuer ein Ziel ohne Abweichung, nicht „ohne Begruendung"', () => {
    const t = eventMetadataTable(
      projekt([ziel('a', 'YouTube')], { event: { privacy: 'public', title: 'X' }, overrides: [] }),
    )
    expect(t.rows[0].map(String)).toContain('—')
    expect(t.rows[0].map(String)).not.toContain('ohne Begründung')
  })

  it('traegt kanonisches Deutsch, damit der Stand nicht an der Sprache haengt', () => {
    // Dieselbe Regel wie bei `deliveryIssueText`: ein Blatt, dessen Text mit
    // der eingestellten Sprache wechselt, meldete jedes gedruckte Exemplar
    // als veraltet.
    expect(libQuelle).not.toMatch(/\bfrom '\.\/i18n/)
    expect(libQuelle).not.toContain("t('")
    expect(PRIVACY_LABEL.public).toBe('öffentlich')
  })

  it('ist als Dokument mit Stand und lesbarem Namen registriert', () => {
    expect(DOCUMENT_STANDS['event-metadaten']).toBeTruthy()
    expect(DOCUMENT_LABELS['event-metadaten']).toBeTruthy()
  })
})

// ── 4. Das Laden ───────────────────────────────────────────────────────────

describe('normaliseEventMetadata — was das Laden ueberlebt', () => {
  it('verwirft eine Abweichung ohne Ziel-Id und meldet sie', () => {
    const drops: string[] = []
    const out = normaliseEventMetadata(
      { event: { privacy: 'public', title: 'X' }, overrides: [{ title: 'Y' }] },
      (d) => drops.push(d.reason),
    )
    expect(out?.overrides).toHaveLength(0)
    expect(drops).toEqual(['missing-required'])
  })

  it('verwirft die zweite Abweichung auf dasselbe Ziel', () => {
    const drops: string[] = []
    const out = normaliseEventMetadata(
      {
        event: { privacy: 'public' },
        overrides: [
          { destinationId: 'a', title: 'erst' },
          { destinationId: 'a', title: 'dann' },
        ],
      },
      (d) => drops.push(d.reason),
    )
    expect(out?.overrides).toHaveLength(1)
    expect(out?.overrides[0].title).toBe('erst')
    expect(drops).toEqual(['duplicate-id'])
  })

  it('BEHAELT eine Abweichung auf ein Ziel, das es nicht mehr gibt', () => {
    // Sie hier wegzuwerfen hiesse, einen abweichenden Titel spurlos
    // verschwinden zu lassen. Dafuer gibt es `override-orphan`.
    const out = normaliseEventMetadata({
      event: { privacy: 'public' },
      overrides: [{ destinationId: 'laengst-weg', title: 'Y' }],
    })
    expect(out?.overrides).toHaveLength(1)
  })

  it('verwirft ein Objekt, das nichts traegt — sonst Ballast in jedem File', () => {
    expect(normaliseEventMetadata({ event: { privacy: 'not-stated' }, overrides: [] })).toBeUndefined()
    expect(normaliseEventMetadata({})).toBeUndefined()
    expect(normaliseEventMetadata(null)).toBeUndefined()
  })

  it('haelt den Beginn fest, wie er dasteht — ohne Offset zu erfinden', () => {
    const out = normaliseEventMetadata({
      event: { privacy: 'public', scheduledStart: '2026-09-12T19:00' },
      overrides: [],
    })
    expect(out?.event.scheduledStart).toBe('2026-09-12T19:00')
  })

  it('laeuft auf dem Lade-Pfad und meldet Verworfenes an den Ladebericht', () => {
    expect(storeQuelle).toMatch(/normaliseEventMetadata\(project\.eventMetadata, \(d\) =>/)
    expect(storeQuelle).toMatch(/kind: 'metadata-override'/)
    // …und das Ergebnis landet auch im geheilten Projekt. Ohne diese Zeile
    // liefe die Normalisierung ins Leere: verworfen wuerde gemeldet, aber das
    // Behaltene nie uebernommen.
    expect(storeQuelle).toMatch(/\n {4}eventMetadata,\n/)
  })
})

// ── 5. Die Grenzen, die der Bedarf selbst zieht ────────────────────────────

describe('was ausdruecklich NICHT gebaut wird', () => {
  it('erfindet keine Plattform-Grenzen fuer Titel- oder Textlaengen', () => {
    // `types/delivery.ts`: „jeder Vorgabewert traegt seine Quelle". Fuer
    // Zeichenlimits liegt im Korpus keine — ein Warner mit geratenen Grenzen
    // kuerzte Titel, die gepasst haetten.
    expect(libQuelle).not.toMatch(/maxTitle|titleLimit|\.length\s*>\s*\d{2,}/)
    expect(typenQuelle).not.toMatch(/maxTitle|titleLimit/)
  })

  it('behauptet nirgends, die Plattform habe die Angaben angenommen', () => {
    expect(libQuelle).not.toMatch(/accepted|uploaded|published|angenommen/i)
  })

  it('legt das Vorschaubild als VERWEIS ab, nicht als eingebettetes Bild', () => {
    // Ein eingebettetes Vollbild vervielfachte die Dateigroesse jeder
    // `.avplan`, die per Mail geht — fuer etwas, das ohnehin bei jeder
    // Plattform von Hand hochgeladen wird.
    expect(typenQuelle).toContain('thumbnailRef')
    expect(typenQuelle).not.toMatch(/data:image|base64/)
  })
})

// ── 6. Die Oberflaeche ─────────────────────────────────────────────────────

describe('der Dialog', () => {
  it('zeigt den Abschnitt nur, wenn es ein Ziel gibt', () => {
    const abschnitt = renderAbschnitt()
    expect(abschnitt).toContain('{list.length > 0 && (')
  })

  it('nimmt den Beginn als Text und NICHT als datetime-local', () => {
    // `datetime-local` liefert „2026-09-12T19:00" ohne Offset, und der Plan
    // saehe aus, als wuesste er die Zeitzone. Genau der Fehler, gegen den
    // dieser Bedarf geschrieben ist.
    const abschnitt = renderAbschnitt()
    // Auf `type="datetime-local"` gepruft und nicht auf das blosse Wort: der
    // Kommentar im Abschnitt nennt es, gerade weil es dort NICHT steht.
    expect(abschnitt).not.toMatch(/type=["']datetime-local["']/)
    expect(abschnitt).toMatch(/delivery\.event\.startPh/)
  })

  it('zeigt jeden Befund mit seiner Beschriftung an, nicht nur den Text', () => {
    const abschnitt = renderAbschnitt()
    expect(abschnitt).toMatch(
      /meta\.findings\.length > 0 &&[\s\S]*EVENT_METADATA_FINDING_LABEL\[f\.kind\][\s\S]*f\.text/,
    )
  })

  it('entfernt eine leer gewordene Abweichung, statt sie als Leiche zu behalten', () => {
    expect(dialogQuelle).toMatch(
      /const leer = !next\.title && !next\.description && !next\.privacy && !next\.reason/,
    )
    expect(dialogQuelle).toMatch(/overrides: leer \? rest : \[\.\.\.rest, next\]/)
  })
})
