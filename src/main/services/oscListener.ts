/**
 * Der eingehende OSC-Lauscher (E-23).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VIER AUFLAGEN, UND SIE STEHEN ALLE IM CODE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Der Eigentuemer hat den eingehenden Teil unter genau vier Bedingungen
 * erlaubt (E-23, 2026-09-08). Sie sind hier keine Prosa:
 *
 *   1. AUS ALS VORGABE. Dieses Modul startet nichts von selbst; es hat keinen
 *      Aufruf beim Laden. Ein Port, der ungefragt lauscht, ist ein offener
 *      Port auf dem Rechner eines anderen.
 *   2. JE PROJEKT EINGESCHALTET. Der Aufrufer schickt die Konfiguration; es
 *      gibt keine App-weite Einstellung, die ein zweites Projekt miterbt.
 *   3. EINE ADRESSE, DIE DER NUTZER NENNT. `bind()` weist eine leere Adresse
 *      ZURUECK. `0.0.0.0` als Vorgabe waere eine Entscheidung, die niemand
 *      getroffen hat — sie lauscht auf jeder Schnittstelle, auch der im
 *      Kundennetz.
 *   4. SICHTBAR MELDEN, WENN NICHT GEBUNDEN WERDEN KONNTE. Das ist die
 *      wichtigste: ein stiller Nicht-Empfang sieht aus wie „keine Cues", und
 *      das ist die Entwarnung durch die Hintertuer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WAS AUS DEM PAKET GELESEN WIRD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nur die Adresse, und die Laenge dessen, was dahinter steht. Die Argumente
 * zu entziffern hiesse, aus fremden Bytes Zahlen zu machen — und eine falsch
 * gelesene Zahl sieht aus wie eine Messung. Das Lesen steht HIER, unmittelbar
 * neben dem Socket, und nirgends sonst: `leseOscAdresse` und `nutzlastLaenge`
 * sind reine Funktionen ueber `Uint8Array` und damit ohne Netz pruefbar
 * (`tests/oscEmpfang.test.ts`). Eine zweite Fassung im Renderer waere
 * `zwei-rechnungen` mit fremden Bytes — dort kommt ohnehin nie ein Paket an.
 *
 * KEIN ZUSTAND. Dieses Modul fuehrt eine Liste von EMPFANGSMELDUNGEN mit
 * Zeitpunkt und Absender. Es leitet daraus nichts ab, und es hat kein Feld,
 * das „bereit" oder „laeuft" heissen koennte.
 */
import dgram from 'node:dgram'

/**
 * Struktur-gleich mit `renderer/types/showControl.ts` — und bewusst hier noch
 * einmal aufgeschrieben statt importiert: der Hauptprozess baut gegen eine
 * eigene tsconfig (ESM/node16) und darf nicht in den Renderer-Baum
 * hineinreichen. Dieselbe Loesung wie bei `switcherControl/types.ts`, und mit
 * demselben Schutz: `tests/oscEmpfang.test.ts` haelt die Gleichheit fest.
 */
export interface OscEmpfang {
  adresse: string
  empfangenAm: string
  absender: string
  nutzlastBytes: number
}

export interface OscLauscherConfig {
  aktiv: boolean
  adresse: string
  port: number
}

export type LauscherLage = 'aus' | 'lauscht' | 'nicht-gebunden'

export interface LauscherZustand {
  lage: LauscherLage
  grund?: string
  adresse?: string
  port?: number
}

// ─── DAS LESEN DER ADRESSE — UND NUR IHRER ─────────────────────────────────
//
// Ein OSC-Paket traegt hinter der Adresse Typkennungen und Werte; die zu
// entziffern hiesse, aus fremden Bytes ZAHLEN zu machen — und eine falsch
// gelesene Zahl sieht aus wie eine Messung (dieselbe Ueberlegung wie beim
// EDID, Invariante 23). Die Adresse dagegen ist eine Zeichenkette: faellt das
// Lesen daneben, steht dort erkennbarer Unsinn.

/**
 * Die Adresse aus einem OSC-Paket.
 *
 * Beginnt das Paket nicht mit `/`, ist es keine Adresse (ein Bundle beginnt
 * mit `#bundle`), und diese Funktion sagt `undefined` statt zu raten.
 */
export const leseOscAdresse = (paket: Uint8Array): string | undefined => {
  if (paket.length === 0) return undefined
  if (paket[0] !== 0x2f) return undefined // '/'
  let ende = paket.indexOf(0)
  if (ende < 0) ende = paket.length
  let adresse = ''
  for (let i = 0; i < ende; i += 1) {
    const b = paket[i]
    // Nur druckbares ASCII. Ein Steuerzeichen in einer Adresse waere ein
    // Zeichen dafuer, dass hier gar keine steht — und es auf dem Blatt
    // auszugeben hiesse, fremde Bytes in die Anzeige zu lassen.
    if (b < 0x20 || b > 0x7e) return undefined
    adresse += String.fromCharCode(b)
  }
  return adresse
}

