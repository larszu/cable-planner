## Canvas

Die Arbeitsfläche ist das Herzstück von Cable Planner. Hier planen Sie Ihr Verkabelungssystem, visualisieren den Signalfluss und verwalten die Anordnung aller Geräte. Die schwebende Werkzeugleiste oben links bietet direkten Zugriff auf alle Funktionen.

### Werkzeugleiste (Toolbar)

Die Toolbar ist eine schwebende Leiste oben links auf dem Canvas. Sie enthält alle wichtigen Funktionen und lässt sich mit dem Zieh-Griff verschieben.

![Toolbar-Hauptansicht](bilder/de/canvas-01-toolbar-main.jpg)

#### Toolbar schließen und wieder öffnen

Der **X**-Button neben dem Zieh-Griff versteckt die Toolbar. Sie können sie über das *Ansicht* → *Canvas-Werkzeugleiste* Menü wieder öffnen. Dies ist nützlich auf kleinen Bildschirmen oder für ungestörte Pläne.

### Einstellungen: Defaults (Voreinstellungen für neue Kabel)

Das Menü *Defaults* fasst alle Standard-Verhaltenswerte zusammen, die beim Erstellen neuer Kabel gelten. Klicken Sie auf den Defaults-Button (Zahnrad-Symbol) um das Menü zu öffnen.

#### Routing (Kabel-Verlauf)

Bestimmt die Standardform neuer Kabel:

- **Orthogonal** (rechtwinkliges Gitter): Kabel verlaufen waagerecht und senkrecht
- **Straight** (direkt): Gerade Linien zwischen den Anschlüssen
- **Curved** (geschwungen): Sanfte Kurven

#### Pfeile (Signalrichtung)

Aktiviert kleine Pfeile an den Kabeln, die die Signalrichtung anzeigen.

#### Kabelbrücken (Cable Bumps)

Zeigt kleine Hügel an Kreuzungspunkten, damit Kabel optisch übereinander gehen, statt sich zu schneiden.

#### Ports nach Typ färben

Färbt die Anschlüsse je nach Typ (z. B. SDI, Audio, Power) unterschiedlich.

#### Kabelfarben

Wählen Sie die Färbungs-Logik für Kabel:

- **Manuell**: Sie wählen die Farbe für jedes Kabel einzeln
- **Nach Länge**: Automatische Färbung je nach Kabellänge (mit Farblegenden)
- **Nach Layer**: Automatische Färbung je nach Signaltyp (Video, Audio, Control, Network, Power)

### Rahmen (Location Frames)

Rahmen sind farbige Rechtecke, um Gerätegruppen zu kennzeichnen — zum Beispiel alle Kameras, alle Mischer oder alle Switch-Komponenten.

**Neuen Rahmen hinzufügen:**
1. Klicken Sie auf den **Frame**-Button in der Toolbar
2. Ein leerer Rahmen wird am Viewport-Zentrum erstellt
3. Ziehen Sie den Rahmen und die Ecken, um ihn anzupassen
4. Rechtsklick auf einen Rahmen öffnet das Kontextmenü zum Bearbeiten

**Rahmen um ausgewählte Geräte:**
1. Wählen Sie ein oder mehrere Geräte
2. Der **Frame**-Button zeigt jetzt "Frame um die X Geräte"
3. Klicken Sie ihn an — ein neuer Rahmen wird automatisch um alle Geräte gezogen

### Auswahl und Mehrfach-Verkabelung

#### Ein Gerät auswählen

Klicken Sie auf ein Gerät. Es wird mit blauem Umriss markiert. Die Ausrichtungs-Buttons erscheinen nun in der Toolbar.

#### Mehrere Geräte auswählen

Halten Sie **Strg** (Windows/Linux) oder **Cmd** (Mac) gedrückt und klicken Sie auf weitere Geräte. Sie können auch ein Rechteck ziehen, um mehrere Geräte auf einmal zu erfassen.

#### Mehrfach-Verkabelung (Bulk Connect)

Wenn genau **zwei Geräte** ausgewählt sind, erscheint der **Connect cables**-Button in der Toolbar.

![Zwei Geräte ausgewählt](bilder/de/canvas-06-two-equipment-selected.jpg)

Im Dialog können Sie mehrere Verbindungen auf einmal erstellen:
- Wählen Sie Output-Ports des ersten Gerätes
- Wählen Sie Input-Ports des zweiten Gerätes
- Wählen Sie den Kabeltyp und die Farbe
- Klicken Sie "Verbinden", um alle auf einmal anzulegen

