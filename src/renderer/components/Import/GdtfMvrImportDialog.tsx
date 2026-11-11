// #1206 — GDTF-Dateien in die Bibliothek, MVR-Szenen auf die Flaeche.
//
// Eine MVR-Datei bringt ihre GDTF-Typen mit. Je Typ zeigt der Dialog, welche
// Vorlage der Bibliothek er nimmt (Typ-Id, dann Name) oder ob er eine neue
// anlegt; die Wahl laesst sich je Zeile aendern. Platziert wird in der
// Draufsicht im Massstab des kalibrierten Hallenplans, sonst im eingestellten.

import { useMemo, useState } from 'react'
import { FileUp, AlertTriangle } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { projectHistory } from '../../store/projectHistory'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { Button } from '../shared/Button'
import { infoDialog } from '../../lib/infoDialog'
import { useTranslation, format } from '../../lib/i18n'
import { parseGdtf, type GdtfTyp } from '../../lib/gdtf/gdtf'
import { parseMvr, type MvrSzene } from '../../lib/gdtf/mvr'
import { findeVorlage, mvrGeraete, mvrTypen, vorlageAusGdtf } from '../../lib/gdtf/zuordnung'
import { pxProMeterAusKalibrierung } from '../../lib/gdtf/massstab'
import type { EquipmentTemplate } from '../../types/equipment'

interface GdtfDatei {
  datei: string
  typ?: GdtfTyp
  fehler?: string
}

const STANDARD_PX_PRO_M = 40

