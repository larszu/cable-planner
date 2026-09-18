// ───────────────────────────────────────────────────────────────────────────
// Der Berichts-Editor (#880).
//
// ─── WARUM DIE VORSCHAU DEM EXPORT ENTSPRICHT ──────────────────────────────
//
// Nicht, weil zwei Stellen dasselbe tun — weil es nur EINE gibt. Die Tabelle
// unten, die CSV-Datei und das Papier kommen alle drei aus demselben
// `wendeForm(...)`-Ergebnis. Eine „Vorschau", die den Export nachbaut, ist
// genau der Fehler, den dieses Repo `zwei-rechnungen` nennt: sie stimmt am
// ersten Tag und driftet danach.
//
// ─── UND WARUM DIE VORLAGE ZWEIMAL WOHNEN KANN ─────────────────────────────
//
// „So sieht die Ziehliste DIESER Produktion aus" gehoert in die Plandatei und
// geht mit ihr weiter. „So sieht MEINE Ziehliste aus" gehoert in die
// Installation und gilt fuer das naechste Projekt. Das sind zwei Aussagen,
// und ein gemeinsamer Ort machte aus der einen die andere.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Printer, Save, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation, format } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { Icon } from '../shared/Icon'
import { confirmDialog } from '../../lib/confirmDialog'
import { downloadBlob } from '../../lib/downloadBlob'
import { toCsv } from '../../lib/csv'
import { printHtmlDocument } from '../../lib/printHtml'
import { buildPacketHtml, sheetFromTable, DEFAULT_PACKET_OPTIONS } from '../../lib/documentPacket'
import { BERICHTS_QUELLEN, quelleNach } from '../../lib/berichtsQuellen'
import {
  formAus,
  heileForm,
  wendeForm,
  type Berichtsform,
  type Berichtsvorlage,
} from '../../types/bericht'

