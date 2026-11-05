// ───────────────────────────────────────────────────────────────────────────
// Ticket-Sortierer — Duplikate und fehlende Labels finden, bevor jemand sie
// abarbeitet.
//
// WARUM ES DAS GIBT (2026-11-05). Issues entstehen hier in Wellen (49 aus
// einer Screenshot-Sichtung am 27.10., Durchlaeufe mit Dutzenden Befunden).
// Was in so einer Welle doppelt steht, faellt erst auf, wenn beide bearbeitet
// sind. Vorbild ist der „Planer"-Agent aus Hahn 2026 (TH Koeln): jedes neue
// Ticket einmal gegen den Bestand abgleichen und klassifizieren.
//
// ZWEI STUFEN, mit Absicht verschieden teuer:
//   - Duplikate: TF-IDF und Kosinus ueber Titel + Text. Deterministisch,
//     kostenlos, ohne Modell — Aehnlichkeit von Woertern braucht keine KI.
//   - Labels (nur mit --ki): ein lokales Modell schlaegt aus den VORHANDENEN
//     Labels des Repos vor. Erfundene Labels werden verworfen.
//
// Schreibt nichts, solange --kommentieren fehlt. Mit --kommentieren bekommt
// jedes betroffene Issue EINEN Kommentar mit den Kandidaten — gesetzt wird
// weder Label noch Status; das entscheidet ein Mensch.
//
// Aufruf:
//   node scripts/issues/triage.mjs [--repo larszu/cable-planner] [--tage 14]
//                                  [--schwelle 0.45] [--ki] [--kommentieren]
//   --tage     nur Issues pruefen, die in den letzten N Tagen entstanden sind
//              (verglichen wird immer gegen alle, offen wie geschlossen)
//   --ki       Labels vorschlagen; KI_URL (Vorgabe http://localhost:11434/v1),
//              KI_MODELL (Vorgabe gemma4:26b), KI_KEY optional
// ───────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process'

const STOPP = new Set(
  `der die das den dem des ein eine einen einem einer und oder nicht kein keine ist sind wird werden wurde
  fuer für mit von vom zum zur beim auf aus bei nach als wie wenn dann auch noch schon nur man es sie er wir ich
  im in an am zu so da dass daß was wer hier dort jetzt mehr sehr ohne über ueber unter bis seit beim kann muss soll
  the a an and or not no is are be was were for with from to of in on at by as if then also only it this that
  these those there here can should must will would has have had do does did into out up down`.split(/\s+/),
)

export const woerter = (text) =>
  (text ?? '')
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !STOPP.has(w) && !/^\d+$/.test(w))

/** TF-IDF-Vektoren; Titel zaehlt dreifach, weil er die Absicht traegt. */
export const vektoren = (issues) => {
  const docs = issues.map((i) => [...woerter(i.title), ...woerter(i.title), ...woerter(i.title), ...woerter(i.body)])
  const df = new Map()
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1)
  const n = docs.length
  return docs.map((d) => {
    const tf = new Map()
    for (const w of d) tf.set(w, (tf.get(w) ?? 0) + 1)
    const v = new Map()
    let norm = 0
    for (const [w, c] of tf) {
      const x = (1 + Math.log(c)) * Math.log((n + 1) / (df.get(w) + 0.5))
      v.set(w, x)
      norm += x * x
    }
    norm = Math.sqrt(norm) || 1
    for (const [w, x] of v) v.set(w, x / norm)
    return v
  })
}

export const kosinus = (a, b) => {
  let s = 0
  const [klein, gross] = a.size < b.size ? [a, b] : [b, a]
  for (const [w, x] of klein) s += x * (gross.get(w) ?? 0)
  return s
}

const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))

