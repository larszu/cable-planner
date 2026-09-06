import { describe, expect, it } from 'vitest'
import {
  HANDOVER_SIGNATURE_HEADERS,
  LEG_LABEL,
  NOT_SIGNED,
  SIGNATURE_REFUSAL_LABEL,
  SIGNATURE_RULE,
  SIGNATURE_STATE_LABEL,
  handoverFindings,
  handoverSignatureTable,
  signHandover,
  signatureRefusal,
  signatureState,
} from '../src/renderer/lib/handoverSignature'
import type { CheckoutRecord } from '../src/renderer/types/checkout'
import libQuelle from '../src/renderer/lib/handoverSignature.ts?raw'
import typenQuelle from '../src/renderer/types/checkout.ts?raw'
import storeQuelle from '../src/renderer/store/checkoutStore.ts?raw'
import dialogQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Eine Unterschrift je Container — und eine fuer den Rueckweg
// (Bedarf 136, P4).
//
//   > Each asset in a bulk handover has to be signed for separately;
//   > CHECK-IN HAS NO SIGNATURE AT ALL, so the return leg has no
//   > counter-signed evidence when a dispute arises weeks later.
//
// Belegt an `grokability/snipe-it#19070` (2026-05-26) und `#19114`
// (2026-05-29), beide offen.
//
// Die erste Haelfte war seit Bedarf 15 erfuellt: ein `CheckoutRecord` ist EIN
// Container mit eingefrorenem Inhalt — eine Unterschrift fuer alles darin.
// Was fehlte, ist der RUECKWEG, und der ist der teurere.
// ---------------------------------------------------------------------------

const jetzt = '2026-09-06T10:00:00.000Z'

const beleg = (over: Partial<CheckoutRecord> = {}): CheckoutRecord => ({
  id: 'v1',
  nodeId: 'case-1',
  nodeLabel: 'Case 1',
  out: { at: '2026-09-01T08:00:00.000Z', to: 'Truck 3' },
  contents: [],
  ...over,
})

const zurueck = (over: Partial<CheckoutRecord> = {}): CheckoutRecord =>
  beleg({ in: { at: '2026-09-05T18:00:00.000Z', missing: [], extra: [] }, ...over })

// ── 1. Die Absage hat einen Namen ──────────────────────────────────────────

describe('signatureRefusal', () => {
  it('laesst die gewoehnliche Quittung zu', () => {
    expect(signatureRefusal(beleg(), 'out', 'Lars')).toBeNull()
    expect(signatureRefusal(zurueck(), 'in', 'Lars')).toBeNull()
  })

  it('lehnt die namenlose Unterschrift ab', () => {
    expect(signatureRefusal(beleg(), 'out', '   ')).toBe('no-name')
  })

  it('lehnt die Gegenzeichnung ab, solange nichts zurueck ist', () => {
    // Sonst quittierte jemand etwas, das noch im Truck liegt.
    expect(signatureRefusal(beleg(), 'in', 'Lars')).toBe('not-returned')
  })

  it('ueberschreibt eine vorhandene Unterschrift NICHT', () => {
    // `CheckoutRecord` ist append-only, „weil ein Beleg nicht nachtraeglich
    // anders lauten darf". Eine Unterschrift, die sich stillschweigend
    // austauschen laesst, ist keine.
    const schon = beleg({ out: { at: jetzt, to: 'Truck 3', signature: { name: 'Anna', at: jetzt } } })
    expect(signatureRefusal(schon, 'out', 'Lars')).toBe('already-signed')
  })

  it('haelt fuer jede Absage eine lesbare Ueberschrift bereit', () => {
    for (const k of ['no-name', 'already-signed', 'not-returned'] as const) {
      expect(SIGNATURE_REFUSAL_LABEL[k].length).toBeGreaterThan(20)
    }
  })
})

// ── 2. Das Setzen ──────────────────────────────────────────────────────────

