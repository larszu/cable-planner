import { useEffect, useRef, useState } from 'react'
import type { ProjectMetadata } from '../../types/project'

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

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export const ProjectMetaDialog = ({
  open,
  mode,
  initial,
  onCancel,
  onConfirm,
}: ProjectMetaDialogProps) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [client, setClient] = useState('')
  const [contractor, setContractor] = useState('')
  const [projectNumber, setProjectNumber] = useState('')
  const [companyLogo, setCompanyLogo] = useState<string | undefined>(undefined)
  const [clientLogo, setClientLogo] = useState<string | undefined>(undefined)
  const companyInputRef = useRef<HTMLInputElement>(null)
  const clientInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const src = mode === 'new' ? ({} as ProjectMetadata) : initial
    setName(mode === 'new' ? '' : src.name ?? '')
    setDescription(src.description ?? '')
    setAuthor(src.author ?? '')
    setClient(src.client ?? '')
    setContractor(src.contractor ?? '')
    setProjectNumber(src.projectNumber ?? '')
    setCompanyLogo(src.companyLogo)
    setClientLogo(src.clientLogo)
  }, [open, mode, initial])

  if (!open) return null

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
      companyLogo,
      clientLogo,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="w-[560px] max-w-[95vw] rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
          <h2 className="text-sm font-semibold">
            {mode === 'new' ? 'Neues Projekt' : 'Projektdaten bearbeiten'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
          >
            Abbrechen
          </button>
        </div>

        <div className="max-h-[75vh] space-y-3 overflow-auto p-4 text-xs">
          <label className="block">
            Projektname <span className="text-red-400">*</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. ProSieben Studio Umbau"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              Auftragnehmer (Firma)
              <input
                value={contractor}
                onChange={(e) => setContractor(e.target.value)}
                placeholder="Deine Firma GmbH"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
              />
            </label>
            <label className="block">
              Kunde
              <input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Endkunde"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
              />
            </label>
            <label className="block">
              Planer / Autor
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Vorname Nachname"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
              />
            </label>
            <label className="block">
              Projekt-/Job-Nr.
              <input
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                placeholder="z.B. 2026-042"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
              />
            </label>
          </div>

          <label className="block">
            Beschreibung
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-y rounded border border-slate-700 bg-slate-950 p-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[11px] text-slate-400">Firmenlogo</div>
              {companyLogo ? (
                <div className="flex items-center gap-2">
                  <img
                    src={companyLogo}
                    alt="Firmenlogo"
                    className="h-12 w-auto rounded border border-slate-700 bg-white p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setCompanyLogo(undefined)}
                    className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
                  >
                    Entfernen
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
                  setCompanyLogo(await readFileAsDataUrl(f))
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => companyInputRef.current?.click()}
                className="mt-1 rounded bg-slate-700 px-2 py-1 text-[11px] hover:bg-slate-600"
              >
                Logo auswählen…
              </button>
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-400">Kundenlogo</div>
              {clientLogo ? (
                <div className="flex items-center gap-2">
                  <img
                    src={clientLogo}
                    alt="Kundenlogo"
                    className="h-12 w-auto rounded border border-slate-700 bg-white p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setClientLogo(undefined)}
                    className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
                  >
                    Entfernen
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
                  setClientLogo(await readFileAsDataUrl(f))
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => clientInputRef.current?.click()}
                className="mt-1 rounded bg-slate-700 px-2 py-1 text-[11px] hover:bg-slate-600"
              >
                Logo auswählen…
              </button>
            </div>
          </div>

          <p className="text-[10px] italic text-slate-500">
            Diese Daten erscheinen im Planköpfchen unten rechts beim PDF-Export.
            Jeder Speichervorgang aktualisiert das „zuletzt geändert"-Datum automatisch.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-700 px-4 py-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="rounded bg-emerald-700 px-3 py-1 text-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === 'new' ? 'Projekt anlegen' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
