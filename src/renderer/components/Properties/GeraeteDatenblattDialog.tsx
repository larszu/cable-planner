import { useMemo, useState } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { translate, useTranslation } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import {
  datenblattFelder,
  datenblattHtml,
  geraeteFotos,
  vorauswahl,
  type DatenblattGruppe,
} from '../../lib/geraeteDatenblatt'
import { datenblattPdf } from '../../lib/datenblattPdf'
import { printHtmlDocument } from '../../lib/printHtml'
import { downloadBlob } from '../../lib/downloadBlob'
import { stampForRows, stampLine } from '../../lib/documentStamp'
import { steckbriefStandTable } from '../../lib/steckbrief'

/**
 * #919 — Datenblatt EINES Geräts: Eigenschaften ankreuzen, Foto wählen,
 * drucken oder als PDF speichern. Vorausgewählt ist, was ausgefüllt ist;
 * die Auswahl lebt nur im Dialog — sie ist eine Entscheidung für dieses eine
 * Blatt, keine Eigenschaft des Geräts.
 */
export const GeraeteDatenblattDialog = ({ equipmentId, onClose }: { equipmentId: string; onClose: () => void }) => {
  const t = useTranslation()
  const language = useUiStore((s) => s.language)
  const lang = language === 'de' ? 'de' : 'en'
  const project = useProjectStore((s) => s.project)
  const felder = useMemo(
    () => datenblattFelder(project, equipmentId, { t: (key, fallback) => translate(language, key, fallback), lang }) ?? [],
    [project, equipmentId, language, lang],
  )
  const fotos = useMemo(() => geraeteFotos(project, equipmentId), [project, equipmentId])
  const [auswahl, setAuswahl] = useState<Set<string>>(() => vorauswahl(felder))
  const [fotoIds, setFotoIds] = useState<string[]>(() => fotos.filter((f) => f.dataUri).slice(0, 1).map((f) => f.id))
  const [pdfFehler, setPdfFehler] = useState('')
  const name = project.equipment.find((e) => e.id === equipmentId)?.name ?? equipmentId

  // Derselbe Stempel wie die Geräte-Steckbriefe: das Blatt ist ein Auszug daraus.
  const html = () =>
    datenblattHtml(project, equipmentId, {
      auswahl,
      fotoIds,
      stempel: stampLine(stampForRows(project, steckbriefStandTable, new Date())),
      t,
      lang,
    })

  const umschalten = (key: string) =>
    setAuswahl((alt) => {
      const neu = new Set(alt)
      if (neu.has(key)) neu.delete(key)
      else neu.add(key)
      return neu
    })

  const pdf = async () => {
    setPdfFehler('')
    let bytes: Uint8Array | null
    try {
      bytes = await datenblattPdf(html())
    } catch (err) {
      setPdfFehler(err instanceof Error ? err.message : String(err))
      return
    }
    if (bytes) {
      downloadBlob(`${name} - ${t('datasheet.fileName', 'datasheet')}.pdf`, bytes, 'application/pdf')
      return
    }
    // Browser-Ausgabe: kein Hauptprozess, der PDF schreibt. Der Druckdialog
    // bietet „Als PDF speichern" selbst an.
    setPdfFehler(t('datasheet.pdfBrowser', 'The web edition cannot write a PDF itself — choose "Save as PDF" in the print dialog.'))
    printHtmlDocument(html())
  }

  const gruppen: Array<[DatenblattGruppe, string]> = [
    ['general', t('datasheet.group.general', 'General')],
    ['technical', t('datasheet.group.technical', 'Technical data')],
    ['category', t('datasheet.group.category', 'Category data')],
    ['operation', t('datasheet.group.operation', 'Operation')],
    ['tables', t('datasheet.group.tables', 'Tables')],
  ]
  const knopf = 'inline-flex items-center gap-1 border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs hover:bg-cp-surface-3'

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`${t('datasheet.title', 'Device datasheet')} — ${name}`}
      maxWidth="3xl"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={knopf} onClick={() => setAuswahl(vorauswahl(felder))}>
            {t('datasheet.selectFilled', 'Filled ones')}
          </button>
          <button type="button" className={knopf} onClick={() => setAuswahl(new Set(felder.map((f) => f.key)))}>
            {t('datasheet.selectAll', 'All')}
          </button>
          <button type="button" className={knopf} onClick={() => setAuswahl(new Set())}>
            {t('datasheet.selectNone', 'None')}
          </button>
          <span className="flex-1" />
          <button type="button" className={knopf} onClick={() => printHtmlDocument(html())}>
            <Icon icon={Printer} size="xs" />
            {t('datasheet.print', 'Print')}
          </button>
          <button type="button" className={`${knopf} bg-cp-accent text-white hover:bg-cp-accent`} onClick={() => void pdf()}>
            <Icon icon={FileDown} size="xs" />
            {t('datasheet.pdf', 'Save PDF')}
          </button>
        </div>
      }
    >
      <p className="mb-2 text-cp-xs text-cp-text-muted">
        {t('datasheet.hint', 'One A4 page for this device. Filled properties are preselected; an empty one you tick prints as a dash.')}
      </p>
      {pdfFehler && <p className="mb-2 text-cp-xs text-cp-warn">{pdfFehler}</p>}
      {fotos.length > 0 && (
        <fieldset className="mb-3">
          <legend className="mb-1 text-cp-xs font-semibold">{t('datasheet.photos', 'Photos')}</legend>
          <div className="flex flex-wrap gap-2">
            {fotos.map((f) => (
              <label key={f.id} className="flex flex-col items-start gap-1 text-cp-xs">
                <span className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    disabled={!f.dataUri}
                    checked={fotoIds.includes(f.id)}
                    onChange={() => setFotoIds((alt) => (alt.includes(f.id) ? alt.filter((x) => x !== f.id) : [...alt, f.id]))}
                  />
                  {f.notiz || t('datasheet.photo', 'Photo')}
                </span>
                {f.dataUri ? (
                  <img src={f.dataUri} alt={f.notiz ?? ''} className="h-16 w-auto border border-cp-border" />
                ) : (
                  <span className="text-cp-text-faint">{t('datasheet.photoNotLoaded', 'Image not loaded')}</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {gruppen.map(([g, titel]) => {
        const liste = felder.filter((f) => f.gruppe === g)
        if (!liste.length) return null
        return (
          <fieldset key={g} className="mb-3">
            <legend className="mb-1 text-cp-xs font-semibold">{titel}</legend>
            <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {liste.map((f) => (
                <label key={f.key} className="flex min-w-0 items-baseline gap-1.5 text-cp-xs">
                  <input type="checkbox" checked={auswahl.has(f.key)} onChange={() => umschalten(f.key)} />
                  <span className="shrink-0 text-cp-text-secondary">{f.label}</span>
                  <span className={`truncate ${f.wert ? 'text-cp-text' : 'text-cp-text-faint'}`}>{f.wert || '—'}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )
      })}
    </ModalShell>
  )
}
