import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pruefeZiel } from '../src/main/services/tallyPushService'
import { vergleicheMitPi, type TallyPiDevice } from '../src/renderer/lib/tallyMap'

/**
 * B-6 / E-7 — DER DIREKTWEG ZUM TALLY-PI.
 *
 * Der Befund: `ExportDialog` erzeugte eine Download-Datei, die jemand von
 * Hand nach `/opt/pi-guide/tally.json` kopiert — genau der Medienbruch, gegen
 * den dieses Programm angetreten ist. E-7 sagt BEIDES mit Rangfolge: die
 * Datei bleibt der Vorgabeweg, der Direktweg kommt als ausdruecklich
 * einzuschaltendes Ziel dazu.
 *
 * Geprueft ist hier, was daran schiefgehen kann:
 *
 *  1. Die Adresse wird in MAIN geprueft, nicht im Renderer (Repo-Regel), und
 *     `https://` bekommt eine Absage statt einer Zeitueberschreitung.
 *  2. Der Schreibvorgang LOESCHT auf dem Pi jede Rolle, die der Plan nicht
 *     nennt — samt ihrer GPIO-Zuordnung. Das muss man vorher sehen.
 *  3. Der Weg ist aus, bis jemand ihn einschaltet, und die Datei bleibt.
 */

const lies = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8')

describe('Die Adresse wird in main geprueft', () => {
  it('nimmt eine gewoehnliche Pi-Adresse an', () => {
    const r = pruefeZiel('http://10.0.0.42:8080')
    expect(r.ok).toBe(true)
  })

  it('lehnt https ab und sagt warum', () => {
    // `guide_server.py` bindet einen einfachen HTTPServer auf Port 8080. Wer
    // `https://` eintraegt, bekaeme sonst eine Zeitueberschreitung ohne Grund
    // und suchte den Fehler im Netz.
    const r = pruefeZiel('https://10.0.0.42:8080')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('http://')
  })

  it('lehnt file: ab', () => {
    // Eine Adresse, die zum Dateisystem zeigt, ist kein Tally-Pi. Ohne diese
    // Absage waere die Adresse ein Pfad, und der Pfad kaeme aus dem Renderer.
    expect(pruefeZiel('file:///etc/passwd').ok).toBe(false)
  })

  it('lehnt Leeres und Unsinn ab, mit Grund', () => {
    for (const roh of ['', '   ', 'nicht mal eine URL']) {
      const r = pruefeZiel(roh)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
    }
  })
})

describe('Was der Schreibvorgang auf dem Pi anrichtet, steht vorher da', () => {
  const plan: TallyPiDevice[] = [
    { id: 'cam1', name: 'Kamera 1', input: 1 },
    { id: 'cam2', name: 'Kamera 2', input: 2 },
  ]

  it('nennt die Rollen, die verschwinden', () => {
    const pi = { devices: [{ id: 'cam1', name: 'Kamera 1' }, { id: 'alt', name: 'Alte Rolle' }] }
    const v = vergleicheMitPi(pi, plan)
    expect(v.verschwinden.map((x) => x.id)).toEqual(['alt'])
    expect(v.neu).toEqual(['cam2'])
    expect(v.bleiben).toBe(1)
  })

  it('unterscheidet, ob an der verschwindenden Rolle eine Lampe haengt', () => {
    // Der Unterschied kostet verschieden viel: ein Eintrag ist schnell wieder
    // eingetragen, eine GPIO-Zuordnung ist Verkabelung, die jemand am Gehaeuse
    // gemacht hat.
    const pi = {
      devices: [
        { id: 'ohne', name: 'Ohne Pin' },
        { id: 'mit', name: 'Mit Pin', out_gpio: 17 },
      ],
    }
    const v = vergleicheMitPi(pi, plan)
    expect(v.verschwinden.find((x) => x.id === 'ohne')?.hatVerdrahtung).toBe(false)
    expect(v.verschwinden.find((x) => x.id === 'mit')?.hatVerdrahtung).toBe(true)
  })

  it('zaehlt auch eine Null-Zuordnung als Verdrahtung nicht mit', () => {
    // `out_gpio: null` heisst „ausdruecklich keiner". Es als Verdrahtung zu
    // zaehlen faerbte die Warnung rot, wo nichts zu verlieren ist — und eine
    // Warnung, die zu oft rot ist, wird nicht mehr gelesen.
    const v = vergleicheMitPi({ devices: [{ id: 'x', name: 'X', out_gpio: null }] }, plan)
    expect(v.verschwinden[0]?.hatVerdrahtung).toBe(false)
  })

  it('macht aus einer unbrauchbaren Antwort keinen Fehler, sondern eine leere Liste', () => {
    // „Der Pi hat noch nichts" und „der Pi hat anders geantwortet" fuehren
    // beide dazu, dass nichts verschwindet — und genau das ist die Auskunft,
    // auf die es hier ankommt.
    // `{ devices: 7 }` steht hier NICHT zur Zierde: es ist der einzige Fall,
    // der eine fehlende `Array.isArray`-Pruefung zum Werfen bringt. Ohne ihn
    // blieb diese Regel gruen, wenn man die Pruefung entfernte — eine
    // Zeichenkette laesst sich durchlaufen, eine Zahl nicht. Gegengeprobt.
    for (const roh of [null, undefined, {}, { devices: 'nein' }, { devices: 7 }, { devices: [null, 7, {}] }]) {
      const v = vergleicheMitPi(roh, plan)
      expect(v.verschwinden).toEqual([])
      expect(v.neu).toEqual(['cam1', 'cam2'])
    }
  })
})

