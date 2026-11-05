// ───────────────────────────────────────────────────────────────────────────
// KI-Bench — welches Modell beantwortet die Port-Frage gut genug, wofuer?
//
// WARUM ES DAS GIBT (2026-11-05). Der KI-Modus (#1172) legt Modelle fest,
// gewaehlt nach Preisliste. Ob „sparsam" (Haiku, ohne Suche) die Ports eines
// Geraets noch richtig nennt, war nie gemessen. Vorbild ist die Vorauswahl
// aus Hahn 2026 (TH Koeln): feste Aufgaben, jedes Modell dieselbe Frage,
// gemessen werden Treffer, Zeit, Token und Kosten — statt nach Gefuehl.
//
// DIE RICHTIGE ANTWORT kommt aus den eigenen Katalogen: deren Ports sind
// gegen Herstellerdatenblaetter geprueft (manufacturerUrl, test-erzwungen).
// Damit braucht es keine LLM-Juroren wie in der Arbeit — es gibt eine
// Referenz, und gezaehlt wird gegen sie.
//
// GEZAEHLT wird je Richtung und Steckertyp (`in|BNC` …): Treffer = Minimum
// aus genannter und belegter Anzahl. Daraus Genauigkeit (wie viel des
// Genannten stimmt), Vollstaendigkeit (wie viel des Belegten genannt wurde)
// und F1. Beschriftungen zaehlen nicht — „SDI In 1" vs. „Input 1" ist kein
// Fehler, ein fehlender BNC schon.
//
// Aufruf (Modelle als anbieter:modell, Komma-getrennt):
//   node --experimental-strip-types --import ./scripts/register-endungen.mjs \
//     scripts/ki-bench/lauf.mjs --modelle lokal:gemma4:26b,claude:claude-haiku-5-5 [--suchen 2] [--aus datei.json]
//
// Anbieter und ihre Umgebung:
//   claude      ANTHROPIC_API_KEY            (Websuche mit --suchen N)
//   openai      OPENAI_API_KEY
//   openrouter  OPENROUTER_API_KEY           (viele Modelle, Kosten aus der Antwort)
//   lokal       OLLAMA_URL, Vorgabe http://localhost:11434
// ───────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeHints, parseJsonResponse, PORT_ANLEITUNG, PORT_FRAGE } from '../../src/renderer/lib/aiPortFrage.ts'
import { preisFuer } from '../../src/renderer/lib/aiModus.ts'

/** Feste Aufgaben: zwoelf Geraete aus zehn Katalogen, quer durch die Gattungen. */
export const AUFGABEN = [
  ['blackmagicCatalog', 'Blackmagic Smart Videohub 12x12'],
  ['blackmagicCatalog', 'Blackmagic ATEM 2 M/E Constellation 4K'],
  ['ajaCatalog', 'AJA Ki Pro Ultra 12G'],
  ['ajaCatalog', 'AJA FS-HDR'],
  ['crestronCatalog', 'Crestron DM-NVX-350'],
  ['audioCatalog', 'Behringer Wing'],
  ['audioCatalog', 'Yamaha QL5'],
  ['clearcomCatalog', 'Clear-Com MS-702'],
  ['barcoCatalog', 'Barco S3-4K'],
  ['luminexCatalog', 'Luminex GigaCore 14R'],
  ['decimatorCatalog', 'Decimator MD-QUAD'],
  ['greengoCatalog', 'GreenGo MCXD'],
]

const zaehle = (paare) => {
  const m = new Map()
  for (const [schluessel, n] of paare) m.set(schluessel, (m.get(schluessel) ?? 0) + n)
  return m
}

export const referenz = (vorlage) =>
  zaehle([
    ...vorlage.inputs.map((p) => [`in|${p.connectorType}`, 1]),
    ...vorlage.outputs.map((p) => [`out|${p.connectorType}`, 1]),
  ])

export const bewerte = (soll, hinweise) => {
  const ist = zaehle(hinweise.map((h) => [`${h.direction}|${h.connectorType}`, h.count]))
  const summe = (m) => [...m.values()].reduce((a, b) => a + b, 0)
  let treffer = 0
  for (const [k, n] of soll) treffer += Math.min(n, ist.get(k) ?? 0)
  const genau = summe(ist) ? treffer / summe(ist) : 0
  const voll = summe(soll) ? treffer / summe(soll) : 0
  return { genau, voll, f1: genau + voll ? (2 * genau * voll) / (genau + voll) : 0 }
}

const vorlagen = async () => {
  const wurzel = process.cwd()
  const cache = new Map()
  const aus = []
  for (const [katalog, name] of AUFGABEN) {
    if (!cache.has(katalog)) {
      const m = await import(join(wurzel, 'src/renderer/lib', `${katalog}.ts`))
      cache.set(katalog, Object.entries(m).find(([k, v]) => k.endsWith('Templates') && Array.isArray(v))?.[1] ?? [])
    }
    const v = cache.get(katalog).find((t) => t.name === name)
    if (!v) throw new Error(`${katalog}: ${name} nicht gefunden — Aufgabe anpassen`)
    aus.push(v)
  }
  return aus
}

