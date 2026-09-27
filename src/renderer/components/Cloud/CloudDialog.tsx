import { useEffect, useState } from 'react'
import { ModalShell } from '../shared/ModalShell'
import { Button } from '../shared/Button'
import { PanelHint } from '../shared/PanelHint'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useDeviceLibraryStore } from '../../store/deviceLibraryStore'
import { effectiveServer } from '../../lib/deviceLibraryUrl'
import { format, useTranslation } from '../../lib/i18n'
import { confirmDialog } from '../../lib/confirmDialog'
import { downloadBlob } from '../../lib/downloadBlob'
import { CloudCallError, cloudApi, projectFromCloud } from '../../lib/cloud'
import { syncCloudNow } from '../../lib/cloudAutoSync'
import type { CloudProject, CloudRevision, ShareLink } from '../../lib/cloudProjectsClient'

/**
 * #871 — Cloud-Projekt: in die Cloud legen, Revisionen, wiederherstellen,
 * auf einem zweiten Geraet oeffnen, loeschen.
 *
 * Alles hier ist freiwillig. Solange niemand „In die Cloud legen" drueckt,
 * verlaesst kein Plan den Rechner.
 */
export const CloudDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.cloudDialog.open)
  const close = useUiStore((s) => s.closeCloudDialog)
  const server = effectiveServer(useSettingsStore((s) => s.deviceLibraryUrl))
  const session = useDeviceLibraryStore((s) => s.session)
  const refreshSession = useDeviceLibraryStore((s) => s.refreshSession)
  const binding = useProjectStore((s) => s.project.cloud)
  const [projects, setProjects] = useState<CloudProject[]>([])
  const [revisions, setRevisions] = useState<CloudRevision[]>([])
  const [links, setLinks] = useState<ShareLink[]>([])
  const [expiry, setExpiry] = useState<number | null>(null)
  const [followNewest, setFollowNewest] = useState(true)
  const [copied, setCopied] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const host = (() => {
    try {
      return new URL(server).host
    } catch {
      return server
    }
  })()

  const errorText = (e: unknown): string => {
    const code = e instanceof CloudCallError ? e.code : 'server'
    const texts: Record<string, string> = {
      'not-signed-in': t('cloud.err.signedOut', 'Not signed in. Sign in under Settings → Device library.'),
      offline: t('cloud.err.offline', 'No connection to the server. Your file is saved locally as always.'),
      'rate-limited': t('cloud.err.rateLimited', 'Too many saves in a short time. Try again in a few minutes.'),
      'project-too-large': t('cloud.err.tooLarge', 'The plan is larger than the server accepts per revision.'),
      'quota-exceeded': t('cloud.err.quota', 'Your cloud storage is full. Delete old projects to make room.'),
      'not-found': t('cloud.err.notFound', 'This cloud project no longer exists.'),
      conflict: t('cloud.err.conflict', 'Someone saved at the same moment. Try again.'),
    }
    return texts[code] ?? format(t('cloud.err.server', 'The server answered with an error ({code}).'), { code })
  }

  useEffect(() => {
    if (open) void refreshSession(server)
  }, [open, server, refreshSession])
  const closeDialog = () => {
    setError('')
    setNotice('')
    close()
  }

  // Neu laden, wenn der Dialog aufgeht, die Anmeldung steht, sich die
  // Verbindung aendert oder eine Aktion fertig ist (`tick`).
  const [tick, setTick] = useState(0)
  const [loadError, setLoadError] = useState<unknown>(null)
  const boundId = binding && binding.server === server ? binding.projectId : null
  useEffect(() => {
    if (!open || session !== 'signed-in') return
    let live = true
    void (async () => {
      try {
        const list = await cloudApi.list(server)
        const revs = boundId ? await cloudApi.revisions(server, boundId) : []
        const ls = boundId ? await cloudApi.links(server, boundId) : []
        if (!live) return
        setProjects(list)
        setRevisions(revs)
        setLinks(ls)
        setLoadError(null)
      } catch (e) {
        if (live) setLoadError(e)
      }
    })()
    return () => {
      live = false
    }
  }, [open, session, server, boundId, tick])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      setTick((n) => n + 1)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const saveNow = () =>
    run(async () => {
      const r = await syncCloudNow(server)
      setNotice(
        r.merged
          ? format(t('cloud.merged', 'Another device had saved in between. Both changes were merged into revision {rev}.'), { rev: r.binding.rev })
          : format(t('cloud.saved', 'Saved as revision {rev}.'), { rev: r.binding.rev }),
      )
    })

  const restore = (rev: number) =>
    run(async () => {
      const b = useProjectStore.getState().project.cloud
      if (!b) return
      const ok = await confirmDialog(
        format(t('cloud.restore.confirm', 'Restore revision {rev}? It becomes the newest revision; nothing is lost.'), { rev }),
      )
      if (!ok) return
      const r = await cloudApi.restore(server, b.projectId, rev, b.rev)
      const head = await cloudApi.revision(server, b.projectId, 'head')
      useProjectStore.getState().applyCloudProject({ ...projectFromCloud(server, head), cloud: { ...b, rev: r.rev, syncedAt: new Date().toISOString() } })
      setNotice(format(t('cloud.restored', 'Revision {rev} restored.'), { rev }))
    })

  const openProject = (p: CloudProject) =>
    run(async () => {
      const ok = await confirmDialog(
        t('cloud.open.confirm', 'Open this cloud project? Save the current plan first if you still need it.'),
      )
      if (!ok) return
      const head = await cloudApi.revision(server, p.id, 'head')
      useProjectStore.getState().loadProject(projectFromCloud(server, head))
      closeDialog()
    })

  const download = (p: CloudProject) =>
    run(async () => {
      const head = await cloudApi.revision(server, p.id, 'head')
      downloadBlob(`${p.name}.cableplan`, JSON.stringify(head.data, null, 2), 'application/json')
    })

  // #870 — Lese-Link. Er zeigt ohne Konto genau diesen Plan; vorgegeben
  // folgt er der neuesten Revision, damit „derselbe Link" aktuell bleibt.
  const createLink = () =>
    run(async () => {
      const b = useProjectStore.getState().project.cloud
      if (!b) return
      const l = await cloudApi.createLink(server, b.projectId, { rev: followNewest ? null : b.rev, expiresInDays: expiry })
      await copy(l)
    })

  const copy = async (l: ShareLink) => {
    try {
      await navigator.clipboard.writeText(l.url)
      setCopied(l.id)
    } catch {
      setCopied('')
    }
  }

  const revokeLink = (l: ShareLink) =>
    run(async () => {
      const ok = await confirmDialog(t('cloud.link.revoke.confirm', 'Revoke this link? Anyone who has it can no longer open the plan.'))
      if (ok) await cloudApi.revokeLink(server, l.id)
    })

  const disconnect = () => useProjectStore.getState().setCloudBinding(undefined)

  const removeFromCloud = () =>
    run(async () => {
      const b = useProjectStore.getState().project.cloud
      if (!b) return
      const ok = await confirmDialog(
        t('cloud.delete.confirm', 'Delete this project from the cloud, with all revisions and share links? Your local file stays.'),
      )
      if (!ok) return
      await cloudApi.remove(server, b.projectId)
      disconnect()
    })

  const dateText = (iso: string) => {
    const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
  }
  const bound = !!binding && binding.server === server
  const others = projects.filter((p) => p.id !== binding?.projectId)

  return (
    <ModalShell open={open} onClose={closeDialog} title={t('cloud.title', 'Cloud')} maxWidth="2xl">
      <div className="flex flex-col gap-4 text-sm">
        <PanelHint
          text={format(
            t(
              'cloud.intro',
              'Optional. Your file stays the master copy; {host} keeps a copy with revisions, encrypted at rest. Credentials are removed before upload.',
            ),
            { host },
          )}
        />
        {!error && loadError !== null && <p className="border border-cp-danger px-2 py-1 text-cp-danger" role="alert">{errorText(loadError)}</p>}
        {error && <p className="border border-cp-danger px-2 py-1 text-cp-danger" role="alert">{error}</p>}
        {notice && <p className="border border-cp-accent px-2 py-1 text-cp-text" role="status">{notice}</p>}
        {session !== 'signed-in' ? (
          <p className="text-cp-text-secondary">
            {t('cloud.signIn', 'Cloud projects use your device library account. Sign in under Settings → Device library.')}
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold text-cp-text">{t('cloud.thisProject', 'This project')}</h3>
              {!bound ? (
                <div className="flex items-center gap-2">
                  <Button variant="primary" disabled={busy} onClick={() => void saveNow()}>
                    {t('cloud.put', 'Put this project in the cloud')}
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-cp-text-secondary">
                    {format(t('cloud.status', 'Revision {rev}, last saved {time}. Changes are saved to the cloud automatically.'), {
                      rev: binding.rev,
                      time: dateText(binding.syncedAt),
                    })}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" disabled={busy} onClick={() => void saveNow()}>
                      {t('cloud.saveNow', 'Save to cloud now')}
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={disconnect}>
                      {t('cloud.disconnect', 'Stop syncing')}
                    </Button>
                    <Button variant="danger" disabled={busy} onClick={() => void removeFromCloud()}>
                      {t('cloud.delete', 'Delete from cloud')}
                    </Button>
                  </div>
                  <h4 className="mt-2 font-semibold text-cp-text">{t('cloud.revisions', 'Revisions')}</h4>
                  <ul className="flex max-h-48 flex-col gap-1 overflow-auto">
                    {revisions.map((r) => (
                      <li key={r.rev} className="flex items-center justify-between gap-2 border-b border-cp-border-muted py-1">
                        <span>
                          {format(t('cloud.revision.row', 'Revision {rev} · {time} · {device}'), {
                            rev: r.rev,
                            time: dateText(r.createdAt),
                            device: r.device || '–',
                          })}
                          {r.note && <span className="text-cp-text-muted"> · {r.note}</span>}
                        </span>
                        {r.rev !== binding.rev && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void restore(r.rev)}>
                            {t('cloud.restore', 'Restore')}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            {bound && (
              <section className="flex flex-col gap-2">
                <h3 className="font-semibold text-cp-text">{t('cloud.link.title', 'Share link')}</h3>
                <p className="border border-cp-warn px-2 py-1 text-cp-text">
                  {t(
                    'cloud.link.warning',
                    'The plan leaves this computer: anyone with the link can read it in the browser, without an account. Credentials are not included.',
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={followNewest} onChange={(e) => setFollowNewest(e.target.checked)} />
                    {t('cloud.link.follow', 'Always show the newest revision')}
                  </label>
                  <label className="flex items-center gap-1">
                    {t('cloud.link.expiry', 'Expires')}
                    <select
                      value={expiry ?? ''}
                      onChange={(e) => setExpiry(e.target.value ? Number(e.target.value) : null)}
                      className="border border-cp-border bg-cp-surface-2 px-1 py-0.5"
                    >
                      <option value="">{t('cloud.link.never', 'never')}</option>
                      {[7, 30, 90].map((d) => (
                        <option key={d} value={d}>
                          {format(t('cloud.link.days', 'after {n} days'), { n: d })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button variant="primary" disabled={busy} onClick={() => void createLink()}>
                    {t('cloud.link.create', 'Create link and copy')}
                  </Button>
                </div>
                <ul className="flex flex-col gap-1">
                  {links.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 border-b border-cp-border-muted py-1">
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-cp-xs">{l.url}</span>
                        <span className="text-cp-text-muted">
                          {format(t('cloud.link.row', '{what} · opened {n}× · {expiry}'), {
                            what: l.rev === null ? t('cloud.link.newest', 'newest revision') : format(t('cloud.link.fixed', 'revision {rev}'), { rev: l.rev }),
                            n: l.opens,
                            expiry: l.expiresAt
                              ? format(t('cloud.link.until', 'until {time}'), { time: dateText(l.expiresAt) })
                              : t('cloud.link.noExpiry', 'no expiry'),
                          })}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button size="sm" variant="secondary" onClick={() => void copy(l)}>
                          {copied === l.id ? t('cloud.link.copied', 'Copied') : t('cloud.link.copy', 'Copy')}
                        </Button>
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => void revokeLink(l)}>
                          {t('cloud.link.revoke', 'Revoke')}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="flex flex-col gap-2">
              <h3 className="font-semibold text-cp-text">{t('cloud.others', 'Your cloud projects')}</h3>
              {others.length === 0 && <p className="text-cp-text-muted">{t('cloud.none', 'None.')}</p>}
              <ul className="flex flex-col gap-1">
                {others.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 border-b border-cp-border-muted py-1">
                    <span>
                      {format(t('cloud.project.row', '{name} · revision {rev} · {time}'), {
                        name: p.name,
                        rev: p.headRev,
                        time: dateText(p.updatedAt),
                      })}
                    </span>
                    <span className="flex gap-1">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void openProject(p)}>
                        {t('cloud.open', 'Open')}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void download(p)}>
                        {t('cloud.download', 'Download .cableplan')}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </ModalShell>
  )
}
