import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../renderer/index.css'
import { MobileApp } from './MobileApp'

// Hell oder dunkel folgt dem Telefon. Die Token-Schicht in `index.css` kippt
// ueber `[data-theme="light"]`; am Desktop setzt das `App.tsx` aus den
// Einstellungen, hier gibt es keine — wer in der hellen Halle steht, hat sein
// Telefon ohnehin auf hell.
const hell = window.matchMedia('(prefers-color-scheme: light)')
const setzeThema = () => {
  document.documentElement.dataset.theme = hell.matches ? 'light' : 'dark'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', hell.matches ? '#F6F5F0' : '#132040')
}
setzeThema()
hell.addEventListener('change', setzeThema)

// Die Zielgroesse aus `index.css` (`--ziel`, 32 px) gilt fuer Maus und Stift
// am Desktop. Diese Seite wird nur mit dem Finger bedient, oft mit
// Handschuh: hier gilt die WCAG-Empfehlung 44 px (SC 2.5.5). Die Regel ist
// ungeschichtet und schlaegt jede `min-h-*`-Utility — deshalb wird die Zahl
// umgestellt und nicht jeder Knopf einzeln.
document.documentElement.style.setProperty('--ziel', '44px')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>,
)
