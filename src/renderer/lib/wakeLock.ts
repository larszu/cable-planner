// ───────────────────────────────────────────────────────────────────────────
// Der Bildschirm bleibt an, solange gescannt wird (Bedarf 69, P2).
//
// WAS DER BEDARF SAGT — sechs unabhaengige Reibungen aus drei Trackern:
//
//   > Scanner input submits the whole form instead of tabbing to the next
//   > field; THE PHONE LOCKS MID-SCAN AND HAS TO BE DOUBLE-TAPPED; the scan
//   > resolves to the company default warehouse rather than where the stock
//   > is; scanning on receipt adds duplicate rows instead of incrementing.
//
//   > If the suite ever exposes a scan surface: location-context-first,
//   > continuous scan without form submission, WAKE-LOCK WHILE SCANNING, and
//   > idempotent quantity handling. These are six independent frictions across
//   > three trackers — cheap to get right, very visible when wrong.
//
// Beleg fuer genau diesen Punkt: inventree/inventree-app#492 (2024-05) — das
// Telefon sperrt, waehrend der Scanner offen ist.
//
// Diese Anwendung hat zwei Kamera-Scan-Flaechen (`lib/barcodeScanner.ts` fuer
// den Desktop, das Overlay in `src/mobile/MobileApp.tsx` fuer das Telefon).
// KEINE davon hielt den Bildschirm wach. Auf dem Telefon ist das die Flaeche,
// die im Lager wirklich benutzt wird.
//
// ─── DER TEIL, DEN MAN VERGISST ────────────────────────────────────────────
//
// Die Wake-Lock-API gibt die Sperre AUTOMATISCH FREI, sobald die Seite in den
// Hintergrund geht — und holt sie beim Zurueckkommen NICHT von allein zurueck.
// Wer sie einmal anfordert und sich darauf verlaesst, hat nach dem ersten
// Wechsel in eine andere App wieder genau das Problem aus dem Befund, ohne
// dass irgendetwas eine Fehlermeldung wirft. Deshalb haengt hier ein
// `visibilitychange`-Horcher daran, der sie neu anfordert.
//
// EHRLICH DEGRADIEREND, wie `barcodeScanner.ts`: wo es die API nicht gibt
// (aelteres iOS-Safari, unsicherer Kontext), passiert nichts, es wirft nichts,
// und die Oberflaeche behauptet nichts. Ein Hinweis „Bildschirm bleibt an",
// der auf dem halben Geraetepark nicht stimmt, waere schlimmer als keiner.
// ───────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Ist die Wake-Lock-API hier verfuegbar? */
export const isWakeLockSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'wakeLock' in (navigator as any)

export interface WakeLockHandle {
  /** Sperre freigeben und den Horcher abmelden. Mehrfach aufrufbar. */
  release: () => void
}

/**
 * Haelt den Bildschirm wach, bis `release()` gerufen wird.
 *
 * Gibt IMMER ein Handle zurueck — auch ohne API-Unterstuetzung. Der Aufrufer
 * soll `release()` bedenkenlos rufen koennen, ohne vorher zu pruefen; ein
 * `null` hier zwaenge jede Aufrufstelle zu einer Fallunterscheidung, und die
 * wird irgendwo vergessen.
 */
export const keepScreenAwake = (): WakeLockHandle => {
  let sentinel: any = null
  let freigegeben = false

  const anfordern = async (): Promise<void> => {
    if (freigegeben || !isWakeLockSupported()) return
    try {
      const neu = await (navigator as any).wakeLock.request('screen')
      // DAS WETTRENNEN. `release()` kann waehrend dieses `await` gelaufen sein
      // — dann ist der Horcher schon abgemeldet und `sentinel` geleert, und
      // die eben erhaltene Sperre haette niemand mehr in der Hand. Der
      // Bildschirm bliebe fuer den Rest der Sitzung an, ohne dass irgendwo
      // etwas darauf zeigt. Die Pruefung VOR dem `await` faengt das nicht.
      if (freigegeben) {
        void neu?.release?.()
        return
      }
      sentinel = neu
    } catch {
      // Kein Grund zur Aufregung: der Browser darf ablehnen (Akku niedrig,
      // Richtlinie). Der Scan laeuft weiter, der Bildschirm eben nicht.
      // Wichtig ist, dass hier NICHTS weiterfliegt: `anfordern` wird mit
      // `void` gerufen, eine durchgelassene Ablehnung waere eine unbehandelte
      // Promise-Ablehnung mitten im Scan.
      sentinel = null
    }
  }

  const beiSichtbarkeit = (): void => {
    // Die Sperre ist beim Wechsel in den Hintergrund gefallen. Zurueck im
    // Vordergrund muss sie neu angefordert werden — von allein kommt sie nicht.
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void anfordern()
    }
  }

  void anfordern()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', beiSichtbarkeit)
  }

  return {
    release: () => {
      if (freigegeben) return
      freigegeben = true
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', beiSichtbarkeit)
      }
      try {
        void sentinel?.release?.()
      } catch {
        /* Schon freigegeben oder nie gehalten — beides in Ordnung. */
      }
      sentinel = null
    },
  }
}
