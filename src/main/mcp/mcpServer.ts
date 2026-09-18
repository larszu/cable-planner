// ───────────────────────────────────────────────────────────────────────────
// Der lokale MCP-Server (#872, Stufe 1 — nur lesend).
//
// ═══════════════════════════════════════════════════════════════════════════
// ER LIEST KEINE DATEIEN, ER FRAGT DEN PLAN
// ═══════════════════════════════════════════════════════════════════════════
//
// Die Architektur aus #872 ist verbindlich und hat einen Grund:
//
//     „Der MCP-Server liest und schreibt nie direkt `.cableplan`-Dateien –
//      das würde `healProjectPositions`, Undo und Autosave umgehen und beim
//      nächsten Speichern überschrieben."
//
// Eine Datei auf der Platte ist der Stand des letzten Speicherns. Was auf dem
// Bildschirm steht, ist der Stand von jetzt. Ein Assistent, der den ersten
// meldet, waehrend der Mensch den zweiten sieht, ist schlimmer als keiner.
//
// Deshalb: die Frage kommt hier an, geht per IPC in den Renderer, wird dort
// aus `projectStore` beantwortet (`lib/mcpWerkzeuge.ts`) und kommt zurueck.
//
// ═══════════════════════════════════════════════════════════════════════════
// SICHERHEIT
// ═══════════════════════════════════════════════════════════════════════════
//
// Vier Riegel, und jeder liegt gegen etwas Bestimmtes:
//
//   AUS als Vorgabe      Ein Server, den niemand eingeschaltet hat, laeuft
//                        nicht. Der Schalter steht in den Einstellungen.
//   nur 127.0.0.1        Gebunden an das Loopback-Gerät. Kein Hallen-WLAN,
//                        kein Gast-Netz, keine Frage nach der Firewall.
//   Paarungs-Token       `Authorization: Bearer …`, im Schluesselbund
//                        (`mcpTokenService`). Ohne Token 401, und zwar BEVOR
//                        ein Koerper gelesen wird.
//   Host-Pruefung        Gegen DNS-Rebinding: eine Webseite, die
//                        `http://127.0.0.1:<port>` aufruft, traegt einen
//                        fremden `Host`/`Origin` — der SDK-Transport lehnt
//                        ihn ab (`enableDnsRebindingProtection`).
//
// Was das NICHT schuetzt: einen anderen Prozess auf DEMSELBEN Rechner, der
// das Token aus dem Schluesselbund lesen darf. Wer so weit ist, hat ohnehin
// Zugriff auf die Plandateien.
// ───────────────────────────────────────────────────────────────────────────
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { mcpTokenService } from '../services/credentialsService.js'

/** Wie der Server die Antwort aus dem Renderer holt. */
export type PlanFrager = (
  werkzeug: string,
  args: Record<string, unknown>,
) => Promise<{ daten: Record<string, unknown>; text: string }>

interface McpState {
  server: Server | null
  port: number
  token: string
  /** Wann zuletzt ein Client geantwortet bekam — fuer die Anzeige. */
  letzterZugriff: number | null
  frager: PlanFrager | null
  /**
   * #873 — darf der Client auch SCHREIBEN?
   *
   * Zweiter Schalter, und ausdruecklich nicht derselbe: „Claude darf meinen
   * Plan lesen" und „Claude darf meinen Plan aendern" sind zwei
   * Entscheidungen. Dieselbe Teilung wie beim Handy (BEDARF 109), und aus
   * demselben Grund — wer nur fragen wollte, soll nicht aus Versehen
   * zugestimmt haben, dass geaendert wird.
   */
  schreibenErlaubt: boolean
}

const state: McpState = {
  server: null,
  port: 0,
  token: '',
  letzterZugriff: null,
  frager: null,
  schreibenErlaubt: false,
}

export interface McpStatus {
  running: boolean
  port: number
  /** #873 — ob schreibende Werkzeuge angeboten werden. */
  schreibenErlaubt: boolean
  /** Das Token steht NICHT hier — es geht nur ueber einen eigenen Weg. */
  url: string
  /** Vor weniger als zwei Minuten hat ein Client gefragt. */
  verbunden: boolean
}

const ZWEI_MINUTEN = 2 * 60 * 1000