### Ausrichtung und Anordnung

Die Ausrichtungs-Buttons erscheinen nur, wenn mindestens ein Gerät ausgewählt ist.

![Ausrichtungs-Buttons](bilder/de/canvas-05-align-buttons.jpg)

| Button | Funktion |
|--------|----------|
| **Links** | Bei 1 Gerät: am linken Viewport-Rand; bei mehreren: linke Kanten bündig |
| **Mitte horizontal** | Bei 1 Gerät: horizontal im Viewport zentriert; bei mehreren: mittig aneinander |
| **Rechts** | Bei 1 Gerät: am rechten Viewport-Rand; bei mehreren: rechte Kanten bündig |
| **Oben** | Bei 1 Gerät: am oberen Viewport-Rand; bei mehreren: obere Kanten bündig |
| **Mitte vertikal** | Bei 1 Gerät: vertikal im Viewport zentriert; bei mehreren: mittig aneinander |
| **Unten** | Bei 1 Gerät: am unteren Viewport-Rand; bei mehreren: untere Kanten bündig |
| **Verteilen horizontal** | (nur bei 3+ Geräten) Gleiche Abstände horizontal |
| **Verteilen vertikal** | (nur bei 3+ Geräten) Gleiche Abstände vertikal |

#### Gerätegruppen speichern

Wählen Sie ein oder mehrere Geräte und klicken Sie den **Gruppen-speichern**-Button (3 Rechtecke). Ein Eingabefeld erscheint. Geben Sie einen Namen ein und klicken Sie den grünen **Speichern**-Button.

Gruppen können Sie später aus der Bibliothek auf den Canvas ziehen und die Anordnung wird beibehalten.

### Geräte im 2D-Rack-Builder anordnen

Wenn Sie ein oder mehrere normale Geräte ausgewählt haben, können Sie sie mit dem **Rack**-Button der Werkzeugleiste oder per Rechtsklick → **Im Rack-Builder anordnen** in den 2D-Rack-Builder verschieben, um sie in Reihen anzuordnen (z. B. um einen Schrank zu simulieren). Ist ein Rack in der Auswahl, fehlt beides: Racks lassen sich nicht in Racks packen.

Wenn Sie ein bestehendes Rack (schwarz-weiße Black-Box) auswählen, erscheint stattdessen ein **Bearbeiten**-Button zum Öffnen des Rack-Builders für dieses spezifische Rack.

### Kontextmenüs (Rechtsklick)

#### Geräte-Kontextmenü

Klicken Sie mit der rechten Maustaste auf ein Gerät. Ein Menü erscheint mit diesen Optionen:

- **Gerät umbenennen**: Beschriftung ändern
- **Farbe ändern**: Rahmen- und Hintergrundfarbe des Geräts
- **Gerät duplizieren**: Kopiert das Gerät mit allen Verbindungen
- **Gerät löschen**: Gerät und alle seine Kabel entfernen
- **Beschriftung verbergen**: Symbol ohne Namen anzeigen
- **Anschlüsse verbergen**: Nur das Gerätsymbol ohne Port-Punkte
- **Im Rack-Builder anordnen**: Öffnet den Rack-Builder mit dem Gerät bzw. der ganzen Auswahl (wie der Rack-Button der Werkzeugleiste)

#### Kabel-Kontextmenü

Klicken Sie mit der rechten Maustaste auf ein Kabel. Folgende Optionen sind verfügbar:

![Kabel-Kontextmenü](bilder/de/canvas-11-canvas-context-menu.jpg)

- **Kabel umbenennen**: Beschriftung ändern
- **Kabeltyp wechseln**: Port-Typen neu zuweisen (z. B. SDI ↔ Optical)
- **Farbe ändern**: Kabelfarbe überschreiben
- **Länge ändern**: Kabellänge in Metern eintragen
- **Verbindung prüfen**: Wenn verfügbar, wird die Kabelverbindung validiert
- **Knickpunkte anzeigen**: Zeichnet Zwischenpunkte sichtbar, um Wegführung zu ändern
- **Adapter einsetzen**: Dialog zum Hinzufügen eines Gender-Changers (z. B. XLR M↔F)
- **Seitenverbinder**: Führt das Kabel über einen Off-Page-Connector raus und wieder rein
- **Kabel löschen**: Verbindung entfernen

#### Canvas-Kontextmenü (Leerefläche)

Klicken Sie mit der rechten Maustaste auf eine leere Fläche:

