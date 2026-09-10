import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { backdropEntscheidung } from '../src/renderer/hooks/useBackdropClose'
import hookSrc from '../src/renderer/hooks/useBackdropClose.ts?raw'
import shellSrc from '../src/renderer/components/shared/ModalShell.tsx?raw'

// ---------------------------------------------------------------------------
// B-44 — der Hintergrund schliesst, und zwar ueberall nach DERSELBEN Regel.
//
// Rueckmeldung des Eigentuemers, 2026-09-08: „Menues schliessen ist nicht
// immer intuitiv. Oft muss man auf ein x klicken und nicht auch in eine leere
// Flaeche."
//
// WAS DIE MESSUNG ERGAB — NACH ZWEI FALSCHEN ANLAEUFEN. `ModalShell` kann es
// laengst (`closeOnBackdrop` steht auf `true`); 24 Dateien bauen ihr Overlay
// trotzdem selbst.
//
//   Erster Anlauf: „funfzehn Dialoge haben gar nichts." Das Muster suchte den
//   Bezeichner `onClose` und uebersah jeden, der seine Schliessfunktion
//   `close`, `onCancel` oder `setOpen(false)` nennt.
//   Zweiter Anlauf: „sechs." Das Muster fand irgendwo in der Datei ein
//   `onClick={close}` — und das war der SCHLIESS-KNOPF, nicht der Hintergrund.
//
// Beide Zahlen waren falsch, in verschiedene Richtungen, und die zweite fast
// gefaehrlicher: sie sagte, es sei fast alles in Ordnung. Richtig gemessen —
// am oeffnenden Tag des Overlays selbst — waren VIERZEHN Dateien offen.
//
// Deshalb haelt dieser Test keine Zahl fest, sondern die Frage: traegt das
// Element mit `fixed inset-0` selbst eine Behandlung? Eine Zahl waere beim
// naechsten Dialog wieder eine andere; die Frage bleibt.
// ---------------------------------------------------------------------------

const COMPONENTS = resolve(__dirname, '..', 'src', 'renderer', 'components')

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const voll = join(dir, eintrag)
    return statSync(voll).isDirectory()
      ? dateien(voll)
      : /\.tsx$/.test(eintrag)
        ? [voll]
        : []
  })

/**
 * Jedes Overlay EINZELN — und geprueft wird das oeffnende Tag, an dem es
 * haengt, nicht die Datei.
 *
 * DAS IST DIE LEHRE AUS ZWEI FALSCHEN MESSUNGEN. Die erste suchte in der
 * ganzen Datei nach `onClose` und zaehlte funfzehn offene Dialoge; sie uebersah
 * jeden, der seine Schliessfunktion anders nennt. Die zweite suchte nach
 * `onClick={close}` und fand sechs — und zaehlte dabei den SCHLIESS-KNOPF als
 * Behandlung des Hintergrunds. Beide Zahlen waren falsch, in verschiedene
 * Richtungen.
 *
 * Richtig ist nur diese Frage: traegt das Element mit `fixed inset-0` selbst
 * eine Behandlung? Deshalb wird hier das oeffnende Tag ausgeschnitten —
 * klammer-bewusst, weil in den Attributen geschweifte Klammern stehen — und
 * nur darin gesucht. Kommentarzeilen fallen vorher weg: `ModalShell` nennt
 * die Klassen in seinem Kopfkommentar, und das ist kein Overlay.
 */
interface Overlay {
  datei: string
  behandelt: boolean
}

const ohneKommentar = (quelle: string) =>
  quelle
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const overlays = (): Overlay[] => {
  const raus: Overlay[] = []
  for (const f of dateien(COMPONENTS)) {
    const quelle = ohneKommentar(readFileSync(f, 'utf8'))
    const datei = relative(COMPONENTS, f).split(sep).join('/')
    for (const treffer of quelle.matchAll(/fixed inset-0/g)) {
      const start = quelle.lastIndexOf('<', treffer.index)
      let i = start
      let tiefe = 0
      while (i < quelle.length) {
        const c = quelle[i]
        if (c === '{') tiefe += 1
        else if (c === '}') tiefe -= 1
        else if (c === '>' && tiefe === 0) break
        i += 1
      }
      const tag = quelle.slice(start, i)
      raus.push({ datei, behandelt: /\{\.\.\.\w*[Bb]ackdrop\}|on(MouseDown|Click)=/.test(tag) })
    }
  }
  return raus
}

