import { describe, expect, it } from 'vitest'
import {
  gruppenBefunde,
  naechsteGruppenId,
  portGruppen,
  PORT_GROUP_INFO,
} from '../src/renderer/lib/portGroups'
import type { Port } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// #832 — „Inputs und Outputs gruppieren. Z.b 2 Mono Klinken als ein Stereo
// kennzeichnen." (Meldung des Eigentümers, 2026-09-10)
//
// Diese Gruppe ist bewusst NICHT `dualLinkGroup`. Die SDI-Gruppen tragen eine
// Protokoll-Aussage, die ATEM- und Videohub-Ausgaben lesen; ein Stereo-Paar
// trägt keine. Wer beides in ein Feld legt, meldet ein Klinken-Paar als
// SDI-Dual-Link — an eine Kreuzschiene, die es zu schalten versucht.
// ---------------------------------------------------------------------------

const port = (teil: Partial<Port> & { id: string }): Port =>
  ({ name: teil.id, connectorType: 'Jack 6.35 mm TS', ...teil }) as Port

describe('Welche Ports gehören zusammen', () => {
  it('fasst gleiche Gruppen-Ids zusammen', () => {
    const ports = [
      port({ id: 'a', portGroup: 'SP-1', portGroupKind: 'stereo', portGroupRole: 'L' }),
      port({ id: 'b', portGroup: 'SP-1', portGroupKind: 'stereo', portGroupRole: 'R' }),
      port({ id: 'c' }),
    ]
    const g = portGruppen(ports)
    expect(g).toHaveLength(1)
    expect(g[0].id).toBe('SP-1')
    expect(g[0].ports.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('lässt Ports ohne Gruppe weg statt eine Ein-Port-Gruppe zu erfinden', () => {
    expect(portGruppen([port({ id: 'a' }), port({ id: 'b' })])).toEqual([])
  })

  it('hält mehrere Gruppen auseinander', () => {
    const ports = [
      port({ id: 'a', portGroup: 'SP-1' }),
      port({ id: 'b', portGroup: 'SP-2' }),
      port({ id: 'c', portGroup: 'SP-1' }),
    ]
    expect(portGruppen(ports).map((g) => g.ports.length)).toEqual([2, 1])
  })
})

describe('Was an einer Gruppe nicht stimmen kann', () => {
  it('meldet eine Stereo-Gruppe mit drei Mitgliedern', () => {
    const ports = ['a', 'b', 'c'].map((id) =>
      port({ id, portGroup: 'SP-1', portGroupKind: 'stereo' }),
    )
    expect(gruppenBefunde(ports)).toContainEqual({
      art: 'groesse',
      gruppe: 'SP-1',
      erwartet: 2,
      ist: 3,
    })
  })

  it('meldet auch die Gruppe, der ein Mitglied FEHLT', () => {
    // Der haeufigere Fall und der teurere: jemand markiert den linken Kanal
    // und wird unterbrochen. Auf dem Blatt steht danach ein Stereo-Anschluss
    // mit einem Kabel.
    const ports = [port({ id: 'a', portGroup: 'SP-1', portGroupKind: 'stereo' })]
    expect(gruppenBefunde(ports)).toContainEqual({
      art: 'groesse',
      gruppe: 'SP-1',
      erwartet: 2,
      ist: 1,
    })
  })

  it('meldet zwei verschiedene Arten in derselben Gruppe', () => {
    const ports = [
      port({ id: 'a', portGroup: 'SP-1', portGroupKind: 'stereo' }),
      port({ id: 'b', portGroup: 'SP-1', portGroupKind: 'ms' }),
    ]
    const b = gruppenBefunde(ports)
    expect(b.some((x) => x.art === 'artenmix')).toBe(true)
  })

  it('meldet zweimal dieselbe Rolle', () => {
    // Zwei linke Kanäle sind kein Stereo, sondern eine vertauschte Angabe —
    // und im Aufbau steckt danach jemand beide Kabel auf denselben Eingang.
    const ports = [
      port({ id: 'a', portGroup: 'SP-1', portGroupKind: 'stereo', portGroupRole: 'L' }),
      port({ id: 'b', portGroup: 'SP-1', portGroupKind: 'stereo', portGroupRole: 'L' }),
    ]
    expect(gruppenBefunde(ports)).toContainEqual({
      art: 'rolle-doppelt',
      gruppe: 'SP-1',
      rolle: 'L',
    })
  })

  it('schweigt bei einer vollständigen Stereo-Gruppe', () => {
    const ports = [
      port({ id: 'a', portGroup: 'SP-1', portGroupKind: 'stereo', portGroupRole: 'L' }),
      port({ id: 'b', portGroup: 'SP-1', portGroupKind: 'stereo', portGroupRole: 'R' }),
    ]
    expect(gruppenBefunde(ports)).toEqual([])
  })

  it('schweigt bei einer Gruppe OHNE Art — auch bei fünf Mitgliedern', () => {
    // DIE GEGENPROBE. „Diese gehören zusammen" ist eine vollständige Aussage,
    // auch ohne zu sagen wie. Eine erwartete Größe daneben zu erfinden hieße,
    // eine Angabe zu prüfen, die niemand gemacht hat.
    const ports = ['a', 'b', 'c', 'd', 'e'].map((id) => port({ id, portGroup: 'X' }))
    expect(gruppenBefunde(ports)).toEqual([])
  })

  it('schweigt bei `sonstige`, auch bei drei Mitgliedern', () => {
    // Dieselbe Regel an der Art selbst: `sonstige` hat keine erwartete Größe.
    expect(PORT_GROUP_INFO.sonstige.groesse).toBeUndefined()
    const ports = ['a', 'b', 'c'].map((id) =>
      port({ id, portGroup: 'X', portGroupKind: 'sonstige' }),
    )
    expect(gruppenBefunde(ports)).toEqual([])
  })

  it('lässt eine leere Rolle durch statt sie als Dublette zu zählen', () => {
    const ports = [
      port({ id: 'a', portGroup: 'SP-1', portGroupKind: 'stereo', portGroupRole: '' }),
      port({ id: 'b', portGroup: 'SP-1', portGroupKind: 'stereo' }),
    ]
    expect(gruppenBefunde(ports)).toEqual([])
  })
})

describe('Die nächste Gruppen-Id', () => {
  it('zählt hoch und überspringt Belegtes', () => {
    const ports = [port({ id: 'a', portGroup: 'SP-1' }), port({ id: 'b', portGroup: 'SP-3' })]
    expect(naechsteGruppenId(ports)).toBe('SP-2')
  })

  it('fängt bei SP-1 an, wenn nichts belegt ist', () => {
    expect(naechsteGruppenId([])).toBe('SP-1')
  })

  it('ist lesbar statt eindeutig-und-unaussprechlich', () => {
    // Sie steht in der Oberfläche und auf dem gedruckten Blatt. `SP-2` liest
    // jemand vor, eine UUID nicht.
    expect(naechsteGruppenId([])).toMatch(/^SP-\d+$/)
  })
})

describe('Der Powerlock-Satz (#665)', () => {
  const satz = (rollen: readonly string[]) =>
    rollen.map((r) =>
      port({ id: `p-${r}`, portGroup: 'PL-IN', portGroupKind: 'powerlock', portGroupRole: r }),
    )

  it('sind fünf Adern und nicht eine', () => {
    // Sie als EINEN Port zu führen wäre bequem und falsch: auf dem Blatt
    // stünde ein Kabel, wo fünf liegen, und die Stückliste zählte vier zu
    // wenig.
    expect(PORT_GROUP_INFO.powerlock.groesse).toBe(5)
    expect(PORT_GROUP_INFO.powerlock.rollen).toEqual(['L1', 'L2', 'L3', 'N', 'PE'])
  })

  it('ein vollständiger Satz gibt nichts zurück', () => {
    expect(gruppenBefunde(satz(['L1', 'L2', 'L3', 'N', 'PE']))).toEqual([])
  })

  it('ein Satz OHNE PE fällt auf', () => {
    // Der Fall, um den es geht. Vier zu stecken und den fünften zu vergessen
    // ist kein halber Anschluss.
    expect(gruppenBefunde(satz(['L1', 'L2', 'L3', 'N']))).toContainEqual({
      art: 'groesse',
      gruppe: 'PL-IN',
      erwartet: 5,
      ist: 4,
    })
  })
})

describe('Jede Art nennt Rollen, die zu ihrer Größe passen', () => {
  it('so viele Rollen wie Mitglieder — oder gar keine', () => {
    // Sonst böte die Oberfläche eine Rolle an, die in keine Gruppe passt, und
    // die Prüfung darunter meldete sie als Dublette.
    for (const [art, info] of Object.entries(PORT_GROUP_INFO)) {
      if (info.groesse === undefined) {
        expect(info.rollen, `${art}: ohne Größe auch ohne Rollen`).toEqual([])
      } else {
        expect(info.rollen.length, `${art}`).toBe(info.groesse)
      }
    }
  })
})
