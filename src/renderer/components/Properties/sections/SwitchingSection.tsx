import { useProjectStore } from '../../../store/projectStore'
import { useTranslation, format } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { deviceCrosspoints } from '../../../lib/deviceCrosspoints'
import {
  CONTROL_PROTOCOLS,
  CONTROL_ROLE_LABEL,
  PROTOCOL_INFO,
  type ControlProtocol,
  type ControlRole,
} from '../../../types/switcherControl'
import { portDisplayLabel } from '../../../lib/portLabel'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'

/**
 * Was dieses Gerät SCHALTET — herstellerneutral, je Anschluss (S-1).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM ES DIESE SEKTION GIBT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Bis 2026-09-08 endete im Plan jeder Signalweg am Mischer. Nicht, weil ein
 * Mischer nichts weiterleitet — er leitet ständig etwas weiter, das ist seine
 * Aufgabe —, sondern weil der Plan nur EINE Bauform von Kreuzpunkt kannte:
 * die Index-Tabelle des Videohubs. Ein Weg „Kamera 1 → ATEM → Aux 2 →
 * Monitor Regie" existierte damit nirgends, obwohl er auf jedem Aufbau liegt.
 *
 * Hier wird er eingetragen: je AUSGANG des Geräts, welcher EINGANG darauf
 * liegt. Keine Protokollnummern, keine Bus-Begriffe — die Anschlüsse, die im
 * Plan ohnehin stehen. Damit trägt dieselbe Tabelle einen Videohub, einen
 * ATEM-Aux, einen Bildmischer eines beliebigen Herstellers und ein Gerät, das
 * es noch nicht gibt.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM NICHTS DAVON GERATEN WIRD
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Es wäre naheliegend, bei einem Mischer „Programm liegt auf Eingang 1"
 * anzunehmen. Der Weg dahin führte über einen Namensabgleich (ADR-002), und
 * er fiele in die gefährliche Richtung: der Plan zeigte einen vollständigen
 * Weg zu einem Monitor, an dem in Wahrheit etwas anderes steht. Ohne Eintrag
 * endet der Weg am Gerät und sagt das — eine kürzere Antwort ist besser als
 * eine falsche.
 *
 * WAS HIER NICHT STEHT: was das Gerät gerade WIRKLICH schaltet. Das ist eine
 * Beobachtung und gehört nicht in den Plan (ADR-001, Invariante 14). Diese
 * Tabelle ist die ABSICHT — und genau deshalb kann sie neben dem gelesenen
 * Ist-Zustand stehen und ihn widerlegen.
 */
