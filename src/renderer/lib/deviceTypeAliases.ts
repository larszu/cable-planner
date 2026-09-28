/**
 * Geraetetyp-Ids von Katalog-Eintraegen, die in einem anderen aufgegangen
 * sind: alte Id -> heutige. Die alte Id steht in gespeicherten Projekten und
 * Lagerbestaenden und muss weiter aufloesen — eine Id wird nie neu vergeben.
 *
 * 2026-09-27: „UniFi Switch 16 (USW-16)" gab es als Modell nicht; ui.com
 * fuehrt nur den USW-16-PoE mit denselben Anschluessen (16 RJ45, 2 SFP).
 */
export const DEVICE_TYPE_ALIASES: Readonly<Record<string, string>> = {
  'a6c64b89-60ff-40f6-9049-3d6faa4beeca': '6d8f73bf-2a99-4de4-933f-9621abd4c16c',
}
