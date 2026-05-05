import { useMemo } from 'react'
import jsPDF from 'jspdf'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'

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
  const drag = useDraggablePosition('cable-planner:modal-pos:location-bom', open)

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

  if (!open || !location) return null

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const margin = 32
    let y = margin + 4
    pdf.setFontSize(14)
    pdf.text(`Stückliste — ${location.name}`, margin, y)
    y += 18
    pdf.setFontSize(9)
    pdf.setTextColor(80)
    if (location.floor) pdf.text(`Stockwerk: ${location.floor}`, margin, y)
    pdf.text(new Date().toLocaleString(), pageW - margin, y, { align: 'right' })
    y += 18

    pdf.setTextColor(20)
    pdf.setFontSize(11)
    pdf.text(`Geräte (${devices.length})`, margin, y)
    y += 14
    pdf.setFontSize(8)
    for (const d of devices) {
      if (y > 780) {
        pdf.addPage()
        y = margin
      }
      const sn = d.serialNumber ? `  S/N: ${d.serialNumber}` : ''
      const ip = d.ipAddress ? `  IP: ${d.ipAddress}` : ''
      pdf.text(`• ${d.name}  [${d.category}]${sn}${ip}`, margin, y)
      y += 11
    }

    y += 8
    pdf.setFontSize(11)
    pdf.text(`Interne Kabel (${internalCables.length})`, margin, y)
    y += 14
    pdf.setFontSize(8)
    for (const c of internalCables) {
      if (y > 780) {
        pdf.addPage()
        y = margin
      }
      pdf.text(
        `• ${c.name ?? c.type ?? 'Kabel'}  ${c.length ? `(${c.length} m)` : ''}`,
        margin,
        y,
      )
      y += 11
    }

    if (externalCables.length > 0) {
      y += 8
      pdf.setFontSize(11)
      pdf.text(`Externe Verbindungen (${externalCables.length})`, margin, y)
      y += 14
      pdf.setFontSize(8)
      for (const c of externalCables) {
        if (y > 780) {
          pdf.addPage()
          y = margin
        }
        pdf.text(`• ${c.name ?? c.type ?? 'Kabel'}`, margin, y)
        y += 11
      }
    }

    pdf.save(`${location.name.replace(/[^a-z0-9\-_. ]/gi, '_')}-stueckliste.pdf`)
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
            <button
              type="button"
              onClick={exportPdf}
              className="ml-auto rounded bg-amber-700 px-3 py-1 text-xs hover:bg-amber-600"
            >
              PDF exportieren
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
            </>
          )}
        </main>
      </div>
    </div>
  )
}
