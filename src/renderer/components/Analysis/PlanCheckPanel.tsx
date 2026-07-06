// #411 — Vereinte „Plan-Check"-Palette.
//
// Live-Validierung des aktuellen Plans in einem ziehbaren Panel (analog zu
// ConnectCADs „Status"-Palette). Liest Equipment + Cables aus dem Store,
// rechnet die Findings über lib/drawingChecks.ts und macht jeden Fund
// klickbar → selektiert das betroffene Gerät/Kabel auf dem Canvas.

import { useMemo } from 'react'
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useTranslation, format } from '../../lib/i18n'
import { runDrawingChecks, type CheckFinding, type CheckSeverity } from '../../lib/drawingChecks'
import { triggerCanvasCenterOn } from '../../lib/canvasViewport'

const SEVERITY_META: Record<
  CheckSeverity,
  { icon: typeof AlertTriangle; tone: string; row: string }
> = {
  error: { icon: AlertCircle, tone: 'text-red-400', row: 'hover:bg-red-950/40' },
  warning: { icon: AlertTriangle, tone: 'text-amber-400', row: 'hover:bg-amber-950/30' },
  info: { icon: Info, tone: 'text-sky-400', row: 'hover:bg-sky-950/30' },
}

export const PlanCheckPanel = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.planCheck.open)
  const close = useUiStore((s) => s.closePlanCheck)
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const drumKit = useProjectStore((s) => s.project.drumKit)
  const setSelection = useProjectStore((s) => s.setSelection)

  const result = useMemo(
    () => runDrawingChecks({ equipment, cables, drumKit }),
    [equipment, cables, drumKit],
  )

  if (!open) return null

  // Fund anklicken → betroffenes Element selektieren UND die Canvas darauf
  // zentrieren (centerOn-Bridge), damit man es auch sieht wenn es außerhalb des
  // Viewports liegt. Bei Kabeln auf die Mitte zwischen den beiden Geräten.
  const centerOnEquipment = (id: string | undefined) => {
    const e = id ? equipment.find((x) => x.id === id) : undefined
    if (e) triggerCanvasCenterOn(e.x + e.width / 2, e.y + e.height / 2)
    return e
  }
  const focusFinding = (f: CheckFinding) => {
    if (f.cableId) {
      setSelection(undefined, f.cableId, undefined)
      const c = cables.find((x) => x.id === f.cableId)
      const a = c ? equipment.find((e) => e.id === c.fromEquipmentId) : undefined
      const b = c ? equipment.find((e) => e.id === c.toEquipmentId) : undefined
      if (a && b) {
        triggerCanvasCenterOn(
          (a.x + a.width / 2 + b.x + b.width / 2) / 2,
          (a.y + a.height / 2 + b.y + b.height / 2) / 2,
        )
      } else {
        centerOnEquipment(a?.id ?? b?.id)
      }
    } else if (f.equipmentId) {
      setSelection(f.equipmentId, undefined, undefined)
      centerOnEquipment(f.equipmentId)
    }
  }

  const { findings, errorCount, warningCount, infoCount } = result

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('planCheck.title', 'Plan-Check')}
      titleIcon="🩺"
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:plancheck"
      scrollBody={false}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-cp-border-muted py-2 text-cp-xs">
          <span className="inline-flex items-center gap-1 text-red-400">
            <Icon icon={AlertCircle} size="xs" /> {errorCount}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-400">
            <Icon icon={AlertTriangle} size="xs" /> {warningCount}
          </span>
          <span className="inline-flex items-center gap-1 text-sky-400">
            <Icon icon={Info} size="xs" /> {infoCount}
          </span>
          <span className="ml-auto text-cp-text-faint">
            {format(t('planCheck.summary', '{count} Hinweise'), { count: findings.length })}
          </span>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {findings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-emerald-400">
              <Icon icon={CheckCircle2} size="lg" />
              <span className="text-cp-base">{t('planCheck.allClear', 'Keine Auffälligkeiten gefunden.')}</span>
            </div>
          ) : (
            <ul className="divide-y divide-cp-surface-2/60">
              {findings.map((f) => {
                const meta = SEVERITY_META[f.severity]
                const clickable = !!(f.cableId || f.equipmentId)
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => focusFinding(f)}
                      className={`flex w-full items-start gap-2 px-2 py-1.5 text-left text-cp-xs ${meta.row} ${
                        clickable ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <Icon icon={meta.icon} size="xs" className={`mt-0.5 shrink-0 ${meta.tone}`} />
                      <span className="min-w-0">
                        <span className={`mr-1 font-semibold ${meta.tone}`}>{f.category}:</span>
                        <span className="text-cp-text-secondary">{f.message}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <p className="border-t border-cp-border-muted py-1.5 text-[10px] text-cp-text-muted">
          {t(
            'planCheck.footerHint',
            'Live-Validierung des Plans. Klick auf einen Hinweis selektiert das betroffene Element.',
          )}
        </p>
      </div>
    </ModalShell>
  )
}
