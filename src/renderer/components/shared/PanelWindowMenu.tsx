import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ExternalLink, PictureInPicture2 } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Icon } from './Icon'

/**
 * Die Fenster-Aktionen eines Panels — beschriftet statt als zwei Symbole.
 *
 * NUTZER-RUECKMELDUNG 2026-09-07: „Nicht alle Elemente sind beschriftet und
 * man erkennt nicht auf den ersten Blick was jedes Element das man anklickt
 * verursacht."
 *
 * Nachgemessen an der gebauten App (`npm run ui:labels`): von 111 sichtbaren
 * Bedienelementen im Hauptfenster hat KEINES gar keinen Namen — aber 32
 * tragen nur ein Symbol, der Name erscheint erst beim Verweilen. Die
 * schlimmsten zwei davon standen in jedem Panel-Rahmen: ein „⤢" (ein
 * Textzeichen, nicht einmal ein Symbol) fuer „abdocken" und ein Pfeil-Kaestchen
 * fuer „in ein eigenes Fenster". Wer sie nicht kannte, konnte sie nur
 * ausprobieren.
 *
 * DIE GLEICHE ANTWORT WIE BEIM SCHLOSS (cable#752): ein beschrifteter Knopf,
 * dahinter die Aktionen im Klartext. Aus zwei stummen Symbolen wird ein
 * Knopf, auf dem „Fenster" steht.
 *
 * DAS ZIEHEN BLEIBT. Der „⤢"-Knopf war nicht nur ein Knopf: an ihm haengt der
 * Tear-off-Griff — man kann das Panel damit aus dem Rahmen ZIEHEN, und ein
 * blosser Klick dockte es an Ort und Stelle ab. Beides waere in einem Menue
 * verloren gegangen. Deshalb traegt der Menue-Knopf selbst den
 * `onPointerDown` des Griffs: ziehen reisst ab wie vorher, klicken oeffnet
 * das Menue, und „Abdocken" darin tut, was der Klick frueher tat.
 * `draggedRef` verhindert, dass nach einem Zieh-Vorgang auch noch das Menue
 * aufgeht.
 */
export const PanelWindowMenu = ({
  onUndock,
  onPopout,
  onPointerDown,
  draggedRef,
  titel,
}: {
  onUndock: () => void
  onPopout: () => void
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  draggedRef: { current: boolean }
  /** Name des Panels im Klartext, fuer Titel und Vorlesehilfe. */
  titel: string
}) => {
  const t = useTranslation()
  const [offen, setOffen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!offen) return
    const aus = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOffen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('mousedown', aus)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', aus)
      document.removeEventListener('keydown', escape)
    }
  }, [offen])

  const eintrag =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-cp-xs text-cp-text hover:bg-cp-surface-2'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-tearoff="handle"
        onPointerDown={onPointerDown}
        onClick={() => {
          if (draggedRef.current) return
          setOffen((v) => !v)
        }}
        title={`${titel} — ${t('panel.window.title', 'abdocken, herausziehen oder in ein eigenes Fenster')}`}
        aria-haspopup="menu"
        aria-expanded={offen}
        className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-cp-border bg-cp-surface-1 px-2 text-cp-xs text-cp-text-secondary transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        style={{ touchAction: 'none' }}
      >
        <Icon icon={PictureInPicture2} size="xs" />
        <span>{t('panel.window.button', 'Fenster')}</span>
        <span className="text-[9px] leading-none">{offen ? '▴' : '▾'}</span>
      </button>
      {offen && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+4px)] z-30 min-w-[200px] rounded-lg border border-cp-border bg-cp-surface-1 p-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className={eintrag}
            onClick={() => {
              setOffen(false)
              onUndock()
            }}
          >
            <Icon icon={PictureInPicture2} size="xs" />
            {t('panel.window.undock', 'Abdocken (schwebend)')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={eintrag}
            onClick={() => {
              setOffen(false)
              onPopout()
            }}
          >
            <Icon icon={ExternalLink} size="xs" />
            {t('panel.window.popout', 'In eigenes Fenster')}
          </button>
          {/* Der dritte Weg steht nur da, weil er sonst unauffindbar waere:
              den Knopf selbst kann man ziehen. Das ist keine Wiederholung des
              ersten Eintrags — es ist die Bedienung, die niemand raet. */}
          <p className="mt-1 border-t border-cp-border-muted px-2 pt-1.5 text-[10px] text-cp-text-muted">
            {t('panel.window.dragHint', 'Der Knopf lässt sich auch ziehen.')}
          </p>
        </div>
      )}
    </div>
  )
}
