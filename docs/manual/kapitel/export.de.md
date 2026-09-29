## Exportieren und Drucken

Der Export-Bereich ist die Zentrale für alle Ausgaben: Pläne als PDF/Bild, Patchlisten, Stücklisten, Cloud-Speicherung und spezialisierte Doku für Festinstallationen. Hier entsteht jedes Blatt, das den Plan verlässt.

### Patchliste

*Datei → Werkzeuge → Patchliste…*

![Patchlisten-Dialog](bilder/de/export-patchliste-dialog.jpg)

Tabelle aller Kabel im Plan — eine Zeile je Kabel mit Quell- und Zielgerät, Port, Kabeltyp, Länge und Farbe. Speziell für den Techniker im Feld, der jedes einzelne Kabel legen muss, nicht für Planabstraktionen wie Stücklisten.

**Spalten:**
- **Nummer**: Kabelnummer (leer wenn keine vergeben)
- **Quelle** → **Ziel**: Gerätename und Port
- **Typ**, **Länge**: Kabelspezifikation
- **Farbe**: Markierung des Kabels
- **Multicore**: Bündel-Name (wenn Teil einer Schlange/Snake)
- **Faser**: Bei Lichtwellenleitern die Faser-Nummer und -Rolle (TX/RX)
- **Ebene**: Video, Audio, Steuerung, Netzwerk, Strom, Sonstiges

**Filter & Sortierung:**
- Nach Ebene filtern (z. B. nur Video-Kabel zeigen)
- Nach Quell-Gerät, Ziel-Gerät, Kabeltyp, Länge oder Farbe sortieren
- Freitext-Suche über alle Spalten

**Export-Formate:**
- **CSV**: Tabellarisch, zur Bearbeitung in Excel oder als Druckvorlage
- **Etikettenformat**: CSV für Etikett-Drucker-Software (Generic, Brother, Dymo); enthält Angaben wie Quellport, Zielport und Kabellänge in dem Format, das die Drucker-Software erwartet
- **PDF Etiketten + QR**: Kleine Sticker pro Kabel mit QR-Code (zur Verfolgung) und gedruckten Angaben; A4 oder Rollen-Format
- **PDF Patchliste**: Die Tabelle als ein druckbares PDF — eine Seite pro Gerät mit dessen Kabelzuordnungen

### Festinstallation: Doku & Übergabe

*Datei → Werkzeuge → Festinstallation: Doku & Übergabe…*

Doku-Zentrale für Installateure und Betreiber. Jeder Reiter erzeugt ein eigenständiges CSV- oder PDF-Ausgabedokument für einen Aspekt der Festinstallation.

Die Reiter:

**Übersicht** — Checkliste zur Installationsvorbereitung:
- Installer-Listen: Pull-Liste (wer zieht was mit), Termination-Liste (wo werden Stecker aufgelöst), Zeitplan (Reihenfolge der Arbeitsschritte), Kabel-Stückliste (Typ+Länge zusammengefasst)
- Betriebs-Asset-Register: Geräte-Inventar mit Seriennummern und Lagerort
- Änderungsprotokoll: Wer hat wann welche Änderung eingetragen; kann geleert werden

**Handover-Paket** — Markdown-Manifest aller Unterlagen mit Versionsstand und QR zum Nachverfolgung:
- Umfasst automatisch alle Blätter: Installateur-Listen, Technische Doku, Signalwege, …
- Jedes Blatt trägt seinen Stempel (Revision + Datum)

**QR & Asset-IDs** — Markierung der Ausrüstung:
- Auto-Nummern für Geräte und Kabel vergeben (falls noch nicht geschehen)
- QR-Etikett-PDF erzeugen zum Aufkleben

**Bearbeiter-ID** — Name des Installateurs/Technikers (steht in jedem Protokoll-Eintrag als Autor)

### Stage Plot

*Datei → Werkzeuge → Stage Plot (SVG)…*

Draufsicht des Plans als **SVG** (Vektor-Grafik): nur die Geräte, keine Kabel, Vogelperspektive auf die Bühne/den Saal. Ideal zum Ausdrucken oder für technische Zeichnungen.

### Exportieren & Drucken

*Datei → Exportieren & Drucken…*

![Export-Dialog Übersicht](bilder/de/export-dialog-plan.jpg)

Zentrale Export-Dialog mit sieben Reitern für alle Ausgabe-Formate. Alle Aktionen sind nicht-destruktiv — keine Änderung am Plan selbst.

#### Reiter: Plan

Den Canvas-Plan als **PDF, PNG, JPEG, SVG oder DXF** exportieren.

