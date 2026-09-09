import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { confirmDialog } from '../../../lib/confirmDialog'
import { promptDialog } from '../../../lib/promptDialog'
import { infoDialog } from '../../../lib/infoDialog'
import { format, useTranslation } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — "Bibliothek"-SortableSection. Zwei Buttons: aktuelles Geraet
 * unter dem aktuellen Namen ueberschreiben (Standard-Vorlage), oder
 * unter neuem Namen als zusaetzliche Vorlage anlegen.
 *
 * Confirm/Prompt-Dialoge laufen inline — die Section haengt sich
 * eigenstaendig an customLibrary + saveEquipmentAsTemplate Selectoren.
 */
export const LibrarySaveSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const saveEquipmentAsTemplate = useProjectStore((state) => state.saveEquipmentAsTemplate)
  const saveEquipmentAsNewTemplate = useProjectStore((state) => state.saveEquipmentAsNewTemplate)
  const existing = customLibrary.find((entry) => entry.name === equipment.name)

  return (
    <SortableSection
      id="library"
      title={t('libSave.title', 'Library')}
      subtitle={t('libSave.subtitle', 'save as template')}
    >
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={async () => {
            const ok = existing
              ? await confirmDialog(
                  format(t('libSave.overwriteConfirm', 'Overwrite "{name}"?'), { name: equipment.name }),
                  {
                    body: t(
                      'libSave.overwriteBody',
                      "Already exists in the library. Overwrite with the current device's settings?",
                    ),
                    okLabel: t('libSave.overwriteOk', 'Overwrite'),
                    destructive: true,
                  },
                )
              : await confirmDialog(
                  format(t('libSave.saveConfirm', 'Save "{name}"?'), { name: equipment.name }),
                  {
                    body: t('libSave.saveBody', 'Save as a new default template in the library.'),
                  },
                )
            if (ok) {
              saveEquipmentAsTemplate(equipment.id)
            }
          }}
          className="w-full rounded bg-amber-700 px-2 py-1 text-cp-xs hover:bg-amber-600"
          title={t(
            'libSave.btnTitle',
            'Saves the current device (ports, network, SDI caps, MV config …) as a library template.',
          )}
        >
          {existing
            ? t('libSave.btnOverwrite', 'Overwrite default template ↺')
            : t('libSave.btnSave', 'Save as new default template ✚')}
        </button>
        <button
          type="button"
          onClick={async () => {
            const suggestion = `${equipment.name} (Custom)`
            const input = await promptDialog(
              t('libSave.newPrompt', 'Save as a new device in the library.\nName:'),
              suggestion,
            )
            if (!input) return
            const trimmed = input.trim()
            if (!trimmed) return
            if (customLibrary.some((entry) => entry.name === trimmed)) {
              await infoDialog(format(t('libSave.exists', '"{name}" already exists'), { name: trimmed }), {
                body: t(
                  'libSave.existsBody',
                  'Please choose a different name or overwrite the existing template.',
                ),
                tone: 'warning',
              })
              return
            }
            saveEquipmentAsNewTemplate(equipment.id, trimmed, equipment.category)
          }}
          className="w-full rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
          title={t(
            'libSave.newBtnTitle',
            'Creates a new template under a different name — the existing one stays unchanged.',
          )}
        >
          {t('libSave.newBtn', 'Save as new device in library ✚')}
        </button>
      </div>
    </SortableSection>
  )
}
