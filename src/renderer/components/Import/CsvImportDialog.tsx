// Issue #354 — generischer Equipment-CSV-Import in die Library.
//
// Non-destruktiv: erzeugt Custom-Library-Templates via addCustomTemplates
// (merged by-name, überschreibt keine bestehenden). Spalten werden anhand
// der Kopfzeile automatisch zugeordnet (DE/EN-Aliase); der User sieht eine
// Vorschau bevor importiert wird. Deckt Rental-Systeme ab, die kein
// dediziertes Plugin haben (Current RMS / HireHop / Flex / Excel-Export).
//
// BEDARF 29 (P1) — „silent data loss on import must be impossible". Die
// Zuordnung, die Vorschau und die Zaehlung liegen seither in
// `lib/csvImportPlan.ts`: was NICHT uebernommen wird, hat dort einen Namen,
// eine Liste und eine Zahl, und dieser Dialog zeigt sie. Drei stille Verluste
// waren es vorher — unbekannte Spalten, namenlose Zeilen, und eine
// Erfolgsmeldung, die uebersprungene Namen als „hinzugefuegt" zaehlte.

import { useMemo, useState } from 'react'
import { FileUp, AlertTriangle } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { Button } from '../shared/Button'
import { infoDialog } from '../../lib/infoDialog'
import { useTranslation, format } from '../../lib/i18n'
import { parseCsv } from '../../lib/csvParse'
import { ALIASES, planCsvImport, type FieldKey } from '../../lib/csvImportPlan'

