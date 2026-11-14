import { FileStack } from 'lucide-react'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { AnhaengeSection } from './AnhaengeSection'

/**
 * #1186 — die Dokumente am Projekt: Datenblaetter, Protokolle, Angebote,
 * Konfigurationsdateien. Dieselbe Ablage wie in der Uebergabe (`AnhaengeSection`),
 * aber ohne das Festinstallations-Modul erreichbar — eine Dokumentenablage
 * braucht jedes Projekt, nicht nur die Festinstallation.
 */
export const DokumenteDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.dokumenteOpen)
  const setOpen = useUiStore((s) => s.setDokumenteOpen)
  if (!open) return null
  return (
    <ModalShell
      open
      onClose={() => setOpen(false)}
      title={t('documents.title', 'Documents')}
      titleIcon={<Icon icon={FileStack} size="md" />}
      maxWidth="3xl"
      draggableKey="cable-planner:modal-pos:documents"
    >
      <AnhaengeSection />
    </ModalShell>
  )
}