describe('signHandover', () => {
  it('setzt die Unterschrift auf dem richtigen Bein', () => {
    const r = signHandover(beleg(), 'out', { name: 'Lars', at: jetzt })
    expect('record' in r && r.record.out.signature?.name).toBe('Lars')
    expect('record' in r && r.record.in).toBeUndefined()
  })

  it('laesst den alten Datensatz unberuehrt', () => {
    // Dieselbe Regel wie bei `closeCheckout`.
    const alt = beleg()
    signHandover(alt, 'out', { name: 'Lars', at: jetzt })
    expect(alt.out.signature).toBeUndefined()
  })

  it('gegenzeichnet die Rueckgabe, ohne die Ausgabe anzufassen', () => {
    const r = signHandover(zurueck(), 'in', { name: 'Lars', at: jetzt })
    expect('record' in r && r.record.in?.signature?.name).toBe('Lars')
    expect('record' in r && r.record.out.signature).toBeUndefined()
  })

  it('schneidet Leerraum ab und laesst die leere Bemerkung weg', () => {
    const r = signHandover(beleg(), 'out', { name: '  Lars  ', at: jetzt, note: '   ' })
    expect('record' in r && r.record.out.signature?.name).toBe('Lars')
    expect('record' in r && 'note' in (r.record.out.signature ?? {})).toBe(false)
  })

  it('liefert die Absage, statt still nichts zu tun', () => {
    const r = signHandover(beleg(), 'in', { name: 'Lars', at: jetzt })
    expect('refusal' in r && r.refusal).toBe('not-returned')
  })
})

// ── 3. Der Zustand ─────────────────────────────────────────────────────────

describe('signatureState', () => {
  it('unterscheidet die vier Faelle', () => {
    expect(signatureState(beleg())).toBe('none')
    expect(
      signatureState(beleg({ out: { at: jetzt, to: 'x', signature: { name: 'A', at: jetzt } } })),
    ).toBe('out-only')
    expect(
      signatureState(
        zurueck({ in: { at: jetzt, missing: [], extra: [], signature: { name: 'B', at: jetzt } } }),
      ),
    ).toBe('in-only')
    expect(
      signatureState(
        zurueck({
          out: { at: jetzt, to: 'x', signature: { name: 'A', at: jetzt } },
          in: { at: jetzt, missing: [], extra: [], signature: { name: 'B', at: jetzt } },
        }),
      ),
    ).toBe('both')
  })

  it('haelt fuer jeden Zustand eine lesbare Ueberschrift bereit', () => {
    for (const k of ['both', 'out-only', 'in-only', 'none'] as const) {
      expect(SIGNATURE_STATE_LABEL[k].length).toBeGreaterThan(5)
    }
  })
})

// ── 4. Der Befund, um den es geht ──────────────────────────────────────────

describe('handoverFindings', () => {
  it('macht aus der fehlenden GEGENZEICHNUNG einen FEHLER', () => {
    // Der Beleg beschreibt genau diesen Zustand als den, der wochenlang
    // folgenlos aussieht und dann den Streit entscheidet.
    const f = handoverFindings([zurueck()])
    const offen = f.find((x) => x.kind === 'unsigned-in')
    expect(offen?.severity).toBe('error')
    expect(offen?.message).toContain('Aussage gegen Aussage')
  })

  it('macht aus der fehlenden Ausgabe-Quittung nur einen Hinweis', () => {
    // Der Container ist noch unterwegs, die Unterschrift kann nachkommen —
    // ein Fehler auf jedem laufenden Vorgang waere Laerm.
    const f = handoverFindings([beleg()])
    expect(f.map((x) => [x.kind, x.severity])).toEqual([['unsigned-out', 'warning']])
  })

  it('meldet nichts bei einem beidseitig quittierten Vorgang', () => {
    expect(
      handoverFindings([
        zurueck({
          out: { at: jetzt, to: 'x', signature: { name: 'A', at: jetzt } },
          in: { at: jetzt, missing: [], extra: [], signature: { name: 'B', at: jetzt } },
        }),
      ]),
    ).toEqual([])
  })

  it('meldet KEINE fehlende Gegenzeichnung, solange nichts zurueck ist', () => {
    expect(handoverFindings([beleg()]).some((x) => x.kind === 'unsigned-in')).toBe(false)
  })
})

// ── 5. Der Quittungs-Block ─────────────────────────────────────────────────

