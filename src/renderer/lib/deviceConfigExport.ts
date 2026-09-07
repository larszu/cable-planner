// ───────────────────────────────────────────────────────────────────────────
// Bedarf 43 — die eine Stelle, an der eine Gerätekonfiguration diesen Planer
// verlässt.
//
// `deviceConfigProvenance` ist rein: es kennt weder Store noch Uhr noch
// App-Version. Diese Datei setzt beides zusammen und ist damit die einzige
// unreine Zeile des Wegs. Getrennt, damit das Blatt selbst prüfbar bleibt —
// derselbe Ursprung und derselbe Inhalt ergeben zweimal denselben Text, und
// genau das lässt sich nur an einer Funktion ohne Uhr festhalten.
//
// Der Zustand kommt über `getState()` und nicht über einen Selektor: das hier
// läuft in einem Klick-Handler, nicht im Rendern. Ein Abonnement auf das ganze
// Projekt ließe jeden Dialog bei jeder Änderung neu zeichnen, ohne dass er
// etwas davon anzeigt.
// ───────────────────────────────────────────────────────────────────────────
import { useProjectStore } from '../store/projectStore'
import { APP_VERSION } from './appInfo'
import { stampForPlan } from './documentStamp'
import { downloadDeviceConfig } from './deviceConfigProvenance'

/**
 * Eine Gerätekonfiguration ausgeben — samt Herkunfts-Blatt.
 *
 * `device` und `what` stehen im Klartext auf dem Blatt: „Blackmagic Videohub"
 * und „Anschluss-Beschriftungen". Beides ist für einen Menschen gedacht, der
 * die Datei in einem halben Jahr im Download-Ordner findet, und nicht für eine
 * Auswertung — deshalb Text und keine Kennung.
 */
export const exportDeviceConfig = (
  device: string,
  what: string,
  filename: string,
  content: string,
  mimeType: string,
): void => {
  const project = useProjectStore.getState().project
  downloadDeviceConfig(
    {
      device,
      what,
      filename,
      stamp: stampForPlan(project, new Date()),
      app: `Cable Planner ${APP_VERSION}`,
    },
    content,
    mimeType,
  )
}
