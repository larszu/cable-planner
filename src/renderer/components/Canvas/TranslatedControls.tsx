import { ControlButton, Controls, useReactFlow, useStore, useStoreApi, type ReactFlowState } from 'reactflow'
import { Lock, Maximize, Minus, Plus, Unlock } from 'lucide-react'
import { shallow } from 'zustand/shallow'
import { useTranslation } from '../../lib/i18n'

/**
 * ReactFlow-Zoomleiste mit uebersetzten Tooltips.
 *
 * `<Controls />` aus ReactFlow 11 schreibt "zoom in", "fit view" usw. fest
 * ins title/aria-label und bietet keinen Prop dafuer. Deshalb die vier
 * Knoepfe hier nachgebaut, mit demselben Verhalten wie im Original.
 */
const selector = (s: ReactFlowState) => ({
  isInteractive: s.nodesDraggable || s.nodesConnectable || s.elementsSelectable,
  minZoomReached: s.transform[2] <= s.minZoom,
  maxZoomReached: s.transform[2] >= s.maxZoom,
})

export const TranslatedControls = () => {
  const t = useTranslation()
  const store = useStoreApi()
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { isInteractive, minZoomReached, maxZoomReached } = useStore(selector, shallow)
  const zoomInLabel = t('canvas.controls.zoomIn', 'Zoom in')
  const zoomOutLabel = t('canvas.controls.zoomOut', 'Zoom out')
  const fitLabel = t('canvas.controls.fitView', 'Fit view')
  const lockLabel = t('canvas.controls.toggleInteractivity', 'Toggle interactivity')
  return (
    <Controls showZoom={false} showFitView={false} showInteractive={false}>
      <ControlButton onClick={() => zoomIn()} title={zoomInLabel} aria-label={zoomInLabel} disabled={maxZoomReached}>
        <Plus />
      </ControlButton>
      <ControlButton onClick={() => zoomOut()} title={zoomOutLabel} aria-label={zoomOutLabel} disabled={minZoomReached}>
        <Minus />
      </ControlButton>
      <ControlButton onClick={() => fitView()} title={fitLabel} aria-label={fitLabel}>
        <Maximize />
      </ControlButton>
      <ControlButton
        onClick={() =>
          store.setState({
            nodesDraggable: !isInteractive,
            nodesConnectable: !isInteractive,
            elementsSelectable: !isInteractive,
          })
        }
        title={lockLabel}
        aria-label={lockLabel}
      >
        {isInteractive ? <Unlock /> : <Lock />}
      </ControlButton>
    </Controls>
  )
}