const labelVorschlag = async (issue, labels) => {
  const url = (process.env.KI_URL ?? 'http://localhost:11434/v1').replace(/\/+$/, '')
  const res = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.KI_KEY ? { Authorization: `Bearer ${process.env.KI_KEY}` } : {}) },
    body: JSON.stringify({
      model: process.env.KI_MODELL ?? 'gemma4:26b',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: `Classify this GitHub issue. Pick 0-3 labels ONLY from this list: ${JSON.stringify(labels.map((l) => `${l.name}${l.description ? ` (${l.description})` : ''}`))}.
Also say which information a developer would still need to start (empty list if none).
Answer JSON: {"labels": [...names], "fehlt": [...short German phrases]}

Title: ${issue.title}
Body:
${(issue.body ?? '').slice(0, 6000)}`,
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  const j = await res.json()
  const a = JSON.parse(j.choices?.[0]?.message?.content ?? '{}')
  const erlaubt = new Set(labels.map((l) => l.name))
  return { labels: (a.labels ?? []).filter((l) => erlaubt.has(l)), fehlt: (a.fehlt ?? []).slice(0, 5) }
}

const haupt = async () => {
  const args = process.argv.slice(2)
  const arg = (n, v) => (args.includes(n) ? args[args.indexOf(n) + 1] : v)
  const repo = arg('--repo', 'larszu/cable-planner')
  const tage = Number(arg('--tage', '14'))
  const schwelle = Number(arg('--schwelle', '0.45'))
  const alle = gh(['issue', 'list', '-R', repo, '--state', 'all', '--limit', '5000', '--json', 'number,title,body,state,labels,createdAt'])
  const v = vektoren(alle)
  const grenze = Date.now() - tage * 864e5
  const pruefen = alle.map((i, k) => [i, k]).filter(([i]) => i.state === 'OPEN' && Date.parse(i.createdAt) >= grenze)
  const labels = args.includes('--ki') ? gh(['label', 'list', '-R', repo, '--limit', '200', '--json', 'name,description']) : []

  console.log(`# Triage ${repo} — ${pruefen.length} offene Issues der letzten ${tage} Tage gegen ${alle.length}\n`)
  for (const [issue, k] of pruefen) {
    const kandidaten = alle
      .map((j, m) => [j, m === k ? 0 : kosinus(v[k], v[m])])
      .filter(([j, s]) => s >= schwelle && j.number !== issue.number)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    let ki
    if (labels.length) {
      try {
        ki = await labelVorschlag(issue, labels)
      } catch (e) {
        ki = { fehler: String(e.message ?? e) }
      }
    }
    const neueLabels = ki?.labels?.filter((l) => !issue.labels.some((x) => x.name === l)) ?? []
    if (!kandidaten.length && !neueLabels.length && !ki?.fehlt?.length && !ki?.fehler) continue
    console.log(`## #${issue.number} ${issue.title}`)
    for (const [j, s] of kandidaten) console.log(`- ähnlich: #${j.number} (${j.state === 'OPEN' ? 'offen' : 'geschlossen'}, ${(s * 100).toFixed(0)} %) ${j.title}`)
    if (neueLabels.length) console.log(`- Labels: ${neueLabels.join(', ')}`)
    if (ki?.fehlt?.length) console.log(`- fehlt: ${ki.fehlt.join('; ')}`)
    if (ki?.fehler) console.log(`- KI nicht erreichbar: ${ki.fehler}`)
    console.log()
    if (args.includes('--kommentieren') && kandidaten.length) {
      const text = [
        'Mögliche Duplikate (automatischer Abgleich, `scripts/issues/triage.mjs`):',
        ...kandidaten.map(([j, s]) => `- #${j.number} — ${(s * 100).toFixed(0)} % Ähnlichkeit`),
        ...(neueLabels.length ? [`\nVorgeschlagene Labels: ${neueLabels.join(', ')}`] : []),
      ].join('\n')
      execFileSync('gh', ['issue', 'comment', String(issue.number), '-R', repo, '--body', text])
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await haupt()
