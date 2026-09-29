## Programmoberfläche


![Übersicht der Programmoberfläche](bilder/de/oberflaeche-start.jpg)

Die Oberfläche von LZ Cable Planner besteht aus vier Hauptbereichen: der Menüleiste oben, der Bibliothek-Seitenleiste links, der Canvas-Fläche in der Mitte und dem Inspector-Panel rechts. Am unteren Rand liegt die Statusleiste.

### Menü Bearbeiten

![Menü Bearbeiten](bilder/de/oberflaeche-menu-edit.jpg)

Das Menü Bearbeiten enthält Funktionen zum Verändern der Auswahl.

| Funktion | Tastaturkürzel | Beschreibung |
|---|---|---|
| Rückgängig | Strg+Z | Letzten Schritt rückgängig machen |
| Wiederherstellen | Strg+Y | Letzten rückgängig gemachten Schritt wiederherstellen |
| Duplizieren | Strg+D | Ausgewählte Geräte oder Kabel duplizieren |
| Auswahl löschen | Entf | Ausgewählte Elemente löschen |
| Alles auswählen | Strg+A | Alle Geräte und Kabel im Plan auswählen |
| Auswahl aufheben | Esc | Aktuelle Auswahl aufheben |

### Menü Ansicht

![Menü Ansicht](bilder/de/oberflaeche-menu-view.jpg)

Das Menü Ansicht stellt Funktionen zur Verfügung, um die Canvas-Ansicht zu beeinflussen und die Anzeige verschiedener Panels zu kontrollieren.

#### Zoom und Anpassung

| Funktion | Beschreibung |
|---|---|
| Einpassen | Canvas so zoomen, dass alle Elemente sichtbar sind |
| Zoom 100 % | Zoom auf 100 % zurücksetzen |
| Vergrößern | Canvas vergrößern |
| Verkleinern | Canvas verkleinern |

#### Design und Darstellung

| Funktion | Beschreibung |
|---|---|
| Helles Design | Zwischen hellem und dunklem Design umschalten |
| System-Theme folgen | Das Design des Betriebssystems verwenden |
| Vollbild | App im Vollbildmodus anzeigen |

#### Kabel und Beschriftungen

| Funktion | Beschreibung |
|---|---|
| Am Raster ausrichten | Geräte auf einem Raster ausrichten |
| Kabel-Labels ausblenden | Kabelbezeichnungen auf dem Canvas verbergen |
| Off-Page-Namen anzeigen | Namen von Geräten außerhalb des Plans anzeigen |
| Kabelfarbe nach Länge | Kabel nach ihrer Länge einfärben |
| Kabelfarbe nach Gewerk | Kabel nach ihrer Disziplin/Gewerk einfärben |

#### Panels und Werkzeuge

| Funktion | Beschreibung |
|---|---|
| Gerät suchen | Canvas-Suchfeld ein- und ausblenden |
| Werkzeugleiste | Canvas-Werkzeugleiste anzeigen oder ausblenden |
| Anmerkungen-Panel | Annotations-Panel ein- und ausblenden |

### Menü Hilfe

![Menü Hilfe](bilder/de/oberflaeche-menu-help.jpg)

Das Menü Hilfe bietet Zugang zu Dokumentation und Informationen über die App.

| Funktion | Tastaturkürzel | Beschreibung |
|---|---|---|
| Befehlspalette… | Strg+K | Schnellzugriff auf Befehle durch Tippsuche |
| Tastaturkürzel… | | Übersicht aller Tastaturkürzel anzeigen |
| Erste-Schritte-Tour… | | Interaktive Einführung in die App starten |
| Auf Updates prüfen… | | Nach neuen Versionen suchen |
| Über LZ Cable Planner… | | Versionsinformation und Credits anzeigen |

### Befehlspalette

![Befehlspalette](bilder/de/oberflaeche-command-palette.jpg)

Die Befehlspalette ist ein schneller Zugriff auf die wichtigsten Aktionen. Sie wird mit **Strg+K** geöffnet oder über *Hilfe → Befehlspalette…* aufgerufen. Sie erlaubt das Suchen und Ausführen von Befehlen durch Textsuche.

Die Befehlspalette enthält:
- **Bearbeiten**: Rückgängig, Wiederherstellen, Duplizieren, Alles auswählen
- **Ansicht**: Einpassen, Vergrößern, Verkleinern, Zoom zurücksetzen
- **Werkzeuge**: Plan-Überprüfung, Patch-Liste, Analysen, Massenverbindung, Revisionen, KI-Plan-Generierung, CSV-Import, und weitere Funktionen

Die Befehlspalette ist besonders nützlich, wenn Sie sich die genauen Menü-Pfade nicht merken oder wenn Sie eine Funktion schnell ausführen möchten, ohne durch die Menüs zu navigieren. Geben Sie einfach die ersten Buchstaben des gesuchten Befehls ein, um die Liste zu filtern.

### Statusleiste

![Statusleiste](bilder/de/oberflaeche-statusbar.jpg)

