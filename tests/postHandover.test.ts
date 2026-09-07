import { describe, expect, it } from 'vitest'
import {
  NO_RECORDER,
  NO_SWITCHER,
  buildHandoverManifest,
  cameraLetter,
  cardPrefixFor,
  handoverManifestTable,
  recordText,
  sanitisePrefix,
} from '../src/renderer/lib/postHandover'
import { detectRecording } from '../src/renderer/lib/recording'
import { resolveDeviceType } from '../src/renderer/lib/deviceTypeRegistry'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import { MONITOR_CATALOG } from '../src/renderer/lib/monitorCatalog'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { SourceIdentity } from '../src/renderer/types/sourceIdentity'
import quelle from '../src/renderer/lib/postHandover.ts?raw'
import registerQuelle from '../src/renderer/lib/documentRegistry.ts?raw'
import packetQuelle from '../src/renderer/components/Export/PacketSection.tsx?raw'

// ---------------------------------------------------------------------------
// Die Uebergabe an die Post (Bedarf 62, P2).
//
//   > Card labelling and media reports are a manual discipline; CAMERA
//   > IDENTITY IN POST ('B_Day1_003') HAS NO LINK TO THE PLANNED POSITION.
//
// Der teuerste Fehler waere hier eine erfundene Kanalnummer: ein HyperDeck
// hat keine, und eine auf dem Blatt schickt die Post an eine Datei, die es
// nicht gibt. Der groesste Teil dieser Tests haelt deshalb fest, WAS NICHT
// behauptet wird.
// ---------------------------------------------------------------------------

const port = (id: string, name: string) =>
  ({ id, name, type: 'video', connectorType: 'BNC' }) as never

const geraet = (id: string, name: string, extra: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id,
    name,
    type: 'camera',
    x: 0,
    y: 0,
    inputs: [],
    outputs: [],
    ...extra,
  }) as unknown as EquipmentItem

const kabel = (id: string, from: string, fromPort: string, to: string, toPort: string): Cable =>
  ({
    id,
    fromEquipmentId: from,
    fromPortId: fromPort,
    toEquipmentId: to,
    toPortId: toPort,
  }) as unknown as Cable

const rolle = (id: string, name: string, number?: number): SourceIdentity =>
  ({ id, name, ...(number !== undefined ? { number } : {}) }) as SourceIdentity

/** Kamera 1 → ATEM (kein ISO). Die Grundform, auf der die anderen aufbauen. */
const aufbau = (mischerName = 'ATEM 4 M/E') => {
  const cam = geraet('cam1', 'Kamera 1', {
    sourceIdentityId: 'r1',
    outputs: [port('cam1-out', 'SDI Out')],
  } as never)
  const atem = geraet('sw1', mischerName, {
    type: 'switcher',
    inputs: [port('sw1-in1', 'SDI In 1'), port('sw1-in2', 'SDI In 2')],
  } as never)
  return {
    equipment: [cam, atem],
    cables: [kabel('c1', 'cam1', 'cam1-out', 'sw1', 'sw1-in2')],
    sourceIdentities: [rolle('r1', 'Kamera 1', 2)],
  }
}

