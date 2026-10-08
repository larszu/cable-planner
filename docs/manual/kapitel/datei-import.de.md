## Datei und Import

Das Menü *Datei* ist das zentrale Tor zum Projektmanagement: Projekte anlegen, öffnen, speichern, Import-Datenquellen, Export-Formate und die Zusammenarbeit mit externen Entwürfen.

### Neues Projekt

*Datei → Neu*

Öffnet das Formular *Neues Projekt* mit Projektname, Kunde und Logos. *Projekt anlegen* ersetzt den aktuellen Plan durch einen leeren. Enthält der aktuelle Plan schon Geräte, Kabel oder Orte, steht im Formular der Hinweis, dass ungespeicherte Änderungen verloren gehen.

Tastatur: `Strg+N`

### Neu aus Vorlage

*Datei → Neu aus Vorlage…*

Öffnet einen Dialog mit allen verfügbaren Vorlagen. Projektvorlagen sind vordefinierte Bausteine: Raum-Layouts, Standard-Geräte oder Verkabelungs-Muster, die als Grundlage für neue Entwürfe dienen. Der Dialog zeigt die Vorlagen themenweise gruppiert; ein Klick auf eine Vorlage erzeugt das neue Projekt.

![Vorlagen-Dialog](bilder/de/datei-import-templates.jpg)

### Öffnen

*Datei → Öffnen…*

Öffnet einen Datei-Dialog des Betriebssystems. Es werden Dateien mit den Endungen `.cableplan`, `.json` oder (beim Mergen von Anmerkungen) `.cpviewer` gelesen. Die ausgewählte Datei wird im aktiven Fenster geladen.

Tastatur: `Strg+O`

### Speichern

*Datei → Speichern*

Speichert das aktive Projekt unter seinem aktuellen Namen und Pfad. War das Projekt noch nie gespeichert, öffnet sich ein „Speichern unter"-Dialog. Die Datei trägt die Endung `.cableplan` und ist ein JSON-Dokument, das alle Projekt-Daten enthält: Geräte, Kabel, Einstellungen, Metadaten.

Tastatur: `Strg+S`

Bestandteile der `.cableplan`-Datei:
- Projektmetadaten (Name, Ersteller, Änderungsdatum)
- Alle Geräte und ihre Positionen
- Alle Kabel und deren Verbindungen
- Kategorien und benutzerdefinierte Geräte-Vorlagen
- Drucksettings und Rahmen-Anordnung
- Fotoanhänge (sofern vorhanden; ab etwa 40 MB wird eine `.cableplan` unhandlich zum Versand per E-Mail)

**Automatische Sicherungskopie:** Die App speichert regelmäßig automatisch und behält eine `.bak`-Datei neben der aktuellen Projektdatei. Dreht sich das Speichersymbol in der Statusleiste, wird gerade eine Kopie geschrieben.

### Speichern unter

*Datei → Speichern unter…*

Speichert das aktive Projekt unter einem neuen Namen oder an einem anderen Pfad. Die Originalversion bleibt ungeändert; die neue Datei wird als aktives Projekt geladen.

Tastatur: `Strg+Umschalt+S`

### Import yEd / GraphML

*Datei → Import yEd / GraphML…*

Importiert Verkabelungsentwürfe aus yEd (Grapheneditor der y.Works) oder beliebigen GraphML-Dateien. Der Dialog lädt eine `.graphml`-Datei, analysiert sie und zeigt eine Vorschau mit drei Reitern:

![GraphML-Import-Dialog](bilder/de/datei-import-graphml.jpg)

**Reiter 1: Geräte** — Listet alle erkannten Knoten auf. Die App versucht, Knotennamen gegen die Gerätebibliothek abzugleichen (HIGH = sicher erkannt, MED = möglicherweise, LOW = Lücke). Die Spalten sind:

| Spalte | Wirkung |
|---|---|
| ☐ (Kontrollkästchen) | Kontrollkästchen zum Auswahl/Abwahl von Geräten. Markiert: wird importiert |
| Name | Der Knotenname aus der yEd-Datei; kann manuell umbenannt werden |
| Kategorie | Die erkannte Gerätekategorie (z. B. Camera, Mixer); kann überschrieben werden |
| Vertrautheit | Farbkodierte Erkennungssicherheit (HIGH/MED/LOW) |

Funktionen:
- Einzelne Zeile anklicken und editieren, um Namen oder Kategorie zu ändern
- Mehrere Zeilen markieren; dann über die Dropdown-Liste oben eine Kategorie stapelweise zuordnen
- Der grüne Button **Alle auswählen** markiert alle Geräte; **Keine** demarkiert alle

**Reiter 2: Kabel** — Listet alle erkannten Verbindungen (Kanten zwischen Knoten).

