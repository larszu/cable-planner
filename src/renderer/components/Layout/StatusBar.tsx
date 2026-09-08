import { useMemo } from 'react'
import { Check, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { APP_VERSION } from '../../lib/appInfo'
import { useUiStore } from '../../store/uiStore'
import { useModule } from '../../store/settingsStore'
import { useCollabStore } from '../../store/collabStore'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { runDrawingChecks } from '../../lib/drawingChecks'
import { buildAddressPlan } from '../../lib/addressPlan'
import { segmentFindings } from '../../lib/networkSegments'
import { actionCounts, actionItems } from '../../lib/actionItems'
import { Icon } from '../shared/Icon'
import { useAusgaben, useBestand } from '../../lager'

interface StatusBarProps {
  projectName: string
  zoom: number
  hasToken: boolean
  equipmentCount: number
  cableCount: number
  locationCount: number
  packedCount?: number
  rentmanProjectName?: string
}

/** H2R-style coarse complexity badge so users get a feel for project
 *  size at a glance. Thresholds are heuristic; the badge is purely
 *  informational. */
const complexityFor = (
  devices: number,
  cables: number,
  t: (key: string, fallback?: string) => string,
): { label: string; tone: string } => {
  const score = devices + cables
  if (score >= 200) return { label: t('statusbar.complexity.xl', 'XL'), tone: 'bg-purple-700 text-purple-100' }
  if (score >= 80) return { label: t('statusbar.complexity.large', 'Groß'), tone: 'bg-amber-600 text-amber-50' }
  if (score >= 30) return { label: t('statusbar.complexity.medium', 'Mittel'), tone: 'bg-sky-700 text-sky-50' }
  if (score >= 8) return { label: t('statusbar.complexity.small', 'Klein'), tone: 'bg-emerald-700 text-emerald-50' }
  return { label: t('statusbar.complexity.new', 'Neu'), tone: 'bg-cp-surface-4 text-cp-text-bright' }
}

/** #471 — Macht eine laufende Live-Session im Haupt-UI sichtbar. Klick öffnet
 *  die Einstellungen direkt auf dem Netzwerk-Sync-Tab. */
const CollabStatusBadge = () => {
  const t = useTranslation()
  const status = useCollabStore((s) => s.status)
  const peers = useCollabStore((s) => s.peers)
  if (status !== 'on' && status !== 'connecting') return null
  return (
    <button
      type="button"
      onClick={() => useUiStore.getState().openSettings('sync')}
      title={t('statusbar.collab.title', 'Live-Kollaboration aktiv — Klick für Teilnehmer & Einladung')}
      className="flex items-center gap-1 whitespace-nowrap rounded bg-emerald-700/80 px-1.5 py-0.5 text-cp-xs font-medium text-emerald-50 hover:bg-emerald-600"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
      {t('statusbar.collab.live', 'Live')} · {Math.max(peers.length, 1)}
    </button>
  )
}

/**
 * BEDARF 108 — das Abzeichen, das den taeglichen Rundgang ersetzt.
 *
 * Der Bedarf sagt es in einem Satz: „users ask to be TOLD something rather
 * than to go and check". Deshalb steht die Zahl in der Statuszeile und nicht
 * hinter zwei Klicks — und deshalb steht sie NUR DA, WENN ES ETWAS ZU SAGEN
 * GIBT. Ein Abzeichen, das jeden Tag „0" zeigt, ist der Anfang davon, dass
 * niemand mehr hinsieht.
 *
 * Gezaehlt wird, was heute oder frueher faellig ist. Das Anstehende und das
 * Undatierte stehen auf der Seite selbst: sie brauchen keinen Alarm, sie
 * brauchen einen Blick.
 */
const AufgabenBadge = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const inventory = useBestand()
  const checkouts = useAusgaben()
  const dringend = useMemo(() => {
    const z = actionCounts(
      actionItems({ today: new Date().toISOString().slice(0, 10), project, inventory, checkouts }),
    )
    return z.overdue + z.today
  }, [project, inventory, checkouts])
  if (dringend === 0) return null
  return (
    <button
      type="button"
      onClick={() => useUiStore.getState().openAnalysis('todo')}
      className="inline-flex shrink-0 items-center gap-1 rounded bg-red-700 px-1.5 py-0.5 text-cp-xs font-bold text-red-50 hover:bg-red-600"
      title={t(
        'statusbar.todo.title',
        'Überfällig oder heute fällig: Rückgaben, Ausgaben, Stunden, Belege, Kosten. Klick öffnet die Analysen auf „Was ansteht".',
      )}
    >
      <Icon icon={AlertCircle} size="xs" />
      {format(t('statusbar.todo.counts', 'Fällig {count}'), { count: dringend })}
    </button>
  )
}

