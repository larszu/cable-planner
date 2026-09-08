// ───────────────────────────────────────────────────────────────────────────
// Welche Show hängt gerade an dieser Freigabe? (Bedarf 127, P4)
//
//   > One machine, one operator, one file; a house running roughly 65 events a
//   > year cannot have team members working concurrently ON SEPARATE SHOWS.
//
// Belege: `cpvalente/ontime#1325` (2024) und `bitfocus/companion#1738`.
//
// WAS HIER GEPRÜFT WIRD, und warum jede Zeile davon nötig ist:
//
//  1. EINE SHOW HAT EINE KENNUNG, UND „KEINE" IST EIN EIGENER FALL. Zwei
//     kennungslose Shows sind nicht dieselbe Show.
//
//  2. IM ZWEIFEL WIRD NICHT GEBUCHT. Fehlt die Kennung auf einer der beiden
//     Seiten, wird der Rückweg abgewiesen — annehmen hieße, im Zweifel in
//     irgendein Projekt zu schreiben.
//
//  3. ABGEWIESEN HEISST BEGRÜNDET. Eine Rückmeldung, die ohne Erklärung
//     verschwindet, sieht am Handy aus wie ein Netzfehler — und dann drückt
//     der Field-Tech noch dreimal.
//
//  4. ALLE SCHREIBWEGE GEHEN DURCH DIESELBE PRÜFUNG. Eigene
//     Vergleiche wären drei Gelegenheiten, einen zu vergessen.
//
//  5. DIE FREIGABE ZIEHT DIE SHOW MIT. Wer das Projekt tauscht und die
//     Kennung stehen lässt, hat den Defekt nur verschoben.
//
//  6. DIE KENNUNG ENTSTEHT AN DER MIGRATIONS-STELLE — und wird dort nur
//     vergeben, wenn sie fehlt. Beim bloßen Öffnen aus einer Show eine andere
//     zu machen, wäre schlimmer als gar keine Kennung.
//
//  7. DAS HANDY SPEICHERT JE SHOW, NICHT JE NAME. Zwei Shows „Konzert"
//     teilten sich sonst einen Haken-Speicher.
//
//  8. DER SHOW-WECHSEL WIRD BEMERKT UND NICHT VOLLZOGEN.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  SHOW_REJECTION_REASON,
  showIdOf,
  showMismatch,
  type ShowRejection,
} from '../src/main/util/shareShow'

const lies = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8')

/**
 * Quelltext OHNE Kommentare.
 *
 * Ein Waechter, den sein eigener Kommentar zufrieden stellt, prueft nichts.
 */
