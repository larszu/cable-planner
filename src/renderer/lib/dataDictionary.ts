// ───────────────────────────────────────────────────────────────────────────
// Das Spaltenlexikon (Bedarf 81, P2, erste Haelfte).
//
//   > Separately, PMs spend time explaining their own export columns to other
//   > people.
//
// Die Bedarfs-Datenbank nennt die Massnahme woertlich: „Ship a DATA DICTIONARY
// alongside every export […]. Cheap, and directly requested."
//
// ─── WARUM DAS LEXIKON NACH SPALTENNAME GEHT, NICHT NACH BLATT ─────────────
//
// Naheliegend waere `Record<dokument, Record<spalte, text>>`. Genau das waere
// aber die Krankheit und nicht die Kur: dann duerfte „Ziel" auf dem einen
// Blatt etwas anderes heissen als auf dem anderen, und niemand haette einen
// Ort, an dem der Widerspruch auffiele. Ein Lexikon nach NAMEN erzwingt die
// Frage: bedeutet dieses Wort ueberall dasselbe? Wo es das nicht tut, nennt
// der Eintrag beide Lesarten — statt eine auszusuchen und die andere still
// falsch zu machen.
//
// ─── DAS LEXIKON REIST MIT ─────────────────────────────────────────────────
//
// Es haengt IN der Datei, nicht daneben. Dieselbe Regel wie beim Hinweis im
// NOALBS-Geruest (Bedarf 89): die Datei geht per Mail weiter, der Satz daneben
// bleibt im Chat zurueck.
//
// Es haengt UNTER den Daten und nicht darueber, damit ein Tabellenprogramm
// die erste Zeile weiterhin als Kopfzeile liest — und es aendert den
// Dokument-STAND nicht: der wird aus `headers`/`rows` gerechnet
// (`documentFingerprint`), nicht aus den exportierten Bytes. Ein Lexikon, das
// den Stand veraenderte, meldete jedes gedruckte Exemplar als veraltet.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CsvCell } from './csv'

/** Die Zeile, mit der der Lexikon-Block anfaengt. Erkennbar fuer Menschen und
 *  fuer den Guard, der prueft, dass er ueberhaupt drankommt. */
export const DICTIONARY_MARKER = '# Spaltenlexikon — was die Spalten oben bedeuten'

/** Was in der Bedeutungs-Spalte steht, wenn ein Wort noch nicht erklaert ist.
 *  Ein NAME statt einer leeren Zelle: „nicht beschrieben" ist ein Auftrag,
 *  eine leere Zelle sieht aus wie „braucht keine Erklaerung". */
export const UNDESCRIBED = 'nicht beschrieben'

/**
 * Spaltenname → was er bedeutet, in einem Satz.
 *
 * Kanonisches Deutsch, wie bei allen Blatt-Texten: ein Lexikon, das mit der
 * eingestellten Sprache wechselt, aenderte den Inhalt jeder exportierten
 * Datei, ohne dass sich am Plan etwas geaendert haette.
 */
