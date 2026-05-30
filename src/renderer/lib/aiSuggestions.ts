/**
 * v7.9.86 / #197 — Multi-Provider AI Port-Suggestions.
 *
 * Vorher: nur Gemini. Jetzt drei Provider auswählbar:
 *   - gemini  (Google Generative Language API, gemini-2.5-flash)
 *   - claude  (Anthropic Messages API, claude-haiku-4-5)
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
}

const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    storageKey: STORAGE_KEY_GEMINI,
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    overrideKey: '__CABLE_PLANNER_GEMINI__',
  },
  claude: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-haiku-4-5-20251001',
    storageKey: STORAGE_KEY_CLAUDE,
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    overrideKey: '__CABLE_PLANNER_CLAUDE__',
  },
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    storageKey: STORAGE_KEY_OPENAI,
    consoleUrl: 'https://platform.openai.com/api-keys',
    overrideKey: '__CABLE_PLANNER_OPENAI__',
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

/** Returns true if at least one provider has a key configured. Used by
 *  caller-Code um den AI-Button aktiv/inaktiv zu machen. */
export const hasAnyAiKey = (): boolean =>
  (Object.keys(PROVIDERS) as AiProvider[]).some((p) => getApiKey(p).length > 0)

// ── Legacy-Compat ──────────────────────────────────────────────────────
// Existing code uses getGeminiApiKey/setGeminiApiKey. Wir liefern die
// Funktionen unverändert weiter aber lenken sie auf den neuen per-
// Provider-Pfad um, damit Migration sanft läuft.

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
- "in" for signal inputs/returns, "out" for signal outputs/sends. Power inputs use direction "in".
- Group identical ports (e.g. 4x BNC SDI inputs) into ONE entry with count=4.
- Include power connectors (Schuko 230V / PowerCON / IEC 230V) and network ports (Ethernet/RJ45) when typical.
- Do NOT include internal buses or non-user-facing connectors.
- If unknown or generic item, return { "ports": [] }.`

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
  let parsed: { ports?: RawSuggestion[] }
  try {
    parsed = JSON.parse(stripped) as { ports?: RawSuggestion[] }
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

const callGemini = async (apiKey: string, prompt: string): Promise<string> => {
  const override = overrideFor<{ base?: string; model?: string }>('__CABLE_PLANNER_GEMINI__')
  const base = override?.base ?? 'https://generativelanguage.googleapis.com/v1beta'
  const model = override?.model ?? PROVIDERS.gemini.defaultModel
  const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
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

const callClaude = async (apiKey: string, prompt: string): Promise<string> => {
  const override = overrideFor<{ base?: string; model?: string }>('__CABLE_PLANNER_CLAUDE__')
  const base = override?.base ?? 'https://api.anthropic.com/v1'
  const model = override?.model ?? PROVIDERS.claude.defaultModel
  const url = `${base}/messages`
  const body = {
    model,
    max_tokens: 1024,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
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
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const textBlock = json.content?.find((c) => c.type === 'text')
  return textBlock?.text ?? ''
}

const callOpenAI = async (apiKey: string, prompt: string): Promise<string> => {
  const override = overrideFor<{ base?: string; model?: string }>('__CABLE_PLANNER_OPENAI__')
  const base = override?.base ?? 'https://api.openai.com/v1'
  const model = override?.model ?? PROVIDERS.openai.defaultModel
  const url = `${base}/chat/completions`
  const body = {
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
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
  const text = await completeWithAI(prompt)
  const raw = parseJsonResponse(text)
  return normalizeHints(raw)
}

/**
 * #414 — Generische Text→Text-Completion über den ausgewählten Provider.
 * Wird von der KI-Plan-Generierung (planGeneration.ts) genutzt. Wirft, wenn
 * kein API-Key hinterlegt ist. Liefert den rohen Modell-Text (Caller parst
 * JSON selbst via parseJsonResponse).
 */
export const completeWithAI = async (prompt: string): Promise<string> => {
  const provider = getSelectedAiProvider()
  const key = getApiKey(provider)
  if (!key) {
    throw new Error(
      `Kein API-Key für ${PROVIDERS[provider].label}. Bitte in den Einstellungen → AI hinterlegen.`,
    )
  }
  switch (provider) {
    case 'gemini':
      return callGemini(key, prompt)
    case 'claude':
      return callClaude(key, prompt)
    case 'openai':
      return callOpenAI(key, prompt)
  }
}
