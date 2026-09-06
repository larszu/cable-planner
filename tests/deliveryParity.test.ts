import { describe, expect, it } from 'vitest'
import {
  checkDelivery,
  deliveryTable,
  deliveryTableForProject,
  PARITY_FIELDS,
} from '../src/renderer/lib/deliveryParity'
import { DEFAULT_ENCODING, type DeliveryDestination, type EncodingProfile } from '../src/renderer/types/delivery'

// ---------------------------------------------------------------------------
// Die Ausspielung (Initiative 9, Bedarfe 28-29).
//
// Der Kern ist die Paritaets-Regel, und sie hat eine Autoritaet statt einer
// Meinung: Primaer- und Backup-Weg muessen in Aufloesung, Video-Codec,
// Bitrate, Bildrate, Keyframe-Abstand und Audio-Abtastrate UEBEREINSTIMMEN,
// sonst bricht der Failover oder die Plattform wirft Ingest-Fehler.
// (support.google.com/youtube/answer/2853702, docs.castr.com/.../backup-ingest)
//
// Genau daran haengt der Wert des ganzen Objekts: eine Abweichung faellt sonst
// erst auf, wenn der Primaerweg stirbt -- also im schlechtesten Moment.
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

describe('Primaer gegen Backup', () => {
  it('meldet jede der sechs Pflicht-Abweichungen einzeln', () => {
    // Einzeln und nicht als Sammelbefund: wer das Backup korrigiert, braucht
    // die Liste der Felder, nicht die Zahl.
    const abweichend: EncodingProfile = {
      ...DEFAULT_ENCODING,
      width: 1280,
      height: 720,
      fps: 30,
      videoCodec: 'HEVC',
      videoBitrateKbps: 4500,
      keyframeSec: 4,
      audioSampleRate: 44100,
    }
    const { issues } = checkDelivery([
      ziel('Haupt'),
      ziel('Backup', { backupOfId: 'id-Haupt', encoding: abweichend }),
    ])
    // Die Erwartung steht hier AUSGESCHRIEBEN und nicht als `PARITY_FIELDS`.
    // Die Gegenprobe hat gezeigt, warum: mit der Konstante auf beiden Seiten
    // blieb der Test gruen, als die Liste auf ein einziges Feld zusammenschrumpfte
    // -- er verglich die Umsetzung mit sich selbst. Diese Namen kommen aus der
    // Regel (Aufloesung, Video-Codec, Bitrate, Bildrate, Keyframe-Abstand,
    // Audio-Abtastrate), nicht aus dem Modul.
    const erwartet = [
      'width',
      'height',
      'videoCodec',
      'videoBitrateKbps',
      'fps',
      'keyframeSec',
      'audioSampleRate',
    ]
    const felder = issues.filter((i) => i.kind === 'backup-mismatch').map((i) => i.field)
    expect([...felder].sort()).toEqual([...erwartet].sort())
    // Und die exportierte Liste muss dieselbe sein — sonst prueft die eine
    // Haelfte etwas anderes als die andere anzeigt.
    expect([...PARITY_FIELDS].sort()).toEqual([...erwartet].sort())
  })

  it('nennt Soll und Ist, nicht nur das Feld', () => {
    const { issues } = checkDelivery([
      ziel('Haupt'),
      ziel('Backup', {
        backupOfId: 'id-Haupt',
        encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 4500 },
      }),
    ])
    const b = issues.find((i) => i.kind === 'backup-mismatch')
    expect(b?.field).toBe('videoBitrateKbps')
    expect(b?.expected).toBe('6000')
    expect(b?.actual).toBe('4500')
  })

  it('schweigt, wenn Primaer und Backup uebereinstimmen', () => {
    const { issues } = checkDelivery([ziel('Haupt'), ziel('Backup', { backupOfId: 'id-Haupt' })])
    expect(issues.filter((i) => i.kind === 'backup-mismatch')).toEqual([])
  })

  it('prueft die Audio-BITRATE bewusst NICHT mit', () => {
    // Die Quelle nennt die Abtastrate, nicht die Bitrate. Ein Feld
    // mitzupruefen, das die Regel nicht nennt, waere eine erfundene Regel --
    // und sie wuerde auf voellig funktionierenden Aufbauten anschlagen.
    const { issues } = checkDelivery([
      ziel('Haupt'),
      ziel('Backup', {
        backupOfId: 'id-Haupt',
        encoding: { ...DEFAULT_ENCODING, audioBitrateKbps: 192 },
      }),
    ])
    expect(issues.filter((i) => i.kind === 'backup-mismatch')).toEqual([])
  })

  it('meldet einen Backup-Zeiger ins Leere', () => {
    const { issues } = checkDelivery([ziel('Backup', { backupOfId: 'gibt-es-nicht' })])
    expect(issues.map((i) => i.kind)).toContain('backup-orphan')
  })

  it('meldet ein Ziel, das sein eigenes Backup ist', () => {
    const { issues } = checkDelivery([ziel('Solo', { backupOfId: 'id-Solo' })])
    expect(issues.map((i) => i.kind)).toContain('backup-orphan')
  })

  it('faengt einen Zeiger-Kreis, statt sich aufzuhaengen', () => {
    // Ohne die Pruefung dreht sich die Aufloesung endlos -- das waere ein
    // eingefrorenes Fenster statt eines Befunds.
    const { issues } = checkDelivery([
      ziel('A', { backupOfId: 'id-B' }),
      ziel('B', { backupOfId: 'id-A' }),
    ])
    expect(issues.filter((i) => i.kind === 'backup-cycle').length).toBeGreaterThan(0)
  })

  it('meldet einen Ausspielweg ohne Ausweichweg', () => {
    const { issues } = checkDelivery([ziel('Haupt')])
    expect(issues.map((i) => i.kind)).toContain('no-backup')
  })

  it('meldet das NICHT, wenn ein Backup daran haengt', () => {
    const { issues } = checkDelivery([ziel('Haupt'), ziel('Backup', { backupOfId: 'id-Haupt' })])
    // Auch nicht fuer das Backup selbst: ein Ausweichweg braucht keinen
    // eigenen Ausweichweg, und ihn einzufordern waere genau die Warnung, die
    // auf jedem ordentlich abgesicherten Aufbau anschlaegt.
    expect(issues.filter((i) => i.kind === 'no-backup')).toEqual([])
  })
})

