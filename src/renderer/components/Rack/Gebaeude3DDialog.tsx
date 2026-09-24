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
import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
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
import { gebaeudeSzene, type GebaeudeSzene } from '../../lib/gebaeudeSzene'
import { RaumSichtbarkeit } from '../Canvas/RaumSichtbarkeit'
import type { Floor, LocationFrame } from '../../types/location'

const EMPTY_LOCATIONS: LocationFrame[] = []
const EMPTY_FLOORS: Floor[] = []

type Modus = 'raeume' | 'kabel'

const Szene = ({ szene, modus, beschriftung, isLight }: { szene: GebaeudeSzene; modus: Modus; beschriftung: boolean; isLight: boolean }) => {
  const text = isLight ? '#0f172a' : '#e2e8f0'
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
          <mesh>
            <boxGeometry args={[r.breite, r.hoehe, r.tiefe]} />
            <meshStandardMaterial color={r.farbe} transparent opacity={0.12} depthWrite={false} />
            <Edges color={r.farbe} />
          </mesh>
          {/* Boden deutlicher als die Waende: auf ihm stehen die Geraete. */}
          <mesh position={[0, -r.hoehe / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
      {szene.geraete.map((g) => (
        <group key={g.id} position={[g.pos.x, g.pos.y, g.pos.z]}>
          <mesh>
            <boxGeometry args={[0.35, 0.35, 0.35]} />
            <meshStandardMaterial color={isLight ? '#334155' : '#cbd5e1'} />
          </mesh>
          {beschriftung && modus === 'kabel' && (
            <Html position={[0, 0.4, 0]} center>
              {label(g.name)}
            </Html>
          )}
        </group>
      ))}
      {modus === 'kabel' &&
        szene.kabel.map((k) => (
          <Line
            key={k.id}
            points={[
              [k.von.x, k.von.y, k.von.z],
              [k.nach.x, k.nach.y, k.nach.z],
            ]}
            color={k.farbe}
            lineWidth={k.raumuebergreifend ? 2.5 : 1.2}
            dashed={k.tieLine}
            dashSize={0.4}
            gapSize={0.2}
          />
        ))}
      {modus === 'raeume' &&
        szene.verbindungen.map((v) => {
          const mitte: [number, number, number] = [(v.von.x + v.nach.x) / 2, (v.von.y + v.nach.y) / 2, (v.von.z + v.nach.z) / 2]
          return (
            <group key={`${v.vonRaumId}-${v.nachRaumId}`}>
              <Line
                points={[
                  [v.von.x, v.von.y, v.von.z],
                  [v.nach.x, v.nach.y, v.nach.z],
                ]}
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
      <OrbitControls target={[szene.mitte.x, szene.mitte.y, szene.mitte.z]} makeDefault />
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
  const metersPer100px = useProjectStore(
    (s) => s.project.metadata.lengthEstimation?.metersPer100px ?? DEFAULT_LENGTH_ESTIMATION.metersPer100px,
  )
  const [geschosshoeheM, setGeschosshoeheM] = useState(4)
  const [modus, setModus] = useState<Modus>('raeume')
  const [beschriftung, setBeschriftung] = useState(true)

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

  if (!open) return null
  const angenommen = szene.etagen.filter((e) => e.hoeheAngenommen)
  const abstand = szene.groesse * 1.4

  return (
    <div {...backdrop} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
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
          <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary" title={t('gebaeude3d.storeyTitle', 'Used only for floors without a height in the floor list')}>
            {t('gebaeude3d.storey', 'Storey height (m)')}
            <input
              type="number"
              min={2}
              max={20}
              step={0.5}
              value={geschosshoeheM}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v) && v >= 2 && v <= 20) setGeschosshoeheM(v)
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
        <div className="relative min-h-0 flex-1" style={{ background: isLight ? '#f1f5f9' : '#0b1220' }}>
          {szene.raeume.length === 0 ? (
            <p className="p-4 text-cp-xs text-cp-text-muted">
              {t('gebaeude3d.empty', 'No rooms yet. Draw frames on the canvas and give them a floor — each frame becomes a room here.')}
            </p>
          ) : (
            <Canvas camera={{ position: [szene.mitte.x + abstand, szene.mitte.y + abstand * 0.8, szene.mitte.z + abstand], fov: 45, near: 0.1, far: abstand * 20 }}>
              <Szene szene={szene} modus={modus} beschriftung={beschriftung} isLight={isLight} />
            </Canvas>
          )}
        </div>
        <footer className="border-t border-cp-border px-4 py-1 text-cp-xs text-cp-text-muted">
          {format(
            t('gebaeude3d.footer', '{rooms} rooms · {devices} devices · {cables} cables · {links} room connections — drag to orbit, scroll to zoom'),
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
