// ───────────────────────────────────────────────────────────────────────────
// #917 — Stammdaten: eigene Steckertypen, Signalstandards und Kabel-Ebenen an
// EINER Stelle.
//
// Angelegt werden konnten sie schon vorher — im Port-Editor, im Kabeltyp-
// Dialog, an den Ebenen-Chips. Gesehen hat man sie nirgends beieinander, und
// entfernen ging nur dort, wo man sie zufaellig wiederfand. Eingebaute
// Eintraege stehen daneben, damit klar ist, was es schon gibt; entfernen
// lassen sich nur die eigenen.
//
// Sie reisen mit der geteilten Bibliothek (Netzwerk-Sync), damit ein Team
// dieselben Namen benutzt und nicht jeder seine eigene „LC-Duplex"-Schreibung.
// ───────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { SettingsCard } from '../SettingsCard'
import { PanelHint } from '../../shared/PanelHint'
import { useUiStore } from '../../../store/uiStore'
import { confirmDialog } from '../../../lib/confirmDialog'
import { format, useTranslation } from '../../../lib/i18n'
import { schonVorhanden } from '../../../lib/stammdaten'
import { ALL_CONNECTOR_TYPES } from '../../../types/equipment'
import { ALL_SIGNAL_STANDARDS } from '../../../types/cableSpec'
import { STANDARD_LAYERS } from '../../../lib/cableLayers'

const Liste = ({
  eingebaut,
  eigene,
  onAdd,
  onRemove,
  platzhalter,
}: {
  eingebaut: readonly string[]
  eigene: readonly string[]
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  platzhalter: string
}) => {
  const t = useTranslation()
  const [neu, setNeu] = useState('')
  const doppelt = neu.trim() !== '' && schonVorhanden(neu, eingebaut, eigene)
  const hinzufuegen = () => {
    if (!neu.trim() || doppelt) return
    onAdd(neu.trim())
    setNeu('')
  }
  return (
    <div className="flex flex-col gap-2 text-cp-xs">
      <div className="flex flex-wrap gap-1">
        {eigene.map((n) => (
          <span key={n} className="inline-flex items-center gap-1 border border-cp-accent px-1.5 py-0.5 text-cp-text">
            {n}
            <button
              type="button"
              onClick={async () => {
                if (await confirmDialog(format(t('stammdaten.removeConfirm', 'Remove "{name}"?'), { name: n }), { destructive: true })) {
                  onRemove(n)
                }
              }}
              aria-label={format(t('stammdaten.remove', 'Remove {name}'), { name: n })}
              className="text-cp-text-muted hover:text-cp-danger"
            >
              <Icon icon={Trash2} size="xs" />
            </button>
          </span>
        ))}
        {eigene.length === 0 && <span className="text-cp-text-faint">{t('stammdaten.noneOwn', 'No own entries yet.')}</span>}
      </div>
      <div className="flex items-center gap-1">
        <input
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') hinzufuegen()
          }}
          placeholder={platzhalter}
          className="w-56 border border-cp-border bg-cp-surface-3 px-1.5 py-1"
        />
        <button
          type="button"
          onClick={hinzufuegen}
          disabled={!neu.trim() || doppelt}
          className="border border-cp-border px-2 py-1 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
        >
          {t('stammdaten.add', 'Add')}
        </button>
        {doppelt && <span className="text-cp-warn">{t('stammdaten.exists', 'Already exists.')}</span>}
      </div>
      <details>
        <summary className="cursor-pointer text-cp-text-muted">
          {format(t('stammdaten.builtIn', 'Built in ({n})'), { n: eingebaut.length })}
        </summary>
        <p className="mt-1 text-cp-text-faint">{eingebaut.join(' · ')}</p>
      </details>
    </div>
  )
}

export const StammdatenTab = () => {
  const t = useTranslation()
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)
  const customSignalStandards = useUiStore((s) => s.customSignalStandards)
  const customLayers = useUiStore((s) => s.customLayers)
  const addCustomConnectorType = useUiStore((s) => s.addCustomConnectorType)
  const removeCustomConnectorType = useUiStore((s) => s.removeCustomConnectorType)
  const addCustomSignalStandard = useUiStore((s) => s.addCustomSignalStandard)
  const removeCustomSignalStandard = useUiStore((s) => s.removeCustomSignalStandard)
  const addCustomLayer = useUiStore((s) => s.addCustomLayer)
  const removeCustomLayer = useUiStore((s) => s.removeCustomLayer)

  return (
    <div className="flex flex-col gap-3">
      <PanelHint
        className="text-cp-xs text-cp-text-muted"
        text={t(
          'stammdaten.intro',
          'Your own connector types, signal standards and cable layers — in one place. They appear in every picker next to the built-in ones and travel with the shared library (Network sync), so a team uses the same names.',
        )}
      />
      <SettingsCard title={t('stammdaten.connectors', 'Connector types')}>
        <Liste
          eingebaut={ALL_CONNECTOR_TYPES}
          eigene={customConnectorTypes}
          onAdd={addCustomConnectorType}
          onRemove={removeCustomConnectorType}
          platzhalter={t('stammdaten.connectorPlaceholder', 'e.g. opticalCON DUO')}
        />
      </SettingsCard>
      <SettingsCard title={t('stammdaten.standards', 'Signal standards')}>
        <Liste
          eingebaut={ALL_SIGNAL_STANDARDS}
          eigene={customSignalStandards}
          onAdd={addCustomSignalStandard}
          onRemove={removeCustomSignalStandard}
          platzhalter={t('stammdaten.standardPlaceholder', 'e.g. SMPTE 2110-20')}
        />
      </SettingsCard>
      <SettingsCard title={t('stammdaten.layers', 'Cable layers')}>
        <Liste
          eingebaut={STANDARD_LAYERS}
          eigene={customLayers}
          onAdd={addCustomLayer}
          onRemove={removeCustomLayer}
          platzhalter={t('stammdaten.layerPlaceholder', 'e.g. intercom')}
        />
      </SettingsCard>
    </div>
  )
}
