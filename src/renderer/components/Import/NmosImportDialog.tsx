import { useMemo, useState } from 'react'
import { Download, FileJson, Network } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { PanelHint } from '../shared/PanelHint'
import { cablePlannerApi, hasDesktopBridge } from '../../lib/bridge'
import { useTranslation, format } from '../../lib/i18n'
import {
  equipmentFromPreview,
  parseRegistry,
  previewRegistry,
  RegistryFormatError,
  type Is04ImportPreview,
} from '../../lib/nmos'
import { useProjectStore } from '../../store/projectStore'
import { projectHistory } from '../../store/projectHistory'

/**
 * #1240 Stufe 6 — IS-04 einlesen.
 *
 * Eine Registry-Antwort (JSON-Datei, im Desktop auch die Query API) wird zur
 * Bestandsaufnahme: je IS-04-Device ein Geraet mit seinen Sendern als
 * Ausgaengen und Receivern als Eingaengen. Erst die Vorschau, dann die
 * Uebernahme; Geraete mit bekannter UUID werden nicht doppelt angelegt.
 * Kabel entstehen nicht — die Registry weiss nicht, was gesteckt ist.
 *
 * Wird nur gemountet, solange er offen ist: jeder Aufruf beginnt leer.
 */
export const NmosImportDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const t = useTranslation()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState('')
  const [preview, setPreview] = useState<Is04ImportPreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const take = (data: unknown, from: string) => {
    try {
      const reg = parseRegistry(data)
      const pre = previewRegistry(reg, useProjectStore.getState().project.equipment)
      setPreview(pre)
      setSource(from)
      setSelected(new Set(pre.devices.filter((d) => !d.existing).map((d) => d.nmosId)))
      setError(null)
    } catch (e) {
      setError(
        e instanceof RegistryFormatError
          ? t('nmos.import.noDevices', 'No IS-04 devices found. Expected a registry response with nodes, devices, senders and receivers.')
          : e instanceof Error
            ? e.message
            : String(e),
      )
    }
  }

  const openFile = async () => {
    setBusy(true)
    try {
      const res = await cablePlannerApi.nmos.openFile()
      if (!res) return
      if (!res.ok) return setError(res.message)
      let data: unknown
      try {
        data = JSON.parse(res.value.text)
      } catch {
        return setError(t('nmos.import.badJson', 'The file is not valid JSON.'))
      }
      take(data, res.value.fileName)
    } finally {
      setBusy(false)
    }
  }

  const fetchRegistry = async () => {
    setBusy(true)
    try {
      const res = await cablePlannerApi.nmos.fetchRegistry(url)
      if (!res.ok) return setError(res.message)
      take(res.value.resources, res.value.url)
    } finally {
      setBusy(false)
    }
  }

  const count = useMemo(() => preview?.devices.filter((d) => !d.existing && selected.has(d.nmosId)).length ?? 0, [preview, selected])

  const apply = () => {
    if (!preview) return
    const { project, addEquipment } = useProjectStore.getState()
    const maxY = project.equipment.reduce((m, e) => Math.max(m, e.y + e.height), 0)
    const items = equipmentFromPreview(preview, selected, { x: 0, y: maxY + 80 }, uuidv4)
    projectHistory.transact(() => {
      for (const { id: _id, ...item } of items) addEquipment(item)
    })
    onClose()
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const button = 'inline-flex items-center gap-1.5 bg-cp-surface-2 px-3 py-1 text-cp-base hover:bg-cp-surface-3 rounded-cp-control disabled:opacity-50'

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('nmos.import.title', 'Import NMOS registry (IS-04)')}
      titleIcon={<Icon icon={Network} size="md" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:nmos-import"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {preview && (
            <button type="button" onClick={() => setPreview(null)} className={button}>
              {t('common.back', 'Back')}
            </button>
          )}
          <button type="button" onClick={onClose} className={button}>
            {t('common.cancel', 'Cancel')}
          </button>
          {preview && (
            <button
              type="button"
              disabled={count === 0}
              onClick={apply}
              className="inline-flex items-center gap-1.5 rounded-cp-control bg-cp-accent px-3 py-1 text-cp-base font-semibold text-cp-accent-text hover:bg-cp-accent-hover disabled:opacity-50"
            >
              <Icon icon={Download} size="sm" /> {format(t('nmos.import.apply', 'Add {count} devices'), { count })}
            </button>
          )}
        </div>
      }
    >
      {!preview ? (
        <div className="space-y-3">
          <PanelHint
            className="text-cp-base text-cp-text-secondary"
            text={t(
              'nmos.import.intro',
              'Devices with their senders and receivers become an inventory in the plan. No cables are created: a registry knows subscriptions, not what is plugged in.',
            )}
          />
          <button type="button" disabled={busy} onClick={() => void openFile()} className={button}>
            <Icon icon={FileJson} size="sm" /> {t('nmos.import.file', 'Open JSON file…')}
          </button>
          {hasDesktopBridge && (
            <label className="block text-cp-base">
              {t('nmos.import.url', 'Query API address')}
              <div className="mt-1 flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://registry:8235/x-nmos/query/v1.3"
                  className="flex-1 rounded-cp-control border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
                />
                <button type="button" disabled={busy || !url.trim()} onClick={() => void fetchRegistry()} className={button}>
                  {busy ? t('nmos.import.loading', 'Loading…') : t('nmos.import.fetch', 'Read')}
                </button>
              </div>
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-cp-xs text-cp-text-muted">{source}</div>
          {preview.orphans > 0 && (
            <div className="text-cp-xs text-cp-warn">
              {format(t('nmos.import.orphans', '{count} senders or receivers without a known device are skipped.'), {
                count: preview.orphans,
              })}
            </div>
          )}
          <ul className="max-h-96 space-y-1 overflow-y-auto text-cp-base">
            {preview.devices.map((d) => (
              <li key={d.nmosId} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={d.existing}
                  checked={!d.existing && selected.has(d.nmosId)}
                  onChange={() => toggle(d.nmosId)}
                  aria-label={d.name}
                />
                <span className="flex-1 truncate text-cp-text">{d.name}</span>
                <span className="shrink-0 text-cp-xs text-cp-text-muted">
                  {d.existing
                    ? t('nmos.import.existing', 'already in the plan')
                    : format(t('nmos.import.counts', '{senders} senders · {receivers} receivers'), {
                        senders: d.senders.length,
                        receivers: d.receivers.length,
                      })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="mt-3 border border-cp-danger p-2 text-cp-xs text-cp-danger">{error}</div>}
    </ModalShell>
  )
}