const neueId = () => `bericht-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const BerichtEditorDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.berichtEditorOpen)
  const setOpen = useUiStore((s) => s.setBerichtEditorOpen)
  const project = useProjectStore((s) => s.project)
  const projektVorlagen = useProjectStore((s) => s.project.berichtsvorlagen) ?? []
  const setProjektVorlagen = useProjectStore((s) => s.setBerichtsvorlagen)
  const globaleVorlagen = useSettingsStore((s) => s.berichtsvorlagen)
  const setGlobaleVorlagen = useSettingsStore((s) => s.setBerichtsvorlagen)

  const [quelleId, setQuelleId] = useState(BERICHTS_QUELLEN[0].id)
  const [form, setForm] = useState<Berichtsform | null>(null)
  const [name, setName] = useState('')

  const quelle = quelleNach(quelleId)
  const roh = useMemo(() => (quelle ? quelle.table(project) : { headers: [], rows: [] }), [quelle, project])
  // Die Form der Tabelle von heute — auch ohne gewaehlte Vorlage.
  const gelten = useMemo(() => heileForm(form ?? formAus(roh), roh), [form, roh])
  const { tabelle, gruppen } = useMemo(() => wendeForm(roh, gelten), [roh, gelten])

  if (!open) return null

  const aendere = (teil: Partial<Berichtsform>) => setForm({ ...gelten, ...teil })

  const verschiebe = (kopf: string, richtung: -1 | 1) => {
    const i = gelten.spalten.findIndex((s) => s.kopf === kopf)
    const j = i + richtung
    if (i < 0 || j < 0 || j >= gelten.spalten.length) return
    const spalten = [...gelten.spalten]
    ;[spalten[i], spalten[j]] = [spalten[j], spalten[i]]
    aendere({ spalten })
  }

  const kippeSpalte = (kopf: string) =>
    aendere({
      spalten: gelten.spalten.map((s) => (s.kopf === kopf ? { ...s, sichtbar: !s.sichtbar } : s)),
    })

  const kippeSortierung = (kopf: string) => {
    const vorhanden = gelten.sortierung.find((s) => s.kopf === kopf)
    if (!vorhanden) {
      aendere({ sortierung: [...gelten.sortierung, { kopf, richtung: 'auf' }] })
      return
    }
    if (vorhanden.richtung === 'auf') {
      aendere({
        sortierung: gelten.sortierung.map((s) => (s.kopf === kopf ? { ...s, richtung: 'ab' as const } : s)),
      })
      return
    }
    aendere({ sortierung: gelten.sortierung.filter((s) => s.kopf !== kopf) })
  }

  const dateiname = `${project.metadata.name || 'AV'}-${quelle?.label ?? 'Bericht'}`

  const alsCsv = () =>
    downloadBlob(`${dateiname}.csv`, toCsv(tabelle.headers, tabelle.rows), 'text/csv;charset=utf-8')

  const aufsPapier = () =>
    printHtmlDocument(
      buildPacketHtml(
        project.metadata.name || 'AV-Planer',
        [sheetFromTable(t(`packet.sheet.${quelleId}`, quelle?.label ?? ''), tabelle)],
        DEFAULT_PACKET_OPTIONS,
      ),
    )

  const speichere = (wohin: 'projekt' | 'global') => {
    const bezeichnung = name.trim()
    if (!bezeichnung) return
    const vorlage: Berichtsvorlage = { id: neueId(), name: bezeichnung, quelleId, form: gelten }
    if (wohin === 'projekt') setProjektVorlagen([...projektVorlagen, vorlage])
    else setGlobaleVorlagen([...globaleVorlagen, vorlage])
    setName('')
  }

  const lade = (v: Berichtsvorlage) => {
    setQuelleId(v.quelleId)
    setForm(v.form)
  }

  const loesche = async (v: Berichtsvorlage, wo: 'projekt' | 'global') => {
    if (
      !(await confirmDialog(t('bericht.confirmDelete', 'Delete report template?'), {
        body: t('bericht.confirmDeleteBody', 'The lists stay as they are; only this saved view goes.'),
        destructive: true,
        okLabel: t('common.delete', 'Delete'),
      }))
    )
      return
    if (wo === 'projekt') setProjektVorlagen(projektVorlagen.filter((x) => x.id !== v.id))
    else setGlobaleVorlagen(globaleVorlagen.filter((x) => x.id !== v.id))
  }

  const passende = (liste: Berichtsvorlage[]) => liste.filter((v) => v.quelleId === quelleId)
  const feldCls = 'border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs text-cp-text'

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('bericht.title', 'Report editor')}
      maxWidth="5xl"
    >
      <PanelHint
        className="mb-3 text-cp-xs text-cp-text-muted"
        text={t(
          'bericht.hint',
          'The table below is what the CSV file and the printed sheet contain - not a preview of them. Columns, grouping, sorting and filters are applied once, and all three read the same result.',
        )}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-cp-xs">
        <label className="flex items-center gap-1.5">
          {t('bericht.list', 'List')}
          <select
            value={quelleId}
            onChange={(e) => {
              setQuelleId(e.target.value)
              // Die Form gehoert zur Liste: eine andere Liste hat andere
              // Spalten, und die alte Form haette nach dem Heilen nichts mehr
              // von dem, was jemand eingestellt hat.
              setForm(null)
            }}
            className={feldCls}
          >
            {BERICHTS_QUELLEN.map((q) => (
              <option key={q.id} value={q.id}>
                {t(`packet.sheet.${q.id}`, q.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          {t('bericht.groupBy', 'Group by')}
          <select
            value={gelten.gruppeNach ?? ''}
            onChange={(e) => aendere({ gruppeNach: e.target.value || undefined })}
            className={feldCls}
          >
            <option value="">{t('bericht.groupNone', 'not grouped')}</option>
            {roh.headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <span className="text-cp-text-muted">
          {format(t('bericht.count', '{rows} of {total} rows · {cols} columns'), {
            rows: tabelle.rows.length,
            total: roh.rows.length,
            cols: tabelle.headers.length,
          })}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={alsCsv} className="inline-flex items-center gap-1 bg-cp-surface-3 px-2 py-1 hover:bg-cp-surface-4">
            <Icon icon={Download} size="xs" /> {t('bericht.csv', 'CSV')}
          </button>
          <button type="button" onClick={aufsPapier} className="inline-flex items-center gap-1 bg-cp-surface-3 px-2 py-1 hover:bg-cp-surface-4">
            <Icon icon={Printer} size="xs" /> {t('bericht.print', 'Print')}
          </button>
        </div>
      </div>

      {/* Die Spalten: Sichtbarkeit, Reihenfolge, Sortierung, Filter — je Zeile
          eine Spalte, damit alles zu EINER Spalte beieinander steht. */}
      <div className="mb-3 max-h-56 overflow-auto border border-cp-border-muted">
        <table className="w-full text-cp-xs">
          <thead className="sticky top-0 bg-cp-surface-3 text-cp-text-muted">
            <tr>
              <th className="px-2 py-1 text-left">{t('bericht.column', 'Column')}</th>
              <th className="px-2 py-1 text-left">{t('bericht.order', 'Order')}</th>
              <th className="px-2 py-1 text-left">{t('bericht.sort', 'Sort')}</th>
              <th className="px-2 py-1 text-left">{t('bericht.filter', 'Filter')}</th>
            </tr>
          </thead>
          <tbody>
            {gelten.spalten.map((s, i) => {
              const sortiert = gelten.sortierung.find((x) => x.kopf === s.kopf)
              return (
                <tr key={s.kopf} className="border-t border-cp-border-muted">
                  <td className="px-2 py-1">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={s.sichtbar} onChange={() => kippeSpalte(s.kopf)} />
                      <span className={s.sichtbar ? 'text-cp-text' : 'text-cp-text-muted line-through'}>
                        {s.kopf}
                      </span>
                    </label>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => verschiebe(s.kopf, -1)}
                        className="bg-cp-surface-3 px-1 disabled:opacity-30"
                        title={t('bericht.up', 'Move up')}
                      >
                        <Icon icon={ArrowUp} size="xs" />
                      </button>
                      <button
                        type="button"
                        disabled={i === gelten.spalten.length - 1}
                        onClick={() => verschiebe(s.kopf, 1)}
                        className="bg-cp-surface-3 px-1 disabled:opacity-30"
                        title={t('bericht.down', 'Move down')}
                      >
                        <Icon icon={ArrowDown} size="xs" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={() => kippeSortierung(s.kopf)}
                      className="bg-cp-surface-3 px-2 py-0.5"
                      title={t(
                        'bericht.sortTitle',
                        'Click through: ascending, descending, off. Several columns sort in the order you switched them on - and a hidden column sorts too.',
                      )}
                    >
                      {sortiert
                        ? sortiert.richtung === 'auf'
                          ? t('bericht.asc', 'ascending')
                          : t('bericht.desc', 'descending')
                        : t('bericht.sortOff', 'off')}
                    </button>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={gelten.filter[s.kopf] ?? ''}
                      onChange={(e) =>
                        aendere({ filter: { ...gelten.filter, [s.kopf]: e.target.value } })
                      }
                      placeholder={t('bericht.filterPlaceholder', 'contains…')}
                      className="w-full border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Das Ergebnis. Es IST der Export. */}
      <div className="mb-3 max-h-72 overflow-auto border border-cp-border-muted">
        <table className="w-full text-cp-xs">
          <thead className="sticky top-0 bg-cp-surface-3 text-cp-text-muted">
            <tr>
              {tabelle.headers.map((h) => (
                <th key={h} className="px-2 py-1 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabelle.rows.map((zeile, i) => (
              <tr key={i} className="border-t border-cp-border-muted">
                {zeile.map((zelle, j) => (
                  <td key={j} className="px-2 py-1 text-cp-text-secondary">
                    {zelle === null || zelle === undefined ? '' : String(zelle)}
                  </td>
                ))}
              </tr>
            ))}
            {tabelle.rows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(1, tabelle.headers.length)}
                  className="px-2 py-6 text-center text-cp-text-faint"
                >
                  {roh.rows.length === 0
                    ? t('bericht.emptyList', 'This list has no rows in this project yet.')
                    : t('bericht.emptyFilter', 'No row matches the filters.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {gruppen && gruppen.length > 0 && (
        <div className="mb-3 text-cp-xs text-cp-text-muted">
          {gruppen.map((g) => `${g.titel || t('bericht.groupEmpty', 'not stated')} (${g.zeilen})`).join(' · ')}
        </div>
      )}

      {/* Die Vorlagen. */}
      <div className="flex flex-wrap items-end gap-2 text-cp-xs">
        <label className="flex flex-col gap-1">
          <span className="text-cp-text-muted">{t('bericht.templateName', 'Save as template')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('bericht.templatePlaceholder', 'e.g. pull list without room')}
            className={feldCls}
          />
        </label>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => speichere('projekt')}
          className="inline-flex items-center gap-1 bg-emerald-700 px-2 py-1 hover:bg-emerald-600 disabled:opacity-40"
        >
          <Icon icon={Save} size="xs" /> {t('bericht.saveProject', 'with this project')}
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => speichere('global')}
          className="inline-flex items-center gap-1 bg-cp-surface-3 px-2 py-1 hover:bg-cp-surface-4 disabled:opacity-40"
        >
          <Icon icon={Save} size="xs" /> {t('bericht.saveGlobal', 'for all projects')}
        </button>
      </div>

      {(passende(projektVorlagen).length > 0 || passende(globaleVorlagen).length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1 text-cp-xs">
          {([
            ['projekt', passende(projektVorlagen)] as const,
            ['global', passende(globaleVorlagen)] as const,
          ]).map(([wo, liste]) =>
            liste.map((v) => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 border border-cp-border bg-cp-surface-2 px-1.5 py-0.5"
              >
                <button type="button" onClick={() => lade(v)} className="hover:text-cp-accent">
                  {v.name}
                </button>
                <span className="text-cp-text-faint">
                  {wo === 'projekt'
                    ? t('bericht.scopeProject', 'project')
                    : t('bericht.scopeGlobal', 'global')}
                </span>
                <button
                  type="button"
                  onClick={() => void loesche(v, wo)}
                  className="text-cp-text-muted hover:text-cp-danger"
                  aria-label={t('common.delete', 'Delete')}
                >
                  <Icon icon={Trash2} size="xs" />
                </button>
              </span>
            )),
          )}
        </div>
      )}
    </ModalShell>
  )
}
