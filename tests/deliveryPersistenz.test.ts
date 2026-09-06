import { describe, expect, it } from 'vitest'
import { normaliseDeliveryDestinations } from '../src/renderer/lib/deliveryNormalise'
import { normaliseDeliveryDestination, streamKeyAccount, DEFAULT_ENCODING } from '../src/renderer/types/delivery'
import type { LoadDrop } from '../src/renderer/types/loadReport'

// ---------------------------------------------------------------------------
// Was beim Laden mit den Ausspielzielen passiert -- und was NICHT.
//
// Der Kern dieser Datei ist eine einzige Zusage: der Stream-Key steht nicht im
// Projekt. Alles andere daran ist Bequemlichkeit; das hier ist die Zusage,
// wegen der `CLAUDE.md` fuer externe Tokens den OS-Schluesselbund vorschreibt.
// Eine `.avplan` wandert per Mail, liegt in Dropbox, geht in den Mobile-Viewer
// und in den Web-Viewer -- jeder dieser Wege haette den Key mitgenommen.
//
// Die zweite Zusage ist feiner und faellt sonst erst am Showtag auf: das
// Haekchen „Key hinterlegt" gilt fuer DIESEN Rechner. Aus der Datei geglaubt
// waere es eine Behauptung ueber einen fremden Schluesselbund.
// ---------------------------------------------------------------------------

describe('der Stream-Key kommt nicht aus der Datei', () => {
  it('uebernimmt kein Key-Feld, auch wenn eines dasteht', () => {
    // Eine handgeschriebene oder aelter erzeugte Datei koennte eins tragen.
    const roh = [
      {
        id: 'd1',
        name: 'YouTube',
        platform: 'youtube',
        transport: 'RTMP',
        streamKey: 'live-abcd-1234-efgh',
        key: 'live-abcd-1234-efgh',
        hasStreamKey: true,
      },
    ]
    const out = normaliseDeliveryDestinations(roh)
    expect(JSON.stringify(out)).not.toContain('live-abcd-1234-efgh')
    // Und das Haekchen wird nicht geglaubt, sondern auf „nein" gesetzt: der
    // Renderer fragt den Schluesselbund. Ein aus der Datei uebernommenes
    // Haekchen behauptete etwas ueber einen fremden Rechner.
    expect(out[0].hasStreamKey).toBe(false)
  })

  it('leitet den Schluesselbund-Account aus der Id ab, statt ihn zu speichern', () => {
    // Abgeleitet und nicht gespeichert: sonst koennen Zeiger und Ablage
    // auseinanderlaufen, und der Key eines Ziels liegt unter dem Namen eines
    // anderen.
    expect(streamKeyAccount('d1')).toBe('stream-key:d1')
  })
})

