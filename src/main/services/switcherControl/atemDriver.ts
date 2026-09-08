import type { ControlAction, ControlResult, SwitcherDriver } from './types.js'
import { atemStatus, connectAtem, connectedAtem, pushAtemEvent } from '../atemSession.js'

/**
 * Blackmagic ATEM — kein Text-Protokoll, sondern die `atem-connection`-
 * Bibliothek (UDP 9910, dasselbe Paketformat, das LibAtem dokumentiert).
 *
 * Deshalb gibt es hier keinen Block und keinen Port: was gesendet wird, sind
 * AUFRUFE, und die Vorschau im Dialog nennt sie so. Ein erfundener Textblock
 * waere genau die Sorte Behauptung, gegen die der ganze Weg gebaut ist.
 *
 * VERBUNDEN WIRD ueber dieselbe Sitzung wie der ATEM-Dialog
 * (`services/atemSession.ts`). Eine zweite Verbindung zum selben Mischer
 * ginge am Connect-Lock vorbei, und der Fehler waere ein sporadischer — die
 * schlechteste Sorte an einem Geraet, das auf Sendung ist.
 *
 * IST SCHON EINE ANDERE ADRESSE VERBUNDEN, wird auf die verlangte
 * umgeschaltet. Das ist die richtige Reihenfolge: der Befehl nennt das
 * Geraet, und stillschweigend an den gerade verbundenen Mischer zu senden
 * waere ein Befehl an das FALSCHE Geraet — der teuerste Fehler, den dieser
 * Weg machen kann.
 */
export const atemDriver: SwitcherDriver = {
  protocol: 'atem',
  send: async (action: ControlAction): Promise<ControlResult> => {
    if (action.protocol !== 'atem') {
      return { ok: false, message: 'Falscher Treiber für dieses Protokoll.' }
    }
    const { host, befehle } = action
    if (!host || !/^[\w.\-:]+$/.test(host)) {
      return { ok: false, message: 'Ungültige IP-Adresse' }
    }
    if (befehle.length === 0) {
      return { ok: false, message: 'Kein Befehl zu senden.' }
    }

    // Der Vergleich geht ueber die Sitzung und nicht ueber ein eigenes Feld:
    // wer gerade verbunden ist, weiss nur sie.
    let atem = connectedAtem()
    try {
      if (!atem || atemStatus().ip !== host) {
        atem = await connectAtem(host)
      }
    } catch (e) {
      return {
        ok: false,
        message: `Keine Verbindung zum Mischer ${host}: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
    if (!atem) return { ok: false, message: `Keine Verbindung zum Mischer ${host}.` }

    // Der Reihe nach und ohne Wiederholung. Ein wiederholter Schaltbefehl
    // waere kein harmloser Doppelklick: zwischen den beiden Versuchen kann
    // jemand anders geschaltet haben, und der zweite machte das rueckgaengig.
    const gesendet: string[] = []
    for (const b of befehle) {
      try {
        if (b.kind === 'program') await atem.changeProgramInput(b.source, b.me)
        else if (b.kind === 'preview') await atem.changePreviewInput(b.source, b.me)
        else if (b.kind === 'aux') await atem.setAuxSource(b.source, b.bus)
        else await atem.cut(b.me)
        gesendet.push(b.kind)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        pushAtemEvent(`Schaltbefehl ${b.kind} abgelehnt: ${msg}`)
        return {
          ok: false,
          message: `${gesendet.length} von ${befehle.length} Befehlen gesendet, dann: ${msg}`,
        }
      }
    }
    pushAtemEvent(`Aus dem Plan geschaltet: ${gesendet.length} Befehl(e) an ${host}`)
    return { ok: true, message: `Vom Mischer angenommen (${gesendet.length} Befehl(e))` }
  },
}