export const CsvImportDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.csvImport.open)
  const close = useUiStore((s) => s.closeCsvImport)
  const addCustomTemplates = useProjectStore((s) => s.addCustomTemplates)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const [text, setText] = useState('')

  const parsed = useMemo(() => parseCsv(text), [text])
  const plan = useMemo(
    () =>
      planCsvImport(
        parsed,
        customLibrary.map((tpl) => tpl.name),
        t('csvImport.fallbackCategory', 'Importiert'),
      ),
    [parsed, customLibrary, t],
  )
  const templates = plan.fresh

  if (!open) return null

  const onFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const doImport = () => {
    addCustomTemplates(templates)
    close()
    setText('')
    // Die Zahl im Erfolgsfenster ist jetzt die, die wirklich angelegt wurde —
    // und was NICHT angelegt wurde, steht daneben statt nirgends.
    void infoDialog(t('csvImport.doneTitle', 'CSV importiert'), {
      body: format(
        t(
          'csvImport.doneBody',
          '{n} Gerät(e) neu angelegt. Unverändert geblieben: {vorhanden} bereits vorhandene(r) Name(n). Übersprungen: {ohneName} Zeile(n) ohne Namen.',
        ),
        {
          n: plan.fresh.length,
          vorhanden: plan.existing.length,
          ohneName: plan.rowsWithoutName.length,
        },
      ),
      tone: 'success',
    })
  }

  const mappedFields = (Object.keys(ALIASES) as FieldKey[]).filter((k) => plan.mapping[k] != null)
  const etwasFaelltAuf =
    plan.unmapped.length > 0 || plan.duplicates.length > 0 || plan.rowsWithoutName.length > 0 || plan.existing.length > 0

  return (
    <ModalShell
      open={open}
      onClose={close}
      maxWidth="3xl"
      titleIcon={<Icon icon={FileUp} size="md" />}
      title={t('csvImport.title', 'Equipment aus CSV importieren')}
    >
      <div className="space-y-3 p-1 text-cp-base">
        <p className="text-cp-xs text-[var(--cp-text-muted)]">
          {t(
            'csvImport.intro',
            'CSV einfügen oder Datei wählen. Erste Zeile = Spaltenüberschriften. Erkannte Spalten: Name, Kategorie, Leistung (W), Gewicht (kg), Seriennummer, IP, HE, Untertitel/Hersteller. Jede andere Spalte wandert in die Notizen — nichts fällt still weg. Import legt Library-Templates an (kein Überschreiben).',
          )}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded bg-[var(--cp-surface-2)] px-2 py-1 text-cp-xs hover:bg-[var(--cp-surface-3)]">
          <Icon icon={FileUp} size="xs" /> {t('csvImport.pickFile', 'CSV-Datei wählen…')}
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={t('csvImport.placeholder', 'Name;Kategorie;Leistung;Gewicht;Seriennummer\nATEM Mini;Mischer;30;1.1;SN123')}
          className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-2 font-mono text-cp-xs"
        />
        {parsed.length > 1 && (
          <>
            <div className="text-cp-xs text-[var(--cp-text-faint)]">
              {format(t('csvImport.detected', 'Erkannt: {rows} Zeile(n), zugeordnete Spalten: {fields}'), {
                rows: templates.length,
                fields: mappedFields.join(', ') || '—',
              })}
            </div>

            {/* BEDARF 29 — was NICHT ankommt, steht hier. Der Bedarf verlangt
                „a preview that names exactly what will be dropped"; eine
                Vorschau, die nur die erkannten Spalten nennt, sagt ueber die
                nicht erkannten nichts — und Verschweigen sieht aus wie
                „vollstaendig uebernommen". */}
            {etwasFaelltAuf && (
              <div className="rounded border border-[var(--cp-warn)]/40 bg-[var(--cp-surface-2)] p-2 text-cp-xs">
                <div className="mb-1 flex items-center gap-1 font-medium text-[var(--cp-text)]">
                  <Icon icon={AlertTriangle} size="xs" />
                  {t('csvImport.whatHappens', 'Was mit dem Rest passiert')}
                </div>
                <ul className="flex list-disc flex-col gap-0.5 pl-4 text-[var(--cp-text-secondary)]">
                  {plan.unmapped.length > 0 && (
                    <li>
                      {format(
                        t(
                          'csvImport.unmapped',
                          'Nicht als Feld erkannt, wandert in die Notizen: {cols}',
                        ),
                        { cols: plan.unmapped.map((c) => c.header || `#${c.index + 1}`).join(', ') },
                      )}
                    </li>
                  )}
                  {plan.duplicates.length > 0 && (
                    <li>
                      {format(
                        t(
                          'csvImport.duplicateCols',
                          'Zweite Spalte auf dasselbe Feld — die erste gewinnt, diese wird zur Notiz: {cols}',
                        ),
                        {
                          cols: plan.duplicates
                            .map((c) => `${c.header || `#${c.index + 1}`} (${c.field})`)
                            .join(', '),
                        },
                      )}
                    </li>
                  )}
                  {plan.rowsWithoutName.length > 0 && (
                    <li>
                      {format(
                        t('csvImport.noName', '{n} Zeile(n) ohne Namen werden übersprungen: {rows}'),
                        {
                          n: plan.rowsWithoutName.length,
                          rows: plan.rowsWithoutName.slice(0, 12).join(', '),
                        },
                      )}
                    </li>
                  )}
                  {plan.existing.length > 0 && (
                    <li>
                      {format(
                        t(
                          'csvImport.existing',
                          '{n} Name(n) gibt es schon — sie bleiben unverändert, es wird nichts überschrieben: {names}',
                        ),
                        {
                          n: plan.existing.length,
                          names: plan.existing.slice(0, 12).join(', '),
                        },
                      )}
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="max-h-48 overflow-auto rounded border border-[var(--cp-border-muted)]">
              <table className="w-full text-cp-xs">
                <thead className="sticky top-0 bg-[var(--cp-surface-2)] text-left text-[var(--cp-text-muted)]">
                  <tr>
                    <th className="px-2 py-1">{t('csvImport.col.name', 'Name')}</th>
                    <th className="px-2 py-1">{t('csvImport.col.category', 'Kategorie')}</th>
                    <th className="px-2 py-1 text-right">W</th>
                    <th className="px-2 py-1 text-right">kg</th>
                    <th className="px-2 py-1">HE</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.slice(0, 50).map((tpl, i) => (
                    <tr key={`${tpl.name}-${i}`} className="border-t border-[var(--cp-border-muted)]">
                      <td className="px-2 py-0.5">{tpl.name}</td>
                      <td className="px-2 py-0.5">{tpl.category}</td>
                      <td className="px-2 py-0.5 text-right">{tpl.powerConsumptionWatts ?? ''}</td>
                      <td className="px-2 py-0.5 text-right">{tpl.weightKg ?? ''}</td>
                      <td className="px-2 py-0.5">{tpl.rackUnits ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={close}>
            {t('common.cancel', 'Abbrechen')}
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={doImport}
            disabled={templates.length === 0}
          >
            {format(t('csvImport.importBtn', '{n} importieren'), { n: templates.length })}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
