// @avplan/floorplan — Erkannten Plan in Venue-Waende und Buehnen umsetzen.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// Gemeinsam fuer alle Planer: was als Wand mit welcher Oeffnung ankommt,
// soll in MultiCam, Licht und Kabel gleich aussehen. Der Planer setzt nur
// noch Ids und seine eigenen Felder dazu.

import type { ErkannterPlan, ErkannteBuehne } from './planErkennung'
import type { Rahmen } from './vektor'
import type { VenueWallOpening } from './venueExchange'

export interface UebernahmeWand {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Eigene Hoehe nur, wenn der Plan sie nennt; sonst folgt die Wand der
   *  Standardhoehe des Projekts (multicam #198). */
  hoehe?: number
  dicke: number
  label: string
  oeffnungen: VenueWallOpening[]
  /** `stuetze`: eine Stuetze als kurze, dicke Wand (sie verdeckt Kameras). */
  art: 'wall' | 'column'
}

export interface UebernahmeBuehne {
  x: number
  y: number
  breite: number
  tiefe: number
  label: string
  hoehe?: number
}

export interface UebernahmeOptionen {
  waende: boolean
  stuetzen: boolean
  buehnen: boolean
  /** Nur Teile in diesem Rahmen (Meter, Plankoordinaten). */
  bereich?: Rahmen
  /** Verschiebung, die auf alle Koordinaten addiert wird. */
  dx?: number
  dy?: number
  /** Podesthoehe, wenn der Plan keine nennt. */
  buehnenHoeheM?: number
}

const drin = (b: Rahmen | undefined, x: number, y: number) => !b || (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY)

export function planUebernahme(p: ErkannterPlan, o: UebernahmeOptionen): { waende: UebernahmeWand[]; buehnen: UebernahmeBuehne[] } {
  const dx = o.dx ?? 0
  const dy = o.dy ?? 0
  const waende: UebernahmeWand[] = []
  if (o.waende) {
    const traeger = new Map(p.oeffnungen.filter((q) => q.wandId).map((q) => [q.wandId!, q]))
    for (const w of p.waende) {
      if (!drin(o.bereich, (w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2)) continue
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
      const q = traeger.get(w.id)
      const oeffnungen: VenueWallOpening[] = q
        ? [{ offset: 0, width: len, bottom: q.unterkanteM ?? 0, top: q.oberkanteM ?? 2.1, kind: q.art === 'door' ? 'door' : q.art === 'window' ? 'window' : 'opening' }]
        : []
      waende.push({
        x1: w.x1 + dx,
        y1: w.y1 + dy,
        x2: w.x2 + dx,
        y2: w.y2 + dy,
        hoehe: w.hoeheM,
        dicke: w.dickeM,
        label: q ? (q.art === 'door' ? 'Door' : q.art === 'window' ? 'Window' : 'Opening') : 'Wall',
        oeffnungen,
        art: 'wall',
      })
    }
  }
  if (o.stuetzen) {
    for (const s of p.stuetzen) {
      if (!drin(o.bereich, s.x, s.y)) continue
      const w = (s.winkel * Math.PI) / 180
      const hx = (Math.cos(w) * s.breiteM) / 2
      const hy = (Math.sin(w) * s.breiteM) / 2
      waende.push({ x1: s.x - hx + dx, y1: s.y - hy + dy, x2: s.x + hx + dx, y2: s.y + hy + dy, dicke: s.tiefeM, label: 'Column', oeffnungen: [], art: 'column' })
    }
  }
  const buehnen: UebernahmeBuehne[] = []
  if (o.buehnen) {
    for (const b of p.buehnen) {
      if (!drin(o.bereich, b.x + b.breiteM / 2, b.y + b.tiefeM / 2)) continue
      buehnen.push(buehneAus(b, dx, dy, o.buehnenHoeheM))
    }
  }
  return { waende, buehnen }
}

function buehneAus(b: ErkannteBuehne, dx: number, dy: number, hoehe?: number): UebernahmeBuehne {
  // Kurzer Name statt der ganzen Planbeschriftung („Podium neu < 20m2 …")
  const kurz = /bühne|buehne|stage/i.test(b.label) ? 'Stage' : /podium/i.test(b.label) ? 'Podium' : /podest|riser/i.test(b.label) ? 'Riser' : /tribüne|tribuene/i.test(b.label) ? 'Tribune' : b.label.slice(0, 24)
  return { x: b.x + dx, y: b.y + dy, breite: b.breiteM, tiefe: b.tiefeM, label: kurz, hoehe }
}