export const getMcpStatus = (): McpStatus => ({
  running: !!state.server,
  port: state.port,
  schreibenErlaubt: state.schreibenErlaubt,
  url: state.server ? `http://127.0.0.1:${state.port}/mcp` : '',
  verbunden: !!state.letzterZugriff && Date.now() - state.letzterZugriff < ZWEI_MINUTEN,
})

/**
 * #873 — den Schreibmodus setzen. Er wirkt erst beim naechsten Start: die
 * Werkzeugliste steht im Server, und ein Client, der sie schon geholt hat,
 * bekommt sie nicht nachtraeglich geaendert.
 */
export const setMcpSchreibmodus = (an: boolean): void => {
  state.schreibenErlaubt = an === true
}

/** Der Renderer haengt sich hier ein; ohne ihn antwortet kein Werkzeug. */
export const setMcpPlanFrager = (frager: PlanFrager | null): void => {
  state.frager = frager
}

const werkzeugAntwort = async (werkzeug: string, args: Record<string, unknown>) => {
  if (!state.frager) {
    // Kein „leeres Ergebnis": ein Modell liest eine leere Liste als „es gibt
    // nichts" und sagt das dem Menschen weiter.
    return {
      content: [{ type: 'text' as const, text: 'The planner window is not ready to answer yet.' }],
      isError: true,
    }
  }
  const antwort = await state.frager(werkzeug, args)
  state.letzterZugriff = Date.now()
  return {
    content: [{ type: 'text' as const, text: antwort.text }],
    structuredContent: antwort.daten,
  }
}

/**
 * Die Werkzeuge. Alle `readOnlyHint: true` — Stufe 1 schreibt nichts, und das
 * steht im Schema und nicht nur in der Beschreibung.
 */
const baueServer = (): McpServer => {
  const mcp = new McpServer({ name: 'cable-planner', version: '1' })
  const seite = {
    limit: z.number().int().positive().max(200).optional().describe('How many rows to return (default 50).'),
    offset: z.number().int().min(0).optional().describe('How many rows to skip.'),
  }

  mcp.registerTool(
    'list_devices',
    {
      title: 'List devices',
      description: 'Devices in the open plan, with their port counts. Filter by name or category.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().optional().describe('Substring of the device name.'),
        category: z.string().optional().describe('Exact category, as the plan stores it.'),
        ...seite,
      },
    },
    async (args) => werkzeugAntwort('list_devices', args as Record<string, unknown>),
  )

  mcp.registerTool(
    'device_ports',
    {
      title: 'Ports of a device',
      description: 'Every input and output of one device, with connector type and signal standard.',
      annotations: { readOnlyHint: true },
      inputSchema: { deviceId: z.string().describe('Device id or exact device name.') },
    },
    async (args) => werkzeugAntwort('device_ports', args as Record<string, unknown>),
  )

  mcp.registerTool(
    'trace_signal',
    {
      title: 'Trace the signal',
      description:
        'Every path that starts at one device, through patch panels and converters, to where it arrives.',
      annotations: { readOnlyHint: true },
      inputSchema: { deviceId: z.string().describe('Device id or exact device name.') },
    },
    async (args) => werkzeugAntwort('trace_signal', args as Record<string, unknown>),
  )

  mcp.registerTool(
    'list_cables',
    {
      title: 'List cables',
      description: 'Cables in the plan with type, length and both ends. A length nobody entered is null, not 0.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().optional().describe('Substring of name, type, number or either end.'),
        ...seite,
      },
    },
    async (args) => werkzeugAntwort('list_cables', args as Record<string, unknown>),
  )

  mcp.registerTool(
    'plan_findings',
    {
      title: 'Plan check findings',
      description:
        'What the plan check says: open ports, mismatched links, missing figures. The same check the status bar counts.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        severity: z.enum(['error', 'warning', 'info']).optional(),
        limit: seite.limit,
      },
    },
    async (args) => werkzeugAntwort('plan_findings', args as Record<string, unknown>),
  )

  // #873 — die schreibenden Werkzeuge. NUR wenn der zweite Schalter an ist;
  // sonst existieren sie fuer den Client gar nicht. Ein Werkzeug, das immer
  // „nicht erlaubt" antwortet, ist dieselbe Sorte Luege wie ein Knopf, der
  // jedes Mal 403 bekommt (ADR-005).
  if (state.schreibenErlaubt) {
    mcp.registerTool(
      'connect_ports',
      {
        title: 'Connect two ports',
        description:
          'Draw a cable between two ports, through the same store action the canvas uses. Says what would fit if the two ends do not mate.',
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
        inputSchema: {
          fromDeviceId: z.string(),
          fromPortId: z.string(),
          toDeviceId: z.string(),
          toPortId: z.string(),
          name: z.string().optional(),
          type: z.string().optional(),
          length: z.number().optional().describe('Metres. Leave it out rather than guessing.'),
          notes: z.string().optional(),
        },
      },
      async (args) => werkzeugAntwort('connect_ports', args as Record<string, unknown>),
    )

    mcp.registerTool(
      'disconnect_cable',
      {
        title: 'Remove a cable',
        description: 'Delete one cable from the plan. One undo step takes it back.',
        annotations: { readOnlyHint: false, destructiveHint: true },
        inputSchema: { cableId: z.string().describe('Cable id, number or name.') },
      },
      async (args) => werkzeugAntwort('disconnect_cable', args as Record<string, unknown>),
    )

    mcp.registerTool(
      'set_cable',
      {
        title: 'Set cable details',
        description: 'Change name, length, notes, colour or layer of one cable.',
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
        inputSchema: {
          cableId: z.string(),
          name: z.string().optional(),
          length: z.number().optional(),
          notes: z.string().optional(),
          color: z.string().optional(),
          layer: z.string().optional(),
        },
      },
      async (args) => werkzeugAntwort('set_cable', args as Record<string, unknown>),
    )

    mcp.registerTool(
      'rename_device',
      {
        title: 'Rename a device',
        description: 'Give one device a new name. Every list and label follows the name.',
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
        inputSchema: { deviceId: z.string(), name: z.string() },
      },
      async (args) => werkzeugAntwort('rename_device', args as Record<string, unknown>),
    )
  }

  return mcp
}

