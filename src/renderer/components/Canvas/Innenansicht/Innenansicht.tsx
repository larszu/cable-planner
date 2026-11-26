// ───────────────────────────────────────────────────────────────────────────
// #1240 Stufe 2 — die Innenansicht als zweite Ebene im Canvas.
//
// Hausregel „Steuerung am Geraet im Canvas“: keine zweite App, kein Dialog.
// Ein Doppelklick auf den Mischer (bzw. „Innenansicht“ im Kontextmenue)
// legt diese Ebene ueber den Plan; die Brotkrumen „Plan › Geraet“ fuehren
// zurueck. Der Zustand liegt am Geraet im Projekt (`EquipmentItem.switching`).
// Mischer und Kreuzschiene haben getrennte Ansichten — getrennte Produkte.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useTranslation } from '../../../lib/i18n'
import { innenansichtRolle, switchingProfileFor } from '../../../lib/switching'
import { MischerAufbau } from './MischerAufbau'
import { KreuzschieneAufbau } from './KreuzschieneAufbau'

export const Innenansicht = () => {
  const t = useTranslation()
  const id = useUiStore((s) => s.innenansichtId)
  const close = useUiStore((s) => s.closeInnenansicht)
  const device = useProjectStore((s) => s.project.equipment.find((e) => e.id === id))

  useEffect(() => {
    if (!id) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, close])

  // Das Geraet wurde geloescht, waehrend die Ansicht offen war.
  useEffect(() => {
    if (id && !device) close()
  }, [id, device, close])

  if (!id || !device) return null
  const profile = switchingProfileFor(device)
  const rolle = innenansichtRolle(device) ?? 'mixer'

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col bg-cp-bg"
      data-testid="innenansicht"
      role="region"
      aria-label={t('switching.view.title', 'Inner view')}
    >
      <nav
        className="flex items-center gap-1.5 border-b border-cp-border bg-cp-surface-1 px-3 py-1.5 text-cp-sm"
        aria-label={t('switching.view.breadcrumb', 'Breadcrumb')}
      >
        <button
          type="button"
          onClick={close}
          className="rounded-cp-s px-1.5 py-0.5 text-cp-accent hover:bg-cp-surface-3"
        >
          {t('switching.view.plan', 'Plan')}
        </button>
        <span className="text-cp-text-faint" aria-hidden>
          ›
        </span>
        <span className="font-medium text-cp-text">{device.name}</span>
        <span className="ml-2 text-cp-xs text-cp-text-muted">
          {rolle === 'router'
            ? t('switching.view.router', 'Router · matrix')
            : t('switching.view.mixer', 'Switcher · layout')}
        </span>
      </nav>
      <div className="relative min-h-0 flex-1">
        {rolle === 'router' ? (
          <KreuzschieneAufbau device={device} profile={profile} />
        ) : (
          <MischerAufbau device={device} profile={profile} />
        )}
      </div>
    </div>
  )
}