- **Neues Gerät hier…**: Öffnet die Geräte-Bibliothek gefiltert für schnelle Auswahl am Klick-Punkt
- **Rahmen hinzufügen**: Erstellt einen neuen Rahmen am Cursor
- **Einfügen**: Wenn Sie ein Gerät kopiert haben, wird es hier eingefügt

### Layer-Sichtbarkeit (Video, Audio, Control, Network, Power)

![Layer-Sichtbarkeit](bilder/de/canvas-12-layer-visibility.jpg)

Die farbigen **Chips** nach dem Signalweg-Button filtern, welche Kabel sichtbar sind. Sie verbergen nur die Kabel — die Geräte bleiben immer sichtbar.

Klicken Sie auf einen **Video**-, **Audio**-, **Control**-, **Network**- oder **Power**-Chip, um diese Kabel ein-/auszublenden. Ein **X** im Chip bedeutet, dass dieser Layer verborgen ist.

Für benutzerdefinierte Layer (z. B. "RF", "Intercom"), die Sie angelegt haben, erscheinen zusätzliche Chips.

### Signalfluss-Darstellung (Flow Mode)

Der **Flow Mode**-Chip bestimmt, wie Kabel dargestellt werden:

- **Linear**: Direkte Verbindungen ohne zusätzliche Visualisierung
- **Schematic**: Grafische Darstellung mit Signalfluss-Visualisierung (Pfeile und Farben zeigen Signal-Richtung)
- **Circuit**: Elektrotechnische Schaltplan-Ansicht (wenn verfügbar)

### Grundriss (Floor Plan)

![Grundriss-Panel](bilder/de/canvas-14-floorplan-panel.jpg)

Der **Floor plan**-Button blendet oder verbirgt einen Grundriss unter der Canvas, um räumliche Positionen zu zeigen.

**Im Grundriss-Panel können Sie:**
- Einen Grundriss hochladen (JPG/PNG) oder aus der Datei-Bibliothek wählen
- Maßstab / Kalibrierung anpassen
- **Zwei-Punkt-Kalibrierung**: Zwei Punkte im Plan markieren und deren reale Meter eingeben
- **Vier-Ecken-Kalibrierung**: Ein Grundriss-Rechteck auf die Canvas-Koordinaten abbilden

### Symbole (Electrical, Alarm, PA, IT, AV)

![Symbole-Panel](bilder/de/canvas-15-symbols-panel.jpg)

Der **Symbols**-Button öffnet ein Panel mit Planzeichen:

- **Kategorien**: Electrical, Alarm, PA, IT, Automation, AV
- **Symbol ziehen**: Wählen Sie ein Symbol und ziehen Sie es auf den Canvas
- **Import**: Externe SVG-Symbole hochladen
- **KI-Erzeugung**: Mit Beschreibung neue Symbole erzeugen lassen
- **CSV-Import**: Große Symbolmengen aus Datei importieren

### Raumsichtbarkeit (Rooms)

Der **Rooms** ▾-Button zeigt alle definierten Räume des Projekts. Klicken Sie einen Raum an, um nur die Geräte in diesem Raum anzuzeigen. Dies ist nützlich bei größeren Projekten mit mehreren Räumen.

### 3D-Gebäudeansicht

Der **3D**-Button öffnet eine dreidimensionale Gebäude-Ansicht. Hier sehen Sie die Positionen aller Geräte räumlich — nützlich, um Kabel-Laufwege und Raumaufteilung zu visualisieren.

Verwenden Sie die Maus, um die Ansicht zu drehen und zu zoomen.

### Signalweg anzeigen

Wenn ein Gerät ausgewählt ist, werden alle Kabel, die ein Signal zu oder von diesem Gerät transportieren, hervorgehoben. So sehen Sie schnell den kompletten Signalfluss.

### Geräte-Suche (Strg+F / Cmd+F)

Drücken Sie **Strg+F** (Windows/Linux) oder **Cmd+F** (Mac) oder klicken Sie auf die Lupe. Ein Suchfeld erscheint oben über dem Canvas.

![Geräte-Suche](bilder/de/canvas-22-equipment-search.jpg)

Tippen Sie den Namen eines Geräts ein. Gefundene Geräte werden hervorgehoben und die Canvas zoomt heran.

### Inline-Auswahl-Toolbar (Multiple Selection)

Wenn Sie mehrere Geräte auswählen, erscheint über der Auswahl eine kleine Werkzeugleiste mit schnellen Optionen:

- **Farbe**: Ändert die Farbe aller ausgewählten Geräte
- **Löschen**: Entfernt alle ausgewählten Geräte
- **Weitere Optionen**: Menü für alle Aktionen

