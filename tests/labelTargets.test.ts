import { describe, expect, it } from 'vitest'
import {
  LABEL_TARGETS,
  allLabelTargets,
  collisionsForTarget,
  fitToTarget,
  utf8Length,
} from '../src/renderer/lib/labelTargets'
import { DANTE_MAX_LENGTH } from '../src/renderer/lib/danteNaming'

describe('utf8Length', () => {
  it('zaehlt Bytes, nicht Zeichen — ein Umlaut kostet zwei', () => {
    expect(utf8Length('Cam')).toBe(3)
    expect(utf8Length('Bühne')).toBe(6)
    expect(utf8Length('€')).toBe(3)
  })
})

describe('fitToTarget — ATEM-Kurzname (4 Byte)', () => {
  const spec = LABEL_TARGETS['atem-input-short']

  it('schneidet auf das Budget ab', () => {
    const f = fitToTarget('CAM10', spec)
    expect(f.value).toBe('CAM1')
    expect(f.truncated).toBe(true)
  })

  it('laesst Passendes unangetastet', () => {
    const f = fitToTarget('PGM', spec)
    expect(f).toMatchObject({ value: 'PGM', truncated: false, invalidChars: [] })
  })

  it('zerlegt kein Mehr-Byte-Zeichen — lieber ein Zeichen weniger', () => {
    // "BÜH" ist 4 Byte; "BÜHN" waere 5 und passt nicht mehr.
    const f = fitToTarget('BÜHNE', spec)
    expect(f.value).toBe('BÜH')
    expect(utf8Length(f.value)).toBeLessThanOrEqual(4)
  })

  it('meldet Zeichen, die das Ziel gar nicht darstellt', () => {
    expect(fitToTarget('BÜHNE', spec).invalidChars).toEqual(['Ü'])
  })

  it('meldet jedes ungueltige Zeichen nur einmal', () => {
    expect(fitToTarget('ÄÄÖ', spec).invalidChars).toEqual(['Ä', 'Ö'])
  })
})

describe('fitToTarget — Videohub (kein Laengenlimit, aber ein Dateiformat)', () => {
  const spec = LABEL_TARGETS['videohub-label']

  it('kuerzt nicht, weil kein Budget belegt ist', () => {
    const long = 'Ein sehr langer Port-Name der nirgends abgeschnitten wird'
    expect(fitToTarget(long, spec)).toMatchObject({ value: long, truncated: false })
  })

  it('meldet Komma und Zeilenumbruch — die zerlegen die Labels.txt', () => {
    expect(fitToTarget('Kamera 1, links', spec).invalidChars).toEqual([','])
    expect(fitToTarget('Zeile\nZwei', spec).invalidChars).toEqual(['\n'])
  })

  it('laesst Umlaute durch — das Format transportiert sie', () => {
    expect(fitToTarget('Bühne links', spec).invalidChars).toEqual([])
  })
})

describe('fitToTarget — Dante', () => {
  const spec = LABEL_TARGETS['dante-device']

  it('uebernimmt die Laenge aus danteNaming, statt sie zu duplizieren', () => {
    expect(spec.budget).toBe(DANTE_MAX_LENGTH)
  })

  it('meldet alles ausserhalb des DNS-SD-Zeichensatzes', () => {
    expect(fitToTarget('Pult Regie', spec).invalidChars).toEqual([' '])
    expect(fitToTarget('Pult-Regie-1', spec).invalidChars).toEqual([])
  })
})

describe('collisionsForTarget', () => {
  const spec = LABEL_TARGETS['atem-input-short']
  const fit = (raw: string) => fitToTarget(raw, spec)

  it('meldet zwei verschiedene Namen, die auf denselben Wert fallen', () => {
    const cols = collisionsForTarget([fit('CAM1'), fit('CAM10')], spec)
    expect(cols).toHaveLength(1)
    expect(cols[0].value).toBe('CAM1')
    expect(cols[0].members.map((m) => m.raw)).toEqual(['CAM1', 'CAM10'])
  })

  it('meldet NICHT, wenn schon die Wunschtexte gleich waren', () => {
    // Doppelte Namen sind ein eigener Befund — nicht jedes Ziel soll ihn
    // noch einmal melden.
    expect(collisionsForTarget([fit('PGM'), fit('PGM')], spec)).toEqual([])
  })

  it('misst Unterschiedlichkeit am Plantext, nicht am aufbereiteten Text', () => {
    // "1 SDI 3G" und "2 SDI 3G" sind im Plan zwei Eingaenge; die
    // ATEM-Aufbereitung macht aus beiden "3G". Ohne den Plantext als
    // Massstab verschluckt die Pruefung genau diesen Fall.
    const cols = collisionsForTarget(
      [fitToTarget('3G', spec, '1 SDI 3G'), fitToTarget('3G', spec, '2 SDI 3G')],
      spec,
    )
    expect(cols).toHaveLength(1)
    expect(cols[0].members.map((m) => m.origin)).toEqual(['1 SDI 3G', '2 SDI 3G'])
  })

  it('setzt origin auf den Rohtext, wenn keiner angegeben ist', () => {
    expect(fit('PGM').origin).toBe('PGM')
  })

  it('ignoriert leere Werte', () => {
    expect(collisionsForTarget([fit(''), fit('')], spec)).toEqual([])
  })

  it('faltet Gross-/Kleinschreibung nur, wo das Ziel es tut', () => {
    const dante = LABEL_TARGETS['dante-device']
    const cased = collisionsForTarget(
      [fitToTarget('Cam-1', dante), fitToTarget('cam-1', dante)],
      dante,
    )
    expect(cased).toHaveLength(1)

    const videohub = LABEL_TARGETS['videohub-label']
    const kept = collisionsForTarget(
      [fitToTarget('Cam 1', videohub), fitToTarget('cam 1', videohub)],
      videohub,
    )
    expect(kept).toEqual([])
  })
})

describe('LABEL_TARGETS — Tabellen-Disziplin', () => {
  it('jedes Ziel belegt, woher sein Limit stammt', () => {
    for (const spec of allLabelTargets()) {
      expect(spec.source.length).toBeGreaterThan(20)
    }
  })

  it('jedes Budget ist positiv oder ausdruecklich nicht vorhanden', () => {
    for (const spec of allLabelTargets()) {
      expect(spec.budget === null || spec.budget > 0).toBe(true)
    }
  })

  it('die id im Datensatz stimmt mit dem Schluessel ueberein', () => {
    for (const [key, spec] of Object.entries(LABEL_TARGETS)) {
      expect(spec.id).toBe(key)
    }
  })
})
