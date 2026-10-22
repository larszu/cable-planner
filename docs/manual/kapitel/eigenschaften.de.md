## Inspector

Der Inspector ist die rechte Seitenleiste. Er zeigt die Eigenschaften dessen, was ausgewählt ist: eines Geräts, eines Kabels, eines Rahmens oder einer Bibliotheks-Vorlage. Die Kopfzeile nennt die Auswahl, zum Beispiel *Gerät: Camera 1*, *Kabel: CAM 1 → mixer* oder *Rahmen: Regie*.

### Nichts ausgewählt

![Inspector ohne Auswahl](bilder/de/eigenschaften-01-nichts-ausgewaehlt.jpg)

Ohne Auswahl zeigt der Inspector:

- *Nichts ausgewählt* mit dem Hinweis, ein Gerät, Kabel, einen Rahmen oder eine Library-Vorlage auszuwählen.
- *Fotos des Projekts*: Fotos, die dem ganzen Plan gehören und keinem einzelnen Gerät. *Foto hinzufügen…* öffnet die Dateiauswahl. Jedes Foto zeigt Größe und Herkunft (*vom Planer* oder *vom Handy*) und hat ein Feld *Notiz*.
- *Schnelle Orientierung* mit vier Hinweisen: Geräte aus der Library auf den Canvas setzen, Ports verbinden, um Kabel zu erstellen, mehrere Geräte auswählen und im Canvas als Gruppe speichern, Rentman-Aktionen im Equipment-Tab unter Rentman.

![Projektfoto hinzugefügt](bilder/de/eigenschaften-02-projektfoto-hinzugefuegt.jpg)

