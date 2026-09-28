/**
 * Anhänge — Messprotokolle, Herstellerunterlagen, Konfig-Sicherungen.
 *
 * Die Dateien liegen in `Anhaenge/` neben dem Projekt (main legt sie ab,
 * `attachmentStore.ts`); hier wird gewählt, wozu eine Datei gehört, und
 * gezeigt, ob sie im Ordner liegt. Geöffnet wird nichts — nur im Dateimanager
 * gezeigt. Die Gründe stehen in `attachmentStore.ts` und `anhangSlice.ts`.
 *
 * OHNE DESKTOP-BRÜCKE GIBT ES KEINEN KNOPF, sondern einen Satz — wie bei den
 * Belegen. Ein Knopf, der im Browser nichts ablegt, verspräche eine Ablage,
 * die es nicht gibt.
 */
import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FolderOpen, Paperclip, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { format, useTranslation } from '../../lib/i18n'
import { cablePlannerApi, hasDesktopBridge } from '../../lib/bridge'
import { messungenOhneProtokoll, neuerAnhang, zielName } from '../../lib/anhaenge'
import { ANHANG_ARTEN, type AnhangAblehnung, type AnhangArt, type ProjektAnhang } from '../../types/anhang'
import type { Uebersetzen } from '../../lib/druckblatt'
import { Icon } from '../shared/Icon'
import { PanelHint } from '../shared/PanelHint'

const artText = (a: AnhangArt, t: Uebersetzen): string => {
  switch (a) {
    case 'messprotokoll':
      return t('attachments.kind.testReport', 'Test report')
    case 'herstellerunterlage':
      return t('attachments.kind.manufacturer', 'Manufacturer document')
    case 'konfig-backup':
      return t('attachments.kind.configBackup', 'Configuration backup')
    case 'sonstiges':
      return t('attachments.kind.other', 'Other')
  }
}

const ablehnungText = (r: AnhangAblehnung, t: Uebersetzen): string => {
  switch (r) {
    case 'no-project-path':
      return t('attachments.refusal.noPath', 'The project is not saved yet — there is no folder for the attachment.')
    case 'not-a-file':
      return t('attachments.refusal.notFile', 'That is not a file.')
    case 'too-large':
      return t('attachments.refusal.tooLarge', 'The file is larger than 100 MB.')
    case 'unsupported-type':
      return t('attachments.refusal.type', 'This file type is not accepted.')
    case 'unreadable':
      return t('attachments.refusal.unreadable', 'The file could not be read.')
    case 'outside-project':
      return t('attachments.refusal.outside', 'The target lies outside the project folder.')
  }
}

/** `''` = zur Anlage, sonst `cable:<id>` oder `equipment:<id>`. */
const zielAus = (wert: string): ProjektAnhang['ziel'] => {
  const i = wert.indexOf(':')
  if (i < 0) return undefined
  const type = wert.slice(0, i)
  const id = wert.slice(i + 1)
  return type === 'cable' || type === 'equipment' ? { type, id } : undefined
}

const zielWert = (z: ProjektAnhang['ziel']): string => (z ? `${z.type}:${z.id}` : '')

