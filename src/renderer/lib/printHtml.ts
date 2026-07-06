// ───────────────────────────────────────────────────────────────────────────
// Druck eines selbst-enthaltenen HTML-Dokuments (Etiketten, Packlisten).
//
// Bewusst der iframe-Weg (nicht der PDF-Vektor-IPC): das HTML trägt seine
// `@page`-Größe selbst, sodass der native Druckdialog von Browser UND Electron
// die Papier-/Rollengröße korrekt übernimmt — der User wählt dort A4 oder den
// Labeldrucker. Funktioniert offline und ohne Zusatz-Dependency.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Rendert `html` in ein verstecktes iframe und öffnet den Druckdialog. Das
 * iframe wird nach dem Druck (bzw. nach Timeout) wieder entfernt. No-op ohne
 * DOM (z. B. in Tests).
 */
export const printHtmlDocument = (html: string): void => {
  if (typeof document === 'undefined') return
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.srcdoc = html
  iframe.onload = () => {
    try {
      const win = iframe.contentWindow
      win?.focus()
      win?.print()
    } catch {
      /* still remove below */
    }
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 60_000)
  }
  document.body.appendChild(iframe)
}
