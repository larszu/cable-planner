import { describe, expect, it } from 'vitest'
import { teile } from '../src/renderer/lib/panelHint'
import addrQuelle from '../src/renderer/components/Network/AddressTemplatePanel.tsx?raw'
import segQuelle from '../src/renderer/components/Network/SegmentsPanel.tsx?raw'

/**
 * BEDARF DES NUTZERS, 2026-09-07: „Auch viele schriftliche Informationen die
 * überladen wirken aus Enduser-Ansicht."
 *
 * Nachgemessen im laufenden Fenster (Electron, Beispielprojekt geladen):
 * das Hauptfenster traegt 219 Zeichen Fliesstext, der Analysen-Dialog auf dem
 * Netzwerk-Reiter **3.327 Zeichen in 25 Bloecken**, einzelne davon 349
 * Zeichen. `PanelHint` schneidet den ersten Satz heraus und stellt den Rest
 * hinter „mehr".
 */
describe('PanelHint teilt den Erklaersatz', () => {
  it('trennt nach dem ersten Satz', () => {
    const { kopf, rest } = teile(
      'Die Haus-Ebene ersetzt einen stehenden Bereich mit demselben Schlüssel und lässt alle anderen stehen. Vergeben wird nichts von allein — der Umzug wird vorgeschlagen und einzeln übernommen.',
    )
    expect(kopf).toBe(
      'Die Haus-Ebene ersetzt einen stehenden Bereich mit demselben Schlüssel und lässt alle anderen stehen.',
    )
    expect(rest.startsWith('Vergeben wird nichts von allein')).toBe(true)
  })

  it('laesst einen einzelnen Satz unangetastet', () => {
    // Ein Aufklapper, hinter dem nichts steckt, ist schlimmer als der Satz.
    const { kopf, rest } = teile('Noch keine Ebene angelegt.')
    expect(kopf).toBe('Noch keine Ebene angelegt.')
    expect(rest).toBe('')
  })

  it('zerschneidet keine Abkuerzung und keine Adresse', () => {
    // „z. B." und „192.168.1.0/24" haben Punkte mitten im Wort. Getrennt wird
    // nur vor einem Grossbuchstaben mit Leerzeichen davor.
    for (const text of [
      'Der Bereich 192.168.1.0/24 gehört dem Haus und wird nicht verändert.',
      'Gilt für den Weg, z. B. seriell oder über TCP, nicht für das Modell.',
    ]) {
      const { kopf, rest } = teile(text)
      expect(rest, `nicht trennen in: ${text}`).toBe('')
      expect(kopf).toBe(text)
    }
  })

  it('trennt nicht vor dem 20. Zeichen', () => {
    // „OK. Der Rest …" waere ein Kopf, der nichts sagt.
    const { rest } = teile('OK. Der Plan nennt kein Subnetz, weil Adressen oder Masken fehlen.')
    expect(rest).toBe('')
  })

  it('wird von den langen Hinweisen wirklich benutzt', () => {
    // Sonst waere die Komponente gebaut und niemand benutzte sie — genau die
    // Sorte Aenderung, die in der Zusammenfassung gut klingt und im Fenster
    // nichts tut.
    for (const [name, quelle] of [
      ['AddressTemplatePanel', addrQuelle],
      ['SegmentsPanel', segQuelle],
    ] as const) {
      expect(quelle, `${name} benutzt PanelHint`).toContain('<PanelHint')
      // Und der lange Hinweis liegt nicht mehr roh in einem <p>.
      expect(quelle, `${name} hat keinen rohen Hinweis-Absatz mehr`).not.toMatch(
        /<p className="mb-2 text-cp-text-muted">\s*\{t\(\s*'[a-zA-Z.]+\.hint'/,
      )
    }
  })
})

describe('teile schneidet nicht hinter einer Ordnungszahl', () => {
  it('laesst „Intermodulation 3. Ordnung" zusammen', () => {
    // Gefunden im Funkstrecken-Dialog: der sichtbare Teil endete mit
    // „Intermodulation 3." — der Begriff war mitten durchgeschnitten, und
    // wer nicht aufklappte, las etwas anderes als dasteht.
    const text =
      'Geprüft: Trägerabstand + Intermodulation 3. Ordnung (2- und 3-Sender-Produkte). Treffer heißt: die Frequenz liegt zu dicht an einem Produkt.'
    const { kopf } = teile(text)
    expect(kopf).toContain('3. Ordnung')
    expect(kopf.endsWith('Intermodulation 3.')).toBe(false)
  })

  it('schneidet weiterhin am echten Satzende', () => {
    const { kopf, rest } = teile('Der erste Satz steht hier. Der zweite erklaert warum.')
    expect(kopf).toBe('Der erste Satz steht hier.')
    expect(rest).toBe('Der zweite erklaert warum.')
  })
})
