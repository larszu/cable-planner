import { useRef, useState } from 'react'
import { AlertTriangle, Mic, Square } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { projectHistory } from '../../store/projectHistory'
import { useTranslation, format } from '../../lib/i18n'
import {
  alsGeraet,
  belegtDurch,
  brauchtWandler,
  findeVorlage,
  findeWandlerVorlage,
  fuehreSprachAuftraegeAus,
  loeseEnde,
  versteheSprache,
  waehlePort as portFuer,
  type SprachAuftrag,
  type SprachKabel,
} from '../../lib/sprachKabel'
import type { CablePlannerProject } from '../../types/project'

/**
 * #1056 — Kabel per Sprache: Satz → Vorschau → ein Undo-Schritt.
 *
 * MIKROFON NUR, WO ES GEHT. Die Web-Speech-API von Chromium schickt den Ton
 * an Googles Server; in Electron fehlt der Schluessel dafuer, die Erkennung
 * meldet `network` und tut nichts. Ein Knopf, der nie hoert, ist schlimmer
 * als keiner. In der Desktop-App steht deshalb das Textfeld im Fokus, und
 * das Diktat des Systems (macOS: zweimal Fn, Windows: Win+H) schreibt hinein
 * — offline und ohne neue Abhaengigkeit. Im Browser (dev:renderer, Viewer)
 * erscheint das Mikrofon, wenn die API da ist.
 */

type Erkennung = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

const erkennungsKlasse = (): (new () => Erkennung) | undefined => {
  if (typeof window === 'undefined' || /Electron/i.test(navigator.userAgent)) return undefined
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Erkennung) | undefined
}

const geraetName = (p: Readonly<CablePlannerProject>, id?: string) => p.equipment.find((e) => e.id === id)

export const SprachVerkabelungDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) =>
  open ? <Inhalt onClose={onClose} /> : null

