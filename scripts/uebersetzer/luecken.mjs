// ───────────────────────────────────────────────────────────────────────────
// Uebersetzungsluecken finden — und auf Wunsch schliessen.
//
// WARUM ES DAS GIBT (2026-11-05). Englisch ist die Quellsprache (E-28), jedes
// `t('key', 'English')` zeigt ohne Eintrag in `i18n/de.ts` dem deutschen
// Nutzer Englisch. Kein Test faellt dabei: der Fallback greift, die Oberflaeche
// bleibt lesbar. Genau deshalb waechst die Luecke unbemerkt.
//
// Vorbild ist der „Uebersetzer"-Agent aus Hahn 2026 (TH Koeln, Masterarbeit
// „Integration lokaler KI-Agenten"): Quelle aendert sich → Luecke wird
// maschinell geschlossen → als eigener, erkennbarer Commit vorgelegt. Zwei
// Befunde von dort bestimmen die Form:
//   - Ein Allround-Modell uebersetzt kurze UI-Zeichenketten so gut wie ein
//     Uebersetzungs-Spezialmodell (Gemma 3/4 vs. TranslateGemma). Vorgabe ist
//     deshalb ein lokales Gemma 4 ueber Ollama — kostenlos, nichts verlaesst
//     den Rechner.
//   - Alle 16 Modelle hielten Platzhalter ein, aber nur, weil es GEPRUEFT
//     wurde. Hier wird jede Antwort verworfen, deren `{…}`-Platzhalter nicht
//     exakt denen der Quelle entsprechen. Was verworfen wird, bleibt Luecke.
//
// Aufruf:
//   node scripts/uebersetzer/luecken.mjs                 Luecken auflisten
//   node scripts/uebersetzer/luecken.mjs --max 0         …und mit 1 beenden, wenn es welche gibt
//   node scripts/uebersetzer/luecken.mjs --uebersetzen   Luecken schliessen (schreibt de.ts)
//   node scripts/uebersetzer/luecken.mjs --pruefen 50    Modell an 50 vorhandenen Eintraegen messen
//
// ERST PRUEFEN, DANN UEBERSETZEN LASSEN. `--pruefen` uebersetzt Eintraege,
// die schon eine (menschliche) deutsche Fassung haben, und vergleicht mit
// chrF (Zeichen-n-Gramme, beta 2 — das Mass der Arbeit). Gemma 4 26B lag
// dort bei 76,7, Cloud-Modelle bei 76–79; deutlich darunter heisst: dieses
// Modell nicht fuer `--uebersetzen` benutzen. Schreibt nichts.
//
// Umgebung (OpenAI-kompatibel; Ollama, LM Studio, OpenAI, OpenRouter …):
//   UEBERSETZER_URL     Vorgabe http://localhost:11434/v1
//   UEBERSETZER_MODELL  Vorgabe gemma4:26b
//   UEBERSETZER_KEY     nur fuer Anbieter mit Schluessel
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WURZEL = 'src/renderer'
const WOERTERBUCH = 'src/renderer/lib/i18n/de.ts'
/** Wird in `de.ts` eingespreizt (`...KANONISCH_DE`); seine Schluessel zaehlen mit. */
const KANONISCH = 'src/renderer/lib/kanonischDe.ts'
const MARKE = '  // ── maschinell übersetzt (scripts/uebersetzer) — beim Lesen prüfen ──'
const STAPEL = 40

const args = process.argv.slice(2)
const wert = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}

/** key + englischer Fallback aus `t('k','F')`, `tr(…)`, `translate(lang,'k','F')`. */
const AUFRUF =
  /\b(?:t|tr|translate)\(\s*(?:[A-Za-z]+\s*,\s*)?'([^'\n]+)'\s*,\s*(['"])((?:[^\\\n]|\\.)*?)\2\s*[,)]/g

const dateien = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === 'vendor' || n === 'i18n' ? [] : dateien(p)
    return /\.(ts|tsx)$/.test(n) ? [p] : []
  })

const ohneEscape = (s, q) => s.replace(new RegExp(`\\\\${q}`, 'g'), q).replace(/\\n/g, '\n')

