import { useMemo, useState } from 'react'
import { ListOrdered } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { ablaufAusText, positionsKarte } from '../../lib/rundownCard'
import type { RundownPlan, SegmentCoverage } from '../../types/rundown'

/**
 * BEDARF 10 — der Ablauf wird EINGELESEN und die Zuordnung gepflegt.
 *
 * Der Bedarf zieht die Grenze selbst:
 *
 *   > Do not build a rundown editor — link segment IDs to positions.
 *
 * Dieses Fenster haelt sich daran, und man sieht es an seiner Form: oben ein
 * Textfeld, in das man den Ablauf HINEINWIRFT (aus der Tabelle kopiert, aus
 * der Mail), unten eine Tabelle, in der nur EINE Sorte Zelle beschreibbar ist
 * — der Auftrag einer Position in einem Abschnitt. Titel und Nummern lassen
 * sich hier nicht aendern. Wer das koennte, haette zwei Ablaeufe, und der
 * falsche waere der neuere.
 *
 * WARUM DIE HERKUNFT EIN PFLICHTFELD IST. Die Karte am Kameraplatz zeigt sie
 * an. Ohne sie sieht jede Karte aktuell aus, auch wenn sie drei Fassungen alt
 * ist — und genau diesen Zustand beschreibt der Beleg („Buendel gedruckter
 * Ablaufplaene, bei jeder Aenderung neu gedruckt und neu gemailt").
 */
