## Werkzeuge

Das Menü *Werkzeuge* enthält Spezialtasks zum Planen und Bauen von Systemen: Kabel verbinden, Racks aufbauen, LED-Wände konfigurieren, Schaltpläne exportieren und Geräte wie ATEM-Mischer und Videohub steuern.

### Patchliste

*Werkzeuge → Patch-Liste…*

![Patchliste Dialog](bilder/de/werkzeuge-bauen-patchlist.jpg)

Zeigt alle Verbindungen des Plans in tabellarischer Form — jedes Kabel eine Zeile, sortiert für die Patch-Reihenfolge am Set. 

**Spalten:** Nr., Von Gerät, Port, Nach Gerät, Port, Typ, Länge (m), Farbe.

**Layer-Filter:** Über das Dropdown oben wählen Sie, welche Schicht angezeigt wird (z. B. nur Video). Das Feld zeigt, wie viele Kabel insgesamt zu sehen sind.

**Suchfeld:** Filtert nach Gerät, Port, Typ oder Farbe — die Suche läuft in Echtzeit.

**Export-Optionen:**
- **CSV exportieren:** Kommagetrennte Datei für Tabellenkalkulationen.
- **XLSX exportieren:** Excel-Format.
- **Etiketten + QR (PDF):** Druckvorlage für Beschriftung. Wählt man einen Etikett-Typ (Generisch, Brother P-touch, Dymo), wird zusätzlich die entsprechende Exportdatei angeboten.

### Patch-Reihenfolge
Kabel werden nach ihrer Position auf dem Set sortiert — zuerst die Quellen (oben), dann die Ziele (unten). Das erlaubt, die Patchliste am Mischpult auszudrucken und Zeile für Zeile abzuarbeiten.

---

### LED-Wand

*Werkzeuge → LED-Wand…*

Definiert Panels, Auflösung, Gewicht und Leistung einer LED-Wand und generiert die Pixel-Map für den Media-Server.

**Felder:**
- **Panel-Typ:** Hersteller und Modell (z. B. Barco E22 Full HD, Unilumin LED-Panel).
- **Auflösung:** Breite × Höhe in Pixeln.
- **Panel-Größe:** Physische Abmessungen in mm (wird vom Datenblatt vorgegeben).
- **Anzahl Panels:** Horizontal × Vertikal (errechnet Gesamtgewicht und Leistung).
- **Helligkeit:** Nits (für die Planung der Kühlanlage relevant).
- **Blickwinkel:** Horizontal und vertikal, in Grad.

**Pixel-Map:** Nach dem Speichern können Sie die Pixel-Map im CSV- oder JSON-Format exportieren — für die Media-Server-Konfiguration (vPro, Notch, …).

---

### Frontplatten-Editor

*Werkzeuge → Frontplatten-Editor…*

Positioniert Buchsen auf einer Frontplatte (Wandfeld, Bühnenkiste) im Millimeter-Raster und druckt 1:1-Streifen zum Anbringen oder Fräsen.

**Arbeitsweise:**
1. Wählen Sie das Equipment (z. B. eine Wandplatte).
2. Positionieren Sie Buchsen per Drag & Drop oder durch Eingabe der (X, Y)-Koordinaten.
3. Definieren Sie Beschriftungen, Zonen und Farbcodes.
4. Drucken Sie den Streifen in voller Größe — zum Aufkleben, als Fräsvorlage oder für die Überprüfung am Set.

**Reiter/Funktionen:**
- **Layout:** Übersicht und Positionierung der Buchsen.
- **Beschriftung:** Labels und Legende.
- **Druck:** 1:1-Druckvorschau, Papierformat, Ränder.

---

### Berichts-Editor

*Werkzeuge → Berichts-Editor…*

Passt jede exportierbare Liste an (Kabel-BOM, Geräte, Lager): Spalten wählen oder verbergen, Gruppierung, Sortierung, Filter, und speichern als Vorlage für spätere Exporte.

