/**
 * v7.9.86 / #197 — Multi-Provider AI Port-Suggestions.
 *
 * Vorher: nur Gemini. Jetzt drei Provider auswählbar:
 *   - gemini  (Google Generative Language API, gemini-2.5-flash)
 *   - claude  (Anthropic Messages API, claude-opus-5-5, mit Websuche)
 *   - openai  (OpenAI Chat Completions, gpt-4o-mini)
 *
 * Jeder Provider hat seinen eigenen API-Key (localStorage-Slot). Der
 * `selectedAiProvider` wird ebenfalls in localStorage gespeichert.
 *
 * Bestehende `getGeminiApiKey()` / `setGeminiApiKey()` bleiben als
 * Compat-Aliases erhalten — alter Code in der Codebase (LibraryPanel,
 * Settings-Dialog, NewRentmanDeviceWizard) funktioniert weiter ohne
 * Anpassung.
 *
 * suggestFromAI() dispatcht intern auf den ausgewählten Provider, der
 * Caller-Code bleibt unverändert.
 */
import { ALL_CONNECTOR_TYPES } from '../types/equipment'
import type { ConnectorType } from '../types/equipment'
import { ALL_SIGNAL_STANDARDS } from '../types/cableSpec'
import type { PortGroupHint } from './portSuggestions'
import { STORAGE_KEYS } from './storageKeys'

export type AiProvider = 'gemini' | 'claude' | 'openai'

const STORAGE_PROVIDER_SELECTED = 'cable-planner:ai-provider'
const STORAGE_KEY_GEMINI = STORAGE_KEYS.geminiApiKey
const STORAGE_KEY_CLAUDE = 'cable-planner:claude-api-key'
const STORAGE_KEY_OPENAI = 'cable-planner:openai-api-key'
const STORAGE_KEY_CLAUDE_WORKSPACE = 'cable-planner:claude-workspace-id'

const CONNECTOR_VALUES = ALL_CONNECTOR_TYPES
const STANDARD_VALUES = ALL_SIGNAL_STANDARDS

// ─── Provider-Konfiguration ────────────────────────────────────────────

interface ProviderConfig {
  label: string
  defaultModel: string
  storageKey: string
  /** URL für API-Key-Verwaltung damit der User direkt zum richtigen
   *  Dashboard navigieren kann. */
  consoleUrl: string
  /** Per-Provider override via window — für E2E-Tests. */
  overrideKey: string
  /**
   * Wie ein Schluessel dieses Anbieters ANFAENGT — als Platzhalter im
   * Eingabefeld.
   *
   * Dazugekommen 2026-09-28, weil im Anlegen-Dialog `AIza…` fest im Markup
   * stand: ein Platzhalter, der die Form eines Gemini-Schluessels zeigt,
   * waehrend Claude gewaehlt ist, ist eine falsche Auskunft an genau der
   * Stelle, an der jemand pruefen will, ob er das Richtige eingefuegt hat.
   */
  keyHint: string
}

const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    storageKey: STORAGE_KEY_GEMINI,
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    overrideKey: '__CABLE_PLANNER_GEMINI__',
    keyHint: 'AIza…',
  },
  claude: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-opus-5-5',
    storageKey: STORAGE_KEY_CLAUDE,
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    overrideKey: '__CABLE_PLANNER_CLAUDE__',
    keyHint: 'sk-ant-…',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    storageKey: STORAGE_KEY_OPENAI,
    consoleUrl: 'https://platform.openai.com/api-keys',
    overrideKey: '__CABLE_PLANNER_OPENAI__',
    keyHint: 'sk-…',
  },
}

export const listAiProviders = (): Array<{ id: AiProvider; config: ProviderConfig }> =>
  (Object.keys(PROVIDERS) as AiProvider[]).map((id) => ({ id, config: PROVIDERS[id] }))

export const getAiProviderConfig = (provider: AiProvider): ProviderConfig => PROVIDERS[provider]

// ─── Provider-Auswahl-State ────────────────────────────────────────────

export const getSelectedAiProvider = (): AiProvider => {
  try {
    const v = localStorage.getItem(STORAGE_PROVIDER_SELECTED)
    if (v === 'gemini' || v === 'claude' || v === 'openai') return v
  } catch {
    /* ignore */
  }
  return 'gemini'
}

