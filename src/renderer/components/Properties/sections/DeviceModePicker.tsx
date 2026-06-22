import { useState } from 'react'
import { Pencil, ArrowUp, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../../store/projectStore'
import { Icon } from '../../shared/Icon'
import { confirmDialog } from '../../../lib/confirmDialog'
import { promptDialog } from '../../../lib/promptDialog'
import { format, useTranslation } from '../../../lib/i18n'
import { ModeEditorDialog } from '../ModeEditorDialog'
import type { DeviceMode, EquipmentItem } from '../../../types/equipment'

/**
 * #306 — Device-Mode-Picker (Issue #113) aus EquipmentProperties
 * ausgelagert. Verwaltet alternative Port-Konfigurationen (Modes) pro
 * Gerät: aktivieren, hinzufügen, umbenennen, Ports übernehmen, löschen,
 * Edit-Dialog öffnen.
 *
 * Switching activates the mode and copies its snapshot to the live
 * inputs/outputs (via setActiveDeviceMode in the store). Editing the
 * ports later doesn't automatically sync back to the mode — there's
 * an "Aktuelle Ports in Modus übernehmen" button per active mode for
 * that, so the user controls when a mode definition is updated.
 */
export const DeviceModePicker = ({
  equipment,
}: {
  equipment: EquipmentItem
}) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const setActiveDeviceMode = useProjectStore((s) => s.setActiveDeviceMode)
  const modes = equipment.modes ?? []
  const active = equipment.activeModeId
  // v7.9.0 / Issue #113 — Mode-Editor-Dialog (richer form)
  const [editorState, setEditorState] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; modeId: string }
    | null
  >(null)
  const editingMode =
    editorState?.mode === 'edit'
      ? modes.find((m) => m.id === editorState.modeId) ?? null
      : null

  const saveModeFromEditor = (newMode: DeviceMode) => {
    if (editorState?.mode === 'edit') {
      // Replace existing mode by id
      updateEquipment(equipment.id, {
        modes: modes.map((m) => (m.id === newMode.id ? newMode : m)),
      })
    } else {
      // Append new mode and activate it
      updateEquipment(equipment.id, {
        modes: [...modes, newMode],
        activeModeId: newMode.id,
      })
    }
    setEditorState(null)
  }

  const createModeFromPorts = async () => {
    const name = (await promptDialog(
      t('modes.newPrompt', 'Name des neuen Modus (z. B. "12G Single-Link" / "HDMI Output Mode"):'),
      format(t('modes.newDefaultName', 'Modus {n}'), { n: modes.length + 1 }),
    ))?.trim()
    if (!name) return
    const newMode = {
      id: `mode:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name,
      inputs: equipment.inputs.map((p) => ({ ...p })),
      outputs: equipment.outputs.map((p) => ({ ...p })),
    }
    updateEquipment(equipment.id, {
      modes: [...modes, newMode],
      activeModeId: newMode.id,
    })
  }

  const renameMode = async (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId)
    if (!mode) return
    const name = (await promptDialog(t('modes.renamePrompt', 'Modus-Name:'), mode.name))?.trim()
    if (!name) return
    updateEquipment(equipment.id, {
      modes: modes.map((m) => (m.id === modeId ? { ...m, name } : m)),
    })
  }

  const editDescription = async (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId)
    if (!mode) return
    const desc = await promptDialog(
      t('modes.descPrompt', 'Kurze Beschreibung (z. B. "1x 12G IN, 4x HDMI OUT"):'),
      mode.description ?? '',
    )
    if (desc === null) return
    updateEquipment(equipment.id, {
      modes: modes.map((m) => (m.id === modeId ? { ...m, description: desc || undefined } : m)),
    })
  }

  const deleteMode = async (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId)
    if (!mode) return
    if (
      !(await confirmDialog(format(t('modes.deleteConfirm', 'Modus "{name}" löschen?'), { name: mode.name }), {
        body: t('modes.deleteConfirmBody', 'Die zugehörigen Ports bleiben am Gerät erhalten.'),
        okLabel: t('common.delete', 'Löschen'),
        destructive: true,
      }))
    )
      return
    updateEquipment(equipment.id, {
      modes: modes.filter((m) => m.id !== modeId),
      activeModeId: active === modeId ? undefined : active,
    })
  }

  const captureCurrentPortsToMode = async (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId)
    if (!mode) return
    if (
      !(await confirmDialog(format(t('modes.captureConfirm', 'Aktuelles Port-Layout als Definition für "{name}" speichern?'), { name: mode.name }), {
        body: format(t('modes.captureBody', '{ins} Inputs · {outs} Outputs'), { ins: equipment.inputs.length, outs: equipment.outputs.length }),
      }))
    )
      return
    updateEquipment(equipment.id, {
      modes: modes.map((m) =>
        m.id === modeId
          ? {
              ...m,
              inputs: equipment.inputs.map((p) => ({ ...p })),
              outputs: equipment.outputs.map((p) => ({ ...p })),
            }
          : m,
      ),
    })
  }

  return (
    <div className="space-y-2 text-cp-xs">
      <p className="text-[10px] text-cp-text-muted">
        {t(
          'modes.intro',
          'Wechselt das Port-Layout des Geräts. Bestehende Kabel an Ports, die im neuen Modus nicht existieren, bleiben im Projekt, müssen aber neu gesteckt werden.',
        )}
      </p>
      <div className="grid grid-cols-1 gap-1">
        {modes.length === 0 && (
          <div className="rounded border border-dashed border-cp-border p-3 text-center text-[11px] text-cp-text-muted">
            {t(
              'modes.emptyState',
              'Keine Modi definiert. Ports oben bearbeiten und anschließend mit "+ aus aktuellem Layout" als Modus speichern.',
            )}
          </div>
        )}
        {modes.map((m) => (
          <div
            key={m.id}
            className={`rounded border ${
              active === m.id ? 'border-sky-500 bg-sky-900/40' : 'border-cp-border bg-cp-surface-1'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveDeviceMode(equipment.id, m.id)}
              className="flex w-full flex-col items-start px-2 py-1.5 text-left text-cp-text"
              title={active === m.id ? t('modes.active', 'Aktiv') : t('modes.activate', 'Aktivieren')}
            >
              <span className="font-medium">
                {active === m.id && <span className="mr-1 text-sky-300">●</span>}
                {m.name}
              </span>
              {m.description && (
                <span className="text-[10px] text-cp-text-muted">{m.description}</span>
              )}
              <span className="mt-1 text-[10px] text-cp-text-muted">
                {m.inputs.length} {t('modes.inShort', 'In')} · {m.outputs.length} {t('modes.outShort', 'Out')}
              </span>
            </button>
            <div className="flex gap-1 border-t border-cp-border-muted bg-cp-surface-3/40 px-1 py-1 text-[10px]">
              <button
                type="button"
                onClick={() => setEditorState({ mode: 'edit', modeId: m.id })}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sky-300 hover:bg-sky-900/30"
                title={t('modes.editorTitle', 'Modus im Editor öffnen (Name, Beschreibung, Ports auf einmal)')}
              >
                <Icon icon={Pencil} size="xs" /> {t('modes.editor', 'Editor')}
              </button>
              <button
                type="button"
                onClick={() => renameMode(m.id)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-cp-text-secondary hover:bg-cp-surface-2"
                title={t('modes.renameTitle', 'Namen ändern')}
              >
                <Icon icon={Pencil} size="xs" /> {t('modes.name', 'Name')}
              </button>
              <button
                type="button"
                onClick={() => editDescription(m.id)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-cp-text-secondary hover:bg-cp-surface-2"
                title={t('modes.descTitle', 'Beschreibung ändern')}
              >
                <Icon icon={Pencil} size="xs" /> {t('modes.desc', 'Beschreibung')}
              </button>
              {active === m.id && (
                <button
                  type="button"
                  onClick={() => captureCurrentPortsToMode(m.id)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-900/30"
                  title={t('modes.captureTitle', 'Aktuelles Port-Layout in diesen Modus übernehmen')}
                >
                  <Icon icon={ArrowUp} size="xs" /> {t('modes.capture', 'Ports übernehmen')}
                </button>
              )}
              <button
                type="button"
                onClick={() => deleteMode(m.id)}
                className="ml-auto rounded px-1.5 py-0.5 text-cp-text-muted hover:bg-red-700 hover:text-white"
                title={t('modes.deleteTitle', 'Modus löschen')}
                aria-label={t('modes.deleteTitle', 'Modus löschen')}
              >
                <Icon icon={Trash2} size="xs" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setEditorState({ mode: 'create' })}
          className="w-full rounded border border-sky-700 bg-sky-900/30 px-2 py-1 text-[11px] text-sky-100 hover:bg-sky-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          title={t(
            'modes.newEditorTitle',
            'Öffnet einen Editor in dem Name, Beschreibung und Ports des neuen Modus konfiguriert werden können (Issue #113).',
          )}
        >
          {t('modes.newEditor', '+ Neuer Modus (Editor)')}
        </button>
        <button
          type="button"
          onClick={createModeFromPorts}
          className="w-full rounded border border-dashed border-emerald-700 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          title={t(
            'modes.quickSaveTitle',
            'Speichert das aktuelle Port-Layout des Geräts als neuen Modus (Quick-Save).',
          )}
        >
          {t('modes.quickSave', '+ aus aktuellem Layout speichern')}
        </button>
      </div>
      <ModeEditorDialog
        open={editorState !== null}
        equipment={equipment}
        editingMode={editingMode}
        onCancel={() => setEditorState(null)}
        onSave={saveModeFromEditor}
      />
    </div>
  )
}
