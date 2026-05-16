import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { toJpeg } from 'html-to-image'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { sanitizeForPdf } from '../../lib/sanitizeForPdf'

/**
 * Issue #39 — Frame-scoped Bill of Materials. For a selected location/frame
 * the user gets a printable list of every device whose center sits inside
 * the frame, complete with serial number, IP, location label, plus the
 * cables whose endpoints both fall inside the frame. Useful when sending
 * someone with a parts list to assemble that one rack/room.
 *
 * Out-of-scope: cross-frame cables (one end inside, one outside) are
 * intentionally listed separately as "Externe Verbindungen" so the field
 * tech sees what they need to route into/out of the frame.
 */
export const LocationBomDialog = () => {
  const { open, locationId } = useUiStore((s) => s.locationBom)
  const close = useUiStore((s) => s.closeLocationBom)
  const project = useProjectStore((s) => s.project)
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const drag = useDraggablePosition('cable-planner:modal-pos:location-bom', open)
  // Issue #54: optionally embed a snapshot of the canvas (cropped to the
  // location's bbox) as the first page so the recipient gets the plan +
  // the parts list in one document. Off by default — capturing a 2.4 MB
  // diagram region takes ~500 ms and the user might not always want it.
  const [includePlan, setIncludePlan] = useState(true)
  // v7.9.0 / Issue #116 — Kabel-Liste lässt sich zwischen "Detail"
  // (eine Zeile pro Kabel) und "Gruppiert" (eine Zeile pro Typ+Länge
  // mit Stückzahl) umschalten. Gruppiert ist Default — das ist was
  // ein Einkäufer/Materialwart bekommen will.
  const [grouped, setGrouped] = useState(true)
  const [busy, setBusy] = useState(false)

  const location = (project.locations ?? []).find((l) => l.id === locationId)

  const { devices, internalCables, externalCables } = useMemo(() => {
    if (!location) {
      return { devices: [], internalCables: [], externalCables: [] }
    }
    const lx1 = location.x
    const ly1 = location.y
    const lx2 = location.x + location.width
    const ly2 = location.y + location.height
    const inside = (x: number, y: number) =>
      x >= lx1 && x <= lx2 && y >= ly1 && y <= ly2
    const devices = project.equipment.filter((e) => {
      const cx = e.x + (e.width ?? 220) / 2
      const cy = e.y + (e.height ?? 60) / 2
      return inside(cx, cy)
    })
    const deviceIds = new Set(devices.map((d) => d.id))
    const internalCables = project.cables.filter(
      (c) => deviceIds.has(c.fromEquipmentId) && deviceIds.has(c.toEquipmentId),
    )
    const externalCables = project.cables.filter(
      (c) =>
        (deviceIds.has(c.fromEquipmentId) && !deviceIds.has(c.toEquipmentId)) ||
        (!deviceIds.has(c.fromEquipmentId) && deviceIds.has(c.toEquipmentId)),
    )
    return { devices, internalCables, externalCables }
  }, [location, project.equipment, project.cables])

  // v7.9.0 / Issue #116 — gruppiere Kabel nach Typ + Länge.
  // Beispiel: 5× "BNC, 1m", 3× "BNC, 3m". Length wird auf 0.1 m
  // gerundet damit minimale Float-Drifts (1.0001 vs 1) nicht zwei
  // separate Gruppen erzeugen.
  type CableGroup = {
    key: string
    type: string
    length: number
    count: number
    examples: string[] // up to 3 cable names for tooltip
  }
  const aggregateCables = (cables: typeof internalCables): CableGroup[] => {
    const map = new Map<string, CableGroup>()
    for (const c of cables) {
      const type = c.type ?? '—'
      const length = Math.round((c.length ?? 0) * 10) / 10
      const key = `${type}|${length}`
      let g = map.get(key)
      if (!g) {
        g = { key, type, length, count: 0, examples: [] }
        map.set(key, g)
      }
      g.count += 1
      if (g.examples.length < 3 && c.name) g.examples.push(c.name)
    }
    // Sort by type, then length asc
    return Array.from(map.values()).sort((a, b) =>
      a.type === b.type ? a.length - b.length : a.type.localeCompare(b.type),
    )
  }
  const internalGroups = aggregateCables(internalCables)
  const externalGroups = aggregateCables(externalCables)

  if (!open || !location) return null

  /** Capture the canvas region covered by the current location frame as a
   *  JPEG dataURL, padded slightly so cables touching the border aren't
   *  clipped. Mirrors the trick exportCanvasToPdf uses. */
  const capturePlanForLocation = async (): Promise<string | null> => {
    const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewportEl || !location) return null
    const padding = 40
    const cx = location.x - padding
    const cy = location.y - padding
    const cw = Math.ceil(location.width + padding * 2)
    const ch = Math.ceil(location.height + padding * 2)
    const bgFallback = canvasTheme === 'light' ? '#e8edf4' : '#0f172a'
    return await toJpeg(viewportEl, {
      backgroundColor: bgFallback,
      pixelRatio: 1.5,
      quality: 0.85,
      cacheBust: true,
      width: cw,
      height: ch,
      style: {
        width: `${cw}px`,
        height: `${ch}px`,
        backgroundColor: bgFallback,
        transform: `translate(${-cx}px, ${-cy}px)`,
        transformOrigin: '0 0',
      },
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true
        if (node.classList.contains('react-flow__minimap')) return false
        if (node.classList.contains('react-flow__controls')) return false
        return true
      },
    })
  }

  const exportPdf = async () => {
    if (busy) return
    setBusy(true)
    try {
      const planDataUrl = includePlan ? await capturePlanForLocation() : null
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 32
      let y = margin + 4
      pdf.setFontSize(14)
      pdf.text(sanitizeForPdf(`Stückliste - ${location.name}`), margin, y)
      y += 18
      pdf.setFontSize(9)
      pdf.setTextColor(80)
      if (location.floor) pdf.text(sanitizeForPdf(`Stockwerk: ${location.floor}`), margin, y)
      pdf.text(sanitizeForPdf(new Date().toLocaleString()), pageW - margin, y, { align: 'right' })
      y += 18

      // Embed the plan snapshot at the top, scaled to fit the page width
      // while preserving aspect ratio. Capped at half the page height so
      // the parts list still has room on the same page when small.
      if (planDataUrl) {
        const img = new Image()
        img.src = planDataUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Konnte den Plan-Snapshot nicht laden'))
        })
        const avail = pageW - margin * 2
        const maxH = (pageH - margin * 2) * 0.5
        const ratio = img.naturalWidth / Math.max(1, img.naturalHeight)
        let drawW = avail
        let drawH = drawW / ratio
        if (drawH > maxH) {
          drawH = maxH
          drawW = drawH * ratio
        }
        pdf.addImage(planDataUrl, 'JPEG', margin, y, drawW, drawH)
        y += drawH + 14
      }

      pdf.setTextColor(20)
      pdf.setFontSize(11)
      pdf.text(sanitizeForPdf(`Geräte (${devices.length})`), margin, y)
      y += 14
      pdf.setFontSize(8)
      for (const d of devices) {
        if (y > 780) {
          pdf.addPage()
          y = margin
        }
        const sn = d.serialNumber ? `  S/N: ${d.serialNumber}` : ''
        const ip = d.ipAddress ? `  IP: ${d.ipAddress}` : ''
        pdf.text(sanitizeForPdf(`* ${d.name}  [${d.category}]${sn}${ip}`), margin, y)
        y += 11
      }

      y += 8
      pdf.setFontSize(11)
      pdf.text(sanitizeForPdf(`Interne Kabel (${internalCables.length})`), margin, y)
      y += 14
      pdf.setFontSize(8)
      for (const c of internalCables) {
        if (y > 780) {
          pdf.addPage()
          y = margin
        }
        pdf.text(
          sanitizeForPdf(
            `* ${c.name ?? c.type ?? 'Kabel'}  ${c.length ? `(${c.length} m)` : ''}`,
          ),
          margin,
          y,
        )
        y += 11
      }

      if (externalCables.length > 0) {
        y += 8
        pdf.setFontSize(11)
        pdf.text(sanitizeForPdf(`Externe Verbindungen (${externalCables.length})`), margin, y)
        y += 14
        pdf.setFontSize(8)
        for (const c of externalCables) {
          if (y > 780) {
            pdf.addPage()
            y = margin
          }
          pdf.text(sanitizeForPdf(`* ${c.name ?? c.type ?? 'Kabel'}`), margin, y)
          y += 11
        }
      }

      pdf.save(`${location.name.replace(/[^a-z0-9\-_. ]/gi, '_')}-stueckliste.pdf`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={drag.containerRef}
        style={drag.containerStyle}
        className="flex max-h-[90vh] w-[760px] max-w-[95vw] flex-col rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <header
          {...drag.headerProps}
          className="flex items-center justify-between border-b border-slate-700 px-4 py-2 select-none"
        >
          <h2 className="text-sm font-semibold">Stückliste — {location.name}</h2>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            Schließen
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 text-xs">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>
              Geräte: <b className="text-slate-200">{devices.length}</b>
            </span>
            <span>
              Interne Kabel: <b className="text-slate-200">{internalCables.length}</b>
            </span>
            {externalCables.length > 0 && (
              <span>
                Externe Verbindungen: <b className="text-slate-200">{externalCables.length}</b>
              </span>
            )}
            <label
              className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-300"
              title="Gruppiert gleiche Kabel (selber Typ + Länge) in einer Zeile mit Stückzahl — Standard für Stückliste."
            >
              <input
                type="checkbox"
                checked={grouped}
                onChange={(e) => setGrouped(e.target.checked)}
              />
              Kabel zusammenfassen
            </label>
            <label
              className="flex items-center gap-1.5 text-[11px] text-slate-300"
              title="Hängt einen Plan-Ausschnitt der Location als JPEG vor die Geräteliste — die Empfänger bekommen Stückliste + Plan in einem Dokument."
            >
              <input
                type="checkbox"
                checked={includePlan}
                onChange={(e) => setIncludePlan(e.target.checked)}
              />
              Plan einbetten
            </label>
            <button
              type="button"
              onClick={() => { void exportPdf() }}
              disabled={busy}
              className="rounded bg-amber-700 px-3 py-1 text-xs hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Rendere…' : 'PDF exportieren'}
            </button>
          </div>

          <h3 className="mb-1 text-sm font-semibold text-slate-200">Geräte</h3>
          <table className="mb-4 w-full text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-700">
                <th className="px-2 py-1 text-left">Name</th>
                <th className="px-2 py-1 text-left">Kategorie</th>
                <th className="px-2 py-1 text-left">S/N</th>
                <th className="px-2 py-1 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-slate-800">
                  <td className="px-2 py-1 text-slate-100">{d.name}</td>
                  <td className="px-2 py-1 text-slate-400">{d.category}</td>
                  <td className="px-2 py-1 font-mono text-slate-400">
                    {d.serialNumber ?? '—'}
                  </td>
                  <td className="px-2 py-1 font-mono text-slate-400">
                    {d.ipAddress ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mb-1 text-sm font-semibold text-slate-200">Interne Kabel</h3>
          {internalCables.length === 0 ? (
            <div className="mb-3 text-slate-500">Keine internen Kabel.</div>
          ) : grouped ? (
            <table className="mb-4 w-full text-xs">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-700">
                  <th className="px-2 py-1 text-right w-12">Stk.</th>
                  <th className="px-2 py-1 text-left">Typ</th>
                  <th className="px-2 py-1 text-right">Länge (m)</th>
                </tr>
              </thead>
              <tbody>
                {internalGroups.map((g) => (
                  <tr
                    key={g.key}
                    className="border-b border-slate-800"
                    title={g.examples.length > 0 ? `Beispiele: ${g.examples.join(', ')}` : undefined}
                  >
                    <td className="px-2 py-1 text-right font-mono font-semibold text-emerald-300">
                      {g.count}×
                    </td>
                    <td className="px-2 py-1 text-slate-200">{g.type}</td>
                    <td className="px-2 py-1 text-right font-mono text-slate-400">
                      {g.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="mb-4 w-full text-xs">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-700">
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Typ</th>
                  <th className="px-2 py-1 text-right">Länge (m)</th>
                </tr>
              </thead>
              <tbody>
                {internalCables.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800">
                    <td className="px-2 py-1">{c.name ?? '—'}</td>
                    <td className="px-2 py-1 text-slate-400">{c.type ?? '—'}</td>
                    <td className="px-2 py-1 text-right font-mono text-slate-400">
                      {c.length ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {externalCables.length > 0 && (
            <>
              <h3 className="mb-1 text-sm font-semibold text-amber-200">
                Externe Verbindungen
              </h3>
              {grouped ? (
                <table className="w-full text-xs">
                  <thead className="text-slate-400">
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-1 text-right w-12">Stk.</th>
                      <th className="px-2 py-1 text-left">Typ</th>
                      <th className="px-2 py-1 text-right">Länge (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalGroups.map((g) => (
                      <tr
                        key={g.key}
                        className="border-b border-slate-800"
                        title={g.examples.length > 0 ? `Beispiele: ${g.examples.join(', ')}` : undefined}
                      >
                        <td className="px-2 py-1 text-right font-mono font-semibold text-amber-300">
                          {g.count}×
                        </td>
                        <td className="px-2 py-1 text-slate-200">{g.type}</td>
                        <td className="px-2 py-1 text-right font-mono text-slate-400">
                          {g.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-slate-400">
                    <tr className="border-b border-slate-700">
                      <th className="px-2 py-1 text-left">Name</th>
                      <th className="px-2 py-1 text-left">Typ</th>
                      <th className="px-2 py-1 text-right">Länge (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalCables.map((c) => (
                      <tr key={c.id} className="border-b border-slate-800">
                        <td className="px-2 py-1">{c.name ?? '—'}</td>
                        <td className="px-2 py-1 text-slate-400">{c.type ?? '—'}</td>
                        <td className="px-2 py-1 text-right font-mono text-slate-400">
                          {c.length ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
