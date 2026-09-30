import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '../../../lib/i18n'
import { siehtAusWieDisplay } from '../../../lib/displayHeuristik'
import type { EquipmentItem } from '../../../types/equipment'
import { Icon } from '../../shared/Icon'
import { TestPatternSlot } from '../../Scopes/ScopesLazy'

/**
 * larszu/lz-scopes#15 — „Testbild zeigen" am Display. Eingeklappt als
 * Vorgabe; die Muster aus lz-scopes werden erst beim Aufklappen geladen.
 * Begruendung der Form in `Scopes/TestPatternPanel.tsx`.
 */
export const TestPatternSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  if (!siehtAusWieDisplay(equipment)) return null
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="border border-cp-border [&_summary]:cursor-pointer"
    >
      <summary className="flex items-center gap-1 px-2 py-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted hover:text-cp-text-bright [&::-webkit-details-marker]:hidden">
        <Icon icon={open ? ChevronDown : ChevronRight} size="xs" className="text-cp-text-faint" />
        <span className="flex-1">{t('testPattern.title', 'Test pattern')}</span>
      </summary>
      {open && (
        <div className="px-2 pb-2">
          <TestPatternSlot key={equipment.id} equipment={equipment} />
        </div>
      )}
    </details>
  )
}