describe('Plattform-Vorgaben', () => {
  it('meldet eine Bitrate ueber der belegten Twitch-Grenze', () => {
    // 6.000 kbit/s fuer Nicht-Partner (stream.twitch.tv/encoding/).
    const { issues } = checkDelivery([
      ziel('Twitch', {
        platform: 'twitch',
        encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 9000 },
      }),
    ])
    const b = issues.find((i) => i.kind === 'over-platform-bitrate')
    expect(b?.expected).toBe('6000 kbit/s')
    expect(b?.actual).toBe('9000 kbit/s')
  })

  it('laesst dieselbe Bitrate bei YouTube in Ruhe', () => {
    // 9.000-12.000 kbit/s bei 1080p60. Eine Grenze, die fuer alle gleich
    // waere, waere geraten.
    const { issues } = checkDelivery([
      ziel('YouTube', {
        platform: 'youtube',
        encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 9000 },
      }),
    ])
    expect(issues.filter((i) => i.kind === 'over-platform-bitrate')).toEqual([])
  })

  it('behauptet fuer ein eigenes Ziel gar keine Grenze', () => {
    const { issues } = checkDelivery([
      ziel('Kunde', { platform: 'custom', encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 40000 } }),
    ])
    expect(issues.filter((i) => i.kind === 'over-platform-bitrate')).toEqual([])
  })
})

describe('was am Showtag fehlt', () => {
  it('meldet fehlende Ingest-URL und fehlenden Stream-Key', () => {
    const { issues } = checkDelivery([ziel('Leer', { ingestUrl: '', hasStreamKey: false })])
    expect(issues.map((i) => i.kind)).toEqual(expect.arrayContaining(['missing-url', 'missing-key']))
  })

  it('meldet den SRT-Listener als Portfreigabe-Fall', () => {
    // Firewall-Entscheidung, keine Video-Entscheidung: der Listener braucht
    // eine Freigabe, der Caller meist nichts.
    const listener = checkDelivery([ziel('L', { transport: 'SRT', srt: { mode: 'listener' } })])
    const caller = checkDelivery([ziel('C', { transport: 'SRT', srt: { mode: 'caller' } })])
    expect(listener.issues.map((i) => i.kind)).toContain('needs-port-forward')
    expect(caller.issues.map((i) => i.kind)).not.toContain('needs-port-forward')
  })
})

describe('Uplink-Nenner', () => {
  it('zaehlt nur die Primaerwege, nicht die Backups', () => {
    // Ein Backup laeuft im Havariefall, nicht daneben. Es mitzuzaehlen
    // verdoppelte die Last jedes ordentlich abgesicherten Aufbaus.
    const r = checkDelivery([
      ziel('Haupt', { encoding: { ...DEFAULT_ENCODING, videoBitrateKbps: 6000, audioBitrateKbps: 128 } }),
      ziel('Backup', { backupOfId: 'id-Haupt' }),
    ])
    expect(r.primaries.map((d) => d.name)).toEqual(['Haupt'])
    expect(r.primaryKbps).toBe(6128)
  })
})

describe('CSV', () => {
  it('traegt Ziel, Encoding, Backup und Befunde — aber keinen Key', () => {
    const table = deliveryTable([ziel('Haupt'), ziel('Backup', { backupOfId: 'id-Haupt' })])
    expect(table.rows).toHaveLength(2)
    expect(table.rows[0][0]).toBe('Haupt')
    expect(table.rows[0][5]).toBe('1920x1080p25')
    expect(table.rows[1][9]).toBe('Haupt')
    // Der Key steht als TATSACHE da, nicht als Wert -- ein CSV geht per Mail.
    expect(table.rows[0][4]).toBe('ja')
  })

  it('traegt kanonisches Deutsch statt uebersetzten Text', () => {
    // Das CSV bekommt einen Dokument-Stempel (ADR-004). Ein Fingerabdruck ueber
    // uebersetzte Zeichenketten waere sprachabhaengig: dieselbe Ausspielung
    // ergaebe auf Englisch einen anderen Stand, und ein Blatt aus der
    // englischen Oberflaeche liesse sich mit der deutschen nie wieder als
    // aktuell nachweisen.
    const table = deliveryTable([ziel('Allein', { ingestUrl: '', hasStreamKey: false })])
    expect(table.headers[0]).toBe('Ziel')
    expect(String(table.rows[0][10])).toContain('Keine Ingest-URL')
    expect(String(table.rows[0][10])).toContain('Kein Stream-Key hinterlegt')
  })

  it('greift die Ziele auch aus einem Projekt', () => {
    // Der Weg, den Stempel und Dokument-Register nehmen.
    const ausProjekt = deliveryTableForProject({ deliveryDestinations: [ziel('Haupt')] })
    expect(ausProjekt.rows[0][0]).toBe('Haupt')
    // Ein Projekt ohne Ausspielung ergibt eine leere Tabelle, keinen Fehler:
    // „es gibt keine Ziele" ist eine Antwort, ein Wurf waere keine.
    expect(deliveryTableForProject({}).rows).toEqual([])
  })
})