export const RundownDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.rundownOpen)
  const setOpen = useUiStore((s) => s.setRundownOpen)
  const rundown = useProjectStore((s) => s.project.rundown)
  const setRundown = useProjectStore((s) => s.setRundown)
  const identities = useProjectStore((s) => s.project.sourceIdentities) ?? []

  const [text, setText] = useState('')
  const [quelle, setQuelle] = useState('')
  const [stand, setStand] = useState('')
  const [funde, setFunde] = useState<ReturnType<typeof ablaufAusText>['funde']>([])

  // Die Vorschau der Zuordnung: EINE Rechnung, dieselbe wie am Kameraplatz.
  // Wer hier eine eigene aufstellte, zeigte dem Planer eine andere Karte als
  // dem Kameramann — und der Unterschied fiele erst im Saal auf.
  const karten = useMemo(
    () => (rundown ? identities.map((i) => positionsKarte(rundown, i.id)) : []),
    [rundown, identities],
  )

  const einlesen = () => {
    const gelesen = ablaufAusText(text)
    setFunde(gelesen.funde)
    if (gelesen.segments.length === 0) return
    const bekannt = new Set(gelesen.segments.map((s) => s.id))
    const naechster: RundownPlan = {
      source: quelle.trim() || t('rundown.sourceUnknown', 'Origin unknown'),
      ...(stand.trim() ? { revision: stand.trim() } : {}),
      // Die Uhr steht HIER und nicht im Modul: `ablaufAusText` bleibt rein.
      importedAt: new Date().toISOString(),
      segments: gelesen.segments,
      // ZUORDNUNGEN UEBERLEBEN DAS NEU-EINLESEN, soweit ihr Abschnitt es tut.
      // Das ist der ganze Zweck der abgeleiteten Kennung (siehe
      // `lib/rundownCard.ts`): eine Umformulierung des Titels laesst den
      // Auftrag stehen. Was auf einen weggefallenen Abschnitt zeigte, faellt
      // weg — sichtbar, denn die Karte zeigt den Abschnitt dann nicht mehr.
      coverage: (rundown?.coverage ?? []).filter((c) => bekannt.has(c.segmentId)),
    }
    setRundown(naechster)
    setText('')
  }

  const setzeAuftrag = (segmentId: string, sourceId: string, shot: string) => {
    if (!rundown) return
    const rest = rundown.coverage.filter(
      (c) => !(c.segmentId === segmentId && c.sourceId === sourceId),
    )
    const naechste: SegmentCoverage[] = shot.trim()
      ? [...rest, { segmentId, sourceId, shot: shot.trim() }]
      : // Ein geleerter Auftrag wird ENTFERNT und nicht als leerer Text
        // gespeichert: „kein Auftrag eingetragen" und „Auftrag: nichts" sind
        // zwei Auskuenfte, und die Karte unterscheidet sie.
        rest
    setRundown({ ...rundown, coverage: naechste })
  }

  const auftrag = (segmentId: string, sourceId: string): string =>
    rundown?.coverage.find((c) => c.segmentId === segmentId && c.sourceId === sourceId)?.shot ?? ''

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('rundown.title', 'Rundown and camera assignments')}
      titleIcon={<Icon icon={ListOrdered} size="md" />}
      maxWidth="5xl"
      draggableKey="cable-planner:modal-pos:rundown"
    >
      <div className="space-y-4 text-cp-sm">
        <section className="rounded border border-cp-border bg-cp-surface-2/40 p-3">
          <h3 className="mb-1 font-medium text-cp-text">
            {t('rundown.import', 'Read in the rundown')}
          </h3>
          <PanelHint
            className="mb-2 text-cp-xs text-cp-text-muted"
            text={t(
              'rundown.import.hint',
              'The rundown belongs to the editorial team and is only read here. One line per segment: number, title, note - separated by a tab or a semicolon. Cells copied from a spreadsheet bring the tab along.',
            )}
          />
          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block text-cp-xs text-cp-text-secondary">
              <span className="mb-1 block">{t('rundown.source', 'Where it comes from')}</span>
              <input
                value={quelle}
                onChange={(e) => setQuelle(e.target.value)}
                placeholder={t('rundown.source.placeholder', 'e.g. rundown.xlsx, mail of 9 Sept')}
                className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
              />
            </label>
            <label className="block text-cp-xs text-cp-text-secondary">
              <span className="mb-1 block">{t('rundown.revision', 'Version of the source')}</span>
              <input
                value={stand}
                onChange={(e) => setStand(e.target.value)}
                placeholder={t('rundown.revision.placeholder', 'e.g. v4, third draft')}
                className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
              />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={t('rundown.pastePh', '1\tWelcome\n2\tInterview\tGuest enters from the left\n3\tMusic')}
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono text-cp-xs"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={einlesen}
              disabled={text.trim() === ''}
              className="rounded bg-cp-accent px-3 py-1 text-cp-xs text-white disabled:opacity-50"
            >
              {t('rundown.read', 'Read in')}
            </button>
            {rundown && (
              <span className="text-cp-xs text-cp-text-muted">
                {rundown.segments.length} {t('rundown.segments', 'segments')} ·{' '}
                {rundown.source}
                {rundown.revision ? ` · ${rundown.revision}` : ''}
              </span>
            )}
          </div>
          {/* Was beim Lesen auffiel, steht da — eine still weggelassene Zeile
              stand im Ablauf und fehlt danach ohne Spur. */}
          {funde.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {funde.map((f) => (
                <li key={f.zeile} className="text-cp-xs text-cp-warn">
                  {t('rundown.finding.line', 'Line')} {f.zeile}:{' '}
                  {f.grund === 'ohne-titel'
                    ? t('rundown.finding.noTitle', 'number without a title - not taken over')
                    : t('rundown.finding.empty', 'nothing readable - not taken over')}{' '}
                  <code className="text-cp-text-muted">{f.text}</code>
                </li>
              ))}
            </ul>
          )}
        </section>

        {rundown && identities.length === 0 && (
          <p className="text-cp-xs text-cp-text-muted">
            {t(
              'rundown.noIdentities',
              'There are no source roles ("Camera 1") yet. Without them there is no position an assignment could belong to.',
            )}
          </p>
        )}

        {rundown && identities.length > 0 && (
          <section>
            <h3 className="mb-1 font-medium text-cp-text">
              {t('rundown.coverage', 'Who does what')}
            </h3>
            <PanelHint
              className="mb-2 text-cp-xs text-cp-text-muted"
              text={t(
                'rundown.coverage.hint',
                'The assignment belongs to the role, not to the device - when the standby camera steps in, it stays. An empty cell means "no assignment recorded", not "free".',
              )}
            />
            {/* B-44 Teil 3 — breite Inhalte bekommen ihren eigenen
                Scrollbereich, statt die Seite quer zu ziehen. */}
            <div className="overflow-x-auto">
              <table className="w-full text-cp-xs">
                <thead className="text-cp-text-secondary">
                  <tr>
                    <th className="px-2 py-1 text-left">{t('rundown.col.no', 'No.')}</th>
                    <th className="px-2 py-1 text-left">{t('rundown.col.title', 'Segment')}</th>
                    {identities.map((i) => (
                      <th key={i.id} className="px-2 py-1 text-left whitespace-nowrap">
                        {i.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rundown.segments.map((seg) => (
                    <tr key={seg.id} className="border-t border-cp-border-muted">
                      <td className="px-2 py-1 font-mono text-cp-text-muted">{seg.number ?? '—'}</td>
                      <td className="px-2 py-1">
                        {seg.title}
                        {seg.note && (
                          <span className="block text-cp-text-muted">{seg.note}</span>
                        )}
                      </td>
                      {identities.map((i) => (
                        <td key={i.id} className="px-1 py-1">
                          <input
                            value={auftrag(seg.id, i.id)}
                            onChange={(e) => setzeAuftrag(seg.id, i.id, e.target.value)}
                            placeholder="—"
                            className="w-32 rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-cp-xs text-cp-text-muted">
              {karten
                .map((k) => {
                  const name = identities.find((i) => i.id === k.sourceId)?.name ?? k.sourceId
                  return `${name}: ${k.mitAuftrag}/${k.zeilen.length}`
                })
                .join(' · ')}
            </p>
          </section>
        )}
      </div>
    </ModalShell>
  )
}
