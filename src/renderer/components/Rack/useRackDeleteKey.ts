import { useEffect } from 'react'

/**
 * #1221 — Ein im Rack-Builder ausgewaehltes Geraet laesst sich mit Entf bzw.
 * Backspace entfernen. Vorher ging das nur ueber Doppelklick → Eigenschaften
 * → „Remove from rack“, und das hat niemand gefunden.
 *
 * Die Rueckfrage bleibt dieselbe (`onRemove` ist `removePlacement` des
 * Builders). Nicht ausgeloest wird die Taste
 * - in Eingabefeldern (Rack-Name, Suche, Zahlen),
 * - solange ueber dem Builder ein weiterer modaler Dialog liegt
 *   (Eigenschaften, Bildzuschnitt, interne Verkabelung, Rueckfrage).
 */
export const istLoeschTaste = (event: Pick<KeyboardEvent, 'key' | 'target'>, offeneDialoge: number): boolean => {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return false
  if (offeneDialoge > 1) return false
  const el = event.target as HTMLElement | null
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? ''))) return false
  return true
}

export const useRackDeleteKey = (aktiv: boolean, placementId: string, onRemove: (id: string) => void): void => {
  useEffect(() => {
    if (!aktiv) return
    const handler = (event: KeyboardEvent) => {
      const offen = document.querySelectorAll('[aria-modal="true"]').length
      if (!istLoeschTaste(event, offen)) return
      event.preventDefault()
      onRemove(placementId)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [aktiv, placementId, onRemove])
}
