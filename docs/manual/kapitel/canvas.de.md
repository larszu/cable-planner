## Canvas

Der Canvas ist die Arbeitsfläche, auf der Geräte stehen, Kabel verlaufen und Rahmen Räume bilden. Dieses Kapitel beschreibt die Fläche selbst, die schwebende Werkzeugleiste, die Auswahl, das Zeichnen und Bearbeiten von Kabeln, Rahmen, Etagen, Ebenen, Betriebsarten, Anmerkungen, Hallenplan und Planzeichen. Die Eigenschaften eines markierten Geräts, Kabels oder Rahmens stehen im Kapitel [Inspector](#6-inspector); die Bibliothek links im Kapitel [Bibliothek](#4-bibliothek).

### Der leere Plan und das Beispielprojekt

Ein Plan ohne Geräte zeigt in der Mitte den Hinweis *Noch keine Geräte im Plan*: Ein Gerät aus der Bibliothek links auf die Fläche ziehen. Darunter steht *Beispielprojekt laden*.

1. Starten Sie mit einem leeren Plan.

   ![Leerer Plan mit Hinweis](bilder/de/canvas-start-01-leerer-plan.jpg)

2. Klicken Sie auf *Beispielprojekt laden*. Der Plan zeigt dann Camera 1, Camera 2, Vision mixer, Multiviewer und Control room monitor mit vier Kabeln. Die weiteren Abschnitte dieses Kapitels arbeiten an diesem Beispiel.

   ![Beispielprojekt auf dem Canvas](bilder/de/canvas-start-02-beispiel-geladen.jpg)

Die Fläche lässt sich mit gedrückter Maustaste auf freiem Grund verschieben, mit dem Mausrad zoomen und zeigt unten rechts eine Übersichtskarte.

### Die Werkzeugleiste

Die Werkzeugleiste schwebt oben links über dem Plan. In der Leiste stehen von links nach rechts:

- der Griff zum Verschieben und der Schließen-Knopf,
- *Defaults* (Voreinstellungen für neue Kabel und die Darstellung),
- *Rahmen*,
- *Sprache* (Kabel aus einem Satz anlegen),
- Knöpfe für die Auswahl, solange Geräte markiert sind (Kabel verbinden, Gruppe speichern, Rack, Ausrichten),
- die Ebenen-Chips *Video*, *Audio*, *Control*, *Network*, *Power*, *Other* und eigene Ebenen,
- der Chip der gerade eingeschalteten Betriebsart (Signalweg, Schaltbild, Prüfbild),
- *Mehr*.

![Die Werkzeugleiste](bilder/de/canvas-leiste-01-leiste-ganz.jpg)

Unter *Mehr* stehen die selteneren Schalter: *Ebenen ⋯* (Ebenen verwalten), *Sperren*, *Schema* beziehungsweise *Live*, *Schaltbild*, *Prüfbild*, *Abschließen*, *Badges*, *Anmerkungen*, *Hallenplan* und *Symbole*. Die Knöpfe *Räume* und *3D* erscheinen dort, sobald der Plan Rahmen enthält.

![Mehr geöffnet](bilder/de/canvas-modi-04-schaltbild-an.jpg)

Auf einem Telefon zeigt die Leiste nur den Griff, *Defaults* und *Mehr*; Rahmen, Ebenen und Auswahl-Knöpfe stehen dann unter *Mehr*.

#### Leiste verschieben, schließen und wieder öffnen

1. Ziehen Sie die Leiste am Griff (sechs Punkte links) an eine andere Stelle.

2. Mit dem **×** neben dem Griff schließen Sie die Leiste.

3. Öffnen Sie das Menü *Ansicht*.

   ![Menü Ansicht](bilder/de/canvas-leiste-05-ansicht-menue.jpg)

4. Wählen Sie *Werkzeugleiste*. Die Leiste erscheint wieder.

### Defaults

*Defaults* (Tooltip: *Standard-Verhalten für neue Kabel + Darstellung*) legt fest, wie neue Kabel entstehen und wie der Plan aussieht. Ein Punkt am Knopf zeigt, dass mindestens ein Wert verändert ist.

![Menü Defaults](bilder/de/canvas-defaults-01-menue-offen.jpg)

| Gruppe | Option | Wirkung |
|---|---|---|
| *Kabel-Routing* | *Ortho* | Neue Kabel verlaufen waagerecht und senkrecht. |
| | *Direkt* | Neue Kabel verlaufen geradlinig. |
| | *Kurve* | Neue Kabel verlaufen als Kurve. |
| *Kabelfarbe* | *Nach Typ* | Die Farbe kommt vom Kabeltyp. |
| | *Nach Länge* | Die Farbe richtet sich nach der Länge; der Knopf *?* zeigt die Legende *Längenfarben*. |
| *Sonstiges* | *Pfeil am Kabel-Ende* | Frisch gezogene Kabel bekommen einen Pfeil. |
| | *Kabelbrücken bei Kreuzungen* | Kreuzungen werden als kleine Brücke gezeichnet. Pro Kabel lässt sich das im Kontextmenü überschreiben. |
| | *Alle Kabel-Labels ausblenden* | Die Beschriftungen aller Kabel verschwinden; ihre Lage bleibt gespeichert. |
| | *Kabel-Labels: Kurzform* | Das Format-Suffix (zum Beispiel „(1080p50/60)") wird aus der Anzeige entfernt. Der volle Name bleibt in den Kabel-Eigenschaften. |
| | *Ports nach Connector-Typ einfärben* | Anschlüsse erhalten die Farbe ihres Steckertyps (SDI amber, HDMI violett, Ethernet grün und so weiter). |

Das Routing wirkt auf Kabel, die danach entstehen. Bereits gezeichnete Kabel behalten ihre Form (siehe [Kabel bearbeiten](#kabel-bearbeiten)).

1. Wählen Sie unter *Kabel-Routing* zum Beispiel *Kurve*.

2. Wählen Sie unter *Kabelfarbe* *Nach Länge*. Die Kabel erscheinen in Längenfarben.

   ![Kabelfarbe nach Länge](bilder/de/canvas-defaults-06-farbe-laenge-flaeche.jpg)

3. Der Knopf *?* neben *Nach Länge* blendet die Legende *Längenfarben* ein: 1 m rot, 2 m gelb, 3 m grün, 5 m weiß, 10 m rot, 20 m gelb, 25 m gelb/weiß gestrichelt, 50 m weiß, 100 m rot. *Schließen* blendet sie aus.

   ![Legende der Längenfarben](bilder/de/canvas-defaults-07-farbe-legende.jpg)

4. *Kabelbrücken bei Kreuzungen* zeichnet an Kreuzungen eine Brücke.

   ![Kabelbrücke an einer Kreuzung](bilder/de/canvas-defaults-11-bruecken-flaeche.jpg)

5. *Alle Kabel-Labels ausblenden* entfernt die Beschriftungen vom Plan.

6. *Ports nach Connector-Typ einfärben* färbt die Anschlüsse nach Steckertyp.

   ![Farbige Anschlüsse](bilder/de/canvas-defaults-16-ports-nach-typ-flaeche.jpg)

Zusätzlich färbt der Eintrag *Kabelfarbe nach Gewerk* im Menü *Ansicht* die Kabel nach ihrer Ebene (Video, Audio und so weiter).

### Geräte auswählen

- **Klick** auf ein Gerät markiert es; der Inspector rechts zeigt seine Eigenschaften.
- **Umschalt**, **Strg** oder **Cmd** plus Klick fügt weitere Geräte hinzu oder nimmt sie wieder heraus.
- **Umschalt** gedrückt halten und auf freier Fläche ziehen spannt ein Auswahlrechteck auf.
- *Bearbeiten → Alles auswählen* markiert alle Geräte.
- Ein Klick auf freie Fläche hebt die Auswahl auf.

1. Klicken Sie auf den Kopf von Camera 2.

   ![Ein Gerät markiert](bilder/de/canvas-auswahl-01-ein-geraet.jpg)

2. Klicken Sie mit gedrückter Umschalt-Taste auf den Vision mixer.

   ![Zwei Geräte markiert](bilder/de/canvas-auswahl-04-zwei-geraete.jpg)

3. Ziehen Sie mit gedrückter Umschalt-Taste ein Rechteck über mehrere Geräte.

   ![Auswahlrechteck](bilder/de/canvas-auswahl-07-rechteck.jpg)

4. *Bearbeiten → Alles auswählen* markiert alle fünf Geräte.

Sobald Geräte markiert sind, erscheinen in der Leiste die Knöpfe für Auswahl-Aktionen und über der Auswahl die [Auswahlleiste](#auswahlleiste-am-gerät).

### Geräte ausrichten

Die Ausrichte-Knöpfe stehen in der Leiste, sobald mindestens ein Gerät markiert ist. Alle Ergebnisse rasten auf das Raster ein, wenn *Am Raster ausrichten* eingeschaltet ist.

| Knopf (Tooltip) | Bei einem Gerät | Bei mehreren Geräten |
|---|---|---|
| *Linksbündig* / *An linkem Viewport-Rand ausrichten* | Am linken Rand des sichtbaren Ausschnitts | Linke Kanten bündig |
| *Horizontal zentrieren* | In der Mitte des sichtbaren Ausschnitts | Auf eine gemeinsame senkrechte Mittelachse |
| *Rechtsbündig* | Am rechten Rand des Ausschnitts | Rechte Kanten bündig |
| *Oben ausrichten* | Am oberen Rand des Ausschnitts | Obere Kanten bündig |
| *Vertikal zentrieren* | In der Mitte des Ausschnitts | Auf eine gemeinsame waagerechte Mittelachse |
| *Unten ausrichten* | Am unteren Rand des Ausschnitts | Untere Kanten bündig |
| *Horizontal gleichmäßig verteilen* | – | Ab drei Geräten: gleiche Abstände |
| *Vertikal gleichmäßig verteilen* | – | Ab drei Geräten: gleiche Abstände |

1. Mit einem markierten Gerät richtet *An linkem Viewport-Rand ausrichten* es am Rand des sichtbaren Ausschnitts aus.

   ![Ein Gerät am linken Rand](bilder/de/canvas-auswahl-02-einzeln-links.jpg)

2. Markieren Sie Camera 2, Vision mixer und Multiviewer und klicken Sie *Linksbündig*.

   ![Linksbündig ausgerichtet](bilder/de/canvas-auswahl-09-ausrichten-links.jpg)

3. *Horizontal gleichmäßig verteilen* gleicht die Abstände aus.

   ![Horizontal verteilt](bilder/de/canvas-auswahl-15-ausrichten-verteilen-waagerecht.jpg)

Ausrichten lässt sich mit *Bearbeiten → Rückgängig* zurücknehmen.

### Gerätegruppe speichern

Der Knopf *N markierte Geräte als Gruppe speichern* legt die Auswahl samt Kabeln als Vorlage ab. Die Gruppe steht danach in der Bibliothek unter *Gruppen* und lässt sich auf den Plan ziehen.

1. Markieren Sie mehrere Geräte und klicken Sie auf den Knopf mit den drei Rechtecken. In der Leiste erscheint das Feld *Gruppenname…*.

   ![Feld für den Gruppennamen](bilder/de/canvas-auswahl-17-gruppe-name.jpg)

2. Geben Sie einen Namen ein und klicken Sie auf den grünen Haken (*Gruppe speichern*). In der Bibliothek erscheint die Gruppe unter *Gruppen*.

   ![Gruppe in der Bibliothek](bilder/de/canvas-auswahl-18-gruppe-gespeichert.jpg)

3. Existiert der Name schon, fragt die App *Es existiert bereits eine Vorlage namens „…". Überschreiben?* Mit *Überschreiben* ersetzen Sie die Vorlage.

### Auswahl im Rack-Builder anordnen

Der Knopf *N markierte Geräte im 2D-Rack-Builder anordnen* öffnet den Rack-Builder mit der Auswahl (dasselbe steht im Kontextmenü eines Geräts als *Im Rack-Builder anordnen*). Enthält die Auswahl bereits ein Rack, fehlt der Knopf; ist genau ein Rack markiert, öffnet stattdessen der Knopf *Dieses Rack im 2D-Rack-Builder bearbeiten* den Builder für dieses Rack. Der Builder selbst ist im Kapitel [Rack-Builder](#rack-builder) beschrieben.

![Rack-Builder mit der Auswahl](bilder/de/canvas-auswahl-20-rack-aus-auswahl.jpg)

### Mehrere Kabel zwischen zwei Geräten

Sind genau zwei Geräte markiert, erscheint in der Leiste der Knopf *Kabel verbinden* (Tooltip: *Mehrere Kabel zwischen den zwei markierten Geräten auf einmal anlegen*). Ohne Auswahl öffnet *Werkzeuge → Mehrere Kabel verbinden…* denselben Dialog mit zwei Auswahllisten für Quelle und Ziel.

1. Markieren Sie zwei Geräte, zum Beispiel Camera 2 und Vision mixer.

2. Klicken Sie auf *Kabel verbinden*. Der Dialog *Mehrere Kabel verbinden* erklärt: Er erstellt N Kabel auf einmal, Quell-Port i zu Ziel-Port i; belegte Ziel-Ports werden übersprungen.

   ![Dialog Mehrere Kabel verbinden](bilder/de/canvas-auswahl-22-kabel-verbinden-dialog.jpg)

| Feld | Bedeutung |
|---|---|
| *Quelle → Gerät*, *Seite* | Gerät und Seite (*Outputs* oder *Inputs*), von der die Kabel ausgehen. |
| *Start-Output (1..n)* | Nummer des ersten Quell-Anschlusses. |
| *Ziel → Gerät*, *Seite* | Gerät und Seite (*Inputs* oder *Outputs*), an der sie enden. |
| *Start-Input (1..n)* | Nummer des ersten Ziel-Anschlusses. |
| *Anzahl Kabel* | Wie viele Kabel entstehen. |
| *Kabel-Typ* | Der Kabeltyp aller neuen Kabel; die Farbe kommt vom Typ. |
| *Länge pro Kabel (m)* | Länge aller neuen Kabel. |
| *Vorschau (x/y Kabel)* | Listet die Paare. Übersteigt die Anzahl die freien Anschlüsse, steht dort *Anzahl überschreitet verfügbare Ports — überzählige werden ausgelassen.* |

3. Stellen Sie *Start-Input* und *Anzahl Kabel* ein. Die Vorschau zeigt, welche Paare entstehen.

   ![Werte eingestellt](bilder/de/canvas-auswahl-23-kabel-verbinden-werte.jpg)

4. Klicken Sie auf *N Kabel erstellen*. Eine Meldung nennt, wie viele Kabel entstanden und wie viele übersprungen wurden (*Ziel-Port belegt oder ungültig*).

   ![Kabel erstellt](bilder/de/canvas-auswahl-24-kabel-verbinden-erstellt.jpg)

### Kabel per Sprache

Der Knopf *Sprache* (Tooltip: *Kabel aus einem gesprochenen oder getippten Satz anlegen*) öffnet den Dialog *Kabel per Sprache*. Ein Satz der Form „<Quelle> nach <Ziel>" wird gegen die Namen der Geräte, ihrer Räume und Anschlüsse im Plan gelesen. Es gibt kein Sprachmodell und keine Netzverbindung. Mehrere Kabel trennen Sie mit einem Punkt.

1. Klicken Sie auf *Sprache*. Das Eingabefeld ist aktiv; mit dem Mikrofon-Knopf diktieren Sie, wenn die Spracherkennung verfügbar ist, sonst tippen Sie oder nutzen die Systemdiktierfunktion (macOS: zweimal Fn, Windows: Win+H).

2. Geben Sie einen Satz ein, zum Beispiel „SDI 1 von Camera 1 nach Vision mixer In 3".

3. Klicken Sie auf *Vorschau* oder drücken Sie die Eingabetaste. Die Vorschau zeigt je Satz Quellgerät und -anschluss, Zielgerät und -anschluss. Jede Auswahl lässt sich ändern. Der Knopf unten nennt die Zahl der bereiten Kabel (*N Kabel verbinden*).

   ![Vorschau eines Satzes](bilder/de/canvas-sprache-03-vorschau.jpg)

4. Mehrere Sätze erscheinen untereinander. Ein Satz ohne Treffer zeigt *Kein Treffer – Gerät wählen*; solange dort nichts gewählt ist, zählt er nicht mit. Passen mehrere Geräte, fragt die Vorschau *Welches? (n Treffer)*. Steht ein genanntes Gerät nur in der Bibliothek, bietet die Vorschau *Aus Bibliothek hinzufügen: Name* an; es wird beim Verbinden im Plan angelegt. Ist ein Zielanschluss belegt, fragt die Vorschau *Dieser Eingang hat schon Kabel …. Ersetzen?*. Passen die Signalfamilien nicht zusammen, erscheint der Hinweis, dass wahrscheinlich ein Wandler nötig ist, und es lässt sich ein Wandler einsetzen.

   ![Vorschau mehrerer Sätze](bilder/de/canvas-sprache-04-zwei-saetze.jpg)

5. *N Kabel verbinden* legt die Kabel in einem Schritt an. Ein Rückgängig nimmt alle wieder zurück.

   ![Kabel angelegt](bilder/de/canvas-sprache-05-angelegt.jpg)

### Tastenkürzel auf dem Canvas

| Taste | Wirkung |
|---|---|
| Klick, Umschalt/Strg/Cmd + Klick | Auswählen, zur Auswahl hinzufügen |
| Pfeiltasten | Markierte Geräte um eine Rasterzelle verschieben |
| Umschalt + Pfeiltasten | Um vier Rasterzellen verschieben |
| Strg/Cmd + C, Strg/Cmd + V | Markierte Geräte kopieren und einfügen |
| Strg/Cmd + D | Auswahl duplizieren |
| Strg/Cmd + Plus (oder =) | Ein neues Gerät an der Mausposition anlegen; ein Dialog fragt den Namen. Das Gerät erhält die Kategorie *Other* und keine Anschlüsse. |
| Entf oder Rücktaste | Auswahl löschen (Geräte und Kabel zusammen in einem Schritt) |
| Esc | Ein begonnenes Kabel abbrechen |
| Strg/Cmd + F | Gerätesuche |

Die Tasten wirken nicht, solange der Cursor in einem Textfeld steht.

1. Markieren Sie Camera 2 und drücken Sie die Pfeiltaste nach rechts.

2. Strg/Cmd + D dupliziert das markierte Gerät.

3. Strg/Cmd + Plus fragt nach dem Namen des neuen Geräts.

   ![Dialog Neues Gerät](bilder/de/canvas-kuerzel-06-strg-plus.jpg)

### Kabel ziehen

Kabel entstehen, indem Sie von einem Anschluss zu einem anderen ziehen.

1. Drücken Sie auf den Anschlusspunkt eines Ausgangs (zum Beispiel SDI Out von Camera 2) und ziehen Sie ihn auf einen freien Eingang (zum Beispiel In 3 am Vision mixer).

   ![Kabel wird gezogen](bilder/de/canvas-kabel-01-ziehen.jpg)

2. Beim Loslassen öffnet sich der Dialog *Neues Kabel*. Oben stehen *Von:* und *Nach:*. Die Liste *Kabel* zeigt alle Kabeltypen; ✓ kennzeichnet Typen, die zu beiden Steckern passen, ✕ solche, die nicht passen. *★ Custom-Kabel…* legt einen eigenen Typ an. Weitere Felder sind *Signal-Standard*, *Name*, *Länge (m)*, *Farbe* und *Notizen*; ein grüner Hinweis bestätigt, dass der Typ zu den Steckern passt (zum Beispiel *SDI 3G (1080p50/60) passt zu BNC ↔ BNC.*).

   ![Dialog Neues Kabel](bilder/de/canvas-kabel-02-dialog.jpg)

3. Wählen Sie einen Typ und klicken Sie auf *Erstellen*. Das Kabel erscheint mit Beschriftung und Länge.

   ![Kabel angelegt](bilder/de/canvas-kabel-04-kabel-angelegt.jpg)

Besonderheiten beim Ziehen:

- Ein **belegter Eingang** wird nicht stillschweigend überschrieben. Nach *Erstellen* meldet die App *Port bereits belegt* und nennt das vorhandene Kabel. *Ersetzen* löscht das bestehende Kabel und legt die neue Verbindung an, *Abbrechen* verwirft die neue Verbindung, alles bleibt wie es ist.

  ![Meldung Port bereits belegt](bilder/de/canvas-kabel-05-besetzt.jpg)

- Wer **auf freier Fläche** loslässt, bekommt ein offenes Ende: Die App legt dort ein Gerät „Open …" mit einem Anschluss *Open End* desselben Steckertyps an und öffnet den Dialog *Neues Kabel* dafür.

  ![Kabel zu einem offenen Ende](bilder/de/canvas-kabel-07-offenes-ende.jpg)

- Wer auf den **Körper eines anderen Geräts** loslässt, bekommt dort einen passenden Anschluss neu angelegt und verbunden. So lässt sich auch ein Gerät verkabeln, das erst einen Namen hat.

  ![Loslassen auf dem Gerätekörper](bilder/de/canvas-kabel-09-auf-den-koerper.jpg)

- **Zwei Klicks statt Ziehen:** Ein Klick auf einen Anschluss beginnt das Kabel; Klicks auf freie Fläche setzen Knickpunkte, ein Klick auf einen Anschluss beendet es. Das Banner nennt *Kabel zeichnen: Tippen auf die Fläche setzt einen Knick, Tippen auf einen Port beendet.* *Knick zurück* nimmt den letzten Knick zurück, *Abbrechen* verwirft das Kabel; Esc bricht ebenfalls ab. Ein Eingang lässt sich nur mit einem Ausgang verbinden, nicht mit einem anderen Eingang. Während das Kabel aussteht, zeigt die rechte Seite *Schnelle Vorschläge (Steckertyp)*: bis zu acht Bibliotheksgeräte mit passendem Anschluss, die im Projekt am häufigsten verbunden sind zuerst. Ein Klick auf einen Vorschlag setzt das Gerät an die Mausposition und beendet das Kabel am ersten passenden Anschluss.

  ![Kabel mit Banner und Vorschlägen](bilder/de/canvas-kabel-12-klick-knick.jpg)

Der Standard für *Kabel-Routing* und *Pfeil am Kabel-Ende* aus [Defaults](#defaults) gilt für jedes neue Kabel.

### Kabel bearbeiten

Ein Klick auf ein Kabel markiert es; der Inspector zeigt seine Eigenschaften, ein Doppelklick öffnet den Bearbeiten-Dialog. Am markierten Kabel erscheinen Griffe.

1. Klicken Sie auf ein Kabel.

   ![Markiertes Kabel mit Griffen](bilder/de/canvas-kabeleditor-01-gewaehlt.jpg)

2. Ziehen Sie ein Segment, um den Verlauf zu verschieben.

3. Ziehen Sie eine Ecke, um den Knick zu verlegen.

   ![Ecke verschoben](bilder/de/canvas-kabeleditor-03-ecke-ziehen.jpg)

4. Rechtsklick auf das Kabel öffnet das Kabel-Menü.

   ![Kabel-Menü](bilder/de/canvas-kabeleditor-04-menue.jpg)

| Eintrag | Wirkung |
|---|---|
| *Bezeichnung ändern…* | Fragt die Beschriftung des Kabels ab. |
| *Anmerkung hinzufügen…* | Heftet eine Anmerkung an das Kabel. |
| *In Plan übernehmen (Handy-Vorschlag akzeptieren)* / *Mobile-Haken entfernen* | Nur bei Kabeln, die vom Handy vorgeschlagen oder abgehakt wurden. |
| *Signal messen* | Öffnet die Scopes für den Strom, den das Gerät am Kabelanfang sendet. Ausgegraut, wenn das Quellgerät keinen Strom hat, den die App öffnen kann (RTSP, RTMP, SRT, HLS, MJPEG; Eigenschaften → Streams). |
| *Wegpunkt hier hinzufügen* | Fügt am Klickpunkt einen Wegpunkt ein. |
| *Nächsten Wegpunkt entfernen* | Entfernt den Wegpunkt, der dem Klick am nächsten liegt. |
| *Alle Wegpunkte löschen (n)* | Entfernt alle Wegpunkte des Kabels. |
| *Automatisch neu routen* | Berechnet den Verlauf neu. |
| *Routing:* *Orthogonal* / *Direkt* / *Geschwungen* | Stellt die Form dieses Kabels ein. |
| *Kabelbrücken für dieses Kabel* | Überschreibt die globale Einstellung; *Override entfernen (global folgen)* nimmt das zurück. |
| *Pfeil am Ende*, *Pfeil am Anfang* | Blendet den Pfeil ein oder aus. |
| *Bidirektional* | Schaltet Pfeile an beiden Enden ein oder aus. |
| *Off-Page-Verbindung erstellen…* | Siehe [Seitenverbinder](#seitenverbinder). |
| *Kabel löschen* | Fragt *Kabel „…" löschen?* und entfernt es nach Bestätigung. |

5. *Wegpunkt hier hinzufügen* setzt einen Wegpunkt auf das Kabel.

6. Unter *Routing:* wählen Sie die Form des Kabels.

7. *Pfeil am Ende* blendet den Pfeil aus.

8. *Bezeichnung ändern…* öffnet ein Eingabefeld für die Beschriftung.

9. Ein Doppelklick auf ein Kabel öffnet den Dialog zum Bearbeiten des Kabels; die Felder sind im Kapitel [Inspector](#6-inspector) beschrieben.

   ![Doppelklick auf ein Kabel](bilder/de/canvas-kabeleditor-19-doppelklick.jpg)

### Seitenverbinder

Eine Off-Page-Verbindung ersetzt die durchgehende Linie eines Kabels an jedem Ende durch ein kleines Verbindersymbol. Das hält Pläne lesbar, in denen zwei Geräte weit auseinanderstehen. Alle Off-Page-Kabel mit demselben Netznamen bilden ein Netz.

1. Rechtsklick auf das Kabel, *Off-Page-Verbindung erstellen…*. Die App fragt *Netzname / Signalname für die Off-Page-Verbindung:*; vorbelegt ist der Kabelname.

   ![Frage nach dem Netznamen](bilder/de/canvas-seitenverbinder-01-erstellen-frage.jpg)

2. Mit *OK* wird das Kabel zur Off-Page-Verbindung. Jedes Verbindersymbol nennt das Gegenstück (*Gerät · Port*), ein Pfeil zeigt die Signalrichtung. Ein Klick auf den Pfeil springt zum nächstgelegenen Gegenstück.
3. Der Netzname erscheint beim Zeigen auf das Symbol; der Eintrag *Off-Page-Namen anzeigen* im Menü *Ansicht* blendet ihn dauerhaft ein.
4. Rechtsklick auf ein Symbol öffnet die Netz-Info: Zahl der Endpunkte, eine Sprungliste und *Off-Page auflösen*, das die Linie wiederherstellt.

### Rahmen

Ein Rahmen ist ein farbiges Rechteck, das Geräte zu einem Ort oder Raum zusammenfasst. Der Knopf *Rahmen* der Leiste legt einen neuen Rahmen („Neue Location") in der Mitte des sichtbaren Ausschnitts an. Sind Geräte markiert, trägt der Knopf den Tooltip *Rahmen um die N markierten Geräte* und zieht den Rahmen um sie.

1. Klicken Sie ohne Auswahl auf *Rahmen*.

   ![Neuer Rahmen](bilder/de/canvas-rahmen-01-rahmen-leer.jpg)

2. Ein Doppelklick auf den Rahmen fragt *Location umbenennen:*.

3. Ein Klick auf den Rahmen zeigt im Inspector die Rahmen-Eigenschaften (Name, Breite, Tiefe, Fläche, Stockwerk, Farbe, Steigschacht, Raumnummer, Adresse, Notizen); sie sind im Kapitel [Inspector](#6-inspector) beschrieben.

4. An den Griffen des markierten Rahmens ändern Sie die Größe.

5. Ziehen Sie den Rahmen an seinem Titel. Die Geräte, deren Mittelpunkt im Rahmen liegt, wandern mit.

   ![Rahmen mit Geräten verschoben](bilder/de/canvas-rahmen-14-rahmen-nimmt-mit.jpg)

6. Das Schloss am Rahmentitel sperrt Verschieben und Größenänderung; die Einstellungen bleiben erreichbar.

7. Rechtsklick auf den Rahmen öffnet das Menü mit *Position sperren* (beziehungsweise *Position entsperren*) und *Rahmen löschen*.

   ![Kontextmenü eines Rahmens](bilder/de/canvas-rahmen-09-rahmen-kontext.jpg)

8. *Rahmen löschen* fragt *Rahmen „…" löschen?* — nur der Rahmen verschwindet, die Geräte bleiben.

9. Markieren Sie mehrere Geräte und klicken Sie *Rahmen*, um einen Rahmen um sie zu ziehen.

   ![Rahmen um die Auswahl](bilder/de/canvas-rahmen-13-rahmen-um-auswahl-fertig.jpg)

### Räume, Etagen und 3D-Gebäudeansicht

Jeder Rahmen ist ein Raum. Rahmen lassen sich Etagen zuordnen; sie bestimmen die Sichtbarkeit im Plan und die Stapelung in der 3D-Ansicht. Die Knöpfe *Räume* und *3D* stehen unter *Mehr*, sobald der Plan mindestens einen Rahmen enthält.

1. Legen Sie Rahmen an (hier Studio, Regie, Technik).

2. Markieren Sie einen Rahmen. Im Inspector öffnet die Auswahl *Stockwerk* mit dem Eintrag *Etage hinzufügen…* eine Abfrage *Name der neuen Etage (z. B. „3. OG")*.

   ![Etage hinzufügen](bilder/de/canvas-raeume-05-etage-neu.jpg)

3. Die Etage steht danach im Feld *Stockwerk*.

4. Im Inspector zeigt der Abschnitt *Etagen (n)* die Etagen von unten nach oben mit ihrer Fußbodenhöhe in Metern; mit den Pfeilen ändern Sie die Reihenfolge, der Papierkorb entfernt eine Etage, *Etage hinzufügen…* ergänzt eine weitere.

   ![Etagen mit Höhen](bilder/de/canvas-raeume-08-etage-hoehen.jpg)

5. *Steigschacht / senkrechte Trasse* kennzeichnet einen Rahmen, der in der 3D-Ansicht durch alle Etagen geht; Kabel zwischen Etagen verlaufen dann durch ihn statt als Luftlinie.

6. *Mehr → Räume* öffnet eine Liste, gegliedert nach Etagen (oberste zuerst). Jede Etage und jeder Raum hat ein Häkchen; Räume ohne Etage stehen unter *Ohne Etage*.

   ![Liste der Räume](bilder/de/canvas-raeume-11-raeume-menue.jpg)

7. Nehmen Sie das Häkchen bei einem Raum weg: Seine Geräte und Kabel verschwinden vom Plan. Die Beschriftung des Knopfes lautet dann *Räume (n ausgeblendet)*.

8. Das Häkchen einer Etage blendet alle Räume dieser Etage aus.

9. *Alle zeigen* blendet alles wieder ein. Mehrere Räume lassen sich gleichzeitig ausblenden.

10. *Mehr → 3D* öffnet *Gebäude 3D*: die Räume nach Etagen gestapelt, dazwischen die Verbindungen.

    ![Gebäude 3D mit Raumverbindungen](bilder/de/canvas-raeume-17-drei-d-raeume.jpg)

11. Unter *Anzeigen* wechseln Sie zwischen *Raumverbindungen* und *Einzelne Kabel*.

    ![Einzelne Kabel in 3D](bilder/de/canvas-raeume-18-drei-d-kabel.jpg)

12. *Beschriftung* blendet die Namen ein oder aus. *Geschosshöhe (m)* gilt nur für Etagen ohne eingetragene Höhe; die Ansicht weist darauf hin, dass dies eine Annahme ist.

Geräte lassen sich in der 3D-Ansicht ziehen. Bodentanks erscheinen als flache Platte im Boden, andere Geräte als Würfel. Ziehen neben ein Gerät dreht die Ansicht, das Mausrad zoomt.

### Ebenen

Die Ebenen-Chips blenden die Kabel einer Ebene ein und aus. Nur die Kabel werden gefiltert, die Geräte bleiben. Ein farbiger Punkt kennzeichnet die Signalart; der Tooltip nennt die Zahl der Kabel (zum Beispiel *Video — 4 Kabel · sichtbar (klick: ausblenden)*).

1. Die Leiste zeigt *Video*, *Audio*, *Control*, *Network*, *Power* und *Other*.

   ![Ebenen-Chips](bilder/de/canvas-ebenen-01-chips.jpg)

2. Klicken Sie auf *Video*: Die Videokabel verschwinden.

   ![Ebene Video ausgeblendet](bilder/de/canvas-ebenen-02-video-aus.jpg)

3. *Mehr → Ebenen ⋯* öffnet das Verwaltungsmenü: *Custom-Layer anlegen…* und *Alle Ebenen wieder einblenden*.

   ![Menü Ebenen](bilder/de/canvas-ebenen-03-menue.jpg)

4. *Custom-Layer anlegen…* fragt den Namen (zum Beispiel „intercom"). Die neue Ebene erscheint als Chip mit Rautensymbol.

   ![Eigene Ebene anlegen](bilder/de/canvas-ebenen-05-eigene-anlegen.jpg)

5. Rechtsklick (auf dem Telefon langer Druck) auf den Chip einer eigenen Ebene fragt *Custom-Layer „…" entfernen?*.

### Signalweg

Der Signalweg hebt die ganze Kette hervor, in der ein Kabel liegt, und dunkelt den Rest ab.

1. Markieren Sie ein Kabel.

2. Klicken Sie im Inspector auf *Signalweg zeigen*.

   ![Signalweg gezeigt](bilder/de/canvas-signalweg-02-signalweg-zeigen.jpg)

3. In der Leiste steht der Chip *Signalweg: n Kabel, m Geräte*. Ein Klick darauf oder Esc beendet die Ansicht.


### Betriebsarten: Schema, Schaltbild, Prüfbild

#### Schema und Live

Der Knopf *Schema* unter *Mehr* zeigt, woher der Plan sein Bild nimmt: *Schema* heißt, es ist der geplante Weg ohne Verbindung zu einer Anlage; *Live* heißt, der beobachtete Zustand eines Mischers oder einer Kreuzschiene wird gezeigt (mit Alter in Sekunden). Reißt die Verbindung ab, steht *· Verbindung verloren* und die Ansicht fällt auf den geplanten Weg zurück. Ein Klick auf den Chip schaltet nicht die Betriebsart um, sondern die Bewegung der Darstellung ein oder aus; hat das Betriebssystem Bewegung abgeschaltet, bleibt die Ansicht ruhig.


#### Schaltbild

*Schaltbild* rechnet Stromkreise: welche Leuchten brennen, welche Schalterstellungen gelten, welche Leitungen unter Spannung stehen. Das Ergebnis ist gerechnet und nicht gemessen; die Schalterstellungen gehören nicht zum Plan. Berücksichtigt werden nur Geräte, die in ihren Eigenschaften eine Schaltbild-Bauart tragen; sie wird nicht aus der Kategorie geraten. Steht kein Gerät mit Bauart im Plan, zeigt der Chip *· nichts angegeben*.

1. Schalten Sie *Schaltbild* ein. Der Chip nennt die brennenden von allen Leuchten (zum Beispiel „1/1").


2. Mit *Schalter zurück* gehen alle Schalter in ihre Grundstellung; der Plan ändert sich dadurch nicht. *Vorschläge* erklärt, warum die Schaltung nicht tut, was sie soll, und welche Ader das ändern würde; jeder Vorschlag bringt seine Wahrheitstafel mit, nichts wird ohne Klick eingetragen.


#### Prüfbild

*Prüfbild* ist eine Erwartung, kein Videobild: Nach der Wahl einer Quelle zeigt der Plan an jedem Ankunftsort, welches Bild dort stehen müsste. Die App sieht nicht, was wirklich ankommt.

1. Öffnen Sie *Mehr* und wählen Sie unter *Prüfbild* eine Quelle (die Liste enthält jedes Gerät mit einem Ausgang, zuerst *keine*).

2. Der Plan zeigt das Prüfbild an der Quelle und an jedem Ankunftsort, mit der Aufschrift *Erwartung laut Plan*. Die Leiste zeigt den Chip *Prüfbild* mit Quelle, Zahl der Ankunftsorte und den Zählern *· n offen*, *· n vertauscht*, *· n ungeprüft*.

   ![Prüfbild gewählt](bilder/de/canvas-modi-07-pruefbild-gewaehlt.jpg)

3. An jedem Ankunftsort tragen Sie ein, was Sie vor Ort gesehen haben: *stimmt*, *anderes Bild…* (dann den Namen, der darauf steht, und *merken*), *kein Bild* oder *kein Monitor*. Der Befund steht danach farbig am Ankunftsort (stimmt, noch offen, vertauscht oder eine andere Abweichung) und fließt in die Zähler der Leiste ein.

   ![Prüfbild-Leiste](bilder/de/canvas-modi-08-pruefbild-leiste.jpg)

4. *Sichern…* bietet drei Dateien an: *Prüfbild (SVG)* für Mediaplayer, Standbild-Speicher oder Laptop (die App speist nichts ein), *Prüfblatt (CSV)* als Liste zum Abgehen, auch mit Wegen, die der Plan nicht zu Ende kennt, und *Abnahmeblatt (CSV)* mit dem, was gesehen wurde, samt Zeitpunkt.

5. *Weg schalten…* erscheint, wenn auf einem Weg der Quelle eine Kreuzschiene liegt. Der Dialog setzt die Kreuzpunkte des Plans an der laufenden Anlage.


   Unter *Wohin soll das Bild?* wählen Sie das Ziel; der Dialog zeigt den Weg (zum Beispiel Camera 1 → Videohub 12x12 → Control room monitor) und die gesendeten Befehle. Ist für das Gerät kein Steuer-Protokoll erklärt (Eigenschaften → Steuerung), wird nichts gesendet. *Wer schaltet* nimmt einen Namen auf. *jetzt schalten* ist nur möglich, wenn der Plan Befehle enthält, nichts im Weg steht (zum Beispiel ein fehlendes Steuer-Protokoll) und der Haken *Ich habe gelesen, welche Ausgänge umgeschaltet werden, und schalte an der laufenden Anlage.* gesetzt ist.

Die Wahl *keine* beendet das Prüfbild.

### Sperren

*Mehr → Sperren* schützt vor versehentlichem Verschieben. Das Menü hat drei Schalter:

| Schalter | Wirkung |
|---|---|
| *Rahmen* | Keine Frame-Verschiebung |
| *Geräte* | Keine Geräte-Verschiebung |
| *Kabel* | Keine Waypoint-Bearbeitung (die Griffe am Kabel entfallen) |

Der Knopf zeigt die Zahl der aktiven Schalter (zum Beispiel *Sperren 1/3*).

1. Öffnen Sie *Sperren*.

   ![Menü Sperren](bilder/de/canvas-sperren-01-menue.jpg)

2. Schalten Sie *Geräte* ein. Die Geräte lassen sich nicht mehr ziehen.

   ![Geräte gesperrt](bilder/de/canvas-sperren-02-geraete.jpg)

3. Mit *Kabel* gesperrt zeigt ein markiertes Kabel keine Griffe.

   ![Kabel ohne Griffe](bilder/de/canvas-sperren-05-kabel-ohne-griffe.jpg)

Einzelne Geräte und Rahmen lassen sich außerdem im Kontextmenü mit *Position sperren* festsetzen.

### Plan abschließen

*Mehr → Abschließen* sperrt den ganzen Plan: keine Verschiebungen, keine neuen Verbindungen, keine Löschungen. Der Eintrag zeigt danach *Abgeschlossen*.

1. Klicken Sie auf *Abschließen*. Die App fragt *Planung abschließen?* und erklärt, dass der Canvas gesperrt wird und die Sperre jederzeit aufgehoben werden kann.

   ![Rückfrage Planung abschließen](bilder/de/canvas-abschliessen-02-frage.jpg)

2. Nach *Abschließen* erscheint über dem Plan das Banner *Plan ist abgeschlossen — Änderungen sind gesperrt.* mit dem Knopf *Bearbeitung freigeben*.

   ![Abgeschlossener Plan](bilder/de/canvas-abschliessen-03-abgeschlossen.jpg)

3. *Bearbeitung freigeben* (oder erneut der Eintrag unter *Mehr*) fragt *Planung wieder zur Bearbeitung freigeben?*; *Freigeben* hebt die Sperre auf.

   ![Rückfrage Freigeben](bilder/de/canvas-abschliessen-05-freigeben-frage.jpg)

Eine Viewer-Datei (`.cpviewer`) ist dauerhaft schreibgeschützt; der Eintrag heißt dann *Viewer* und ist nicht bedienbar.

### Anmerkungen

Anmerkungen sind Notizen am Plan, frei oder an ein Gerät oder Kabel geheftet. Zwei Einträge unter *Mehr* gehören dazu: *Badges* blendet die Marken der Anmerkungen auf dem Plan ein oder aus (die Daten bleiben), *Anmerkungen* öffnet das Panel.

1. Öffnen Sie *Anmerkungen*. Das Panel zeigt oben die Filter *alle*, *offen*, *gebaut*, *erledigt* und den Knopf *+ Neue Anmerkung*.

   ![Panel Anmerkungen](bilder/de/canvas-anmerkungen-02-panel-offen.jpg)

2. Klicken Sie auf *+ Neue Anmerkung* und schreiben Sie den Text.

3. *Hinzufügen* fragt beim ersten Mal nach Ihrem Namen; er wird allen Anmerkungen angeheftet, die Sie erstellen.

4. Die Anmerkung steht danach in der Liste.

   ![Anmerkung angelegt](bilder/de/canvas-anmerkungen-06-hinzugefuegt.jpg)

5. Jede Anmerkung hat einen Status (*offen*, *gebaut*, *erledigt*); die Filter zeigen nur die Anmerkungen eines Status.

6. Mit dem Knopf zum Platzieren in der Mitte erscheint die Marke in der Mitte des Plans; ziehen Sie den Griff einer Anmerkung auf ein Gerät, um sie dort anzuheften.

   ![Anmerkung am Gerät](bilder/de/canvas-anmerkungen-13-an-geraet.jpg)

7. Ein Klick auf die Marke auf dem Plan zeigt die Anmerkung.

8. *Badges* blendet die Marken aus.

9. Löschen fragt *Anmerkung löschen?*.

Rechtsklick auf ein Gerät oder ein Kabel bietet außerdem *Anmerkung hinzufügen…*: Nach der Frage nach Text (und beim ersten Mal nach Ihrem Namen) wird die Anmerkung an das Gerät oder Kabel geheftet. Im Viewer-Modus lädt der Eintrag *Anmerkungen* Prüfer ein, Notizen zu hinterlassen (Tooltip: *Anmerkungen — als Reviewer Notizen hinterlassen*).

### Hallenplan

*Mehr → Hallenplan* (auch im Menü *Ansicht*) legt ein Bild oder ein PDF unter den Plan. Es dient als Maßstab für Kabellängen und als räumliche Vorlage.

1. Öffnen Sie *Hallenplan*. Das Panel bietet *Hallenplan als Bild oder PDF laden…*, *Venue aus MultiCam / Light Planner importieren…* und den Hinweis, dass sich ein Bild oder PDF auch hierher oder auf den Canvas ziehen lässt.

   ![Leeres Panel Hallenplan](bilder/de/canvas-hallenplan-02-panel-leer.jpg)

2. Laden Sie ein Bild (PNG, JPG, WebP, GIF, BMP oder AVIF bis 40 MB). Es liegt unter den Geräten. Die App meldet *Hallenplan geladen. Als Nächstes den Maßstab setzen — bis dahin rechnen die Längen mit „Meter pro 100 px".*

   ![Hallenplan geladen](bilder/de/canvas-hallenplan-03-bild-geladen.jpg)

3. *Deckkraft* regelt, wie stark das Bild durchscheint.

4. *Position sperren (Klicks gehen an die Geräte durch)* macht das Bild unempfindlich für Klicks.

Den **Maßstab** setzen Sie auf zwei Wegen.

5. *Zwei Punkte* (für Pläne von oben, CAD-Export, Scan): Tragen Sie die bekannte Strecke in Metern ein und klicken Sie *Zwei Punkte*. Die App sagt *Klicke beide Enden einer Strecke von N m an.*

6. Nach dem zweiten Klick steht im Panel *Maßstab aus N m Referenz: … cm je Canvas-Pixel.*

   ![Maßstab aus zwei Punkten](bilder/de/canvas-hallenplan-09-zwei-punkte-fertig.jpg)

7. *Vier Ecken* (für Fotos, Schilder und isometrische Zeichnungen): Tragen Sie Breite × Tiefe einer rechteckigen Bodenfläche in Metern ein und klicken Sie nacheinander die vier Ecken an: links oben, rechts oben, rechts unten, links unten. Bilden die Punkte kein Rechteck, meldet die App das.

   ![Vier Ecken in falscher Reihenfolge](bilder/de/canvas-hallenplan-11-vier-ecken-falsch.jpg)

8. Danach steht *Perspektivischer Maßstab aus einer B × T m großen Fläche.*

9. *Kabellängen neu berechnen* ermittelt die Längen entlang der gezeichneten Wege (*n Kabellängen entlang ihres gezeichneten Wegs neu berechnet.*).

10. *Bild ersetzen…* fragt *Hallenplan ersetzen?* — die Maßstab-Kalibrierung geht verloren und muss neu gesetzt werden.

11. Eine Datei, die kein Bild ist, weist die App ab: *Diese Datei ist kein Hallenplan-Bild. Verwende PNG, JPG, WebP, GIF, BMP oder AVIF.*

**PDF.** Ein PDF wird als Bild der Seite geladen. Hat es mehrere Seiten, erscheint im Panel *PDF-Seite* mit der Seitennummer und *von n*; eine andere Seite ersetzt den Plan an derselben Stelle mit derselben Deckkraft.

12. Laden Sie ein PDF.

13. Wählen Sie eine andere Seite.

    ![PDF-Seite gewählt](bilder/de/canvas-hallenplan-21-pdf-seite.jpg)

14. *Zuschneiden…* öffnet im Panel eine Vorschau mit dem Hinweis *Ein Rechteck über den Teil des Plans ziehen, der bleiben soll.* Ziehen Sie das Rechteck auf und klicken Sie *Plan zuschneiden*; *Abbrechen* verwirft es.

    ![Zuschnitt aufgezogen](bilder/de/canvas-hallenplan-23-zuschnitt-rahmen.jpg)

15. Der Plan zeigt nur noch den gewählten Ausschnitt.

    ![Zugeschnittener Plan](bilder/de/canvas-hallenplan-24-zugeschnitten.jpg)

**Eine Etage je Plan.** Sobald der Plan Etagen hat, steht im Panel oben die Auswahl *Etage* mit *Alle Etagen* und den Etagennamen; jede Etage hat ihren eigenen Hallenplan. Für Kabellängen gilt der Maßstab des Plans für alle Etagen (*Kabellängen nutzen den Maßstab des Plans für alle Etagen.*).

**Venue-Austausch.** *Venue aus MultiCam / Light Planner importieren…* liest eine Venue-Datei der Schwester-Apps samt Hallenplan und Maßstab. Fehlerfälle meldet das Panel: *Das ist keine Venue-Austauschdatei (MultiCam / Light Planner).*, *Die Venue-Datei enthält kein Hallenplan-Bild.*, *Die Venue-Datei enthält einen Hallenplan ohne reale Maße.* *Venue für MultiCam / Light Planner exportieren* schreibt den Plan zurück; der Austausch kennt einen Maßstab je Plan, deshalb ist der Knopf nach einer Vier-Ecken-Kalibrierung gesperrt.

16. Import einer Venue-Datei.

17. *Hallenplan entfernen* nimmt das Bild wieder weg.

### Planzeichen

*Mehr → Symbole* (auch im Menü *Ansicht*) öffnet das Panel *Symbole* mit Planzeichen, die nicht zu den Geräten zählen: Steckdosen, Melder, Lautsprecher, Netzwerkdosen und Ähnliches.

1. Öffnen Sie *Symbole*. Oben stehen die Kategorien *Elektro*, *EMA*, *BMA*, *SAA / ELA*, *IT / Netzwerk*, *Automation*, *AV* und *Eigene*; darunter das Suchfeld *Symbole suchen…* und die Symbole der Kategorie.

   ![Panel Symbole](bilder/de/canvas-symbole-02-panel-offen.jpg)

2. Jede Kategorie enthält feste Symbole, zum Beispiel unter *Elektro* Steckdose, Schutzkontakt-Steckdose, Schalter, Taster, Leuchte, Verteiler, Sicherung, FI-Schutzschalter, Zähler, Erdung, Motor, Transformator, Abzweigdose und CEE-Steckdose; unter *AV* Kamera, Monitor, Beamer, Leinwand, Stagebox, Rack, Bodentank und Kabelbrücke.

   ![Kategorie AV](bilder/de/canvas-symbole-09-kategorie-av.jpg)

3. Ein Klick auf ein Symbol (Tooltip *Auf dem Canvas platzieren*) setzt es auf den Plan.

   ![Symbol platziert](bilder/de/canvas-symbole-12-platziert.jpg)

4. Ein markiertes Symbol hat die Felder *Beschriftung*, *Größe*, *Drehung* (0°, 90°, 180°, 270°), *Position sperren* und *Symbol löschen*.

   ![Eigenschaften eines Symbols](bilder/de/canvas-symbole-15-drehung.jpg)

5. *Symbol importieren (SVG, PNG, JPG, WebP)…* legt eigene Zeichen unter *Eigene* ab. SVG darf höchstens 200 KB haben, Rasterbilder höchstens 512 KB. Ein ungenutztes eigenes Symbol lässt sich mit dem **×** an seiner Kachel wieder aus der Bibliothek entfernen.

6. Mit hinterlegtem KI-Anbieter erzeugt *Symbol erzeugen* aus einer Beschreibung ein Symbol und legt es unter *Eigene* ab. Die App weist darauf hin, das Ergebnis zu prüfen: Es ist die Zeichnung eines Modells, kein Normzeichen.

7. *Symbolliste als CSV (n)* exportiert die platzierten Symbole mit Kategorie, Anzahl und Beschriftungen.

   ![Symbolliste als CSV](bilder/de/canvas-symbole-29-liste-csv.jpg)

### Gerätesuche

*Strg/Cmd + F* oder *Ansicht → Gerät suchen* öffnet über dem Plan die Suchleiste *Gerät suchen…*. Sie lässt sich verschieben, zu einer Pille einklappen und schließen (*Suche schließen*); Strg/Cmd + F und das Menü *Ansicht* holen sie zurück.

1. Die Suche steht als Pille über dem Plan.

   ![Suche als Pille](bilder/de/canvas-suche-01-pille.jpg)

2. Strg/Cmd + F klappt sie auf.

3. Tippen Sie einen Begriff. Die Liste zeigt Treffer mit dem Feld, in dem er gefunden wurde. Durchsucht werden Name, Kurzname, IP, MAC, VLAN, Asset-Tag, Interne Nr., Seriennummer, Etiketten-Code, Switch-Port, Kategorie, Untertitel und Notiz.

   ![Treffer](bilder/de/canvas-suche-03-treffer.jpg)

4. Ein Klick auf einen Treffer zentriert den Plan auf das Gerät und schließt die Suche. Ohne Treffer steht *Keine Treffer*.

   ![Springen zum Treffer](bilder/de/canvas-suche-06-springen.jpg)

### Zoom und Navigation

Unten links stehen die Regler *Vergrößern*, *Verkleinern*, *Einpassen* und der Knopf zum Sperren der Interaktion. Unten rechts zeigt die Übersichtskarte den ganzen Plan; ein Klick darauf oder Ziehen springt zur Stelle. Das Mausrad zoomt zwischen 10 % und 400 %; mit gedrückter Maustaste auf freier Fläche verschieben Sie den Plan. Das Menü *Ansicht* bietet *Einpassen*, *Zoom 100 %*, *Vergrößern*, *Verkleinern* und *Vollbild*.

![Regler und Übersichtskarte](bilder/de/canvas-zoom-01-regler-minikarte.jpg)

1. *Vergrößern* zoomt hinein.

2. *Einpassen* zeigt alle Geräte.

   ![Plan eingepasst](bilder/de/canvas-zoom-06-einpassen.jpg)

3. Der Schloss-Knopf sperrt die Interaktion: Der Plan lässt sich dann weder verschieben noch zoomen.

4. *Ansicht → Zoom 100 %* setzt den Maßstab zurück.

### Kontextmenüs

**Gerät** (Rechtsklick auf ein Gerät):

| Eintrag | Wirkung |
|---|---|
| *Rack-Editor öffnen* | Nur bei einem Rack: öffnet den Rack-Builder dafür. |
| *Anmerkung hinzufügen…* | Fragt (beim ersten Mal) Ihren Namen und den Text und heftet die Anmerkung an das Gerät. |
| *Geräte-Datenblatt…* | Öffnet das Datenblatt (eine A4-Seite) für das Gerät beziehungsweise die Auswahl. |
| *Scopes…* / *Scopes vergleichen* | Nur in der Desktop-App und wenn die Geräte Ströme haben, die die App öffnen kann. |
| *Im Rack-Builder anordnen* / *N Geräte im Rack-Builder anordnen* | Öffnet den Rack-Builder mit dem Gerät beziehungsweise der Auswahl. |
| *Position sperren* / *Position entsperren* | Hält das Gerät an seinem Ort. |
| *Gerät löschen* | Fragt *Gerät „…" löschen?* — das Gerät und alle angeschlossenen Kabel werden gelöscht. |

![Kontextmenü eines Geräts](bilder/de/canvas-kontext-01-geraet.jpg)

![Geräte-Datenblatt](bilder/de/canvas-kontext-02-geraet-datenblatt.jpg)

**Freie Fläche:** Rechtsklick bietet *Neues Gerät hier …*. Es öffnet *Eigenes Gerät anlegen* mit Name, Kategorie, Port-Gruppen und den Knöpfen *In Bibliothek speichern*, *Nur im Projekt platzieren* und *Speichern + Platzieren*; der Dialog ist im Kapitel [Eigenes Gerät anlegen](#eigenes-gerät-anlegen) beschrieben.

![Kontextmenü der freien Fläche](bilder/de/canvas-kontext-08-flaeche.jpg)

**Kabel** und **Rahmen**: siehe [Kabel bearbeiten](#kabel-bearbeiten) und [Rahmen](#rahmen).

### Auswahlleiste am Gerät

Über einer Auswahl erscheint eine kleine Leiste mit Schnellaktionen.

| Auswahl | Knöpfe |
|---|---|
| Ein Gerät | *Duplizieren*, *Rahmen um Auswahl*, *Geräte-Datenblatt (A4-PDF / Druck)*, *Löschen* |
| Zwei Geräte | zusätzlich die sechs Ausrichte-Knöpfe |
| Drei und mehr Geräte | zusätzlich *Horizontal verteilen* und *Vertikal verteilen* |

Bei Geräten mit lesbaren Strömen kommt *Scopes vergleichen (ein Parade je Quelle)* hinzu.

![Auswahlleiste an einem Gerät](bilder/de/canvas-inline-01-ein-geraet.jpg)

![Auswahlleiste bei drei Geräten](bilder/de/canvas-inline-04-drei-geraete.jpg)

### Standbild unter dem Gerät

Für ein Gerät, das einen Stream oder ein Standbild liefert, zeigt der Canvas unter dem Gerät eine Kachel. Sie wird im Inspector unter *Streams* eingeschaltet (*Standbild unter dem Gerät im Canvas zeigen*, mit einer *Standbild-Adresse für die Vorschau*). Die Kachel startet nicht von selbst: *Vorschau starten · Name* holt ein Standbild, danach alle 10 Sekunden, solange die Kachel sichtbar ist. Ist es ein Live-Stream, spielt die Kachel ihn ab, bis *Live beenden* gewählt wird. Die Kachel nennt den Grund, wenn kein Bild kommt, zum Beispiel *Keine Vorschau: die Adresse liegt nicht im lokalen Netz.*, *Keine Vorschau: ffmpeg wurde nicht gefunden …* oder *Keine Vorschau: das Gerät ist nicht erreichbar.* Standbilder holt nur die Desktop-App.

![Gerät mit Streams-Abschnitt](bilder/de/canvas-stream-02-abschnitt-streams.jpg)


### Adapter und Wandler im Kabel

Beim Anlegen eines Kabels prüft die App, ob die Stecker zusammenpassen. Der Dialog *Neues Kabel* nennt dann den Grund und was dazwischengehört:

- gleiches Geschlecht an beiden Enden: ein Geschlechtswandler,
- Stecker, die nicht ineinandergehen: ein Adapter,
- verschiedene Signalfamilien: ein Konverter, ein Gerät mit Strom und Bandbreitengrenze, das Sie selbst wählen.

Nach dem Anlegen bietet der Inspector des Kabels *Einsetzen*; es setzt den Adapter als eigenes Gerät in die Strecke (*In diesen Lauf einsetzen — ein Undo nimmt es wieder heraus*). Ein Adapter gehört als Gerät in den Plan, sonst steht er weder im Signalweg noch auf der Packliste.

![Dialog bei verschiedenen Steckern](bilder/de/canvas-adapter-09-dialog-adapter.jpg)

