// Kamera-Rig aus Koerper, Objektiv und Halterung.
//
// Konvention (gleich dem multicam-planner, Venue3D/RigStructure):
// - Ursprung am Boden unter der Pan-Achse; die Gruppe setzt der Planer auf
//   (cam.x, 0, cam.y).
// - Bei Pan 0 / Tilt 0 blickt die Optik nach +x, +y ist oben.
// - Pan in Grad, umgesetzt als rotation.y = -pan: positives Pan dreht den
//   Blick von +x nach +z. Tilt in Grad um die lokale z-Achse, positiv = hoch.
// - `hoeheM` ist die Hoehe der optischen Achse bei Tilt 0 (entspricht cam.z).
//   Neigt ein Fluidkopf, wandert die Optik um seine Achse unter der Platte —
//   den Sichtkegel deshalb immer am Knoten `optischeAchse` ansetzen: er liegt
//   an der Objektivfront, seine lokale +x-Achse ist die Blickrichtung.
import * as THREE from 'three'
import type { Detail } from './mensch'
import { entsorgeKameraTeil, knoten } from './kameraBau'
import { erzeugeHalterung, halterungsKnoten, type HalterungArt, type HalterungOptionen } from './kameraHalterung'
import { erzeugeKamerakoerper, erzeugePtzKamera, koerperMasse, PTZ_ACHSE_M, type KoerperArt, type PtzForm, type Tally } from './kameraKoerper'
import { erzeugeMatteBox, erzeugeObjektiv, objektivMasse, type ObjektivOptionen } from './kameraObjektiv'

export interface KameraRigOptionen extends Omit<HalterungOptionen, 'art' | 'plattenHoeheM' | 'detail' | 'kopf' | 'eigeneSchulter'> {
  koerper: KoerperArt
  /** Fehlt `art`, gilt das uebliche Objektiv des Koerpers. Bei PTZ ohne Wirkung. */
  objektiv?: Partial<ObjektivOptionen>
  halterung?: HalterungArt
  /** Hoehe der optischen Achse bei Tilt 0 (m). */
  hoeheM?: number
  pan?: number
  tilt?: number
  /** Ausrichtung der Halterung (Kran, Dolly, Stativbeine); Standard: Pan beim Bau. */
  rigDrehungDeg?: number
  detail?: Detail
  matteBox?: boolean
  cage?: boolean
  tally?: Tally
  ptzForm?: PtzForm
  ptzHell?: boolean
}

export interface KameraRigKnoten {
  wurzel: THREE.Group
  halterung: THREE.Object3D
  panGelenk: THREE.Object3D
  tiltGelenk: THREE.Object3D
  platte: THREE.Object3D
  montagepunkt: THREE.Object3D
  koerper: THREE.Object3D
  objektiv: THREE.Object3D | null
  /** An der Objektivfront; lokale +x = Blickrichtung. */
  optischeAchse: THREE.Object3D
}

export interface KameraRig {
  gruppe: THREE.Group
  knoten: KameraRigKnoten
  /** Pan/Tilt in Grad (gleiche Bedeutung wie in den Optionen). */
  stelle(pan: number, tilt: number): void
  /** Lage der Optik in Weltkoordinaten. */
  optischeAchse(): { ursprung: THREE.Vector3; richtung: THREE.Vector3 }
  /** Haengt das Rig aus und gibt seine eigenen Geometrien frei (der Cache bleibt). */
  dispose(): void
}

export const STANDARD_HOEHE_M: Record<HalterungArt, number> = {
  stativ: 1.5, pedestal: 1.55, kran: 2.5, slider: 1.2, dolly: 1.5, schulter: 1.55, wand: 2.4, decke: 2.6, keine: 1.5,
}

const RAD = Math.PI / 180