**Reiter:**
- **Spalten:** Aktivieren/Deaktivieren der Spalten — die Liste wird mit den gewählten Spalten exportiert oder ausgedruckt.
- **Gruppieren:** Nach Feld sortieren (z. B. Nach Gerättyp).
- **Sortieren:** Primäre und sekundäre Sortierreihenfolge.
- **Filter:** Zeigen nur Zeilen, die eine Bedingung erfüllen (z. B. nur Kabel > 50 m).

Nach dem Speichern bleibt die Vorlage erhalten — der nächste Kabel-Export nutzt diese Einstellung.

---

### Adern und Farbnormen

*Werkzeuge → Adern und Farbnormen…*

Zeigt Steckerbelegungen und Farbcodes für alle unterstützten Stecker (XLR, HDMI, DB25, DMX, …) — zum Nachschlagen, für das Anlöten von Kabeln und zur Dokumentation.

**Struktur:**
- **Stecker auswählen:** Dropdown mit allen Typen (Cinch, XLR, BNC, Klinke, Speakon, …).
- **Belegung:** Grafik oder Tabelle mit Kontakt-Nummer, Name, Farbe und Funktion.
- **Standard:** Zur Information (z. B. IEC 60268-12 für XLR Audio).

Nutzen Sie dieses Werkzeug, um Kabel anzulöten oder um Verwechslungen bei der Wartung zu vermeiden.

---

### Empfangene Show-Control-Nachrichten

*Werkzeuge → Empfangene Show-Control-Nachrichten…*

Protokolliert alle OSC-, MIDI- und andere Show-Control-Botschaften, die die Planner-App empfangen hat (aus einem Ablauf-System, einer Kamera-Fernbedienung, etc.). Eine Lesart, keine System-Konfiguration — zeigt, was kam, aber speichert es nicht.

**Spalten:** Uhrzeit, Befehl, Quelle, Parameter, Status.

**Nutzung:** Zum Testen von Integrationen oder zum Verfolgen von Fernsteuerungs-Vorgängen während einer Probenaufzeichnung.

---

### Mehrere Kabel verbinden

*Werkzeuge → Mehrere Kabel verbinden…*

Erstellt N Kabel auf einmal — Quelle-Port i → Ziel-Port i. Belegte Ziel-Ports werden übersprungen.

![Mehrere Kabel verbinden Dialog](bilder/de/werkzeuge-bauen-mehrere-kabel.jpg)

**Felder:**
- **QUELLE:** Gerät und Seite (Outputs/Inputs) + Start-Port-Nummer.
- **ZIEL:** Gerät und Seite (Inputs/Outputs) + Start-Port-Nummer.
- **Anzahl Kabel:** Wie viele Verbindungen erstellt werden.
- **Kabel-Typ:** Aus einer Dropdown (XLR Audio, SDI 3G, HDMI, Dante, DMX, Power, …).
- **Länge pro Kabel (m):** Wird auf alle Kabel übernommen (später einzeln änderbar).

**Vorschau:** Zeigt, welche Kabel entstehen, bevor Sie bestätigen. Belegte Ziele werden übersprungen — bei „0 Kabel erstellen" sind alle Ziel-Ports bereits belegt.

---

### Neues Rack erstellen

*Werkzeuge → Neues Rack erstellen…*

Startet einen Assistent zum Aufbau eines neuen Racks oder einer Regalanlage. Sie definieren:

1. **Racktyp:** 19" Standard, Grundriss-Feld oder Freistellung (z. B. Standregal).
2. **Größe:** Höhe in HE, Tiefe in mm.
3. **Material & Farbe:** Gehäuse, Seitenwand.
4. **Position im Plan:** Raum und Koordinaten.

Das neue Rack wird im Plan eingefügt und kann sofort mit Geräten gefüllt werden.

---

### Rack-Builder

*Werkzeuge → Rack-Builder…*

Populiert und bearbeitet Racks — platziert Geräte im Gehäuse, definiert Kabelwege und exportiert STL/3D-Modelle zum Visualisieren oder Fräsen.

![Rack-Builder Dialog](bilder/de/werkzeuge-bauen-rack-builder.jpg)

