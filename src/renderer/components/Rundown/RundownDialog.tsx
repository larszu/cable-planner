import { useEffect, useMemo, useState } from 'react'
import { FileText, ListOrdered, X } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { ablaufAusText, positionsKarte } from '../../lib/rundownCard'
import type { RundownPlan, SegmentCoverage, SegmentLink } from '../../types/rundown'
import { regieBlattForProject, type AblaufBefund } from '../../lib/ablaufPruefung'
import { ablaufFuerProjekt, regieBlattHtml } from '../../lib/ablaufRegie'
import { triggerCanvasCenterOn } from '../../lib/canvasViewport'
import { stampForRows, stampLine } from '../../lib/documentStamp'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { recordEmission } from '../../lib/documentLog'
import { format } from '../../lib/i18n'

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
  const identitiesRaw = useProjectStore((s) => s.project.sourceIdentities)
  const identities = useMemo(() => identitiesRaw ?? [], [identitiesRaw])
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const setSelection = useProjectStore((s) => s.setSelection)
  const fokus = useUiStore((s) => s.rundownFokus)
  // #1182 — je Abschnitt: verknuepfte Geraete und Wege, und ob sie stehen.
  const punkte = useMemo(
    () => (open ? ablaufFuerProjekt({ rundown, equipment, cables }) : []),
    [open, rundown, equipment, cables],
  )
  useEffect(() => {
    if (!open || !fokus) return
    document.getElementById(`ablauf-${fokus}`)?.scrollIntoView({ block: 'center' })
  }, [open, fokus])

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
      // #1182 — die Verknuepfungen ueberleben genauso.
      ...(rundown?.links ? { links: rundown.links.filter((l) => bekannt.has(l.segmentId)) } : {}),
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

  const setzeLink = (segmentId: string, aendern: (l: SegmentLink) => SegmentLink) => {
    if (!rundown) return
    const alt = rundown.links?.find((l) => l.segmentId === segmentId) ?? { segmentId, equipmentIds: [], cableIds: [] }
    const neu = aendern(alt)
    const rest = (rundown.links ?? []).filter((l) => l.segmentId !== segmentId)
    const links = neu.equipmentIds.length || neu.cableIds.length ? [...rest, neu] : rest
    setRundown({ ...rundown, links })
  }

  const springeZu = (b: { equipmentId?: string; cableId?: string }) => {
    const mitte = (id: string) => {
      const e = equipment.find((x) => x.id === id)
      return e ? { x: e.x + e.width / 2, y: e.y + e.height / 2 } : undefined
    }
    if (b.cableId) {
      setSelection(undefined, b.cableId, undefined)
      const c = cables.find((x) => x.id === b.cableId)
      const a = c && mitte(c.fromEquipmentId)
      const z = c && mitte(c.toEquipmentId)
      const p = a && z ? { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 } : (a ?? z)
      if (p) triggerCanvasCenterOn(p.x, p.y)
    } else if (b.equipmentId) {
      setSelection(b.equipmentId, undefined, undefined)
      const p = mitte(b.equipmentId)
      if (p) triggerCanvasCenterOn(p.x, p.y)
    }
    setOpen(false)
  }

  const befundText = (b: AblaufBefund): string => {
    switch (b.art) {
      case 'geraet-fehlt':
        return t('runOfShow.finding.deviceGone', 'Linked device is no longer in the plan')
      case 'weg-fehlt':
        return t('runOfShow.finding.pathGone', 'Linked path is no longer in the plan')
      case 'weg-ohne-ende':
        return format(t('runOfShow.finding.pathEnd', 'Path {name} is missing an end'), { name: b.id })
      case 'check':
        return b.text ?? ''
    }
  }

  const regieBlattAusgeben = () => {
    const { project, filePath } = useProjectStore.getState()
    const titel = t('runOfShow.sheet', 'Run of show for the gallery')
    const html = regieBlattHtml(project, {
      titel: `${project.metadata.name || titel} — ${titel}`,
      stempel: stampLine(stampForRows(project, regieBlattForProject, new Date())),
      t,
    })
    downloadBlob(buildExportFilenameWithSuffix(project.metadata.name || 'anlage', 'regieblatt', 'html'), html, 'text/html')
    void recordEmission(project, 'regieblatt', filePath ?? undefined, '')
  }

  const geraeteSortiert = useMemo(() => [...equipment].sort((a, b) => a.name.localeCompare(b.name)), [equipment])
  const kabelSortiert = useMemo(
    () =>
      cables
        .map((c) => ({ id: c.id, name: c.cableNumber || c.name || c.id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [cables],
  )

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
        <section className="border border-cp-border bg-cp-surface-2/40 p-3">
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
                className="w-full border border-cp-border bg-cp-surface-1 p-2"
              />
            </label>
            <label className="block text-cp-xs text-cp-text-secondary">
              <span className="mb-1 block">{t('rundown.revision', 'Version of the source')}</span>
              <input
                value={stand}
                onChange={(e) => setStand(e.target.value)}
                placeholder={t('rundown.revision.placeholder', 'e.g. v4, third draft')}
                className="w-full border border-cp-border bg-cp-surface-1 p-2"
              />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={t('rundown.pastePh', '1\tWelcome\n2\tInterview\tGuest enters from the left\n3\tMusic')}
            className="w-full border border-cp-border bg-cp-surface-1 p-2 font-mono text-cp-xs"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={einlesen}
              disabled={text.trim() === ''}
              className="bg-cp-accent px-3 py-1 text-cp-xs text-cp-accent-text disabled:opacity-50"
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

        {rundown && (
          <section>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="flex-1 font-medium text-cp-text">{t('runOfShow.links', 'Devices and paths per segment')}</h3>
              <button
                type="button"
                onClick={regieBlattAusgeben}
                className="inline-flex items-center gap-1 border border-cp-border px-2 py-1 text-cp-xs hover:text-cp-text"
              >
                <Icon icon={FileText} className="h-3 w-3" />
                {t('runOfShow.sheetButton', 'Sheet for the gallery')}
              </button>
            </div>
            <PanelHint
              className="mb-2 text-cp-xs text-cp-text-muted"
              text={t(
                'runOfShow.links.hint',
                'Link the devices and paths a segment needs. Before each segment the plan checks that they are all there, have both ends and that the plan check reports nothing on them. A segment without links is not checked.',
              )}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-cp-xs">
                <thead className="text-cp-text-secondary">
                  <tr>
                    <th className="px-2 py-1 text-left">{t('rundown.col.no', 'No.')}</th>
                    <th className="px-2 py-1 text-left">{t('rundown.col.title', 'Segment')}</th>
                    <th className="px-2 py-1 text-left">{t('runOfShow.col.devices', 'Devices')}</th>
                    <th className="px-2 py-1 text-left">{t('runOfShow.col.paths', 'Paths')}</th>
                    <th className="px-2 py-1 text-left">{t('runOfShow.col.check', 'Check')}</th>
                  </tr>
                </thead>
                <tbody>
                  {punkte.map((p) => {
                    const l = p.link ?? { segmentId: p.segment.id, equipmentIds: [], cableIds: [] }
                    return (
                      <tr
                        key={p.segment.id}
                        id={`ablauf-${p.segment.id}`}
                        className={`border-t border-cp-border-muted align-top ${fokus === p.segment.id ? 'bg-cp-accent-soft' : ''}`}
                      >
                        <td className="px-2 py-1 font-mono text-cp-text-muted">{p.segment.number ?? '—'}</td>
                        <td className="px-2 py-1">{p.segment.title}</td>
                        <td className="px-1 py-1">
                          {l.equipmentIds.map((id) => (
                            <span key={id} className="mb-0.5 mr-1 inline-flex items-center gap-0.5 border border-cp-border px-1">
                              {equipment.find((e) => e.id === id)?.name ?? '?'}
                              <button
                                type="button"
                                aria-label={t('runOfShow.unlink', 'Remove link')}
                                onClick={() => setzeLink(p.segment.id, (x) => ({ ...x, equipmentIds: x.equipmentIds.filter((y) => y !== id) }))}
                              >
                                <Icon icon={X} className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          <select
                            value=""
                            aria-label={t('runOfShow.addDevice', 'Add device…')}
                            onChange={(e) => {
                              const id = e.target.value
                              if (id) setzeLink(p.segment.id, (x) => ({ ...x, equipmentIds: [...new Set([...x.equipmentIds, id])] }))
                            }}
                            className="max-w-[10rem] border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                          >
                            <option value="">{t('runOfShow.addDevice', 'Add device…')}</option>
                            {geraeteSortiert.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          {l.cableIds.map((id) => (
                            <span key={id} className="mb-0.5 mr-1 inline-flex items-center gap-0.5 border border-cp-border px-1">
                              {kabelSortiert.find((k) => k.id === id)?.name ?? '?'}
                              <button
                                type="button"
                                aria-label={t('runOfShow.unlink', 'Remove link')}
                                onClick={() => setzeLink(p.segment.id, (x) => ({ ...x, cableIds: x.cableIds.filter((y) => y !== id) }))}
                              >
                                <Icon icon={X} className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          <select
                            value=""
                            aria-label={t('runOfShow.addPath', 'Add path…')}
                            onChange={(e) => {
                              const id = e.target.value
                              if (id) setzeLink(p.segment.id, (x) => ({ ...x, cableIds: [...new Set([...x.cableIds, id])] }))
                            }}
                            className="max-w-[10rem] border border-cp-border bg-cp-surface-1 px-1 py-0.5"
                          >
                            <option value="">{t('runOfShow.addPath', 'Add path…')}</option>
                            {kabelSortiert.map((k) => (
                              <option key={k.id} value={k.id}>
                                {k.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          {p.ok === undefined ? (
                            <span className="text-cp-text-faint">{t('runOfShow.unchecked', 'not linked')}</span>
                          ) : p.ok ? (
                            <span className="text-cp-ok">OK</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {p.befunde.map((b, i) => (
                                <li key={`${b.art}:${b.id}:${i}`}>
                                  {b.equipmentId || b.cableId ? (
                                    <button type="button" onClick={() => springeZu(b)} className="text-left text-cp-warn underline">
                                      {befundText(b)}
                                    </button>
                                  ) : (
                                    <span className="text-cp-warn">{befundText(b)}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

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
                            className="w-32 border border-cp-border bg-cp-surface-1 px-1 py-0.5"
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