export function erzeugeKameraRig(o: KameraRigOptionen): KameraRig {
  const detail = o.detail ?? 'hoch'
  const art = o.halterung ?? (o.koerper === 'ptz' ? 'wand' : 'stativ')
  const hoehe = o.hoeheM ?? STANDARD_HOEHE_M[art]
  const kopfueber = art === 'decke'
  const ptz = o.koerper === 'ptz'
  const masse = koerperMasse(o.koerper, o)
  const achse = ptz ? PTZ_ACHSE_M : masse.achseUeberAuflageM
  const plattenHoehe = hoehe + (kopfueber ? achse : -achse)
  const rigDeg = o.rigDrehungDeg ?? o.pan ?? 0

  const wurzel = new THREE.Group()
  wurzel.name = 'kameraRig'
  const halterung = erzeugeHalterung({
    ...o, art, detail, plattenHoeheM: plattenHoehe,
    kopf: ptz ? 'keiner' : 'fluid',
    eigeneSchulter: o.koerper === 'eng',
  })
  halterung.rotation.y = -rigDeg * RAD
  wurzel.add(halterung)
  const hk = halterungsKnoten(halterung)

  let koerper: THREE.Object3D
  let objektiv: THREE.Object3D | null = null
  let optischeAchse: THREE.Object3D
  let pan = hk.panGelenk
  let tilt = hk.tiltGelenk
  const koerperArt = o.koerper
  if (koerperArt === 'ptz') {
    koerper = erzeugePtzKamera({ form: o.ptzForm, hell: o.ptzHell, tally: o.tally, detail })
    hk.platte.add(koerper)
    pan = koerper.getObjectByName('ptzPan') as THREE.Object3D
    tilt = koerper.getObjectByName('ptzTilt') as THREE.Object3D
    const front = koerper.getObjectByName('objektivFront') as THREE.Object3D
    optischeAchse = knoten('optischeAchse')
    front.add(optischeAchse)
  } else {
    const traeger = knoten('kameraTraeger', -masse.auflageX, masse.achseUeberAuflageM, 0)
    hk.platte.add(traeger)
    koerper = erzeugeKamerakoerper({ art: koerperArt, detail, tally: o.tally, cage: o.cage })
    traeger.add(koerper)
    const objOpt: ObjektivOptionen = { ...o.objektiv, art: o.objektiv?.art ?? masse.standardObjektiv, detail }
    const objM = objektivMasse(objOpt)
    objektiv = erzeugeObjektiv(objOpt)
    traeger.add(objektiv)
    if (o.matteBox && objOpt.art !== 'box') {
      const mb = erzeugeMatteBox(objM.durchmesserM, detail)
      mb.position.x = objM.laengeM - 0.03
      traeger.add(mb)
    }
    optischeAchse = knoten('optischeAchse', objM.laengeM)
    traeger.add(optischeAchse)
  }

  const stelle = (p: number, t: number): void => {
    const rel = (p - rigDeg) * RAD
    // Kopfueber kehrt sich der Drehsinn beider Achsen im lokalen System um.
    if (ptz) {
      pan.rotation.set(0, kopfueber ? rel : -rel, 0)
      tilt.rotation.set(0, 0, (kopfueber ? -t : t) * RAD)
    } else {
      pan.rotation.set(kopfueber ? Math.PI : 0, kopfueber ? rel : -rel, 0)
      tilt.rotation.set(0, 0, (kopfueber ? -t : t) * RAD)
    }
  }
  stelle(o.pan ?? 0, o.tilt ?? 0)

  const knotenListe: KameraRigKnoten = {
    wurzel, halterung, panGelenk: pan, tiltGelenk: tilt, platte: hk.platte, montagepunkt: hk.montagepunkt,
    koerper, objektiv, optischeAchse,
  }
  return {
    gruppe: wurzel,
    knoten: knotenListe,
    stelle,
    optischeAchse() {
      optischeAchse.updateWorldMatrix(true, false)
      const ursprung = new THREE.Vector3().setFromMatrixPosition(optischeAchse.matrixWorld)
      const richtung = new THREE.Vector3(1, 0, 0).transformDirection(optischeAchse.matrixWorld)
      return { ursprung, richtung }
    },
    dispose() {
      entsorgeKameraTeil(wurzel)
    },
  }
}