const vergleich = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export const AnhaengeSection = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const filePath = useProjectStore((s) => s.filePath)
  const addAnhaenge = useProjectStore((s) => s.addAnhaenge)
  const updateAnhang = useProjectStore((s) => s.updateAnhang)
  const removeAnhang = useProjectStore((s) => s.removeAnhang)
  const [art, setArt] = useState<AnhangArt>('messprotokoll')
  const [ziel, setZiel] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [vorhanden, setVorhanden] = useState<Record<string, boolean>>({})

  const anhaenge = useMemo(() => project.anhaenge ?? [], [project.anhaenge])
  const ohneProtokoll = useMemo(() => messungenOhneProtokoll(project), [project])
  const kabel = useMemo(
    () =>
      project.cables
        .map((c) => ({ id: c.id, name: c.cableNumber || c.name || c.id }))
        .sort((a, b) => vergleich(a.name, b.name)),
    [project.cables],
  )
  const geraete = useMemo(
    () => project.equipment.map((e) => ({ id: e.id, name: e.name })).sort((a, b) => vergleich(a.name, b.name)),
    [project.equipment],
  )

  // Liegt jede Datei im Ordner? Eine Frage an DIESEN Rechner, deshalb live
  // und nicht im Projekt.
  useEffect(() => {
    if (!hasDesktopBridge || !filePath || anhaenge.length === 0) return
    let aktiv = true
    void cablePlannerApi.attachment
      .present(
        filePath,
        anhaenge.map((a) => a.datei.storedAs),
      )
      .then((r) => {
        if (aktiv) setVorhanden(r)
      })
    return () => {
      aktiv = false
    }
  }, [filePath, anhaenge])

  const kabelName = new Map(kabel.map((k) => [k.id, k.name]))

  const zielAuswahl = (wert: string, onChange: (v: string) => void, label: string) => (
    <select
      value={wert}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="max-w-[14rem] border border-cp-border bg-cp-surface-1 px-1.5 py-1"
    >
      <option value="">{t('attachments.target.site', 'Whole installation')}</option>
      {kabel.length > 0 && (
        <optgroup label={t('attachments.target.cables', 'Cables')}>
          {kabel.map((k) => (
            <option key={k.id} value={`cable:${k.id}`}>
              {k.name}
            </option>
          ))}
        </optgroup>
      )}
      {geraete.length > 0 && (
        <optgroup label={t('attachments.target.devices', 'Devices')}>
          {geraete.map((g) => (
            <option key={g.id} value={`equipment:${g.id}`}>
              {g.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )

  return (
    <section className="border border-cp-border bg-cp-surface-2/40 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-cp-text-bright">
        <Icon icon={Paperclip} size="sm" />
        {t('attachments.title', 'Attachments')}{' '}
        <span className="text-cp-text-muted">({anhaenge.length})</span>
      </h3>
      <PanelHint
        className="mb-2 text-cp-xs text-cp-text-muted"
        text={t(
          'attachments.hint',
          'Test reports, manufacturer documents, configuration backups. The files are copied into the folder "Anhaenge" next to the project; pass the project on without that folder and they do not travel with it. Removing an entry here keeps the file.',
        )}
      />

      {!hasDesktopBridge ? (
        <p className="text-cp-xs text-cp-text-muted">
          {t('attachments.desktopOnly', 'Attachments only in the desktop app')}
        </p>
      ) : (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={art}
            onChange={(e) => setArt(e.target.value as AnhangArt)}
            aria-label={t('attachments.kind', 'Kind')}
            className="border border-cp-border bg-cp-surface-1 px-1.5 py-1"
          >
            {ANHANG_ARTEN.map((a) => (
              <option key={a} value={a}>
                {artText(a, t)}
              </option>
            ))}
          </select>
          {zielAuswahl(ziel, setZiel, t('attachments.target', 'Belongs to'))}
          <button
            type="button"
            onClick={async () => {
              setFehler(null)
              const r = await cablePlannerApi.attachment.pick(filePath ?? undefined)
              if (r.canceled) return
              const neu: ProjektAnhang[] = []
              const abgelehnt: string[] = []
              for (const x of r.results) {
                if (x.ok) neu.push(neuerAnhang(x.file, art, zielAus(ziel), uuidv4()))
                else abgelehnt.push(ablehnungText(x.reason, t))
              }
              addAnhaenge(neu)
              if (abgelehnt.length) setFehler([...new Set(abgelehnt)].join(' '))
            }}
            className="inline-flex items-center gap-1.5 bg-cp-surface-4 px-3 py-1.5 hover:bg-cp-surface-5"
          >
            <Icon icon={Paperclip} size="sm" /> {t('attachments.add', 'Attach files…')}
          </button>
          {fehler && <span className="text-cp-xs text-cp-danger">{fehler}</span>}
        </div>
      )}

      {ohneProtokoll.length > 0 && (
        <p className="mb-2 text-cp-xs text-cp-warn">
          {format(t('attachments.missingReports', '{n} cable(s) have a test result but no report: {list}'), {
            n: ohneProtokoll.length,
            list: ohneProtokoll
              .map((id) => kabelName.get(id) ?? id)
              .slice(0, 12)
              .join(', '),
          })}
        </p>
      )}

      {anhaenge.length > 0 && (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto text-cp-xs">
          {anhaenge.map((a) => {
            const name = zielName(project, a.ziel)
            const da = vorhanden[a.datei.storedAs]
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2 border border-cp-border-muted bg-cp-surface-1 px-2 py-1.5">
                <select
                  value={a.art}
                  onChange={(e) => updateAnhang(a.id, { art: e.target.value as AnhangArt })}
                  aria-label={t('attachments.kind', 'Kind')}
                  className="border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                >
                  {ANHANG_ARTEN.map((x) => (
                    <option key={x} value={x}>
                      {artText(x, t)}
                    </option>
                  ))}
                </select>
                <input
                  // Der Schlüssel trägt den Titel: nach Rückgängig steht sonst
                  // der alte Text im Feld, weil `defaultValue` nur einmal gilt.
                  key={`${a.id}:${a.titel}`}
                  defaultValue={a.titel}
                  placeholder={a.datei.fileName}
                  onBlur={(e) => {
                    if (e.target.value !== a.titel) updateAnhang(a.id, { titel: e.target.value })
                  }}
                  aria-label={t('attachments.titleField', 'Title')}
                  className="min-w-[10rem] flex-1 border border-cp-border bg-cp-surface-1 px-1.5 py-0.5"
                />
                {zielAuswahl(
                  zielWert(a.ziel),
                  (v) => updateAnhang(a.id, { ziel: zielAus(v) }),
                  t('attachments.target', 'Belongs to'),
                )}
                {name === null && (
                  <span className="text-cp-warn">{t('attachments.targetGone', 'Target no longer in the plan')}</span>
                )}
                <span className="text-cp-text-faint">{Math.ceil(a.datei.bytes / 1024)} KB</span>
                {hasDesktopBridge && filePath && da === false && (
                  <span className="text-cp-danger">{t('attachments.fileMissing', 'File not in the folder')}</span>
                )}
                {hasDesktopBridge && (
                  <button
                    type="button"
                    onClick={() => void cablePlannerApi.attachment.reveal(filePath ?? undefined, a.datei.storedAs)}
                    title={t('attachments.reveal', 'Show in folder')}
                    className="p-1 hover:bg-cp-surface-2"
                  >
                    <Icon icon={FolderOpen} size="xs" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAnhang(a.id)}
                  title={t('attachments.remove', 'Remove entry (the file stays in the folder)')}
                  className="p-1 text-cp-danger hover:bg-cp-surface-2"
                >
                  <Icon icon={Trash2} size="xs" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
