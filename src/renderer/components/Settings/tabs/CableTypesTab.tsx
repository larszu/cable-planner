// ───────────────────────────────────────────────────────────────────────────
// Kabeltypen — der Einstellungen-Tab (#836).
//
// Meldung des Eigentuemers, 2026-09-10: „Neue kabeltypen anlegen muss
// eigentlich in den Einstellungen sein und nicht links in der Geräte
// seitenleiste."
//
// ─── WARUM DAS MEHR IST ALS EIN VERSCHOBENER KNOPF ─────────────────────────
//
// Die Geraete-Seitenleiste beantwortet die Frage „welches Kabel nehme ich
// jetzt". Ein Kabeltyp anzulegen beantwortet eine andere: „was kennt dieses
// Werkzeug ueberhaupt". Die zweite stellt man einmal beim Einrichten, die
// erste zwanzigmal am Tag — und wer sie am selben Ort bedient, findet die
// haeufige zwischen der seltenen.
//
// ─── DIE ZWEI ARTEN, DIE HIER NEBENEINANDER STEHEN ─────────────────────────
//
// EIGENE Typen liegen in `customCableSpecs` und gehoeren dem Nutzer: sie
// lassen sich anlegen, aendern und LOESCHEN.
//
// EINGEBAUTE Typen kommen aus `cableCatalog` und lassen sich nur
// UEBERSCHREIBEN (`cableSpecOverrides`). Ein eingebauter Typ verschwindet
// nicht — er traegt dann eine abweichende Angabe, und der Ruecksetz-Griff
// stellt die Vorgabe wieder her. Der Unterschied steht in der Liste, weil er
// beim Loeschen-Wollen sonst als Fehler aussieht.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { SettingsCard } from '../SettingsCard'
import { PanelHint } from '../../shared/PanelHint'
import { CableTypeEditor } from '../../Cable/CableTypeEditor'
import { cableCatalog } from '../../../types/cableSpec'
import type { CableSpec } from '../../../types/cableSpec'
import { useUiStore } from '../../../store/uiStore'
import { confirmDialog } from '../../../lib/confirmDialog'
import { format, useTranslation } from '../../../lib/i18n'

