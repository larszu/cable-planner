// #1225 — Technische Fragen an den offenen Plan („Was ist der beste Signalweg
// von Gerät A zu Gerät B?", „Welches Gerät eignet sich für X?").
//
// Derselbe Plan-Kontext wie für die Ergänzung aus Dokumenten (`planKontext`)
// und derselbe Weg zum Anbieter (`completeWithAI`) — kein zweiter. Ohne
// Websuche: gefragt ist der Plan, nicht das Netz, und Suchen sind das, was
// eine Abfrage teuer macht (siehe aiModus.ts).
import { completeWithAI } from './aiSuggestions'
import { planKontext } from './planVervollstaendigung'
import type { CablePlannerProject } from '../types/project'

export const PLAN_FRAGE_PROMPT = (kontext: string, frage: string, sprache: string): string =>
  `You are a broadcast/AV systems engineer. Answer the planner's question about THIS plan.

PLAN (devices are referenced by @ref; name them by their name in the answer):
${kontext}

QUESTION:
${frage.trim()}

Rules: base the answer on the devices, ports, cables and specs listed above. If the plan lacks a detail
you need, say which one instead of guessing. For signal paths, list the hops device → port → cable.
Answer concisely in plain text, in the language with code "${sprache}".`

export const fragePlan = (
  project: Pick<CablePlannerProject, 'equipment' | 'cables' | 'locations'>,
  frage: string,
  sprache: string,
): Promise<string> => completeWithAI(PLAN_FRAGE_PROMPT(planKontext(project), frage, sprache), [], { webSearch: false })
