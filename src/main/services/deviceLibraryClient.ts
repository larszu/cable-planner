// ───────────────────────────────────────────────────────────────────────────
// Geraetebibliothek (devices.zumpelars.de) — Client, identisch in jedem Planner
//
// Quelle: larszu/av-device-library, `clients/deviceLibraryClient.ts`. In
// cable-, light-, multicam-, inventory-planner und Broadcast-intercom liegt
// dieselbe Datei; Abweichungen gehoeren zuerst in die Quelle.
//
// Die Bibliothek ist nur mit Konto lesbar. Ein Planner meldet sich mit
// E-Mail oder Benutzername und Passwort an und bekommt ein Token (Better
// Auth `bearer`, Header `set-auth-token`). Zwei-Faktor: die Zwischenstufe
// kommt als `x-auth-challenge` und geht mit dem Code zurueck — ein Cookie
// koennte ein Planner von einem fremden Ursprung weder lesen noch senden.
//
// Rein: nur `fetch`, keine Speicherung. Wo das Token liegt (Schluesselbund,
// localStorage im Web-Build), entscheidet der Planner.
// ───────────────────────────────────────────────────────────────────────────

/** Der Server, den jeder Release-Build ab Werk anspricht. */
export const DEFAULT_DEVICE_LIBRARY_URL = 'https://devices.zumpelars.de'

export type LibraryPlanner = 'cable' | 'light' | 'multicam' | 'inventory' | 'intercom'

export interface LibraryUser {
  id: string
  email: string
  username: string
  emailVerified: boolean
}

export type SignInResult =
  | { kind: 'ok'; token: string; user: LibraryUser }
  | { kind: 'second-factor'; challenge: string }
  | { kind: 'error'; code: LibraryErrorCode; message?: string }

/** Die Faelle, die eine Oberflaeche unterscheiden muss. */
export type LibraryErrorCode =
  | 'wrong-credentials'
  | 'email-not-verified'
  /** Die Community-Richtlinien haben sich geaendert: auf der Website neu annehmen. */
  | 'guidelines-outdated'
  /** Hersteller und Modell gibt es schon in der Bibliothek. */
  | 'exists'
  | 'wrong-code'
  | 'rate-limited'
  | 'not-signed-in'
  | 'offline'
  | 'server'

export interface SyncDevice {
  slug: string
  version: number
  seq: number
  /** Verborgen oder ohne Ansicht fuer diesen Planner: lokal entfernen. */
  removed: boolean
  status: 'verified' | 'confirmed' | 'unconfirmed' | 'disputed'
  confirmations: number
  core: {
    manufacturer: string
    model: string
    category: string
    description?: string
    sourceUrl?: string
    powerWatts?: number
    rackUnits?: number
    weightKg?: number
  }
  /** Das Objekt im Bibliotheksformat DIESES Planners; null bei `removed`. */
  facet: Record<string, unknown> | null
}

export interface SyncResponse {
  format: 'avplan-device-sync'
  version: 1
  planner: LibraryPlanner
  latestSeq: number
  devices: SyncDevice[]
}

export interface ProposalCore {
  manufacturer: string
  model: string
  category: string
  description?: string
  /** Pflicht, wenn keine PDF hochgeladen wird: Link aufs Herstellerdatenblatt. */
  sourceUrl: string
  powerWatts?: number
  rackUnits?: number
  weightKg?: number
}

export class LibraryError extends Error {
  code: LibraryErrorCode
  status: number
  constructor(code: LibraryErrorCode, status = 0, message?: string) {
    super(message ?? code)
    this.code = code
    this.status = status
  }
}

const basis = (server: string) => server.replace(/\/+$/, '')