export const setSelectedAiProvider = (provider: AiProvider): void => {
  try {
    localStorage.setItem(STORAGE_PROVIDER_SELECTED, provider)
  } catch {
    /* ignore */
  }
}

// ─── Per-Provider API-Key-Verwaltung ───────────────────────────────────

export const getApiKey = (provider: AiProvider): string => {
  try {
    return localStorage.getItem(PROVIDERS[provider].storageKey) ?? ''
  } catch {
    return ''
  }
}

export const setApiKey = (provider: AiProvider, key: string): void => {
  try {
    if (key) localStorage.setItem(PROVIDERS[provider].storageKey, key)
    else localStorage.removeItem(PROVIDERS[provider].storageKey)
  } catch {
    /* ignore */
  }
}

/**
 * Workspace-ID fuer Claude-Schluessel, die keinem Workspace zugeordnet sind.
 *
 * Gemeldet 2026-10-09: „Claude API 400: This API key is not scoped to a
 * workspace, so this request must include the anthropic-workspace-id
 * header". Solche Schluessel gelten fuer die ganze Organisation; die API
 * verlangt dann bei jeder Anfrage, welcher Workspace gemeint ist. Leer
 * heisst: kein Header — der Normalfall fuer Workspace-Schluessel.
 */
export const getClaudeWorkspaceId = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY_CLAUDE_WORKSPACE) ?? ''
  } catch {
    return ''
  }
}

export const setClaudeWorkspaceId = (id: string): void => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_CLAUDE_WORKSPACE, id)
    else localStorage.removeItem(STORAGE_KEY_CLAUDE_WORKSPACE)
  } catch {
    /* ignore */
  }
}

/** Returns true if at least one provider has a key configured. Used by
 *  caller-Code um den AI-Button aktiv/inaktiv zu machen. */
export const hasAnyAiKey = (): boolean =>
  (Object.keys(PROVIDERS) as AiProvider[]).some((p) => getApiKey(p).length > 0)

// ── Legacy-Compat ──────────────────────────────────────────────────────
// Existing code uses getGeminiApiKey/setGeminiApiKey. Wir liefern die
// Funktionen unverändert weiter aber lenken sie auf den neuen per-
// Provider-Pfad um, damit Migration sanft läuft.

// ─── WARUM DIESE ZWEI NICHT MEHR BENUTZT WERDEN ─────────────────────────
//
// Sie waren als sanfte Migration gedacht und wurden zur Falle. Am 2026-09-28
// gemeldet: „in den KI Ausfuellen der Geraeteinfos ist immer Gemini
// hinterlegt, unabhaengig von dem was im Menue ausgewaehlt ist." Beide
// Anlegen-Dialoge (`LibraryPanel`, `NewRentmanDeviceWizard`) riefen sie —
// sie sehen wie „der KI-Schluessel" aus, sind aber `getApiKey('gemini')`.
// Folge: mit Claude oder OpenAI gewaehlt meldete der Knopf „kein API-Key",
// und der im Fenster nachgetragene Schluessel landete unter Gemini, wo ihn
// niemand mehr las.
//
// Sie bleiben als Schnittstelle stehen (Fremdcode kann sie rufen), aber im
// eigenen Quelltext ruft sie nichts mehr; `tests/kiAnbieter.test.ts` haelt das
// fest. Wer einen Schluessel braucht, fragt `getApiKey(getSelectedAiProvider())`
// — dann steht die Auswahl in der Antwort.
export const getGeminiApiKey = (): string => getApiKey('gemini')
export const setGeminiApiKey = (key: string): void => setApiKey('gemini', key)

// ─── Gemeinsamer Prompt ────────────────────────────────────────────────

const PROMPT_TEMPLATE = (deviceName: string, category: string) => `You are helping populate a cable-planning tool.
For the device below, list the physical connectors typically found on it based on common datasheets.
Return STRICT JSON only (no prose, no markdown, no code fences).

Device name: ${deviceName}
Category: ${category}

JSON schema:
{
  "ports": [
    { "direction": "in" | "out", "label": "short label", "count": <int>, "connector": <one of: ${CONNECTOR_VALUES.join(', ')}>, "standard": <optional, one of: ${STANDARD_VALUES.join(', ')}> }
  ]
}

Rules:
- Describe THIS exact model, not the product family. Encoder/decoder, transmitter/receiver and
  variants with a suffix (C, D, E, -IOAV …) differ in their connectors — check which one is meant.
- If you can search the web, look up the manufacturer datasheet or product page first and list
  only what it documents.
- "in" for signal inputs/returns, "out" for signal outputs/sends. Power inputs use direction "in".
- Group identical ports (e.g. 4x BNC SDI inputs) into ONE entry with count=4.
- Power: list a mains connector only if the datasheet shows one on the unit. Devices powered via
  PoE or an external power pack have no mains connector — PoE goes into the Ethernet label.
- Leave out service-only ports (console/micro-USB for setup) and internal buses.
- Do not add connectors because they are "typical" for the category. Omit what you cannot confirm.
- If the model is unknown to you and cannot be found, return { "ports": [] }.
- Reply with the JSON object only.`

