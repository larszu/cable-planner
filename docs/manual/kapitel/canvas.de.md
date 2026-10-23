## Canvas

Der Canvas ist die Arbeitsfläche in der Mitte. Auf ihm stehen Geräte, Kabel und Rahmen. Oben links schwebt die Werkzeugleiste, darunter das Suchfeld; unten links liegen die Zoom-Knöpfe, unten rechts die Übersichtskarte.

### Werkzeugleiste

![Werkzeugleiste](bilder/de/canvas-leiste-01-leiste-ganz.jpg)

Die Werkzeugleiste zeigt von links nach rechts:

| Element | Wirkung |
|---|---|
| Griff ⠿ | verschiebt die Leiste |
| × | schließt die Leiste; *Ansicht → Werkzeugleiste* holt sie zurück |
| Defaults | Voreinstellungen für neue Kabel und die Darstellung |
| Rahmen | legt einen Rahmen an, bei Auswahl um die ausgewählten Geräte |
| Sprache | legt Kabel aus einem gesprochenen oder getippten Satz an |
| Auswahl-Knöpfe | erscheinen nur bei ausgewählten Geräten |
| Ebenen-Chips | Video, Audio, Control, Network, Power, Other und eigene Ebenen; blenden die Kabel einer Ebene ein und aus |
| Mehr | weitere Funktionen |

Eine eingeschaltete Betriebsart (Signalweg, Schaltbild, Prüfbild) erscheint mit ihrem Stand direkt in der Leiste.

#### Menü Mehr

![Menü Mehr](bilder/de/canvas-hallenplan-02-panel-leer.jpg)

| Eintrag | Wirkung |
|---|---|
| Ebenen ⋯ | *Custom-Layer anlegen…* und *Alle Ebenen wieder einblenden* |
| Sperren | Sperren gegen versehentliches Verschieben |
| Räume, 3D | erscheinen, sobald Rahmen vorhanden sind |
| Schema | Darstellung des geplanten Wegs |
| Schaltbild | Stromschaltbild mit Schalterstellungen |
| Prüfbild | Prüfbild einer Quelle |
| Abschließen | sperrt den ganzen Plan |
| Badges | blendet die Anmerkungs-Marken ein und aus; die Anmerkungen bleiben |
| Anmerkungen | öffnet das Anmerkungen-Panel |
| Hallenplan | öffnet das Hallenplan-Panel |
| Symbole | öffnet das Symbol-Panel |

### Defaults

![Defaults](bilder/de/canvas-defaults-01-menue-offen.jpg)

*Defaults* gilt für neu gezogene Kabel und die Darstellung aller Kabel. Ein Punkt am Knopf zeigt, dass mindestens eine Vorgabe geändert ist.

| Gruppe | Optionen |
|---|---|
| Kabel-Routing | Ortho, Direkt, Kurve |
| Kabelfarbe | Nach Typ (Farbe aus dem Kabeltyp), Nach Länge (Längen-Farbcode) |
| Sonstiges | Pfeil am Kabel-Ende, Kabelbrücken bei Kreuzungen, Alle Kabel-Labels ausblenden, Kabel-Labels: Kurzform, Ports nach Connector-Typ einfärben |

*Kabel-Labels: Kurzform* lässt den Format-Zusatz wie „(1080p50/60)“ in der Beschriftung weg. Kabelbrücken lassen sich je Kabel im Kontextmenü abweichend setzen. Färbung nach Gewerk steht in *Ansicht → Kabelfarbe nach Gewerk* und in *Einstellungen → Darstellung*.

Bei *Nach Länge* zeigt eine Legende *Längenfarben* die Farbe je Länge; *Schließen* blendet sie aus.

![Längenfarben](bilder/de/canvas-defaults-07-farbe-legende.jpg)

### Geräte auswählen und anordnen

- Ein Klick wählt ein Gerät. Mit **Strg** (macOS: **Cmd**) kommen weitere hinzu; ein aufgezogenes Rechteck wählt alle Geräte darin. **Strg+A** wählt alles, **Esc** hebt die Auswahl auf.
- Über der Auswahl erscheint eine kleine Leiste: bei einem Gerät *Duplizieren*, *Rahmen um Auswahl*, *Geräte-Datenblatt (A4-PDF / Druck)* und *Löschen*; ab zwei Geräten zusätzlich die Ausrichte-Knöpfe, ab drei auch Verteilen.

