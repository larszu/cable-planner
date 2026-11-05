// ───────────────────────────────────────────────────────────────────────────
// KI-Modus — was eine Abfrage kosten darf (#1172).
//
// DER BEFUND. Gemeldet 2026-10-27: „api abfragen zum generieren von geraeten
// kosten ca 2,50 dollar pro 10 geraete." Nachgerechnet an der Abfrage, die
// `suggestFromAI` bis dahin stellte:
//
//   Modell        claude-opus-5-5          $4 / $20 je Mio. Token
//   Denktiefe     Vorgabe `medium`         (bei Opus 5.5 nicht abschaltbar)
//   Websuche      max_uses: 5              $10 je 1000 Suchen
//   max_tokens    16000
//
// Teuer ist daran NICHT der Prompt — die Port-Frage samt beiden Vokabellisten
// sind rund 1500 Token, also unter einem Cent. Teuer sind die Suchergebnisse:
// jede Suche legt den abgerufenen Seiteninhalt in den Kontext, und bei jedem
// weiteren Schritt derselben Antwort wird der ganze Kontext erneut als
// Eingabe berechnet. Fuenf Suchen sind damit nicht 5 x $0,01, sondern fuenf
// Runden mit wachsendem Eingabestapel — bei Opus-Preisen die Groessenordnung,
// die der Nutzer gemessen hat.
//
// Die drei Hebel in der Reihenfolge ihrer Wirkung:
//
//   1. Modell. Dieselben Suchergebnisse kosten bei Haiku 5.5 ($0,10/Mio.)
//      ein Vierzigstel der Eingabe von Opus 5.5, bei Sonnet 5.5 die Haelfte.
//   2. Anzahl der Suchen. Zwei statt fuenf halbieren den Stapel, der sich
//      aufbaut, und sparen zusaetzlich die Suchgebuehr.
//   3. Denktiefe. `effort: 'low'` kuerzt die Ausgabe, die bei Sonnet
//      standardmaessig auf `high` steht.
//
// WARUM DREI MODI UND KEINE ZWANZIG SCHALTER. Modell, Denktiefe, Suchanzahl
// und Token-Deckel sind nicht unabhaengig voneinander waehlbar — „Opus mit
// Denktiefe low und ohne Suche" ist keine sinnvolle Einstellung, sondern eine
// teure Verwechslung. Der Nutzer entscheidet, was ihm die Antwort wert ist;
// welche vier Werte daraus folgen, entscheidet diese Datei.
//
// Die Preise stehen hier, damit die App sagen kann, was gelaufen ist (siehe
// `aiKosten.ts`). Nur die Anthropic-Zahlen sind belegt (Preisliste
// 2026-10, Websuche $10/1000 Suchen); die beiden anderen Anbieter sind
// Schaetzwerte aus ihren oeffentlichen Listen. Darum heisst es in der
// Oberflaeche „ca." und nirgends „Rechnung".
// ───────────────────────────────────────────────────────────────────────────

/** Die Anbieter. Steht hier und nicht in `aiSuggestions`, damit Modus-Tabelle
 *  und Preisliste den Typ ohne Ringschluss benutzen koennen. */
export type AiProvider = 'gemini' | 'claude' | 'openai' | 'lokal'

export type AiModus = 'sparsam' | 'ausgewogen' | 'genau'

export const AI_MODI: AiModus[] = ['sparsam', 'ausgewogen', 'genau']

/** Die Vorgabe. Vorher lief jede Abfrage im Profil von `genau`. */
export const AI_MODUS_VORGABE: AiModus = 'ausgewogen'

export interface AiModusProfil {
  /** Modell je Anbieter. */
  modelle: Record<AiProvider, string>
  /** Websuchen je Abfrage. 0 heisst: ohne Suche fragen. */
  webSuchen: number
  /** `output_config.effort` bei Claude. */
  effort: 'low' | 'medium' | 'high'
  /**
   * Denk-Budget bei Gemini. 0 schaltet das Denken ab, -1 laesst das Modell
   * entscheiden. Nicht jedes Modell nimmt 0 — `gemini-2.5-pro` denkt immer,
   * deshalb steht dort -1.
   */
  geminiDenkbudget: number
  /** Obergrenze der Antwort, wenn der Aufrufer keine eigene nennt. */
  maxTokens: number
}

export const AI_MODUS_PROFILE: Record<AiModus, AiModusProfil> = {
  sparsam: {
    modelle: {
      claude: 'claude-haiku-5-5',
      gemini: 'gemini-2.5-flash-lite',
      openai: 'gpt-4o-mini',
      lokal: 'gemma4:e4b',
    },
    webSuchen: 0,
    effort: 'low',
    geminiDenkbudget: 0,
    maxTokens: 4000,
  },
  ausgewogen: {
    modelle: {
      claude: 'claude-sonnet-5-5',
      gemini: 'gemini-2.5-flash',
      openai: 'gpt-4o-mini',
      lokal: 'gemma4:26b',
    },
    webSuchen: 2,
    effort: 'low',
    geminiDenkbudget: 0,
    maxTokens: 8000,
  },
  genau: {
    modelle: {
      claude: 'claude-opus-5-5',
      gemini: 'gemini-2.5-pro',
      openai: 'gpt-4o',
      lokal: 'gemma4:26b',
    },
    webSuchen: 5,
    effort: 'high',
    geminiDenkbudget: -1,
    maxTokens: 16000,
  },
}

