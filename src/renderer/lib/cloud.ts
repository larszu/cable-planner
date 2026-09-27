// ───────────────────────────────────────────────────────────────────────────
// #871 — Cloud-Projekte: Speichern mit Revisionen, Konflikt, Zusammenfuehren.
//
// OFFLINE-FIRST BLEIBT. Die lokale Datei ist fuehrend, der Server eine Kopie
// mit Geschichte. Nichts hier laeuft, bevor jemand ein Projekt ausdruecklich
// in die Cloud gelegt hat (`project.cloud`), und ohne Netz arbeitet die App
// wie immer weiter; gespeichert wird beim naechsten Versuch.
//
// KONFLIKT. Jedes Speichern nennt die Revision, auf der es beruht. Hat ein
// anderes Geraet dazwischen gespeichert, weist der Server ab (409). Dann wird
// dreiseitig zusammengefuehrt — Basis (die Revision, auf der wir standen),
// unsere Aenderungen, die der anderen — und das Ergebnis als neue Revision
// gespeichert. Geraete, Kabel und Bereiche laufen dabei durch denselben CRDT
// wie die Live-Zusammenarbeit (`ProjectCrdt`): beide Seiten spielen ihre
// Aenderungen gegenueber der Basis in je eine Kopie ein, die Kopien werden
// vereinigt. Was beide an VERSCHIEDENEN Elementen geaendert haben, bleibt
// beides; am selben Element entscheidet Yjs deterministisch fuer eine Seite.
// Uebrige Felder (Metadaten, Etagen …): wer sie gegenueber der Basis geaendert
// hat, gewinnt; haben es beide, gewinnt die lokale Seite.
//
// ZUGANGSDATEN verlassen den Rechner nicht (`stripCredentials`, wie jeder
// andere Ausgang). Beim Zusammenfuehren bekommen die lokalen Geraete ihre
// Zugangsdaten zurueck — sonst loeschte ein Abgleich sie aus der Datei.
// ───────────────────────────────────────────────────────────────────────────
import * as Y from 'yjs'
import { cablePlannerApi } from './bridge'
import { ProjectCrdt, type CrdtProjectSlice } from './crdt/projectCrdt'
import { stripCredentials } from './credentialKeys'
import type { CloudProject, CloudRevision, CloudUsage, SaveInput, ShareLink, TurnCredentials } from './cloudProjectsClient'
import type { IceServerConfig } from './crdt/iceServers'
import type { CablePlannerProject, CloudBinding } from '../types/project'

export class CloudCallError extends Error {
  code: string
  status?: number
  headRev?: number
  constructor(r: { code: string; status?: number; headRev?: number }) {
    super(r.code)
    this.code = r.code
    this.status = r.status
    this.headRev = r.headRev
  }
}

const call = async <T>(server: string, op: string, ...args: unknown[]): Promise<T> => {
  const r = await cablePlannerApi.cloud.call(server, op, args)
  if (r.ok) return r.value as T
  throw new CloudCallError(r)
}

export interface CloudRevisionData {
  projectId: string
  name: string
  rev: number
  headRev: number
  createdAt: string
  data: Record<string, unknown>
}

/** Typisierte Durchreicher auf `cloud:call`. */
export const cloudApi = {
  usage: (s: string) => call<CloudUsage>(s, 'usage'),
  list: (s: string) => call<CloudProject[]>(s, 'list'),
  create: (s: string, name: string, input: SaveInput) => call<CloudProject>(s, 'create', 'cable', name, input),
  save: (s: string, id: string, baseRev: number, input: SaveInput) =>
    call<{ rev: number; unchanged: boolean }>(s, 'save', id, baseRev, input),
  revisions: (s: string, id: string) => call<CloudRevision[]>(s, 'revisions', id),
  revision: (s: string, id: string, rev: number | 'head') => call<CloudRevisionData>(s, 'revision', id, rev),
  restore: (s: string, id: string, rev: number, baseRev: number) => call<{ rev: number }>(s, 'restore', id, rev, baseRev),
  rename: (s: string, id: string, name: string) => call<CloudProject>(s, 'rename', id, name),
  remove: (s: string, id: string) => call<{ ok: true }>(s, 'remove', id),
  links: (s: string, id: string) => call<ShareLink[]>(s, 'links', id),
  createLink: (s: string, id: string, opts: { rev?: number | null; expiresInDays?: number | null }) =>
    call<ShareLink>(s, 'createLink', id, opts),
  revokeLink: (s: string, linkId: string) => call<{ ok: true }>(s, 'revokeLink', linkId),
  turn: (s: string) => call<TurnCredentials>(s, 'turn'),
}

