import { useRef, useState } from 'react'
import { Check, ClipboardList, X } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { FotoListe } from '../Properties/sections/FotoSection'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { format, useTranslation } from '../../lib/i18n'
import { hasDesktopBridge } from '../../lib/bridge'
import { nextPlacementPosition } from '../../lib/library'
import { eintragAusMeldung, erfasstesGeraet, offeneErfassungen } from '../../lib/erfassung'

/**
 * #906 — Bestandsaufnahme: vorhandene Technik im Raum erfassen.
 *
 * Gebaut fuer das Arbeiten VOR ORT: ein Feld fuer den Namen, Enter, das
 * naechste. Der Raum bleibt stehen, weil man ihn erst verlaesst, wenn alles
 * darin erfasst ist. Jedes Geraet steht sofort im Plan — unfertig und so
 * markiert (keine Buchsen, `portsUnknown`), nicht als Entwurf in einer
 * Nebenliste, die spaeter abgetippt werden muesste.
 *
 * Unten die Arbeitsliste: was erfasst und noch nicht ausgearbeitet ist, mit
 * Fotos je Geraet, und was vom Telefon gemeldet wurde und noch angenommen
 * werden muss.
 */
export const SurveyDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.surveyOpen)
  const setOpen = useUiStore((s) => s.setSurveyOpen)
  const equipment = useProjectStore((s) => s.project.equipment)
  const pending = useProjectStore((s) => s.project.pendingChanges) ?? []
  const addEquipment = useProjectStore((s) => s.addEquipment)
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const applyPendingChange = useProjectStore((s) => s.applyPendingChange)
  const rejectPendingChange = useProjectStore((s) => s.rejectPendingChange)

  const [name, setName] = useState('')
  const [raum, setRaum] = useState('')
  const [verbindung, setVerbindung] = useState('')
  const [notiz, setNotiz] = useState('')
  const [zuletzt, setZuletzt] = useState<string | null>(null)
  const nameFeld = useRef<HTMLInputElement>(null)

  const offen = offeneErfassungen(equipment)
  const vomTelefon = pending.filter((p) => p.kind === 'new-device')

  const erfassen = () => {
    const geraet = erfasstesGeraet(
      { name, raum, verbindung, notiz },
      nextPlacementPosition(equipment.length, equipment),
      {
        am: new Date().toISOString(),
        quelle: 'planer',
        label: { raum: t('survey.room', 'Room'), verbindung: t('survey.connection', 'Connected to (assumed)') },
      },
    )
    if (!geraet) return
    addEquipment(geraet)
    setZuletzt(geraet.name)
    setName('')
    setVerbindung('')
    setNotiz('')
    nameFeld.current?.focus()
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      erfassen()
    }
  }

  const feld = 'w-full border border-cp-border bg-cp-surface-3 px-2 py-1.5 text-cp-sm'

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('survey.title', 'Survey: capture what is there')}
      titleIcon={<Icon icon={ClipboardList} size="md" />}
      maxWidth="3xl"
      draggableKey="cable-planner:modal-pos:survey"
    >
      <div className="space-y-4 text-cp-sm">
        <PanelHint
          className="text-cp-xs text-cp-text-muted"
          text={t(
            'survey.intro',
            'Walk through the room and write down what you see. Each entry becomes a device in the plan right away — without connectors, marked as unfinished, with room, assumed connection and note in its notes. Add the ports, cables and photos later, or tick it off here.',
          )}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('survey.name', 'Device *')}</span>
            <input
              ref={nameFeld}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onEnter}
              placeholder={t('survey.namePlaceholder', 'e.g. Projector ceiling front')}
              className={feld}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('survey.room', 'Room')}</span>
            <input
              value={raum}
              onChange={(e) => setRaum(e.target.value)}
              onKeyDown={onEnter}
              placeholder={t('survey.roomPlaceholder', 'stays for the next entry')}
              className={feld}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-secondary">
              {t('survey.connection', 'Connected to (assumed)')}
            </span>
            <input
              value={verbindung}
              onChange={(e) => setVerbindung(e.target.value)}
              onKeyDown={onEnter}
              placeholder={t('survey.connectionPlaceholder', 'e.g. lectern, HDMI at the back?')}
              className={feld}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('survey.note', 'Note')}</span>
            <input
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              onKeyDown={onEnter}
              placeholder={t('survey.notePlaceholder', 'what it is for, what is odd')}
              className={feld}
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={erfassen}
            disabled={!name.trim()}
            className="bg-cp-accent px-3 py-1.5 text-cp-sm text-white hover:opacity-90 disabled:opacity-40"
          >
            {t('survey.capture', 'Capture (Enter)')}
          </button>
          {zuletzt && (
            <span className="text-cp-xs text-cp-text-muted">
              {format(t('survey.captured', '"{name}" is in the plan.'), { name: zuletzt })}
            </span>
          )}
        </div>

        <PanelHint
          className="text-cp-xs text-cp-text-muted"
          text={hasDesktopBridge
            ? t(
                'survey.phoneHint',
                'From the phone: Phone access → set "Contribute" → on the phone "Report" → "New device". It arrives below and becomes a device when you accept it.',
              )
            : t(
                'survey.phoneHintWeb',
                'Capturing from the phone needs the desktop app: it serves the plan to the phone over the local network. In the browser version this path does not exist.',
              )}
        />

        {vomTelefon.length > 0 && (
          <section className="space-y-1">
            <h3 className="font-semibold text-cp-text">
              {format(t('survey.fromPhone', 'From the phone ({n})'), { n: vomTelefon.length })}
            </h3>
            <ul className="space-y-1 text-cp-xs">
              {vomTelefon.map((p) => {
                const e = eintragAusMeldung(p)
                return (
                  <li key={p.id} className="flex items-start gap-2 border border-cp-border-muted px-2 py-1">
                    <span className="min-w-0 flex-1">
                      <span className="block text-cp-text">{e?.name ?? p.summary}</span>
                      <span className="block whitespace-pre-line text-cp-text-muted">
                        {[e?.raum, e?.verbindung, e?.notiz].filter(Boolean).join(' · ')}
                      </span>
                      <span className="text-cp-text-faint">{p.author}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => applyPendingChange(p.id)}
                      title={t('survey.accept', 'Accept: add as unfinished device')}
                      aria-label={t('survey.accept', 'Accept: add as unfinished device')}
                      className="shrink-0 p-1 text-cp-accent hover:bg-cp-surface-2"
                    >
                      <Icon icon={Check} size="xs" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectPendingChange(p.id)}
                      title={t('survey.reject', 'Discard')}
                      aria-label={t('survey.reject', 'Discard')}
                      className="shrink-0 p-1 text-cp-danger hover:bg-cp-surface-2"
                    >
                      <Icon icon={X} size="xs" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="space-y-1">
          <h3 className="font-semibold text-cp-text">
            {format(t('survey.open', 'Captured, not worked out yet ({n})'), { n: offen.length })}
          </h3>
          {offen.length === 0 ? (
            <p className="text-cp-xs text-cp-text-muted">{t('survey.none', 'Nothing open.')}</p>
          ) : (
            <ul className="space-y-1 text-cp-xs">
              {offen.map((g) => (
                <li key={g.id} className="border border-cp-border-muted px-2 py-1">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-cp-text">{g.name}</span>
                      {g.notes && <span className="block whitespace-pre-line text-cp-text-muted">{g.notes}</span>}
                      {g.erfasst?.quelle === 'handy' && (
                        <span className="text-cp-text-faint">{t('survey.viaPhone', 'captured on the phone')}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateEquipment(g.id, { erfasst: undefined })}
                      title={t('survey.doneTitle', 'Worked out — remove from this list (the device stays)')}
                      className="shrink-0 border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text"
                    >
                      {t('survey.done', 'Done')}
                    </button>
                  </div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-cp-text-muted">{t('survey.photos', 'Photos')}</summary>
                    <div className="mt-1">
                      <FotoListe ziel={{ equipmentId: g.id }} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ModalShell>
  )
}
