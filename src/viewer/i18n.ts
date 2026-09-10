// ---------------------------------------------------------------------------
// Das Woerterbuch des read-only Viewers.
//
// ─── WARUM EIN EIGENES UND NICHT DAS DES RENDERERS ─────────────────────────
//
// Aus demselben Grund wie bei `mobile/i18n.ts`: `renderer/lib/i18n.ts`
// importiert `de.ts` STATISCH (316 KB, 5276 Schluessel). Der Viewer ist ein
// eigener Vite-Entry (`viewer.html`) und liegt auf GitHub Pages — er wird von
// Leuten geoeffnet, die das Programm gar nicht haben, oft unterwegs. Ihm das
// Desktop-Woerterbuch mitzugeben hiesse, den ganzen Wortschatz einer App
// auszuliefern, von der diese Seite 30 Zeichenketten zeigt.
//
// Das Werk (`spracheAusBrowser`, `format`) steht in
// `renderer/lib/i18nLite.ts` und wird mit der Mobile-Ansicht geteilt; hier
// steht nur, was diesem Eintrittspunkt gehoert.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Zeichenketten, die in beiden Sprachen wirklich gleich lauten („Plan",
// „Viewer"). Ein Eintrag, der die Quelle wiederholt, sieht beim Lesen aus wie
// eine Uebersetzung und ist keine; der Fallback im Aufruf liefert dasselbe.
//
// „WIRKLICH GLEICH" HEISST: NACHGESEHEN, NICHT GESCHAETZT. `.cpviewer or
// .json` stand beim ersten Durchgang aus genau diesem Grund nicht in der
// Liste — bis die Seite im Browser mit deutscher Spracheinstellung offen war
// und dort „.cpviewer or .json" zwischen lauter deutschen Zeilen stand. Ein
// Wort Unterschied, und es ist genau die Sorte halbe Uebersetzung, die E-17
// im `sony-camera-bridge` als Fehler benannt hat. Wer hier einen Eintrag
// weglaesst, macht die Seite in einer Sprache auf, in der er ihn weglassen
// will.
// ---------------------------------------------------------------------------

import { macheUebersetzer, type Sprache } from '../renderer/lib/i18nLite'

const de: Record<string, string> = {
  // ── Anmerkungs-Status ───────────────────────────────────────────────────
  'viewer.status.open': 'Offen',
  'viewer.status.built': 'Aufgebaut',
  'viewer.status.resolved': 'Erledigt',

  // ── Laden ───────────────────────────────────────────────────────────────
  'viewer.err.badUrl': 'Ungültige URL.',
  'viewer.err.serverStatus': 'Server antwortete {status}.',
  'viewer.err.noPlanData': 'Keine gültigen Plandaten empfangen.',
  'viewer.err.remoteFailed': 'Remote-Laden fehlgeschlagen.',
  'viewer.err.notAFile': 'Keine gültige Cable-Planner-Datei (.cpviewer / .json).',
  'viewer.err.fileUnreadable': 'Datei konnte nicht gelesen werden.',

  // ── Startseite ──────────────────────────────────────────────────────────
  'viewer.intro':
    'Read-only-Ansicht eines Plans. Keine Installation nötig — Datei laden, prüfen und Anmerkungen setzen.',
  'viewer.yourName': 'Dein Name (für Anmerkungen)',
  'viewer.yourName.placeholder': 'z. B. Jan (Freelance-Cam)',
  'viewer.drop': 'Plan-Datei hierher ziehen oder klicken',
  'viewer.drop.kinds': '.cpviewer oder .json',
  'viewer.orLive': '— oder live vom Desktop —',
  'viewer.remote.placeholder':
    'http://192.168.1.10:PORT/?t=…  (LAN)  ·  https://…  (Mobilfunk-Tunnel)',
  'viewer.remote.loading': 'Lade…',
  'viewer.remote.load': 'Live laden',
  'viewer.remote.hint':
    'LAN: die vom Desktop angezeigte Adresse. Mobilfunk: deine öffentliche Tunnel-/Relay-URL (siehe docs/self-hosted-relay.md). Nichts läuft über fremde Server.',

  // ── Kopfzeile des geladenen Plans ───────────────────────────────────────
  'viewer.stampHint':
    'Diese Ansicht ist eine Momentaufnahme. Ob sie noch gilt, beantwortet der Planer: dort „Analyse → Blatt prüfen" mit dieser Zeichenfolge.',
  'viewer.stamp': 'Stand',
  'viewer.stamp.drifted': ' + Änderungen',
  'viewer.readOnly': 'Plan read-only',
  'viewer.download.title':
    'Annotierte Datei (.cpviewer) herunterladen — im Hauptprogramm über „Annotierte Viewer-Datei zurücklesen…" einlesen',
  'viewer.download': 'Annotierte Datei ↓',
  'viewer.otherFile': 'Andere Datei…',

  // ── Anmerkungen ─────────────────────────────────────────────────────────
  'viewer.ann.clickPlan': 'Klicke in den Plan…',
  'viewer.ann.add': '+ Anmerkung',
  'viewer.ann.heading': 'Anmerkungen ({n})',
  'viewer.ann.empty': 'Noch keine Anmerkungen. Klicke „+ Anmerkung" und dann in den Plan.',
  'viewer.ann.placeholder': 'Anmerkung…',
  'viewer.ann.delete': 'Löschen',
  'viewer.counts': '{devices} Geräte · {cables} Kabel · {locations} Standorte',
}

const woerterbuecher: Partial<Record<Sprache, Record<string, string>>> = { de }

/** `t(key, 'English source')` fuer den Viewer. */
export const uebersetzer = macheUebersetzer(woerterbuecher)

export { format } from '../renderer/lib/i18nLite'
