// ───────────────────────────────────────────────────────────────────────────
// Geräte-Datenblatt (#919) — die Auswahl vor dem Druck.
//
// Eine Checkliste der Eigenschaften, die an den gewählten Geräten ausgefüllt
// sind; alle sind vorausgewählt. Leere Felder stehen gar nicht erst in der
// Liste (siehe `lib/geraeteDatenblatt.ts`). Bei mehreren Geräten gilt ein
// Haken für alle Seiten, und die Zeile sagt, an wie vielen Geräten das Feld
// überhaupt gefüllt ist.
//
// Die Seite selbst zeichnet `exportDevicePdf.ts` im Rahmen des Patch-Sheets;
// gedruckt wird über `printPdfBlob`, wie jedes andere PDF der App.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { FileText, Printer, Download } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import {
  BILD_FOTOS,
  BILD_REFERENZ,
  DATENBLATT_GRUPPEN,
  auswahlZeilen,
  datenblattBilder,
  datenblattEigenschaften,
  gewaehlt,
  gewaehlteBilder,
  gruppenTitel,
  vorauswahl,
} from '../../lib/geraeteDatenblatt'
import {
  buildDeviceDatasheetsBlob,
  exportDeviceDatasheets,
  type DatenblattSeite,
} from '../../lib/exportDevicePdf'
import { printPdfBlob } from '../../lib/printPdfBlob'

/** Gemountet nur, solange offen — die Vorauswahl entsteht beim Öffnen neu. */
export const DeviceDatasheetDialog = () => {
  const datasheet = useUiStore((s) => s.datasheet)
  if (!datasheet) return null
  return <DatasheetBody key={datasheet.equipmentIds.join('|')} ids={datasheet.equipmentIds} />
}