Der Knopf *Fenster* oben bietet *Abdocken (schwebend)* und *In eigenes Fenster*; der Pfeil daneben klappt den Inspector ein. Beides beschreibt [Seitenleisten anordnen](#seitenleisten-anordnen).

![Fenster-Menü des Inspectors](bilder/de/eigenschaften-04-fenstermenue-offen.jpg)

### Geräteeigenschaften

Ein Klick auf ein Gerät im Canvas zeigt seine Eigenschaften.

![Gerät gewählt](bilder/de/eigenschaften-07-kamera-gewaehlt.jpg)

Im Viewer-Modus und in einem abgeschlossenen Plan sind die Felder gesperrt; der Inspector sagt es oben. Ein abgeschlossener Plan wird über *Bearbeitung freigeben* im Canvas-Banner wieder bearbeitbar. Filtern und Auf- und Zuklappen gehen auch dann.

Oben stehen fest, in dieser Reihenfolge: Name, Kurzname, Untertitel, *Inputs & Outputs* und *Notiz*. Darunter folgen die aufklappbaren Abschnitte. Welche Abschnitte erscheinen, hängt von Kategorie, Gerät und eingeschalteten Modulen ab.

#### Abschnitte filtern, auf- und zuklappen

- Das Feld *Abschnitte filtern …* blendet alle Abschnitte aus, deren Titel, Untertitel oder Kennung den Suchtext nicht enthalten. Passende Abschnitte klappen auf. Das × leert das Feld.
- *Alle zu* klappt alle Abschnitte zu, *Alle auf* klappt alle auf.

![Filter „dmx“](bilder/de/eigenschaften-35-filter-dmx-getippt.jpg)

![Alle Abschnitte zugeklappt](bilder/de/eigenschaften-37-alle-zugeklappt.jpg)

#### Abschnitte umsortieren

Abschnitte mit dem Griff ⠿ lassen sich mit der Maus an eine andere Stelle ziehen. Die Reihenfolge gilt für alle Geräte und bleibt gespeichert. Name, Kurzname, Untertitel, *Inputs & Outputs* und *Notiz* stehen fest und haben keinen Griff.

#### Name, Kurzname, Untertitel

| Feld | Wirkung |
|---|---|
| Name | Bezeichnung des Geräts im Plan |
| Kurzname | kurze Form für Port- und Endpunkt-Beschriftungen; ohne eigene Eingabe wird er aus dem Namen gebildet (*automatisch*). Der Stift öffnet das Feld; *auto* stellt den gebildeten Kurznamen wieder her |
| Untertitel | optionale Zeile unter dem Namen am Knoten, z. B. „PGM Monitor“ |

![Kurzname bearbeiten](bilder/de/eigenschaften-10-kopf-kurzname-stift.jpg)

#### Inputs & Outputs

Der Abschnitt hat zwei Listen, *Inputs* und *Outputs*. Die Kopfzeile zählt sie, z. B. *0 In · 1 Out*.

![Inputs & Outputs](bilder/de/eigenschaften-15-ports-abschnitt.jpg)

1. *+ Hinzufügen* legt einen Port in der Liste an.

   ![Eingang hinzugefügt](bilder/de/eigenschaften-16-ports-eingang-hinzu.jpg)

2. Tragen Sie Nummer und Name ein und wählen Sie Steckertyp und Signalstandard.

   ![Port mit BNC](bilder/de/eigenschaften-18-ports-anschlusstyp-bnc.jpg)

3. Weitere Felder je Port:

   | Feld | Werte |
   |---|---|
   | Inhalt / Funktion | freier Text, z. B. „PGM“ |
   | Richtung | Richtung (auto), Nur Input, Nur Output, Bidirektional (z.B. Netzwerk) |
   | Seite | Seite (auto), Links, Rechts |
   | Geschlecht | Geschlecht (–), ♂ Male / Stecker, ♀ Female / Buchse |
   | Gruppe | — Kein —, vorhandene Gruppen, *+ Neue Gruppe …* |

   ![Signal, Inhalt und Richtung](bilder/de/eigenschaften-19-ports-signal-inhalt-richtung.jpg)

4. Bei SDI-Ports klappt *SDI-Fähigkeiten (port-spezifisch)* auf: *Max Single-Link* überschreibt den Wert des Geräts für diesen Port; *Quad-Link Set* und *Dual-Link Set* fassen Ports zu einem Set zusammen (*+ Neues Set…*). Ein neues Set meldet, wie viele Ports ihm schon zugewiesen sind.

   ![SDI-Fähigkeiten](bilder/de/eigenschaften-20-ports-sdi-faehigkeiten.jpg)

Eine Gruppe fasst zusammengehörige Ports zusammen. Ihre Art ist *Stereo (L/R)*, *M/S*, *Summe (A/B)*, *Gebrückt (+/-)*, *Powerlock-Satz (L1/L2/L3/N/PE)* oder *Sonstige*; je Port wird die Rolle in der Gruppe gewählt, bei Stereo L oder R.

Bei Glasfaser-Ports erscheinen zusätzlich *Breakout* (*DUO (2)*, *QUAD (4)*) mit einer Zeile je Faser (*TX (sendend)*, *RX (empfangend)*, *nicht angegeben*, *Faser hinzufügen*) sowie das *SFP-Modul* mit Stecker (LC, SC, ST, FC, E2000, MPO-MTP, opticalCON, LEMO) und Faserklasse (OM1–OM5, OS1, OS2).

Am Ende der Steckertyp-Liste legt ein eigener Eintrag einen neuen Stecker-Typ an; die App fragt nach dem Namen. Das × löscht einen Port.

Der Griff ≡ vor *Inputs* und *Outputs* tauscht die beiden Listen; *Ports spiegeln (Inputs rechts, Outputs links)* setzt die Eingänge an die rechte Seite des Knotens.

![Gespiegelter Knoten im Canvas](bilder/de/eigenschaften-33-ports-spiegeln-canvas.jpg)

#### Notiz

Freies Feld für alles, was kein eigenes Feld hat, etwa Web-Oberfläche, Firmware oder Standort.

#### Rentman-Hinweis und Kategorie

Ist das Modul Rentman eingeschaltet und das Gerät nicht im verknüpften Rentman-Plan, steht dort *Nicht im Rentman-Plan erfasst*. Darunter wählt *Kategorie* die Geräteart; *+ Neue Kategorie…* legt eine eigene an. Der Abschnitt *Fachdaten — <Kategorie>* zeigt die Felder dieser Art, bei Monitoren etwa Panel-Typ, HDR, Helligkeit, Bildrate und Farbraum.

![Fachdaten eines Monitors](bilder/de/eigenschaften-147-monitor-spezifikation.jpg)

#### Optionale Felder

![Optionale Felder](bilder/de/eigenschaften-41-opt-offen.jpg)

| Feld | Wirkung |
|---|---|
| Als korrekt verifizieren | bestätigt mit Ihrem Namen, dass die Ports stimmen; die Zahl der Bestätigungen steht daneben |
| Mietpreis / Tag | Preis mit Währung |
| Hersteller-Link | Adresse des Datenblatts; *Öffnen* ruft sie auf |
| Preis / Miete (€) | Wert für den Angebots-Export |
| Referenzbild | Bild, z. B. der Port-Belegung (*Auswählen…*) |
| Icon | Zeichen oder Emoji am Knoten, höchstens 2 Zeichen; leer bedeutet automatisch |

![Verifiziert](bilder/de/eigenschaften-44-opt-verifiziert.jpg)

#### Fotos

*Foto hinzufügen…* hängt ein Foto an das Gerät. Hat das Gerät einen Gerätetyp aus der Bibliothek, fragt die App *Auch für den Gerätetyp übernehmen?*. Mit *Auch für den Gerätetyp* erscheint das Foto an jedem Gerät dieses Typs im Plan und wird nur einmal gespeichert; *Nur dieses Gerät* hängt es nur hier an. Der Abschnitt zeigt dann zwei Listen: *Dieses Gerät* und *Gerätetyp* mit der Zahl der Geräte dieses Typs.

![Foto am Gerät](bilder/de/eigenschaften-50-fotos-hinzugefuegt.jpg)

#### Darstellung & Flags

![Darstellung & Flags](bilder/de/eigenschaften-52-flags-offen.jpg)

| Feld | Wirkung |
|---|---|
| Kompakte Darstellung | Knoten zeigt nur Icon und Name, Ports als Punkte |
| Gerätefarbe | Farbe des Knotens; *Reset* setzt sie zurück |
| Gepackt / Pack-Status | markiert das Gerät als gepackt: ✓ im Canvas und Spalte in der Geräteliste |
| Wandler (Patchliste folgt Durchgangskabel) | die Patchliste überspringt das Gerät und zeigt das nächste echte Ziel |
| Patchfeld (Durchgang folgt der Position) | Ein- und Ausgang gleicher Position gelten als durchverbunden |
| Verteilverstärker (1→N) | ein Eingang wird auf mehrere Ausgänge derselben Quelle verteilt |
| Timecode | —, Quelle, Senke |
| Tally | —, Quelle, Senke |
| Embedding | —, Embedder, De-Embedder |

![Kompakter Knoten](bilder/de/eigenschaften-54-flags-kompakt-canvas.jpg)

#### Signalquelle (Rolle)

Eine Rolle ist der redaktionelle Name einer Quelle, z. B. „Kamera 1“. Sie bleibt beim Gerätetausch erhalten. *Rolle* wählt eine vorhandene Rolle oder *Neue Rolle aus Gerätename anlegen…*. Eine Rolle hat Name, Nummer und eine TSL-UMD-Adresse; *Umbenennen* und *Verwerfen* ändern den Namen, *Rolle löschen* gibt alle Bindungen frei.

![Signalquelle](bilder/de/eigenschaften-60-quelle-offen.jpg)

#### Network & Access

![Network & Access](bilder/de/eigenschaften-66-netz-adresse-kennungen.jpg)

| Feld | Inhalt |
|---|---|
| IP Address, Subnet Mask, Gateway, VLAN-ID, MAC-Adresse | Netzdaten der ersten Schnittstelle |
| Seriennummer, Asset-Tag, Interne Nummer | Kennungen des Geräts |
| Einheit aus dem Bestand | die konkrete Einheit, die an diesem Platz steht |
| Username, Password | Anmeldedaten des Geräts |
| Rolle der ersten Schnittstelle | Medien primär, Medien sekundär, Steuerung, Management, nicht angegeben |
| Weitere Netzwerk-Schnittstellen | *Hinzufügen* legt weitere Schnittstellen an, je mit Rolle, Switch, PTP-Profil (ST 2059-2, AES67, IEEE 1588 Default) und PTP-Rolle (Grandmaster, Boundary Clock, Slave) |

Username und Password stehen in der Projektdatei. Beim Export und beim Teilen entfernt die App sie.

![Weitere Schnittstelle](bilder/de/eigenschaften-70-netz-schnittstelle-hinzu.jpg)

#### Streams

Streams, die das Gerät sendet oder empfängt. Benutzername, Passwort oder Passphrase in einer Adresse trennt die App heraus und legt sie im Schlüsselbund des Rechners ab, nie im Plan.

1. *Stream hinzufügen* legt einen Eintrag an.
2. Wählen Sie Protokoll (RTSP, SRT, RTMP, NDI, NDI-HX, HLS, MJPEG, WebRTC, WHIP, WHEP, RTP, ST 2110, Dante, AES67, Anderes) und Richtung (*Sendet*, *Empfängt*, *Sendet und empfängt*), dann Name, Adresse, Vorschau-Adresse, Port, Codec und Format.

   ![Stream eingetragen](bilder/de/eigenschaften-74-streams-gefuellt.jpg)

3. Auswahl:

   | Element | Wirkung |
   |---|---|
   | Standbild unter dem Gerät im Canvas zeigen | zeigt das Vorschaubild am Knoten |
   | Live-Bild | spielt den Stream ab, solange die Anzeige offen ist |
   | Scopes | zeigt Waveform und Vectorscope des Streams live; *Große Scopes* zeigt Waveform, Vectorscope, Parade und Histogramm in einem großen Panel |
   | Live-Waveform unter dem Gerät im Canvas zeigen | zeigt die Waveform am Knoten |

Das Live-Bild spielt die Desktop-App für RTSP, RTMP, SRT, HLS und MJPEG ab (braucht ffmpeg), der Browser HLS, MJPEG und WebRTC (WHEP). Die Adresse muss im lokalen Netz liegen; höchstens vier Streams laufen gleichzeitig. Geht es nicht, nennt die Anzeige den Grund.

#### Lebenszyklus / Wartung

Erscheint, wenn das Modul Festinstallation oder Vermietung eingeschaltet ist.

![Lebenszyklus](bilder/de/eigenschaften-76-lebenszyklus-offen.jpg)

| Feld | Werte |
|---|---|
| Status | — kein Status —, Geplant, Installiert, Getestet, In Betrieb, Störung, Außer Betrieb |
| Garantie bis | Datum |
| Wartungsintervall (Tage) | Zahl |
| Eigentum (nur Vermietung) | — k.A. —, Eigenbestand, Angemietet, Sub-Hire |
| Anschaffung, Lagerort, Lieferant (nur Vermietung) | Datum bzw. Text |
| Service-Historie | Einträge mit Datum, Art (Installation, Inspektion, Reparatur, Austausch, Notiz), Text und Autor; *Hinzufügen* legt einen an |

![Service-Historie](bilder/de/eigenschaften-79-lebenszyklus-historie.jpg)

#### Optik (MultiCam-Plan)

Bei Kameras aus einem MultiCam-Plan zeigt dieser Abschnitt nur lesend: Objektiv, Brennweitenbereich, eingestellte Brennweite, Extender, horizontalen Bildwinkel, Objektiv- und Kamera-Anschluss, Höhe, Schwenk, Neigung und eine Tabelle der Presets. Die Werte setzt der MultiCam-Planer; der nächste Kamera-Import aktualisiert sie.

#### Steuerbare Funktionen

Bei Kameras listet der Abschnitt je Steuerfunktion (Schwenken und Neigen, Zoom, Schärfe, Blende, Verstärkung, Verschluss, ND-Filter, Weißabgleich, Farbtemperatur, Rot- und Blau-Anteil, Detail, Preset abrufen und speichern), ob das Modell sie unterstützt. *nicht belegt* heißt, dass dazu keine Angabe vorliegt.

![Steuerbare Funktionen](bilder/de/eigenschaften-81-kamerasteuerung.jpg)

#### Steuerung über

Für Geräte, deren Steuerschnittstellen die App kennt (etwa Kameras mit VISCA oder AW-Protokoll, HyperDeck, KUMO), zeigt dieser Abschnitt nur lesend je Schnittstelle: Protokoll, Übertragung (seriell, SDI oder IP), Anschluss, Baud, Format, Pinbelegung, Flusssteuerung, Mehrpunkt, Netzwerk-Port und für eine Netzwerk-Bridge Modus, Port und Pakete. Angaben, die nicht in der Herstellerdoku stehen, sind als *Nicht in der Herstellerdoku* markiert. *Quelle* verweist auf die Dokumentation.

#### Kamera-Steuerung (Brücke)

Bei Kameras steht dieser Abschnitt unter den Schnittstellen. Gefahren wird ein Kamerakopf von der LZ Camera Bridge, einem Prozess im Regieraum. Der Abschnitt sagt ihr, wie sie den Kopf erreicht, schickt ihr den Raum und zeigt, was sie meldet. Die Zeile neben dem Titel nennt den Stand: *noch nicht auf der Brücke*, *Brücken-Slot n* oder *Brücken-Slot n · online*.

![Der Abschnitt Kamera-Steuerung](bilder/de/kamerasteuerung-02-abschnitt.jpg)

| Feld oder Knopf | Bedeutung |
|---|---|
| *Brücke (Raum)* und *Port* | Adresse der Brücke im Raum; der Port steht auf 9700. Sie gelten für das ganze Projekt. |
| *Verbinden* / *Trennen* | baut die Verbindung auf oder ab; der Zustand steht daneben als *Brücke verbunden* oder *Brücke nicht verbunden*. *Verbinden* bleibt gesperrt, solange keine Adresse eingetragen ist. |
| *Steuerweg* | wie die Brücke diesen Kopf erreicht: *– nicht erklärt –*, *Not remote-controlled*, *VISCA over IP*, *HTTP-CGI (Vissonic / PTZOptics, Sony SRG)*, *Panasonic AW PTZ*, *BirdDog*, *JVC ConnectedCam*, *Canon CCAPI*, *Blackmagic REST*, *Z CAM*, *Panasonic Lumix*, *Sony Monitor & Control*, *Sony CCU (700PTP)*, *VISCA RS-232 (at the bridge)*, *Sony RS-422 (at the bridge)*, *Sony USB (at the bridge)*, *DJI Ronin gimbal* und *DJI Osmo Pocket gimbal* |
| *Firmware-Familie* | nur bei *HTTP-CGI*: *Vissonic / PTZOptics* oder *Sony SRG / BRC* |
| *Steuer-Port* | Port des Kopfs; leer heißt *auto* |
| Hinweiszeile | die IP-Adresse kommt aus dem Abschnitt *Netzwerk*; ohne sie steht dort *noch keine IP-Adresse — im Abschnitt Netzwerk setzen* |

![Liste der Steuerwege](bilder/de/kamerasteuerung-05-steuerweg-liste.jpg)

![Steuerweg HTTP-CGI mit Firmware-Familie](bilder/de/kamerasteuerung-06-steuerweg-http-cgi.jpg)

*Raum an die Brücke schicken* ist bei bestehender Verbindung bedienbar. Es ersetzt die Kameras der Brücke durch die Kameras dieses Plans mit Adresse, Steuerweg, Stream, Ausrichtung und Shots. Die Brücke verbindet sie selbst und behält sie über Neustarts. Danach steht *n Kamera(s) geschickt*; Kameras ohne IP-Adresse oder ohne Steuerweg erscheinen unter *zurückgeblieben:*. Jede geschickte Kamera erhält ihre Slot-Nummer von der Brücke.

Hat die Kamera einen Slot und ist die Brücke verbunden, kommen dazu:

- *Kopf online* oder *Kopf offline* mit dem Knopf *Kopf verbinden*, das Tally *PGM* oder *PVW*, die Pose (*Pan … ° · Tilt … °*, bei Zoom auch dessen Anteil) und *Pose lesen*;
- *Livebild von der Brücke zeigen*, sofern der Slot eine Stream-Adresse hat;
- ein Steuerkreuz: Halten fährt, Loslassen stoppt; *⌂* fährt in die Grundstellung. Dazu kommen Tasten für Zoom und Fokus (*T/W* Zoom, *N/F* Fokus) und *AF*;
- die *Zoomkurve* mit *Punkt aufnehmen* (Brennweite in mm, am Objektiv abgelesen) und *Kurve löschen*;
- *Geplante Shots*: je Shot *Abrufen* (das im Kopf gespeicherte Preset), *Anfahren* (die geplante Pose) und *Kopf steht hier* mit anschließender Bestätigung, wodurch die Differenz zum Plan der Offset aller Shots wird. *Alle Shots im Kopf speichern* braucht einen zweiten Klick zur Bestätigung; *Offset löschen* nimmt den Offset wieder weg.

#### Videowand

*Videowand (Livebilder)…* im Abschnitt *Kamera-Steuerung (Brücke)* öffnet den Dialog *Videowand*. Er zeigt die Livebilder aller Kameras dieses Plans, die auf der Brücke einen Slot haben, als Kacheln. Das Fenster hat keinen Menüeintrag.

![Der Dialog Videowand ohne Brücke](bilder/de/kamerasteuerung-03-videowand.jpg)

Oben rechts stehen die Adresse der Brücke mit dem Zustand (ohne Adresse: *keine Brücken-Adresse in diesem Projekt*) und der Knopf *Bilder neu laden*. Ohne Kamera auf der Brücke steht *Noch keine Kamera dieses Plans ist auf der Brücke. Öffne eine Kamera, setze Steuerweg und Stream, und schicke den Raum an die Brücke.* Jede Kachel trägt unten *CAM n*, den Gerätenamen und bei Tally *PGM* oder *PVW*; der obere Rand färbt sich bei Programm und Vorschau. Fehlt der Kamera die Stream-Adresse, steht *keine Stream-Adresse*, fehlt sie auf der Brücke, *nicht auf der Brücke*. Bis zu vier Kacheln stehen in zwei Spalten, bis zu neun in drei, mehr in vier.

#### Stromverbrauch

Felder Spannung (V), Stromstärke (A) und Leistung (W). Sind Spannung und Stromstärke gesetzt, berechnet die App die Leistung (P = U × I).

![Stromverbrauch](bilder/de/eigenschaften-83-strom-werte.jpg)

#### Schaltbild (Strom)

*Bauart im Stromkreis* legt fest, als was das Gerät im Stromschaltbild zählt: keine, Einspeisung, Aus-Schalter, Wechselschalter, Kreuzschalter, Dimmer, Leuchte, Klemmstelle / Dose, Stromverteiler, Taster, Schütz, Relais, Not-Aus, FI-Schutzschalter, Leitungsschutzschalter. Danach wird jeder Anschluss einer Klemme der Bauart zugeordnet. Die Klemme hängt am Anschluss, nicht an seiner Position in der Liste.

![Schaltbild-Bauart](bilder/de/eigenschaften-85-stromkreis-rolle.jpg)

#### Adapter

*Dieses Gerät ist ein Adapter* öffnet die Felder:

| Feld | Werte |
|---|---|
| Seite zur Quelle, Seite zur Senke | Steckertypen |
| Richtung | nur in eine Richtung, in beide Richtungen, nicht erklärt |
| Speisung | passiv (kein Strom), aktiv, eigene Einspeisung, aktiv, Strom aus der Quelle, nicht erklärt |
| Lässt höchstens durch | höchster Signalstandard |
| Setzt an der Quelle voraus | Merkmal, das das Quellgerät unter *Kann* führen muss |
| Notiz | Text |

*Kann* führt die Merkmale, die ein Gerät erklärt. Leer heißt „nicht erklärt“, nicht „kann nicht“.

![Adapter eingetragen](bilder/de/eigenschaften-89-adapter-gefuellt.jpg)

#### DMX

*Dieses Gerät wird über DMX adressiert* öffnet Hersteller, Modell, die Liste der Modi und Universe und Adresse. *+ Modus* legt einen Modus mit Name, Kanalzahl und Herkunft an (Von Hand, GDTF-Datei, Pult-Patch, Am Gerät abgelesen, Geschätzt). Mit gewähltem Modus zeigt die Kopfzeile Modus, Kanalzahl und Adresse. *Diese Adresse behalten* schützt die Adresse vor der automatischen Vergabe.

![DMX eingetragen](bilder/de/eigenschaften-94-dmx-gefuellt.jpg)

#### Hausanschluss

*Gebäude-Datei laden…* liest eine `.avfacility`-Datei aus dem Gebäude-Werkzeug. Danach wählt *Hausanschluss* eine Dose oder Einspeisung des Hauses; die App zeigt Absicherung, Dauerleistung und ob die Dose geschaltet oder gedimmt ist. *Steueradresse* verknüpft eine Adresse des Hauses, etwa KNX oder DALI.

![Hausanschluss zugeordnet](bilder/de/eigenschaften-98-haus-zugeordnet.jpg)

#### Formatprofil (Senke)

*Für dieses Gerät ist erklärt, welche Formate es annimmt* öffnet das Profil. *Herkunft (Pflicht)* sagt, woher die Angabe stammt; ohne Herkunft verwirft die App das Profil beim nächsten Laden. *+ Format* legt eine Zeile an: Format, Bittiefe (8, 10, 12 bit), Farbformat (RGB, YCbCr 4:4:4, 4:2:2, 4:2:0) und Dynamik (SDR, HDR10, HLG, Dolby Vision). Ohne Profil sagt der Plan „nicht erklärt“.

![Formatprofil](bilder/de/eigenschaften-101-senke-format-hinzu.jpg)

#### Dimensionen

Breite, Höhe und Tiefe in mm. Die Kopfzeile zeigt die Maße.

![Dimensionen](bilder/de/eigenschaften-104-masse-gefuellt.jpg)

#### Betriebsmodi

Ein Betriebsmodus ist ein eigenes Port-Layout des Geräts.

1. *+ Neuer Modus (Editor)* öffnet *Neuer Betriebsmodus* mit Name, Beschreibung, Leistung und Gewicht in diesem Modus und eigenen Listen für Inputs und Outputs (*+ Port*). *Aus aktuellem Geräte-Layout übernehmen* kopiert die Ports des Geräts. *Modus anlegen* speichert.

   ![Neuer Betriebsmodus](bilder/de/eigenschaften-107-modi-editor-gefuellt.jpg)

2. *+ aus aktuellem Layout speichern* legt einen Modus aus den aktuellen Ports an; die App fragt nach dem Namen.
3. Je Modus öffnet *Editor* den Dialog; *Ports übernehmen* setzt das Layout des Modus am Gerät. Beim Löschen bleiben die Ports am Gerät erhalten.

![Modi](bilder/de/eigenschaften-112-modi-liste.jpg)

#### Bibliothek

*Als neue Standard-Vorlage speichern* überschreibt nach Rückfrage die Vorlage dieses Geräts in der Bibliothek. *Als neues Gerät in Library speichern* fragt nach einem Namen und legt eine neue Vorlage an.

![Bibliothek](bilder/de/eigenschaften-115-bib-speichern-offen.jpg)

#### Katalog & Herkunft

Verknüpft das Gerät mit einem Modell aus dem eingebauten Katalog; Datenblatt-Link, Lager-Abgleich und Stückliste nutzen das. *Von Hand wählen* öffnet eine Liste aller Katalogmodelle.

![Katalogwahl](bilder/de/eigenschaften-119-katalog-manuell.jpg)

#### Gerät ersetzen

*↔ Anderes Gerät wählen…* öffnet eine Liste der Bibliothek mit Kategoriefilter und Suche. Nach der Wahl zeigt die App, wie viele verkabelte Verbindungen bestehen und wie viele Eingänge und Ausgänge sie überträgt. *Ersetzen* tauscht das Gerät und erhält die Verkabelung.

![Ersetzen bestätigen](bilder/de/eigenschaften-124-ersetzen-bestaetigung.jpg)

#### Druck / Dokumentation

| Knopf | Wirkung |
|---|---|
| Geräte-Datenblatt (A4) … | öffnet das Datenblatt dieses Geräts |
| Patch-Sheet (A4 PDF) drucken | druckt das Patch-Sheet A4 |
| Patch-Sheet (A3 PDF) drucken | druckt das Patch-Sheet A3 |

Das Geräte-Datenblatt ist eine A4-Seite. Es gliedert sich in Fotos, Allgemein, Technische Daten, Fachdaten, Betrieb und Tabellen; jedes Feld hat ein Häkchen. *Ausgefüllte*, *Alle* und *Keine* setzen die Häkchen; *Drucken* und *PDF speichern* geben das Blatt aus.

![Geräte-Datenblatt](bilder/de/eigenschaften-126-datenblatt-dialog.jpg)

#### Schaltung (Signalweg)

Bei Geräten mit Ein- und Ausgängen, etwa Mischern und Kreuzschienen, legt dieser Abschnitt je Ausgang fest, welcher Eingang darauf liegt. Die Kopfzeile zählt die geplanten Ausgänge.

![Schaltung](bilder/de/eigenschaften-132-schaltung-kreuzpunkt.jpg)

*Steuer-Protokoll* bestimmt, wohin geschaltet wird:

| Protokoll | Zusatzfelder |
|---|---|
| keins — es wird nicht gesendet | keine |
| Blackmagic Videohub | Ziel; Schalter *ATEM-Eingangsnamen folgen der Route dieses Videohubs* |
| Blackmagic ATEM | Ziel; *Nummern am Gerät* je Ein- und Ausgang (Programm, Vorschau, Aux) |
| Bitfocus Companion | Companion-IP, Port, *Verbindungen abrufen*, Seite, Zeile, Spalte und zwei Variablen für Ausgang und Eingang |
| Erklärtes Text-Protokoll | Befehlszeile aus dem Handbuch des Geräts, Zeilenanfang, Zeilenende, Zählbeginn, Nummern, Ebene, Quittung, Port und Vorlagen, etwa Quartz / Evertz; eine Vorschau zeigt die gesendete Zeile |

*Ziel* ist *Anlage* (das Gerät im Netz) oder *Prüfstand (Emulator)*.

![Text-Protokoll mit Vorlage](bilder/de/eigenschaften-135-schaltung-text-vorlage.jpg)

Ist bei einem Videohub *ATEM-Eingangsnamen folgen der Route dieses Videohubs* eingeschaltet, listet der Abschnitt jeden Hub-Ausgang, der über Kabel an einem ATEM-Eingang endet. *Folgen starten* hält die Verbindung zum Hub offen; bei jedem Umschalten bekommt der ATEM-Eingang den Namen der neuen Hub-Quelle (Langname bis 20 Zeichen, Kurzname 4 Zeichen). Geschrieben werden nur Namen. Nur in der Desktop-App.

#### Rack / 19" Einstellungen

*Ist ein 19" Rack-Gerät* öffnet Höhe in HE, *Ansicht* (Nur vorne, Nur hinten, Vorne + hinten), *Frontgrafik importieren + zuschneiden*, *Reargrafik importieren + zuschneiden* und eine 2D-Vorschau mit den Ports.

![Rack-Einstellungen](bilder/de/eigenschaften-141-rack-hoehe-ansicht.jpg)

#### Display

Bei Monitoren: Auflösung und Diagonale in Zoll.

![Display](bilder/de/eigenschaften-146-monitor-anzeige-gefuellt.jpg)

#### Mehrere Geräte ausgewählt

Der Inspector bearbeitet immer ein Gerät. Aktionen für mehrere ausgewählte Geräte, etwa als Gruppe speichern oder ausrichten, liegen im Canvas.

### Kabeleigenschaften

Ein Klick auf ein Kabel zeigt seine Eigenschaften.

![Kabel gewählt](bilder/de/eigenschaften-160-kabel-gewaehlt.jpg)

| Feld | Wirkung |
|---|---|
| Kabeltyp / Standard festlegen | öffnet die Wahl von Kabeltyp und Standard |
| Fotos | Fotos dieses Kabels |
| Name | Bezeichnung; *↳ aus Quelle → Ziel* bildet sie aus Quelle und Ziel |
| Länge (m) | Länge des Kabels |
| Farbe | Farbe im Canvas |
| Ebene (Layer) | Video, Audio, Control, Network, Power, Other; wirkt mit dem Layer-Filter der Werkzeugleiste |
| Multicore / Snake | Name des Multicores, zu dem das Kabel gehört |
| Tie-Line / Festverbindung (permanent) | markiert eine feste Verbindung |
| Off-Page-Verbindung (Pfeil-Connector) | zeichnet statt der Linie zwei Pfeil-Verbinder mit *Netzname / Signalname* |
| Signalweg zeigen | hebt den Weg des Signals im Canvas hervor |
| Hausstrecke | ordnet das Kabel einer Strecke des Hauses zu |
| Notiz | Text |
| Kabel löschen | entfernt das Kabel |

![Name aus Quelle und Ziel](bilder/de/eigenschaften-161-kabel-name-quelle-ziel.jpg)

#### Signalweg zeigen

*Signalweg zeigen* hebt im Canvas alle Kabel und Geräte des Signalwegs hervor und blendet den Rest ab. Die Werkzeugleiste zeigt *Signalweg: n Kabel, n Geräte*; das × dort beendet die Hervorhebung.

![Signalweg im Canvas](bilder/de/eigenschaften-175-kabel-signalweg-canvas.jpg)

#### Festinstallation / Lebenszyklus

| Feld | Werte |
|---|---|
| Status | — kein Status —, Geplant, Installiert, Getestet, In Betrieb, Störung, Außer Betrieb |
| Trasse / Pfad | Text |
| Mantel/Brandklasse | Text |
| Term. A, Term. B | Terminierung an beiden Enden |
| Faser A, Faser B | bei Glasfaser die belegte Faser je Ende |
| Mess-/Test-Ergebnis | — nicht getestet —, PASS, FAIL; dazu *Marge dB*, *Standard/Limit* und *Report-Datei*; *Löschen* leert das Ergebnis |

![Lebenszyklus des Kabels](bilder/de/eigenschaften-167-kabel-messergebnis.jpg)

#### Adern (Strom)

*Gehört zum Anschluss* ordnet das Kabel einem Anschluss aus *Werkzeuge → Adern und Farbnormen* zu. *+ Leiter* legt einen Leiter an: Rolle (L1, L2, L3, N, PE, frei), Farbe (leer bedeutet aus der Norm) und Grund für eine Abweichung.

![Adern](bilder/de/eigenschaften-171-kabel-ader-gefuellt.jpg)

#### Verbindung

Zeigt Quelle und Ziel. *Von Gerät*, *Port*, *Nach Gerät* und *Port* ändern die Enden; belegte Ports tragen den Zusatz *belegt*, und die App warnt, wenn ein Port schon belegt ist.

![Verbindung](bilder/de/eigenschaften-177-kabel-verbindung-offen.jpg)

#### Darstellung des Kabels

| Feld | Werte |
|---|---|
| Routing | Ortho, Linie, Kurve |
| Stroke width | Linienstärke in px, Regler |
| Label Position | Start, Mitte, End; ein Klick auf die aktive Position blendet die Beschriftung aus; der Regler verschiebt sie fein entlang des Kabels |
| Endpoint-Labels (→ zum anderen Ende) | Auto (folgt *Einstellungen → Bearbeiten*), Anzeigen, Ausblenden |
| Dashed, Arrow ◄, Arrow ► | gestrichelte Linie und Pfeile |
| Bidirektional ⇌ | Pfeile an beiden Enden |

![Routing Kurve, Linienstärke und Beschriftung](bilder/de/eigenschaften-181-kabel-beschriftung-position.jpg)

#### Funkverbindung

*Wireless Verbindung (kein Kabel)* macht aus dem Kabel eine Funkstrecke. Statt der Länge steht *Max. Reichweite (m)*; dazu kommen Frequenz und Kanal.

![Funkverbindung](bilder/de/eigenschaften-188-kabel-funk-felder.jpg)

#### Adapter-Vorschlag

Passen die Stecker beider Enden nicht zusammen oder haben sie dasselbe Geschlecht, zeigt das Kabel einen Hinweis und passende Adapter oder Wandler aus der Bibliothek. *Einsetzen* fügt den Adapter in die Strecke ein; ein Rückgängig-Schritt entfernt ihn wieder.


### Rahmen-Eigenschaften

Ein Klick auf einen Rahmen zeigt seine Eigenschaften.

![Rahmen-Eigenschaften](bilder/de/eigenschaften-196-rahmen-eigenschaften.jpg)

| Feld | Wirkung |
|---|---|
| Name | Name des Raums |
| Breite (m), Tiefe (m) | Größe; darunter die Fläche |
| Stockwerk | Etage des Raums; *Etage hinzufügen…* legt eine an |
| Farbe | Farbe des Rahmens |
| Steigschacht / senkrechte Trasse | markiert den Rahmen als senkrechte Trasse zwischen Etagen |
| Raumnummer, Adresse, Notizen | Text |
| Etagen | Liste der Etagen von unten nach oben mit Fußbodenhöhe in Metern; die 3D-Ansicht stapelt die Räume danach. *Etagen aus der Gebäude-Auskunft übernehmen* liest sie aus einer Gebäude-Datei |

![Etagen](bilder/de/eigenschaften-202-etagen-verwaltung-offen.jpg)

| Knopf | Wirkung |
|---|---|
| Stückliste exportieren | öffnet die Stückliste des Raums mit Geräten, internen Kabeln und externen Verbindungen; *Kabel zusammenfassen*, *Plan einbetten* und *PDF exportieren* |
| Nur Rahmen löschen | löscht den Rahmen, die Geräte bleiben |
| Rahmen + Inhalt löschen | löscht nach Rückfrage den Rahmen mit allen Geräten und deren Kabeln |

![Stückliste](bilder/de/eigenschaften-206-rahmen-stueckliste-dialog.jpg)
