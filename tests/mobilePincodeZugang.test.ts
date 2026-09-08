// @vitest-environment node
//
// Node-Umgebung, nicht happy-dom: dieser Test spricht einen echten
// HTTP-Server an, und happy-doms `fetch` setzt eine Same-Origin-Regel
// durch, die es im Hauptprozess nicht gibt. Mit happy-dom pruefte er die
// CORS-Politik der Testumgebung statt der Route.
import { afterEach, describe, expect, it } from 'vitest'
import { Agent, request } from 'node:http'
import {
  getMobileShareStatus,
  setMobileShareProject,
  setMobileSharePincodeAccess,
  setMobileSharePincodeReadHandler,
  setMobileSharePincodes,
  mobileSharePincodeStatus,
  startMobileShareServer,
  stopMobileShareServer,
} from '../src/main/services/mobileShareServer'
import { stripSecrets } from '../src/main/util/stripSecrets'
import { anlagenZugangscodes } from '../src/renderer/lib/anlagenZugangscodes'

// ───────────────────────────────────────────────────────────────────────────
// E-3 — der Anlagen-Zugangscode ueber die Mobile-Ansicht, hinter einem
// EIGENEN Token.
//
// DIE VORGESCHICHTE. `cable#656` hat die Zugangsdaten der Intercom-Anlage aus
// dem ausgelieferten Blatt genommen: `TechPincode` und `Security.Pincode`
// stehen im Roh-Dokument des Herstellers (`basePreset`), keiner ihrer Namen
// steht in `SECRET_KEYS`, und deshalb gingen sie in die `.cpviewer`-Datei und
// an jedes Handy im WLAN. Die Antwort war, das Roh-Dokument als Ganzes
// zurueckzuhalten.
//
// Der Eigentuemer hat am 2026-09-08 entschieden, dass der Techniker vor Ort
// trotzdem an den Code kommen soll — aber hinter einem eigenen Token, nicht
// hinter dem des QR-Links. Genau diese Unterscheidung ist die Zusicherung,
// und sie zerfaellt in vier Teile, die alle einzeln pruefbar sind:
//
//   1. Der Sitzungstoken aus dem QR-Code reicht NICHT. Sonst hiesse „hinter
//      einem Token" in der Praxis „hinter dem Link", und die Entscheidung
//      waere eine andere als die getroffene.
//   2. Der Wert steht NICHT im ausgelieferten Blatt. `stripSecrets` bleibt,
//      wie es ist; `/project.json` traegt keinen Code.
//   3. Vorgabe ist AUS. Ohne ausdrueckliches Einschalten gibt es die Route
//      nicht — und zwar als 404, nicht als 401: „falscher Code, versuch es
//      nochmal" schickte jemanden ans Raten.
//   4. Jeder Abruf wird gemeldet, mit Fingerabdruck statt Wert.
// ───────────────────────────────────────────────────────────────────────────

const CODES = [
  { label: 'Technik-Pincode', value: '4711' },
  { label: 'Admin-Passwort', value: 'geheim' },
]

interface Lauf {
  basis: string
  token: string
}

/** Server starten und Basis-URL + Sitzungstoken aus der angebotenen URL holen. */
const starte = async (): Promise<Lauf> => {
  const info = await startMobileShareServer('/nicht/vorhanden')
  const url = new URL(info.urls.find((u) => u.includes('127.0.0.1')) ?? info.urls[0])
  return { basis: `http://127.0.0.1:${info.port}`, token: url.searchParams.get('t') ?? '' }
}

/**
 * Ein Aufruf ohne Verbindungs-Wiederverwendung.
 *
 * Bewusst `node:http` und nicht `fetch`: die Tests starten je einen Server,
 * stoppen ihn wieder, und der naechste bekommt vom Betriebssystem oft
 * DENSELBEN Port. Undicis Verbindungs-Pool haelt dann eine Verbindung zu
 * einem Server, den es nicht mehr gibt, und der naechste Aufruf scheitert mit
 * „other side closed" — ein Fehlschlag der Testmechanik, der wie ein
 * Fehlschlag der Route aussieht.
 */
