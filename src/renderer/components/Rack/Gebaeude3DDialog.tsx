/**
 * #916 — Gebaeude 3D: Raeume auf ihrer Etage, Geraete darin, Kabel und
 * Raumverbindungen dazwischen.
 *
 * WARUM UNTER `Rack/`. Three.js lebt nur hier (CLAUDE.md, „Three.js-Grenze");
 * der Einstieg in `App.tsx` ist `lazy` und wird nur gemountet, wenn der
 * Dialog offen ist — sonst laege Three wieder im Haupt-Chunk
 * (`tests/threeBundleGrenze.test.ts`).
 *
 * Die Szene rechnet `lib/gebaeudeSzene.ts` ohne WebGL; hier wird nur
 * gezeichnet. Sichtbarkeit von Raeumen/Etagen und Kabel-Ebenen kommt aus
 * denselben Schaltern wie auf dem Canvas (uiStore) — zwei Filter fuer
 * dieselbe Frage liefen auseinander.
 */
import { useEffect, useMemo, useState } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { BoxGeometry, CurvePath, DoubleSide, LineCurve3, Plane, Quaternion, TubeGeometry, Vector3 } from 'three'
import { Edges, Html, Line, OrbitControls } from '@react-three/drei'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import { format, useTranslation } from '../../lib/i18n'
import { ansicht } from '../../lib/ansicht'
import { isCableVisibleByLayer } from '../../lib/cableLayers'
import { DEFAULT_LENGTH_ESTIMATION } from '../../lib/cableLengthEstimate'
import {
  canvasPositionAus3D,
  gebaeudeSzene,
  STANDARD_GESCHOSSHOEHE_M,
  type GebaeudeSzene,
  type Punkt3D,
  type SzeneGeraet,
  type SzeneKabel,
} from '../../lib/gebaeudeSzene'
import { fuehrungAusPunkt, STANDARD_DURCHMESSER_MM, stuetzpunktEinfuegen } from '../../lib/kabelFuehrung'
import { kabelAussendurchmesserMm } from '../../lib/buendel'
import { cableCatalog } from '../../types/cableSpec'
import { RaumSichtbarkeit } from '../Canvas/RaumSichtbarkeit'
import type { Floor, LocationFrame } from '../../types/location'
import type { Cable } from '../../types/cable'

const EMPTY_LOCATIONS: LocationFrame[] = []
const EMPTY_FLOORS: Floor[] = []

type Modus = 'raeume' | 'kabel'

/** Laufendes Ziehen eines Geraets (#963): wo es gerade liegt und wo es gegriffen wurde. */
interface Zug {
  id: string
  x: number
  z: number
  /** Abstand Griffpunkt → Geraetemitte, damit es nicht zum Zeiger springt. */
  dx: number
  dz: number
}

/** #1190 — Schlauch wird ueberhoeht gezeichnet: 6 mm waeren im Gebaeude
 *  unsichtbar duenn. Das Verhaeltnis dicker zu duenner Kabel bleibt. */
const SCHLAUCH_UEBERHOEHUNG = 8
const STECKER_LAENGE_M = 0.12
/** Ein Klick, kein Drehen: r3f meldet auch nach einem Zug ein `click`. */
const istKlick = (e: ThreeEvent<MouseEvent>) => e.delta <= 4

/**
 * #1190 — Klick auf eine Wand setzt einen Stuetzpunkt, aber nur auf der
 * Wand, die man von INNEN sieht. Die vordere Wand liegt zwischen Auge und
 * Raum; nimmt sie den Klick, liesse sich der Boden dahinter nie treffen.
 * Ohne `stopPropagation` geht der Klick an die naechste Flaeche weiter.
 */
const wandKlick = (e: ThreeEvent<MouseEvent>, wandPos: [number, number, number], onFlaeche: (p: Punkt3D) => void) => {
  if (!istKlick(e)) return
  // Innen = von der Wand zur Raummitte (Gruppenursprung). Laeuft der Strahl
  // dorthin, tritt er gerade ein: das ist die vordere Wand.
  const hinein = -(wandPos[0] * e.ray.direction.x + wandPos[2] * e.ray.direction.z)
  if (hinein > 0) return
  e.stopPropagation()
  onFlaeche({ x: e.point.x, y: e.point.y, z: e.point.z })
}

