import { describe, expect, it } from 'vitest'
import {
  checkAllEncoders,
  checkEncoderFeasibility,
  ENCODERS,
  runOfShowSheet,
} from '../src/renderer/lib/encoderFeasibility'
import { DEFAULT_ENCODING, type DeliveryDestination } from '../src/renderer/types/delivery'
import dialogQuelle from '../src/renderer/components/Delivery/DeliveryDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Kann der Encoder, was der Plan verlangt? (Bedarfe 33 und 36)
//
// Bedarf 36 beschreibt einen Widerspruch zwischen Plan und Werkzeug:
//
//   > vMix disables multi-bitrate the moment a second destination is added and
//   > defaults all targets to identical quality; the OBS multi-RTMP plugin's
//   > per-destination quality question is open and unanswered.
//
// Und Bedarf 31 sagt, was heute stattdessen passiert: „nothing validates
// them, so the only proof the backup works is deliberately killing the primary
// during rehearsal".
//
// Der Plan DARF Qualitaet je Ziel fuehren -- Twitch nimmt 6.000 kbit/s und
// YouTube 12.000. Was fehlte, ist die Auskunft, ob das Werkzeug am Showtag das
// auch liefern kann.
//
// Geprueft wird deshalb: dass die Grenzen aus BELEGTEN Herstellerangaben
// kommen, dass „unbeantwortet" ein eigener Zustand bleibt und nicht zu „nein"
// wird, und dass auf einem einfachen Aufbau gar nichts gemeldet wird.
// ---------------------------------------------------------------------------

const ziel = (name: string, over: Partial<DeliveryDestination> = {}): DeliveryDestination => ({
  id: `id-${name}`,
  name,
  platform: 'custom',
  transport: 'RTMP',
  ingestUrl: 'rtmp://example.test/live',
  hasStreamKey: true,
  encoding: { ...DEFAULT_ENCODING },
  ...over,
})

const vmix = ENCODERS.find((e) => e.id === 'vmix')!
const obs = ENCODERS.find((e) => e.id === 'obs-multi-rtmp')!

describe('ein einfacher Aufbau meldet nichts', () => {
  it('schweigt bei einem einzigen Ziel', () => {
    expect(checkEncoderFeasibility([ziel('YouTube')], vmix)).toEqual([])
  })

  it('schweigt bei zwei Zielen mit gleicher Qualitaet', () => {
    // Der Normalfall eines Simulcasts. Eine Warnung darueber waere Rauschen
    // auf einem korrekten Aufbau -- und nach dem zweiten Mal wird auch die
    // richtige daneben ignoriert.
    expect(checkEncoderFeasibility([ziel('YouTube'), ziel('Twitch')], vmix)).toEqual([])
  })

  it('zaehlt Backups NICHT als gleichzeitige Ziele', () => {
    // Ein Backup laeuft im Havariefall, nicht daneben. Es als viertes Ziel zu
    // zaehlen ergaebe einen Befund, den es nicht gibt -- dieselbe Regel wie im
    // Uplink-Budget.
    const viele = [
      ziel('A'),
      ziel('B'),
      ziel('C'),
      ziel('A-Backup', { backupOfId: 'id-A' }),
      ziel('B-Backup', { backupOfId: 'id-B' }),
    ]
    expect(checkEncoderFeasibility(viele, vmix).filter((f) => f.kind === 'too-many-destinations')).toEqual([])
  })
})

