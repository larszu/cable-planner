## Werkzeuge: Planen

Die Werkzeug-Dialoge zum Erfassen, Analysieren und Planen einer Anlage — von der Bestandsaufnahme über Funktionsgruppen bis zur Ausspielung.

### Berechnen

Spezialisierte Rechner für Kapazitäten und Ressourcen.

#### Aufzeichnungsspeicher berechnen

*Werkzeuge → Aufzeichnungsspeicher berechnen…*

![Speicherplatz-Rechner](../bilder/de/werkzeuge-planen-recording-storage-calc.jpg)

Berechnet den Speicherbedarf für Video-Aufzeichnung basierend auf Codec, Auflösung, Framerate und Dauer.

- **Eingaben**: Videoformat (HD/4K/8K), Codec (DCI/H.265/ProRes/etc.), Framerate (25/50/60 fps), Dauer der Aufzeichnung.
- **Ausgabe**: Speichergröße in GB/TB.

#### Projektion & Display

*Werkzeuge → Projektion & Display…*

![Projektions-Rechner](../bilder/de/werkzeuge-planen-projection-calc.jpg)

Berechnet Projektions-Parameter für Bildschirme und Beamer.

- **Eingaben**: Displaygröße (Diagonale), Auflösung, Abstand zum Publikum.
- **Ausgabe**: Optimale Projektions-Entfernung und Linsenparameter.

### Prüfen

Analysen zur Kontrolle und Konsistenzprüfung des Plans.

#### Analysen

*Werkzeuge → Analysen (Gewicht/Netzwerk/Redundanz)…*

Ein umfassendes Analyse-Werkzeug mit 14 Reitern zur Kontrolle aller Aspekte der Anlage.

##### Reiter: Gewicht & Wärme

![Gewicht und Wärmelast nach Gerätegruppe](../bilder/de/werkzeuge-planen-analysis-weight.jpg)

Gesamtgewicht und Wärmelast (BTU/h) pro Gerätegruppe und insgesamt.

- **Tabelle**: Kategorie, Anzahl, Gewicht (kg), Leistung (W), Wärme (BTU/h), optional Wert (€).
- **Fehlend**: Anzeige, wenn Geräte ohne Gewichtsangabe.
- **Download**: CSV-Export für Berechnungsblätter.
- **Link**: Direkter Zugang zum Stromverbrauch-Rechner (s. u.).

##### Reiter: Netzwerk

![Netzwerk-Übersicht: VLAN, IP-Doppelungen, Datenflüsse](../bilder/de/werkzeuge-planen-analysis-network.jpg)

IP-Adressen, VLANs, Switchports und Netzwerk-Topologie prüfen.

- **Adressplan**: IP-Konflikte und fehlende Zuordnungen.
- **VLAN-Zählung**: Welche VLANs und wie viele Ports je VLAN.
- **Switchport-Belegung**: Welche Geräte-Ports an welchen Switch-Ports.
- **Multicast**: Multicast-Adressen und -Gruppen prüfen.

##### Reiter: Redundanz

![Single-Points-of-Failure erkennen](../bilder/de/werkzeuge-planen-analysis-redundancy.jpg)

Überprüft, wo nur ein Signal oder Stromkreis vorhanden ist.

- **Eingänge**: Wieviele unabhängige Strom- oder Upsream-Verbindungen je Gerät?
- **Befunde**: Rote Flaggen für Geräte mit nur einer Verbindung.

##### Reiter: RF / Funk

![Funkfrequenzen und Spektrum-Konflikte](../bilder/de/werkzeuge-planen-analysis-rf.jpg)

Funkstrecken (Mikrofone, Kopfhörer, Kameras) und Spektrum-Konflikte prüfen.

- **Frequenz-Tabelle**: Alle Sender und Empfänger mit Frequenz (MHz), Bandbreite, Leistung.
- **Konflikte**: Zu dicht beieinander liegende Kanäle (< 0,4 MHz Abstand).
- **Spektrum-Scan**: Optional Upload von Spektrum-Messdaten zur Validierung.

##### Reiter: Kabelwege

![Kabel-Längen und Routen prüfen](../bilder/de/werkzeuge-planen-analysis-runs.jpg)

Überprüft die physischen Verlegungswege und Kabellängen.

- **Befunde**: Zu lange Kabel, unzulässige Verlauf-Komplexität.
- **Weg-Details**: Pro Kabel Länge, Leitungsanzahl, Durchmesser.

##### Reiter: Signalwege

![Verfolgung der Signale von Quelle bis Ziel](../bilder/de/werkzeuge-planen-analysis-chain.jpg)

