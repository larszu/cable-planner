// ---------------------------------------------------------------------------
// Das Woerterbuch der Mobile-Ansicht.
//
// ─── WARUM EIN EIGENES UND NICHT DAS DES RENDERERS ─────────────────────────
//
// Weil das des Renderers 316 KB gross ist und diese Seite 57 KB.
//
// `src/renderer/lib/i18n.ts` importiert `de.ts` STATISCH — wer von dort auch
// nur `translate` oder `format` holt, bekommt alle 5276 Schluessel der
// Desktop-App mit. Die Mobile-Ansicht wird ueber das Hallen-WLAN auf ein
// Telefon geladen und braucht davon keinen einzigen: ihre Oberflaeche ist
// eine andere. Das Woerterbuch der App mitzuschicken hiesse, die Seite zu
// vervierfachen, damit ein Handy Zeichenketten laedt, die es nie zeigt.
//
// Das ist KEIN zweites System: es ist dieselbe Form, die `CLAUDE.md` fuer
// jede Sprache beschreibt — ein Woerterbuch als Datei, ein `t(key, fallback)`
// darueber, keine Zeile Logik. Das Werk dazu (`spracheAusBrowser`, `format`)
// steht in `renderer/lib/i18nLite.ts` und wird mit dem Viewer geteilt; hier
// steht nur, was dieser Seite gehoert.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Zeichenketten, die in beiden Sprachen gleich lauten („Plan", „Name",
// „Problem", „Code / ID"). Ein Eintrag, der die Quelle wiederholt, ist keine
// Uebersetzung: er sieht beim Lesen aus wie eine und macht die Liste laenger,
// ohne dass sich etwas aendert, wenn man ihn loescht. Der Fallback im Aufruf
// liefert dasselbe.
// ---------------------------------------------------------------------------

import { macheUebersetzer, type Sprache } from '../renderer/lib/i18nLite'