/**
 * #1185 — Ein Raum als vier Waende und eine Decke statt als geschlossener
 * Kasten. Mit „Durchsicht" werden die Waende halbtransparent und die Decke
 * faellt weg: man schaut von schraeg oben hinein. Ohne Durchsicht ist der
 * Raum zu — die Ansicht des Gebaeudes von aussen.
 */
const RaumHuelle = ({
  breite,
  hoehe,
  tiefe,
  farbe,
  durchsicht,
  onFlaeche,
}: {
  breite: number
  hoehe: number
  tiefe: number
  farbe: string
  durchsicht: boolean
  onFlaeche?: (p: Punkt3D) => void
}) => {
  const kasten = useMemo(() => new BoxGeometry(breite, hoehe, tiefe), [breite, hoehe, tiefe])
  useEffect(() => () => kasten.dispose(), [kasten])
  const opacity = durchsicht ? 0.1 : 0.55
  const material = <meshStandardMaterial color={farbe} transparent opacity={opacity} depthWrite={false} side={DoubleSide} />
  const waende: { pos: [number, number, number]; rotY: number; w: number }[] = [
    { pos: [0, 0, tiefe / 2], rotY: 0, w: breite },
    { pos: [0, 0, -tiefe / 2], rotY: 0, w: breite },
    { pos: [breite / 2, 0, 0], rotY: Math.PI / 2, w: tiefe },
    { pos: [-breite / 2, 0, 0], rotY: Math.PI / 2, w: tiefe },
  ]
  return (
    <>
      {waende.map((w, i) => (
        <mesh key={i} position={w.pos} rotation={[0, w.rotY, 0]} onClick={onFlaeche ? (e) => wandKlick(e, w.pos, onFlaeche) : undefined}>
          <planeGeometry args={[w.w, hoehe]} />
          {material}
        </mesh>
      ))}
      {!durchsicht && (
        <mesh position={[0, hoehe / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[breite, tiefe]} />
          {material}
        </mesh>
      )}
      {/* Die Kanten bleiben immer: sie zeigen den Raum auch, wenn er offen ist. */}
      <Edges geometry={kasten} color={farbe} />
    </>
  )
}

/**
 * #1190 — Ein Kabel als Schlauch (TubeGeometry) entlang seines Wegs, in der
 * Farbe seiner Signalart, mit einem Endstueck je Stecker. Gewaehlt zeigt es
 * seine Stuetzpunkte; ein Klick auf einen nimmt ihn heraus.
 */
const KabelSchlauch = ({
  k,
  radius,
  gewaehlt,
  isLight,
  onKlick,
  onStuetzpunktWeg,
}: {
  k: SzeneKabel
  radius: number
  gewaehlt: boolean
  isLight: boolean
  onKlick: () => void
  onStuetzpunktWeg: (index: number) => void
}) => {
  const { schlauch, stecker } = useMemo(() => {
    const pts = k.punkte.map((p) => new Vector3(p.x, p.y, p.z))
    const pfad = new CurvePath<Vector3>()
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].distanceTo(pts[i - 1]) > 1e-4) pfad.add(new LineCurve3(pts[i - 1], pts[i]))
    }
    if (pfad.curves.length === 0) return { schlauch: null, stecker: [] }
    const ende = (an: Vector3, nach: Vector3) => {
      const richtung = nach.clone().sub(an).normalize()
      return {
        pos: an.clone().addScaledVector(richtung, STECKER_LAENGE_M / 2),
        drehung: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), richtung),
      }
    }
    const n = pts.length
    return {
      schlauch: new TubeGeometry(pfad, Math.max(16, pfad.curves.length * 24), radius, 8, false),
      stecker: [ende(pts[0], pts[1]), ende(pts[n - 1], pts[n - 2])],
    }
  }, [k.punkte, radius])
  useEffect(() => () => schlauch?.dispose(), [schlauch])
  if (!schlauch) return null
  const steckerFarbe = isLight ? '#475569' : '#94a3b8'
  return (
    <group>
      <mesh
        geometry={schlauch}
        onClick={(e) => {
          if (!istKlick(e)) return
          e.stopPropagation()
          onKlick()
        }}
      >
        <meshStandardMaterial
          color={k.signalFarbe}
          emissive={gewaehlt ? k.signalFarbe : '#000000'}
          emissiveIntensity={gewaehlt ? 0.6 : 0}
          transparent={k.tieLine}
          opacity={k.tieLine ? 0.55 : 1}
        />
      </mesh>
      {stecker.map((s, i) => (
        <mesh key={i} position={s.pos} quaternion={s.drehung}>
          <cylinderGeometry args={[radius * 1.8, radius * 1.8, STECKER_LAENGE_M, 12]} />
          <meshStandardMaterial color={steckerFarbe} />
        </mesh>
      ))}
      {gewaehlt &&
        k.gefuehrt &&
        k.punkte.slice(1, -1).map((p, i) => (
          <mesh
            key={i}
            position={[p.x, p.y, p.z]}
            onClick={(e) => {
              if (!istKlick(e)) return
              e.stopPropagation()
              onStuetzpunktWeg(i)
            }}
          >
            <sphereGeometry args={[Math.max(0.06, radius * 2.5), 16, 12]} />
            <meshStandardMaterial color="#38bdf8" />
          </mesh>
        ))}
    </group>
  )
}