Verfolgt ein Signal durch alle Ebenen — von der Quelle bis zur Ausgabe.

- **Eintrag**: Wähle Quelle und Ziel.
- **Kette**: Zeigt Weg durch Mischer, Router, Player, etc.
- **Konflikte**: Unterbrochene oder mehrdeutige Wege.

##### Reiter: Anschlussliste

![Alle Gerät-zu-Port-Zuordnungen](../bilder/de/werkzeuge-planen-analysis-patch.jpg)

Tabellarische Übersicht aller Kabel-Verbindungen.

- **Spalten**: Quellgerät, -port → Zielgerät, -port, Kabeltyp, Länge.
- **Filter**: Nach Gerät, Kabeltyp, oder Statusn (Geplant/Verbaut).
- **Download**: CSV für Patchlisten-Drucke.

##### Reiter: Blatt prüfen

![Datenblatts-Vollständigkeit prüfen](../bilder/de/werkzeuge-planen-analysis-sheet.jpg)

Überprüft, ob alle erforderlichen Geräte-Datenblätter hinterlegt sind.

- **Status**: Welche Geräte haben Links zu PDF-Datenblättern?
- **Befunde**: Fehlende oder veraltete Datenblätter.

##### Reiter: Kunden-Übersicht

![Zusammenfassung für Angebot und Abnahme](../bilder/de/werkzeuge-planen-analysis-client.jpg)

Übersicht für Kundenkommunikation und Projektabnahme.

- **Projektname, Anlagensystem**: Standard-Info.
- **Geräteliste**: Kurze Fassung für Angebot.
- **Konfiguration**: Wichtigste Parameter (Kameras, Eingänge, Ausgaben).

##### Reiter: Kosten: Plan gegen Ist

![Vergleich zwischen Angebot und tatsächlichen Ausgaben](../bilder/de/werkzeuge-planen-analysis-cost.jpg)

Abweichungen zwischen geplanten und tatsächlichen Kosten.

- **Eingabe**: Gebotene und tatsächliche Preise pro Gerätezeile.
- **Differenz**: Über-/Unterbietung, Prozentsatz.
- **Toleranz**: Schwellenwert für Abweichung eingeben.

##### Reiter: Crew: Stunden & Auslagen

![Personaleinsatz und Material-Kosten](../bilder/de/werkzeuge-planen-analysis-crew.jpg)

Arbeitsplan: Wer, wann, wie lange, Material-Budget.

- **Positionen**: Techniker, Kameraleute, Ton, etc.
- **Stunden**: Aufbau, Betrieb, Abbau.
- **Stundensatz**: Calculation der Personalkosten.
- **Auslagen**: Reise, Hotel, Mietgeräte.

##### Reiter: Namensregel

![Automatische Namens-Schemata anwenden](../bilder/de/werkzeuge-planen-analysis-naming.jpg)

Einheitliche Benennung von Geräten, Kabeln und Netzwerk-Ports.

- **Schema**: Wähle aus vorgefertigten Regeln (Kategorie + Nummer, Hersteller + Modell, Custom).
- **Anwendung**: Welche Objekte aktualisieren?
- **Vorschau**: Zeigt, wie die neuen Namen aussehen.

##### Reiter: Dante-Patch

![Audio-Netzwerk-Leitungen und Geräte-Zuordnung](../bilder/de/werkzeuge-planen-analysis-dante.jpg)

Überprüfung der Dante-Audio-Routing und Geräte-Zertifizierung.

- **Patch-Matrix**: Sender → Empfänger-Zuordnung.
- **Leitungsqualität**: Latenz, Jitter, Redundanz je Leitung.
- **Geräte-Liste**: Dante-Zertifizierung und Firmware-Stand.

##### Reiter: Was ansteht

![Offene Aufgaben und Befunde](../bilder/de/werkzeuge-planen-analysis-todo.jpg)

Zusammenfassung aller Befunde und noch zu erledigenden Aufgaben.

- **Kategorien**: Gewicht, Netzwerk, Redundanz, RF, Kabel, Kosten, etc.
- **Priorität**: Rot (kritisch), Gelb (warnung), Grau (Info).
- **Aktionen**: Was ist zu tun, um den Plan freizugeben?

#### Plan-Prüfung

*Werkzeuge → Plan-Prüfung…*

![Plan-Check: Alle Befunde und Probleme](../bilder/de/werkzeuge-planen-plan-check.jpg)

Scannt den gesamten Plan nach häufigen Fehlern und zeigt sie strukturiert.

