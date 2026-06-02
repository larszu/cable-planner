import axios, { AxiosError } from 'axios'

const BASE_URL = 'https://api.rentman.net'

const normalize = <T>(value: unknown): T => {
  if (Array.isArray(value)) {
    return value as T
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    if (Array.isArray(record.data)) {
      return record.data as T
    }

    if (Array.isArray(record.results)) {
      return record.results as T
    }

    if (Array.isArray(record.items)) {
      return record.items as T
    }

    if (record.response && typeof record.response === 'object') {
      const nested = record.response as Record<string, unknown>
      if (Array.isArray(nested.data)) {
        return nested.data as T
      }
    }
  }

  return value as T
}

/**
 * v7.9.110 — Convert Axios/Rentman errors into a clean Error with a German
 * user-facing message. Rentman returns JSON like
 * `{ "error": "Validation failed", "details": [{...}] }` on 4xx — we lift
 * the most helpful string out and prefix with the HTTP status so triage
 * via console logs is easier.
 *
 * v7.9.116 — Mehr Diagnostik:
 *  - Console-Log auf JEDEN Error: HTTP-Method + URL + Status + Body
 *    so dass die DevTools-Konsole zeigt welche Rentman-Anfrage failt.
 *  - User-Message enthaelt den HTTP-Method+Pfad damit User sieht ob
 *    der gleiche Endpoint immer failt (= Permission) oder ein
 *    spezifischer (= Route-/Body-Problem).
 *  - 403-Hint ehrlicher: 'entweder Token-Rechte ODER Endpoint falsch
 *    fuer deinen Account' — beides ist moeglich.
 */
const wrapRentmanError = (err: unknown, context: string): Error => {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<unknown>
    const status = ax.response?.status
    const data = ax.response?.data as Record<string, unknown> | undefined
    const reqMethod = ax.config?.method?.toUpperCase() ?? '?'
    const reqUrl = ax.config?.url ?? '?'
    const serverMsg =
      (typeof data?.error === 'string' && data.error) ||
      (typeof data?.message === 'string' && data.message) ||
      (Array.isArray(data?.details) && data.details.length > 0
        ? JSON.stringify(data.details[0])
        : '') ||
      ax.message

    // Console-Log fuer Debugging — sichtbar in den DevTools des
    // Main-Prozesses (Electron-Dev-Mode console). Hilft zu unter-
    // scheiden zwischen 'Endpoint existiert nicht / falsche URL'
    // und 'echtes Permission-Problem'. Body + Response-Data werden NICHT
    // geloggt — sie koennen projekt-/account-Daten enthalten.
    console.error('[rentman]', reqMethod, reqUrl, '->', status, serverMsg)

    const hint =
      status === 401
        ? 'Token ungültig oder abgelaufen — Einstellungen → Rentman prüfen.'
        : status === 403
          ? `403 Forbidden auf ${reqMethod} ${reqUrl}. Entweder fehlen dem Token die Schreibrechte fuer diesen Endpoint, ODER der Endpoint existiert nicht fuer deinen Rentman-Plan (manche Endpoints sind Tarif-abhaengig). Server-Antwort: ${serverMsg}`
          : status === 404
            ? `404 Not Found auf ${reqMethod} ${reqUrl}. Resource gibt's nicht — Projekt-/Equipment-ID falsch oder geloescht, oder Endpoint-Pfad falsch.`
            : status === 422
              ? `422 Validation auf ${reqMethod} ${reqUrl}: ${serverMsg}`
              : status && status >= 500
                ? 'Rentman-Server-Fehler — später erneut versuchen.'
                : `${reqMethod} ${reqUrl}: ${serverMsg}`
    return new Error(`Rentman ${status ?? '??'} (${context}): ${hint}`)
  }
  if (err instanceof Error) return new Error(`${context}: ${err.message}`)
  return new Error(`${context}: ${String(err)}`)
}

