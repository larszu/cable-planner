// ───────────────────────────────────────────────────────────────────────────
// Wo die Bilddaten liegen, wenn der Plan nur gesichert und nicht gespeichert
// ist (#884).
//
// ─── WARUM EINE ZWEITE ABLAGE ──────────────────────────────────────────────
//
// Die Sicherungskopie des Plans liegt in `localStorage`, und das fasst 5–10
// MB. Zehn heruntergerechnete Fotos füllen das (die Rechnung steht in
// `lib/fotoMasse.ts`). IndexedDB dagegen ist nach Festplatte bemessen —
// Browser geben typischerweise einen Anteil des freien Speichers frei, nicht
// fünf Megabyte.
//
// Die Fotos gehören trotzdem zum Plan und reisen in der Datei mit. Was hier
// liegt, ist ausschliesslich die Kopie für den Fall „Absturz vor dem ersten
// Speichern".
//
// ─── WARUM OHNE BIBLIOTHEK ─────────────────────────────────────────────────
//
// Es sind drei Vorgänge: schreiben, alle lesen, löschen. Eine Bibliothek
// dafür wäre mehr Abhängigkeit als Gewinn, und dieses Repo hat für IndexedDB
// bisher keine.
//
// ─── UND WARUM JEDER FEHLER STILL BLEIBT ───────────────────────────────────
//
// Nicht aus Bequemlichkeit: die Ablage ist eine Bequemlichkeit. Schlägt sie
// fehl (privates Fenster, abgeschalteter Speicher, volle Platte), ist der
// PLAN unversehrt — nur die Bilder kommen nach einem Absturz nicht zurück.
// Eine Fehlermeldung an dieser Stelle bezöge sich auf etwas, das der Benutzer
// nicht beeinflussen kann, und sie käme beim Tippen. Was er beeinflussen
// kann — „speichere die Datei" — sagt ihm die Fussleiste, und zwar an der
// Sicherungskopie.
// ───────────────────────────────────────────────────────────────────────────

const DB_NAME = 'cable-planner'
const DB_VERSION = 1
const LADEN = 'fotos'

const oeffne = (): Promise<IDBDatabase | null> =>
  new Promise((fertig) => {
    try {
      const anfrage = indexedDB.open(DB_NAME, DB_VERSION)
      anfrage.onupgradeneeded = () => {
        const db = anfrage.result
        if (!db.objectStoreNames.contains(LADEN)) db.createObjectStore(LADEN)
      }
      anfrage.onsuccess = () => fertig(anfrage.result)
      anfrage.onerror = () => fertig(null)
      anfrage.onblocked = () => fertig(null)
    } catch {
      fertig(null)
    }
  })

/** Die Bilddaten sichern. Was misslingt, misslingt still — siehe Kopf. */
export const sichereBilder = async (bilder: ReadonlyMap<string, string>): Promise<void> => {
  const db = await oeffne()
  if (!db) return
  await new Promise<void>((fertig) => {
    try {
      const t = db.transaction(LADEN, 'readwrite')
      const laden = t.objectStore(LADEN)
      for (const [id, dataUri] of bilder) laden.put(dataUri, id)
      t.oncomplete = () => fertig()
      t.onerror = () => fertig()
      t.onabort = () => fertig()
    } catch {
      fertig()
    }
  })
  db.close()
}

/** Alle gesicherten Bilder lesen. Leere Karte, wenn es keine gibt. */
export const liesBilder = async (): Promise<Map<string, string>> => {
  const db = await oeffne()
  if (!db) return new Map()
  const aus = await new Promise<Map<string, string>>((fertig) => {
    try {
      const t = db.transaction(LADEN, 'readonly')
      const laden = t.objectStore(LADEN)
      const karte = new Map<string, string>()
      const zeiger = laden.openCursor()
      zeiger.onsuccess = () => {
        const c = zeiger.result
        if (!c) {
          fertig(karte)
          return
        }
        if (typeof c.value === 'string') karte.set(String(c.key), c.value)
        c.continue()
      }
      zeiger.onerror = () => fertig(karte)
    } catch {
      fertig(new Map())
    }
  })
  db.close()
  return aus
}

/**
 * Bilder entfernen, die kein Datensatz mehr nennt.
 *
 * Ohne das wüchse die Ablage mit jedem gelöschten Foto weiter — und zwar
 * unsichtbar, weil niemand in IndexedDB schaut. Sie wird beim Sichern
 * mitgeräumt, statt in einem eigenen Aufräum-Lauf, den jemand vergisst.
 */
export const raeumeBilder = async (behalten: ReadonlySet<string>): Promise<void> => {
  const db = await oeffne()
  if (!db) return
  await new Promise<void>((fertig) => {
    try {
      const t = db.transaction(LADEN, 'readwrite')
      const laden = t.objectStore(LADEN)
      const zeiger = laden.openCursor()
      zeiger.onsuccess = () => {
        const c = zeiger.result
        if (!c) return
        if (!behalten.has(String(c.key))) laden.delete(c.key)
        c.continue()
      }
      t.oncomplete = () => fertig()
      t.onerror = () => fertig()
      t.onabort = () => fertig()
    } catch {
      fertig()
    }
  })
  db.close()
}
