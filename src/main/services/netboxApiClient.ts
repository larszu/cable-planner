import axios, { AxiosError } from 'axios'

/**
 * NetBox-REST-API-Client (#597).
 *
 * Anders als Rentman hat NetBox keine feste Cloud-URL — jede Firma betreibt
 * ihre eigene Instanz. Die Basis-URL kommt deshalb bei JEDEM Aufruf aus dem
 * Renderer mit und wird hier (im Main-Prozess) validiert. Der Main-Prozess
 * bleibt damit zustandslos; persistiert wird nur das Token (keytar) und die
 * URL (Renderer-Settings).
 *
 * API-Referenz: `<instanz>/api/schema/swagger-ui/`. Wir nutzen ausschliesslich
 * lesende DCIM-Endpoints:
 *   /api/status/                    — Verbindungstest + Versions-Info
 *   /api/dcim/sites/                — Standorte
 *   /api/dcim/racks/                — Racks (optional nach Site gefiltert)
 *   /api/dcim/devices/              — Geraete
 *   /api/dcim/interfaces/           — Netzwerk-/Signal-Ports
 *   /api/dcim/front-ports/          — Patchfeld vorne
 *   /api/dcim/rear-ports/           — Patchfeld hinten
 *   /api/dcim/console-ports/        — Konsole (DTE)
 *   /api/dcim/console-server-ports/ — Konsolen-Server (DCE)
 *   /api/dcim/power-ports/          — Strom-Eingaenge
 *   /api/dcim/power-outlets/        — Strom-Ausgaenge (PDU)
 *   /api/dcim/cables/               — Verkabelung
 */

/** Roh-Objekt wie es die NetBox-API liefert. Wir typen bewusst schwach und
 *  reichen die Records unveraendert an den Renderer weiter — das Mapping auf
 *  Cable-Planner-Typen passiert dort (`lib/netboxMapping.ts`), damit es
 *  unit-testbar bleibt und der Main-Prozess kein Domaenen-Wissen braucht. */
export type NetboxRecord = Record<string, unknown>

/** Ein vollstaendiger Lese-Snapshot fuer Site- oder Rack-Import. */
export interface NetboxSnapshot {
  scope: 'site' | 'rack'
  scopeId: number
  scopeName: string
  /** Site-Name — bei Rack-Scope die Site, in der das Rack steht. */
  siteName: string
  racks: NetboxRecord[]
  devices: NetboxRecord[]
  /** Alle Geraete-Komponenten, gebuendelt nach NetBox-Komponententyp. Der
   *  Key ist der NetBox-`object_type` ohne Prefix (`interface`, `frontport`,
   *  …), damit `a_terminations[].object_type` direkt darauf zeigt. */
  components: Record<string, NetboxRecord[]>
  cables: NetboxRecord[]
  /** Von der Instanz gemeldete NetBox-Version (aus /api/status/). */
  netboxVersion: string
}

/** Component-Endpoints → NetBox-`object_type`-Suffix. Die Reihenfolge
 *  bestimmt auch die Port-Reihenfolge am importierten Geraet. */
export const NETBOX_COMPONENT_ENDPOINTS: Array<{ path: string; objectType: string }> = [
  { path: 'dcim/interfaces', objectType: 'interface' },
  { path: 'dcim/front-ports', objectType: 'frontport' },
  { path: 'dcim/rear-ports', objectType: 'rearport' },
  { path: 'dcim/console-ports', objectType: 'consoleport' },
  { path: 'dcim/console-server-ports', objectType: 'consoleserverport' },
  { path: 'dcim/power-ports', objectType: 'powerport' },
  { path: 'dcim/power-outlets', objectType: 'poweroutlet' },
]

/**
 * Normalisiert und validiert die vom User eingetragene Instanz-URL.
 *
 * Erlaubt sind ausschliesslich http/https. Ein angehaengtes `/api` (oder
 * `/api/schema/swagger-ui/`, was User gerne aus der Browser-Adresszeile
 * kopieren) wird abgeschnitten, ebenso Trailing-Slashes. Wirft bei allem
 * anderen — die Validierung passiert bewusst hier im Main-Prozess, nicht
 * im Renderer.
 */
export const normalizeNetboxBaseUrl = (raw: string): string => {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) {
    throw new Error('Keine NetBox-URL konfiguriert — Einstellungen → Integrationen → NetBox.')
  }
  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    throw new Error(`Ungültige NetBox-URL: "${trimmed}"`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`NetBox-URL muss http oder https sein (war "${parsed.protocol}").`)
  }
  // Query/Hash sind bei einer Basis-URL immer ein Copy-Paste-Unfall.
  parsed.search = ''
  parsed.hash = ''
  // `/api`, `/api/`, `/api/schema/swagger-ui/` → Instanz-Root.
  const path = parsed.pathname.replace(/\/+$/, '')
  parsed.pathname = path.replace(/\/api(\/.*)?$/i, '')
  return parsed.toString().replace(/\/+$/, '')
}