- **Filter**: Nach Befund-Art (Fehler, Warnung, Hinweis) oder Gerät/Kabel.
- **Befunde**: Unvollständige Verbindungen, ungültige Kombinationen, missing Metadaten.
- **Automatisch**: Läuft bei jedem Speichern im Hintergrund.

#### Plan gegen Vorgefundenes

*Werkzeuge → Plan gegen Vorgefundenes…*

![Abweichungen zwischen Plan und Bestandsaufnahme](../bilder/de/werkzeuge-planen-reconcile.jpg)

Vergleicht den geplanten Plan mit der erfassten Ist-Situation vor Ort.

- **Bestandsaufnahme laden**: CSV/Excel mit Namen und Positionen.
- **Matching**: Automatischer Abgleich oder manuelle Zuordnung.
- **Differenzen**: Was ist geplant, aber nicht vorhanden? Was steht vor Ort, aber nicht im Plan?
- **Export**: Gegenüberstellung als Bericht.

### Planen

Werkzeuge zum Erfassen, Strukturieren und Detaillieren der Anlage.

#### Bestandsaufnahme (Vorhandenes erfassen)

*Werkzeuge → Bestandsaufnahme…*

![Erfassung vorhandener Geräte vor Ort](../bilder/de/werkzeuge-planen-survey.jpg)

Dokumentiert physisch vorhandene Geräte und deren Position.

- **Geräteeingabe**: Name, Kategorie, angenommener Einsatzort.
- **Raum**: Ablageplatz in der Anlage, oder frei im Raum.
- **Foto**: Schnappschuss des Geräts (optional).
- **Notiz**: Beobachtungen (Zustand, Alternative, abgeklebte Anschlüsse).
- **Anschlüsse raten**: Geräte-Datenblatt suchen und Anschlussgruppen ausfüllen.

#### Drum-Mikrofonierung

*Werkzeuge → Drum-Mikrofonierung…*

![Platzierung von Drum-Mikrofonen](../bilder/de/werkzeuge-planen-drum-micing.jpg)

Spezial-Dialog zur Platzierung von Mikrofonen an Schlagzeug-Komponenten.

- **Schlagzeug-Skizze**: Drum-Kit mit Positionen (Kick, Snare, Hi-Hat, Toms, Becken).
- **Mik-Slots**: Drag-and-Drop von Mikro-Typen auf die Positionen.
- **Stecker**: Geräte wählen (Mischpult, Interface) und Eingangsanschlüsse zuordnen.
- **Notizen**: Name und Notizen je Mik (z.B. Kick-Outside, Snare Top).

#### Funkstrecken / Gesang (Spektrum)

*Werkzeuge → Funkstrecken / Gesang…*

![Frequenz-Planung für Funkstrecken](../bilder/de/werkzeuge-planen-wireless.jpg)

Plant Funkfrequenzen für Drahtlos-Mikrofone und Kopfhörer.

- **Bänder**: 2,4 GHz, UHF (600–700 MHz), UHF (900 MHz), IR, SMD24.
- **Geräte**: Sender und Empfänger-Baureihen, teilweise mit Programmable Freqs.
- **Frequenzzuweisung**: Kanäle Eins-zu-Eins zuordnen, oder automatisch Konflikte minimieren.
- **Spektrum-Scan**: Upload von Messdaten (CSV) zur Überprüfung gegen echte Umweltfrequenzen.

#### Ablauf und Kamera-Aufträge

*Werkzeuge → Ablauf und Kamera-Aufträge…*

![Szenen, Schnitte und Kamera-Anweisungen](../bilder/de/werkzeuge-planen-rundown.jpg)

Strukturiert den zeitlichen Ablauf einer Veranstaltung und ordnet Kamera-Aufgaben zu.

- **Segmente importieren**: Einlesen aus TCS-Dateien oder manuel eintragen.
- **Schnitte / Szenen**: Pro Eintrag Name, Dauer, Musik-Timing.
- **Kamera-Anschlüsse**: Pro Kamera-Position (Kamera 1, Kamera 2, …) welcher Schnitt/Shot zeigen?
- **Handover**: Erstellt Befehlskarten für Kamerateam (QR-Code oder Ausdruck).

#### Ausspielung (Streaming-Ziele)

*Werkzeuge → Ausspielung…*

![Streaming-Destinationen und Parameter](../bilder/de/werkzeuge-planen-delivery.jpg)

Definiert, wohin das Video/Audio geleitet wird (YouTube Live, Zoom, Recording, etc.).

- **Destinationen**: YouTube Live, Facebook, Twitch, RTMPS-Server, Local Recording, Multiview-Monitor.
- **Parameter**: Bitrate, Codec, Auflösung, Framerate.
- **Credentials**: API-Schlüssel, Stream-URLs (sicher verwahrt, nicht im Projekt-File).
- **Monitoring**: Live-Status, Bps-Verbrauch, Fehlerrate.

