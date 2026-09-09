// #413/#471 — Stufe 3+4+5: UI für die Live-Kollaboration im SyncTab.
//
// Bedien-Panel: Modus (BroadcastChannel / WebRTC), Anzeigename, Raumname,
// LAN-Signaling, Start/Stop, Status — plus Presence (wer ist im Raum) und
// eine klare „so treten andere bei"-Anleitung (#471). Logik liegt im
// collabStore + lib/crdt/*; diese Komponente ist Anzeige + Steuerung.

import { useMemo, useState } from 'react'
import {
  useCollabStore,
  type CollabMode,
  type DiscoveredCollabSession,
} from '../../store/collabStore'
import { useProjectStore } from '../../store/projectStore'
import { hasDesktopBridge } from '../../lib/bridge'
import { buildInviteLink } from '../../lib/collabInvite'
import { useTranslation } from '../../lib/i18n'
import { confirmDialog } from '../../lib/confirmDialog'
import { ungueltigeIceZeilen } from '../../lib/crdt/iceServers'
import { PanelHint } from '../shared/PanelHint'

const statusLabel = (
  status: ReturnType<typeof useCollabStore.getState>['status'],
  t: ReturnType<typeof useTranslation>,
): string => {
  switch (status) {
    case 'on':
      return t('collab.status.on', 'Connected — changes are shared live')
    case 'connecting':
      return t('collab.status.connecting', 'Connecting…')
    case 'error':
      return t('collab.status.error', 'Error')
    default:
      return t('collab.status.off', 'Off')
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
  const iceServers = useCollabStore((s) => s.iceServers)
  const setIceServers = useCollabStore((s) => s.setIceServers)
  const start = useCollabStore((s) => s.start)
  const stop = useCollabStore((s) => s.stop)
  const discovered = useCollabStore((s) => s.discovered)
  const discovering = useCollabStore((s) => s.discovering)
  const discover = useCollabStore((s) => s.discover)
  const joinDiscovered = useCollabStore((s) => s.joinDiscovered)

  const [copied, setCopied] = useState(false)
  const active = status === 'on' || status === 'connecting'
  // Verworfene Zeilen benennen statt sie stumm zu schlucken: eine
  // ignorierte Zeile sieht im Feld genauso aus wie eine akzeptierte, und
  // der Nutzer sucht den Fehler dann in coturn statt in seinem Tippfehler.
  const iceFehler = useMemo(() => ungueltigeIceZeilen(iceServers), [iceServers])

  // #516 — Einladungs-Link statt Text-Block: ein klickbarer Link (wie
  // Zoom/Teams), der die App öffnet und Raum/Modus/Signaling/Passwort
  // vorbefüllt + nach Rückfrage beitritt. Raum/Passwort stecken kodiert im
  // Link, eine kurze Kopfzeile gibt Kontext.
  const copyInvite = () => {
    const link = buildInviteLink({ mode, room, signaling, password, host: name })
    const text = `${t('collab.invite.linkHead', 'Join the Cable Planner live session:')}\n${link}`
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
  //
  // Die Rückfrage lief über `window.confirm`. Der UX-Audit führte Punkt 41
  // („keine nativen Dialoge mehr in Komponenten") als erledigt — für diese
  // Stelle stimmte das nicht. Sie ist die einzige, die übrig war, und
  // ausgerechnet die mit dem grössten Schaden: das OK ersetzt den lokalen Plan.
  // `confirmDialog` ist deshalb hier nicht nur konsistenter, sondern trägt das,
  // was `window.confirm` nicht kann — `destructive`, also der rote Knopf.
  const onJoin = async (s: DiscoveredCollabSession): Promise<void> => {
    const p = useProjectStore.getState().project
    const hasLocalPlan =
      (p.equipment?.length ?? 0) > 0 ||
      (p.cables?.length ?? 0) > 0 ||
      (p.locations?.length ?? 0) > 0
    if (
      hasLocalPlan &&
      !(await confirmDialog(
        t('collab.join.replaceTitle', 'Replace your local plan with the host’s plan?'),
        {
          body: t(
            'collab.join.replaceConfirm',
            'Joining loads the host’s plan and replaces your current plan. Continue?',
          ),
          okLabel: t('collab.join.replaceOk', 'Join and replace'),
          destructive: true,
        },
      ))
    ) {
      return
    }
    void joinDiscovered(s)
  }

  return (
    <section className="space-y-3 rounded-cp-control border border-[var(--cp-border)] bg-[var(--cp-surface-2)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-cp-sm font-semibold text-[var(--cp-text)]">
          {t('collab.title', 'Live collaboration (beta)')}
        </h3>
        <span className="flex items-center gap-1.5 text-cp-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: statusColor(status) }}
          />
          {statusLabel(status, t)}
        </span>
      </div>

      <PanelHint
        className="text-cp-xs text-[var(--cp-text-muted)]"
        text={t(
          'collab.desc',
          'Multiple planners edit the same plan in real time. Changes merge without a server (CRDT) — even after a brief disconnect.',
        )}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-cp-xs text-[var(--cp-text-muted)]">
            {t('collab.name', 'Your display name')}
          </span>
          <input
            type="text"
            className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('collab.name.placeholder', 'e.g. Lars')}
          />
        </label>

        <label className="space-y-1">
          <span className="block text-cp-xs text-[var(--cp-text-muted)]">
            {t('collab.mode', 'Mode')}
          </span>
          <select
            className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs disabled:opacity-50"
            value={mode}
            disabled={active}
            onChange={(e) => setMode(e.target.value as CollabMode)}
          >
            <option value="broadcast">
              {t('collab.mode.broadcast', 'This device (multiple windows)')}
            </option>
            <option value="webrtc">
              {t('collab.mode.webrtc', 'Network (LAN/WAN, P2P)')}
            </option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="block text-cp-xs text-[var(--cp-text-muted)]">
            {t('collab.room', 'Room name')}
          </span>
          <input
            type="text"
            className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs disabled:opacity-50"
            value={room}
            disabled={active}
            onChange={(e) => setRoom(e.target.value)}
            placeholder={t('collab.room.placeholder', 'e.g. show-2026')}
          />
        </label>

        {mode === 'webrtc' && (
          <label className="space-y-1">
            <span className="block text-cp-xs text-[var(--cp-text-muted)]">
              {t('collab.signaling', 'Signaling server')}
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
              {t('collab.localOnly', 'Local only (no remote relay, nothing leaves the LAN)')}
            </label>
          </label>
        )}

        {mode === 'webrtc' && (
          <label className="space-y-1">
            <span className="block text-cp-xs text-[var(--cp-text-muted)]">
              {t('collab.password', 'Room password')}
              <span className="text-[var(--cp-text-faint)]"> ({t('collab.optional', 'optional')})</span>
            </span>
            <input
              type="password"
              autoComplete="off"
              className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 text-cp-xs disabled:opacity-50"
              value={password}
              disabled={active}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('collab.password.placeholder', 'encrypts the room')}
            />
          </label>
        )}

        {/* B-37 — STUN/TURN. Ohne eigene Server gelten die y-webrtc-Defaults:
            die genügen im LAN und scheitern zwischen zwei Netzen hinter
            symmetrischem NAT. `docs/self-hosted-relay.md` beschrieb dieses
            Feld, bevor es es gab. */}
        {mode === 'webrtc' && (
          <label className="space-y-1">
            <span className="block text-cp-xs text-[var(--cp-text-muted)]">
              {t('collab.ice', 'STUN/TURN servers')}
              <span className="text-[var(--cp-text-faint)]"> ({t('collab.optional', 'optional')})</span>
            </span>
            <textarea
              rows={2}
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-2 py-1 font-mono text-cp-xs disabled:opacity-50"
              value={iceServers}
              disabled={active}
              onChange={(e) => setIceServers(e.target.value)}
              placeholder={'turn:turn.example.com:3478|benutzer|geheim'}
            />
            <span className="block text-cp-xs text-[var(--cp-text-faint)]">
              {t(
                'collab.ice.hint',
                'One server per line: URL|user|password. Only needed when the other side sits in a different network. The credentials stay on this machine — they are not part of the invite link.',
              )}
            </span>
            {iceFehler.length > 0 && (
              <span className="block text-cp-xs text-[var(--cp-danger)]">
                {t('collab.ice.invalid', 'Not usable:')} {iceFehler.join(' · ')}
              </span>
            )}
          </label>
        )}
      </div>

      {/* #413/#471 — offene Sessions im LAN finden + per Klick beitreten */}
      {!active && (
        <div className="space-y-2 rounded-cp-card border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-cp-xs font-medium text-[var(--cp-text)]">
              {t('collab.discover.title', 'Sessions on the network')}
            </span>
            <button
              type="button"
              onClick={() => void discover()}
              disabled={discovering || !hasDesktopBridge}
              className="rounded-cp-control border border-[var(--cp-border)] bg-[var(--cp-surface-1)] px-2 py-1 text-cp-xs text-[var(--cp-text-secondary)] hover:border-sky-500 hover:text-sky-300 disabled:opacity-50"
            >
              {discovering
                ? t('collab.discover.searching', 'Searching…')
                : t('collab.discover.search', 'Search the network')}
            </button>
          </div>

          <p className="text-[11px] text-[var(--cp-text-muted)]">
            {t(
              'collab.discover.adoptHint',
              'Joining adopts the host’s plan (replaces your current plan).',
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
                    onClick={() => void onJoin(s)}
                    className="shrink-0 rounded-cp-control bg-[var(--cp-accent,#3b82f6)] px-2 py-1 text-cp-xs font-medium text-white hover:opacity-90"
                  >
                    {t('collab.discover.join', 'Join')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-cp-xs text-[var(--cp-text-muted)]">
              {hasDesktopBridge
                ? t(
                    'collab.discover.empty',
                    'No open session found yet. "Search the network" scans the local network for running Cable Planner sessions.',
                  )
                : t('collab.discover.desktopOnly', 'Network search is only available in the desktop app.')}
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
                ? t('collab.peers.aloneTitle', 'Only you in the room')
                : `${peers.length} ${t('collab.peers.inRoom', 'in the room')}`}
            </span>
            <div className="flex -space-x-1.5">
              {peers.slice(0, 8).map((p) => (
                <span
                  key={p.id}
                  title={p.self ? `${p.name} (${t('collab.peers.you', 'you')})` : p.name}
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
                'Others join by using the same room name:',
              )}{' '}
              <code className="rounded bg-[var(--cp-surface-1)] px-1 font-mono text-[var(--cp-text)]">{room}</code>
            </p>
          )}
          <button
            type="button"
            onClick={copyInvite}
            className="rounded border border-[var(--cp-border)] bg-[var(--cp-surface-1)] px-2 py-1 text-cp-xs text-[var(--cp-text-secondary)] hover:border-sky-500 hover:text-sky-300"
          >
            {copied ? t('collab.invite.copied', 'Copied ✓') : t('collab.invite.copy', 'Copy invite')}
          </button>
        </div>
      )}

      {mode === 'webrtc' && !active && (
        <PanelHint
          className="text-cp-xs text-[var(--cp-warning,#f59e0b)]"
          text={t(
            'collab.webrtc.hint',
            'Network mode uses WebRTC + a signaling server to find peers. On a pure LAN, configure your own server if needed.',
          )}
        />
      )}

      {mode === 'webrtc' && !active && !password.trim() && (
        <PanelHint
          className="rounded-cp-control border border-[var(--cp-danger,#ef4444)] bg-[color-mix(in_srgb,var(--cp-danger,#ef4444)_12%,transparent)] px-2 py-1.5 text-cp-xs text-[var(--cp-danger,#ef4444)]"
          text={t(
            'collab.webrtc.noPassword',
            'Without a room password the room is unencrypted: anyone who knows the room name and signaling server (or finds the session on the LAN) can read the entire project. Set a password and share it only with your team.',
          )}
        />
      )}

      {error && (
        <p className="text-cp-xs text-[var(--cp-danger,#ef4444)]">
          {t('collab.error.prefix', 'Error:')} {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {active ? (
          <button
            type="button"
            className="rounded bg-[var(--cp-danger,#ef4444)] px-3 py-1 text-cp-xs font-medium text-white hover:opacity-90"
            onClick={() => stop()}
          >
            {t('collab.stop', 'Leave')}
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-[var(--cp-accent,#3b82f6)] px-3 py-1 text-cp-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            disabled={!room.trim()}
            onClick={() => void start()}
          >
            {t('collab.start', 'Start session')}
          </button>
        )}
      </div>
    </section>
  )
}
