## Bibliothek

Die Bibliothek links organisiert Gerätevorlagen, Kabeltypen, Gerätegruppen und Racks
zum Speichern, Laden und Wiederverwenden von Plänen.

### Geräte (Equipment)

Die Geräte-Registerkarte zeigt lokale Vorlagen und externe Quellen.

#### Lokale Bibliothek

![Geräte-Übersicht in der Bibliothek](../bilder/de/bibliothek-geraete-lokal.jpg)

Die lokale Bibliothek enthält die 150+ mitgelieferten Geräte und alle selbst angelegten Vorlagen.

- *Suchen*: Suchfeld mit `Strg+F`-Kurzbefehl. Der Such-Text filtert nach Name oder Kategorie.
- *Filter-Menü*: Sortierrichtung (Manuell, A→Z, Z→A), Anzeige versteckter Geräte, nur Eigentum anzeigen.
- *Kategorien*: Aufklappen/Einklappen, Bearbeiten-Button zum Umbenennen.
- *Einträge*: Ein Eintrag pro Gerät. Hover zeigt Aktionen.

##### Eigenes Gerät anlegen

Neue Geräte mit Anschlüssen und optional Fotos erstellen:

*Bibliothek → +* (grüner Button) *→ Eigenes Gerät anlegen*

![Neues Gerät anlegen](../bilder/de/bibliothek-dialog-geraet-anlegen-allgemein.jpg)

Die Felder:

- **Name**: Wie das Gerät heißen soll.
- **Kategorie**: Z.B. Kameras, Mixer, Monitore. Wird in der Bibliothek als Ordner angezeigt. Neue Kategorien entstehen hier.
- **Ist ein 19" Rack-Gerät**: Checkbox. Falls ja, Höhe in Rack-Einheiten (RU) eingeben.

###### Reiter: Anschlüsse

![Anschlüsse konfigurieren](../bilder/de/bibliothek-dialog-geraet-anlegen-anschluesse.jpg)

Anschlüsse zu Gruppen zusammenfassen („4x BNC In", „2x HDMI Out"):

- **+Input group** oder **+Output group**: Neue Gruppe hinzufügen.
- *Für jede Gruppe*:
  - *Richtung*: Input oder Output.
  - *Anzahl*: Wie viele Anschlüsse dieser Art.
  - *Name*: Z.B. „SDI In" oder „Ethernet Out".
  - *Stecker*: BNC, HDMI, DisplayPort, USB, Ethernet, XLR, Power, etc. oder Custom.

Die Gruppen werden beim Speichern in einzelne Anschlüsse aufgelöst (z.B. „SDI In 1", „SDI In 2", …).

###### Reiter: Foto

![Fotos hochladen und Anschlüsse erkennen](../bilder/de/bibliothek-dialog-geraet-anlegen-foto.jpg)

Anschlüsse automatisch vom Gerätedatenblatt oder einem Foto erkennen:

- **Fotos hochladen**: Drag-and-Drop oder Button.
- **Erkennen**: Erkennt Stecker-Art und -Anzahl.
  - Falls mehrere Modelle passen: Bestes Treffer-Gerät anzeigen.
  - Ergebnisse als Tabelle mit Checkboxes (unsichere Einträge sind unchecked).
- **Fotos speichern**: Checkbox — Bilder werden mit der Vorlage gespeichert.

Die Erkennung braucht einen API-Schlüssel für die Gerätebibliothek oder KI (Einstellungen → KI-Einstellungen).

###### Port-Guessing

Anschlüsse aus dem Gerätenamen raten:

