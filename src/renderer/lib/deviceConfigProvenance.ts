// ───────────────────────────────────────────────────────────────────────────
// Bedarf 43 (P2) — eine Gerätekonfiguration, die sagt, woher sie kommt.
//
// ─── DER BEFUND ────────────────────────────────────────────────────────────
//
//   > The config the freelancer carries between clients BREAKS ON IMPORT, and
//   > the rebuild happens during load-in in front of the client.
//
// Drei unabhängige Belege 2021–2024, alle dieselbe Sorte Schaden:
// `bitfocus/companion#1603` — beim Import verrutschten Zeilen, und der
// Meldende hatte den älteren Installer nicht mehr: „I would be doomed now".
// Dazu: „Every month or so I lose the configuration and have to reimport it."
//
// Die Bedarfs-Datenbank nennt die Maßnahme:
//
//   > The suite's own device exports (Videohub routing and labels, ATEM
//   > multiviewer XML, Green-GO config) are the same artefact class. VERSION
//   > THEM, diff them against the machine, and never silently replace.
//
// ─── WAS ES SCHON GAB UND WAS FEHLTE ───────────────────────────────────────
//
// Zwei der drei Teile sind gebaut. „Never silently replace" ist Initiative 10
// (Confirmed-State-Disziplin in `VideohubExportDialog`, `AtemAudioRouterDialog`
// und `AtemMvConfigDialog`), und „diff them against the machine" leisten
// `atemLiveCompare` und der Status-Abgleich der Videohub-Ansicht.
//
// „VERSION THEM" fehlte. Nachgesehen 2026-09-07: die Green-GO-Datei schreibt
// `fileCreatedVersion: '5.0.6-6684'` — die Version des HERSTELLER-FORMATS —,
// die Videohub-Labels-Datei schreibt gar nichts, und das ATEM-Audio-XML
// ebenso wenig. Keine der drei sagt, aus welchem PLAN und aus welchem STAND
// sie stammt. Auf dem Laptop des Freelancers liegen danach fünf Dateien mit
// ähnlichen Namen, und welche zu welcher Show gehört, weiß niemand mehr.
//
// ─── WARUM DIE ANGABE NEBEN DER DATEI STEHT UND NICHT IN IHR ───────────────
//
// Das ist die eigentliche Entscheidung dieses Moduls, und sie geht gegen die
// bequeme Lösung.
//
// In die Datei zu schreiben hieße, ein fremdes Format zu erweitern. Ob
// Blackmagics Videohub Setup eine `#`-Zeile überliest, ob der Green-GO-Editor
// ein unbekanntes JSON-Feld durchlässt, ob der ATEM-Importer ein zusätzliches
// XML-Kommentar akzeptiert — das ist ohne die Hersteller-Spezifikation NICHT
// zu wissen, und die liegt hier nicht vor. Dass UNSER Parser
// (`parseVideohubLabelsTxt`) `#`-Zeilen überspringt, sagt nichts über das
// Gerät: die Datei geht dorthin, nicht zu uns zurück.
//
// Eine Konfigurationsdatei, die das Pult beim Laden zurückweist, ist beim
// Load-in schlimmer als eine ohne Herkunft — genau die Situation, die der
// Beleg beschreibt. Also wird die Gerätedatei NICHT ANGEFASST, und die
// Herkunft geht als eigenes Blatt daneben.
//
// Und die Reihenfolge ist Absicht: das Blatt geht ZUERST raus, die Konfigu-
// ration danach. Bricht der Browser die zweite Ausgabe ab, fehlt das Blatt —
// nicht die Datei, die die Show braucht.
//
// ─── DIE PRÜFSUMME IST ZUM VERGLEICHEN DA ──────────────────────────────────
//
// Sie wird über den Inhalt der Konfigurationsdatei gerechnet, mit derselben
// Ableitung wie der Dokument-Stempel (ADR-004). Ihr Sinn ist NICHT, dass
// jemand sie nachrechnet — dafür gibt es hier kein Werkzeug, und eine Zahl,
// zu der die Probe fehlt, wäre eine Behauptung. Ihr Sinn ist der VERGLEICH:
// zwei Blätter mit verschiedenen Prüfsummen gehören zu zwei verschiedenen
// Dateien, und das ist am Telefon in fünf Sekunden geklärt. Dieselbe
// Begründung wie bei den acht Hex-Zeichen des Stempels.
//
// REIN: keine Uhr (der Zeitpunkt kommt herein), kein Store. Das Herunterladen
// ist der einzige Seiteneffekt und steht am Ende.
// ───────────────────────────────────────────────────────────────────────────
import { downloadBlob } from './downloadBlob'
import { fingerprint, stampLine, type DocumentStamp } from './documentStamp'

