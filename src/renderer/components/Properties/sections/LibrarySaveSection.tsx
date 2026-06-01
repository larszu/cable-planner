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
      title={t('libSave.title', 'Bibliothek')}
      subtitle={t('libSave.subtitle', 'als Vorlage speichern')}
    >
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={async () => {
            const ok = existing
              ? await confirmDialog(
                  format(t('libSave.overwriteConfirm', '"{name}" überschreiben?'), { name: equipment.name }),
                  {
                    body: t(
                      'libSave.overwriteBody',
                      'Existiert bereits in der Bibliothek. Mit den aktuellen Einstellungen dieses Geräts überschreiben?',
                    ),
                    okLabel: t('libSave.overwriteOk', 'Überschreiben'),
                    destructive: true,
                  },
                )
              : await confirmDialog(
                  format(t('libSave.saveConfirm', '"{name}" speichern?'), { name: equipment.name }),
                  {
                    body: t('libSave.saveBody', 'Als neue Standard-Vorlage in der Bibliothek speichern.'),
                  },
                )
            if (ok) {
              saveEquipmentAsTemplate(equipment.id)
            }
          }}
          className="w-full rounded bg-amber-700 px-2 py-1 text-cp-xs hover:bg-amber-600"
          title={t(
            'libSave.btnTitle',
            'Speichert das aktuelle Gerät (Ports, Netzwerk, SDI-Caps, MV-Config …) als Vorlage in der Bibliothek.',
          )}
        >
          {existing
            ? t('libSave.btnOverwrite', 'Als Standard-Vorlage überschreiben ↺')
            : t('libSave.btnSave', 'Als neue Standard-Vorlage speichern ✚')}
        </button>
        <button
          type="button"
          onClick={async () => {
            const suggestion = `${equipment.name} (Custom)`
            const input = await promptDialog(
              t('libSave.newPrompt', 'Als neues Gerät in der Bibliothek speichern.\nName:'),
              suggestion,
            )
            if (!input) return
            const trimmed = input.trim()
            if (!trimmed) return
            if (customLibrary.some((entry) => entry.name === trimmed)) {
              await infoDialog(format(t('libSave.exists', '"{name}" existiert bereits'), { name: trimmed }), {
                body: t(
                  'libSave.existsBody',
                  'Bitte einen anderen Namen wählen oder die bestehende Vorlage überschreiben.',
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
            'Erstellt eine neue Vorlage unter anderem Namen — bestehende bleibt unverändert.',
          )}
        >
          {t('libSave.newBtn', 'Als neues Gerät in Library speichern ✚')}
        </button>
      </div>
    </SortableSection>
  )
}
