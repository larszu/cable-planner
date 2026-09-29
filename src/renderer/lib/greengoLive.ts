/**
 * Was ein Green-GO-Geraet ueber das Skript osc-remote.gg5t meldet, als Bild
 * je Kanal. Rein: die Zustandsnachrichten `/ggo/state/...` kommen herein,
 * ein neuer Zustand geht hinaus. Nur Kanaele 1–6 — mehr kann das Skript nicht.
 */
export const GREENGO_CHANNELS = [1, 2, 3, 4, 5, 6] as const

export interface GreengoChannel {
  /** 0 = aus; das Companion-Modul setzt 2 fuer „latch". */
  talk?: number
  /** 0 = stumm, 1 = hoeren. */
  listen?: number
  /** dB, −40..12. */
  level?: number
}

export interface GreengoState {
  channels: Record<number, GreengoChannel>
  mainLevel?: number
  lastHeard: number
}

export const emptyGreengoState = (): GreengoState => ({ channels: {}, lastHeard: 0 })

export function applyGreengoState(s: GreengoState, address: string, args: number[], at: number): GreengoState {
  const next: GreengoState = { ...s, lastHeard: at }
  const ch = /^\/ggo\/state\/channel\/(talk|listen|level)$/.exec(address)
  if (ch) {
    const [value, channel] = args
    if (!GREENGO_CHANNELS.includes(channel as (typeof GREENGO_CHANNELS)[number])) return next
    next.channels = { ...s.channels, [channel]: { ...s.channels[channel], [ch[1]]: value } }
    return next
  }
  if (address === '/ggo/state/level/main' && args.length) next.mainLevel = args[0]
  return next
}
