/**
 * Der Hintergrund-Klick schliesst — mit der einen Ausnahme, die ihn brauchbar
 * macht (B-44).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DER BEFUND, DER DAZU GEFUEHRT HAT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Rueckmeldung des Eigentuemers, 2026-09-08: „Menues schliessen ist nicht
 * immer intuitiv. Oft muss man auf ein x klicken und nicht auch in eine leere
 * Flaeche."
 *
 * Nachgemessen: `components/shared/ModalShell.tsx` kann es laengst
 * (`closeOnBackdrop` steht auf `true`), aber 24 Dateien bauen ihr Overlay
 * selbst, und SECHS davon hatten gar keine Behandlung des Hintergrund-Drucks:
 * `LibraryPanel` (zwei Unter-Dialoge), `CableLibraryPanel`, `CableDialog`,
 * `RackBuilderDialog`, `RackImageCropDialog`, `NewRentmanDeviceWizard`. Es
 * fehlte also kein Bauteil — es wurde eines nicht benutzt.
 *
 * Die erste Messung sagte FUENFZEHN, und sie war falsch: das Suchmuster
 * verlangte den Bezeichner `onClose`, und die Haelfte der Dialoge nennt ihre
 * Schliessfunktion `close`, `onCancel` oder `setOpen(false)`. Das steht hier,
 * weil die falsche Zahl beinahe zu einem Rasenmaeher-Umbau gefuehrt haette —
 * und weil die sechs, die wirklich fehlten, ausnahmslos Dialoge mit Entwurf
 * sind. Genau deshalb ist der Schutz unten keine Kuer.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DIE REGEL NICHT „ONCLICK={ONCLOSE}" HEISST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ein Dialog, der eine begonnene Eingabe haelt, darf bei einem Fehlklick
 * daneben NICHT zumachen. Wer im Rack-Builder zwanzig Hoeheneinheiten
 * bestueckt hat oder im Rentman-Assistenten auf Seite drei steht, verliert
 * sonst Arbeit — und verlorene Arbeit ist schlimmer als ein Kreuz, das man
 * suchen muss. Das waere die Verschlimmbesserung, bei der die Rueckmeldung
 * beim naechsten Mal „jetzt geht dauernd alles zu" lautet.
 *
 * Deshalb: **der Hintergrund schliesst, ausser der Dialog haelt ungesicherte
 * Eingaben; dann fragt er.** Ob er welche haelt, ERKLAERT der Dialog
 * (`schutz`) — geraten wird es nicht. Es gibt keinen Weg, das von aussen
 * zuverlaessig zu sehen, und ein geratener waere die Sorte Vermutung, gegen
 * die dieses Repo an mehreren Stellen steht.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM MOUSEDOWN UND NICHT CLICK
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `onClick` auf dem Hintergrund feuert auch, wenn die Maus INNEN gedrueckt
 * und AUSSEN losgelassen wurde — also beim Markieren eines Textes, der ueber
 * den Dialogrand hinauszieht. Der Dialog ginge mitten in einer Auswahl zu.
 * `onMouseDown` mit `e.target === e.currentTarget` trifft nur den Fall, um
 * den es geht: der Zeiger geht auf der leeren Flaeche nach unten.
 *
 * Dieselbe Bedingung benutzt `ModalShell` seit jeher — und benutzt sie seit
 * B-44 aus DIESER Datei, damit es nicht zwei Fassungen derselben Regel gibt.
 */
import { useCallback, type MouseEvent } from 'react'
import { confirmDialog } from '../lib/confirmDialog'
import { useTranslation } from '../lib/i18n'

export interface BackdropCloseOptions {
  /**
   * Hat der Dialog gerade ungesicherte Eingaben?
   *
   * Als FUNKTION und nicht als Wert, damit sie im Moment des Klicks gefragt
   * wird und nicht beim Rendern von vorhin. Fehlt sie, schliesst der
   * Hintergrund ohne Rueckfrage — das ist fuer einen reinen Anzeige-Dialog
   * richtig und fuer einen Editor falsch, und deshalb steht es beim Dialog.
   */
  schutz?: () => boolean
  /**
   * Der Satz in der Rueckfrage. Ohne Angabe der allgemeine.
   *
   * Ein eigener lohnt sich, wo er benennen kann, WAS verloren geht („Das
   * Rack ist noch nicht gespeichert") — das ist die Angabe, an der jemand
   * „Abbrechen" statt „OK" drueckt.
   */
  frage?: string
  /** Ganz abschalten (z. B. ein Dialog, der eine Entscheidung erzwingt). */
  aus?: boolean
}

/**
 * Was bei einem Zeiger-Druck auf dem Overlay zu tun ist.
 *
 * ALS REINE FUNKTION, getrennt vom Haken — und das ist kein Selbstzweck: die
 * drei Faelle sind die eigentliche Regel, und sie gehoeren pruefbar. Ein
 * Haken laesst sich ohne Render-Umgebung nicht aufrufen, und eine Regel, die
 * nur im laufenden Dialog existiert, wird beim naechsten Umbau still anders.
 */
export type BackdropEntscheidung = 'schliessen' | 'fragen' | 'nichts'

export const backdropEntscheidung = (
  /** Ging der Druck auf den Hintergrund selbst — und nicht auf das Panel? */
  istHintergrund: boolean,
  /** Ist der Weg fuer diesen Dialog abgeschaltet? */
  aus: boolean,
  /** Haelt der Dialog ungesicherte Eingaben? */
  hatEntwurf: boolean,
): BackdropEntscheidung => {
  if (aus) return 'nichts'
  if (!istHintergrund) return 'nichts'
  return hatEntwurf ? 'fragen' : 'schliessen'
}

/**
 * Die Props fuer das Overlay-`div`.
 *
 * Rueckgabe statt eines fertigen Bauteils, weil die Dialoge ihre Overlays
 * aus Layout-Gruenden selbst bauen — sie alle auf `ModalShell`
 * umzustellen waere ein Umbau mit sichtbarem Risiko, und die Regel gilt
 * unabhaengig davon, wer das `div` schreibt.
 */
export const useBackdropClose = (
  onClose: () => void,
  { schutz, frage, aus = false }: BackdropCloseOptions = {},
) => {
  const t = useTranslation()
  const onMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // NUR der Hintergrund selbst. Ein Druck, der im Panel begann, gehoert
      // dem Panel — auch wenn er auf dem Hintergrund endet.
      const was = backdropEntscheidung(e.target === e.currentTarget, aus, !!schutz?.())
      if (was === 'nichts') return
      if (was === 'schliessen') {
        onClose()
        return
      }
      void (async () => {
        const ok = await confirmDialog(
          frage ?? t('common.closeUnsaved', 'Dialog schließen und Eingaben verwerfen?'),
          {
            body: t(
              'common.closeUnsavedBody',
              'Was hier noch nicht übernommen wurde, geht dabei verloren.',
            ),
            okLabel: t('common.closeDiscard', 'Verwerfen'),
            cancelLabel: t('common.closeKeep', 'Weiter bearbeiten'),
            destructive: true,
          },
        )
        if (ok) onClose()
      })()
    },
    [aus, frage, onClose, schutz, t],
  )
  return { onMouseDown }
}
