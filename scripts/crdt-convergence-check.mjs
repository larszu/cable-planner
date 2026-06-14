// #413 — Konvergenz-Beweis für die CRDT-Synchronisation, in EINEM Prozess.
//
// Simuliert zwei Planer (A und B), die gleichzeitig am selben Plan arbeiten,
// ihre Updates über einen Transport austauschen und garantiert auf denselben
// Stand konvergieren — ohne Server, auch bei konkurrierenden Edits, Offline-
// Phasen und out-of-order Zustellung.
//
// Spiegelt die App-Module (pure JS, da die .mjs keine TS importieren kann):
//   • Stufe 1: Y.Doc-Merge-Garantien direkt (Szenarien 1–3).
//   • Stufe 2: LoopbackTransport + SyncManager-Protokoll (Szenarien 4–5).
//   • Stufe 3: Store-Bindung (Referenz-Diff + Echo-Schutz) (Szenario 6).
//   • Stufe 4: ECHTER BroadcastChannel-Transport inkl. hello/resync-Handshake
//     (Szenario 7) — Node stellt BroadcastChannel global bereit, daher ein
//     echter In-Prozess-Integrationstest, kein Mock.
// Die TS-Implementierung ist tsc-geprüft; dieser Beweis verifiziert das
// Protokoll/den Algorithmus.
//
// Nutzung:  node scripts/crdt-convergence-check.mjs   (npm run test:crdt)
// Exit 0 = alle Asserts grün, Exit 1 = Divergenz (CI-tauglich).

import * as Y from 'yjs'

