// #413/#471 — LAN-Auffindbarkeit offener Live-Kollaborations-Sessions.
//
// y-webrtc verbindet nur Peers, die *denselben Raumnamen kennen* — es gibt
// keinen eingebauten „offene Räume durchsuchen"-Mechanismus. Diese IPC füllt
// genau die Lücke per mDNS/Bonjour (dieselbe Technik wie die ATEM-/Videohub-
// Discovery), sodass ein Planer an PC B im Netz die Session sieht, die ein
// Planer an PC A gerade hostet — ohne Raumnamen/Link manuell auszutauschen.
//
//   • advertise   — bewirbt die laufende Session als "_cableplanner._tcp"
//                   mit TXT-Records (Raum, Projekt, Host, Signaling).
//   • unadvertise — nimmt die Bewerbung wieder zurück (Session beendet).
//   • browse      — sammelt für ein kurzes Zeitfenster alle beworbenen
//                   Sessions im LAN ein und liefert die Liste.
//
// Der WebRTC-Verbindungsaufbau läuft danach unverändert über den Signaling-
// Server (der im TXT-Record mitgereicht wird, damit der Beitretende ihn
// automatisch übernimmt).

import { ipcMain } from 'electron'
import { Bonjour, type Service } from 'bonjour-service'

/** Bonjour-Service-Type → "_cableplanner._tcp.local". */
const SERVICE_TYPE = 'cableplanner'
/** Protokoll-Version im TXT — erlaubt spätere Format-Änderungen. */
const PROTO_VERSION = '1'
/** WebRTC ist P2P und hat keinen festen Port; Bonjour verlangt aber einen.
 *  Der echte Beitritt läuft über Raumname + Signaling aus den TXT-Records,
 *  dieser Port ist nur nominell (y-webrtc-Default-Signaling-Port). */
const NOMINAL_PORT = 4444

export interface CollabAdvertiseInfo {
  room: string
  project: string
  host: string
  /** Signaling-Server-Liste (Roh-Eingabe, Komma/Space-getrennt). */
  signaling: string
}

export interface DiscoveredCollabSession {
  /** Anzeigename des Bonjour-Service. */
  name: string
  room: string
  project: string
  host: string
  signaling: string
  /** IP des werbenden Rechners (informativ). */
  address: string
}

// Eine aktive Bewerbung gleichzeitig (genau eine Session pro Instanz).
let advertiseBonjour: Bonjour | null = null

const stopAdvertise = (): void => {
  const b = advertiseBonjour
  advertiseBonjour = null
  if (!b) return
  try {
    // unpublishAll sendet die mDNS-„goodbye"-Pakete, danach freigeben.
    b.unpublishAll(() => {
      try {
        b.destroy()
      } catch {
        /* ignore */
      }
    })
  } catch {
    try {
      b.destroy()
    } catch {
      /* ignore */
    }
  }
}

export const registerCollabDiscoveryIpc = (): void => {
  ipcMain.handle(
    'collabDiscovery:advertise',
    async (_event, info: CollabAdvertiseInfo): Promise<{ ok: boolean }> => {
      const room = (info?.room ?? '').trim()
      if (!room) return { ok: false }
      // Vorherige Bewerbung ablösen (Raumwechsel ohne App-Neustart).
      stopAdvertise()
      const bonjour = new Bonjour()
      advertiseBonjour = bonjour
      const project = (info.project ?? '').trim()
      const host = (info.host ?? '').trim()
      const label = [project || 'Cable Planner', host].filter(Boolean).join(' · ').slice(0, 63)
      bonjour.publish({
        name: label,
        type: SERVICE_TYPE,
        port: NOMINAL_PORT,
        txt: {
          room,
          project,
          host,
          signaling: (info.signaling ?? '').trim(),
          v: PROTO_VERSION,
        },
      })
      return { ok: true }
    },
  )

  ipcMain.handle('collabDiscovery:unadvertise', async (): Promise<{ ok: boolean }> => {
    stopAdvertise()
    return { ok: true }
  })

  ipcMain.handle(
    'collabDiscovery:browse',
    async (_event, params?: { timeoutMs?: number }): Promise<DiscoveredCollabSession[]> => {
      const timeoutMs = Math.max(800, Math.min(15000, params?.timeoutMs ?? 3000))
      const bonjour = new Bonjour()
      const found = new Map<string, DiscoveredCollabSession>()
      const browser = bonjour.find({ type: SERVICE_TYPE })
      const onUp = (svc: Service) => {
        const txt = (svc.txt && typeof svc.txt === 'object' ? svc.txt : {}) as Record<string, unknown>
        const room = String(txt.room ?? '').trim()
        if (!room) return // kein/kaputter TXT-Record → keine unserer Sessions
        const address = svc.referer?.address ?? svc.addresses?.[0] ?? ''
        const key = `${room}@${svc.fqdn || address || svc.name}`
        if (found.has(key)) return
        found.set(key, {
          name: svc.name || room,
          room,
          project: String(txt.project ?? ''),
          host: String(txt.host ?? ''),
          signaling: String(txt.signaling ?? ''),
          address,
        })
      }
      browser.on('up', onUp)
      await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
      browser.stop()
      bonjour.destroy()
      return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
    },
  )
}
