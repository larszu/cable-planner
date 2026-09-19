// ───────────────────────────────────────────────────────────────────────────
// WAS IM BROWSER NICHT GEHT — an einer Stelle, und gemessen (#877)
//
// „Klar gekennzeichnet, welche Funktionen nur am Desktop gehen (ATEM,
// Videohub, LAN)."
//
// Die Auskunft gab es bisher nur als Ausnahme IM MOMENT DES SCHEITERNS: wer
// im Browser auf „Verbinden" drueckt, bekommt „ATEM control requires the
// desktop app". Das ist ehrlich und trotzdem die falsche Reihenfolge — auf
// einem iPad am FOH steht dann jemand vor einem Knopf, der nichts tut, und
// weiss erst hinterher, warum.
//
// ─── WARUM DIESE LISTE NICHT DIE ZWEITE WAHRHEIT IST ──────────────────────
//
// Weil `tests/nurDesktop.test.ts` sie gegen `bridge.ts` haelt: jede Domaene,
// deren Web-Rueckfall die Desktop-App verlangt, MUSS hier stehen, und jede
// hier genannte Domaene muss es dort wirklich tun. Wer einen neuen
// Desktop-Weg baut und diese Liste vergisst, wird rot — nicht erst der
// Nutzer, der davorsteht.
//
// Eine Liste, die jemand hinschreibt, ist sonst der Kenntnisstand ihres
// Autors am Tag des Hinschreibens; die siebte Domaene, die in vier Wochen
// dazukommt, faellt hier auf, ohne dass ihr Autor diese Datei kennen muss.
// ───────────────────────────────────────────────────────────────────────────

/** Derselbe Uebersetzer, den  liefert. */
type Uebersetzen = (key: string, fallback?: string) => string

export interface NurDesktop {
  /** Die IPC-Domaene in `bridge.ts` — der Schluessel, an dem der Test prueft. */
  domaene: string
  /** Wie die Funktion im Fenster heisst. */
  name: string
  /** Warum sie einen Desktop braucht. Technisch, nicht entschuldigend. */
  grund: string
}

/**
 * Die Domaenen, die im Browser nicht laufen — mit dem GRUND und nicht nur mit
 * einem Namen.
 *
 * Der Grund ist jedes Mal derselbe in seiner Form: es fehlt ein Zugriff, den
 * eine Seite im Browser nicht hat (ein UDP- oder TCP-Socket, ein lauschender
 * Port, der Schluesselbund des Systems). Das steht da, weil „geht nur am
 * Desktop" sonst wie eine Lizenzgrenze aussieht — und jemand nach einem
 * Schalter sucht, den es nicht gibt.
 */
export function nurDesktop(t: Uebersetzen): NurDesktop[] {
  return [
    {
      domaene: 'atem',
      name: t('desktopOnly.atem', 'ATEM control'),
      grund: t('desktopOnly.atem.why', 'Talks to the mixer over a UDP socket. A browser page cannot open one.'),
    },
    {
      domaene: 'videohub',
      name: t('desktopOnly.videohub', 'Videohub routing'),
      grund: t('desktopOnly.videohub.why', 'Raw TCP to port 9990. A browser can only speak HTTP and WebSocket.'),
    },
    {
      domaene: 'netbox',
      name: t('desktopOnly.netbox', 'NetBox integration'),
      grund: t('desktopOnly.netbox.why', 'Reads a token from the OS keychain and calls a host inside your network.'),
    },
    {
      domaene: 'signaling',
      name: t('desktopOnly.signaling', 'Local signalling server'),
      grund: t('desktopOnly.signaling.why', 'Listens on a port of this machine. A page cannot be a server.'),
    },
    {
      domaene: 'sync',
      name: t('desktopOnly.sync', 'Network sync (LAN)'),
      grund: t('desktopOnly.sync.why', 'Finds the other machines on the LAN over UDP discovery.'),
    },
    {
      domaene: 'mobileShare',
      name: t('desktopOnly.mobileShare', 'Phone access to the plan'),
      grund: t('desktopOnly.mobileShare.why', 'Serves the plan to phones in the hall from this machine — that needs a listening port.'),
    },
    {
      domaene: 'mcp',
      name: t('desktopOnly.mcp', 'MCP server'),
      grund: t('desktopOnly.mcp.why', 'Listens on 127.0.0.1 so an assistant on this machine can read the plan.'),
    },
    {
      domaene: 'tally',
      name: t('desktopOnly.tally', 'Direct path to the Tally-Pi'),
      grund: t('desktopOnly.tally.why', 'Posts the tally map to the Pi. Its server sends no CORS headers, so a page cannot reach it — the file export stays.'),
    },
    {
      domaene: 'switcher',
      name: t('desktopOnly.switcher', 'Switching mixers and routers'),
      grund: t('desktopOnly.switcher.why', 'Sends the actual switch commands and asks Companion. Both need sockets a page does not have.'),
    },
    {
      domaene: 'rentman',
      name: t('desktopOnly.rentman', 'Rentman export'),
      grund: t('desktopOnly.rentman.why', 'Writes the export file through the desktop file path. Reading from Rentman works here.'),
    },
    {
      domaene: 'updater',
      name: t('desktopOnly.updater', 'Update check'),
      grund: t('desktopOnly.updater.why', 'There is nothing to update: the web edition is whatever the server last deployed.'),
    },
    {
      domaene: 'showControl',
      name: t('desktopOnly.showControl', 'Show control (OSC / UDP in)'),
      grund: t('desktopOnly.showControl.why', 'Waits for messages on a UDP port. There is no port to listen on in a browser.'),
    },
  ]
}

/**
 * Laeuft diese Fassung im Browser?
 *
 * `window.cablePlanner` legt das Preload an; ohne es ist der Web-Rueckfall
 * aktiv. Dieselbe Frage stellt `bridge.ts` fuer seine Auswahl — hier wird sie
 * fuer die ANZEIGE gestellt, und deshalb steht sie als eigene Funktion da und
 * nicht als Abschrift der Bedingung.
 */
export const imBrowser = (): boolean =>
  typeof window !== 'undefined' && (window as { cablePlanner?: unknown }).cablePlanner === undefined