describe('Normalisierung', () => {
  it('wirft ein Ziel ohne Namen weg und MELDET das', () => {
    // ADR-005 Regel 3: wer nicht bewahren kann, sagt es an der Stelle.
    const drops: LoadDrop[] = []
    const out = normaliseDeliveryDestinations([{ id: 'd1' }], (d) => drops.push(d))
    expect(out).toEqual([])
    expect(drops[0]).toMatchObject({ kind: 'delivery-destination', reason: 'missing-required' })
  })

  it('behaelt bei doppelter Id das erste und meldet das zweite', () => {
    const drops: LoadDrop[] = []
    const out = normaliseDeliveryDestinations(
      [
        { id: 'd1', name: 'Erst' },
        { id: 'd1', name: 'Zweit' },
      ],
      (d) => drops.push(d),
    )
    expect(out.map((d) => d.name)).toEqual(['Erst'])
    expect(drops[0]).toMatchObject({ reason: 'duplicate-id', label: 'Zweit' })
  })

  it('entfernt einen Backup-Zeiger auf ein verworfenes Ziel', () => {
    // Ein Fehlzeiger meldete sonst `backup-orphan` statt der echten Frage
    // „wo ist mein Ausweichweg?".
    const out = normaliseDeliveryDestinations([
      { id: 'd1' }, // faellt raus (kein Name)
      { id: 'd2', name: 'Backup', backupOfId: 'd1' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].backupOfId).toBeUndefined()
  })

  it('laesst ein Ziel nicht sein eigenes Backup sein', () => {
    const d = normaliseDeliveryDestination({ id: 'd1', name: 'Solo', backupOfId: 'd1' }, 'x')
    expect(d?.backupOfId).toBeUndefined()
  })

  it('fuellt fehlende Encoding-Werte mit der Vorgabe, statt 0 zu tragen', () => {
    // Eine 0 in `width` liefe durch die Paritaetspruefung und behauptete eine
    // Abweichung, wo nur ein Feld fehlte.
    const d = normaliseDeliveryDestination({ name: 'X', encoding: { width: 0, fps: -1 } }, 'gen-1')
    expect(d?.encoding.width).toBe(DEFAULT_ENCODING.width)
    expect(d?.encoding.fps).toBe(DEFAULT_ENCODING.fps)
  })

  it('vergibt eine Id, wenn die Datei keine mitbringt', () => {
    expect(normaliseDeliveryDestination({ name: 'X' }, 'gen-7')?.id).toBe('gen-7')
  })

  it('nimmt nur bekannte Transporte und Modi', () => {
    const d = normaliseDeliveryDestination(
      { name: 'X', transport: 'CARRIER-PIGEON', srt: { mode: 'telepathy' } },
      'g',
    )
    expect(d?.transport).toBe('RTMP')
    // Kein SRT -> auch kein SRT-Block. Ein Block ohne Transport waere ein
    // Feld, das die Oberflaeche nie zeigt und der Export mitschleppt.
    expect(d?.srt).toBeUndefined()
  })

  it('gibt bei Unsinn eine leere Liste statt zu werfen', () => {
    expect(normaliseDeliveryDestinations(undefined)).toEqual([])
    expect(normaliseDeliveryDestinations('nein' as unknown)).toEqual([])
    expect(normaliseDeliveryDestinations([null, 42, 'x'])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Die Verdrahtung, ohne die die Zusage im Kommentar eine Behauptung waere.
//
// `removeDeliveryDestination` verspricht, den Stream-Key mitzunehmen. Es kann
// das nur, wenn jemand den Ruecksteller setzt -- der Store kann kein IPC. Wird
// die Verdrahtung in `App.tsx` beim naechsten Umbau vergessen, ueberlebt der
// Key des Kunden das Projekt, und zwar unbemerkt: die Oberflaeche sieht danach
// genauso aus.
// ---------------------------------------------------------------------------
describe('der Zeiger auf den Encoder (Bedarf 32)', () => {
  it('ueberlebt das Laden', () => {
    const d = normaliseDeliveryDestination(
      { name: 'YouTube', encoderEquipmentId: '  enc-1  ' },
      'x',
    )
    expect(d?.encoderEquipmentId).toBe('enc-1')
  })

  it('wird NICHT geprueft und NICHT still geleert', () => {
    // Diese Funktion sieht nur den Rohsatz, nicht den Geraetebestand. Ein
    // hier geleertes Feld saehe spaeter aus wie „nie ausgefuellt" -- dann
    // sucht niemand nach dem Geraet, das jemand geloescht hat. Die Auskunft
    // gibt `buildDeliveryChains` mit `encoder-gone`.
    const d = normaliseDeliveryDestination({ name: 'YouTube', encoderEquipmentId: 'weg' }, 'x')
    expect(d?.encoderEquipmentId).toBe('weg')
  })

  it('laesst leere und falsch getypte Werte weg', () => {
    expect(
      normaliseDeliveryDestination({ name: 'X', encoderEquipmentId: '   ' }, 'x')
        ?.encoderEquipmentId,
    ).toBeUndefined()
    expect(
      normaliseDeliveryDestination({ name: 'X', encoderEquipmentId: 42 }, 'x')?.encoderEquipmentId,
    ).toBeUndefined()
  })
})

describe('der Weg vom Loeschen zum Schluesselbund', () => {
  it('ist in App.tsx verdrahtet', async () => {
    const src = await import('../src/renderer/App.tsx?raw').then((m) => m.default as string)
    expect(src).toContain('setStreamKeyDropper')
    expect(src).toContain('streamKey.delete')
  })

  it('geht ueber die Preload-Bruecke und nicht ueber fetch', async () => {
    const preload = await import('../src/main/preload.cts?raw').then((m) => m.default as string)
    expect(preload).toContain("ipcRenderer.invoke('streamKey:delete'")
    const ipc = await import('../src/main/ipc/credentialsIpc.ts?raw').then((m) => m.default as string)
    expect(ipc).toContain("ipcMain.handle('streamKey:delete'")
  })

  it('legt den Key in den Schluesselbund und nicht in eine Datei', async () => {
    // Die eine Zeile, an der die ganze Zusage haengt.
    const svc = await import('../src/main/services/credentialsService.ts?raw').then(
      (m) => m.default as string,
    )
    expect(svc).toContain('keytar.setPassword')
    expect(svc).toMatch(/stream-key:/)
    expect(svc).not.toMatch(/writeFile|fs\./)
  })
})