const DatasheetBody = ({ ids }: { ids: string[] }) => {
  const t = useTranslation()
  const lang = useUiStore((s) => s.language)
  const close = useUiStore((s) => s.closeDatasheet)
  const equipment = useProjectStore((s) => s.project.equipment)
  const fotos = useProjectStore((s) => s.project.fotos)
  const locations = useProjectStore((s) => s.project.locations)

  const devices = useMemo(() => {
    const byId = new Map(equipment.map((e) => [e.id, e]))
    return ids.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => !!e)
  }, [equipment, ids])

  const listen = useMemo(
    () => devices.map((d) => datenblattEigenschaften(d, { t, lang, locations })),
    // `t` wechselt mit der Sprache; `lang` steht deshalb für beide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, lang, locations],
  )
  const bilder = useMemo(() => devices.map((d) => datenblattBilder(d, fotos)), [devices, fotos])
  const zeilen = useMemo(() => auswahlZeilen(listen), [listen])

  const fotoAnzahl = bilder.reduce((n, b) => n + b.fotos.length, 0)
  const referenzAnzahl = bilder.filter((b) => b.referenz).length

  const alleSchluessel = useMemo(() => {
    const s = vorauswahl(listen.flat())
    if (fotoAnzahl > 0) s.add(BILD_FOTOS)
    if (referenzAnzahl > 0) s.add(BILD_REFERENZ)
    return s
  }, [listen, fotoAnzahl, referenzAnzahl])

  // Vorausgewählt: alles, was ausgefüllt ist (Issue #919).
  const [auswahl, setAuswahl] = useState<Set<string>>(() => new Set(alleSchluessel))
  const [busy, setBusy] = useState(false)

  const umschalten = (key: string) =>
    setAuswahl((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const seiten = (): DatenblattSeite[] =>
    devices.map((device, i) => ({
      device,
      eigenschaften: gewaehlt(listen[i], auswahl),
      bilder: gewaehlteBilder(bilder[i], auswahl),
    }))

  const speichern = () => {
    setBusy(true)
    try {
      exportDeviceDatasheets(seiten(), { t })
      close()
    } finally {
      setBusy(false)
    }
  }

  const drucken = () => {
    setBusy(true)
    try {
      const blob = buildDeviceDatasheetsBlob(seiten(), { t })
      if (blob) void printPdfBlob(blob)
      close()
    } finally {
      setBusy(false)
    }
  }

  const mehrere = devices.length > 1
  const titel = mehrere
    ? format(t('datasheet.dialog.titleMany', 'Device datasheets ({n} devices)'), { n: devices.length })
    : format(t('datasheet.dialog.titleOne', 'Device datasheet: {name}'), { name: devices[0]?.name ?? '' })

  const zeile = (key: string, label: string, rechts: string) => (
    <label
      key={key}
      className="flex cursor-pointer items-start gap-2 px-2 py-1 text-cp-xs hover:bg-cp-surface-2"
    >
      <input type="checkbox" checked={auswahl.has(key)} onChange={() => umschalten(key)} className="mt-0.5" />
      <span className="w-40 shrink-0 text-cp-text-secondary">{label}</span>
      <span className="min-w-0 flex-1 truncate text-cp-text" title={rechts}>
        {rechts}
      </span>
    </label>
  )

  const anzahlText = (n: number) =>
    format(t('datasheet.dialog.filledOn', 'filled on {n} of {total}'), { n, total: devices.length })

  return (
    <ModalShell
      open
      onClose={close}
      title={titel}
      titleIcon={<Icon icon={FileText} size="sm" />}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-cp-xs text-cp-text-muted">
            {format(t('datasheet.dialog.pages', '{n} A4 page(s), one per device'), { n: devices.length })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={speichern}
              disabled={busy || devices.length === 0}
              className="inline-flex items-center gap-1 bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
            >
              <Icon icon={Download} size="xs" />
              {t('datasheet.dialog.savePdf', 'Save PDF')}
            </button>
            <button
              type="button"
              onClick={drucken}
              disabled={busy || devices.length === 0}
              className="inline-flex items-center gap-1 bg-cp-accent px-3 py-1.5 text-cp-xs text-cp-accent-text hover:opacity-90 disabled:opacity-50"
            >
              <Icon icon={Printer} size="xs" />
              {t('datasheet.dialog.print', 'Print')}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-cp-xs text-cp-text-muted">
          {t(
            'datasheet.dialog.hint',
            'Tick what goes on the sheet. All filled-in properties are preselected; empty fields are not listed.',
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAuswahl(new Set(alleSchluessel))}
            className="bg-cp-surface-2 px-2 py-0.5 text-cp-xs hover:bg-cp-surface-4"
          >
            {t('datasheet.dialog.all', 'Select all')}
          </button>
          <button
            type="button"
            onClick={() => setAuswahl(new Set())}
            className="bg-cp-surface-2 px-2 py-0.5 text-cp-xs hover:bg-cp-surface-4"
          >
            {t('datasheet.dialog.none', 'Select none')}
          </button>
        </div>

        {(fotoAnzahl > 0 || referenzAnzahl > 0) && (
          <section>
            <h3 className="mb-1 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
              {t('datasheet.dialog.images', 'Images')}
            </h3>
            <div className="border border-cp-border-muted bg-cp-surface-1/40 p-1">
              {fotoAnzahl > 0 &&
                zeile(
                  BILD_FOTOS,
                  t('datasheet.dialog.photos', 'Documentation photos'),
                  format(t('datasheet.dialog.photoCount', '{n} photo(s), up to 4 per page'), { n: fotoAnzahl }),
                )}
              {referenzAnzahl > 0 &&
                zeile(
                  BILD_REFERENZ,
                  t('datasheet.dialog.reference', 'Reference image'),
                  mehrere ? anzahlText(referenzAnzahl) : '',
                )}
            </div>
          </section>
        )}

        {zeilen.length === 0 && (
          <p className="text-cp-xs text-cp-text-muted">
            {t('datasheet.dialog.empty', 'No property is filled in on these devices yet.')}
          </p>
        )}

        {DATENBLATT_GRUPPEN.map((g) => {
          const inGruppe = zeilen.filter((z) => z.gruppe === g)
          if (inGruppe.length === 0) return null
          return (
            <section key={g}>
              <h3 className="mb-1 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
                {gruppenTitel(g, t)}
              </h3>
              <div className="border border-cp-border-muted bg-cp-surface-1/40 p-1">
                {inGruppe.map((z) => zeile(z.key, z.label, mehrere ? anzahlText(z.anzahl) : z.wert))}
              </div>
            </section>
          )
        })}
      </div>
    </ModalShell>
  )
}