const ohneKommentare = (rel: string): string =>
  lies(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

describe('Bedarf 127 — welche Show hängt an dieser Freigabe?', () => {
  it('1. eine Show hat eine Kennung, und „keine" ist ein eigener Fall', () => {
    expect(showIdOf({ metadata: { projectId: 'abc' } })).toBe('abc')
    // Alles, was keine Kennung ist, ist `null` — und nicht der leere String,
    // der sich gegen einen anderen leeren String vergleichen liesse.
    expect(showIdOf({ metadata: { projectId: '   ' } })).toBeNull()
    expect(showIdOf({ metadata: {} })).toBeNull()
    expect(showIdOf({})).toBeNull()
    expect(showIdOf(null)).toBeNull()
    expect(showIdOf('nicht mal ein Objekt')).toBeNull()
    expect(showIdOf({ metadata: { projectId: 42 } })).toBeNull()
  })

  it('2. im Zweifel wird nicht gebucht', () => {
    // Zwei kennungslose Seiten sind NICHT dieselbe Show.
    expect(showMismatch(null, null).ok).toBe(false)
    expect(showMismatch(null, 'a').ok).toBe(false)
    expect(showMismatch('a', null).ok).toBe(false)
    expect(showMismatch('a', 'b').ok).toBe(false)
    // Und nur die Uebereinstimmung geht durch.
    expect(showMismatch('a', 'a').ok).toBe(true)
    expect(showMismatch('a', 'a').rejection).toBeNull()
  })

  it('3. abgewiesen heisst begründet', () => {
    const faelle: Array<[string | null, string | null, ShowRejection]> = [
      ['a', 'b', 'other-show'],
      ['a', null, 'no-show-sent'],
      [null, 'a', 'no-show-served'],
    ]
    for (const [served, sent, erwartet] of faelle) {
      const r = showMismatch(served, sent)
      expect(r.rejection, `${served} / ${sent}`).toBe(erwartet)
      expect(r.reason).toBe(SHOW_REJECTION_REASON[erwartet])
      // Der Grund sagt, was passiert ist, und nicht nur dass etwas war.
      expect(r.reason!.length).toBeGreaterThan(60)
      // Und beide Seiten stehen dabei: ohne sie ist die Meldung nicht
      // nachvollziehbar, und am Handy sieht sie aus wie ein Netzfehler.
      expect(r.served).toBe(served)
      expect(r.sent).toBe(sent)
    }
    for (const art of Object.keys(SHOW_REJECTION_REASON) as ShowRejection[]) {
      expect(SHOW_REJECTION_REASON[art].length).toBeGreaterThan(60)
    }
  })

  it('4. alle Schreibwege gehen durch dieselbe Prüfung', () => {
    const server = ohneKommentare('../src/main/services/mobileShareServer.ts')
    // Die eine Pruefung.
    expect(server).toMatch(/const showOk = \(parsed: Record<string, unknown>\): boolean =>/)
    expect(server).toMatch(/showMismatch\(state\.showId, sent\)/)
    // 409 und nicht 400: der Aufruf ist nicht falsch gebaut, die Lage hat
    // sich geaendert.
    expect(server).toMatch(/res\.statusCode = 409/)
    // Und jeder der drei Wege fragt sie — VOR dem Weiterreichen.
    const wege = server.match(/if \(!showOk\(parsed\)\) return/g) ?? []
    expect(wege).toHaveLength(4)
    for (const cb of ['onChecksUpdate', 'onCableAdded', 'onPendingChange', 'onPatternCheck']) {
      const vorher = server.indexOf('if (!showOk(parsed)) return', server.indexOf(cb) - 4000)
      expect(vorher, cb).toBeGreaterThan(-1)
      expect(vorher).toBeLessThan(server.indexOf(`state.${cb}?.`))
    }
  })

  it('5. die Freigabe zieht die Show mit', () => {
    const server = ohneKommentare('../src/main/services/mobileShareServer.ts')
    // Gesetzt wird sie zusammen mit dem Projekt — ein zweiter Ort waere ein
    // zweiter Stand.
    expect(server).toMatch(/state\.showId = showIdOf\(project\)/)
    // Und `stop()` raeumt sie mit weg: eine stehengebliebene Kennung naehme
    // nach dem Neustart Rueckwege fuer eine Show an, die niemand freigegeben
    // hat.
    const stop = /export const stopMobileShareServer[\s\S]*?\n\}/.exec(server)?.[0] ?? ''
    expect(stop).toMatch(/state\.showId = null/)
  })

  it('6. die Kennung entsteht an der Migrations-Stelle', () => {
    const store = ohneKommentare('../src/renderer/store/projectStore.ts')
    // `healProjectPositions` ist laut CLAUDE.md die Schema-Migrationsschicht.
    expect(store).toMatch(/projectId: project\.metadata\.projectId\?\.trim\(\) \|\| newProjectId\(\)/)
    // Vergeben wird nur genau hier.
    // GENAU EIN Aufruf: ein zweiter Ort, an dem eine Kennung entsteht,
    // ergaebe zwei Kennungen fuer eine Show.
    expect(store.match(/newProjectId\(\)/g) ?? []).toHaveLength(1)
    // Und das Typfeld gibt es wirklich.
    expect(ohneKommentare('../src/renderer/types/project.ts')).toMatch(/projectId\?: string/)
  })

  it('7. das Handy speichert je Show, nicht je Name', () => {
    const mobil = ohneKommentare('../src/mobile/MobileApp.tsx')
    expect(mobil).toMatch(/const CHECK_KEY = \(showId: string\)/)
    expect(mobil).toMatch(/const PROJECT_CACHE_KEY = \(showId: string \| null\)/)
    // Der Rueckweg traegt die Kennung — sonst weist der Server ihn ab.
    expect(mobil.match(/projectId: showId[,\s]/g) ?? []).toHaveLength(2)
    expect(mobil.match(/projectId: showIdOf\(project\)/g) ?? []).toHaveLength(2)
  })

  it('8. der Show-Wechsel wird bemerkt und nicht vollzogen', () => {
    const mobil = ohneKommentare('../src/mobile/MobileApp.tsx')
    expect(mobil).toMatch(/setShowSwitched\(true\)/)
    expect(mobil).toMatch(/\{showSwitched && \(/)
    // Der Abruf, der den Wechsel bemerkt, tauscht den Plan NICHT aus: das
    // `return` steht vor `setProject(next)`.
    const poll = /const jetzt = showIdOf\(next\)[\s\S]*?setCachedAt\(new Date\(\)\.toISOString\(\)\)/
      .exec(mobil)?.[0] ?? ''
    expect(poll).not.toBe('')
    expect(poll.indexOf('setShowSwitched(true)')).toBeLessThan(poll.indexOf('setProject(next)'))
    expect(poll).toMatch(/setShowSwitched\(true\)\s*\n\s*setOnline\(true\)\s*\n\s*return/)
  })
})