const ruf = (
  url: string,
  kopf: Record<string, string> = {},
): Promise<{ status: number; body: string }> =>
  new Promise((ok, fail) => {
    const req = request(url, { agent: new Agent({ keepAlive: false }), headers: kopf }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (body += c))
      res.on('end', () => ok({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', fail)
    req.end()
  })

const hole = (l: Lauf, kopf: Record<string, string> = {}) =>
  ruf(`${l.basis}/pincodes`, { 'X-CP-Token': l.token, ...kopf })

afterEach(() => {
  setMobileSharePincodeReadHandler(null)
  stopMobileShareServer()
})

describe('E-3 — Vorgabe ist aus', () => {
  it('meldet keinen Zugriff, solange niemand ihn einschaltet', async () => {
    const l = await starte()
    setMobileSharePincodes(CODES)
    expect(mobileSharePincodeStatus()).toEqual({ on: false, count: 0 })
    const r = await hole(l)
    // 404 und nicht 401: die Route gibt es nicht, es ist nichts falsch
    // eingetippt.
    expect(r.status).toBe(404)
  })

  it('nimmt keine Codes an, solange der Zugriff aus ist', async () => {
    await starte()
    setMobileSharePincodes(CODES)
    expect(mobileSharePincodeStatus().count).toBe(0)
  })
})

describe('E-3 — der zweite Token, nicht der des QR-Links', () => {
  it('weist den Sitzungstoken allein ab', async () => {
    const l = await starte()
    setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    const r = await hole(l)
    // 403 und nicht 404: die Route gibt es, der zweite Token fehlt.
    expect(r.status).toBe(403)
    expect(JSON.parse(r.body)).toEqual({ error: 'pin-token' })
  })

  it('weist einen falschen zweiten Token ab', async () => {
    const l = await starte()
    setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    expect((await hole(l, { 'X-CP-Pin-Token': 'falsch' })).status).toBe(403)
  })

  it('gibt die Codes mit dem richtigen zweiten Token heraus', async () => {
    const l = await starte()
    const pin = setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    const r = await hole(l, { 'X-CP-Pin-Token': pin })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body)).toEqual({ codes: CODES })
  })

  it('laesst den zweiten Token NICHT als Query-Parameter durch', async () => {
    // Ein Code in einer URL landet im Verlauf, im Screenshot und in jedem
    // Server-Log dazwischen. Der Sitzungstoken darf das, weil er ohnehin im
    // QR-Code steht; dieser hier nicht.
    const l = await starte()
    const pin = setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    const r = await ruf(`${l.basis}/pincodes?t=${l.token}&pin=${pin}`)
    expect(r.status).toBe(403)
  })

  it('macht den alten Token mit dem Aus- und Wiedereinschalten ungueltig', async () => {
    const l = await starte()
    const alt = setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    const neu = setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    expect(neu).not.toBe(alt)
    expect((await hole(l, { 'X-CP-Pin-Token': alt })).status).toBe(403)
    expect((await hole(l, { 'X-CP-Pin-Token': neu })).status).toBe(200)
  })

  it('nimmt Zugriff und Codes beim Abschalten weg', async () => {
    const l = await starte()
    const pin = setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    setMobileSharePincodeAccess(false)
    expect(mobileSharePincodeStatus()).toEqual({ on: false, count: 0 })
    expect((await hole(l, { 'X-CP-Pin-Token': pin })).status).toBe(404)
  })
})

describe('E-3 — der Wert steht nicht im ausgelieferten Blatt', () => {
  it('haelt `basePreset` weiter ganz zurueck, auch bei eingeschaltetem Zugriff', async () => {
    const l = await starte()
    setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    setMobileShareProject({
      name: 'Show',
      intercom: { basePreset: { Security: { Pincode: '4711' } } },
    })
    const blatt = (await ruf(`${l.basis}/project.json?t=${l.token}`)).body
    expect(blatt).not.toContain('4711')
    expect(blatt).not.toContain('basePreset')
  })

  it('aendert nichts an der Streich-Regel selbst', () => {
    // Der Zugriff ist ein zweiter WEG, keine Lockerung des ersten. Ginge das
    // Roh-Dokument wieder mit, waere die ganze Konstruktion sinnlos.
    const gestrichen = stripSecrets({ basePreset: { Security: { Pincode: '4711' } } })
    expect(gestrichen).toEqual({})
  })
})

describe('E-3 — jeder Abruf wird gemeldet', () => {
  it('meldet Zeitpunkt, Fingerabdruck und Anzahl — nicht den Wert', async () => {
    const l = await starte()
    const pin = setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    const gemeldet: { at: string; tokenPrefix: string; count: number }[] = []
    setMobileSharePincodeReadHandler((info) => gemeldet.push(info))

    await hole(l, { 'X-CP-Pin-Token': pin })

    expect(gemeldet).toHaveLength(1)
    expect(gemeldet[0].count).toBe(2)
    expect(gemeldet[0].tokenPrefix).toBe(pin.slice(0, 6))
    expect(gemeldet[0].tokenPrefix.length).toBeLessThan(pin.length)
    expect(Number.isNaN(Date.parse(gemeldet[0].at))).toBe(false)
    // Der Wert taucht nirgends auf.
    expect(JSON.stringify(gemeldet)).not.toContain('4711')
    expect(JSON.stringify(gemeldet)).not.toContain('geheim')
  })

  it('meldet einen abgewiesenen Abruf NICHT als Abruf', async () => {
    // Sonst stuende im Register ein Abruf, der nie stattgefunden hat — und
    // jemand suchte nach einem Leck, das es nicht gibt.
    const l = await starte()
    setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    const gemeldet: unknown[] = []
    setMobileSharePincodeReadHandler((info) => gemeldet.push(info))
    await hole(l, { 'X-CP-Pin-Token': 'falsch' })
    expect(gemeldet).toEqual([])
  })
})

describe('E-3 — das Aufraeumen', () => {
  it('vergisst Token und Codes beim Stoppen des Servers', async () => {
    await starte()
    setMobileSharePincodeAccess(true)
    setMobileSharePincodes(CODES)
    stopMobileShareServer()
    expect(mobileSharePincodeStatus()).toEqual({ on: false, count: 0 })
    expect(getMobileShareStatus().running).toBe(false)
  })
})

describe('E-3 — welche Felder als Zugangsmittel gelten', () => {
  it('liest die vier benannten Pfade', () => {
    expect(
      anlagenZugangscodes({
        Security: { Pincode: '1234' },
        TechPincode: '5678',
        AdminPassword: 'admin',
        ConfigPassword: 'config',
      }),
    ).toEqual([
      { label: 'Anlagen-Pincode', value: '1234' },
      { label: 'Technik-Pincode', value: '5678' },
      { label: 'Admin-Passwort', value: 'admin' },
      { label: 'Konfigurations-Passwort', value: 'config' },
    ])
  })

  it('nimmt eine Zahl als Pincode an', () => {
    // Im Herstellerdokument steht ein Pincode gern ohne Anfuehrungszeichen.
    // Ihn deshalb zu verschweigen waere die schlechteste Art, genau zu sein.
    expect(anlagenZugangscodes({ TechPincode: 4711 })).toEqual([
      { label: 'Technik-Pincode', value: '4711' },
    ])
  })

  it('laesst leere Felder weg', () => {
    // Ein leerer Pincode ist kein Geheimnis, und ihn als „—" zu zeigen liesse
    // den Techniker glauben, er habe den richtigen Wert vor sich.
    expect(anlagenZugangscodes({ TechPincode: '', Security: { Pincode: '   ' } })).toEqual([])
  })

  it('sucht NICHT nach anderen Feldern, die nach Geheimnis aussehen', () => {
    // Eine Suche faende beim naechsten Firmware-Stand mehr, als jemand
    // entschieden hat herzugeben — die falsche Richtung, um sich zu irren.
    expect(anlagenZugangscodes({ SuperSecretKey: 'x', wifiPassword: 'y' })).toEqual([])
  })

  it('kommt mit fehlendem Dokument klar', () => {
    expect(anlagenZugangscodes(undefined)).toEqual([])
    expect(anlagenZugangscodes(null)).toEqual([])
    expect(anlagenZugangscodes('kein Objekt')).toEqual([])
  })
})