**PDF (Raster):**
- Klassischer Raster-PDF (JPEG-Snapshot des Plans)
- Mit Titelblock: Projektname, Revision, Änderungs-Fingerprint, QR-Code
- Druckfertig, Text wird bei hohem Zoom unscharf

**PDF (Vektor, Beta):**
- Chromium printToPDF — Text bleibt selektierbar und scharf bei jedem Zoom
- Kleinere Dateigröße
- **Keine Titelblock** — Revision, Fingerprint und QR stehen nur im Raster-PDF

**PNG, JPEG:**
- Bitmap-Formate für E-Mail, Slack, Webseiten
- PNG: transparent möglich, scharf bei kleinen Flächen
- JPEG: komprimiert, kleinere Dateien

**SVG:**
- Vektorgrafik für Web und weitere Bearbeitung; alle Elemente bleiben selektierbar

**DXF:**
- CAD-Format für Plotter und Desktop-Planer
- Geräte, Kabel und Text auf separaten Ebenen

**Optionen:**

- **PDF-Thema**: Dunkel (wie Canvas) oder Hell (empfohlen für Druck)
- **Monochrom-sicher**: Text der Ebene auf jedem Kabel drucken statt Farben — für Schwarzweiß-Drucker, wo Videokabel sonst nicht von Audiokabeln zu unterscheiden sind
- **Render-Mode** (nur Vektor-PDF):
  - Raster (Classic): JPEG-Snapshot, zuverlässig, aber Text unscharf bei Zoom
  - Vektor: Chromium printToPDF, Text scharf, kleinere Datei, aber kein Titelblock
- **Seitengröße** (nur Vektor-PDF): Auto (A0-compat), A4–A0+, Original (volle Canvas-Größe für Plotter)
- **Ebenen**: Welche Kabeltypen (Video, Audio, Steuerung, Netzwerk, Strom, Sonstiges) in die PDF einbezogen werden; Auswahl ist synchron mit der Canvas-Ansicht

#### Reiter: Patch-Sheets

Pro ausgewähltem Gerät eine Port-Belegungs-Liste — ideal zum Aufkleben am Gerät.

- **Geräte auswählen**: Haken neben jedem Gerät setzen oder "Alle wählen"
- **Format wählen**: A4 oder A3 (wird nach dem Klick abgefragt)
- **Aktion**:
  - "PDF herunterladen": alle ausgewählten Geräte in eine PDF
  - "Drucken": sofort an den OS-Drucker
  - "Etikett-CSV": kompakte Tabelle als CSV (eine Zeile pro Gerät statt ganzer Seite)

#### Reiter: Kabel-Stückliste (BOM)

Alle Kabel zusammengefasst nach Typ und Länge — zur Bestellung.

- **Tabelle**: Kabeltyp + Länge, Menge, Rentman-Planung (editierbar)
- **Export**:
  - CSV: für Excel-Bearbeitung
  - PDF: druckfertig mit Rentman-Spalte
- **Rentman-Integration**: Falls die Gerätebibliothek mit Rentman verknüpft ist, können Ausgabemengen und Preise direkt übernommen werden

#### Reiter: Geräte-Stückliste

Was der Plan an Geräten braucht — gedeckt durch Bestand (Lager)?

- **Drei Zustände pro Gerät**:
  - Grün (Gedeckt): Gerät ist im Lager bekannt (über Katalog-Identität)
  - Orange (VORSCHLAG): Namenstreffer — nur die Vermutung, dass es das richtige Gerät ist; wartet auf Bestätigung
  - Rot (Nicht im Lager): Gerät nicht im Bestand
- **Kommissionier-Liste**: nur die grünen Geräte, nach Lagerort sortiert — die Liste, die der Techniker zum Packen mitnimmt

#### Reiter: Racks & Gruppen

Gespeicherte Racks und Gruppen einzeln als PDF exportieren.

- Liste aller Racks und Gruppen im Plan
- **Pro Rack**: eine Patch-Seite je enthaltenem Gerät, zeigt die interne Verkabelung
- Aktion: "PDF herunterladen" oder "Drucken"

#### Reiter: Tally-Karte

Die Kette Rolle (Show-Position) → Gerät (z. B. Kamera) → Mischer-Eingang → UMD-Adresse (Texteinblendung auf dem Multiviewer).

Aus dem Plan abgeleitet und geprüft. Ideal zum gegenlesen oder zur Konfiguration der tally-pi-Hardware.

- **CSV**: zum gegenlesen (Mensch)
- **JSON**: für tally-pi-Konfiguration
  - (Anmerkung: GPIO-Pins der physischen Lampen gehören zur Hardware, nicht zum Plan)