const Szene = ({
  szene,
  modus,
  beschriftung,
  durchsicht,
  isLight,
  gesperrt,
  onVerschoben,
  durchmesserMm,
  gewaehlt,
  onWaehlen,
  onStuetzpunkt,
  onStuetzpunktWeg,
}: {
  szene: GebaeudeSzene
  modus: Modus
  beschriftung: boolean
  durchsicht: boolean
  durchmesserMm: (kabelId: string) => number
  gewaehlt: string | null
  onWaehlen: (kabelId: string) => void
  onStuetzpunkt: (p: Punkt3D) => void
  onStuetzpunktWeg: (index: number) => void
  isLight: boolean
  gesperrt: ReadonlySet<string>
  onVerschoben: (id: string, xM: number, zM: number) => void
}) => {
  const text = isLight ? '#0f172a' : '#e2e8f0'
  const setzen = modus === 'kabel' && gewaehlt !== null
  const [zug, setZug] = useState<Zug | null>(null)
  // Gezogen wird auf der waagrechten Ebene in Hoehe des Geraets: es bleibt
  // auf seiner Etage, nur x/z aendern sich — genau die Canvas-Position.
  const aufEbene = (e: ThreeEvent<PointerEvent>, g: SzeneGeraet): Vector3 | null =>
    e.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -g.pos.y), new Vector3())
  const greifen = (e: ThreeEvent<PointerEvent>, g: SzeneGeraet) => {
    if (gesperrt.has(g.id)) return
    const p = aufEbene(e, g)
    if (!p) return
    e.stopPropagation()
    ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    setZug({ id: g.id, x: g.pos.x, z: g.pos.z, dx: g.pos.x - p.x, dz: g.pos.z - p.z })
  }
  const ziehen = (e: ThreeEvent<PointerEvent>, g: SzeneGeraet) => {
    if (!zug || zug.id !== g.id) return
    const p = aufEbene(e, g)
    if (!p) return
    e.stopPropagation()
    setZug({ ...zug, x: p.x + zug.dx, z: p.z + zug.dz })
  }
  const loslassen = (e: ThreeEvent<PointerEvent>, g: SzeneGeraet) => {
    if (!zug || zug.id !== g.id) return
    e.stopPropagation()
    ;(e.target as Element | null)?.releasePointerCapture?.(e.pointerId)
    if (Math.hypot(zug.x - g.pos.x, zug.z - g.pos.z) > 0.01) onVerschoben(g.id, zug.x, zug.z)
    setZug(null)
  }
  const schild = (inhalt: string) => (
    <div
      style={{
        color: isLight ? '#0f172a' : '#f8fafc',
        background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.88)',
        border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
        borderRadius: 'var(--cp-r-s)',
        padding: '1px 6px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {inhalt}
    </div>
  )
  const label = (inhalt: string, farbe = text) => (
    <div style={{ color: farbe, fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none', textShadow: isLight ? 'none' : '0 0 3px #000' }}>
      {inhalt}
    </div>
  )
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[20, 40, 20]} intensity={0.6} />
      {szene.raeume.map((r) => (
        <group key={r.id} position={[r.x + r.breite / 2, r.y + r.hoehe / 2, r.z + r.tiefe / 2]}>
          <RaumHuelle
            breite={r.breite}
            hoehe={r.hoehe}
            tiefe={r.tiefe}
            farbe={r.farbe}
            durchsicht={durchsicht}
            {...(setzen ? { onFlaeche: onStuetzpunkt } : {})}
          />
          {/* Boden deutlicher als die Waende: auf ihm stehen die Geraete. */}
          <mesh
            position={[0, -r.hoehe / 2 + 0.01, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={
              setzen
                ? (e) => {
                    if (!istKlick(e)) return
                    e.stopPropagation()
                    onStuetzpunkt({ x: e.point.x, y: e.point.y, z: e.point.z })
                  }
                : undefined
            }
          >
            <planeGeometry args={[r.breite, r.tiefe]} />
            <meshStandardMaterial color={r.farbe} transparent opacity={0.25} depthWrite={false} />
          </mesh>
          {beschriftung && (
            <Html position={[0, r.hoehe / 2 + 0.3, 0]} center>
              {label(r.etage ? `${r.etage} · ${r.name}` : r.name, r.farbe)}
            </Html>
          )}
        </group>
      ))}
      {szene.schaechte.map((sch) => {
        const hoehe = sch.yOben - sch.yUnten
        return (
          <group key={sch.id} position={[sch.x, sch.yUnten + hoehe / 2, sch.z]}>
            <mesh>
              <boxGeometry args={[sch.breite, hoehe, sch.tiefe]} />
              <meshStandardMaterial color={sch.farbe} transparent opacity={0.18} depthWrite={false} />
              <Edges color={sch.farbe} />
            </mesh>
            {beschriftung && (
              <Html position={[0, hoehe / 2 + 0.3, 0]} center>
                {label(sch.name, sch.farbe)}
              </Html>
            )}
          </group>
        )
      })}
      {szene.geraete.map((g) => {
        const aktiv = zug?.id === g.id
        const x = aktiv ? zug.x : g.pos.x
        const z = aktiv ? zug.z : g.pos.z
        return (
        <group key={g.id} position={[x, g.pos.y, z]}>
          <mesh
            onPointerDown={(e) => greifen(e, g)}
            onPointerMove={(e) => ziehen(e, g)}
            onPointerUp={(e) => loslassen(e, g)}
          >
            {/* Bodentank: flache Platte im Boden; sonst ein Wuerfel auf Tischhoehe. */}
            <boxGeometry args={g.bodentank ? [0.5, 0.06, 0.5] : [0.35, 0.35, 0.35]} />
            <meshStandardMaterial color={aktiv ? '#38bdf8' : g.bodentank ? '#f59e0b' : isLight ? '#334155' : '#cbd5e1'} />
          </mesh>
          {/* #1185 — Schild mit der Kennung. `Html` liegt als DOM ueber der
              Szene: es zeigt immer zur Kamera und bleibt beim Zoomen gleich
              gross — genau das, was ein Schild soll. */}
          {beschriftung && (
            <Html position={[0, g.bodentank ? 0.3 : 0.45, 0]} center zIndexRange={[20, 0]}>
              {schild(g.kennung)}
            </Html>
          )}
        </group>
        )
      })}
      {modus === 'kabel' &&
        szene.kabel.map((k) => (
          <KabelSchlauch
            key={k.id}
            k={k}
            radius={Math.max(0.006, (durchmesserMm(k.id) / 2000) * SCHLAUCH_UEBERHOEHUNG)}
            gewaehlt={gewaehlt === k.id}
            isLight={isLight}
            onKlick={() => onWaehlen(k.id)}
            onStuetzpunktWeg={onStuetzpunktWeg}
          />
        ))}
      {modus === 'raeume' &&
        szene.verbindungen.map((v) => {
          // Beschriftung in der Mitte des mittleren Abschnitts — ueber einen
          // Schacht ist das die senkrechte Strecke darin.
          const i = Math.max(0, Math.floor((v.punkte.length - 1) / 2))
          const a = v.punkte[i]
          const b = v.punkte[Math.min(i + 1, v.punkte.length - 1)]
          const mitte: [number, number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]
          return (
            <group key={`${v.vonRaumId}-${v.nachRaumId}`}>
              <Line
                points={v.punkte.map((p) => [p.x, p.y, p.z] as [number, number, number])}
                color="#38bdf8"
                lineWidth={Math.min(8, 2 + v.kabelIds.length)}
              />
              {beschriftung && (
                <Html position={mitte} center>
                  {label(String(v.kabelIds.length), '#38bdf8')}
                </Html>
              )}
            </group>
          )
        })}
      <OrbitControls target={[szene.mitte.x, szene.mitte.y, szene.mitte.z]} makeDefault enabled={!zug} />
    </>
  )
}

export const Gebaeude3DDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.gebaeude3dOpen)
  const close = useUiStore((s) => s.closeGebaeude3d)
  const isLight = useUiStore((s) => s.canvasTheme) === 'light'
  const layerVisibility = useUiStore((s) => s.layerVisibility)
  const ausgeblendeteRaeume = useUiStore((s) => s.ausgeblendeteRaeume)
  const ausgeblendeteEtagen = useUiStore((s) => s.ausgeblendeteEtagen)
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const locations = useProjectStore((s) => s.project.locations ?? EMPTY_LOCATIONS)
  const floors = useProjectStore((s) => s.project.floors ?? EMPTY_FLOORS)
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const updateCable = useProjectStore((s) => s.updateCable)
  const customSpecs = useUiStore((s) => s.customCableSpecs)
  const metersPer100px = useProjectStore(
    (s) => s.project.metadata.lengthEstimation?.metersPer100px ?? DEFAULT_LENGTH_ESTIMATION.metersPer100px,
  )
  const [geschosshoeheM, setGeschosshoeheM] = useState(STANDARD_GESCHOSSHOEHE_M)
  // Eingabe als Text, uebernommen beim Verlassen/Enter: sonst liesse sich
  // „12" nicht tippen — die „1" dazwischen laege unter der Untergrenze.
  const [geschossEingabe, setGeschossEingabe] = useState(String(STANDARD_GESCHOSSHOEHE_M))
  const geschossUebernehmen = () => {
    const v = Number(geschossEingabe.replace(',', '.'))
    if (Number.isFinite(v) && v >= 2 && v <= 20) setGeschosshoeheM(v)
    else setGeschossEingabe(String(geschosshoeheM))
  }
  const [modus, setModus] = useState<Modus>('raeume')
  const [beschriftung, setBeschriftung] = useState(true)
  const [durchsicht, setDurchsicht] = useState(true)
  // #1190 — das Kabel, dessen Fuehrung gerade gesetzt wird.
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)

  const { containerRef, containerStyle, headerProps } = useDraggablePosition('cable-planner:modal-pos:gebaeude-3d', open)
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, close, { ref: containerRef })
  const backdrop = useBackdropClose(close)

  const szene = useMemo(() => {
    const sicht = ansicht(equipment, cables, locations, { ausgeblendeteRaeume, ausgeblendeteEtagen, signalweg: null })
    return gebaeudeSzene(
      { equipment, cables, locations, floors },
      {
        metersPer100px,
        geschosshoeheM,
        verborgeneRahmen: sicht.verborgeneRahmen,
        verborgeneGeraete: sicht.verborgeneGeraete,
        kabelSichtbar: (c) => isCableVisibleByLayer(c, layerVisibility),
      },
    )
  }, [equipment, cables, locations, floors, metersPer100px, geschosshoeheM, ausgeblendeteRaeume, ausgeblendeteEtagen, layerVisibility])

  // #1190 — Durchmesser aus dem Katalog (#1178): eigener Wert des Kabels vor
  // dem des Kabeltyps; fehlt beides, ein Standard — gezeichnet wird trotzdem.
  const durchmesser = useMemo(() => {
    const specs = [...cableCatalog, ...customSpecs]
    const byId = new Map(cables.map((c) => [c.id, c]))
    return (id: string) => {
      const c = byId.get(id)
      return (c && kabelAussendurchmesserMm(c, specs)) || STANDARD_DURCHMESSER_MM
    }
  }, [cables, customSpecs])
  const gewaehltesKabel = modus === 'kabel' && gewaehlt ? szene.kabel.find((k) => k.id === gewaehlt) : undefined
  const fuehrungSetzen = (f: Cable['fuehrung3d']) => {
    if (!gewaehlt) return
    updateCable(gewaehlt, { fuehrung3d: f && f.length > 0 ? f : undefined })
  }
  const stuetzpunktSetzen = (p: Punkt3D) => {
    const k = gewaehltesKabel
    const c = cables.find((x) => x.id === gewaehlt)
    if (!k || !c) return
    fuehrungSetzen(stuetzpunktEinfuegen(c.fuehrung3d ?? [], k.von, k.nach, fuehrungAusPunkt(p, metersPer100px), metersPer100px))
  }
  const stuetzpunktWeg = (i: number) => {
    const c = cables.find((x) => x.id === gewaehlt)
    if (!c?.fuehrung3d) return
    fuehrungSetzen(c.fuehrung3d.filter((_, j) => j !== i))
  }

  const gesperrt = useMemo(() => new Set(equipment.filter((e) => e.positionLocked).map((e) => e.id)), [equipment])
  const verschieben = (id: string, xM: number, zM: number) => {
    const e = equipment.find((x) => x.id === id)
    if (!e) return
    updateEquipment(id, canvasPositionAus3D(e, xM, zM, metersPer100px))
  }

  if (!open) return null
  const angenommen = szene.etagen.filter((e) => e.hoeheAngenommen)
  const abstand = szene.groesse * 1.4

  return (
    <div {...backdrop} className="fixed inset-0 z-50 flex items-center justify-center cp-scrim p-4">
      <div
        ref={panelRef}
        style={containerStyle}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden border border-cp-border bg-cp-surface-1 text-cp-text"
      >
        <header {...headerProps} className="flex flex-wrap items-center gap-2 border-b border-cp-border px-4 py-2 select-none">
          <h2 id={titleId} className="mr-auto text-cp-base font-semibold">
            {t('gebaeude3d.title', 'Building 3D')}
          </h2>
          <div className="flex items-center gap-1 text-cp-xs" role="group" aria-label={t('gebaeude3d.mode', 'Show')}>
            <button
              type="button"
              aria-pressed={modus === 'raeume'}
              onClick={() => setModus('raeume')}
              className={`border px-2 py-0.5 ${modus === 'raeume' ? 'border-cp-accent text-cp-accent' : 'border-cp-border text-cp-text-secondary'}`}
            >
              {t('gebaeude3d.modeRooms', 'Room connections')}
            </button>
            <button
              type="button"
              aria-pressed={modus === 'kabel'}
              onClick={() => setModus('kabel')}
              className={`border px-2 py-0.5 ${modus === 'kabel' ? 'border-cp-accent text-cp-accent' : 'border-cp-border text-cp-text-secondary'}`}
            >
              {t('gebaeude3d.modeCables', 'Single cables')}
            </button>
          </div>
          <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary">
            <input type="checkbox" checked={beschriftung} onChange={(e) => setBeschriftung(e.target.checked)} />
            {t('gebaeude3d.labels', 'Labels')}
          </label>
          <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary" title={t('gebaeude3d.seeInsideTitle', 'Walls see-through, ceiling off — look into the rooms from above')}>
            <input type="checkbox" checked={durchsicht} onChange={(e) => setDurchsicht(e.target.checked)} />
            {t('gebaeude3d.seeInside', 'See inside')}
          </label>
          <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary" title={t('gebaeude3d.storeyTitle', 'Used only for floors without a height in the floor list')}>
            {t('gebaeude3d.storey', 'Storey height (m)')}
            <input
              type="text"
              inputMode="decimal"
              value={geschossEingabe}
              onChange={(e) => setGeschossEingabe(e.target.value)}
              onBlur={geschossUebernehmen}
              onKeyDown={(e) => {
                if (e.key === 'Enter') geschossUebernehmen()
              }}
              className="w-14 border border-cp-border bg-cp-surface-3 px-1 py-0.5"
            />
          </label>
          <RaumSichtbarkeit />
          <button type="button" onClick={close} className="bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5">
            {t('common.close', 'Close')}
          </button>
        </header>
        {angenommen.length > 0 && (
          <p className="border-b border-cp-border px-4 py-1 text-cp-xs text-cp-warn">
            {format(
              t('gebaeude3d.assumed', 'No height given for: {floors}. Stacked with the storey height — an assumption, not a measurement.'),
              { floors: angenommen.map((e) => e.name).join(', ') },
            )}
          </p>
        )}
        {modus === 'kabel' && szene.schaechte.length === 0 && szene.kabel.some((k) => k.etagenwechsel) && (
          <p className="border-b border-cp-border px-4 py-1 text-cp-xs text-cp-text-muted">
            {t(
              'gebaeude3d.noRiser',
              'Cables between floors are drawn as straight lines. Mark a frame as riser (frame properties) to route them through it.',
            )}
          </p>
        )}
        {modus === 'kabel' && szene.kabel.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-cp-border px-4 py-1 text-cp-xs text-cp-text-muted">
            {gewaehltesKabel ? (
              <>
                <span className="text-cp-text">
                  {format(t('gebaeude3d.route', '{cable}: {routed} m along the route · {straight} m straight line'), {
                    cable: gewaehltesKabel.name,
                    routed: gewaehltesKabel.laengeM.toFixed(1),
                    straight: gewaehltesKabel.luftlinieM.toFixed(1),
                  })}
                </span>
                <span>{t('gebaeude3d.routeHint', 'Click the floor or a wall to add a support point, click a point to remove it.')}</span>
                {gewaehltesKabel.gefuehrt && (
                  <button type="button" onClick={() => fuehrungSetzen(undefined)} className="border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text">
                    {t('gebaeude3d.routeClear', 'Clear route')}
                  </button>
                )}
              </>
            ) : (
              <span>{t('gebaeude3d.routePick', 'Click a cable to route it through the room — the length along the route goes into the cable list.')}</span>
            )}
          </div>
        )}
        <div className="relative min-h-0 flex-1" style={{ background: isLight ? '#f1f5f9' : '#0b1220' }}>
          {szene.raeume.length === 0 ? (
            <p className="p-4 text-cp-xs text-cp-text-muted">
              {t('gebaeude3d.empty', 'No rooms yet. Draw frames on the canvas and give them a floor — each frame becomes a room here.')}
            </p>
          ) : (
            <Canvas
              camera={{ position: [szene.mitte.x + abstand, szene.mitte.y + abstand * 0.8, szene.mitte.z + abstand], fov: 45, near: 0.1, far: abstand * 20 }}
              onPointerMissed={() => setGewaehlt(null)}
            >
              <Szene szene={szene} modus={modus} beschriftung={beschriftung}
                durchsicht={durchsicht}
                isLight={isLight}
                gesperrt={gesperrt}
                onVerschoben={verschieben}
                durchmesserMm={durchmesser}
                gewaehlt={gewaehltesKabel ? gewaehlt : null}
                onWaehlen={setGewaehlt}
                onStuetzpunkt={stuetzpunktSetzen}
                onStuetzpunktWeg={stuetzpunktWeg}
              />
            </Canvas>
          )}
        </div>
        <footer className="border-t border-cp-border px-4 py-1 text-cp-xs text-cp-text-muted">
          {format(
            t('gebaeude3d.footer', '{rooms} rooms · {devices} devices · {cables} cables · {links} room connections — drag a device or floor box to move it, drag elsewhere to orbit, scroll to zoom'),
            {
              rooms: szene.raeume.length,
              devices: szene.geraete.length,
              cables: szene.kabel.length,
              links: szene.verbindungen.length,
            },
          )}
        </footer>
      </div>
    </div>
  )
}