| Spalte | Wirkung |
|---|---|
| ☐ (Kontrollkästchen) | Kontrollkästchen zum Auswahl/Abwahl von Kabeln |
| Von | Quell-Gerätename |
| Port | Quellenport (oder leer, wenn nicht spezifiziert) |
| Zu | Ziel-Gerätename |
| Port | Zielport (oder leer) |

Funktionen:
- Jedes Kabel kann einzeln ein- oder ausgeschlossen werden
- Gleiches Stapel-Verfahren wie bei Geräten (mehrere Zeilen, dann Aktion)

**Reiter 3: Übersprungen** — Zeigt alle Knoten oder Kanten, die nicht importiert werden können (z. B. Beschriftungen, reine Strukturknoten, nicht zugeordnete Kategorien). Die Liste dient der Fehlersuche: Was wurde ausgelassen und warum?

**Optionen:**
- **Anfügen** (Standard) — Die importierten Geräte und Kabel werden zum bestehenden Projekt hinzugefügt
- **Ersetzen** — Das gesamte Projekt wird durch die Import-Daten überschrieben

**Besonderheiten:**
- Knotenpositionen aus yEd werden übernommen (soft mapping auf das Cable-Planner-Koordinatensystem)
- Unbekannte Kategorien werden mit "unklar" gekennzeichnet und können manuell korrigiert werden
- Verbindungen ohne Geräte-Zuordnung werden als Fehler angezeigt

### Import MultiCam-Kameras

*Datei → Import MultiCam cameras…*

Importiert Kameradefintionen aus einer MultiCam-Kameraliste. Die Datei wird über einen Datei-Dialog des Betriebssystems ausgewählt. Das Format ist Text-basiert; die App prüft die Struktur und fügt erkannte Kameras zur Gerätebibliothek hinzu.

Der Dialog öffnet sich nicht — stattdessen wird direkt der Datei-Dialog angezeigt (verstecktes `<input type="file"`). Nach Dateiauswahl wird die Liste importiert und eine Bestätigung angezeigt.

### Import Equipment aus CSV

*Datei → Import Equipment aus CSV…*

Importiert Geräte-Kataloge aus einer CSV-Datei (Comma-Separated Values). Das Format ist flexibel: die Kopfzeile (Name, Kategorie, Leistung, Seriennummer, …) wird automatisch erkannt. Der Dialog unterstützt mehrsprachige Spaltennamen (DE/EN-Aliase).

![CSV-Import-Dialog](bilder/de/datei-import-csv.jpg)

**Ablauf:**

1. **Datei laden** — Klick auf *CSV-Datei wählen…* öffnet den Betriebssystem-Datei-Dialog
2. **CSV-Text eingeben/anpassen** — Der erkannte Text wird im Textbereich gezeigt und kann manuell editiert werden
3. **Vorschau** — Alle erkannten Spalten und deren Inhalte werden unten angezeigt; bekannte Spalten sind grün gekennzeichnet
4. **Stille Verluste sichtbar** — Die App zählt und zeigt:
   - Unbekannte Spalten (ignoriert beim Import)
   - Zeilen ohne Namen (übersprungen)
   - Doppelnamen (nur die erste Zeile wird importiert)
5. **Importieren** — Der grüne Button *0 importieren* zeigt die Zahl der neuen Geräte; ein Klick committet den Import

**Spalten-Aliase:**

| Deutsch | English | Wirkung |
|---|---|---|
| Name | Name | Gerätename (Pflicht) |
| Kategorie | Category | Gerätekategorie (z. B. Camera) |
| Leistung | Power | Stromaufnahme in Watt |
| Gewicht | Weight | Gewicht für Lastberechnung |
| Seriennummer | Serial number | Eindeutige Geräte-ID |

Die App merkt sich die Spalten-Zuordnung für nachfolgende CSV-Importe.

### Rentman-Import

*Datei → Rentman-Import…* (nur wenn die Rentman-Integration aktiviert ist)

Verbindet sich mit dem Rentman-Mietmanagement-System und lädt Geräte aus der Rentman-Klassifizierung als Gerätebibliothek in LZ Cable Planner. Der Dialog durchläuft mehrere Schritte:

**Schritte im Dialog:**

1. **Authentifizierung** — Gibt den Rentman-API-Token ein (gespeichert im OS-Credential-Store)
2. **Projektauswahl** — Listet alle Rentman-Projekte auf; der Nutzer wählt eines
3. **Kategorien-Zuordnung** — Rentman-Geräteklassen werden auf Cable-Planner-Kategorien abgebildet
4. **Vorschau** — Zeigt alle zu importierenden Geräte
5. **Import** — Bestätigung und Durchführung

Die Integration wird in den *Einstellungen → Integrationen* freigeschaltet. Der Workflow ist non-destruktiv: bestehende Geräte werden nicht überschrieben.

