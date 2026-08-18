import { useCallback, useEffect, useMemo, useState } from 'react'
import { Server, RefreshCw, Download, AlertTriangle } from 'lucide-react'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { cablePlannerApi } from '../../lib/bridge'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation, format } from '../../lib/i18n'
import { buildNetboxImportPlan, type NetboxImportPlan } from '../../lib/netboxMapping'
import type { NetboxRack, NetboxSite, NetboxSnapshot } from '../../types/netbox'

/**
 * #597 — NetBox-Import.
 *
 * Zweistufig: erst Site (und optional Rack) aus der konfigurierten Instanz
 * wählen, dann eine Vorschau des Deltas bestätigen. Der Abgleich ist immer
 * additiv, deshalb ist der zweite Lauf („Aktualisieren") derselbe Weg —
 * er zeigt dann nur noch, was seit dem letzten Import dazugekommen ist.
 */

type Phase = 'choose' | 'preview'

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export const NetboxImportDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const t = useTranslation()
  const netboxUrl = useSettingsStore((s) => s.netboxUrl)
  const applyNetboxImport = useProjectStore((s) => s.applyNetboxImport)
  const metadata = useProjectStore((s) => s.project.metadata)

  const [phase, setPhase] = useState<Phase>('choose')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sites, setSites] = useState<NetboxSite[]>([])
  const [racks, setRacks] = useState<NetboxRack[]>([])
  const [siteId, setSiteId] = useState<number | null>(null)
  const [rackId, setRackId] = useState<number | null>(null)

  const [onlyConnectedPorts, setOnlyConnectedPorts] = useState(true)
  const [includeCables, setIncludeCables] = useState(true)
  const [createRackFrames, setCreateRackFrames] = useState(true)

  const [snapshot, setSnapshot] = useState<NetboxSnapshot | null>(null)
  const [plan, setPlan] = useState<NetboxImportPlan | null>(null)

  const configured = netboxUrl.trim().length > 0
  /** Das Projekt hängt bereits an einer NetBox-Quelle → „Aktualisieren". */
  const linked =
    metadata.netboxSourceUrl === netboxUrl.trim() &&
    typeof metadata.netboxScopeId === 'number' &&
    (metadata.netboxScope === 'site' || metadata.netboxScope === 'rack')

  /** Dialog beim Öffnen in den Ausgangszustand bringen; wenn das Projekt
   *  schon verknüpft ist, direkt die gespeicherte Auswahl vorbelegen. */
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Dialog beim Öffnen zurücksetzen + gespeicherte Quelle seeden (keyed sync)
    setPhase('choose')
    setError(null)
    setSnapshot(null)
    setPlan(null)
    if (linked && metadata.netboxScope === 'rack') {
      setRackId(metadata.netboxScopeId ?? null)
    } else if (linked && metadata.netboxScope === 'site') {
      setSiteId(metadata.netboxScopeId ?? null)
      setRackId(null)
    }
  }, [open, linked, metadata.netboxScope, metadata.netboxScopeId])

  const loadSites = useCallback(async () => {
    if (!configured) return
    setBusy(true)
    setError(null)
    try {
      const result = await cablePlannerApi.netbox.getSites(netboxUrl)
      setSites(result)
      // Funktionales Update statt `siteId`-Closure: der Reset-Effect kann
      // im selben Commit eine gespeicherte Site vorbelegt haben, die diese
      // Closure noch als null sieht — die dürfen wir nicht überschreiben.
      setSiteId((current) =>
        current === null && result.length > 0 ? numberOr(result[0].id, 0) || null : current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [configured, netboxUrl])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Site-Liste beim Öffnen aus der Instanz nachladen (externes System)
    if (open && configured && sites.length === 0) void loadSites()
    // Absichtlich nur `open`/`configured` als Deps: `sites.length` mit
    // aufzunehmen wuerde den Effect direkt nach dem Laden erneut ausloesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, configured])

  // Racks nachladen, sobald eine Site gewählt ist.
  useEffect(() => {
    if (!open || !configured || siteId === null) return
    let cancelled = false
    void (async () => {
      try {
        const result = await cablePlannerApi.netbox.getRacks(netboxUrl, siteId)
        if (!cancelled) setRacks(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, configured, netboxUrl, siteId])

  const scope: 'site' | 'rack' = rackId === null ? 'site' : 'rack'
  const scopeId = rackId ?? siteId

  const buildPreview = async () => {
    if (scopeId === null) return
    setBusy(true)
    setError(null)
    try {
      const fetched = await cablePlannerApi.netbox.fetchSnapshot(netboxUrl, scope, scopeId)
      const { equipment, cables } = useProjectStore.getState().project
      const next = buildNetboxImportPlan(fetched, equipment, cables, {
        baseUrl: netboxUrl.trim(),
        onlyConnectedPorts,
        includeCables,
        createRackFrames,
      })
      setSnapshot(fetched)
      setPlan(next)
      setPhase('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const confirmImport = () => {
    if (!plan || !snapshot) return
    applyNetboxImport({
      newEquipment: plan.newEquipment,
      newCables: plan.newCables,
      portAdditions: plan.portAdditions,
      newLocations: plan.newLocations,
      source: {
        baseUrl: netboxUrl.trim(),
        scope: snapshot.scope,
        scopeId: snapshot.scopeId,
        scopeName: snapshot.scopeName,
      },
    })
    onClose()
  }

  const addedPortCount = useMemo(
    () => (plan ? plan.portAdditions.reduce((n, p) => n + p.inputs.length + p.outputs.length, 0) : 0),
    [plan],
  )

  const nothingToDo =
    plan !== null &&
    plan.newEquipment.length === 0 &&
    plan.newCables.length === 0 &&
    addedPortCount === 0

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('netbox.import.title', 'NetBox-Import')}
      titleIcon={<Icon icon={Server} size="md" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:netbox-import"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-cp-xs text-cp-text-muted">
            {configured ? netboxUrl : t('netbox.notConfigured', 'Keine NetBox-URL konfiguriert')}
          </span>
          <div className="flex gap-2">
            {phase === 'preview' && (
              <button
                type="button"
                onClick={() => setPhase('choose')}
                className="rounded bg-cp-surface-2 px-3 py-1 text-cp-base hover:bg-cp-surface-3"
              >
                {t('common.back', 'Zurück')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-cp-surface-2 px-3 py-1 text-cp-base hover:bg-cp-surface-3"
            >
              {t('common.cancel', 'Abbrechen')}
            </button>
            {phase === 'choose' ? (
              <button
                type="button"
                disabled={busy || !configured || scopeId === null}
                onClick={() => void buildPreview()}
                className="rounded bg-sky-600 px-3 py-1 text-cp-base font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {busy
                  ? t('netbox.import.loading', 'Lade aus NetBox…')
                  : t('netbox.import.preview', 'Vorschau erstellen')}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || nothingToDo}
                onClick={confirmImport}
                className="rounded bg-emerald-600 px-3 py-1 text-cp-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Icon icon={Download} size="sm" />{' '}
                {t('netbox.import.apply', 'In Projekt übernehmen')}
              </button>
            )}
          </div>
        </div>
      }
    >
      {!configured ? (
        <div className="rounded border border-amber-700/50 bg-amber-900/20 p-3 text-cp-base text-amber-200">
          {t(
            'netbox.import.needsConfig',
            'Bitte zuerst unter Einstellungen → Integrationen → NetBox die Instanz-URL und ein API-Token hinterlegen.',
          )}
        </div>
      ) : phase === 'choose' ? (
        <div className="space-y-3">
          <p className="text-cp-base text-cp-text-secondary">
            {t(
              'netbox.import.intro',
              'Wähle eine Site oder ein einzelnes Rack. Geräte, Ports und Verbindungen werden gelesen und als Kabelplan angelegt. Der Abgleich fügt immer nur hinzu — bereits vorhandene Geräte und Kabel bleiben mit allen Anpassungen erhalten.',
            )}
          </p>

          <label className="block text-cp-base">
            {t('netbox.import.site', 'Site')}
            <div className="mt-1 flex gap-2">
              <select
                value={siteId ?? ''}
                onChange={(e) => {
                  setSiteId(e.target.value ? Number(e.target.value) : null)
                  setRackId(null)
                }}
                className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
              >
                <option value="">{t('netbox.import.sitePlaceholder', '— Site wählen —')}</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name ?? site.display ?? `Site ${site.id}`}
                    {typeof site.device_count === 'number' ? ` (${site.device_count})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => void loadSites()}
                className="rounded bg-cp-surface-2 px-2 py-1 text-cp-text-muted hover:bg-cp-surface-4 disabled:opacity-50"
                title={t('netbox.import.reload', 'Neu laden')}
                aria-label={t('netbox.import.reload', 'Neu laden')}
              >
                <Icon icon={RefreshCw} size="sm" />
              </button>
            </div>
          </label>

          <label className="block text-cp-base">
            {t('netbox.import.rack', 'Rack (optional)')}
            <select
              value={rackId ?? ''}
              disabled={siteId === null}
              onChange={(e) => setRackId(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base disabled:opacity-50"
            >
              <option value="">
                {t('netbox.import.wholeSite', '— ganze Site importieren —')}
              </option>
              {racks.map((rack) => (
                <option key={rack.id} value={rack.id}>
                  {rack.name ?? rack.display ?? `Rack ${rack.id}`}
                  {typeof rack.device_count === 'number' ? ` (${rack.device_count})` : ''}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2 rounded border border-cp-border bg-cp-surface-3/40 p-3">
            <legend className="px-1 text-cp-xs text-cp-text-muted">
              {t('netbox.import.options', 'Optionen')}
            </legend>
            <label className="flex items-start gap-2 text-cp-base">
              <input
                type="checkbox"
                checked={onlyConnectedPorts}
                onChange={(e) => setOnlyConnectedPorts(e.target.checked)}
                className="mt-1 accent-sky-500"
              />
              <span>
                {t('netbox.import.onlyConnected', 'Nur verkabelte Ports importieren')}
                <span className="block text-cp-xs text-cp-text-muted">
                  {t(
                    'netbox.import.onlyConnectedHint',
                    'Empfohlen: ein 48-Port-Switch bringt sonst 48 unbenutzte Ports mit auf den Plan.',
                  )}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-cp-base">
              <input
                type="checkbox"
                checked={includeCables}
                onChange={(e) => setIncludeCables(e.target.checked)}
                className="accent-sky-500"
              />
              {t('netbox.import.includeCables', 'Verbindungen importieren')}
            </label>
            <label className="flex items-center gap-2 text-cp-base">
              <input
                type="checkbox"
                checked={createRackFrames}
                onChange={(e) => setCreateRackFrames(e.target.checked)}
                className="accent-sky-500"
              />
              {t('netbox.import.rackFrames', 'Rahmen je Rack anlegen')}
            </label>
          </fieldset>

          {linked && (
            <div className="rounded border border-sky-700/50 bg-sky-900/20 p-2 text-cp-xs text-sky-200">
              {format(
                t(
                  'netbox.import.linked',
                  'Dieses Projekt ist mit {scope} „{name}" verknüpft. Letzter Abgleich: {when}.',
                ),
                {
                  scope: metadata.netboxScope === 'rack' ? 'Rack' : 'Site',
                  name: metadata.netboxScopeName ?? '—',
                  when: metadata.netboxLastSyncAt
                    ? new Date(metadata.netboxLastSyncAt).toLocaleString()
                    : '—',
                },
              )}
            </div>
          )}
        </div>
      ) : plan && snapshot ? (
        <div className="space-y-3">
          <div className="text-cp-base">
            <span className="font-semibold">
              {snapshot.scope === 'rack' ? 'Rack' : 'Site'} „{snapshot.scopeName}"
            </span>
            <span className="ml-2 text-cp-xs text-cp-text-muted">
              {snapshot.siteName}
              {snapshot.netboxVersion ? ` · NetBox ${snapshot.netboxVersion}` : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PreviewStat
              label={t('netbox.preview.newDevices', 'Neue Geräte')}
              value={plan.newEquipment.length}
              accent
            />
            <PreviewStat
              label={t('netbox.preview.newCables', 'Neue Verbindungen')}
              value={plan.newCables.length}
              accent
            />
            <PreviewStat
              label={t('netbox.preview.newPorts', 'Neue Ports an Bestand')}
              value={addedPortCount}
              accent={addedPortCount > 0}
            />
            <PreviewStat
              label={t('netbox.preview.unchanged', 'Unverändert')}
              value={plan.unchangedDeviceIds.length + plan.unchangedCableIds.length}
            />
          </div>

          <div className="rounded border border-cp-border bg-cp-surface-3/40 p-2 text-cp-xs text-cp-text-muted">
            {format(
              t(
                'netbox.preview.source',
                'In NetBox: {devices} Geräte, {cables} Verbindungen, {ports} Ports — davon {imported} übernommen.',
              ),
              {
                devices: plan.stats.devicesInNetbox,
                cables: plan.stats.cablesInNetbox,
                ports: plan.stats.componentsInNetbox,
                imported: plan.stats.componentsImported,
              },
            )}
          </div>

          {nothingToDo && (
            <div className="rounded border border-emerald-700/50 bg-emerald-900/20 p-2 text-cp-base text-emerald-200">
              {t(
                'netbox.preview.upToDate',
                'Der Plan ist bereits auf dem Stand von NetBox — es gibt nichts hinzuzufügen.',
              )}
            </div>
          )}

          {(plan.staleDeviceIds.length > 0 || plan.staleCableIds.length > 0) && (
            <div className="rounded border border-amber-700/50 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
              <Icon icon={AlertTriangle} size="sm" />{' '}
              {format(
                t(
                  'netbox.preview.stale',
                  '{devices} Geräte und {cables} Verbindungen im Plan gibt es in NetBox nicht mehr. Sie bleiben unangetastet — bitte manuell prüfen.',
                ),
                { devices: plan.staleDeviceIds.length, cables: plan.staleCableIds.length },
              )}
            </div>
          )}

          {plan.skipped.length > 0 && (
            <details className="rounded border border-cp-border bg-cp-surface-3/40 p-2">
              <summary className="cursor-pointer text-cp-xs text-cp-text-secondary">
                {format(t('netbox.preview.skipped', '{count} übersprungene Objekte'), {
                  count: plan.skipped.length,
                })}
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-cp-xs text-cp-text-muted">
                {plan.skipped.slice(0, 100).map((skip) => (
                  <li key={`${skip.kind}-${skip.netboxId}-${skip.reason}`}>
                    <span className="font-mono">#{skip.netboxId}</span> {skip.label} — {skip.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {plan.newEquipment.length > 0 && (
            <details className="rounded border border-cp-border bg-cp-surface-3/40 p-2" open>
              <summary className="cursor-pointer text-cp-xs text-cp-text-secondary">
                {t('netbox.preview.deviceList', 'Geräte, die angelegt werden')}
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-cp-xs">
                {plan.newEquipment.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span className="truncate text-cp-text">{item.name}</span>
                    <span className="shrink-0 text-cp-text-muted">
                      {item.category} · {item.inputs.length + item.outputs.length} Ports
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : null}

      {error && (
        <div className="mt-3 rounded border border-red-700/50 bg-red-900/20 p-2 text-cp-xs text-red-200">
          {error}
        </div>
      )}
    </ModalShell>
  )
}

const PreviewStat = ({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: boolean
}) => (
  <div
    className={`rounded border p-2 text-center ${
      accent && value > 0
        ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-200'
        : 'border-cp-border bg-cp-surface-3/40 text-cp-text-muted'
    }`}
  >
    <div className="text-cp-xl font-semibold">{value}</div>
    <div className="text-[10px] leading-tight">{label}</div>
  </div>
)