describe('Bedarf 62 — die Übergabe an die Post', () => {
  // -- 1 --------------------------------------------------------------------
  it('der Kamerabuchstabe kommt aus der Rolle und hoert bei Z auf', () => {
    expect(cameraLetter(1)).toBe('A')
    expect(cameraLetter(2)).toBe('B')
    expect(cameraLetter(26)).toBe('Z')
    // Jenseits von 26 gibt es KEINEN Buchstaben. „AA" waere eine Regel, die
    // niemand vereinbart hat — und zwei Rollen koennten darunter denselben
    // Namen bekommen.
    expect(cameraLetter(27)).toBeNull()
    expect(cameraLetter(0)).toBeNull()
    expect(cameraLetter(-3)).toBeNull()
    expect(cameraLetter(1.5)).toBeNull()
    expect(cameraLetter(undefined)).toBeNull()
  })

  // -- 2 --------------------------------------------------------------------
  it('ohne Nummer traegt das Praefix den bereinigten Namen — und sagt das', () => {
    expect(cardPrefixFor({ name: 'Kamera 1', number: 3 })).toEqual({
      prefix: 'C',
      basis: 'number',
    })
    // Ohne Nummer und jenseits von Z ist die Grundlage eine ANDERE, und das
    // steht in der Antwort: ein „A" aus der Nummer und ein „A" aus dem Namen
    // saehen auf dem Blatt sonst gleich aus.
    expect(cardPrefixFor({ name: 'Bühne links' })).toEqual({
      prefix: 'Buhne_links',
      basis: 'name',
    })
    expect(cardPrefixFor({ name: 'Kamera 1', number: 27 }).basis).toBe('name')

    // Umlaute, Leerzeichen und Sonderzeichen ueberleben Karten-Ordner nicht.
    expect(sanitisePrefix('Kamera 1')).toBe('Kamera_1')
    expect(sanitisePrefix('Über/Kopf')).toBe('Uber_Kopf')
    expect(sanitisePrefix('  Rand  ')).toBe('Rand')
    // Bleibt nichts uebrig, wird nichts erfunden.
    expect(sanitisePrefix('///')).toBe('')
    expect(cardPrefixFor({ name: '///' }).prefix).toBe('ohne Praefix')
  })

  // -- 3 --------------------------------------------------------------------
  it('das Datenblatt entscheidet, ob ein Geraet aufzeichnet', () => {
    const hyperdeck = BLACKMAGIC_CATALOG.find((e) =>
      e.template.name.includes('Hyperdeck'),
    )!
    const isoMischer = BLACKMAGIC_CATALOG.find((e) =>
      e.template.name.includes('Mini Pro ISO'),
    )!
    expect(resolveDeviceType(hyperdeck.deviceTypeId)?.records).toBe('per-device')
    expect(resolveDeviceType(isoMischer.deviceTypeId)?.records).toBe('per-input')
    // Ein Shogun ist Monitor UND Recorder — genau der Fall, den ein einzelnes
    // `kind` nicht sagen koennte.
    const shogun = MONITOR_CATALOG.find((e) => e.template.name.includes('Shogun Ultra'))!
    expect(resolveDeviceType(shogun.deviceTypeId)?.records).toBe('per-device')

    expect(
      detectRecording(geraet('x', 'egal', { deviceTypeId: hyperdeck.deviceTypeId } as never)),
    ).toBe('per-device')
    expect(
      detectRecording(geraet('x', 'egal', { deviceTypeId: isoMischer.deviceTypeId } as never)),
    ).toBe('per-input')
  })

  it('ein Katalog-Treffer ohne Aufnahme ist eine AUSSAGE, kein Schweigen', () => {
    // Ein Katalog-Geraet, das nicht aufzeichnet, bleibt auch dann „nein",
    // wenn sein Name die Heuristik ansprechen wuerde. Sonst ueberstimmte ein
    // Regex das Datenblatt — und zwar unbemerkt.
    const atemOhneIso = BLACKMAGIC_CATALOG.find(
      (e) => e.template.name === 'Blackmagic ATEM Mini Pro',
    )
    if (atemOhneIso) {
      expect(resolveDeviceType(atemOhneIso.deviceTypeId)?.records).toBeUndefined()
      expect(
        detectRecording(geraet('x', 'ATEM Mini Pro ISO', {
          deviceTypeId: atemOhneIso.deviceTypeId,
        } as never)),
      ).toBeNull()
    }
    // Ohne Katalog-Zuordnung greift die Heuristik.
    expect(detectRecording(geraet('x', 'HyperDeck Studio 4K'))).toBe('per-device')
    expect(detectRecording(geraet('x', 'ATEM Mini Extreme ISO'))).toBe('per-input')
    // „ISO" ALLEIN macht keinen ISO-Mischer: es steht auf Objektiven, in
    // Empfindlichkeitsangaben und in Dateinamen. Ohne die ATEM-Bedingung
    // bekaeme ein „ISO 800 Monitor" eine Kanalnummer je Eingang.
    expect(detectRecording(geraet('x', 'Monitor ISO 800'))).toBeNull()
    expect(detectRecording(geraet('x', 'ISO-Konverter'))).toBeNull()
    // Und sie schweigt lieber, als zu raten.
    expect(detectRecording(geraet('x', 'Aufnahmeraum-Panel'))).toBeNull()
    expect(detectRecording(geraet('x', 'Sony FX9'))).toBeNull()
  })

  // -- 4 --------------------------------------------------------------------
  it('ohne Recorder im Plan steht das auf dem Blatt', () => {
    const m = buildHandoverManifest(aufbau())
    expect(m.rows).toHaveLength(1)
    expect(m.rows[0].cardPrefix).toBe('B')
    expect(m.rows[0].switcherName).toBe('ATEM 4 M/E')
    expect(m.rows[0].switcherInput).toBe(2)
    expect(m.rows[0].record).toEqual({ kind: 'none' })
    // Gegen den TEXT und nicht gegen die Konstante: `toBe(NO_RECORDER)` bliebe
    // auch dann gruen, wenn jemand die Konstante auf '' setzt — und genau das
    // ist der Fall, gegen den dieses Blatt geschrieben ist. Nachgemessen: die
    // Gegenprobe „kein Recorder wird zur leeren Zelle" ueberlebte so.
    expect(recordText(m.rows[0].record)).toBe('kein Recorder im Plan')
    expect(NO_RECORDER).toBe('kein Recorder im Plan')
  })

  // -- 5 --------------------------------------------------------------------
  it('ein ISO-Mischer beantwortet die Frage mit der Eingangsnummer', () => {
    const plan = aufbau('ATEM Mini Extreme ISO')
    const m = buildHandoverManifest(plan)
    expect(m.rows[0].record).toEqual({
      kind: 'switcher-iso',
      recorder: 'ATEM Mini Extreme ISO',
      channel: 2,
    })
    // Es ist DIESELBE Zahl wie der Mischer-Eingang — keine zweite Wahrheit
    // ueber dieselbe Sache.
    expect(m.rows[0].switcherInput).toBe(2)
    expect(recordText(m.rows[0].record)).toContain('ISO-Kanal 2')
  })

  // -- 6 --------------------------------------------------------------------
  it('ein eigener Recorder nennt Geraet und Eingang, aber keinen Kanal', () => {
    const plan = aufbau()
    const rec = geraet('rec1', 'HyperDeck Studio HD Plus', {
      type: 'recorder',
      inputs: [port('rec1-in1', 'SDI In 1'), port('rec1-in2', 'SDI In 2')],
    } as never)
    plan.equipment.push(rec)
    plan.cables.push(kabel('c2', 'cam1', 'cam1-out', 'rec1', 'rec1-in1'))
    const m = buildHandoverManifest(plan)
    expect(m.rows[0].record).toEqual({
      kind: 'recorder',
      recorder: 'HyperDeck Studio HD Plus',
      input: 1,
    })
    // Kein „Kanal": den gibt es bei einem HyperDeck nicht.
    expect(recordText(m.rows[0].record)).toBe('HyperDeck Studio HD Plus · Eingang 1')
    expect(recordText(m.rows[0].record)).not.toContain('Kanal')
  })

  it('der Referenz-Eingang eines Recorders ist kein Aufnahmeweg', () => {
    // Ohne diese Regel zaehlte der Genlock-Eingang als Aufnahmeweg, und auf
    // dem Blatt staende der Sync-Generator als das, was aufgezeichnet wird.
    // Geprueft wird der PORT-Name — `isReferencePort`, dieselbe Liste wie in
    // der Label-Ableitung.
    const plan = aufbau()
    const sync = geraet('sync', 'Sync-Generator', {
      outputs: [port('sync-out', 'Ref Out')],
    } as never)
    const rec = geraet('rec1', 'HyperDeck Studio HD Plus', {
      inputs: [port('rec1-ref', 'Ref In'), port('rec1-in1', 'SDI In 1')],
    } as never)
    plan.equipment.push(sync, rec)
    plan.cables.push(kabel('c2', 'sync', 'sync-out', 'rec1', 'rec1-ref'))
    // Nur die Referenz haengt dran: fuer die Kamera gibt es keinen Recorder.
    expect(buildHandoverManifest(plan).rows[0].record).toEqual({ kind: 'none' })

    // Und der Sync-Generator taucht auch dann nirgends als Motiv auf, wenn er
    // eine Rolle traegt.
    plan.sourceIdentities.push(rolle('r9', 'Sync', 9))
    plan.equipment[plan.equipment.length - 2] = geraet('sync', 'Sync-Generator', {
      sourceIdentityId: 'r9',
      outputs: [port('sync-out', 'Ref Out')],
    } as never)
    const zeile = buildHandoverManifest(plan).rows.find((r) => r.roleId === 'r9')!
    expect(zeile.record).toEqual({ kind: 'none' })
  })

  it('bei zwei Recordern gewinnt der kleinste Eingang, nicht der erstbeste', () => {
    // `recorderInputs` folgt der Reihenfolge des `equipment`-Arrays, und die
    // ist eine Bearbeitungs-Reihenfolge. Ohne feste Ordnung traege dasselbe
    // Projekt nach einem Umsortieren einen anderen Eingang auf dem Blatt.
    const plan = aufbau()
    const rec2 = geraet('rec2', 'HyperDeck B', {
      inputs: [port('rec2-in1', 'SDI In 1'), port('rec2-in2', 'SDI In 2')],
    } as never)
    const rec1 = geraet('rec1', 'HyperDeck A', {
      inputs: [port('rec1-in1', 'SDI In 1'), port('rec1-in2', 'SDI In 2')],
    } as never)
    // Die Kamera liegt auf Eingang 2 des zuerst angelegten und auf Eingang 1
    // des zweiten — der erstbeste Treffer waere die 2.
    plan.equipment.push(rec2, rec1)
    plan.cables.push(
      kabel('c2', 'cam1', 'cam1-out', 'rec2', 'rec2-in2'),
      kabel('c3', 'cam1', 'cam1-out', 'rec1', 'rec1-in1'),
    )
    expect(buildHandoverManifest(plan).rows[0].record).toEqual({
      kind: 'recorder',
      recorder: 'HyperDeck A',
      input: 1,
    })
    // Und umsortiert kommt dasselbe heraus.
    const gedreht = buildHandoverManifest({ ...plan, equipment: [...plan.equipment].reverse() })
    expect(gedreht.rows[0].record).toEqual({
      kind: 'recorder',
      recorder: 'HyperDeck A',
      input: 1,
    })
  })

  it('der ISO-Mischer gewinnt vor dem eigenen Recorder', () => {
    // Beides zugleich ist der Normalfall in kleinen Aufbauten. Die Reihenfolge
    // ist Absicht: der Mischer-Eingang steht ohnehin auf dem Blatt, und die
    // ISO-Datei traegt genau diese Nummer.
    const plan = aufbau('ATEM Mini Pro ISO')
    const rec = geraet('rec1', 'HyperDeck Studio HD Plus', {
      inputs: [port('rec1-in1', 'SDI In 1')],
    } as never)
    plan.equipment.push(rec)
    plan.cables.push(kabel('c2', 'cam1', 'cam1-out', 'rec1', 'rec1-in1'))
    expect(buildHandoverManifest(plan).rows[0].record.kind).toBe('switcher-iso')
  })

  // -- 7 --------------------------------------------------------------------
  it('eine Rolle ohne Geraet ist eine gerechnete Luecke, keine Zeile', () => {
    const plan = aufbau()
    plan.sourceIdentities.push(rolle('r2', 'Kamera 2', 3))
    const m = buildHandoverManifest(plan)
    expect(m.rows.map((r) => r.roleId)).toEqual(['r1'])
    expect(m.gaps).toHaveLength(1)
    expect(m.gaps[0].roleId).toBe('r2')
    expect(m.gaps[0].reason).toContain('kein Gerät')

    // Wer das Geraet zuordnet, sieht die Luecke von selbst verschwinden.
    plan.equipment.push(
      geraet('cam2', 'Kamera 2', {
        sourceIdentityId: 'r2',
        outputs: [port('cam2-out', 'SDI Out')],
      } as never),
    )
    const danach = buildHandoverManifest(plan)
    expect(danach.gaps).toHaveLength(0)
    expect(danach.rows).toHaveLength(2)
  })

  // -- 8 --------------------------------------------------------------------
  it('Haupt und Backup sind ZWEI Aufzeichnungen und damit zwei Zeilen', () => {
    const plan = aufbau()
    plan.equipment.push(
      geraet('cam1b', 'Kamera 1 Backup', {
        sourceIdentityId: 'r1',
        outputs: [port('cam1b-out', 'SDI Out')],
      } as never),
    )
    plan.cables.push(kabel('c2', 'cam1b', 'cam1b-out', 'sw1', 'sw1-in1'))
    const m = buildHandoverManifest(plan)
    // Beide tragen dasselbe Praefix (es ist dieselbe Rolle), aber eigene
    // Zeilen — die zweite ist die, nach der hinterher niemand sucht.
    expect(m.rows).toHaveLength(2)
    expect(m.rows.map((r) => r.cardPrefix)).toEqual(['B', 'B'])
    expect(m.rows.map((r) => r.switcherInput)).toEqual([2, 1])
  })

  // -- 9 --------------------------------------------------------------------
  it('derselbe Plan ergibt zweimal dasselbe Blatt', () => {
    const plan = aufbau()
    plan.sourceIdentities.push(rolle('r0', 'Reserve'))
    plan.equipment.push(
      geraet('cam0', 'Reserve-Kamera', { sourceIdentityId: 'r0' } as never),
    )
    const a = buildHandoverManifest(plan)
    // Umgestellte Eingabe, gleiches Ergebnis: die Reihenfolge im
    // `equipment`-Array ist eine Bearbeitungs-Reihenfolge und darf das Blatt
    // nicht bestimmen.
    const b = buildHandoverManifest({
      ...plan,
      equipment: [...plan.equipment].reverse(),
      sourceIdentities: [...plan.sourceIdentities].reverse(),
    })
    expect(b.rows).toEqual(a.rows)
    // Nummerierte Rollen zuerst, dann die ohne Nummer.
    expect(a.rows.map((r) => r.roleName)).toEqual(['Kamera 1', 'Reserve'])
  })

  // -- 10 -------------------------------------------------------------------
  it('das Blatt traegt die Grundlage des Praefixes mit', () => {
    const plan = aufbau()
    plan.sourceIdentities.push(rolle('r0', 'Reserve'))
    plan.equipment.push(geraet('cam0', 'Reserve-Kamera', { sourceIdentityId: 'r0' } as never))
    const table = handoverManifestTable(buildHandoverManifest(plan))
    expect(table.headers[0]).toBe('Karten-Präfix')
    expect(table.headers[1]).toBe('Grundlage')
    expect(table.rows[0][1]).toBe('Rollen-Nummer')
    expect(table.rows[1][1]).toBe('Rollen-Name')
    // Und die Rolle ohne Mischer sagt das, statt eine leere Zelle zu zeigen.
    expect(table.rows[1][5]).toBe('kein Mischer-Eingang im Plan')
    expect(table.rows[1][7]).toBe('kein Recorder im Plan')
    expect(NO_SWITCHER).toBe('kein Mischer-Eingang im Plan')
  })

  // -- 11 -------------------------------------------------------------------
  it('der Weg ist verdrahtet', () => {
    // Das Blatt hat einen Stand (ADR-004) und liegt im Papierstapel.
    expect(registerQuelle).toMatch(/'post-uebergabe': ofTable\(handoverManifestTableForProject\)/)
    expect(registerQuelle).toMatch(/'post-uebergabe': 'Übergabe an die Post'/)
    // Der Import allein ist keine Verdrahtung — gepruft wird der EINTRAG in
    // der Kandidaten-Liste. Nachgemessen: gegen den blossen Namen blieb die
    // Gegenprobe „das Blatt fehlt im Papierstapel" gruen.
    expect(packetQuelle).toMatch(
      /\{ id: 'post-uebergabe', label: '[^']+', table: handoverManifestTableForProject \}/,
    )
    // Die Mischer-Nummer kommt aus der Engstelle und nicht aus einem eigenen
    // `find()` — genau daran ist die Tally-Karte einmal gescheitert.
    expect(quelle).toMatch(/switcherLinkFor\(sources, \[device\.id\]\)/)
    expect(quelle).not.toMatch(/sources\.find\(/)
    // Der Recorder-Weg laeuft NICHT ueber `sources`: das fuehrt nur Mischer-
    // und Router-Senken, ein HyperDeck steht dort in keiner Zeile. Gemessen,
    // nicht vermutet — die erste Fassung las `sources` und fand nie einen.
    expect(quelle).toMatch(/resolveSignalSource\(port\.id, ctx\)/)
    expect(quelle).toMatch(/isReferencePort\(voll\)/)
    // Rein: keine Uhr, kein Store, kein IO.
    expect(quelle).not.toMatch(/\bDate\.now\b|new Date\(|useProjectStore|window\./)
  })
})