const Inhalt = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslation()
  const sprache = useUiStore((s) => s.language)
  const project = useProjectStore((s) => s.project)
  const [text, setText] = useState('')
  const [kabel, setKabel] = useState<SprachKabel[] | null>(null)
  const [unverstanden, setUnverstanden] = useState<string[]>([])
  const [ersetzen, setErsetzen] = useState<Record<number, boolean>>({})
  // Abgewaehlte Vorschlaege: Bibliotheksvorlage je Ende, Wandler je Kabel.
  const [vorlageAus, setVorlageAus] = useState<Record<string, boolean>>({})
  const [wandlerAus, setWandlerAus] = useState<Record<number, boolean>>({})
  const bibliothek = useProjectStore((s) => s.customLibrary)
  const [hoert, setHoert] = useState(false)
  const [meldung, setMeldung] = useState('')
  const erkennung = useRef<Erkennung | null>(null)
  const Klasse = erkennungsKlasse()

  const verstehen = (satz: string) => {
    const r = versteheSprache(project, satz)
    setKabel(r.kabel)
    setUnverstanden(r.unverstanden)
    setErsetzen({})
    setVorlageAus({})
    setWandlerAus({})
    setMeldung('')
  }

  const hoeren = () => {
    if (!Klasse) return
    if (hoert) {
      erkennung.current?.stop()
      return
    }
    const e = new Klasse()
    e.lang = sprache === 'de' ? 'de-DE' : 'en-US'
    e.interimResults = false
    e.continuous = false
    e.onresult = (ev) => {
      const satz = Array.from(ev.results).map((r) => r[0]?.transcript ?? '').join(' ').trim()
      setText(satz)
      verstehen(satz)
    }
    e.onerror = (ev) =>
      setMeldung(format(t('voiceCabling.micError', 'Speech recognition stopped ({error}). Type or dictate the sentence instead.'), { error: ev.error }))
    e.onend = () => setHoert(false)
    erkennung.current = e
    setHoert(true)
    e.start()
  }

  const waehleGeraet = (i: number, seite: 'von' | 'nach', id: string) => {
    if (!kabel) return
    const k = kabel[i]
    const neu = loeseEnde(project, k[seite].wunsch, seite === 'von' ? 'from' : 'to', id || undefined)
    setKabel(kabel.map((x, j) => (j === i ? { ...x, [seite]: { ...neu, kandidaten: k[seite].kandidaten } } : x)))
  }

  const waehlePort = (i: number, seite: 'von' | 'nach', portId: string) => {
    if (!kabel) return
    setKabel(kabel.map((x, j) => (j === i ? { ...x, [seite]: { ...x[seite], portId: portId || undefined } } : x)))
  }

  /** Fehlt das Geraet im Plan, schlaegt die Bibliothek eines vor. */
  const vorlageFuer = (k: SprachKabel, i: number, seite: 'von' | 'nach') => {
    const e = k[seite]
    if (e.geraetId || e.kandidaten.length || vorlageAus[`${i}:${seite}`]) return undefined
    return findeVorlage(bibliothek, e.wunsch)
  }

  const portAm = (k: SprachKabel, i: number, seite: 'von' | 'nach') => {
    const v = vorlageFuer(k, i, seite)
    if (v) return portFuer(alsGeraet(v), k[seite].wunsch, seite === 'von' ? 'from' : 'to').port
    const g = geraetName(project, k[seite].geraetId)
    return g ? [...g.outputs, ...g.inputs].find((p) => p.id === k[seite].portId) : undefined
  }

  const wandlerNoetig = (k: SprachKabel, i: number) => {
    const q = portAm(k, i, 'von')
    const z = portAm(k, i, 'nach')
    return !!q && !!z && brauchtWandler(q.connectorType, z.connectorType)
  }

  const bereitIdx = (kabel ?? [])
    .map((k, i) => ({ k, i }))
    .filter(({ k, i }) => portAm(k, i, 'von') && portAm(k, i, 'nach') && (!belegtDurch(project, k) || ersetzen[i]))
  const bereit = bereitIdx

  const uebernehmen = () => {
    const auftraege: SprachAuftrag[] = bereitIdx.map(({ k, i }) => {
      const ende = (seite: 'von' | 'nach') => {
        const v = vorlageFuer(k, i, seite)
        return v ? { vorlage: v, wunsch: k[seite].wunsch } : { geraetId: k[seite].geraetId, portId: k[seite].portId, wunsch: k[seite].wunsch }
      }
      return { von: ende('von'), nach: ende('nach'), wandler: wandlerNoetig(k, i) && !wandlerAus[i], ersetzen: !!ersetzen[i] }
    })
    if (!auftraege.length) return
    // Ein Diktat, ein Undo-Schritt — auch mit neuen Geraeten und Wandlern.
    // Dieselbe Klammer wie der MCP-Weg in App.tsx.
    const r = projectHistory.transact(() =>
      fuehreSprachAuftraegeAus(
        auftraege,
        (w, a) => useProjectStore.getState().mcpSchreiben(w, a),
        () => useProjectStore.getState().project,
        bibliothek,
      ),
    )
    if (r.ok) onClose()
    else setMeldung(r.texte.join(' '))
  }

  const endeZeile = (k: SprachKabel, i: number, seite: 'von' | 'nach') => {
    const ende = k[seite]
    const vorlage = vorlageFuer(k, i, seite)
    const vorschlag = !ende.geraetId && !ende.kandidaten.length ? findeVorlage(bibliothek, ende.wunsch) : undefined
    const geraet = vorlage ? undefined : geraetName(project, ende.geraetId)
    const ports = geraet ? (seite === 'von' ? geraet.outputs : geraet.inputs) : []
    const kandidaten = ende.kandidaten.length ? ende.kandidaten : project.equipment
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <select
          aria-label={seite === 'von' ? t('voiceCabling.fromDevice', 'Source device') : t('voiceCabling.toDevice', 'Target device')}
          value={vorlage ? '__bibliothek__' : (ende.geraetId ?? '')}
          onChange={(e) => {
            const wert = e.target.value
            setVorlageAus({ ...vorlageAus, [`${i}:${seite}`]: wert !== '__bibliothek__' })
            if (wert !== '__bibliothek__') waehleGeraet(i, seite, wert)
          }}
          className={`rounded-cp-control border bg-cp-surface-2 px-2 py-1 text-cp-sm ${ende.geraetId || vorlage ? 'border-cp-border' : 'border-cp-warn'}`}
        >
          {vorschlag && (
            <option value="__bibliothek__">
              {format(t('voiceCabling.fromLibrary', 'Add from library: {name}'), { name: vorschlag.name })}
            </option>
          )}
          <option value="">
            {ende.kandidaten.length > 1
              ? format(t('voiceCabling.pick', 'Which one? ({count} match)'), { count: ende.kandidaten.length })
              : t('voiceCabling.notFound', 'No match - pick a device')}
          </option>
          {kandidaten.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        {vorlage && (
          <p className="text-cp-xs text-cp-text-muted">
            {format(t('voiceCabling.newDevice', 'Not in the plan yet - placed on Connect, port {port}.'), {
              port: portAm(k, i, seite)?.name ?? '?',
            })}
          </p>
        )}
        {geraet && (
          <select
            aria-label={t('voiceCabling.port', 'Port')}
            value={ende.portId ?? ''}
            onChange={(e) => waehlePort(i, seite, e.target.value)}
            className={`rounded-cp-control border bg-cp-surface-2 px-2 py-1 text-cp-sm ${ende.portId ? 'border-cp-border' : 'border-cp-warn'}`}
          >
            <option value="">{t('voiceCabling.pickPort', 'Pick a port')}</option>
            {ports.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.connectorType})</option>
            ))}
          </select>
        )}
      </div>
    )
  }

  return (
    <ModalShell
      open
      onClose={onClose}
      maxWidth="2xl"
      title={t('voiceCabling.title', 'Cable by voice')}
      titleIcon={<Icon icon={Mic} size="md" />}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-cp-control bg-cp-surface-3 px-3 py-2 text-cp-sm hover:bg-cp-surface-2">
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="button" disabled={!bereit.length} onClick={uebernehmen} className="cp-btn-primary px-4 py-2 text-cp-sm disabled:opacity-45">
            {format(t('voiceCabling.apply', 'Connect {count} cables'), { count: bereit.length })}
          </button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          verstehen(text)
        }}
      >
        <div className="flex gap-2">
          <textarea
            autoFocus
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                verstehen(text)
              }
            }}
            placeholder={t('voiceCabling.placeholder', 'e.g. "SDI 1 from the ATEM to the NEC in the foyer"')}
            aria-label={t('voiceCabling.sentence', 'Sentence')}
            className="min-w-0 flex-1 rounded-cp-control border border-cp-border bg-cp-surface-2 px-3 py-2 text-cp-sm"
          />
          {Klasse && (
            <button
              type="button"
              onClick={hoeren}
              aria-label={hoert ? t('voiceCabling.stop', 'Stop listening') : t('voiceCabling.listen', 'Speak')}
              title={hoert ? t('voiceCabling.stop', 'Stop listening') : t('voiceCabling.listen', 'Speak')}
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-cp-full ${hoert ? 'bg-cp-danger text-white' : 'bg-cp-accent text-cp-bg'}`}
            >
              <Icon icon={hoert ? Square : Mic} size="md" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-cp-xs text-cp-text-muted">
            {Klasse
              ? t('voiceCabling.hintMic', 'Speak or type. Several cables: separate them with a full stop.')
              : t('voiceCabling.hintDictation', 'Type, or use system dictation (macOS: press Fn twice, Windows: Win+H). Several cables: separate them with a full stop.')}
          </p>
          <button type="submit" className="shrink-0 rounded-cp-control bg-cp-surface-3 px-3 py-1 text-cp-sm hover:bg-cp-surface-2">
            {t('voiceCabling.understand', 'Preview')}
          </button>
        </div>
      </form>

      {meldung && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-cp-sm text-cp-danger">
          <Icon icon={AlertTriangle} size="sm" /> {meldung}
        </p>
      )}

      {kabel && (
        <ul className="mt-4 flex flex-col gap-3" aria-label={t('voiceCabling.preview', 'Preview')}>
          {kabel.length === 0 && unverstanden.length === 0 && (
            <li className="text-cp-sm text-cp-text-muted">{t('voiceCabling.empty', 'Nothing to connect.')}</li>
          )}
          {kabel.map((k, i) => {
            const alt = belegtDurch(project, k)
            const q = portAm(k, i, 'von')
            const z = portAm(k, i, 'nach')
            const wandler = wandlerNoetig(k, i)
            const wandlerVorlage = wandler && q && z ? findeWandlerVorlage(bibliothek, q.connectorType, z.connectorType) : null
            const anderesSignal = !wandler && (k.nach.signalFehlt || k.von.signalFehlt)
            return (
              <li key={i} className="rounded-cp-card bg-cp-surface-2 p-3">
                <p className="mb-2 text-cp-xs text-cp-text-muted">„{k.satz}"</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  {endeZeile(k, i, 'von')}
                  <span aria-hidden className="self-center text-cp-text-muted">→</span>
                  {endeZeile(k, i, 'nach')}
                </div>
                {anderesSignal && (
                  <p className="mt-2 flex items-center gap-2 text-cp-xs text-cp-warn">
                    <Icon icon={AlertTriangle} size="sm" />
                    {format(t('voiceCabling.converter', '{from} to {to}: this likely needs a converter.'), {
                      from: q?.connectorType ?? '?',
                      to: z?.connectorType ?? '?',
                    })}
                  </p>
                )}
                {wandler && (
                  <label className="mt-2 flex items-center gap-2 text-cp-xs text-cp-warn">
                    <input type="checkbox" checked={!wandlerAus[i]} onChange={(e) => setWandlerAus({ ...wandlerAus, [i]: !e.target.checked })} />
                    {format(t('voiceCabling.insertConverter', 'Insert converter {from} to {to}: {name}'), {
                      from: q?.connectorType ?? '?',
                      to: z?.connectorType ?? '?',
                      name: wandlerVorlage?.name ?? t('voiceCabling.genericConverter', 'generic converter'),
                    })}
                  </label>
                )}
                {alt && (
                  <label className="mt-2 flex items-center gap-2 text-cp-xs text-cp-warn">
                    <input type="checkbox" checked={!!ersetzen[i]} onChange={(e) => setErsetzen({ ...ersetzen, [i]: e.target.checked })} />
                    {format(t('voiceCabling.occupied', 'This input already has cable {cable}. Replace it?'), { cable: alt.cableNumber || alt.name || alt.id })}
                  </label>
                )}
              </li>
            )
          })}
          {unverstanden.map((s) => (
            <li key={s} className="text-cp-sm text-cp-warn">
              {format(t('voiceCabling.unclear', 'Not understood: "{sentence}". Say it as "<source> to <target>".'), { sentence: s })}
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  )
}