export const StatusBar = ({
  projectName,
  zoom,
  hasToken,
  equipmentCount,
  cableCount,
  locationCount,
  packedCount,
  rentmanProjectName,
}: StatusBarProps) => {
  const t = useTranslation()
  const complexity = complexityFor(equipmentCount, cableCount, t)
  // #411 — Live-Plan-Check-Badge. Findings direkt aus dem Store (Equipment +
  // Cables); ein Klick oeffnet/schliesst die Plan-Check-Palette.
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const drumKit = useProjectStore((s) => s.project.drumKit)
  const sourceIdentities = useProjectStore((s) => s.project.sourceIdentities)
  const anschlussListe = useProjectStore((s) => s.project.anschlussListe)
  const farbnormen = useProjectStore((s) => s.project.farbnormen)
  const defaultVideoFormat = useProjectStore((s) => s.project.metadata.defaultVideoFormat)
  const networkSegments = useProjectStore((s) => s.project.networkSegments)
  const togglePlanCheck = useUiStore((s) => s.togglePlanCheck)
  // Memoisiert, weil die StatusBar bei jeder Viewport-Aenderung rendert, die
  // Check-Engine aber ueber den ganzen Plan laeuft (seit ADR-001 auch ueber
  // den Kabelgraph). Abhaengigkeiten sind Store-Referenzen, wechseln also nur
  // bei echter Projekt-Aenderung.
  const { errorCount, warningCount } = useMemo(
    () => runDrawingChecks({ equipment, cables, drumKit, sourceIdentities, anschlussListe, farbnormen, defaultVideoFormat }),
    [equipment, cables, drumKit, sourceIdentities, anschlussListe, farbnormen, defaultVideoFormat],
  )
  // ── DIE NETZ-BEFUNDE, NEBEN DEN PLAN-CHECK (2026-09-07) ────────────────
  //
  // Der Plan-Check steht seit #411 hier; die Befunde der ANALYSEN standen
  // nirgends. Wer nicht von selbst den Netzwerk-Reiter aufmachte, erfuhr nie,
  // dass zwei Geraete dieselbe IP tragen.
  //
  // ICH HATTE DAS ALS ZU TEUER ZURUECKGESTELLT — nachgemessen stimmt das
  // nicht. Auf einem Plan mit 800 Geraeten und 799 Kabeln:
  //
  //     runDrawingChecks   12,68 ms   (steht laengst hier)
  //     buildAddressPlan    8,02 ms
  //     segmentFindings     0,35 ms
  //
  // Das Dazugekommene kostet weniger als das, was ohnehin schon laeuft. Und
  // es laeuft NICHT bei jeder Viewport-Aenderung: `useMemo` haengt an
  // Store-Referenzen, die nur bei echter Projekt-Aenderung wechseln.
  //
  // ZWEI ABZEICHEN UND NICHT EINES. Ein Abzeichen, dessen Klick woanders
  // landet als das, was es gezaehlt hat, ist dieselbe Sorte Luege wie eine
  // Zahl ohne Deckung: der Plan-Check-Knopf oeffnet die Plan-Check-Palette,
  // der Netz-Knopf die Analysen auf dem Netzwerk-Reiter.
  const netzBefunde = useMemo(() => {
    const plan = buildAddressPlan(equipment)
    const adressen = plan.withIssues.length
    const segmente = segmentFindings(equipment, networkSegments ?? []).length
    return adressen + segmente
  }, [equipment, networkSegments])

  const checkTone =
    errorCount > 0
      ? 'bg-red-700 text-red-50'
      : warningCount > 0
        ? 'bg-amber-600 text-amber-50'
        : 'bg-emerald-700 text-emerald-50'
  const checkIcon = errorCount > 0 ? AlertCircle : warningCount > 0 ? AlertTriangle : CheckCircle2
  return (
    <footer className="cp-statusbar justify-between gap-3 text-cp-xs">
      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
        <span className="truncate font-medium text-[var(--cp-text)]">{projectName}</span>
        <span className="text-[var(--cp-text-faint)]" aria-hidden="true">|</span>
        <span className="whitespace-nowrap">{format(t('statusbar.equipment', '{count} Geräte'), { count: equipmentCount })}</span>
        <span className="whitespace-nowrap">{format(t('statusbar.cables', '{count} Kabel'), { count: cableCount })}</span>
        <span className="hidden whitespace-nowrap lg:inline">{format(t('statusbar.locations', '{count} Rahmen'), { count: locationCount })}</span>
        {packedCount !== undefined && equipmentCount > 0 && (
          <span
            className={`hidden shrink-0 items-center gap-1 whitespace-nowrap xl:inline-flex ${
              packedCount === equipmentCount
                ? 'text-emerald-300'
                : packedCount > 0
                  ? 'text-amber-300'
                  : 'text-cp-text-faint'
            }`}
            title={t('statusbar.packedTitle', "Geräte, die in den Eigenschaften als 'gepackt' markiert sind")}
          >
            <Icon icon={Check} size="xs" />
            {format(t('statusbar.packed', '{packed}/{total} gepackt'), {
              packed: packedCount,
              total: equipmentCount,
            })}
          </span>
        )}
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-cp-xs font-bold ${complexity.tone}`}
          title={t(
            'statusbar.complexity.title',
            'Komplexität: heuristisch aus (Geräte + Kabel)-Anzahl. Hilft beim Einschätzen von Übersichtlichkeit + Performance.',
          )}
        >
          {complexity.label}
        </span>
        <button
          type="button"
          onClick={() => togglePlanCheck()}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-cp-xs font-bold ${checkTone}`}
          title={t('statusbar.planCheck.title', 'Plan-Check öffnen: Live-Validierung (Fehler/Warnungen)')}
        >
          <Icon icon={checkIcon} size="xs" />
          {errorCount > 0 || warningCount > 0
            ? format(t('statusbar.planCheck.counts', '{errors}⚠'), { errors: errorCount + warningCount })
            : t('statusbar.planCheck.ok', 'OK')}
        </button>
        {netzBefunde > 0 && (
          <button
            type="button"
            onClick={() => useUiStore.getState().openAnalysis('network')}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-600 px-1.5 py-0.5 text-cp-xs font-bold text-amber-50"
            title={t(
              'statusbar.network.title',
              'Netz-Befunde: fehlende oder doppelte Adressen, Masken, Segmente. Klick öffnet die Analysen auf dem Netzwerk-Reiter.',
            )}
          >
            <Icon icon={AlertTriangle} size="xs" />
            {format(t('statusbar.network.counts', 'Netz {count}'), { count: netzBefunde })}
          </button>
        )}
        <AufgabenBadge />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* v7.9.4 — Rentman-Badge nur sichtbar wenn die Integration
            in den Einstellungen aktiviert ist. */}
        <CollabStatusBadge />
        {useModule('rentman') && (
          <span className={`hidden whitespace-nowrap lg:inline ${rentmanProjectName ? 'text-orange-300' : hasToken ? 'text-[var(--cp-text-muted)]' : 'text-[var(--cp-text-faint)]'}`}>
            {t('statusbar.rentman.label', 'Rentman:')}{' '}
            {rentmanProjectName ??
              (hasToken
                ? t('statusbar.rentman.tokenReady', 'Token bereit')
                : t('statusbar.rentman.standalone', 'Standalone'))}
          </span>
        )}
        <span>
          {t('statusbar.zoom', 'Zoom:')} {(zoom * 100).toFixed(0)}%
        </span>
        <button
          type="button"
          onClick={() => useUiStore.getState().openAboutDialog()}
          className="rounded bg-[var(--cp-surface-2)] px-1.5 py-0.5 font-mono text-cp-xs text-[var(--cp-text-muted)] hover:bg-[var(--cp-border)] hover:text-[var(--cp-text)]"
          title={t('statusbar.aboutTitle', 'Über Cable Planner')}
        >
          v{APP_VERSION}
        </button>
      </div>
    </footer>
  )
}