const STORAGE_MODUS = 'cable-planner:ai-modus'

export const getAiModus = (): AiModus => {
  try {
    const v = localStorage.getItem(STORAGE_MODUS)
    if (v && (AI_MODI as string[]).includes(v)) return v as AiModus
  } catch {
    /* ignore */
  }
  return AI_MODUS_VORGABE
}

export const setAiModus = (modus: AiModus): void => {
  try {
    localStorage.setItem(STORAGE_MODUS, modus)
  } catch {
    /* ignore */
  }
}

export const aiProfil = (modus: AiModus = getAiModus()): AiModusProfil => AI_MODUS_PROFILE[modus]

// ─── Lokales Modell ────────────────────────────────────────────────────
//
// Beim lokalen Anbieter entscheidet nicht der Modus allein: welche Modelle
// auf dem Rechner liegen, weiss nur `ollama list`. Die Tabelle oben nennt
// die Vorgabe (Gemma 4 26B A4B — in der Fallstudie Hahn 2026, TH Koeln, das
// lokale Modell mit dem besten Verhaeltnis aus Qualitaet und Tempo; e4b fuer
// Rechner mit wenig Speicher). Wer ein anderes geladen hat, traegt es hier ein,
// und es gilt dann fuer alle drei Modi.

const STORAGE_LOKAL_MODELL = 'cable-planner:lokal-modell'

export const getLokalesModell = (): string => {
  try {
    return localStorage.getItem(STORAGE_LOKAL_MODELL)?.trim() ?? ''
  } catch {
    return ''
  }
}

export const setLokalesModell = (modell: string): void => {
  try {
    if (modell.trim()) localStorage.setItem(STORAGE_LOKAL_MODELL, modell.trim())
    else localStorage.removeItem(STORAGE_LOKAL_MODELL)
  } catch {
    /* ignore */
  }
}

/** Das Modell, das der gewaehlte Modus bei diesem Anbieter benutzt. */
export const aiModell = (provider: AiProvider, modus: AiModus = getAiModus()): string =>
  (provider === 'lokal' && getLokalesModell()) || AI_MODUS_PROFILE[modus].modelle[provider]

// ─── Preise ────────────────────────────────────────────────────────────

export interface ModellPreis {
  /** USD je Mio. Eingabe-Token. */
  ein: number
  /** USD je Mio. Ausgabe-Token. */
  aus: number
  /** USD je Mio. Token, die aus dem Prompt-Cache gelesen werden. */
  cache: number
  /** USD je Websuche. */
  suche: number
}

/**
 * Preise je Modell, Stand 2026-10.
 *
 * Belegt: die vier Anthropic-Zeilen (Anthropic-Preisliste; Websuche $10 je
 * 1000 Suchen). Geschaetzt: Gemini und OpenAI aus ihren oeffentlichen Listen
 * — Googles Grounding wird je geerdete Anfrage abgerechnet und liegt deutlich
 * ueber der Anthropic-Suche. Wer eine Rechnung braucht, liest sie beim
 * Anbieter; hier geht es um die Groessenordnung.
 */
export const AI_PREISE: Record<string, ModellPreis> = {
  'claude-haiku-5-5': { ein: 0.1, aus: 0.5, cache: 0.01, suche: 0.01 },
  'claude-sonnet-5-5': { ein: 2, aus: 10, cache: 0.2, suche: 0.01 },
  'claude-opus-5-5': { ein: 4, aus: 20, cache: 0.2, suche: 0.01 },
  'claude-opus-5': { ein: 5, aus: 25, cache: 0.5, suche: 0.01 },
  'gemini-2.5-flash-lite': { ein: 0.1, aus: 0.4, cache: 0.025, suche: 0.035 },
  'gemini-2.5-flash': { ein: 0.3, aus: 2.5, cache: 0.075, suche: 0.035 },
  'gemini-2.5-pro': { ein: 1.25, aus: 10, cache: 0.31, suche: 0.035 },
  'gpt-4o-mini': { ein: 0.15, aus: 0.6, cache: 0.075, suche: 0 },
  'gpt-4o': { ein: 2.5, aus: 10, cache: 1.25, suche: 0 },
}

const KOSTENLOS: ModellPreis = { ein: 0, aus: 0, cache: 0, suche: 0 }

/**
 * Unbekanntes Modell (eigener Override, neues Modell): lieber nicht raten.
 * Ausnahme lokal: dort kostet keine Abfrage Geld, gleich welches Modell —
 * der Strom des eigenen Rechners steht auf keiner Rechnung, die diese App
 * nachrechnen koennte.
 */
export const preisFuer = (modell: string, provider?: AiProvider): ModellPreis | undefined =>
  provider === 'lokal' ? KOSTENLOS : AI_PREISE[modell]
