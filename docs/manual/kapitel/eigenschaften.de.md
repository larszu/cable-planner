## Inspector

Der Inspector ist die rechte Seitenleiste der Anwendung. Sie zeigt Eigenschaften des aktuell ausgewählten Objekts — eines Geräts, eines Kabels, eines Rahmens oder einer Bibliotheks-Vorlage. Ist nichts ausgewählt, sieht der Inspector den Ist-Zustand des Plans: Fotos, die dem Plan gehören, und eine Schnelle Orientierung.

![Nichts ausgewählt im Inspector](bilder/de/eigenschaften-nichts-ausgewaehlt.jpg)

### Nichts ausgewählt

Wenn Sie kein Objekt auf dem Canvas ausgewählt haben, zeigt der Inspector drei Dinge:

- **Hinweis**: Eine kurze Orientierung — Geräte aus der Bibliothek auf den Canvas ziehen, Anschlüsse verbinden, um Kabel zu erstellen.
- **Fotos des Plans**: Der Abschnitt *Projekt-Fotos* enthält alle Bilder, die Sie ohne Zielgerät an den Plan anhängt haben. Das gehört dem Plan als Ganzes, nicht einem einzelnen Gerät.

### Geräteeigenschaften

Wenn Sie ein Gerät auf dem Canvas anklicken, zeigt der Inspector alle Eigenschaften dieses Geräts in verschiebbaren und umsortierbar Abschnitten.

#### Struktur und Umsortieren

Der Inspector organisiert Geräteeigenschaften in etwa 30 aufklappbaren Abschnitten. Jeder Abschnitt kann:

- **Auf-/zugeklappt** werden durch Klick auf die Kopfzeile. Der Zustand wird gespeichert.
- **Umsortiert** werden: Das ⠿-Griff-Symbol am linken Rand erlaubt Drag&Drop, um die Reihenfolge zu ändern. Die neue Reihenfolge wird pro Gerät gespeichert und überträgt sich auf alle Geräte derselben Art (z. B. alle Kameras).

![Geräteeigenschaften: Mixer-Überblick](bilder/de/eigenschaften-geraet-mixer-uebersicht.jpg)

#### Abschnitte filtern

Im oberen Bereich des Inspectors befindet sich ein Suchfeld mit dem Label *Abschnitte durchsuchen*. Geben Sie einen Namen oder Stichwort ein:

- Der Filter sucht in der **Abschnitt-ID** (z. B. `network-config`), im **Titel** (z. B. „Netzwerk") und im **Untertitel** (z. B. „3 in · 2 out").
- Alle Abschnitte, die nicht treffen, werden ausgeblendet.
- Ein Treffer wird automatisch aufgeklappt.

#### Alle aufklappen / zuklappen

Neben dem Suchfeld gibt es zwei Schaltflächen:

- **Alle auf** — öffnet alle Abschnitte.
- **Alle zu** — schließt alle Abschnitte.

### Die Abschnitte im Detail

#### Name und Notiz (oben, nicht verschiebbar)

- **Name**: Eindeutige Bezeichnung des Geräts (z. B. „ATEM 1", „Kamera Main").
- **Notiz**: Freies Textfeld für alles, was keinen Platz in einem anderen Feld hat (z. B. Web-UI, Firmware-Version, Standort, Zugehörigkeit).
- **Kurzname**: Automatisch aus dem Namen generiert (z. B. „ATEM" statt „ATEM Constellation 8K"). Wird in platzknappen Kontexten wie Port-Labels verwendet. Sie können den Auto-Vorschlag durch ein eigenes Wort überschreiben oder mit dem Refresh-Button (↻) zurücksetzen.

#### Ein- und Ausgänge (oben, Standardposition)

![Abschnitt: Ein- und Ausgänge](bilder/de/eigenschaften-sektion-ports.jpg)

Die Anschlüsse sind direkt unter Name und Notiz — oben im Panel, weil die ganze Anwendung um die Verkabelung dreht.

