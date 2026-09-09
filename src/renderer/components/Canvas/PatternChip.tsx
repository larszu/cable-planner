import { useMemo, useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { stampForRows } from '../../lib/documentStamp'
import { usePatternStore } from '../../store/patternStore'
import { usePatternBefunde, usePatternOverview, usePatternRouting, usePatternSumme } from '../../hooks/usePattern'
import { diagnoseZeilen } from '../../lib/patternDiagnose'
import { patternPruefzeilen, patternRouting } from '../../lib/patternRouting'
import { testPatternSvg } from '../../lib/testPattern'
import { HubSwitchDialog } from './HubSwitchDialog'
import { schaltbareWege } from '../../lib/controlActions'
import { useTranslation, format } from '../../lib/i18n'

/**
 * Das Prüfbild — welche Quelle trägt es, und wo müsste es ankommen.
 *
 * DER STREIFEN IST PFLICHT UND NICHT ZIERDE, aus demselben Grund wie
 * `FlowModeChip` und `CircuitChip`: auf den Geräte-Karten stehen dann
 * Prüfbilder, und ein Bild auf einem Plan sieht aus wie eine Rückmeldung.
 * Hier steht, dass es eine ERWARTUNG ist — und dass diese App nicht sieht,
 * was wirklich ankommt.
 *
 * ER NENNT AUCH DIE OFFENEN WEGE. Ein Plan, der von einer Quelle aus an drei
 * Stellen nicht weiterweiss, ist für eine Inbetriebnahme die wichtigere
 * Auskunft als die sieben Wege, die er kennt: an genau diesen drei Monitoren
 * versteht später niemand, warum kein Bild kommt.
 */
export function PatternChip() {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const equipment = project.equipment
  const quelleId = usePatternStore((s) => s.quelleId)
  const waehle = usePatternStore((s) => s.waehle)
  const { quellName, ziele, offen } = usePatternOverview()
  const routing = usePatternRouting()
  const summe = usePatternSumme()
  const befunde = usePatternBefunde()
  const [schaltenOffen, setSchaltenOffen] = useState(false)

  // B-42 Inkrement 3 — „schalten" wird nur angeboten, wenn auf einem Weg
  // dieser Quelle ueberhaupt eine Kreuzschiene liegt. Ein Knopf, der bei
  // fest verkabelten Wegen nichts tun kann, verspricht eine Wirkung.
  const schaltbar = useMemo(
    () => schaltbareWege(routing.ziele).length > 0,
    [routing.ziele],
  )

  // Als Quelle kommt in Frage, was einen Ausgang hat. Kein Namensabgleich,
  // keine Kategorie-Liste: ein Gerät ohne Ausgang kann nichts einspeisen,
  // und alles andere ist die Entscheidung des Nutzers.
  const quellen = useMemo(
    () =>
      equipment
        .filter((e) => e.outputs.length > 0)
        .map((e) => ({ id: e.id, name: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [equipment],
  )

  const speichern = (name: string, inhalt: string, typ: string) => {
    const blob = new Blob([inhalt], { type: typ })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const bildSpeichern = () => {
    if (!quellName) return
    // ADR-004: das Bild traegt den Dokument-Stempel. Wozu — jemand
    // fotografiert einen Monitor, auf dem das Bild steht, und schickt das
    // Foto. Ohne Stempel ist das ein Beweis fuer „irgendwann"; mit Stempel
    // sagt es, aus welchem Planstand die Erwartung kam. Genau diese Frage
    // stellt sich zwei Wochen spaeter, wenn der Plan sich geaendert hat.
    const stempel = stampForRows(
      project,
      (p) => ({
        headers: ['Gerät', 'Anschluss', 'Weg', 'Hinweis'],
        rows: patternPruefzeilen(patternRouting(p, quelleId ?? undefined)).map((z) => [
          z.geraet,
          z.anschluss,
          z.weg,
          z.hinweis,
        ]),
      }),
      new Date(),
    )
    speichern(
      `testbild-${quellName.replace(/[^\w.-]+/g, '_')}.svg`,
      testPatternSvg({
        name: quellName,
        zeile2: format(t('canvas.pattern.line2', '{n} arrival points per plan'), { n: ziele }),
        zeile3: `${stempel.project}${stempel.revision ? ` · ${stempel.revision}` : ''} · ${stempel.fingerprint}${stempel.drifted ? ' *' : ''}`,
      }),
      'image/svg+xml',
    )
  }

  const blattSpeichern = () => {
    const zeilen = patternPruefzeilen(routing)
    const kopf = ['Gerät', 'Anschluss', 'Weg', 'Hinweis']
    const csv = [kopf, ...zeilen.map((z) => [z.geraet, z.anschluss, z.weg, z.hinweis])]
      .map((r) => r.map((f) => `"${f.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    speichern(`testbild-liste-${quellName.replace(/[^\w.-]+/g, '_')}.csv`, csv, 'text/csv')
  }

  // Das ABNAHME-Blatt: was jemand gesehen hat, nicht was der Plan vorsieht.
  // Die ungeprueften Orte stehen mit drin — ein Blatt, das nur die geprueften
  // zeigt, sieht nach abgeschlossener Abnahme aus, sobald jemand drei von
  // zwoelf Monitoren angesehen hat.
  const abnahmeSpeichern = () => {
    const kopf = ['Gerät', 'Anschluss', 'Befund', 'Gesehen', 'Zeitpunkt']
    const csv = [
      kopf,
      ...diagnoseZeilen(befunde).map((z) => [z.geraet, z.anschluss, z.befund, z.gesehen, z.zeitpunkt]),
    ]
      .map((r) => r.map((f) => `"${f.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    speichern(`abnahme-${quellName.replace(/[^\w.-]+/g, '_')}.csv`, csv, 'text/csv')
  }

  return (
    <span className="flex items-center gap-1">
      <label className="flex items-center gap-1.5 rounded-full border border-cp-border px-2 py-0.5 text-[11px] text-cp-text-secondary">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: quelleId ? '#fbbf24' : 'var(--cp-text-faint, #64748b)' }}
        />
        <span>{t('canvas.pattern.label', 'Test pattern')}</span>
        <select
          className="bg-transparent text-cp-text outline-none"
          value={quelleId ?? ''}
          onChange={(e) => waehle(e.target.value || null)}
          title={t(
            'canvas.pattern.pickTitle',
            'Pick a source: the plan then shows, at every arrival point, which image should be there. That is the expectation — this app cannot see what actually arrives.',
          )}
        >
          <option value="">{t('canvas.pattern.none', 'none')}</option>
          {quellen.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
        {quelleId && (
          <span className="tabular-nums text-cp-text-muted">{`· ${ziele}`}</span>
        )}
        {quelleId && offen > 0 && (
          <span className="tabular-nums text-cp-warn">
            {format(t('canvas.pattern.open', '· {n} open'), { n: offen })}
          </span>
        )}
        {/* Die Abnahme-Zahlen. „Vertauscht" steht vorn und getrennt, weil es
            als einziger Befund SAGT, was zu tun ist. */}
        {quelleId && summe.vertauscht > 0 && (
          <span className="tabular-nums text-cp-danger">
            {format(t('canvas.pattern.swapped', '· {n} swapped'), { n: summe.vertauscht })}
          </span>
        )}
        {quelleId && summe.ungeprueft > 0 && (
          <span className="tabular-nums text-cp-text-muted">
            {format(t('canvas.pattern.unchecked', '· {n} unchecked'), { n: summe.ungeprueft })}
          </span>
        )}
      </label>
      {quelleId && (
        <>
          <button
            type="button"
            onClick={bildSpeichern}
            title={t(
              'canvas.pattern.saveImageTitle',
              'Save the image as SVG — for a media player, the switcher stills store, or a laptop on an output. This app feeds nothing in.',
            )}
            className="av-focus rounded-full border border-cp-border px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-3"
          >
            {t('canvas.pattern.saveImage', 'Save image')}
          </button>
          <button
            type="button"
            onClick={blattSpeichern}
            title={t(
              'canvas.pattern.saveSheetTitle',
              'The walk-around list — including the paths the plan cannot follow to the end, and why.',
            )}
            className="av-focus rounded-full border border-cp-border px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-3"
          >
            {t('canvas.pattern.saveSheet', 'Check sheet')}
          </button>
          <button
            type="button"
            onClick={abnahmeSpeichern}
            title={t(
              'canvas.pattern.saveAcceptanceTitle',
              'What was actually seen, with timestamps — and the places nobody has looked at yet.',
            )}
            className="av-focus rounded-full border border-cp-border px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-3"
          >
            {t('canvas.pattern.saveAcceptance', 'Sign-off')}
          </button>
          {schaltbar && (
            <button
              type="button"
              onClick={() => setSchaltenOffen(true)}
              title={t(
                'canvas.pattern.switchTitle',
                'Set the crosspoints the plan foresees for one path — an intervention in the live installation. Only that path\u2019s outputs are switched; the plan itself stays unchanged.',
              )}
              className="av-focus rounded-full border border-cp-danger/60 px-2 py-0.5 text-[11px] text-cp-danger hover:bg-cp-surface-3"
            >
              {t('canvas.pattern.switch', 'Switch path…')}
            </button>
          )}
        </>
      )}
      {schaltenOffen && <HubSwitchDialog onClose={() => setSchaltenOffen(false)} />}
    </span>
  )
}
