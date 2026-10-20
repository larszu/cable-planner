/** v7.8.4 — set-rate guard. When the store mutates more than
 *  PROJECT_RATE_THRESHOLD times within PROJECT_RATE_WINDOW_MS, throw
 *  so the React error boundary captures the stack with a real
 *  pointer to the offending caller. Without this, the silent #185
 *  loop just chews the renderer with no actionable info.
 *
 *  #1057 — MCP-Schreibaufrufe zaehlen nicht mit. Ein Agent schickt Aufrufe
 *  ueber HTTP, ein Stapel (Spracheingabe, Aufbau aus einer Liste) kommt
 *  schnell hintereinander, und jeder Aufruf setzt mehrere Aenderungen ab.
 *  Das ist kein Render-Kreislauf: der Takt kommt von aussen, nicht aus
 *  React. Gezaehlt werden weiter alle anderen Aenderungen. */
export const PROJECT_RATE_THRESHOLD = 80
export const PROJECT_RATE_WINDOW_MS = 250

let projectRecentSetTs: number[] = []
let ausgenommen = 0

export const checkProjectSetRate = () => {
  if (ausgenommen > 0) return
  const now = Date.now()
  projectRecentSetTs.push(now)
  projectRecentSetTs = projectRecentSetTs.filter((t) => now - t <= PROJECT_RATE_WINDOW_MS)
  if (projectRecentSetTs.length > PROJECT_RATE_THRESHOLD) {
    const count = projectRecentSetTs.length
    projectRecentSetTs = []
    throw new Error(
      `[CablePlanner] projectStore set-rate guard tripped: ${count} mutations in ${PROJECT_RATE_WINDOW_MS} ms. Render-loop suspected — captured stack pinpoints the offending caller.`,
    )
  }
}

/** Fuehrt `fn` aus, ohne dass seine Store-Aenderungen den Guard fuettern.
 *  Die Abonnenten laufen bei Zustand synchron im `set`, deshalb reicht ein
 *  Zaehler um den Aufruf. */
export const ohneRateGuard = <T>(fn: () => T): T => {
  ausgenommen += 1
  try {
    return fn()
  } finally {
    ausgenommen -= 1
  }
}
