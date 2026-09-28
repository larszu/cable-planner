// ───────────────────────────────────────────────────────────────────────────
// „Ports aus Foto" im Anlegen-Dialog (2026-09-28). Die Erkennung selbst und
// warum sie nur VORSCHLAEGT steht in `lib/fotoPortErkennung.ts`.
//
// Drei Wege zum Bild, weil die Fotos an drei Orten liegen: als Datei (auch
// Drag&Drop), in der Zwischenablage (Bildschirmfoto, aus dem Messenger
// kopiert) und — am Telefon — in der Kamera. Jedes Bild wird vor dem Senden
// auf 1600 px lange Kante verkleinert (`nimmFoto`, dieselbe Rechnung wie die
// Fotos am Geraet): ein Telefonfoto hat 3–5 MB, die Beschriftung einer
// Rueckseite ist bei 1600 px lesbar.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { Spinner } from '../shared/Spinner'
import { format, useTranslation } from '../../lib/i18n'
import { useUiStore } from '../../store/uiStore'
import { nimmFoto } from '../../lib/fotoAufnahme'
import {
  getAiProviderConfig,
  getApiKey,
  getSelectedAiProvider,
} from '../../lib/aiSuggestions'
import { erkennePortsAusFotos, type ErkannterPort, type FotoErkennung } from '../../lib/fotoPortErkennung'
import { katalogTypKandidaten } from '../../lib/deviceTypeMatch'
import { resolveDeviceType } from '../../lib/deviceTypeRegistry'
import type { ConnectorType, EquipmentTemplate } from '../../types/equipment'
import type { Foto } from '../../types/foto'
import { erkennungZuGruppen, type PortGroupDraft } from './libraryPanelHelpers'
import { v4 as uuidv4 } from 'uuid'

interface Zeile extends ErkannterPort {
  id: string
  an: boolean
}

