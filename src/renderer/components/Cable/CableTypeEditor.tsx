// ───────────────────────────────────────────────────────────────────────────
// Der Editor für Kabeltypen (#836).
//
// ─── WARUM ER EINE EIGENE DATEI IST ────────────────────────────────────────
//
// Er stand bis 2026-09-10 unten in `CableLibraryPanel.tsx` — dort, wo auch
// der einzige Knopf sass, der ihn oeffnete. Der Eigentuemer hat gemeldet:
// „Neue kabeltypen anlegen muss eigentlich in den Einstellungen sein und
// nicht links in der Geräte seitenleiste."
//
// Damit hat er ZWEI Aufrufer: die Einstellungen legen an, die Seitenleiste
// bearbeitet weiter, was schon dasteht. Ihn in der einen Datei zu lassen und
// von der anderen zu importieren hiesse, dass die Einstellungen die
// Seitenleiste laden — mitsamt dnd-kit, Sortierung und Katalog-Gruppierung,
// die sie nicht brauchen.
//
// Er weiss NICHT, wohin das Ergebnis geht. Der Aufrufer gibt den Anfangswert
// und nimmt das Ergebnis entgegen — deshalb kann dieselbe Maske einen eigenen
// Typ anlegen und einen eingebauten ueberschreiben, ohne den Unterschied zu
// kennen.
//
// GENAU DAS und nicht mehr. „Kein Store-Zugriff" waere zu viel behauptet: er
// liest die eigenen Steckertypen des Nutzers (`customConnectorTypes`) und
// kann einen dazulegen, weil dieselbe Auswahl sonst hier aermer waere als in
// der Eigenschaften-Leiste. Was er nicht anfasst, ist der Kabel-Speicher —
// `addCustomCableSpec`, `setCableSpecOverride` und ihre Geschwister bleiben
// beim Aufrufer, sonst zoege die Entscheidung „anlegen oder ueberschreiben"
// in die Maske.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ALL_SIGNAL_STANDARDS } from '../../types/cableSpec'
import type { CableSpec, SignalStandard } from '../../types/cableSpec'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType } from '../../types/equipment'
import { useUiStore } from '../../store/uiStore'
import { promptDialog } from '../../lib/promptDialog'
import { useTranslation } from '../../lib/i18n'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'


/** v7.8.6 — Editor dialog for creating / editing custom cable specs.
 *  Pure controlled form, no store
 *  access — caller passes an initial value (if editing) and a save
 *  callback. */
interface CableTypeEditorProps {
  open: boolean
  initial?: CableSpec | null
  /** Used to detect duplicate-name conflicts inside the dialog. */
  existingNames: string[]
  onCancel: () => void
  onSave: (spec: Omit<CableSpec, 'id'>) => void
}

