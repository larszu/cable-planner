import { describe, expect, it } from 'vitest'
import {
  bestApprovalCandidate,
  looksLikeApproval,
  parsePastedApproval,
} from '../src/renderer/lib/approvalCapture'

describe('eingefügter Chat wird zerlegt, nicht geraten', () => {
  it('liest die deutsche iOS-Form mit Sekunden', () => {
    const m = parsePastedApproval('[09.09.26, 20:14:03] Max Mustermann: ja, macht die Überstunden')
    expect(m).toHaveLength(1)
    expect(m[0].givenAt).toBe('2026-09-09T20:14:03')
    expect(m[0].by).toBe('Max Mustermann')
    expect(m[0].text).toBe('ja, macht die Überstunden')
    expect(m[0].style).toBe('day-first')
  })

  it('liest die Android-Form mit Bindestrich', () => {
    const m = parsePastedApproval('09.09.26, 20:14 - Max Mustermann: passt so')
    expect(m[0].givenAt).toBe('2026-09-09T20:14:00')
    expect(m[0].by).toBe('Max Mustermann')
  })

  it('liest die englische Form mit PM', () => {
    const m = parsePastedApproval('[9/9/26, 8:14:03 PM] Ops: yes, go ahead')
    expect(m[0].givenAt).toBe('2026-09-09T20:14:03')
    expect(m[0].style).toBe('month-first')
  })

  it('erkennt 12 AM als Mitternacht und 12 PM als Mittag', () => {
    expect(parsePastedApproval('[9/9/26, 12:05:00 AM] A: x')[0].givenAt).toBe('2026-09-09T00:05:00')
    expect(parsePastedApproval('[9/9/26, 12:05:00 PM] A: x')[0].givenAt).toBe('2026-09-09T12:05:00')
  })

  it('nimmt bei Schrägstrichen den Tag zuerst, wenn die erste Zahl kein Monat sein kann', () => {
    // 13/2/26 kann nur der 13. Februar sein.
    const m = parsePastedApproval('[13/2/26, 09:00] A: ok')
    expect(m[0].givenAt).toBe('2026-02-13T09:00:00')
    expect(m[0].style).toBe('day-first')
  })

  it('unterscheidet Punkt- und Schrägstrich-Schreibweise am mehrdeutigen Datum', () => {
    // 3.2.26 ist der 3. Februar, 3/2/26 der 2. März.
    expect(parsePastedApproval('[3.2.26, 09:00] A: ok')[0].givenAt).toBe('2026-02-03T09:00:00')
    expect(parsePastedApproval('[3/2/26, 09:00] A: ok')[0].givenAt).toBe('2026-03-02T09:00:00')
  })
})

describe('was nicht dasteht, wird nicht erfunden', () => {
  it('gibt einem abgetippten Satz KEINEN Zeitpunkt und KEINEN Absender', () => {
    const m = parsePastedApproval('Der Kunde hat am Telefon zugestimmt.')
    expect(m).toHaveLength(1)
    expect(m[0].givenAt).toBeUndefined()
    expect(m[0].by).toBeUndefined()
    expect(m[0].text).toBe('Der Kunde hat am Telefon zugestimmt.')
    expect(m[0].style).toBe('none')
  })

  it('verwirft eine unmögliche Uhrzeit, statt sie zu verbiegen', () => {
    const m = parsePastedApproval('[09.09.26, 25:99] A: ok')
    expect(m[0].givenAt).toBeUndefined()
    // Der Text bleibt vollständig — er ist der Beleg.
    expect(m[0].text).toContain('25:99')
  })

  it('verwirft einen unmöglichen Monat', () => {
    const m = parsePastedApproval('[09/45/26, 09:00] A: ok')
    expect(m[0].givenAt).toBeUndefined()
  })

  it('gibt bei leerem Text gar nichts zurück', () => {
    expect(parsePastedApproval('   \n  \n')).toEqual([])
  })
})

describe('mehrere Nachrichten', () => {
  const verlauf = [
    '[09.09.26, 19:58:11] Anna Berg: wir brauchen zwei Stunden länger, ok?',
    '[09.09.26, 20:14:03] Max Mustermann: ja, macht das und stellt es uns',
    'in Rechnung',
    '[09.09.26, 20:15:00] Anna Berg: danke',
  ].join('\n')

  it('zerlegt den Verlauf in einzelne Nachrichten', () => {
    expect(parsePastedApproval(verlauf)).toHaveLength(3)
  })

  it('hängt eine Fortsetzungszeile an die Nachricht davor', () => {
    const m = parsePastedApproval(verlauf)
    expect(m[1].text).toBe('ja, macht das und stellt es uns\nin Rechnung')
  })

  it('schlägt die LETZTE Nachricht mit Zusagewort vor, nicht die erste', () => {
    const k = bestApprovalCandidate(parsePastedApproval(verlauf))
    expect(k?.by).toBe('Max Mustermann')
    expect(k?.givenAt).toBe('2026-09-09T20:14:03')
  })

  it('schlägt ohne Zusagewort die letzte Nachricht vor und erfindet keine Zustimmung', () => {
    const m = parsePastedApproval('[09.09.26, 20:14:03] Max: schau ich mir morgen an')
    const k = bestApprovalCandidate(m)
    expect(k?.text).toBe('schau ich mir morgen an')
    expect(looksLikeApproval(k?.text ?? '')).toBe(false)
  })
})

describe('die Zusagewörter sind ein Vorschlag und kein Urteil', () => {
  it('erkennt die üblichen Formen', () => {
    for (const s of ['ja, macht das', 'ok', 'passt so', 'geht klar', 'yes please']) {
      expect(looksLikeApproval(s), s).toBe(true)
    }
  })

  it('hält eine Absage nicht für eine Zusage', () => {
    for (const s of ['bitte nicht', 'das machen wir nächstes Jahr', 'kein Budget']) {
      expect(looksLikeApproval(s), s).toBe(false)
    }
  })

  it('greift nicht mitten im Wort', () => {
    // „Jacke" faengt mit „ja" an, „Gokart" enthaelt „go".
    expect(looksLikeApproval('die Jacke liegt im Truck')).toBe(false)
    expect(looksLikeApproval('Gokart-Halle')).toBe(false)
  })
})
