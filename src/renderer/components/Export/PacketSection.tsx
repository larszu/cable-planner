import { useMemo, useState } from 'react'
import { Printer, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { printHtmlDocument } from '../../lib/printHtml'
import {
  DEFAULT_PACKET_OPTIONS,
  buildPacketHtml,
  sheetFromTable,
  sheetsWithUndescribedColumns,
  type ColourMode,
  type PacketSheet,
  type PaperSize,
} from '../../lib/documentPacket'
import { stampForRows } from '../../lib/documentStamp'
import { DOCUMENT_STANDS } from '../../lib/documentRegistry'
import { pullListTable, terminationListTable, cableScheduleTable } from '../../lib/installerLists'
import { assetRegisterTable } from '../../lib/assetRegister'
import { crewSheetTableForProject } from '../../lib/crewNetworkSheet'
import { spectrumTableForProject } from '../../lib/spectrumPlan'
import { deliveryTableForProject } from '../../lib/deliveryParity'
import { tallyMapTableForProject } from '../../lib/tallyMap'
import type { CsvTable } from '../../lib/csv'
import type { CablePlannerProject } from '../../types/project'

/**
 * BEDARF 115 — ein Papierstapel, den man zusammenheften kann.
 *
 *   > Stage plot print offers only two modes […] neither of which fits a
 *   > packet; a 44-row patch list SPANS PAGES AND LOSES ITS REPEATING HEADER
 *   > and colour chips.
 *
 * Diese Ansicht stellt den Stapel zusammen; das Papier selbst baut
 * `lib/documentPacket.ts`. Die Trennung ist Absicht: die Regel „der Kopf
 * wiederholt sich auf jeder Seite" gehört nicht in eine Oberfläche, sonst
 * gilt sie nur für den einen Stapel, den jemand hier zusammenklickt.
 *
 * Angeboten werden die Blätter, die einen eintragbaren STAND haben
 * (`DOCUMENT_STANDS`) — jedes trägt seinen Stempel, und ein Stapel aus
 * gestempelten Blättern lässt sich morgen gegen den Plan halten. Ein Blatt
 * ohne Stand käme ohne Datum aus dem Drucker, und genau das ist der Zustand,
 * den ADR-004 abgeschafft hat.
 */

interface Kandidat {
  id: string
  label: string
  table: (p: CablePlannerProject) => CsvTable
}

const KANDIDATEN: ReadonlyArray<Kandidat> = [
  { id: 'pull-liste', label: 'Zug-Liste', table: pullListTable },
  { id: 'termination-liste', label: 'Auflege-Liste', table: terminationListTable },
  { id: 'kabel-schedule', label: 'Kabel-Schedule', table: cableScheduleTable },
  { id: 'asset-register', label: 'Geräte-Register', table: assetRegisterTable },
  { id: 'crew-netz', label: 'Netz-Merkblatt', table: crewSheetTableForProject },
  { id: 'spektrum-plan', label: 'Spektrum-Plan', table: spectrumTableForProject },
  { id: 'ausspielung', label: 'Ausspielung', table: deliveryTableForProject },
  { id: 'tally-karte', label: 'Tally-Karte', table: tallyMapTableForProject },
]

export const PacketSection = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const [gewaehlt, setGewaehlt] = useState<string[]>(['pull-liste', 'kabel-schedule'])
  const [paper, setPaper] = useState<PaperSize>(DEFAULT_PACKET_OPTIONS.paper)
  const [colour, setColour] = useState<ColourMode>(DEFAULT_PACKET_OPTIONS.colour)
  const [glossary, setGlossary] = useState(DEFAULT_PACKET_OPTIONS.glossary)

  // Der Zeitpunkt kommt EINMAL aus der Uhr und geht in jeden Stempel — sonst
  // trägt Blatt 1 eine andere Minute als Blatt 7, und der Stapel sieht aus,
  // als wäre er über eine Stunde zusammengesucht worden.
  const blaetter: PacketSheet[] = useMemo(() => {
    const jetzt = new Date()
    return KANDIDATEN.filter((k) => gewaehlt.includes(k.id)).map((k) => {
      const table = k.table(project)
      // Der Stempel kommt aus derselben Ableitung, aus der das Blatt kommt —
      // sonst stempelt er etwas anderes, als gedruckt wird.
      const stempel = DOCUMENT_STANDS[k.id] ? stampForRows(project, k.table, jetzt) : undefined
      return sheetFromTable(k.label, table, stempel)
    })
  }, [project, gewaehlt])

  const unerklaert = useMemo(() => sheetsWithUndescribedColumns(blaetter), [blaetter])

  const drucken = () => {
    if (blaetter.length === 0) return
    printHtmlDocument(
      buildPacketHtml(
        project.metadata.name || 'AV-Planer',
        blaetter,
        { paper, colour, glossary },
      ),
    )
  }

  const toggle = (id: string) =>
    setGewaehlt((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))

  const selectCls =
    'rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs text-cp-text'

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {KANDIDATEN.map((k) => (
          <label key={k.id} className="flex items-center gap-1.5 text-cp-xs">
            <input type="checkbox" checked={gewaehlt.includes(k.id)} onChange={() => toggle(k.id)} />
            <span>{t(`packet.sheet.${k.id}`, k.label)}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-cp-xs">
        <label className="flex items-center gap-1.5">
          {t('packet.paper', 'Papier')}
          <select value={paper} onChange={(e) => setPaper(e.target.value as PaperSize)} className={selectCls}>
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="A3">A3</option>
          </select>
        </label>
        {/* BEDARF 115 — der Farbmodus. „Mono" ist nicht „grau": eine Farbfläche,
            die im Graustufendruck zu einem grauen Kästchen wird, ist keine
            Information mehr. Der NAME steht in beiden Modi da. */}
        <label className="flex items-center gap-1.5">
          {t('packet.colour', 'Farbe')}
          <select
            value={colour}
            onChange={(e) => setColour(e.target.value as ColourMode)}
            title={t(
              'packet.colourHint',
              'Farbfelder werden nur im Farbmodus gedruckt. Der Name der Gruppe steht in BEIDEN Modi da — ein graues Kästchen auf der Fotokopie unterscheidet zwei Gruppen nicht mehr.',
            )}
            className={selectCls}
          >
            <option value="colour">{t('packet.colour.colour', 'farbig')}</option>
            <option value="mono">{t('packet.colour.mono', 'schwarzweiß')}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={glossary} onChange={(e) => setGlossary(e.target.checked)} />
          {t('packet.glossary', 'Spaltenlexikon mitdrucken')}
        </label>
        <button
          type="button"
          onClick={drucken}
          disabled={blaetter.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1 text-cp-xs hover:bg-emerald-600 disabled:opacity-40"
        >
          <Icon icon={Printer} size="xs" />
          {t('packet.print', 'Stapel drucken')}
        </button>
      </div>

      {/* Ein Packet geht an jemanden, der die Spalten nicht kennt — das ist der
          ganze Grund für das Lexikon. Ein Blatt mit unerklärten Spalten ist
          deshalb ein Befund und keine Kleinigkeit. */}
      {unerklaert.length > 0 && (
        <ul className="flex flex-col gap-1 text-cp-xs text-amber-300/90">
          {unerklaert.map((u) => (
            <li key={u.title} className="flex items-start gap-1.5">
              <Icon icon={AlertTriangle} size="xs" />
              <span>
                {t('packet.undescribed', '„{sheet}“: {cols} ohne Erklärung im Lexikon.')
                  .replace('{sheet}', u.title)
                  .replace('{cols}', u.columns.join(', '))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