// ─── Provider-Implementierungen ────────────────────────────────────────

interface RawSuggestion {
  direction?: string
  type?: string
  label?: string
  count?: number
  connector?: string
  standard?: string
}

const parseJsonResponse = (text: string): RawSuggestion[] => {
  // Manche Provider rahmen JSON in ```json ... ``` ein trotz strict-JSON-
  // Prompt. Strip vor dem Parse.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  // Nach einer Websuche schreibt das Modell manchmal einen Satz vor das JSON.
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  const kern = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped
  let parsed: { ports?: RawSuggestion[] }
  try {
    parsed = JSON.parse(kern) as { ports?: RawSuggestion[] }
  } catch {
    throw new Error('AI provider returned invalid JSON')
  }
  return Array.isArray(parsed.ports) ? parsed.ports : []
}

const normalizeHints = (ports: RawSuggestion[]): PortGroupHint[] =>
  ports.map((p): PortGroupHint => {
    const dirRaw = (p.direction ?? p.type ?? '').toString().toLowerCase()
    const direction: 'in' | 'out' = dirRaw.startsWith('out') ? 'out' : 'in'
    const connector: ConnectorType = CONNECTOR_VALUES.includes(p.connector as ConnectorType)
      ? (p.connector as ConnectorType)
      : 'Custom'
    const count = Math.max(1, Math.min(64, Math.round(Number(p.count) || 1)))
    const label = (p.label ?? '').toString().slice(0, 40) || (direction === 'in' ? 'Input' : 'Output')
    return { direction, count, connectorType: connector, label }
  })

const overrideFor = <T = unknown>(key: string): T | undefined =>
  (globalThis as Record<string, unknown>)[key] as T | undefined

/**
 * Bilder als Data-URI (`data:image/jpeg;base64,…`) in Mime-Typ und Nutzlast
 * zerlegen. Alle drei Anbieter wollen die Nutzlast ohne Praefix — nur OpenAI
 * nimmt die ganze Data-URI.
 */
export const zerlegeDataUri = (dataUri: string): { mime: string; data: string } => {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUri)
  if (!m) throw new Error('Image is not a base64 data URI')
  return { mime: m[1], data: m[2] }
}

