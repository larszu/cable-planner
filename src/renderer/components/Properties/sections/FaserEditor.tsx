// ───────────────────────────────────────────────────────────────────────────
// Der Breakout einer Buchse (#885).
//
// ─── WARUM DIE VORLAGEN NUR DIE ZAHL SETZEN ────────────────────────────────
//
// „2 Fasern" und „4 Fasern" legen die Lagen an und lassen die Rolle auf
// `unbestimmt`. Sie KOENNTEN Faser 1 auf TX und 2 auf RX setzen — das ist die
// haeufigste Belegung —, und genau deshalb tun sie es nicht: die Zahl kaeme
// aus diesem Programm und saehe danach aus wie eine Angabe des Datenblatts.
// Wer die Richtung kennt, waehlt sie in einem Klick; wer sie nicht kennt,
// soll sie nicht geschenkt bekommen.
// ───────────────────────────────────────────────────────────────────────────
import { v4 as uuidv4 } from 'uuid'
import { Plus, X } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useTranslation } from '../../../lib/i18n'
import { FASER_ROLLEN, type Faser, type FaserRolle } from '../../../types/fiber'
import type { Port } from '../../../types/equipment'

const ROLLE_KURZ: Record<FaserRolle, string> = {
  tx: 'TX',
  rx: 'RX',
  unbestimmt: '—',
}

export const FaserEditor = ({
  port,
  onChange,
}: {
  port: Port
  onChange: (fasern: Faser[] | undefined) => void
}) => {
  const t = useTranslation()
  const fasern = port.fasern ?? []

  const vorlage = (anzahl: number) =>
    onChange(
      Array.from({ length: anzahl }, (_, i) => ({
        id: uuidv4(),
        position: i + 1,
        rolle: 'unbestimmt' as FaserRolle,
      })),
    )

  const aendere = (id: string, patch: Partial<Faser>) =>
    onChange(fasern.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const entferne = (id: string) => {
    const rest = fasern.filter((f) => f.id !== id)
    onChange(rest.length > 0 ? rest : undefined)
  }

  return (
    <div className="mt-1 border border-amber-900/60 bg-amber-950/20 p-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-cp-xs font-semibold uppercase tracking-wide text-amber-400">
          {t('fibre.breakout', 'Breakout')}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => vorlage(2)}
            className="bg-cp-surface-3 px-1.5 py-0.5 text-cp-xs hover:bg-cp-surface-4"
          >
            {t('fibre.template2', 'DUO (2)')}
          </button>
          <button
            type="button"
            onClick={() => vorlage(4)}
            className="bg-cp-surface-3 px-1.5 py-0.5 text-cp-xs hover:bg-cp-surface-4"
          >
            {t('fibre.template4', 'QUAD (4)')}
          </button>
        </div>
      </div>

      {fasern.length === 0 ? (
        <p className="text-cp-xs text-cp-text-muted">
          {t(
            'fibre.noneHint',
            'Not split. A socket that carries several fibres (opticalCON DUO/QUAD, MPO) lists them here - then each cable says which one it uses.',
          )}
        </p>
      ) : (
        <div className="space-y-1">
          {[...fasern]
            .sort((a, b) => a.position - b.position)
            .map((f) => (
              <div key={f.id} className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  value={f.position}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isInteger(n) && n >= 1) aendere(f.id, { position: n })
                  }}
                  className="w-12 border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                  title={t('fibre.positionTitle', 'Position in the socket, 1-based')}
                />
                <select
                  value={f.rolle}
                  onChange={(e) => aendere(f.id, { rolle: e.target.value as FaserRolle })}
                  className="border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                  title={t(
                    'fibre.roleTitle',
                    'What this fibre carries. "not stated" is a state of its own - it never counts as checked.',
                  )}
                >
                  {FASER_ROLLEN.map((r) => (
                    <option key={r} value={r}>
                      {r === 'tx'
                        ? t('fibre.role.tx', 'TX (sending)')
                        : r === 'rx'
                          ? t('fibre.role.rx', 'RX (receiving)')
                          : t('fibre.role.unstated', 'not stated')}
                    </option>
                  ))}
                </select>
                <input
                  value={f.connector ?? ''}
                  onChange={(e) => aendere(f.id, { connector: e.target.value || undefined })}
                  placeholder={t('fibre.connectorPlaceholder', 'Connector (LC)')}
                  className="w-20 border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                  title={t(
                    'fibre.connectorTitle',
                    'The connector of THIS fibre at the breakout tail - outside opticalCON, inside LC.',
                  )}
                />
                <input
                  value={f.notiz ?? ''}
                  onChange={(e) => aendere(f.id, { notiz: e.target.value || undefined })}
                  placeholder={t('fibre.notePlaceholder', 'Note')}
                  className="min-w-0 flex-1 border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                />
                <span className="w-6 shrink-0 text-center text-cp-xs text-cp-text-muted">
                  {ROLLE_KURZ[f.rolle]}
                </span>
                <button
                  type="button"
                  onClick={() => entferne(f.id)}
                  className="shrink-0 border border-cp-border p-1 hover:bg-red-700 hover:text-white"
                  title={t('fibre.remove', 'Remove fibre')}
                >
                  <Icon icon={X} className="h-3 w-3" />
                </button>
              </div>
            ))}
          <button
            type="button"
            onClick={() =>
              onChange([
                ...fasern,
                {
                  id: uuidv4(),
                  position: Math.max(0, ...fasern.map((f) => f.position)) + 1,
                  rolle: 'unbestimmt',
                },
              ])
            }
            className="inline-flex items-center gap-1 bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            <Icon icon={Plus} className="h-3 w-3" />
            {t('fibre.add', 'Add fibre')}
          </button>
        </div>
      )}
    </div>
  )
}
