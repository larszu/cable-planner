// ───────────────────────────────────────────────────────────────────────────
// Wireless-Kompatibilitäts-Katalog — Handsender-Bodies + Kapseln, Taschensender
// + Headsets/Lavaliere. Fassungs-/Steckverbinder-Standards aus Herstellerdaten
// (Shure ULX-D/AD/QLX-D/SLX-D teilen das Shure-Handheld-Gewinde; Sennheiser
// evolution vs. Digital 6000/9000; Neumann KK auf 6000/9000).
//
// GUIDs sind stabil (App-übergreifend). Neue/unbekannte Kombinationen trägt der
// User selbst ein — hier stehen nur belegte Standards.
// ───────────────────────────────────────────────────────────────────────────
import type { WirelessDevice } from '../types/wireless'

// Stabile GUID-Basis; das 2-stellige Suffix macht jeden Eintrag eindeutig.
const gid = (n: number): string => `7f3a9c10-0000-4000-8000-0000000000${n.toString(16).padStart(2, '0')}`

let i = 0
const dev = (d: Omit<WirelessDevice, 'deviceTypeId'>): WirelessDevice => ({ deviceTypeId: gid(i++), ...d })

export const WIRELESS_CATALOG: WirelessDevice[] = [
  // ── Shure Handsender-Bodies (Shure-Gewinde) ───────────────────────────────
  dev({ name: 'Shure AD2', brand: 'Shure', role: 'handheldBody', capsuleMount: 'shure-thread', series: 'Axient Digital', bodypackConnector: undefined }),
  dev({ name: 'Shure ADX2', brand: 'Shure', role: 'handheldBody', capsuleMount: 'shure-thread', series: 'Axient Digital' }),
  dev({ name: 'Shure ULXD2', brand: 'Shure', role: 'handheldBody', capsuleMount: 'shure-thread', series: 'ULX-D' }),
  dev({ name: 'Shure QLXD2', brand: 'Shure', role: 'handheldBody', capsuleMount: 'shure-thread', series: 'QLX-D' }),
  dev({ name: 'Shure SLXD2', brand: 'Shure', role: 'handheldBody', capsuleMount: 'shure-thread', series: 'SLX-D' }),

  // ── Shure Kapseln (Shure-Gewinde) ─────────────────────────────────────────
  dev({ name: 'Shure SM58 (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'dynamic', polarPattern: 'cardioid', notes: 'Bühnen-Standard, robust' }),
  dev({ name: 'Shure Beta 58A (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'dynamic', polarPattern: 'super', notes: 'Supernieren-Variante, mehr Präsenz' }),
  dev({ name: 'Shure SM86 (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'condenser', polarPattern: 'cardioid' }),
  dev({ name: 'Shure SM87A (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'condenser', polarPattern: 'super' }),
  dev({ name: 'Shure Beta 87A (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'condenser', polarPattern: 'super' }),
  dev({ name: 'Shure Beta 87C (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'condenser', polarPattern: 'cardioid' }),
  dev({ name: 'Shure KSM8 (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'dynamic', polarPattern: 'cardioid', notes: 'Dualdyne, sehr geringer Naheffekt' }),
  dev({ name: 'Shure KSM9 (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'condenser', polarPattern: 'cardioid', notes: 'umschaltbar Niere/Superniere' }),
  dev({ name: 'Shure KSM9HS (Kapsel)', brand: 'Shure', role: 'capsule', capsuleMount: 'shure-thread', transducer: 'condenser', polarPattern: 'hyper', notes: 'umschaltbar Hyper/Superniere' }),

  // ── Sennheiser evolution Handsender + Kapseln ─────────────────────────────
  dev({ name: 'Sennheiser SKM 100 G4', brand: 'Sennheiser', role: 'handheldBody', capsuleMount: 'sennheiser-ew', series: 'ew 100 G4' }),
  dev({ name: 'Sennheiser SKM 300 G4', brand: 'Sennheiser', role: 'handheldBody', capsuleMount: 'sennheiser-ew', series: 'ew 300 G4' }),
  dev({ name: 'Sennheiser SKM 500 G4', brand: 'Sennheiser', role: 'handheldBody', capsuleMount: 'sennheiser-ew', series: 'ew 500 G4' }),
  dev({ name: 'Sennheiser MMD 835 (Kapsel)', brand: 'Sennheiser', role: 'capsule', capsuleMount: 'sennheiser-ew', transducer: 'dynamic', polarPattern: 'cardioid' }),
  dev({ name: 'Sennheiser MMD 845 (Kapsel)', brand: 'Sennheiser', role: 'capsule', capsuleMount: 'sennheiser-ew', transducer: 'dynamic', polarPattern: 'super' }),
  dev({ name: 'Sennheiser MME 865 (Kapsel)', brand: 'Sennheiser', role: 'capsule', capsuleMount: 'sennheiser-ew', transducer: 'condenser', polarPattern: 'super' }),
  dev({ name: 'Sennheiser MMD 935 (Kapsel)', brand: 'Sennheiser', role: 'capsule', capsuleMount: 'sennheiser-ew', transducer: 'dynamic', polarPattern: 'cardioid' }),
  dev({ name: 'Sennheiser MMD 945 (Kapsel)', brand: 'Sennheiser', role: 'capsule', capsuleMount: 'sennheiser-ew', transducer: 'dynamic', polarPattern: 'super' }),

  // ── Sennheiser Digital 6000/9000 + Kapseln (inkl. Neumann KK) ─────────────
  dev({ name: 'Sennheiser SKM 6000', brand: 'Sennheiser', role: 'handheldBody', capsuleMount: 'sennheiser-9000', series: 'Digital 6000' }),
  dev({ name: 'Sennheiser SKM 9000', brand: 'Sennheiser', role: 'handheldBody', capsuleMount: 'sennheiser-9000', series: 'Digital 9000' }),
  dev({ name: 'Sennheiser MMD 9235 (Kapsel)', brand: 'Sennheiser', role: 'capsule', capsuleMount: 'sennheiser-9000', transducer: 'dynamic', polarPattern: 'cardioid' }),
  dev({ name: 'Sennheiser MME 9265 (Kapsel)', brand: 'Sennheiser', role: 'capsule', capsuleMount: 'sennheiser-9000', transducer: 'condenser', polarPattern: 'super' }),
  dev({ name: 'Neumann KK 204 (Kapsel)', brand: 'Neumann', role: 'capsule', capsuleMount: 'sennheiser-9000', transducer: 'condenser', polarPattern: 'cardioid', notes: 'passt auf Sennheiser 2000/6000/9000' }),
  dev({ name: 'Neumann KK 205 (Kapsel)', brand: 'Neumann', role: 'capsule', capsuleMount: 'sennheiser-9000', transducer: 'condenser', polarPattern: 'super', notes: 'passt auf Sennheiser 2000/6000/9000' }),

  // ── Shure Taschensender (TA4F / LEMO) ─────────────────────────────────────
  dev({ name: 'Shure ULXD1', brand: 'Shure', role: 'bodypackBody', bodypackConnector: 'shure-ta4f', series: 'ULX-D' }),
  dev({ name: 'Shure QLXD1', brand: 'Shure', role: 'bodypackBody', bodypackConnector: 'shure-ta4f', series: 'QLX-D' }),
  dev({ name: 'Shure SLXD1', brand: 'Shure', role: 'bodypackBody', bodypackConnector: 'shure-ta4f', series: 'SLX-D' }),
  dev({ name: 'Shure AD1', brand: 'Shure', role: 'bodypackBody', bodypackConnector: 'shure-lemo', series: 'Axient Digital' }),
  dev({ name: 'Shure ADX1', brand: 'Shure', role: 'bodypackBody', bodypackConnector: 'shure-lemo', series: 'Axient Digital' }),

  // ── Sennheiser Taschensender (3,5 mm verriegelbar / LEMO) ─────────────────
  dev({ name: 'Sennheiser SK 100 G4', brand: 'Sennheiser', role: 'bodypackBody', bodypackConnector: 'sennheiser-3.5-lock', series: 'ew 100 G4' }),
  dev({ name: 'Sennheiser SK 500 G4', brand: 'Sennheiser', role: 'bodypackBody', bodypackConnector: 'sennheiser-3.5-lock', series: 'ew 500 G4' }),
  dev({ name: 'Sennheiser SK 6000', brand: 'Sennheiser', role: 'bodypackBody', bodypackConnector: 'sennheiser-lemo', series: 'Digital 6000' }),

  // ── Headsets / Lavaliere (Terminierung im Namen — sind mehrfach bestellbar) ─
  dev({ name: 'Shure SM35 · TA4F (Headset)', brand: 'Shure', role: 'headset', bodypackConnector: 'shure-ta4f', transducer: 'condenser', polarPattern: 'cardioid' }),
  dev({ name: 'Shure WH20 · TA4F (Headset)', brand: 'Shure', role: 'headset', bodypackConnector: 'shure-ta4f', transducer: 'dynamic', polarPattern: 'cardioid' }),
  dev({ name: 'DPA 4066 · TA4F (Headset)', brand: 'DPA', role: 'headset', bodypackConnector: 'shure-ta4f', transducer: 'condenser', polarPattern: 'omni', notes: 'auch in anderen Terminierungen erhältlich' }),
  dev({ name: 'Countryman E6 · TA4F (Headset)', brand: 'Countryman', role: 'headset', bodypackConnector: 'shure-ta4f', transducer: 'condenser', notes: 'auch in anderen Terminierungen erhältlich' }),
  dev({ name: 'Shure MX150 · TA4F (Lavalier)', brand: 'Shure', role: 'lavalier', bodypackConnector: 'shure-ta4f', transducer: 'condenser', polarPattern: 'omni' }),
  dev({ name: 'Sennheiser HSP 2 · 3,5 mm (Headset)', brand: 'Sennheiser', role: 'headset', bodypackConnector: 'sennheiser-3.5-lock', transducer: 'condenser', polarPattern: 'omni' }),
  dev({ name: 'Sennheiser ME 2 · 3,5 mm (Lavalier)', brand: 'Sennheiser', role: 'lavalier', bodypackConnector: 'sennheiser-3.5-lock', transducer: 'condenser', polarPattern: 'omni' }),
  dev({ name: 'Sennheiser ME 3 · 3,5 mm (Headset)', brand: 'Sennheiser', role: 'headset', bodypackConnector: 'sennheiser-3.5-lock', transducer: 'condenser', polarPattern: 'cardioid' }),
]

/** Lookup nach GUID. */
export const wirelessById = (id: string): WirelessDevice | undefined =>
  WIRELESS_CATALOG.find((d) => d.deviceTypeId === id)

/** Alle Bodies (Hand-/Taschensender) für Auswahl-Listen. */
export const wirelessBodies = (): WirelessDevice[] =>
  WIRELESS_CATALOG.filter((d) => d.role === 'handheldBody' || d.role === 'bodypackBody')