![Leiste über einem Gerät](bilder/de/canvas-stream-07-kachel-fehler.jpg)

![Leiste über drei Geräten](bilder/de/canvas-inline-04-drei-geraete.jpg)

#### Ausrichten

Die Ausrichte-Knöpfe stehen auch in der Werkzeugleiste.

| Knopf | ein Gerät | mehrere Geräte |
|---|---|---|
| Links, Rechts, Oben, Unten | an den Rand des sichtbaren Bereichs | Kanten bündig |
| Horizontal / Vertikal zentrieren | in die Mitte des sichtbaren Bereichs | mittig zueinander |
| Horizontal / Vertikal verteilen | – | gleiche Abstände, ab drei Geräten |

#### Gruppe speichern und Rack aus Auswahl

Bei ausgewählten Geräten stehen in der Werkzeugleiste zwei weitere Knöpfe:

- *Als Gruppe speichern*: Ein Namensfeld erscheint; *Gruppe speichern* legt die Gruppe in der Bibliothek ab. Gibt es den Namen schon, fragt die App, ob überschrieben werden soll.
- *Im 2D-Rack-Builder anordnen*: öffnet *Neues Rack aus Auswahl* mit den gewählten Geräten. Geräte, die nicht als Rack-Gerät markiert sind, stehen dort unter *Konflikte*. Ist ein Rack gewählt, öffnet der Knopf dieses Rack zum Bearbeiten.

#### Mehrere Kabel verbinden

Sind genau zwei Geräte ausgewählt, erscheint *Kabel verbinden*. Der Dialog *Mehrere Kabel verbinden* legt N Kabel auf einmal an: Quelle-Port i zu Ziel-Port i.

![Mehrere Kabel verbinden](bilder/de/canvas-auswahl-22-kabel-verbinden-dialog.jpg)

| Feld | Wirkung |
|---|---|
| Quelle / Ziel: Gerät, Seite, Start-Output / Start-Input | Gerät, Port-Liste und erster Port je Seite |
| Anzahl Kabel | wie viele Kabel |
| Kabel-Typ | Kabeltyp; die Farbe kommt aus dem Typ |
| Länge pro Kabel (m) | Länge jedes Kabels |

Die *Vorschau* zeigt die Verbindungen und warnt, wenn die Anzahl die freien Ports übersteigt; belegte Ziel-Ports werden übersprungen. *n Kabel erstellen* legt sie an.

### Kabel ziehen

1. Ziehen Sie von einem Port auf einen Port eines anderen Geräts. Lassen Sie auf dem Gerätekörper los, nimmt die App einen freien passenden Port.
2. Der Dialog *Neues Kabel* zeigt *Von* und *Nach*. Wählen Sie *Kabel* (passende Typen mit ✓, unpassende mit ✕, *★ Custom-Kabel…* für ein eigenes), *Signal-Standard*, *Name*, *Länge (m)*, *Farbe* und *Notizen*. Ein Hinweis sagt, ob der Typ zu den Steckern passt.

   ![Neues Kabel](bilder/de/canvas-kabel-02-dialog.jpg)

3. *Erstellen* legt das Kabel an.

Ist ein Port schon belegt, fragt *Port bereits belegt*: *Ersetzen* löscht das bestehende Kabel und legt das neue an, *Abbrechen* verwirft das neue. Endet ein Zug auf freier Fläche, bietet der Dialog ein Kabel mit offenem Ende an (*Nach: Open End*).

Passen die Stecker nicht zusammen oder haben beide dasselbe Geschlecht, zeigt das Kabel im Inspector einen Hinweis mit *Einsetzen*; das setzt einen Adapter oder Wandler in die Strecke, ein Rückgängig-Schritt nimmt ihn wieder heraus.

![Adapter-Hinweis](bilder/de/canvas-adapter-02-adapter-hinweis.jpg)

### Kabel per Sprache