describe('Jeder Dialog schliesst auf dem Hintergrund — nach einer Regel', () => {
  it('jedes Overlay behandelt den Druck auf den Hintergrund', () => {
    const ohne = [...new Set(overlays().filter((o) => !o.behandelt).map((o) => o.datei))]
    expect(
      ohne,
      'Diese Overlays behandeln den Hintergrund-Druck nicht. Entweder ' +
        '`useBackdropClose` benutzen (mit `schutz`, wenn der Dialog einen ' +
        'Entwurf haelt) oder auf `ModalShell` umstellen. Ein Dialog, den man ' +
        'nur ueber das Kreuz loswird, war die Rueckmeldung, die zu B-44 gefuehrt hat.',
    ).toEqual([])
  })

  it('findet ueberhaupt Overlays — sonst waere die Ruhe oben wertlos', () => {
    // Ein umbenanntes Layout-Utility, und der Suchlauf oben findet nichts
    // mehr. Die Zahl ist bewusst weit unter dem Ist-Stand (26 Overlays in 24
    // Dateien am 2026-09-08).
    expect(overlays().length).toBeGreaterThan(18)
  })

  it('die Regel steht an EINER Stelle — ModalShell hat keine eigene mehr', () => {
    // Vor B-44 stand `e.target === e.currentTarget` woertlich in `ModalShell`
    // UND spaeter im Haken. Zwei Fassungen derselben Bedingung sind die
    // Defektform `zwei-rechnungen`: eine haette den Entwurfs-Schutz
    // bekommen und die andere nicht.
    expect(shellSrc).toContain('useBackdropClose')
    expect(shellSrc).not.toMatch(/e\.target === e\.currentTarget/)
  })

  it('gehorcht dem Druck, nicht dem Klick', () => {
    // `onClick` auf dem Hintergrund feuert auch, wenn die Maus INNEN
    // gedrueckt und AUSSEN losgelassen wurde — beim Markieren eines Textes,
    // der ueber den Dialogrand hinauszieht. Der Dialog ginge mitten in der
    // Auswahl zu.
    expect(hookSrc).toMatch(/onMouseDown/)
    // Ohne Kommentare: der Kopf dieser Datei erklaert gerade, warum NICHT
    // `onClick` — das Wort steht dort und ist keine Verwendung.
    expect(ohneKommentar(hookSrc)).not.toMatch(/onClick/)
  })
})

describe('Die Regel selbst', () => {
  it('der Hintergrund schliesst', () => {
    expect(backdropEntscheidung(true, false, false)).toBe('schliessen')
  })

  it('ein Druck IM Panel tut nichts', () => {
    expect(backdropEntscheidung(false, false, false)).toBe('nichts')
    expect(backdropEntscheidung(false, false, true)).toBe('nichts')
  })

  it('mit Entwurf wird gefragt statt geschlossen', () => {
    // Der ganze Punkt. Wer im Rack-Builder zwanzig Hoeheneinheiten bestueckt
    // hat, darf sie nicht durch einen Fehlklick daneben verlieren — verlorene
    // Arbeit ist schlimmer als ein Kreuz, das man suchen muss.
    expect(backdropEntscheidung(true, false, true)).toBe('fragen')
  })

  it('abgeschaltet heisst abgeschaltet — auch ohne Entwurf', () => {
    expect(backdropEntscheidung(true, true, false)).toBe('nichts')
    expect(backdropEntscheidung(true, true, true)).toBe('nichts')
  })
})

describe('Wo ein Entwurf liegt, steht auch ein Schutz', () => {
  /**
   * Die sechs, die vor B-44 gar nichts hatten. Sie sind ausnahmslos Dialoge
   * mit Entwurf — deshalb ist der Schutz dort keine Kuer, und deshalb stehen
   * sie hier namentlich.
   *
   * `Library/CableLibraryPanel.tsx` stand hier bis zum 2026-09-10. Sie ist
   * KEINE Streichung: der Kabeltyp-Editor, um den es ging, liegt seit #836 in
   * `Cable/CableTypeEditor.tsx` — samt seinem `schutz`. Die Seitenleiste
   * haelt seither keinen Entwurf mehr, sie oeffnet nur noch den Editor.
   *
   * Der Unterschied ist wichtig: eine Zeile aus dieser Liste zu nehmen, weil
   * der Test rot wurde, waere genau der Griff, gegen den sie geschrieben ist.
   * Sie darf nur mitwandern, wenn der Entwurf mitgewandert ist — und die
   * Zusicherung darunter prueft, dass er am neuen Ort auch angekommen ist.
   */
  const MIT_ENTWURF = [
    'Cable/CableDialog.tsx',
    'Cable/CableTypeEditor.tsx',
    'Library/LibraryPanel.tsx',
    'Rack/RackBuilderDialog.tsx',
    'Rack/RackImageCropDialog.tsx',
    'Rentman/NewRentmanDeviceWizard.tsx',
  ]

  it('jeder von ihnen fragt, statt den Entwurf wegzuwerfen', () => {
    const ohneSchutz = MIT_ENTWURF.filter((rel) => {
      const quelle = readFileSync(join(COMPONENTS, ...rel.split('/')), 'utf8')
      return !/schutz:\s*\(\)\s*=>/.test(quelle)
    })
    expect(
      ohneSchutz,
      'Diese Dialoge halten einen Entwurf und schliessen auf dem Hintergrund ' +
        'ohne Rueckfrage. Das ist die Verschlimmbesserung, bei der die naechste ' +
        'Rueckmeldung „jetzt geht dauernd alles zu" lautet.',
    ).toEqual([])
  })

  it('die Kabel-Seitenleiste haelt wirklich keinen Entwurf mehr', () => {
    // Die Gegenprobe zur Zeile oben. Ohne sie stuende die Streichung als
    // Behauptung da, und niemand merkte es, wenn dort wieder ein Formular
    // entstuende.
    const quelle = readFileSync(join(COMPONENTS, 'Library', 'CableLibraryPanel.tsx'), 'utf8')
    expect(
      quelle,
      'Die Kabel-Seitenleiste haelt wieder einen Backdrop-Dialog. Dann gehoert ' +
        'sie zurueck in MIT_ENTWURF — mit einem `schutz`.',
    ).not.toMatch(/useBackdropClose/)
  })
})
