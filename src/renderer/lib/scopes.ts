// larszu/lz-scopes#15 — Scopes am Geraet: welcher Strom sich messen laesst und
// woher ein Kabel sein Signal bekommt. REIN: kein Store, kein IO.
//
// Konzept: lz-scopes `docs/cable-planner-integration.md`. Gemessen wird nur,
// was der Desktop per ffmpeg oeffnen kann — dieselbe Liste wie das Standbild
// (`FFMPEG_PROTOKOLLE`), dieselben Riegel im Main-Prozess.

import { FFMPEG_PROTOKOLLE, protokollName, zugangsSchluessel } from './streamEndpoints'
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { StreamEndpoint } from '../types/stream'

export interface ScopeQuelle {
  url: string
  /** Schluesselbund-Account der Zugangsdaten der Stream-Adresse. */
  credentialId: string
}

/**
 * Die Adresse, an der die Scopes messen: nur die Stream-Adresse (nicht die
 * Standbild-Adresse — ein JPEG misst keine Pegel), nur an einem Geraet, das
 * den Strom SENDET, nur in einem Protokoll, das ffmpeg oeffnet.
 */
export const scopeQuelle = (s: StreamEndpoint): ScopeQuelle | null =>
  s.url?.trim() && s.direction !== 'receive' && FFMPEG_PROTOKOLLE.has(s.protocol)
    ? { url: s.url.trim(), credentialId: zugangsSchluessel(s.id, 'url') }
    : null

export const scopeStreams = (e: Pick<EquipmentItem, 'streams'> | undefined): StreamEndpoint[] =>
  (e?.streams ?? []).filter((s) => scopeQuelle(s) !== null)

/** Der Strom fuer die Plakette am Canvas: der erste mit eingeschalteter Plakette. */
export const plaketteStream = (streams: StreamEndpoint[] | undefined): StreamEndpoint | null =>
  streams?.find((s) => s.showScope && scopeQuelle(s) !== null) ?? null

export type Messpunkt =
  | { ok: true; geraet: EquipmentItem; stream: StreamEndpoint }
  /** `no-stream`: das Quellgeraet hat keinen messbaren Strom. `signal` nennt, was auf der Leitung laeuft. */
  | { ok: false; grund: 'no-source' | 'no-stream'; signal?: string }

/**
 * Das Scope am Steckfeld: gemessen wird, was auf DIESER Leitung ankommt, also
 * das Geraet am Anfang des Kabels (`from`). Hat es keinen Strom, den ffmpeg
 * oeffnet, sagt die Antwort, was auf der Leitung laeuft — SDI, HDMI … —, damit
 * die Oberflaeche sagen kann, was fehlt (ein Capture-Geraet oder Encoder).
 */
export function messpunkt(cable: Pick<Cable, 'fromEquipmentId' | 'type' | 'standard'>, equipment: readonly EquipmentItem[]): Messpunkt {
  const geraet = equipment.find((e) => e.id === cable.fromEquipmentId)
  if (!geraet) return { ok: false, grund: 'no-source' }
  const stream = scopeStreams(geraet)[0]
  if (stream) return { ok: true, geraet, stream }
  const signal = cable.standard ?? (cable.type && cable.type !== 'Custom' ? cable.type : undefined)
  return { ok: false, grund: 'no-stream', ...(signal ? { signal: String(signal) } : {}) }
}

/** „Kamera 1 · RTSP Main“ — Quellname in Panel-Kopf und Scope. */
export const scopeQuellName = (geraet: string, s: StreamEndpoint): string =>
  [geraet, [protokollName(s.protocol), s.label].filter(Boolean).join(' ')].filter(Boolean).join(' · ')

/**
 * *Scopes vergleichen*: je Geraet der Auswahl der erste messbare Strom, in der
 * Reihenfolge der Auswahl. Geraete ohne einen fallen heraus.
 */
export const vergleichsStreams = (ids: readonly string[], equipment: readonly EquipmentItem[]): string[] =>
  ids.flatMap((id) => {
    const s = scopeStreams(equipment.find((e) => e.id === id))[0]
    return s ? [s.id] : []
  })