const de: Record<string, string> = {
  // ── Projekt laden ───────────────────────────────────────────────────────
  'mobile.err.noProject': 'Desktop teilt aktuell kein Projekt.',
  'mobile.err.badFormat': 'Antwort hat falsches Format.',
  'mobile.err.hostUnreachable': 'Host nicht erreichbar ({error}). Datei wählen oder JSON einfügen.',
  'mobile.err.hostUnreachableShort': 'Host nicht erreichbar.',
  'mobile.err.notAProject':
    'Datei sieht nicht wie ein Cable-Planner-Projekt aus (fehlende equipment/cables).',
  'mobile.err.fileUnreadable': 'Datei konnte nicht gelesen werden.',
  'mobile.intro':
    'Hak Ports und Kabel ab während du sie steckst, oder trage fehlende Patches direkt vor Ort nach. Alles syncht live zum Desktop. Offline funktioniert auch — Häkchen werden beim Re-Connect übertragen.',
  'mobile.reload.titleCached': 'Letztes Projekt vom Host laden — Rückfall auf Cache vom {time}',
  'mobile.reload.title': 'Aktuell auf dem Desktop geöffnetes Projekt laden',
  'mobile.reload.busy': 'Lade…',
  'mobile.reload.cached': 'Projekt erneut laden (Cache: {time})',
  'mobile.reload.fresh': 'Projekt vom Desktop laden',
  'mobile.or': 'oder',
  'mobile.file.pick': 'Cable-Planner-Datei (.json) wählen…',
  'mobile.paste.cancel': 'Einfügen abbrechen',
  'mobile.paste.open': 'Oder JSON einfügen…',
  'mobile.paste.load': 'Projekt laden',

  // ── Port-Liste ──────────────────────────────────────────────────────────
  'mobile.port.goesTo': 'geht zu',
  'mobile.port.via': 'über {path}',
  'mobile.port.openEnd': 'Offenes Ende',
  'mobile.port.occupied': ' • belegt',

  // ── Plan-Ansicht ────────────────────────────────────────────────────────
  'mobile.zoom.in': 'Vergrößern',
  'mobile.zoom.out': 'Verkleinern',
  'mobile.zoom.fit': 'Einpassen',
  'mobile.plan.tapHint': 'Tippe ein Gerät im Plan an, um seine Patchliste zu sehen.',

  // ── QR-/ID-Suche ────────────────────────────────────────────────────────
  'mobile.qr.title': 'QR / ID finden',
  'mobile.close': 'Schließen',
  'mobile.qr.loadingDecoder': 'Scanner wird geladen…',
  'mobile.qr.camUnavailable': 'Kamera nicht verfügbar',
  'mobile.qr.noScan':
    'Kamera-Scan hier nicht verfügbar (kein HTTPS/Secure-Context). Scanne das Etikett mit der Kamera-App deines Geräts und füge den Code unten ein — oder tippe die Kabel-/Asset-ID.',
  'mobile.lookup.placeholder': 'z.B. C-0001, A-0007 oder cableplanner://…',
  'mobile.qr.find': 'Finden',
  'mobile.lookup.docCurrent': '{label}: aktueller Stand',
  'mobile.lookup.docStale': '{label}: VERALTET — aktueller Stand #{stand}',
  'mobile.lookup.docUnknown': '{label}: Stand nicht prüfbar',
  'mobile.lookup.standOrphan': 'Stand {stand} gehört zu keinem aktuellen Blatt',
  'mobile.lookup.noMatch': 'Kein Treffer für „{raw}"',
  'mobile.lookup.device': 'Gerät: {name}',
  'mobile.lookup.cable': 'Kabel {id}: {name}',

  // ── Ablauf an der eigenen Position (Bedarf 10/11) ───────────────────────
  'mobile.rundown.myPlace': 'Mein Platz',
  'mobile.pos.choose': '— Position wählen —',
  'mobile.rundown.pickHint':
    'Wähle deine Kameraposition. Ohne sie kann diese Ansicht nicht sagen, was DIR aufgetragen ist — und eine Liste aller Aufträge wäre am Platz unbrauchbar.',
  'mobile.rundown.withAssignment': '{done}/{total} mit Auftrag',
  'mobile.rundown.sinceLast': 'Seit deinem letzten Blick:',
  'mobile.rundown.changed': '{n} geändert',
  'mobile.rundown.new': '{n} neu',
  'mobile.rundown.dropped': '{n} entfallen',
  'mobile.rundown.moved': '{n} verschoben',
  'mobile.rundown.seen': 'gesehen',
  'mobile.rundown.noBaseline':
    'Noch kein Vergleichsstand auf diesem Gerät — beim ersten Blick gibt es nichts zu markieren.',
  'mobile.rundown.rememberBaseline': 'Diesen Stand merken',
  'mobile.rundown.tagNew': 'neu',
  'mobile.rundown.tagChanged': 'geändert',
  'mobile.rundown.noShot': 'kein Auftrag eingetragen',
  'mobile.rundown.droppedItem': 'entfallen: {title}',

  // ── Kopfzeile der Projektansicht ────────────────────────────────────────
  'mobile.header.otherProject': 'Anderes Projekt laden',
  'mobile.header.counts': '{devices} Geräte · {cables} Kabel',
  'mobile.header.portsDone': '{done}/{total} Ports gesteckt',
  'mobile.view.list': 'Patchliste',
  'mobile.view.rundown': 'Ablauf',
  'mobile.search': 'Suchen…',
  'mobile.filter.open': 'offen',
  'mobile.find.title': 'Per QR-Scan oder ID zu Kabel/Gerät springen',
  'mobile.walk.title': 'Prüfbild-Rundgang: wo müsste welches Bild ankommen',
  'mobile.walk.button': 'Prüfbild',
  'mobile.report.title': 'Korrektur/Problem melden (Feld-Rückkanal)',
  'mobile.report.button': 'Meldung',
  'mobile.addCable.title': 'Kabel vor Ort hinzufügen (Dropdowns)',
  'mobile.addCable.button': '+ Kabel',
  'mobile.offline.banner':
    'Offline · Cache vom {time} · Checks werden bei Re-Connect synchronisiert',
  'mobile.readonly.banner':
    'Nur lesen · Häkchen bleiben auf diesem Gerät und erreichen den Plan nicht · den Plan ändert die Person am Rechner',
  'mobile.list.noMatch': 'Keine Geräte passen zum Filter.',

  // ── Anlagen-Zugangscodes (E-3) ──────────────────────────────────────────
  'mobile.pin.notShared': 'Nicht freigegeben. Am Planer muss jemand die Zugangscodes freigeben.',
  'mobile.pin.wrongCode': 'Falscher Code.',
  'mobile.pin.error': 'Fehler {status}.',
  'mobile.pin.noConnection': 'Keine Verbindung zum Planer.',
  'mobile.pin.title': 'Anlagen-Zugangscodes',
  'mobile.pin.button': 'Zugangscodes',
  'mobile.pin.hint':
    'Der Code steht nicht im QR-Link. Er wird am Planer ausgegeben und einzeln weitergegeben.',
  'mobile.pin.placeholder': 'Code vom Planer',
  'mobile.pin.fetching': 'Hole…',
  'mobile.pin.show': 'Anzeigen',
  'mobile.pin.empty': 'Freigegeben, aber es sind keine Codes hinterlegt.',
  'mobile.pin.logged': 'Dieser Abruf steht im Dokument-Register des Planers.',

  // ── Verbindung (lokal / remote) ─────────────────────────────────────────
  'mobile.connection': 'Verbindung',
  'mobile.conn.local': 'Lokal',
  'mobile.conn.localFull': 'Lokal (LAN)',
  'mobile.conn.remoteFull': 'Remote (Mobilfunk)',
  'mobile.conn.urlLabel': 'Server-URL (dein Tunnel/Relay auf den Desktop, inkl. ?t=Token)',
  'mobile.host.placeholder': 'https://mein-desktop.example.com/?t=…',
  'mobile.conn.hint':
    'Lokal: nur im selben WLAN. Remote: über mobile Daten via eigenem Tunnel/Relay (siehe docs/self-hosted-relay.md). Nichts läuft über fremde Server.',
  'mobile.apply': 'Übernehmen',

  // ── Show-Wechsel und Laden (Bedarf 127) ─────────────────────────────────
  'mobile.showSwitched': 'Am Desktop ist jetzt eine andere Show offen.',
  'mobile.showSwitched.body':
    'Dieser Plan bleibt stehen — er gehört zu der Show, mit der diese Seite geladen wurde. Häkchen und Meldungen gehen bis zum Neuladen nicht mehr durch.',
  'mobile.showSwitched.reload': 'Zur neuen Show wechseln (neu laden)',
  'mobile.loading': 'Lade Projekt vom Desktop…',
  'mobile.autoLoadError':
    'Hinweis: Es lief offenbar ein Desktop-Share-Server, aber das Laden ist fehlgeschlagen ({error}).',

  // ── Kabel vor Ort hinzufuegen ────────────────────────────────────────────
  'mobile.addCable.sendFailed': 'Konnte Kabel nicht senden: {error}. Verbindung zum Desktop prüfen.',
  'mobile.addCable.sendFailedShort': 'Konnte Kabel nicht senden.',
  'mobile.addCable.heading': 'Kabel hinzufügen',
  'mobile.addCable.sent': 'An den Desktop gesendet',
  'mobile.addCable.sentHint':
    'Ob es im Plan landet, entscheidet der Desktop — dort steht es dann mit 📱-Marker.',
  'mobile.addCable.badgeHint':
    'Wird im Plan mit 📱-Badge markiert, damit der Planer sieht dass das Kabel vor Ort nachgepflegt wurde.',
  'mobile.addCable.send': 'An Desktop senden',
  'mobile.fromDevice': 'Von Gerät',
  'mobile.fromPort': 'Von Port',
  'mobile.toDevice': 'Zu Gerät',
  'mobile.toPort': 'Zu Port',
  'mobile.choose': '— wählen —',
  'mobile.type': 'Typ',
  'mobile.length': 'Länge (m)',
  'mobile.name.placeholder': "Auto: '<Typ> Gerät A → Gerät B'",
  'mobile.name.regenerate': 'Wieder automatisch aus Typ + Geräten generieren',
  'mobile.name.reset': 'Auto-Name zurücksetzen',
  'mobile.notes': 'Notizen (opt.)',
  'mobile.notes.placeholder': "Z.B. 'Notfall-Patch — bitte später ordentlich verlegen'",
  'mobile.cancel': 'Abbrechen',
  'mobile.sending': 'Sende…',

  // ── Meldung an den Planer (Feld-Rueckkanal) ──────────────────────────────
  'mobile.report.lengthPart': 'Länge → {n} m',
  'mobile.report.cableEdit': 'Kabel-Korrektur',
  'mobile.report.sendFailed':
    'Konnte Meldung nicht senden: {error}. Verbindung zum Desktop prüfen.',
  'mobile.report.sendFailedShort': 'Konnte Meldung nicht senden.',
  'mobile.report.heading': 'Meldung an Planer',
  'mobile.report.sent': 'Meldung gesendet — erscheint am Desktop unter „Feld-Rückmeldungen"',
  'mobile.report.hint':
    'Wird NICHT direkt geändert — der Planer übernimmt oder verwirft deine Meldung am Desktop (landet dann im Änderungsprotokoll).',
  'mobile.report.kindNote': 'Notiz',
  'mobile.device.context': 'Gerät (Kontext)',
  'mobile.cable': 'Kabel',
  'mobile.report.correctedLength': 'Korrigierte Länge (m)',
  'mobile.report.currentLength': ' · aktuell {n} m',
  'mobile.report.lengthPlaceholder': 'z.B. 7.5',
  'mobile.report.remark': 'Bemerkung (optional)',
  'mobile.report.description': 'Beschreibung',
  'mobile.report.issuePlaceholder': 'Was ist das Problem?',
  'mobile.report.notePlaceholder': 'Notiz für den Planer…',
  'mobile.report.yourName': 'Dein Name (optional)',
  'mobile.report.placeholder': 'für die Protokoll-Zuordnung',
  'mobile.report.send': 'Meldung senden',

  // ── Pruefbild-Rundgang (B-42) ────────────────────────────────────────────
  'mobile.walk.obsOk': 'stimmt',
  'mobile.walk.obsOther': 'anderes Bild…',
  'mobile.walk.obsNone': 'kein Bild',
  'mobile.walk.obsNoMonitor': 'kein Monitor',
  'mobile.walk.noSource': 'Am Rechner ist keine Prüfquelle gewählt.',
  'mobile.walk.loadFailedStatus': 'Der Plan liess sich nicht laden ({status}).',
  'mobile.walk.loadFailed': 'Der Plan liess sich nicht laden.',
  'mobile.walk.sending': 'sendet …',
  'mobile.walk.notArrivedStatus': 'nicht angekommen ({status}) {text}',
  'mobile.walk.reported': 'gemeldet',
  'mobile.walk.notArrivedError': 'nicht angekommen: {error}',
  'mobile.walk.notArrived': 'nicht angekommen',
  'mobile.walk.expected': 'Laut Plan müsste hier stehen:',
  'mobile.walk.last': 'Zuletzt: {befund}',
  'mobile.walk.seenNamePlaceholder': 'Welcher Name steht drauf?',
  'mobile.walk.remember': 'merken',
  'mobile.walk.readOnly':
    'Der Rückweg ist zu — am Rechner unter „Freigabe" auf Mitschreiben stellen.',
  'mobile.walk.heading': 'Prüfbild-Rundgang',
  'mobile.walk.disclaimer':
    'Unten steht, was laut Plan ankommen müsste — nicht, was ankommt. Diese App sieht kein Bild. Was Sie melden, ist das, was Sie auf dem Monitor sehen.',
  'mobile.walk.who': 'Wer prüft',
  'mobile.loadingShort': 'lädt …',
  'mobile.walk.retry': 'noch einmal',
  'mobile.walk.source': 'Quelle:',
  'mobile.walk.stops': '{n} Ankunftsorte',
  'mobile.walk.openCount': ' · {n} offen',
  'mobile.walk.openHeading': 'Wege, die der Plan nicht zu Ende kennt',
}

const woerterbuecher: Partial<Record<Sprache, Record<string, string>>> = { de }

/** `t(key, 'English source')` fuer die Mobile-Ansicht. */
export const uebersetzer = macheUebersetzer(woerterbuecher)

export { format } from '../renderer/lib/i18nLite'
