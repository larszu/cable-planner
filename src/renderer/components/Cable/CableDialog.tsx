import { useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useUiStore } from '../../store/uiStore'
import { confirmDialog } from '../../lib/confirmDialog'
import { promptDialog } from '../../lib/promptDialog'
import { AlertTriangle, Check, XCircle } from 'lucide-react'
import { format, useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { connectorToCableType } from '../../lib/cableInheritance'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType, EquipmentItem, Port } from '../../types/equipment'
import type { Cable } from '../../types/cable'
import {
  ALL_SIGNAL_STANDARDS,
  cableCatalog,
  checkCableCompatibility,
  checkSdiStandardMismatch,
  checkImpedanceMismatch,
  checkBalanceMismatch,
  balanceForConnector,
  pickHighestSdiStandard,
  type CableSpec,
  type SignalStandard,
} from '../../types/cableSpec'
import {
  DEFAULT_VIDEO_FORMAT,
  pickCableStandardForFormat,
  videoFormatById,
  type VideoFormatId,
} from '../../types/videoFormat'
import { CUSTOM_CABLE_SPEC_ID, makeCustomCableSpec } from './customCableSpec'

export interface CableDialogProps {
  fromPort?: Port
  toPort?: Port
  fromDev?: EquipmentItem
  toDev?: EquipmentItem
  defaultVideoFormat?: VideoFormatId
  onCancel: () => void
  onCreate: (
    draft: Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'> &
      Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>,
  ) => void
}