describe('Der Weg ist aus, bis jemand ihn einschaltet — und die Datei bleibt', () => {
  it('die Vorgabe ist AUS', () => {
    const store = lies('src/renderer/store/settingsStore.ts')
    expect(store).toContain('tallyPiDirekt: false')
  })

  it('eine bestehende Installation bekommt ihn nicht ungefragt an', () => {
    // Ein gespeichertes Feld, das nach dem Update auf AN steht, waere eine
    // Entscheidung, die niemand getroffen hat — mit Wirkung auf ein Geraet im
    // Netz.
    const store = lies('src/renderer/store/settingsStore.ts')
    const stelle = store.slice(store.indexOf('tallyPiDirekt:\n'))
    expect(store).toMatch(/tallyPiDirekt:\s*\n?\s*typeof parsed\.tallyPiDirekt === 'boolean'/)
    expect(stelle.slice(0, 200)).toContain('defaults.tallyPiDirekt')
  })

  it('der Download-Knopf steht weiter da', () => {
    // E-7: „Die Datei bleibt der Vorgabeweg." Sie ist ausserdem der einzige
    // Weg, der ohne Netz zum Pi funktioniert.
    const dialog = lies('src/renderer/components/Export/ExportDialog.tsx')
    expect(dialog).toContain('onClick={downloadTallyPi}')
  })

  it('der Sendeknopf ist zu, solange niemand gelesen hat', () => {
    const dialog = lies('src/renderer/components/Export/ExportDialog.tsx')
    const stelle = dialog.slice(dialog.indexOf('onClick={piSenden}'))
    expect(stelle.slice(0, 600)).toContain('piGelesen === null')
    // Und der gelesene Stand muss zu DIESER Adresse gehoeren: wer sie nach
    // dem Lesen aendert, hat den Stand eines anderen Pi gesehen.
    expect(stelle.slice(0, 600)).toContain('piGelesen.adresse !== piUrl')
  })
})

describe('Kein Token, wo keiner geprueft wird', () => {
  it('schickt keinen Nachweis-Kopf mit', () => {
    // `guide_server.py` prueft an seinen Schreib-Endpunkten nichts. Einen Kopf
    // mitzuschicken, den niemand liest, waere die schlechteste Antwort: das
    // Feld im Dialog behauptete einen Schutz, den es nicht gibt.
    const dienst = lies('src/main/services/tallyPushService.ts')
    // GEMESSEN WIRD DER CODE, NICHT DER TEXT. Die erste Fassung dieser Regel
    // suchte „Authorization" in der ganzen Datei — und wurde rot an dem
    // Kommentar, der ERKLAERT, dass kein solcher Kopf geschickt wird. Ein
    // Waechter, der die Begruendung fuer den Verstoss haelt, zwingt dazu, die
    // Begruendung zu loeschen. Also: Kommentare raus, dann messen.
    const ohneKommentar = dienst
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((z) => !z.trim().startsWith('//'))
      .join('\n')
    expect(ohneKommentar).not.toMatch(/Authorization|X-Token|X-Tally-Token|token/i)
    // Und der Grund steht in der Datei, statt dass jemand ihn spaeter
    // „nachruestet", ohne zu wissen, dass niemand ihn prueft.
    expect(dienst).toContain('KEIN TOKEN')
  })

  it('sagt es dem Nutzer an der Stelle, wo er das Ziel eintraegt', () => {
    const tab = lies('src/renderer/components/Settings/tabs/IntegrationsTab.tsx')
    expect(tab).toContain('settings.integrations.tallyPi.noToken')
  })
})

describe('Geschickt wird nur die Rollenliste', () => {
  it('der Post traegt `devices` und sonst nichts', () => {
    // `merge_tally_config` drueben behaelt jedes Feld, das der Post nicht
    // nennt — ATEM-Adresse und GPIO-Verdrahtung. Wer hier ein zweites Feld
    // mitschickt, loescht auf dem Pi das, was er dabei weglaesst.
    const dienst = lies('src/main/services/tallyPushService.ts')
    const stelle = dienst.slice(dienst.indexOf('export const schreiben'))
    expect(stelle).toContain("anfrage(new URL('/tally-config', ziel.url), 'POST', { devices })")
    expect(stelle).not.toMatch(/atem_ip|out_gpio/)
  })
})
