import { useEffect, useRef, useState } from 'react'
import { MonitorPlay, X } from 'lucide-react'
import { PATTERNS, RESOLUTIONS, patternById, renderPattern } from '../../vendor/lz-scopes/src'
import { cablePlannerApi, hasDesktopBridge, type TestPatternScreen } from '../../lib/bridge'
import { format, useTranslation } from '../../lib/i18n'
import { patternGroup, patternName } from '../../lib/testPatternNames'
import { useUiStore } from '../../store/uiStore'
import { Icon } from '../shared/Icon'
import type { EquipmentItem } from '../../types/equipment'

/**
 * larszu/lz-scopes#15 — Testbild am Display: Muster aus lz-scopes, randlos im
 * Vollbild auf einem Bildschirm dieses Rechners (`testPattern:*`).
 *
 * FUNKTION AM DISPLAY, KEIN KATALOG-GERAET. Ein Testbildgenerator als
 * virtuelles Geraet fuehrte ein reales Geraet (Blackmagic-Generator, Ausgang
 * eines Mischers) doppelt und stuende in der Stueckliste, ohne gemietet oder
 * gekauft zu werden. Das Testbild gehoert zu der Frage, die man am Display
 * stellt: „zeigt es richtig?".
 *
 * DAS LABEL IST VORGEGEBEN MIT DEM NAMEN DES DISPLAYS IM PLAN. Aus demselben
 * Grund wie beim Pruefbild (`PatternChip`): Balken allein beantworten nichts,
 * ein Name auf dem echten Schirm findet die Vertauschung.
 *
 * Welcher Bildschirm dieses Rechners das Display ist, gilt fuer diesen Rechner
 * und diese Sitzung — es steht nicht im Plan.
 */
export default function TestPatternPanel({ equipment }: { equipment: EquipmentItem }) {
  const t = useTranslation()
  const lang = useUiStore((s) => s.language)
  const [musterId, setMusterId] = useState('smpte75')
  const [label, setLabel] = useState(equipment.name)
  const [aufloesung, setAufloesung] = useState('native')
  const [schirme, setSchirme] = useState<TestPatternScreen[]>([])
  const [schirmId, setSchirmId] = useState<number | null>(null)
  const [laeuft, setLaeuft] = useState<number | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const vorschau = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!hasDesktopBridge) return
    let aus = false
    void cablePlannerApi.testPattern.screens().then((l) => {
      if (aus) return
      setSchirme(l)
      // Vorgabe: ein Bildschirm, der NICHT der Hauptbildschirm ist — dort
      // steht die App selbst.
      setSchirmId((l.find((s) => !s.primary) ?? l[0])?.id ?? null)
    })
    return () => {
      aus = true
    }
  }, [])

  const def = patternById(musterId)
  useEffect(() => {
    const c = vorschau.current
    if (!c) return
    void renderPattern(c.getContext('2d')!, def, c.width, c.height, 0, label).catch(() => undefined)
  }, [def, label])

  const groesse = (): [number, number] => {
    if (aufloesung !== 'native') {
      const [w, h] = aufloesung.split('x').map(Number)
      return [w, h]
    }
    const s = schirme.find((x) => x.id === schirmId)
    if (s) return [s.width, s.height]
    return [Math.round(window.screen.width * devicePixelRatio), Math.round(window.screen.height * devicePixelRatio)]
  }

  const malen = async (): Promise<HTMLCanvasElement> => {
    const [w, h] = groesse()
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    await renderPattern(c.getContext('2d')!, def, w, h, 0, label)
    return c
  }

  const zeigen = async () => {
    setFehler(null)
    try {
      const c = await malen()
      if (!hasDesktopBridge || schirmId === null) {
        // Browser: Vollbild im eigenen Fenster; Esc beendet es.
        c.style.cssText = 'width:100vw;height:100vh;object-fit:contain;background:#000;image-rendering:pixelated'
        document.body.append(c)
        c.addEventListener('fullscreenchange', () => {
          if (!document.fullscreenElement) c.remove()
        })
        await c.requestFullscreen()
        return
      }
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'))
      if (!blob) throw new Error('png')
      const r = await cablePlannerApi.testPattern.show(schirmId, new Uint8Array(await blob.arrayBuffer()))
      if (!r.ok) throw new Error('show')
      setLaeuft(schirmId)
    } catch {
      setFehler(t('testPattern.err', 'The test pattern could not be shown.'))
    }
  }

  const gruppen = [...new Set(PATTERNS.map((p) => p.group))]
  const feld = 'w-full border border-cp-border bg-cp-surface-1 p-1.5'

  return (
    <div className="flex flex-col gap-1.5 text-cp-xs">
      <canvas ref={vorschau} width={320} height={180} className="w-full border border-cp-border-muted bg-black" />
      <select
        value={musterId}
        onChange={(e) => setMusterId(e.target.value)}
        aria-label={t('testPattern.pattern', 'Pattern')}
        className={feld}
      >
        {gruppen.map((g) => (
          <optgroup key={g} label={patternGroup(g, lang)}>
            {PATTERNS.filter((p) => p.group === g).map((p) => (
              <option key={p.id} value={p.id}>
                {patternName(p, lang)}
                {p.animated ? ` (${t('testPattern.still', 'still frame')})` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t('testPattern.label', 'Label on the pattern')}
        aria-label={t('testPattern.label', 'Label on the pattern')}
        className={feld}
      />
      <div className="grid grid-cols-2 gap-1">
        <select
          value={aufloesung}
          onChange={(e) => setAufloesung(e.target.value)}
          aria-label={t('testPattern.resolution', 'Resolution')}
          className={feld}
        >
          <option value="native">{t('testPattern.native', 'Native (screen)')}</option>
          {RESOLUTIONS.map(([w, h]) => (
            <option key={`${w}x${h}`} value={`${w}x${h}`}>{`${w}×${h}`}</option>
          ))}
        </select>
        {hasDesktopBridge && schirme.length > 0 ? (
          <select
            value={schirmId ?? ''}
            onChange={(e) => setSchirmId(Number(e.target.value))}
            aria-label={t('testPattern.screen', 'Screen of this computer')}
            title={t('testPattern.screenTitle', 'Which screen of this computer is this display? Applies to this computer only, not stored in the plan.')}
            className={feld}
          >
            {schirme.map((s) => (
              <option key={s.id} value={s.id}>
                {format(t('testPattern.screenOption', '{label} · {w}×{h}{primary}'), {
                  label: s.label,
                  w: String(s.width),
                  h: String(s.height),
                  primary: s.primary ? ` · ${t('testPattern.primary', 'main screen')}` : '',
                })}
              </option>
            ))}
          </select>
        ) : (
          <span className="self-center text-cp-text-muted">
            {t('testPattern.thisWindow', 'Full screen in this window')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void zeigen()}
          className="flex items-center gap-1 border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text"
        >
          <Icon icon={MonitorPlay} size="xs" /> {t('testPattern.show', 'Show test pattern')}
        </button>
        {laeuft !== null && (
          <button
            type="button"
            onClick={() => {
              void cablePlannerApi.testPattern.close(laeuft)
              setLaeuft(null)
            }}
            className="flex items-center gap-1 border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text"
          >
            <Icon icon={X} size="xs" /> {t('testPattern.close', 'Close')}
          </button>
        )}
      </div>
      <p className="text-cp-text-faint">
        {t('testPattern.hint', 'Borderless and full screen on the chosen screen. Esc on that screen closes it.')}
      </p>
      {fehler && <p className="text-cp-danger">{fehler}</p>}
    </div>
  )
}
