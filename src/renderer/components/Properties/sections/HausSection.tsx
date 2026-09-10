import { useRef, useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { hausPunkt, hausRaumLabel } from '../../../types/hausAuskunft'
import { leseHausDatei } from '../../../lib/hausDatei'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'

/**
 * Der Hausanschluss dieses Geraets (larszu-facility-planner Issue #2).
 *
 * ─── WARUM DIE DATEI HIER GELADEN WIRD UND NICHT IN DEN EINSTELLUNGEN ──────
 *
 * Weil hier die Frage entsteht. Wer ein Geraet setzt und wissen will, woran
 * es haengt, sucht nicht erst einen Reiter. Der Knopf steht deshalb an der
 * Stelle, an der die Auskunft gebraucht wird, und verschwindet, sobald eine
 * hinterlegt ist.
 *
 * ─── WAS HIER NICHT PASSIERT ───────────────────────────────────────────────
 *
 * Nichts wird abgeschrieben. Absicherung, Dauerleistung und „geschaltet"
 * stehen als ANZEIGE da und gehen nicht ins Geraet: das Geraet haelt nur die
 * Id. Waere es anders, haette der Plan beim naechsten Export des Betreibers
 * Zahlen, die das Haus so nicht mehr sagt — und niemand saehe es.
 */
export const HausSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const auskunft = useProjectStore((s) => s.project.hausAuskunft)
  const setHausAuskunft = useProjectStore((s) => s.setHausAuskunft)
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const [fehler, setFehler] = useState<string | null>(null)
  const feld = useRef<HTMLInputElement>(null)

  const punkt = hausPunkt(auskunft, equipment.hausPunktId)
  const klinke = auskunft?.klinken.find((k) => k.id === equipment.hausKlinkeId)

  const laden = async (datei: File) => {
    setFehler(null)
    const gelesen = leseHausDatei(await datei.text(), {
      quelle: datei.name,
      gelesenAm: new Date().toISOString(),
    })
    if (!gelesen) {
      setFehler(
        t(
          'haus.dateiUnlesbar',
          'That is not a building file from the facility planner, or it comes from a newer version. Nothing was taken over.',
        ),
      )
      return
    }
    setHausAuskunft(gelesen)
  }

  const summary = !auskunft
    ? t('haus.keineAuskunft', 'no building file')
    : punkt
      ? punkt.bezeichnung
      : t('haus.nichtZugeordnet', 'not assigned')

  return (
    <SortableSection id="haus" title={t('haus.title', 'House connection')} subtitle={summary}>
      {!auskunft ? (
        <>
          <PanelHint
            text={t(
              'haus.ladenHinweis',
              'The facility planner exports the building as an .avfacility file: which outlets exist, what they carry, which of them are switched or dimmed, and which control addresses the show may use. Load it here and the plan check can ask it.',
            )}
          />
          <button
            type="button"
            onClick={() => feld.current?.click()}
            className="mt-2 rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('haus.dateiLaden', 'Load building file…')}
          </button>
          <input
            ref={feld}
            type="file"
            accept=".avfacility,application/json"
            className="hidden"
            onChange={(e) => {
              const datei = e.target.files?.[0]
              e.target.value = ''
              if (datei) void laden(datei)
            }}
          />
          {fehler && <PanelHint text={fehler} />}
        </>
      ) : (
        <div className="space-y-2">
          {/* Die Abschrift sagt, WANN sie entstanden ist. Zwischen Export und
              Aufbau kann der Betreiber eine Dose stillgelegt haben. */}
          <div className="text-cp-xs text-cp-text-muted">
            {format(t('haus.stand', '{name} · read {stand} from {quelle}'), {
              name: auskunft.name,
              stand: auskunft.gelesenAm.slice(0, 10),
              quelle: auskunft.quelle,
            })}
          </div>

          <label className="text-cp-xs">
            <span className="text-cp-text-muted">{t('haus.punkt', 'House outlet')}</span>
            <select
              value={equipment.hausPunktId ?? ''}
              onChange={(e) => updateEquipment(equipment.id, { hausPunktId: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
            >
              <option value="">{t('haus.keinPunkt', '— none —')}</option>
              {auskunft.punkte.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.bezeichnung} · {hausRaumLabel(auskunft, p.raumId)} · {p.anschlussart} {p.absicherungA} A
                </option>
              ))}
            </select>
          </label>

          {/* Was das Haus über diesen Punkt sagt — als Anzeige, nicht als
              Kopie. Was es NICHT sagt, steht auch nicht da. */}
          {punkt && (
            <ul className="space-y-0.5 text-cp-xs text-cp-text-muted">
              <li>
                {format(t('haus.absicherung', 'Fuse {a} A'), { a: punkt.absicherungA })}
                {punkt.dauerleistungW
                  ? ` · ${format(t('haus.dauerleistung', '{w} W continuous'), { w: punkt.dauerleistungW })}`
                  : ` · ${t('haus.keineDauerleistung', 'continuous rating not stated')}`}
              </li>
              {punkt.geschaltet === true && <li className="text-cp-warn">{t('haus.geschaltet', 'switched')}</li>}
              {punkt.gedimmt === true && <li className="text-cp-danger">{t('haus.gedimmt', 'dimmed')}</li>}
              {punkt.hinweis && <li>{punkt.hinweis}</li>}
            </ul>
          )}

          <label className="text-cp-xs">
            <span className="text-cp-text-muted">{t('haus.klinke', 'Control address')}</span>
            <select
              value={equipment.hausKlinkeId ?? ''}
              onChange={(e) => updateEquipment(equipment.id, { hausKlinkeId: e.target.value || undefined })}
              className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
            >
              <option value="">{t('haus.keineKlinke', '— none —')}</option>
              {auskunft.klinken.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.system.toUpperCase()} {k.adresse}
                  {k.adressart ? ` (${k.adressart})` : ''} · {k.bedeutung}
                </option>
              ))}
            </select>
          </label>
          {klinke && (
            <div className="text-cp-xs text-cp-text-muted">
              {klinke.richtung === 'lesen'
                ? t('haus.nurLesen', 'read only — this address reports, it does not switch')
                : t('haus.schaltet', 'switching — what it does is what the building states')}
            </div>
          )}
        </div>
      )}
    </SortableSection>
  )
}