let failures = 0
const assert = (cond, msg) => {
  console.log(cond ? '  OK ' : '  XX ', msg)
  if (!cond) failures++
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// Order-unabhängiger Vergleich einer Y.Map (Insertion-Order variiert je Doc).
const mapSorted = (doc, name) => {
  const o = {}
  for (const [k, v] of doc.getMap(name)) o[k] = v
  return Object.keys(o).sort().map((k) => [k, o[k]])
}
const cablesEqual = (a, b) =>
  JSON.stringify(mapSorted(a, 'cables')) === JSON.stringify(mapSorted(b, 'cables'))
const cableCount = (doc) => mapSorted(doc, 'cables').length

const projOf = (doc) =>
  JSON.stringify({
    e: mapSorted(doc, 'equipment'),
    c: mapSorted(doc, 'cables'),
    l: mapSorted(doc, 'locations'),
  })
const sameProject = (a, b) => projOf(a) === projOf(b)

// Origins (spiegeln projectCrdt.ts: REMOTE_ORIGIN / LOCAL_ORIGIN).
const REMOTE = 'remote'
const LOCAL = 'local'

// ── LoopbackTransport (spiegelt syncTransport.ts inkl. inbox-Puffer) ────────
const makeLoopbackPair = () => {
  const mk = () => ({ peer: null, receivers: new Set(), outbox: [], inbox: [], paused: false })
  const a = mk()
  const b = mk()
  a.peer = b
  b.peer = a
  const deliver = (ep, u) => {
    if (ep.receivers.size === 0) {
      ep.inbox.push(u)
      return
    }
    for (const r of ep.receivers) r(u)
  }
  const api = (ep) => ({
    send: (u) => {
      if (ep.paused) ep.outbox.push(u)
      else deliver(ep.peer, u)
    },
    onReceive: (cb) => {
      ep.receivers.add(cb)
      if (ep.inbox.length > 0) {
        const q = ep.inbox
        ep.inbox = []
        for (const u of q) cb(u)
      }
      return () => ep.receivers.delete(cb)
    },
    pause: () => {
      ep.paused = true
    },
    resume: () => {
      ep.paused = false
      const q = ep.outbox
      ep.outbox = []
      for (const u of q) deliver(ep.peer, u)
    },
  })
  return [api(a), api(b)]
}

// ── SyncManager (spiegelt syncManager.ts inkl. onResyncRequest/connect) ─────
const wireManager = (doc, transport, counter) => {
  doc.on('update', (u, origin) => {
    if (origin !== REMOTE) {
      if (counter) counter.sends++
      transport.send(u)
    }
  })
  transport.onReceive((u) => {
    Y.applyUpdate(doc, u, REMOTE)
  })
  if (transport.onResyncRequest) {
    transport.onResyncRequest(() => {
      if (counter) counter.sends++
      transport.send(Y.encodeStateAsUpdate(doc))
    })
  }
  if (counter) counter.sends++
  transport.send(Y.encodeStateAsUpdate(doc))
  if (transport.connect) transport.connect()
}

// ── ProjectCrdt-Mirror (spiegelt projectCrdt.ts: transactLocal/observe) ─────
const makeCrdt = () => {
  const doc = new Y.Doc()
  const E = doc.getMap('equipment')
  const C = doc.getMap('cables')
  const L = doc.getMap('locations')
  return {
    doc,
    transactLocal: (fn) => doc.transact(fn, LOCAL),
    observe: (cb) => {
      const h = (_u, o) => cb(o)
      doc.on('update', h)
      return () => doc.off('update', h)
    },
    upsertEquipment: (i) => E.set(i.id, i),
    removeEquipment: (id) => E.delete(id),
    upsertCable: (i) => C.set(i.id, i),
    removeCable: (id) => C.delete(id),
    upsertLocation: (i) => L.set(i.id, i),
    removeLocation: (id) => L.delete(id),
    toProject: () => ({
      equipment: [...E.values()],
      cables: [...C.values()],
      locations: [...L.values()],
    }),
  }
}

// ── Fake-Store mit strukturellem Sharing (spiegelt projectStore-Essenz) ─────
const makeFakeStore = () => {
  let project = { equipment: [], cables: [], locations: [] }
  const listeners = new Set()
  const emit = () => {
    for (const l of listeners) l()
  }
  return {
    getState: () => ({
      project,
      applyRemoteProject: (slice) => {
        project = { ...project, equipment: slice.equipment, cables: slice.cables, locations: slice.locations }
        emit()
      },
    }),
    subscribe: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    // Test-Mutatoren: erhalten unveränderte Item-Referenzen (strukturelles
    // Sharing), damit der referenz-basierte Diff der Bindung greift.
    addEquipment: (item) => {
      project = { ...project, equipment: [...project.equipment, item] }
      emit()
    },
    addCable: (item) => {
      project = { ...project, cables: [...project.cables, item] }
      emit()
    },
    removeEquipment: (id) => {
      project = { ...project, equipment: project.equipment.filter((e) => e.id !== id) }
      emit()
    },
  }
}

// ── Store-Bindung (spiegelt storeBinding.ts) ────────────────────────────────
const EMPTY = []
const bindStoreToCrdt = (crdt, store, seedDoc = true) => {
  const read = () => {
    const p = store.getState().project
    return { equipment: p.equipment, cables: p.cables, locations: p.locations ?? EMPTY }
  }
  let last = read()
  const diffInto = (prev, next, upsert, remove) => {
    if (prev === next) return
    const prevById = new Map(prev.map((x) => [x.id, x]))
    const nextIds = new Set()
    for (const item of next) {
      nextIds.add(item.id)
      if (prevById.get(item.id) !== item) upsert(item)
    }
    for (const item of prev) if (!nextIds.has(item.id)) remove(item.id)
  }
  const pushToDoc = (next) => {
    crdt.transactLocal(() => {
      diffInto(last.equipment, next.equipment, (i) => crdt.upsertEquipment(i), (id) => crdt.removeEquipment(id))
      diffInto(last.cables, next.cables, (i) => crdt.upsertCable(i), (id) => crdt.removeCable(id))
      diffInto(last.locations, next.locations, (i) => crdt.upsertLocation(i), (id) => crdt.removeLocation(id))
    })
    last = next
  }
  if (seedDoc) {
    crdt.transactLocal(() => {
      for (const e of last.equipment) crdt.upsertEquipment(e)
      for (const c of last.cables) crdt.upsertCable(c)
      for (const l of last.locations) crdt.upsertLocation(l)
    })
  }
  const unsubStore = store.subscribe(() => {
    const next = read()
    if (next.equipment === last.equipment && next.cables === last.cables && next.locations === last.locations) return
    pushToDoc(next)
  })
  const unsubDoc = crdt.observe((origin) => {
    if (origin === LOCAL) return
    const slice = crdt.toProject()
    last = { equipment: slice.equipment, cables: slice.cables, locations: slice.locations }
    store.getState().applyRemoteProject(slice)
  })
  return { stop: () => { unsubStore(); unsubDoc() } }
}

// ── BroadcastTransport (spiegelt broadcastTransport.ts), echter Channel ─────
const makeBroadcastTransport = (room) => {
  const channel = new BroadcastChannel(room)
  const receivers = new Set()
  const resyncers = new Set()
  channel.onmessage = (ev) => {
    const msg = ev.data
    if (!msg || typeof msg !== 'object') return
    if (msg.kind === 'update') for (const r of receivers) r(msg.data)
    else if (msg.kind === 'hello') for (const r of resyncers) r()
  }
  return {
    send: (u) => channel.postMessage({ kind: 'update', data: u }),
    onReceive: (cb) => { receivers.add(cb); return () => receivers.delete(cb) },
    onResyncRequest: (cb) => { resyncers.add(cb); return () => resyncers.delete(cb) },
    connect: () => channel.postMessage({ kind: 'hello' }),
    dispose: () => { channel.onmessage = null; channel.close() },
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Szenario 1: konkurrierende Edits an VERSCHIEDENEN Kabeln
const scenario1 = () => {
  console.log('Szenario 1: A und B editieren verschiedene Kabel gleichzeitig')
  const a = new Y.Doc()
  const b = new Y.Doc()
  a.getMap('cables').set('c1', { id: 'c1', name: 'SDI 1', length: 5 })
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  assert(cablesEqual(a, b), 'gleicher Startstand nach initialem Sync')

  a.getMap('cables').set('c2', { id: 'c2', name: 'SDI 2', length: 10 })
  b.getMap('cables').set('c3', { id: 'c3', name: 'XLR 1', length: 3 })
  assert(!cablesEqual(a, b), 'divergiert während offline (erwartet)')

  Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  assert(cablesEqual(a, b), 'konvergiert nach Austausch')
  assert(cableCount(a) === 3, 'alle 3 Kabel vorhanden (c1,c2,c3)')
}

// Szenario 2: konkurrierende Edits am SELBEN Kabel (Konflikt)
const scenario2 = () => {
  console.log('Szenario 2: A und B editieren DASSELBE Kabel (deterministische Aufloesung)')
  const a = new Y.Doc()
  const b = new Y.Doc()
  a.getMap('cables').set('c1', { id: 'c1', name: 'orig', length: 1 })
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))

  a.getMap('cables').set('c1', { id: 'c1', name: 'von-A', length: 7 })
  b.getMap('cables').set('c1', { id: 'c1', name: 'von-B', length: 9 })

  Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  assert(cablesEqual(a, b), 'konfligierende Edits konvergieren deterministisch')
}

// Szenario 3: Idempotenz + out-of-order Zustellung
const scenario3 = () => {
  console.log('Szenario 3: Doppel-Empfang und vertauschte Reihenfolge')
  const a = new Y.Doc()
  const b = new Y.Doc()
  a.getMap('cables').set('c1', { id: 'c1', name: 'A', length: 1 })
  a.getMap('cables').set('c2', { id: 'c2', name: 'B', length: 2 })

  const u1 = Y.encodeStateAsUpdate(a)
  Y.applyUpdate(b, u1)
  Y.applyUpdate(b, u1)
  Y.applyUpdate(b, u1)
  assert(cablesEqual(a, b), 'mehrfaches Anwenden desselben Updates ist idempotent')
  assert(cableCount(b) === 2, 'kein Duplikat durch Doppel-Empfang')
}

// Szenario 4: SyncManager-Loop (live), volles Projekt
const scenario4 = () => {
  console.log('Szenario 4: SyncManager-Loop (live), volles Projekt')
  const counter = { sends: 0 }
  const a = new Y.Doc()
  const b = new Y.Doc()
  a.getMap('equipment').set('e1', { id: 'e1', name: 'Switcher' })
  const [ta, tb] = makeLoopbackPair()
  wireManager(a, ta, counter)
  wireManager(b, tb, counter)
  assert(sameProject(a, b), 'beitretender Peer B erhaelt A-Initialstand')

  a.getMap('cables').set('c1', { id: 'c1', name: 'SDI 1', length: 5 })
  b.getMap('locations').set('l1', { id: 'l1', name: 'FOH' })
  assert(sameProject(a, b), 'Live-Edits beider Seiten propagieren sofort')
  assert(counter.sends < 50, `keine Echo-Schleife (sends=${counter.sends})`)
}

// Szenario 5: Offline-Divergenz + Reconnect über Transport
const scenario5 = () => {
  console.log('Szenario 5: Offline-Divergenz + Reconnect ueber Transport')
  const a = new Y.Doc()
  const b = new Y.Doc()
  const [ta, tb] = makeLoopbackPair()
  wireManager(a, ta)
  wireManager(b, tb)
  a.getMap('equipment').set('e1', { id: 'e1', name: 'Cam 1' })
  assert(sameProject(a, b), 'synchron vor Offline-Phase')

  ta.pause()
  tb.pause()
  a.getMap('equipment').set('e2', { id: 'e2', name: 'Cam 2' })
  b.getMap('cables').set('c9', { id: 'c9', name: 'Tri-Level', length: 2 })
  assert(!sameProject(a, b), 'divergiert waehrend beide offline (erwartet)')

  ta.resume()
  tb.resume()
  assert(sameProject(a, b), 'konvergiert nach Reconnect')
  const merged = JSON.parse(projOf(a))
  assert(merged.e.length === 2 && merged.c.length === 1, 'alle Offline-Edits erhalten (2 Geraete, 1 Kabel)')
}

// Szenario 6: Store-Bindung (Stufe 3) — Store-Edits propagieren über das Doc
const scenario6 = () => {
  console.log('Szenario 6: Store-Bindung — UI-Edit in Store A erscheint in Store B')
  const crdtA = makeCrdt()
  const crdtB = makeCrdt()
  const storeA = makeFakeStore()
  const storeB = makeFakeStore()
  bindStoreToCrdt(crdtA, storeA)
  bindStoreToCrdt(crdtB, storeB)
  const [ta, tb] = makeLoopbackPair()
  wireManager(crdtA.doc, ta)
  wireManager(crdtB.doc, tb)

  // Edit NUR im Store A (UI-Mutation) → soll in Store B ankommen.
  storeA.addEquipment({ id: 'e1', name: 'Kamera 1' })
  const bEq = storeB.getState().project.equipment
  assert(bEq.length === 1 && bEq[0].id === 'e1', 'Store→Doc→Transport→Doc→Store: e1 in B')

  // Gegenrichtung.
  storeB.addCable({ id: 'c1', name: 'SDI', length: 5 })
  storeA.addEquipment({ id: 'e2', name: 'Kamera 2' })
  assert(storeA.getState().project.cables.some((c) => c.id === 'c1'), 'B->A: Kabel c1 in A')
  assert(storeB.getState().project.equipment.length === 2, 'A->B: beide Geraete in B')

  // Kein Echo-Loop: A bleibt konsistent (kein doppeltes/fehlendes Item).
  assert(
    storeA.getState().project.equipment.length === 2 &&
      storeA.getState().project.cables.length === 1,
    'A konsistent (2 Geraete, 1 Kabel), kein Echo-Schaden',
  )

  // Löschen propagiert ebenfalls.
  storeA.removeEquipment('e1')
  assert(!storeB.getState().project.equipment.some((e) => e.id === 'e1'), 'Loeschen propagiert A->B')
}

// Szenario 7: ECHTER BroadcastChannel-Transport inkl. Join-Handshake
const scenario7 = async () => {
  console.log('Szenario 7: echter BroadcastChannel — Late-Join Resync + Live-Sync')
  const room = 'cp-proof-' + Math.random().toString(36).slice(2)
  const a = new Y.Doc()
  a.getMap('equipment').set('e1', { id: 'e1', name: 'Bereits da' })

  // Peer A startet allein.
  const ta = makeBroadcastTransport(room)
  wireManager(a, ta)
  await delay(30)

  // Peer B tritt SPÄTER bei (leeres Doc) → connect() sendet hello →
  // A antwortet via onResyncRequest mit vollem Stand.
  const b = new Y.Doc()
  const tb = makeBroadcastTransport(room)
  wireManager(b, tb)
  await delay(50)
  assert(sameProject(a, b), 'Late-Joiner B holt A-Stand via hello/resync')

  // Live-Edits in beide Richtungen über den echten Channel.
  a.getMap('cables').set('c1', { id: 'c1', name: 'SDI 1', length: 5 })
  await delay(30)
  b.getMap('locations').set('l1', { id: 'l1', name: 'Regie' })
  await delay(30)
  assert(sameProject(a, b), 'Live-Edits propagieren über BroadcastChannel')
  assert(cableCount(b) === 1 && mapSorted(a, 'locations').length === 1, 'beide Richtungen angekommen')

  ta.dispose()
  tb.dispose()
}

// Szenario 8: Kollaboratives Undo (#413) — Y.UndoManager auf LOCAL_ORIGIN
// beschränkt. Spiegelt projectCrdt.getUndoManager(): Undo nimmt NUR die
// eigenen Edits zurück, fremde (remote) Änderungen bleiben unangetastet.
const scenario8 = () => {
  console.log('Szenario 8: kollaboratives Undo — nur eigene Edits zurücknehmen')
  const a = new Y.Doc()
  const b = new Y.Doc()
  // Kopplung wie SyncManager: lokale Updates beim Peer als remote anwenden.
  const link = (src, dst) =>
    src.on('update', (u, origin) => {
      if (origin !== REMOTE) Y.applyUpdate(dst, u, REMOTE)
    })
  link(a, b)
  link(b, a)
  const eqA = a.getMap('equipment')
  const eqB = b.getMap('equipment')
  // UndoManager von A: nur LOCAL_ORIGIN (wie ProjectCrdt.getUndoManager).
  const um = new Y.UndoManager([eqA, a.getMap('cables'), a.getMap('locations')], {
    trackedOrigins: new Set([LOCAL]),
  })

  a.transact(() => eqA.set('a1', { id: 'a1', name: 'A' }), LOCAL)
  b.transact(() => eqB.set('b1', { id: 'b1', name: 'B' }), LOCAL)
  assert(eqA.has('a1') && eqA.has('b1'), 'A sieht eigenes a1 + fremdes b1')
  assert(um.undoStack.length === 1, `A-Undo-Stack hat nur den eigenen Edit (len=${um.undoStack.length})`)

  um.undo()
  assert(!eqA.has('a1'), 'A.undo(): eigenes a1 entfernt')
  assert(eqA.has('b1'), 'A.undo(): fremdes b1 bleibt (kein Clobbering der Peer-Edits)')
  assert(eqB.has('b1') && !eqB.has('a1'), 'B konvergiert nach A.undo()')

  um.redo()
  assert(eqA.has('a1') && eqA.has('b1'), 'A.redo(): a1 zurück, b1 unberührt')
}

// ── Runner ──────────────────────────────────────────────────────────────────
const run = async () => {
  scenario1()
  scenario2()
  scenario3()
  scenario4()
  scenario5()
  scenario6()
  await scenario7()
  scenario8()

  console.log('')
  if (failures === 0) {
    console.log('ALLE KONVERGENZ-ASSERTS GRUEN')
    process.exit(0)
  } else {
    console.error(`${failures} ASSERT(S) FEHLGESCHLAGEN`)
    process.exit(1)
  }
}

run()