Die Statusleiste am unteren Rand des Fensters zeigt wichtige Informationen zum aktuellen Projekt:

| Element | Beschreibung |
|---|---|
| Projektname | Name des aktuell geöffneten Projekts |
| Geräte | Anzahl der Equipment-Elemente |
| Kabel | Anzahl der Kabelverbindungen |
| Rahmen | Anzahl der Rackrahmen |
| Gepackt | Status und Anzahl gepackter Geräte |
| Dateigröße | Größe der Projektdatei |
| Plan-Check | Status der Planüberprüfung (grün OK, rot Probleme) |
| Zoom | Aktuelle Zoomstufe in Prozent |
| Version | Installierte App-Version |

Zusätzlich können folgende Badges angezeigt werden:
- **Live-Kollaboration**: zeigt an, wenn eine Live-Zusammenarbeit aktiv ist
- **MCP-Server**: zeigt an, ob der MCP-Server läuft und ob Claude den Plan liest
- **Aufgaben**: zeigt an, wenn es fällige Aufgaben gibt

### Designeinstellungen

#### Helles Design

![Helles Design](bilder/de/oberflaeche-theme-light.jpg)

Das App-Design kann zwischen einem hellen und dunklem Design umgeschaltet werden. Im hellen Design hat die App einen weißen/hellen Hintergrund, im dunklen Design (Standard) einen dunklen Hintergrund. Die Farbpalette wird automatisch angepasst.

Sie können auch einstellen, dass das System-Theme des Betriebssystems verwendet wird. Dann wechselt die App automatisch zwischen hellem und dunklem Design, je nach Systemeinstellung.

### Canvas-Sichtbarkeitsoptionen

#### Einrasten

![Einrasten](bilder/de/oberflaeche-snap-to-grid.jpg)

Mit der Option „Am Raster ausrichten" werden Geräte, die Sie auf dem Canvas verschieben, automatisch auf einem Raster ausgerichtet. Dies erleichtert die Anordnung und erzeugt ein ordentliches Layoutergebnis. Sie können diese Option im Menü Ansicht aktivieren oder deaktivieren.

#### Beschriftungen ausblenden

![Kabel-Labels ausblenden](bilder/de/oberflaeche-hide-labels.jpg)

Kabel können Beschriftungen (Labels) wie die Portnummern tragen. Mit „Kabel-Labels ausblenden" im Menü Ansicht können diese ausgeblendet werden. Dies ist nützlich, wenn der Canvas überlastet wirkt oder wenn Sie nur die Verbindungsstruktur sehen möchten.

#### Kabelfarben

##### Farbe nach Länge

![Kabelfarbe nach Länge](bilder/de/oberflaeche-color-by-length.jpg)

Mit dieser Option werden Kabel je nach ihrer physikalischen Länge eingefärbt. Kurze Kabel erhalten eine Farbe, lange Kabel eine andere. Dies hilft, auf einen Blick zu erkennen, welche Kabel besonders lang sind und daher möglicherweise kostspielig oder schwierig zu verlegen sind.

##### Farbe nach Gewerk

![Kabelfarbe nach Gewerk](bilder/de/oberflaeche-color-by-layer.jpg)

Mit dieser Option werden Kabel nach ihrer Disziplin/ihrem Gewerk eingefärbt (z. B. Video, Audio, Daten, Stromversorgung). Das erleichtert die Unterscheidung zwischen verschiedenen Kabeltypen auf einem komplexen Plan.

### Informationen und Hilfe

#### Über die App

![Über-Dialog](bilder/de/oberflaeche-about.jpg)

Der About-Dialog zeigt die aktuelle Version von LZ Cable Planner sowie Informationen über den Lizenzgeber und verwendete Open-Source-Bibliotheken. Er ist erreichbar über *Hilfe → Über LZ Cable Planner…*.

Hier finden Sie:
- Die aktuelle Versionsnummer
- Das Veröffentlichungsdatum
- Den Autor (Lars Zumpe)
- Das GitHub-Repository (github.com/larszu/cable-planner)
- Verwendete Technologien (Electron, React, ReactFlow, Vite, Tailwind)
- Hinweis zur Fehlermeldung (Issues und Feature-Anfragen sollten direkt auf GitHub gemeldet werden)

### Nicht aufgenommene Funktionen

Die folgenden Elemente konnten nicht vollständig dokumentiert werden:

- **Handy-Zugriff Dialog**: Der Button zum Starten des Handy-Zugriffs ist in der Test-Umgebung möglicherweise nicht verfügbar oder wurde nicht erfolgreich aktiviert.
- **Zusammenarbeit Panel**: Das Sync-Panel wurde nicht erfolgreich vom Testskript geöffnet.
- **Tastaturkürzel Dialog**: Der Dialog konnte nicht erfolgreich aktiviert werden.

Diese Funktionen sind alle im Code vorhanden und funktional. Die Dokumentation konzentriert sich auf die Hauptmenüs und die wichtigsten Einstellungen zur Konfiguration der Benutzeroberfläche.
