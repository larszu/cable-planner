import { useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../../store/projectStore'
import { useGrundrissUi } from '../../store/grundrissUiStore'
import { getViewportCenter } from '../../lib/canvasViewport'
import { downloadBlob } from '../../lib/downloadBlob'
import { csvFromTable } from '../../lib/documentStamp'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { EINGEBAUTE_SYMBOLE, SYMBOL_KATEGORIEN } from '../../lib/symbole/eingebaut'
import { svgBereinigen, svgDataUrl } from '../../lib/symbole/svg'
import { kiSymbolErzeugen } from '../../lib/symbole/kiSymbol'
import { symbolTabelle } from '../../lib/symbole/symbolListe'
import { getApiKey, getAiProviderConfig, getSelectedAiProvider } from '../../lib/aiSuggestions'
import { format, useTranslation } from '../../lib/i18n'
import type { SymbolDef, SymbolKategorie } from '../../types/symbol'

/** Groesste Rasterdatei fuer ein eigenes Symbol. Ein Zeichen, kein Foto. */
const BILD_MAX_BYTES = 512 * 1024

export const SymbolPanel = () => {
  const t = useTranslation()
  const offen = useGrundrissUi((s) => s.symbolPanel)
  const setOffen = useGrundrissUi((s) => s.setSymbolPanel)
  const ausgewaehlt = useGrundrissUi((s) => s.ausgewaehltesSymbol)
  const waehle = useGrundrissUi((s) => s.waehleSymbol)
  const symbole = useProjectStore((s) => s.project.symbole)
  const eigene = useProjectStore((s) => s.project.symbolDefs)
  const projektName = useProjectStore((s) => s.project.metadata.name)
  const addSymbol = useProjectStore((s) => s.addSymbol)
  const updateSymbol = useProjectStore((s) => s.updateSymbol)
  const removeSymbol = useProjectStore((s) => s.removeSymbol)
  const addSymbolDef = useProjectStore((s) => s.addSymbolDef)
  const removeSymbolDef = useProjectStore((s) => s.removeSymbolDef)
  const [kategorie, setKategorie] = useState<SymbolKategorie>('elektro')
  const [suche, setSuche] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

  const alle = useMemo(() => [...EINGEBAUTE_SYMBOLE, ...(eigene ?? [])], [eigene])
  const defs = useMemo(() => new Map(alle.map((d) => [d.id, d])), [alle])
  const name = (d: SymbolDef) => (d.herkunft === 'eingebaut' ? t(`symbols.builtin.${d.id.slice(8)}`, d.name) : d.name)
  const katName = (k: SymbolKategorie) =>
    ({
      elektro: t('symbols.cat.electrical', 'Electrical'),
      ema: t('symbols.cat.intrusion', 'Intrusion alarm'),
      bma: t('symbols.cat.fire', 'Fire alarm'),
      saa: t('symbols.cat.voice', 'Voice alarm / PA'),
      it: t('symbols.cat.it', 'IT / network'),
      automation: t('symbols.cat.automation', 'Automation'),
      av: t('symbols.cat.av', 'AV'),
      eigen: t('symbols.cat.custom', 'Custom'),
    })[k]

  if (!offen) return null

  const provider = getSelectedAiProvider()
  const kiMoeglich = getApiKey(provider).length > 0
  const sichtbar = alle.filter((d) =>
    suche.trim() ? name(d).toLowerCase().includes(suche.trim().toLowerCase()) : d.kategorie === kategorie,
  )
  const sel = (symbole ?? []).find((s) => s.id === ausgewaehlt)

  const platzieren = (d: SymbolDef) => {
    const m = getViewportCenter() ?? { x: 0, y: 0 }
    const id = uuidv4()
    addSymbol({ id, defId: d.id, x: Math.round(m.x - 24), y: Math.round(m.y - 24), groesse: 48 })
    waehle(id)
  }

  const importieren = async (datei: File | undefined) => {
    if (!datei) return
    const basis = datei.name.replace(/\.[^.]+$/, '')
    if (/svg/i.test(datei.type) || /\.svg$/i.test(datei.name)) {
      const svg = svgBereinigen(await datei.text())
      if (!svg) {
        setMeldung(t('symbols.import.badSvg', 'The file contains no usable SVG (or is larger than 200 KB).'))
        return
      }
      addSymbolDef({ id: `custom:${uuidv4()}`, name: basis, kategorie: 'eigen', svg, herkunft: 'import' })
    } else {
      if (datei.size > BILD_MAX_BYTES) {
        setMeldung(t('symbols.import.tooLarge', 'Raster images for symbols are limited to 512 KB.'))
        return
      }
      const bild = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(datei)
      })
      addSymbolDef({ id: `custom:${uuidv4()}`, name: basis, kategorie: 'eigen', bild, herkunft: 'import' })
    }
    setKategorie('eigen')
    setSuche('')
    setMeldung(format(t('symbols.import.done', '“{name}” added to Custom.'), { name: basis }))
  }

  const erzeugen = async () => {
    const text = beschreibung.trim()
    if (!text) return
    setLaeuft(true)
    setMeldung(null)
    try {
      const r = await kiSymbolErzeugen(text)
      if (!r) {
        setMeldung(t('symbols.ai.noSvg', 'The answer contained no usable SVG. Try a more concrete description.'))
        return
      }
      addSymbolDef({ id: `custom:${uuidv4()}`, name: r.name, kategorie: 'eigen', svg: r.svg, herkunft: 'ki', beschreibung: text })
      setKategorie('eigen')
      setSuche('')
      setBeschreibung('')
      setMeldung(format(t('symbols.ai.done', '“{name}” generated and added to Custom. Check it before use: it is a drawing by a model, not a standard symbol.'), { name: r.name }))
    } catch (e) {
      setMeldung(e instanceof Error ? e.message : String(e))
    } finally {
      setLaeuft(false)
    }
  }

  const listeExport = () => {
    const tabelle = symbolTabelle(symbole ?? [], defs, name, {
      symbol: t('symbols.list.symbol', 'Symbol'),
      kategorie: t('symbols.list.category', 'Category'),
      anzahl: t('symbols.list.count', 'Count'),
      beschriftungen: t('symbols.list.labels', 'Labels'),
      unbekannt: t('symbols.list.unknown', 'Unknown symbol'),
    })
    downloadBlob(buildExportFilenameWithSuffix(projektName, 'symbole', 'csv'), csvFromTable(tabelle), 'text/csv')
  }

  return (
    <div className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-[95vw] flex-col border-l border-cp-border bg-cp-surface-1 text-cp-text sm:w-96 text-sm">
      <div className="flex items-center justify-between border-b border-cp-border px-3 py-2">
        <strong>{t('symbols.title', 'Symbols')}</strong>
        <button className="px-2 hover:bg-cp-surface-3" onClick={() => setOffen(false)} aria-label={t('common.close', 'Close')}>
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sel && (
          <section className="space-y-2 border border-cp-border p-2">
            <strong>{name(defs.get(sel.defId) ?? { id: '', name: '?', kategorie: 'eigen', herkunft: 'import' })}</strong>
            <label className="flex items-center gap-2">
              <span className="w-24">{t('symbols.sel.label', 'Label')}</span>
              <input
                value={sel.beschriftung ?? ''}
                onChange={(e) => updateSymbol(sel.id, { beschriftung: e.target.value })}
                className="flex-1 px-1 py-0.5 bg-cp-surface-2 border border-cp-border"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24">{t('symbols.sel.size', 'Size')}</span>
              <input
                type="number"
                min={16}
                max={400}
                value={sel.groesse}
                onChange={(e) => updateSymbol(sel.id, { groesse: Math.min(400, Math.max(16, Number(e.target.value) || 16)) })}
                className="w-20 px-1 py-0.5 bg-cp-surface-2 border border-cp-border"
              />
              <span className="text-cp-text-muted">px</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24">{t('symbols.sel.rotation', 'Rotation')}</span>
              <select
                value={sel.drehung ?? 0}
                onChange={(e) => updateSymbol(sel.id, { drehung: Number(e.target.value) })}
                className="px-1 py-0.5 bg-cp-surface-2 border border-cp-border"
              >
                {[0, 90, 180, 270].map((g) => (
                  <option key={g} value={g}>
                    {g}°
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!sel.gesperrt} onChange={(e) => updateSymbol(sel.id, { gesperrt: e.target.checked })} />
              {t('symbols.sel.lock', 'Lock position')}
            </label>
            <button
              className="px-2 py-1 border border-cp-border text-cp-danger hover:bg-cp-surface-3"
              onClick={() => {
                removeSymbol(sel.id)
                waehle(null)
              }}
            >
              {t('symbols.sel.delete', 'Delete symbol')}
            </button>
          </section>
        )}

        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t('symbols.search', 'Search symbols…')}
          className="w-full px-2 py-1 bg-cp-surface-2 border border-cp-border"
        />
        {!suche.trim() && (
          <div className="flex flex-wrap gap-1">
            {SYMBOL_KATEGORIEN.map((k) => (
              <button
                key={k}
                onClick={() => setKategorie(k)}
                className={`px-2 py-0.5 border ${k === kategorie ? 'border-cp-accent bg-cp-accent text-cp-accent-text' : 'border-cp-border hover:bg-cp-surface-3'}`}
              >
                {katName(k)}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sichtbar.map((d) => {
            const src = d.svg ? svgDataUrl(d.svg) : d.bild
            const benutzt = (symbole ?? []).some((s) => s.defId === d.id)
            return (
              <div key={d.id} className="relative">
                <button
                  onClick={() => platzieren(d)}
                  title={t('symbols.place', 'Place on the canvas')}
                  className="flex w-full flex-col items-center gap-1 border border-cp-border bg-cp-surface-2 p-2 hover:bg-cp-surface-3"
                >
                  {/* Weisser Grund: eingebaute Zeichen sind dunkel gezeichnet. */}
                  <span className="flex h-12 w-12 items-center justify-center bg-white">
                    {src && <img src={src} alt="" className="h-10 w-10 object-contain" />}
                  </span>
                  <span className="text-xs leading-tight text-center">{name(d)}</span>
                </button>
                {d.herkunft !== 'eingebaut' && !benutzt && (
                  <button
                    onClick={() => removeSymbolDef(d.id)}
                    title={t('symbols.removeDef', 'Remove from library')}
                    className="absolute right-0 top-0 px-1 text-cp-danger hover:bg-cp-surface-3"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
          {sichtbar.length === 0 && <p className="col-span-3 text-cp-text-muted">{t('symbols.empty', 'No symbols here yet.')}</p>}
        </div>

        <section className="space-y-2 border-t border-cp-border pt-3">
          <input
            ref={importInput}
            type="file"
            accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              void importieren(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button className="w-full px-2 py-1 border border-cp-border hover:bg-cp-surface-3" onClick={() => importInput.current?.click()}>
            {t('symbols.import.button', 'Import symbol (SVG, PNG, JPG, WebP)…')}
          </button>
        </section>

        {kiMoeglich && (
          <section className="space-y-2 border-t border-cp-border pt-3">
            <strong>{format(t('symbols.ai.title', 'Generate with {provider}'), { provider: getAiProviderConfig(provider).label })}</strong>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={3}
              placeholder={t('symbols.ai.placeholder', 'e.g. “emergency stop button”, “DMX splitter”, “fibre splice box”')}
              className="w-full px-2 py-1 bg-cp-surface-2 border border-cp-border"
            />
            <button
              className="w-full px-2 py-1 border border-cp-border hover:bg-cp-surface-3 disabled:opacity-50"
              disabled={laeuft || !beschreibung.trim()}
              onClick={() => void erzeugen()}
            >
              {laeuft ? t('symbols.ai.running', 'Generating…') : t('symbols.ai.button', 'Generate symbol')}
            </button>
          </section>
        )}

        <section className="border-t border-cp-border pt-3">
          <button
            className="w-full px-2 py-1 border border-cp-border hover:bg-cp-surface-3 disabled:opacity-50"
            disabled={(symbole ?? []).length === 0}
            onClick={listeExport}
          >
            {format(t('symbols.list.export', 'Symbol list as CSV ({n})'), { n: (symbole ?? []).length })}
          </button>
        </section>
        {meldung && <p className="border-l-2 border-cp-warn pl-2">{meldung}</p>}
      </div>
    </div>
  )
}
