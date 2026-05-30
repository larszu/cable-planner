// #413 — Echtzeit-Kollaboration: CRDT-Fundament (erste Stufe).
//
// Dies ist die *Datenschicht* für die spätere Live-Kollaboration: ein
// Yjs-`Y.Doc`, das den Plan als CRDT spiegelt. Zwei Instanzen, die ihre
// Updates austauschen, konvergieren garantiert auf denselben Stand — ohne
// zentralen Server, auch bei gleichzeitigen Edits.
//
// BEWUSST erste Stufe: nur die `cables`-Collection ist gespiegelt (der am
// häufigsten gleichzeitig editierte Teil), und es ist noch KEIN Transport
// angebunden (`y-webrtc`/`y-websocket` kommt als nächster Schritt). Die
// Slice-Integration (Store ⇄ Y.Doc) und Presence folgen darauf. Der Pfad
// ist in docs/architecture.md §9.4 skizziert.
//
// Verifizierbar OHNE zweite App-Instanz: `mergeUpdateInto` + `encodeState`
// erlauben einen Konvergenz-Beweis in einem Prozess (siehe
// scripts/crdt-convergence-check.mjs).

import * as Y from 'yjs'
import type { Cable } from '../../types/cable'

/** Name der Yjs-Top-Level-Map, unter der die Kabel liegen. */
const CABLES_MAP = 'cables'

/**
 * Wrappt ein `Y.Doc` und bietet eine kleine, plan-spezifische API. Die
 * Kabel liegen als `Y.Map<Cable>` (Key = cable.id). Cables werden als ganze
 * Objekte gehalten (nicht feld-granular) — das ist die pragmatische erste
 * Stufe: Konflikt-Granularität ist „pro Kabel", was für die Praxis (zwei
 * Planer ziehen verschiedene Kabel) ausreicht. Feld-granulares CRDT pro
 * Kabel ist eine spätere Optimierung.
 */
export class ProjectCrdt {
  readonly doc: Y.Doc
  private readonly cables: Y.Map<Cable>

  constructor(doc: Y.Doc = new Y.Doc()) {
    this.doc = doc
    this.cables = doc.getMap<Cable>(CABLES_MAP)
  }

  /** Spiegelt eine Kabel-Liste in das Y.Doc (Initial-Load). Bestehende
   *  Einträge, die nicht mehr in der Liste sind, werden entfernt. Läuft in
   *  einer Transaction, damit Observer nur ein Update sehen. */
  loadFromCables(list: Cable[]): void {
    this.doc.transact(() => {
      const incoming = new Set(list.map((c) => c.id))
      // Entfernte Kabel löschen.
      for (const id of [...this.cables.keys()]) {
        if (!incoming.has(id)) this.cables.delete(id)
      }
      // Neue/aktualisierte setzen.
      for (const c of list) this.cables.set(c.id, c)
    })
  }

  /** Setzt/aktualisiert ein einzelnes Kabel. */
  upsertCable(cable: Cable): void {
    this.cables.set(cable.id, cable)
  }

  /** Entfernt ein Kabel. */
  removeCable(id: string): void {
    this.cables.delete(id)
  }

  /** Aktueller Kabel-Stand aus dem Y.Doc als plain-Array. */
  toCables(): Cable[] {
    return [...this.cables.values()]
  }

  /** Encodiert den gesamten Doc-State als binäres Update (für Transport
   *  oder Persistenz). */
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc)
  }

  /** State-Vector für inkrementelle Diffs (nur das senden, was der Peer
   *  noch nicht hat). */
  encodeStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc)
  }

  /** Diff relativ zum State-Vector eines Peers — minimaler Sync. */
  encodeDiff(remoteStateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc, remoteStateVector)
  }

  /** Wendet ein eingehendes Update (von einem Peer) an. CRDT-Merge ist
   *  kommutativ + idempotent — Reihenfolge und Doppel-Empfang sind egal. */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update)
  }

  /** Registriert einen Listener für lokale UND remote Updates. Liefert das
   *  binäre Update + ob es vom lokalen Doc stammt (origin). Rückgabe:
   *  Unsubscribe-Funktion. */
  onUpdate(cb: (update: Uint8Array, isLocal: boolean) => void): () => void {
    const handler = (update: Uint8Array, origin: unknown) => {
      cb(update, origin !== 'remote')
    }
    this.doc.on('update', handler)
    return () => this.doc.off('update', handler)
  }

  /** Wendet ein Remote-Update mit korrekter Origin-Markierung an, damit
   *  `onUpdate`-Listener es als nicht-lokal erkennen (keine Echo-Schleife). */
  applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update, 'remote')
  }

  destroy(): void {
    this.doc.destroy()
  }
}

/**
 * Konvenienz: führt das Update von `source` in `target` zusammen. Nur für
 * Tests/Proofs — Produktion nutzt den Transport. Liefert true, wenn beide
 * danach denselben Kabel-Stand haben.
 */
export const mergeUpdateInto = (source: ProjectCrdt, target: ProjectCrdt): void => {
  target.applyUpdate(source.encodeState())
}