/** Uebersetzt Axios-/NetBox-Fehler in eine sprechende deutsche Meldung. */
const wrapNetboxError = (err: unknown, context: string): Error => {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<unknown>
    const status = ax.response?.status
    const data = ax.response?.data as Record<string, unknown> | undefined
    const serverMsg =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.error === 'string' && data.error) ||
      ax.message
    const reqUrl = ax.config?.url ?? '?'
    // Nur Status + Pfad loggen — Response-Bodies koennen Infrastruktur-
    // Daten der Instanz enthalten und gehoeren nicht ins Log.
    console.error('[netbox]', ax.config?.method?.toUpperCase() ?? '?', reqUrl, '->', status ?? 'network')

    if (!ax.response) {
      return new Error(
        `NetBox nicht erreichbar (${context}): ${ax.message}. URL, VPN/Netzwerk und Zertifikat prüfen.`,
      )
    }
    const hint =
      status === 401 || status === 403
        ? 'Token ungültig oder ohne Leserechte — Einstellungen → Integrationen → NetBox prüfen.'
        : status === 404
          ? `Endpoint ${reqUrl} existiert auf dieser Instanz nicht. Ist die URL wirklich die NetBox-Basis-URL?`
          : status && status >= 500
            ? 'NetBox-Server-Fehler — später erneut versuchen.'
            : serverMsg
    return new Error(`NetBox ${status} (${context}): ${hint}`)
  }
  if (err instanceof Error) return new Error(`${context}: ${err.message}`)
  return new Error(`${context}: ${String(err)}`)
}

/** Wie viele Objekte pro Seite. NetBox deckelt `limit` serverseitig
 *  (MAX_PAGE_SIZE, Default 1000) — 250 ist ein sicherer Mittelweg. */
const PAGE_SIZE = 250
/** Obergrenze gegen Endlos-Paginierung bei einer kaputten Instanz. */
const MAX_PAGES = 200
/** Wie viele `device_id=`-Parameter pro Component-Request. Haelt die URL
 *  unter den ueblichen 8-KB-Limits von nginx/gunicorn. */
const DEVICE_ID_BATCH = 50

