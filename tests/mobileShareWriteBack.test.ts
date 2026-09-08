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
  it('kennt genau die dokumentierten Schreibwege', () => {
    // Waechst diese Liste, ist der Dialog-Hinweis (und docs/architecture.md
    // 6.6) nachzuziehen — nicht einfach die Erwartung hier zu erweitern.
    //
    // Genau das ist am 2026-09-08 passiert: `/pattern-checks` kam dazu
    // (B-42 Inkrement 2b), der Waechter wurde rot, und nachgezogen wurden
    // ZUERST die beiden Dokumentationsstellen. Die Liste hier ist das
    // Letzte, was man anfasst — sonst waere sie eine Abschrift des Codes
    // statt eine Zusage darueber.
    expect(postRoutes(read(SERVER))).toEqual([
      '/cables',
      '/checks',
      '/pattern-checks',
      '/pending-changes',
    ])
  })

  it('gated jeden Schreibweg mit dem Token aus der QR-Code-URL', () => {
    const lines = read(SERVER).split('\n')
    const routeLines = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /req\.method === 'POST'/.test(line))

    expect(routeLines.length).toBe(4)
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

// ── BEDARF 39 — der Crew-Feed ist ein LESEWEG, und er ist gegated ──────────
//
// Er kommt in diese Datei und nicht in eine eigene, weil hier die Zusage des
// Dialogs gegen den Code gehalten wird: „das Handy kann lesen, nicht
// schreiben". Ein neuer LESEweg aendert diese Zusage nicht — aber er darf die
// zweite nicht brechen, naemlich dass jeder Weg das Token verlangt. Wer wann
// wo arbeitet, ist dieselbe Sorte Auskunft wie der Plan selbst.

describe('mobileShare: der Crew-Kalender (Bedarf 39)', () => {
  const src = read(SERVER)

  it('ist ein GET-Weg und steht in keiner Schreibliste', () => {
    expect(postRoutes(src)).not.toContain('/crew.ics')
    expect(src).toContain("pathname === '/crew.ics'")
  })

  it('verlangt dasselbe Token wie der Plan', () => {
    const block = src.slice(src.indexOf("pathname === '/crew.ics'"))
    expect(block.slice(0, 300)).toContain('authed(req, url)')
  })

  it('antwortet ohne Kalender mit 503 statt mit einem leeren', () => {
    // Ein leerer Kalender liest sich als „diese Person hat frei" — die eine
    // Auskunft, die dieser Bedarf nie geben darf.
    const block = src.slice(src.indexOf("pathname === '/crew.ics'"))
    expect(block.slice(0, 400)).toContain('state.crewIcs ? 200 : 503')
  })

  it('liefert text/calendar aus, nicht text/plain', () => {
    const block = src.slice(src.indexOf("pathname === '/crew.ics'"))
    expect(block.slice(0, 400)).toContain('text/calendar')
  })

  it('rechnet den Kalender NICHT im Main-Prozess nach', () => {
    // Die Rechnung steht in `renderer/lib/crewCalendar.ts`. Eine zweite hier
    // waere eine zweite Vorstellung davon, was eine Schicht ist.
    expect(src).not.toContain('BEGIN:VCALENDAR')
    expect(src).not.toContain('DTSTART')
  })

  it('bietet die Feed-Adresse im Dialog an — sonst findet sie niemand', () => {
    const dlg = read(DIALOG)
    expect(dlg).toContain('/crew.ics')
    // `webcal://` und nicht `http://`: das oeffnet am Handy das ABO statt
    // eines Downloads, und genau darum geht es im Bedarf.
    expect(dlg).toContain('webcal://')
  })

  it('zeigt sie nur, wenn es Schichten gibt', () => {
    const dlg = read(DIALOG)
    expect(dlg).toContain('hatSchichten')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// BEDARF 109 — „read-many, write-one".
//
//   > both sites want to be able to SEE the cuesheet ... however as the
//   > producer / show caller I do not want some one else to be able to ALTER
//   > the cue sheet once we are on site      (`cpvalente/ontime#1547`)
//
// Diese Tests haengen an derselben Frage wie der Rest der Datei: was der
// Dialog verspricht, muss der Server tun. Neu ist, dass die Antwort jetzt
// EINSTELLBAR ist — und damit gibt es zwei Zusagen statt einer, die beide
// stimmen muessen.
// ───────────────────────────────────────────────────────────────────────────
describe('mobileShare: lesen viele, schreiben einer (Bedarf 109)', () => {
  const src = read(SERVER)

  it('prüft die Erlaubnis in JEDEM Schreibweg', () => {
    // Nicht „in mindestens einem": ein ungeschuetzter weiterer Weg waere
    // genau der Fall, den die Zusage des Dialogs dann nicht mehr deckt.
    for (const route of postRoutes(src)) {
      const block = src.slice(src.indexOf(`pathname === '${route}' && req.method === 'POST'`))
      expect(block.slice(0, 300)).toContain('writeAllowed(req, res)')
    }
    expect(postRoutes(src)).toHaveLength(4)
  })

  it('prüft sie VOR dem Lesen des Bodys', () => {
    for (const route of postRoutes(src)) {
      const block = src.slice(src.indexOf(`pathname === '${route}' && req.method === 'POST'`))
      const gate = block.indexOf('writeAllowed(req, res)')
      const body = block.indexOf("req.on('data'")
      expect(gate).toBeGreaterThan(-1)
      expect(body).toBeGreaterThan(gate)
    }
  })

  it('lehnt mit 403 ab und nicht mit 401 — das Token war ja richtig', () => {
    const block = src.slice(src.indexOf('const writeAllowed'))
    expect(block.slice(0, 500)).toContain('res.statusCode = 403')
    expect(block.slice(0, 500)).toContain('read-only')
  })

  it('lässt nur den einen erlaubenden Wert durch', () => {
    // Alles ausser `contribute` ist `read-only`. Ein unbekannter Wert darf nie
    // in den erlaubenden Zustand fallen.
    const setter = src.slice(src.indexOf('export const setMobileShareWriteMode'))
    expect(setter.slice(0, 300)).toContain("mode === 'contribute' ? 'contribute' : 'read-only'")
  })

  it('beginnt jede Sitzung bei „nur lesen"', () => {
    expect(src).toContain("writeMode: 'read-only',")
  })

  it('sagt dem Handy in /share-info.json, was gilt', () => {
    const block = src.slice(src.indexOf("pathname === '/share-info.json'"))
    expect(block.slice(0, 900)).toContain('writeMode: state.writeMode')
  })
})

describe('mobileShare: Dialog und Handy sagen dasselbe wie der Server', () => {
  it('der Dialog holt den Modus vom Server, statt ihn anzunehmen', () => {
    const dlg = read(DIALOG)
    expect(dlg).toContain('getWriteMode()')
    // Und übernimmt die ANTWORT des Setzens, nicht den eigenen Klick.
    expect(dlg).toContain('setWriteModeState(r.writeMode)')
  })

  it('das Handy blendet die Schreib-Bedienung aus, statt sie ins Leere laufen zu lassen', () => {
    const mob = read('src/mobile/MobileApp.tsx')
    expect(mob).toContain("writeMode === 'contribute' &&")
    // Und sagt es auch: die Häkchen bleiben dann lokal.
    expect(mob).toContain('Nur lesen · Häkchen bleiben auf diesem Gerät')
  })

  it('das Handy fällt bei unbekanntem Wert auf „nur lesen" zurück', () => {
    const mob = read('src/mobile/MobileApp.tsx')
    expect(mob).toContain("info.writeMode === 'contribute' ? 'contribute' : 'read-only'")
  })

  it('der Sicherheits-Hinweis behauptet nicht mehr, es werde immer geschrieben', () => {
    const dlg = read(DIALOG)
    expect(dlg).toContain('entscheidet die Einstellung darüber')
  })
})
