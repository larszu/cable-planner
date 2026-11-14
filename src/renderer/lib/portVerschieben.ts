import type { Port } from '../types/equipment'
import type { PortListen } from './portArt'

export type { PortListen }

/**
 * #1220 — Ports per Ziehen ordnen, auch ZWISCHEN Eingaengen und Ausgaengen.
 *
 * Bisher hatte jede Port-Liste ihren eigenen Zieh-Kontext; ein Port kam aus
 * seiner Liste nicht heraus. Wer einen Anschluss falsch einsortiert hatte
 * (Datenblatt-Import, „Ref Loop" bei den Eingaengen), musste ihn loeschen
 * und auf der anderen Seite neu anlegen — samt Stecker, Signal und Gruppe.
 *
 * Der Port behaelt seine Id: Kabel zeigen auf (Geraet, Port-Id), und alle
 * Nachschlagestellen suchen in beiden Listen. Eine AUSDRUECKLICHE Richtung
 * 'in'/'out', die der neuen Liste widerspricht, faellt weg (die Liste gibt
 * dann die Richtung vor, vgl. lib/portArt #1228); 'bidirectional' (#1212)
 * bleibt.
 */
export type PortSeite = 'in' | 'out'

/** Droppable-Id einer ganzen Liste — auch eine leere nimmt so einen Port an. */
export const listenZiel = (seite: PortSeite): string => `liste:${seite}`

const seiteVon = (listen: PortListen, id: string): PortSeite | undefined => {
  if (id === listenZiel('in')) return 'in'
  if (id === listenZiel('out')) return 'out'
  if (listen.inputs.some((p) => p.id === id)) return 'in'
  if (listen.outputs.some((p) => p.id === id)) return 'out'
  return undefined
}

/**
 * Neue Listen nach dem Ablegen von `aktivId` auf `zielId` (Port oder Liste),
 * oder `null`, wenn sich nichts aendert.
 */
export const verschiebePort = (
  listen: PortListen,
  aktivId: string,
  zielId: string,
): PortListen | null => {
  if (aktivId === zielId) return null
  const von = seiteVon(listen, aktivId)
  const nach = seiteVon(listen, zielId)
  if (!von || !nach) return null
  const schluessel = (s: PortSeite) => (s === 'in' ? 'inputs' : 'outputs')
  const quelle = [...listen[schluessel(von)]]
  const alt = quelle.findIndex((p) => p.id === aktivId)
  if (alt < 0) return null

  if (von === nach) {
    const neu = quelle.findIndex((p) => p.id === zielId)
    // Auf die eigene Liste statt auf einen Port: ans Ende.
    const ziel = neu < 0 ? quelle.length - 1 : neu
    if (ziel === alt) return null
    const [port] = quelle.splice(alt, 1)
    quelle.splice(ziel, 0, port)
    return { ...listen, [schluessel(von)]: quelle }
  }

  const [port] = quelle.splice(alt, 1)
  const richtung = port.direction
  const umgezogen: Port = { ...port }
  if (richtung && richtung !== 'bidirectional' && richtung !== nach) delete umgezogen.direction
  const zielListe = [...listen[schluessel(nach)]]
  const i = zielListe.findIndex((p) => p.id === zielId)
  zielListe.splice(i < 0 ? zielListe.length : i, 0, umgezogen)
  return { ...listen, [schluessel(von)]: quelle, [schluessel(nach)]: zielListe }
}
