import { useTranslation } from '../../lib/i18n'
import { provenanceReason, type Provenance } from '../../types/provenance'

/**
 * ADR-003 Inkrement 2 — das geteilte Element, das an einem Wert sagt, woher er
 * kommt.
 *
 * WARUM UEBERHAUPT EIN BADGE. Der Schaden aus ADR-003 entsteht nicht daran,
 * einen unbestaetigten Wert zu benutzen, sondern daran, ihn wie einen
 * bestaetigten AUSZUGEBEN. Eine Zahl in einer Tabelle sieht immer bestaetigt
 * aus; sie hat keine Stelle, an der „ich habe das abgeschickt, mehr weiss ich
 * nicht" stehen koennte. Das Badge ist diese Stelle.
 *
 * WARUM `planned` NICHTS RENDERT. Der Normalfall braucht keine Kennzeichnung.
 * Ein Badge an jedem Wert waere dasselbe wie an keinem — es traegt nur
 * Information, solange es die Ausnahme markiert. (Dieselbe Ueberlegung wie
 * bei der Zugangsdaten-Rueckfrage, die schweigt, wenn nichts dabei ist.)
 */
export interface ProvenanceBadgeProps {
  provenance: Provenance
  /** Feldpfad aus `DECLARED_PROVENANCE` — liefert die Begruendung im Tooltip. */
  field?: string
  /** Zusaetzlicher Klartext, wenn der Aufrufer mehr weiss als die Liste. */
  title?: string
}

const STYLE: Record<Exclude<Provenance, 'planned'>, string> = {
  unknown: 'border-cp-warn/40 bg-cp-warn/10 text-cp-warn',
  commanded: 'border-cp-border bg-cp-surface-3 text-cp-text-secondary',
  confirmed: 'border-cp-accent/40 bg-cp-accent/10 text-cp-accent',
}

export const ProvenanceBadge = ({ provenance, field, title }: ProvenanceBadgeProps) => {
  const t = useTranslation()
  if (provenance === 'planned') return null

  const label =
    provenance === 'unknown'
      ? t('prov.unknown', 'unbestätigt')
      : provenance === 'commanded'
        ? t('prov.commanded', 'gesendet')
        : t('prov.confirmed', 'bestätigt')

  const reason = title ?? (field ? provenanceReason(field) : undefined)

  return (
    <span
      title={reason}
      className={`ml-1 inline-block rounded border px-1 text-[10px] leading-4 align-middle ${STYLE[provenance]}`}
    >
      {label}
    </span>
  )
}