**Arbeitsweise:**
1. Wählen Sie ein Rack aus dem Plan (oder erstellen Sie eines über „Neues Rack erstellen").
2. Ziehen Sie Geräte aus der Gerätebibliothek in freie HE-Positionen.
3. Verbinden Sie Rückseiten (A/B) und definieren Sie Kabelwege.
4. Speichern — das 3D-Modell wird aktualisiert.

**Reiter:**
- **Übersicht:** Rack mit eingebauten Geräten (Vorder- und Rückseite wählbar).
- **3D-Ansicht:** Perspektivisches Modell zum Visualisieren von Kabelwegen und Platzbedarf.
- **Kabelwege:** Liste der Verbindungen im Rack mit Längen und Wegen.
- **Export:** STL für 3D-Druck, PDF für technische Zeichnungen.

---

### KI-Plan generieren

*Werkzeuge → KI-Plan generieren…*

Generiert einen Entwurf für einen Kabelprojekt anhand einer Textbeschreibung — z. B. „Live-Konzert, 3 Kameras, ATEM 2 M/E, Multiviewer, Ton auf Dante". Die KI erstellt Geräte, Verbindungen und Grundriss basierend auf Standardvorlagen.

![KI-Plan-Generierung Dialog](bilder/de/werkzeuge-bauen-ki-plan.jpg)

**Voraussetzung:** Ein API-Key für einen KI-Anbieter (OpenAI, Anthropic, …) in den Einstellungen → AI hinterlegt.

**Arbeitsweise:**
1. Beschreiben Sie das System in Klartext.
2. Klicken Sie „Generieren".
3. Eine Vorschau wird angezeigt.
4. Bestätigen Sie, um sie in den Plan einzufügen.

Das Ergebnis ist ein erster Entwurf — keine vollständige Planung. Sie ergänzen Geräte, ändern Verbindungen und gleichen mit der Realität ab, wie üblich.

---

### Revisionen & Snapshots

*Werkzeuge → Revisionen & Snapshots…*

Speichert Snapshots des Plans — zum Dokumentieren von As-Built-Ständen, zum Vergleich mit früheren Versionen oder zum Archivieren.

![Revisionen & Snapshots Dialog](bilder/de/werkzeuge-bauen-revisionen.jpg)

**Arbeitsweise:**
1. Geben Sie einen Namen ein (z. B. „As-Built", „Technische Abnahme").
2. Klicken Sie „Festschreiben" — ein kompletter Snapshot wird gespeichert.
3. Revisionen sind unveränderlich — Sie können Sie nicht später bearbeiten.
4. Zum Wiederherstellen: Wählen Sie eine Revision und klicken „Wiederherstellen".

**Unterschied zu Undo:** Revisionen sind absichtlich aufbewahrte Meilensteine. Undo ist ein temporärer Puffer für die aktuelle Arbeitssitzung.

**Reiter:**
- **Snapshots:** Liste aller Revisionen mit Datum, Benutzer und Beschreibung.
- **Vergleich:** Zeigt die Unterschiede zwischen zwei Revisionen (neuen Geräten, geänderten Kabeln, …).

---

### Lager / Bestand

*Werkzeuge → Lager / Bestand…* (nur mit aktiviertem Rental-Modul)

Verwaltet die Lagerhaltung — verfügbare Geräte, Verbrauchtes, Beschädigtes — wenn Ihre Firma Geräte vermietet oder lagert.

**Reiter:**
- **Bestand:** Aktuelle Menge jedes Geräts (verfügbar, vermietet, Wartung).
- **Transaktionen:** Zu- und Abgänge mit Datum und Grund.
- **Verfügbarkeit:** Zeigt, ob alle Geräte des Plans lagern (zum Reclassify zur Verfügung stellen oder nachbestellen).

Dieses Werkzeug ist optional und wird durch ein Modul aktiviert, das Sie in Einstellungen → Module einschalten müssen.

---

### ATEM Multiviewer-Layout

*Werkzeuge → ATEM Multiviewer-Layout…* (nur wenn ein ATEM-Mischer im Plan)

Konfiguriert, welche Quellen auf dem Multiviewer angezeigt werden — Position, Größe und Ausreißer (z. B. Lautstärke-Meter).

**Vorbedingung:** Der Plan muss einen Blackmagic ATEM Mischer enthalten. Das Werkzeug zeigt seinen aktuellen Multiviewer-Zustand und erlaubt, ihn zu ändern — Reiter, Layouts, Eingänge.

**Nutzen:** Zum Visualisieren, wie der Operator die Quellen sieht, und zum Export der Konfiguration in das Mischer-Skript.

---

### ATEM Audio-Routing

*Werkzeuge → ATEM Audio-Routing…* (nur wenn ein ATEM-Mischer im Plan)

Definiert Audio-Eingänge, Mixing und Ausgänge des ATEM-Mischers — Dante-In zu welchen Kanälen, Mic-Input-Verstärkung, welche Master-Ausgabe wohin.

**Struktur:**
- **Eingänge:** Dante, AES/EBU, Mikro mit Verstärkung.
- **Mixing:** Kanalmute, Fader, Pan.
- **Ausgänge:** Monitor, Multiviewer, Codec, etc.

Dieses Werkzeug exportiert ein ATEM-Konfigurationsskript, das der Operator am Mischer laden kann — wenn die Hardware diesen Weg unterstützt.

---

### ATEM Input-Labels

*Werkzeuge → ATEM Input-Labels…* (nur wenn ein ATEM-Mischer im Plan)

Beschriftet die Eingänge des ATEM-Mischers — Name, Anzeige-Optionen, Ausreißer (z. B. nur Sicherungs-Feed zeigen).

**Verfahren:**
1. Ordnen Sie jeden ATEM-Eingang einem Gerät zu (z. B. Eingang 3 ← „Kamera 1 HD").
2. Geben Sie einen angezeigten Namen ein (max. 20 Zeichen für die ATEM-Anzeige).
3. Wählen Sie Optionen (Farbe, Symbole, …).

Die Beschriftung wird beim Export in die ATEM-Konfiguration übernommen.

---

### Videohub-Routing / Labels

*Werkzeuge → Videohub-Routing / Labels…* (nur wenn ein Blackmagic Videohub im Plan)

Konfiguriert den Videohub — Eingangs- und Ausgangs-Konfiguration, Routing, Labels.

**Reiter:**
- **Routing:** Zeigt alle Crosspoints (Eingang X → Ausgang Y).
- **Labels:** Beschriftet Ein- und Ausgänge.
- **Sicherung:** Optionen für Rekonfiguration unter Last.

Dieses Werkzeug exportiert eine Konfiguration im Videohub-Export-Format (CSV/JSON), die in das Gerät hochgeladen wird — z. B. nach einer Änderung vor Ort.

---

### GreenGo-Intercom

*Werkzeuge → GreenGo-Intercom…* (nur wenn eine GreenGo-Anlage im Plan)

Zeigt die Intercom-Konfiguration der GreenGo-Headset-Anlage — Kanäle, Matrix, Prio, Routing. Ein reines Anzeige-Werkzeug — Änderungen müssen in der GreenGo-Netzwerk-Konfiguration vorgenommen werden.

**Ansicht:**
- **Kanäle:** Name, Netzwerk-Adressen, Gruppenteilnahme.
- **Kopfhörer:** Assigned Channels pro Ohr.
- **Paging & Gates:** Sprechgruppen mit Prioritäten.

Nutzen Sie dieses Werkzeug zur Dokumentation und zur Überprüfung, dass die Routing-Logik mit dem Kabelprojekt übereinstimmt.

---

### Hinweise

- Viele dieser Werkzeuge (ATEM, Videohub, GreenGo, LED-Wand) erscheinen nur im Menü, wenn die entsprechenden Geräte im aktuellen Plan vorhanden sind. Leere Menüpunkte sind absichtlich — es gibt in diesem Plan nichts zu konfigurieren.
- Alle Exporte (PDF, CSV, STL, JSON) folgen dem Projekt-Dateinamen, um Verwechslungen zu vermeiden.
- Einige Werkzeuge speichern Vorlagen (z. B. Bericht-Editor, Rack-Vorlagen) — diese bleiben über Projekte hinweg erhalten.
