// v7.9.0 / Issue #110 — Unified Export Dialog.
//
// User-requested: replace the three separate "Plan als PDF / PNG / JPEG
// exportieren…" menu items with a single "Exportieren…" entry that opens
// a dialog where the format is chosen via radio buttons. Reduces menu
// noise and gives one consistent place for export options.
//
// Owns no business logic — delegates to the same export handlers
// App.tsx already wires (handleExportPdf / handleExportImage).

import { useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'

export type ExportFormat = 'pdf' | 'png' | 'jpeg'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  /** Triggers the actual export pipelines App.tsx already owns. */
  onExportPdf: (theme: 'dark' | 'light') => Promise<void> | void
  onExportImage: (format: 'png' | 'jpeg') => Promise<void> | void
}

export const ExportDialog = ({
  open,
  onClose,
  onExportPdf,
  onExportImage,
}: ExportDialogProps) => {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const [pdfTheme, setPdfTheme] = useState<'dark' | 'light'>(canvasTheme)
  const projectName = useProjectStore((s) => s.project.metadata.name)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const handleExport = async () => {
    setBusy(true)
    try {
      if (format === 'pdf') {
        await onExportPdf(pdfTheme)
      } else {
        await onExportImage(format)
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Plan exportieren</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-[11px] text-slate-400">
          Datei wird unter <code className="rounded bg-slate-800 px-1 py-0.5">{projectName || 'cable-planner'}</code> heruntergeladen.
        </p>

        <fieldset className="mb-4 space-y-2">
          <legend className="mb-1 text-xs font-semibold text-slate-300">Format</legend>
          {(
            [
              {
                value: 'pdf',
                icon: '📑',
                label: 'PDF',
                hint: 'Vektor-PDF mit Titelblock — beste Qualität, druckbar',
              },
              {
                value: 'png',
                icon: '🖼',
                label: 'PNG',
                hint: 'Transparent möglich, scharfe Kanten, beste Bildqualität',
              },
              {
                value: 'jpeg',
                icon: '🖼',
                label: 'JPEG',
                hint: 'Kleinere Dateien, gut für E-Mail / Slack',
              },
            ] as const
          ).map((opt) => {
            const selected = format === opt.value
            return (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-xs ${
                  selected
                    ? 'border-sky-500 bg-sky-900/30'
                    : 'border-slate-700 bg-slate-950 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="export-format"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setFormat(opt.value)}
                  className="mt-0.5"
                />
                <span className="text-base">{opt.icon}</span>
                <span className="flex-1">
                  <span className="block font-semibold text-slate-100">{opt.label}</span>
                  <span className="block text-[10px] text-slate-400">{opt.hint}</span>
                </span>
              </label>
            )
          })}
        </fieldset>

        {format === 'pdf' && (
          <fieldset className="mb-4 space-y-1">
            <legend className="mb-1 text-xs font-semibold text-slate-300">
              PDF-Thema
            </legend>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="pdf-theme"
                checked={pdfTheme === 'dark'}
                onChange={() => setPdfTheme('dark')}
              />
              <span>🌙 Dunkles Thema (wie Canvas)</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="pdf-theme"
                checked={pdfTheme === 'light'}
                onChange={() => setPdfTheme('light')}
              />
              <span>☀ Helles Thema (für Ausdruck empfohlen)</span>
            </label>
          </fieldset>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
            disabled={busy}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Exportiere…' : `Als ${format.toUpperCase()} herunterladen`}
          </button>
        </div>
      </div>
    </div>
  )
}
