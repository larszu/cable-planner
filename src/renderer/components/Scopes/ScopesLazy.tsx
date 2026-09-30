import { lazy, Suspense, type ComponentProps } from 'react'
import { useTranslation } from '../../lib/i18n'
import { useScopeStore } from '../../store/scopeStore'

// larszu/lz-scopes#15 — die Lazy-Grenze der Scopes. Alles, was lz-scopes
// importiert, liegt hinter diesen `lazy()`; der Haupt-Chunk kennt nur diese
// Datei. Wer einen weiteren Eintritt braucht, legt ihn HIER an — ein
// statischer Import aus `Scopes/` oder `vendor/lz-scopes` irgendwo sonst zoege
// WebGL-Renderer und Audio-DSP in jeden Start (vgl. die Three-Grenze in
// CLAUDE.md). `tests/scopesLazyGrenze.test.ts` haelt das fest.
const ScopeMonitor = lazy(() => import('./ScopeMonitor'))
const ScopeDialog = lazy(() => import('./ScopeDialog'))
const TestPatternPanel = lazy(() => import('./TestPatternPanel'))

export function ScopeMonitorSlot(props: ComponentProps<typeof ScopeMonitor>) {
  const t = useTranslation()
  return (
    <Suspense fallback={<div className="text-cp-xs text-cp-text-muted">{t('scopes.loading', 'Loading scopes …')}</div>}>
      <ScopeMonitor {...props} />
    </Suspense>
  )
}

/** Testbild am Display (`Properties/sections/TestPatternSection.tsx`). */
export function TestPatternSlot(props: ComponentProps<typeof TestPatternPanel>) {
  const t = useTranslation()
  return (
    <Suspense fallback={<div className="text-cp-xs text-cp-text-muted">{t('testPattern.loading', 'Loading test patterns …')}</div>}>
      <TestPatternPanel {...props} />
    </Suspense>
  )
}

/** Das grosse Panel; einmal in `App.tsx` gemountet, offen ueber `useScopeStore`. */
export function ScopeDialogHost() {
  const offen = useScopeStore((s) => s.dialog !== null)
  if (!offen) return null
  return (
    <Suspense fallback={null}>
      <ScopeDialog />
    </Suspense>
  )
}
