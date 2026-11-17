// ───────────────────────────────────────────────────────────────────────────
// #1280 — ST 2110-20: Last aus dem Videoformat, ST 2110-21: Sendeprofil.
//
// Vorher lieferte `bandwidthMbpsForStandard('ST2110-20')` fest 3000 Mbps —
// ein 2160p-Aufbau stand damit um Faktor vier zu niedrig, 720p zu hoch.
//
// ─── WOHER DIE ZAHLEN KOMMEN ───────────────────────────────────────────────
//
// ST 2110-20 traegt nur das AKTIVE Bild, als RTP-Nutzlast nach RFC 4175.
// Die Pixelgruppen (pgroup) stehen in RFC 4175, Abschnitt 4.3:
//   YCbCr-4:2:2  8 bit → 4 Oktette / 2 Pixel, 10 bit → 5 / 2, 12 bit → 6 / 2
//   YCbCr-4:4:4  8 bit → 3 Oktette / 1 Pixel, 10 bit → 15 / 4, 12 bit → 9 / 2
// Kopf je Paket:
//   RTP-Festkopf 12 Oktette (RFC 3550, 5.1), RFC-4175-Nutzlastkopf 2 Oktette
//   erweiterte Sequenznummer + 6 Oktette je Zeilenabschnitt (RFC 4175, 4),
//   UDP 8 (RFC 768), IPv4 20 ohne Optionen (RFC 791), Ethernet 14 + FCS 4
//   (IEEE 802.3). Zusammen 66 Oktette.
//
// ANNAHME, keine Normzahl: 1200 Oktette Bilddaten je Paket. Die Paketgroesse
// waehlt der Sender; 1200 ist die verbreitete Wahl. Ein groesseres Paket
// senkt den Kopfanteil (bei 1200: 5,5 %) nur wenig, das Ergebnis bleibt in
// derselben Groessenordnung.
//
// Bildrate: die NENNrate (59,94 rechnet als 60) — die Obergrenze, damit die
// Pruefung `link-too-slow` eher warnt als schweigt. Zeilensprung (1080i50)
// sind 25 volle Bilder je Sekunde: beide Halbbilder zusammen tragen alle
// Zeilen einmal.
// ───────────────────────────────────────────────────────────────────────────
import type { VideoFormatId } from '../types/videoFormat'

export type Abtastung = '4:2:2' | '4:4:4'
export type Bittiefe = 8 | 10 | 12

/** RFC 4175, 4.3: [Oktette, Pixel] je pgroup. */
const PGROUP: Record<Abtastung, Record<Bittiefe, [number, number]>> = {
  '4:2:2': { 8: [4, 2], 10: [5, 2], 12: [6, 2] },
  '4:4:4': { 8: [3, 1], 10: [15, 4], 12: [9, 2] },
}

/** Aktives Raster und volle Bilder je Sekunde (Nennrate). */
const RASTER: Record<VideoFormatId, [number, number, number]> = {
  '576i50': [720, 576, 25],
  '720p50': [1280, 720, 50],
  '720p60': [1280, 720, 60],
  '1080i50': [1920, 1080, 25],
  '1080i60': [1920, 1080, 30],
  '1080p24': [1920, 1080, 24],
  '1080p25': [1920, 1080, 25],
  '1080p30': [1920, 1080, 30],
  '1080p50': [1920, 1080, 50],
  '1080p60': [1920, 1080, 60],
  '2160p24': [3840, 2160, 24],
  '2160p25': [3840, 2160, 25],
  '2160p30': [3840, 2160, 30],
  '2160p50': [3840, 2160, 50],
  '2160p60': [3840, 2160, 60],
  '4096x2160p24': [4096, 2160, 24],
  '4096x2160p60': [4096, 2160, 60],
}

const KOPF_JE_PAKET = 12 + 2 + 6 + 8 + 20 + 14 + 4
/** Annahme, siehe Kopf. */
const NUTZLAST_JE_PAKET = 1200

/** Last eines ST-2110-20-Stroms in Mbps, samt Paketkoepfen bis Ethernet. */
export const st2110_20Mbps = (
  format: VideoFormatId,
  abtastung: Abtastung = '4:2:2',
  bit: Bittiefe = 10,
): number | undefined => {
  const raster = RASTER[format]
  if (!raster) return undefined
  const [breite, hoehe, bilder] = raster
  const [oktette, pixel] = PGROUP[abtastung][bit]
  const nutzlastBit = breite * hoehe * bilder * (oktette / pixel) * 8
  return Math.round((nutzlastBit * (1 + KOPF_JE_PAKET / NUTZLAST_JE_PAKET)) / 1e6)
}

/**
 * ST 2110-21 Sendeprofil: N (Narrow), NL (Narrow Linear), W (Wide). Im SDP als
 * `TP=2110TPN | 2110TPNL | 2110TPW`; NMOS fuehrt am Empfaenger die Sendertypen,
 * die er annimmt (`urn:x-nmos:cap:transport:st2110_21_sender_type`).
 */
export type St2110_21Profil = 'N' | 'NL' | 'W'
export const ST2110_21_PROFILE: readonly St2110_21Profil[] = ['N', 'NL', 'W']

/**
 * Passt ein Sender zum Empfaenger? Belegt ist nur: ein W-Empfaenger nimmt
 * jeden Sender, ein W-Sender passt nicht an einen schmalen (N) Empfaenger —
 * dessen Puffer ist fuer die enge Taktung bemessen. Was nicht belegt ist
 * (NL-Sender an N-Empfaenger), meldet die Pruefung nicht.
 */
export const st2110_21Passt = (sender: St2110_21Profil | undefined, empfaenger: St2110_21Profil | undefined): boolean =>
  !(sender === 'W' && (empfaenger === 'N' || empfaenger === 'NL'))