const callGemini = async (
  apiKey: string,
  prompt: string,
  images: string[] = [],
  opts: AiCallOptions = {},
): Promise<string> => {
  const override = overrideFor<{ base?: string; model?: string }>('__CABLE_PLANNER_GEMINI__')
  const base = override?.base ?? 'https://generativelanguage.googleapis.com/v1beta'
  const model = override?.model ?? PROVIDERS.gemini.defaultModel
  const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          ...images.map((uri) => {
            const { mime, data } = zerlegeDataUri(uri)
            return { inline_data: { mime_type: mime, data } }
          }),
          { text: prompt },
        ],
      },
    ],
    // Google-Suche und JSON-Modus schliessen sich bei Gemini aus; das JSON
    // holt dann parseJsonResponse aus dem Text.
    ...(opts.webSearch ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      ...(opts.webSearch ? {} : { responseMimeType: 'application/json' }),
      temperature: 0.2,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

interface AiCallOptions {
  /**
   * Vor der Antwort im Web nachschlagen. Gemeldet 2026-10-09: fuer
   * „Crestron DM-NVX-D30" kamen HDMI-Eingang, IEC 230V und USB-A — alles, was
   * ein Netzwerkgeraet „typischerweise" hat, nichts davon am Decoder. Aus dem
   * Namen allein raet jedes Modell die Produktfamilie, nicht das Geraet.
   */
  webSearch?: boolean
}

const callClaude = async (
  apiKey: string,
  prompt: string,
  images: string[] = [],
  opts: AiCallOptions = {},
): Promise<string> => {
  const override = overrideFor<{ base?: string; model?: string }>('__CABLE_PLANNER_CLAUDE__')
  const base = override?.base ?? 'https://api.anthropic.com/v1'
  const model = override?.model ?? PROVIDERS.claude.defaultModel
  const url = `${base}/messages`
  const workspaceId = getClaudeWorkspaceId().trim()
  const body: Record<string, unknown> = {
    model,
    max_tokens: 16000,
    // Verweigert ein Sicherheitsfilter, beantwortet ein anderes Modell.
    fallbacks: 'default',
    ...(opts.webSearch
      ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }] }
      : {}),
    messages: [
      {
        role: 'user',
        content:
          images.length === 0
            ? prompt
            : [
                ...images.map((uri) => {
                  const { mime, data } = zerlegeDataUri(uri)
                  return { type: 'image', source: { type: 'base64', media_type: mime, data } }
                }),
                { type: 'text', text: prompt },
              ],
      },
    ],
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // CORS-Safe-Header-Flag damit der Browser ohne Backend-Proxy direkt
      // ansprechen kann (Anthropic erlaubt das mit einem expliziten Opt-In).
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (text.includes('anthropic-workspace-id')) {
      throw new Error(
        workspaceId
          ? `Claude API ${res.status}: the workspace ID you entered was not accepted. Check it in the Anthropic Console under Settings → Workspaces.`
          : `Claude API ${res.status}: this key is not scoped to a workspace. Enter the workspace ID under Settings → Integrations → Anthropic Claude (Anthropic Console → Settings → Workspaces, starts with wrkspc_), or create the key inside a workspace.`,
      )
    }
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    stop_reason?: string
    content?: Array<{ type?: string; text?: string }>
  }
  if (json.stop_reason === 'refusal') throw new Error('Claude API: request declined')
  // Mit Websuche kommt die Antwort in mehreren Textbloecken (Zitate teilen
  // sie); die JSON-Antwort steht am Ende.
  return (json.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
}

const callOpenAI = async (apiKey: string, prompt: string, images: string[] = []): Promise<string> => {
  const override = overrideFor<{ base?: string; model?: string }>('__CABLE_PLANNER_OPENAI__')
  const base = override?.base ?? 'https://api.openai.com/v1'
  const model = override?.model ?? PROVIDERS.openai.defaultModel
  const url = `${base}/chat/completions`
  const body = {
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content:
          images.length === 0
            ? prompt
            : [
                { type: 'text', text: prompt },
                ...images.map((uri) => ({ type: 'image_url', image_url: { url: uri } })),
              ],
      },
    ],
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI API ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return json.choices?.[0]?.message?.content ?? ''
}

// ─── Dispatch ──────────────────────────────────────────────────────────

export const suggestFromAI = async (
  deviceName: string,
  category: string,
): Promise<PortGroupHint[]> => {
  const prompt = PROMPT_TEMPLATE(deviceName, category)
  const text = await completeWithAI(prompt, [], { webSearch: true })
  const raw = parseJsonResponse(text)
  return normalizeHints(raw)
}

/**
 * #414 — Generische Text→Text-Completion (2026-09-28: optional mit Bildern —
 * alle drei Anbieter nehmen sie in derselben Nachricht; siehe
 * `lib/fotoPortErkennung.ts`) über den ausgewählten Provider.
 * Wird von der KI-Plan-Generierung (planGeneration.ts) genutzt. Wirft, wenn
 * kein API-Key hinterlegt ist. Liefert den rohen Modell-Text (Caller parst
 * JSON selbst via parseJsonResponse).
 */
export const completeWithAI = async (
  prompt: string,
  images: string[] = [],
  opts: AiCallOptions = {},
): Promise<string> => {
  const provider = getSelectedAiProvider()
  const key = getApiKey(provider)
  if (!key) {
    throw new Error(
      `Kein API-Key für ${PROVIDERS[provider].label}. Bitte in den Einstellungen → AI hinterlegen.`,
    )
  }
  switch (provider) {
    case 'gemini':
      return callGemini(key, prompt, images, opts)
    case 'claude':
      return callClaude(key, prompt, images, opts)
    case 'openai':
      return callOpenAI(key, prompt, images)
  }
}
