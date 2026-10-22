## Werkzeuge: Planen

Das Menü *Werkzeuge* gliedert sich in fünf Gruppen: *Berechnen*, *Prüfen*, *Planen*, *Erstellen & verwalten* und *Geräte-Konfiguration*. Dieses Kapitel beschreibt die Rechner, die Prüfungen und die Werkzeuge zum Erfassen und Planen vor Ort. Die übrigen Einträge der Gruppen *Planen* und *Erstellen & verwalten* stehen im Kapitel „Werkzeuge: Bauen“. Alle Dialoge öffnen sich über *Werkzeuge* und lassen sich mit dem **×** oder Esc schließen.

![Menü Werkzeuge](bilder/de/werkzeuge-planen-01-menue-werkzeuge.jpg)

Die Menüeinträge mit Hinweiszeile sind:

| Gruppe | Eintrag | Hinweiszeile |
|---|---|---|
| *Berechnen* | *Recording-Speicherplatz berechnen…* | – |
| | *Projektion & Display…* | – |
| *Prüfen* | *Analysen…* | Gewicht, Netzwerk, Redundanz, Kabelwege |
| | *Plan-Check…* | Findet Lücken und Widersprüche im Plan |
| | *Plan gegen Vorgefundenes…* | Vergleicht den Plan mit dem, was vor Ort steht |
| *Planen* | *Bestandsaufnahme (Vorhandenes erfassen)…* | Vorhandene Technik vor Ort erfassen: Name, Raum, vermutete Verbindung, Foto |
| | *Drum-Mikrofonierung…* | Mikrofone am Schlagzeug setzen und benennen |
| | *Funkstrecken / Gesang…* | Frequenzen, Sender, Empfänger im Spektrum |
| | *Ablauf und Kamera-Aufträge…* | Abschnitte einlesen, Aufträge je Kameraposition |
| | *Ausspielung (Streaming-Ziele)…* | Wohin gesendet wird, mit welchen Parametern |

### Berechnen

#### Recording-Speicherplatz berechnen

*Werkzeuge → Recording-Speicherplatz berechnen…* rechnet den Speicherbedarf einer Aufzeichnung: Codec-Bitrate × Dauer × Kanäle. Die Werte sind Richtwerte ohne Filesystem-Overhead.

![Recording-Speicherplatz-Rechner](bilder/de/werkzeuge-planen-02-speicher-offen.jpg)

| Feld | Bedeutung |
|---|---|
| *Codec / Bitrate-Preset* | Ein Preset mit Auflösung, Bildrate und Bitrate im Namen, zum Beispiel *ProRes 422 HQ (1080p25) — 220 Mbps*. Die Liste enthält ProRes 422 HQ, 422, 422 LT und 4444 (1080p25), ProRes 422 und 422 HQ (2160p25), DNxHD 220, 145 und 36 (Proxy), H.264 1080p (high), H.265 2160p (high), XDCAM HD422 50, AVC-Intra 100 und *Custom (eigene Bitrate)*. |
| *Eigene Bitrate (Mbps)* | Erscheint bei *Custom*. |
| *Stunden*, *Minuten*, *Kanäle* | Dauer und Zahl der Aufzeichnungskanäle. |

Das Ergebnis nennt *Effektive Bitrate*, *Dauer*, *Pro Kanal*, *Gesamt (n× Kanäle)* und die *Schreibrate* mit einer Einordnung (zum Beispiel *unkritisch* oder *einzelne HDD grenzwertig*).

1. Wählen Sie ein anderes Preset, hier *ProRes 422 HQ (2160p25)*.

   ![Anderes Preset](bilder/de/werkzeuge-planen-03-speicher-codec-gewaehlt.jpg)

2. Mit *Custom (eigene Bitrate)* tragen Sie die Bitrate selbst ein.

   ![Eigene Bitrate](bilder/de/werkzeuge-planen-04-speicher-custom.jpg)

3. Geben Sie Dauer und Kanäle ein.

   ![Vier Kanäle, viereinhalb Stunden](bilder/de/werkzeuge-planen-05-speicher-dauer-kanaele.jpg)