const fragen = async (anbieter, modell, vorlage, suchen) => {
  const frage = PORT_FRAGE(vorlage.name, vorlage.category)
  if (anbieter === 'claude') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modell,
        max_tokens: 8000,
        system: PORT_ANLEITUNG,
        messages: [{ role: 'user', content: frage }],
        ...(suchen > 0 ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: suchen }] } : {}),
      }),
    })
    if (!res.ok) throw new Error(`claude ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const j = await res.json()
    const text = j.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    const u = j.usage ?? {}
    const p = preisFuer(modell, 'claude')
    const s = u.server_tool_use?.web_search_requests ?? 0
    const usd = p ? ((u.input_tokens ?? 0) / 1e6) * p.ein + ((u.output_tokens ?? 0) / 1e6) * p.aus + s * p.suche : undefined
    return { text, ein: u.input_tokens ?? 0, aus: u.output_tokens ?? 0, usd }
  }
  const basis = {
    openai: ['https://api.openai.com/v1', process.env.OPENAI_API_KEY],
    openrouter: ['https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY],
    lokal: [`${(process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/+$/, '')}/v1`, undefined],
  }[anbieter]
  if (!basis) throw new Error(`Unbekannter Anbieter ${anbieter}`)
  const res = await fetch(`${basis[0]}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(basis[1] ? { Authorization: `Bearer ${basis[1]}` } : {}) },
    body: JSON.stringify({
      model: modell,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PORT_ANLEITUNG },
        { role: 'user', content: frage },
      ],
      ...(anbieter === 'openrouter' ? { usage: { include: true } } : {}),
    }),
  })
  if (!res.ok) throw new Error(`${anbieter} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  const u = j.usage ?? {}
  const p = preisFuer(modell, anbieter === 'lokal' ? 'lokal' : undefined)
  const usd =
    u.cost ?? (p ? ((u.prompt_tokens ?? 0) / 1e6) * p.ein + ((u.completion_tokens ?? 0) / 1e6) * p.aus : undefined)
  return { text: j.choices?.[0]?.message?.content ?? '', ein: u.prompt_tokens ?? 0, aus: u.completion_tokens ?? 0, usd }
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

const haupt = async () => {
  const args = process.argv.slice(2)
  const arg = (n, v) => (args.includes(n) ? args[args.indexOf(n) + 1] : v)
  const modelle = (arg('--modelle', '') || '').split(',').filter(Boolean)
  if (!modelle.length) {
    console.error('--modelle anbieter:modell[,…] fehlt (siehe Kopf der Datei)')
    process.exit(2)
  }
  const suchen = Number(arg('--suchen', '0'))
  const geraete = await vorlagen()
  const ergebnis = []
  for (const eintrag of modelle) {
    const i = eintrag.indexOf(':')
    const anbieter = eintrag.slice(0, i)
    const modell = eintrag.slice(i + 1)
    const laeufe = []
    for (const v of geraete) {
      const t0 = performance.now()
      try {
        const a = await fragen(anbieter, modell, v, suchen)
        const hinweise = normalizeHints(parseJsonResponse(a.text))
        laeufe.push({ geraet: v.name, sek: (performance.now() - t0) / 1000, ...bewerte(referenz(v), hinweise), ein: a.ein, aus: a.aus, usd: a.usd, json: true })
      } catch (e) {
        laeufe.push({ geraet: v.name, sek: (performance.now() - t0) / 1000, genau: 0, voll: 0, f1: 0, fehler: String(e.message ?? e).slice(0, 160), json: false })
      }
      const l = laeufe.at(-1)
      console.error(`${eintrag}  ${v.name}: F1 ${(l.f1 * 100).toFixed(0)} %  ${l.sek.toFixed(1)} s${l.fehler ? `  ${l.fehler}` : ''}`)
    }
    const mittel = (k) => laeufe.reduce((s, l) => s + (l[k] ?? 0), 0) / laeufe.length
    const kosten = laeufe.every((l) => l.usd !== undefined) ? laeufe.reduce((s, l) => s + l.usd, 0) / laeufe.length : undefined
    ergebnis.push({ modell: eintrag, suchen, f1: mittel('f1'), genau: mittel('genau'), voll: mittel('voll'), jsonQuote: laeufe.filter((l) => l.json).length / laeufe.length, sekMedian: median(laeufe.map((l) => l.sek)), usdJeGeraet: kosten, laeufe })
  }
  const pct = (x) => `${(x * 100).toFixed(0)} %`
  console.log('| Modell | F1 | Genauigkeit | Vollständigkeit | gültiges JSON | Zeit (Median) | USD/Gerät |')
  console.log('|---|---|---|---|---|---|---|')
  for (const e of ergebnis)
    console.log(`| ${e.modell}${e.suchen ? ` (${e.suchen} Suchen)` : ''} | ${pct(e.f1)} | ${pct(e.genau)} | ${pct(e.voll)} | ${pct(e.jsonQuote)} | ${e.sekMedian.toFixed(1)} s | ${e.usdJeGeraet === undefined ? '—' : e.usdJeGeraet.toFixed(4)} |`)
  const ziel = arg('--aus')
  if (ziel) writeFileSync(ziel, JSON.stringify({ datum: new Date().toISOString(), aufgaben: AUFGABEN, ergebnis }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) await haupt()
