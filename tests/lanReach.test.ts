// ───────────────────────────────────────────────────────────────────────────
// Wie weit reicht diese Adresse? (Bedarf 133, P4)
//
//   > Venue internet is unreliable or absent […] BUT managers also need
//   > multi-site and remote viewers, and IMMEDIATELY WANT ACCESS CONTROL when
//   > they get it.
//
// Belege: `cpvalente/ontime#1423` (2025-01-03) — Passwortschutz ausdrücklich
// für Aufstellungen, die „globally available (open network or internet)" sind
// — und `#1547` (2025-03-18), eine Show über zwei Standorte.
//
// WAS HIER GEPRÜFT WIRD, und warum jede Zeile davon nötig ist:
//
//  1. DIE EINORDNUNG STIMMT. RFC 1918, CGNAT, Link-Local und die
//     IPv6-Entsprechungen gelten als lokal — der Rest nicht. Wer hier
//     danebenliegt, gibt entweder das Hallen-WLAN nicht frei (ärgerlich) oder
//     eine öffentliche Adresse (gefährlich).
//
//  2. IM ZWEIFEL WIRD ZURÜCKGEHALTEN. Eine Adresse, die dieser Rechner nicht
//     einordnen kann, gilt als „darüber hinaus". Die andere Richtung wäre
//     eine Freigabe aus Unkenntnis.
//
//  3. ZURÜCKGEHALTEN HEISST BENANNT. Eine Adresse, die niemand nennt, ist für
//     den Nutzer dasselbe wie eine, die es nicht gibt — und dann sucht er den
//     Fehler in der Netzwerktechnik statt in einer Entscheidung, die diese
//     Anwendung getroffen hat.
//
//  4. BEIDE LISTEN KOMMEN AUS DERSELBEN EINORDNUNG. Sonst stünde eine Adresse
//     oben als angeboten und unten als zurückgehalten.
//
//  5. DIE FREIGABE IST EINE ENTSCHEIDUNG. Ohne sie bleibt es beim LAN — eine
//     Freigabe, die sich aus der Netzwerkkarte ergibt, ist keine.
//
//  6. DER WEG IST VERDRAHTET — und die Freigabe überlebt kein `stop()`.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  BEYOND_LAN_REASON,
  REACH_LABEL,
  classifyAddress,
  shareAddresses,
  type Reach,
} from '../src/main/util/lanReach'

const lies = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8')

/**
 * Quelltext OHNE Kommentare.
 *
 * Wer eine abgeschaffte Bauform verbietet, muss sie in der Begruendung
 * zitieren duerfen — sonst steht im Code kein Wort mehr darueber, warum sie
 * weg ist. Also erst die Kommentare weg, dann pruefen.
 */