### NetBox-Import

*Datei → NetBox-Import…* (nur wenn die NetBox-Integration aktiviert ist)

Lädt eine Netzwerk-Infrastruktur-Inventarbild aus NetBox (IPAM/DCIM-System). Der Dialog ähnelt dem Rentman-Import: Authentifizierung, Inventar-Auswahl, Kategorien-Mapping, Vorschau und Import.

**Besonderheiten:**
- NetBox-Gerätetypen werden als Kategorien interpretiert
- Schnittstellenangaben (z. B. „SFP+") werden als Portnamen übernommen
- Die Integration wird in den *Einstellungen → Integrationen* freigeschaltet

### Gesamtprojekt exportieren

*Datei → Exportieren Gesamtprojekt (.avplan)…*

Speichert das Projekt im `.avplan`-Format — ein standortübergreifendes Austauschformat für AV-Planungssoftware. Das Format ist transparent (JSON) und enthält alle Projekt-Daten plus Metadaten für externe Werkzeuge (z. B. av-control-center).

Ein Klick öffnet einen Speichern-Dialog; der Standard-Dateiname ist `<Projektname>.avplan`.

### Gesamtprojekt importieren

*Datei → Importieren Gesamtprojekt (.avplan)…*

Lädt ein zuvor exportiertes `.avplan`-Projekt zurück. Das Projekt wird im aktiven Fenster geladen.

Ein Klick öffnet einen Öffnen-Dialog; Dateitypen sind `.avplan` und `.json`.

### Identitäts-Karte exportieren

*Datei → Exportieren Identitäts-Karte (.avsourcemap)…*

Die Identitäts-Karte ist eine Zuordnungstabelle zwischen internen Geräte-IDs (wie sie in Quellsystemen — z. B. ATEM-Videohub — referenziert werden) und den Geräteinamen im Cable-Planner-Plan. Die Datei dient dem Abgleich mit Hardware oder anderen Softwaresystemen.

Ein Klick öffnet einen Speichern-Dialog.

### Identitäts-Karte importieren

*Datei → Importieren Identitäts-Karte (.avsourcemap)…*

Lädt eine zuvor exportierte Identitäts-Karte zurück und wendet die Zuordnungen auf die aktuellen Geräte an.

Ein Klick öffnet einen Öffnen-Dialog.

### Verknüpfte Venue-Planung ansehen

*Datei → Verknüpfte Venue-Planung ansehen…*

Wenn das Projekt über das `.avplan`-Format mit einem Venue-Planungsprojekt (z. B. aus light-planner) verknüpft ist, kann dieser Dialog die verknüpfte Datei anzeigen. Diese Funktion dient der Koordination zwischen Kabel- und Venue-Planung.

### Projekt-Dateiformat: `.cableplan`

Die Projektdatei ist ein JSON-Dokument mit der Struktur:

```json
{
  "metadata": {
    "name": "Mein Projekt",
    "creator": "Max Mustermann",
    "modified": "2026-09-28T10:00:00Z",
    "version": "8.1.0"
  },
  "equipment": [
    {"id": "...", "name": "Camera 1", "category": "Camera", "position": {...}},
    ...
  ],
  "cables": [
    {"id": "...", "from": "...", "to": "...", "type": "SDI"},
    ...
  ],
  "library": [...],
  "fotos": [...]
}
```

Größenmerkmale:
- Kleine Projekte (< 50 Geräte): 50–200 kB
- Mittlere Projekte (50–200 Geräte): 200 KB–2 MB
- Große Projekte (> 200 Geräte) + Fotos: > 5 MB

**Sicherung und Datenverlust-Prävention:**

- Die App speichert alle 30 Sekunden automatisch
- Neben der `.cableplan` liegt eine `.bak`-Datei (Backup der vorherigen Version)
- Bei Absturz wird die automatische Sicherung beim nächsten Start wiederhergestellt
- Backup-Fehler werden in der Statusleiste mit einem Warnsymbol angezeigt

### Sicherungskopie in der Statusleiste

Unten rechts im Fenster zeigt die **Statusleiste** den Sicherungs-Status:

- **Normales Symbol (☑)** — Projekt ist aktuell, letzter Speichern vor < 5 Sekunden
- **Drehendes Symbol (⟳)** — Sicherungskopie läuft gerade
- **Warnsymbol (⚠)** — Sicherung fehlgeschlagen (z. B. voller Speicher, Schreibfehler)

Fehlerhafte Sicherungen werden gesammelt und in den Einstellungen unter *Fehlerlog* angezeigt.

Die `.bak`-Datei ist atomar geschrieben: sie wird nie in einem Halb-Zustand auf die Platte fallen, und Stromausfälle während des Speicherns zerstören weder die aktuelle noch die alte Datei.