4. Der Block *Array-Dimensionierung* rechnet die Laufwerke: *Redundanz* (*Keine (JBOD)*, *RAID 5 (+1)*, *RAID 6 (+2)*, *Spiegelung (×2)*), *Reserve (%)* und *Laufwerk (TB)*. Das Ergebnis nennt *Nutzbedarf inkl. Reserve* und *Laufwerke nötig* (zum Beispiel „3 × 8 TB (roh 24.0 TB)").

   ![Array mit RAID 6](bilder/de/werkzeuge-planen-06-speicher-array.jpg)

5. *Formel* klappt die Rechenvorschrift auf.

   ![Formel](bilder/de/werkzeuge-planen-07-speicher-formel.jpg)

#### Projektion & Display

*Werkzeuge → Projektion & Display…* rechnet Bildgröße, Projektionsabstand und Sitzabstände und die Auflösung einer LED-Wand. Zwei Reiter: *Projektion & Display* und *LED-Wall*.

##### Reiter Projektion & Display

Eine zweite Auswahl wählt die Art: *Projektor* oder *Display / LED*.

![Projektion mit Vorgabewerten](bilder/de/werkzeuge-planen-08-projektion-offen.jpg)

| Feld | Bedeutung |
|---|---|
| *Diagonale* (″) | Bilddiagonale in Zoll. |
| *Seitenverhältnis* | *16:9 (HD/UHD)*, *16:10 (WUXGA)*, *4:3 (XGA)*, *21:9 (UltraWide)*, *2.39:1 (CinemaScope)* oder *1:1*. |
| *Unterkante über Boden* (m) | Höhe der Bildunterkante. |
| *Throw-Ratio* | Nur bei *Projektor*: Verhältnis Projektionsabstand zu Bildbreite. |
| *Lens-Shift vertikal* / *horizontal* (%) | Nur bei *Projektor*. |
| *Verfügbare Tiefe* (m) | Nur bei *Projektor*: Raumtiefe für die Prüfung des Abstands. |

Darunter wählen *2D-Plan* und *3D-Ansicht* die Vorschau. Der 2D-Plan zeigt eine Seitenansicht mit Projektor, Bildfläche und den Sitzabständen (*Erste Reihe*, *Optimal*, *Letzte Reihe*) und eine Frontansicht mit Maßen. Die Ergebnisfelder:

| Ergebnis | Bedeutung |
|---|---|
| *Bildfläche (B × H)* | Breite und Höhe des Bildes. |
| *Oberkante über Boden* | Höhe der Bildoberkante. |
| *Projektionsabstand (Objektiv → Bild)* | Throw-Ratio × Bildbreite (nur Projektor). |
| *Objektivhöhe über Boden*, *Objektivversatz zur Leinwandmitte* | Lage des Objektivs (nur Projektor). |
| *Max. Bildbreite im Raum* | Größte Bildbreite bei der verfügbaren Tiefe (nur Projektor). |
| *Min. Sitzabstand (THX 36°)* | Kleinster Abstand nach THX. |
| *Optimaler Sitzabstand (SMPTE 30°)* | Abstand nach SMPTE. |
| *Max. Sitzabstand (6 × Bildhöhe)* | Größter Abstand. |

Passt der Projektor nicht in die verfügbare Tiefe oder liegt das Objektiv unter dem Boden, meldet der Dialog das.

1. Tragen Sie Diagonale, Throw-Ratio und verfügbare Tiefe ein. Die Vorschau und die Ergebnisse folgen sofort.

   ![Werte eingetragen](bilder/de/werkzeuge-planen-09-projektion-wurf-werte.jpg)

2. *3D-Ansicht* zeigt den Raum mit Projektor, Bild und Sitzpositionen in drei Dimensionen.

   ![3D-Ansicht](bilder/de/werkzeuge-planen-10-projektion-3d.jpg)

3. *Display / LED* blendet die Felder des Projektors aus; es bleiben Diagonale, Seitenverhältnis und Unterkante.

   ![Art Display / LED](bilder/de/werkzeuge-planen-11-projektion-display.jpg)

##### Reiter LED-Wall

Der Reiter rechnet die Auflösung einer LED-Wand aus *Pixel-Pitch* (mm), *Breite* (m) und *Höhe* (m): *Auflösung* in Pixeln und *Pixel gesamt* mit Megapixeln. Die Faustregel lautet: Der Mindest-Betrachtungsabstand in Metern entspricht ungefähr dem Pixel-Pitch in Millimetern; bei 2,6 mm also ab etwa 2,6 m.

![Reiter LED-Wall](bilder/de/werkzeuge-planen-12-projektion-led.jpg)

![LED-Wand mit 3,9 mm](bilder/de/werkzeuge-planen-13-projektion-led-werte.jpg)

### Prüfen

#### Analysen

*Werkzeuge → Analysen…* öffnet einen Dialog mit 14 Reitern in zwei Zeilen: *Was ansteht*, *Kunden-Übersicht*, *Kosten: Plan gegen Ist*, *Crew: Stunden & Auslagen*, *Namensregel*, *Dante-Patch*, *Gewicht & Wärme*, *Netzwerk*, *Redundanz*, *RF / Funk*, *Kabelwege*, *Signalwege*, *Anschlussliste* und *Blatt prüfen*. Die Beispiele zeigen ein Projekt, in dem bewusst vieles unfertig ist.

![Analysen, Reiter Gewicht & Wärme](bilder/de/werkzeuge-planen-73-analysen-offen.jpg)

##### Was ansteht

*Was ansteht* sagt, was ansteht, und bearbeitet nichts. Die Seite sammelt Befunde aus den anderen Analysen nach Dringlichkeit: *Termin*, *Stand* (zum Beispiel *heute* oder *ohne Termin*), *Quelle* (zum Beispiel *Belege*, *Kosten*, *Crew*) und *Was*. Ohne Befunde steht *Nichts offen — es gibt zu diesem Stand nichts zu melden.*

![Was ansteht](bilder/de/werkzeuge-planen-92-ansteht-spaeter.jpg)

##### Kunden-Übersicht

Die *Kunden-Übersicht* ist eine Kennzahlentabelle (*Bereich*, *Kennzahl*, *Wert*, *Anteil*, *Grundlage*) für Geräte, Kabel und weitere Bereiche aus dem Plan, mit *CSV exportieren*. Ein Auswahlfeld legt fest, ob sie den Plan wie geplant oder als As-Built zeigt (*Wie geplant (kein As-Built)*).

![Kunden-Übersicht](bilder/de/werkzeuge-planen-75-kunde.jpg)

##### Kosten: Plan gegen Ist

Der Reiter vergleicht je Kostenposition Schätzung und Ist-Wert. Ohne Position steht *Keine Kostenposition — es gibt nichts zu vergleichen.* Je Zeile gibt es ein Bezugsgerät (*— ohne Bezug —* oder ein Gerät), *Schätzung*, *Ist-Wert* und die *Herkunft* des Ist-Werts (*aus dem ERP*, *von der Rechnung*, *von Hand geschätzt*, *Herkunft nicht angegeben*). Die Summenzeile zeigt die Projektschätzung (gerechnet), die Posten ohne Schätzung oder Ist-Wert und die Abweichung in Prozent; weicht sie über die gesetzte Toleranz ab, meldet der Reiter das (*Abweichung über der gesetzten Toleranz — „Kameras“ weicht um 12 % ab (Toleranz 10 %).*). Ein Ist-Wert ohne genannte Herkunft wird ebenfalls gemeldet.

![Kostenzeile](bilder/de/werkzeuge-planen-79-kosten-zeile-werte.jpg)

##### Crew: Stunden & Auslagen

Der Reiter rechnet Stunden, Sätze und Auslagen für einen Zeitraum (*von* … *bis*) und erzeugt das Blatt für die Buchhaltung (*Blatt als CSV*). Oben fasst eine Zeile zusammen: *Stunden*, *Arbeit*, *Auslagen weiterberechenbar*, *eigene Auslagen* und *an den Kunden*. Die Abschnitte:

| Abschnitt | Inhalt |
|---|---|
| *Personen* | Name und Firma / freiberuflich; *+ Person*. |
| *Zuschlagsbänder* | Bandname, Beginn, Ende, Zuschlag in Prozent, *nur sonntags*; *+ Band* (zum Beispiel „Nacht 20:00–06:00 +25 %“). |
| *Sätze* | Je Person eine Tätigkeit mit Stundensatz, optional Pauschale, Stunden ab und Zuschlag; *+ Satz*. |
| *Schichten* | Datum, Person und Tätigkeit, Beginn, Ende und Buchungsstand (*vorgemerkt*, *reserviert*, *bestätigt*, *geleistet*); die Zeile nennt Stunden, Betrag und Mehrarbeit. *+ Schicht*. |
| *Auslagen* | Datum, Art (*Fahrt*, *Übernachtung*, *Verpflegung*, *Material*, *Sonstiges*), Job, Betrag, Beleg, *geht an den Kunden*; *+ Auslage*. Ein Belegtext (Kassenbon-Mail, PDF-Text) lässt sich einfügen; die App liest Datum, Betrag, Aussteller, Währung und Steuersatz heraus und legt mit *Auslage aus Beleg anlegen* eine Auslage an. |
| *Belegdeckung je Kostenzeile* | Wie viel der Ist-Werte durch Belege gedeckt ist. Die belegte Summe wird nicht in den Ist-Wert geschrieben. |
| *Zusagen* | Eine Nachricht hineinkopieren; Zeitpunkt und Absender werden gelesen, soweit sie im Text stehen. *Zusage festhalten*. |
| *Übergabe an die Buchhaltung (netto)* | Die Posten je Person und die Einsatzpauschalen. |

Mehrarbeit ohne Zusage meldet der Reiter als Hinweis (*Mehrarbeit ohne Zusage — Max Beispiel hat am … 7.0 h Mehrarbeit — dazu liegt keine Zusage im Plan.*).

![Reiter Crew](bilder/de/werkzeuge-planen-81-crew-leer.jpg)

![Person und Zuschlagsband](bilder/de/werkzeuge-planen-83-crew-band.jpg)

![Schicht mit Mehrarbeit](bilder/de/werkzeuge-planen-87-crew-schicht-nacht.jpg)

![Beleg gelesen](bilder/de/werkzeuge-planen-89-crew-beleg-lesen.jpg)

![Zusage festgehalten und Übergabe](bilder/de/werkzeuge-planen-91-crew-uebergabe.jpg)

##### Namensregel

Der Reiter bildet Gerätenamen aus einer Regel statt aus dem Gefühl. Eine Zeile mit Trennzeichen, Schreibweise (*wie erzeugt*, *GROSS*, *klein*) und Kategorie (*— alle Kategorien —* oder eine) steuert die Vergabe; die Tabelle zeigt *Alter Name*, *Neuer Name* und die Zeichenzahl. *Anwenden (n)* benennt die Geräte um, *CSV exportieren* schreibt die Tabelle. Ändert die Regel nichts, sagt das der Reiter (*Die Regel ändert nichts*).

Darunter erzeugt *Aufnahmenamen* den Dateinamen jeder Aufzeichnung aus dem Plan: *Take*, *Trenner* und ein *Zettel fürs Deck (CSV)*. Die Tabelle nennt je Rolle den Recorder, den Kanal und den Dateinamen. Erreicht eine Rolle keinen Recorder, entsteht keine Aufzeichnung; das steht als Hinweis daneben.

![Namensregel](bilder/de/werkzeuge-planen-93-namen.jpg)

![Regel Großbuchstaben, Kategorie Audio](bilder/de/werkzeuge-planen-94-namen-regel.jpg)

![Take-Nummer in den Aufnahmenamen](bilder/de/werkzeuge-planen-96-namen-aufnahme.jpg)

##### Dante-Patch

*Matrix einlesen* liest die Subscription-Matrix eines Dante-Netzes ein und zeigt die Zahl der Empfangskanäle; *CSV exportieren* schreibt sie als Blatt. Liest man eine zweite Matrix ein, zeigt *Änderungen* den Vergleich (zum Beispiel *Tonmischer / 1 auf andere Quelle gelegt*).

![Dante-Matrix eingelesen](bilder/de/werkzeuge-planen-98-dante-eins.jpg)

![Änderungen zur zweiten Matrix](bilder/de/werkzeuge-planen-99-dante-zwei.jpg)

##### Gewicht & Wärme

Der Reiter zeigt Gewicht (kg), Leistung (W), Wärmelast (BTU/h) und Wert (€) je Kategorie aus den Geräte-Eigenschaften, mit einer Summenzeile. Eine Zeile nennt, wie viele Geräte ohne Gewichtsangabe sind. *Schwerste Geräte (Rigging/Transport)* listet die schwersten Geräte; *CSV exportieren* schreibt die Tabelle. Der Knopf *Stromverbrauch berechnen…* öffnet den [Stromrechner](#stromrechner).

![Gewicht & Wärme](bilder/de/werkzeuge-planen-100-gewicht.jpg)

###### Stromrechner

Der Rechner summiert die Leistungsangaben der Geräte (Geräte ohne Wert zählen nicht mit). *Anschluss-Typ* (zum Beispiel *CEE 32 A (3-phase, red)*) und *Sicherheits-Reserve (%)* bestimmen die Auslegung. Das Ergebnis nennt die erfassten Geräte, den Gesamtverbrauch plus Reserve in W und kW, den Strom, die Generatorgröße und die Wärme in BTU/h und kW; *Passt auf* nennt die Anschlüsse, die genügen. Die *Phasen-Verteilung* zeigt die Last je Phase und den Neutralleiter-Strom; *Geräte → Phase* weist Geräte fest einer Phase zu oder lässt sie auf *Auto* (der Balancer verteilt, sortiert nach Leistung). *EU-Farbcode (DIN VDE 0293-308)* nennt die Aderfarben. *CSV exportieren* und *PDF-Report* schreiben das Ergebnis. Weitere Abschnitte: *USV / Notstrom-Puffer* (Scheinleistung, Leistungsfaktor, Akku-Daten, Auslastung, empfohlene USV, geschätzte Pufferzeit), *Spannungsfall (Zuleitung)* (Leitungslänge, Querschnitt, Laststrom, Spannungsfall in Prozent mit Bewertung ≤ 3 %, > 3 %, > 5 %) und *Top-Verbraucher*.

![Stromrechner](bilder/de/werkzeuge-planen-101-strom-offen.jpg)

##### Netzwerk

Der Reiter *Netzwerk* gibt eine IP-/VLAN-Übersicht aller netzwerkfähigen Geräte mit Doppel-IP-Prüfung. Oben stehen *Bandbreite berechnen…* (siehe unten) und die Befunde: *Doppelte IP-Adressen* und *Dante-/AES67-Namen prüfen (≤31 Zeichen, a–z/0–9/-)* mit dem Vorschlag eines gültigen Namens. Darunter folgen die Tabelle *Gerät*, *IP*, *Mgmt-VLAN*, *VLANs* und die Abschnitte:

| Abschnitt | Inhalt |
|---|---|
| *Segmente (VLAN, Zweck, Zeit, Weg hinein)* | Je VLAN ein Segment mit Name, *Zweck* (*Medien primär*, *Medien sekundär*, *Steuerung*, *Management*, *nicht angegeben*), *PTP-Domäne* und *Weg hinein*. *N VLAN(s) aus dem Plan übernehmen* legt die Segmente an; *Segmente* exportiert, *Wer steht wo* listet die Geräte je Segment. Eine VLAN-Nummer allein sagt nicht, ob Dante dort hin darf; deshalb meldet der Reiter Segmente ohne Namen. |
| *Streams* | Gesendete und empfangene Streams der Geräte (Protokoll, Adresse, Format); *CSV*. |
| *Patchfeld-Beschriftung* | Streifen und Etiketten für Patchfelder: *Vorlage: automatisch* (oder eine Vorlage), *Streifen drucken*, *Generisch (CSV)* (Format wählbar) und *Datei für Etikettendrucker*. Steht ein Patchfeld in keinem Rack, sagt der Reiter das. |
| *Adressbereiche (stehender Plan + Haus-Ebene)* | *+ stehende Ebene* und *Haus-Ebene*; die Haus-Ebene ersetzt einen stehenden Bereich mit demselben Schlüssel. *Bereiche* exportiert. |
| *Subnetze* | Die Subnetze des Plans mit den Geräten. |
| *Adressplan* | Wie viele Netzgeräte adressiert sind; Hinweise zu fehlenden oder doppelten Adressen. |
| *Switch-Port-Karte* | Je Switch die Ports mit Gerät, Schnittstelle, Adresse und Art der Verbindung; *CSV* und *Beschriftung*. |
| *Anforderung an die Haus-IT* | Die Wünsche an das Haus-Netz (VLANs, Adressbereiche, Netz-Ports, Medien-Bandbreite, Multicast-Standards, PoE, IGMP-Querier, PTP, DHCP, QoS / DSCP). Zu jedem Punkt lässt sich die Antwort festhalten: *genehmigt*, *mit Auflage* (mit Feld *Auflage oder Umweg im Klartext*), *abgelehnt* oder *keine Antwort*. *CSV*. |
| *Zeit (PTP)* | Die PTP-Domänen und die Frage, welches Gerät die Uhr stellt. |
| *Welche Kiste füllt welchen Platz* | Geräte mit Netz-Identität, aber ohne benannte Einheit. |
| *Multicast-Adressplan* | *Pool (CIDR)* und *UDP-Port*; *Vergeben* weist den Streams Adressen zu. |

![Netzwerk, oberer Teil](bilder/de/werkzeuge-planen-110-netz-oben.jpg)

![Segmente aus dem Plan übernommen](bilder/de/werkzeuge-planen-112-netz-segmente-uebernehmen.jpg)

![Subnetze, Adressplan, Switch-Port-Karte](bilder/de/werkzeuge-planen-119-netz-subnetze.jpg)

![Anforderung an die Haus-IT](bilder/de/werkzeuge-planen-122-netz-haus-anforderung.jpg)

![Antworten der Haus-IT festhalten](bilder/de/werkzeuge-planen-123-netz-haus-antwort.jpg)

![Zeit (PTP) und Welche Kiste füllt welchen Platz](bilder/de/werkzeuge-planen-124-netz-ptp.jpg)

###### Bandbreite berechnen

*Bandbreite berechnen…* rechnet die Brutto-Datenrate eines Video-Streams vor der Kompression und nennt den kleinsten SDI-Tier, der sie trägt (Pixel × Zeilen × fps × Bits pro Pixel). Überschreitet sie 12G-SDI, steht dort *nur über IP-Transport (ST 2110, NDI, JPEG-XS …) möglich*. Aufklappbare Listen nennen die SDI-Tiers und die IP-/Digital-Signalstandards. Der Abschnitt *Projekt-Netzwerk-Budget* summiert die Brutto-Bandbreiten aller Kabel mit IP-Mediensignal (NDI, Dante/AES67, ST 2110); Ethernet-Kabel zählen nicht als Last, ihre Kapazität steht getrennt darunter.

![Bandbreitenrechner](bilder/de/werkzeuge-planen-129-bandbreite-offen.jpg)

##### Redundanz

Die Tabelle *Gerät* / *Befund* nennt je Gerät, was an Redundanz fehlt, zum Beispiel *nur eine Strom-Anbindung (keine Netzteil-Redundanz)*, *keine Strom-Anbindung im Plan* oder *ST 2110 ohne 2110-7-Redundanz (nur ein Netzwerk-Pfad)*. *CSV exportieren* schreibt sie.

![Redundanz](bilder/de/werkzeuge-planen-133-redundanz.jpg)

##### RF / Funk

*RF / Funk* rechnet alles, was im Plan funkt — das Funkmikrofon-Rig und die Funkstrecken — in einer Rechnung. Der Reiter nennt die Zahl der Sender im Plan, Sender ohne Frequenz (sie sind in keiner Rechnung enthalten) und listet *Mögliche RF-Konflikte* (zum Beispiel gleicher WLAN-Kanal) und *Frequenz-Befunde über das ganze Spektrum* (Trägerabstand und Intermodulation 2. und 3. Ordnung).

Darunter stehen *Freie Frequenzen im Band* (Band wählbar), die *Frequenzbänder (Sennheiser / Shure / …)* als Tabelle mit Hersteller, Serie, Band, MHz-Bereich und Hinweisen (zum Beispiel *EU eingeschränkt*) und der *Spektrum-Scan vom Analyser*: *Scan einlesen* liest eine CSV mit Messpunkten ein (*21 Messpunkte · 600–610 MHz*); *belegt ab (dBm)* legt die Schwelle fest, *Abgleich* prüft die Träger gegen den Scan. Träger außerhalb des gemessenen Bereichs sind gesondert aufgeführt; „nicht gemessen“ heißt nicht „frei“.

![RF / Funk](bilder/de/werkzeuge-planen-134-rf.jpg)

![Frequenzbänder](bilder/de/werkzeuge-planen-136-rf-bandtabelle.jpg)

![Spektrum-Scan eingelesen](bilder/de/werkzeuge-planen-137-rf-scan.jpg)

##### Kabelwege

Der Reiter meldet Kabel, deren Länge nicht stimmt: *Geschätzte Längen tragen ihre Herkunft.* Er nennt Kabel, bei denen sich eine geschätzte Länge seit der Schätzung geändert hat, und Kabel über der Reichweite ihres Typs (zum Beispiel *Länge 2500 m über der Reichweite von 2000 m*), jeweils mit den Diensten, die im Strang laufen. *CSV* schreibt die Liste.

![Kabelwege](bilder/de/werkzeuge-planen-139-wege.jpg)

##### Signalwege

Der Reiter listet die mehrstufigen Wege: Quelle, Port, Kabelnummer, Zwischengerät (*Wandler*, *Patchfeld*) und *Endgerät erreicht*.

![Signalwege](bilder/de/werkzeuge-planen-140-signal.jpg)

##### Anschlussliste

Die Anschlussliste führt jeden Netzanschluss mit Gerät, Schnittstelle, IP, VLAN, Weg und dem erreichten Switch-Port auf, mit *Quelle* (*Kabel*, *Schnittstelle*, *Kabel + Schnittstelle*). Anschlüsse, deren Weg an einem anderen Gerät als einem Switch endet, stehen unter *Ohne erreichten Switch*. *Nur offene* zeigt nur die ungelösten; *CSV* exportiert.

![Anschlussliste](bilder/de/werkzeuge-planen-141-anschluss.jpg)

##### Blatt prüfen

*Blatt prüfen* nimmt ein Blatt in die Hand: Tippen Sie den Stand vom Fuß (acht Zeichen) oder den ganzen Dokument-Code ein; *Prüfen* sagt, ob das Blatt zum aktuellen Plan passt, nicht lesbar ist oder zu einem anderen Projekt gehört.

![Blatt prüfen](bilder/de/werkzeuge-planen-146-blatt-fremd.jpg)

#### Plan-Check-Dialog

*Werkzeuge → Plan-Check…* findet Lücken und Widersprüche im Plan. Die Prüfung läuft laufend gegen den aktuellen Plan, nicht erst beim Speichern. Oben stehen die Zahlen der Hinweise nach Schwere (Fehler, Warnungen, Infos) und die Gesamtzahl. Jede Zeile nennt die Art (zum Beispiel *Doppelte Kabelnummer*, *Doppelte IP*, *Hausanschluss*, *Adernbündel*, *Stecker-Mismatch*, *Kabellänge*, *Audio sym/unsym*, *Drum-Mikrofonierung*, *Dual-Link*, *Fibre breakout*) und den Befund. Ein Klick auf eine Zeile markiert das betroffene Objekt im Plan. In der Statusleiste unten zeigen drei farbige Zähler denselben Stand.

![Plan-Check](bilder/de/werkzeuge-planen-148-check-offen.jpg)

![Statusleiste mit Zählern](bilder/de/werkzeuge-planen-147-statusleiste.jpg)

#### Plan gegen Vorgefundenes

*Werkzeuge → Plan gegen Vorgefundenes…* vergleicht den Plan mit dem, was vor Ort steht: Was vom LKW kam, unter welchen Namen und mit welchen Adressen — gegen das, was der Plan sagt. *Datei einlesen* liest eine CSV-Datei der Funde. Jede Zeile nennt das Ergebnis (*stimmt*, *Adresse weicht ab*, *nicht gefunden*, *nicht im Plan*, *nicht eindeutig — keine Zuordnung*), das gefundene Gerät mit Adresse und die Art der Zuordnung (*über IP* oder *über NAME*). Eine Zeile oben zählt die Ergebnisse. Der Knopf *As-Built* schreibt das As-Built-Blatt (wie geplant / wie gebaut); die Zeile *n von m Angaben nachgesehen* sagt, wie viele Angaben schon geprüft sind. *CSV* exportiert den Vergleich.

![Plan gegen Vorgefundenes, noch ohne Datei](bilder/de/werkzeuge-planen-153-abgleich-offen.jpg)

![Vergleich mit eingelesener Datei](bilder/de/werkzeuge-planen-154-abgleich-datei.jpg)

### Planen

#### Bestandsaufnahme

*Werkzeuge → Bestandsaufnahme (Vorhandenes erfassen)…* ist für den Gang durch den Raum: aufschreiben, was man sieht. Die Felder: *Gerät* (Pflicht), *Raum* (bleibt für den nächsten Eintrag stehen), *Verbunden mit (vermutet)* und *Notiz*. *Erfassen (Enter)* legt den Eintrag an; steht ein Gerät gleichen Namens schon im Plan, sagt die App das („…“ steht im Plan.).

Zwei Listen: *Vom Telefon (n)* zeigt Einträge, die ein Telefon gemeldet hat (am Telefon *Mitschreiben* einstellen, *Melden* → *Neues Gerät*; vorher muss der Telefonzugriff eingeschaltet sein). Ein Haken übernimmt den Eintrag, **×** verwirft ihn. *Erfasst, noch nicht ausgearbeitet (n)* sammelt die erfassten Einträge; *Erledigt* nimmt einen Eintrag aus der Liste. Am Eintrag lässt sich unter *Fotos* mit *Foto hinzufügen…* ein Foto anhängen („Ein Foto beantwortet Fragen, für die es kein Feld gibt.“).

![Bestandsaufnahme](bilder/de/werkzeuge-planen-14-bestand-offen.jpg)

![Eintrag erfasst](bilder/de/werkzeuge-planen-17-bestand-erfasst.jpg)

![Foto hinzufügen](bilder/de/werkzeuge-planen-19-bestand-fotos.jpg)

![Vom Telefon übernommen](bilder/de/werkzeuge-planen-20-bestand-telefon-annehmen.jpg)

#### Drum-Mikrofonierung

*Werkzeuge → Drum-Mikrofonierung…* setzt und benennt die Mikrofone am Schlagzeug. Links steht das Kit als Draufsicht mit den Zonen *Kick*, *SN Top*, *SN Bot*, *HiHat*, *Tom 1*, *Tom 2*, *Floor Tom*, *Ride*, *OH L*, *OH R*, *Room L* und *Room R*. Oben setzen die Presets *Technik* einen Startpunkt: *Minimal (Kick + Overheads)*, *Glyn Johns (4 Mics)*, *Recorderman (Kick, Snare, 2 OH)* und *Full Close (alle Kessel + OH + Room)*; *Alle Mics entfernen* leert das Kit.

![Drum-Mikrofonierung](bilder/de/werkzeuge-planen-22-drum-offen.jpg)

1. Ein Preset setzt die Mikrofone der Technik (hier *Glyn Johns*).

   ![Technik Glyn Johns](bilder/de/werkzeuge-planen-23-drum-technik.jpg)

2. Ein Klick auf eine Zone zeigt rechts ihre Mikrofone. *+ Mic* fügt ein Mikrofon hinzu, die Auswahl *— Mikrofon wählen —* ordnet ihm ein Modell zu (Dynamische, Kondensator- und Bändchenmikrofone gängiger Hersteller), der Papierkorb entfernt es.

   ![Zone Kick mit Mikrofon](bilder/de/werkzeuge-planen-24-drum-zone.jpg)

3. Rechts stehen weiter *Subsnake* (die Größe der Stagebox: *8*, *12*, *16*, *24* oder *32 Eing.*), *Patchliste* und *Etiketten* (Ausgabe der Kanalliste beziehungsweise der Beschriftungen) und *Kanalliste & Bedarf* mit der Zahl der Kanäle, der 48-V-Kanäle und der Kanäle ohne Mikrofon. Die *Materialliste* nennt Mikrofone, XLR-Kabel, Stative und Kessel-Clamps; *kopieren* übernimmt sie in die Zwischenablage.

   ![Kanalliste und Materialliste](bilder/de/werkzeuge-planen-25-drum-mikro-dazu.jpg)

4. *Kit bearbeiten* öffnet den Kit-Editor: Zonen im Bild verschieben, umbenennen, löschen und neue Zonen (Kick, Snare, Tom, HiHat, Ride, Crash, Overhead, Room) hinzufügen. *Kit fertig* beendet das Bearbeiten.

   ![Kit zusammenstellen](bilder/de/werkzeuge-planen-28-drum-kit-bearbeiten.jpg)

5. *Full Close* setzt alle Kessel, Overheads und Room-Mikrofone: zwölf Kanäle.

   ![Full Close](bilder/de/werkzeuge-planen-31-drum-full-close.jpg)

Fehlen im Plan Mikrofoneingänge für das Kit, meldet der [Plan-Check](#plan-check-dialog) das (*Drum-Kit braucht 12 Mic-Inputs …*).

#### Funkstrecken / Gesang

*Werkzeuge → Funkstrecken / Gesang…* plant Funkmikrofone und prüft ihre Frequenzen. Die Kopfzeile hat *+ Kanal*, die Zahl der Kanäle, die Zahl der RF-Konflikte, die Auswahl *— Land —* (Deutschland, Österreich, Schweiz, Niederlande, Frankreich, USA) mit dem Knopf *Frequenztabelle*, *CSV* und *Drucken / PDF*. Je Kanal gibt es eine Zeile mit:

| Spalte | Bedeutung |
|---|---|
| *Kanal* | Name des Kanals. |
| *Sender (Body)* | Handsender oder Taschensender (zum Beispiel Shure AD2, ULXD2, QLXD2, Sennheiser SKM 6000, SK 6000). |
| *Kapsel / Headset* | Die zum Sender kompatiblen Kapseln; ein Haken zeigt, dass die Kombination passt. |
| *Band* | Das Frequenzband des Geräts (zum Beispiel *GB · 606–648*, *S1-7 · 606.2–662*); die Auswahl lässt sich nach Land eingrenzen. |
| *Frequenz (MHz)* | Die Trägerfrequenz. |
| *Bandbreite (kHz)* | Die belegte Bandbreite. |

Der Kasten *RF-Koordination — Konflikte* listet, was nicht passt: *Abstand* (Träger zu nah beieinander, Abstand kleiner als die Bandbreite) und *IMD3·3* beziehungsweise *IMD3-2* (Intermodulation dritter Ordnung mit zwei oder drei Sendern). Geprüft werden Trägerabstand und Intermodulation. Der Plan wird einbezogen: Funkstrecken aus dem Plan, etwa Kamerafunk oder WLAN, erscheinen mit.

![Funkstrecken / Gesang](bilder/de/werkzeuge-planen-35-funk-offen.jpg)

![Kanal angelegt](bilder/de/werkzeuge-planen-36-funk-kanal.jpg)

![Sender und Kapsel gewählt](bilder/de/werkzeuge-planen-38-funk-kapsel.jpg)

![Frequenz eingetragen](bilder/de/werkzeuge-planen-39-funk-frequenz.jpg)

##### Mic-Plot

Der Abschnitt *Mic-Plot — wer trägt welche Strecke* hält für jede Sitzung fest, wer welche Strecke trägt. Der Kanalplan oben gehört zur Produktion; wer welche Strecke trägt, ändert sich je Vorstellung — dafür ist dieser Abschnitt.

| Bedienung | Wirkung |
|---|---|
| *Session* (Auswahl) und *+ Session* | Wählt oder legt eine Sitzung an. |
| *Aus vorheriger übernehmen* | Übernimmt die Zuordnungen der Vorsitzung; sie gelten für heute als nicht bestätigt (*Übernommen und nicht bestätigt*). |
| *Session-Blatt* | Exportiert das Blatt der Sitzung. |
| *+ Person* | Fügt eine Zeile mit *Person*, *Funktion*, *Kanal*, *Sender* und *Akku eingelegt* hinzu. |

Die App weist auf Lücken hin: *Akku-Wechsel nicht festgehalten* (steht nicht, wann der Akku eingelegt wurde) und *Zwei Personen auf demselben Kanal*.

![Mic-Plot, Person angelegt](bilder/de/werkzeuge-planen-43-funk-person-daten.jpg)

![Zwei Personen auf einem Kanal](bilder/de/werkzeuge-planen-44-funk-person-doppelt.jpg)

![Zweite Sitzung mit Übernahme](bilder/de/werkzeuge-planen-47-funk-uebernehmen.jpg)

#### Ablauf und Kamera-Aufträge

*Werkzeuge → Ablauf und Kamera-Aufträge…* liest den Ablauf der Redaktion ein und weist je Abschnitt jeder Kameraposition einen Auftrag zu. Der Ablauf gehört der Redaktion und wird hier nur gelesen.

1. Tragen Sie *Herkunft* (zum Beispiel „ablauf.xlsx, Mail vom 9. Sept.“) und *Stand der Quelle* (zum Beispiel „v4“) ein.

   ![Herkunft und Stand](bilder/de/werkzeuge-planen-49-ablauf-herkunft.jpg)

2. Fügen Sie den Ablauf in das Textfeld ein — je Zeile Nummer, Titel und Notiz, getrennt durch Tab oder Semikolon — und klicken Sie auf *Einlesen*.

   ![Ablauf eingefügt](bilder/de/werkzeuge-planen-50-ablauf-text.jpg)

3. Das Ergebnis nennt die Zahl der Abschnitte mit Herkunft und Stand. Zeilen, die sich nicht lesen lassen, meldet die App und übernimmt sie nicht (*Zeile 3: Nummer ohne Titel — nicht übernommen*).

   ![Ablauf eingelesen](bilder/de/werkzeuge-planen-51-ablauf-eingelesen.jpg)

4. Die Tabelle *Wer macht was* hat je Abschnitt eine Spalte je Kameraposition. Tragen Sie die Aufträge ein (zum Beispiel „Totale“, „Nahe Moderation“). Der Auftrag hängt an der Rolle, nicht am Gerät — springt die Havarie-Kamera ein, bleibt er stehen. Die Zeile unten zählt die Aufträge je Kamera (*Kamera 1: 3/4*).

   ![Aufträge eingetragen](bilder/de/werkzeuge-planen-52-ablauf-auftrag.jpg)

5. Liest man den Ablauf neu ein, bleiben die Aufträge zu gleichen Abschnitten erhalten.

   ![Neu eingelesen](bilder/de/werkzeuge-planen-54-ablauf-neu-einlesen.jpg)

#### Ausspielung

*Werkzeuge → Ausspielung (Streaming-Ziele)…* hält fest, wohin gesendet wird, mit welchen Parametern und welcher Weg der Ausweichweg ist. Oben stehen *CSV*, *Ablaufblatt* und *Ausspielweg*; der Dialog ist ein langer, scrollbarer Bogen. Ohne Ziel steht *Noch kein Ausspielziel. Lege eins an.* mit *Ziel hinzufügen*.

![Ausspielung ohne Ziel](bilder/de/werkzeuge-planen-55-ausspielung-offen.jpg)

Der Bogen hat diese Abschnitte:

| Abschnitt | Inhalt |
|---|---|
| *Unabhängige Archiv-Aufzeichnung* | Die Frage, wo die Archiv-Aufzeichnung liegt: *— noch nicht beantwortet —*, *auf diesem Gerät* (dann mit Gerätewahl und Anmerkung) oder *bewusst keine*. Unbeantwortet ist das eine offene Frage, keine Warnung über ein Gerät. *Blatt* exportiert das Archiv-Blatt. |
| *Angaben zur Veranstaltung* | Titel, *Sichtbarkeit* (*öffentlich*, *nicht gelistet*, *privat*; es gibt keinen Vorgabewert), Beginn, Zeitzone, Vorschaubild, Schlagworte, Beschreibungstext. Darunter *Bewusste Abweichungen je Ziel* (leer heißt „gilt wie am Projekt“; eine Abweichung braucht eine Begründung). |
| *Sendebericht* | Was die Sendung getan hat, soweit jemand es aufgeschrieben hat: *Eintrag* hinzufügen (Sendestart, Sendeende, Abriss, Verschlechterung, Umschaltung, Wieder normal, Änderung während der Sendung, Beobachtung) mit Zeitpunkt, Ziel und Herkunft (*gesehen*, *aus Log abgetippt*, *gemeldet*), eine Zusammenfassung für den Kunden (bewusst von Hand) und *Blatt*. |
| *Ausweichverhalten (Sicherheitsnetz)* | Welches Gerät den Wächter betreibt (*Wächter läuft auf*), die Statistik-Quelle und die Szenen im Encoder (*Übernehmen*); je Ziel *Normalbetrieb*, *Niedrige Bitrate*, *Offline* und Schwellen. *Blatt* und *Gerüst* schreiben die Unterlagen. |
| *Uplink (Mbit/s)* | Der verfügbare Uplink; die Zeile rechnet geplante gegen nutzbare kbit/s (nach 40 % Kopfraum). |
| Ziele | Je Ziel Plattform (*YouTube Live*, *Twitch*, *Eigenes Ziel*), Transport (*RTMP*, *SRT*, *HLS*), Encoder (ein Gerät des Plans) und Weg (*eigener Weg* oder ein Ausweichweg), die Adresse, der *Stream-Key* (*Key speichern* legt ihn im Schlüsselbund ab; er steht nicht im Projekt), Breite, Höhe, fps, Video-kbit/s, Keyframe-Abstand, Audio, Codec und bei SRT Modus und gemessene RTT mit der empfohlenen Latenz. Für die Steuerung des Encoders sind OSC-Adresse, Companion-Seite und -Platz anzugeben. |

Zu jedem Ziel prüft die App und meldet zum Beispiel *Kein Stream-Key hinterlegt*, *Bitrate 15000 kbit/s über der Plattform-Grenze von 12000 kbit/s* oder *Kein Ausweichweg*.

![Ziel hinzugefügt](bilder/de/werkzeuge-planen-56-ausspielung-ziel.jpg)

![Ziel mit SRT und Latenz](bilder/de/werkzeuge-planen-60-ausspielung-srt-rtt.jpg)

![Encoder gewählt](bilder/de/werkzeuge-planen-61-ausspielung-encoder.jpg)

![Stream-Key hinterlegt](bilder/de/werkzeuge-planen-63-ausspielung-schluessel.jpg)

![Companion-Steuerung](bilder/de/werkzeuge-planen-64-ausspielung-osc.jpg)

![Uplink geändert](bilder/de/werkzeuge-planen-67-ausspielung-uplink.jpg)

![Archiv-Aufzeichnung auf diesem Gerät](bilder/de/werkzeuge-planen-68-ausspielung-archiv.jpg)

![Sendebericht mit Eintrag](bilder/de/werkzeuge-planen-70-ausspielung-sendebericht.jpg)

![Ausweichverhalten](bilder/de/werkzeuge-planen-71-ausspielung-ausweich.jpg)
