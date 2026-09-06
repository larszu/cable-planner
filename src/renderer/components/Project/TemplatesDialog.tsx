// Issue #343 — "Neu aus Vorlage" / Projekt-Vorlagen-Galerie.
//
// Macht Vorlagen dauerhaft über das Datei-Menü erreichbar (nicht nur beim
// Erststart). Non-destruktiv: "Verwenden" lädt eine frische Kopie über
// loadProject und fragt vorher ob das aktuelle Projekt verworfen werden darf.
// Eigene Projekte lassen sich als Vorlage speichern (localStorage).

import { useMemo, useState } from 'react'
import { LayoutTemplate, Save, Trash2 } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { projectHistory } from '../../store/projectHistory'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { Button } from '../shared/Button'
import { confirmDialog } from '../../lib/confirmDialog'
import { promptDialog } from '../../lib/promptDialog'
import { infoDialog } from '../../lib/infoDialog'
import { useTranslation, format } from '../../lib/i18n'
import {
  buildBuiltinTemplates,
  deleteUserTemplate,
  instantiateTemplate,
  loadUserTemplates,
  promoteAsBuiltToTemplate,
  saveUserTemplate,
  type ProjectTemplate,
} from '../../lib/projectTemplates'
import {
  projectVenue,
  templateCarryReport,
  venueBoundCount,
  type TemplateScope,
} from '../../lib/templateScope'
import { venueScopeDialog } from '../../lib/venueScopeDialog'
import { JOB_BASIS_LABEL, latestAsBuilt } from '../../lib/jobHandover'

