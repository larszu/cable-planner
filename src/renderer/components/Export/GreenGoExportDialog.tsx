import { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import type { GreenGoConfig, GreenGoGroup, GreenGoUser } from '../../types/greengo'
import { defaultGreenGoConfig } from '../../types/greengo'
import { buildGg5File } from '../../lib/exportGreengo'

interface Props {
  onClose: () => void
}

const downloadFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const MAX_USERS = 12
const MAX_GROUPS = 9

export const GreenGoExportDialog = ({ onClose }: Props) => {
  const equipment = useProjectStore((s) => s.project.equipment)
  const savedConfig = useProjectStore((s) => s.project.greengoConfig)
  const updateGreenGoConfig = useProjectStore((s) => s.updateGreenGoConfig)

  const [config, setConfig] = useState<GreenGoConfig>(
    () => savedConfig ?? defaultGreenGoConfig(),
  )

  const [activeTab, setActiveTab] = useState<'system' | 'users' | 'groups'>('users')

  // ── system helpers ────────────────────────────────────────────────────────

  const setField = <K extends keyof GreenGoConfig>(key: K, value: GreenGoConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  // ── user helpers ──────────────────────────────────────────────────────────

  const addUser = () => {
    if (config.users.length >= MAX_USERS) return
    const nextId = Math.max(0, ...config.users.map((u) => u.id)) + 1
    const newUser: GreenGoUser = { id: nextId, name: `Benutzer ${nextId}`, groupIds: [] }
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
    const newGroup: GreenGoGroup = { id: nextId, name: `Gruppe ${nextId}` }
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
    const safeName = (config.systemName || 'GreenGo').replace(/[^\w.-]+/g, '_')
    downloadFile(`${safeName}.gg5`, buildGg5File(config))
  }

  // ── GreenGo device filter (equipment with 'greengo' or 'intercom' in category/name) ──

  const intercomEquipment = equipment.filter((e) =>
    /greengo|intercom|beltpack|mcx|xtbb|xtbd|bpxsp|wbpx/i.test(e.name + ' ' + e.category),
  )

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded border border-emerald-700 bg-slate-900 text-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="text-base font-semibold text-emerald-300">
            🎙 GreenGo Intercom-Planung / .gg5 Export
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 text-xs">
          {(['users', 'groups', 'system'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-emerald-400 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'users' ? `Benutzer (${config.users.length})` : tab === 'groups' ? `Gruppen (${config.groups.length})` : 'System'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* ── USERS ── */}
          {activeTab === 'users' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Bis zu {MAX_USERS} Benutzer (Stationen / Rollen). Weise jeder Station eine oder mehrere Gruppen zu.
                </span>
                <button
                  type="button"
                  onClick={addUser}
                  disabled={config.users.length >= MAX_USERS}
                  className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600 disabled:opacity-40"
                >
                  + Benutzer
                </button>
              </div>

              {config.users.length === 0 && (
                <div className="rounded border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
                  Noch keine Benutzer. Klicke „+ Benutzer" um zu beginnen.
                </div>
              )}

              <div className="space-y-2">
                {config.users.map((user) => (
                  <div
                    key={user.id}
                    className="rounded border border-slate-700 bg-slate-800/60 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="w-6 text-center text-[10px] font-bold text-slate-500">
                        #{user.id}
                      </span>
                      <input
                        value={user.name}
                        onChange={(e) => updateUser(user.id, { name: e.target.value })}
                        placeholder="Stationsname (z.B. Regie)"
                        className="flex-1 rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
                      />
                      {intercomEquipment.length > 0 && (
                        <select
                          value={user.equipmentId ?? ''}
                          onChange={(e) =>
                            updateUser(user.id, { equipmentId: e.target.value || undefined })
                          }
                          className="w-40 rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
                          title="Gerät auf dem Canvas zuweisen"
                        >
                          <option value="">— Gerät —</option>
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

                    {config.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-8">
                        <span className="self-center text-[10px] text-slate-500">Gruppen:</span>
                        {config.groups.map((group) => {
                          const active = user.groupIds.includes(group.id)
                          return (
                            <button
                              key={group.id}
                              type="button"
                              onClick={() => toggleUserGroup(user.id, group.id)}
                              className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                                active
                                  ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                              }`}
                            >
                              {group.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {config.groups.length === 0 && (
                      <p className="pl-8 text-[10px] text-slate-600">
                        Erst Gruppen anlegen, dann hier zuweisen.
                      </p>
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
                <span className="text-xs text-slate-400">
                  Bis zu {MAX_GROUPS} Kommunikationsgruppen (Talk Groups).
                </span>
                <button
                  type="button"
                  onClick={addGroup}
                  disabled={config.groups.length >= MAX_GROUPS}
                  className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600 disabled:opacity-40"
                >
                  + Gruppe
                </button>
              </div>

              {config.groups.length === 0 && (
                <div className="rounded border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
                  Noch keine Gruppen. Klicke „+ Gruppe" um eine Talk Group anzulegen.
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
                      className="rounded border border-slate-700 bg-slate-800/60 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center text-[10px] font-bold text-slate-500">
                          #{group.id}
                        </span>
                        <input
                          value={group.name}
                          onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                          placeholder="Gruppenname (z.B. CAM)"
                          className="flex-1 rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
                        />
                        <span className="text-[10px] text-slate-500">
                          {memberCount} Mitglieder
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
                        <p className="mt-1 pl-8 text-[10px] text-slate-500">{memberNames}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SYSTEM ── */}
          {activeTab === 'system' && (
            <div className="max-w-md space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">System-Name</span>
                <input
                  value={config.systemName}
                  onChange={(e) => setField('systemName', e.target.value)}
                  placeholder="Produktion"
                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Beschreibung</span>
                <input
                  value={config.description ?? ''}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="optional"
                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">
                  Multicast-Adresse
                </span>
                <input
                  value={config.multicastAddress}
                  onChange={(e) => setField('multicastAddress', e.target.value)}
                  placeholder="239.1.160.1"
                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-sm"
                />
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  Standard: 239.1.160.1 — muss im Netzwerk eindeutig sein.
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Sample Rate</span>
                <select
                  value={config.sampleRate}
                  onChange={(e) =>
                    setField('sampleRate', Number(e.target.value) as 32000 | 48000)
                  }
                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
                >
                  <option value={32000}>32000 Hz (Standard GreenGo)</option>
                  <option value={48000}>48000 Hz</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3">
          <span className="text-[11px] text-slate-500">
            {config.users.length} Benutzer · {config.groups.length} Gruppen
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
            >
              Im Projekt speichern
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs hover:bg-emerald-500"
            >
              ⬇ Als .gg5 exportieren
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