### Sperren (Lock)

Der **Sperren**-Button fasst drei Schutzmaßnahmen zusammen:

| Bereich | Effekt |
|---------|--------|
| **Rahmen sperren** | Rahmen können nicht verschoben oder gelöscht werden |
| **Geräte sperren** | Geräte können nicht verschoben oder gelöscht werden |
| **Kabel sperren** | Kabel können nicht verschoben, geändert oder gelöscht werden |

Das Button-Label zeigt die Anzahl der aktiven Sperren. Wenn alle drei aktiv sind, wird der Button grau und zeigt "Sperren: 3".

### Finalisieren (Plan-Lock)

Der **Finalize**-Button auf der rechten Seite der Toolbar sperrt den gesamten Plan:

![Finalize-Button](bilder/de/canvas-17-finalize-button.jpg)

- **Editing** (Standard): Sie können alle Änderungen machen
- **Finalised**: Kein Verschieben, keine neuen Verbindungen, keine Löschungen. Ein Bestätigungsdialog warnt vor Änderungen
- **Viewer**: Read-only-Datei (`.cpviewer`), kann nicht bearbeitet werden

Ein Klick toggelt zwischen Editing und Finalised. Der Plan bleibt in dieser Datei gespeichert.

### Anmerkungen (Annotations)

![Anmerkungen-Buttons](bilder/de/canvas-18-annotations-buttons.jpg)

**Badges** zeigen/verstecken die farbigen Kreis-Marken auf dem Canvas, ohne Anmerkungen zu löschen.

**Annotations** öffnet das Anmerkungs-Panel mit einer Liste aller Markierungen. Hier können Sie Notizen hinzufügen, Farben ändern und Anmerkungen verwalten.

Im **Viewer-Modus** wird der Anmerkungen-Button lila und zeigt "Viewer", um Reviewer zu ermutigen, Feedback zu geben.

### Zoom und Navigation

![Zoom-Buttons und Minimap](bilder/de/canvas-19-zoom-minimap.jpg)

Unten links im Canvas:

- **+** und **−** zum Zoomen
- **1:1** zum Zurücksetzen auf Originalgröße
- **Fit** um alle Geräte sichtbar zu machen
- **Minimap** zeigt eine Vogelperspektive, klicken Sie drauf um zu springen

Sie können auch mit dem **Mausrad** zoomen oder die rechte Maustaste (nicht auf Geräten!) zum Verschieben nutzen.

### 3D-Rackansicht

Wenn Sie ein Rack öffnen oder vom Canvas aus den Rack-Builder aufrufen, wird eine 3D-Ansicht aller Rack-Units angezeigt. Hier können Sie Geräte in einzelne Units einordnen und die räumliche Anordnung sehen.

Die 3D-Ansicht kann mit der Maus rotiert und gezoomt werden.

### Kabel-Details

Doppelklicken Sie auf ein Kabel oder öffnen Sie sein Kontextmenü, um Details zu bearbeiten:

- **Name/Label**: Beschriftung (erscheint auf dem Kabel)
- **Länge**: In Metern (wird zur Kabelplanung und Farb-Kodierung genutzt)
- **Typ**: Port-Typ (SDI, Optical, Audio, Power, etc.)
- **Farbe**: Farbe des Kabels (nur bei manueller Färbung)
- **Waypoints**: Knickpunkte zum Kontrollieren des Verlaufs

### Stream-Vorschau

Wenn Sie einen Stream-Output eines Geräts aktivieren, kann eine kleine Vorschau-Kachel auf dem Canvas angezeigt werden (z. B. ATEM-Multiviewer oder Videohub-Ausgang). Diese zeigt das Live-Signal.

### Tastenkürzel auf dem Canvas

| Shortcut | Funktion |
|----------|----------|
| **Klick** | Gerät/Kabel auswählen |
| **Strg+Klick** (Cmd+Klick) | Zur Auswahl hinzufügen |
| **Ziehen** | Gerät oder Kabel verschieben |
| **Rechtsklick** | Kontextmenü |
| **Strg+F** (Cmd+F) | Geräte-Suche |
| **Strg+D** (Cmd+D) | Auswahl duplizieren |
| **Entf** | Auswahl löschen |
| **Strg+Z** (Cmd+Z) | Rückgängig |
| **Strg+Y** (Cmd+Y) | Wiederherstellen |
| **Mausrad** | Zoomen |
| **Rechte Taste + Ziehen** | Canvas verschieben |