- **Eingänge**: Liste der Eingangs-Anschlüsse mit Typ (z. B. SDI, HDMI, Fiber).
- **Ausgänge**: Liste der Ausgangs-Anschlüsse.
- Je nach Gerät können Sie Anschlüsse hinzufügen, bearbeiten oder löschen.
- Jeder Anschluss zeigt seinen Namen (z. B. „SDI 1") und seinen Typ.

#### Kategorie

Wählen Sie die Geräte-Art (z. B. „Kamera", „Mischer", „Monitor", „Lagerbestand"). Die Kategorie bestimmt, welche anderen Felder im Inspector sichtbar sind (z. B. erscheint das Feld „Optik/Linse" nur bei Kameras).

#### Fotos

Laden Sie Bilder des Geräts hoch. Sie werden in der Galerie unter den Eigenschaften angezeigt.

- **Hinzufügen**: Klicken Sie auf das Plus-Symbol oder ziehen Sie Bilder direkt ins Feld.
- **Löschen**: Klicken Sie auf das X-Symbol eines Bildes.

#### Informationen zu Geräteart

Wenn das Gerät eine Spezial-Unterstützung hat (z. B. ATEM, Videohub, GreenGo Intercom), zeigt dieser Abschnitt einen Knopf zum Öffnen eines Geräteinformationen-Dialogs oder zum Exportieren (z. B. Export-Patch für ATEM).

#### Katalog und Herkunft

- **Katalog-Typ**: Der Hersteller und die Modell-Nummer aus der Geräte-Bibliothek (z. B. „Blackmagic Design: ATEM Constellation 8K").
- **Herkunft**: Zeigt, woher die Port-Informationen kommen (z. B. aus dem Datenblatt, manuell eingegeben, von Rentman).
- **In die Bibliothek speichern**: Legt das Gerät als Vorlage ab, um es später schneller platzieren zu können.

#### Netzwerk und Zugang

- **IP-Adresse**: Die Netzwerk-Adresse des Geräts (z. B. `192.168.1.10`).
- **Benutzername, Passwort**: Anmeldedaten für die Web-UI oder die API des Geräts.
- Diese Daten werden im Betriebssystem-Credential-Store gespeichert — nicht in der Projekt-Datei.

#### Streams und Ausspielziele

Falls das Gerät Live-Video-Feeds aussendet:

- **Stream-URL**: Der HTTP(S)- oder RTMP-Endpoint des Geräts.
- **Stream-Keys / Zugangsdaten**: Werden sicher im Credential-Store hinterlegt.

#### Optik und Linsendaten (nur Kameras)

![Abschnitt: Optik/Linse](bilder/de/eigenschaften-sektion-optik.jpg)

Für Kameras zeigt dieser Abschnitt:

- **Linsenmodell**: Z. B. „Canon CN7x7", „Fujinon HA22x7.6".
- **Fokussierer-Typ**: Manuell oder motorgesteuert (z. B. „Canon R-FS").
- **Steuerungsart**: Serielle Steuerung, ESP32-Bridge, Simulator (zu Test-Zwecken).

#### Stromversorgung und Stromkreis

- **Stromverbrauch**: Die typische Leistungsaufnahme in Watt (z. B. 150 W).
- **Stromkreis-Bauart**: Die Netzfrequenz und Betriebsart (z. B. „230 V AC, 16 A Kühlschrank" oder „12 V DC Batterie").
- **Anschlusspunkte**: Eine Tabelle zeigt, welche Anschlüsse an welche Stromschiene gehen (z. B. „Eingang 1 → Stromkreis A, Klemme 1").

#### Adapter

Falls das Gerät Adapter benötigt (z. B. XLR → BNC, Stecker → Buchse):

- Liste verfügbarer Adapter.
- Sie können Adapter hinzufügen oder aus einer Vorlage übernehmen.

#### DMX (für Steuergeräte)

Für Geräte mit DMX-Steuerung:

- **DMX-Startkanal**: Der erste belegte Kanal (z. B. 1, 65, etc.).
- **DMX-Geräte-ID**: Die Universum- und Kanal-Nummer.

#### Hausverkabelung

Dokumentiert Verkabelungsrouten innerhalb des Geräts (z. B. vom Eingang zum Mischer-Kern zum Ausgang).

#### Formatprofil

Die Eingangs-/Ausgangs-Formate und Codec-Profile, wenn das Gerät mehrere Betriebsmodi unterstützt.

#### Abmessungen

Breite, Höhe und Tiefe in Millimetern. Wird später für 3D-Rack-Visualisierung und Platzbedarf-Planung verwendet.

#### Netzwerk-Konfiguration

Erweiterte Netzwerk-Settings (falls das Gerät mehrere Netzwerk-Modi oder VLANs unterstützt).

#### Modi

Falls das Gerät verschiedene Betriebsmodi hat (z. B. „Aufnahme", „Live-Streaming", „Simulator"), können Sie diese hier konfigurieren.

#### Rackplatz

- **Rackposition**: Die HE (Höheneinheit) und Tiefe im 19"-Rack.
- **Rack-3D-Ansicht**: Zeigt eine 3D-Visualisierung der Geräte im Rack.

#### Lebenszyklus

- **Installationsstatus**: z. B. „Geplant", „Installiert", „Getestet", „Live".
- **Test-Ergebnisse**: Bestätigung, dass das Gerät funktioniert.
- **Wartungsplan**: Wartungstermine und nächste Überprüfung.

#### Druck und Dokumentation

Generiert Patch-Sheets und Dokumentation zum Ausdrucken (z. B. Geräte-Übersicht, Port-Listen).

#### Anhänge

Laden Sie Datenblätter, Handbücher oder andere Dateien hoch.

### Kabeleigenschaften

Klicken Sie auf ein Kabel auf dem Canvas, um seine Eigenschaften zu sehen.

![Kabeleigenschaften: Überblick](bilder/de/eigenschaften-kabel-uebersicht.jpg)

#### Verbindung (Von/Zu)

- **Von-Gerät und Von-Port**: Das Quell-Gerät und sein Port (z. B. „Camera 1 → SDI out").
- **Zu-Gerät und Zu-Port**: Das Ziel-Gerät und sein Port (z. B. → „Mixer → SDI in 1").
- Sie können diese durch Dropdown-Listen ändern.

![Kabel: Verbindung](bilder/de/eigenschaften-kabel-verbindung.jpg)

#### Beschriftung und Farbe

- **Name**: Eine Beschriftung für das Kabel (z. B. „Main Camera Feed").
- **Farbe**: Klicken Sie auf das Farbfeld, um die Darstellungsfarbe zu ändern.

#### Kabel-Typ und Spezifikation

- **Kabel-Spezifikation**: Wählen Sie einen Standard-Kabeltyp aus dem Katalog (z. B. „Belden 1694A SDI", „Fiber Optic SM9/125").
- **Länge**: Die Kabellänge in Metern.
- **Custom-Kabel**: Falls nicht im Katalog, können Sie den Typ als Freitext eingeben.

![Kabel: Routing und Spezifikation](bilder/de/eigenschaften-kabel-routing.jpg)

#### Routing

- **Orthogonal** (rechtwinkliger Knick): Das Kabel folgt einem rechtwinkeligen Weg (Standard).
- **Diagonal**: Das Kabel verläuft gerade von Quelle zu Ziel.
- **Gebogen**: Das Kabel zeigt einen Bezier-Kurvenverlauf.

#### Aderaufbau (bei Mehrleitern-Kabeln)

Falls das Kabel mehrere Adern hat (z. B. ein Audio-Multikabel mit 4 Paaren):

- Liste der einzelnen Adern mit ihren Funktionen (z. B. „Ader 1: Audio L", „Ader 2: Audio R").

#### Glasfaser-Modus (Fiber Optic)

Falls das Kabel eine Glasfaser ist:

- **Modus**: Singlemode (SM) oder Multimode (MM).
- **Wellenlänge**: z. B. 1310 nm, 1550 nm.

#### Hausverkabelung und Steigschacht

- Dokumentiert, ob das Kabel durch einen Hausverteilschrank oder Steigschacht führt.
- Notizen zum Installationsroute.

#### Lebenszyklu und Test-Ergebnisse

- **Status**: z. B. „Geplant", „Installiert", „Getestet", „Live".
- **Test-Resultat**: Pass/Fail mit Datum und Techniker.

### Rahmen-Eigenschaften

Klicken Sie auf einen Rahmen (LocationFrame), um seine Eigenschaften zu sehen.

#### Name

Der Name des Rahmens/Raums (z. B. „Studio A", „Serverraum", „Kontrolle").

#### Größe

- **Breite, Höhe** in Pixeln auf dem Canvas (bestimmt die sichtbare Größe der Box).

#### Farbe

Klicken Sie auf das Farbfeld, um die Rahmendarstellung zu ändern.

#### Etage

- **Stockwerk**: Wählen Sie aus vorhandenen Etagen oder erstellen Sie eine neue.
- Etagen können eine Höhenkote (z. B. „3. Stock (18 m)") haben.

#### Steigschacht

Ein besonderer Rahmen, durch den mehrere Kabelleitungen vertikal verlaufen (Routing-Dokumentation).

### Mehrfachauswahl

Wenn Sie mehrere Geräte gleichzeitig auswählen (Ctrl+Click oder Drag-Auswahl), zeigt der Inspector Eigenschaften, die **für alle** gelten:

- **Kategorie**: Nur wenn alle ausgewählten Geräte dieselbe Kategorie haben.
- **Gemeinsame Felder**: Felder, deren Wert bei allen gleich ist.

Dies erlaubt Batch-Änderungen, z. B. um mehrere Geräte auf einmal die gleiche Farbe zu geben oder in die gleiche Kategorie zu verschieben.