export const quellTexte = (wurzel = WURZEL) => {
  const gefunden = new Map()
  for (const datei of dateien(wurzel)) {
    const ohneKommentare = readFileSync(datei, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
    for (const m of ohneKommentare.matchAll(AUFRUF)) {
      if (!gefunden.has(m[1])) gefunden.set(m[1], { en: ohneEscape(m[3], m[2]), datei })
    }
  }
  return gefunden
}

export const vorhandeneSchluessel = (text) =>
  new Set([...text.matchAll(/^\s*'([^'\n]+)'\s*:/gm)].map((m) => m[1]))

export const platzhalter = (s) => [...s.matchAll(/\{[^{}]*\}/g)].map((m) => m[0]).sort().join('|')

/** Eine Antwort taugt nur, wenn sie nicht leer ist und dieselben Platzhalter traegt. */
export const pruefe = (en, de) =>
  typeof de === 'string' && de.trim() !== '' && platzhalter(en) === platzhalter(de)

const glossar = (text, n = 60) =>
  [...text.matchAll(/^\s*'([^'\n]+)'\s*:\s*'((?:[^'\\]|\\.)*)',?$/gm)]
    .filter((m) => m[2].length > 3 && m[2].length < 60)
    .filter((_, i, a) => i % Math.max(1, Math.floor(a.length / n)) === 0)
    .slice(0, n)
    .map((m) => m[2])

const frage = async (eintraege, beispiele) => {
  const url = (process.env.UEBERSETZER_URL ?? 'http://localhost:11434/v1').replace(/\/+$/, '')
  const modell = process.env.UEBERSETZER_MODELL ?? 'gemma4:26b'
  const prompt = `Translate the user-interface strings of a broadcast cable-planning app from English to German.
Rules: keep every {placeholder} exactly; keep units, connector names (XLR, BNC, SDI, HDMI, RJ45), product names and keyboard shortcuts unchanged; use the same terminology and tone as these existing German strings: ${JSON.stringify(beispiele)}.
Answer with one JSON object mapping each key to its German text, nothing else.

${JSON.stringify(Object.fromEntries(eintraege.map(([k, v]) => [k, v.en])), null, 1)}`
  const res = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.UEBERSETZER_KEY ? { Authorization: `Bearer ${process.env.UEBERSETZER_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: modell,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`${url} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const inhalt = json.choices?.[0]?.message?.content ?? '{}'
  return JSON.parse(inhalt.replace(/^```(?:json)?\s*|\s*```$/g, ''))
}

/** chrF (Popović 2015): F-Mass ueber Zeichen-n-Gramme 1..6, Leerzeichen ignoriert, beta = 2. */
export const chrF = (hyp, ref, nMax = 6, beta = 2) => {
  const grams = (s, n) => {
    const t = s.replace(/\s+/g, '')
    const m = new Map()
    for (let i = 0; i + n <= t.length; i++) m.set(t.slice(i, i + n), (m.get(t.slice(i, i + n)) ?? 0) + 1)
    return m
  }
  let p = 0
  let r = 0
  let stufen = 0
  for (let n = 1; n <= nMax; n++) {
    const h = grams(hyp, n)
    const g = grams(ref, n)
    const hs = [...h.values()].reduce((a, b) => a + b, 0)
    const gs = [...g.values()].reduce((a, b) => a + b, 0)
    if (!hs || !gs) continue
    let gemein = 0
    for (const [k, c] of h) gemein += Math.min(c, g.get(k) ?? 0)
    p += gemein / hs
    r += gemein / gs
    stufen++
  }
  if (!stufen) return 0
  p /= stufen
  r /= stufen
  return p + r ? ((1 + beta ** 2) * p * r) / (beta ** 2 * p + r) : 0
}

const alsZeile = (k, de) => `  '${k}': '${de.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}',`

const haupt = async () => {
  const dict = readFileSync(WOERTERBUCH, 'utf8')
  const da = vorhandeneSchluessel(dict + readFileSync(KANONISCH, 'utf8'))
  const luecken = [...quellTexte()].filter(([k]) => !da.has(k))
  for (const [k, v] of luecken) console.log(`${k}\t${v.en}\t${v.datei}`)
  console.log(`\n${luecken.length} Schluessel ohne deutsche Fassung.`)

  const pruefen = wert('--pruefen')
  if (pruefen !== undefined) {
    const werte = new Map([...dict.matchAll(/^\s*'([^'\n]+)'\s*:\s*'((?:[^'\\]|\\.)*)',?$/gm)].map((m) => [m[1], m[2].replace(/\\'/g, "'")]))
    const kandidaten = [...quellTexte()].filter(([k, v]) => werte.has(k) && v.en.length >= 12)
    const n = Math.min(Number(pruefen) || 50, kandidaten.length)
    const schritt = Math.max(1, Math.floor(kandidaten.length / n))
    const probe = kandidaten.filter((_, i) => i % schritt === 0).slice(0, n)
    const t0 = performance.now()
    const antwort = await frage(probe, glossar(dict))
    let summe = 0
    let platz = 0
    for (const [k, v] of probe) {
      const de = typeof antwort[k] === 'string' ? antwort[k] : ''
      summe += chrF(de, werte.get(k))
      if (pruefe(v.en, de)) platz++
    }
    console.log(`Modell ${process.env.UEBERSETZER_MODELL ?? 'gemma4:26b'}: chrF ${((summe / probe.length) * 100).toFixed(1)} · Platzhalter korrekt ${platz}/${probe.length} · ${((performance.now() - t0) / 1000).toFixed(1)} s`)
    return
  }
  const max = wert('--max')
  if (max !== undefined && luecken.length > Number(max)) process.exit(1)
  if (!args.includes('--uebersetzen') || luecken.length === 0) return

  const beispiele = glossar(dict)
  const neu = []
  const verworfen = []
  for (let i = 0; i < luecken.length; i += STAPEL) {
    const stapel = luecken.slice(i, i + STAPEL)
    const antwort = await frage(stapel, beispiele)
    for (const [k, v] of stapel) {
      if (pruefe(v.en, antwort[k])) neu.push(alsZeile(k, antwort[k].trim()))
      else verworfen.push(k)
    }
    console.log(`… ${Math.min(i + STAPEL, luecken.length)}/${luecken.length}`)
  }
  if (neu.length) {
    const ende = dict.lastIndexOf('\n}')
    if (ende === -1) throw new Error(`${WOERTERBUCH}: Ende des Woerterbuchs nicht gefunden`)
    const block = dict.includes(MARKE) ? neu.join('\n') : `${MARKE}\n${neu.join('\n')}`
    writeFileSync(WOERTERBUCH, `${dict.slice(0, ende)}\n${block}${dict.slice(ende)}`)
  }
  console.log(`${neu.length} eingetragen, ${verworfen.length} verworfen (Platzhalter oder leer).`)
  if (verworfen.length) console.log(verworfen.join('\n'))
}

if (import.meta.url === `file://${process.argv[1]}`) await haupt()
