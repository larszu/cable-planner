import { useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { projectHistory } from '../../store/projectHistory'
import { useTranslation, format } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'
import { cableCatalog } from '../../types/cableSpec'
import type { CableType } from '../../types/cable'

// CableType excludes DIN/DisplayPort/USB (legacy types); map them to 'Custom'.
const EXCLUDED: Set<string> = new Set(['DIN', 'DisplayPort', 'USB'])
const toCableType = (connectorType: string): CableType =>
  EXCLUDED.has(connectorType) ? 'Custom' : (connectorType as CableType)

/**
 * #378 — Bulk-Cable-Create-Dialog. User waehlt zwei Geraete + Port-
 * Bereiche und der Dialog legt mit einem Klick N Kabel parallel
 * an (Output 1 → Input 10, Output 2 → Input 11, ...).
 *
 * Funktioniert mit Outputs+Inputs ueber Kreuz, oder auch Outputs+
 * Outputs (zb. Patchblende-Durchleitung). Port-Belegungs-Check pro
 * Ziel-Port: belegte Ports werden uebersprungen + dem User gemeldet.
 *
 * Trigger: Werkzeuge-Menue 'Mehrere Kabel verbinden...' (siehe MenuBar).
 */
export const BulkConnectDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.bulkConnect.open)
  const close = useUiStore((s) => s.closeBulkConnect)
  const equipment = useProjectStore((s) => s.project.equipment)
  const customCableSpecs = useUiStore((s) => s.customCableSpecs)
  const addCablesBulk = useProjectStore((s) => s.addCablesBulk)

  const [fromEqId, setFromEqId] = useState<string>('')
  const [fromSide, setFromSide] = useState<'outputs' | 'inputs'>('outputs')
  const [fromStart, setFromStart] = useState<number>(1)
  const [toEqId, setToEqId] = useState<string>('')
  const [toSide, setToSide] = useState<'inputs' | 'outputs'>('inputs')
  const [toStart, setToStart] = useState<number>(1)
  const [count, setCount] = useState<number>(8)
  const [cableSpecId, setCableSpecId] = useState<string>('bnc-coax')
  const [lengthMeters, setLengthMeters] = useState<number>(2)

  const allSpecs = useMemo(
    () => [...cableCatalog, ...customCableSpecs],
    [customCableSpecs],
  )

  const fromEq = equipment.find((e) => e.id === fromEqId)
  const toEq = equipment.find((e) => e.id === toEqId)
  const fromPorts = fromEq ? fromEq[fromSide] : []
  const toPorts = toEq ? toEq[toSide] : []

  const planned = useMemo(() => {
    if (!fromEq || !toEq) return [] as Array<{ from: string; to: string }>
    const result: Array<{ from: string; to: string }> = []
    for (let i = 0; i < count; i++) {
      const fIdx = fromStart - 1 + i
      const tIdx = toStart - 1 + i
      const fp = fromPorts[fIdx]
      const tp = toPorts[tIdx]
      if (!fp || !tp) break
      result.push({ from: fp.name, to: tp.name })
    }
    return result
  }, [fromEq, toEq, fromPorts, toPorts, fromStart, toStart, count])

  const planWillSkip =
    planned.length > 0 &&
    fromPorts.length - fromStart + 1 < count &&
    toPorts.length - toStart + 1 < count

  const handleSubmit = () => {
    if (!fromEq || !toEq || planned.length === 0) return
    const spec = allSpecs.find((s) => s.id === cableSpecId)
    const type: CableType = spec ? toCableType(spec.connectorType) : 'Custom'
    const drafts = planned.map((p) => {
      const fp = fromPorts.find((port) => port.name === p.from)!
      const tp = toPorts.find((port) => port.name === p.to)!
      return {
        name: format(t('bulk.cableName', '{from} → {to}'), { from: p.from, to: p.to }),
        type,
        length: lengthMeters,
        color: spec?.color ?? '#94a3b8',
        notes: '',
        cableSpecId: spec?.id,
        fromEquipmentId: fromEq.id,
        fromPortId: fp.id,
        toEquipmentId: toEq.id,
        toPortId: tp.id,
      }
    })
    const result = projectHistory.transact(() => addCablesBulk(drafts))
    if (result.skipped > 0) {
      alert(
        format(
          t('bulk.resultSkipped', '{created} Kabel angelegt, {skipped} übersprungen (Ziel-Port belegt oder ungültig).'),
          { created: result.created, skipped: result.skipped },
        ),
      )
    }
    close()
  }

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('bulk.title', '🔗 Mehrere Kabel verbinden')}
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!fromEq || !toEq || planned.length === 0}
            className="rounded bg-emerald-600 px-3 py-1 text-cp-xs text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {format(t('bulk.create', '{n} Kabel erstellen'), { n: planned.length })}
          </button>
        </div>
      }
    >
      <div className="space-y-3 p-4 text-cp-base">
        <p className="text-[11px] text-cp-text-muted">
          {t(
            'bulk.intro',
            'Erstellt N Kabel auf einmal: Quelle-Port i → Ziel-Port i. Belegte Ziel-Ports werden übersprungen.',
          )}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Quelle */}
          <fieldset className="rounded border border-cp-border p-2">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-cp-text-muted">
              {t('bulk.source', 'Quelle')}
            </legend>
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('bulk.device', 'Gerät')}</span>
              <select
                value={fromEqId}
                onChange={(e) => setFromEqId(e.target.value)}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
              >
                <option value="">—</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('bulk.side', 'Seite')}</span>
              <select
                value={fromSide}
                onChange={(e) => setFromSide(e.target.value as 'outputs' | 'inputs')}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
              >
                <option value="outputs">{t('bulk.outputs', 'Outputs')}</option>
                <option value="inputs">{t('bulk.inputs', 'Inputs')}</option>
              </select>
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {format(
                  t('bulk.startFrom', 'Start-{side} (1..{total})'),
                  { side: fromSide === 'outputs' ? 'Output' : 'Input', total: fromPorts.length },
                )}
              </span>
              <input
                type="number"
                min={1}
                max={Math.max(1, fromPorts.length)}
                value={fromStart}
                onChange={(e) => setFromStart(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 font-mono text-cp-xs"
              />
            </label>
          </fieldset>

          {/* Ziel */}
          <fieldset className="rounded border border-cp-border p-2">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-cp-text-muted">
              {t('bulk.target', 'Ziel')}
            </legend>
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('bulk.device', 'Gerät')}</span>
              <select
                value={toEqId}
                onChange={(e) => setToEqId(e.target.value)}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
              >
                <option value="">—</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('bulk.side', 'Seite')}</span>
              <select
                value={toSide}
                onChange={(e) => setToSide(e.target.value as 'inputs' | 'outputs')}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
              >
                <option value="inputs">{t('bulk.inputs', 'Inputs')}</option>
                <option value="outputs">{t('bulk.outputs', 'Outputs')}</option>
              </select>
            </label>
            <label className="mt-2 block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">
                {format(
                  t('bulk.startTo', 'Start-{side} (1..{total})'),
                  { side: toSide === 'inputs' ? 'Input' : 'Output', total: toPorts.length },
                )}
              </span>
              <input
                type="number"
                min={1}
                max={Math.max(1, toPorts.length)}
                value={toStart}
                onChange={(e) => setToStart(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 font-mono text-cp-xs"
              />
            </label>
          </fieldset>
        </div>

        {/* Anzahl + Kabel-Spec + Laenge */}
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('bulk.count', 'Anzahl Kabel')}</span>
            <input
              type="number"
              min={1}
              max={256}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(256, Number(e.target.value) || 1)))}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 font-mono text-cp-xs"
            />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('bulk.spec', 'Kabel-Typ')}</span>
            <select
              value={cableSpecId}
              onChange={(e) => setCableSpecId(e.target.value)}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
            >
              {allSpecs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.connectorType})
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('bulk.length', 'Länge pro Kabel (m)')}</span>
          <input
            type="number"
            min={0}
            step="0.5"
            value={lengthMeters}
            onChange={(e) => setLengthMeters(Math.max(0, Number(e.target.value) || 0))}
            className="w-32 rounded border border-cp-border bg-cp-surface-3 p-1.5 font-mono text-cp-xs"
          />
        </label>

        {/* Preview */}
        <div className="rounded border border-cp-border bg-cp-surface-3/40 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-cp-text-muted">
            {format(t('bulk.preview', 'Vorschau ({n}/{plan} Kabel)'), {
              n: planned.length,
              plan: count,
            })}
          </div>
          {planned.length === 0 ? (
            <p className="text-[11px] text-cp-text-muted">
              {t('bulk.previewEmpty', 'Wähle Quelle/Ziel und Port-Bereich.')}
            </p>
          ) : (
            <ul className="max-h-32 space-y-0.5 overflow-auto text-[11px] text-cp-text-secondary">
              {planned.slice(0, 12).map((p, i) => (
                <li key={i} className="font-mono">
                  {p.from} → {p.to}
                </li>
              ))}
              {planned.length > 12 && (
                <li className="text-cp-text-faint">… + {planned.length - 12} weitere</li>
              )}
            </ul>
          )}
          {planWillSkip && (
            <p className="mt-1 text-[10px] text-amber-400">
              {t('bulk.willSkip', '⚠ Anzahl überschreitet verfügbare Ports — überzählige werden ausgelassen.')}
            </p>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
