import { describe, expect, it } from 'vitest'
import { portDisplayLabel, portLabelPair, shortenForAtem } from '../src/renderer/lib/portLabel'

describe('shortenForAtem', () => {
  it('macht aus dem technischen Portnamen die inhaltliche Kurzform', () => {
    expect(shortenForAtem('1 SDI 3G PGM (1080p50/60)')).toBe('PGM')
  })

  it('entfernt fuehrende Portnummern und Format-Suffixe', () => {
    expect(shortenForAtem('2 Kamera Buehne (1080p50)')).toBe('Kamera Buehne')
  })

  it('verstuemmelt "SDI 1" NICHT zur nackten "1"', () => {
    // Der Kommentar der Funktion schliesst genau das aus; die Schleife tat es
    // trotzdem, weil sie das Ergebnis bedingungslos uebernahm.
    expect(shortenForAtem('SDI 1')).toBe('SDI 1')
    expect(shortenForAtem('HDMI 2')).toBe('HDMI 2')
  })

  it('laesst einen Namen ohne Stecker-Token unangetastet', () => {
    expect(shortenForAtem('Kamera 1')).toBe('Kamera 1')
  })

  it('faellt auf den Rohtext zurueck, statt leer zu liefern', () => {
    expect(shortenForAtem('SDI')).toBe('SDI')
  })
})

describe('portDisplayLabel', () => {
  it('bevorzugt das inhaltliche Label vor dem Portnamen', () => {
    expect(portDisplayLabel({ name: '1 SDI 3G', contentLabel: 'PGM' })).toBe('PGM')
    expect(portDisplayLabel({ name: '1 SDI 3G', contentLabel: '  ' })).toBe('1 SDI 3G')
  })
})

describe('portLabelPair', () => {
  it('liefert beide Zeilen nur, wenn sie sich unterscheiden', () => {
    expect(portLabelPair({ name: '1 SDI 3G', contentLabel: 'PGM' })).toEqual({
      main: 'PGM',
      subline: '1 SDI 3G',
    })
    expect(portLabelPair({ name: 'PGM', contentLabel: 'PGM' })).toEqual({ main: 'PGM' })
  })
})