const ohneKommentare = (rel: string): string =>
  lies(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

describe('Bedarf 133 — wie weit reicht diese Adresse?', () => {
  it('1. die Einordnung stimmt', () => {
    // Loopback.
    expect(classifyAddress('127.0.0.1')).toBe('loopback')
    expect(classifyAddress('127.255.255.254')).toBe('loopback')
    expect(classifyAddress('::1')).toBe('loopback')

    // RFC 1918 — das Hallen-WLAN.
    for (const ip of ['10.0.0.5', '10.255.255.255', '192.168.1.42', '172.16.0.1', '172.31.255.254']) {
      expect(classifyAddress(ip), ip).toBe('private')
    }
    // CGNAT (RFC 6598) und Link-Local (RFC 3927) sind ebenfalls nicht aus dem
    // Internet erreichbar.
    expect(classifyAddress('100.64.0.1')).toBe('private')
    expect(classifyAddress('100.127.255.254')).toBe('private')
    expect(classifyAddress('169.254.10.20')).toBe('private')
    // IPv6: Link-Local und Unique-Local, auch mit Zone-Id.
    expect(classifyAddress('fe80::1')).toBe('private')
    expect(classifyAddress('fe80::1%eth0')).toBe('private')
    expect(classifyAddress('fd00::1234')).toBe('private')

    // DIE RAENDER. 172.15 und 172.32 liegen AUSSERHALB von 172.16/12 — genau
    // hier liegt der klassische Fehler, und er faellt in die gefaehrliche
    // Richtung.
    expect(classifyAddress('172.15.255.255')).toBe('beyond-lan')
    expect(classifyAddress('172.32.0.1')).toBe('beyond-lan')
    expect(classifyAddress('100.63.255.255')).toBe('beyond-lan')
    expect(classifyAddress('100.128.0.1')).toBe('beyond-lan')
    expect(classifyAddress('169.253.0.1')).toBe('beyond-lan')

    // Oeffentlich erreichbar.
    for (const ip of ['8.8.8.8', '93.184.216.34', '11.0.0.1', '2001:db8::1']) {
      expect(classifyAddress(ip), ip).toBe('beyond-lan')
    }
    // IPv4-mapped IPv6 wird als das behandelt, was es ist.
    expect(classifyAddress('::ffff:192.168.1.5')).toBe('private')
    expect(classifyAddress('::ffff:8.8.8.8')).toBe('beyond-lan')

    for (const r of ['loopback', 'private', 'beyond-lan'] as Reach[]) {
      expect(REACH_LABEL[r].length).toBeGreaterThan(5)
    }
  })

  it('2. im Zweifel wird zurueckgehalten', () => {
    // Was sich nicht einordnen laesst, gilt als „darueber hinaus". Die andere
    // Richtung waere eine Freigabe aus Unkenntnis.
    for (const murks of ['', '   ', 'nicht.eine.adresse', '999.1.1.1', '10.0.0', '10.0.0.0.1', '10.0.0.256']) {
      expect(classifyAddress(murks), JSON.stringify(murks)).toBe('beyond-lan')
    }
  })

  it('3. zurueckgehalten heisst benannt', () => {
    const r = shareAddresses(['192.168.1.5', '93.184.216.34'], { allowBeyondLan: false })
    expect(r.offered).toEqual(['192.168.1.5'])
    expect(r.withheld).toHaveLength(1)
    expect(r.withheld[0].address).toBe('93.184.216.34')
    expect(r.withheld[0].reach).toBe('beyond-lan')
    // Der Grund steht dabei, und er sagt WARUM ein Token in einer URL im
    // offenen Netz keine Zugriffskontrolle ist.
    expect(r.withheld[0].reason).toBe(BEYOND_LAN_REASON)
    expect(BEYOND_LAN_REASON).toMatch(/Token/)
    expect(BEYOND_LAN_REASON.length).toBeGreaterThan(80)
    expect(r.hasBeyondLan).toBe(true)
  })

  it('4. beide Listen kommen aus derselben Einordnung', () => {
    const alle = ['127.0.0.1', '10.0.0.5', '172.15.0.1', 'fe80::1', '8.8.8.8']
    const r = shareAddresses(alle, { allowBeyondLan: false })
    // Keine Adresse verschwindet, und keine steht in beiden Listen.
    expect(r.offered.length + r.withheld.length).toBe(alle.length)
    for (const w of r.withheld) expect(r.offered).not.toContain(w.address)
    for (const o of r.offered) expect(r.withheld.map((w) => w.address)).not.toContain(o)
    // Und die Einordnung ist dieselbe wie die von `classifyAddress`.
    for (const o of r.offered) expect(classifyAddress(o)).not.toBe('beyond-lan')
    for (const w of r.withheld) expect(classifyAddress(w.address)).toBe('beyond-lan')
  })

  it('5. die Freigabe ist eine Entscheidung', () => {
    const alle = ['192.168.1.5', '93.184.216.34']
    // Ohne sie: das LAN.
    expect(shareAddresses(alle, { allowBeyondLan: false }).offered).toEqual(['192.168.1.5'])
    // Mit ihr: alles — und nichts bleibt zurueckgehalten, ueber das dann
    // faelschlich gewarnt wuerde.
    const frei = shareAddresses(alle, { allowBeyondLan: true })
    expect(frei.offered).toEqual(alle)
    expect(frei.withheld).toHaveLength(0)
    expect(frei.hasBeyondLan).toBe(false)

    // Ein reines LAN meldet nichts — eine Warnung ohne Anlass wird beim
    // zweiten Mal weggeklickt und dann auch die mit Anlass.
    const nurLan = shareAddresses(['10.0.0.5', '127.0.0.1'], { allowBeyondLan: false })
    expect(nurLan.withheld).toHaveLength(0)
    expect(nurLan.hasBeyondLan).toBe(false)
  })

  it('6. der Weg ist verdrahtet', () => {
    const server = ohneKommentare('../src/main/services/mobileShareServer.ts')
    // Die Freigabe-URLs kommen aus der Einordnung und nicht mehr aus der
    // rohen Adressliste.
    expect(server).toMatch(/shareAddresses\(collectLanAddresses\(\), \{ allowBeyondLan: state\.allowBeyondLan \}\)\.offered/)
    // Was zurueckgehalten wird, geht mit an den Renderer.
    expect(server).toMatch(/withheld: WithheldAddress\[\]/)
    expect(server).toMatch(/withheld: buildWithheld\(\)/)
    // Vorgabe: LAN. Eine Freigabe, die sich aus der Netzwerkkarte ergibt, ist
    // keine Entscheidung.
    expect(server).toMatch(/allowBeyondLan: false,/)
    // Und sie ueberlebt kein `stop()`: wer den Rechner morgen woanders
    // aufstellt, faengt wieder beim LAN an.
    const stop = /export const stopMobileShareServer[\s\S]*?\n\}/.exec(server)?.[0] ?? ''
    expect(stop).toMatch(/state\.allowBeyondLan = false/)

    // Der Dialog zeigt die zurueckgehaltenen Adressen samt Grund und bietet
    // die ausdrueckliche Freigabe an.
    const dialog = ohneKommentare('../src/renderer/components/MobileShare/MobileShareDialog.tsx')
    expect(dialog).toMatch(/status\.withheld\.length > 0/)
    expect(dialog).toMatch(/status\.withheld\[0\]\.reason/)
    expect(dialog).toMatch(/setAllowBeyondLan\(true\)/)

    // Und wenn NICHTS uebrig bleibt, weil jede Adresse zurueckgehalten
    // wurde: Der Zustand wird benannt. Ein ewig pulsender Platzhalter an
    // der Stelle des QR-Codes hiesse „niemand hat nachgesehen" — dabei
    // hat jemand nachgesehen und entschieden.
    expect(dialog).toMatch(/status\.urls\.length === 0 \? \(/)
    expect(dialog).toMatch(/mobile\.dialog\.noAddress/)

    // Und der IPC-Kanal ist domaenen-praefixiert wie alle anderen.
    const ipc = ohneKommentare('../src/main/ipc/mobileShareIpc.ts')
    expect(ipc).toMatch(/'mobileShare:setAllowBeyondLan'/)
    // Nur ein echtes `true` schaltet frei — kein truthy-Wert aus dem Renderer.
    expect(ipc).toMatch(/allow === true/)
  })
})