describe('vMix — belegte Grenzen', () => {
  it('meldet mehr als drei gleichzeitige Ziele', () => {
    // „up to three destinations" (vmix.com/help23).
    const f = checkEncoderFeasibility([ziel('A'), ziel('B'), ziel('C'), ziel('D')], vmix)
    const zuViele = f.find((x) => x.kind === 'too-many-destinations')
    expect(zuViele?.values).toEqual(['4', '3'])
    expect(zuViele?.source).toContain('vmix.com')
  })

  it('meldet Qualitaet je Ziel als NICHT unterstuetzt', () => {
    // „multi-bitrate support is disabled when using multiple destinations".
    // Twitch 6.000 und YouTube 12.000 nebeneinander ist genau der Fall, in dem
    // der Plan recht hat und das Werkzeug nicht mitkommt.
    const f = checkEncoderFeasibility(
      [
        ziel('Twitch', { encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 6000 } }),
        ziel('YouTube', { encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 12000 } }),
      ],
      vmix,
    )
    expect(f.map((x) => x.kind)).toContain('per-destination-quality-unsupported')
  })

  it('nennt jedes Feld, das gleich sein muss, einzeln', () => {
    // Wer den Aufbau anpassen will, braucht die Liste der Felder und nicht die
    // Zahl. „keyframe frequency and master frame rate must match for every
    // additional streaming target".
    const f = checkEncoderFeasibility(
      [
        ziel('A', { encoding: { ...DEFAULT_ENCODING, fps: 25, keyframeSec: 2 } }),
        ziel('B', { encoding: { ...DEFAULT_ENCODING, fps: 30, keyframeSec: 4 } }),
      ],
      vmix,
    )
    const felder = f.filter((x) => x.kind === 'must-match-differs').map((x) => x.field)
    expect(felder).toContain('fps')
    expect(felder).toContain('keyframeSec')
    const fpsBefund = f.find((x) => x.field === 'fps')
    expect(fpsBefund?.values).toEqual(['25', '30'])
  })
})

describe('OBS — „unbeantwortet" ist kein „nein"', () => {
  it('meldet die Qualitaetsfrage als UNBEKANNT, nicht als nicht unterstuetzt', () => {
    // sorayuki/obs-multi-rtmp#448 ist offen und ohne Antwort des Betreuers.
    // Ein Werkzeug, dessen Verhalten niemand kennt, als „geht nicht" in den
    // Plan zu schreiben waere eine Behauptung ueber fremden Code.
    const f = checkEncoderFeasibility(
      [
        ziel('A', { encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 6000 } }),
        ziel('B', { encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 12000 } }),
      ],
      obs,
    )
    expect(f.map((x) => x.kind)).toContain('per-destination-quality-unknown')
    expect(f.map((x) => x.kind)).not.toContain('per-destination-quality-unsupported')
  })

  it('behauptet fuer OBS keine Zielgrenze', () => {
    // Es liegt keine belegte vor. Eine erfundene waere schlimmer als keine.
    expect(obs.maxDestinations).toBeUndefined()
    const f = checkEncoderFeasibility([ziel('A'), ziel('B'), ziel('C'), ziel('D'), ziel('E')], obs)
    expect(f.map((x) => x.kind)).not.toContain('too-many-destinations')
  })
})

describe('jeder Eintrag traegt seine Fundstelle', () => {
  it('kein Encoder ohne Quelle, kein Befund ohne Quelle', () => {
    // Dieselbe Regel wie beim Transport-Rechner: „an unattributed value would
    // be worse than none".
    for (const e of ENCODERS) expect(e.source.length).toBeGreaterThan(10)
    const f = checkAllEncoders([
      ziel('A', { encoding: { ...DEFAULT_ENCODING, fps: 25 } }),
      ziel('B', { encoding: { ...DEFAULT_ENCODING, fps: 30 } }),
    ])
    expect(f.length).toBeGreaterThan(0)
    for (const x of f) expect(x.source.length).toBeGreaterThan(10)
  })

  it('fuehrt nur Encoder, fuer die eine Fundstelle vorliegt', () => {
    // Ein Katalog mit zehn Encodern und geratenen Grenzen saehe vollstaendig
    // aus. Zwei belegte Zeilen sind ehrlicher.
    expect(ENCODERS.map((e) => e.id).sort()).toEqual(['obs-multi-rtmp', 'vmix'])
  })
})