/**
 * v7.9.110 — Fixed group-name for items that Cable-Planner exports to a
 * Rentman project. Created on demand (if not present) and reused across
 * exports — so all items from Cable-Planner end up in one well-named
 * group rather than scattered through the project.
 */
const CABLE_PLANNER_GROUP_NAME = 'CablePlanner'

export interface CablePlannerExportResult {
  /** Number of items successfully added to the group. */
  added: number
  /** Items that failed with their error message. */
  failed: Array<{ equipmentId: string; quantity: number; error: string }>
  /** The Rentman equipmentgroup id that received the items. */
  groupId: string | null
  /** True if the group was created during this call (false: reused existing). */
  groupCreated: boolean
  /** Subproject the group lives in. */
  subprojectId: string | null
}

export const createRentmanApiClient = (token: string) => {
  // v7.9.120 — Token-Sanitization. Tokens kommen oft aus Copy-Paste
  // (PDF, Mail, OS-Credential-Store) und enthalten unsichtbare
  // Zeichen: BOM (U+FEFF), Non-Breaking-Space (U+00A0), Control-Chars
  // (U+0000–U+001F), Whitespace am Anfang/Ende, evtl. ein
  // versehentliches 'Bearer ' Prefix. Rentman's API-Gateway antwortet
  // dann mit 403 + 'Invalid key=value pair (missing equal-sign) in
  // Authorization header' — was wir vorher als 'Permission-Problem'
  // missgedeutet haben. Vite-Dev-Proxy sanitisiert schon (siehe
  // vite.config.ts), aber der Electron-Main-Prozess hat das bisher
  // ignoriert.
  // v7.9.121 — STRENGERE Sanitization: keep ONLY printable ASCII
  // (0x21-0x7e = '!' bis '~'). Stripped damit ALLES rausgeht:
  //   - Whitespace (space, tab, newline, NBSP, NBSP-variants)
  //   - Zero-Width-Spaces (U+200B-U+200F)
  //   - Bidirectional-Marks (U+202A-U+202E)
  //   - BOM (U+FEFF) und alles Non-ASCII
  //   - Control-Chars (0x00-0x1f, 0x7f)
  // Tokens sind base64 / hex / JWT-Format — alle in ASCII-printable.
  // Plus: Strippe 'Bearer ' wenn der User es selber eingefuegt hat.
  const rawToken = token ?? ''
  const cleanToken = rawToken
    .replace(/[^!-~]/g, '')
    .replace(/^Bearer\s*/i, '')
  // Diagnose ohne Token-Material: nur melden DASS sanitisiert wurde, keine
  // Prefix/Suffix/Length-Details (die das Brute-Force-Fenster verengen).
  if (rawToken.length !== cleanToken.length || rawToken !== cleanToken.trim()) {
    console.warn('[rentman:auth] Token wurde vor dem Senden bereinigt (unsichtbare Zeichen entfernt).')
  }
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${cleanToken}`,
    },
    timeout: 30000,
  })

  /** Fetch all pages of a paginated Rentman endpoint. */
  const fetchAll = async (path: string): Promise<unknown[]> => {
    const PAGE_SIZE = 300
    const all: unknown[] = []
    let offset = 0
    while (true) {
      const sep = path.includes('?') ? '&' : '?'
      const response = await client.get(`${path}${sep}limit=${PAGE_SIZE}&offset=${offset}`)
      const page = normalize<unknown[]>(response.data)
      all.push(...page)
      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
    return all
  }

  /** Robust id-extractor: Rentman responses sometimes use number ids, sometimes
   *  stringified, sometimes nested in `data`. */
  const pickId = (raw: unknown): string | null => {
    if (raw == null) return null
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
    if (typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>
    const data = (obj.data ?? obj) as Record<string, unknown>
    const id = data.id ?? data.ID ?? data._id
    if (id == null) return null
    return String(id)
  }

  /** v7.9.110 — Subprojects einer Project-ID. Jedes Rentman-Projekt hat
   *  >=1 Subproject (Standard: 'Initial'). Equipment + Groups haengen
   *  immer an einem Subproject. */
  const getProjectSubprojects = async (projectId: string): Promise<unknown[]> => {
    try {
      return await fetchAll(`/projects/${encodeURIComponent(projectId)}/subprojects`)
    } catch (err) {
      throw wrapRentmanError(err, `GET subprojects fuer Projekt ${projectId}`)
    }
  }

  /** v7.9.110 — Liste aller EquipmentGroups in einem Subproject. Wird
   *  genutzt um die 'CablePlanner'-Gruppe nachzuschlagen.
   *
   *  v7.9.117 — Liefert null statt zu werfen, wenn der Endpoint nicht
   *  verfuegbar ist (manche Rentman-Plaene exponieren equipmentgroups
   *  schlicht nicht — typischerweise 403/404). Aufrufer faellt dann auf
   *  Equipment-Add OHNE Gruppen-Bezug zurueck. */
  const getEquipmentGroups = async (
    subprojectId: string,
  ): Promise<unknown[] | null> => {
    try {
      return await fetchAll(
        `/equipmentgroups?subproject=${encodeURIComponent(subprojectId)}`,
      )
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        if (status === 403 || status === 404) {
          console.warn(
            `[rentman] /equipmentgroups nicht verfuegbar (${status}) — fallback auf Equipment-Add ohne Gruppe.`,
          )
          return null
        }
      }
      throw wrapRentmanError(err, `GET equipmentgroups fuer Subproject ${subprojectId}`)
    }
  }

  /** v7.9.110 — Create new equipment group in a subproject.
   *
   *  v7.9.117 — Liefert null bei 403/404 statt zu werfen (siehe
   *  getEquipmentGroups). Aufrufer arbeitet dann gruppenlos weiter. */
  const createEquipmentGroup = async (params: {
    name: string
    subprojectId: string
    order?: number
  }): Promise<{ id: string } | null> => {
    try {
      // v7.9.122 — subprojectId numerisch senden (siehe addEquipmentToGroup).
      const subN = Number(params.subprojectId)
      const subVal = Number.isFinite(subN) && /^[0-9]+$/.test(params.subprojectId)
        ? subN
        : params.subprojectId
      const response = await client.post('/equipmentgroups', {
        name: params.name,
        subproject: subVal,
        ...(typeof params.order === 'number' ? { order: params.order } : {}),
      })
      const id = pickId(response.data)
      if (!id) {
        throw new Error('Rentman lieferte beim Erstellen der Group keine id zurueck.')
      }
      return { id }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        if (status === 403 || status === 404) {
          console.warn(
            `[rentman] POST /equipmentgroups nicht erlaubt (${status}) — fallback auf gruppenlosen Add.`,
          )
          return null
        }
      }
      throw wrapRentmanError(err, `POST equipmentgroups (${params.name})`)
    }
  }

  /** v7.9.110 — Add equipment to a specific group within a project.
   *  Anders als der alte addProjectEquipment, der nur equipment+project+
   *  quantity sendete (was Rentman teilweise mit 422 abwies weil
   *  subproject fehlte), schickt diese Variante ALLE relevanten Refs:
   *  project, subproject, equipmentgroup, equipment, quantity.
   *
   *  v7.9.117 — equipmentGroupId darf null sein wenn der Plan keine
   *  Gruppen erlaubt; das Feld wird dann im Body weggelassen. */
  const addEquipmentToGroup = async (params: {
    projectId: string
    subprojectId: string
    equipmentGroupId: string | null
    equipmentId: string
    quantity: number
  }): Promise<unknown> => {
    try {
      // v7.9.122 — Numerische IDs senden statt Strings. Rentman's
      // OpenAPI-Schema erwartet bei den ID-Feldern integer, nicht
      // string. Vorher sendeten wir {"project":"807",...} — das wird
      // teilweise akzeptiert (subproject-GET), teilweise mit generischem
      // 403 abgelehnt. Mit echten Zahlen ist die Spec definitiv erfuellt.
      // Wenn die ID nicht numerisch ist (sollte nicht passieren), bleibt
      // sie String als Fallback.
      const toNum = (s: string): number | string => {
        const n = Number(s)
        return Number.isFinite(n) && /^[0-9]+$/.test(s) ? n : s
      }
      const body: Record<string, unknown> = {
        project: toNum(params.projectId),
        subproject: toNum(params.subprojectId),
        equipment: toNum(params.equipmentId),
        quantity: params.quantity,
      }
      if (params.equipmentGroupId) body.equipmentgroup = toNum(params.equipmentGroupId)
      const response = await client.post('/projectequipment', body)
      return response.data
    } catch (err) {
      throw wrapRentmanError(
        err,
        `POST projectequipment (equipment=${params.equipmentId}, qty=${params.quantity})`,
      )
    }
  }

  /** v7.9.110 — Top-level export action. Stellt sicher, dass eine
   *  Equipment-Gruppe namens 'CablePlanner' im (ersten/Standard-)
   *  Subproject existiert und fuegt die items hinzu.
   *
   *  Idempotenz: wird die Action mehrfach ausgefuehrt, landen alle items
   *  in derselben 'CablePlanner'-Gruppe (nicht in einer neuen). Wenn
   *  Rentman bereits identische Equipment+Quantity-Eintraege hat, kommen
   *  zusaetzliche dazu — Rentman dedupliziert nicht automatisch.
   *
   *  Fehler-Strategie: ein einzelner failed item bricht NICHT den
   *  gesamten Export ab. Wir sammeln alle Failures und melden sie am
   *  Ende via failed[]. So sieht der User welche items angekommen sind
   *  und welche nicht. */
  const exportEquipmentToCablePlannerGroup = async (
    projectId: string,
    items: Array<{ equipmentId: string; quantity: number }>,
  ): Promise<CablePlannerExportResult> => {
    if (items.length === 0) {
      return { added: 0, failed: [], groupId: null, groupCreated: false, subprojectId: null }
    }

    // 1. Subprojects holen — wir brauchen mindestens eines.
    const subprojectsRaw = await getProjectSubprojects(projectId)
    if (subprojectsRaw.length === 0) {
      throw new Error(`Rentman-Projekt #${projectId} hat keine Subprojects.`)
    }
    // Sortieren nach order (falls vorhanden), dann nach id — erstes ist
    // der Default ("Initial").
    const subprojects = (subprojectsRaw as Array<Record<string, unknown>>).slice().sort((a, b) => {
      const oa = typeof a.order === 'number' ? a.order : 0
      const ob = typeof b.order === 'number' ? b.order : 0
      if (oa !== ob) return oa - ob
      const ia = pickId(a) ?? ''
      const ib = pickId(b) ?? ''
      return ia.localeCompare(ib)
    })
    const subprojectId = pickId(subprojects[0])
    if (!subprojectId) {
      throw new Error(`Rentman-Projekt #${projectId}: Subproject hat keine id.`)
    }

    // 2. CablePlanner-Group finden oder erstellen.
    // v7.9.117 — Wenn der Plan/Token /equipmentgroups nicht erlaubt
    // (Plan-Restriction), faellt getEquipmentGroups + createEquipmentGroup
    // auf null zurueck. Wir adden dann ohne Gruppe — die Items landen
    // im Default-Container des Subprojects. Weniger schoen, aber besser
    // als ueberhaupt nicht zu syncen.
    const existingGroups = await getEquipmentGroups(subprojectId)
    let groupId: string | null = null
    let groupCreated = false
    if (existingGroups !== null) {
      const existingGroup = (existingGroups as Array<Record<string, unknown>>).find(
        (g) => typeof g.name === 'string' && g.name === CABLE_PLANNER_GROUP_NAME,
      )
      if (existingGroup) {
        const id = pickId(existingGroup)
        if (id) groupId = id
      }
      if (!groupId) {
        const maxOrder = (existingGroups as Array<Record<string, unknown>>).reduce(
          (max, g) => (typeof g.order === 'number' && g.order > max ? g.order : max),
          0,
        )
        const created = await createEquipmentGroup({
          name: CABLE_PLANNER_GROUP_NAME,
          subprojectId,
          order: maxOrder + 1,
        })
        if (created) {
          groupId = created.id
          groupCreated = true
        }
      }
    }

    // 3. Items einzeln adden (sequentiell — Rentman rate-limits stark).
    const result: CablePlannerExportResult = {
      added: 0,
      failed: [],
      groupId,
      groupCreated,
      subprojectId,
    }
    for (const item of items) {
      try {
        await addEquipmentToGroup({
          projectId,
          subprojectId,
          // v7.9.117 — null = kein Gruppen-Bezug. addEquipmentToGroup
          // unten laesst das Feld dann aus.
          equipmentGroupId: groupId,
          equipmentId: item.equipmentId,
          quantity: item.quantity,
        })
        result.added++
      } catch (err) {
        result.failed.push({
          equipmentId: item.equipmentId,
          quantity: item.quantity,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return result
  }

  return {
    async getProjects() {
      return fetchAll('/projects')
    },
    async getProjectEquipment(projectId: string) {
      return fetchAll(`/projects/${encodeURIComponent(projectId)}/projectequipment`)
    },
    async getEquipment() {
      return fetchAll('/equipment')
    },
    async getEquipmentFolders() {
      try {
        return await fetchAll('/equipmentfolders')
      } catch (error) {
        // Token may lack permission for equipmentfolders; degrade gracefully.
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          return [] as unknown[]
        }
        throw error
      }
    },
    getProjectSubprojects,
    getEquipmentGroups,
    createEquipmentGroup,
    addEquipmentToGroup,
    exportEquipmentToCablePlannerGroup,
    /**
     * @deprecated v7.9.110 — verwende exportEquipmentToCablePlannerGroup.
     * Diese Methode bleibt aus Kompatibilitaet, routet aber jetzt auf den
     * neuen Pfad (mit subproject + equipmentgroup gesetzt). Davor wurden
     * nur equipment+project+quantity gesendet — Rentman wies das oft mit
     * 422 ab, weshalb Exports lautlos kaputt waren.
     */
    async addProjectEquipment(projectId: string, equipmentId: string, quantity = 1) {
      const result = await exportEquipmentToCablePlannerGroup(projectId, [
        { equipmentId, quantity },
      ])
      if (result.failed.length > 0) {
        throw new Error(result.failed[0].error)
      }
      return { added: result.added, groupId: result.groupId, groupCreated: result.groupCreated }
    },
    /**
     * Upload a file (e.g. an exported PDF plan) and attach it to a Rentman
     * project. Per the Rentman OpenAPI spec, files live under `/files` and
     * the link to the parent item (in our case the project) is expressed via
     * the `item` (id) and `itemtype` ("project") fields.
     *
     * `fileBytes` must be the raw bytes of the file. We send it as
     * multipart/form-data with the conventional `file` field name plus the
     * required `name`, `item` and `itemtype` metadata.
     */
    async addProjectFile(
      projectId: string,
      fileName: string,
      fileBytes: Uint8Array,
      mimeType: string = 'application/pdf',
    ) {
      try {
        const form = new FormData()
        const buf = new Uint8Array(new ArrayBuffer(fileBytes.byteLength))
        buf.set(fileBytes)
        const blob = new Blob([buf], { type: mimeType })
        form.append('file', blob, fileName)
        form.append('name', fileName)
        form.append('item', projectId)
        form.append('itemtype', 'project')
        const response = await client.post('/files', form, {
          maxContentLength: 50 * 1024 * 1024,
          maxBodyLength: 50 * 1024 * 1024,
        })
        return response.data
      } catch (err) {
        throw wrapRentmanError(err, `POST files (project ${projectId})`)
      }
    },
  }
}