export const COLUMN_GLOSSARY: Readonly<Record<string, string>> = {
  Abweichung:
    'Ist minus Schätzung. „unbekannt“ heißt: eine der beiden Zahlen fehlt — nicht, dass die Abweichung null wäre.',
  'Abweichung %':
    'Die Abweichung im Verhältnis zur Schätzung. Bei einer Schätzung von 0 gibt es keinen Prozentsatz.',
  Abgehakt: 'Wie viele Positionen des Containers beim Ein- oder Auschecken bestätigt wurden.',
  Abnahme: 'Ob der Kanal bei der Probe abgenommen wurde.',
  Abschnitt: 'Der Themenblock des Merkblatts (Zugang, Adressen, Verbote, Ansprechpartner).',
  'Abweichung begründet':
    'Warum dieses Ziel andere Veranstaltungsangaben trägt als das Projekt. „—" heißt: es weicht nicht ab.',
  'Alter Name': 'Wie das Gerät heute heißt.',
  'Am Dante-Netz':
    'Ob das Gerät eine Dante-Schnittstelle führt. Nur dort gilt die 31-Zeichen-Grenze, und nur dort brechen Subscriptions beim Umbenennen.',
  An: 'An wen der Container ausgegeben wurde.',
  'Änderungen seither':
    'Wie viele inhaltliche Änderungen seit dem festgeschriebenen As-Built dazugekommen sind.',
  'Angesagt in':
    'Die Zeitzone, in der der Beginn angesagt wurde — nicht dasselbe wie der Offset im Zeitpunkt.',
  Anker:
    'Woran die Netz-Identität des Geräts hängt (IP, MAC, Dante-Name, PTP). Ohne Anker ist ein Tausch unsichtbar.',
  Anmerkung: 'Freitext des Planers zu dieser Zeile.',
  Anteil:
    'Wie groß dieser Teil am Ganzen ist — immer MIT Nenner („3 von 12 (25 %)"), nie als nackter Prozentsatz.',
  Antwort: 'Was das Haus auf die Frage geantwortet hat — gewährt, abgelehnt oder mit Auflage.',
  Anzahl: 'Wie viele Geräte oder Positionen diese Zeile betrifft.',
  Art: 'Die Sorte des Eintrags — je nach Blatt Ereignis-, Kanal-, Container- oder Anforderungsart.',
  'As-Built': 'Die Revision, die als Bauzustand festgeschrieben wurde.',
  Audio: 'Die geplanten Audio-Parameter des Ziels (Codec, Abtastrate, Bitrate).',
  'Auflage / Umweg':
    'Unter welcher Bedingung das Haus zugestimmt hat, oder welcher Umweg vereinbart wurde.',
  'Aus dem Plan':
    'Der Wert, den der Plan für diesen Punkt vorsieht — die Frage- oder Vergleichsseite.',
  Ausgang: 'Der Ausgang am Pult, auf den dieser Kanal geht.',
  Ausgegeben: 'Wann der Container ausgegeben wurde.',
  'Ausgegeben an': 'An wen die beschädigte Einheit zuletzt ausgegeben war.',
  'Backup von': 'Für welches Ziel dieses Ziel der Ausweichweg ist.',
  Bereich: 'Der Themenblock der Übersicht (Geräte, Kabel, Ausspielung, Aufbau).',
  Befund:
    'Was die Prüfung an dieser Zeile beanstandet. Leer heißt: nichts beanstandet, nicht „nicht geprüft".',
  Beginn: 'Der geplante Beginn der Veranstaltung, so wie er eingetragen wurde.',
  Bein: 'Welcher der beiden 2022-7-Wege (a oder b) diese Vergabe ist.',
  'Beobachtet von': 'Wer den Eintrag im Sendebericht gemacht hat.',
  Beschreibung: 'Der Klartext zu dieser Zeile.',
  Bezeichnung: 'Wie der Container im Lager heißt.',
  Bild: 'Die geplanten Bild-Parameter des Ziels (Auflösung, Bildrate, Codec).',
  'Bezug im Plan':
    'Woran die Kostenposition im Plan hängt — ein Gerät, ein Ausspielziel, oder ausdrücklich nichts (Fahrt, Personal).',
  Ch: 'Die Kanalnummer am Pult.',
  Code: 'Der Etiketten- oder Barcode, mit dem die Einheit gescannt wird.',
  Container: 'Der Container (Case, Kiste), zu dem diese Zeile gehört.',
  Dienste:
    'Welche Dienste ein Fehler mitgenommen hat. Ein SMPTE-/Fiber-Strang trägt sie gemeinsam, deshalb ist die Angabe mehrwertig.',
  'Dienste auf dem Strang':
    'Welche Dienste über denselben Kabelstrang laufen — die Grundlage der Trennungs-Prüfung.',
  Domaene: 'Die PTP-Domänennummer der Schnittstelle.',
  Eingang: 'Der physische Eingang am Gerät oder Mischer.',
  Einheit: 'Die einzelne, mit Seriennummer unterscheidbare Kiste — nicht das Modell.',
  Empfänger: 'Wer den Multicast-Fluss empfängt.',
  Encoder: 'Das Gerät im Plan, das dieses Ziel beliefert.',
  Ergebnis: 'Wie die Inventur-Prüfung dieser Position ausgegangen ist.',
  'Erwartet in': 'Wo die Position laut Plan liegen müsste.',
  Essenz: 'Die Sorte Nutzlast — Video, Audio, ANC oder Licht.',
  'Etiketten-Code': 'Der aufgeklebte Code, unter dem die Einheit gescannt wird.',
  'Fehler gesamt':
    'Alle je gemeldeten Fehler an dieser Einheit, auch die behobenen. Die Zahl daneben zählt nur die offenen.',
  Feld: 'Das benannte Feld des Übergabe-Dokuments.',
  Fluss: 'Ein einzelner Sende-Strom, aus dem Kabelgraph abgeleitet (Gerät und Port).',
  'Frage an das Haus':
    'Was die Haus-IT beantworten oder freigeben muss, im Wortlaut des Anforderungsblatts.',
  'Frequenz (MHz)': 'Die belegte Funkfrequenz in Megahertz.',
  Gateway: 'Das Standard-Gateway des Netzsegments.',
  'Gefundene IP': 'Die Adresse, die vor Ort tatsächlich angetroffen wurde.',
  Gekuerzt: 'Ob der Name für das Ziel-Gerät gekürzt werden musste, und wie.',
  'Geplant (kbit/s)': 'Die im Plan hinterlegte Gesamt-Bitrate des Ziels (Bild plus Ton).',
  'Geprueft an': 'Wann diese Position zuletzt geprüft wurde.',
  Geraet: 'Das Gerät im Plan, um das es in dieser Zeile geht.',
  'Geraet(e)': 'Die Geräte, die dieser Zeile zugeordnet sind.',
  Geraete: 'Die Geräte, die an diesem Punkt hängen.',
  Grundlage:
    'Woraus dieses Blatt spricht: aus dem festgeschriebenen As-Built, aus einem veralteten As-Built oder aus dem Plan (also im Zweifel dem Angebot).',
  Gruppe: 'Die vergebene Multicast-Gruppenadresse.',
  Haus: 'Der Ort, für den die Antwort gegeben wurde — eingefroren beim Speichern.',
  Herkunft:
    'Woher die Angabe stammt. Im Sendebericht: gesehen, aus einem Log abgetippt oder gemeldet. Auf anderen Blättern: aus welcher Quelle im Plan der Wert kommt.',
  'Herkunft (Ist)':
    'Woher der Ist-Wert stammt — aus dem ERP, von der Rechnung oder von Hand geschätzt.',
  'Im Klartext im Plan':
    'Wie oft der alte Name in Notizen oder Antworten als Text vorkommt. Diese Stellen bricht ein Umbenennen still.',
  'Im Plan': 'Was der Plan an dieser Stelle vorsieht — die Soll-Seite des Abgleichs.',
  'Ingest-URL': 'Die Adresse, an die gesendet wird. Ohne Stream-Key — der steht nie in einer Datei.',
  IP: 'Die IP-Adresse der Schnittstelle.',
  Ist: 'Der tatsächlich angefallene Betrag. Wird nie gerechnet und nie geraten.',
  Kabel: 'Das Kabel, um das es in dieser Zeile geht.',
  Kennung: 'Die interne Kennung des Datensatzes, für den Rückbezug.',
  Kennzahl: 'Der Name der Kennzahl im Übergabe-Dokument.',
  'Key hinterlegt':
    'Ob für dieses Ziel ein Stream-Key im Schlüsselbund DIESES Rechners liegt. Der Wert selbst steht nirgends in der Datei.',
  Keyframe: 'Der geplante Keyframe-Abstand in Sekunden.',
  Konto: 'Das Konto oder der Kanal auf der Plattform.',
  'L2-MAC':
    'Die Ethernet-Adresse, auf die diese Gruppe abgebildet wird. 32 Gruppen fallen auf dieselbe — daran erkennt man einen Alias.',
  'Laenge (m)': 'Die Länge in Metern.',
  Lagerort: 'Wo der Container im Lager steht.',
  MAC: 'Die Ethernet-Adresse der Schnittstelle.',
  Maske: 'Die Subnetzmaske des Segments.',
  Menge: 'Die Stückzahl dieser Position.',
  Mischer: 'Der Bildmischer, auf den sich die Eingangsnummer bezieht.',
  Modell: 'Der Gerätetyp — nicht die einzelne Einheit.',
  Name: 'Der Name, unter dem der Datensatz im Plan geführt wird.',
  'Neuer Name': 'Der Name, den die Regel für dieses Gerät ergibt.',
  'Niedrige Bitrate': 'Die Szene, auf die bei niedriger Bitrate geschaltet werden soll.',
  Normalbetrieb: 'Die Szene für den Normalbetrieb — der Rückweg aus der Ausweichszene.',
  Notiz: 'Freitext zu diesem Ziel.',
  'Nr.': 'Die laufende Nummer auf diesem Blatt.',
  Objekt: 'Die Sache, um die es geht — Einheit, Container oder Position.',
  'Offene Fehler':
    'Wie viele gemeldete Fehler an dieser Einheit noch nicht als behoben nachgetragen sind. Ein Eintrag ohne Angabe zählt als offen.',
  Offline: 'Die Szene, auf die geschaltet wird, wenn nichts mehr ankommt.',
  Plan: 'Die Menge oder der Wert, den der Plan vorsieht.',
  'Plan-IP': 'Die Adresse, die der Plan für dieses Gerät vorsieht.',
  Plattform: 'Die Zielplattform (YouTube, Twitch, eigenes Ziel …).',
  Platz: 'Der Platz im Rack oder Case, an dem die Einheit sitzt.',
  Port: 'Der Port am Switch oder am Gerät.',
  Position: 'Die einzelne Zeile einer Liste oder Buchung.',
  Positionen: 'Wie viele Positionen der Container enthält.',
  Profil: 'Das PTP-Profil (ST 2059-2, AES67 …).',
  'Programm-Eingang': 'Der Eingang, an dem das Programm-Signal in den Ausspielweg eintritt.',
  Pult: 'Das Mischpult, auf das sich der Kanal bezieht.',
  Punkt: 'Der Punkt des Anforderungsblatts, auf den sich die Zeile bezieht.',
  Quelle:
    'Woher das Signal oder die Angabe kommt — je nach Blatt das speisende Gerät, der Kanal oder die Fundstelle.',
  Reservierung: 'Die Menge, die im Warenwirtschaftssystem reserviert ist.',
  Rolle: 'Wofür das Gerät oder die Schnittstelle in diesem Zusammenhang steht.',
  'Schätzung': 'Der geschätzte Betrag dieser Position.',
  Schaden: 'Was an der Einheit beschädigt ist.',
  Schlagworte: 'Die Schlagworte für die Plattform-Formulare.',
  Schnittstelle: 'Die Netzwerk-Schnittstelle des Geräts (erste, Dante-Sekundär, ST 2110 blau …).',
  'Schwelle niedrig (kbit/s)': 'Ab welcher Bitrate der Wächter „niedrig" annehmen soll.',
  'Schwelle offline (kbit/s)': 'Ab welcher Bitrate der Wächter „offline" annehmen soll.',
  'Serie (Einheit)': 'Die Seriennummer, die an der Lager-Einheit steht.',
  'Serie (Platz)': 'Die Seriennummer, die am Platz im Plan hinterlegt ist.',
  Show: 'Das Projekt oder die Show, zu der die Zeile gehört.',
  Sichtbarkeit: 'Wie die Veranstaltung auf der Plattform sichtbar ist.',
  'Sichtbarkeit aus': 'Ob die Sichtbarkeit vom Projekt kommt, aus einer Abweichung oder nirgendwo.',
  Standard: 'Der Signalstandard des Flusses (ST 2110-20, AES67, sACN …).',
  Status: 'Der Zustand der Zeile.',
  Stecker: 'Der Steckertyp an diesem Ende.',
  'Stream-Key':
    'Nur der VERWEIS auf den Schlüsselbund-Eintrag, nie der Wert. Ein Blatt geht per Mail.',
  Text: 'Der Klartext dieser Zeile.',
  Thumbnail: 'Der Dateiname des Vorschaubilds — das Bild selbst steckt nicht im Projekt.',
  Titel: 'Der Titel, unter dem die Veranstaltung läuft.',
  'Titel aus': 'Ob der Titel vom Projekt kommt, aus einer Abweichung oder nirgendwo.',
  Transport: 'Über welchen Transport gesendet wird (SRT, RTMP, HLS).',
  'UDP-Port': 'Der Sende-Port. Adresse und Port zusammen müssen je Sender eindeutig sein.',
  'UMD-Adresse': 'Die TSL-Adresse, unter der der Multiviewer diese Quelle beschriftet.',
  Video: 'Die geplanten Video-Parameter des Ziels.',
  VLAN: 'Das VLAN, in dem die Schnittstelle liegt.',
  Vorgefunden: 'Was vor Ort tatsächlich angetroffen wurde — die Ist-Seite des Abgleichs.',
  Wann: 'Wann die Angabe gemacht oder die Antwort gegeben wurde.',
  Was: 'Worum es in dieser Zeile geht.',
  'Währung': 'Das Währungskürzel des Projekts. Wird nicht geraten, auch nicht „EUR“.',
  'Was gilt': 'Die Regel, die für diesen Abschnitt gilt.',
  Wer: 'Wer die Angabe gemacht hat.',
  'Wer / wo': 'Wer die Frequenz benutzt und an welcher Position.',
  Wert: 'Der Wert der Kennzahl.',
  Widerspruch:
    'Wo sich zwei Angaben zu demselben Port widersprechen — die Schnittstelle sagt das eine, das Kabel das andere.',
  X: 'Die X-Position auf der Bühnenfläche.',
  Y: 'Die Y-Position auf der Bühnenfläche.',
  Zeit: 'Der Zeitpunkt des Eintrags, wie ihn ein Mensch eingetragen hat.',
  Zeichen: 'Wie viele Zeichen der neue Name hat.',
  Ziel:
    'Wohin es geht. Bei der Ausspielung das Ausspielziel (Plattform-Adresse), sonst das empfangende Gerät oder der empfangende Kanal.',
  'Zugeordnet ueber': 'Woran das vorgefundene Gerät dem geplanten zugeordnet wurde.',
  Zuordnung: 'Wie die Plan-Position dem Artikel im Warenwirtschaftssystem zugeordnet ist.',
  'Zurueck am': 'Wann die Einheit oder der Container zurückgegeben wurde.',
  'Zurueck bis': 'Bis wann die Rückgabe zugesagt ist.',
  Zuletzt: 'Wann der jüngste Fehler an dieser Einheit gemeldet wurde.',
  Zwischenstationen: 'Die Geräte, die zwischen Programm-Eingang und Ziel im Weg liegen.',
}

