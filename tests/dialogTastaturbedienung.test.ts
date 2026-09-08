import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// ---------------------------------------------------------------------------
// Jeder modale Dialog ist mit der Tastatur bedienbar (UI-Pruefung, Phase 3).
//
// Der Befund stand in `docs/ui-audit.md` und war doppelt richtig:
//
//   > `ModalShell`: kein `aria-modal`, kein `aria-labelledby`, keine
//   > Focus-Trap, kein Escape-to-close, keine Fokus-Rueckgabe.
//
// Die Shell hat das laengst; was blieb, war eine Liste von siebzehn
// Standalone-Dialogen, die ihr eigenes `fixed inset-0`-Geruest rollen.
//
// ─── WARUM DIESER WAECHTER LAEUFT UND NICHT DIE LISTE ──────────────────────
//
// Die Liste im Audit war an zwei Enden falsch, und beide Fehler kommen
// daher, dass sie VON HAND gefuehrt wurde:
//
//   * SIEBEN der siebzehn brauchten gar nichts mehr — sie gehen laengst
//     ueber `ModalShell`, und die hat den Haken seit derselben Phase.
//   * NEUN Dialoge fehlten in ihr ganz. Sie sind nach dem Audit entstanden
//     (Ausspielung, Drum-Mikrofonierung, Funkstrecken, Rack-Verkabelung,
//     Abgleich, Befehlspalette …) und niemand hat sie nachgetragen.
//
// Dieselbe Lehre wie beim Lager-Vertrag: DIE DOMAENE IST DER ORDNER, NICHT
// EINE LISTE IM WAECHTER. Dieser Test laeuft deshalb ueber
// `src/renderer/components` und findet jede Datei, die ein eigenes
// `fixed inset-0` aufspannt. Wer morgen einen Dialog anlegt, wird hier rot,
// ohne dass jemand eine Liste pflegt.
// ---------------------------------------------------------------------------

const WURZEL = join(process.cwd(), 'src', 'renderer', 'components')

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const pfad = join(dir, eintrag)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return pfad.endsWith('.tsx') ? [pfad] : []
  })

/** Ein eigenes `fixed inset-0` ist die Signatur eines selbstgebauten Modals. */
const MODAL = /className="fixed inset-0/

const modale = (): string[] =>
  dateien(WURZEL)
    .filter((f) => MODAL.test(readFileSync(f, 'utf8')))
    .map((f) => relative(WURZEL, f))
    .sort()

const inhalt = (rel: string): string => readFileSync(join(WURZEL, rel), 'utf8')

