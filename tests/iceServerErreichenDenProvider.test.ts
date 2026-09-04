// ───────────────────────────────────────────────────────────────────────────
// B-37 — Die eingetragenen TURN-Server erreichen den Provider.
//
// WARUM DIESER TEST DAS OBJEKT PRUEFT UND NICHT DEN TYP. `docs/self-hosted-relay.md`
// beschrieb ein `iceServers`-Feld, das es nirgends gab: `grep -rn iceServers src/`
// lieferte null Treffer, und `attachWebrtcProvider` reichte an y-webrtc nur
// `signaling` und `password` durch. Wer der Anleitung folgte, hatte einen
// laufenden coturn, den nichts benutzte.
//
// Ein Feld ins Interface zu schreiben kostet eine Zeile, und ob der Wert unten
// ankommt, sieht man einer Typdefinition nicht an — genau diese Luecke war der
// Befund. Deshalb prueft dieser Test das Objekt, das `new WebrtcProvider`
// tatsaechlich bekommt (`webrtcProviderOptions`), und nicht, dass ein Feld
// existiert.
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { webrtcProviderOptions } from '../src/renderer/lib/crdt/webrtcProvider'
import { parseIceServers, ungueltigeIceZeilen } from '../src/renderer/lib/crdt/iceServers'
import { buildInviteLink } from '../src/renderer/lib/collabInvite'

describe('das Eingabefeld', () => {
  it('liest STUN ohne und TURN mit Zugangsdaten', () => {
    const roh = ['stun:stun.example.com:3478', 'turn:turn.example.com:3478|lars|geheim'].join('\n')
    expect(parseIceServers(roh)).toEqual([
      { urls: 'stun:stun.example.com:3478' },
      { urls: 'turn:turn.example.com:3478', username: 'lars', credential: 'geheim' },
    ])
  })

  it('trennt an `|`, damit ein Passwort `:` und `@` enthalten darf', () => {
    // Der Grund fuer das ungewoehnliche Trennzeichen: coturn-Passwoerter aus
    // `lt-cred-mech` enthalten beides regelmaessig. Ein Format, das an einem
    // gueltigen Passwort zerbricht, ist schlimmer als eines, das haesslich
    // aussieht.
    expect(parseIceServers('turns:turn.example.com:5349|user@host|a:b@c')).toEqual([
      { urls: 'turns:turn.example.com:5349', username: 'user@host', credential: 'a:b@c' },
    ])
  })

  it('meldet unbrauchbare Zeilen, statt sie stumm zu schlucken', () => {
    const roh = [
      'wss://relay.example.com', // Signaling-Server, hier falsch eingetragen
      'turn:turn.example.com:3478', // TURN ohne Zugangsdaten weist jede Allocation ab
      '  ',
      'stun:stun.example.com:3478',
    ].join('\n')
    expect(ungueltigeIceZeilen(roh)).toEqual(['wss://relay.example.com', 'turn:turn.example.com:3478'])
    expect(parseIceServers(roh)).toEqual([{ urls: 'stun:stun.example.com:3478' }])
  })

  it('ein leeres Feld ergibt keine Server', () => {
    expect(parseIceServers('')).toEqual([])
    expect(parseIceServers('\n \n')).toEqual([])
  })
})

describe('die Weitergabe an y-webrtc', () => {
  it('legt die Server unter peerOpts.config.iceServers ab', () => {
    // Das ist der Pfad, den simple-peer in die RTCPeerConnection reicht.
    // Steht der Wert woanders, ist er wirkungslos und nichts meldet es.
    const opts = webrtcProviderOptions({
      signaling: ['wss://relay.example.com'],
      iceServers: [{ urls: 'turn:turn.example.com:3478', username: 'lars', credential: 'geheim' }],
    })
    expect(opts).toMatchObject({
      signaling: ['wss://relay.example.com'],
      peerOpts: {
        config: {
          iceServers: [{ urls: 'turn:turn.example.com:3478', username: 'lars', credential: 'geheim' }],
        },
      },
    })
  })

  it('ohne konfigurierte Server bleibt peerOpts WEG, nicht leer', () => {
    // Ein leeres `iceServers: []` schaltet die Defaults von y-webrtc ab, statt
    // sie zu ergaenzen — dann faende sich auch im LAN nichts mehr. Der
    // Unterschied zwischen „nicht gesetzt" und „leer gesetzt" ist hier der
    // Unterschied zwischen „funktioniert" und „funktioniert nirgends".
    expect(webrtcProviderOptions({ signaling: ['wss://x'] })).not.toHaveProperty('peerOpts')
    expect(webrtcProviderOptions({ signaling: ['wss://x'], iceServers: [] })).not.toHaveProperty('peerOpts')
  })

  it('Signaling und Passwort gehen unveraendert weiter', () => {
    const opts = webrtcProviderOptions({ signaling: ['wss://x'], password: 'geheim' })
    expect(opts.signaling).toEqual(['wss://x'])
    expect(opts.password).toBe('geheim')
  })
})

describe('die Zugangsdaten verlassen den Rechner nicht', () => {
  // Ein Einladungslink wird in einen Chat gepastet. Ein TURN-Passwort, das
  // dort mitfaehrt, ist damit veroeffentlicht -- und zwar an eine Stelle, die
  // niemand spaeter widerruft. Das Raum-Passwort steht bewusst drin (ohne es
  // kann der Eingeladene nicht beitreten); die TURN-Zugangsdaten gehoeren dem
  // Server-Betreiber und haben dort nichts zu suchen.

  it('buildInviteLink nimmt nur benannte Felder, nicht das ganze Objekt', () => {
    // Der eigentliche Schutz ist, dass die Funktion eine Positivliste baut und
    // nicht spreizt. Mit einem Kanarienwert gemessen statt im Kommentar
    // behauptet: waere es ein Spread, stuende er im Link.
    const link = buildInviteLink({
      mode: 'webrtc',
      room: 'raum',
      signaling: 'wss://relay.example.com',
      ...({ iceServers: 'turn:turn.example.com:3478|lars|KANARIENVOGEL' } as Record<string, string>),
    })
    const nutzlast = atob(link.split('#join=')[1].replace(/-/g, '+').replace(/_/g, '/'))
    expect(nutzlast).not.toContain('KANARIENVOGEL')
    expect(nutzlast).not.toContain('iceServers')
    expect(nutzlast).toContain('wss://relay.example.com')
  })

  it('weder der Einladungslink noch die mDNS-Ankuendigung kennen das Feld', () => {
    // Zweite, grobere Sperre fuer den Fall, dass jemand das Feld doch in die
    // Positivliste aufnimmt: dann faellt es hier auf, bevor es ausgeliefert ist.
    const wurzel = join(__dirname, '..', 'src', 'renderer')
    const invite = readFileSync(join(wurzel, 'lib', 'collabInvite.ts'), 'utf8')
    expect(invite, 'Der Einladungslink darf keine TURN-Zugangsdaten tragen.').not.toMatch(/iceServers/)

    const store = readFileSync(join(wurzel, 'store', 'collabStore.ts'), 'utf8')
    const ankuendigung = store.slice(store.indexOf('const advertiseSession'), store.indexOf('const unadvertiseSession'))
    expect(ankuendigung, 'Die mDNS-Ankuendigung geht an jeden im LAN.').not.toMatch(/iceServers/)
  })
})
