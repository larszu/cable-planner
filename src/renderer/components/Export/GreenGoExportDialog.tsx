import { useRef, useState } from 'react'
import { ArrowRight, Download, Upload, X, FileSpreadsheet } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useProjectStore } from '../../store/projectStore'
import type { GreenGoConfig, GreenGoGroup, GreenGoUser } from '../../types/greengo'
import { defaultGreenGoConfig } from '../../types/greengo'
import { buildGg5File } from '../../lib/exportGreengo'
import { greengoFromPlan } from '../../lib/intercomPlan'
import { withGroupIds } from '../../lib/greengoKeys'
import {
  fromIntercomExchange,
  parseIntercomExchange,
  serializeIntercomExchange,
  toIntercomExchange,
} from '../../lib/intercomExchange'
import {
  autoMatchEquipment,
  detectDeviceType,
  isParseError,
  parseGg5File,
  type EquipmentMatchReport,
  type Gg5ImportResult,
} from '../../lib/importGreengo'
import {
  exportIntercomMatrixXlsx,
  parseIntercomMatrixXlsx,
} from '../../lib/intercomMatrixXlsx'
import { downloadBlob } from '../../lib/downloadBlob'
import { exportDeviceConfig } from '../../lib/deviceConfigExport'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { useTranslation, format } from '../../lib/i18n'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'

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
  // DER DIALOG SPRICHT GREEN-GO, das Projekt fuehrt den neutralen Slot
  // (E-2). Die Projektion entsteht EINMAL beim Oeffnen — der Dialog arbeitet
  // danach auf seiner eigenen Kopie und schreibt beim Speichern zurueck, wo
  // sie wieder in den Slot uebersetzt wird. Bei jedem Render zu projizieren
  // waere dieselbe Defektform, die `MobileShareDialog` in seinem Kommentar
  // beschreibt: ein Selektor mit neuer Identitaet je Aufruf.
  const slot = useProjectStore((s) => s.project.intercom)
  const updateGreenGoConfig = useProjectStore((s) => s.updateGreenGoConfig)

  const [config, setConfig] = useState<GreenGoConfig>(
    () => (slot ? greengoFromPlan(slot) : defaultGreenGoConfig()),
  )

  const [activeTab, setActiveTab] = useState<'matrix' | 'users' | 'groups' | 'system'>('matrix')

  // ── import state ──────────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null)
  const xlsxInputRef = useRef<HTMLInputElement>(null)
  const neutralInputRef = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<Gg5ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [xlsxImportNotice, setXlsxImportNotice] = useState<string | null>(null)
  /** userId → canvas equipmentId mapping chosen by the user in the import overlay */
  const [importMappings, setImportMappings] = useState<Map<number, string>>(new Map())
  /** ADR-005 — was der Abgleich behalten und was er neu geraten hat. */
  const [matchReport, setMatchReport] = useState<EquipmentMatchReport | null>(null)

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
        // ADR-005, Regel 2 — die .gg5 sagt nichts ueber Canvas-Geraete, also
        // darf sie die von Hand gesetzten Zuordnungen nicht loeschen. Der
        // vorhandene Stand geht mit hinein.
        const match = autoMatchEquipment(result.config.users, intercomEquipment, config.users)
        setImportMappings(match.mapping)
        setMatchReport(match)
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
    // ENTSCHEIDUNG "Editor UND Generator": das Roh-Dokument wandert mit in
    // den Plan. Der naechste Export schreibt hinein, statt neu zu bauen —
    // Raeume, Templates, Geraete-Registrierungen und die Anlagen-Passwoerter
    // bleiben damit erhalten.
    setConfig({ ...importResult.config, users, basePreset: importResult.raw })
    setActiveTab('matrix')
    setImportResult(null)
    setImportError(null)
    setMatchReport(null)
  }

  const cancelImport = () => {
    setImportResult(null)
    setImportError(null)
    setMatchReport(null)
  }

  // ── XLSX intercom-matrix round-trip ───────────────────────────────────────

  const handleXlsxSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const buffer = ev.target?.result
      if (!(buffer instanceof ArrayBuffer)) {
        setImportError(t('greengo.importXlsxBinaryError', 'Could not read XLSX as binary data.'))
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
          t('greengo.import.usersAndGroups', '{users} users · {groups} groups imported from Excel.'),
          { users: result.config.users.length, groups: result.config.groups.length },
        ),
      )
      if (result.directTalkPairs.length > 0) {
        lines.push(
          format(
            t(
              'greengo.import.directIgnored',
              '{n} direct lines (user↔user) ignored — GreenGo stores memberships, not 1:1 routes.',
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
              '{n} equipment marks are audit-only — assign the beltpacks on the canvas.',
            ),
            { n: result.equipmentMarks.length },
          ),
        )
      }
      for (const w of result.warnings) lines.push(`⚠ ${w}`)
      setXlsxImportNotice(lines.join('\n'))
      setImportError(null)
    }
    reader.onerror = () => setImportError(t('greengo.import.readError', 'XLSX could not be read.'))
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
      name: t('greengo.defaultUserName', 'User {n}').replace('{n}', String(nextId)),
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
    // Ueber `withGroupIds`, damit die Taste einer abgewaehlten Gruppe
    // mitgeht — sonst stuende sie in der Oberflaeche nicht mehr und auf dem
    // Beltpack doch.
    setConfig((c) => ({
      ...c,
      users: c.users.map((u) => (u.id === userId ? withGroupIds(u, groupIds) : u)),
    }))
  }

  // ── group helpers ─────────────────────────────────────────────────────────

  const addGroup = () => {
    if (config.groups.length >= MAX_GROUPS) return
    const nextId = Math.max(0, ...config.groups.map((g) => g.id)) + 1
    const newGroup: GreenGoGroup = {
      id: nextId,
      name: t('greengo.defaultGroupName', 'Group {n}').replace('{n}', String(nextId)),
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
      users: c.users.map((u) => withGroupIds(u, u.groupIds.filter((gid) => gid !== id))),
    }))

  // ── export ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    updateGreenGoConfig(config)
  }

  /**
   * ADR-005, Regel 4 — der Export verspricht im Modulkopf eine Datei, die
   * „directly into the GreenGo Manager software (v5.x)" laedt. Fuer die
   * leere Konfiguration stimmt das nachweislich nicht: `buildGg5File`
   * schreibt dann eine .gg5, die der EIGENE Importer des Cable-Planners
   * ablehnt („No users or groups found in the file. Is this a valid GreenGo
   * 5.x .gg5 file?"). Eine Station ODER eine Gruppe reicht; erst beides leer
   * bricht es.
   *
   * Statt eine Datei auszugeben, die wir selbst nicht wieder einlesen
   * koennen, bleibt der Knopf aus und sagt warum.
   */
  const exportBlocked = config.users.length === 0 && config.groups.length === 0

  const handleExport = () => {
    if (exportBlocked) return
    updateGreenGoConfig(config)
    // v7.9.116 — Einheitlicher Stempel, gg5-Endung beibehalten.
    // BEDARF 43 — mit Herkunfts-Blatt. Die .gg5 traegt die Version des
    // HERSTELLER-Formats (`fileCreatedVersion`), aber nichts ueber den Plan,
    // aus dem sie stammt.
    exportDeviceConfig(
      'Green-GO',
      'Intercom-Konfiguration',
      buildExportFilenameWithSuffix(config.systemName || 'GreenGo', 'config', 'gg5'),
      buildGg5File(config),
      'application/json;charset=utf-8',
    )
  }

  // ── Herstellerneutraler Austausch (B-8) ───────────────────────────────────
  //
  // Der .gg5-Export bleibt der Weg IN die Anlage. Dieser hier ist der Weg aus
  // dem Haus: eine Datei, die auch jemand lesen kann, der Riedel oder
  // Clear-Com aufbaut. Beide Knoepfe stehen bewusst nebeneinander -- ein
  // Format, das nur im Code existiert, ist kein Austauschformat.
  const handleNeutralExport = () => {
    if (exportBlocked) return
    updateGreenGoConfig(config)
    const file = toIntercomExchange(config, { exportedAt: new Date().toISOString() })
    downloadFile(
      buildExportFilenameWithSuffix(config.systemName || 'Intercom', 'neutral', 'json'),
      serializeIntercomExchange(file),
    )
  }

  const handleNeutralSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const gelesen = parseIntercomExchange((ev.target?.result as string) ?? '')
      if (!gelesen) {
        setImportError(
          t(
            'intercom.import.invalid',
            'Not a valid vendor-neutral intercom file (avplan-intercom) — or it comes from a newer version.',
          ),
        )
        return
      }
      setImportError(null)
      // Bewusst ohne Geraete-Zuordnung: die neutrale Datei kennt
      // `equipmentId` nur, wenn sie aus DIESEM Plan stammt. Was sie mitbringt,
      // uebernimmt `fromIntercomExchange`; was sie nicht hat, wird nicht
      // geraten.
      setConfig(fromIntercomExchange(gelesen))
      setXlsxImportNotice(
        t('intercom.import.done', '{n} stations and {g} conferences imported.')
          .replace('{n}', String(gelesen.stations.length))
          .replace('{g}', String(gelesen.channels.length)),
      )
    }
    reader.readAsText(file)
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

  // Phase 3 der UI-Pruefung.
  //
  // ESCAPE BRICHT DAS INNERSTE AB, NICHT DAS GANZE. Liegt eine Import-
  // Zuordnung offen, nimmt Escape sie zurueck (`cancelImport`) statt den
  // Dialog zu schliessen — sonst waere eine Taste, die man reflexhaft
  // drueckt, der schnellste Weg, eine halb fertige Zuordnung zu verlieren.
  //
  // Der Haken haengt am AEUSSEREN Kasten, weil die Zuordnungs-Ueberlagerung
  // ein Geschwister des Hauptfeldes IN diesem Kasten ist. Damit umschliesst
  // die Fokus-Falle beide. Dass der Fokus bei offener Ueberlagerung noch
  // hinter sie greifen kann, bleibt so — eine verschachtelte zweite Falle
  // waere hier mehr Mechanik als Gewinn, und heute gibt es gar keine.
  const { panelRef, dialogProps } = useDialogA11y(true, () => {
    if (importResult) cancelImport()
    else onClose()
  })

  // Und der Import-Ueberlagerung: sie haelt ein ZUORDNUNGS-Ergebnis, das
  // erst beim Uebernehmen wirkt — deshalb mit Rueckfrage.
  const importBackdrop = useBackdropClose(() => setImportResult(null), {
    schutz: () => true,
    frage: t('greengo.importOverlay.close', 'Discard import?'),
  })
  // B-44 — der Hintergrund schliesst, aus derselben Quelle wie ueberall.
  const backdrop = useBackdropClose(onClose)

  return (
    <div
      {...backdrop}
      ref={panelRef}
      aria-label={t('greengo.title', 'GreenGo Intercom planning')}
      {...dialogProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded border border-emerald-700 bg-cp-surface-1 text-cp-text">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-3">
          <div>
            <h3 className="text-cp-xl font-semibold text-emerald-300">{t('greengo.title', 'GreenGo Intercom planning')}</h3>
            <p className="text-cp-xs text-cp-text-muted">{config.systemName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
            aria-label={t('common.close', 'Close')}
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cp-border text-cp-xs">
          {([
            ['matrix',  t('greengo.tab.matrix', 'Overview')],
            ['users',   `${t('greengo.tab.users', 'Stations')} (${config.users.length})`],
            ['groups',  `${t('greengo.tab.groups', 'Groups')} (${config.groups.length})`],
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
                    ? t('greengo.matrix.emptyBoth', 'No stations or groups yet — switch to the "Stations" and "Groups" tabs.')
                    : config.users.length === 0
                      ? t('greengo.matrix.emptyUsers', 'No stations yet — switch to the "Stations" tab.')
                      : t('greengo.matrix.emptyGroups', 'No groups yet — switch to the "Groups" tab.')}
                </div>
              )}

              {config.users.length > 0 && config.groups.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-cp-xs">
                    <thead>
                      <tr className="bg-cp-surface-2">
                        <th className="w-8 px-2 py-2 text-left text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">#</th>
                        <th className="min-w-[130px] px-3 py-2 text-left text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.col.station', 'Station')}</th>
                        <th className="min-w-[70px] px-3 py-2 text-left text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.col.type', 'Type')}</th>
                        <th className="min-w-[160px] px-3 py-2 text-left text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.col.deviceCanvas', 'Device (canvas)')}</th>
                        {config.groups.map((group) => (
                          <th key={group.id} className="px-2 py-2 text-center text-cp-xs font-semibold uppercase tracking-wide text-emerald-400 whitespace-nowrap">
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
                            <td className="px-2 py-1.5 text-center text-cp-xs text-cp-text-muted font-mono">{user.id}</td>
                            <td className="px-2 py-1">
                              <input
                                value={user.name}
                                onChange={(e) => updateUser(user.id, { name: e.target.value })}
                                className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-cp-xs text-cp-text hover:border-cp-border focus:border-cp-surface-5 focus:bg-cp-surface-3 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              {deviceType
                                ? <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-cp-xs font-mono text-emerald-300">{deviceType}</span>
                                : <span className="text-cp-xs text-cp-text-muted">—</span>}
                            </td>
                            <td className="px-2 py-1">
                              {intercomEquipment.length > 0 ? (
                                <select
                                  value={user.equipmentId ?? ''}
                                  onChange={(e) => updateUser(user.id, { equipmentId: e.target.value || undefined })}
                                  className="w-full rounded border border-cp-border-muted bg-cp-surface-3 px-1 py-0.5 text-cp-xs text-cp-text-secondary hover:border-cp-surface-5 focus:outline-none">
                                  <option value="">{t('greengo.option.unassigned', '— unassigned —')}</option>
                                  {intercomEquipment.map((eq) => (
                                    <option key={eq.id} value={eq.id}>{eq.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-cp-xs text-cp-text-muted">{t('greengo.noIntercomCanvas', 'no intercom on canvas')}</span>
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
                                      ? t('greengo.toggle.removeTitle', 'Remove {user} from "{group}"').replace('{user}', user.name).replace('{group}', group.name)
                                      : t('greengo.toggle.addTitle', 'Add {user} to "{group}"').replace('{user}', user.name).replace('{group}', group.name)}
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
                                className="rounded px-1 py-0.5 text-cp-xs text-cp-text-muted hover:bg-red-900/60 hover:text-red-300">×</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-cp-border bg-cp-surface-2/80">
                        <td colSpan={4} className="px-3 py-1.5 text-cp-xs text-cp-text-muted">{t('greengo.members', 'Members')}</td>
                        {config.groups.map((group) => (
                          <td key={group.id} className="px-2 py-1.5 text-center text-cp-xs font-bold text-emerald-400">
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
                    {t('greengo.addStationLong', '+ Add station')}
                  </button>
                </div>
              )}

              {intercomEquipment.length > 0 && (
                <div className="mt-5">
                  <div className="mb-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">{t('greengo.devicesOnCanvas', 'GreenGo devices on the canvas')}</div>
                  <div className="flex flex-wrap gap-2">
                    {intercomEquipment.map((eq) => {
                      const assignedTo = config.users.find((u) => u.equipmentId === eq.id)
                      return (
                        <div key={eq.id}
                          className={`rounded border px-2 py-1 text-cp-xs ${
                            assignedTo
                              ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                              : 'border-cp-border bg-cp-surface-2/60 text-cp-text-muted'
                          }`}>
                          <span className="font-medium">{eq.name}</span>
                          {assignedTo
                            ? <span className="ml-1.5 text-cp-xs text-cp-text-muted">→ {assignedTo.name}</span>
                            : <span className="ml-1.5 text-cp-xs text-cp-text-muted">{t('greengo.unassigned', 'unassigned')}</span>}
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
                  {t('greengo.users.intro', 'Up to {max} stations. Assign groups via clicks in the "Overview" tab.').replace('{max}', String(MAX_USERS))}
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
                  {t('greengo.users.empty', 'No stations yet. Click "+ Station" to begin.')}
                </div>
              )}

              <div className="space-y-2">
                {config.users.map((user) => (
                  <div
                    key={user.id}
                    className="rounded border border-cp-border bg-cp-surface-2/60 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="w-6 text-center text-cp-xs font-bold text-cp-text-muted">
                        #{user.id}
                      </span>
                      <input
                        value={user.name}
                        onChange={(e) => updateUser(user.id, { name: e.target.value })}
                        placeholder={t('greengo.users.namePlaceholder', 'Station name (e.g. control room)')}
                        className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
                      />
                      {intercomEquipment.length > 0 && (
                        <select
                          value={user.equipmentId ?? ''}
                          onChange={(e) =>
                            updateUser(user.id, { equipmentId: e.target.value || undefined })
                          }
                          className="w-44 rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
                          title={t('greengo.users.assignTitle', 'Assign device on the canvas')}
                        >
                          <option value="">{t('greengo.users.deviceShort', '— Device —')}</option>
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
                        className="rounded bg-red-900/60 px-2 py-1 text-cp-xs hover:bg-red-800"
                      >
                        ×
                      </button>
                    </div>
                    {user.groupIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-8">
                        {user.groupIds.map((gid) => {
                          const g = config.groups.find((x) => x.id === gid)
                          return g ? (
                            <span key={gid} className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-cp-xs text-emerald-300">
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
                  {t('greengo.groups.intro', 'Up to {max} talk groups.').replace('{max}', String(MAX_GROUPS))}
                </span>
                <button
                  type="button"
                  onClick={addGroup}
                  disabled={config.groups.length >= MAX_GROUPS}
                  className="rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600 disabled:opacity-50"
                >
                  {t('greengo.addGroup', '+ Group')}
                </button>
              </div>

              {config.groups.length === 0 && (
                <div className="rounded border border-dashed border-cp-border p-6 text-center text-cp-xs text-cp-text-faint">
                  {t('greengo.groups.empty', 'No groups yet. Click "+ Group" to create a talk group.')}
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
                        <span className="w-6 text-center text-cp-xs font-bold text-cp-text-muted">
                          #{group.id}
                        </span>
                        <input
                          value={group.name}
                          onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                          placeholder={t('greengo.groups.namePlaceholder', 'Group name (e.g. CAM)')}
                          className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
                        />
                        <span className="text-cp-xs text-cp-text-muted">
                          {memberCount} {t('greengo.members', 'Members')}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeGroup(group.id)}
                          className="rounded bg-red-900/60 px-2 py-1 text-cp-xs hover:bg-red-800"
                        >
                          ×
                        </button>
                      </div>
                      {memberNames && (
                        <p className="mt-1 pl-8 text-cp-xs text-cp-text-muted">{memberNames}</p>
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
                <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('greengo.system.systemName', 'System name')}</span>
                <input
                  value={config.systemName}
                  onChange={(e) => setField('systemName', e.target.value)}
                  placeholder={t('greengo.system.systemNamePlaceholder', 'Production')}
                  className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('greengo.system.description', 'Description')}</span>
                <input
                  value={config.description ?? ''}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder={t('greengo.system.descriptionPlaceholder', 'optional')}
                  className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">
                  {t('greengo.system.multicast', 'Multicast address')}
                </span>
                <input
                  value={config.multicastAddress}
                  onChange={(e) => setField('multicastAddress', e.target.value)}
                  placeholder="239.1.160.1"
                  className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-cp-base"
                />
                <span className="mt-0.5 block text-cp-xs text-cp-text-muted">
                  {t('greengo.system.multicastHint', 'Default: 239.1.160.1 — must be unique on the network.')}
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('greengo.system.sampleRate', 'Sample rate')}</span>
                <select
                  value={config.sampleRate}
                  onChange={(e) =>
                    setField('sampleRate', Number(e.target.value) as 32000 | 48000)
                  }
                  className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
                >
                  <option value={32000}>{t('greengo.system.sampleRate32', '32000 Hz (GreenGo default)')}</option>
                  <option value={48000}>{t('greengo.system.sampleRate48', '48000 Hz')}</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-cp-border px-4 py-3">
          <span className="text-cp-xs text-cp-text-muted">
            {config.users.length} {t('greengo.footer.stations', 'stations')} · {config.groups.length} {t('greengo.footer.groups', 'groups')}
            {intercomEquipment.length > 0 && (
              <span className="ml-2 text-emerald-700">· {intercomEquipment.length} {t('greengo.footer.devicesOnCanvas', 'devices on canvas')}</span>
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
              title={t('greengo.import.gg5Title', 'Import .gg5 file and link to canvas devices')}
            >
              <Icon icon={Upload} size="xs" className="mr-1 inline-block align-text-bottom" />{t('greengo.import.gg5', 'Import .gg5')}
            </button>
            <button
              type="button"
              onClick={() => xlsxInputRef.current?.click()}
              className="rounded border border-cp-surface-5 px-3 py-1.5 text-cp-xs text-cp-text-muted hover:border-cyan-700 hover:text-cyan-300"
              title={t('greengo.import.xlsxTitle', 'Upload intercom-matrix Excel — users + groups will be merged into the GreenGo configuration.')}
            >
              <Icon icon={FileSpreadsheet} size="xs" className="mr-1 inline-block align-text-bottom" />
              {t('greengo.import.xlsx', 'Import Excel matrix')}
            </button>
            <input
              ref={neutralInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleNeutralSelected}
            />
            <button
              type="button"
              onClick={() => neutralInputRef.current?.click()}
              className="rounded border border-cp-surface-5 px-3 py-1.5 text-cp-xs text-cp-text-muted hover:border-violet-700 hover:text-violet-300"
              title={t('intercom.import.title', 'Import a vendor-neutral intercom file (avplan-intercom).')}
            >
              <Icon icon={Upload} size="xs" className="mr-1 inline-block align-text-bottom" />
              {t('intercom.import.button', 'Import neutral')}
            </button>
            <button
              type="button"
              onClick={handleNeutralExport}
              disabled={exportBlocked}
              title={
                exportBlocked
                  ? t('greengo.export.blocked', 'Without at least one station or group there is no valid .gg5 — create one first.')
                  : t('intercom.export.title', 'Vendor-neutral intercom file — stations, conferences and who talks/listens, readable outside GreenGo too.')
              }
              className="rounded border border-cp-surface-5 px-3 py-1.5 text-cp-xs text-cp-text-muted hover:border-violet-700 hover:text-violet-300 disabled:cursor-not-allowed disabled:text-cp-text-muted"
            >
              {t('intercom.export.button', 'Export neutral')}
            </button>
            <button
              type="button"
              onClick={handleXlsxExport}
              className="rounded border border-cp-surface-5 px-3 py-1.5 text-cp-xs text-cp-text-muted hover:border-cyan-700 hover:text-cyan-300"
              title={t('greengo.export.xlsxTitle', 'Download current GreenGo configuration as an intercom-matrix Excel (for print / hand-off).')}
            >
              <Icon icon={FileSpreadsheet} size="xs" className="mr-1 inline-block align-text-bottom" />
              {t('greengo.export.xlsx', 'Export Excel matrix')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('greengo.saveProject', 'Save in project')}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportBlocked}
              title={
                exportBlocked
                  ? t(
                      'greengo.export.blocked',
                      'Without at least one station or group there is no valid .gg5 — create one first.',
                    )
                  : undefined
              }
              className="rounded bg-emerald-600 px-3 py-1.5 text-cp-xs hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-cp-surface-4 disabled:text-cp-text-muted disabled:hover:bg-cp-surface-4"
            >
              <Icon icon={Download} size="xs" className="mr-1 inline-block align-text-bottom" />{t('greengo.export.gg5', 'Export as .gg5')}
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
            className="mt-2 rounded bg-cyan-800 px-2 py-1 text-cp-xs text-white hover:bg-cyan-700"
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
        <div
          {...importBackdrop}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
        >
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded border border-emerald-700 bg-cp-surface-1 text-cp-text shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-cp-border px-4 py-3">
              <div>
                <h3 className="text-cp-base font-semibold text-emerald-300">
                  {t('greengo.importOverlay.title', 'Import .gg5 — link devices')}
                </h3>
                <p className="text-cp-xs text-cp-text-muted">
                  {t('greengo.importOverlay.system', 'System:')} <span className="text-cp-text-bright">{importResult.config.systemName}</span>
                  {importResult.config.multicastAddress && (
                    <span className="ml-2 font-mono text-cp-text-faint">{importResult.config.multicastAddress}</span>
                  )}
                </p>
              </div>
              <button type="button" onClick={cancelImport}
                aria-label={t('common.close', 'Close')}
                className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"><Icon icon={X} size="sm" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* ADR-005 — was die Datei mitbringt und dieser Import nicht liest.
                  Der Export schreibt diese Sektionen aus Defaults; wer eine echte
                  Anlagen-Konfiguration hier durchreicht, bekommt sie leer zurueck.
                  Bis der Round-Trip sie bewahrt, sagt er es wenigstens. */}
              {(importResult.unreadSections.length > 0 ||
                importResult.unreadFields.length > 0) && (
                <div className="rounded border border-cp-warn/50 bg-cp-warn/10 p-3">
                  <div className="mb-1 text-cp-xs font-semibold text-cp-warn">
                    {t(
                      'greengo.importOverlay.unreadTitle',
                      'This file contains sections the import does not read',
                    )}
                  </div>
                  {importResult.unreadSections.length > 0 && (
                    <div className="font-mono text-cp-xs text-cp-text-secondary">
                      {importResult.unreadSections.join(', ')}
                    </div>
                  )}
                  {/* ADR-005, Inkrement 4 — die Zeile darueber nannte nur
                      TOP-LEVEL-Sektionen. Weil Settings/Users/Groups als
                      „gelesen" gelten, konnte sie nie sagen, dass INNERHALB
                      davon das meiste liegen bleibt: die Hardware-Registrierung
                      der Beltpacks, die Tastenbelegungen, Pincodes, die
                      eingemessenen Gains. Der Nutzer las „Devices, Rooms,
                      Templates" und schloss, seine Stationen seien uebernommen. */}
                  {importResult.unreadFields.map((u) => (
                    <div key={u.section} className="mt-1 text-cp-xs text-cp-text-secondary">
                      <span className="font-semibold">{u.section}</span>
                      {u.section === 'Settings'
                        ? ''
                        : format(
                            t('greengo.importOverlay.unreadEntries', ' ({count} entries)'),
                            { count: u.entries },
                          )}
                      {': '}
                      <span className="font-mono">{u.fields.join(', ')}</span>
                    </div>
                  ))}
                  <div className="mt-1.5 text-cp-xs text-cp-text-muted">
                    {t(
                      'greengo.importOverlay.unreadHint',
                      'Cable Planner does not read these sections and fields — when you export from the loaded file they travel through unchanged. Only without a loaded file are they regenerated with defaults. The export never replaces the original file, but keep it anyway.',
                    )}
                  </div>
                </div>
              )}

              {/* ADR-005, Regel 2 und 3 — die Zuordnung Station → Canvas-Geraet
                  steht NICHT in der .gg5; sie ist Wissen dieses Projekts. Der
                  Import hat sie frueher jedes Mal neu geraten und die von Hand
                  gesetzten Verknuepfungen ueberschrieben. Jetzt bleiben sie,
                  wo Slot und Name gleich sind — und der Nutzer sieht, was
                  uebernommen und was geraten wurde. */}
              {matchReport &&
                (matchReport.kept.length > 0 ||
                  matchReport.renamed.length > 0 ||
                  matchReport.stale.length > 0) && (
                  <div className="rounded border border-cp-border bg-cp-surface-2 p-3">
                    <div className="mb-1 text-cp-xs font-semibold text-cp-text-bright">
                      {t(
                        'greengo.importOverlay.matchTitle',
                        'Mapping to canvas devices',
                      )}
                    </div>
                    {matchReport.kept.length > 0 && (
                      <div className="text-cp-xs text-cp-text-secondary">
                        {format(
                          t(
                            'greengo.importOverlay.matchKept',
                            '{count} hand-set mappings are preserved (slot {slots}).',
                          ),
                          { count: matchReport.kept.length, slots: matchReport.kept.join(', ') },
                        )}
                      </div>
                    )}
                    {matchReport.renamed.length > 0 && (
                      <div className="mt-1 text-cp-xs text-cp-warn">
                        {format(
                          t(
                            'greengo.importOverlay.matchRenamed',
                            'Slot {slots}: the station has a different name in the file — the mapping was guessed again.',
                          ),
                          { slots: matchReport.renamed.join(', ') },
                        )}
                      </div>
                    )}
                    {matchReport.stale.length > 0 && (
                      <div className="mt-1 text-cp-xs text-cp-warn">
                        {format(
                          t(
                            'greengo.importOverlay.matchStale',
                            'Slot {slots}: the previously mapped device is no longer in the plan — guessed again.',
                          ),
                          { slots: matchReport.stale.join(', ') },
                        )}
                      </div>
                    )}
                    <div className="mt-1.5 text-cp-xs text-cp-text-muted">
                      {t(
                        'greengo.importOverlay.matchHint',
                        'Guessed mappings can be corrected per station below before the import is applied.',
                      )}
                    </div>
                  </div>
                )}

              {/* Groups summary */}
              {importResult.config.groups.length > 0 && (
                <div>
                  <div className="mb-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">
                    {t('greengo.importOverlay.importedGroups', 'Imported groups')} ({importResult.config.groups.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {importResult.config.groups.map((g) => (
                      <span key={g.id} className="rounded bg-emerald-900/50 px-2 py-0.5 text-cp-xs text-emerald-300">
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* User → Equipment mapping table */}
              <div>
                <div className="mb-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">
                  {t('greengo.importOverlay.linkStations', 'Link stations → canvas devices')} ({importResult.config.users.length})
                </div>
                <p className="mb-2 text-cp-xs text-cp-text-muted">
                  {t('greengo.importOverlay.linkHint', 'Pick the matching canvas device for each imported station. Auto-detected matches are pre-filled.')}
                </p>
                <table className="w-full border-collapse text-cp-xs">
                  <thead>
                    <tr className="bg-cp-surface-2">
                      <th className="px-3 py-2 text-left text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.importOverlay.col.nameFromGg5', 'Name (from .gg5)')}</th>
                      <th className="px-3 py-2 text-left text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.col.type', 'Type')}</th>
                      <th className="px-3 py-2 text-left text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">{t('greengo.importOverlay.col.groups', 'Groups')}</th>
                      <th className="min-w-[180px] px-3 py-2 text-left text-cp-xs font-semibold uppercase tracking-wide text-emerald-400">{t('greengo.importOverlay.col.deviceCanvas', 'Device on canvas')}</th>
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
                              ? <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-cp-xs font-mono text-emerald-300">{typeHint}</span>
                              : <span className="text-cp-text-dim">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {userGroups.length > 0
                              ? <span className="text-cp-xs text-cp-text-muted">{userGroups.join(', ')}</span>
                              : <span className="text-cp-xs text-cp-text-muted">{t('greengo.importOverlay.noGroups', 'none')}</span>}
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
                                className={`w-full rounded border px-1.5 py-1 text-cp-xs focus:outline-none ${
                                  assignedId
                                    ? 'border-emerald-800 bg-emerald-950/40 text-emerald-200'
                                    : 'border-cp-border bg-cp-surface-3 text-cp-text-muted'
                                }`}>
                                <option value="">{t('greengo.importOverlay.dontLink', '— do not link —')}</option>
                                {intercomEquipment.map((eq) => (
                                  <option key={eq.id} value={eq.id}>{eq.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-cp-xs text-cp-text-muted">{t('greengo.importOverlay.noIntercomCanvas', 'No intercom on canvas')}</span>
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
              <span className="text-cp-xs text-cp-text-muted">
                {t('greengo.importOverlay.linkedCount', '{linked} of {total} stations linked').replace('{linked}', String(importMappings.size)).replace('{total}', String(importResult.config.users.length))}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={cancelImport}
                  className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5">
                  {t('greengo.importOverlay.cancel', 'Cancel')}
                </button>
                <button type="button" onClick={applyImport}
                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium hover:bg-emerald-500">
                  {t('greengo.importOverlay.apply', 'Apply')}
                  <Icon icon={ArrowRight} size="xs" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