*Sprache* öffnet *Kabel per Sprache*. Tippen Sie in *Satz* einen Satz wie „SDI 1 vom ATEM zum NEC im Foyer“ oder sprechen Sie ihn (*Sprechen*, wo die Spracherkennung verfügbar ist; sonst die Diktierfunktion des Systems). Mehrere Kabel trennen Sie mit einem Punkt. *Vorschau* zeigt je Kabel Quelle, Ziel und Port; bei mehreren Treffern wählen Sie das Gerät, fehlt ein Gerät, kann es aus der Bibliothek kommen. Braucht eine Verbindung einen Wandler, bietet die Vorschau ihn an; ist ein Eingang belegt, fragt sie, ob das Kabel ersetzt werden soll. *n Kabel verbinden* legt alles in einem Rückgängig-Schritt an.

### Kabel bearbeiten

Ein gewähltes Kabel zeigt Griffe an seinen Ecken und Abschnitten und ein × an der Beschriftung, das das Kabel löscht. Abschnitte und Ecken lassen sich ziehen.

![Gewähltes Kabel](bilder/de/canvas-kabeleditor-02-segment-ziehen.jpg)

Ein Doppelklick öffnet die Eigenschaften im Inspector. Ein Rechtsklick öffnet das Kabel-Menü:

| Eintrag | Wirkung |
|---|---|
| Bezeichnung ändern… | neuer Name |
| In Plan übernehmen, Mobile-Haken entfernen | bei Vorschlägen und Haken vom Handy |
| Signal messen | zeigt die Scopes des Streams am Quellgerät; ohne passenden Stream sagt die App, was fehlt |
| Wegpunkt hier hinzufügen, Nächsten Wegpunkt entfernen, Alle Wegpunkte löschen (n) | Knickpunkte |
| Automatisch neu routen | legt den Weg neu |
| Routing: Orthogonal, Direkt, Geschwungen | Form dieses Kabels |
| Kabelbrücken für dieses Kabel | an, aus oder global |
| Pfeil am Anfang, Pfeil am Ende, Bidirektional | Pfeile |
| Off-Page-Verbindung erstellen… | ersetzt die Linie durch zwei Pfeil-Verbinder mit Netznamen |
| Kabel löschen | nach Rückfrage |

An einer Off-Page-Verbindung lässt sich die Hilfslinie zu jedem Verbinder über Wegpunkte führen: Griffe ziehen, *Wegpunkt hinzufügen* mit +, Doppelklick löscht einen Wegpunkt.

### Kontextmenüs von Gerät, Rahmen und Fläche

![Geräte-Kontextmenü](bilder/de/canvas-kontext-01-geraet.jpg)

| Rechtsklick auf | Einträge |
|---|---|
| Gerät | Geräte-Datenblatt…, Im Rack-Builder anordnen (bei mehreren: n Geräte), Rack-Editor öffnen (nur bei Racks), Position sperren / entsperren, Gerät löschen |
| Rahmen | Position sperren / entsperren, Rahmen löschen |
| freie Fläche | Neues Gerät hier … |

*Neues Gerät hier …* öffnet *Eigenes Gerät anlegen* und setzt das Gerät an die Stelle des Klicks. Beim Löschen eines Geräts werden seine Kabel mitgelöscht; beim Löschen eines Rahmens bleiben die Geräte.

![Rahmen-Kontextmenü](bilder/de/canvas-rahmen-09-rahmen-kontext.jpg)

### Rahmen und Räume

