## Einstellungen

Die Einstellungen-Dialog enthält 15 Reiter zur Konfiguration aller Aspekte der Anwendung. Sie öffnen den Dialog über die Befehlspalette (*Strg+K*, dann „Settings…" eingeben) oder über das Menü.

### Projekt

![Einstellungen - Projekt](bilder/de/einstellungen-project.jpg)

Im Projekt-Tab konfigurieren Sie projekt-spezifische Einstellungen:

#### Gerätebibliothek: Export / Import

Sichern Sie Ihre eigenen Gerätevorlagen und Gruppierungen als JSON-Datei. Beim Import werden bestehende Einträge mit denselben Namen NICHT überschrieben (Merge-by-name).

| Option | Wirkung |
|--------|---------|
| **Gerätebibliothek exportieren** | Speichert alle Gerätevorlagen, Gruppen und Rack-Presets als JSON-Datei |
| **Gerätebibliothek importieren…** | Lädt eine zuvor exportierte Datei. Nur neue Einträge werden hinzugefügt |

#### Kabelnummerierung

Automatische, kollisionsfreie Kabel-IDs nach einem festen Schema. Die Nummern werden auf dem Canvas, in der Patch-Liste und auf Etiketten angezeigt.

| Option | Wirkung |
|--------|---------|
| **Automatische Nummerierung für neue Kabel aktivieren** | Weist neuen Kabeln automatisch die nächste Nummer zu |
| **Präfix** | Zeichenfolge vor der Nummer (z.B. „C") |
| **Trennzeichen** | Zeichen zwischen Präfix und Nummer (z.B. „-") |
| **Ziffern** | Anzahl der Stellen für die Nummer (1-6) |
| **Startnummer** | Erste Nummer im Schema |
| **Separater Zähler pro Ebene (V/A/N/P…)** | Nummern werden pro Signaltyp gezählt statt durchgehend |
| **Alle Kabel neu nummerieren** | Wendet das aktuelle Schema auf alle vorhandenen Kabel an |

Beispiel: Mit Präfix „C", Trennzeichen „-" und 3 Ziffern entsteht „C-001", „C-002" usw.

#### Kabellängen schätzen

Schätzt Kabellängen aus der Canvas-Entfernung zwischen Geräten (Luftlinie × Maßstab + Sicherheit). Überschreibt vorhandene Längen.

| Option | Wirkung |
|--------|---------|
| **Meter pro 100 Pixel** | Skalierungsfaktor (z.B. 2 = 2 m pro 100 Bildschirmpixel) |
| **Slack-Faktor** | Zusätzliche Länge für Sicherheit (1,2 = 20% Zuschlag) |
| **Alle Kabellängen schätzen** | Berechnet Längen für alle vorhandenen Kabel |

### Darstellung

![Einstellungen - Darstellung](bilder/de/einstellungen-appearance.jpg)

Konfigurieren Sie das visuelle Erscheinungsbild:

#### Sprache und Theme

| Option | Wirkung |
|--------|---------|
| **Sprache** | Wähle zwischen Deutsch, Englisch und anderen unterstützten Sprachen |
| **Canvas-Theme** | Hell oder Dunkel für die Arbeitsfläche |

#### Anschlussfarben

| Option | Wirkung |
|--------|---------|
| **Anschlüsse nach Typ färben** | Färbt SDI, Audio, Power usw. unterschiedlich |
| **Farben für Anschlusstypen** | Wählen Sie individuelle Farben für jeden Typ |
| **Farben für Gerätkategorien** | Wählen Sie Farben für Kamera, Mischer, Monitor usw. |

#### Kabeldarstellung

| Option | Wirkung |
|--------|---------|
| **Kabelfarben** | Manual, nach Länge oder nach Layer (V/A/N/P) |
| **Pfeile anzeigen** | Kleine Pfeile zeigen die Signalrichtung |
| **Kabelbrücken** | Hügel an Kreuzungspunkten für visuelle Klarheit |
| **Port-Label-Größe** | Größe der Anschlussbezeichnungen |

#### Custom Palette

Farben für Canvas-Hintergrund und Raster-Linien (überschreibt Theme-Defaults):

| Option | Wirkung |
|--------|---------|
| **Custom Palette aktivieren** | Eigene Farben verwenden |
| **Hintergrund** | Canvas-Hintergrundfarbe |
| **Gitter-Strich** | Farbe der Raster-Linien |

### Bearbeiten

![Einstellungen - Bearbeiten](bilder/de/einstellungen-editing.jpg)

Standard-Verhaltensweisen beim Bearbeiten von Kabeln und Geräten:

#### Standard-Kabelverlauf

| Option | Wirkung |
|--------|---------|
| **Orthogonal** | Rechtwinklige, gitterartige Kabel |
| **Straight** | Gerade Linien |
| **Curved** | Sanfte Kurven |

#### Endpoint-Labels

Kleine Labels an jedem Kabelende, die zeigen, wohin die andere Seite führt.

| Option | Wirkung |
|--------|---------|
| **Endpoint-Labels anzeigen** | Am Quellende „→ Zielgeräte · Zielport", am Zielende „← Quellgeräte · Quellport" |

#### Kabeltyp folgt Anschlusstyp

| Option | Wirkung |
|--------|---------|
| **Kabeltyp vom Anschlusstyp ableiten** | Wenn ein Anschlusstyp geändert wird (z.B. BNC → XLR), passen verbundene Kabel automatisch an |

#### Raster

| Option | Wirkung |
|--------|---------|
| **Raster-Spacing** | Größe des Snap-Rasters in Pixeln |
| **Zum Raster ausrichten** | Geräte rasten beim Verschieben ein |

#### Verbindungs-Warnungen

| Option | Wirkung |
|--------|---------|
| **Warnungen bei ungültigen Verbindungen anzeigen** | Zeigt Warnungen, wenn inkompatible Geräte verbunden werden |

### Kabeltypen

![Einstellungen - Kabeltypen](bilder/de/einstellungen-cableTypes.jpg)

Definieren und verwalten Sie Kabeltypen:

| Option | Wirkung |
|--------|---------|
| **Neuer Kabeltyp** | Erstellt einen neuen Kabeltyp |
| **Kabeltyp bearbeiten** | Ändert Name, Farbe oder Standard-Länge |
| **Kabeltyp löschen** | Entfernt einen nicht verwendeten Kabeltyp |

Jeder Kabeltyp hat:
- Ein eindeutiger Name (z.B. "SDI-Kabel")
- Eine Farbe für die Canvas-Anzeige
- Optional: Standard-Länge und Beschreibung

### Stammdaten

![Einstellungen - Stammdaten](bilder/de/einstellungen-stammdaten.jpg)

Verwaltung von Steckertypen, Standards und Ebenen:

#### Steckertypen

| Option | Wirkung |
|--------|---------|
| **Neuer Steckertyp** | Erstellt einen neuen Steckertyp (z.B. 3G-SDI, MADI) |
| **Steckertyp bearbeiten** | Ändert Name oder Display-Name |

#### Standards

| Option | Wirkung |
|--------|---------|
| **Video-Standard** | PAL, NTSC, SDI, HDMI usw. |
| **Power-Standard** | IEC, USA, EU etc. |

#### Ebenen

Signaltypen für die Farbkodierung:

| Option | Wirkung |
|--------|---------|
| **Video (V)** | Videoströme |
| **Audio (A)** | Audioströme |
| **Netzwerk (N)** | Datenverbindungen |
| **Power (P)** | Stromversorgung |

### Konfigurationen

![Einstellungen - Konfigurationen](bilder/de/einstellungen-configs.jpg)

Gespeicherte Geräte-Konfigurationen (z.B. verschiedene Firmware-Versionen oder Einstellungen):

| Option | Wirkung |
|--------|---------|
| **Neue Konfiguration** | Erstellt eine benannte Konfiguration |
| **Konfiguration anwenden** | Wendet eine gespeicherte Konfiguration auf ein Gerät an |
| **Konfiguration löschen** | Entfernt eine nicht verwendete Konfiguration |

### Gerätebibliothek

![Einstellungen - Gerätebibliothek](bilder/de/einstellungen-deviceLibrary.jpg)

Verbindung zur Geräte-Online-Datenbank (devices.zumpelars.de):

| Option | Wirkung |
|--------|---------|
| **Anmelden…** | Registrieren oder anmelden mit Benutzerkonto |
| **Geräte hochladen** | Sendet Ihre eigenen Gerätevorlagen an die Datenbank |
| **Hochgeladene Geräte** | Zeigt, welche Geräte Sie bereits geteilt haben |

**Hinweis:** Diese Einstellungen sind nur im Desktop-Client verfügbar. Der Browser-Modus unterstützt keine Anmeldung.

### Integrationen

![Einstellungen - Integrationen](bilder/de/einstellungen-integrations.jpg)

Externe Dienste und KI-Anbieter:

#### Ausfüll-Quelle

Bestimmt, woher der „Ausfüllen"-Knopf Gerätinformationen bezieht:

| Option | Wirkung |
|--------|---------|
| **Web-Suche** | Sucht auf Wikipedia und DuckDuckGo (kein API-Key nötig) |
| **KI-Modell** | Verwendet ein KI-Modell (erfordert API-Key) |

#### KI-Anbieter

| Option | Wirkung |
|--------|---------|
| **Anbieter** | Wählen Sie zwischen Claude, OpenAI, Google Gemini |
| **API-Key** | Geben Sie den API-Schlüssel des Anbieters ein |
| **Schlüssel anzeigen / verbergen** | Toggles die Sichtbarkeit des Schlüssels |

#### Rentman-Integration

| Option | Wirkung |
|--------|---------|
| **Rentman-API-Token** | Token für die Rentman-Schnittstelle |
| **Projekt verlinken** | Verbindet das aktuelle Projekt mit einem Rentman-Projekt |

#### GreenGo-Presets

| Option | Wirkung |
|--------|---------|
| **Preset speichern** | Speichert die aktuelle Planung als GreenGo-Konfiguration |
| **Preset laden** | Lädt eine zuvor gespeicherte GreenGo-Konfiguration |
| **Preset löschen** | Entfernt ein gespeichertes Preset |

### MCP

![Einstellungen - MCP](bilder/de/einstellungen-mcp.jpg)

MCP-Server-Konfiguration (Claude fragt den Plan):

| Option | Wirkung |
|--------|---------|
| **MCP-Server aktivieren** | Schaltet die Verbindung zu MCP-Servern ein |
| **Server-Adresse** | URL oder Pfad zum MCP-Server |
| **Authentifizierung** | Benutzername und Passwort (falls nötig) |

**Hinweis:** MCP-Server im Browser-Modus nicht verfügbar.

### Module

![Einstellungen - Module](bilder/de/einstellungen-modules.jpg)

Installierte und verfügbare Module:

| Modul | Status | Wirkung |
|-------|--------|---------|
| **ATEM-Steuerung** | Enabled/Disabled | Steuert Blackmagic ATEM-Mischer |
| **Videohub** | Enabled/Disabled | Verbindung zu Blackmagic Videohub |
| **Rentman** | Enabled/Disabled | Rentman-Integration |
| **Mobile Share** | Enabled/Disabled | Smartphone-Ansicht freigeben |

Jedes Modul kann aktiviert oder deaktiviert werden.

### Nachweise

![Einstellungen - Nachweise](bilder/de/einstellungen-nachweise.jpg)

Verwaltung von Qualifikationen und Versicherungen:

| Option | Wirkung |
|--------|---------|
| **Neuer Nachweis** | Erstellt einen neuen Qualifikations-/Versicherungs-Nachweis |
| **Nachweis bearbeiten** | Ändert Name, Gültigkeitsdatum oder Beschreibung |
| **Nachweis löschen** | Entfernt einen Nachweis |

Nachweise können an Personen oder Geräte angehängt werden.

### Schema-Builder

![Einstellungen - Schema-Builder](bilder/de/einstellungen-schema.jpg)

Definieren Sie benutzerdefinierte Kategorien und Felder für Geräte:

#### Kategorien

| Option | Wirkung |
|--------|---------|
| **Neue Kategorie** | Erstellt eine neue Geräte-Kategorie (z.B. „Spezialkameras") |
| **Kategorie umbenennen** | Ändert den Namen |
| **Kategorie löschen** | Entfernt eine nicht verwendete Kategorie |

#### Felder

| Option | Wirkung |
|--------|---------|
| **Neues Feld** | Erstellt ein neues Attribut (Text, Zahl, Dropdown usw.) |
| **Feld bearbeiten** | Ändert Typ, Validierung oder Standard-Wert |
| **Feld löschen** | Entfernt ein Feld aus allen Geräten |

### Sync

![Einstellungen - Sync](bilder/de/einstellungen-sync.jpg)

Netzwerk-Synchronisation für Zusammenarbeit:

| Option | Wirkung |
|--------|---------|
| **Sync aktivieren** | Erlaubt anderen, Änderungen live zu sehen |
| **Relay-Server** | Adresse des Signaling-Servers |
| **Raum-Code** | Eindeutiger Code für diesen Plan (für Kollegen freigeben) |

Andere Nutzer können sich mit Ihrem Plan verbinden, wenn sie den Raum-Code haben.

### Tastenkürzel

![Einstellungen - Tastenkürzel](bilder/de/einstellungen-hotkeys.jpg)

Anpassen der Tastatur-Shortcuts:

| Aktion | Standard-Shortcut | Wirkung |
|--------|-------------------|---------|
| **Neues Projekt** | Strg+N | Erstellt ein leeres Projekt |
| **Projekt öffnen** | Strg+O | Öffnet eine Datei |
| **Projekt speichern** | Strg+S | Speichert die Änderungen |
| **Befehlspalette** | Strg+K | Öffnet die Suche und Navigation |
| **Einstellungen** | (Strg+,) | Öffnet diesen Dialog |

Alle Shortcuts können angepasst werden. Klicken Sie auf eine Aktion, um den neuen Shortcut zu definieren.

### Erweitert

![Einstellungen - Erweitert](bilder/de/einstellungen-advanced.jpg)

Fortgeschrittene Optionen für Entwickler und Poweruser:

| Option | Wirkung |
|--------|---------|
| **Datenexport** | Exportiert projekt- und Anwendungsdaten als ZIP-Datei |
| **Datenbank zurücksetzen** | Löscht alle lokalen Daten (nicht rückgängig zu machen) |
| **Logging aktivieren** | Schreibt detaillierte Logs für Debugging |
| **Log-Datei anzeigen** | Öffnet die aktuelle Log-Datei |
| **Cache leeren** | Löscht den lokalen Bildschirm-Cache |
| **DevTools öffnen** | Öffnet die Browser-Entwicklerwerkzeuge |

Verwenden Sie diese Optionen nur, wenn Sie wissen, was Sie tun. Sie können Ihr Projekt beschädigen.
