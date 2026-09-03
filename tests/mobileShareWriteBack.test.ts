import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ADR-005, Inkrement 4 — Regel 4: eine Zusage muss pruefbar sein.
//
// Der Sicherheits-Hinweis im Handy-Dialog sagte woertlich „Read-only: das
// Handy kann nur lesen, nichts schreiben", der Modulkopf sogar „The server
// has no write endpoints". Beides war falsch: der Server hat drei
// Schreibwege, die das Projekt am Desktop aendern. Der Nutzer liest diesen
// Hinweis genau dann, wenn er entscheidet, ob er sein Projekt ins LAN
// haengt — die falsche Zusage war also die falsche Grundlage fuer eine
// Sicherheits-Entscheidung.
//
// Derselbe Fehler war zweimal entstanden, weil die Zusage einmal geschrieben
// und danach nie wieder gegen den Code gehalten wurde: /cables kam in
// v7.9.54 dazu, /pending-changes noch spaeter, der Satz blieb stehen.
// Deshalb dieser Test. Er faengt nicht den heutigen Fehler (der ist behoben),
// sondern den naechsten: wer einen vierten Schreibweg hinzufuegt, muss hier
// vorbei und wird damit an den Dialog-Hinweis erinnert.

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')

const SERVER = 'src/main/services/mobileShareServer.ts'
const DIALOG = 'src/renderer/components/MobileShare/MobileShareDialog.tsx'

/** Alle Pfade, die der Server per POST annimmt — direkt aus der Quelle. */
const postRoutes = (src: string): string[] =>
  [...src.matchAll(/pathname === '([^']+)' && req\.method === 'POST'/g)]
    .map((m) => m[1])
    .sort()

describe('mobileShare: der Rueckkanal und was der Dialog darueber sagt', () => {
  it('kennt genau die drei dokumentierten Schreibwege', () => {
    // Waechst diese Liste, ist der Dialog-Hinweis (und docs/architecture.md
    // 6.6) nachzuziehen — nicht einfach die Erwartung hier zu erweitern.
    expect(postRoutes(read(SERVER))).toEqual(['/cables', '/checks', '/pending-changes'])
  })

  it('gated jeden Schreibweg mit dem Token aus der QR-Code-URL', () => {
    const lines = read(SERVER).split('\n')
    const routeLines = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /req\.method === 'POST'/.test(line))

    expect(routeLines.length).toBe(3)
    for (const { line, i } of routeLines) {
      // Die Pruefung steht unmittelbar als erste Anweisung im Handler.
      expect(lines[i + 1], `ungegated: ${line.trim()}`).toContain('authed(req, url)')
    }
  })

  it('behauptet im Sicherheits-Hinweis nicht mehr, das Handy koenne nur lesen', () => {
    const dialog = read(DIALOG)
    expect(dialog).not.toContain('kann nur lesen')
    expect(dialog).not.toContain('has no write endpoints')
    expect(dialog).not.toContain('the phone can only read')
  })

  it('benennt den Rueckkanal an der Stelle, an der der Nutzer entscheidet', () => {
    const dialog = read(DIALOG)
    // Der Hinweis muss sagen, DASS geschrieben wird, und WER es kann.
    expect(dialog).toContain('mobile.dialog.security.writeBack')
    expect(dialog).toContain('QR-Code')
    // ... und dass der Weg abgesichert ist, sonst liest sich die Korrektur
    // alarmierender als die Lage ist.
    expect(dialog).toContain('mobile.dialog.security.token')
  })

  it('haelt die englische Fassung mit der deutschen gleichauf', () => {
    const dicts = read('src/renderer/lib/i18n/dicts.ts')
    expect(dicts).toContain("'mobile.dialog.security.writeBack'")
    expect(dicts).toContain("'mobile.dialog.security.token'")
    // Der alte Schluessel darf nicht als Leiche zurueckbleiben — sonst
    // taucht die falsche Zusage bei der naechsten Uebersetzung wieder auf.
    expect(dicts).not.toContain("'mobile.dialog.security.readOnly'")
  })
})