describe('jeder selbstgebaute Dialog ist mit der Tastatur bedienbar', () => {
  it('findet ueberhaupt Dialoge — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waere der Test auch dann gruen, wenn das Muster
    // nicht mehr passt und die Liste leer zurueckkommt.
    expect(modale().length).toBeGreaterThan(10)
  })

  it('zieht Escape, Fokus-Falle und Fokus-Rueckgabe aus DEM EINEN Haken', () => {
    // `ModalShell` benutzt denselben Haken — eine Datei, die ueber sie geht,
    // ist damit gedeckt.
    const ohne = modale().filter((rel) => {
      const src = inhalt(rel)
      return !src.includes('useDialogA11y') && !src.includes('ModalShell')
    })
    expect(ohne, `ohne Tastatur-Bedienung: ${ohne.join(', ')}`).toEqual([])
  })

  it('haengt den Haken an einen Kasten, nicht nur an den Import', () => {
    // GESCHAERFT NACH ZWEI GEGENPROBEN.
    //
    // Die erste Fassung suchte nur den NAMEN `useDialogA11y` und blieb gruen,
    // als die Verwendung entfernt wurde und die Import-Zeile stehenblieb.
    //
    // Die zweite suchte die Namen `panelRef` und `dialogProps` — und wurde
    // rot, als eine Datei sie beim Auseinandernehmen umbenannte
    // (`panelRef: netBoxRef`), obwohl alles richtig verdrahtet war. Ein
    // Waechter, der an einer Umbenennung rot wird, wird geaendert statt
    // gelesen.
    //
    // Geprueft werden deshalb DIE NAMEN, DIE DIE DATEI SELBST BINDET: aus
    // jedem `useDialogA11y`-Aufruf werden sie ausgelesen, und dann muss der
    // Ref-Name in einem `ref={…}` und der Props-Name in einer Ausbreitung
    // stehen.
    const halb = modale().filter((rel) => {
      const src = inhalt(rel)
      const aufrufe = [...src.matchAll(/const\s*\{([^}]*)\}\s*=\s*useDialogA11y/g)]
      if (aufrufe.length === 0) return false
      return aufrufe.some((m) => {
        const gebunden = (feld: string): string | null => {
          const treffer = new RegExp(`${feld}\\s*(?::\\s*(\\w+))?`).exec(m[1])
          if (!treffer) return null
          return treffer[1] ?? feld
        }
        const refName = gebunden('panelRef')
        const propsName = gebunden('dialogProps')
        if (!refName || !propsName) return true
        return (
          !new RegExp(`ref=\\{${refName}\\}`).test(src) ||
          !new RegExp(`\\{\\.\\.\\.${propsName}\\}`).test(src)
        )
      })
    })
    expect(halb, `Haken importiert, aber nicht verdrahtet: ${halb.join(', ')}`).toEqual([])
  })

  it('beschriftet jeden Dialog — entweder ueber eine Ueberschrift oder direkt', () => {
    // Ein `role="dialog"` ohne Namen liest der Screenreader als „Dialog".
    // Und ein `aria-labelledby`, das auf nichts zeigt, ist schlechter als
    // keins: dann liest er gar nichts.
    // GESCHAERFT NACH DER GEGENPROBE: die erste Fassung suchte `aria-label`
    // IRGENDWO in der Datei — und blieb gruen, als die Beschriftung vom
    // Dialog verschwand, weil der Schliessen-Knopf daneben eine hat. Geprueft
    // wird deshalb die Umgebung JEDER `{...dialogProps}`-Stelle, also der
    // Kasten, der `role="dialog"` bekommt.
    const namenlos = modale().filter((rel) => {
      const src = inhalt(rel)
      const stellen = [...src.matchAll(/\{\.\.\.[\w.]*[Dd]ialogProps\}/g)]
      if (stellen.length === 0) return false
      return stellen.some((m) => {
        const von = Math.max(0, (m.index ?? 0) - 220)
        const umgebung = src.slice(von, (m.index ?? 0) + 220)
        const zeigtAufTitel = /aria-labelledby=\{[^}]*titleId\}/i.test(umgebung)
        if (zeigtAufTitel) return !/id=\{[^}]*titleId\}/i.test(src)
        return !/aria-label=\{/.test(umgebung)
      })
    })
    expect(namenlos, `Dialog ohne lesbaren Namen: ${namenlos.join(', ')}`).toEqual([])
  })
})

describe('der Haken selbst', () => {
  const haken = readFileSync(
    join(process.cwd(), 'src', 'renderer', 'hooks', 'useDialogA11y.ts'),
    'utf8',
  )

  it('gibt den Fokus an den Ausloeser zurueck', () => {
    // Ohne Rueckgabe steht der Fokus nach dem Schliessen am Seitenanfang, und
    // wer per Tastatur arbeitet, faengt jedes Mal von vorn an.
    expect(haken).toContain('lastFocusedRef')
  })

  it('laesst sich das Schliessen abschalten', () => {
    // Zwei Dialoge brauchen das: der Rack-Builder fragt bei ungesicherten
    // Aenderungen nach, die Befehlspalette hat ihre eigene Tastensteuerung.
    // Ein Escape daneben wuerde an beidem vorbei schliessen.
    expect(haken).toContain('closeOnEscape')
  })

  it('nimmt eine fremde Ref, statt eine zweite danebenzustellen', () => {
    // Die zieh- und die falle-tragende Ref muessen denselben Knoten meinen.
    expect(haken).toContain('ref?: RefObject')
  })
})
