// #413/#471 — Stufe 3+4+5: UI für die Live-Kollaboration im SyncTab.
//
// Bedien-Panel: Modus (BroadcastChannel / WebRTC), Anzeigename, Raumname,
// LAN-Signaling, Start/Stop, Status — plus Presence (wer ist im Raum) und
// eine klare „so treten andere bei"-Anleitung (#471). Logik liegt im
// collabStore + lib/crdt/*; diese Komponente ist Anzeige + Steuerung.

import { useState } from 'react'
import {
  useCollabStore,
  type CollabMode,
  type DiscoveredCollabSession,
} from '../../store/collabStore'
import { useProjectStore } from '../../store/projectStore'
import { hasDesktopBridge } from '../../lib/bridge'
import { buildInviteLink } from '../../lib/collabInvite'
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

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

export const CollabPanel = () => {
  const t = useTranslation()
  const status = useCollabStore((s) => s.status)
  const mode = useCollabStore((s) => s.mode)
  const room = useCollabStore((s) => s.room)
  const name = useCollabStore((s) => s.name)
  const signaling = useCollabStore((s) => s.signaling)
  const password = useCollabStore((s) => s.password)
  const error = useCollabStore((s) => s.error)
  const peers = useCollabStore((s) => s.peers)
  const setMode = useCollabStore((s) => s.setMode)
  const setRoom = useCollabStore((s) => s.setRoom)
  const setName = useCollabStore((s) => s.setName)
  const setSignaling = useCollabStore((s) => s.setSignaling)
  const localOnly = useCollabStore((s) => s.localOnly)
  const setLocalOnly = useCollabStore((s) => s.setLocalOnly)
  const setPassword = useCollabStore((s) => s.setPassword)
  const start = useCollabStore((s) => s.start)
  const stop = useCollabStore((s) => s.stop)
  const discovered = useCollabStore((s) => s.discovered)
  const discovering = useCollabStore((s) => s.discovering)
  const discover = useCollabStore((s) => s.discover)
  const joinDiscovered = useCollabStore((s) => s.joinDiscovered)

  const [copied, setCopied] = useState(false)
  const active = status === 'on' || status === 'connecting'

  // #516 — Einladungs-Link statt Text-Block: ein klickbarer Link (wie
  // Zoom/Teams), der die App öffnet und Raum/Modus/Signaling/Passwort
  // vorbefüllt + nach Rückfrage beitritt. Raum/Passwort stecken kodiert im
  // Link, eine kurze Kopfzeile gibt Kontext.
  const copyInvite = () => {
    const link = buildInviteLink({ mode, room, signaling, password, host: name })
    const text = `${t('collab.invite.linkHead', 'Cable-Planner Live-Session beitreten:')}\n${link}`
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      },
      () => {},
    )
  }

  // Beitreten übernimmt den Plan des Hosts und ersetzt den lokalen — bei
  // vorhandenem lokalem Plan vorher rückfragen, damit keine Arbeit verloren geht.
  const onJoin = (s: DiscoveredCollabSession): void => {
    const p = useProjectStore.getState().project
    const hasLocalPlan =
      (p.equipment?.length ?? 0) > 0 ||
      (p.cables?.length ?? 0) > 0 ||
      (p.locations?.length ?? 0) > 0
    if (
      hasLocalPlan &&
      !window.confirm(
        t(
          'collab.join.replaceConfirm',
          'Beitreten lädt den Plan des Hosts und ersetzt deinen aktuellen Plan. Fortfahren?',
        ),
      )
    ) {
      return
    }
    void joinDiscovered(s)
  }

  return (
    <section className="space-y-3 rounded-cp-control border border-[var(--cp-border)] bg-[var(--cp-surface-2)] p-4">
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
            {t('collab.name', 'Dein Anzeigename')}
          </span>
          <input
            type="text"
            className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('collab.name.placeholder', 'z. B. Lars')}
          />
        </label>

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

        {mode === 'webrtc' && (
          <label className="space-y-1">
            <span className="block text-cp-xs text-[var(--cp-text-muted)]">
              {t('collab.signaling', 'Signaling-Server')}
            </span>
            <input
              type="text"
              className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs disabled:opacity-50"
              value={signaling}
              disabled={active || localOnly}
              onChange={(e) => setSignaling(e.target.value)}
              placeholder="wss://relay.example.com"
            />
            <label className="mt-1 flex items-center gap-2 text-cp-xs text-[var(--cp-text-secondary)]">
              <input
                type="checkbox"
                checked={localOnly}
                disabled={active}
                onChange={(e) => setLocalOnly(e.target.checked)}
              />
              {t('collab.localOnly', 'Nur lokal (kein Remote-Relay, nichts verlässt das LAN)')}
            </label>
          </label>
        )}

        {mode === 'webrtc' && (
          <label className="space-y-1">
            <span className="block text-cp-xs text-[var(--cp-text-muted)]">
              {t('collab.password', 'Raum-Passwort')}
              <span className="text-[var(--cp-text-faint)]"> ({t('collab.optional', 'optional')})</span>
            </span>
            <input
              type="password"
              autoComplete="off"
              className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs disabled:opacity-50"
              value={password}
              disabled={active}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('collab.password.placeholder', 'verschlüsselt den Raum')}
            />
          </label>
        )}
      </div>

      {/* #413/#471 — offene Sessions im LAN finden + per Klick beitreten */}
      {!active && (
        <div className="space-y-2 rounded-cp-card border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-cp-xs font-medium text-[var(--cp-text)]">
              {t('collab.discover.title', 'Sessions im Netzwerk')}
            </span>
            <button
              type="button"
              onClick={() => void discover()}
              disabled={discovering || !hasDesktopBridge}
              className="rounded-cp-control border border-[var(--cp-border)] bg-[var(--cp-surface-1)] px-2 py-1 text-cp-xs text-[var(--cp-text-secondary)] hover:border-sky-500 hover:text-sky-300 disabled:opacity-50"
            >
              {discovering
                ? t('collab.discover.searching', 'Suche läuft…')
                : t('collab.discover.search', 'Im Netzwerk suchen')}
            </button>
          </div>

          <p className="text-[11px] text-[var(--cp-text-muted)]">
            {t(
              'collab.discover.adoptHint',
              'Beitreten übernimmt den Plan des Hosts (ersetzt deinen aktuellen Plan).',
            )}
          </p>

          {discovered.length > 0 ? (
            <ul className="space-y-1">
              {discovered.map((s) => (
                <li
                  key={`${s.room}@${s.address}`}
                  className="flex items-center justify-between gap-2 rounded-cp-control bg-[var(--cp-surface-1)] px-2 py-1"
                >
                  <span className="min-w-0 flex-1 truncate text-cp-xs text-[var(--cp-text)]">
                    <span className="font-medium">{s.project || s.room}</span>
                    {s.host && <span className="text-[var(--cp-text-muted)]"> · {s.host}</span>}
                    <span className="text-[var(--cp-text-faint)]"> · {s.room}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onJoin(s)}
                    className="shrink-0 rounded-cp-control bg-[var(--cp-accent,#3b82f6)] px-2 py-1 text-cp-xs font-medium text-white hover:opacity-90"
                  >
                    {t('collab.discover.join', 'Beitreten')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-cp-xs text-[var(--cp-text-muted)]">
              {hasDesktopBridge
                ? t(
                    'collab.discover.empty',
                    'Noch keine offene Session gefunden. „Im Netzwerk suchen" durchsucht das lokale Netz nach laufenden Cable-Planner-Sessions.',
                  )
                : t('collab.discover.desktopOnly', 'Netzwerk-Suche ist nur in der Desktop-App verfügbar.')}
            </p>
          )}
        </div>
      )}

      {/* #471 — wer ist im Raum + wie treten andere bei */}
      {active && (
        <div className="space-y-2 rounded border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-cp-xs font-medium text-[var(--cp-text)]">
              {peers.length === 1
                ? t('collab.peers.aloneTitle', 'Nur du im Raum')
                : `${peers.length} ${t('collab.peers.inRoom', 'im Raum')}`}
            </span>
            <div className="flex -space-x-1.5">
              {peers.slice(0, 8).map((p) => (
                <span
                  key={p.id}
                  title={p.self ? `${p.name} (${t('collab.peers.you', 'du')})` : p.name}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--cp-surface-3)] text-[11px] font-bold text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {initials(p.name)}
                </span>
              ))}
            </div>
          </div>
          {peers.length === 1 && (
            <p className="text-[11px] text-[var(--cp-text-muted)]">
              {t(
                'collab.peers.aloneHint',
                'Andere treten bei, indem sie denselben Raumnamen verwenden:',
              )}{' '}
              <code className="rounded bg-[var(--cp-surface-1)] px-1 font-mono text-[var(--cp-text)]">{room}</code>
            </p>
          )}
          <button
            type="button"
            onClick={copyInvite}
            className="rounded border border-[var(--cp-border)] bg-[var(--cp-surface-1)] px-2 py-1 text-cp-xs text-[var(--cp-text-secondary)] hover:border-sky-500 hover:text-sky-300"
          >
            {copied ? t('collab.invite.copied', 'Kopiert ✓') : t('collab.invite.copy', 'Einladung kopieren')}
          </button>
        </div>
      )}

      {mode === 'webrtc' && !active && (
        <p className="text-cp-xs text-[var(--cp-warning,#f59e0b)]">
          {t(
            'collab.webrtc.hint',
            'Netzwerk-Modus nutzt WebRTC + einen Signaling-Server zum Finden der Peers. Im reinen LAN einen eigenen Server eintragen (sonst öffentliche y-webrtc-Server).',
          )}
        </p>
      )}

      {mode === 'webrtc' && !active && !password.trim() && (
        <p className="rounded-cp-control border border-[var(--cp-danger,#ef4444)] bg-[color-mix(in_srgb,var(--cp-danger,#ef4444)_12%,transparent)] px-2 py-1.5 text-cp-xs text-[var(--cp-danger,#ef4444)]">
          {t(
            'collab.webrtc.noPassword',
            'Ohne Raum-Passwort ist der Raum unverschlüsselt: jeder, der Raumname und Signaling-Server kennt (oder die Session im LAN findet), kann das gesamte Projekt mitlesen. Setze ein Passwort und teile es nur mit deinem Team.',
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
