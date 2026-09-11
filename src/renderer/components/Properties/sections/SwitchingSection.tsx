import { useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation, format } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { deviceCrosspoints } from '../../../lib/deviceCrosspoints'
import {
  CONTROL_PROTOCOLS,
  CONTROL_ROLE_LABEL,
  CONTROL_TARGETS,
  CONTROL_TARGET_HINWEIS,
  CONTROL_TARGET_LABEL,
  PROTOCOL_INFO,
  type ControlProtocol,
  type ControlRole,
} from '../../../types/switcherControl'
import {
  LEERE_COMPANION_KONFIG,
  leseVerbindungen,
  type CompanionConfig,
  type CompanionVerbindung,
} from '../../../lib/companionControl'
import { cablePlannerApi } from '../../../lib/bridge'
import {
  LEERE_TEXT_KONFIG,
  TEXT_VORLAGEN,
  ZEILEN_ANFANG,
  ZEILEN_ENDE,
  lesbar,
  pruefeVorlage,
  renderTextCommand,
  type TextProtocolConfig,
  type ZeilenAnfang,
  type ZeilenEnde,
} from '../../../lib/textProtocol'
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
  const textKonfig = equipment.controlText
  const companionKonfig = equipment.controlCompanion
  const istText = protokoll === 'text'
  const istCompanion = protokoll === 'companion'
  // Beim Text-Protokoll entscheidet die Konfiguration selbst, woher die
  // Nummern kommen — `PROTOCOL_INFO` kann das nicht wissen.
  const brauchtAdressen = istText
    ? textKonfig?.nummern === 'declared'
    : istCompanion
      ? companionKonfig?.nummern === 'declared'
      : info?.adressen === 'declared'

  const [verbindungen, setVerbindungen] = useState<CompanionVerbindung[]>([])
  const [verbindungenFehler, setVerbindungenFehler] = useState('')
  const [verbindungenLaufen, setVerbindungenLaufen] = useState(false)

  // Ein LESEN und kein Eingriff: es fragt Companion, welche Geraete dort
  // eingerichtet sind. Deshalb ohne Bestaetigung — und deshalb hier und
  // nicht im Schalt-Dialog.
  const holeVerbindungen = async () => {
    setVerbindungenLaufen(true)
    setVerbindungenFehler('')
    try {
      const antwort = await cablePlannerApi.switcher.companionConnections({
        host: equipment.ipAddress?.trim() ?? '',
        port: equipment.controlPort ?? 8000,
      })
      if (!antwort.ok) {
        setVerbindungen([])
        setVerbindungenFehler(antwort.message)
        return
      }
      const liste = leseVerbindungen(antwort.connections)
      setVerbindungen(liste)
      if (liste.length === 0) {
        setVerbindungenFehler(
          t('switching.companionEmpty', 'Companion answers, but has no connection configured.'),
        )
      }
    } catch (e) {
      setVerbindungen([])
      setVerbindungenFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setVerbindungenLaufen(false)
    }
  }

  const setzeCompanion = (patch: Partial<CompanionConfig>) => {
    updateEquipment(equipment.id, {
      controlCompanion: { ...LEERE_COMPANION_KONFIG, ...companionKonfig, ...patch },
    })
  }

  const setzeText = (patch: Partial<TextProtocolConfig>) => {
    updateEquipment(equipment.id, {
      controlText: { ...LEERE_TEXT_KONFIG, ...textKonfig, ...patch },
    })
  }

  // Die Probe: was ginge fuer den ERSTEN Ausgang raus. Sie steht neben dem
  // Feld, weil eine Vorlage ohne sichtbares Ergebnis eine Vermutung bleibt —
  // und weil ein unsichtbares Steuerzeichen genau der Unterschied zwischen
  // „das Geraet versteht es" und „das Geraet antwortet nicht" ist.
  const probe = (() => {
    if (!istText || !textKonfig) return null
    try {
      pruefeVorlage(textKonfig)
      return lesbar(
        renderTextCommand(textKonfig, [
          { outputIndex: 0, inputIndex: 1, outputAddress: 1, inputAddress: 2 },
        ]),
      ).trim()
    } catch (e) {
      return e instanceof Error ? `⚠ ${e.message}` : null
    }
  })()

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
    ? format(t('switching.summaryCount', '{n} of {total} outputs'), {
        n: gesetzt,
        total: equipment.outputs.length,
      })
    : t('switching.summaryNone', 'cannot switch')

  return (
    <SortableSection
      id="switching"
      title={t('switching.title', 'Switching (signal path)')}
      subtitle={summary}
    >
      {!schaltbar ? (
        <PanelHint
          className="text-cp-xs text-cp-text-muted"
          text={t(
            'switching.notSwitchable',
            'This device has no inputs and outputs at the same time and therefore cannot switch anything. The section stays visible so it is clear that nothing is missing.',
          )}
        />
      ) : (
        <>
          {/* Erst das Protokoll, dann die Nummern: ohne Protokoll ist gar
              nicht bekannt, WELCHE Nummern gebraucht werden. */}
          <label className="mb-2 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">
              {t('switching.protocol', 'Control protocol')}
            </span>
            <select
              className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
              value={protokoll ?? ''}
              onChange={(e) =>
                updateEquipment(equipment.id, {
                  controlProtocol: e.target.value
                    ? (e.target.value as ControlProtocol)
                    : undefined,
                })
              }
            >
              <option value="">{t('switching.protocolNone', 'none \u2014 nothing will be sent')}</option>
              {CONTROL_PROTOCOLS.map((k) => (
                <option key={k} value={k}>
                  {PROTOCOL_INFO[k].label}
                </option>
              ))}
            </select>
          </label>
          {/* S-5 — WOHIN gesteuert wird. Direkt unter dem Protokoll, weil es
              dieselbe Sorte Angabe ist: erklaert und nicht geraten. Aus der
              Adresse liesse es sich nicht ablesen — ein Pruefstand kann im
              selben Netz stehen, ein echter Mischer ueber einen Tunnel auf
              localhost liegen. */}
          {protokoll && (
            <>
              <label className="mb-2 block text-cp-xs">
                <span className="mb-1 block text-cp-text-muted">
                  {t('switching.target', 'Target')}
                </span>
                <select
                  className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
                  value={equipment.controlTarget ?? 'device'}
                  onChange={(e) =>
                    updateEquipment(equipment.id, {
                      // `'device'` wird NICHT geschrieben: es ist die Vorgabe,
                      // und ein Feld, das in jeder Datei „device" sagt, traegt
                      // nichts bei. Das Fehlen ist die Auskunft.
                      controlTarget:
                        e.target.value === 'simulator' ? 'simulator' : undefined,
                    })
                  }
                >
                  {CONTROL_TARGETS.map((k) => (
                    <option key={k} value={k}>
                      {CONTROL_TARGET_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <PanelHint
                className="mb-2 text-cp-xs text-cp-text-muted"
                text={CONTROL_TARGET_HINWEIS[equipment.controlTarget ?? 'device']}
              />
            </>
          )}
          <PanelHint
            className="mb-2 text-cp-xs text-cp-text-muted"
            text={
              info
                ? info.hinweis
                : t(
                    'switching.protocolHint',
                    'Without a protocol nothing is sent to this device. Which one a device speaks cannot be read off its name \u2014 a device called \u201cVideohub spare\u201d would otherwise get a Videohub command, and nobody knows what is really listening there.',
                  )
            }
          />
          <PanelHint
            className="mb-2 text-cp-xs text-cp-text-muted"
            text={t(
              'switching.hint',
              'Per output: which input sits on it. This is the plan\u2019s intent, not the state read back from the device \u2014 without an entry the signal path ends here, and that is the more honest answer than a guessed continuation.',
            )}
          />
          <div className="space-y-1">
            {equipment.outputs.map((out) => (
              <label key={out.id} className="flex items-center gap-2 text-cp-xs">
                <span className="w-28 shrink-0 truncate text-cp-text-muted" title={portDisplayLabel(out)}>
                  {portDisplayLabel(out)}
                </span>
                <select
                  className="min-w-0 flex-1 border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
                  value={kreuzpunkte.get(out.id) ?? ''}
                  onChange={(e) => setze(out.id, e.target.value)}
                >
                  <option value="">{t('switching.unset', 'not planned')}</option>
                  {equipment.inputs.map((inp) => (
                    <option key={inp.id} value={inp.id}>
                      {portDisplayLabel(inp)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {istCompanion && (
            <div className="mt-3 space-y-2">
              <PanelHint
                className="text-cp-xs text-cp-text-muted"
                text={t(
                  'switching.companionHow',
                  'How to set this up: in Companion create one button whose action sets the device\u2019s route, and in that action point output and input at two custom variables (written $(internal:custom_NAME)). Here you enter where that button sits and the two variable names \u2014 the plan sets them and presses.',
                )}
              />

              <div className="flex flex-wrap items-end gap-2 text-cp-xs">
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.companionHost', 'Companion (IP)')}
                  </span>
                  <input
                    className="w-32 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={equipment.ipAddress ?? ''}
                    placeholder="127.0.0.1"
                    onChange={(e) => updateEquipment(equipment.id, { ipAddress: e.target.value })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textPort', 'Port')}
                  </span>
                  <input
                    type="number"
                    className="w-20 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={equipment.controlPort ?? ''}
                    placeholder="8000"
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      updateEquipment(equipment.id, {
                        controlPort: Number.isInteger(n) && n > 0 ? n : undefined,
                      })
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void holeVerbindungen()}
                  disabled={verbindungenLaufen}
                  className="av-focus border border-cp-border px-2 py-1 hover:bg-cp-surface-3 disabled:opacity-40"
                >
                  {verbindungenLaufen
                    ? t('switching.companionLoading', 'asking \u2026')
                    : t('switching.companionFetch', 'Fetch connections')}
                </button>
              </div>

              {verbindungenFehler && (
                <div className="text-cp-xs text-cp-warn">{verbindungenFehler}</div>
              )}
              {verbindungen.length > 0 && (
                <div className="text-cp-xs">
                  <div className="mb-1 text-cp-text-muted">
                    {t('switching.companionFound', 'Configured in this Companion:')}
                  </div>
                  <ul className="space-y-0.5">
                    {verbindungen.map((v) => (
                      <li key={v.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setzeCompanion({
                              connectionLabel: v.label,
                              connectionModule: v.moduleId,
                            })
                          }
                          className="av-focus border border-cp-border px-1.5 py-0.5 hover:bg-cp-surface-3"
                        >
                          {t('switching.companionNote', 'note')}
                        </button>
                        <span className="truncate">
                          {v.label}{' '}
                          <span className="text-cp-text-faint">
                            ({v.moduleId}
                            {v.enabled ? '' : t('switching.companionOff', ', off')})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2 text-cp-xs">
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.companionPage', 'Page')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    className="w-16 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={companionKonfig?.knopf.page ?? 1}
                    onChange={(e) =>
                      setzeCompanion({
                        knopf: {
                          ...(companionKonfig?.knopf ?? LEERE_COMPANION_KONFIG.knopf),
                          page: parseInt(e.target.value, 10) || 1,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.companionRow', 'Row')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="w-16 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={companionKonfig?.knopf.row ?? 0}
                    onChange={(e) =>
                      setzeCompanion({
                        knopf: {
                          ...(companionKonfig?.knopf ?? LEERE_COMPANION_KONFIG.knopf),
                          row: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.companionColumn', 'Column')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="w-16 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={companionKonfig?.knopf.column ?? 0}
                    onChange={(e) =>
                      setzeCompanion({
                        knopf: {
                          ...(companionKonfig?.knopf ?? LEERE_COMPANION_KONFIG.knopf),
                          column: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-2 text-cp-xs">
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.companionVarOut', 'Output variable')}
                  </span>
                  <input
                    className="w-32 border border-cp-border bg-cp-surface-2 px-1 py-1 font-mono text-cp-text"
                    value={companionKonfig?.varOut ?? ''}
                    placeholder="cp_out"
                    onChange={(e) => setzeCompanion({ varOut: e.target.value })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.companionVarIn', 'Input variable')}
                  </span>
                  <input
                    className="w-32 border border-cp-border bg-cp-surface-2 px-1 py-1 font-mono text-cp-text"
                    value={companionKonfig?.varIn ?? ''}
                    placeholder="cp_in"
                    onChange={(e) => setzeCompanion({ varIn: e.target.value })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textBase', 'Counts from')}
                  </span>
                  <select
                    className="border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={String(companionKonfig?.basis ?? 1)}
                    onChange={(e) => setzeCompanion({ basis: e.target.value === '0' ? 0 : 1 })}
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textNumbers', 'Numbers')}
                  </span>
                  <select
                    className="border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={companionKonfig?.nummern ?? 'position'}
                    onChange={(e) =>
                      setzeCompanion({
                        nummern: e.target.value === 'declared' ? 'declared' : 'position',
                      })
                    }
                  >
                    <option value="position">
                      {t('switching.textNumbersPos', 'position in the list')}
                    </option>
                    <option value="declared">
                      {t('switching.textNumbersDecl', 'entered per port')}
                    </option>
                  </select>
                </label>
              </div>

              {companionKonfig?.connectionLabel && (
                <div className="text-cp-xs text-cp-text-muted">
                  {t('switching.companionNoted', 'Noted:')}{' '}
                  {companionKonfig.connectionLabel}
                  {companionKonfig.connectionModule ? ` (${companionKonfig.connectionModule})` : ''}
                  {' — '}
                  {t(
                    'switching.companionNoteWarn',
                    'a note only. What the button really does lives in Companion; whoever rebuilds it there makes this line wrong.',
                  )}
                </div>
              )}
            </div>
          )}

          {istText && (
            <div className="mt-3 space-y-2">
              <label className="block text-cp-xs">
                <span className="mb-1 block text-cp-text-muted">
                  {t('switching.textTemplate', 'Command line (from the device manual)')}
                </span>
                <input
                  className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 font-mono text-cp-text"
                  value={textKonfig?.vorlage ?? ''}
                  placeholder=".S{level}{out},{in}"
                  onChange={(e) => setzeText({ vorlage: e.target.value })}
                />
              </label>

              <div className="flex flex-wrap items-end gap-2 text-cp-xs">
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textStart', 'Line start')}
                  </span>
                  <select
                    className="border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={textKonfig?.anfang ?? 'none'}
                    onChange={(e) => setzeText({ anfang: e.target.value as ZeilenAnfang })}
                  >
                    {(Object.keys(ZEILEN_ANFANG) as ZeilenAnfang[]).map((k) => (
                      <option key={k} value={k}>
                        {ZEILEN_ANFANG[k].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textEnd', 'Line end')}
                  </span>
                  <select
                    className="border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={textKonfig?.ende ?? 'cr'}
                    onChange={(e) => setzeText({ ende: e.target.value as ZeilenEnde })}
                  >
                    {(Object.keys(ZEILEN_ENDE) as ZeilenEnde[]).map((k) => (
                      <option key={k} value={k}>
                        {ZEILEN_ENDE[k].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textBase', 'Counts from')}
                  </span>
                  <select
                    className="border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={String(textKonfig?.basis ?? 1)}
                    onChange={(e) => setzeText({ basis: e.target.value === '0' ? 0 : 1 })}
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textNumbers', 'Numbers')}
                  </span>
                  <select
                    className="border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={textKonfig?.nummern ?? 'position'}
                    onChange={(e) =>
                      setzeText({ nummern: e.target.value === 'declared' ? 'declared' : 'position' })
                    }
                  >
                    <option value="position">
                      {t('switching.textNumbersPos', 'position in the list')}
                    </option>
                    <option value="declared">
                      {t('switching.textNumbersDecl', 'entered per port')}
                    </option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textLevel', 'Level')}
                  </span>
                  <input
                    className="w-14 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={textKonfig?.level ?? ''}
                    onChange={(e) => setzeText({ level: e.target.value })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textAck', 'Ack')}
                  </span>
                  <input
                    className="w-20 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={textKonfig?.quittung ?? ''}
                    placeholder={t('switching.textAckNone', 'none')}
                    onChange={(e) => setzeText({ quittung: e.target.value })}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-cp-text-muted">
                    {t('switching.textPort', 'Port')}
                  </span>
                  <input
                    type="number"
                    className="w-20 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                    value={equipment.controlPort ?? ''}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      updateEquipment(equipment.id, {
                        controlPort: Number.isInteger(n) && n > 0 ? n : undefined,
                      })
                    }}
                  />
                </label>
              </div>

              {probe && (
                <div className="text-cp-xs">
                  <span className="text-cp-text-muted">
                    {t('switching.textProbe', 'This is what would go out (output 1, input 2):')}
                  </span>{' '}
                  <code className="bg-cp-surface-3 px-1">{probe}</code>
                </div>
              )}

              {/* Vorlagen als STARTPUNKT, mit ihrer Herkunft. Eine Vorlage aus
                  dem Gedaechtnis waere schlimmer als keine: sie saehe aus wie
                  geprueftes Wissen und ginge als Befehl raus. */}
              <div className="flex flex-wrap items-center gap-1 text-cp-xs">
                <span className="text-cp-text-muted">
                  {t('switching.textPresets', 'Apply template:')}
                </span>
                {TEXT_VORLAGEN.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    title={v.herkunft}
                    onClick={() => {
                      updateEquipment(equipment.id, {
                        controlText: { ...v.config },
                        controlPort: v.port,
                      })
                    }}
                    className="av-focus border border-cp-border px-1.5 py-0.5 hover:bg-cp-surface-3"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <PanelHint
                className="text-cp-xs text-cp-text-muted"
                text={t(
                  'switching.textHint',
                  'The templates are a starting point, not an assurance \u2014 their provenance is in the tooltip, and they belong checked against the manual. Before sending, the switching dialog shows the text once more verbatim; control characters are named there, because an invisible STX is the difference between \u201cunderstood\u201d and \u201cno answer\u201d.',
                )}
              />
            </div>
          )}

          {brauchtAdressen && (
            <div className="mt-3">
              <div className="mb-1 text-cp-xs text-cp-text-muted">
                {t('switching.addresses', 'Numbers on the device')}
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
                        className="min-w-0 flex-1 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                        value={p.control?.role ?? ''}
                        onChange={(e) =>
                          e.target.value
                            ? setzeAdresse(p.id, { role: e.target.value as ControlRole })
                            : setzeAdresse(p.id, null)
                        }
                      >
                        <option value="">{t('switching.roleNone', 'not entered')}</option>
                        {erlaubt.map((r) => (
                          <option key={r} value={r}>
                            {CONTROL_ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        className="w-20 border border-cp-border bg-cp-surface-2 px-1 py-1 text-cp-text"
                        value={p.control?.address ?? ''}
                        placeholder={t('switching.addressPlaceholder', 'No.')}
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
                  'Without a number nothing is sent to this port. On the ATEM the source number of an input is read off the switcher, an aux output counts in its own row, and program/preview carry the mix-effect number. The position in the list does not tell you.',
                )}
              />
            </div>
          )}
        </>
      )}
    </SortableSection>
  )
}
