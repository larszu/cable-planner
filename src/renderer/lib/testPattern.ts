/**
 * Ein Prüfbild, das seinen eigenen Namen trägt (Eigentümer-Wunsch vom
 * 2026-09-08: „Testpattern generieren mit dem Namen der Quelle und ner SMPTE
 * bar … um zu sehen wo was ankommt").
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DER NAME DER EIGENTLICHE INHALT IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Farbbalken allein beantworten die Frage NICHT. Wer vor einem Monitor steht
 * und Balken sieht, weiss: „hier kommt irgendein Signal an". Er weiss nicht,
 * WELCHES — und genau das ist die Frage bei einer Inbetriebnahme. Zwei
 * vertauschte Kreuzpunkte sehen mit Balken auf beiden Wegen völlig richtig
 * aus.
 *
 * Der Name macht daraus einen Beweis: steht auf dem Monitor im Regieraum
 * „KAMERA 3", wo der Plan „KAMERA 1" vorsieht, ist die Vertauschung in dem
 * Moment gefunden, in dem jemand hinsieht — ohne Messgerät, ohne zweiten
 * Techniker am Funk.
 *
 * Deshalb ist der Name gross, oben, und in einer Schrift ohne Feinheiten:
 * er muss von der anderen Seite eines Regieraums auf einem 7-Zoll-Monitor
 * lesbar sein.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DIESE DATEI IST — UND WAS SIE NICHT IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Sie ERZEUGT ein Bild. Sie misst nichts, sie sendet nichts, und sie ist
 * ausdrücklich KEIN Messnormal: die Farbwerte hier sind die üblichen 75-%-
 * Balken in sRGB, gut genug, um einen Weg zu identifizieren, und nicht gut
 * genug, um einen Monitor danach einzustellen. Wer eine Kalibrierung
 * braucht, nimmt einen Generator; das steht auch auf dem Bild.
 *
 * Das Bild geht in einen Mediaplayer, auf einen Laptop am HDMI-Ausgang, in
 * den Standbild-Speicher eines Mischers oder auf ein USB-Stick am
 * Testgenerator. Diese App speist nichts ein — sie hat keinen Videoausgang.
 */

/** Die klassischen 75-%-Balken, obere Reihe (links nach rechts). */
const OBERE_REIHE = [
  '#bfbfbf', // 75 % Weiss
  '#bfbf00', // Gelb
  '#00bfbf', // Cyan
  '#00bf00', // Gruen
  '#bf00bf', // Magenta
  '#bf0000', // Rot
  '#0000bf', // Blau
] as const

/** Die schmale Mittelreihe: umgekehrte Folge, Blau/Schwarz im Wechsel. */
const MITTLERE_REIHE = [
  '#0000bf',
  '#131313',
  '#bf00bf',
  '#131313',
  '#00bfbf',
  '#131313',
  '#bfbfbf',
] as const

/**
 * Die untere Reihe mit dem PLUGE-Feld.
 *
 * Die drei Stufen ganz rechts (-4 / 0 / +4 IRE als sRGB-Naeherung) sind der
 * einzige Teil des Bildes, der ueberhaupt etwas ueber die ANZEIGE sagt: sind
 * die aeusseren beiden Streifen unterscheidbar, steht der Schwarzwert grob.
 * Als Naeherung benannt, damit niemand sie fuer eine Messung haelt.
 */
const UNTERE_REIHE = [
  { farbe: '#00214c', breite: 5 / 28 }, // -I
  { farbe: '#ffffff', breite: 5 / 28 }, // 100 % Weiss
  { farbe: '#32006a', breite: 5 / 28 }, // +Q
  { farbe: '#131313', breite: 5 / 28 },
  { farbe: '#050505', breite: 1 / 28 }, // PLUGE unter Schwarz
  { farbe: '#131313', breite: 1 / 28 },
  { farbe: '#1f1f1f', breite: 1 / 28 }, // PLUGE ueber Schwarz
  { farbe: '#131313', breite: 5 / 28 },
] as const

export interface TestPatternInput {
  /** Der Name, um den es geht — die Quelle, wie sie im Plan heisst. */
  name: string
  /** Zweite Zeile: Port, Rolle, Kreuzpunkt — was den Weg genauer benennt. */
  zeile2?: string
  /** Dritte Zeile: Projekt und Dokument-Code (ADR-004). */
  zeile3?: string
  /** Bildbreite in Pixeln. Die Hoehe folgt dem Seitenverhaeltnis. */
  breite?: number
  /** Seitenverhaeltnis. Vorgabe 16:9. */
  seitenverhaeltnis?: number
}

