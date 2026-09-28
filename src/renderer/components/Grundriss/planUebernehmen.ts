// Eine Plan-Datei laden und als Grundriss setzen — ein Weg fuer Dateiauswahl,
// Drop aufs Panel und Drop auf den Canvas, damit die drei nicht auseinander-
// laufen (vor ADR-015 hatte das Panel seinen eigenen Lader).

import { ladePlanDatei, type GeladenerPlan } from '../../avplan/floorplan/planDatei'
import { confirmDialog } from '../../lib/confirmDialog'
import {
  ersetzenBrauchtBestaetigung,
  grundrissAusPlan,
  PLAN_MAX_KANTE_CABLE,
  planFehlerCode,
  planFehlerText,
} from '../../lib/grundriss/planUebernahme'
import type { Grundriss, PlanPunkt } from '../../types/grundriss'

export type PlanUebernahme =
  | { status: 'ok'; plan: GeladenerPlan }
  | { status: 'abgebrochen' }
  | { status: 'fehler'; text: string }

export async function planUebernehmen(o: {
  datei: File
  ursprung: (plan: GeladenerPlan) => PlanPunkt
  aktuell: Grundriss | null | undefined
  setze: (g: Grundriss) => void
  t: (key: string, fallback: string) => string
}): Promise<PlanUebernahme> {
  const { t } = o
  let plan: GeladenerPlan
  try {
    plan = await ladePlanDatei(o.datei, { maxKante: PLAN_MAX_KANTE_CABLE })
  } catch (e) {
    return { status: 'fehler', text: planFehlerText(planFehlerCode(e), t) }
  }
  if (ersetzenBrauchtBestaetigung(o.aktuell)) {
    const ja = await confirmDialog(t('floorplan.replaceConfirm', 'Replace the floor plan?'), {
      body: t(
        'floorplan.replaceConfirmBody',
        'The new image replaces the current floor plan. Its scale calibration is lost and has to be set again.',
      ),
      okLabel: t('floorplan.replace', 'Replace'),
      destructive: true,
    })
    if (!ja) return { status: 'abgebrochen' }
  }
  o.setze(grundrissAusPlan(plan, o.ursprung(plan)))
  return { status: 'ok', plan }
}
