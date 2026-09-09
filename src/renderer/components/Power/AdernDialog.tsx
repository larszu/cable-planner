import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { Icon } from '../shared/Icon'
import { confirmDialog } from '../../lib/confirmDialog'
import {
  LEITER_ROLLEN,
  type Anschluss,
  type Farbnorm,
  type LeiterRolle,
} from '../../types/conductor'

/**
 * Die Farbnormen und die Adernbündel eines Projekts (B-45).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM HIER KEINE NORM VORGEGEBEN IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Die deutsche Neuinstallation, die ältere Farbgebung mit anderen
 * Aussenleiter-Farben und die nordamerikanische Zuordnung sind drei
 * verschiedene Sätze. Welcher für eine Anlage gilt, steht nicht im Programm.
 *
 * Eine eingebaute Vorgabe wäre hier schlimmer als keine: sie sähe aus wie
 * eine geprüfte Angabe, sie färbte jede Ader, und die Prüfung bestätigte sie
 * anschliessend gegen sich selbst. An einer Stelle, an der jemand mit Strom
 * arbeitet, ist das die falsche Sorte Bequemlichkeit.
 *
 * Deshalb wird die Norm hier EINGETRAGEN, und `herkunft` ist Pflicht —
 * dieselbe Regel wie bei den Text-Protokoll-Vorlagen (Invariante 18).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * UND WARUM DAS BÜNDEL NICHT DER MULTICORE-NAME IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Am Kabel gibt es `multicoreName`, und der sieht ähnlich aus. Er beantwortet
 * aber eine andere Frage: „diese Kabel stecken in EINEM Mantel, zähle sie in
 * der Stückliste als ein Stück". Ein Bündel sagt: „diese getrennt gezogenen
 * Leitungen bilden EINEN Anschluss, und er muss diese Leiter haben."
 *
 * Nur das Zweite kann merken, dass die vierte von fünf Leitungen fehlt — und
 * genau dieser Fehler muss auffallen. Die beiden zusammenzulegen hiesse, die
 * Soll-Angabe an einen Namen zu hängen, der sie nie hatte.
 */