/**
 * #869 — STUN/TURN des eigenen coturn mit den Zugangsdaten des Kontos.
 * Leer, wenn niemand angemeldet ist, der Server keinen TURN kennt oder das
 * Netz fehlt: dann gelten die Defaults von y-webrtc, wie bisher.
 */
export const turnFromAccount = async (server: string): Promise<IceServerConfig[]> => {
  try {
    const r = await cloudApi.turn(server)
    // Eine URL je Eintrag: so fuehrt `IceServerConfig` sie auch aus dem Feld.
    return r.iceServers.flatMap((x) =>
      x.urls.map((urls) => ({ urls, ...(x.username ? { username: x.username, credential: x.credential } : {}) })),
    )
  } catch {
    return []
  }
}

export type CloudApi = typeof cloudApi

/** Was hochgeht: ohne Zugangsdaten, ohne die Verbindung selbst. */
export const cloudPayload = (project: CablePlannerProject): Record<string, unknown> => {
  const { cloud: _binding, ...rest } = project
  void _binding
  return stripCredentials(rest) as unknown as Record<string, unknown>
}

const COLLECTIONS = ['equipment', 'cables', 'locations'] as const

const sliceOf = (p: Partial<CablePlannerProject>): CrdtProjectSlice => ({
  equipment: p.equipment ?? [],
  cables: p.cables ?? [],
  locations: p.locations ?? [],
})

/** Die Aenderungen von `side` gegenueber `base` in einen CRDT einspielen. */
const applyChanges = (crdt: ProjectCrdt, base: CrdtProjectSlice, side: CrdtProjectSlice): void => {
  crdt.transactLocal(() => {
    for (const key of COLLECTIONS) {
      const before = new Map(base[key].map((x) => [x.id, JSON.stringify(x)]))
      const now = new Set(side[key].map((x) => x.id))
      for (const id of before.keys()) {
        if (now.has(id)) continue
        if (key === 'equipment') crdt.removeEquipment(id)
        else if (key === 'cables') crdt.removeCable(id)
        else crdt.removeLocation(id)
      }
      for (const x of side[key]) {
        if (before.get(x.id) === JSON.stringify(x)) continue
        if (key === 'equipment') crdt.upsertEquipment(x as CrdtProjectSlice['equipment'][number])
        else if (key === 'cables') crdt.upsertCable(x as CrdtProjectSlice['cables'][number])
        else crdt.upsertLocation(x as CrdtProjectSlice['locations'][number])
      }
    }
  })
}

/**
 * Dreiseitig zusammenfuehren. `base` ist der Stand, auf dem `local` beruhte;
 * `remote` ist die neueste Revision in der Cloud. Rein: keine Uhr, kein IO.
 */