export const GdtfMvrImportDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.gdtfImport.open)
  const close = useUiStore((s) => s.closeGdtfImport)
  const addCustomTemplates = useProjectStore((s) => s.addCustomTemplates)
  const importEquipment = useProjectStore((s) => s.importEquipment)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const grundriss = useProjectStore((s) => s.project.grundriss)

  const [gdtfDateien, setGdtfDateien] = useState<GdtfDatei[]>([])
  const [szene, setSzene] = useState<{ datei: string; szene: MvrSzene } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  /** spec → Name der gewaehlten Vorlage; leer = neue Vorlage anlegen. */
  const [wahl, setWahl] = useState<Record<string, string>>({})
  const planMassstab = grundriss?.kalibrierung ? pxProMeterAusKalibrierung(grundriss.kalibrierung) : null
  const [pxProM, setPxProM] = useState<number | null>(null)
  const massstab = pxProM ?? planMassstab ?? STANDARD_PX_PRO_M

  const typen = useMemo(() => (szene ? mvrTypen(szene.szene, customLibrary) : []), [szene, customLibrary])
  const nachName = useMemo(() => new Map(customLibrary.map((v) => [v.name, v])), [customLibrary])

  if (!open) return null

  const zuruecksetzen = () => {
    setGdtfDateien([])
    setSzene(null)
    setFehler(null)
    setWahl({})
    setPxProM(null)
  }
  const schliessen = () => {
    zuruecksetzen()
    close()
  }

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    zuruecksetzen()
    const liste = [...files]
    const mvr = liste.find((f) => f.name.toLowerCase().endsWith('.mvr'))
    try {
      if (mvr) {
        const s = parseMvr(new Uint8Array(await mvr.arrayBuffer()))
        setSzene({ datei: mvr.name, szene: s })
        // Vorbelegung: die gefundene Vorlage. Sie steht im Feld, damit sie
        // sichtbar ist und sich ueberschreiben laesst.
        const vor: Record<string, string> = {}
        for (const z of mvrTypen(s, customLibrary)) vor[z.spec] = z.vorhanden?.name ?? ''
        setWahl(vor)
        return
      }
      const gelesen: GdtfDatei[] = []
      for (const f of liste) {
        try {
          gelesen.push({ datei: f.name, typ: parseGdtf(new Uint8Array(await f.arrayBuffer())) })
        } catch (e) {
          gelesen.push({ datei: f.name, fehler: e instanceof Error ? e.message : String(e) })
        }
      }
      setGdtfDateien(gelesen)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    }
  }

  const gdtfUebernehmen = () => {
    const neu = gdtfDateien.flatMap((d) =>
      d.typ && !findeVorlage(d.typ, customLibrary) ? [vorlageAusGdtf(d.typ, d.datei)] : [],
    )
    const bericht = addCustomTemplates(neu)
    schliessen()
    void infoDialog(t('gdtfImport.doneTitle', 'GDTF imported'), {
      body: format(
        t('gdtfImport.doneBody', 'Created {n} new template(s). Already in the library: {vorhanden}.'),
        { n: bericht.added.length, vorhanden: gdtfDateien.filter((d) => d.typ).length - neu.length + bericht.skipped.length },
      ),
      tone: 'success',
    })
  }

  const mvrUebernehmen = () => {
    if (!szene) return
    const gewaehlt = new Map<string, EquipmentTemplate>()
    const neu: EquipmentTemplate[] = []
    for (const z of typen) {
      const name = (wahl[z.spec] ?? '').trim()
      const vorhanden = name ? nachName.get(name) : undefined
      if (vorhanden) {
        gewaehlt.set(z.spec, vorhanden)
      } else {
        // Zwei Specs koennen auf denselben Typ zeigen (mit und ohne Endung).
        const schon = neu.find((v) => v.name === z.neu.name)
        if (!schon) neu.push(z.neu)
        gewaehlt.set(z.spec, schon ?? z.neu)
      }
    }
    const ursprung = grundriss ? { x: grundriss.x, y: grundriss.y } : { x: 100, y: 100 }
    const geraete = mvrGeraete(szene.szene, gewaehlt, { pxProMeter: massstab, ursprung })
    const bericht = projectHistory.transact(() => {
      const b = addCustomTemplates(neu)
      importEquipment(geraete)
      return b
    })
    schliessen()
    void infoDialog(t('mvrImport.doneTitle', 'MVR imported'), {
      body: format(
        t('mvrImport.doneBody', 'Placed {n} device(s). New templates in the library: {neu}.'),
        { n: geraete.length, neu: bericht.added.length },
      ),
      tone: 'success',
    })
  }

  const uebersprungen = szene
    ? szene.szene.objekte.length - typen.reduce((s, z) => s + z.anzahl, 0)
    : 0

  return (
    <ModalShell
      open={open}
      onClose={schliessen}
      maxWidth="3xl"
      titleIcon={<Icon icon={FileUp} size="md" />}
      title={t('gdtfImport.title', 'Import GDTF / MVR')}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={schliessen}>{t('common.cancel', 'Cancel')}</Button>
          {szene ? (
            <Button variant="primary" onClick={mvrUebernehmen} disabled={typen.length === 0}>
              {t('mvrImport.apply', 'Place devices')}
            </Button>
          ) : (
            <Button variant="primary" onClick={gdtfUebernehmen} disabled={!gdtfDateien.some((d) => d.typ)}>
              {t('gdtfImport.apply', 'Add to library')}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3 p-1 text-cp-base">
        <p className="text-cp-xs text-cp-text-muted">
          {t(
            'gdtfImport.intro',
            'GDTF files become library templates with their DMX modes, power, weight and connectors. An MVR file places its fixtures in plan view with their DMX addresses; types you do not have yet are created from the embedded GDTF files.',
          )}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-cp-control bg-cp-surface-2 px-2 py-1 text-cp-xs hover:bg-cp-surface-3">
          <Icon icon={FileUp} size="xs" /> {t('gdtfImport.pick', 'Choose .gdtf or .mvr file(s)…')}
          <input
            type="file"
            accept=".gdtf,.mvr"
            multiple
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>

        {fehler && (
          <div className="flex items-center gap-1 text-cp-xs text-cp-danger">
            <Icon icon={AlertTriangle} size="xs" /> {fehler}
          </div>
        )}

        {gdtfDateien.length > 0 && (
          <table className="w-full text-cp-xs">
            <thead className="text-left text-cp-text-muted">
              <tr>
                <th className="py-1">{t('gdtfImport.col.type', 'Type')}</th>
                <th>{t('gdtfImport.col.modes', 'DMX modes')}</th>
                <th>{t('gdtfImport.col.ports', 'Connectors')}</th>
                <th>{t('gdtfImport.col.status', 'Library')}</th>
              </tr>
            </thead>
            <tbody>
              {gdtfDateien.map((d) => {
                const da = d.typ ? findeVorlage(d.typ, customLibrary) : undefined
                return (
                  <tr key={d.datei} className="border-t border-cp-border-muted align-top">
                    <td className="py-1 pr-2">{d.typ ? `${d.typ.manufacturer} ${d.typ.name}` : d.datei}</td>
                    <td className="pr-2">
                      {d.typ?.modi.map((m) => `${m.name} (${m.kanaele})`).join(', ') || '—'}
                    </td>
                    <td className="pr-2">{d.typ ? d.typ.anschluesse.map((a) => a.connectorType).join(', ') || '—' : ''}</td>
                    <td className={d.fehler ? 'text-cp-danger' : da ? 'text-cp-text-muted' : 'text-cp-ok'}>
                      {d.fehler
                        ? d.fehler
                        : da
                          ? format(t('gdtfImport.exists', 'already there: {name}'), { name: da.name })
                          : t('gdtfImport.new', 'new')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {szene && (
          <>
            <div className="text-cp-xs text-cp-text-muted">
              {format(
                t('mvrImport.summary', '{datei}: {n} object(s), {typen} type(s). Truss and scenery stay in the lighting plan: {skip} object(s).'),
                { datei: szene.datei, n: szene.szene.objekte.length, typen: typen.length, skip: uebersprungen },
              )}
            </div>
            <datalist id="mvr-vorlagen">
              {customLibrary.map((v) => (
                <option key={v.name} value={v.name} />
              ))}
            </datalist>
            <table className="w-full text-cp-xs">
              <thead className="text-left text-cp-text-muted">
                <tr>
                  <th className="py-1">{t('mvrImport.col.spec', 'GDTF type in the MVR')}</th>
                  <th>{t('mvrImport.col.count', 'Count')}</th>
                  <th>{t('mvrImport.col.template', 'Template (empty = create new)')}</th>
                </tr>
              </thead>
              <tbody>
                {typen.map((z) => {
                  const name = wahl[z.spec] ?? ''
                  const unbekannt = name.trim() !== '' && !nachName.has(name.trim())
                  return (
                    <tr key={z.spec} className="border-t border-cp-border-muted align-top">
                      <td className="py-1 pr-2">
                        {z.spec || t('mvrImport.noSpec', '(no GDTF type)')}
                        {!z.gdtf && z.spec && (
                          <div className="text-cp-warn">
                            {z.fehler ?? t('mvrImport.notEmbedded', 'GDTF file not embedded — new template without ports')}
                          </div>
                        )}
                      </td>
                      <td className="pr-2">{z.anzahl}</td>
                      <td>
                        <input
                          list="mvr-vorlagen"
                          value={name}
                          placeholder={format(t('mvrImport.newTemplate', 'New: {name}'), { name: z.neu.name })}
                          onChange={(e) => setWahl((w) => ({ ...w, [z.spec]: e.target.value }))}
                          className="w-full rounded-cp-control border border-cp-border bg-cp-surface-2 px-1.5 py-1"
                        />
                        {unbekannt && (
                          <div className="text-cp-warn">{t('mvrImport.unknownTemplate', 'Not in the library — a new template will be created')}</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <label className="flex items-center gap-2 text-cp-xs">
              {t('mvrImport.scale', 'Scale (px per metre)')}
              <input
                type="number"
                min={1}
                step={1}
                value={Math.round(massstab * 100) / 100}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setPxProM(Number.isFinite(n) && n > 0 ? n : null)
                }}
                className="w-24 rounded-cp-control border border-cp-border bg-cp-surface-2 px-1.5 py-1"
              />
              <span className="text-cp-text-muted">
                {planMassstab
                  ? t('mvrImport.scaleFromPlan', 'from the calibrated floor plan')
                  : t('mvrImport.scaleDefault', 'calibrate the floor plan to place the devices true to scale')}
              </span>
            </label>
          </>
        )}
      </div>
    </ModalShell>
  )
}
