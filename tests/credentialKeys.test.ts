import { describe, expect, it } from 'vitest'
import {
  SECRET_KEYS,
  countCredentialBearers,
  hasCredential,
  stripCredentials,
} from '../src/renderer/lib/credentialKeys'
import rendererSrc from '../src/renderer/lib/credentialKeys.ts?raw'
import mainSrc from '../src/main/util/stripSecrets.ts?raw'
import syncSrc from '../src/renderer/lib/sharedLibrarySync.ts?raw'
import menuSrc from '../src/renderer/components/Layout/MenuBar.tsx?raw'

// ---------------------------------------------------------------------------
// Design-Frage 5, entschieden: bei jedem Ausgang, der die Datei aus der Hand
// gibt, wird gefragt.
//
// DER WICHTIGSTE TEST IN DIESER DATEI ist der letzte im ersten Block: die
// Schluessel-Menge existiert zweimal, weil Renderer und Hauptprozess keinen
// Quellbaum teilen. Genau eine ungeprueft auseinandergelaufene Kopie war die
// Ursache des urspruenglichen Fehlers — der Viewer-Export bekam die Regel des
// Mobile-Share-Pfads nie mit. Die Kopie ist unvermeidbar, das Auseinanderlaufen
// nicht.
// ---------------------------------------------------------------------------

/** Die Menge aus einem `new Set([...])`-Literal im Quelltext lesen. */
const keysFromSource = (src: string): string[] => {
  const m = /new Set\(\[([\s\S]*?)\]\)/.exec(src)
  if (!m) throw new Error('kein Set-Literal im Quelltext gefunden')
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
}

describe('die Regel steht zweimal — und muss deckungsgleich bleiben', () => {
  it('Renderer und Hauptprozess fuehren dieselben Schluessel', () => {
    expect(keysFromSource(rendererSrc)).toEqual(keysFromSource(mainSrc))
  })

  it('die geladene Menge stimmt mit ihrem eigenen Quelltext ueberein', () => {
    // Sonst pruefte der Test oben zwei Quelltexte, die keiner benutzt.
    expect([...SECRET_KEYS].sort()).toEqual(keysFromSource(rendererSrc))
  })

  it('beide fuehren die zwei Felder, die EquipmentItem wirklich hat', () => {
    expect(SECRET_KEYS.has('username')).toBe(true)
    expect(SECRET_KEYS.has('password')).toBe(true)
  })
})

describe('stripCredentials', () => {
  it('entfernt Zugangsdaten rekursiv, auch in Listen', () => {
    const input = {
      equipment: [
        { id: 'A', name: 'Switch', ipAddress: '10.0.0.2', username: 'admin', password: 'geheim' },
        { id: 'B', name: 'Kamera' },
      ],
    }
    expect(stripCredentials(input)).toEqual({
      equipment: [
        { id: 'A', name: 'Switch', ipAddress: '10.0.0.2' },
        { id: 'B', name: 'Kamera' },
      ],
    })
  })

  it('laesst alles andere unangetastet', () => {
    const value = { n: 1, b: false, s: '', nil: null, list: [1, 2], deep: { x: [{ y: 1 }] } }
    expect(stripCredentials(value)).toEqual(value)
  })
})

describe('gefragt wird nur, wenn es etwas zu entscheiden gibt', () => {
  it('zaehlt nur Eintraege, die wirklich etwas tragen', () => {
    const items = [
      { id: 'A', password: 'geheim' },
      { id: 'B' },
      { id: 'C', username: 'admin' },
    ]
    expect(countCredentialBearers(items)).toBe(2)
  })

  it('haelt ein leeres Feld nicht fuer ein Geheimnis', () => {
    // `password: ''` heisst „nicht gesetzt". Wuerde das zaehlen, erschiene die
    // Rueckfrage bei fast jedem Export — und eine Rueckfrage, die immer kommt,
    // liest irgendwann niemand mehr.
    expect(hasCredential({ password: '' })).toBe(false)
    expect(hasCredential({ password: '   ' })).toBe(false)
    expect(hasCredential({ username: undefined })).toBe(false)
    expect(countCredentialBearers([{ password: '' }, { username: '' }])).toBe(0)
  })

  it('findet ein Geheimnis auch tief verschachtelt', () => {
    expect(hasCredential({ a: { b: [{ token: 'x' }] } })).toBe(true)
  })
})

describe('die beiden Ausgaenge fragen wirklich', () => {
  it('der Bibliotheks-Push nimmt die Entscheidung als Pflicht-Parameter', () => {
    // Ohne Default: ein Aufrufer, der sie weglaesst, kompiliert nicht. Ein
    // Default haette den alten Zustand („geht stillschweigend mit")
    // wiederhergestellt, sobald ihn jemand vergisst.
    expect(syncSrc).toMatch(/credentials: CredentialChoice,\s*\): Promise<LibrarySyncResult>/)
    expect(syncSrc).toContain("credentials === 'strip' ? stripCredentials(merged) : merged")
  })

  it('der Bibliotheks-Push strippt nur, was hinausgeht', () => {
    // Die lokale Bibliothek behaelt ihre Zugangsdaten — sonst kostete ein
    // einziger Sync sie dem Nutzer dauerhaft.
    expect(syncSrc).not.toMatch(/stripCredentials\(\s*after\.customLibrary/)
    expect(syncSrc).toContain('const merged = unionByName(after.customLibrary, sDevices)')
  })

  it('der .avplan-Export fragt und strippt die Nutzlast', () => {
    expect(menuSrc).toContain('countCredentialBearers(project.equipment ?? [])')
    expect(menuSrc).toContain("choice === 'strip' ? stripCredentials(avplan) : avplan")
  })

  it('ein Abbruch gibt nichts heraus', () => {
    // Bei einer Frage nach Zugangsdaten ist „ich habe nicht geantwortet" kein
    // Grund, sie mitzugeben — beide Aufrufer kehren auf `null` zurueck.
    expect(menuSrc).toMatch(/if \(answer === null\) return/)
    expect(syncSrc.length).toBeGreaterThan(0)
  })
})