*„Guess the ports from the device name"* — Knopf **Ausfüllen** (mit Quelle aus Einstellungen):
- **KI** (Claude API, OpenAI GPT, Google Gemini): Sendet Namen und optional Beschreibung an die KI.
- **Websuche**: Sucht öffentliche Datenblätter und Hersteller-Seiten.
- **Heuristik**: Einfache Regeln nach Name (Z.B. „ATEM 4 Pro": 4 Eingänge erwartet).

KI-Quelle und API-Schlüssel stehen in *Einstellungen → KI-Anbieter*.

###### Speichern

Unten drei Buttons:

- **Nur platzieren**: Gerät auf den Canvas, keine Vorlage speichern.
- **In Bibliothek speichern**: Nur Vorlage, kein Gerät auf Canvas.
- **Speichern und platzieren**: Beides.

#### Vorlagen einreichen

Selbst erstellte Geräte zur Gerätebibliothek beitragen:

*Bibliothek → +* *→ Vorlagen einreichen*

![Vorlagen einreichen Dialog](../bilder/de/bibliothek-dialog-vorlagen-einreichen.jpg)

- Wähle aus, welche lokalen Vorlagen versendet werden sollen.
- Gib Hersteller und Modell an, optional Datenblatt-Link.
- Die Vorlage wird hochgeladen und von anderen Nutzern bestätigt (Voting).

Die Gerätebibliothek ist eine Community-Ressource. Verifizierte Geräte verstecken die „lokale" Version.

#### NetBox-Import

Netzwerk-Infrastruktur aus NetBox importieren:

*Bibliothek → +* *→ Import-Datei …* oder über NetBox-Integration

![NetBox Geräte suchen](../bilder/de/bibliothek-dialog-netbox-import.jpg)

- **Suchfeld**: Z.B. „Cisco Catalyst". Sucht in NetBox-Datentypen.
- **Kategorie wählen**: Wird die importierte Vorlage eingeordnet.
- **Importieren**: Gerät wird zur lokalen Bibliothek hinzugefügt.

#### Gerätebibliothek

Öffentliche Gerätedatenbank mit 500+ verifizierten Vorlagen:

![Gerätebibliothek](../bilder/de/bibliothek-geraete-geraetebibliothek.jpg)

- Geräte aus der Datenbank laden (erfordert Anmeldung).
- Bestätigungsstatus sehen: wie viele Nutzer das Gerät verifiziert haben.
- Mit lokalen Versionen abgleichen und zusammenführen.

#### Rentman

Rentman-Projekte mit Gerätebestand abgleichen (falls Rentman-Modul aktiv):

![Rentman-Integration](../bilder/de/bibliothek-geraete-rentman.jpg)

- **Linked Project**: Das Rentman-Projekt abrufen.
- **Imported**: Welche Rentman-Geräte bereits importiert sind.
- **Catalog**: Weitere Geräte zum Import anschauen.
- **Reconcile**: Abweichungen zwischen Plan und Rentman-Projekt zeigen.

### Kabel

Verfügbare Kabeltypen und deren Konfigurationen:

![Kabel-Übersicht](../bilder/de/bibliothek-kabel-uebersicht.jpg)

- **Kabeltypen** (SDI, HDMI, DisplayPort, Ethernet, Lichtleiter, Audio/XLR, USB, Strom, Custom):
  Je eine Gruppe mit den Kabeln dieser Art.
- *Pro Kabel*:
  - Anzeige-Name (z.B. „SDI 75 Ω" oder „HDMI 2.1").
  - Konnektoren an beiden Enden.
  - Maximale Länge (optional).
  - Signalstandards.
  - **Verbaut** / **Geplant**: Anzahl aktuell verlegter/geplanter Kabel im Plan.

Die Kabel-Bibliothek ist fest vorgegeben; eigene Typen sind „Custom".

#### Kabeltypen verwalten

Neue Kabeltypen definieren oder bestehende bearbeiten:

*Bibliothek → Kabel-Reiter → „Manage cable types…"*

![Kabeltypen-Verwaltung](../bilder/de/bibliothek-dialog-kabeltypen-verwalten.jpg)

- Neue Gruppe: z.B. „Satellite" mit eigenem Konnektoren-Paar und Standards.
- Kabel editieren: Name, Länge, Farbe, Signale, Status (Empfohlen/Custom/Modified).

### Gruppen

Mehrere Geräte + Kabel zusammen speichern und später einzusetzen:

![Gruppen-Übersicht](../bilder/de/bibliothek-gruppen-uebersicht.jpg)

*So entsteht eine Gruppe*:

1. Geräte auf dem Canvas anordnen und miteinander verdrahten.
2. Die markierten Geräte + Kabel **wählen** (Mehrfach-Auswahl auf dem Canvas).
3. *Canvas-Toolbar → „Als Gruppe speichern"*.
4. Namen eingeben → Gruppe erscheint in der Bibliothek.

*Eine gespeicherte Gruppe verwenden*:

- Aus der Bibliothek auf den Canvas ziehen → alle Geräte + Kabel werden an dieser Position platziert.
- Beim Speichern mit Positionsdaten, damit sie an Ort und Stelle landen.

*Operationen auf Gruppen*:

- **Umbenennen** (Stift-Icon)
- **Exportieren** → `.cpgroup`-Datei
- **Löschen**

### Racks

2D-Rack-Layout speichern: Welche Geräte, an welcher Höhe, hintereinander:

![Racks-Übersicht](../bilder/de/bibliothek-racks-uebersicht.jpg)

#### Rack Builder

Ein leeres oder bestehendes Rack editieren:

*Bibliothek → Racks-Reiter → „+" → Neues Rack*

![Rack Builder Dialog](../bilder/de/bibliothek-dialog-rack-builder-leer.jpg)

- **Rack-Name**: Z.B. „Server Rack 1".
- **Rack-Höhe**: Gesamthöhe in Rack-Einheiten (meist 42 RU).
- **Geräte einfügen**: Rechts aus der Liste hinzufügen.
- **Slot-Editor**: Jedes Gerät bekommt eine Anfangsposition (oberste freie Stelle).
- **Übereinanderstapeln**: Mehrere Geräte im gleichen Rack.

Nach dem Speichern:

- Das Rack wird zu einer Vorlage (wie eine Gruppe).
- Auf den Canvas ziehen → alle Geräte im Rack werden platziert.
- Im Canvas-Toolbar: **Rack bearbeiten** öffnet den Builder für ein bereits platziertes Rack.

#### Zum Lagern exportieren

Rack-Bestand für Lagerbestandssystem exportieren:

*Bibliothek → Racks-Reiter → „For the warehouse"*

![Rack zum Lagern exportieren](../bilder/de/bibliothek-racks-zum-lagern.jpg)

Erzeugt `rack-belegung.json` für dein Lagerbestands-System (z.B. Inventory-Planner).

### Häufig genutzte Einstellungen

**Quelle für Port-Guessing** (automatische Anschluss-Erkennung):
- *Einstellungen → KI-Anbieter* → wähle OpenAI, Claude oder Google Gemini.
- Gib deinen API-Schlüssel an.
- Die Heuristik (Namens-Analyse) läuft ohne Schlüssel.

**Kategorien verwalten**:
- Neue Kategorien entstehen, wenn du ein Gerät anlegst oder umbenennst.
- Kategorie-Namen sind zweisprachig (Deutsch + Englisch).
- Über das Filter-Menü **Expand all** / **Collapse all** schaltet alle Kategorien auf einmal.

**Suche und Filter**:
- Suchfeld = Echtzeit-Filterung nach Name oder Kategorie.
- **Nur Eigentum**: Zeigt nur Geräte, die in deinem Lagerbestand eingetragen sind.
- **Versteckte zeigen**: Geräte, die du aus Ansicht geklappt hast.
