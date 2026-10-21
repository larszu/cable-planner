/**
 * Suche der Befehlspalette (#1025).
 *
 * Die Palette ist der Weg zu jeder Funktion, die man im Menue nicht findet.
 * Darum sucht sie nicht nur im Titel, sondern auch in der Kurzbeschreibung,
 * der Gruppe und in Synonymen (`keywords`, absichtlich zweisprachig: wer
 * „Etikett" tippt, soll die QR-Labels auch in der englischen Oberflaeche
 * finden). Jedes Suchwort muss irgendwo vorkommen; Treffer im Titel stehen
 * vorn.
 */

export interface SearchableCommand {
  title: string
  group: string
  note?: string
  keywords?: string
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')

export const searchCommands = <T extends SearchableCommand>(commands: T[], query: string): T[] => {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return commands
  const scored: { c: T; score: number; i: number }[] = []
  commands.forEach((c, i) => {
    const title = norm(c.title)
    const hay = `${title} ${norm(c.group)} ${norm(c.note ?? '')} ${norm(c.keywords ?? '')}`
    if (!words.every((w) => hay.includes(w))) return
    const score =
      (title.startsWith(words[0]) ? 0 : 1) + words.filter((w) => !title.includes(w)).length
    scored.push({ c, score, i })
  })
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((x) => x.c)
}