describe('handoverSignatureTable', () => {
  it('haelt den Spaltenkopf fest', () => {
    expect(handoverSignatureTable(beleg()).headers).toEqual([...HANDOVER_SIGNATURE_HEADERS])
  })

  it('druckt IMMER beide Zeilen — auch die fuer ein Bein, das es noch nicht gibt', () => {
    // Das Blatt faehrt mit dem Case mit. Wer die zweite Zeile erst druckt,
    // wenn die Rueckgabe eingetragen ist, kommt genau einen Vorgang zu spaet —
    // und dann unterschreibt wieder niemand.
    const rows = handoverSignatureTable(beleg()).rows
    expect(rows).toHaveLength(2)
    expect(rows[0][1]).toBe(LEG_LABEL.out)
    expect(rows[1][1]).toBe(LEG_LABEL.in)
  })

  it('setzt die STRICHLINIE, wo niemand unterschrieben hat', () => {
    // Eine leere Zelle liest sich, als sei nichts vorgesehen.
    const [aus] = handoverSignatureTable(beleg()).rows
    expect(aus[2]).toBe(NOT_SIGNED)
    expect(aus[5]).toBe(SIGNATURE_RULE)
  })

  it('setzt Name und Datum ein, wo unterschrieben wurde — und KEINE Strichlinie', () => {
    const [aus] = handoverSignatureTable(
      beleg({ out: { at: jetzt, to: 'x', signature: { name: 'Lars', at: jetzt, note: 'ok' } } }),
    ).rows
    expect(aus[2]).toBe('Lars')
    expect(aus[3]).toBe('2026-09-06')
    expect(aus[4]).toBe('ok')
    expect(aus[5]).toBe('')
  })

  it('traegt bei der unquittierten Zeile das Datum DES BEINS, nicht der Unterschrift', () => {
    const rows = handoverSignatureTable(zurueck()).rows
    expect(rows[0][3]).toBe('2026-09-01')
    expect(rows[1][3]).toBe('2026-09-05')
  })
})

// ── 6. Reinheit, Store und Oberflaeche ─────────────────────────────────────

describe('das Modul, der Store und die Oberflaeche', () => {
  it('nimmt keine Uhr und keinen Store', () => {
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useCheckoutStore')
  })

  it('fuehrt KEIN Bild der Unterschrift', () => {
    // Ein gemaltes Feld, dessen Echtheit niemand pruefen kann, waere eine
    // Zusage ueber Beweiskraft, die diese Anwendung nicht halten kann.
    expect(typenQuelle).toContain('KEINE BILD-UNTERSCHRIFT')
    expect(libQuelle).not.toContain('dataUrl')
    expect(libQuelle).not.toContain('image')
  })

  it('haengt die Unterschrift an BEIDE Beine des Typs', () => {
    const aus = typenQuelle.indexOf('export interface CheckoutOut')
    const ein = typenQuelle.indexOf('export interface CheckoutIn')
    expect(typenQuelle.slice(aus, typenQuelle.indexOf('}', aus))).toContain('signature?')
    expect(typenQuelle.slice(ein, typenQuelle.indexOf('}', ein))).toContain('signature?')
  })

  it('nimmt die Uhr im STORE, wo die Unterschrift geleistet wird', () => {
    // Auf den SIGN-Block geschnitten: `new Date()` steht im Store ohnehin
    // dreimal (Ausgabe, Rueckgabe, Quittung), und eine Zusicherung auf die
    // ganze Datei ginge durch, wenn ausgerechnet hier ein fester Zeitpunkt
    // stuende. Die Gegenprobe hat genau das durchgelassen.
    const block = storeQuelle.slice(
      storeQuelle.indexOf('  sign: (recordId, leg, name, note) =>'),
      storeQuelle.indexOf('  removeRecord: (recordId) =>'),
    )
    expect(block.length).toBeGreaterThan(0)
    expect(block).toContain('at: new Date().toISOString()')
    expect(block).toContain('signHandover(vorhanden, leg,')
  })

  it('gibt die Absage aus dem Store zurueck, statt sie zu schlucken', () => {
    expect(storeQuelle).toContain("absage = 'unknown-record'")
    expect(storeQuelle).toContain('absage = gesetzt.refusal')
  })

  it('bietet die Gegenzeichnung erst an, wenn etwas zurueck ist', () => {
    expect(dialogQuelle).toContain("if (leg === 'in' && !r.in) return null")
  })

  it('zeigt die Absage, statt sie stumm zu verwerfen', () => {
    expect(dialogQuelle).toContain('setSignRefusal(')
    expect(dialogQuelle).toContain('{signRefusal && (')
  })
})