/** Text, der in einem SVG-Attribut oder -Knoten stehen darf. */
const sicher = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Das Prüfbild als SVG.
 *
 * SVG und nicht PNG, weil es ohne Bibliothek auskommt, in jeder Groesse
 * scharf bleibt und sich in einem Blatt einbetten laesst. Wer eine
 * Bilddatei braucht, rendert es einmal im Browser — das tut
 * `renderTestPatternPng` an der Oberflaeche.
 */
export const testPatternSvg = (input: TestPatternInput): string => {
  const breite = Math.max(160, Math.round(input.breite ?? 1920))
  const hoehe = Math.round(breite / (input.seitenverhaeltnis ?? 16 / 9))

  const oben = Math.round(hoehe * 0.62)
  const mitte = Math.round(hoehe * 0.08)
  const unten = hoehe - oben - mitte
  const spalte = breite / OBERE_REIHE.length

  const teile: string[] = []
  teile.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${hoehe}" viewBox="0 0 ${breite} ${hoehe}" role="img" aria-label="${sicher(input.name)}">`,
  )
  teile.push(`<rect width="${breite}" height="${hoehe}" fill="#131313"/>`)

  OBERE_REIHE.forEach((farbe, i) => {
    teile.push(
      `<rect x="${(i * spalte).toFixed(2)}" y="0" width="${spalte.toFixed(2)}" height="${oben}" fill="${farbe}"/>`,
    )
  })
  MITTLERE_REIHE.forEach((farbe, i) => {
    teile.push(
      `<rect x="${(i * spalte).toFixed(2)}" y="${oben}" width="${spalte.toFixed(2)}" height="${mitte}" fill="${farbe}"/>`,
    )
  })
  let x = 0
  for (const feld of UNTERE_REIHE) {
    const w = breite * feld.breite
    teile.push(
      `<rect x="${x.toFixed(2)}" y="${oben + mitte}" width="${w.toFixed(2)}" height="${unten}" fill="${feld.farbe}"/>`,
    )
    x += w
  }

  // Das Namensfeld. Es liegt AUF den Balken und nicht daneben: ein Streifen
  // unter dem Bild faellt weg, sobald jemand das Bild formatfuellend auf
  // einen 4:3-Monitor legt — und dann steht auf dem Monitor ein Prueffbild
  // ohne Namen, also wieder das Bild, das die Frage nicht beantwortet.
  const feldH = Math.round(hoehe * 0.3)
  const feldY = Math.round(hoehe * 0.2)
  const feldX = Math.round(breite * 0.06)
  const feldW = breite - feldX * 2
  teile.push(
    `<rect x="${feldX}" y="${feldY}" width="${feldW}" height="${feldH}" fill="#000000" fill-opacity="0.82" rx="${Math.round(hoehe * 0.02)}"/>`,
  )

  const namenGroesse = Math.round(hoehe * 0.15)
  teile.push(
    `<text x="${breite / 2}" y="${feldY + feldH * 0.52}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${namenGroesse}" text-anchor="middle" dominant-baseline="middle" textLength="${Math.min(feldW * 0.94, namenGroesse * 0.62 * Math.max(1, input.name.length))}" lengthAdjust="spacingAndGlyphs">${sicher(input.name)}</text>`,
  )
  if (input.zeile2) {
    teile.push(
      `<text x="${breite / 2}" y="${feldY + feldH * 0.82}" fill="#e5e7eb" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(hoehe * 0.055)}" text-anchor="middle" dominant-baseline="middle">${sicher(input.zeile2)}</text>`,
    )
  }
  if (input.zeile3) {
    teile.push(
      `<text x="${breite / 2}" y="${hoehe - Math.round(hoehe * 0.035)}" fill="#9ca3af" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(hoehe * 0.032)}" text-anchor="middle" dominant-baseline="middle">${sicher(input.zeile3)}</text>`,
    )
  }
  teile.push('</svg>')
  return teile.join('')
}

/** Das Bild als `data:`-URI — direkt in ein `<img>` oder einen Export. */
export const testPatternDataUri = (input: TestPatternInput): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(testPatternSvg(input))}`
