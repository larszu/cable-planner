import { useMemo, useState } from 'react'
import { PanelHint } from '../shared/PanelHint'
import { AlertTriangle, Download, Layers, Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { downloadBlob } from '../../lib/downloadBlob'
import { toCsv } from '../../lib/csv'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import {
  REFUSAL_TEXT,
  addressTemplateFindings,
  addressTemplateTable,
  proposeReaddress,
  resolveLayers,
} from '../../lib/addressTemplate'
import { ROLE_TEXT } from '../../lib/networkSegments'
import { NETWORK_INTERFACE_ROLES, type NetworkInterfaceRole } from '../../types/network'
import {
  ADDRESS_RANGE_KINDS,
  type AddressLayerKind,
  type AddressRangeKind,
} from '../../types/addressTemplate'

/**
 * BEDARF 20 — der stehende Plan des Wagens und die Ueberlagerung des Hauses.
 *
 *   > Layerable address-range templates: a truck/rig standing plan plus a
 *   > per-venue overlay, with live conflict validation.
 *
 * DREI DINGE, DIE DIESE OBERFLAECHE BEWUSST SO MACHT:
 *
 * 1. **Der geltende Satz steht ueber den Ebenen, nicht unter ihnen.** Was
 *    zaehlt, ist das Ergebnis der Ueberlagerung — und daneben, in derselben
 *    Zeile, woher es kommt und was es ersetzt. Wer nur die Ebenen sieht, muss
 *    die Ueberlagerung im Kopf machen, und genau dabei entsteht der Fehler,
 *    den dieses Panel verhindern soll.
 *
 * 2. **Der Umzugs-Vorschlag hat einen Knopf JE ZEILE.** Es gibt kein „alle
 *    uebernehmen". Der Bedarf verlangt einen Vorschlag; ein Knopf, der
 *    zwanzig Adressen auf einmal umschreibt, ist eine Vergabe mit
 *    Bestaetigungsdialog. Dieselbe Haltung wie bei den PTZ-Presets
 *    (Bedarf 96): ein Preset darf nie still ueberschreiben.
 *
 * 3. **Abgelehnte Vorschlaege stehen mit ihrem Grund da**, statt zu fehlen.
 *    Eine kurze Liste sieht aus wie „alles in Ordnung"; „waere die
 *    Broadcast-Adresse" ist eine Auskunft.
 */
export const AddressTemplatePanel = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const gespeichert = useProjectStore((s) => s.project.addressLayers)
  const layers = useMemo(() => gespeichert ?? [], [gespeichert])
  const addAddressLayer = useProjectStore((s) => s.addAddressLayer)
  const updateAddressLayer = useProjectStore((s) => s.updateAddressLayer)
  const removeAddressLayer = useProjectStore((s) => s.removeAddressLayer)
  const addAddressRange = useProjectStore((s) => s.addAddressRange)
  const updateAddressRange = useProjectStore((s) => s.updateAddressRange)
  const removeAddressRange = useProjectStore((s) => s.removeAddressRange)
  const applyReaddress = useProjectStore((s) => s.applyReaddress)

  const [neuerBereich, setNeuerBereich] = useState<Record<string, string>>({})

  const geltend = useMemo(() => resolveLayers(layers), [layers])
  const findings = useMemo(
    () => addressTemplateFindings(layers, equipment),
    [layers, equipment],
  )
  const vorschlaege = useMemo(
    () => proposeReaddress(layers, equipment).filter((v) => v.to || v.refusal !== 'no-range'),
    [layers, equipment],
  )

  const laden = () =>
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'adressbereiche', 'csv'),
      toCsv(addressTemplateTable(layers).headers, addressTemplateTable(layers).rows as never),
      'text/csv;charset=utf-8',
    )

  const inputCls = 'rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-cp-xs'

  const LAYER_LABEL: Record<AddressLayerKind, string> = {
    standing: t('addrTpl.layer.standing', 'standing plan'),
    venue: t('addrTpl.layer.venue', 'venue'),
  }
  const KIND_LABEL: Record<AddressRangeKind, string> = {
    container: t('addrTpl.kind.container', 'container'),
    assignable: t('addrTpl.kind.assignable', 'assignable'),
  }

  return (
    <div className="rounded border border-cp-border bg-cp-surface-2 p-2 text-cp-xs">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-cp-text-secondary">
          {t('addrTpl.title', 'Address ranges (standing plan + venue overlay)')}
        </span>
        <button
          type="button"
          onClick={() =>
            addAddressLayer({ name: t('addrTpl.newStanding', 'Truck'), kind: 'standing' })
          }
          className="inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3"
        >
          <Icon icon={Plus} size="xs" />
          {t('addrTpl.addStanding', 'standing layer')}
        </button>
        <button
          type="button"
          onClick={() => addAddressLayer({ name: t('addrTpl.newVenue', 'Venue'), kind: 'venue' })}
          className="inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3"
        >
          <Icon icon={Layers} size="xs" />
          {t('addrTpl.addVenue', 'venue layer')}
        </button>
        <button
          type="button"
          onClick={laden}
          className="ml-auto inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3"
        >
          <Icon icon={Download} size="xs" />
          {t('addrTpl.export', 'Ranges')}
        </button>
      </div>

      <PanelHint
        text={t(
          'addrTpl.hint',
          'The venue layer replaces a standing range carrying the same key and leaves all others in force. Nothing is assigned on its own \u2014 the move is proposed and adopted one interface at a time.',
        )}
      />

      {layers.length === 0 ? (
        <p className="text-cp-text-muted">
          {t('addrTpl.empty', 'No layer created yet.')}
        </p>
      ) : (
        layers.map((l) => (
          <div key={l.id} className="mb-2 rounded border border-cp-border-muted p-1">
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <span className="rounded bg-cp-surface-3 px-1 text-cp-text-secondary">
                {LAYER_LABEL[l.kind]}
              </span>
              <input
                value={l.name}
                onChange={(e) => updateAddressLayer(l.id, { name: e.target.value })}
                placeholder={t('addrTpl.layerNamePh', 'OB truck 2')}
                className={`w-52 ${inputCls}`}
              />
              <input
                value={neuerBereich[l.id] ?? ''}
                onChange={(e) => setNeuerBereich((s) => ({ ...s, [l.id]: e.target.value }))}
                placeholder={t('addrTpl.newRangePh', '10.2.0.0/16')}
                className={`w-32 ${inputCls} font-mono`}
              />
              <button
                type="button"
                onClick={() => {
                  const cidr = (neuerBereich[l.id] ?? '').trim()
                  if (!cidr) return
                  if (addAddressRange(l.id, { cidr })) {
                    setNeuerBereich((s) => ({ ...s, [l.id]: '' }))
                  }
                }}
                className="inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3"
              >
                <Icon icon={Plus} size="xs" />
                {t('addrTpl.addRange', 'Range')}
              </button>
              <button
                type="button"
                onClick={() => removeAddressLayer(l.id)}
                title={t('addrTpl.removeLayer', 'Remove layer')}
                className="ml-auto rounded border border-cp-border px-1 py-0.5 hover:bg-cp-surface-3"
              >
                <Icon icon={Trash2} size="xs" />
              </button>
            </div>

            {l.ranges.length === 0 ? (
              <p className="text-cp-text-muted">
                {t('addrTpl.noRanges', 'No range in this layer yet.')}
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-cp-text-secondary">
                    <th className="px-1 py-1">{t('addrTpl.col.key', 'Key')}</th>
                    <th className="px-1 py-1">{t('addrTpl.col.name', 'Range')}</th>
                    <th className="px-1 py-1">{t('addrTpl.col.cidr', 'CIDR')}</th>
                    <th className="px-1 py-1">{t('addrTpl.col.kind', 'Kind')}</th>
                    <th className="px-1 py-1">{t('addrTpl.col.role', 'Purpose')}</th>
                    <th className="px-1 py-1">{t('addrTpl.col.vlan', 'VLAN')}</th>
                    <th className="px-1 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {l.ranges.map((r) => (
                    <tr key={r.id} className="border-t border-cp-border-muted">
                      <td className="px-1 py-1">
                        <input
                          value={r.key}
                          onChange={(e) => updateAddressRange(l.id, r.id, { key: e.target.value })}
                          placeholder={t('addrTpl.keyPh', 'control')}
                          className={`w-24 ${inputCls} font-mono`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={r.name}
                          onChange={(e) => updateAddressRange(l.id, r.id, { name: e.target.value })}
                          placeholder={t('addrTpl.namePh', 'Control')}
                          className={`w-28 ${inputCls}`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          defaultValue={r.cidr}
                          key={r.cidr}
                          onBlur={(e) => updateAddressRange(l.id, r.id, { cidr: e.target.value })}
                          className={`w-32 ${inputCls} font-mono`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={r.kind}
                          onChange={(e) =>
                            updateAddressRange(l.id, r.id, {
                              kind: e.target.value as AddressRangeKind,
                            })
                          }
                          className={inputCls}
                        >
                          {ADDRESS_RANGE_KINDS.map((k) => (
                            <option key={k} value={k}>
                              {KIND_LABEL[k]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={r.role}
                          onChange={(e) =>
                            updateAddressRange(l.id, r.id, {
                              role: e.target.value as NetworkInterfaceRole,
                            })
                          }
                          className={inputCls}
                        >
                          {NETWORK_INTERFACE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {t(`nic.role.${role}`, ROLE_TEXT[role])}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min={1}
                          max={4094}
                          value={r.vlanId ?? ''}
                          onChange={(e) => {
                            const roh = e.target.value.trim()
                            const zahl = roh === '' ? undefined : Number(roh)
                            updateAddressRange(l.id, r.id, { vlanId: zahl })
                          }}
                          className={`w-16 ${inputCls} font-mono`}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => removeAddressRange(l.id, r.id)}
                          title={t('addrTpl.removeRange', 'Remove range')}
                          className="rounded border border-cp-border px-1 py-0.5 hover:bg-cp-surface-3"
                        >
                          <Icon icon={Trash2} size="xs" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}

      {geltend.length > 0 && (
        <>
          <p className="mb-1 mt-2 font-semibold text-cp-text-secondary">
            {t('addrTpl.resolved', 'What is in force after the overlay')}
          </p>
          <ul className="mb-2 flex flex-col gap-0.5">
            {geltend.map((r) => (
              <li key={`${r.from}:${r.id}`} className="flex flex-wrap items-center gap-1">
                <span className="font-mono">{r.cidr}</span>
                <span className="text-cp-text-secondary">{r.name || r.key}</span>
                <span className="text-cp-text-muted">
                  ({LAYER_LABEL[r.from]} · {r.layerName})
                </span>
                {r.replaces && (
                  <span className="text-cp-warn">
                    {format(t('addrTpl.replaces', 'replaces {name} ({cidr})'), {
                      name: r.replaces.name,
                      cidr: r.replaces.cidr,
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {vorschlaege.length > 0 && (
        <>
          <p className="mb-1 font-semibold text-cp-text-secondary">
            {t('addrTpl.proposals', 'Re-address proposals (adopt one at a time)')}
          </p>
          <ul className="mb-2 flex max-h-40 flex-col gap-0.5 overflow-auto">
            {vorschlaege.map((v) => (
              <li key={v.nicId} className="flex flex-wrap items-center gap-1">
                <span className="text-cp-text-secondary">{v.where}</span>
                <span className="font-mono">{v.from || '—'}</span>
                {v.to ? (
                  <>
                    <span aria-hidden>→</span>
                    <span className="font-mono text-cp-accent">
                      {v.to} / {v.mask}
                    </span>
                    <button
                      type="button"
                      onClick={() => applyReaddress(v.equipmentId, v.nicId, v.to!, v.mask!)}
                      className="rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-3"
                    >
                      {t('addrTpl.apply', 'adopt')}
                    </button>
                  </>
                ) : (
                  <span className="text-cp-text-muted">
                    {t(`addrTpl.refusal.${v.refusal}`, REFUSAL_TEXT[v.refusal!])}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {findings.length > 0 && (
        <ul className="flex max-h-40 flex-col gap-0.5 overflow-auto">
          {findings.map((f, idx) => (
            <li
              key={`${f.kind}:${f.key}:${idx}`}
              className={`flex items-start gap-1 ${
                f.severity === 'error' ? 'text-cp-danger' : 'text-cp-warn'
              }`}
            >
              <Icon icon={AlertTriangle} size="xs" />
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