export const TemplatesDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.templates.open)
  const close = useUiStore((s) => s.closeTemplates)
  const loadProject = useProjectStore((s) => s.loadProject)

  const builtins = useMemo(() => buildBuiltinTemplates(), [])
  const [userTemplates, setUserTemplates] = useState<ProjectTemplate[]>(() => loadUserTemplates())

  if (!open) return null

  const label = (tpl: ProjectTemplate) => (tpl.nameKey ? t(tpl.nameKey, tpl.name) : tpl.name)
  const desc = (tpl: ProjectTemplate) => (tpl.descKey ? t(tpl.descKey, tpl.description) : tpl.description)

  const stats = (tpl: ProjectTemplate) =>
    format(t('templates.stats', '{eq} Geräte · {cab} Kabel · {loc} Standorte'), {
      eq: tpl.project.equipment.length,
      cab: tpl.project.cables.length,
      loc: tpl.project.locations?.length ?? 0,
    })

  const applyTemplate = async (tpl: ProjectTemplate) => {
    const hasContent =
      useProjectStore.getState().project.equipment.length > 0 ||
      useProjectStore.getState().project.cables.length > 0 ||
      (useProjectStore.getState().project.locations?.length ?? 0) > 0
    if (hasContent) {
      const ok = await confirmDialog(
        t('templates.confirmReplace.title', 'Aktuelles Projekt verwerfen?'),
        {
          body: t(
            'templates.confirmReplace.body',
            'Die Vorlage ersetzt das aktuelle Projekt. Ungespeicherte Änderungen gehen verloren.',
          ),
          okLabel: t('templates.confirmReplace.ok', 'Vorlage laden'),
          destructive: true,
        },
      )
      if (!ok) return
    }
    // BEDARF 91 — was die Vorlage an Haus-Antworten mitbringt, und ob es hier
    // gilt. VOR dem Laden gesagt: danach steht es im Blatt und sieht aus wie
    // Auskunft.
    const bericht = templateCarryReport(
      tpl.venue,
      tpl.project.metadata?.venueAnswers?.length ?? 0,
      projectVenue(useProjectStore.getState().project),
    )
    if (bericht.state === 'elsewhere') {
      const weiter = await confirmDialog(t('templates.carryTitle', 'Antworten aus einem anderen Haus'), {
        body: bericht.text,
        okLabel: t('templates.carryOk', 'Trotzdem laden'),
      })
      if (!weiter) return
    }
    const name = await promptDialog(
      t('templates.namePrompt', 'Name des neuen Projekts'),
      label(tpl),
    )
    if (name === null) return
    loadProject(instantiateTemplate(tpl, name))
    projectHistory.reset()
    close()
    void infoDialog(t('templates.loadedTitle', 'Vorlage geladen'), {
      body: format(t('templates.loadedBody', 'Neues Projekt „{name}“ aus Vorlage erstellt.'), { name }),
      tone: 'success',
    })
  }

  // Bedarf 75 — nur fuer den Hinweistext am Knopf. Der Knopf bleibt aktiv:
  // wer ihn drueckt, bekommt den GRUND zu sehen, statt vor einem grauen Knopf
  // zu stehen.
  const hasAsBuilt = !!latestAsBuilt(useProjectStore.getState().project)

  const saveCurrent = async () => {
    const current = useProjectStore.getState().project
    const name = await promptDialog(
      t('templates.saveNamePrompt', 'Name der Vorlage'),
      current.metadata.name && current.metadata.name !== 'Untitled Project'
        ? current.metadata.name
        : '',
    )
    if (name === null) return
    // BEDARF 91 — gefragt wird NUR, wenn etwas Ortsgebundenes dranhaengt.
    // Ohne Haus-Antworten und ohne Adresse gibt es nichts zu entscheiden, und
    // eine Rueckfrage, die meistens „nichts dabei" bedeutet, wird zur
    // Klickgewohnheit.
    const gebunden = venueBoundCount(current)
    let scope: TemplateScope = 'neutral'
    if (gebunden > 0) {
      const antwort = await venueScopeDialog(gebunden, projectVenue(current) ?? '')
      if (antwort === null) return
      scope = antwort
    }
    saveUserTemplate(name, current.metadata.description ?? '', current, scope)
    setUserTemplates(loadUserTemplates())
    void infoDialog(t('templates.savedTitle', 'Als Vorlage gespeichert'), {
      body: format(t('templates.savedBody', 'Vorlage „{name}“ gespeichert.'), { name }),
      tone: 'success',
    })
  }

  // BEDARF 75 — den festgeschriebenen Bauzustand zur Vorlage machen.
  //
  // Ein eigener Weg neben „Aktuelles als Vorlage": der speichert den Plan, wie
  // er GERADE ist — nach dem Abbau also den Stand nach dem letzten Klick.
  // Was die naechste Show braucht, ist der Stand, den jemand ausdruecklich als
  // gebaut festgeschrieben hat.
  const promoteCurrent = async () => {
    const current = useProjectStore.getState().project
    const name = await promptDialog(
      t('templates.promoteNamePrompt', 'Name der Vorlage (aus dem As-Built)'),
      current.metadata.name && current.metadata.name !== 'Untitled Project' ? current.metadata.name : '',
    )
    if (name === null) return
    const gebunden = venueBoundCount(current)
    let scope: TemplateScope = 'neutral'
    if (gebunden > 0) {
      const antwort = await venueScopeDialog(gebunden, projectVenue(current) ?? '')
      if (antwort === null) return
      scope = antwort
    }
    const res = promoteAsBuiltToTemplate(name, current.metadata.description ?? '', current, scope)
    if (res.refused) {
      // Die Ablehnung ist der Punkt: auf den Live-Plan auszuweichen ergaebe
      // eine Vorlage mit dem Wort „wie gebaut" darauf, die den Angebotsstand
      // traegt (Bedarf 84).
      void infoDialog(t('templates.promoteNoneTitle', 'Kein As-Built festgeschrieben'), {
        body: t(
          'templates.promoteNoneBody',
          'Es ist nichts als „wie gebaut" festgeschrieben. Schreibe zuerst eine As-Built-Revision fest — sonst wäre die Vorlage der Plan von vor dem Aufbau, nur mit einem anderen Namen.',
        ),
        tone: 'warning',
      })
      return
    }
    setUserTemplates(loadUserTemplates())
    void infoDialog(t('templates.savedTitle', 'Als Vorlage gespeichert'), {
      body: format(
        t('templates.promotedBody', 'Vorlage „{name}“ aus dem As-Built „{from}“ erstellt.'),
        { name, from: res.from ?? '' },
      ),
      tone: 'success',
    })
  }

  const removeTemplate = async (tpl: ProjectTemplate) => {
    const ok = await confirmDialog(
      format(t('templates.confirmDelete', 'Vorlage „{name}“ löschen?'), { name: tpl.name }),
      { destructive: true, okLabel: t('common.delete', 'Löschen') },
    )
    if (!ok) return
    deleteUserTemplate(tpl.id)
    setUserTemplates(loadUserTemplates())
  }

  const card = (tpl: ProjectTemplate) => (
    <div
      key={tpl.id}
      className="flex flex-col gap-2 rounded border border-[var(--cp-border)] bg-[var(--cp-surface-2)] p-3"
    >
      <div className="flex items-start gap-2">
        <Icon icon={LayoutTemplate} size="md" className="mt-0.5 text-violet-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-cp-base font-semibold">{label(tpl)}</div>
          <div className="text-cp-xs text-[var(--cp-text-muted)]">{desc(tpl)}</div>
        </div>
      </div>
      <div className="text-[10px] text-[var(--cp-text-faint)]">{stats(tpl)}</div>
      {/* BEDARF 91 — aus welchem Haus. Steht auf der Karte, weil die
          Entscheidung „diese Vorlage oder die neutrale" hier faellt und nicht
          erst nach dem Laden. */}
      {tpl.venue && (
        <div className="text-[10px] text-[var(--cp-text-muted)]">
          {format(t('templates.venue', 'Haus-Vorlage: {venue} · {n} Antworten'), {
            venue: tpl.venue,
            n: tpl.project.metadata?.venueAnswers?.length ?? 0,
          })}
        </div>
      )}
      {/* BEDARF 84 — woraus die Vorlage gemacht wurde. Steht auf der Karte,
          weil es hier über ihren Wert entscheidet: eine aus dem Angebot
          gemachte Vorlage bringt nächstes Jahr genau die Fixes NICHT mit, um
          derentwillen jemand sie aufmacht. */}
      {tpl.basis && (
        <div
          className={`text-[10px] ${
            tpl.basis === 'as-built'
              ? 'text-[var(--cp-text-muted)]'
              : 'text-amber-300/90'
          }`}
        >
          {format(t('templates.basis', 'Grundlage: {basis}'), {
            basis: JOB_BASIS_LABEL[tpl.basis],
          })}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <Button variant="success" size="sm" onClick={() => void applyTemplate(tpl)}>
          {t('templates.use', 'Verwenden')}
        </Button>
        {!tpl.builtin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void removeTemplate(tpl)}
            aria-label={t('common.delete', 'Löschen')}
            title={t('common.delete', 'Löschen')}
            leftIcon={Trash2}
            className="!px-1.5 hover:text-red-400"
          />
        )}
      </div>
    </div>
  )

  return (
    <ModalShell
      open={open}
      onClose={close}
      maxWidth="3xl"
      titleIcon={<Icon icon={LayoutTemplate} size="md" />}
      title={t('templates.title', 'Neu aus Vorlage')}
    >
      <div className="space-y-4 p-1 text-cp-base">
        <div className="flex items-center justify-between gap-2">
          <p className="text-cp-xs text-[var(--cp-text-muted)]">
            {t(
              'templates.intro',
              'Mitgelieferte Show-Setups oder eigene gespeicherte Vorlagen als Startpunkt. Lädt eine Kopie — das bestehende Projekt wird erst nach Bestätigung ersetzt.',
            )}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void saveCurrent()}
            leftIcon={Save}
            className="shrink-0"
          >
            {t('templates.saveCurrent', 'Aktuelles Projekt als Vorlage')}
          </Button>
          {/* BEDARF 75 — der Bauzustand als Startpunkt der nächsten Show.
              Immer sichtbar, auch ohne As-Built: ein Knopf, der verschwindet,
              erklärt nicht, warum. Der Hinweis dahinter tut es. */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void promoteCurrent()}
            leftIcon={Save}
            className="shrink-0"
            title={
              hasAsBuilt
                ? t('templates.promoteHint', 'Nimmt den festgeschriebenen As-Built-Stand, nicht den aktuellen Plan')
                : t('templates.promoteNoneTitle', 'Kein As-Built festgeschrieben')
            }
          >
            {t('templates.promote', 'As-Built als Vorlage')}
          </Button>
        </div>

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cp-text-faint)]">
            {t('templates.builtinHeading', 'Mitgelieferte Vorlagen')}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {builtins.map(card)}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cp-text-faint)]">
            {t('templates.userHeading', 'Eigene Vorlagen')}
          </div>
          {userTemplates.length === 0 ? (
            <p className="text-cp-xs text-[var(--cp-text-faint)]">
              {t('templates.userEmpty', 'Noch keine eigenen Vorlagen. Speichere ein Projekt über „Aktuelles Projekt als Vorlage“.')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {userTemplates.map(card)}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
