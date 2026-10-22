## Werkzeuge: Bauen

Das Menü *Werkzeuge* hat fünf Gruppen: *Berechnen*, *Prüfen*, *Planen*, *Erstellen & verwalten* und *Geräte-Konfiguration*. Dieses Kapitel beschreibt die Einträge der Gruppe *Planen* ab *LED-Wand…* sowie die Gruppen *Erstellen & verwalten* und *Geräte-Konfiguration*. Die Rechner, die Prüfungen und die übrigen Einträge der Gruppe *Planen* stehen im Kapitel [Werkzeuge: Planen](#8-werkzeuge-planen). Patch-Liste, Festinstallation, Stage Plot und *Exportieren & Drucken…* stehen im Menü *Datei* und im Kapitel [Exportieren und Drucken](#7-exportieren-und-drucken).

Die Gruppe *Geräte-Konfiguration* erscheint nur, wenn der Plan ein passendes Gerät enthält: *ATEM Multiviewer-Layout…* bei einem ATEM oder Multiviewer, *ATEM Audio-Routing…* und *ATEM Input-Labels…* bei einem ATEM, *Videohub-Routing / Labels…* bei einem Videohub und *GreenGo-Intercom…* bei einem GreenGo-Gerät. Dieselben Werkzeuge stehen im Inspector im Abschnitt *Werkzeuge für dieses Gerät*. *Lager / Bestand…* erscheint, wenn das Modul Vermietung eingeschaltet ist.

![Untere Hälfte des Menüs Werkzeuge](bilder/de/werkzeuge-bauen-menue-01-unten.jpg)

### LED-Wand

*Werkzeuge → LED-Wand…*

Der Dialog *LED-Wand* plant eine Wand aus gleichen Kacheln. Aus den Datenblattwerten des Panel-Typs rechnet er Kachelzahl, Auflösung, Maß, Gewicht und Leistung der Wand, prüft, ob die Ports der Sending Card die Pixel tragen, rechnet den Zuschnitt einer Standardquelle auf die Wand und liefert die Pixelmap als PNG. Panel-Typen und Wände gehören zum Projekt. Eine fehlende Angabe steht als Satz da, wo sonst die Zahl stünde: Trägt ein Panel-Typ kein Gewicht, ist das Gewicht der Wand unbekannt und nicht 0 kg.

1. Öffnen Sie *Werkzeuge → LED-Wand…*. Ohne Panel-Typ steht dort *Kein Panel-Typ eingetragen.* mit dem Hinweis, die Zahlen vom Datenblatt zu nehmen; unter *Wände* steht *Eine Wand braucht zuerst einen Panel-Typ.*

   ![Dialog LED-Wand ohne Panel-Typ](bilder/de/werkzeuge-bauen-led-01-leer.jpg)

2. *Panel-Typ hinzufügen* legt einen Typ mit den Vorgaben *Neuer Panel-Typ*, 3,9 mm Pixelabstand, 128 × 128 Pixel und 500 × 500 mm an.

   ![Neuer Panel-Typ](bilder/de/werkzeuge-bauen-led-02-typ-neu.jpg)

3. Tragen Sie die Werte des Datenblatts ein. Jede Zahl wird übernommen, sobald Sie das Feld verlassen.

   ![Panel-Typ mit Datenblattwerten](bilder/de/werkzeuge-bauen-led-03-typ-ausgefuellt.jpg)

   | Feld | Bedeutung |
   |---|---|
   | *Name* | Bezeichnung des Typs; sie erscheint in der Auswahl der Wand. |
   | *Pixelabstand (mm)* | Abstand der Pixel. |
   | *Pixel quer* / *Pixel hoch* | Auflösung eines Panels. |
   | *Breite (mm)* / *Höhe (mm)* | Maß eines Panels. |
   | *Gewicht (kg)* | Gewicht eines Panels; leer heißt nicht angegeben. |
   | *Leistung, Dauer (W)* / *Leistung, Spitze (W)* | Leistungsaufnahme eines Panels im Mittel und in der Spitze; leer heißt nicht angegeben. |
   | *Datenblatt (URL)* | Verweis auf das Datenblatt. |

   Das **×** neben den ersten Feldern (*Entfernen*) löscht den Panel-Typ.

4. *Wand hinzufügen* legt eine Wand *Neue Wand* mit dem ersten Panel-Typ, 4 Spalten und 3 Reihen an. Gibt es mehrere Wände, wählen die Schaltflächen mit den Wandnamen, welche Wand unten steht.

   ![Neue Wand](bilder/de/werkzeuge-bauen-led-04-wand-neu.jpg)

5. Die Wand hat die Felder *Name*, *Panel-Typ* (Auswahl unter den Typen), *Spalten* und *Reihen*. Mit *Spalten* und *Reihen* ändert sich die Summe darunter sofort.

   ![Raster 8 × 4](bilder/de/werkzeuge-bauen-led-05-raster.jpg)

6. Statt das Raster zu zählen, geben Sie die Öffnung ein: *Öffnung Breite (mm)* und *Öffnung Höhe (mm)*. Neben dem Knopf steht, was passt, zum Beispiel *6 × 3 Kacheln, 300 mm quer und 200 mm hoch bleiben übrig*. Es wird abgerundet: eine Kachel, die nur zur Hälfte in der Öffnung steht, zählt nicht. Der Rest bleibt sichtbar, damit Sie entscheiden können, ob Sie die Wand mittig hängen oder die Öffnung ändern.

   ![Öffnung eingegeben](bilder/de/werkzeuge-bauen-led-06-oeffnung.jpg)

7. *Raster einpassen* übernimmt Spalten und Reihen. Der Knopf ist erst aktiv, wenn beide Maße größer als 0 sind.

   ![Raster eingepasst](bilder/de/werkzeuge-bauen-led-07-oeffnung-eingepasst.jpg)

#### Summe der Wand

Unter den Feldern stehen sechs Werte: *Panels*, *Auflösung* (Pixel gesamt), *Mass (mm)*, *Gewicht*, *Leistung, Dauer* und *Leistung, Spitze*. Fehlt dem Panel-Typ das Gewicht oder die Leistung, steht an dieser Stelle *Panel-Typ trägt kein Gewicht* beziehungsweise *Panel-Typ trägt keine Leistungsangabe*. Ein Hinweis erinnert, die Sicherung nach der Spitze zu wählen und nicht nach dem Mittel.

![Wand ohne Gewichtsangabe](bilder/de/werkzeuge-bauen-led-12-ohne-gewicht.jpg)

#### Zuschnitt der Quelle

Der Abschnitt *Zuschnitt der Quelle* rechnet, welchen Ausschnitt einer Standardquelle der Prozessor zeigen muss, damit sie die Wand unverzerrt und mittig füllt. *Breite der Quelle (px)* und *Höhe der Quelle (px)* sind mit 1920 × 1080 vorbelegt. Die Quelle wird so skaliert, dass sie die ganze Wand füllt; die Achse, die übersteht, wird mittig beschnitten. Vier Kacheln nennen die Werte in Quellpixeln: *X*, *Breite*, *Y* und *Höhe*. Die Achse, die nicht beschnitten wird, trägt die volle Quellgröße, nicht 0. Darunter steht ein Satz wie *Beschnitten: oben und unten (Y). Skalierung 30 %, Ebene 1152 × 576.* Die Achse heißt *nichts, gleiches Seitenverhältnis*, *seitlich (X)* oder *oben und unten (Y)*. Hat die Wand noch keine Auflösung, steht *Die Wand braucht zuerst eine Auflösung.*

1. Geben Sie die Auflösung der Quelle ein, hier 3840 × 2160.

   ![Zuschnitt für 3840 × 2160](bilder/de/werkzeuge-bauen-led-08-zuschnitt-quelle.jpg)

2. Ein Klick auf eine Kachel kopiert ihren Wert in die Zwischenablage; die Kachel zeigt danach *· kopiert*.

   ![Wert kopiert](bilder/de/werkzeuge-bauen-led-09-zuschnitt-kopiert.jpg)

#### Sending Card

*Ports der Sending Card* und *Pixel je Port* beschreiben die Sending Card. Der Dialog rechnet nur die Zahl der Ports, nicht, welche Kachel an welchem Port hängt. Das Urteil steht neben den Feldern: *2 von 4 Ports tragen sie*, *Reicht nicht — 2 Ports nötig, 1 vorhanden* oder, solange nichts eingetragen ist, *Zur Sending Card ist nichts eingetragen — also wird auch nichts behauptet.*

![Vier Ports mit 650 000 Pixeln](bilder/de/werkzeuge-bauen-led-10-sending-card.jpg)

![Ein Port reicht nicht](bilder/de/werkzeuge-bauen-led-11-sending-card-knapp.jpg)

#### Anschlusspunkt des Hauses

Enthält das Projekt eine Gebäude-Auskunft mit Anschlusspunkten, erscheint die Auswahl *Gespeist aus (Anschlusspunkt des Hauses)* mit der Vorgabe *nicht angegeben*. Die Dauerleistung geht dann in die Last an diesem Punkt; die Spitze bekommt einen eigenen Befund.

#### Pixelmap

*Pixelmap als PNG* speichert ein Bild, das so groß ist wie die Wand Pixel hat. Die Kacheln sind zeilenweise von oben links nummeriert. Der Knopf ist ohne Panels deaktiviert. Die Datei heißt `<Datum>_<Projektname>_<Nr>_pixelmap.png`.

### Frontplatten-Editor

*Werkzeuge → Frontplatten-Editor…*

Der Frontplatten-Editor setzt die Stecker eines Wandanschlussfelds, einer Bodendose, einer Stagebox oder einer Blende in Millimetern und druckt den Beschriftungsstreifen im Maßstab 1:1. Die Stecker sind die Ports des Geräts und keine Zeichnung davon: Was Sie verschieben, ist dieselbe Lage, die die Rack-Ansicht liest.

1. Öffnen Sie *Werkzeuge → Frontplatten-Editor…*. Hat das gewählte Gerät kein Maß in Millimetern, steht *Dieses Gerät hat noch kein Maß in Millimetern.* Ohne Breite und Höhe gibt es keine Platte, und *1:1 drucken* ist deaktiviert.

   ![Frontplatten-Editor ohne Maß](bilder/de/werkzeuge-bauen-frontplatte-01-offen.jpg)

2. Wählen Sie das *Gerät*. Die Auswahl listet alle Geräte des Plans.

   ![Gerät gewählt](bilder/de/werkzeuge-bauen-frontplatte-02-geraet-gewaehlt.jpg)

3. Wählen Sie bei *Art*, was das Gerät ist: *Wandanschlussfeld*, *Bodentank*, *Stagebox*, *Rack-Blende* oder *Sonstige*. *keine Frontplatte* nimmt die Angabe wieder weg. Der *Bodentank* ist eine Bodendose: Er leitet wie ein Wandanschlussfeld durch und verbindet wie ein Anschlusspunkt; die 3D-Ansicht des Gebäudes legt ihn flach auf den Boden.

   ![Art Wandanschlussfeld](bilder/de/werkzeuge-bauen-frontplatte-03-art-wandfeld.jpg)

4. Tragen Sie *Breite (mm)* und *Höhe (mm)* der Platte ein. Beide Werte gelten für das Gerät.

   ![Maß der Platte](bilder/de/werkzeuge-bauen-frontplatte-04-masse.jpg)

5. Jeder Stecker ohne Lage steht in der Tabelle mit dem Knopf *setzen*; er setzt den Stecker in die Mitte der Platte.

   ![Stecker gesetzt](bilder/de/werkzeuge-bauen-frontplatte-05-platziert.jpg)

6. Ziehen Sie die Stecker mit der Maus an ihre Stelle. Die Tabelle zeigt die Lage in Millimetern von links oben (*Lage (mm)*).

   ![Stecker verschoben](bilder/de/werkzeuge-bauen-frontplatte-06-verschoben.jpg)

7. Tragen Sie bei jedem Stecker den *Ausschnitt (mm)* aus dem Dokument des Herstellers ein; er erscheint als gestrichelter Kreis um den Stecker. Das Programm rät den Ausschnitt nicht. Ohne Ausschnitt wird der Stecker nicht gegen die anderen geprüft, und die Befunde sagen das.

   ![Ausschnitte eingetragen](bilder/de/werkzeuge-bauen-frontplatte-07-ausschnitt.jpg)

8. *Raster (mm)* lässt gezogene Stecker auf ein Raster einrasten; 0 oder leer heißt frei. *Streifen (mm)* ist die Höhe des Streifenhalters; leer heißt kein Streifen. *1:1 drucken* druckt den Streifen in Originalgröße.

   ![Raster und Streifen](bilder/de/werkzeuge-bauen-frontplatte-08-raster-streifen.jpg)

Unter der Tabelle stehen die Befunde: *… sitzt außerhalb der Platte*, *… überschneiden sich um … mm* (beide rot), *… Stecker haben noch keine Lage auf der Platte* und *… Stecker tragen kein Ausschnittmaß — sie wurden NICHT gegeneinander geprüft.* Bei einem durchleitenden Feld (Patchfeld) gibt es zusätzlich das Feld *Auf der Platte* mit *Eingänge (n)* und *Ausgänge (n)*: Auf der Platte sitzt nur eine Seite; Position n vorne ist Position n hinten.

![Art Bodentank](bilder/de/werkzeuge-bauen-frontplatte-09-art-bodentank.jpg)

### Berichts-Editor

*Werkzeuge → Berichts-Editor…*

Der Berichts-Editor legt fest, wie eine Liste aussieht: Spalten, Reihenfolge, Gruppierung, Sortierung und Filter. Die Tabelle im Dialog ist der Inhalt der CSV-Datei und des gedruckten Blatts, keine Vorschau darauf.

1. Öffnen Sie *Werkzeuge → Berichts-Editor…*. Oben wählen Sie die *Liste*; sie ist beim Öffnen *Zug-Liste*. Die Zeile *Gruppieren nach* und der Zähler (*4 von 4 Zeilen · 24 Spalten*) stehen daneben, rechts die Knöpfe *CSV* und *Drucken*.

   ![Berichts-Editor mit der Zug-Liste](bilder/de/werkzeuge-bauen-bericht-01-offen.jpg)

   Zur Auswahl stehen 17 Listen: *Zug-Liste*, *Auflege-Liste*, *Kabel-Schedule*, *Geräte-Register*, *Netz-Merkblatt*, *Spektrum-Plan*, *Ausspielung*, *Tally-Karte*, *Übergabe an die Post*, *Frontplatten*, *Signalwege*, *Hausstrecken-Belegung*, *Durchgänge (Brandschutz)*, *Mängel und Restpunkte*, *Wartungs- und Prüfplan*, *Konfigurationsvorgaben* und *Anhänge-Verzeichnis*.

2. Wählen Sie eine andere Liste, hier *Kabel-Schedule*. Mit der Liste wechselt die Form; sie gehört zur Liste.

   ![Kabel-Schedule gewählt](bilder/de/werkzeuge-bauen-bericht-02-liste-gewaehlt.jpg)

3. Die Tabelle *Spalte | Reihenfolge | Sortieren | Filter* hat eine Zeile je Spalte. Das Kontrollkästchen vor dem Namen blendet die Spalte aus (der Name erscheint durchgestrichen) oder wieder ein.

   ![Spalte *Standard* ausgeblendet](bilder/de/werkzeuge-bauen-bericht-03-spalte-aus.jpg)

4. Die Pfeile unter *Reihenfolge* verschieben die Spalte nach oben (*Nach oben*) oder nach unten (*Nach unten*).

   ![Spalte *Länge (m)* nach vorn geschoben](bilder/de/werkzeuge-bauen-bericht-04-spalte-verschoben.jpg)

5. *Sortieren* schaltet bei jedem Klick weiter: *aufsteigend*, *absteigend*, *aus*. Mehrere Spalten sortieren in der Reihenfolge, in der Sie sie eingeschaltet haben; eine ausgeblendete Spalte sortiert mit.

   ![Absteigend nach Länge](bilder/de/werkzeuge-bauen-bericht-05-sortiert.jpg)

6. In *Filter* (Platzhalter *enthält…*) tippen Sie einen Text; nur Zeilen, deren Zelle ihn enthält, bleiben. Der Zähler nennt die Zeilen, hier *2 von 4 Zeilen*.

   ![Gefiltert auf Camera](bilder/de/werkzeuge-bauen-bericht-06-gefiltert.jpg)

7. *Gruppieren nach* wählt eine Spalte; unter der Tabelle stehen die Gruppen mit ihrer Zeilenzahl, zum Beispiel *BNC (2)*. Ohne Wert in der Gruppenspalte steht *nicht angegeben*.

   ![Gruppiert nach Typ](bilder/de/werkzeuge-bauen-bericht-07-gruppiert.jpg)

8. Unter *Als Vorlage speichern* geben Sie einen Namen ein, zum Beispiel *Ziehliste ohne Raum*.

   ![Vorlagenname](bilder/de/werkzeuge-bauen-bericht-08-vorlage-name.jpg)

9. *mit diesem Projekt* legt die Vorlage in der Projektdatei ab; sie geht mit ihr weiter. *für alle Projekte* legt sie in der Installation ab; sie gilt für das nächste Projekt. Die Vorlagen der gewählten Liste erscheinen darunter als Chips mit dem Zusatz *Projekt* beziehungsweise *global*. Ein Klick auf den Namen lädt die Vorlage; das Papierkorb-Symbol fragt *Berichts-Vorlage löschen?* und entfernt nur diese gespeicherte Ansicht.

   ![Vorlage gespeichert](bilder/de/werkzeuge-bauen-bericht-09-vorlage-gespeichert.jpg)

10. *CSV* speichert die Tabelle als CSV-Datei mit Semikolon als Trenner, benannt nach Projekt und Liste. *Drucken* öffnet das Blatt zum Drucken. Beide geben genau die Zeilen und Spalten aus, die die Tabelle zeigt.

    ![Nach dem Speichern als CSV](bilder/de/werkzeuge-bauen-bericht-10-csv.jpg)

Ist eine Liste im Projekt leer, steht *Diese Liste hat in diesem Projekt noch keine Zeilen.*; trifft kein Filter, steht *Keine Zeile passt zu den Filtern.*

### Adern und Farbnormen

*Werkzeuge → Adern und Farbnormen…*

Der Dialog *Adern, Farbnormen, Anschlüsse und Faser-Polarität* hat drei Reiter. Es ist keine Norm eingebaut: Welche Farbzuordnung oder Polaritätsmethode für die Anlage gilt, steht nicht im Programm. Eine vorgegebene Norm würde wie eine geprüfte Angabe aussehen. Sie tragen deshalb die Norm ein, und zu jeder Norm gehört eine Herkunft.

#### Reiter Farbnormen

1. Ohne Eintrag steht *Noch keine Farbnorm eingetragen.* Ohne Norm bleiben die Adernfarben ungeprüft; der Plan-Check sagt das.

   ![Reiter Farbnormen ohne Eintrag](bilder/de/werkzeuge-bauen-adern-01-normen-leer.jpg)

2. *Farbnorm eintragen* legt eine Norm *Neue Farbnorm* an. Der Papierkorb löscht sie nach der Rückfrage *Farbnorm löschen?*; Anschlüsse, die sie gewählt hatten, bleiben dann ohne Norm.

   ![Neue Farbnorm](bilder/de/werkzeuge-bauen-adern-02-norm-neu.jpg)

3. Geben Sie den *Name der Norm* und die *Herkunft (Pflicht)* ein, zum Beispiel eine Vorschrift mit Ausgabe und Seite oder „Hausstandard, festgelegt von …". Ohne Herkunft ist das Feld rot, und die Norm wird beim nächsten Laden verworfen. Dann tragen Sie je Leiter die Farbe ein: *L1*, *L2*, *L3*, *N* und *PE*.

   ![Ausgefüllte Farbnorm](bilder/de/werkzeuge-bauen-adern-03-norm-ausgefuellt.jpg)

#### Reiter Anschlüsse (Bündel)

Ein Anschluss ist eine Verbindung, die man je Leiter einzeln zieht: fünf Leitungen bilden zum Beispiel einen 400-A-Anschluss. Tragen Sie ein, welche Leiter er haben muss; nur dann kann der Plan merken, dass die vierte Leitung fehlt. Ein Anschluss ist nicht dasselbe wie der Multicore-Name eines Kabels: Der Multicore-Name zählt Kabel in einem Mantel als ein Stück, der Anschluss legt fest, welche Leiter vorhanden sein müssen.

1. Der Reiter beginnt leer; *Anschluss anlegen* legt einen Anschluss an.

   ![Reiter Anschlüsse](bilder/de/werkzeuge-bauen-adern-04-anschluss-leer.jpg)

   ![Neuer Anschluss](bilder/de/werkzeuge-bauen-adern-05-anschluss-neu.jpg)

2. Ein Anschluss hat einen Namen, die Leiter *L1*, *L2*, *L3*, *N*, *PE* und *frei*, die er haben muss, die *Farbnorm für diesen Anschluss* (Vorgabe *keine gewählt*) und eine *Notiz (z. B. Steckverbinder-Kodierung)*. Die Kodierung steht im Dokument des Herstellers; sie wird eingetragen und nicht geraten. Der Papierkorb fragt *Anschluss löschen?*; die Leitungen bleiben, gehören danach zu keinem Anschluss.

   ![Anschluss ausgefüllt](bilder/de/werkzeuge-bauen-adern-06-anschluss-ausgefuellt.jpg)

#### Reiter Faser-Polarität

Auch hier ist keine Methode eingebaut: TIA-568 kennt die Methoden A, B und C, sie unterscheiden sich darin, wo die Fasern gekreuzt werden. Welche gilt, steht im Anlagendokument.

1. Ohne Eintrag bleibt die Faser-Richtung ungeprüft.

   ![Reiter Faser-Polarität](bilder/de/werkzeuge-bauen-adern-07-polaritaet-leer.jpg)

   ![Neue Methode](bilder/de/werkzeuge-bauen-adern-08-polaritaet-neu.jpg)

2. Geben Sie *Name der Methode* und *Herkunft (Pflicht)* ein. *Diese Methode kreuzt die Fasern: TX des einen Endes trifft RX des anderen.* schaltet die Kreuzung ein. *Diese Methode gilt für dieses Projekt.* wählt die Methode für das Projekt. Löschen fragt *Polaritäts-Methode löschen?*; war sie die gewählte, ist die Faser-Richtung danach wieder ungeprüft.

   ![Polaritäts-Methode ausgefüllt](bilder/de/werkzeuge-bauen-adern-09-polaritaet-ausgefuellt.jpg)

### Empfangene Show-Control-Nachrichten

*Werkzeuge → Empfangene Show-Control-Nachrichten…*

Das Fenster führt eine Mitschrift eingehender OSC-Nachrichten. Es ist kein Monitor der Anlage: Eine Zeile sagt, dass etwas ankam, nicht, dass etwas in Ordnung ist. Ein leeres Fenster heißt deshalb nur, dass hier nichts ankam, nicht, dass nichts gesendet wurde.

1. Oben steht der Zustand des Lauschers: *Lauscher: aus*, *Lauscher: lauscht — Adresse:Port* oder *Lauscher: eingeschaltet, aber nicht gebunden* mit dem Grund. Im letzten Fall kommt nichts an, auch wenn jemand sendet.

   ![Fenster mit ausgeschaltetem Lauscher](bilder/de/werkzeuge-bauen-osc-01-offen.jpg)

2. Tragen Sie die *Adresse, auf der gelauscht wird* und den *Port* ein (Vorgabe 9000). Es gibt bewusst keine Vorgabe für die Adresse: Eine, die auf allen Schnittstellen lauscht, wäre eine Entscheidung, die niemand getroffen hat, auch im Kundennetz. Die Einstellung gehört zum Projekt. Eine geladene Projektdatei schaltet den Lauscher nicht von selbst ein.

   ![Adresse und Port eingetragen](bilder/de/werkzeuge-bauen-osc-02-adresse.jpg)

3. *Für dieses Projekt zuhören* schaltet den Lauscher ein.

   ![Lauscher lauscht](bilder/de/werkzeuge-bauen-osc-03-lauscht.jpg)

4. Jede Nachricht erscheint in der *Mitschrift* mit Adresse, Uhrzeit, Absender und Alter, zum Beispiel */cue/12/go um 06:29:01 von 127.0.0.1:57060 empfangen (vor 2 s)*, dazu die Größe der Nutzlast. Das Alter läuft weiter, damit eine alte Zeile nicht wie eine aktuelle aussieht.

   ![Eine empfangene Nachricht](bilder/de/werkzeuge-bauen-osc-04-nachricht.jpg)

5. *Leeren* löscht die Mitschrift.

   ![Mitschrift geleert](bilder/de/werkzeuge-bauen-osc-05-geleert.jpg)

Unter der Mitschrift steht der Abschnitt *Companion-Variablenstand zurücklesen*. Er kennt keinen Knopf, der Companion befragt: Er nennt die Befehlszeilen, die Sie in der TCP-Steuerung von Companion eingeben, und nimmt die Antworten über das Feld *Antworten hier einfügen* mit *Als Ablesung übernehmen* zurück. Jede Ablesung trägt die Uhrzeit des Ablesens. Solange kein Gerät im Plan über Companion geschaltet wird, steht dort *Kein Gerät im Plan wird über Companion geschaltet — es gibt keine Variable, die sich zurücklesen ließe.*

### Mehrere Kabel verbinden

*Werkzeuge → Mehrere Kabel verbinden…*

Der Dialog legt mehrere Kabel in einem Zug an: Port *i* der Quelle geht an Port *i* des Ziels. Belegte Ziel-Ports werden übersprungen. Er öffnet auch über die Befehlspalette (Strg+K) und über den Knopf *Kabel verbinden* der Werkzeugleiste des Canvas, wenn genau zwei Geräte markiert sind; die beiden Geräte sind dann als Quelle und Ziel vorbelegt.

1. Öffnen Sie *Werkzeuge → Mehrere Kabel verbinden…*. Der Dialog hat die Blöcke *Quelle* und *Ziel*, darunter *Anzahl Kabel*, *Kabel-Typ* und *Länge pro Kabel (m)*.

   ![Dialog Mehrere Kabel verbinden](bilder/de/werkzeuge-bauen-bulk-01-offen.jpg)

2. Wählen Sie bei *Quelle* das *Gerät*, die *Seite* (*Outputs* oder *Inputs*) und den Start-Port (*Start-Output (1..n)*).

   ![Quelle gewählt](bilder/de/werkzeuge-bauen-bulk-02-quelle.jpg)

3. Wählen Sie bei *Ziel* ebenso Gerät, Seite (*Inputs* oder *Outputs*) und den Start-Port. Die Seiten lassen sich beliebig kombinieren, auch Output zu Output, zum Beispiel bei einer Patchblende.

   ![Ziel gewählt](bilder/de/werkzeuge-bauen-bulk-03-ziel.jpg)

4. Tragen Sie die *Anzahl Kabel* ein (1 bis 256; Vorgabe 8). Die *Vorschau* zeigt die Paare, bis zu 12; sind es mehr, steht die Zahl der übrigen. Reichen die Ports nicht, warnt der Dialog mit *Anzahl überschreitet verfügbare Ports — überzählige werden ausgelassen.*

   ![Anzahl eingetragen](bilder/de/werkzeuge-bauen-bulk-04-bereich.jpg)

5. Wählen Sie den *Kabel-Typ* aus dem Katalog samt eigenen Kabeltypen und die *Länge pro Kabel (m)*. Der Kabelname entsteht aus den beiden Port-Namen, die Farbe aus dem Kabeltyp.

   ![Kabeltyp und Länge](bilder/de/werkzeuge-bauen-bulk-05-kabeltyp.jpg)

6. *8 Kabel erstellen* legt die Kabel an; der Knopf nennt die Zahl der Paare der Vorschau. Müssen Ziel-Ports übersprungen werden, nennt eine Meldung, wie viele Kabel entstanden und wie viele ausgelassen wurden. Die Kabel zählen als ein Schritt für Rückgängig. Die Statusleiste nennt danach die neue Kabelzahl.

   ![Statusleiste nach dem Anlegen](bilder/de/werkzeuge-bauen-bulk-06-angelegt.jpg)

### Neues Rack erstellen

*Werkzeuge → Neues Rack erstellen…*

Der Eintrag öffnet den 2D-Rack-Builder mit einem leeren Rack und schaltet die Bibliothek auf den Reiter *Racks*. Der Builder stellt ein Rack aus Geräten zusammen, zeigt es von vorn, von hinten, von der Seite und in 3D und speichert es als platzierbare Gruppe in der Bibliothek. Die Karten auf dem Reiter *Racks*, das Bearbeiten gespeicherter Racks und das Platzieren auf dem Canvas beschreibt das Kapitel [Bibliothek](#rack-builder); wie ein Rack auf dem Canvas aussieht, steht im Kapitel [Canvas](#3-canvas).

Der Entwurf eines neuen Racks wird laufend zwischengespeichert; die Fußzeile zeigt *Autosave aktiv*, solange es ungespeicherte Änderungen gibt, sonst *Gespeichert*.

1. Öffnen Sie *Werkzeuge → Neues Rack erstellen…*. Die Kopfzeile nennt *Neues Rack* mit der Marke *Neu*, nach der ersten Änderung zusätzlich *Ungespeichert*. Rechts stehen *Exportieren* und **×**.

   ![Der leere Rack-Builder](bilder/de/werkzeuge-bauen-rack-01-offen.jpg)

2. Tragen Sie den *Rack-Name* ein (Pflichtfeld), die *Höhe (HE)* (1 bis 60) und die *Tiefe (mm)* (200 bis 1500; Vorgabe 800; gängig sind 350, 450, 600, 800, 1000 und 1200).

   ![Name, Höhe und Tiefe](bilder/de/werkzeuge-bauen-rack-02-kopf.jpg)

3. Links steht die *Bibliothek* mit der Zahl der Treffer. Das Suchfeld *Gerät suchen…* filtert nach dem Namen; **×** im Feld löscht den Suchbegriff. Auf jeder Karte stehen Name, Kategorie und *n HE · x In · y Out*.

   ![Suche nach einem Gerät](bilder/de/werkzeuge-bauen-rack-03-suchen.jpg)

4. *+ Ins Rack* stellt das Gerät in den ersten freien Platz. Ein Gerät lässt sich auch aus der Bibliothek in das Rack ziehen; die Stelle, an der es fällt, bestimmt die Start-HE und, in der Ansicht *Beide*, die Seite. Ist das Gerät schon im Rack, steht *+ Weitere* auf dem Knopf, und ein Zähler *n×* nennt, wie oft es steht.

   ![Das Gerät steht im Rack](bilder/de/werkzeuge-bauen-rack-04-im-rack.jpg)

   Der kleine Pfeil am Knopf öffnet die Montageart: *Full-Depth* (vorne + hinten, Vorgabe), *Nur vorne* (*Front-Mount*) oder *Nur hinten* (*Rear-Mount*, zum Beispiel für eine Patchblende).

5. Weitere Geräte kommen auf dieselbe Weise dazu. Die Fußzeile zählt mit, wie voll das Rack ist: *Geräte:* und *HE belegt:*.

   ![Zwei Geräte im Rack](bilder/de/werkzeuge-bauen-rack-05-zweites-geraet.jpg)

#### Ansichten

Über dem Rack stehen die Reiter *2D* und *3D*. Im Reiter *2D* wechseln die Knöpfe *Vorne*, *Hinten*, *Beide* und *Seite* die Ansicht; der Zoom (**−**, Prozentwert, **+**, *Einpassen*) wirkt nur in 2D. *Stecker-Symbole zeigen* blendet die gezeichneten Steckverbinder in 2D und 3D ein.

1. *Hinten* zeigt die Rückseite.

   ![Rückansicht](bilder/de/werkzeuge-bauen-rack-06-hinten.jpg)

2. *Beide* stellt Vorder- und Rückseite nebeneinander.

   ![Vorder- und Rückansicht](bilder/de/werkzeuge-bauen-rack-07-beide.jpg)

3. *Seite* zeigt die Tiefe: Jedes Gerät ist ein Streifen von seiner Vorderkante bis zur Hinterkante in der Rack-Tiefe (*Vorne bis hinten: 800 mm*); die vorderen und hinteren Schienen sind markiert.

   ![Seitenansicht](bilder/de/werkzeuge-bauen-rack-08-seite.jpg)

4. *3D* zeigt das Rack räumlich: links drehen, rechts verschieben, mit dem Rad zoomen; *Shift* bewegt die Ansicht nach oben, *Space* nach unten. Die Auswahl *Ansicht:* wählt *Alle* (alle Geräte, freie Ports und Patchblenden), *Freie Ports* (nur Geräte mit freien Ports und Patchblenden) oder *Released* (Patchblenden und extern verkabelbare Geräte). Die 3D-Ansicht liest nur; bearbeitet wird in 2D.

   ![3D-Ansicht](bilder/de/werkzeuge-bauen-rack-21-3d.jpg)

#### Sonderfälle beim Bestücken

- **Patchblende.** *+ Patchblende* öffnet *Patchblende anlegen*. Der Reiter *Basics* hat *Name*, *Höhe (HE)*, *Montage* (*Full-Depth (vorne)*, *Nur vorne*, *Nur hinten*), *Anzahl Ports* (12, 16, 24, 32 oder 48 oder ein eigener Wert), das Kästchen *Adapter-Patchblende* (Front und Rear tragen verschiedene Stecker, mit internem Adapterkabel) und den *Connector-Typ*. Im Reiter *Per-Port-Detail (n)* lassen sich Label und Stecker je Port überschreiben; leer heißt Vorgabe. *Patchblende erstellen* stellt sie ins Rack.

  ![Dialog Patchblende anlegen](bilder/de/werkzeuge-bauen-rack-09-patchblende-dialog.jpg)

  ![Reiter Per-Port-Detail](bilder/de/werkzeuge-bauen-rack-10-patchblende-ports.jpg)

  ![Patchblende im Rack](bilder/de/werkzeuge-bauen-rack-11-patchblende-angelegt.jpg)

- **Rack-Shelf.** *+ Rack-Shelf* öffnet *Rack-Shelf anlegen* mit *Name*, *Höhe (HE)* und *Tiefe (mm)*. Ein Shelf trägt Geräte, die keine 19 Zoll haben: Setzen Sie sie auf dieselbe Start-HE wie das Shelf, dann stehen sie in der Ansicht darauf.

  ![Dialog Rack-Shelf anlegen](bilder/de/werkzeuge-bauen-rack-12-shelf-dialog.jpg)

  ![Shelf im Rack](bilder/de/werkzeuge-bauen-rack-13-shelf-angelegt.jpg)

- **Geräte ohne Rack-Maß.** Mit dem Kästchen *Auch Nicht-Rack-Geräte* zeigt die Bibliothek auch Geräte, die nicht als 19-Zoll-Gerät markiert sind; sie tragen die Marke *No-HE*.

  ![Nicht-Rack-Geräte in der Bibliothek](bilder/de/werkzeuge-bauen-rack-14-nicht-rack.jpg)

  Beim Hinzufügen fragt *… hinzufügen* nach der Art: *Als 19″-Gerät* (mit *HE-Höhe*) oder *Auf Shelf* (mit *Breite (mm)*, *Höhe (mm)* und *Tiefe (mm)*; Schnellwahl 1/3, 1/2 und 2/3 Rack-Breite). *Maße permanent ans Template speichern* merkt sich die Antwort, sodass nicht noch einmal gefragt wird.

  ![Frage nach der Montageart](bilder/de/werkzeuge-bauen-rack-15-nicht-rack-dialog.jpg)

  ![Gerät im Rack](bilder/de/werkzeuge-bauen-rack-16-nicht-rack-hinzugefuegt.jpg)

#### Eigenschaften eines Geräts im Rack

Ein Doppelklick auf ein Gerät im Rack öffnet *Eigenschaften · Gerätename*. Das Fenster hat *Name*, *Kategorie*, *Höhe (HE)*, *Start-HE* (mit dem Höchstwert), *Tiefe (mm)*, *Montage* (*Full-Depth*, *Nur vorne*, *Nur hinten*), bei halbbreiten Geräten *Hälfte (Vorderansicht)* (*Links* oder *Rechts*), *3D-Modell (STL, optional)*, die Abschnitte *Tiefen-Position (Z)* und *Port-Seite (Front/Rear)* sowie *Panel-Bilder (Import + Zuschneiden)*. Unten stehen *Aus Rack entfernen* (mit Rückfrage) und *Schließen*.

![Eigenschaften eines Geräts im Rack](bilder/de/werkzeuge-bauen-rack-17-eigenschaften.jpg)

- *Port-Seite* legt je Port fest, ob er vorn oder hinten sitzt; *alle nach hinten*, *spiegeln* und *alle nach vorne* ändern alle Ports auf einmal.
- *STL auswählen…* nimmt ein 3D-Modell bis 5 MB; ohne Modell zeichnet die 3D-Ansicht das Gerät als Box mit Front- und Rückfoto. *Entfernen* nimmt das Modell wieder weg.
- Die Panel-Bilder lassen sich importieren, zuschneiden (*Zuschnitt übernehmen*), tauschen (*Front/Rear tauschen*) und entfernen.

![Untere Hälfte der Eigenschaften](bilder/de/werkzeuge-bauen-rack-18-eigenschaften-stl.jpg)

#### Konflikte

Überlappen sich zwei Geräte, steht über dem Rack der Kasten *Konflikte (n)* mit den Fällen, zum Beispiel *Luminex GigaCore 12 überlappt mit Blackmagic Smart Videohub 12x12.* Die Fußzeile nennt die Zahl ebenfalls (*n Konflikte*). Weitere Fälle: ein Gerät, das nicht als Rack-Gerät markiert ist, eine Start-HE kleiner als 1 und ein Gerät, das ab seiner Start-HE nicht mehr ins Rack passt. Konflikte blockieren das Speichern nicht; das Rack wird trotzdem gespeichert.

![Zwei Geräte überlappen](bilder/de/werkzeuge-bauen-rack-19-konflikt.jpg)

![Konflikt behoben](bilder/de/werkzeuge-bauen-rack-20-konflikt-behoben.jpg)

![Zurück in 2D](bilder/de/werkzeuge-bauen-rack-22-2d.jpg)

#### Exportieren, verkabeln und speichern

- *Exportieren* in der Kopfzeile bietet vier Wege: *2D als PNG* (die aktuelle Ansicht), *3D aus 4 Perspektiven* (PNG: Front, Rear, Iso, Top; der Reiter *3D* muss vorher geöffnet worden sein), *3D als STL* (das ganze Rack als binäres STL für 3D-Druck und CAD) und *.cpgroup herunterladen* (das komplette Rack samt STL und Fotos für den Transport auf einen anderen Rechner).

  ![Menü Exportieren](bilder/de/werkzeuge-bauen-rack-23-export.jpg)

- *Intern verkabeln* in der Fußzeile öffnet *Rack-Verkabelung: Rackname*, eine Canvas-Ansicht der Geräte des Racks: Ziehen Sie Linien von einem Output zu einem Input; rechts zeigt der Inspector (*Eigenschaften (Rack-Scope)*) das markierte Gerät oder Kabel. *Fertig* kehrt zum Builder zurück. Der Knopf ist erst aktiv, wenn mindestens ein Gerät im Rack steht. Gibt es interne Kabel, nennt die Fußzeile ihre Zahl (*n Kabel*).

  ![Rack-Verkabelung](bilder/de/werkzeuge-bauen-rack-24-intern.jpg)

- *Rack speichern* legt das Rack als neue Gruppe in der Bibliothek ab. Es verlangt einen Namen (*Bitte Rack-Name angeben.*) und mindestens ein Gerät (*Bitte mindestens ein Gerät ins Rack legen.*). *Abbrechen* und **×** fragen bei ungespeicherten Änderungen nach (*Ungespeicherte Rack-Änderungen verwerfen?*). Beim Bearbeiten eines gespeicherten Racks heißt der Knopf *Speichern*.

  ![Das gespeicherte Rack auf dem Reiter Racks](bilder/de/werkzeuge-bauen-rack-25-gespeichert.jpg)

Das Feld *Live-Preview* rechts zeigt das Rack als *Black-Box auf Canvas* mit *n Geräte · m interne Kabel*: so erscheint es auf dem Canvas.

### KI-Plan generieren

*Werkzeuge → KI-Plan generieren…*

Der Dialog *KI-Plan-Generierung* erzeugt einen Entwurf aus einer Beschreibung oder ergänzt den offenen Plan aus Dokumenten. Nichts wird ohne Bestätigung eingefügt: Erst erscheint eine Vorschau. Die Anfrage geht an den Anbieter, den Sie unter *Einstellungen → Integrationen → AI* gewählt haben; die Aufnahmen dieses Kapitels zeigen erfundene Antworten, es geht keine Anfrage hinaus.

1. Ohne hinterlegten Schlüssel steht oben *Kein AI-API-Key hinterlegt. Bitte in den Einstellungen → AI einen Provider-Key eintragen.* und *Generieren* ist gesperrt.

   ![Dialog ohne Schlüssel](bilder/de/werkzeuge-bauen-ki-01-ohne-schluessel.jpg)

2. **Aus einer Beschreibung.** Beschreiben Sie die Anlage unter *System in Klartext beschreiben*, zum Beispiel eine Kamera über SDI in einen Bildmischer und das Programmbild auf einen Recorder.

   ![Beschreibung eingegeben](bilder/de/werkzeuge-bauen-ki-02-beschreibung.jpg)

3. *Generieren* zeigt die Vorschau: *Vorschau: 3 Geräte, 2 Kabel* mit der Liste der Geräte und ihrer Kategorie, dazu Warnungen, etwa wenn eine Verbindung auf ein unbekanntes Gerät zeigte. *In den Plan einfügen* übernimmt Geräte und Kabel.

   ![Vorschau der Beschreibung](bilder/de/werkzeuge-bauen-ki-03-vorschau.jpg)

4. Nach dem Einfügen schließt der Dialog; die Statusleiste nennt die neue Zahl der Geräte und Kabel.

   ![Statusleiste nach dem Einfügen](bilder/de/werkzeuge-bauen-ki-04-eingefuegt.jpg)

5. **Aus Dokumenten.** *Dateien wählen* oder Ablegen von Dateien im gestrichelten Feld nimmt Blockschaltbilder, IP-Listen, Stücklisten und Grundrisse an: PDF, Excel, CSV, Bilder und `.cableplan`. Die Dateien erscheinen mit ihrer Größe; **×** nimmt eine wieder weg. Alle Anhänge zusammen dürfen 20 MB nicht überschreiten; sonst steht *Zusammen … — mehr, als eine Anfrage tragen kann. Dokumente in mehreren Runden schicken.* Mit Dokumenten heißt das Textfeld *Hinweis an die KI (optional)*.

   ![Dokument angehängt](bilder/de/werkzeuge-bauen-ki-05-dokument.jpg)

6. *Plan vervollständigen* vergleicht die Dokumente mit dem offenen Plan und liefert nur, was fehlt: *Vorschau: 1 neue Räume, 1 neue Geräte, 0 Kabel, 0 Geräte ergänzt* mit den neuen Räumen (+) und Geräten (•, mit Kategorie und IP) sowie Warnungen. Enthalten die Dokumente nichts Neues, steht *Die Dokumente enthalten nichts, was dem Plan fehlt.*

   ![Vorschau der Ergänzung](bilder/de/werkzeuge-bauen-ki-06-ergaenzung-vorschau.jpg)

7. *In den Plan einfügen* übernimmt die Ergänzung.

   ![Statusleiste nach der Ergänzung](bilder/de/werkzeuge-bauen-ki-07-ergaenzung-eingefuegt.jpg)

### Revisionen & Snapshots

*Werkzeuge → Revisionen & Snapshots…*

Eine Revision speichert einen vollständigen Stand des Plans unter einem Namen. Beim Wiederherstellen bleibt die Historie erhalten. Die letzte Revision erscheint im Titelblock der Ausgaben, bei einer As-Built-Revision mit dem Zusatz *(As-Built)*. Zwei Stände miteinander vergleichen Sie über *Datei → Plan-Stände vergleichen…*, siehe [Exportieren und Drucken](#7-exportieren-und-drucken).

1. Öffnen Sie *Werkzeuge → Revisionen & Snapshots…*. Der Abschnitt *Aktuellen Stand festschreiben* hat *Label* (zum Beispiel „A“ oder „Rev 2“), *Notiz: was hat sich geändert?* und das Kästchen *As-Built*. Solange keine Revision existiert, steht *Noch keine Revisionen festgeschrieben.*

   ![Dialog ohne Revisionen](bilder/de/werkzeuge-bauen-revisionen-01-leer.jpg)

2. *Festschreiben* legt die Revision an. Ohne Label heißt sie *Rev n*.

   ![Erste Revision](bilder/de/werkzeuge-bauen-revisionen-02-festgeschrieben.jpg)

3. Mit dem Kästchen *As-Built* markieren Sie den Stand, wie er gebaut wurde; die Liste kennzeichnet ihn mit *As-built*. Die Liste steht neueste zuerst, jede Zeile mit Label, Notiz und Zeitpunkt.

   ![As-built-Revision](bilder/de/werkzeuge-bauen-revisionen-03-as-built.jpg)

4. Der Pfeil in der Zeile (*Wiederherstellen*) fragt *Diesen Stand wiederherstellen?*: Der aktuelle Plan wird durch die Revision ersetzt, die Historie bleibt.

   ![Rückfrage beim Wiederherstellen](bilder/de/werkzeuge-bauen-revisionen-04-wiederherstellen.jpg)

5. Der Papierkorb (*Löschen*) fragt *Revision löschen?*; die Revision wird dauerhaft entfernt.

   ![Rückfrage beim Löschen](bilder/de/werkzeuge-bauen-revisionen-05-loeschen.jpg)

### Lager / Bestand

*Werkzeuge → Lager / Bestand…*

Der Eintrag erscheint, wenn das Modul Vermietung eingeschaltet ist. Das Fenster verwaltet das eigene Material: Artikel mit Menge und Preis, Lagerorte und Cases, einzelne serialisierte Einheiten, Sets, die Ausgabe von Containern, QR-Etiketten und eine Auswertung.

![Lager / Bestand mit den Artikeln des Plans](bilder/de/werkzeuge-bauen-lager-01-aus-plan.jpg)

Über den Reitern steht das Feld *Code scannen / eingeben (Artikel, Lagerort, Einheit)…*. *Auflösen* sucht den Code; ein Treffer meldet *Artikel: …*, *Lagerort: …* oder *Einheit: Modell · Seriennummer*, sonst steht *Kein Treffer für „…".* Der Kamera-Knopf (*Mit Kamera scannen*) liest den Code mit der Kamera. Die Fußzeile nennt die Bestandszahlen (*n Artikel · m Einheiten · k Lagerorte · s Sets*) und bietet *Export* und *Import*: *Export* speichert das Lager als portable Datei (avplan-inventory), die auch andere Anwendungen lesen; *Import* liest eine solche Datei und fragt *Bestehenden Bestand ERSETZEN? „Abbrechen" fügt stattdessen zusammen (merge).* mit den Knöpfen *Ersetzen* und *Zusammenführen*. Ist die Datei kein Lager, steht *Keine gültige Lager-Datei (avplan-inventory).*

#### Reiter Artikel

Ein Artikel ist ein Modell mit einer Menge. Die Liste zeigt *Modell*, *Menge*, *Lagerort / Case*, *Code (QR/Barcode)* und *Eigentum*; das Suchfeld filtert sie. Der Stift bearbeitet einen Artikel, der Papierkorb löscht ihn nach der Rückfrage *Artikel löschen?* Leer steht dort *Noch keine Lager-Artikel. Lege welche an oder übernimm sie aus dem Plan.*

1. *Aus Plan übernehmen* legt zu jedem Gerät des Plans einen Artikel an, den es noch nicht gibt; vorhandene werden nicht dupliziert. Danach nennt eine Meldung die Zahl der neuen Artikel. Hat der Plan keine Geräte, steht *Kein Equipment im Plan*.

2. *+ Artikel* öffnet das Formular *Neuer Artikel*.

   ![Formular Neuer Artikel](bilder/de/werkzeuge-bauen-lager-02-artikel-formular.jpg)

3. Füllen Sie die Felder aus.

   ![Ausgefülltes Formular](bilder/de/werkzeuge-bauen-lager-03-artikel-ausgefuellt.jpg)

   | Feld | Bedeutung |
   |---|---|
   | *Modell* (Pflicht) | Bezeichnung des Artikels. |
   | *Hersteller*, *Kategorie* | Freitext. |
   | *Menge* | Stückzahl. |
   | *Mietpreis/Tag (€)* | Mietpreis je Tag; die Auswertung rechnet damit. |
   | *Eigentum* | *Eigentum*, *gemietet* oder *Sub-Miete*. Bei den beiden letzten erscheint *Rückgabe bis*. |
   | *Lagerort / Case* | Auswahl unter den Lagerorten; Cases sind mit einem Paket-Symbol gekennzeichnet. |
   | *Lieferant* | Von wem das Material kommt. |
   | *Ursprungsland* | Zum Beispiel DE, JP, US; es geht in das Carnet-Blatt. |
   | *Code (QR/Barcode)* und *Code-Art* | Der Code, den ein Etikett trägt; *QR-Code* oder *Barcode*. |
   | *Material-Art* | *Vermietung* oder *Verbrauch*. |
   | *Maße (B×H×T · Gewicht)* | Breite, Höhe und Tiefe in mm und Gewicht in kg. |
   | *Notiz* | Freitext. |

4. *Speichern* legt den Artikel an.

   ![Artikel in der Liste](bilder/de/werkzeuge-bauen-lager-04-artikel-gespeichert.jpg)

Fremdes Material, das zurückmuss, meldet ein Kasten über der Liste: *Fremdes Material: n Position(en) zurückzugeben* mit den Zeilen *Menge× Modell → Lieferant · zurück seit Datum* oder *· kein Rückgabedatum*.

#### Reiter Lagerorte

Lagerplätze und Cases sind Knoten in einem Baum, jeder Knoten ist scanbar und beliebig verschachtelbar: Case in Case in Transport-Case.

1. *Lagerorte (n)* zeigt die Knoten. *+ Lagerort* öffnet das Formular *Neuer Lagerort* mit *Name*, *Art* (*Depot*, *Raum*, *Regal*, *Fach / Box*, *Case*, *Transport-Case*), *Übergeordnet* (*— Wurzel —* oder ein anderer Knoten), *Code (QR/Barcode)*, *Code-Art* und *Maße (B×H×T · Gewicht) — v. a. für Cases*.

   ![Reiter Lagerorte und Formular](bilder/de/werkzeuge-bauen-lager-05-lagerort-formular.jpg)

2. Die Zeile eines Knotens bietet *Inventur an diesem Ort*, *Unterknoten anlegen*, *Bearbeiten* und *Löschen*; *Löschen* fragt *Lagerort löschen?* — Unterknoten rücken eine Ebene hoch, die Artikel verlieren ihren Lagerort. Bei einem Case kommen *Packliste drucken* und *Packliste (rekursiv) kopieren* hinzu; die kopierte Liste nennt alles, was im Case und in seinen Unter-Cases liegt.

   ![Depot mit einem Case](bilder/de/werkzeuge-bauen-lager-06-lagerort-gespeichert.jpg)

3. Die *Inventur an diesem Ort* öffnet unter dem Knoten das Feld *Code scannen — Lagerort-Etikett wechselt den Ort*. Jeder gescannte Code wird als *hier erwartet*, *am falschen Ort* oder als unbekannt vermerkt; die Zeile nennt Modell und, wo es abweicht, den erwarteten Ort. Ohne Scanner hakt die Liste *Ohne Scanner abhaken — hier erwartet: n, davon offen: m* ab (*hier*); sie vermerkt die Zeile als *aus der Liste*. *CSV* schreibt das Blatt samt der nicht gefundenen Positionen, *Ort übernehmen (n)* schreibt den Ort auf alle Objekte, die am falschen Ort lagen.

#### Reiter Einheiten

Einheiten sind einzelne serialisierte Exemplare eines Artikels mit eigener Seriennummer, eigenem Code, Zustand und Historie. Die Knöpfe *Versicherung* und *Carnet* oben rechts erzeugen die Listen für die Versicherung und das Carnet; sie sind ohne Einheiten gesperrt.

1. *+ Einheit* öffnet das Formular *Neue Einheit*. Ohne Artikel steht *Lege zuerst Artikel an, dann kannst du einzelne Einheiten serialisieren.*

   ![Formular Neue Einheit](bilder/de/werkzeuge-bauen-lager-07-einheit-formular.jpg)

2. Tragen Sie *Artikel-Modell*, *Seriennummer (Hersteller)*, *Hausreferenz*, *Code (QR/Barcode)* mit *Code-Art*, den *Anschaffungspreis* (mit *Währung* und *Gekauft am*), den *Versicherungswert* (mit *Währung* und *Wert-Stand*) und eine *Notiz* ein.

   ![Einheit ausgefüllt](bilder/de/werkzeuge-bauen-lager-08-einheit-ausgefuellt.jpg)

3. Eine gespeicherte Einheit zeigt den *Zustand* (*OK*, *defekt*, *in Reparatur*, *ausgemustert*) mit *Zustand ändern*, *Lagerort ändern*, *Fehler melden* (mit *Fehlerbeschreibung*; *Festhalten*) und die *Historie* der Bewegungen und Reparaturen. Offene Fehler zählt die Zeile (*n offene Fehler*); ein Fehler wird mit *behoben* geschlossen.

   ![Einheit gespeichert](bilder/de/werkzeuge-bauen-lager-09-einheit-gespeichert.jpg)

#### Reiter Sets

Ein Set ist ein logisches Kit aus Artikeln. Seine Verfügbarkeit ergibt sich aus der knappsten Komponente (*n× baubar*).

1. *+ Set* öffnet das Formular *Neues Set* mit *Set-Name* und der Liste *Komponenten*: Wählen Sie *Artikel wählen…* und *Hinzufügen*. Ohne Eintrag steht *Noch keine Komponenten.*

   ![Formular Neues Set](bilder/de/werkzeuge-bauen-lager-10-set-formular.jpg)

#### Reiter Ausgabe

Ein Container geht als Ganzes hinaus; was darin liegt, folgt über alle Ebenen mit. Nur Cases und Transport-Cases lassen sich ausgeben.

1. Wählen Sie bei *— Container wählen —* den Container, tragen Sie *An (Person, Truck, Kunde)* und optional *Show (optional)* ein sowie *Ausgabe war am* und *Zurück bis*. Die Vorschau nennt, welche Positionen mitgehen (*n Positionen gehen mit: …*); ein leerer Container meldet *Dieser Container ist leer — es ginge nichts raus.*

   ![Container gewählt](bilder/de/werkzeuge-bauen-lager-11-ausgabe-container.jpg)

2. *Ausgeben* bucht den Container aus. Unter *Draußen (n)* steht jeder ausgegebene Container mit Empfänger, Positionszahl und, wenn überfällig, der Marke *überfällig*. Je Eintrag bieten die Knöpfe *Termin verschieben* (*Neuer Rückgabetermin*; es zählt mit, wie oft verschoben wurde), *Schein* (das Übergabeblatt), die Unterschrift *Ausgabe quittieren* beziehungsweise *Rückgabe gegenzeichnen*, *Schaden (n)* (*Schaden aufnehmen*), *Zurückbuchen* und *Beleg löschen*. Beim Zurückbuchen prüft das Fenster die Etiketten-Codes der Inhalte (*Prüfen*); die *Rückgabe-Befunde* nennen, was fehlt und was zusätzlich zurückkam. Eine Gegenzeichnung ist erst möglich, wenn der Container zurück ist; eine vorhandene Unterschrift lässt sich nicht überschreiben. *CSV* oberhalb der Liste speichert die ausgegebenen Container; eine Liste *Schäden (n)* nennt aufgenommene Schäden und, bei Häufung, an wen die Ausgabe ging.

#### Reiter Labels

*QR-Etiketten drucken — auf A4-Bögen (Avery/Zweckform) oder Endlos-Labeldruckern. Nur Objekte mit hinterlegtem Code.* Wählen Sie die *Quelle* (*Artikel mit Code*, *Lagerorte / Cases mit Code*, *Einheiten mit Code* oder *Inhalt eines Cases (rekursiv)* mit der Auswahl *Case / Container*), den *Code-Typ* (*Je Code-Art (Auto)*, *QR-Code* oder *Barcode (Code128)*) und das *Format* (A4-Bögen von Avery und Zweckform oder Endlos-Labeldrucker). Passt der Code nicht ganz auf das Etikett, nennt der Dialog, auf welchen Formaten er passt. *Erste Etikett-Position (angebrochener Bogen)* überspringt bereits benutzte Etiketten. Der Zähler nennt *n Etiketten · p Seite(n)*; *Drucken* erzeugt den Bogen. Enthält die Quelle keine Objekte mit Code, steht *Keine Codes*.

![Reiter Labels](bilder/de/werkzeuge-bauen-lager-12-labels.jpg)

#### Reiter Auswertung

Die Auswertung zählt das Lager: *Artikel-Positionen*, *Einheiten (Bulk)*, *Serialisiert* und *Miet-Vol./Tag (€)*, dazu die Verteilung *Nach Kategorie*, *Nach Lagerort (Wurzel)*, *Nach Eigentum*, *Nach Material-Art* und *Einheiten nach Zustand*. Fehlt bei Artikeln der Mietpreis, steht *n Artikel ohne Mietpreis — Miet-Volumen unvollständig.*

![Reiter Auswertung](bilder/de/werkzeuge-bauen-lager-13-auswertung.jpg)

### Geräte-Konfiguration

Die Werkzeuge dieser Gruppe stehen im Menü *Werkzeuge* und am Gerät selbst; der Audio-Router eines ATEM öffnet über den Inspector. Wählen Sie ein ATEM-, Videohub-, GreenGo- oder Multiviewer-Gerät auf dem Canvas, zeigt der Inspector unter den Anschlüssen und der Notiz eine Karte mit dem Namen des erkannten Geräts (zum Beispiel *Blackmagic ATEM erkannt*) und den Knöpfen dieses Geräts, weiter unten den Abschnitt *Werkzeuge für dieses Gerät* mit denselben Einträgen wie im Menü.

![Karte im Inspector](bilder/de/werkzeuge-bauen-atem-audio-01-karte.jpg)

![Abschnitt Werkzeuge für dieses Gerät](bilder/de/werkzeuge-bauen-atem-audio-02-werkzeuge.jpg)

Alle Dialoge dieser Gruppe arbeiten zuerst offline am Plan. Verbinden, Lesen und Senden brauchen ein Gerät im Netz und die Desktop-App; ohne Verbindung sind die zugehörigen Knöpfe gesperrt. Die Aufnahmen dieses Kapitels zeigen nur den Zustand ohne Verbindung; es wird nichts gesucht, verbunden oder gesendet. Das Lesen vom Gerät ersetzt den Plan nie von selbst: Der gelesene Stand erscheint neben dem Plan, mit der Zahl der Abweichungen, und erst *In den Plan übernehmen* übernimmt ihn nach einer Rückfrage; *Befund verwerfen* lässt den Plan, wie er ist.

#### ATEM Multiviewer-Layout

*Werkzeuge → ATEM Multiviewer-Layout…*, im Inspector *Multiviewer-Layout konfigurieren*

Der Dialog plant, welche Quelle in welchem Fenster der Multiviewer-Ausgänge eines ATEM-Mischers steht.

1. Das Menü *Werkzeuge → ATEM Multiviewer-Layout…* öffnet erst die Auswahl *ATEM Multiviewer — Gerät wählen*. Enthält der Plan keinen ATEM-Mischer, steht dort *Kein ATEM-Mischer im Plan. Lege zuerst einen ATEM aus der Bibliothek an — danach ist hier seine Multiviewer-Konfiguration wählbar.* Aus dem Inspector eines Mischers öffnet der Dialog gleich mit diesem Gerät.

   ![Auswahl ohne ATEM im Plan](bilder/de/werkzeuge-bauen-atem-mv-01-ohne-atem.jpg)

2. Gibt es einen ATEM, zeigt die Auswahl ihn (*Welchen ATEM-Mischer-Multiviewer möchtest du konfigurieren?*). Ein Klick auf den Namen öffnet den Editor.

   ![Auswahl mit einem ATEM](bilder/de/werkzeuge-bauen-atem-mv-02-auswahl.jpg)

3. Der Editor heißt *Multiviewer-Layout · Gerätename*. Oben stehen die Reiter *MV 1*, *MV 2* … für die Multiviewer des Geräts; **+** (*Multiviewer hinzufügen*) und **−** (*Letzten Multiviewer entfernen*) ändern ihre Zahl (1 bis 4). Das Layout zeigt vier Quadranten; jedes Fenster trägt den Namen seiner Quelle und die ID.

   ![Editor mit zwei Multiviewern](bilder/de/werkzeuge-bauen-atem-mv-03-editor.jpg)

4. Ein Klick auf ein Fenster öffnet die Quellenauswahl. Sie hat ein Suchfeld (*Suchen…*), ein Feld für eine beliebige ID mit *Übernehmen* und die Quellen nach Gruppen, jeweils mit Namen und ID. Ohne Verbindung stehen dort die Eingänge des Geräts und die üblichen internen Quellen (Black, Color Bars, Color 1 und 2, Media Player 1 und 2, Super Source, Program und Preview von ME 1 bis 4, AUX 1 bis 24); mit Verbindung die Quellen des Mischers.

   ![Quellenauswahl](bilder/de/werkzeuge-bauen-atem-mv-04-quelle-waehlen.jpg)

   ![Quelle gesetzt](bilder/de/werkzeuge-bauen-atem-mv-05-quelle-gesetzt.jpg)

5. Die kleine Vorschau neben *Layout* schaltet je Quadrant zwischen einem großen Fenster und vier kleinen um (*1 → 4* und *4 → 1*). Das ATEM-Layout wird daraus abgeleitet.

   ![Ein Quadrant in vier kleine geteilt](bilder/de/werkzeuge-bauen-atem-mv-06-viertel.jpg)

6. Die Zeile *Modell-Capabilities: Gerät · n MVs · m Layouts* klappt auf: Sie zeigt, welche Layouts das Modell kennt, und lässt Sie dies von Hand ändern, wenn die Erkennung nach dem Gerätenamen danebenliegt. Die Kästchen schalten Layouts (*Default*, *Program Top*, *Program Bottom*, *Program Left*, *Program Right*, *Top-Left Small*, *Top-Right Small*, *Bottom-Left Small*, *Bottom-Right Small*, *Grid (16 klein)*, *Quad (4 groß)*) ein und aus; *MV-Anzahl:* (0 bis 4) und *Max Fenster:* (0 bis 32) stellen die Zahlen ein; *Override zurücksetzen* kehrt zur Erkennung zurück. Die Angabe wird mit dem Projekt gespeichert.

   ![Capabilities aufgeklappt](bilder/de/werkzeuge-bauen-atem-mv-07-faehigkeiten.jpg)

7. Die Knöpfe unten: *Als PNG* speichert die Ansicht des aktuellen Multiviewers als Bild; *Zwischenspeichern* schreibt den Entwurf in den Plan (die Meldung *Gespeichert* bestätigt); *Vom ATEM laden* liest die Multiviewer des verbundenen Mischers; *An ATEM übertragen* sendet den Entwurf. Die beiden letzten sind ohne Verbindung gesperrt; die Statuszeile sagt dann *ATEM nicht verbunden.*, bei bestehender Verbindung *ATEM verbunden — direkt übertragbar.* Eine Änderung bleibt nur erhalten, wenn Sie *Zwischenspeichern* oder *An ATEM übertragen* gedrückt haben.

   ![Entwurf zwischengespeichert](bilder/de/werkzeuge-bauen-atem-mv-08-entwurf-gespeichert.jpg)

#### ATEM Audio-Routing

Im Inspector eines ATEM-Mischers: *Audio-Router konfigurieren*

Der Dialog *ATEM Audio-Konfiguration — Gerätename* plant die Audio-Zuordnung eines ATEM offline. Er liest und schreibt das Profil-XML der ATEM-Software und ändert darin nur Audio-Angaben; alle anderen Abschnitte des Profils bleiben erhalten.

1. Öffnen Sie den Dialog über den Inspector eines ATEM-Mischers (*Audio-Router konfigurieren*).

   ![Leerer Audio-Dialog](bilder/de/werkzeuge-bauen-atem-audio-03-leer.jpg)

   Ohne Konfiguration zeigt er *ATEM Audio-Routing* mit zwei Wegen: *Profile-XML laden* liest ein ATEM-Profil; der Editor erkennt, ob es eine Crosspoint-Matrix oder einen klassischen Mixer enthält. *Matrix manuell* legt eine neue Matrix mit den Standard-Eingängen des ATEM und 8 Output-Bussen an; Quellen, Outputs und Zuordnungen lassen sich danach frei bearbeiten.

   ![Neue Matrix](bilder/de/werkzeuge-bauen-atem-audio-04-matrix.jpg)

2. Die Matrix zeigt links die Quellen (Zeilen) und oben die Outputs (Spalten). Ein Klick auf eine Zelle schaltet die Quelle auf den Output; ein zweiter Klick nimmt die Kreuzung weg. Eine belegte Zelle ist grün, ein Output, der anderweitig belegt ist, trägt einen Punkt. Neben dem Namen einer Quelle steht, auf wie vielen Outputs sie liegt (*×n*). Die Zeile über der Matrix nennt *n × m sichtbar · k Crosspoints*.

   ![Matrix mit drei Kreuzungen](bilder/de/werkzeuge-bauen-atem-audio-05-kreuzung.jpg)

3. *Quellen filtern…* und *Outputs filtern…* blenden Zeilen und Spalten nach einem Textteil aus.

   ![Quellen gefiltert](bilder/de/werkzeuge-bauen-atem-audio-06-filter.jpg)

4. *Quellen-Auswahl* und *Outputs-Auswahl* öffnen eine Liste mit Kästchen: Einzelne Quellen oder Outputs lassen sich ausblenden, ganze Gruppen gleichnamiger Einträge auf einmal (*Alle zeigen*, *Alle ausblenden*). Die Schaltfläche nennt, wie viele versteckt sind. Das ändert nur die Ansicht.

   ![Quellen-Auswahl](bilder/de/werkzeuge-bauen-atem-audio-07-quellen-auswahl.jpg)

5. *Alle Routings zurücksetzen* fragt *Alle Routings auf „No Audio" zurücksetzen?* und setzt jeden Output auf *No Audio*. Übersteigt die Matrix 12 000 sichtbare Crosspoints, fragt der Dialog, ob sie trotzdem gezeichnet werden soll (*Trotzdem anzeigen*); mit den Auswahlen lässt sie sich verkleinern.

   ![Rückfrage beim Zurücksetzen](bilder/de/werkzeuge-bauen-atem-audio-08-zuruecksetzen.jpg)

6. Die Knöpfe oben: *XML laden* und *XML speichern* (das geänderte Profil als Datei, mit einem Herkunftsblatt daneben), *Lesen (offline)* beziehungsweise *Vom ATEM lesen* und *Senden (offline)* beziehungsweise *An ATEM senden*. Das Senden wirkt sofort am Mischer und wird nicht als Startzustand gespeichert; dafür muss *Save Startup State* in der ATEM-Software ausgelöst werden. Unten schreibt *Im Projekt speichern* die Matrix in den Plan und schließt den Dialog; *Abbrechen* verwirft sie.

#### ATEM Input-Labels

*Werkzeuge → ATEM Input-Labels…*, im Inspector *ATEM verbinden / Setup übertragen*

Der Dialog *ATEM Live Integration* trägt die Namen der Eingänge ein: Er verbindet sich per UDP mit dem Mischer und schreibt die Portnamen des Plans als Lang- und Kurzname.

1. Das Fenster beginnt mit der *ATEM IP-Adresse* und den Knöpfen *Suchen* (sucht ATEM-Mischer im lokalen Netz per mDNS) und *Verbinden*. Darunter steht der *Event-Log (n)*.

   ![Dialog ATEM Live Integration](bilder/de/werkzeuge-bauen-atem-labels-01-offen.jpg)

2. Nach dem Verbinden zeigt der Dialog Modell und Zahl der M/E und AUX und die Tabelle *Input-Namen (n)* mit *ID*, *Typ*, *Live (long / short)*, *Neu Long (max 20)* und *Neu Short (4)*. Die neuen Namen sind aus den Portnamen des Plans vorbelegt, bei Eingängen mit der gebundenen Quelle (Rolle). Der Langname hat höchstens 20 Zeichen, der Kurzname 4. *n Änderungen senden* schreibt nur die geänderten Zeilen. Nicht überschrieben werden Mediaplayer, Audio-Eingänge (XLR, RJ45-Talkback) und interne Quellen (Black, Bars, Color, SuperSource); ihre Zeilen sind gesperrt. Die Namen gehen in den Arbeitsspeicher des Mischers; für den Neustart muss *Save Startup State* in der ATEM-Software ausgelöst werden. Mit bestehender Verbindung führt *MV Layout →* zum Multiviewer-Layout.

#### Videohub-Routing / Labels

*Werkzeuge → Videohub-Routing/Labels…*, im Inspector *Videohub konfigurieren · Labels + Routing*

Der Dialog *Videohub konfigurieren · Labels + Routing* plant Beschriftung und Kreuzschiene eines Blackmagic Videohub und gibt sie als Datei oder direkt an den Hub aus.

1. Wählen Sie das *Gerät auf dem Canvas* und das *Videohub-Modell*. Die Liste nennt die Modelle von *Micro Videohub 16x16* bis *Universal Videohub 288* mit ihrer Größe; *Custom (eigene Größe)* fragt nach *Inputs* und *Outputs*. Hat das Gerät mehr Ports als das Modell, warnt der Dialog, dass überschüssige Ports abgeschnitten werden.

   ![Dialog Videohub](bilder/de/werkzeuge-bauen-videohub-01-offen.jpg)

   ![Anderes Modell gewählt](bilder/de/werkzeuge-bauen-videohub-02-modell.jpg)

2. *Datei-Export-Format* wählt, was die Vorschau und die Datei enthalten: *Voller Routing-Dump (Protokoll 2.5)* oder *Nur Labels (Input, n, Name)*. Es betrifft nur die Datei; das direkte Senden ist davon unabhängig. *Friendly Name* ist der Name des Hubs im Dump; im Format *Nur Labels* wird er ignoriert.

3. Die *Routing-Ansicht* zeigt die Kreuzschiene. *Matrix* ist die Kreuzpunkt-Matrix, *Liste* eine Liste mit einer Auswahl je Output. Ein Klick auf einen Kreuzpunkt schaltet den Output auf diesen Input. *Out·In tauschen* vertauscht die Achsen; *Verkabelung an* beziehungsweise *aus* blendet hinter den Namen das Gerät ein, das am Port hängt (*← Gerät*), und *Input-Label an*/*aus* dazu den Portnamen. Zeilen- und Spaltenbreiten lassen sich wie in Excel ziehen (*Layout zurücksetzen*). Ist die Matrix zu groß für die Matrix-Darstellung, wechselt der Dialog selbst in die Liste.

   ![Listenansicht](bilder/de/werkzeuge-bauen-videohub-03-liste.jpg)

   ![Matrix mit getauschten Achsen](bilder/de/werkzeuge-bauen-videohub-04-matrix.jpg)

4. *Smart-Routing* schlägt ein Routing aus den Kabeln im Plan vor: je Output der Input mit dem ähnlichsten Gerätenamen, sonst diagonal. *Reset* stellt die Diagonale wieder her (Output n an Input n).

   ![Nach dem Smart-Routing](bilder/de/werkzeuge-bauen-videohub-05-smart-routing.jpg)

5. *Salvos (Routing-Snapshots)*: *+ Aktuelles Routing speichern* fragt *Salvo-Name (= Routing-Snapshot speichern):* und legt den Stand ab; ein Klick auf den Namen holt ihn zurück, **×** (*Salvo löschen*) entfernt ihn. Salvos gehören zum Gerät und zum Modell und liegen im lokalen Speicher.

   ![Name für den Salvo](bilder/de/werkzeuge-bauen-videohub-06-salvo.jpg)

   ![Salvo gespeichert](bilder/de/werkzeuge-bauen-videohub-07-salvo-gespeichert.jpg)

   Mit zwei Salvos erscheint die Zeile *Umbau von — Satz wählen — nach — Satz wählen —*. Sie rechnet den Unterschied zweier Salvos: *n von m Kreuzpunkten ändern sich.* (oder *Kein Unterschied — beim Umbau ist nichts umzustecken.*). *Umbau-Zettel* speichert die geänderten Kreuzpunkte als CSV, *Voller Satz* alle Kreuzpunkte des gewählten Salvos.

6. *An Videohub senden (TCP)* verbindet erst, wenn Sie einen Knopf drücken. Die Felder *IP-Adresse* und *Port* (Vorgabe 9990) nehmen die Adresse auf; der Pfeil daneben nennt die zuletzt benutzten Verbindungen. *Suchen* sucht Hubs per mDNS, *Status laden* holt Labels, Routing und Sperren vom Hub. *Labels senden*, *Routing senden* und *Labels + Routing senden* schicken nur das Gewählte. Nach dem Lesen vergleicht der Dialog das Routing des Hubs mit dem Plan (*Routing stimmt mit dem Plan überein.* oder *n Kreuzpunkt(e) weichen vom Plan ab* mit *in den Plan übernehmen*); gesperrte Outputs zählt er (*n Outputs gesperrt*). Das *Activity-Log* nennt die letzten Sende-Versuche.

7. Unten zeigt die *Vorschau* den Inhalt der Datei. *In Zwischenablage* kopiert ihn, *Als Datei speichern* schreibt die `.txt`-Datei; neben der Datei entsteht ein Herkunftsblatt mit der Endung `.herkunft.txt`, das Projekt, Stand und eine Prüfsumme nennt. Im Format *Nur Labels* liest *Labels.txt importieren* eine Labels-Datei (zum Beispiel aus Videohub Setup) und schreibt die Namen auf die Ports des Geräts; *Labels-PDF* erzeugt druckbare Beschriftungsstreifen im Smart-Control-Raster.

   ![Format Nur Labels](bilder/de/werkzeuge-bauen-videohub-08-nur-labels.jpg)

#### GreenGo-Intercom

*Werkzeuge → GreenGo-Intercom…*, im Inspector *Intercom-Planung / .gg5 exportieren*

Der Dialog *GreenGo Intercom-Planung* plant ein Green-GO-System: Stationen, Kommunikationsgruppen (Talk Groups) und die Zuordnung dazwischen. Er exportiert eine `.gg5`-Datei, die in die Green-GO-Software geladen wird. Unter dem Namen steht der Systemname.

1. Der Reiter *Übersicht* ist leer, solange es weder Stationen noch Gruppen gibt (*Noch keine Stationen und Gruppen — wechsle zu den Tabs „Stationen" und „Gruppen".*). Unten stehen *GreenGo-Geräte auf dem Canvas* mit dem Hinweis *nicht zugewiesen*.

   ![Leere Übersicht](bilder/de/werkzeuge-bauen-greengo-01-uebersicht-leer.jpg)

2. Im Reiter *Stationen (n)* legt *+ Station* eine Station an (bis zu 12). Geben Sie den Namen ein (Platzhalter *Stationsname (z.B. Regie)*) und ordnen Sie ein Gerät auf dem Canvas zu (*— Gerät —*).

   ![Zwei Stationen](bilder/de/werkzeuge-bauen-greengo-02-stationen.jpg)

   ![Stationen benannt](bilder/de/werkzeuge-bauen-greengo-03-stationen-benannt.jpg)

3. Im Reiter *Gruppen (n)* legt *+ Gruppe* eine Kommunikationsgruppe an (bis zu 9) und nennt die Zahl der Mitglieder.

   ![Gruppe CAM](bilder/de/werkzeuge-bauen-greengo-04-gruppen.jpg)

4. Die *Übersicht* ist die Matrix aus Stationen und Gruppen: Ein Klick auf einen Kreis nimmt die Station in die Gruppe auf oder wieder heraus; die Zeile *Mitglieder* zählt je Gruppe. Je Station wählt die Spalte *Gerät (Canvas)* das Gerät; *nicht zugewiesen* heißt kein Gerät.

   ![Übersicht mit Gruppenzuordnung](bilder/de/werkzeuge-bauen-greengo-05-uebersicht.jpg)

5. Der Reiter *System* hat *System-Name*, *Beschreibung*, *Multicast-Adresse* (Vorgabe 239.1.160.1, muss im Netz eindeutig sein) und *Sample Rate* (*32000 Hz (Standard GreenGo)* oder *48000 Hz*).

   ![Reiter System](bilder/de/werkzeuge-bauen-greengo-06-system.jpg)

6. Die Fußzeile nennt *n Stationen · m Gruppen* und die Zahl der Geräte auf dem Canvas und bietet: *.gg5 importieren* (liest eine `.gg5` und verknüpft ihre Stationen mit Geräten auf dem Canvas), *Excel-Matrix importieren* und *Excel-Matrix exportieren* (Benutzer und Gruppen als Excel-Matrix, auch zum Drucken), *Neutral importieren* und *Neutral exportieren* (eine herstellerneutrale Intercom-Datei mit Sprechstellen, Konferenzen und wer spricht oder hört), *Im Projekt speichern* und *Als .gg5 exportieren*. Ohne mindestens eine Station oder Gruppe entsteht keine gültige `.gg5` (*Ohne mindestens eine Station oder Gruppe entsteht keine gültige .gg5 — lege zuerst eine an.*). Eine Ausgabe der Datei schreibt zusätzlich ein Herkunftsblatt (`.herkunft.txt`).

   ![Export der Dateien](bilder/de/werkzeuge-bauen-greengo-07-export.jpg)