export const SwitchingSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)

  const kreuzpunkte = deviceCrosspoints(equipment)
  const gesetzt = kreuzpunkte.size

  // Ein Gerät ohne Ein- oder Ausgänge kann nichts schalten. Die Sektion
  // erscheint trotzdem und sagt, warum sie leer ist — eine Sektion, die
  // stumm verschwindet, sucht man an der falschen Stelle.
  const schaltbar = equipment.inputs.length > 0 && equipment.outputs.length > 0

  const protokoll = equipment.controlProtocol
  const info = protokoll ? PROTOCOL_INFO[protokoll] : undefined
  // Nur wo das Protokoll die Nummern NICHT selbst festlegt, gibt es etwas
  // einzutragen. Beim Videohub ist die Position die Nummer — ein Feld dafuer
  // waere eine Einladung, sie zu verstellen.
  const brauchtAdressen = info?.adressen === 'declared'

  const setzeAdresse = (
    portId: string,
    patch: { role?: ControlRole; address?: number } | null,
  ) => {
    const anpassen = (p: (typeof equipment.inputs)[number]) => {
      if (p.id !== portId) return p
      if (patch === null) return (({ control: _weg, ...rest }) => rest)(p)
      const alt = p.control
      const role = patch.role ?? alt?.role
      const address = patch.address ?? alt?.address
      if (!role || address === undefined) return { ...p, control: undefined }
      return { ...p, control: { role, address } }
    }
    updateEquipment(equipment.id, {
      inputs: equipment.inputs.map(anpassen),
      outputs: equipment.outputs.map(anpassen),
    })
  }

  const setze = (outputPortId: string, inputPortId: string) => {
    const naechste = { ...(equipment.plannedCrosspoints ?? {}) }
    if (inputPortId) naechste[outputPortId] = inputPortId
    else delete naechste[outputPortId]
    updateEquipment(equipment.id, {
      plannedCrosspoints: Object.keys(naechste).length > 0 ? naechste : undefined,
    })
  }

  const summary = schaltbar
    ? format(t('switching.summaryCount', '{n} von {total} Ausgängen'), {
        n: gesetzt,
        total: equipment.outputs.length,
      })
    : t('switching.summaryNone', 'nicht schaltbar')

  return (
    <SortableSection
      id="switching"
      title={t('switching.title', 'Schaltung (Signalweg)')}
      subtitle={summary}
    >
      {!schaltbar ? (
        <PanelHint
          className="text-cp-xs text-cp-text-muted"
          text={t(
            'switching.notSwitchable',
            'Dieses Gerät hat keine Ein- und Ausgänge zugleich und kann deshalb nichts schalten. Die Sektion bleibt sichtbar, damit klar ist, dass hier nichts fehlt.',
          )}
        />
      ) : (
        <>
          {/* Erst das Protokoll, dann die Nummern: ohne Protokoll ist gar
              nicht bekannt, WELCHE Nummern gebraucht werden. */}
          <label className="mb-2 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">
              {t('switching.protocol', 'Steuer-Protokoll')}
            </span>
            <select
              className="w-full rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
              value={protokoll ?? ''}
              onChange={(e) =>
                updateEquipment(equipment.id, {
                  controlProtocol: e.target.value
                    ? (e.target.value as ControlProtocol)
                    : undefined,
                })
              }
            >
              <option value="">{t('switching.protocolNone', 'keins — es wird nicht gesendet')}</option>
              {CONTROL_PROTOCOLS.map((k) => (
                <option key={k} value={k}>
                  {PROTOCOL_INFO[k].label}
                </option>
              ))}
            </select>
          </label>
          <PanelHint
            className="mb-2 text-cp-xs text-cp-text-muted"
            text={
              info
                ? info.hinweis
                : t(
                    'switching.protocolHint',
                    'Ohne Protokoll wird an dieses Gerät nichts gesendet. Welches ein Gerät spricht, lässt sich nicht am Namen ablesen — ein Gerät namens „Videohub Ersatz" bekäme sonst einen Videohub-Befehl, und was dort in Wahrheit horcht, weiss niemand.',
                  )
            }
          />
          <PanelHint
            className="mb-2 text-cp-xs text-cp-text-muted"
            text={t(
              'switching.hint',
              'Je Ausgang: welcher Eingang liegt darauf. Das ist die Absicht des Plans, nicht der gelesene Zustand des Geräts — ohne Eintrag endet der Signalweg hier, und das ist die ehrlichere Auskunft als ein geratener Weiterweg.',
            )}
          />
          <div className="space-y-1">
            {equipment.outputs.map((out) => (
              <label key={out.id} className="flex items-center gap-2 text-cp-xs">
                <span className="w-28 shrink-0 truncate text-cp-text-muted" title={portDisplayLabel(out)}>
                  {portDisplayLabel(out)}
                </span>
                <select
                  className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
                  value={kreuzpunkte.get(out.id) ?? ''}
                  onChange={(e) => setze(out.id, e.target.value)}
                >
                  <option value="">{t('switching.unset', 'nicht geplant')}</option>
                  {equipment.inputs.map((inp) => (
                    <option key={inp.id} value={inp.id}>
                      {portDisplayLabel(inp)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {brauchtAdressen && (
            <div className="mt-3">
              <div className="mb-1 text-cp-xs text-cp-text-muted">
                {t('switching.addresses', 'Nummern am Gerät')}
              </div>
              <div className="space-y-1">
                {[...equipment.inputs, ...equipment.outputs].map((p) => {
                  const istEingang = equipment.inputs.some((x) => x.id === p.id)
                  const erlaubt = (info?.rollen ?? []).filter((r) =>
                    istEingang ? r === 'input' : r !== 'input',
                  )
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-cp-xs">
                      <span className="w-24 shrink-0 truncate text-cp-text-muted" title={portDisplayLabel(p)}>
                        {portDisplayLabel(p)}
                      </span>
                      <select
                        className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                        value={p.control?.role ?? ''}
                        onChange={(e) =>
                          e.target.value
                            ? setzeAdresse(p.id, { role: e.target.value as ControlRole })
                            : setzeAdresse(p.id, null)
                        }
                      >
                        <option value="">{t('switching.roleNone', 'nicht eingetragen')}</option>
                        {erlaubt.map((r) => (
                          <option key={r} value={r}>
                            {CONTROL_ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        className="w-20 rounded border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                        value={p.control?.address ?? ''}
                        placeholder={t('switching.addressPlaceholder', 'Nr.')}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10)
                          setzeAdresse(p.id, Number.isInteger(n) && n >= 0 ? { address: n } : null)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <PanelHint
                className="mt-1 text-cp-xs text-cp-text-muted"
                text={t(
                  'switching.addressHint',
                  'Ohne Nummer wird an diesen Anschluss nicht gesendet. Beim ATEM ist die Quellen-Nummer eines Eingangs am Mischer abzulesen, ein Aux-Ausgang zählt in seiner eigenen Reihe, und Programm bzw. Vorschau tragen die Nummer des Mix-Effects. Die Position in der Liste sagt sie nicht.',
                )}
              />
            </div>
          )}
        </>
      )}
    </SortableSection>
  )
}
