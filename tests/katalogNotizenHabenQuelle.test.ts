import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cableCatalog } from '../src/renderer/types/cableSpec'
import { VIDEO_FORMATS } from '../src/renderer/types/videoFormat'

// ---------------------------------------------------------------------------
// Ein `notesKey` ohne `notesSource` schreibt LEERE Notizen in die Projektdatei.
//
// ─── DER BEFUND (2026-09-10) ───────────────────────────────────────────────
//
// `CableDialog.tsx` loeste die Katalog-Notiz woertlich so auf:
//
//     setNotes(spec.notesKey ? t(spec.notesKey, '') : (spec.notes ?? ''))
//
// Der zweite Parameter von `t()` ist der Rueckfall, und er war LEER. Seit
// E-28 (2026-09-09) ist Englisch die Quellsprache und steht deshalb NICHT
// mehr als Woerterbuch in der Registry — `lib/i18n.ts` sagt das ausdruecklich
// („Englisch fehlt hier mit Absicht"). Damit gab es fuer jede Sprache ausser
// Deutsch nichts, worauf `t()` zurueckfallen konnte:
//
//     Deutsch    de-Dict trifft zu           -> die uebersetzte Notiz
//     Englisch   kein Dict, Fallback ''      -> LEER
//     jede weitere Sprache                   -> LEER
//
// ─── WARUM DAS NICHT NUR ANZEIGE IST ───────────────────────────────────────
//
// Weil der Wert nicht angezeigt, sondern GESCHRIEBEN wird: `setNotes` fuellt
// das Notizfeld des Kabels, und das steht in `Cable.notes` — in der
// Projektdatei des Nutzers. Ein englischer Nutzer bekam die Beschreibung also
// nicht bloss leer zu sehen; er bekam sie leer in seine eigenen Daten
// geschrieben, waehrend ein deutscher Nutzer denselben Katalog-Eintrag mit
// Text bekam. Dieselbe Datei, spaeter geoeffnet, sieht dann je nach Sprache
// des Erstellers anders aus.
//
// Genau diese Richtung hat `tests/deutschesDictIstDeutsch.test.ts` schon
// einmal benannt — dort ging es um englische Werte im deutschen Woerterbuch,
// die in die Projektdatei wanderten. Die Leerstelle ist derselbe Weg, nur
// ohne Text.
//
// ─── WAS DIESER TEST FESTHAELT ─────────────────────────────────────────────
//
// Der uebliche Weg dieses Repos — `t(key, 'English text')` — war hier nicht
// gangbar: der Schluessel ist DYNAMISCH (`t(spec.notesKey, …)`), der Text
// kann also nicht an der Aufrufstelle stehen. Er steht deshalb als
// `notesSource` im Katalog-Eintrag, neben dem Schluessel.
//
// Das Paar kann jetzt nur noch gemeinsam wandern, und dieser Test besteht
// darauf. Ein neuer Katalog-Eintrag mit `notesKey` und ohne `notesSource`
// faellt hier durch — nicht erst, wenn jemand mit englischer Oberflaeche
// eine Projektdatei mit leeren Notizen abgibt.
// ---------------------------------------------------------------------------

/** Beide Kataloge in einer Liste — die Regel gilt fuer jeden `notesKey`. */
const EINTRAEGE: Array<{ katalog: string; id: string; notesKey?: string; notesSource?: string }> = [
  ...cableCatalog.map((c) => ({ katalog: 'cableCatalog', id: c.id, ...c })),
  ...VIDEO_FORMATS.map((v) => ({ katalog: 'VIDEO_FORMATS', id: v.id, ...v })),
]

describe('Katalog-Notizen tragen ihre Quellsprache mit', () => {
  it('sieht ueberhaupt Eintraege — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waere die Regel unten auch dann erfuellt, wenn
    // ein Katalog leer importiert wuerde. Eine leere Menge erfuellt jede
    // Regel; ein Waechter, der daran gruen wird, behauptet eine Deckung,
    // die es nicht gibt.
    const mitSchluessel = EINTRAEGE.filter((e) => e.notesKey)
    expect(mitSchluessel.length).toBeGreaterThan(40)
  })

  it('jeder notesKey hat einen nicht-leeren notesSource', () => {
    const ohne = EINTRAEGE.filter((e) => e.notesKey && !e.notesSource?.trim()).map(
      (e) => `${e.katalog}/${e.id} (${e.notesKey})`,
    )
    expect(
      ohne,
      'Ein `notesKey` ohne `notesSource` faellt fuer jede Sprache ohne ' +
        'Woerterbuch-Eintrag auf den leeren String zurueck — und der landet ' +
        'ueber `CableDialog` in `Cable.notes`, also in der Projektdatei:\n  ' +
        `${ohne.join('\n  ')}`,
    ).toEqual([])
  })

  it('die Aufrufstelle benutzt notesSource als Rueckfall, nicht den leeren String', () => {
    // DIE ZWEITE HAELFTE DERSELBEN ZUSICHERUNG. Jeder Eintrag koennte seinen
    // Quelltext tragen und der Aufruf ihn trotzdem ignorieren — das war der
    // Zustand vorher, nur mit vertauschten Rollen. Die Regel oben prueft die
    // Daten, diese hier den Weg, auf dem sie gelesen werden.
    const quelle = readFileSync(
      join(process.cwd(), 'src', 'renderer', 'components', 'Cable', 'CableDialog.tsx'),
      'utf8',
    )
    expect(quelle).toContain('t(spec.notesKey, spec.notesSource ?? \'\')')
    expect(quelle).not.toContain("t(spec.notesKey, '')")
  })

  // DIE GEGENPROBE — „ist im Quellfeld versehentlich Deutsch gelandet?" —
  // steht bewusst NICHT hier, sondern in `deutschesDictIstDeutsch.test.ts`.
  // Dort wird dieselbe Frage seit dem Befund von damals gestellt (elf
  // unuebersetzte Kabel-Notizen in den Projektdateien deutscher Nutzer), und
  // dieser Test hat sie seit #829 an der neuen Quelle. Zwei Tests, die
  // dasselbe rechnen, sind die Defektform `zwei-rechnungen`: sie laufen
  // auseinander, und dann glaubt man dem falschen.
})
