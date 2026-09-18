// ───────────────────────────────────────────────────────────────────────────
// Der Frontplatten-Editor (#879).
//
// ─── WARUM NICHT IM RACK-BAUER ─────────────────────────────────────────────
//
// Dort liessen sich Stecker schon ziehen (`PortDots2D`, #170) — aber nur an
// einem Geraet, das in einem Rack SITZT, und in Anteilen der Blendenflaeche.
// Eine Wandanschlussdose sitzt in keinem Rack, und der Mensch, der sie bohrt,
// denkt in Millimetern.
//
// Und: der Rack-Bauer ist der Eintritt nach `components/Rack/`, und dort
// haengt Three.js. Diese Ansicht ist zweidimensional; sie in denselben Ordner
// zu legen hiesse, fuer eine Anschlussdose ein 1,2-MB-Bundle nachzuladen
// (CLAUDE.md, Lazy-Grenze).
//
// ─── DIESELBE ZAHL WIE IM RACK ─────────────────────────────────────────────
//
// Gezogen wird in Millimetern, gespeichert wird `panelPosX/Y` — normiert,
// wie seit #170. Wer hier zieht, verschiebt den Punkt auch in der
// Rack-Ansicht und in der 3D-Sicht. Das ist das vierte Kriterium aus #879,
// und es ist keine Synchronisierung, sondern dasselbe Feld.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Printer } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation, format } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { Icon } from '../shared/Icon'
import { ConnectorSymbol } from '../shared/ConnectorSymbol'
import { findConnectorEntry, connectorColorById } from '../../lib/connectorCatalog'
import { printHtmlDocument } from '../../lib/printHtml'
import { buildFrontplattenHtml } from '../../lib/frontplattenBlatt'
import {
  FRONTPLATTEN_ARTEN,
  ausMm,
  mmPosition,
  plattenBefunde,
  type FrontplattenArt,
} from '../../types/frontplatte'
import type { EquipmentItem, Port } from '../../types/equipment'

/** Bildpunkte je Millimeter in der Ansicht. Nur Darstellung — gespeichert
 *  wird normiert, und gedruckt wird 1:1 aus Millimetern. */
const PX_JE_MM = 2.2

const artLabel = (art: FrontplattenArt, t: (k: string, f: string) => string): string =>
  art === 'wandfeld'
    ? t('faceplate.kind.wall', 'Wall panel')
    : art === 'stagebox'
      ? t('faceplate.kind.stagebox', 'Stage box')
      : art === 'blende'
        ? t('faceplate.kind.panel', 'Rack panel')
        : t('faceplate.kind.other', 'Other')

