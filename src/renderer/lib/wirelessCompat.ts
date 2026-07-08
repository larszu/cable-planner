// ───────────────────────────────────────────────────────────────────────────
// Wireless-Kompatibilität — reine Prüf-/Filter-Logik.
//
// Kompatibel = gleiche, BEKANNTE Fassung/Steckverbinder. „unknown" ist niemals
// kompatibel (Grundsatz „nichts erfinden"): lieber ehrlich „nicht bestätigt" als
// eine Kombination behaupten, die im Feld nicht passt.
// ───────────────────────────────────────────────────────────────────────────
import type { WirelessDevice } from '../types/wireless'

const BODYPACK_MIC_ROLES = new Set<WirelessDevice['role']>(['headset', 'lavalier', 'instrumentCable'])

/** Passt eine Kapsel auf einen Handsender-Body? (gleiches, bekanntes Mount) */
export const isCapsuleCompatible = (body: WirelessDevice, capsule: WirelessDevice): boolean =>
  body.role === 'handheldBody' &&
  capsule.role === 'capsule' &&
  !!body.capsuleMount &&
  body.capsuleMount !== 'unknown' &&
  body.capsuleMount === capsule.capsuleMount

/** Passt ein Headset/Lavalier/Instrumentenkabel an einen Taschensender? */
export const isBodypackMicCompatible = (body: WirelessDevice, mic: WirelessDevice): boolean =>
  body.role === 'bodypackBody' &&
  BODYPACK_MIC_ROLES.has(mic.role) &&
  !!body.bodypackConnector &&
  body.bodypackConnector !== 'unknown' &&
  body.bodypackConnector === mic.bodypackConnector

/** Alle Kapseln aus dem Katalog, die auf den Body passen. */
export const compatibleCapsules = (body: WirelessDevice, catalog: WirelessDevice[]): WirelessDevice[] =>
  catalog.filter((c) => isCapsuleCompatible(body, c))

/** Alle Headsets/Lavaliere/Instrumentenkabel, die an den Taschensender passen. */
export const compatibleBodypackMics = (body: WirelessDevice, catalog: WirelessDevice[]): WirelessDevice[] =>
  catalog.filter((m) => isBodypackMicCompatible(body, m))