export const CableDialog = ({ fromPort, toPort, fromDev, toDev, defaultVideoFormat, onCancel, onCreate }: CableDialogProps) => {
  const t = useTranslation()
  // Dialog ist gemountet == offen → open=true. Escape/Tab-Trap/Fokus-Rückgabe.
  const { panelRef, titleId, dialogProps } = useDialogA11y(true, onCancel)
  // Issue #70: optional global override of connector-mismatch warnings.
  // When enabled, the dialog still SHOWS the warning banner so the user
  // sees what's happening, but the submit path skips the modal confirm
  // so the cable can be created in one click.
  const overrideWarnings = useUiStore((s) => s.overrideConnectionWarnings)
  // Combined catalog = built-ins + user-defined custom cable specs (issue #64).
  // The custom specs come from uiStore.customCableSpecs and persist in
  // localStorage so the user can recall them across sessions.
  const customCableSpecs = useUiStore((s) => s.customCableSpecs)
  const cableSpecOverrides = useUiStore((s) => s.cableSpecOverrides)
  const fullCableCatalog = useMemo(
    () => [
      ...cableCatalog.map((spec) => {
        const ov = cableSpecOverrides[spec.id]
        return ov ? { ...spec, ...ov, id: spec.id } : spec
      }),
      ...customCableSpecs,
    ],
    [customCableSpecs, cableSpecOverrides],
  )
  // v7.9.6 — Inline-Anlage neuer Stecker-/Signal-Typen aus dem Kabel-
  // Dialog. Bisher waren die Dropdowns auf ALL_CONNECTOR_TYPES /
  // ALL_SIGNAL_STANDARDS festgenagelt; jetzt zeigen sie zusätzlich die
  // in uiStore.customConnectorTypes / customSignalStandards bereits
  // angelegten Custom-Werte und bieten einen "+ Neuer…"-Eintrag, der
  // den Wert via Prompt anlegt und sofort persistiert.
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)
  const customSignalStandards = useUiStore((s) => s.customSignalStandards)
  const allConnectorOptions = useMemo(
    () =>
      [
        ...ALL_CONNECTOR_TYPES,
        ...customConnectorTypes.filter((c) => !ALL_CONNECTOR_TYPES.includes(c as ConnectorType)),
      ] as ConnectorType[],
    [customConnectorTypes],
  )
  const allStandardOptions = useMemo(
    () =>
      [
        ...ALL_SIGNAL_STANDARDS,
        ...customSignalStandards.filter((s) => !ALL_SIGNAL_STANDARDS.includes(s as SignalStandard)),
      ] as SignalStandard[],
    [customSignalStandards],
  )
  // Build list of cables ranked by compatibility with the two ports.
  const ranked = useMemo((): Array<{ cable: CableSpec; level: 'ok' | 'warn' | 'error'; message: string }> => {
    if (!fromPort || !toPort) {
      return fullCableCatalog.map((cable) => ({ cable, level: 'ok' as const, message: '' }))
    }
    return fullCableCatalog
      .map((cable) => ({
        cable,
        ...checkCableCompatibility(fromPort.connectorType, toPort.connectorType, cable),
      }))
      .sort((a, b) => {
        const order = { ok: 0, warn: 1, error: 2 }
        return order[a.level] - order[b.level]
      })
  }, [fromPort, toPort, fullCableCatalog])

  // For SDI↔SDI connections, pick the cable that matches the project's default
  // video format (or 1080p50 fallback) and the two devices' SDI capabilities.
  // When no catalog entry fits the connectors, fall back to the Custom Cable
  // preset so the resulting cable inherits the start port's connector type
  // instead of landing on the first (unrelated) cable in the catalog.
  const initialSpecId = useMemo(() => {
    const firstUsable = ranked.find((item) => item.level !== 'error')
    if (!firstUsable) return CUSTOM_CABLE_SPEC_ID
    if (!fromPort || !toPort) return firstUsable.cable.id
    const sdiConnectors = new Set<ConnectorType>(['BNC'])
    const bothSdi =
      sdiConnectors.has(fromPort.connectorType) && sdiConnectors.has(toPort.connectorType)
    if (!bothSdi) return firstUsable.cable.id
    const format = videoFormatById(defaultVideoFormat ?? DEFAULT_VIDEO_FORMAT)
    if (!format) return firstUsable.cable.id
    const target = pickCableStandardForFormat(format, fromDev?.sdiCaps, toDev?.sdiCaps)
    const match = ranked.find(
      (item) => item.level !== 'error' && item.cable.standards.includes(target),
    )
    return match?.cable.id ?? firstUsable.cable.id
  }, [ranked, fromPort, toPort, fromDev, toDev, defaultVideoFormat])

  // Default the Custom Cable's connector to the START port's type so the cable
  // type inherits from the start connector when the user keeps the Custom preset.
  const inferredConnector: ConnectorType =
    fromPort?.connectorType ?? toPort?.connectorType ?? 'Custom'

  const [specId, setSpecId] = useState<string>(initialSpecId)
  const [customConnectorType, setCustomConnectorType] = useState<ConnectorType>(inferredConnector)
  const [customStandard, setCustomStandard] = useState<SignalStandard>('Generic')
  const [customMaxLength, setCustomMaxLength] = useState<number | ''>('')
  const selectedEntry = specId === CUSTOM_CABLE_SPEC_ID
    ? { cable: makeCustomCableSpec(customConnectorType, '#64748b'), level: 'ok' as const, message: '' }
    : (ranked.find((item) => item.cable.id === specId) ?? ranked[0])
  const selected: CableSpec = selectedEntry.cable

  const defaultStandard = specId === CUSTOM_CABLE_SPEC_ID
    ? customStandard
    : pickHighestSdiStandard(selected.standards)
  const [standard, setStandard] = useState<SignalStandard | undefined>(defaultStandard)
  const [length, setLength] = useState(1)
  const [name, setName] = useState(selected.name)
  const [color, setColor] = useState(selected.color)
  const [notes, setNotes] = useState(selected.notes ?? '')

  // Keep derived fields aligned when the user changes the spec.
  const onSelectSpec = (id: string) => {
    setSpecId(id)
    if (id === CUSTOM_CABLE_SPEC_ID) {
      setColor('#64748b')
      setNotes('')
      setStandard(customStandard)
      // Do NOT reset `name` here — keep whatever the user typed (or the
      // previous spec name) so a mid-dialog spec switch doesn't wipe out
      // the user's custom name. (Bug #13)
      return
    }
    const spec = fullCableCatalog.find((c) => c.id === id)
    if (!spec) return
    setName(spec.name)
    setColor(spec.color)
    // Catalog entries use notesKey (language-aware via i18n). User-supplied
    // custom CableSpecs use the legacy `notes` literal which stays as-is.
    setNotes(spec.notesKey ? t(spec.notesKey, '') : (spec.notes ?? ''))
    setStandard(pickHighestSdiStandard(spec.standards))
  }

  const sdiMismatch = useMemo(() => {
    if (!fromPort || !toPort) return null
    if (!standard) return null
    // If user picked a specific SDI speed as the cable standard, check that both
    // ports' declared standards (if any) match or note a converter is needed.
    return checkSdiStandardMismatch(fromPort.standard ?? standard, toPort.standard ?? standard)
  }, [fromPort, toPort, standard])

  // #390 — Impedanz-Mismatch (75/50/110Ω) entlang der Verbindung warnen.
  const impedanceMismatch = useMemo(() => {
    if (!fromPort || !toPort) return null
    return checkImpedanceMismatch(fromPort.standard ?? standard, toPort.standard ?? standard)
  }, [fromPort, toPort, standard])

  // #380 — sym/unsym: Übergang warnen + lange unsymmetrische Analog-Strecke.
  const balanceWarning = useMemo(() => {
    if (!fromPort || !toPort) return null
    const transition = checkBalanceMismatch(fromPort.connectorType, toPort.connectorType)
    if (transition) return transition
    if (
      selected.standards.includes('Analog-Audio') &&
      balanceForConnector(selected.connectorType) === 'unbalanced' &&
      length > 10
    ) {
      return {
        level: 'warn' as const,
        message: format(
          t(
            'cable.balance.longUnbalanced',
            'Lange unsymmetrische Analog-Audio-Strecke ({length} m). Brumm-/Störungsrisiko — symmetrisch (XLR) bevorzugen oder unter ~10 m halten.',
          ),
          { length },
        ),
      }
    }
    return null
  }, [fromPort, toPort, selected, length])

  const connectorMismatch: 'ok' | 'warn' | 'error' =
    specId === CUSTOM_CABLE_SPEC_ID ? 'ok' : selectedEntry.level
  const connectorMessage = specId === CUSTOM_CABLE_SPEC_ID ? '' : selectedEntry.message

  const needsConverter =
    connectorMismatch === 'warn' || sdiMismatch?.level === 'warn' || connectorMismatch === 'error'

  const effectiveMaxLength = specId === CUSTOM_CABLE_SPEC_ID ? customMaxLength : selected.maxLengthMeters

  const lengthWarning =
    effectiveMaxLength && length > effectiveMaxLength
      ? format(
          t(
            'cable.lengthWarning',
            'Länge überschreitet die empfohlene Maximallänge von {max} m für {name}.',
          ),
          { max: effectiveMaxLength, name: selected.name },
        )
      : null

  // #62 — Kein passender Kabeltyp im Katalog: statt still auf einen
  // generischen Custom-Fallback (früher 3-pin-XLR) zu landen, den User
  // sichtbar auffordern, bewusst einen Typ zu wählen oder neu anzulegen.
  const noCompatibleSpec = ranked.length === 0 || ranked.every((r) => r.level === 'error')
  const promptPickCableType = specId === CUSTOM_CABLE_SPEC_ID && noCompatibleSpec

  const submit = async () => {
    if (connectorMismatch === 'error' && !overrideWarnings) {
      const proceed = await confirmDialog(t('cable.connector.compatTitle', 'Stecker-Kompatibilität'), {
        body: `${connectorMessage}\n\n${t(
          'cable.connector.createAnywayBody',
          'Verbindung trotzdem anlegen (markiert als "braucht Konverter")?',
        )}`,
        okLabel: t('cable.connector.createAnywayOk', 'Trotzdem anlegen'),
        destructive: true,
      })
      if (!proceed) {
        return
      }
    }
    onCreate({
      name,
      type: connectorToCableType(specId === CUSTOM_CABLE_SPEC_ID ? customConnectorType : selected.connectorType),
      length,
      color,
      notes,
      cableSpecId: specId === CUSTOM_CABLE_SPEC_ID ? undefined : selected.id,
      standard: specId === CUSTOM_CABLE_SPEC_ID ? customStandard : standard,
      // `needsConverter` already covers warn-level and error-level mismatch
      // (see definition above), so no extra fall-through check needed.
      needsConverter,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="w-full max-w-lg rounded border border-cp-border bg-cp-surface-1 p-4 text-cp-text outline-none"
      >
        <h3 id={titleId} className="mb-2 text-cp-2xl font-semibold">{t('cable.dialog.title', 'Neues Kabel')}</h3>

        {fromPort && toPort && (
          <div className="mb-3 rounded bg-cp-surface-3 p-2 text-cp-xs">
            <div>
              {t('cable.dialog.from', 'Von:')} <span className="font-medium">{fromPort.name}</span> ({fromPort.connectorType}
              {fromPort.standard ? `, ${fromPort.standard}` : ''})
            </div>
            <div>
              {t('cable.dialog.to', 'Nach:')} <span className="font-medium">{toPort.name}</span> ({toPort.connectorType}
              {toPort.standard ? `, ${toPort.standard}` : ''})
            </div>
          </div>
        )}

        <div className="space-y-2 text-cp-base">
          <label className="block">
            {t('cable.field.cable', 'Kabel')}
            <select
              value={specId}
              onChange={(e) => onSelectSpec(e.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
            >
              <option value={CUSTOM_CABLE_SPEC_ID}>★ {t('cable.customCable', 'Custom-Kabel')}…</option>
              {ranked.map(({ cable, level }) => {
                const icon = level === 'ok' ? '✓' : level === 'warn' ? '⚠' : '✕'
                return (
                  <option key={cable.id} value={cable.id}>
                    {icon} {cable.name} ({cable.connectorType})
                  </option>
                )
              })}
            </select>
          </label>

          {promptPickCableType && (
            <div className="rounded border border-amber-500/50 bg-amber-500/10 p-2 text-cp-xs text-amber-300">
              {t(
                'cable.dialog.pickTypeHint',
                'Kein passender Kabeltyp im Katalog. Bitte unten bewusst einen Steckertyp/Standard wählen oder einen neuen Kabeltyp anlegen — es wird sonst nur ein generisches Custom-Kabel erzeugt.',
              )}
            </div>
          )}

          {specId === CUSTOM_CABLE_SPEC_ID && (
            <div className="rounded border border-cp-border bg-cp-surface-3/60 p-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-cp-text-muted">
                {t('cable.customDefinition', 'Custom-Kabel-Definition')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  {t('cable.field.connectorType', 'Stecker-Typ')}
                  <select
                    value={customConnectorType}
                    onChange={async (e) => {
                      const v = e.target.value
                      if (v === '__new__') {
                        const name = (await promptDialog(t('cable.prompt.newConnectorType', 'Neuer Stecker-Typ (z.B. "Speakon NL4"):')))?.trim()
                        if (name) {
                          useUiStore.getState().addCustomConnectorType(name)
                          setCustomConnectorType(name as ConnectorType)
                        }
                        return
                      }
                      setCustomConnectorType(v as ConnectorType)
                    }}
                    className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
                  >
                    {allConnectorOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                        {customConnectorTypes.includes(type as string) ? ` (${t('cable.customSuffix', 'custom')})` : ''}
                      </option>
                    ))}
                    <option value="__new__">+ {t('cable.newConnectorTypeOption', 'Neuer Stecker-Typ')}…</option>
                  </select>
                </label>
                <label className="block">
                  {t('cable.field.signalStandard', 'Signal-Standard')}
                  <select
                    value={customStandard}
                    onChange={async (e) => {
                      const v = e.target.value
                      if (v === '__new__') {
                        const name = (await promptDialog(t('cable.prompt.newSignalStandard', 'Neuer Signal-Standard (z.B. "Madi 64ch"):')))?.trim()
                        if (name) {
                          useUiStore.getState().addCustomSignalStandard(name)
                          setCustomStandard(name as SignalStandard)
                          setStandard(name as SignalStandard)
                        }
                        return
                      }
                      const next = v as SignalStandard
                      setCustomStandard(next)
                      setStandard(next)
                    }}
                    className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
                  >
                    {allStandardOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                        {customSignalStandards.includes(item as string) ? ` (${t('cable.customSuffix', 'custom')})` : ''}
                      </option>
                    ))}
                    <option value="__new__">+ {t('cable.newSignalStandardOption', 'Neuer Signal-Standard')}…</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 block">
                {t('cable.field.maxLength', 'Empfohlene Maximallänge (m)')}
                <input
                  type="number"
                  min={0}
                  value={customMaxLength}
                  onChange={(e) => setCustomMaxLength(e.target.value ? Number(e.target.value) : '')}
                  placeholder={t('common.optional', 'Optional')}
                  className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  // Issue #64: persist the current Custom Cable as a
                  // reusable type. We prompt for a name (defaulting to
                  // the user's current `name`) and save the spec; the
                  // dialog then switches to the new spec so the user
                  // can see it landed in the dropdown.
                  const proposedName = name.trim() || `${customConnectorType} Custom`
                  const finalName = (await promptDialog(
                    t('cable.dialog.newTypeNamePrompt', 'Name für den neuen Kabel-Typ:'),
                    proposedName,
                  ))?.trim()
                  if (!finalName) return
                  const created = useUiStore.getState().addCustomCableSpec({
                    name: finalName,
                    connectorType: customConnectorType,
                    standards: [customStandard],
                    color,
                    maxLengthMeters: typeof customMaxLength === 'number' ? customMaxLength : undefined,
                    notes: notes || undefined,
                  })
                  setSpecId(created.id)
                  setName(created.name)
                }}
                className="mt-2 w-full rounded bg-sky-700 px-2 py-1 text-cp-xs font-medium text-white hover:bg-sky-600"
                title={t('cable.dialog.saveCustomTitle', 'Speichert diese Custom-Definition als wiederverwendbaren Kabeltyp in der Bibliothek.')}
              >
                <Icon icon={Save} size="xs" className="mr-1 inline-block align-text-bottom" />{t('cable.saveAsType', 'Als Kabel-Typ speichern')}…
              </button>
            </div>
          )}

          {selected.standards.length > 1 && (
            <label className="block">
              {t('cable.field.signalStandard', 'Signal-Standard')}
              <select
                value={standard ?? ''}
                onChange={(e) => setStandard(e.target.value as SignalStandard)}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
              >
                {selected.standards.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            {t('cable.field.name', 'Name')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              {t('cable.field.length', 'Länge (m)')}
              <input
                type="number"
                min={0}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
              />
            </label>
            <label className="block">
              {t('cable.field.color', 'Farbe')}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-cp-border bg-cp-surface-3 p-1"
              />
            </label>
          </div>

          <label className="block">
            {t('cable.field.notes', 'Notizen')}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
              rows={2}
            />
          </label>
        </div>

        {/* Status/warning area */}
        <div className="mt-3 space-y-1 text-cp-xs">
          {connectorMismatch === 'error' && (
            <div className="flex items-center gap-1.5 rounded bg-red-900/50 p-2 text-red-100">
              <Icon icon={XCircle} size="sm" />
              {connectorMessage}
            </div>
          )}
          {connectorMismatch === 'warn' && (
            <div className="flex items-center gap-1.5 rounded bg-amber-900/50 p-2 text-amber-100">
              <Icon icon={AlertTriangle} size="sm" />
              {connectorMessage}
            </div>
          )}
          {connectorMismatch === 'ok' && connectorMessage && (
            <div className="flex items-center gap-1.5 rounded bg-emerald-900/40 p-2 text-emerald-100">
              <Icon icon={Check} size="sm" />
              {connectorMessage}
            </div>
          )}
          {sdiMismatch?.level === 'warn' && (
            <div className="flex items-center gap-1.5 rounded bg-amber-900/50 p-2 text-amber-100">
              <Icon icon={AlertTriangle} size="sm" />
              {sdiMismatch.message}
            </div>
          )}
          {impedanceMismatch?.level === 'warn' && (
            <div className="flex items-center gap-1.5 rounded bg-amber-900/50 p-2 text-amber-100">
              <Icon icon={AlertTriangle} size="sm" />
              {impedanceMismatch.message}
            </div>
          )}
          {balanceWarning?.level === 'warn' && (
            <div className="flex items-center gap-1.5 rounded bg-amber-900/50 p-2 text-amber-100">
              <Icon icon={AlertTriangle} size="sm" />
              {balanceWarning.message}
            </div>
          )}
          {lengthWarning && (
            <div className="flex items-center gap-1.5 rounded bg-amber-900/50 p-2 text-amber-100">
              <Icon icon={AlertTriangle} size="sm" />
              {lengthWarning}
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2 text-cp-base">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5"
          >
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
          >
            {t('cable.dialog.create', 'Erstellen')}
          </button>
        </div>
      </div>
    </div>
  )
}