#### Reiter: Unterlagen-Stapel

Mehrere Blätter als ein druckbarer Stapel: eine Seite je Blatt, Spaltenkopf auf jeder Folgeseite, Farbe und Format wählbar.

- **Blätter auswählen**: Haken neben jedem Blatt
- **Format**: A4, A3, A2, A1, A0
- **Farbmodus**: Farbe oder Schwarzweiß (jeder Eintrag bleibt lesbar)
- **Aktion**: "Drucken" oder "PDF herunterladen"
- Jedes Blatt trägt seinen Stempel (Revision + Datum) — später lässt sich ein Stapel gestempelter Blätter gegen den aktuellen Plan halten und überprüfen, ob noch alles gültig ist.

### Cloud & Lese-Link

*Datei → Cloud & Lese-Link…*

![Cloud-Dialog](bilder/de/export-cloud-dialog.jpg)

Plan in die Cloud speichern (optional), Revisionen verwalten, Lese-Link zum Öffnen in einem anderen Gerät erzeugen.

**Voraussetzung:** Anmeldung an der Gerätebibliothek (unter *Einstellungen → Gerätebibliothek*).

**Funktionen:**

- **Jetzt speichern**: Der aktuelle Plan wird als neue Revision in die Cloud hochgeladen
- **Revisionen**: Liste aller bisherigen Versionen (mit Änderungs-Fingerprint + Speicherzeitpunkt)
  - Eine Revision kann wiederhergestellt werden (sie wird zur neuen obersten)
  - Download: die Revision als .cp-Datei lokal speichern
- **Lese-Links**: Externe Betrachter öffnen den Plan im Web-Viewer (read-only), ohne sich anzumelden
  - Link erstellen: eigene Adresse eingeben
  - Link kopieren (für E-Mail, Slack, Dokumentation)
  - Link löschen (Zugriff widerrufen)
  - Verfallsdatum setzen (optional)
- **Andere Cloud-Projekte**: Existierende Cloud-Projekte anschauen, öffnen, herunterladen oder von der Cloud löschen

**Datenschutz:**
- Solange niemand „Jetzt speichern" drückt, verbleibt der Plan lokal.
- Der Server fragt die Anmeldung ab — die Dateikennung ist device-spezifisch, nicht datei-spezifisch.

### Export als Viewer-Datei

*Datei → Export als Viewer-Datei…*

Plan in das **`.cpviewer`-Format** exportieren. External Reviewer (Freelancer, andere Teams) können den Plan später im Web-Viewer öffnen, Anmerkungen einzeichnen und die Datei zurückmailen.

(Aktion: direkter Download; kein Dialog)

### Anmerkungen importieren

*Datei → Anmerkungen importieren…*

Eine `.cpviewer`-Datei mit Anmerkungen von einem Reviewer öffnen und die Markierungen / Kommentare in den aktuellen Plan mergen. Das ermöglicht einen Feedback-Workflow ohne direkte Cloud-Anbindung.

(Aktion: Datei-Dialog öffnen; kein Upload an den Server)

### Plan-Stände vergleichen

*Datei → Plan-Stände vergleichen…*

Zwei `.cp`-Dateien gegeneinander halten — z. B. die aktuelle Version gegen die Version von gestern, um Änderungen zu entdecken.

- Gerät hinzugefügt/gelöscht
- Kabel hinzugefügt/gelöscht/umgerouted
- Port-Umbenennung
- etc.

Unterschiede werden visuell hervorgehoben, Details in einer Tabelle.

### Ausgegebene Dokumente

*Datei → Ausgegebene Dokumente…*

Register aller Blätter, die bisher aus diesem Plan exportiert wurden. Warum? Damit sich ein Techniker morgen auf der Baustelle einen alten Ausdruck zu Hand nehmen und prüfen kann, ob er noch aktuell ist — oder ob der Plan seit damals gelaufen hat.

**Spalten:**
- **Zeitstempel**: Wann wurde es ausgegeben
- **Blatt**: Welches Blatt (Patchliste, Plan-PDF, BOM, …)
- **Änderungs-Fingerprint**: Eindeutige Kennung des Planstandes bei der Ausgabe
- **Revision** (wenn Cloud): Revisions-Nummer bei Upload in die Cloud
- **Bearbeiter**: Wer hat es ausgegeben (aus den Einstellungen)

Das Register ist Teil des Projekts und wird mit gespeichert.

---

© 2026 Lars Zumpe Medienproduktion · kostenlos nutzbar, proprietär lizenziert
