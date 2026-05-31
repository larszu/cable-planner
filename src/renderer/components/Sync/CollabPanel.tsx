// #413 — Stufe 3+4: UI für die Live-Kollaboration im SyncTab.
//
// Schlankes Bedien-Panel: Modus (BroadcastChannel / WebRTC), Raumname,
// Start/Stop, Status. Die eigentliche Logik liegt im collabStore +
// lib/crdt/* — diese Komponente ist nur Anzeige + Steuerung.

import { useCollabStore, type CollabMode } from '../../store/collabStore'
import { useTranslation } from '../../lib/i18n'

const statusLabel = (
  status: ReturnType<typeof useCollabStore.getState>['status'],
  t: ReturnType<typeof useTranslation>,
): string => {
  switch (status) {
    case 'on':
      return t('collab.status.on', 'Verbunden — Änderungen werden live geteilt')
    case 'connecting':
      return t('collab.status.connecting', 'Verbinde…')
    case 'error':
      return t('collab.status.error', 'Fehler')
    default:
      return t('collab.status.off', 'Aus')
  }
}

const statusColor = (status: string): string => {
  if (status === 'on') return 'var(--cp-success, #22c55e)'
  if (status === 'connecting') return 'var(--cp-warning, #f59e0b)'
  if (status === 'error') return 'var(--cp-danger, #ef4444)'
  return 'var(--cp-text-muted, #94a3b8)'
}

export const CollabPanel = () => {
  const t = useTranslation()
  const status = useCollabStore((s) => s.status)
  const mode = useCollabStore((s) => s.mode)
  const room = useCollabStore((s) => s.room)
  const error = useCollabStore((s) => s.error)
  const setMode = useCollabStore((s) => s.setMode)
  const setRoom = useCollabStore((s) => s.setRoom)
  const start = useCollabStore((s) => s.start)
  const stop = useCollabStore((s) => s.stop)

  const active = status === 'on' || status === 'connecting'

  return (
    <section className="space-y-3 rounded-md border border-[var(--cp-border)] bg-[var(--cp-surface-2)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-cp-sm font-semibold text-[var(--cp-text)]">
          {t('collab.title', 'Live-Kollaboration (Beta)')}
        </h3>
        <span className="flex items-center gap-1.5 text-cp-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: statusColor(status) }}
          />
          {statusLabel(status, t)}
        </span>
      </div>

      <p className="text-cp-xs text-[var(--cp-text-muted)]">
        {t(
          'collab.desc',
          'Mehrere Planer bearbeiten denselben Plan in Echtzeit. Änderungen werden ohne Server zusammengeführt (CRDT) — auch nach kurzzeitiger Trennung.',
        )}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-cp-xs text-[var(--cp-text-muted)]">
            {t('collab.mode', 'Modus')}
          </span>
          <select
            className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs disabled:opacity-50"
            value={mode}
            disabled={active}
            onChange={(e) => setMode(e.target.value as CollabMode)}
          >
            <option value="broadcast">
              {t('collab.mode.broadcast', 'Dieses Gerät (mehrere Fenster)')}
            </option>
            <option value="webrtc">
              {t('collab.mode.webrtc', 'Netzwerk (LAN/WAN, P2P)')}
            </option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-cp-xs text-[var(--cp-text-muted)]">
            {t('collab.room', 'Raumname')}
          </span>
          <input
            type="text"
            className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs disabled:opacity-50"
            value={room}
            disabled={active}
            onChange={(e) => setRoom(e.target.value)}
            placeholder={t('collab.room.placeholder', 'z. B. show-2026')}
          />
        </label>
      </div>

      {mode === 'webrtc' && (
        <p className="text-cp-xs text-[var(--cp-warning,#f59e0b)]">
          {t(
            'collab.webrtc.hint',
            'Netzwerk-Modus nutzt WebRTC + einen Signaling-Server zum Finden der Peers. Im reinen LAN ggf. eigenen Server konfigurieren.',
          )}
        </p>
      )}

      {error && (
        <p className="text-cp-xs text-[var(--cp-danger,#ef4444)]">
          {t('collab.error.prefix', 'Fehler:')} {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {active ? (
          <button
            type="button"
            className="rounded bg-[var(--cp-danger,#ef4444)] px-3 py-1 text-cp-xs font-medium text-white hover:opacity-90"
            onClick={() => stop()}
          >
            {t('collab.stop', 'Verlassen')}
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-[var(--cp-accent,#3b82f6)] px-3 py-1 text-cp-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            disabled={!room.trim()}
            onClick={() => void start()}
          >
            {t('collab.start', 'Session starten')}
          </button>
        )}
      </div>
    </section>
  )
}
