// Lange Beruehrung statt Rechtsklick (#877).
//
// Die Ketten, die auf dem Geraet schiefgehen und die man beim Lesen des Codes
// nicht sieht: die Hand, die zwei Pixel wandert; der Zug, der zwanzig wandert;
// der zweite Finger; das `pointercancel`; und dieselbe Beruehrung, die das
// Menue nicht zweimal oeffnen darf.
import { describe, it, expect } from 'vitest'
import { DRUCK_MS, DRUCK_SCHLUPF_PX, LangerDruck } from '../src/renderer/lib/langerDruck'

const finger = (zeigerId: number, x: number, y: number) => ({ zeigerId, x, y, art: 'touch' })

describe('LangerDruck', () => {
  it('loest nach der Haltezeit aus', () => {
    const d = new LangerDruck()
    expect(d.runter(finger(1, 100, 100), 0).art).toBe('warten')
    expect(d.pruefe(DRUCK_MS - 1).art).toBe('warten')
    expect(d.pruefe(DRUCK_MS)).toEqual({ art: 'ausloesen', x: 100, y: 100 })
  })

  it('oeffnet das Menue nicht zweimal', () => {
    const d = new LangerDruck()
    d.runter(finger(1, 10, 10), 0)
    expect(d.pruefe(DRUCK_MS).art).toBe('ausloesen')
    expect(d.pruefe(DRUCK_MS + 100).art).toBe('abbrechen')
  })

  it('haelt eine ruhige Hand aus', () => {
    // Zwei Pixel sind keine Bewegung, das ist eine Hand.
    const d = new LangerDruck()
    d.runter(finger(1, 100, 100), 0)
    expect(d.bewegt(finger(1, 102, 99)).art).toBe('warten')
    expect(d.pruefe(DRUCK_MS).art).toBe('ausloesen')
  })

  it('bricht bei einem Zug ab', () => {
    // Ein Kontextmenue mitten im Zug ist ein Abbruch dessen, was der Nutzer
    // wollte — und der Zug ist hier das Verbinden zweier Ports.
    const d = new LangerDruck()
    d.runter(finger(1, 100, 100), 0)
    expect(d.bewegt(finger(1, 100 + DRUCK_SCHLUPF_PX + 1, 100)).art).toBe('abbrechen')
    expect(d.pruefe(DRUCK_MS).art).toBe('abbrechen')
  })

  it('bricht beim zweiten Finger ab', () => {
    // Zwei Finger heissen kneifen oder schieben. Das Menue waere im Weg.
    const d = new LangerDruck()
    d.runter(finger(1, 100, 100), 0)
    expect(d.runter(finger(2, 300, 100), 10).art).toBe('abbrechen')
    expect(d.pruefe(DRUCK_MS).art).toBe('abbrechen')
  })

  it('bricht ab, wenn der Finger hochgeht', () => {
    const d = new LangerDruck()
    d.runter(finger(1, 100, 100), 0)
    d.hoch(1)
    expect(d.pruefe(DRUCK_MS).art).toBe('abbrechen')
  })

  it('bricht ab, wenn der Browser die Geste uebernimmt', () => {
    // `pointercancel` kommt ohne Zeiger-Kennung durch — es gilt trotzdem.
    const d = new LangerDruck()
    d.runter(finger(1, 100, 100), 0)
    d.hoch()
    expect(d.laeuft).toBe(false)
  })

  it('laesst die Maus in Ruhe', () => {
    // Sie hat ihre rechte Taste. Ein Menue nach einer halben Sekunde
    // Stillhalten waere am Schreibtisch eine Ueberraschung und kein Griff.
    const d = new LangerDruck()
    expect(d.runter({ zeigerId: 1, x: 5, y: 5, art: 'mouse' }, 0).art).toBe('abbrechen')
    expect(d.pruefe(DRUCK_MS).art).toBe('abbrechen')
  })

  it('nimmt den Stift wie den Finger', () => {
    // Der Apple Pencil meldet sich als `pen`, und er ist der Grund fuer das
    // ganze Issue.
    const d = new LangerDruck()
    expect(d.runter({ zeigerId: 1, x: 5, y: 5, art: 'pen' }, 0).art).toBe('warten')
    expect(d.pruefe(DRUCK_MS).art).toBe('ausloesen')
  })

  it('ignoriert die Bewegung eines fremden Zeigers', () => {
    const d = new LangerDruck()
    d.runter(finger(1, 100, 100), 0)
    expect(d.bewegt(finger(9, 900, 900)).art).toBe('warten')
    expect(d.pruefe(DRUCK_MS).art).toBe('ausloesen')
  })

  it('haelt die Werte des Systems ein', () => {
    // Dieselbe Geste soll sich im Plan anfuehlen wie ueberall sonst auf dem
    // Geraet — sonst haelt der Nutzer nicht die App fuer eigen, sondern sich
    // fuer ungeschickt.
    expect(DRUCK_MS).toBe(500)
    expect(DRUCK_SCHLUPF_PX).toBe(10)
  })

  it('vergisst beim Leeren alles', () => {
    const d = new LangerDruck()
    d.runter(finger(1, 1, 1), 0)
    d.leeren()
    expect(d.laeuft).toBe(false)
    // Und ein Finger danach faengt sauber an, statt als „zweiter" zu gelten.
    expect(d.runter(finger(1, 1, 1), 0).art).toBe('warten')
  })
})