export const createNetboxApiClient = (rawBaseUrl: string, token: string) => {
  const baseUrl = normalizeNetboxBaseUrl(rawBaseUrl)
  // Token-Sanitization analog Rentman: Copy-Paste schleppt gerne BOM,
  // NBSP, Zero-Width-Spaces oder ein 'Token '-Prefix mit ein. NetBox-
  // Tokens sind 40-stellige Hex-Strings — reines ASCII-printable.
  const cleanToken = (token ?? '').replace(/[^!-~]/g, '').replace(/^Token\s*/i, '')

  const client = axios.create({
    baseURL: `${baseUrl}/api/`,
    headers: {
      Authorization: `Token ${cleanToken}`,
      Accept: 'application/json',
    },
    timeout: 30000,
  })

  /** Holt alle Seiten eines paginierten NetBox-Endpoints. NetBox antwortet
   *  mit `{count, next, previous, results}`; wir paginieren ueber
   *  limit/offset statt `next` zu folgen, damit eine hinter einem Reverse-
   *  Proxy falsch gesetzte `next`-URL (interner Hostname!) uns nicht aus
   *  der konfigurierten Basis-URL herauswirft. */
  const fetchAll = async (path: string, params: string[] = []): Promise<NetboxRecord[]> => {
    const all: NetboxRecord[] = []
    for (let page = 0; page < MAX_PAGES; page++) {
      const query = [...params, `limit=${PAGE_SIZE}`, `offset=${page * PAGE_SIZE}`].join('&')
      const response = await client.get(`${path}/?${query}`)
      const body = response.data as { results?: unknown; count?: number } | unknown[]
      const results = Array.isArray(body)
        ? body
        : Array.isArray((body as { results?: unknown }).results)
          ? ((body as { results: unknown[] }).results)
          : []
      all.push(...(results as NetboxRecord[]))
      if (results.length < PAGE_SIZE) return all
    }
    console.warn(`[netbox] ${path}: Seitenlimit (${MAX_PAGES}) erreicht — Ergebnis evtl. unvollständig.`)
    return all
  }

  /** Component-Endpoint fuer eine Geraeteliste, in `device_id`-Baetchen. */
  const fetchComponentsForDevices = async (
    path: string,
    deviceIds: number[],
  ): Promise<NetboxRecord[]> => {
    const out: NetboxRecord[] = []
    for (let i = 0; i < deviceIds.length; i += DEVICE_ID_BATCH) {
      const batch = deviceIds.slice(i, i + DEVICE_ID_BATCH)
      const params = batch.map((id) => `device_id=${encodeURIComponent(String(id))}`)
      out.push(...(await fetchAll(path, params)))
    }
    return out
  }

  const getStatus = async (): Promise<NetboxRecord> => {
    try {
      const response = await client.get('status/')
      return (response.data ?? {}) as NetboxRecord
    } catch (err) {
      throw wrapNetboxError(err, 'GET /api/status/')
    }
  }

  const numericId = (record: NetboxRecord): number | null => {
    const id = record.id
    return typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : null
  }

  const textField = (record: NetboxRecord | undefined, key: string): string => {
    const value = record?.[key]
    return typeof value === 'string' ? value : ''
  }

  return {
    baseUrl,

    /** Verbindungstest: /api/status/ liefert Version + Plugin-Liste und
     *  verlangt (bei nicht-oeffentlichen Instanzen) ein gueltiges Token. */
    async testConnection(): Promise<{ ok: boolean; message: string; version?: string }> {
      const status = await getStatus()
      const version = textField(status, 'netbox-version') || textField(status, 'netbox_version')
      // Ein zweiter, token-pflichtiger Read stellt sicher, dass wir nicht nur
      // eine anonym lesbare Statusseite erwischt haben.
      try {
        await client.get('dcim/sites/?limit=1')
      } catch (err) {
        throw wrapNetboxError(err, 'GET /api/dcim/sites/')
      }
      return {
        ok: true,
        message: version
          ? `Verbindung OK — NetBox ${version} unter ${baseUrl}.`
          : `Verbindung OK — ${baseUrl}.`,
        version: version || undefined,
      }
    },

    async getSites(): Promise<NetboxRecord[]> {
      try {
        return await fetchAll('dcim/sites')
      } catch (err) {
        throw wrapNetboxError(err, 'GET /api/dcim/sites/')
      }
    },

    async getRacks(siteId?: number): Promise<NetboxRecord[]> {
      try {
        const params = typeof siteId === 'number' ? [`site_id=${encodeURIComponent(String(siteId))}`] : []
        return await fetchAll('dcim/racks', params)
      } catch (err) {
        throw wrapNetboxError(err, 'GET /api/dcim/racks/')
      }
    },

    /**
     * Liest alles, was fuer einen Import gebraucht wird, in einem Rutsch:
     * Racks, Geraete, alle Geraete-Komponenten und die Kabel.
     *
     * Kabel werden IMMER ueber die Site geholt (ein Rack gehoert genau zu
     * einer Site) und erst im Renderer auf die importierten Geraete
     * eingeschraenkt. Grund: der `rack_id`-Filter auf /dcim/cables/ ist
     * nicht in allen NetBox-Versionen vorhanden, `site_id` schon.
     */
    async fetchSnapshot(scope: 'site' | 'rack', scopeId: number): Promise<NetboxSnapshot> {
      if (!Number.isInteger(scopeId) || scopeId <= 0) {
        throw new Error(`Ungültige NetBox-ID: ${String(scopeId)}`)
      }
      const status = await getStatus()
      const netboxVersion =
        textField(status, 'netbox-version') || textField(status, 'netbox_version')

      let siteId: number
      let scopeName: string
      let siteName: string
      let racks: NetboxRecord[]

      try {
        if (scope === 'site') {
          const site = (await client.get(`dcim/sites/${scopeId}/`)).data as NetboxRecord
          siteId = numericId(site) ?? scopeId
          scopeName = textField(site, 'name') || `Site ${scopeId}`
          siteName = scopeName
          racks = await fetchAll('dcim/racks', [`site_id=${siteId}`])
        } else {
          const rack = (await client.get(`dcim/racks/${scopeId}/`)).data as NetboxRecord
          const site = (rack.site ?? {}) as NetboxRecord
          const resolvedSiteId = numericId(site)
          if (resolvedSiteId === null) {
            throw new Error(`Rack #${scopeId} hat keine Site — Import nicht möglich.`)
          }
          siteId = resolvedSiteId
          scopeName = textField(rack, 'name') || `Rack ${scopeId}`
          siteName = textField(site, 'name') || `Site ${siteId}`
          racks = [rack]
        }
      } catch (err) {
        throw wrapNetboxError(err, `GET ${scope} #${scopeId}`)
      }

      try {
        const deviceFilter =
          scope === 'site' ? [`site_id=${siteId}`] : [`rack_id=${scopeId}`]
        const devices = await fetchAll('dcim/devices', deviceFilter)
        const deviceIds = devices
          .map((d) => numericId(d))
          .filter((id): id is number => id !== null)

        const components: Record<string, NetboxRecord[]> = {}
        for (const { path, objectType } of NETBOX_COMPONENT_ENDPOINTS) {
          components[objectType] =
            deviceIds.length > 0 ? await fetchComponentsForDevices(path, deviceIds) : []
        }

        const cables = await fetchAll('dcim/cables', [`site_id=${siteId}`])

        return {
          scope,
          scopeId,
          scopeName,
          siteName,
          racks,
          devices,
          components,
          cables,
          netboxVersion,
        }
      } catch (err) {
        throw wrapNetboxError(err, `Snapshot ${scope} #${scopeId}`)
      }
    },
  }
}

export type NetboxApiClient = ReturnType<typeof createNetboxApiClient>
