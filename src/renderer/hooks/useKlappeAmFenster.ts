// ───────────────────────────────────────────────────────────────────────────
// Eine Klappe, die am FENSTER haengt und nicht an ihrer Leiste.
//
// DAS PROBLEM, dreimal in dieser Anwendung und einmal woanders. Eine Klappe
// ist ueblicherweise ein `position: absolute`-Kind ihres Knopfes. Solange
// kein Vorfahr etwas abschneidet, faellt daran nichts auf. Sobald einer rollt
// oder klemmt, ist die Klappe weg — ganz oder halb, und zwar lautlos:
//
//   * `.cp-menubar` (B-77) rollt auf schmalen Fenstern waagerecht, damit die
//     fuenf Menuetitel und der Einstellungen-Knopf nebeneinander passen.
//   * Die Panel-Kopfzeile schneidet ab, was breiter ist als sie. Gemessen mit
//     `bedienbar:check` bei 1440 px: die Fenster-Klappe ist 200 x 124 px
//     gross und davon 141 x 124 px sichtbar.
//   * Im `light-planner` hielt ein `overflow: hidden` die Kopfzeile
//     einzeilig — und machte aus einer 250 x 505 px grossen Datei-Klappe eine
//     mit NULL Pixel sichtbarer Hoehe. Vier Menues, kein einziges ging auf,
//     monatelang, und kein Waechter sagte es.
//
// Beide Regeln sind je fuer sich richtig. Der Schaden entsteht erst aus ihrem
// Zusammentreffen im Layout, und genau das sieht kein Waechter, der Quelltext
// liest.
//
// DIE LOESUNG. Die Klappe wird `position: fixed` und bekommt ihre
// Koordinaten aus dem Rechteck ihres Knopfes. Ein Element am Viewport kennt
// den Beschnitt seiner Vorfahren nicht. Gemessen wird NACH dem Einhaengen:
// die Breite haengt am laengsten Eintrag und ist auf Deutsch eine andere als
// auf Englisch.
//
// WARUM EIN HAKEN UND NICHT DIE DRITTE ABSCHRIFT. Fuenfundzwanzig Zeilen
// Mechanik an drei Stellen sind drei Stellen, an denen jemand spaeter eine
// davon anfasst. Der Haken ist der eine Ort, an dem die Zahl `8` fuer den
// Rand steht und an dem entschieden ist, was beim Rollen passiert.
//
// ROLLEN FUEHRT NACH, GROESSE SCHLIESST. Der erste Anlauf schloss bei
// beidem, und das war falsch: liegt ein Titel ausserhalb der rollenden
// Leiste, rollt ein Klick sie erst dorthin — und das Rollereignis kommt NACH
// dem Klick. Die Klappe ging auf und sofort wieder zu (gemessen im
// `multicam-planner` bei 390 px). Wer den Titel antippt, den er sieht, merkt
// davon nichts; wer ihn ueber die Tastatur erreicht, oeffnet ins Leere.
// ───────────────────────────────────────────────────────────────────────────
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/** Abstand zum Fensterrand, damit die Klappe nicht am Glas klebt. */
const RAND = 8

export interface KlappeAmFenster {
  /** An den Knopf haengen, der die Klappe oeffnet. */
  knopfRef: React.RefObject<HTMLButtonElement | null>
  /** An die Klappe haengen. Sie braucht `position: fixed` im Stil. */
  klappeRef: React.RefObject<HTMLDivElement | null>
  /**
   * Im `onClick` des Knopfes aufrufen, BEVOR der Zustand umgeschaltet wird.
   * Merkt sich, wo der Knopf gerade steht.
   */
  ankern: () => void
}

/**
 * @param offen  ob die Klappe gerade gezeigt wird — der Haken fuehrt nur
 *               dann nach und misst nur dann.
 * @param schliessen  wird bei Fenster-Groessenaenderung gerufen. Eine Klappe
 *               ueber einem neu umgebrochenen Layout zeigt auf nichts mehr.
 */
export const useKlappeAmFenster = (offen: boolean, schliessen: () => void): KlappeAmFenster => {
  const knopfRef = useRef<HTMLButtonElement | null>(null)
  const klappeRef = useRef<HTMLDivElement | null>(null)
  const [anker, setAnker] = useState<{ links: number; oben: number } | null>(null)

  const ankern = useCallback(() => {
    const r = knopfRef.current?.getBoundingClientRect()
    if (r) setAnker({ links: r.left, oben: r.bottom + 4 })
  }, [])

  useLayoutEffect(() => {
    if (!offen) return
    const el = klappeRef.current
    if (!el || !anker) return
    const r = el.getBoundingClientRect()
    const links = Math.max(RAND, Math.min(anker.links, window.innerWidth - RAND - r.width))
    const oben = Math.max(RAND, Math.min(anker.oben, window.innerHeight - RAND - r.height))
    el.style.left = `${links}px`
    el.style.top = `${oben}px`
  }, [anker, offen])

  useLayoutEffect(() => {
    if (!offen) return
    const nachfuehren = () => ankern()
    window.addEventListener('resize', schliessen)
    window.addEventListener('scroll', nachfuehren, true)
    return () => {
      window.removeEventListener('resize', schliessen)
      window.removeEventListener('scroll', nachfuehren, true)
    }
  }, [offen, ankern, schliessen])

  return { knopfRef, klappeRef, ankern }
}