/** Woher eine Gerätekonfiguration stammt. */
export interface DeviceConfigOrigin {
  /** Welches Gerät die Datei bekommt, im Klartext („Blackmagic Videohub"). */
  device: string
  /** Was in ihr steht, im Klartext („Anschluss-Beschriftungen"). */
  what: string
  /** Der Dateiname der Konfigurationsdatei selbst. */
  filename: string
  /** Der Stempel des Plans (ADR-004) — Projekt, Revision, Abweichung. */
  stamp: DocumentStamp
  /** Version der Anwendung, die sie erzeugt hat. */
  app: string
}

/** Die Endung des Herkunfts-Blattes. */
export const PROVENANCE_SUFFIX = '.herkunft.txt'

/**
 * Der Name des Blattes zu einer Konfigurationsdatei.
 *
 * Der volle Dateiname bleibt stehen, die Endung kommt dazu: `routing.txt`
 * wird `routing.txt.herkunft.txt`. Die Endung zu ERSETZEN wäre hübscher und
 * falsch — zwei Konfigurationen desselben Geräts in verschiedenen Formaten
 * (`.txt` und `.csv`) bekämen dasselbe Blatt, und eines überschriebe das
 * andere im Download-Ordner.
 */
export const provenanceFilename = (configFilename: string): string =>
  `${configFilename}${PROVENANCE_SUFFIX}`

/** Datum/Uhrzeit kurz und lesbar. Wie in `documentStamp`, damit es gleich aussieht. */
const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const zeile = (label: string, wert: string): string => `${label.padEnd(14)}${wert}`

/**
 * Das Herkunfts-Blatt als Text.
 *
 * Reine Funktion: derselbe Ursprung und derselbe Inhalt ergeben zweimal
 * dasselbe Blatt. Der Zeitpunkt steht im Stempel und kommt damit von außen.
 */
export const provenanceText = (origin: DeviceConfigOrigin, content: string): string => {
  const summe = fingerprint(content)
  return `Herkunft dieser Gerätekonfiguration
===================================

${zeile('Datei:', origin.filename)}
${zeile('Für:', origin.device)}
${zeile('Inhalt:', origin.what)}
${zeile('Prüfsumme:', `#${summe}`)}

Aus dem Plan
------------
${zeile('Projekt:', origin.stamp.project)}
${zeile('Stand:', origin.stamp.revision ? (origin.stamp.drifted ? `${origin.stamp.revision} + Änderungen` : origin.stamp.revision) : 'keine Revision festgeschrieben')}
${zeile('Stempel:', stampLine(origin.stamp))}
${zeile('Anwendung:', origin.app)}
${zeile('Erzeugt:', fmtDate(origin.stamp.printedAt))}

Wozu dieses Blatt
-----------------
Eine Gerätekonfiguration ohne Herkunft ist ein halbes Jahr später nicht mehr
zuzuordnen. Auf dem Rechner liegen dann mehrere Dateien mit ähnlichen Namen,
und welche zu welcher Show gehört, weiß niemand mehr — der Neuaufbau passiert
beim Load-in vor dem Kunden.

Die Prüfsumme ist zum VERGLEICHEN da, nicht zum Nachrechnen: zwei Blätter mit
verschiedenen Prüfsummen gehören zu zwei verschiedenen Dateien. Das ist am
Telefon in fünf Sekunden geklärt.

Warum das hier neben der Datei steht und nicht in ihr
-----------------------------------------------------
Weil die Konfigurationsdatei einem fremden Gerät gehört. Ob dessen Importer
eine zusätzliche Zeile, ein unbekanntes Feld oder ein Kommentar überliest, ist
ohne die Hersteller-Spezifikation nicht zu wissen. Eine Datei, die das Pult
beim Laden zurückweist, ist schlimmer als eine ohne Herkunft — deshalb bleibt
sie unberührt.
`
}

/**
 * Eine Gerätekonfiguration herunterladen — mit ihrem Herkunfts-Blatt.
 *
 * DIE Stelle, über die jede Gerätekonfiguration dieses Planers hinausgeht.
 * Ein zweiter Weg daneben wäre eine Datei ohne Blatt, und die fällt niemandem
 * auf, bis sie in einem halben Jahr auf einem Laptop liegt.
 *
 * Das Blatt zuerst: bricht der Browser die zweite Ausgabe ab, fehlt das
 * Blatt und nicht die Datei, die die Show braucht.
 */
export const downloadDeviceConfig = (
  origin: DeviceConfigOrigin,
  content: string,
  mimeType: string,
): void => {
  downloadBlob(
    provenanceFilename(origin.filename),
    provenanceText(origin, content),
    'text/plain;charset=utf-8',
  )
  downloadBlob(origin.filename, content, mimeType)
}
