// ───────────────────────────────────────────────────────────────────────────
// Druck-HTML für Packlisten (pro Case/Lagerort).
//
// Rein: baut aus der abgeleiteten Packliste (`packList.ts`) ein A4-Dokument mit
// eingerückter Baumstruktur. Kein Raten — es wird nur gedruckt, was im Baum
// steht. Gesamtstückzahl aus `packListTotalCount`.
// ───────────────────────────────────────────────────────────────────────────
import type { PackListNode } from './packList'
import { packListTotalCount } from './packList'
import { isContainerKind } from './storageTree'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Baut ein druckfertiges A4-HTML der Packliste eines Wurzel-Knotens. `code`
 * (optional) erscheint im Kopf. Datum wird vom Aufrufer übergeben (Scripts
 * dürfen keine Uhr lesen — hier egal, aber konsistent + testbar).
 */
export const buildPackListHtml = (
  rootName: string,
  rootCode: string | undefined,
  list: PackListNode[],
  dateLabel = '',
): string => {
  const total = packListTotalCount(list)
  const rows = list
    .map((n) => {
      const indent = n.depth * 6
      const marker = isContainerKind(n.node.kind) ? '&#9633;' : '&#8226;'
      const head = `<div class="node" style="margin-left:${indent}mm">${marker} <b>${esc(n.node.name)}</b>${
        n.node.code ? ` <span class="code">${esc(n.node.code)}</span>` : ''
      }</div>`
      const items = n.items
        .map((it) => `<div class="line" style="margin-left:${indent + 6}mm"><span class="qty">${it.qty}×</span> ${esc(it.model)}</div>`)
        .join('')
      const unitsHtml = n.units
        .map(
          (u) =>
            `<div class="line unit" style="margin-left:${indent + 6}mm">– ${esc(u.label)}${
              u.condition !== 'ok' ? ` <span class="cond">[${esc(u.condition)}]</span>` : ''
            }</div>`,
        )
        .join('')
      return head + items + unitsHtml
    })
    .join('\n')

  return `<!doctype html><html><head><meta charset="utf-8"><title>Packliste ${esc(rootName)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, sans-serif; color: #111; font-size: 10pt; }
  h1 { font-size: 15pt; margin: 0 0 1mm; }
  .meta { color: #555; font-size: 9pt; margin-bottom: 5mm; }
  .node { margin-top: 2mm; font-size: 10.5pt; }
  .code { font-family: 'Courier New', monospace; font-size: 8.5pt; color: #555; }
  .line { font-size: 9.5pt; }
  .qty { font-variant-numeric: tabular-nums; color: #333; }
  .unit { color: #444; }
  .cond { color: #b45309; }
</style></head><body>
  <h1>Packliste — ${esc(rootName)}${rootCode ? ` <span class="code">${esc(rootCode)}</span>` : ''}</h1>
  <div class="meta">${total} Positionen${dateLabel ? ` · ${esc(dateLabel)}` : ''}</div>
  ${rows}
</body></html>`
}