*Rahmen* legt einen Rahmen an; sind Geräte ausgewählt, umschließt er sie. Ecken und Kanten ändern die Größe. Ein Rahmen nimmt beim Verschieben die Geräte darin mit. Die Eigenschaften beschreibt [Rahmen-Eigenschaften](#rahmen-eigenschaften).

Mit Rahmen erscheinen unter *Mehr*:

- *Räume*: eine Liste nach Etagen mit Häkchen je Etage und Raum. Abgewählte Räume und Etagen samt ihren Geräten verschwinden vom Canvas; mehrere lassen sich gleichzeitig ausblenden.

  ![Räume](bilder/de/canvas-raeume-11-raeume-menue.jpg)

- *3D*: *Gebäude 3D* zeigt die Räume nach Etagen gestapelt. *Raumverbindungen* oder *Einzelne Kabel* wählt die Darstellung der Kabel, *Beschriftung* blendet Namen ein, *Geschosshöhe (m)* gilt für Etagen ohne eigene Höhe, *Räume* blendet Räume aus. Geräte und Bodentanks lassen sich ziehen; daneben ziehen dreht, das Mausrad zoomt.

  ![Gebäude 3D](bilder/de/canvas-raeume-17-drei-d-raeume.jpg)

### Ebenen

Jeder Ebenen-Chip zeigt beim Überfahren, wie viele Kabel er hat. Ein Klick blendet die Kabel der Ebene aus; die Geräte bleiben. *Ebenen ⋯ → Custom-Layer anlegen…* fügt eine eigene Ebene hinzu; ein Rechtsklick auf ihren Chip entfernt sie. *Alle Ebenen wieder einblenden* zeigt alles.

### Sperren

![Sperren](bilder/de/canvas-sperren-01-menue.jpg)

| Häkchen | Wirkung |
|---|---|
| Rahmen | Rahmen lassen sich nicht verschieben |
| Geräte | Geräte lassen sich nicht verschieben |
| Kabel | Wegpunkte lassen sich nicht bearbeiten |

### Abschließen

*Abschließen* fragt *Planung abschließen?* und sperrt danach den Canvas: keine Verschiebungen, neuen Verbindungen oder Löschungen. Der Knopf heißt dann *Abgeschlossen*; ein Klick fragt *Planung wieder zur Bearbeitung freigeben?* und hebt die Sperre mit *Freigeben* auf. In einer Viewer-Datei steht dort *Viewer*, und der Plan ist nur lesbar.

### Signalweg

Bei gewähltem Kabel hebt *Signalweg zeigen* im Inspector die ganze Kette hervor, in der das Kabel liegt, und dunkelt den Rest ab. **Esc** oder das × am Chip *Signalweg* in der Leiste beenden das.

### Schema, Schaltbild, Prüfbild, Weg schalten

| Modus | Wirkung |
|---|---|
| Schema | zeigt den geplanten Weg, ohne Verbindung zu einer Anlage. Ein Klick schaltet die Bewegung der Kabel ein oder aus. Ist eine Anlage verbunden, heißt der Chip *Live* und zeigt den beobachteten Zustand |
| Schaltbild | rechnet das Stromschaltbild: brennende Leuchten, Schalterstellungen und Leitungen unter Spannung. Die Schalter lassen sich in der Leiste umlegen; *Schalter zurück* setzt sie zurück, *Vorschläge* bietet fehlende Einträge an. Gerechnet, nicht gemessen |
| Prüfbild | nach Wahl einer Quelle zeigt der Plan an jedem Ankunftsort, welches Bild dort stehen müsste, und zählt offene, vertauschte und ungeprüfte Ankunftsorte |

![Schaltbild eingeschaltet](bilder/de/canvas-modi-04-schaltbild-an.jpg)

![Prüfbild einer Quelle](bilder/de/canvas-modi-08-pruefbild-leiste.jpg)

Beim Prüfbild bietet *Sichern…* *Prüfbild (SVG)*, *Prüfblatt (CSV)* als Begehungsliste und *Abnahmeblatt (CSV)*. *Weg schalten…* öffnet einen Dialog, der den Weg der Quelle zu einem gewählten Ziel über Kreuzschienen schaltet. Er zeigt den Weg und für jedes Gerät ohne erklärtes Steuer-Protokoll einen Hinweis; ohne Protokoll wird nichts gesendet. *Wer schaltet* nimmt einen Namen auf; *jetzt schalten* ist erst nach dem Häkchen frei, dass man die betroffenen Ausgänge gelesen hat und an der laufenden Anlage schaltet.

### Anmerkungen

*Mehr → Anmerkungen* öffnet das Panel *Anmerkungen*. Es filtert nach *alle*, *offen*, *gebaut* und *erledigt*. *+ Neue Anmerkung* legt eine an. *Badges* blendet die Marken der Anmerkungen auf dem Canvas aus und ein.

![Anmerkungen](bilder/de/canvas-anmerkungen-02-panel-offen.jpg)

### Hallenplan

*Mehr → Hallenplan* öffnet das Panel *Hallenplan*.

1. *Hallenplan als Bild oder PDF laden…* lädt den Plan; Bild oder PDF lassen sich auch auf das Panel oder den Canvas ziehen. Bei mehrseitigen PDFs wählt *PDF-Seite* die Seite.
2. *Zuschneiden…*: ein Rechteck über den Teil ziehen, der bleiben soll, dann *Plan zuschneiden*.
3. *Etage* ordnet den Plan einer Etage zu; je Etage ist ein eigener Plan möglich. *Alle Etagen* zeigt einen Plan für alle.
4. Maßstab setzen:
   - *Zwei Punkte*: für Pläne von oben (CAD-Export, Scan). Beide Enden einer bekannten Strecke anklicken.
   - *Vier Ecken*: die vier Ecken einer Fläche bekannter Größe anklicken, links oben beginnend im Uhrzeigersinn; ergibt einen perspektivischen Maßstab.
5. *Kabellängen neu berechnen* rechnet die Längen entlang der gezeichneten Wege.

| Element | Wirkung |
|---|---|
| Deckkraft | Durchsichtigkeit des Plans |
| Position sperren | Klicks gehen an die Geräte durch |
| Bild ersetzen… | lädt einen anderen Plan |
| Venue aus MultiCam / Light Planner importieren… | übernimmt Plan und Maßstab aus einer Venue-Datei der Schwester-Apps |
| Venue für MultiCam / Light Planner exportieren | gibt Plan und Maßstab aus; mit Vier-Ecken-Maßstab nicht möglich |
| Hallenplan entfernen | entfernt den Plan |

Ohne Maßstab rechnet die App mit „Meter pro 100 px“. Kabellängen nutzen den Maßstab des Plans für alle Etagen.

### Symbole

*Mehr → Symbole* öffnet das Panel mit Planzeichen in den Gruppen Elektro, EMA, BMA, SAA / ELA, IT / Netzwerk, Automation, AV und Eigene, mit Suchfeld.

![Symbole](bilder/de/canvas-symbole-02-panel-offen.jpg)

- Ein Symbol auf den Canvas ziehen setzt es. Gesetzte Symbole haben Beschriftung, Größe, Drehung (0°, 90°, 180°, 270°) und lassen sich sperren und löschen.
- *Symbol importieren (SVG, PNG, JPG, WebP)…* legt eigene Symbole unter *Eigene* an; zu große oder unlesbare Dateien lehnt die App ab.
- Mit eingerichtetem KI-Anbieter erzeugt ein Bereich im Panel Symbole aus einer Beschreibung.
- *Symbolliste als CSV (n)* exportiert die gesetzten Symbole.

### Geräte suchen

**Strg+F** oder *Ansicht → Gerät suchen* zeigt das Suchfeld über dem Canvas. Es findet Geräte nach Name und nach Feldern wie IP-Adresse, Seriennummer, MAC-Adresse, VLAN und Notiz und zeigt je Treffer, was angeschlossen ist. Ein Klick auf einen Treffer springt zum Gerät. Das Feld lässt sich mit ⠿ verschieben, mit − einklappen und mit × schließen.

![Suche](bilder/de/canvas-suche-03-treffer.jpg)

### Zoom und Übersichtskarte

Unten links: Vergrößern (+), Verkleinern (−), Einpassen und das Schloss, das das Verschieben und Auswählen auf dem Canvas sperrt. Das Mausrad zoomt. Unten rechts zeigt die Übersichtskarte den ganzen Plan; Ziehen darin verschiebt den Ausschnitt. *Ansicht* bietet zusätzlich *Zoom 100 %* und *Einpassen*.

### Tastenkürzel auf dem Canvas

| Kürzel | Wirkung |
|---|---|
| Pfeiltasten | verschieben die Auswahl um eine Rasterzelle, mit Umschalt um vier |
| Strg+D | dupliziert die Auswahl |
| Strg+C, Strg+V | kopiert und fügt ein |
| Strg++ | legt ein neues Gerät an der Mausposition an |
| Entf | löscht die Auswahl |
| Esc | hebt die Auswahl auf, bricht ein begonnenes Kabel ab |
| Strg+A | wählt alles |
| Strg+F | Suche |
| P | Patchliste |
| A | Pfeile ein und aus |

Alle Kürzel zeigt *Hilfe → Tastaturkürzel…*.
