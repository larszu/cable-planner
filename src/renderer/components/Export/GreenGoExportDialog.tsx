import { useRef, useState } from 'react'
import { Download, Upload, X, FileSpreadsheet } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useProjectStore } from '../../store/projectStore'
import type { GreenGoConfig, GreenGoGroup, GreenGoUser } from '../../types/greengo'
import { defaultGreenGoConfig } from '../../types/greengo'
import { buildGg5File } from '../../lib/exportGreengo'
import {
  autoMatchEquipment,
  detectDeviceType,
  isParseError,
  parseGg5File,
  type Gg5ImportResult,
} from '../../lib/importGreengo'
import {
  exportIntercomMatrixXlsx,
  parseIntercomMatrixXlsx,
} from '../../lib/intercomMatrixXlsx'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { useTranslation, format } from '../../lib/i18n'

interface Props {
  onClose: () => void
}

const downloadFile = (filename: string, content: string) =>
  downloadBlob(filename, content, 'application/json;charset=utf-8')

const MAX_USERS = 12
const MAX_GROUPS = 9

export const GreenGoExportDialog = ({ onClose }: Props) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const savedConfig = useProjectStore((s) => s.project.greengoConfig)
  const updateGreenGoConfig = useProjectStore((s) => s.updateGreenGoConfig)

  const [config, setConfig] = useState<GreenGoConfig>(
    () => savedConfig ?? defaultGreenGoConfig(),
  )

  const [activeTab, setActiveTab] = useState<'matrix' | 'users' | 'groups' | 'system'>('matrix')

  // ── import state ──────────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null)
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<Gg5ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [xlsxImportNotice, setXlsxImportNotice] = useState<string | null>(null)
  /** userId → canvas equipmentId mapping chosen by the user in the import overlay */
  const [importMappings, setImportMappings] = useState<Map<number, string>>(new Map())

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseGg5File(text)
      if (isParseError(result)) {
        setImportError(result.error)
        setImportResult(null)
      } else {
        // Auto-match imported users to canvas equipment
        const autoMap = autoMatchEquipment(result.config.users, intercomEquipment)
        setImportMappings(autoMap)
        setImportResult(result)
        setImportError(null)
      }
    }
    reader.readAsText(file, 'utf-8')
    // reset so the same file can be re-selected
    e.target.value = ''
  }

  const applyImport = () => {
    if (!importResult) return
    // Merge equipment IDs from the mapping into the imported users
    const users = importResult.config.users.map((u) => ({
      ...u,
      equipmentId: importMappings.get(u.id) || undefined,
    }))
    setConfig({ ...importResult.config, users })
    setActiveTab('matrix')
    setImportResult(null)
    setImportError(null)
  }

  const cancelImport = () => {
    setImportResult(null)
    setImportError(null)
  }

  // ── XLSX intercom-matrix round-trip ───────────────────────────────────────

  const handleXlsxSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const buffer = ev.target?.result
      if (!(buffer instanceof ArrayBuffer)) {
        setImportError(t('greengo.importXlsxBinaryError', 'Konnte XLSX nicht als Binärdaten lesen.'))
        return
      }
      const result = await parseIntercomMatrixXlsx(buffer)
      if ('error' in result) {
        setImportError(result.error)
        return
      }
      // Merge with current config: prefer the XLSX-derived users/groups
      // but keep system metadata (multicast/sampleRate) from the current
      // session so the user doesn't lose those defaults.
      setConfig((prev) => ({
        ...prev,
        systemName: result.config.systemName,
        description: result.config.description,
        users: result.config.users,
        groups: result.config.groups,
      }))
      setActiveTab('matrix')
      const lines: string[] = []
      lines.push(
        format(
          t('greengo.import.usersAndGroups', '✓ {users} Benutzer · {groups} Gruppen aus Excel übernommen.'),
          { users: result.config.users.length, groups: result.config.groups.length },
        ),
      )
      if (result.directTalkPairs.length > 0) {
        lines.push(
          format(
            t(
              'greengo.import.directIgnored',
              '{n} Direkt-Linien (User↔User) wurden ignoriert — GreenGo speichert Mitgliedschaften, keine 1:1-Routen.',
            ),
            { n: result.directTalkPairs.length },
          ),
        )
      }
      if (result.equipmentMarks.length > 0) {
        lines.push(
          format(
            t(
              'greengo.import.equipmentAudit',
              '{n} Equipment-Markierungen sind nur Audit — ordne die Beltpacks auf dem Canvas zu.',
            ),
            { n: result.equipmentMarks.length },
          ),
        )
      }
      for (const w of result.warnings) lines.push(`⚠ ${w}`)
      setXlsxImportNotice(lines.join('\n'))
      setImportError(null)
    }
    reader.onerror = () => setImportError(t('greengo.import.readError', 'XLSX konnte nicht gelesen werden.'))
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const handleXlsxExport = async () => {
    const buffer = await exportIntercomMatrixXlsx(config)
    downloadBlob(
      // v7.9.116 — Einheitlicher Stempel.
      buildExportFilenameWithSuffix(config.systemName || 'intercom', 'IntercomMatrix', 'xlsx'),
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  }

  // ── system helpers ────────────────────────────────────────────────────────

  const setField = <K extends keyof GreenGoConfig>(key: K, value: GreenGoConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  // ── user helpers ──────────────────────────────────────────────────────────

  const addUser = () => {
    if (config.users.length >= MAX_USERS) return
    const nextId = Math.max(0, ...config.users.map((u) => u.id)) + 1
    const newUser: GreenGoUser = {
      id: nextId,
      name: t('greengo.defaultUserName', 'Benutzer {n}').replace('{n}', String(nextId)),
      groupIds: [],
    }
    setConfig((c) => ({ ...c, users: [...c.users, newUser] }))
  }

  const updateUser = (id: number, patch: Partial<GreenGoUser>) =>
    setConfig((c) => ({
      ...c,
      users: c.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    }))

  const removeUser = (id: number) =>
    setConfig((c) => ({ ...c, users: c.users.filter((u) => u.id !== id) }))

  const toggleUserGroup = (userId: number, groupId: number) => {
    const user = config.users.find((u) => u.id === userId)
    if (!user) return
    const groupIds = user.groupIds.includes(groupId)
      ? user.groupIds.filter((g) => g !== groupId)
      : [...user.groupIds, groupId]
    updateUser(userId, { groupIds })
  }

  // ── group helpers ─────────────────────────────────────────────────────────

  const addGroup = () => {
    if (config.groups.length >= MAX_GROUPS) return
    const nextId = Math.max(0, ...config.groups.map((g) => g.id)) + 1
    const newGroup: GreenGoGroup = {
      id: nextId,
      name: t('greengo.defaultGroupName', 'Gruppe {n}').replace('{n}', String(nextId)),
    }
    setConfig((c) => ({ ...c, groups: [...c.groups, newGroup] }))
  }

  const updateGroup = (id: number, patch: Partial<GreenGoGroup>) =>
    setConfig((c) => ({
      ...c,
      groups: c.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }))

  const removeGroup = (id: number) =>
    setConfig((c) => ({
      ...c,
      groups: c.groups.filter((g) => g.id !== id),
      users: c.users.map((u) => ({
        ...u,
        groupIds: u.groupIds.filter((gid) => gid !== id),
      })),
    }))

  // ── export ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    updateGreenGoConfig(config)
  }

  const handleExport = () => {
    updateGreenGoConfig(config)
    // v7.9.116 — Einheitlicher Stempel, gg5-Endung beibehalten.
    downloadFile(buildExportFilenameWithSuffix(config.systemName || 'GreenGo', 'config', 'gg5'), buildGg5File(config))
  }

  // ── GreenGo device filter (equipment with 'greengo' or 'intercom' in category/name) ──

  const intercomEquipment = equipment.filter((e) =>
    /greengo|intercom|beltpack|mcxd?|xtbb|xtbd|bpxsp|\bbpx\b|wbpx/i.test(e.name + ' ' + e.category),
  )

  const getDeviceType = (equipmentId?: string): string => {
    if (!equipmentId) return ''
    const n = equipment.find((e) => e.id === equipmentId)?.name?.toLowerCase() ?? ''
    if (n.includes('mcxd')) return 'MCXD'
    if (n.includes('mcx')) return 'MCX'
    if (n.includes('wbpx')) return 'WBPX'
    if (n.includes('bpxsp')) return 'BPXSP'
    if (n.includes('bpx')) return 'BPX'
    if (n.includes('xtbd')) return 'XTBD'
    if (n.includes('xtbb')) return 'XTBB'
    if (n.includes('antenna')) return 'ANT'
    return ''
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded border border-emerald-700 bg-cp-surface-1 text-cp-text">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-3">
          <div>
            <h3 className="text-cp-xl font-semibold text-emerald-300">{t('greengo.title', 'GreenGo Intercom-Planung')}</h3>
            <p className="text-[11px] text-cp-text-muted">{config.systemName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
            aria-label={t('common.close', 'Schließen')}
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cp-border text-cp-xs">
          {([
            ['matrix',  t('greengo.tab.matrix', 'Übersicht')],
            ['users',   `${t('greengo.tab.users', 'Stationen')} (${config.users.length})`],
            ['groups',  `${t('greengo.tab.groups', 'Gruppen')} (${config.groups.length})`],
            ['system',  t('greengo.tab.system', 'System')],
          ] as [string, string][]).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab as 'matrix' | 'users' | 'groups' | 'system')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-emerald-400 text-emerald-300'
                  : 'text-cp-text-muted hover:text-cp-text-bright'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ══════ MATRIX OVERVIEW ══════ */}
          {activeTab === 'matrix' && (
            <div>
              {(config.users.length === 0 || config.groups.length === 0) && (
                <div className="mb-3 rounded border border-amber-800 bg-amber-950/40 px-3 py-2 text-cp-xs text-amber-300">
                  {config.users.length === 0 && config.groups.length === 0
                    ? t('greengo.matrix.emptyBoth', 'Noch keine Stationen und Gruppen — wechsle zu den Tabs „Stationen" und „Gruppen".')
                    : config.users.length === 0
                      ? t('greengo.matrix.emptyUsers', 'Noch keine Stationen — wechsle zum Tab „Stationen".')
                      : t('greengo.matrix.emptyGroups', 'Noch keine Gruppen — wechsle zum Tab „Gruppen".')}
                </div>
              )}

              {config.users.length > 0 && config.groups.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-cp-xs">
                    <thead>
                      <tr className="bg-cp-surface-2">
                        <th className="w-8 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-cp-text-muted">#</th>
                        <th className="min-w-[130px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.col.station', 'Station')}</th>
                        <th className="min-w-[70px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.col.type', 'Typ')}</th>
                        <th className="min-w-[160px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.col.deviceCanvas', 'Gerät (Canvas)')}</th>
                        {config.groups.map((group) => (
                          <th key={group.id} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-emerald-400 whitespace-nowrap">
                            {group.name}
                          </th>
                        ))}
                        <th className="w-6" />
                      </tr>
                    </thead>
                    <tbody>
                      {config.users.map((user, idx) => {
                        const deviceType = getDeviceType(user.equipmentId)
                        return (
                          <tr key={user.id}
                            className={`border-t border-cp-border-muted ${idx % 2 === 0 ? 'bg-cp-surface-1' : 'bg-cp-surface-2/30'} hover:bg-cp-surface-2/70`}>
                            <td className="px-2 py-1.5 text-center text-[10px] text-cp-text-muted font-mono">{user.id}</td>
                            <td className="px-2 py-1">
                              <input
                                value={user.name}
                                onChange={(e) => updateUser(user.id, { name: e.target.value })}
                                className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-cp-xs text-cp-text hover:border-cp-border focus:border-cp-surface-5 focus:bg-cp-surface-3 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              {deviceType
                                ? <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">{deviceType}</span>
                                : <span className="text-[10px] text-cp-text-muted">—</span>}
                            </td>
                            <td className="px-2 py-1">
                              {intercomEquipment.length > 0 ? (
                                <select
                                  value={user.equipmentId ?? ''}
                                  onChange={(e) => updateUser(user.id, { equipmentId: e.target.value || undefined })}
                                  className="w-full rounded border border-cp-border-muted bg-cp-surface-3 px-1 py-0.5 text-[11px] text-cp-text-secondary hover:border-cp-surface-5 focus:outline-none">
                                  <option value="">{t('greengo.option.unassigned', '— nicht zugewiesen —')}</option>
                                  {intercomEquipment.map((eq) => (
                                    <option key={eq.id} value={eq.id}>{eq.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-[10px] text-cp-text-muted">{t('greengo.noIntercomCanvas', 'kein Intercom auf Canvas')}</span>
                              )}
                            </td>
                            {config.groups.map((group) => {
                              const active = user.groupIds.includes(group.id)
                              return (
                                <td key={group.id} className="px-2 py-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleUserGroup(user.id, group.id)}
                                    title={active
                                      ? t('greengo.toggle.removeTitle', '{user} aus „{group}" entfernen').replace('{user}', user.name).replace('{group}', group.name)
                                      : t('greengo.toggle.addTitle', '{user} zu „{group}" hinzufügen').replace('{user}', user.name).replace('{group}', group.name)}
                                    className={`h-7 w-7 rounded text-cp-base transition-colors ${
                                      active
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                        : 'bg-cp-surface-2 text-cp-text-dim hover:bg-cp-surface-4 hover:text-cp-text-secondary'
                                    }`}>
                                    {active ? '●' : '○'}
                                  </button>
                                </td>
                              )
                            })}
                            <td className="px-1 py-1 text-center">
                              <button type="button" onClick={() => removeUser(user.id)}
                                className="rounded px-1 py-0.5 text-[10px] text-cp-text-muted hover:bg-red-900/60 hover:text-red-300">×</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-cp-border bg-cp-surface-2/80">
                        <td colSpan={4} className="px-3 py-1.5 text-[10px] text-cp-text-muted">{t('greengo.members', 'Mitglieder')}</td>
                        {config.groups.map((group) => (
                          <td key={group.id} className="px-2 py-1.5 text-center text-[10px] font-bold text-emerald-400">
                            {config.users.filter((u) => u.groupIds.includes(group.id)).length}
                          </td>
                        ))}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {config.users.length > 0 && config.users.length < MAX_USERS && (
                <div className="mt-2">
                  <button type="button" onClick={addUser}
                    className="rounded border border-dashed border-cp-border px-3 py-1.5 text-cp-xs text-cp-text-faint hover:border-emerald-700 hover:text-emerald-400">
                    {t('greengo.addStationLong', '+ Station hinzufügen')}
                  </button>
                </div>
              )}

              {intercomEquipment.length > 0 && (
                <div className="mt-5">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wide text-cp-text-muted">{t('greengo.devicesOnCanvas', 'GreenGo-Geräte auf dem Canvas')}</div>
                  <div className="flex flex-wrap gap-2">
                    {intercomEquipment.map((eq) => {
                      const assignedTo = config.users.find((u) => u.equipmentId === eq.id)
                      return (
                        <div key={eq.id}
                          className={`rounded border px-2 py-1 text-[11px] ${
                            assignedTo
                              ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                              : 'border-cp-border bg-cp-surface-2/60 text-cp-text-muted'
                          }`}>
                          <span className="font-medium">{eq.name}</span>
                          {assignedTo
                            ? <span className="ml-1.5 text-[10px] text-cp-text-muted">→ {assignedTo.name}</span>
                            : <span className="ml-1.5 text-[10px] text-cp-text-muted">{t('greengo.unassigned', 'nicht zugewiesen')}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── USERS ── */}
          {activeTab === 'users' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-cp-xs text-cp-text-muted">
                  {t('greengo.users.intro', 'Bis zu {max} Stationen. Gruppen im Tab „Übersicht" per Klick zuweisen.').replace('{max}', String(MAX_USERS))}
                </span>
                <button
                  type="button"
                  onClick={addUser}
                  disabled={config.users.length >= MAX_USERS}
                  className="rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600 disabled:opacity-50"
                >
                  {t('greengo.addStation', '+ Station')}
                </button>
              </div>

              {config.users.length === 0 && (
                <div className="rounded border border-dashed border-cp-border p-6 text-center text-cp-xs text-cp-text-faint">
                  {t('greengo.users.empty', 'Noch keine Stationen. Klicke „+ Station" um zu beginnen.')}
                </div>
              )}

              <div className="space-y-2">
                {config.users.map((user) => (
                  <div
                    key={user.id}
                    className="rounded border border-cp-border bg-cp-surface-2/60 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="w-6 text-center text-[10px] font-bold text-cp-text-muted">
                        #{user.id}
                      </span>
                      <input
                        value={user.name}
                        onChange={(e) => updateUser(user.id, { name: e.target.value })}
                        placeholder={t('greengo.users.namePlaceholder', 'Stationsname (z.B. Regie)')}
                        className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
                      />
                      {intercomEquipment.length > 0 && (
                        <select
                          value={user.equipmentId ?? ''}
                          onChange={(e) =>
                            updateUser(user.id, { equipmentId: e.target.value || undefined })
                          }
                          className="w-44 rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
                          title={t('greengo.users.assignTitle', 'Gerät auf dem Canvas zuweisen')}
                        >
                          <option value="">{t('greengo.users.deviceShort', '— Gerät —')}</option>
                          {intercomEquipment.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => removeUser(user.id)}
                        className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
                      >
                        ×
                      </button>
                    </div>
                    {user.groupIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-8">
                        {user.groupIds.map((gid) => {
                          const g = config.groups.find((x) => x.id === gid)
                          return g ? (
                            <span key={gid} className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              {g.name}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── GROUPS ── */}
          {activeTab === 'groups' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-cp-xs text-cp-text-muted">
                  {t('greengo.groups.intro', 'Bis zu {max} Kommunikationsgruppen (Talk Groups).').replace('{max}', String(MAX_GROUPS))}
                </span>
                <button
                  type="button"
                  onClick={addGroup}
                  disabled={config.groups.length >= MAX_GROUPS}
                  className="rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600 disabled:opacity-50"
                >
                  {t('greengo.addGroup', '+ Gruppe')}
                </button>
              </div>

              {config.groups.length === 0 && (
                <div className="rounded border border-dashed border-cp-border p-6 text-center text-cp-xs text-cp-text-faint">
                  {t('greengo.groups.empty', 'Noch keine Gruppen. Klicke „+ Gruppe" um eine Talk Group anzulegen.')}
                </div>
              )}

              <div className="space-y-2">
                {config.groups.map((group) => {
                  const memberCount = config.users.filter((u) =>
                    u.groupIds.includes(group.id),
                  ).length
                  const memberNames = config.users
                    .filter((u) => u.groupIds.includes(group.id))
                    .map((u) => u.name)
                    .join(', ')
                  return (
                    <div
                      key={group.id}
                      className="rounded border border-cp-border bg-cp-surface-2/60 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center text-[10px] font-bold text-cp-text-muted">
                          #{group.id}
                        </span>
                        <input
                          value={group.name}
                          onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                          placeholder={t('greengo.groups.namePlaceholder', 'Gruppenname (z.B. CAM)')}
                          className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
                        />
                        <span className="text-[10px] text-cp-text-muted">
                          {memberCount} {t('greengo.members', 'Mitglieder')}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeGroup(group.id)}
                          className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
                        >
                          ×
                        </button>
                      </div>
                      {memberNames && (
                        <p className="mt-1 pl-8 text-[10px] text-cp-text-muted">{memberNames}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SYSTEM ── */}
          {activeTab === 'system' && (
            <div className="max-w-md space-y-3 text-cp-base">
              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('greengo.system.systemName', 'System-Name')}</span>
                <input
                  value={config.systemName}
                  onChange={(e) => setField('systemName', e.target.value)}
                  placeholder={t('greengo.system.systemNamePlaceholder', 'Produktion')}
                  className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('greengo.system.description', 'Beschreibung')}</span>
                <input
                  value={config.description ?? ''}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder={t('greengo.system.descriptionPlaceholder', 'optional')}
                  className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">
                  {t('greengo.system.multicast', 'Multicast-Adresse')}
                </span>
                <input
                  value={config.multicastAddress}
                  onChange={(e) => setField('multicastAddress', e.target.value)}
                  placeholder="239.1.160.1"
                  className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-cp-base"
                />
                <span className="mt-0.5 block text-[10px] text-cp-text-muted">
                  {t('greengo.system.multicastHint', 'Standard: 239.1.160.1 — muss im Netzwerk eindeutig sein.')}
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('greengo.system.sampleRate', 'Sample Rate')}</span>
                <select
                  value={config.sampleRate}
                  onChange={(e) =>
                    setField('sampleRate', Number(e.target.value) as 32000 | 48000)
                  }
                  className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
                >
                  <option value={32000}>{t('greengo.system.sampleRate32', '32000 Hz (Standard GreenGo)')}</option>
                  <option value={48000}>{t('greengo.system.sampleRate48', '48000 Hz')}</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-cp-border px-4 py-3">
          <span className="text-[11px] text-cp-text-muted">
            {config.users.length} {t('greengo.footer.stations', 'Stationen')} · {config.groups.length} {t('greengo.footer.groups', 'Gruppen')}
            {intercomEquipment.length > 0 && (
              <span className="ml-2 text-emerald-700">· {intercomEquipment.length} {t('greengo.footer.devicesOnCanvas', 'Geräte auf Canvas')}</span>
            )}
          </span>
          <div className="flex flex-wrap gap-2">
            {/* Hidden file inputs for .gg5 and .xlsx imports */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".gg5,.json"
              className="hidden"
              onChange={handleFileSelected}
            />
            <input
              ref={xlsxInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleXlsxSelected}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded border border-cp-surface-5 px-3 py-1.5 text-cp-xs text-cp-text-muted hover:border-emerald-700 hover:text-emerald-300"
              title={t('greengo.import.gg5Title', '.gg5 Datei importieren und mit Canvas-Geräten verknüpfen')}
            >
              <Icon icon={Upload} size="xs" className="mr-1 inline-block align-text-bottom" />{t('greengo.import.gg5', '.gg5 importieren')}
            </button>
            <button
              type="button"
              onClick={() => xlsxInputRef.current?.click()}
              className="rounded border border-cp-surface-5 px-3 py-1.5 text-cp-xs text-cp-text-muted hover:border-cyan-700 hover:text-cyan-300"
              title={t('greengo.import.xlsxTitle', 'Intercom-Matrix-Excel hochladen — die Users + Gruppen werden in die GreenGo-Konfiguration übernommen.')}
            >
              <Icon icon={FileSpreadsheet} size="xs" className="mr-1 inline-block align-text-bottom" />
              {t('greengo.import.xlsx', 'Excel-Matrix importieren')}
            </button>
            <button
              type="button"
              onClick={handleXlsxExport}
              className="rounded border border-cp-surface-5 px-3 py-1.5 text-cp-xs text-cp-text-muted hover:border-cyan-700 hover:text-cyan-300"
              title={t('greengo.export.xlsxTitle', 'Aktuelle GreenGo-Konfiguration als Intercom-Matrix-Excel herunterladen (für Druck / Weitergabe).')}
            >
              <Icon icon={FileSpreadsheet} size="xs" className="mr-1 inline-block align-text-bottom" />
              {t('greengo.export.xlsx', 'Excel-Matrix exportieren')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('greengo.saveProject', 'Im Projekt speichern')}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded bg-emerald-600 px-3 py-1.5 text-cp-xs hover:bg-emerald-500"
            >
              <Icon icon={Download} size="xs" className="mr-1 inline-block align-text-bottom" />{t('greengo.export.gg5', 'Als .gg5 exportieren')}
            </button>
          </div>
        </div>
      </div>

      {/* ══════ XLSX IMPORT TOAST (multi-line) ══════ */}
      {xlsxImportNotice && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 max-w-lg rounded border border-cyan-700 bg-cyan-950 px-4 py-3 text-cp-xs text-cyan-100 shadow-lg">
          <pre className="whitespace-pre-wrap font-sans">{xlsxImportNotice}</pre>
          <button
            type="button"
            onClick={() => setXlsxImportNotice(null)}
            className="mt-2 rounded bg-cyan-800 px-2 py-1 text-[11px] text-white hover:bg-cyan-700"
          >
            OK
          </button>
        </div>
      )}

      {/* ══════ IMPORT ERROR TOAST ══════ */}
      {importError && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded border border-red-700 bg-red-950 px-4 py-2 text-cp-xs text-red-300 shadow-lg">
          {importError}
          <button type="button" onClick={() => setImportError(null)} className="ml-3 text-red-500 hover:text-red-300">×</button>
        </div>
      )}

      {/* ══════ IMPORT MAPPING OVERLAY ══════ */}
      {importResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded border border-emerald-700 bg-cp-surface-1 text-cp-text shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-cp-border px-4 py-3">
              <div>
                <h3 className="text-cp-base font-semibold text-emerald-300">
                  {t('greengo.importOverlay.title', '.gg5 importieren — Geräte verknüpfen')}
                </h3>
                <p className="text-[11px] text-cp-text-muted">
                  {t('greengo.importOverlay.system', 'System:')} <span className="text-cp-text-bright">{importResult.config.systemName}</span>
                  {importResult.config.multicastAddress && (
                    <span className="ml-2 font-mono text-cp-text-faint">{importResult.config.multicastAddress}</span>
                  )}
                </p>
              </div>
              <button type="button" onClick={cancelImport}
                aria-label={t('common.close', 'Schließen')}
                className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"><Icon icon={X} size="sm" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Groups summary */}
              {importResult.config.groups.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] uppercase tracking-wide text-cp-text-muted">
                    {t('greengo.importOverlay.importedGroups', 'Importierte Gruppen')} ({importResult.config.groups.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {importResult.config.groups.map((g) => (
                      <span key={g.id} className="rounded bg-emerald-900/50 px-2 py-0.5 text-[11px] text-emerald-300">
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* User → Equipment mapping table */}
              <div>
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-cp-text-muted">
                  {t('greengo.importOverlay.linkStations', 'Stationen → Canvas-Geräte verknüpfen')} ({importResult.config.users.length})
                </div>
                <p className="mb-2 text-[11px] text-cp-text-muted">
                  {t('greengo.importOverlay.linkHint', 'Wähle für jede importierte Station das entsprechende Gerät auf dem Canvas. Automatisch erkannte Zuordnungen sind vorausgefüllt.')}
                </p>
                <table className="w-full border-collapse text-cp-xs">
                  <thead>
                    <tr className="bg-cp-surface-2">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.importOverlay.col.nameFromGg5', 'Name (aus .gg5)')}</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.col.type', 'Typ')}</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.importOverlay.col.groups', 'Gruppen')}</th>
                      <th className="min-w-[180px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-emerald-400">{t('greengo.importOverlay.col.deviceCanvas', 'Gerät auf Canvas')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.config.users.map((user, idx) => {
                      const typeHint = importResult.userTypeHints.get(user.id) || detectDeviceType(user.name)
                      const assignedId = importMappings.get(user.id) ?? ''
                      const userGroups = user.groupIds
                        .map((gid) => importResult.config.groups.find((g) => g.id === gid)?.name)
                        .filter(Boolean)
                      return (
                        <tr key={user.id}
                          className={`border-t border-cp-border-muted ${idx % 2 === 0 ? 'bg-cp-surface-1' : 'bg-cp-surface-2/30'}`}>
                          <td className="px-3 py-2 font-medium text-cp-text-bright">{user.name}</td>
                          <td className="px-3 py-2">
                            {typeHint
                              ? <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">{typeHint}</span>
                              : <span className="text-cp-text-dim">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {userGroups.length > 0
                              ? <span className="text-[10px] text-cp-text-muted">{userGroups.join(', ')}</span>
                              : <span className="text-[10px] text-cp-text-muted">{t('greengo.importOverlay.noGroups', 'keine')}</span>}
                          </td>
                          <td className="px-3 py-2">
                            {intercomEquipment.length > 0 ? (
                              <select
                                value={assignedId}
                                onChange={(e) => {
                                  const next = new Map(importMappings)
                                  if (e.target.value) next.set(user.id, e.target.value)
                                  else next.delete(user.id)
                                  setImportMappings(next)
                                }}
                                className={`w-full rounded border px-1.5 py-1 text-[11px] focus:outline-none ${
                                  assignedId
                                    ? 'border-emerald-800 bg-emerald-950/40 text-emerald-200'
                                    : 'border-cp-border bg-cp-surface-3 text-cp-text-muted'
                                }`}>
                                <option value="">{t('greengo.importOverlay.dontLink', '— nicht verknüpfen —')}</option>
                                {intercomEquipment.map((eq) => (
                                  <option key={eq.id} value={eq.id}>{eq.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[10px] text-cp-text-muted">{t('greengo.importOverlay.noIntercomCanvas', 'Kein Intercom auf Canvas')}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-cp-border px-4 py-3">
              <span className="text-[11px] text-cp-text-muted">
                {t('greengo.importOverlay.linkedCount', '{linked} von {total} Stationen verknüpft').replace('{linked}', String(importMappings.size)).replace('{total}', String(importResult.config.users.length))}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={cancelImport}
                  className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5">
                  {t('greengo.importOverlay.cancel', 'Abbrechen')}
                </button>
                <button type="button" onClick={applyImport}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium hover:bg-emerald-500">
                  {t('greengo.importOverlay.apply', 'Übernehmen →')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
