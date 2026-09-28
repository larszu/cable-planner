# LZ Cable Planner — Benutzerhandbuch

Broadcast- und AV-Verkabelung planen, dokumentieren und übergeben:
Signalfluss, Räume und Etagen, Kabellängen, Patch-Listen und die Unterlagen
für den Aufbautag.

English version: [manual.en.md](manual.en.md)

## Inhalt

1. Installation
2. Erstes Projekt
3. Der Canvas
4. Geräte
5. Kabel
6. Räume, Etagen und 3D
7. Hallenplan und echte Kabellängen
8. Symbole
9. Adapter, Gender-Changer, Wandler
10. Frontplatten
11. Glasfaser-Breakouts und Polarität
12. LED-Wände
13. ATEM und Videohub
14. Listen und Berichts-Editor
15. Export und Übergabeunterlagen
16. Vor Ort: Telefon, Bestandsaufnahme, Etiketten
17. Zusammenarbeiten: Live-Sitzung und Cloud
18. Gerätebibliothek
19. Import und Austausch
20. Claude (MCP)
21. Web-Ausgabe und Tablet
22. Daten, Sicherheit und Fehlerbehebung

---

## 1. Installation

Das Installationsprogramm liegt im
[neuesten Release](https://github.com/larszu/cable-planner/releases/latest):

- **macOS**: `.dmg` für Apple Silicon und Intel
- **Windows**: `.exe`

Die App läuft vollständig offline. Internet braucht nur die Gerätebibliothek,
die Cloud-Kopie und die Live-Sitzung über Netzgrenzen hinweg.

Ohne Installation läuft die Web-Ausgabe unter
**https://larszu.github.io/cable-planner/** (was sie nicht kann: Kapitel 21).

## 2. Erstes Projekt

- **Datei → Neues Projekt** beginnt einen leeren Plan. **Öffnen…**,
  **Speichern** und **Speichern unter…** wie gewohnt; die Liste der letzten
  Projekte füllt sich selbst.
- Ein Projekt ist eine einzelne JSON-Datei (`.cableplan`). Sie lässt sich mit
  git versionieren und wie Text vergleichen.
- Während der Arbeit schreibt die App alle paar hundert Millisekunden eine
  Sicherungskopie. Wird das Projekt größer als dieser Speicher (etwa 5 MB),
  zeigt die Statusleiste **„Keine Sicherungskopie"** mit der Projektgröße —
  dann in eine Datei speichern. Der Plan selbst ist davon nicht betroffen.
- Rückgängig und Wiederholen reichen 100 Schritte zurück.

![Der Canvas](../screenshots/hero.png)

## 3. Der Canvas

- Geräte aus der **Bibliothek** auf den Canvas ziehen. Zoomen, Verschieben und
  die Übersichtskarte gehen mit Maus, Trackpad oder Finger.
- Von Anschluss zu Anschluss ziehen, um ein Kabel zu legen. Knickpunkte und
  Segmente folgen dem Zeiger während des ganzen Ziehens.
- Rechtsklick auf ein Gerät (am Touchscreen: lange drücken) öffnet sein
  Kontextmenü.
- Rechtsklick auf eine freie Stelle → **Neues Gerät hier …** legt ein Gerät nur
  für dieses Projekt an.
- **Signalweg zeigen** (in den Eigenschaften eines Kabels) hebt die ganze Kette
  hervor, zu der das Kabel gehört — über Platten, Hausleitungen, Wandler und
  Kreuzschienen — und listet jede Station mit Etage, Raum, Gerät und Anschluss.
  **Esc** oder der Chip in der Werkzeugleiste beendet die Anzeige.

## 4. Geräte

### Eigenschaften

![Geräteeigenschaften](../screenshots/properties.png)

Oben stehen fest **Name**, **Kurzname**, **Untertitel**, dann **Ein- &
Ausgänge**, dann die **Notiz** (Web-Oberfläche, Firmware, Standort,
Eigentümer). Der Kurzname wird aus dem Namen abgeleitet und als eine Zeile
gezeigt; der Stift öffnet ihn zum Bearbeiten, *auto* kehrt zur Ableitung
zurück. Die beiden Port-Listen lassen sich übereinander ziehen; das tauscht sie
und spiegelt die Ports am Knoten, genau wie das Häkchen *Ports spiegeln*. Alle
übrigen Abschnitte lassen sich in jede Reihenfolge ziehen. Das Filterfeld findet einen Abschnitt über den Titel;
alle auf- oder zuklappen mit einem Klick. Welche Abschnitte offen sind, merkt
sich die App.

### Eigenes Gerät anlegen

- **Eigenes Gerät anlegen** in der Bibliothek braucht nur einen Namen.
  Anschlüsse, Hersteller und Datenblatt können später folgen. Beim Tippen
  erscheinen passende Bibliotheksgeräte unter dem Namensfeld; **Als Vorlage
  nutzen** übernimmt Kategorie, Rackmaß und Anschlüsse, der Name bekommt
  *(Kopie)*, damit das Original stehen bleibt. Ein Kabelende
  auf den Körper eines solchen Geräts fallen lassen, und es bekommt einen
  passenden Anschluss.
- **Nur im Projekt platzieren** hält das Gerät aus der Vorlagenbibliothek
  heraus — für Leihgeräte, Kundengeräte oder Platzhalter.
- **Anschlüsse vom Foto**: Fotos der Anschlussseite wählen, ablegen oder
  einfügen (am Telefon: **Foto aufnehmen**). Der unter *Einstellungen →
  Integrationen → KI* gewählte Anbieter liest die Buchsen und das Typenschild.
  Das Ergebnis ist eine bearbeitbare Vorschlagsliste; unsichere Zeilen sind
  nicht angehakt, übernommen wird erst nach Bestätigung. Steht das Modell im
  eingebauten Katalog, wird stattdessen dieser Eintrag angeboten.

### Katalogzuordnung

Von Hand angelegte, importierte oder aus älteren Projekten geladene Geräte
werden automatisch ihrem Katalogmodell zugeordnet, wenn der Name genau einen
Eintrag trifft. Bei mehreren Treffern wird nie geraten; der Abschnitt
**Katalog & Herkunft** bietet sie an. Katalogeinträge tragen einen
**Hersteller-Link** zum Datenblatt.

Einträge, deren Buchsen nicht bekannt sind, tragen die Markierung
*Anschlüsse unbekannt*. Der Plan-Check fragt nach dem Datenblatt; die
Markierung verschwindet, sobald echte Anschlüsse eingetragen sind.

### Netzwerk und Streams

- **Network & Access**: IP, Maske, Gateway, MAC und **VLAN**. Die Gerätekarte
  zeigt `10.0.0.5 /24 · VLAN 30`.
- **Streams**: was ein Gerät sendet oder empfängt (RTSP, SRT, RTMP, NDI, HLS,
  MJPEG, WebRTC, ST 2110, Dante, AES67 …) mit Adresse, Port, Codec und Format.
- **Zugangsdaten kommen nie in den Plan.** Benutzername, Passwort oder Token in
  einer Stream-Adresse werden beim Verlassen des Felds entfernt. Die
  Desktop-App legt sie im Schlüsselbund des Rechners ab.
- **Standbild-Vorschau** unter einem Gerät: von der Snapshot-Adresse der Kamera
  oder — bei einem RTSP-, RTMP-, SRT-, HLS- oder MJPEG-Stream — ein Bild über
  **ffmpeg** (separat installieren: `brew install ffmpeg` bzw. `ffmpeg.exe` im
  PATH). Nur Desktop-App, nur lokales Netz, alle 10 s neu. Die Vorschau startet
  erst nach Klick auf **Vorschau starten**.

### Stammdaten

*Einstellungen → Stammdaten* führt eigene Steckertypen, Signalstandards und
Kabelebenen neben den eingebauten. Eine Umbenennung wirkt auf alle Anschlüsse,
Kabel und Vorlagen des offenen Projekts.

## 5. Kabel

- Jedes Kabel hat Typ, Länge, Farbe, Beschriftung und Notizen.
- Eigenschaften, Zugliste und Kabelplan zeigen beide Enden als
  *Etage · Raum · Gerät · Anschluss*.
- **Lagerlängen**: die vorhandenen Trommeln unter *Einstellungen → Projekt →
  Verfügbare Lagerlängen* eintragen. Die Stückliste teilt dann einen 137-m-Lauf
  in 100 + 50 mit einem Verbinder — erst möglichst wenige Verbinder, dann
  möglichst wenig Überlänge — und nennt, was der Bestand nicht abdeckt.

![Kabel-Stückliste](../screenshots/bom.png)

## 6. Räume, Etagen und 3D

- Ein **Rahmen** auf dem Canvas ist ein Raum. Er wählt seine Etage aus der
  Etagenliste des Projekts (*Etagen* in den Rahmeneigenschaften, von unten
  nach oben, mit Höhe in Metern).
- **Räume ▾** in der Werkzeugleiste blendet Etagen oder einzelne Räume aus. Ein
  Kabel in einen ausgeblendeten Raum bleibt als Stummel stehen und nennt sein
  Ziel; Exporte bleiben immer vollständig.
- **3D** zeigt das Gebäude: jeder Raum auf seiner Etagenhöhe, die Geräte darin,
  die Verbindungen zwischen Räumen als eine Linie je Raumpaar oder als einzelne
  Kabel.
- **Steigschacht / senkrechte Trasse** an einem Rahmen macht ihn zum Schacht
  durch alle Etagen. Kabel zwischen Etagen laufen dann über den nächsten
  Schacht.

## 7. Hallenplan und echte Kabellängen

Werkzeugleiste → **Hallenplan**.

1. Bild laden oder ablegen (PNG, JPG, WebP, GIF, BMP, AVIF) — oder die Venue
   aus dem MultiCam- oder Light-Planner importieren. PDF-Pläne vorher als PNG
   oder JPG exportieren.
2. Maßstab setzen:
   - **Zwei Punkte** bei einem Plan von oben: beide Enden einer bekannten
     Strecke anklicken.
   - **Vier Ecken** bei einem Foto oder einer isometrischen Zeichnung: die
     Ecken einer Bodenfläche mit bekannter Breite und Tiefe anklicken.
3. Nach der Kalibrierung ist der Plan gesperrt und liegt unter allem.

Kabellängen folgen dann dem gezeichneten Weg, Buchse zu Buchse, durch jeden
Knickpunkt. Eine Länge gilt als **veraltet**, sobald ein Gerät verschoben, ein
Kabel neu geführt oder der Plan neu kalibriert wird.

## 8. Symbole

Werkzeugleiste → **Symbole**: Elektro, Einbruch- und Brandmelde, Sprachalarm,
IT, Automation und AV, gezeichnet nach DIN EN 60617 und DIN 14034-6.

- Ein Symbol beschriftet den Plan, es ist kein Gerät: keine Anschlüsse, keine
  Prüfungen.
- Eigene Symbole als SVG, PNG, JPG oder WebP importieren; sie reisen in der
  Projektdatei mit.
- Mit einem KI-Schlüssel unter *Einstellungen → KI* lässt sich ein Symbol aus
  einer Beschreibung erzeugen.
- Die Symbolliste exportiert als CSV.

## 9. Adapter, Gender-Changer, Wandler

- **Adapter** — ändert die Steckerform (BNC auf Cinch).
- **Gender-Changer** — ändert nur Stecker oder Buchse.
- **Wandler** — ändert das Signal (SDI auf HDMI).

Adapter und Gender-Changer lassen sich mit einem Klick in ein ausgewähltes
Kabel einsetzen; ein Rückgängig nimmt das Einsetzen zurück. Wandler werden
**benannt**, nicht eingesetzt: Modell, Bandbreite und Preis sind Ihre
Entscheidung. Eingesetzte Teile bleiben im Plan-Check ein *offener Punkt*, bis
sie geprüft sind.

## 10. Frontplatten

*Werkzeuge → Frontplatten-Editor…* — Wandanschlussfelder, Stageboxen und
Rackblenden.

- Jede Buchse **in Millimetern** platzieren; die Buchsen sind die Anschlüsse
  des Geräts selbst.
- Den Ausschnittdurchmesser aus dem Herstellerdokument eintragen — er wird nie
  geschätzt. Ohne ihn werden Bohrungen nicht gegeneinander geprüft, und der
  Bericht sagt das.
- Prüfungen: Bohrung über den Rand, überlappende Bohrungen (mit Überlappung in
  mm), Buchsen ohne Position.
- **Beschriftungsstreifen** (einer je Reihe) und **Bohrbild** im Maßstab 1:1
  drucken.
- Eine Platte reicht das Signal durch — Buchse *n* hinten auf Buchse *n*
  vorn. **Patchfeld** abwählen für eine Stagebox mit Wandler darin. **Auf der
  Platte** wählt, welche Seite gebohrt wird.

## 11. Glasfaser-Breakouts und Polarität

- Eine Buchse kann einen **Breakout** tragen: jede Faser mit Position,
  `TX`/`RX`/*nicht angegeben* und eigenem Stecker am Ende.
- Jedes Kabelende nennt die genutzte Faser; Patch- und Zugliste zeigen sie.
- Der Plan-Check findet teilweise belegte Breakouts, zwei Kabel auf einer
  Faser und Fasern, die die Buchse nicht hat.
- **Polarität** wird nur gegen die gewählte Methode geprüft (TIA-568 A, B oder
  C). Ohne Methode steht sie als *ungeprüft* im Bericht.

## 12. LED-Wände

*Werkzeuge → LED-Wand…*

- Paneltypen mit Pixelabstand, Auflösung, Größe und — wo angegeben — Gewicht
  und Leistung (Mittel und Spitze).
- Öffnung in Millimetern eingeben: Raster und Rest werden angezeigt.
- Summen für Panelzahl, Auflösung, Größe, Gewicht und Last; benötigte gegen
  vorhandene Ports der Sendekarte.
- Die Wand hängt an einer Gebäudesteckdose: ihre Dauerlast zählt dort mit, ihre
  Spitze bekommt einen eigenen Befund.
- **Pixel-Map** als PNG in der Auflösung der Wand, Kacheln von oben links
  nummeriert.

## 13. ATEM und Videohub

![ATEM-Multiviewer-Editor](../screenshots/atem-multiview.png)

- **ATEM-Multiviewer** (*Werkzeuge → ATEM Multiviewer-Layout…*): grafischer
  Layout-Editor, Program/Preview- und Kamerazuordnung, exportierbare
  Konfiguration. Für Television Studio, Constellation und M/E-Modelle.
- **Videohub** (*Werkzeuge → Videohub-Routing/Labels…*): Quelle → Ziel,
  Kreuzschienen-Konfiguration, Übersicht und Export.

Der Planner liest Mischer und Kreuzschienen. Schaltbefehle über die
KI-Schnittstelle gibt es nicht.

## 14. Listen und Berichts-Editor

Jede Liste — Zugliste, Auflegeliste, Kabelplan, Anlagenverzeichnis,
Netzwerkblatt, Frequenzplan, Ausspielung, Tally-Map, Übergabe, Signalwege,
Hausleitungsbelegung, Durchbrüche, Mängel, Wartung, Konfiguration, Anhänge,
Frontplatten — öffnet im selben Editor (*Werkzeuge → Berichts-Editor…*):

- **Spalten** ein- und ausblenden, umsortieren
- **gruppieren**, nach mehreren Spalten **sortieren**, je Spalte **filtern**
- **Vorlagen** für dieses Projekt oder für alle Projekte speichern

Die Vorschau ist der Export: Bildschirm, CSV und Druck kommen aus demselben
Ergebnis.

**Patch-Liste** (*Werkzeuge → Patch-Liste…*): eine Zeile je Netzwerkschnittstelle,
vom Geräteanschluss über jedes Patchfeld (mit beiden Portnummern) bis zum
Switch-Port, mit IP, Subnetz, Gateway, MAC und VLAN. Erreicht ein Weg keinen
Switch, nennt die Zeile den Grund.

## 15. Export und Übergabeunterlagen

![Export-Zentrale](../screenshots/export.png)

- **Datei → Exportieren & Drucken…**: PDF, PNG, JPEG, SVG mit Ebenenfilter.
- **Patch-Blätter je Gerät** mit Standort und dem anderen Ende jedes Kabels.

![Patch-Blätter](../screenshots/patch-sheets.png)

**Werkzeuge → Festinstallation: Doku & Übergabe…**:

| Unterlage | Format |
|---|---|
| Zugliste, Auflegeliste, Kabelplan, Stückliste mit Reserve, Anlagenverzeichnis | CSV / PDF |
| Signalwege, Hausleitungsbelegung | CSV |
| Trassenplan je Etage | HTML, A4 quer |
| Durchbrüche (Brandschutz) | CSV |
| Abnahmeprotokoll mit Mängeln, offenen Punkten und Unterschriftsfeld | HTML |
| Wartungsplan | CSV |
| Konfigurationseinstellungen je Schnittstelle | CSV |
| Gerätekarten, Bedienübersicht, Kamerapositionen | HTML |
| Anhangsverzeichnis mit Prüfsummen | CSV |
| QR-Etiketten für Kabel und Geräte | Druck |

**Gerätedatenblatt** (Geräteeigenschaften → *Druck / Dokumentation*): eine
A4-Seite je Gerät mit Foto und den angehakten Eigenschaften. Für mehrere
Geräte: *Export → Patch-Blätter → Datenblätter*.

**Anhänge** (Desktop-App): Prüfprotokolle, Handbücher und
Konfigurationssicherungen, an ein Kabel, ein Gerät oder die Anlage gehängt.
Die Dateien landen im Ordner `Anhaenge` neben dem Projekt.

Jede exportierte CSV endet mit einem Spaltenglossar.

## 16. Vor Ort: Telefon, Bestandsaufnahme, Etiketten

- **Telefonzugang**: am Aufbautag den QR-Code scannen — ohne Installation,
  ohne Konto. **Nur lesen** oder **Mitschreiben** wählen. Mitschreibende
  Telefone haken Arbeiten ab, tragen gezogene Kabel nach, melden Änderungen und
  schicken Fotos; alles kommt zurück in den Plan. Braucht die Desktop-App im
  selben Netz.
- **Fotos** hängen an einem Gerät, einem Kabel oder am Projekt und reisen in
  der Projektdatei mit.
- **Bestandsaufnahme** (*Werkzeuge → Bestandsaufnahme (Vorhandenes
  erfassen)…*): durch eine bestehende Anlage gehen und Gerät, Raum, Verbindung
  und Notiz tippen — Enter, weiter. Jeder Eintrag wird ein unfertiges Gerät;
  der Plan-Check fragt nach dem Fehlenden.
- **Etikettenbögen und QR-Etiketten** für Kabel und Geräte.
- **Web-Viewer** (nur lesen) für alle, die die App nicht haben.

## 17. Zusammenarbeiten: Live-Sitzung und Cloud

### Live-Sitzung

- Gleichzeitiges Bearbeiten über WebRTC; kein Server hält den Plan.
- Beitreten per **Einladungslink** oder offene Sitzungen im LAN finden.
- Ein **Raumpasswort** verschlüsselt die Sitzung Ende zu Ende.
- Über Netzgrenzen verbindet das Standard-Relay `wss://relay.zumpelars.de`;
  eigenes Relay und STUN/TURN sind möglich
  ([eigenes Relay](../self-hosted-relay.md)), ebenso der Modus **nur lokal**.
- Rückgängig nimmt die eigenen Änderungen zurück, nicht die der anderen.

### Cloud-Kopie mit Revisionen

*Datei → Cloud & Lese-Link…* (braucht ein Konto der Gerätebibliothek,
Kapitel 18).

- Die eigene Datei bleibt das Original; die Cloud hält eine Kopie mit Verlauf.
- Jedes Speichern ist eine Revision — automatisch 30 s nach der letzten
  Änderung oder mit **Jetzt in die Cloud speichern**. Jede Revision lässt sich
  wiederherstellen.
- Parallele Änderungen von einem anderen Gerät werden zusammengeführt, nie
  überschrieben.
- Zugangsdaten bleiben auf dem Rechner. **Aus der Cloud löschen** entfernt das
  Projekt mit allen Revisionen.

## 18. Gerätebibliothek

Der gemeinsame Gerätekatalog der Planner-Suite:
**[devices.zumpelars.de](https://devices.zumpelars.de)**.

1. Konto auf der Website anlegen, E-Mail-Adresse bestätigen, Richtlinien
   annehmen.
2. Unter *Einstellungen → Gerätebibliothek* anmelden (E-Mail oder
   Benutzername, Passwort, bei Bedarf Zwei-Faktor-Code).
3. **Aus der Gerätebibliothek aktualisieren** holt, was sich seit dem letzten
   Abgleich geändert hat. Die Geräte bleiben offline verfügbar.
4. Eigene Vorlagen werden bei Anmeldung automatisch hochgeladen (**Eigene
   Geräte automatisch hochladen**) oder mit **Jetzt synchronisieren**.
   *Meine Geräte* zeigt den Stand jeder Vorlage: nicht hochgeladen, wartet auf
   Moderation, live, gesperrt mit Gründen.

**Vorlagen einreichen**: in der Bibliothek *+ → Vorlagen einreichen…* prüft die
eigenen Vorlagen zuerst. Pflicht: ein Datenblatt-Link sowie Steckertyp und
Beschriftung an jedem Anschluss. Die Leistungsaufnahme ist freiwillig.
Vorlagen, die nicht bestehen, stehen mit Grund in der Liste und werden nicht
gesendet.

## 19. Import und Austausch

| Quelle | Was kommt herein |
|---|---|
| **Rentman** | Projekte, Equipment, Kategorien (Auswahl) |
| **NetBox** | Racks, Geräte, Kabelwege |
| **GraphML / yEd** | Diagramme, mit Vorschau |
| **MultiCam-Planner** (`.cameras.json`) | Kameras mit Anschlüssen, Objektiv, Brennweite, Position und PTZ-Presets; erneuter Import gleicht ab statt zu verdoppeln |
| **`.avplan`** | gemeinsames Austauschformat der Planner-Suite |
| **Venue** (`venue-exchange`) | Hallenplan mit Maßstab aus MultiCam- / Light-Planner |
| **Gebäudeangaben** (`.avfacility`) | Steckdosen, Kabelwege, Etagen, Hausleitungen und Steueradressen aus dem Facility-Planner |
| **Green-GO** | Intercom-Export `.gg5` und eine herstellerneutrale Intercom-Datei |
| **Racks fürs Lager** | `rack-belegung.json` für den Inventory-Planner |

API-Schlüssel liegen im Schlüsselspeicher des Betriebssystems (macOS-
Schlüsselbund, Windows-Anmeldeinformationsverwaltung, libsecret), nie in der
Projektdatei.

**Lager / Bestand** (*Werkzeuge → Lager / Bestand…*): Lagerbestand mit
Lagerorten, Seriennummern und Mengen, abgeglichen mit dem Bedarf des Plans.

## 20. Claude (MCP)

Claude beantwortet Fragen zum offenen Plan — Geräte, Anschlüsse, Signalwege,
Kabel und Plan-Check.

**Auf diesem Rechner**

1. *Einstellungen → MCP* → einschalten. Der Server hört nur auf `127.0.0.1` und
   nutzt ein Kopplungs-Token aus dem Schlüsselbund.
2. Den dort angezeigten Befehl kopieren, zum Beispiel:

   ```
   claude mcp add --transport http cable-planner http://127.0.0.1:<port>/mcp --header "Authorization: Bearer <token>"
   ```

3. Standard ist Lesen. **Schreiben** ist ein zweiter Schalter: Claude kann dann
   Kabel verbinden und entfernen, Kabelangaben setzen und Geräte umbenennen.
   Jeder Aufruf ist ein Rückgängig-Schritt und steht unter **Was Claude
   geändert hat**.

**Von claude.ai, vom Telefon oder einem anderen Rechner**

1. Projekt in die Cloud legen (*Datei → Cloud & Lese-Link…*).
2. In claude.ai: *Settings → Connectors → Add custom connector* mit
   `https://devices.zumpelars.de/mcp`, dann mit dem Konto der
   Gerätebibliothek anmelden.
3. Nur lesend, nur über die eigenen Cloud-Projekte. Trennen unter *Konto →
   Sicherheit → Verbundene Apps* auf devices.zumpelars.de.

Schaltbefehle für ATEM oder Videohub werden nie angeboten.

## 21. Web-Ausgabe und Tablet

- **https://larszu.github.io/cable-planner/** öffnen und zum Home-Bildschirm
  hinzufügen; sie läuft dann im Vollbild mit eigenem Symbol.
- Touch: Spreizen zoomt den Plan, zwei Finger verschieben, **lange drücken**
  öffnet das Kontextmenü.
- Im Browser nicht verfügbar (kein Socket, kein offener Port, kein
  Schlüsselbund): ATEM, Videohub, NetBox, LAN-Abgleich, Telefonzugang,
  MCP-Server, Show-Control, Schalten, Tally-Pi, Rentman-Export,
  Update-Prüfung. *Einstellungen → Integrationen* listet sie mit Grund.

## 22. Daten, Sicherheit und Fehlerbehebung

- **Projekte**: lokale JSON-Dateien, atomar geschrieben mit Sicherungskopie.
- **App-Daten** (Bibliothek, letzte Projekte, Einstellungen) liegen im
  App-Datenordner `Cable Planner`.
- **Geheimnisse** (API-Schlüssel, Stream-Zugangsdaten, Anmeldung der
  Gerätebibliothek) liegen im Schlüsselbund des Betriebssystems. Die
  Web-Ausgabe hält die Anmeldung der Gerätebibliothek im Browserspeicher.
- **„Keine Sicherungskopie"** in der Statusleiste: Projekt in eine Datei
  speichern.
- **Keine Standbild-Vorschau**: ffmpeg installieren und prüfen, ob das Gerät im
  lokalen Netz ist.
- **Gerätebibliothek nicht erreichbar**: die App arbeitet mit den Geräten des
  letzten Abgleichs weiter.

Fragen und Fehlermeldungen:
[GitHub Issues](https://github.com/larszu/cable-planner/issues).

---

© 2026 Lars Zumpe Medienproduktion · kostenlos nutzbar, proprietär lizenziert
