import { useEffect, useRef, useState } from 'react'
import type { ProjectMetadata } from '../../types/project'
import { readImageAsDataUri } from '../../lib/readImageAsDataUri'
import { ModalShell } from '../shared/ModalShell'
import { useTranslation } from '../../lib/i18n'
import { useModule } from '../../store/settingsStore'

/**
 * Dialog used both when starting a new project and when editing metadata
 * of the current one. Captures author/client/contractor/logos so the PDF
 * export can stamp a proper plan header.
 */
export interface ProjectMetaDialogProps {
  open: boolean
  mode: 'new' | 'edit'
  initial: ProjectMetadata
  onCancel: () => void
  onConfirm: (patch: Partial<ProjectMetadata>) => void
}


export const ProjectMetaDialog = ({
  open,
  mode,
  initial,
  onCancel,
  onConfirm,
}: ProjectMetaDialogProps) => {
  const t = useTranslation()
  // Modulares UI — Einsatz-/Mietzeitraum nur bei aktivem Rental-/Lager-Modul.
  const rentalModule = useModule('rental')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [client, setClient] = useState('')
  const [contractor, setContractor] = useState('')
  const [projectNumber, setProjectNumber] = useState('')
  const [eventStart, setEventStart] = useState('')
  const [eventEnd, setEventEnd] = useState('')
  const [companyLogo, setCompanyLogo] = useState<string | undefined>(undefined)
  const [clientLogo, setClientLogo] = useState<string | undefined>(undefined)
  const companyInputRef = useRef<HTMLInputElement>(null)
  const clientInputRef = useRef<HTMLInputElement>(null)
  // Stash the latest `initial` in a ref so we can read it inside the open-effect
  // without depending on its identity. Otherwise the effect would re-run and
  // wipe user input every time the parent re-renders with a new metadata
  // reference (e.g. after an autosave tick), making the dialog feel "dead".
  const initialRef = useRef(initial)
  useEffect(() => {
    initialRef.current = initial
  })

  useEffect(() => {
    if (!open) return
    const src = mode === 'new' ? ({} as ProjectMetadata) : initialRef.current
    setName(mode === 'new' ? '' : src.name ?? '')
    setDescription(src.description ?? '')
    setAuthor(src.author ?? '')
    setClient(src.client ?? '')
    setContractor(src.contractor ?? '')
    setProjectNumber(src.projectNumber ?? '')
    setEventStart((src.eventStart ?? '').slice(0, 10))
    setEventEnd((src.eventEnd ?? '').slice(0, 10))
    setCompanyLogo(src.companyLogo)
    setClientLogo(src.clientLogo)
  }, [open, mode])

  const canConfirm = name.trim().length > 0

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({
      name: name.trim(),
      description: description.trim(),
      author: author.trim() || undefined,
      client: client.trim() || undefined,
      contractor: contractor.trim() || undefined,
      projectNumber: projectNumber.trim() || undefined,
      eventStart: eventStart || undefined,
      eventEnd: eventEnd || undefined,
      companyLogo,
      clientLogo,
    })
  }

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={
        mode === 'new'
          ? t('project.meta.titleNew', 'Neues Projekt')
          : t('project.meta.titleEdit', 'Projektdaten bearbeiten')
      }
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="rounded bg-emerald-700 px-3 py-1 text-cp-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === 'new'
              ? t('project.meta.create', 'Projekt anlegen')
              : t('common.save', 'Speichern')}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-cp-xs">
          <label className="block">
            {t('project.meta.name', 'Projektname')} <span className="text-red-400">*</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('project.meta.namePh', 'z.B. ProSieben Studio Umbau')}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              {t('project.meta.contractor', 'Auftragnehmer (Firma)')}
              <input
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
                placeholder={t('project.meta.contractorPh', 'Deine Firma GmbH')}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              />
            </label>
            <label className="block">
              {t('project.meta.client', 'Kunde')}
              <input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder={t('project.meta.clientPh', 'Endkunde')}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              />
            </label>
            <label className="block">
              {t('project.meta.author', 'Planer / Autor')}
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={t('project.meta.authorPh', 'Vorname Nachname')}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              />
            </label>
            <label className="block">
              {t('project.meta.projectNumber', 'Projekt-/Job-Nr.')}
              <input
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                placeholder={t('project.meta.projectNumberPh', 'z.B. 2026-042')}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              />
            </label>
          </div>

          {rentalModule && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              {t('project.meta.eventStart', 'Einsatz-/Mietbeginn')}
              <input
                type="date"
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              />
            </label>
            <label className="block">
              {t('project.meta.eventEnd', 'Einsatz-/Mietende')}
              <input
                type="date"
                value={eventEnd}
                min={eventStart || undefined}
                onChange={(e) => setEventEnd(e.target.value)}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              />
            </label>
          </div>
          )}

          <label className="block">
            {t('project.meta.description', 'Beschreibung')}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-y rounded border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[11px] text-cp-text-muted">
                {t('project.meta.companyLogo', 'Firmenlogo')}
              </div>
              {companyLogo ? (
                <div className="flex items-center gap-2">
                  <img
                    src={companyLogo}
                    alt={t('project.meta.companyLogo', 'Firmenlogo')}
                    className="h-12 w-auto rounded border border-cp-border bg-white p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setCompanyLogo(undefined)}
                    className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
                  >
                    {t('project.meta.removeLogo', 'Entfernen')}
                  </button>
                </div>
              ) : null}
              <input
                ref={companyInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setCompanyLogo((await readImageAsDataUri(f)) ?? "")
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => companyInputRef.current?.click()}
                className="mt-1 rounded bg-cp-surface-4 px-2 py-1 text-[11px] hover:bg-cp-surface-5"
              >
                {t('project.meta.chooseLogo', 'Logo auswählen…')}
              </button>
            </div>
            <div>
              <div className="mb-1 text-[11px] text-cp-text-muted">
                {t('project.meta.clientLogo', 'Kundenlogo')}
              </div>
              {clientLogo ? (
                <div className="flex items-center gap-2">
                  <img
                    src={clientLogo}
                    alt={t('project.meta.clientLogo', 'Kundenlogo')}
                    className="h-12 w-auto rounded border border-cp-border bg-white p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setClientLogo(undefined)}
                    className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
                  >
                    {t('project.meta.removeLogo', 'Entfernen')}
                  </button>
                </div>
              ) : null}
              <input
                ref={clientInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setClientLogo((await readImageAsDataUri(f)) ?? "")
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => clientInputRef.current?.click()}
                className="mt-1 rounded bg-cp-surface-4 px-2 py-1 text-[11px] hover:bg-cp-surface-5"
              >
                {t('project.meta.chooseLogo', 'Logo auswählen…')}
              </button>
            </div>
          </div>

          <p className="text-[10px] italic text-cp-text-muted">
            {t(
              'project.meta.footnote',
              'Diese Daten erscheinen im Planköpfchen unten rechts beim PDF-Export. Jeder Speichervorgang aktualisiert das „zuletzt geändert"-Datum automatisch.',
            )}
          </p>
      </div>
    </ModalShell>
  )
}
