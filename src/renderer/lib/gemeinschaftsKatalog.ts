// ───────────────────────────────────────────────────────────────────────────
// ERZEUGT von `scripts/library-fetch.mjs` — nicht von Hand aendern.
// Lauf: `npm run library:fetch` (naechtlich in `library-fetch.yml`).
//
// Geraete, die die GEMEINSCHAFT in der Bibliothek angelegt und bestaetigt hat
// (Status `confirmed` oder besser). Sie liegen hier eingecheckt, damit jede
// Installation sie bekommt — auch ohne Konto und offline. Wer angemeldet ist,
// bekommt ueber den Abgleich im Programm ausserdem den tagesaktuellen Stand.
//
// Was aus DIESEM Repo stammt, steht hier NICHT: es stuende sonst zweimal im
// Katalog. `libraryRef` haelt fest, woher ein Eintrag kommt.
//
// Quelle: https://devices.zumpelars.de
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment.ts'

export const gemeinschaftsTemplates: readonly EquipmentTemplate[] = [
  {
    "name": "ROBE lighting s.r.o. Spiider",
    "category": "Lighting",
    "inputs": [
      {
        "id": "in-mwcfip9o-0",
        "name": "Ethernet",
        "type": "Ethernet/RJ45",
        "connectorType": "Ethernet/RJ45",
        "direction": "in"
      },
      {
        "id": "in-mwcfkrbm-1",
        "name": "DMX 5pol",
        "type": "DMX 5-pol (XLR)",
        "connectorType": "DMX 5-pol (XLR)",
        "direction": "in",
        "standard": "DMX512",
        "gender": "male"
      },
      {
        "id": "in-mwcfm0rn-2",
        "name": "DMX 3pol",
        "type": "DMX 3-pol (XLR)",
        "connectorType": "DMX 3-pol (XLR)",
        "direction": "in",
        "standard": "DMX512",
        "gender": "male"
      },
      {
        "id": "in-mwcfmiez-3",
        "name": "True 1",
        "type": "PowerCon True 1",
        "connectorType": "PowerCon True 1",
        "direction": "in",
        "standard": "Power-230V",
        "gender": "male"
      }
    ],
    "outputs": [
      {
        "id": "out-mwcfp2ab-4",
        "name": "Ethernet",
        "type": "Ethernet/RJ45",
        "connectorType": "Ethernet/RJ45",
        "direction": "out"
      },
      {
        "id": "out-mwcfpc64-5",
        "name": "DMX 5pol",
        "type": "DMX 5-pol (XLR)",
        "connectorType": "DMX 5-pol (XLR)",
        "direction": "out",
        "standard": "DMX512",
        "gender": "female"
      },
      {
        "id": "out-mwcfpo8k-6",
        "name": "DMX 3pol",
        "type": "DMX 3-pol (XLR)",
        "connectorType": "DMX 3-pol (XLR)",
        "direction": "out",
        "standard": "DMX512",
        "gender": "female"
      }
    ],
    "shortName": "Robe",
    "manufacturerUrl": "https://www.robelighting.de/spiider#downloads",
    "powerWatts": 660,
    "deviceTypeId": "7402b769-953d-598a-a25c-b62c330d82dd",
    "gemeinschaft": {
      "slug": "robe-lighting-s-r-o-spiider",
      "version": 1,
      "status": "confirmed",
      "url": "https://devices.zumpelars.de/d/robe-lighting-s-r-o-spiider"
    }
  }
]