export const CableTypesTab = () => {
  const t = useTranslation()
  const customCableSpecs = useUiStore((s) => s.customCableSpecs)
  const cableSpecOverrides = useUiStore((s) => s.cableSpecOverrides)
  const addCustomCableSpec = useUiStore((s) => s.addCustomCableSpec)
  const updateCustomCableSpec = useUiStore((s) => s.updateCustomCableSpec)
  const removeCustomCableSpec = useUiStore((s) => s.removeCustomCableSpec)
  const setCableSpecOverride = useUiStore((s) => s.setCableSpecOverride)
  const clearCableSpecOverride = useUiStore((s) => s.clearCableSpecOverride)

  /**
   * `null` = zu, `undefined` = offen fuer einen NEUEN Typ, ein Spec = offen
   * zum Bearbeiten. Dieselbe Dreiteilung wie in der Seitenleiste — sie
   * unterscheidet „nichts offen" von „offen ohne Vorlage", und das sind zwei
   * verschiedene Zustaende.
   */
  const [editing, setEditing] = useState<CableSpec | null | undefined>(null)

  // Die geaenderten eingebauten Typen, mit ihrer heutigen Fassung.
  const geaenderteEingebaute = useMemo(
    () =>
      cableCatalog
        .filter((c) => cableSpecOverrides[c.id])
        .map((c) => ({ ...c, ...cableSpecOverrides[c.id] })),
    [cableSpecOverrides],
  )

  const alleNamen = useMemo(
    () => [...cableCatalog.map((c) => c.name), ...customCableSpecs.map((c) => c.name)],
    [customCableSpecs],
  )

  const zeile = (spec: CableSpec, eigen: boolean) => (
    <div
      key={spec.id}
      className="flex flex-wrap items-center gap-2 border-b border-cp-border-muted py-1 last:border-b-0"
    >
      <span
        className="inline-block h-3 w-3 shrink-0"
        style={{ background: spec.color }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-cp-base text-cp-text-bright">{spec.name}</span>
      <span className="text-cp-xs text-cp-text-muted">{spec.connectorType}</span>
      <button
        type="button"
        onClick={() => setEditing(spec)}
        className="bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
        title={t('settings.cableTypes.edit', 'Edit')}
        aria-label={format(t('settings.cableTypes.editAria', 'Edit {name}'), { name: spec.name })}
      >
        <Icon icon={Pencil} size="xs" />
      </button>
      {eigen ? (
        <button
          type="button"
          onClick={async () => {
            const ok = await confirmDialog(
              format(
                t('settings.cableTypes.confirmDelete', 'Delete cable type "{name}"?'),
                { name: spec.name },
              ),
            )
            if (ok) removeCustomCableSpec(spec.id)
          }}
          className="bg-red-900/60 px-2 py-1 text-cp-xs hover:bg-red-800"
          title={t('settings.cableTypes.delete', 'Delete')}
          aria-label={format(t('settings.cableTypes.deleteAria', 'Delete {name}'), { name: spec.name })}
        >
          <Icon icon={Trash2} size="xs" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => clearCableSpecOverride(spec.id)}
          className="bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          title={t('settings.cableTypes.reset', 'Reset to the built-in default')}
          aria-label={format(t('settings.cableTypes.resetAria', 'Reset {name}'), { name: spec.name })}
        >
          <Icon icon={RotateCcw} size="xs" />
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      <PanelHint
        className="text-cp-base text-cp-text-secondary"
        text={t(
          'settings.cableTypes.intro',
          'Cable types are the presets the plan offers you: connector, signal standards, colour and maximum length. They belong to this installation, not to a single project.',
        )}
      />

      <SettingsCard
        title={t('settings.cableTypes.ownTitle', 'Your own cable types')}
        description={t(
          'settings.cableTypes.ownDesc',
          'Created here and available in every project on this machine.',
        )}
      >
        <button
          type="button"
          onClick={() => setEditing(undefined)}
          className="mb-2 bg-emerald-700 px-2 py-1 text-cp-xs text-white hover:bg-emerald-600"
        >
          {t('settings.cableTypes.new', '+ New cable type')}
        </button>
        {customCableSpecs.length === 0 ? (
          <p className="text-cp-xs text-cp-text-muted">
            {t('settings.cableTypes.ownEmpty', 'None yet — the built-in catalogue is used as is.')}
          </p>
        ) : (
          <div>{customCableSpecs.map((c) => zeile(c, true))}</div>
        )}
      </SettingsCard>

      <SettingsCard
        title={t('settings.cableTypes.overriddenTitle', 'Changed built-in types')}
        description={t(
          'settings.cableTypes.overriddenDesc',
          'A built-in type is never deleted, only overridden. Reset puts the shipped values back.',
        )}
      >
        {geaenderteEingebaute.length === 0 ? (
          <p className="text-cp-xs text-cp-text-muted">
            {t('settings.cableTypes.overriddenEmpty', 'None — every built-in type is unchanged.')}
          </p>
        ) : (
          <div>{geaenderteEingebaute.map((c) => zeile(c, false))}</div>
        )}
      </SettingsCard>

      <PanelHint
        className="text-cp-xs text-cp-text-muted"
        text={t(
          'settings.cableTypes.sidebarHint',
          'The cable library in the left sidebar still edits a type in place — it shows what you pick from while planning.',
        )}
      />

      <CableTypeEditor
        open={editing !== null}
        initial={editing ?? null}
        existingNames={alleNamen}
        onCancel={() => setEditing(null)}
        onSave={(spec) => {
          if (editing) {
            // Ein eigener Typ wird geaendert, ein eingebauter ueberschrieben.
            // Die Maske kennt den Unterschied nicht — das ist der Grund, warum
            // sie fuer beides taugt.
            if (editing.id.startsWith('custom-cable:')) updateCustomCableSpec(editing.id, spec)
            else setCableSpecOverride(editing.id, spec)
          } else {
            addCustomCableSpec(spec)
          }
          setEditing(null)
        }}
      />
    </div>
  )
}
