import { describe, expect, it } from 'vitest'
import { MEDIA_STATION_CATALOG, mediaStationTemplates } from '../src/renderer/lib/mediaStationCatalog'
import { resolveDeviceType } from '../src/renderer/lib/deviceTypeRegistry'
import { evidenceForType } from '../src/renderer/lib/catalogueEvidence'
import quelle from '../src/renderer/lib/mediaStationCatalog.ts?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'

// ---------------------------------------------------------------------------
// Die Medien-Station als PLAN-ENDPUNKT.
//
// Die offene Haelfte einer Zeile in der FEATURE-MATRIX der Suite:
//
//   > „Media playback — YES as a planned endpoint" ist im `cable-planner`
//   > nicht eingeloest; `pi-media-station` kommt dort als Geraet oder
//   > Endpunkt nicht vor.
//
// Die Matrix sagt zweierlei, und beides gilt: als KONKURRENT zu QLab oder
// disguise wird nichts gebaut, als geplanter ENDPUNKT gehoert die Station in
// den Plan. Bis hierher stand nur die Absage im Dokument.
//
// Was dieser Test vor allem absichert, sind die AUSLASSUNGEN. Ein Katalog-
// Eintrag ist schnell erweitert; die drei Ports, die hier NICHT stehen, sind
// die Arbeit daran.
// ---------------------------------------------------------------------------

const station = () => MEDIA_STATION_CATALOG[0]

describe('die Medien-Station ist im Plan platzierbar', () => {
  it('steht in der Bibliothek, die der Store beim Start setzt', () => {
    // Ein Katalog, den niemand einhaengt, ist eine Datei und kein Geraet.
    //
    // GESCHAERFT NACH DER GEGENPROBE: die erste Fassung suchte den Namen
    // irgendwo in der Datei — und blieb gruen, als die Einhaengung entfernt
    // wurde, weil die IMPORT-Zeile stehenblieb. Der Waechter prueft damit
    // den Zustand, den der Fix erzeugt, statt den, den der Defekt braucht.
    // Geprueft wird deshalb die Saat-Liste selbst.
    const saat = storeQuelle.slice(
      storeQuelle.indexOf('for (const t of ['),
      storeQuelle.indexOf('if (!byName.has(t.name))'),
    )
    expect(saat).not.toBe('')
    expect(saat).toContain('...mediaStationTemplates')
    expect(mediaStationTemplates).toHaveLength(MEDIA_STATION_CATALOG.length)
  })

  it('loest ueber ihre Geraetetyp-Id auf', () => {
    const typ = resolveDeviceType(station().deviceTypeId)
    expect(typ?.template.name).toBe('LZ Media Station')
  })

  it('traegt einen Beleg, und der zeigt aufs Repo der Station', () => {
    // Bei einem Geraet, dessen Hersteller dieses Projekt IST, ist das Repo
    // das Datenblatt — nicht eine Verlegenheitsangabe.
    const beleg = evidenceForType(station().deviceTypeId)
    expect(beleg.kind).toBe('sourced')
    if (beleg.kind === 'sourced') {
      expect(beleg.url).toContain('github.com/larszu/pi-media-station')
    }
  })
})

describe('was NICHT im Template steht, und warum', () => {
  it('hat keine analoge Klinke', () => {
    // Sie waere eine Aussage ueber die PLATINE, die das Repo der Station gar
    // nicht festlegt: der Pi 5 hat die 3,5-mm-Buchse nicht mehr, der Pi 4
    // hat sie. Ein Port, den die Haelfte der Boards nicht besitzt, erzeugt
    // ein Kabel auf der Kommissionierliste, das vor Ort ins Leere geht.
    const alle = [...station().template.inputs, ...station().template.outputs]
    expect(alle.some((p) => /klinke|3,5|3\.5|jack/i.test(p.name))).toBe(false)
  })

  it('hat genau EINE Bildausgabe', () => {
    // Der Pi 4 hat zwei Micro-HDMI, die Software treibt eine Anzeige
    // (Chromium `--kiosk`). Das Template beschreibt die Station, wie ihre
    // Software sie definiert, nicht den Stecker-Vorrat der Platine.
    const hdmi = station().template.outputs.filter((p) => p.connectorType === 'HDMI')
    expect(hdmi).toHaveLength(1)
  })

  it('hat keinen Sensor-Port', () => {
    // Der HC-SR04 haengt mit vier Draehten an GPIO 23/24. Das ist
    // Innenverkabelung und kein Weg im Signalfluss.
    const alle = [...station().template.inputs, ...station().template.outputs]
    expect(alle.some((p) => /sensor|gpio|hc-sr04/i.test(p.name))).toBe(false)
  })

  it('begruendet jede der drei Auslassungen im Quelltext', () => {
    // Eine Auslassung ohne Grund liest sich wie ein Versaeumnis, und der
    // Naechste traegt sie „nach". Genau das soll nicht passieren.
    expect(quelle).toContain('Keine analoge Klinke')
    expect(quelle).toContain('Kein zweiter HDMI')
    expect(quelle).toContain('Kein Sensor-Port')
  })
})

describe('die Station ist ein Endpunkt und kein Zuspiel-Werkzeug', () => {
  it('bringt keine Wiedergabe-Logik mit', () => {
    // Die Matrix-Zeile ist zweigeteilt: „WONT as a competitor; YES as a
    // planned endpoint". Ein Katalog-Eintrag ist die zweite Haelfte. Wer
    // hier anfaengt, Abspiellisten oder Zonen zu modellieren, hat die erste
    // Haelfte gekippt, ohne sie zu entscheiden.
    expect(quelle).not.toMatch(/playlist|Abspielliste|zone|Zone/i)
    expect(quelle).not.toMatch(/export function play|schedule|cue/i)
  })
})