export const mergeProjects = (
  base: CablePlannerProject,
  local: CablePlannerProject,
  remote: CablePlannerProject,
): CablePlannerProject => {
  const seed = new ProjectCrdt()
  seed.loadFromProject(sliceOf(base))
  const state = seed.encodeState()
  const ours = new ProjectCrdt()
  const theirs = new ProjectCrdt()
  ours.applyUpdate(state)
  theirs.applyUpdate(state)
  // Basis und Gegenseite kamen ohne Zugangsdaten vom Server; mit ihnen saehe
  // jedes lokale Geraet mit Passwort wie eine Aenderung aus.
  applyChanges(ours, sliceOf(base), sliceOf(stripCredentials(local)))
  applyChanges(theirs, sliceOf(base), sliceOf(remote))
  ours.applyUpdate(Y.encodeStateAsUpdate(theirs.doc))
  const merged = ours.toProject()
  for (const c of [seed, ours, theirs]) c.destroy()

  const out: Record<string, unknown> = { ...remote }
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])
  for (const k of keys) {
    if ((COLLECTIONS as readonly string[]).includes(k) || k === 'cloud') continue
    const l = (local as unknown as Record<string, unknown>)[k]
    const b = (base as unknown as Record<string, unknown>)[k]
    if (JSON.stringify(l) !== JSON.stringify(b)) {
      if (l === undefined) delete out[k]
      else out[k] = l
    }
  }
  // Reihenfolge wie lokal, Neues hinten an: die Zeichenflaeche und Listen
  // springen nach einem Abgleich nicht durcheinander.
  const ordered = <T extends { id: string }>(list: T[], order: readonly { id: string }[]): T[] => {
    const pos = new Map(order.map((x, i) => [x.id, i]))
    return [...list].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity))
  }
  const localEq = new Map(local.equipment.map((e) => [e.id, e]))
  const equipment = ordered(merged.equipment, local.equipment).map((e) => {
    const mine = localEq.get(e.id)
    if (!mine || (mine.username === undefined && mine.password === undefined)) return e
    return { ...e, username: mine.username, password: mine.password }
  })
  return {
    ...(out as unknown as CablePlannerProject),
    equipment,
    cables: ordered(merged.cables, local.cables),
    ...(merged.locations.length || local.locations || remote.locations
      ? { locations: ordered(merged.locations, local.locations ?? []) }
      : {}),
    ...(local.cloud ? { cloud: local.cloud } : {}),
  }
}

export interface PushResult {
  binding: CloudBinding
  /** Der Server hatte Neueres; `project` ist das zusammengefuehrte Ergebnis. */
  merged: CablePlannerProject | null
  unchanged: boolean
}

/** Rechnername o. ae. fuer die Revisionsliste — nie mehr als ein Etikett. */
export type DigestFn = (project: CablePlannerProject) => Record<string, unknown> | undefined

/**
 * Speichern. Beim ersten Mal wird das Cloud-Projekt angelegt. Bei einem
 * Konflikt: zusammenfuehren und genau einmal erneut versuchen — ein zweiter
 * Konflikt in derselben Sekunde geht als Fehler an die Oberflaeche.
 */
export const pushToCloud = async (
  api: CloudApi,
  server: string,
  project: CablePlannerProject,
  opts: { device?: string; digest?: DigestFn; now?: () => Date } = {},
): Promise<PushResult> => {
  const now = () => (opts.now ?? (() => new Date()))().toISOString()
  const input = (p: CablePlannerProject): SaveInput => ({ data: cloudPayload(p), digest: opts.digest?.(p), device: opts.device })
  const b = project.cloud
  if (!b || b.server !== server) {
    const created = await api.create(server, project.metadata?.name?.trim() || 'Untitled', input(project))
    return { binding: { server, projectId: created.id, rev: created.headRev, syncedAt: now() }, merged: null, unchanged: false }
  }
  try {
    const r = await api.save(server, b.projectId, b.rev, input(project))
    return { binding: { ...b, rev: r.rev, syncedAt: now() }, merged: null, unchanged: r.unchanged }
  } catch (e) {
    if (!(e instanceof CloudCallError) || e.code !== 'conflict') throw e
    const [base, head] = await Promise.all([
      api.revision(server, b.projectId, b.rev).catch(() => null),
      api.revision(server, b.projectId, 'head'),
    ])
    const remote = head.data as unknown as CablePlannerProject
    // Ist die Basis schon ausgeduennt, gilt „alles ist Aenderung": beide
    // Seiten bleiben, am selben Element gewinnt eine.
    const baseProject = (base?.data ?? { equipment: [], cables: [], locations: [] }) as unknown as CablePlannerProject
    const merged = mergeProjects(baseProject, project, remote)
    const r = await api.save(server, b.projectId, head.rev, { ...input(merged), note: `merged ${b.rev}+${head.rev}` })
    const binding = { ...b, rev: r.rev, syncedAt: now() }
    return { binding, merged: { ...merged, cloud: binding }, unchanged: false }
  }
}

/** Ein Cloud-Projekt als lokales Projekt oeffnen (zweites Geraet). */
export const projectFromCloud = (server: string, r: CloudRevisionData, now = new Date()): CablePlannerProject => ({
  ...(r.data as unknown as CablePlannerProject),
  cloud: { server, projectId: r.projectId, rev: r.rev, syncedAt: now.toISOString() },
})