const unauthorized = (res: ServerResponse) => {
  res.statusCode = 401
  res.setHeader('Content-Type', 'application/json')
  res.end('{"error":"unauthorized"}')
}

/** Traegt die Anfrage das Paarungs-Token? */
const authed = (req: IncomingMessage): boolean => {
  const kopf = req.headers.authorization
  if (typeof kopf !== 'string') return false
  const wert = kopf.replace(/^Bearer\s+/i, '').trim()
  return !!state.token && wert === state.token
}

export const startMcpServer = async (): Promise<McpStatus & { token: string }> => {
  if (state.server) return { ...getMcpStatus(), token: state.token }

  state.token = await mcpTokenService.ensure(() => randomBytes(24).toString('hex'))

  const mcp = baueServer()
  const server = createServer((req, res) => {
    // Erst das Token, dann alles andere: eine Antwort, die ohne Token schon
    // verraet, welche Werkzeuge es gibt, ist eine Auskunft.
    if (!authed(req)) return unauthorized(res)

    const transport = new StreamableHTTPServerTransport({
      // Zustandslos: jede Anfrage steht fuer sich. Der Plan liegt ohnehin im
      // Renderer, es gibt hier nichts zu behalten.
      sessionIdGenerator: undefined,
      enableDnsRebindingProtection: true,
      allowedHosts: [`127.0.0.1:${state.port}`, `localhost:${state.port}`],
    })
    void mcp
      .connect(transport)
      .then(() => transport.handleRequest(req, res))
      .catch(() => {
        if (!res.headersSent) {
          res.statusCode = 500
          res.end('{"error":"mcp failed"}')
        }
      })
  })

  await new Promise<void>((fertig, fehler) => {
    server.once('error', fehler)
    // AUSDRUECKLICH 127.0.0.1 und nicht 0.0.0.0: der Unterschied ist, ob die
    // Halle mitlesen kann.
    server.listen(0, '127.0.0.1', () => fertig())
  })

  const adresse = server.address()
  state.server = server
  state.port = typeof adresse === 'object' && adresse ? adresse.port : 0
  state.letzterZugriff = null
  return { ...getMcpStatus(), token: state.token }
}

export const stopMcpServer = (): void => {
  state.server?.close()
  state.server = null
  state.port = 0
  state.letzterZugriff = null
}

/** Ein neues Paarungs-Token. Der Server muss danach neu gestartet werden. */
export const resetMcpToken = async (): Promise<string> => {
  state.token = await mcpTokenService.reset(() => randomBytes(24).toString('hex'))
  return state.token
}