/**
 * Das Lexikon fuer genau die Spalten, die auf diesem Blatt vorkommen.
 *
 * Nicht das ganze Lexikon: 134 Zeilen unter einer siebenspaltigen Liste waeren
 * kein Nachschlagewerk, sondern Ballast, und der Leser gaebe nach der dritten
 * Zeile auf.
 */
export const dictionaryRows = (headers: string[]): CsvCell[][] =>
  headers.map((h) => [h, COLUMN_GLOSSARY[h] ?? UNDESCRIBED])

/** Die Spalten dieses Blatts, fuer die noch kein Eintrag existiert. */
export const undescribedColumns = (headers: string[]): string[] =>
  headers.filter((h) => !(h in COLUMN_GLOSSARY))

/**
 * Der Lexikon-Block, wie er unter die Daten gehaengt wird.
 *
 * Als Zeilen und nicht als fertiger Text, damit der CSV-Bauer sie genauso
 * maskiert wie alle anderen — eine Bedeutung mit einem Semikolon darin haette
 * sonst die Spalten verschoben.
 */
export const dictionaryBlock = (headers: string[], columns: number): CsvCell[][] => {
  const pad = (row: CsvCell[]): CsvCell[] => {
    const out = [...row]
    while (out.length < Math.max(1, columns)) out.push('')
    return out
  }
  return [pad([]), pad([DICTIONARY_MARKER]), ...dictionaryRows(headers).map(pad)]
}