export const CableTypeEditor = ({
  open,
  initial,
  existingNames,
  onCancel,
  onSave,
}: CableTypeEditorProps) => {
  const t = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [connectorType, setConnectorType] = useState<ConnectorType>(
    initial?.connectorType ?? 'Custom',
  )
  const [compatible, setCompatible] = useState<ConnectorType[]>(
    initial?.compatibleConnectors ?? [],
  )
  const [standards, setStandards] = useState<SignalStandard[]>(
    initial?.standards ?? ['Generic'],
  )
  const [color, setColor] = useState(initial?.color ?? '#64748b')
  const [maxLength, setMaxLength] = useState<number | ''>(initial?.maxLengthMeters ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  // v7.9.2 — User-defined custom connector types and signal standards
  // are merged with the built-in lists so they can be selected
  // alongside XLR/BNC etc. New entries are created via the "+"
  // buttons next to each list (User-Issue: "muss man auch neue
  // steckertypen anlegen können").
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)
  const addCustomConnectorType = useUiStore((s) => s.addCustomConnectorType)
  const customSignalStandards = useUiStore((s) => s.customSignalStandards)
  const addCustomSignalStandard = useUiStore((s) => s.addCustomSignalStandard)
  const allConnectorTypeOptions = useMemo(
    () =>
      [...ALL_CONNECTOR_TYPES, ...customConnectorTypes.filter((c) => !ALL_CONNECTOR_TYPES.includes(c as ConnectorType))] as ConnectorType[],
    [customConnectorTypes],
  )
  const allSignalStandardOptions = useMemo(
    () =>
      [...ALL_SIGNAL_STANDARDS, ...customSignalStandards.filter((s) => !ALL_SIGNAL_STANDARDS.includes(s as SignalStandard))] as SignalStandard[],
    [customSignalStandards],
  )

  // Phase 3 der UI-Pruefung. Das Panel selbst ist kein Modal — dieser
  // Kabeltyp-Editor darin schon, und er hatte weder Escape noch Fokus-Falle.
  // Der Haken steht VOR dem bedingten Ausstieg: Haken duerfen nicht bedingt
  // laufen, `open` schaltet stattdessen ihre Wirkung.
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, onCancel)

  // B-44 — der Kabeltyp-Editor haelt einen Entwurf, bis „Speichern"
  // gedrueckt ist. Ein Fehlklick daneben darf ihn nicht wegwerfen.
  const backdrop = useBackdropClose(onCancel, {
    schutz: () => name.trim().length > 0 || notes.trim().length > 0,
  })

  if (!open) return null

  const trimmedName = name.trim()
  const isEditing = !!initial
  const conflictsWithExisting =
    !!trimmedName &&
    !isEditing &&
    existingNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase())
  const canSave = trimmedName.length > 0 && standards.length > 0

  const submit = () => {
    if (!canSave) return
    const spec: Omit<CableSpec, 'id'> = {
      name: trimmedName,
      connectorType,
      compatibleConnectors: compatible.length > 0 ? compatible : undefined,
      standards,
      color,
      maxLengthMeters: typeof maxLength === 'number' && maxLength > 0 ? maxLength : undefined,
      notes: notes.trim() || undefined,
    }
    onSave(spec)
  }

  return (
    <div
      {...backdrop}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="w-full max-w-md border border-cp-border bg-cp-surface-1 p-4 text-cp-text"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 id={titleId} className="text-cp-base font-semibold">
            {isEditing ? t('cableLib.editor.editTitle', 'Edit cable type') : t('cableLib.editor.newTitle', 'New cable type')}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-cp-text-faint hover:text-cp-text-bright"
            aria-label={t('common.close', 'Close')}
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>
        <div className="space-y-2 text-cp-xs">
          <label className="block">
            <span className="text-cp-text-muted">{t('common.name', 'Name')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('cableLib.namePlaceholder', 'e.g. CAT6a patch 5 m')}
              autoFocus
              className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-text"
            />
            {conflictsWithExisting && (
              <span className="mt-0.5 flex items-center gap-1 text-cp-xs text-amber-400">
                <Icon icon={AlertTriangle} size="xs" className="shrink-0" />
                {t('cableLib.nameExists', 'Name already exists — saving overwrites the existing entry.')}
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="flex items-center justify-between text-cp-text-muted">
                <span>{t('cableLib.connectorType', 'Connector type')}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const n = (await promptDialog(t('cableLib.newConnectorTypePrompt', 'New connector type (e.g. "Speakon NL4"):')))?.trim()
                    if (n) {
                      addCustomConnectorType(n)
                      setConnectorType(n as ConnectorType)
                    }
                  }}
                  className="bg-emerald-700 px-1.5 text-cp-xs text-emerald-100 hover:bg-emerald-600"
                  title={t('cableLib.addConnectorTitle', 'Add new connector type')}
                >
                  +
                </button>
              </span>
              <select
                value={connectorType}
                onChange={(e) => setConnectorType(e.target.value as ConnectorType)}
                className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 px-2 py-1"
              >
                {allConnectorTypeOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                    {customConnectorTypes.includes(c as string) ? t('cableLib.customSuffix', ' (custom)') : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-cp-text-muted">{t('cableLib.color', 'Cable colour')}</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-0.5 h-7 w-full cursor-pointer border border-cp-border bg-cp-surface-3 p-0.5"
              />
            </label>
          </div>
          <div>
            <span className="text-cp-text-muted">{t('cableLib.compatibleWith', 'Also compatible with (optional)')}</span>
            <div className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-auto border border-cp-border bg-cp-surface-3 p-1.5">
              {allConnectorTypeOptions.filter((c) => c !== connectorType).map((c) => {
                const on = compatible.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setCompatible((prev) =>
                        on ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                    className={` px-1.5 py-0.5 text-cp-xs ${
                      on
                        ? 'bg-emerald-700 text-white'
                        : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <span className="flex items-center justify-between text-cp-text-muted">
              <span>{t('cableLib.signalStandards', 'Signal standards')}</span>
              <button
                type="button"
                onClick={async () => {
                  const n = (await promptDialog(t('cableLib.newSignalStandardPrompt', 'New signal standard (e.g. "Dante Primary"):')))?.trim()
                  if (n) {
                    addCustomSignalStandard(n)
                    setStandards((prev) => [...prev, n as SignalStandard])
                  }
                }}
                className="bg-sky-700 px-1.5 text-cp-xs text-sky-100 hover:bg-sky-600"
                title={t('cableLib.addSignalStandardTitle', 'Add new signal standard')}
              >
                {t('cableLib.addStandard', '+ Standard')}
              </button>
            </span>
            <div className="mt-1 flex max-h-32 flex-wrap gap-1 overflow-auto border border-cp-border bg-cp-surface-3 p-1.5">
              {allSignalStandardOptions.map((s) => {
                const on = standards.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setStandards((prev) =>
                        on ? prev.filter((x) => x !== s) : [...prev, s],
                      )
                    }
                    className={` px-1.5 py-0.5 text-cp-xs ${
                      on
                        ? 'bg-sky-700 text-white'
                        : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
                    } ${customSignalStandards.includes(s as string) ? 'italic' : ''}`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            {standards.length === 0 && (
              <span className="mt-0.5 block text-cp-xs text-red-400">
                {t('cableLib.pickAtLeastOneStandard', 'Select at least one standard.')}
              </span>
            )}
          </div>
          <label className="block">
            <span className="text-cp-text-muted">{t('cableLib.maxLength', 'Max. length (m) — optional')}</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={maxLength}
              onChange={(e) => {
                const v = e.target.value
                setMaxLength(v === '' ? '' : Math.max(0, Number(v)))
              }}
              placeholder={t('cable.field.maxReachPlaceholder', 'e.g. 100')}
              className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 px-2 py-1"
            />
          </label>
          <label className="block">
            <span className="text-cp-text-muted">{t('cableLib.note', 'Note (optional)')}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t('cableLib.notePlaceholder', 'e.g. indoor only, shielded, …')}
              className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 px-2 py-1"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="bg-emerald-600 px-3 py-1 text-cp-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isEditing ? t('common.save', 'Save') : t('cableLib.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  )
}