export const FrontplattenDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.frontplatteOpen)
  const setOpen = useUiStore((s) => s.setFrontplatteOpen)
  const equipment = useProjectStore((s) => s.project.equipment)
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const flaeche = useRef<HTMLDivElement>(null)
  const [zieht, setZieht] = useState<string | null>(null)

  const geraet: EquipmentItem | undefined =
    equipment.find((e) => e.id === gewaehlt) ??
    equipment.find((e) => e.frontplatte) ??
    equipment[0]

  const platte = useMemo(
    () => ({ breiteMm: geraet?.widthMm ?? 0, hoeheMm: geraet?.heightMm ?? 0 }),
    [geraet],
  )
  const ports = useMemo(() => (geraet ? [...geraet.inputs, ...geraet.outputs] : []), [geraet])
  const befunde = useMemo(
    () => (platte.breiteMm > 0 && platte.hoeheMm > 0 ? plattenBefunde(ports, platte) : []),
    [ports, platte],
  )

  if (!open) return null

  const setzePlatte = (teil: Partial<NonNullable<EquipmentItem['frontplatte']>>) => {
    if (!geraet) return
    const bisher = geraet.frontplatte ?? { art: 'wandfeld' as FrontplattenArt }
    updateEquipment(geraet.id, { frontplatte: { ...bisher, ...teil } })
  }

  const setzePort = (portId: string, teil: Partial<Port>) => {
    if (!geraet) return
    const inputs = geraet.inputs.map((p) => (p.id === portId ? { ...p, ...teil } : p))
    const outputs = geraet.outputs.map((p) => (p.id === portId ? { ...p, ...teil } : p))
    updateEquipment(geraet.id, { inputs, outputs })
  }

  const ausZeiger = (e: React.PointerEvent) => {
    const kasten = flaeche.current?.getBoundingClientRect()
    if (!kasten || !geraet) return undefined
    return ausMm(
      (e.clientX - kasten.left) / PX_JE_MM,
      (e.clientY - kasten.top) / PX_JE_MM,
      platte,
      geraet.frontplatte?.rasterMm ?? 0,
    )
  }

  const drucken = () => {
    if (!geraet) return
    printHtmlDocument(
      buildFrontplattenHtml({
        titel: geraet.name,
        platte,
        ports,
        streifenHoeheMm: geraet.frontplatte?.streifenHoeheMm,
      }),
    )
  }

  const feldCls = 'border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs text-cp-text'
  const massFehlt = !(platte.breiteMm > 0 && platte.hoeheMm > 0)

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('faceplate.title', 'Faceplate editor')}
      maxWidth="5xl"
    >
      <PanelHint
        className="mb-3 text-cp-xs text-cp-text-muted"
        text={t(
          'faceplate.hint',
          'The connectors here are the ports of this device, not a drawing of them: what you move is the same position the rack view reads. Millimetres come from the device size; the label strip prints 1:1.',
        )}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-cp-xs">
        <label className="flex items-center gap-1.5">
          {t('faceplate.device', 'Device')}
          <select
            value={geraet?.id ?? ''}
            onChange={(e) => setGewaehlt(e.target.value)}
            className={feldCls}
          >
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          {t('faceplate.kind', 'Kind')}
          <select
            value={geraet?.frontplatte?.art ?? ''}
            onChange={(e) => {
              if (e.target.value) setzePlatte({ art: e.target.value as FrontplattenArt })
              else if (geraet) updateEquipment(geraet.id, { frontplatte: undefined })
            }}
            className={feldCls}
          >
            <option value="">{t('faceplate.kindNone', 'not a faceplate')}</option>
            {FRONTPLATTEN_ARTEN.map((a) => (
              <option key={a} value={a}>
                {artLabel(a, t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          {t('faceplate.width', 'Width (mm)')}
          <input
            type="number"
            min={1}
            value={geraet?.widthMm ?? ''}
            onChange={(e) =>
              geraet && updateEquipment(geraet.id, { widthMm: Number(e.target.value) || undefined })
            }
            className={`${feldCls} w-20`}
          />
        </label>
        <label className="flex items-center gap-1.5">
          {t('faceplate.height', 'Height (mm)')}
          <input
            type="number"
            min={1}
            value={geraet?.heightMm ?? ''}
            onChange={(e) =>
              geraet && updateEquipment(geraet.id, { heightMm: Number(e.target.value) || undefined })
            }
            className={`${feldCls} w-20`}
          />
        </label>
        <label className="flex items-center gap-1.5">
          {t('faceplate.grid', 'Grid (mm)')}
          <input
            type="number"
            min={0}
            value={geraet?.frontplatte?.rasterMm ?? ''}
            onChange={(e) => setzePlatte({ rasterMm: Number(e.target.value) || undefined })}
            className={`${feldCls} w-16`}
            title={t(
              'faceplate.gridTitle',
              'Helps while placing. 0 means free - a bought plate whose holes are already drilled has no grid.',
            )}
          />
        </label>
        <label className="flex items-center gap-1.5">
          {t('faceplate.strip', 'Strip (mm)')}
          <input
            type="number"
            min={0}
            value={geraet?.frontplatte?.streifenHoeheMm ?? ''}
            onChange={(e) => setzePlatte({ streifenHoeheMm: Number(e.target.value) || undefined })}
            className={`${feldCls} w-16`}
            title={t(
              'faceplate.stripTitle',
              'Height of the label strip holder. Empty means no strip.',
            )}
          />
        </label>
        <button
          type="button"
          onClick={drucken}
          disabled={massFehlt}
          className="ml-auto inline-flex items-center gap-1 bg-cp-surface-3 px-2 py-1 hover:bg-cp-surface-4 disabled:opacity-40"
        >
          <Icon icon={Printer} size="xs" /> {t('faceplate.print', 'Print 1:1')}
        </button>
      </div>

      {massFehlt ? (
        <div className="border border-cp-border-muted bg-cp-surface-2 p-4 text-cp-xs text-cp-text-muted">
          {t(
            'faceplate.noSize',
            'This device has no size in millimetres yet. Enter width and height - without them there is no plate to place anything on, and a guessed size would be the one someone drills to.',
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <div
            ref={flaeche}
            className="relative shrink-0 border border-cp-border bg-cp-surface-1"
            style={{ width: platte.breiteMm * PX_JE_MM, height: platte.hoeheMm * PX_JE_MM }}
            onPointerMove={(e) => {
              if (!zieht) return
              const lage = ausZeiger(e)
              if (lage) setzePort(zieht, lage)
            }}
            onPointerUp={() => setZieht(null)}
            onPointerLeave={() => setZieht(null)}
          >
            {ports.map((p) => {
              const pos = mmPosition(p, platte)
              if (!pos) return null
              const eintrag = findConnectorEntry(p.connectorType)
              const d = (p.ausschnittMm ?? 0) * PX_JE_MM
              return (
                <div
                  key={p.id}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    setZieht(p.id)
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move"
                  style={{ left: pos.xMm * PX_JE_MM, top: pos.yMm * PX_JE_MM }}
                  title={`${p.name} · ${p.connectorType}${p.ausschnittMm ? ` · ${p.ausschnittMm} mm` : ''}`}
                >
                  {d > 0 && (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 border border-dashed"
                      style={{
                        width: d,
                        height: d,
                        left: '50%',
                        top: '50%',
                        borderColor: connectorColorById(p.connectorType),
                        borderRadius: '50%',
                      }}
                    />
                  )}
                  {eintrag ? (
                    <ConnectorSymbol
                      symbol={eintrag.symbol}
                      pins={eintrag.pins}
                      gender={p.gender}
                      size={18}
                    />
                  ) : (
                    <span
                      className="block h-3 w-3"
                      style={{ background: connectorColorById(p.connectorType) }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="min-w-0 flex-1">
            <div className="max-h-64 overflow-auto border border-cp-border-muted">
              <table className="w-full text-cp-xs">
                <thead className="sticky top-0 bg-cp-surface-3 text-cp-text-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">{t('faceplate.connector', 'Connector')}</th>
                    <th className="px-2 py-1 text-left">
                      {t('faceplate.position', 'Position (mm)')}
                    </th>
                    <th className="px-2 py-1 text-left">{t('faceplate.cutout', 'Cutout (mm)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ports.map((p) => {
                    const pos = mmPosition(p, platte)
                    return (
                      <tr key={p.id} className="border-t border-cp-border-muted">
                        <td className="px-2 py-1 text-cp-text">{p.name}</td>
                        <td className="px-2 py-1">
                          {pos ? (
                            <span className="font-mono text-cp-text-secondary">
                              {Math.round(pos.xMm)} / {Math.round(pos.yMm)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setzePort(
                                  p.id,
                                  ausMm(platte.breiteMm / 2, platte.hoeheMm / 2, platte),
                                )
                              }
                              className="bg-cp-surface-3 px-1.5 py-0.5 hover:bg-cp-surface-4"
                            >
                              {t('faceplate.place', 'place')}
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={p.ausschnittMm ?? ''}
                            onChange={(e) =>
                              setzePort(p.id, { ausschnittMm: Number(e.target.value) || undefined })
                            }
                            placeholder={t('faceplate.cutoutPlaceholder', 'not stated')}
                            className="w-24 border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                            title={t(
                              'faceplate.cutoutTitle',
                              'From the manufacturer document. Without it this connector is not checked against the others - and the report says so.',
                            )}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {befunde.length > 0 && (
              <ul className="mt-2 space-y-1 text-cp-xs">
                {befunde.map((b, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-1.5 ${
                      b.art === 'ueberschneidung' || b.art === 'ausserhalb'
                        ? 'text-cp-danger'
                        : 'text-cp-text-muted'
                    }`}
                  >
                    <Icon icon={AlertTriangle} size="xs" className="mt-0.5 shrink-0" />
                    <span>{format(t(b.schluessel, b.text), b.werte)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  )
}