export const FotoPortErkennung = ({
  name,
  vokabular,
  onUebernehmen,
  onKatalogPlatzieren,
  onFotosBehalten,
}: {
  name: string
  vokabular: readonly ConnectorType[]
  onUebernehmen: (r: { groups: PortGroupDraft[]; name?: string; herkunft: string }) => void
  onKatalogPlatzieren: (template: EquipmentTemplate) => void
  /** Die Fotos, die mit dem Geraet gespeichert werden sollen — oder []. */
  onFotosBehalten: (fotos: Foto[]) => void
}) => {
  const t = useTranslation()
  const provider = getSelectedAiProvider()
  const providerLabel = getAiProviderConfig(provider).label
  const hatSchluessel = !!getApiKey(provider)
  const [fotos, setFotos] = useState<Foto[]>([])
  const [behalten, setBehalten] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [ergebnis, setErgebnis] = useState<FotoErkennung | null>(null)
  const [zeilen, setZeilen] = useState<Zeile[]>([])
  const [ziehen, setZiehen] = useState(false)
  const dateiFeld = useRef<HTMLInputElement>(null)
  const kameraFeld = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onFotosBehalten(behalten ? fotos : [])
  }, [behalten, fotos, onFotosBehalten])

  const hinzu = async (dateien: File[]) => {
    const bilder = dateien.filter((d) => d.type.startsWith('image/'))
    if (bilder.length === 0) return
    const neu: Foto[] = []
    for (const d of bilder) {
      const a = await nimmFoto(d, new Date().toISOString(), 'planer')
      if (a) neu.push(a.foto)
    }
    if (neu.length > 0) setFotos((alt) => [...alt, ...neu].slice(0, 4))
  }

  // Einfuegen aus der Zwischenablage, solange der Dialog offen ist. Nur wenn
  // wirklich ein Bild darin liegt — Text-Einfuegen in die Felder bleibt, wie
  // es ist.
  useEffect(() => {
    if (!hatSchluessel) return
    const onPaste = (e: ClipboardEvent) => {
      const dateien = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (dateien.length === 0) return
      e.preventDefault()
      void hinzu(dateien)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [hatSchluessel])

  const katalog = useMemo(() => {
    if (!ergebnis?.model) return null
    const ids = katalogTypKandidaten({ manufacturer: ergebnis.manufacturer, model: ergebnis.model })
    return ids.length === 1 ? resolveDeviceType(ids[0])?.template ?? null : null
  }, [ergebnis])

  const erkennen = async () => {
    setFehler('')
    setLaeuft(true)
    try {
      const r = await erkennePortsAusFotos(
        fotos.map((f) => f.dataUri),
        { vokabular, name: name.trim() || undefined },
      )
      setErgebnis(r)
      setZeilen(r.ports.map((p) => ({ ...p, id: uuidv4(), an: !p.unsicher })))
      if (r.ports.length === 0 && !r.model) {
        setFehler(t('library.photo.nothing', 'Nothing recognised. Try a sharper photo, straight on, with the labels readable.'))
      }
    } catch (err) {
      setFehler(err instanceof Error ? err.message : String(err))
    } finally {
      setLaeuft(false)
    }
  }

  const uebernehmen = () => {
    const modellName = ergebnis?.model
      ? [ergebnis.manufacturer, ergebnis.model].filter(Boolean).join(' ')
      : undefined
    onUebernehmen({
      groups: erkennungZuGruppen(zeilen),
      ...(modellName && !name.trim() ? { name: modellName } : {}),
      herkunft: format(
        t('library.origin.photo', 'Read from a photo by {provider} and checked by the user — not from a datasheet'),
        { provider: providerLabel },
      ),
    })
  }

  const setzeZeile = (id: string, patch: Partial<Zeile>) =>
    setZeilen((alt) => alt.map((z) => (z.id === id ? { ...z, ...patch } : z)))

  if (!hatSchluessel) {
    return (
      <div className="mb-2 border border-cp-border-muted bg-cp-surface-2 p-2 text-cp-xs text-cp-text-muted">
        {t('library.photo.noKey', 'Recognise ports from a photo: add an AI provider under Settings → Integrations → AI.')}{' '}
        <button
          type="button"
          onClick={() => useUiStore.getState().openSettings('integrations')}
          className="text-cp-accent hover:underline"
        >
          {t('library.photo.openSettings', 'Open settings')}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`mb-2 border p-2 text-cp-xs ${ziehen ? 'border-cp-accent bg-cp-surface-3' : 'border-cp-border bg-cp-surface-2'}`}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault()
          setZiehen(true)
        }
      }}
      onDragLeave={() => setZiehen(false)}
      onDrop={(e) => {
        e.preventDefault()
        setZiehen(false)
        void hinzu([...e.dataTransfer.files])
      }}
    >
      <div className="mb-1 font-semibold text-cp-text">
        {t('library.photo.heading', 'Recognise ports from a photo')}
      </div>
      <p className="mb-2 text-cp-text-muted">
        {format(
          t('library.photo.privacy', 'Drop, paste or pick photos of the connector side. They are sent to {provider} for recognition.'),
          { provider: providerLabel },
        )}
      </p>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          ref={dateiFeld}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const d = [...(e.target.files ?? [])]
            e.target.value = ''
            void hinzu(d)
          }}
        />
        {/* `capture` oeffnet am Telefon direkt die Kamera; am Rechner wird es
            ignoriert und ist ein zweiter Dateiknopf — deshalb nur dort, wo
            ein Finger bedient. */}
        <input
          ref={kameraFeld}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const d = [...(e.target.files ?? [])]
            e.target.value = ''
            void hinzu(d)
          }}
        />
        <button
          type="button"
          onClick={() => dateiFeld.current?.click()}
          className="inline-flex items-center gap-1 border border-cp-border bg-cp-surface-3 px-2 py-1 hover:bg-cp-surface-4"
        >
          <Icon icon={ImagePlus} size="xs" />
          {t('library.photo.pick', 'Choose photos')}
        </button>
        <button
          type="button"
          onClick={() => kameraFeld.current?.click()}
          className="inline-flex items-center gap-1 border border-cp-border bg-cp-surface-3 px-2 py-1 hover:bg-cp-surface-4 [@media(pointer:fine)]:hidden"
        >
          <Icon icon={Camera} size="xs" />
          {t('library.photo.camera', 'Take photo')}
        </button>
        {fotos.length > 0 && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void erkennen()}
            className="inline-flex items-center gap-1 bg-cp-accent px-2 py-1 text-cp-accent-text disabled:opacity-50"
          >
            {laeuft ? <Spinner size="xs" /> : null}
            {laeuft ? t('library.photo.busy', 'Recognising…') : t('library.photo.run', 'Recognise')}
          </button>
        )}
      </div>

      {fotos.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="relative">
              <img src={f.dataUri} alt="" className="h-16 w-auto border border-cp-border object-contain" />
              <button
                type="button"
                aria-label={t('library.photo.remove', 'Remove photo')}
                onClick={() => setFotos((alt) => alt.filter((x) => x.id !== f.id))}
                className="absolute right-0 top-0 bg-cp-surface-1 p-0.5 hover:bg-cp-surface-4"
              >
                <Icon icon={X} size="xs" />
              </button>
            </div>
          ))}
          <label className="flex items-center gap-1 text-cp-text-secondary">
            <input type="checkbox" checked={behalten} onChange={(e) => setBehalten(e.target.checked)} />
            {t('library.photo.keep', 'Keep the photos on the device when placing it')}
          </label>
        </div>
      )}

      {fehler && <div className="mb-2 text-cp-danger">{fehler}</div>}

      {ergebnis && (
        <div className="space-y-2">
          {ergebnis.model && (
            <div className="text-cp-text-secondary">
              {format(t('library.photo.model', 'Device: {name}'), {
                name: [ergebnis.manufacturer, ergebnis.model].filter(Boolean).join(' '),
              })}
              {ergebnis.modelUnsicher && (
                <span className="ml-1 text-cp-warn">{t('library.photo.unsure', 'unsure')}</span>
              )}
            </div>
          )}
          {katalog && (
            <div className="flex flex-wrap items-center justify-between gap-2 border border-cp-border-muted bg-cp-surface-1 p-2">
              <span>
                {format(
                  t('library.photo.catalogue', 'In the catalogue with datasheet ports: {name}'),
                  { name: katalog.name },
                )}
              </span>
              <button
                type="button"
                onClick={() => onKatalogPlatzieren(katalog)}
                className="border border-cp-border bg-cp-surface-3 px-2 py-1 hover:bg-cp-surface-4"
              >
                {t('library.photo.useCatalogue', 'Place catalogue device')}
              </button>
            </div>
          )}
          {zeilen.length > 0 && (
            <>
              <div className="text-cp-text-muted">
                {t('library.photo.review', 'Check the suggestions. Unsure rows are unticked.')}
              </div>
              <div className="space-y-1">
                {zeilen.map((z) => (
                  <div
                    key={z.id}
                    className="grid grid-cols-[20px_90px_56px_1fr_1fr] items-center gap-1 border border-cp-border-muted bg-cp-surface-1 p-1"
                  >
                    <input
                      type="checkbox"
                      aria-label={t('library.photo.include', 'Include')}
                      checked={z.an}
                      onChange={(e) => setzeZeile(z.id, { an: e.target.checked })}
                    />
                    <select
                      aria-label={t('library.photo.direction', 'Direction')}
                      value={z.direction}
                      onChange={(e) => setzeZeile(z.id, { direction: e.target.value as Zeile['direction'] })}
                      className="border border-cp-border bg-cp-surface-1 p-0.5"
                    >
                      <option value="in">{t('library.create.directionInput', 'Input')}</option>
                      <option value="out">{t('library.create.directionOutput', 'Output')}</option>
                      <option value="bidirectional">{t('library.photo.bidirectional', 'Both ways')}</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      aria-label={t('library.photo.count', 'Count')}
                      value={z.count}
                      onChange={(e) => setzeZeile(z.id, { count: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      className="border border-cp-border bg-cp-surface-1 p-0.5"
                    />
                    <select
                      aria-label={t('library.photo.connector', 'Connector')}
                      value={z.connectorType}
                      onChange={(e) => setzeZeile(z.id, { connectorType: e.target.value as ConnectorType, unsicher: false })}
                      className="border border-cp-border bg-cp-surface-1 p-0.5"
                    >
                      {vokabular.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        aria-label={t('library.photo.label', 'Label')}
                        value={z.label}
                        onChange={(e) => setzeZeile(z.id, { label: e.target.value })}
                        className="min-w-0 flex-1 border border-cp-border bg-cp-surface-1 p-0.5"
                      />
                      {z.unsicher && (
                        <span
                          className="shrink-0 text-cp-warn"
                          title={z.connectorRoh ? format(t('library.photo.rawConnector', 'Read as: {raw}'), { raw: z.connectorRoh }) : undefined}
                        >
                          {t('library.photo.unsure', 'unsure')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {(zeilen.length > 0 || ergebnis.model) && (
            <button
              type="button"
              onClick={uebernehmen}
              className="border border-cp-border bg-cp-surface-3 px-2 py-1 hover:bg-cp-surface-4"
            >
              {format(t('library.photo.apply', 'Apply {n} port group(s) to the form'), {
                n: zeilen.filter((z) => z.an).length,
              })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