async function anfrage(
  server: string,
  pfad: string,
  init: { method?: 'GET' | 'POST'; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Response> {
  try {
    return await fetch(`${basis(server)}${pfad}`, {
      method: init.method ?? 'GET',
      // Nie Cookies: der Planner ist ein fremder Ursprung, das Token ist
      // die einzige Sitzung.
      credentials: 'omit',
      headers: {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(init.method === 'POST' ? { 'x-requested-with': 'device-library' } : {}),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new LibraryError('offline')
  }
}

async function jsonOderNull(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

const fehlerAus = (res: Response, body: Record<string, unknown> | null): LibraryErrorCode => {
  const code = String(body?.code ?? body?.error ?? '')
  if (res.status === 429) return 'rate-limited'
  // Better Auth antwortet in GROSSBUCHSTABEN, die Bibliotheks-Routen klein.
  if (code === 'EMAIL_NOT_VERIFIED' || code === 'email-not-verified') return 'email-not-verified'
  if (code === 'guidelines-outdated') return 'guidelines-outdated'
  if (res.status === 409 || code === 'exists') return 'exists'
  if (code === 'INVALID_CODE' || code === 'INVALID_TWO_FACTOR_CODE' || code === 'OTP_HAS_EXPIRED') return 'wrong-code'
  if (res.status === 401 && code === 'not-signed-in') return 'not-signed-in'
  if (res.status === 401 || res.status === 403) return 'wrong-credentials'
  return 'server'
}

const nutzerAus = (u: Record<string, unknown>): LibraryUser => ({
  id: String(u.id),
  email: String(u.email),
  username: String(u.displayUsername ?? u.username ?? u.name ?? ''),
  emailVerified: !!u.emailVerified,
})

/** `kennung` mit @ gilt als E-Mail, sonst als Benutzername. */
export async function signIn(server: string, kennung: string, passwort: string): Promise<SignInResult> {
  const perMail = kennung.includes('@')
  let res: Response
  try {
    res = await anfrage(server, perMail ? '/api/auth/sign-in/email' : '/api/auth/sign-in/username', {
      method: 'POST',
      body: perMail ? { email: kennung.trim(), password: passwort } : { username: kennung.trim(), password: passwort },
    })
  } catch (e) {
    return { kind: 'error', code: e instanceof LibraryError ? e.code : 'offline' }
  }
  const body = await jsonOderNull(res)
  if (!res.ok) return { kind: 'error', code: fehlerAus(res, body), message: String(body?.message ?? '') }
  if (body?.twoFactorRedirect) {
    const challenge = res.headers.get('x-auth-challenge')
    return challenge ? { kind: 'second-factor', challenge } : { kind: 'error', code: 'server' }
  }
  const token = res.headers.get('set-auth-token')
  if (!token || !body?.user) return { kind: 'error', code: 'server' }
  return { kind: 'ok', token, user: nutzerAus(body.user as Record<string, unknown>) }
}

/** Zweiter Schritt bei aktivierter Zwei-Faktor-Anmeldung (Code aus der App). */
export async function verifySecondFactor(server: string, challenge: string, code: string): Promise<SignInResult> {
  let res: Response
  try {
    res = await anfrage(server, '/api/auth/two-factor/verify-totp', {
      method: 'POST',
      body: { code: code.replace(/\s/g, '') },
      headers: { 'x-auth-challenge': challenge },
    })
  } catch (e) {
    return { kind: 'error', code: e instanceof LibraryError ? e.code : 'offline' }
  }
  const body = await jsonOderNull(res)
  if (!res.ok) return { kind: 'error', code: fehlerAus(res, body) }
  const token = res.headers.get('set-auth-token')
  if (!token || !body?.user) return { kind: 'error', code: 'server' }
  return { kind: 'ok', token, user: nutzerAus(body.user as Record<string, unknown>) }
}

/** `null` = Token abgelaufen oder widerrufen: neu anmelden. */
export async function currentUser(server: string, token: string): Promise<LibraryUser | null> {
  const res = await anfrage(server, '/api/auth/get-session', { token })
  if (!res.ok) return null
  const body = await jsonOderNull(res)
  return body?.user ? nutzerAus(body.user as Record<string, unknown>) : null
}

export async function signOut(server: string, token: string): Promise<void> {
  try {
    await anfrage(server, '/api/auth/sign-out', { method: 'POST', token, body: {} })
  } catch {
    // Abmelden geht auch offline: der Planner vergisst das Token trotzdem.
  }
}

/** Alles nach `after` (0 = alles). Den `latestSeq` der Antwort merkt sich der Planner. */
export async function sync(server: string, token: string, planner: LibraryPlanner, after: number): Promise<SyncResponse> {
  const res = await anfrage(server, `/api/sync?planner=${planner}&after=${Math.max(0, Math.floor(after))}`, { token })
  const body = await jsonOderNull(res)
  if (!res.ok) throw new LibraryError(fehlerAus(res, body), res.status)
  if (body?.format !== 'avplan-device-sync') throw new LibraryError('server', res.status, 'unexpected format')
  return body as unknown as SyncResponse
}

/**
 * Ein Geraet vorschlagen. Es geht in die Moderation und ist fuer andere erst
 * nach der Freigabe sichtbar. `facet` ist das Objekt im Bibliotheksformat des
 * einreichenden Planners.
 */
export async function propose(
  server: string,
  token: string,
  planner: LibraryPlanner,
  core: ProposalCore,
  facet: Record<string, unknown>,
): Promise<{ slug: string; state: string; findings?: unknown[] }> {
  const res = await anfrage(server, '/api/proposals', {
    method: 'POST',
    token,
    body: { data: { ...core, planners: { [planner]: facet } } },
  })
  const body = await jsonOderNull(res)
  if (!res.ok) throw new LibraryError(fehlerAus(res, body), res.status, String(body?.error ?? ''))
  return body as { slug: string; state: string; findings?: unknown[] }
}

/** Wo man ein Konto anlegt — die Registrierung laeuft auf der Website
 *  (E-Mail bestaetigen, Richtlinien annehmen), nicht im Planner. */
export const registerUrl = (server: string) => `${basis(server)}/register`
export const forgotPasswordUrl = (server: string) => `${basis(server)}/forgot`
export const deviceUrl = (server: string, slug: string) => `${basis(server)}/d/${encodeURIComponent(slug)}`