export const AdernDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.adernOpen)
  const setOpen = useUiStore((s) => s.setAdernOpen)
  const farbnormen = useProjectStore((s) => s.project.farbnormen) ?? []
  const anschluss = useProjectStore((s) => s.project.anschlussListe) ?? []
  const setFarbnormen = useProjectStore((s) => s.setFarbnormen)
  const setAnschluss = useProjectStore((s) => s.setAnschluss)
  const [tab, setTab] = useState<'normen' | 'anschluss'>('normen')

  if (!open) return null

  const neueNorm = () =>
    setFarbnormen([
      ...farbnormen,
      {
        // Die Laenge allein reichte nicht: wer eine loescht und eine neue
        // anlegt, bekaeme dieselbe Id — und die Anschluss zeigten auf die
        // neue, als haetten sie sie gewaehlt.
        id: `norm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: t('adern.norm.newName', 'New colour standard'),
        herkunft: '',
        farben: {},
      },
    ])

  const aendereNorm = (id: string, teil: Partial<Farbnorm>) =>
    setFarbnormen(farbnormen.map((n) => (n.id === id ? { ...n, ...teil } : n)))

  const neuerAnschluss = () =>
    setAnschluss([
      ...anschluss,
      {
        id: `anschluss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: t('adern.anschluss.newName', 'New connection'),
        soll: [],
      },
    ])

  const aendereAnschluss = (id: string, teil: Partial<Anschluss>) =>
    setAnschluss(anschluss.map((b) => (b.id === id ? { ...b, ...teil } : b)))

  const kippeSoll = (b: Anschluss, rolle: LeiterRolle) =>
    aendereAnschluss(b.id, {
      soll: b.soll.includes(rolle) ? b.soll.filter((r) => r !== rolle) : [...b.soll, rolle],
    })

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('adern.title', 'Conductors, colour standards and connections')}
      maxWidth="3xl"
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {(['normen', 'anschluss'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded px-3 py-1 text-cp-xs ${
              tab === k
                ? 'bg-cp-accent text-white'
                : 'bg-cp-surface-3 text-cp-text-secondary hover:bg-cp-surface-4'
            }`}
          >
            {k === 'normen'
              ? t('adern.tab.normen', 'Colour standards')
              : t('adern.tab.anschluss', 'Connections (bundles)')}
          </button>
        ))}
      </div>

      {tab === 'normen' ? (
        <>
          <PanelHint
            className="mb-3 text-cp-xs text-cp-text-muted"
            text={t(
              'adern.norm.hint',
              'No standard is built in, and that is deliberate: which colour assignment applies to this installation is not something the program knows. A guessed default would look like a checked entry and would colour every conductor. Enter the standard that applies here — and where it comes from.',
            )}
          />
          {farbnormen.length === 0 && (
            <div className="mb-3 rounded border border-cp-border-muted bg-cp-surface-2 p-3 text-cp-xs text-cp-text-muted">
              {t(
                'adern.norm.empty',
                'No colour standard entered yet. Without one the conductor colours stay unchecked — the plan check says so instead of quietly showing them as correct.',
              )}
            </div>
          )}
          <div className="space-y-3">
            {farbnormen.map((n) => (
              <div key={n.id} className="rounded border border-cp-border bg-cp-surface-2 p-3">
                <div className="flex items-start gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-base"
                    value={n.name}
                    onChange={(e) => aendereNorm(n.id, { name: e.target.value })}
                    aria-label={t('adern.norm.name', 'Name of the standard')}
                  />
                  <button
                    type="button"
                    className="rounded bg-red-700 px-2 py-1 text-cp-xs hover:bg-red-600"
                    onClick={async () => {
                      if (
                        await confirmDialog(t('adern.norm.confirmDelete', 'Delete colour standard?'), {
                          body: t(
                            'adern.norm.confirmDeleteBody',
                            'Bundles that chose it are then left without a standard — their conductor colours are no longer checked.',
                          ),
                          destructive: true,
                          okLabel: t('common.delete', 'Delete'),
                        })
                      ) {
                        setFarbnormen(farbnormen.filter((x) => x.id !== n.id))
                      }
                    }}
                    aria-label={t('common.delete', 'Delete')}
                  >
                    <Icon icon={Trash2} size="xs" />
                  </button>
                </div>
                <label className="mt-2 block text-cp-xs">
                  <span className="mb-1 block text-cp-text-muted">
                    {t('adern.norm.herkunft', 'Source (required)')}
                  </span>
                  <input
                    className={`w-full rounded border bg-cp-surface-1 px-2 py-1 text-cp-base ${
                      n.herkunft.trim() ? 'border-cp-border' : 'border-cp-danger'
                    }`}
                    value={n.herkunft}
                    placeholder={t(
                      'adern.norm.herkunftPlaceholder',
                      'Where does this assignment come from? Regulation, edition, page — or "house standard, set by …"',
                    )}
                    onChange={(e) => aendereNorm(n.id, { herkunft: e.target.value })}
                  />
                </label>
                {!n.herkunft.trim() && (
                  <PanelHint
                    className="mt-1 text-cp-xs text-cp-danger"
                    text={t(
                      'adern.norm.herkunftMissing',
                      'Without a source this standard is discarded on the next load — it would otherwise sit in the list without anyone being able to check whether it applies here.',
                    )}
                  />
                )}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {LEITER_ROLLEN.filter((r) => r !== 'frei').map((r) => (
                    <label key={r} className="block text-cp-xs">
                      <span className="mb-1 block text-cp-text-muted">{r}</span>
                      <input
                        className="w-full rounded border border-cp-border bg-cp-surface-1 px-2 py-1"
                        value={n.farben[r] ?? ''}
                        placeholder={t('adern.norm.colourPlaceholder', 'Colour')}
                        onChange={(e) =>
                          aendereNorm(n.id, {
                            farben: { ...n.farben, [r]: e.target.value || undefined },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={neueNorm}
            className="mt-3 flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
          >
            <Icon icon={Plus} size="xs" /> {t('adern.norm.add', 'Enter colour standard')}
          </button>
        </>
      ) : (
        <>
          <PanelHint
            className="mb-3 text-cp-xs text-cp-text-muted"
            text={t(
              'adern.anschluss.hint',
              'A connection pulled one conductor at a time: five lines make up one 400 A connection. Enter which conductors it must have — only then can the plan notice that the fourth is missing.',
            )}
          />
          <div className="space-y-3">
            {anschluss.map((b) => (
              <div key={b.id} className="rounded border border-cp-border bg-cp-surface-2 p-3">
                <div className="flex items-start gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-base"
                    value={b.name}
                    onChange={(e) => aendereAnschluss(b.id, { name: e.target.value })}
                    aria-label={t('adern.anschluss.name', 'Name of the connection')}
                  />
                  <button
                    type="button"
                    className="rounded bg-red-700 px-2 py-1 text-cp-xs hover:bg-red-600"
                    onClick={async () => {
                      if (
                        await confirmDialog(
                          t('adern.anschluss.confirmDelete', 'Delete connection?'),
                          {
                            body: t(
                              'adern.anschluss.confirmDeleteBody',
                              'The lines remain; afterwards they belong to no connection, and the check for missing conductors no longer applies to them.',
                            ),
                            destructive: true,
                            okLabel: t('common.delete', 'Delete'),
                          },
                        )
                      ) {
                        setAnschluss(anschluss.filter((x) => x.id !== b.id))
                      }
                    }}
                    aria-label={t('common.delete', 'Delete')}
                  >
                    <Icon icon={Trash2} size="xs" />
                  </button>
                </div>
                <div className="mt-2 text-cp-xs text-cp-text-muted">
                  {t('adern.anschluss.soll', 'These conductors the connection must have')}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {LEITER_ROLLEN.map((r) => (
                    <label key={r} className="flex items-center gap-1 text-cp-xs">
                      <input
                        type="checkbox"
                        checked={b.soll.includes(r)}
                        onChange={() => kippeSoll(b, r)}
                      />
                      <span className="text-cp-text-secondary">{r}</span>
                    </label>
                  ))}
                </div>
                <label className="mt-2 block text-cp-xs">
                  <span className="mb-1 block text-cp-text-muted">
                    {t('adern.anschluss.norm', 'Colour standard for this connection')}
                  </span>
                  <select
                    className="w-full rounded border border-cp-border bg-cp-surface-1 px-2 py-1"
                    value={b.farbnormId ?? ''}
                    onChange={(e) =>
                      aendereAnschluss(b.id, { farbnormId: e.target.value || undefined })
                    }
                  >
                    <option value="">{t('adern.anschluss.normNone', 'none chosen')}</option>
                    {farbnormen.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-2 block text-cp-xs">
                  <span className="mb-1 block text-cp-text-muted">
                    {t('adern.anschluss.notiz', 'Note (e.g. connector coding)')}
                  </span>
                  <input
                    className="w-full rounded border border-cp-border bg-cp-surface-1 px-2 py-1"
                    value={b.notiz ?? ''}
                    placeholder={t(
                      'adern.anschluss.notizPlaceholder',
                      'The coding is in the manufacturer document — enter it here, do not guess it.',
                    )}
                    onChange={(e) => aendereAnschluss(b.id, { notiz: e.target.value || undefined })}
                  />
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={neuerAnschluss}
            className="mt-3 flex items-center gap-1 rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
          >
            <Icon icon={Plus} size="xs" /> {t('adern.anschluss.add', 'Add connection')}
          </button>
        </>
      )}
    </ModalShell>
  )
}
