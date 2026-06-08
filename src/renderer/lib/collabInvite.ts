// #516 — Einladungs-Link für die Live-Kollaboration.
//
// Vorher kopierte „Einladung kopieren" einen mehrzeiligen Text (Raumname,
// Server, Passwort + Anleitung). Gewünscht ist ein klickbarer Link wie bei
// Zoom/Teams: ein Klick öffnet die (Web-)App, füllt Raum/Modus/Signaling/
// Passwort vor und fragt, ob man der Session beitreten möchte.
//
// Der Link kodiert die Join-Parameter base64url im URL-Hash (#join=…). Der
// Hash wird nicht an den Server gesendet und überlebt das statische GitHub-
// Pages-Hosting. Beim Start liest die App den Hash via consumeInviteFromUrl().

import { APP_WEB_URL } from './appInfo'

export interface CollabInvite {
  mode: 'broadcast' | 'webrtc'
  room: string
  signaling?: string
  password?: string
  /** Anzeigename des Hosts (nur für die Beitritts-Rückfrage). */
  host?: string
}

const toB64Url = (json: string): string => {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromB64Url = (s: string): string => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Baut einen teilbaren Einladungs-Link aus den aktuellen Session-Daten. */
export const buildInviteLink = (inv: CollabInvite): string => {
  const payload = {
    m: inv.mode,
    r: inv.room,
    ...(inv.signaling?.trim() ? { s: inv.signaling.trim() } : {}),
    ...(inv.password?.trim() ? { p: inv.password.trim() } : {}),
    ...(inv.host?.trim() ? { h: inv.host.trim() } : {}),
  }
  return `${APP_WEB_URL}#join=${toB64Url(JSON.stringify(payload))}`
}

// Genau-einmal-Konsum: verhindert doppeltes Auslösen (React StrictMode ruft
// Mount-Effekte im Dev doppelt auf) und ein erneutes Beitreten bei Reload.
let consumed = false

/** Liest einen Invite aus dem URL-Hash, entfernt ihn aus der Adresse und
 *  liefert die Join-Parameter — oder null. Wirkt nur beim ersten Aufruf. */
export const consumeInviteFromUrl = (): CollabInvite | null => {
  if (consumed) return null
  try {
    const m = window.location.hash.match(/(?:^#|&)join=([^&]+)/)
    if (!m) return null
    const data = JSON.parse(fromB64Url(decodeURIComponent(m[1]))) as Record<string, unknown>
    if (typeof data.r !== 'string' || !data.r.trim()) return null
    consumed = true
    // join= aus dem Hash strippen, damit ein Reload nicht erneut beitritt.
    const h = window.location.hash
    const newHash = /^#join=/.test(h) ? '' : h.replace(/&join=[^&]*/, '')
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${newHash}`)
    return {
      mode: data.m === 'webrtc' ? 'webrtc' : 'broadcast',
      room: data.r,
      signaling: typeof data.s === 'string' ? data.s : undefined,
      password: typeof data.p === 'string' ? data.p : undefined,
      host: typeof data.h === 'string' ? data.h : undefined,
    }
  } catch {
    return null
  }
}