describe('das Ablauf-Blatt', () => {
  it('nennt den Stream-Key als VERWEIS, nie als Wert', () => {
    // „secrets as references" sagt der Bedarf, und ein Blatt, das auf einem
    // Regieplatz liegt, ist der letzte Ort fuer ein Geheimnis.
    const t = runOfShowSheet([ziel('YouTube', { account: 'Kanal Kunde' })])
    expect(t.rows[0][5]).toBe('Schluesselbund: stream-key:id-YouTube')
    expect(JSON.stringify(t)).not.toMatch(/live-[a-z0-9-]{8,}/)
  })

  it('sagt es, wenn kein Key hinterlegt ist', () => {
    const t = runOfShowSheet([ziel('YouTube', { hasStreamKey: false })])
    expect(t.rows[0][5]).toBe('nicht hinterlegt')
  })

  it('nennt die Rolle, damit am Showtag klar ist, was der Ausweichweg ist', () => {
    const t = runOfShowSheet([ziel('Haupt'), ziel('Backup', { backupOfId: 'id-Haupt' })])
    expect(t.rows[0][1]).toBe('Primaerweg')
    expect(t.rows[1][1]).toBe('Backup von Haupt')
  })
})

describe('kein erfundenes Fremdformat', () => {
  it('erzeugt weder OBS-Profil noch vMix-Preset noch NOALBS-JSON', async () => {
    // Bedarf 33 nennt sie als Ziel, aber die genauen Schluessel dieser Formate
    // liegen in dieser Recherche NICHT vor -- vom NOALBS-Umfang ist die
    // Feldliste gelesen, nicht das Schema. Eine Datei mit erfundenen
    // Schluesselnamen, die „OBS-Profil" heisst, sieht geprueft aus und ist
    // geraten; sie kostet am Showtag mehr Zeit als das Abtippen.
    const quelle = (await import('../src/renderer/lib/encoderFeasibility.ts?raw')).default as string
    expect(quelle).not.toMatch(/JSON\.stringify|\.json"|profile\s*=|preset\s*=/)
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Der wiederkehrende Fehler in diesem Projekt ist nicht der
// falsche Rechenweg, sondern das gebaute Modul, das kein Knopf aufruft: es ist
// getestet, es ist richtig, und niemand sieht es je. Deshalb prueft dieser
// Block den DIALOG und nicht die Bibliothek.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Ausspiel-Dialog', () => {
  const dialog = dialogQuelle

  it('ruft die Machbarkeitspruefung auf', () => {
    expect(dialog).toContain("from '../../lib/encoderFeasibility'")
    expect(dialog).toContain('checkEncoderFeasibility')
    // Nicht nur importiert, sondern angewendet -- ein Import allein rendert
    // nichts.
    expect(dialog).toMatch(/ENCODERS\.map\(/)
  })

  it('bietet das Ablaufblatt zum Ausgeben an', () => {
    expect(dialog).toContain('runOfShowSheet')
    expect(dialog).toMatch(/onClick=\{exportRunOfShow\}/)
    // Mit Stempel wie jede andere Liste (ADR-004, Inkrement 3): ein Blatt, das
    // per Mail wandert, muss seinen Stand nennen koennen.
    expect(dialog).toContain('stampForRows(project, runOfShowSheetForProject')
  })

  it('setzt die Befundtexte NICHT dynamisch zusammen', () => {
    // Ein `t(\`delivery.encoder.${f.kind}\`)` ist fuer den i18n-Deckungs-Guard
    // unsichtbar und faellt im EN-Betrieb still auf den nackten Slug zurueck.
    // Genau dieser Fehler ist in `venueRequestTable` schon einmal passiert.
    expect(dialog).not.toMatch(/t\(`delivery\.encoder\./)
    for (const key of [
      'delivery.encoder.tooMany',
      'delivery.encoder.noPerDestination',
      'delivery.encoder.perDestinationUnknown',
      'delivery.encoder.mustMatch',
    ]) {
      expect(dialog).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