/** Wieviele Bytes hinter der Adresse stehen. Ihre LAENGE, nicht ihr Inhalt. */
export const nutzlastLaenge = (paket: Uint8Array, adresse: string): number => {
  const belegt = Math.ceil((adresse.length + 1) / 4) * 4
  return Math.max(0, paket.length - belegt)
}

/**
 * Wieviele Meldungen behalten werden.
 *
 * Eine Grenze und kein unbegrenzter Puffer: ein Pult, das im Sekundentakt
 * sendet, fuellte sonst den Speicher einer Anwendung, die vier Stunden lang
 * offen steht. Die aeltesten fallen heraus — das ist bei einer Mitschrift die
 * richtige Richtung.
 */
const MAX_MELDUNGEN = 200

let socket: dgram.Socket | null = null
let zustand: LauscherZustand = { lage: 'aus' }
let meldungen: OscEmpfang[] = []
let melde: ((z: LauscherZustand, m: OscEmpfang[]) => void) | null = null

/** Wer ueber Aenderungen benachrichtigt wird (die Oberflaeche). */
export const setOscMelder = (fn: ((z: LauscherZustand, m: OscEmpfang[]) => void) | null): void => {
  melde = fn
}

const sagBescheid = () => melde?.(zustand, meldungen)

export const oscZustand = (): LauscherZustand => zustand
export const oscMeldungen = (): OscEmpfang[] => meldungen

/** Alles zurueckdrehen. Auch beim Projektwechsel — Auflage 2. */
export const stopOscListener = (): LauscherZustand => {
  if (socket) {
    try {
      socket.close()
    } catch {
      // Ein Socket, der schon zu ist, ist kein Fehler.
    }
    socket = null
  }
  zustand = { lage: 'aus' }
  sagBescheid()
  return zustand
}

/**
 * Den Lauscher starten.
 *
 * Gibt IMMER einen Zustand zurueck — auch (und gerade) wenn nichts gebunden
 * werden konnte. Der Aufrufer bekommt nie ein stilles `undefined`, aus dem
 * er „laeuft wohl" lesen koennte.
 */
export const startOscListener = (config: OscLauscherConfig): Promise<LauscherZustand> => {
  stopOscListener()
  if (!config.aktiv) return Promise.resolve(zustand)

  // Auflage 3: eine Adresse, die der Nutzer genannt hat.
  const adresse = config.adresse.trim()
  if (!adresse) {
    zustand = {
      lage: 'nicht-gebunden',
      grund:
        'Keine Adresse eingetragen. Gelauscht wird nur auf einer Adresse, die Sie nennen — nicht auf allen Schnittstellen.',
    }
    sagBescheid()
    return Promise.resolve(zustand)
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    zustand = { lage: 'nicht-gebunden', grund: `Port ${config.port} ist keiner.`, adresse }
    sagBescheid()
    return Promise.resolve(zustand)
  }

  return new Promise<LauscherZustand>((fertig) => {
    const s = dgram.createSocket({ type: 'udp4', reuseAddr: false })
    socket = s

    // Auflage 4: sichtbar melden, wenn nicht gebunden werden konnte.
    s.on('error', (err) => {
      zustand = {
        lage: 'nicht-gebunden',
        grund: err.message,
        adresse,
        port: config.port,
      }
      try {
        s.close()
      } catch {
        // schon zu
      }
      if (socket === s) socket = null
      sagBescheid()
      fertig(zustand)
    })

    s.on('message', (buf, rinfo) => {
      const gelesen = leseOscAdresse(new Uint8Array(buf))
      // Ein Paket ohne lesbare Adresse wird MITGESCHRIEBEN und nicht
      // verworfen: „hier kam etwas an, das ich nicht lesen konnte" ist eine
      // Auskunft. Es stillschweigend fallenzulassen hiesse, dem Nutzer eine
      // ruhige Leitung zu zeigen, auf der etwas ankommt.
      const eintrag: OscEmpfang = {
        adresse: gelesen ?? '',
        empfangenAm: new Date().toISOString(),
        absender: `${rinfo.address}:${rinfo.port}`,
        nutzlastBytes: gelesen ? nutzlastLaenge(new Uint8Array(buf), gelesen) : buf.length,
      }
      meldungen = [eintrag, ...meldungen].slice(0, MAX_MELDUNGEN)
      sagBescheid()
    })

    s.on('listening', () => {
      zustand = { lage: 'lauscht', adresse, port: config.port }
      sagBescheid()
      fertig(zustand)
    })

    try {
      s.bind(config.port, adresse)
    } catch (err) {
      zustand = {
        lage: 'nicht-gebunden',
        grund: err instanceof Error ? err.message : String(err),
        adresse,
        port: config.port,
      }
      socket = null
      sagBescheid()
      fertig(zustand)
    }
  })
}

/** Die Mitschrift leeren. Aendert den Zustand des Lauschers nicht. */
export const clearOscMeldungen = (): void => {
  meldungen = []
  sagBescheid()
}
