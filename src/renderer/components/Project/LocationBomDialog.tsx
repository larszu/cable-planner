import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { toJpeg } from 'html-to-image'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { sanitizeForPdf } from '../../lib/sanitizeForPdf'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { useTranslation } from '../../lib/i18n'
import { formatCategoryProps } from '../../lib/categorySchemas'
import { effectiveDeviceResources } from '../../lib/equipmentSelectors'
import type { Lang } from '../../lib/categoryTranslations'

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
  const t = useTranslation()
  const { open, locationId } = useUiStore((s) => s.locationBom)
  const close = useUiStore((s) => s.closeLocationBom)
  const project = useProjectStore((s) => s.project)
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  // #373 — Fachdaten (categoryProps) sprach-aufgelöst in BOM/Export mitführen.
  const lang: Lang = useUiStore((s) => s.language) === 'en' ? 'en' : 'de'
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
  // #320 — Verbindungs-Beschreibung "Device · Port → Device · Port"
  // fuer die Detail-Ansicht der Kabel-Tabellen. Wenn ein Endpunkt
  // ausserhalb der Location liegt, wird "(extern)" angehaengt damit
  // der Empfaenger sofort sieht wo er den Kabel-Endpunkt suchen muss.
  const equipmentById = useMemo(
    () => new Map(project.equipment.map((e) => [e.id, e])),
    [project.equipment],
  )
  const insideIds = new Set(devices.map((d) => d.id))
  const portOf = (eqId: string, portId: string): string => {
    const eq = equipmentById.get(eqId)
    if (!eq) return '?'
    const p = [...eq.inputs, ...eq.outputs].find((p) => p.id === portId)
    const portName = p?.contentLabel || p?.name || p?.id || '?'
    const externalTag = !insideIds.has(eqId) ? ' (extern)' : ''
    return `${eq.name} · ${portName}${externalTag}`
  }
  const connectionDesc = (cable: { fromEquipmentId: string; fromPortId: string; toEquipmentId: string; toPortId: string }) =>
    `${portOf(cable.fromEquipmentId, cable.fromPortId)} → ${portOf(cable.toEquipmentId, cable.toPortId)}`

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

  // #351 — Logistik-Summen je Location: Gesamtgewicht (kg) + Leistung (W) +
  // Wärmelast (BTU/h). Reuse der vorhandenen weightKg-/Power-Felder. So sieht
  // der Materialwart pro Rack/Case sofort Traglast + Strombedarf + Kühlung.
  const logistics = useMemo(() => {
    let weightKg = 0
    let weighed = 0
    let watts = 0
    for (const d of devices) {
      // #124 — aktiver Betriebsmodus kann Gewicht/Leistung überschreiben.
      const res = effectiveDeviceResources(d)
      const modePower = d.activeModeId
        ? d.modes?.find((m) => m.id === d.activeModeId)?.powerWatts
        : undefined
      if (typeof res.weightKg === 'number' && res.weightKg > 0) {
        weightKg += res.weightKg
        weighed += 1
      }
      watts += modePower ?? d.powerConsumptionWatts ?? (d.voltage && d.currentAmps ? d.voltage * d.currentAmps : 0)
    }
    return { weightKg, weighed, watts, btu: Math.round(watts * 3.412) }
  }, [devices])

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
      pdf.text(sanitizeForPdf(`${t('project.locbom.pdfTitle', 'Stückliste')} - ${location.name}`), margin, y)
      y += 18
      pdf.setFontSize(9)
      pdf.setTextColor(80)
      if (location.floor) pdf.text(sanitizeForPdf(`${t('project.locbom.pdfFloor', 'Stockwerk')}: ${location.floor}`), margin, y)
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
      pdf.text(sanitizeForPdf(`${t('project.locbom.pdfDevices', 'Geräte')} (${devices.length})`), margin, y)
      y += 14
      // #351 — Logistik-Zusammenfassung (Gewicht/Leistung/Wärme) als Kopfzeile.
      if (logistics.weightKg > 0 || logistics.watts > 0) {
        pdf.setFontSize(8)
        pdf.setTextColor(90)
        const parts: string[] = []
        if (logistics.weightKg > 0) parts.push(`${t('project.locbom.pdfWeight', 'Gewicht')}: ${logistics.weightKg.toFixed(1)} kg`)
        if (logistics.watts > 0) parts.push(`${t('project.locbom.pdfPower', 'Leistung')}: ${logistics.watts.toFixed(0)} W (${logistics.btu} BTU/h)`)
        pdf.text(sanitizeForPdf(parts.join('   ·   ')), margin, y)
        y += 12
        pdf.setTextColor(20)
      }
      pdf.setFontSize(8)
      for (const d of devices) {
        if (y > 780) {
          pdf.addPage()
          y = margin
        }
        const sn = d.serialNumber ? `  S/N: ${d.serialNumber}` : ''
        const ip = d.ipAddress ? `  IP: ${d.ipAddress}` : ''
        // #351 — Pack-Status als Checkbox-Praefix fuer die Pull-/Packliste.
        const box = d.packed ? '[x]' : '[ ]'
        pdf.text(sanitizeForPdf(`${box} ${d.name}  [${d.category}]${sn}${ip}`), margin, y)
        y += 11
        // #373 — Kategorie-Fachdaten als eingerückte Folgezeile(n).
        const specs = formatCategoryProps(d.category, d.categoryProps, lang)
        if (specs) {
          const maxW = pdf.internal.pageSize.getWidth() - margin * 2
          for (const ln of pdf.splitTextToSize(sanitizeForPdf(specs), maxW) as string[]) {
            if (y > 780) {
              pdf.addPage()
              y = margin
            }
            pdf.text(`    ${ln}`, margin, y)
            y += 10
          }
        }
      }

      y += 8
      pdf.setFontSize(11)
      pdf.text(sanitizeForPdf(`${t('project.locbom.pdfInternalCables', 'Interne Kabel')} (${internalCables.length})`), margin, y)
      y += 14
      pdf.setFontSize(8)
      for (const c of internalCables) {
        if (y > 780) {
          pdf.addPage()
          y = margin
        }
        const conn = connectionDesc(c)
        pdf.text(
          sanitizeForPdf(
            `* ${c.name ?? c.type ?? t('project.locbom.pdfCableFallback', 'Kabel')}  ${c.length ? `(${c.length} m)  ` : ''}${conn}`,
          ),
          margin,
          y,
        )
        y += 11
      }

      if (externalCables.length > 0) {
        y += 8
        pdf.setFontSize(11)
        pdf.text(sanitizeForPdf(`${t('project.locbom.pdfExternalConnections', 'Externe Verbindungen')} (${externalCables.length})`), margin, y)
        y += 14
        pdf.setFontSize(8)
        for (const c of externalCables) {
          if (y > 780) {
            pdf.addPage()
            y = margin
          }
          // v7.9.93 — Kabel-Länge mit ausgeben (fehlte bisher in der
          // externen Liste, war nur in den internen Cable-Gruppen drin).
          // Wireless-Cables haben maxRange statt length (#182).
          const lengthLabel = c.wireless
            ? c.maxRange
              ? ` (<=${c.maxRange} m)`
              : ''
            : c.length
              ? ` (${c.length} m)`
              : ''
          const typeLabel = c.type ? ` [${c.type}]` : ''
          const conn = connectionDesc(c)
          pdf.text(
            sanitizeForPdf(`* ${c.name ?? c.type ?? t('project.locbom.pdfCableFallback', 'Kabel')}${typeLabel}${lengthLabel}  ${conn}`),
            margin,
            y,
          )
          y += 11
        }
      }

      // v7.9.116 — Einheitlicher Stempel: YYYYMMDD_<location>_NNN_stueckliste.pdf
      pdf.save(buildExportFilenameWithSuffix(location.name, 'stueckliste', 'pdf'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={`${t('locbom.title', 'Stückliste')} — ${location.name}`}
      maxWidth="3xl"
      draggableKey="cable-planner:modal-pos:location-bom"
    >
        <div className="text-cp-xs">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-cp-text-muted">
            <span>
              {t('locbom.devices', 'Geräte')}: <b className="text-cp-text-bright">{devices.length}</b>
            </span>
            <span>
              {t('locbom.internalCables', 'Interne Kabel')}: <b className="text-cp-text-bright">{internalCables.length}</b>
            </span>
            {externalCables.length > 0 && (
              <span>
                {t('locbom.externalConnections', 'Externe Verbindungen')}: <b className="text-cp-text-bright">{externalCables.length}</b>
              </span>
            )}
            {/* #351 — Logistik: Gewicht + Strombedarf + Wärmelast je Location. */}
            {logistics.weightKg > 0 && (
              <span title={t('locbom.weightTitle', '{n} von {total} Geräten haben ein Gewicht hinterlegt').replace('{n}', String(logistics.weighed)).replace('{total}', String(devices.length))}>
                {t('locbom.weight', 'Gewicht')}: <b className="text-cp-text-bright">{logistics.weightKg.toFixed(1)} kg</b>
              </span>
            )}
            {logistics.watts > 0 && (
              <span>
                {t('locbom.power', 'Leistung')}: <b className="text-cp-text-bright">{logistics.watts.toFixed(0)} W</b>
                <span className="text-cp-text-faint"> · {logistics.btu} BTU/h</span>
              </span>
            )}
            <label
              className="ml-auto flex items-center gap-1.5 text-[11px] text-cp-text-secondary"
              title={t('locbom.groupTitle', 'Gruppiert gleiche Kabel (selber Typ + Länge) in einer Zeile mit Stückzahl — Standard für Stückliste.')}
            >
              <input
                type="checkbox"
                checked={grouped}
                onChange={(e) => setGrouped(e.target.checked)}
              />
              {t('locbom.groupCables', 'Kabel zusammenfassen')}
            </label>
            <label
              className="flex items-center gap-1.5 text-[11px] text-cp-text-secondary"
              title={t('locbom.includePlanTitle', 'Hängt einen Plan-Ausschnitt der Location als JPEG vor die Geräteliste — die Empfänger bekommen Stückliste + Plan in einem Dokument.')}
            >
              <input
                type="checkbox"
                checked={includePlan}
                onChange={(e) => setIncludePlan(e.target.checked)}
              />
              {t('locbom.includePlan', 'Plan einbetten')}
            </label>
            <button
              type="button"
              onClick={() => { void exportPdf() }}
              disabled={busy}
              className="rounded bg-amber-700 px-3 py-1 text-cp-xs hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t('locbom.rendering', 'Rendere…') : t('locbom.exportPdf', 'PDF exportieren')}
            </button>
          </div>

          <h3 className="mb-1 text-cp-base font-semibold text-cp-text-bright">{t('locbom.section.devices', 'Geräte')}</h3>
          <table className="mb-4 w-full text-cp-xs">
            <thead className="text-cp-text-muted">
              <tr className="border-b border-cp-border">
                <th className="px-2 py-1 text-center w-10">{t('locbom.col.packed', 'Pack')}</th>
                <th className="px-2 py-1 text-left">{t('locbom.col.name', 'Name')}</th>
                <th className="px-2 py-1 text-left">{t('locbom.col.category', 'Kategorie')}</th>
                <th className="px-2 py-1 text-left">{t('locbom.col.sn', 'S/N')}</th>
                <th className="px-2 py-1 text-left">{t('locbom.col.ip', 'IP')}</th>
                <th className="px-2 py-1 text-left">{t('locbom.col.specs', 'Fachdaten')}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-cp-border-muted">
                  <td className="px-2 py-1 text-center">{d.packed ? '☑' : '☐'}</td>
                  <td className="px-2 py-1 text-cp-text">{d.name}</td>
                  <td className="px-2 py-1 text-cp-text-muted">{d.category}</td>
                  <td className="px-2 py-1 font-mono text-cp-text-muted">
                    {d.serialNumber ?? '—'}
                  </td>
                  <td className="px-2 py-1 font-mono text-cp-text-muted">
                    {d.ipAddress ?? '—'}
                  </td>
                  <td className="px-2 py-1 text-cp-text-muted">
                    {formatCategoryProps(d.category, d.categoryProps, lang) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mb-1 text-cp-base font-semibold text-cp-text-bright">{t('locbom.section.internalCables', 'Interne Kabel')}</h3>
          {internalCables.length === 0 ? (
            <div className="mb-3 text-cp-text-faint">{t('locbom.noInternalCables', 'Keine internen Kabel.')}</div>
          ) : grouped ? (
            <table className="mb-4 w-full text-cp-xs">
              <thead className="text-cp-text-muted">
                <tr className="border-b border-cp-border">
                  <th className="px-2 py-1 text-right w-12">{t('locbom.col.qty', 'Stk.')}</th>
                  <th className="px-2 py-1 text-left">{t('locbom.col.type', 'Typ')}</th>
                  <th className="px-2 py-1 text-right">{t('locbom.col.lengthM', 'Länge (m)')}</th>
                </tr>
              </thead>
              <tbody>
                {internalGroups.map((g) => (
                  <tr
                    key={g.key}
                    className="border-b border-cp-border-muted"
                    title={g.examples.length > 0 ? `${t('locbom.examples', 'Beispiele:')} ${g.examples.join(', ')}` : undefined}
                  >
                    <td className="px-2 py-1 text-right font-mono font-semibold text-emerald-300">
                      {g.count}×
                    </td>
                    <td className="px-2 py-1 text-cp-text-bright">{g.type}</td>
                    <td className="px-2 py-1 text-right font-mono text-cp-text-muted">
                      {g.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="mb-4 w-full text-cp-xs">
              <thead className="text-cp-text-muted">
                <tr className="border-b border-cp-border">
                  <th className="px-2 py-1 text-left">{t('locbom.col.name', 'Name')}</th>
                  <th className="px-2 py-1 text-left">{t('locbom.col.type', 'Typ')}</th>
                  <th className="px-2 py-1 text-left">{t('locbom.col.connection', 'Verbindung')}</th>
                  <th className="px-2 py-1 text-right">{t('locbom.col.lengthM', 'Länge (m)')}</th>
                </tr>
              </thead>
              <tbody>
                {internalCables.map((c) => (
                  <tr key={c.id} className="border-b border-cp-border-muted">
                    <td className="px-2 py-1">{c.name ?? '—'}</td>
                    <td className="px-2 py-1 text-cp-text-muted">{c.type ?? '—'}</td>
                    <td className="px-2 py-1 text-cp-text-secondary">{connectionDesc(c)}</td>
                    <td className="px-2 py-1 text-right font-mono text-cp-text-muted">
                      {c.length ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {externalCables.length > 0 && (
            <>
              <h3 className="mb-1 text-cp-base font-semibold text-amber-200">
                {t('locbom.section.externalConnections', 'Externe Verbindungen')}
              </h3>
              {grouped ? (
                <table className="w-full text-cp-xs">
                  <thead className="text-cp-text-muted">
                    <tr className="border-b border-cp-border">
                      <th className="px-2 py-1 text-right w-12">{t('locbom.col.qty', 'Stk.')}</th>
                      <th className="px-2 py-1 text-left">{t('locbom.col.type', 'Typ')}</th>
                      <th className="px-2 py-1 text-right">{t('locbom.col.lengthM', 'Länge (m)')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalGroups.map((g) => (
                      <tr
                        key={g.key}
                        className="border-b border-cp-border-muted"
                        title={g.examples.length > 0 ? `${t('locbom.examples', 'Beispiele:')} ${g.examples.join(', ')}` : undefined}
                      >
                        <td className="px-2 py-1 text-right font-mono font-semibold text-amber-300">
                          {g.count}×
                        </td>
                        <td className="px-2 py-1 text-cp-text-bright">{g.type}</td>
                        <td className="px-2 py-1 text-right font-mono text-cp-text-muted">
                          {g.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-cp-xs">
                  <thead className="text-cp-text-muted">
                    <tr className="border-b border-cp-border">
                      <th className="px-2 py-1 text-left">{t('locbom.col.name', 'Name')}</th>
                      <th className="px-2 py-1 text-left">{t('locbom.col.type', 'Typ')}</th>
                      <th className="px-2 py-1 text-left">{t('locbom.col.connection', 'Verbindung')}</th>
                      <th className="px-2 py-1 text-right">{t('locbom.col.lengthM', 'Länge (m)')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalCables.map((c) => (
                      <tr key={c.id} className="border-b border-cp-border-muted">
                        <td className="px-2 py-1">{c.name ?? '—'}</td>
                        <td className="px-2 py-1 text-cp-text-muted">{c.type ?? '—'}</td>
                        <td className="px-2 py-1 text-cp-text-secondary">{connectionDesc(c)}</td>
                        <td className="px-2 py-1 text-right font-mono text-cp-text-muted">
                          {/* v7.9.93 — Wireless zeigt maxRange statt length (#182). */}
                          {c.wireless
                            ? c.maxRange
                              ? `≤${c.maxRange}`
                              : '—'
                            : c.length ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
    </ModalShell>
  )
}