#### LED-Wand

*Werkzeuge → LED-Wand…*

![LED-Wand: Panelgröße, Auflösung, Gewicht](../bilder/de/werkzeuge-planen-led-wall.jpg)

Platz und Leistung von LED-Flächen planen.

- **Panelformat**: Wähle Standard-Größen oder Custom (z.B. 500×250 mm).
- **Auflösung**: Pixel pro Meter (256, 312, 500 ppm).
- **Anordnung**: Breite × Höhe in Paneleinheiten → Gesamt-Größe in Metern.
- **Gewicht & Leistung**: Berechnung aus Panel-Daten.
- **Pixel-Bild**: Export der Koordinaten für Media-Server (Pixel Mapping).

#### Frontplatten-Editor

*Werkzeuge → Frontplatten-Editor…*

![Anordnung von Anschlüssen auf Wandplatten oder Stage Boxes](../bilder/de/werkzeuge-planen-faceplate.jpg)

Platziert Anschlüsse auf ebener Fläche (Wandplatte, Patchfeld, Stage Box) und druckt 1:1 zum Ausdruck.

- **Platte**: Wähle Größe und Material (19"-Rack-Blende, Wandplatte, Custom).
- **Anschlüsse**: Drag-and-Drop von Stecker-Gruppen.
- **Positionierung**: Millimeter-genaue Platzierung (Rastergitter).
- **Beschriftung**: Automatisch von Gerätennamen, oder Custom.
- **Druck**: 1:1 auf Drucker für Lochbohrungen und Etikettendruck.

#### Berichts-Editor

*Werkzeuge → Berichts-Editor…*

![Spalten, Sortierung und Filter für Listen](../bilder/de/werkzeuge-planen-report-editor.jpg)

Konfiguriert die Darstellung von Gerät- und Kabel-Listen (Druck & Export).

- **Spalten**: Auswahl, Reihenfolge, Breite.
- **Gruppierung**: Nach Kategorie, Raum, Status, oder Custom.
- **Sortierung**: A→Z, nach Wert, nach Datum.
- **Filter**: Nur Geräte bestimmter Kategorien, Räume, oder Zustände.
- **Vorlagen**: Speichern und Abrufen vorkonfigurierter Layouts.

#### Adern und Farbnormen

*Werkzeuge → Adern und Farbnormen…*

![Leitungs-Farben nach Standard und benutzerdefiniert](../bilder/de/werkzeuge-planen-conductors.jpg)

Definiert Leitungs-Farben für Kabel und Anschlussmarker nach IEC oder Custom.

- **Standards**: IEC 60757 (International), EN 50575 (EU), Custom.
- **Sätze**: Vordefinierte Farb-Sequenzen (z.B. Braun/Schwarz/Grau/Weiß für 4×4 XLR).
- **Zuordnung**: Welcher Standard für welche Kabeltypen?
- **Vorschau**: Zeigt tatsächliche Farben der aktuellen Nummern.

#### Empfangene Show-Control-Nachrichten

*Werkzeuge → Empfangene Show-Control-Nachrichten…*

![Protokoll der eingegangenen OSC/MIDI/API-Befehle](../bilder/de/werkzeuge-planen-show-control.jpg)

Zeigt ein Protokoll aller Show-Control-Befehle, die die App erhalten hat (OSC, MIDI, HTTP).

- **Eingangsquelle**: IP:Port, Netzwerk-Interface.
- **Datenfluss**: Zeitstempel, Befehl, Parameter, Status (verarbeitet/ignoriert).
- **Fehler**: Ungültige Befehle, Parse-Fehler.
- **Live-Ansicht**: Echtzeit-Monitor während einer Show.

### Erstellen & Verwalten

Werkzeuge zum Aufbau und zur Verwaltung der Anlage.

#### Mehrere Kabel verbinden

*Werkzeuge → Mehrere Kabel verbinden…*

![Kabel-Massenverbindung in einer Tabelle](../bilder/de/werkzeuge-planen-bulk-connect.jpg)

Verbindet viele Kabel auf einmal, statt einzeln zu klicken.

- **Tabelle**: Quelle, Quellen-Port, Ziel, Ziel-Port, Kabeltyp.
- **Paste**: Kopieren-Paste aus Excel oder CSV.
- **Validierung**: Prüft auf Inkompatibilität (z.B. BNC an HDMI).
- **Anwenden**: Alle Zeilen auf einmal verdrahten.

#### Neues Rack erstellen

*Werkzeuge → Neues Rack erstellen…*

![Neues leeres Rack mit Konfiguration](../bilder/de/werkzeuge-planen-new-rack.jpg)

Erstellt einen neuen Rack-Container aus Geräte-Vorlagen.

- **Name**: Bezeichnung (z.B. „Server Rack 1").
- **Höhe**: Rack-Einheiten (RU), meist 42 RU.
- **Vorlage**: Optional aus Standard-Layouts oder leer.
- **Position**: Wo auf dem Canvas platzieren?

#### Rack-Builder

*Werkzeuge → Rack-Builder…*

![Interaktive Bestückung eines Racks](../bilder/de/werkzeuge-planen-rack-builder.jpg)

Populiert einen Rack mit Geräten, ordnet sie und visualisiert in 3D.

- **Vorhandene Racks**: Liste editierbarer Racks.
- **Geräte-Slots**: Höhenangabe (RU) pro Gerät.
- **3D-Ansicht**: Vorderansicht zur Kontrolle von Kabellängen und Verdeckungen.
- **Exportieren**: Rack-Struktur speichern oder auf den Canvas.

#### KI-Planung generieren

*Werkzeuge → KI-Planung generieren…*

![Generierung eines Draft-Plans aus Text-Beschreibung](../bilder/de/werkzeuge-planen-ai-plan.jpg)

Generiert einen ersten Plan-Entwurf basierend auf einer Text-Beschreibung (KI).

- **Eingabe**: Kurze Beschreibung der Anlage (z.B. „3 Kameras, ATEM-Mischer, 2 Monitore, Streaming auf YouTube").
- **Optionen**: Welche Gerätetypen prioritär, Budget-Grenzen.
- **Entwurf**: KI wählt Geräte aus der Bibliothek und verdrahtet sie.
- **Anpassung**: Generierten Plan editieren.

Erfordert einen KI-API-Schlüssel (OpenAI, Google, Anthropic).

#### Überarbeitungen & Snapshots

*Werkzeuge → Überarbeitungen & Snapshots…*

![Versionenverwaltung: Snapshots und Vergleich](../bilder/de/werkzeuge-planen-revisions.jpg)

Speichert Zwischen-Versionen eines Plans, um Änderungen nachzuverfolgen.

- **Snapshots**: Zeitstempel, optionale Notiz.
- **Autosave**: Automatische Snapshots nach großen Änderungen.
- **Vergleich**: Zwei Versionen nebeneinander, Unterschiede hervorgehoben.
- **Wiederherstellen**: Zurück zu einer älteren Version.

### Device-Konfiguration

Einrichtung spezialisierter Geräte (falls vorhanden).

#### ATEM Multiviewer Layout

*Werkzeuge → ATEM Multiviewer Layout…*

(Nur wenn ein ATEM-Mischer in der Anlage vorhanden ist.)

![Multiviewer-Windows auf dem ATEM konfigurieren](../bilder/de/werkzeuge-planen-atem-mv.jpg)

Legt fest, welche Quellen in welchen Multiviewer-Fenstern angezeigt werden.

- **Layout**: Welche Fenster-Anzahl und Positionen?
- **Zuordnung**: Quelle → Fenster-Nummer.
- **Größe & Position**: Jedes Fenster einzeln dimensionierbar (bei unterstützten ATEM-Modellen).

#### ATEM Audio Routing

*Werkzeuge → ATEM Audio Routing…*

(Nur wenn ein ATEM-Mischer mit Audio-Eingängen vorhanden ist.)

![Audio-Eingänge des ATEM zuordnen](../bilder/de/werkzeuge-planen-atem-audio.jpg)

Richtet Audio-Eingänge (XLR, RCA, Dante) zu Kanal-Fader des Mischers.

- **Eingänge**: Alle Audio-Eingänge des ATEM auflisten.
- **Kanäle**: Welcher Kanal bekommt welchen Input?
- **Empfindlichkeit**: Pegel pro Eingang.

#### ATEM Input Labels

*Werkzeuge → ATEM Input Labels…*

(Nur wenn ein ATEM-Mischer vorhanden ist.)

![Eingangsnamen des ATEM konfigurieren](../bilder/de/werkzeuge-planen-atem-labels.jpg)

Benennt die Eingangs-Quellen am ATEM-Mischer (Name auf der Control Surface).

- **Eingänge**: Liste aller ATEM-Eingänge (1–20+).
- **Namen**: Custom-Name pro Eingang (z.B. „Kamera 1", „Graphics").
- **Farbe**: Optional Zuordnung von Marker-Farben.
