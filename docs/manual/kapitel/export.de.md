## Exportieren und Drucken

Alles, was den Plan als Blatt, Liste oder Datei verlässt, steht im Menü *Datei*. Die Einträge im Überblick:

| Eintrag | Ergebnis |
|---|---|
| *Patch-Liste…* | jedes Kabel als Zeile; CSV, Excel, Etiketten, Kanallisten |
| *Festinstallation: Doku & Übergabe…* | Listen und Dokumente für Installateur und Betreiber, QR-Etiketten |
| *Stage-Plot (SVG)…* und *Stage-Plot hell (SVG)…* | die Bühnenaufsicht als Ein-Seiten-Blatt |
| *Exportieren & Drucken…* | die Export-Zentrale mit sieben Bereichen |
| *Cloud & Lese-Link…* | Kopie mit Revisionen und Lese-Links |
| *Als Viewer-Datei exportieren…* | Prüfdatei für Reviewer |
| *Anmerkungen aus Viewer-Datei importieren…* | Anmerkungen der Reviewer zurückholen |
| *Plan-Stände vergleichen…* | Unterschiede zwischen zwei Ständen |
| *Ausgegebene Dokumente…* | Register der ausgegebenen Blätter |
| *Plan an Rentman anhängen…*, *Kabel an Rentman senden…* | Rückweg nach Rentman |

![Das Menü Datei](bilder/de/export-01-datei-menue.jpg)

Die Befehlspalette (`Strg+K`) findet Einträge wie *Patch-Liste…* über ihren Namen.

![Befehlspalette mit der Suche Patch](bilder/de/export-02-palette-suche.jpg)

**Dateinamen.** Dateien, die die App herunterlädt, heißen `JJJJMMTT_<Projektname>_NNN.<Endung>`, bei Listen mit dem Blattnamen dahinter, zum Beispiel `20260519_Demo-Show_007_patchliste.csv`. `NNN` zählt je Tag hoch. Zeichen, die ein Dateisystem nicht verträgt, ersetzt die App durch `_`.

**Stempel.** Die Listen der Festinstallation, die Blätter des Unterlagen-Stapels und das Raster-PDF des Plans tragen einen Stempel mit dem Stand des Plans. Daran lässt sich später prüfen, ob ein ausgegebenes Blatt noch zum Plan passt; das Register *Ausgegebene Dokumente* nutzt ihn dafür.

### Patch-Liste

*Datei → Patch-Liste…* zeigt jedes Kabel als eigene Zeile, sortiert für die Reihenfolge beim Stecken.

![Dialog Patch-Liste](bilder/de/export-65-patch-oeffnen.jpg)

Die Spalten sind *Nr.*, *Von Gerät*, *Port*, *Nach Gerät*, *Port*, *Typ*, *Länge (m)* und *Farbe*. Ein Klick auf eine Überschrift sortiert. Hat ein Port eine Inhaltsbezeichnung wie *PGM*, steht sie als Hauptzeile und die Portbezeichnung darunter. Das Geschlecht des Steckers (♂/♀) steht am Port, wo es gesetzt ist. Führt ein Kabel in ein Gerät, das als Wandler markiert ist und nur ein Folgekabel hat, zeigt die Zeile das Endgerät mit dem Zusatz *via* und dem Wandler; das Folgekabel erscheint dann nicht noch einmal. Die Spalte *Faser* erscheint nur, wenn der Plan eine aufgeteilte Buchse (Breakout) enthält.

Das Suchfeld filtert nach Gerät, Port, Typ, Farbe und Notiz.

![Suche in der Patch-Liste](bilder/de/export-66-patch-suche.jpg)

Hat der Plan Kabel mit einem Layer, erscheint daneben die Auswahl *Alle Layer*.

![Filter nach Layer](bilder/de/export-67-patch-ebene-audio.jpg)

![Sortierung nach Länge](bilder/de/export-68-patch-sortierung.jpg)

Rechts neben dem Filter steht die Zahl der gezeigten und aller Kabel, zum Beispiel *12 / 12*. Passt keine Zeile, steht *Keine Kabel passen zum Filter.*

![Leere Treffermenge](bilder/de/export-69-patch-leer.jpg)

**Ausgaben.** Die Fußzeile bietet vier Ausgaben. Alle nehmen die gerade gefilterten Zeilen.

![Fußzeile mit den Ausgaben](bilder/de/export-70-patch-fussleiste.jpg)

- *CSV exportieren* schreibt die Tabelle mit Semikolon als Trenner und UTF-8-BOM für Excel. Sie hat 13 Spalten: *Nr.*, *Von Gerät*, *Von Port*, *Nach Gerät*, *Nach Port*, *Typ*, *Länge (m)*, *Layer*, *Multicore*, *Faser*, *Farbe*, *Kabelname* und *Notizen*; die Port-Spalten tragen die Inhaltsbezeichnung in Klammern und das Steckergeschlecht.
- *XLSX exportieren* schreibt dieselben 13 Spalten als Excel-Datei mit fetter Kopfzeile.
- *Etiketten + QR (PDF)* druckt einen A4-Bogen mit zwei Spalten und neun Reihen. Je Kabel entstehen zwei Etiketten, eines je Ende, mit Nummer, Typ, Kabelname, Strecke, Länge, Farbstreifen und einem QR-Code. Der QR-Code trägt Kabelnummer oder -name sowie die Strecke; beide Enden teilen ihn.
- *Etiketten-CSV* schreibt je Kabelende eine Zeile für Etikettendrucker. Das Format wählen Sie links daneben: *Generisch (CSV)*, *Brother P-touch (TXT)* oder *Dymo (CSV)*. Die Texte sind ASCII-tauglich, das Steckergeschlecht steht als *(M)* oder *(F)*.

![Etiketten als PDF](bilder/de/export-73-patch-etiketten-pdf.jpg)

![Etiketten-CSV, Format Generisch](bilder/de/export-74-patch-etikett-csv-generic.jpg)

![Etiketten-CSV, Format Brother](bilder/de/export-75-patch-etikett-csv-brother.jpg)

![Etiketten-CSV, Format Dymo](bilder/de/export-76-patch-etikett-csv-dymo.jpg)

![CSV der Patch-Liste](bilder/de/export-71-patch-csv.jpg)

![XLSX der Patch-Liste](bilder/de/export-72-patch-xlsx.jpg)

Die Beschriftung von Patchfeldern (Streifen und Etiketten) steht im Kapitel *Werkzeuge: Planen* bei den Analysen.

**Kanalliste.** Enthält der Plan Audiokanäle, erscheinen in der Fußzeile die Auswahl *Sicht auf die Kanalliste* und der Knopf *Kanalliste*. Eine Kanalliste, fünf Sichten, je als CSV:

| Sicht | Für wen |
|---|---|
| *Band (Rider)* | Rider der Band |
| *Haus (Patch)* | Patch am Haus-Eingang |
| *Bühne (Position)* | Aufstellung auf der Bühne |
| *Pult (Namen)* | Kanalnamen fürs Pult |
| *Monitor-Wege* | Wege zu den Monitoren; nur wenn der Plan solche hat |
| *Haus / Band (wem gehört was)* | stellt beide Hälften nebeneinander: der Stagebox-Eingang gehört dem Haus, das Mikrofon der Band |

Die Monitor-Sicht zeigt Wege, nicht die Mischung; die kennt der Plan nicht.

![Auswahl der Sichten](bilder/de/export-77-kanal-sichten.jpg)

![Sicht Band (Rider)](bilder/de/export-78-kanal-band.jpg)

![Sicht Haus (Patch)](bilder/de/export-79-kanal-venue.jpg)

![Sicht Bühne (Position)](bilder/de/export-80-kanal-stage.jpg)

![Sicht Pult (Namen)](bilder/de/export-81-kanal-console.jpg)

![Sicht Monitor-Wege](bilder/de/export-82-kanal-monitor.jpg)

![Sicht Haus / Band](bilder/de/export-83-kanal-owner.jpg)

Über der Tabelle meldet der Dialog drei Auffälligkeiten an den Kanälen, bevor ein Blatt gedruckt ist: ein Kanal ohne Haus-Port, eine Nummer, die als Name auftritt, und zwei Kanäle auf derselben Buchse.

**Szenendatei des Pults.** *Szene einlesen* liest die Datei, die ein Mischpult schreibt (X32, M32, WING; Endungen `.scn`, `.txt`, `.snap`, `.shw`). Die App liest nur und schreibt nichts zurück ans Pult. Über der Tabelle steht danach *Szenendatei des Pults* mit Format und Zahl der Kanäle, bei nicht lesbaren Zeilen mit deren Zahl. *Zuordnung zum Plan* gleicht die Kanäle *über den Namen* oder *über die Kanalnummer (nur wenn sie stimmt)* mit dem Plan ab.

![Szene eingelesen](bilder/de/export-84-szene-lesen-1.jpg)

![Zuordnung zum Plan](bilder/de/export-85-szene-zuordnung.jpg)

![Zuordnung über die Kanalnummer](bilder/de/export-86-szene-nach-nummer.jpg)

Drei Knöpfe schreiben CSV: *Kanäle* (die gelesenen Kanäle), *Zuordnung* und, ab dem zweiten Einlesen, *Änderungen*. Der erste Import bleibt der Bezugsstand; jeder weitere wird gegen ihn verglichen. So entsteht aus der Probe die Änderungsliste, die sonst nur im Kopf von jemandem steht. Ändert sich nichts, steht dort *Nichts geändert in den Kanalnamen zwischen den beiden Ständen.*

![CSV der Kanäle](bilder/de/export-87-szene-kanaele-csv.jpg)

![CSV der Zuordnung](bilder/de/export-88-szene-zuordnung-csv.jpg)

![Zweiter Stand eingelesen, mit den Änderungen](bilder/de/export-89-szene-lesen-2.jpg)

![CSV der Änderungen](bilder/de/export-90-szene-aenderungen-csv.jpg)

### Festinstallation: Doku & Übergabe

*Datei → Festinstallation: Doku & Übergabe…* sammelt die Unterlagen, die ein Installateur und ein Betreiber brauchen. Der Dialog hat keine Reiter, sondern Abschnitte von oben nach unten.

![Dialog Festinstallation](bilder/de/export-106-doku-oeffnen.jpg)

**Grundlage dieser Übergabe.** Der Kasten ganz oben sagt, ob die Übergabe den gebauten Stand trägt (*As-Built*) oder den Angebotsstand (*Wie geplant (kein As-Built)*), und nennt dazu die Befunde, etwa *Kein As-Built festgeschrieben* oder *Kein Ort genannt*; ohne Ort lässt sich die Datei nächstes Jahr nicht dem Haus zuordnen, und die Antworten der Haus-IT gelten nirgends. Der Grund steht dabei: Nächstes Jahr wird dieselbe Veranstaltung aus dieser Datei geplant. Trägt sie den Plan von vor dem Aufbau, wird jede Änderung vor Ort neu entdeckt. Schreiben Sie dazu eine As-Built-Revision fest; das Kapitel *Werkzeuge: Bauen* beschreibt die Revisionen.

**Bearbeiter.** Das Feld *Bearbeiter (Autor für Änderungsprotokoll & Service)* hält den Namen, der in Protokoll- und Service-Einträgen steht. Er gilt für die ganze App.

![Bearbeiter eingetragen](bilder/de/export-107-doku-bearbeiter.jpg)

**Empfänger und Reserve.** *Empfänger dieses Blattes (Abteilung oder Person)* ist ein Freitext, kein Pflichtfeld. Der Eintrag steht im Register *Ausgegebene Dokumente*; ohne Eintrag steht dort *Empfänger nicht genannt*. *Reserve-Aufschlag für Stückliste (%)* (0 bis 100, Vorgabe 10) schlägt auf die Mengen der Kabel-Stückliste auf.

![Empfänger eingetragen](bilder/de/export-108-doku-empfaenger.jpg)

![Reserve-Aufschlag](bilder/de/export-109-doku-reserve.jpg)

**Listen und Dokumente.** Jede Karte unter *Listen & Übergabe-Dokumente* erzeugt eine Datei mit dem Stempel des Plans. Ein Klick auf den Titel schreibt die Datei im Grundformat. Eine CSV trägt am Ende ein Spaltenlexikon (*# Spaltenlexikon — was die Spalten oben bedeuten*) und eine Stempelzeile mit Projekt, Zeitpunkt und der Kennung des Stands.

| Karte | Format | Inhalt |
|---|---|---|
| *Pull-/Verlege-Liste* | CSV | je Kabel: Von→Nach, Länge, Trasse, Status |
| *Termination-Liste* | CSV | je Kabelende: Gerät, Port, Steckverbinder |
| *Kabel-Schedule (Register)* | CSV | Master-Register aller Kabel |
| *Kabel-Stückliste + Reserve* | CSV | nach Typ und Länge, mit Reserve-Aufschlag |
| *Asset-Register* | CSV | Geräte: Asset-Tag, Standort, Serie, Garantie, Service |
| *Übergabe-Dokument* | Markdown | Betreiber-Übersicht: Umfang, Status, Stückliste, Assets |
| *Abnahmeprotokoll* | HTML, als PDF druckbar | Umfang, Messergebnisse, Mängel und Restpunkte aus dem Plan, Ergebnis-Kästchen und Unterschriftenblock |
| *Mängel und Restpunkte* | CSV | Störungen, nicht bestandene Messungen, offene Feld-Meldungen, noch geplante Punkte |
| *Wartungs- und Prüfplan* | CSV | nächste Fälligkeit je Gerät aus Intervall und letztem Service oder Übergabe-Datum |
| *Konfigurationsvorgaben* | CSV | je Gerät und Schnittstelle: Adresse, Maske, Gateway, VLAN, Switch-Port, Blenden dazwischen, Web-Oberfläche |
| *Geräte-Steckbrief* | HTML, als PDF druckbar | eine Karte je Gerät: Standort, Kennung, Netz, Mischer-Eingang, Kabel, Service-Historie |
| *Bedien-Kurzübersicht* | HTML, als PDF druckbar | welche Quelle auf welchem Mischer-Eingang liegt, wohin die Ausgänge gehen, Kontakte, Web-Oberflächen |
| *Kamera-Positionsblatt* | HTML, als PDF druckbar | je Kamera: Standort, Höhe, Ausrichtung, Optik, Mischer-Eingang und die PTZ-Presets aus dem Kameraplan |
| *Anhänge-Verzeichnis* | CSV | jeder Anhang mit Art, Ziel, abgelegter Datei und SHA-256, dazu Kabel, deren Messergebnis kein Protokoll hat |
| *Signalwege* | CSV | jede Kette von der Quelle bis zum Ziel, mit Etage und Raum an jeder Station |
| *Trassenplan je Etage* | HTML, als PDF druckbar | Draufsicht je Etage: Räume, Steigschacht, die Verbindungen dazwischen und die Durchgangsliste |
| *Durchgänge (Brandschutz)* | CSV | jede Raumgrenze, jeder Schachtzugang und jede Geschossdecke, die ein Kabel passiert, mit Mantel-/Brandklasse und Trasse |
| *Hausstrecken-Belegung* | CSV | je Ader jeder Hausstrecke: welches Kabel sie benutzt, welche frei sind; nur wenn der Plan Hausstrecken kennt |

Die Dateien der Karten werden im Dialog ohne Bild gezeigt; eine Auswahl zeigen die folgenden Aufnahmen.

![Pull-Liste als CSV](bilder/de/export-110-doku-01-pull.jpg)

![Kabel-Stückliste als CSV, Reserve 15 %](bilder/de/export-111-doku-04-bom.jpg)

![Übergabe-Dokument als Markdown](bilder/de/export-112-doku-06-handover.jpg)

![Abnahmeprotokoll](bilder/de/export-113-doku-07-abnahme.jpg)

![Signalwege als CSV](bilder/de/export-114-doku-15-signalwege.jpg)

**PDF und Excel.** Die Karten, die Tabellen sind (Pull-Liste, Termination-Liste, Kabel-Schedule, Kabel-Stückliste, Asset-Register, Mängel und Restpunkte, Wartungsplan, Konfigurationsvorgaben, Anhänge-Verzeichnis, Signalwege, Durchgänge und Hausstrecken), tragen unter dem Titel die Knöpfe *PDF* und *Excel*. Sie schreiben dieselbe Tabelle gestaltet statt als CSV; die CSV bleibt die Sicherung. Das PDF steht im Querformat A4, wiederholt den Tabellenkopf auf jeder Seite, trägt Lesezeichen sowie Stempel und Seitenzahl und ist in Public Sans gesetzt. Die Excel-Datei hat ein Blatt je Tabelle mit fixierter Kopfzeile und Autofilter. *Alle Listen als ein PDF* und *Alle Listen als eine Excel-Mappe* fassen alle diese Karten zusammen. Das PDF bekommt dann ein Deckblatt mit verlinktem Inhaltsverzeichnis.

![Kabel-Stückliste als PDF](bilder/de/export-115-doku-pdf-einzeln.jpg)

![Kabel-Stückliste als Excel-Datei](bilder/de/export-116-doku-excel-einzeln.jpg)

![Alle Listen als ein PDF, Deckblatt](bilder/de/export-117-doku-alle-pdf.jpg)

![Alle Listen als ein PDF, eine Tabellenseite](bilder/de/export-118-doku-alle-pdf-seite.jpg)

![Alle Listen als eine Excel-Mappe](bilder/de/export-119-doku-alle-excel.jpg)

**QR-/Asset-IDs und Etiketten.** Der Abschnitt *QR-/Asset-IDs & Etiketten* vergibt kurze, stabile IDs und druckt Etiketten, die das Gerät am Rack mit seinem Datensatz verbinden.

![Abschnitt QR und Etiketten](bilder/de/export-120-doku-qr-abschnitt.jpg)

- *QR-/Asset-IDs vergeben* gibt Kabeln und Geräten ohne ID eine. Die Meldung nennt die Zahl; hat alles schon eine ID, steht dort *Alle Elemente haben bereits eine ID.*
- *QR-Etiketten (PDF)* druckt einen A4-Bogen mit drei Spalten, ein Etikett je Kabel und je Gerät. Beim Kabel trägt der QR-Code die ID. Beim Gerät führt er auf die Seite des Geräts in der Gerätebibliothek, wenn es dort bekannt ist, sonst auf die hinterlegte Hersteller- oder Datenblatt-URL, sonst trägt er Klartext mit Name, Hersteller, Modell und Asset-Tag, den jedes Handy ohne Netz liest. Das Etikett nennt Hersteller und Modell auch ohne Link. Der Scan in der App findet den Datensatz in allen drei Fällen.
- *Kabel-Labels „Quelle → Ziel" (AVIXA F501.01)* benennt Kabel nach der Strecke. Hat ein Kabel schon einen Namen, bleibt er, solange *vorhandene Namen überschreiben* nicht angehakt ist. Die Meldung nennt die Zahl der Labels; wurde nichts geändert, sagt sie es.

![IDs vergeben](bilder/de/export-121-doku-ids-vergeben.jpg)

![QR-Etiketten als PDF](bilder/de/export-122-doku-qr-pdf.jpg)

![Kabel-Labels aus Quelle und Ziel](bilder/de/export-123-doku-beschriftung-quelle-ziel.jpg)

![Überschreiben vorhandener Namen](bilder/de/export-124-doku-ueberschreiben.jpg)

**Anhänge.** Der Abschnitt *Anhänge* verwaltet Dateien, die dem Plan angehängt sind, und füttert das *Anhänge-Verzeichnis*. Wählen Sie die *Art* (*Messprotokoll*, *Herstellerunterlage*, *Konfigurations-Sicherung*, *Sonstiges*) und wozu die Datei gehört (*Ganze Anlage*, *Kabel*, *Geräte*) und klicken Sie *Dateien anhängen …*. Das gibt es nur in der Desktop-App. Die Dateien liegen in einem Ordner beim Projekt; ein noch nicht gespeichertes Projekt hat keinen. Dateien über 100 MB nimmt die App nicht an. Ein Eintrag zeigt die Datei im Ordner (*Im Ordner zeigen*) oder wird entfernt, wobei die Datei im Ordner bleibt. Kabel mit Messergebnis, aber ohne Protokoll, nennt der Abschnitt.

![Abschnitt Anhänge](bilder/de/export-125-doku-anhaenge.jpg)

**Feld-Rückmeldungen.** Meldet die Handy-Ansicht Korrekturen aus dem Feld, landen sie als offene Einträge im Abschnitt *Feld-Rückmeldungen*, geordnet mit dem jüngsten oben. Jeder Eintrag nennt das Kabel, das Gerät oder die Notiz. *Übernehmen (mergt + protokolliert)* führt die Änderung in den Plan ein und trägt sie ins Änderungsprotokoll ein, *Verwerfen* löscht den Eintrag.

![Feld-Rückmeldungen](bilder/de/export-126-doku-rueckkanal.jpg)

![Eintrag übernommen](bilder/de/export-127-doku-rueckkanal-uebernehmen.jpg)

![Eintrag verworfen](bilder/de/export-128-doku-rueckkanal-verwerfen.jpg)

**Änderungsprotokoll.** Der letzte Abschnitt führt die jüngsten 30 Einträge: wer, was, wann. *Leeren* löscht sie. Ohne Einträge steht dort, dass Status- und Service-Änderungen hier protokolliert werden.

![Änderungsprotokoll](bilder/de/export-129-doku-protokoll.jpg)

![Protokoll geleert](bilder/de/export-130-doku-protokoll-leeren.jpg)

### Stage-Plot

*Datei → Stage-Plot (SVG)…* schreibt die Bühnenaufsicht als SVG auf ein Blatt. *Stage-Plot hell (SVG)…* schreibt dieselbe Grafik mit weißem Grund und dunkler Schrift, für Druck und E-Mail. Der Eintrag ohne Zusatz folgt dem Thema des Canvas.

Das Blatt enthält Zeichnung und Legende aus denselben Objekten. Die Nummer am Gerät ist die Kanalnummer der Kanalliste, dieselbe wie in der Patch-Liste. Geräte, die kein Kanal sind, etwa Stagebox, Pult oder Wedge, tragen keine Nummer; sie sind Ziel, nicht Quelle. Die Legende führt die Eingangsliste. Hat der Plan keine Audio-Kabel, zeigt das Blatt alle Geräte ohne Nummern und sagt das in der Unterzeile.

![Stage-Plot ohne Audiokanäle](bilder/de/export-64-stageplot-ohne-audio.jpg)

![Stage-Plot mit Audiokanälen und Eingangsliste](bilder/de/export-91-stageplot-mit-audio.jpg)

### Exportieren & Drucken

*Datei → Exportieren & Drucken…* öffnet die Export-Zentrale. Links wählen Sie einen von sieben Bereichen: *Plan*, *Patch-Sheets*, *Kabel-Stückliste*, *Geräte-Stückliste*, *Racks & Gruppen*, *Tally-Karte* und *Unterlagen-Stapel*. Jeder Bereich trägt oben eine Zeile, die sagt, was er tut. Nach einer Ausgabe schließt sich der Dialog.

![Die Export-Zentrale](bilder/de/export-07-export-plan-pdf.jpg)

![Die sieben Bereiche](bilder/de/export-08-export-seitenleiste.jpg)

#### Plan als Datei

*Plan* gibt den Canvas als Datei aus. Fünf Formate stehen zur Wahl.

| Format | Eigenschaft |
|---|---|
| *PDF* | druckbar, mit Schriftfeld unten rechts (siehe unten) |
| *PNG* | transparent möglich, scharf |
| *JPEG* | kleiner, gut für E-Mail |
| *SVG* | skalierbar, für Web und Weiterverarbeitung |
| *DXF* | CAD/Plotter: Geräte, Kabel und Text auf Layern |

Für PDF kommen diese Einstellungen dazu:

- *PDF-Thema*: *Dunkles Thema (wie Canvas)* oder *Helles Thema (für Ausdruck empfohlen)*.
- *Monochrom sicher (Ebene im Klartext, eine Strichfarbe)* schreibt die Ebene im Klartext an jedes Kabel und färbt alle Striche gleich. Auf einem Schwarzweiß-Drucker lassen sich sonst Video und Audio kaum unterscheiden.
- *Render-Modus*: *Raster (klassisch)* ist ein JPEG-Abbild des Canvas, zuverlässig, aber der Text wird bei hohem Zoom unscharf. *Vektor* nutzt den Druckweg von Chromium: Text bleibt wählbar und scharf bei jedem Zoom, die Datei bleibt klein. Beide tragen dasselbe Schriftfeld mit Projektdaten, Revision, Stand und QR-Code.
- *Schriftfeld*: an- und abschaltbar; QR-Code, Logos und jede Zeile einzeln wählbar. *Größe* „Auto“ wächst mit dem Blatt (A3 = 100 %), alternativ ein fester Wert von 75 bis 300 %. Die Einstellung wird im Projekt gespeichert.
- *Page-Size* gibt es nur beim Vektor-PDF: *Auto — A0 Landscape (kompatibel mit allen Viewern)*, *A4 Landscape* bis *A0 Landscape*, *A0+ Plotter* und *Original — volle Canvas-Größe für Plotter*. Seiten über A0 zeigen Edge und Vorschau manchmal weiß an; Acrobat und Plotter-Software drucken sie. Der Canvas wird vektoriell auf die Seite skaliert, Text bleibt scharf.
- *Ebenen (im PDF enthalten)*: Die Chips Video, Audio, Control, Network, Power und Other schalten eine Ebene für Canvas und PDF um. Für ein PDF nur mit Video schalten Sie die anderen aus, exportieren und schalten sie wieder ein.

![Thema Dunkel](bilder/de/export-09-plan-thema-dunkel.jpg)

![Thema Hell](bilder/de/export-10-plan-thema-hell.jpg)

![Monochrom sicher](bilder/de/export-11-plan-monochrom.jpg)

![Render-Modus Vektor](bilder/de/export-12-plan-vektor.jpg)

![Page-Size, aufgeklappt](bilder/de/export-13-plan-seitenformat.jpg)

![Ebenen im PDF](bilder/de/export-14-plan-ebenen.jpg)

![Ebene wieder eingeschaltet](bilder/de/export-15-plan-ebenen-zurueck.jpg)

Unten zeigt der Dialog, unter welchem Namen die Datei gespeichert wird. *Als PDF herunterladen* schreibt die Datei. *Drucken* öffnet das Plan-PDF im Druckdialog des Systems und gilt nur für PDF; bei PNG, JPEG, SVG und DXF ist der Knopf gesperrt.

![Format PNG, Drucken gesperrt](bilder/de/export-19-plan-drucken-gesperrt.jpg)

![Format JPEG](bilder/de/export-16-plan-format-jpeg.jpg)

![Format SVG](bilder/de/export-17-plan-format-svg.jpg)

![Format DXF](bilder/de/export-18-plan-format-dxf.jpg)

Die Ergebnisse, hier als Vorschau der geschriebenen Datei:

![Ergebnis PNG](bilder/de/export-20-ergebnis-plan-png.jpg)

![Ergebnis JPEG](bilder/de/export-21-ergebnis-plan-jpeg.jpg)

![Ergebnis SVG](bilder/de/export-22-ergebnis-plan-svg.jpg)

![Ergebnis DXF](bilder/de/export-23-ergebnis-plan-dxf.jpg)

![Ergebnis Raster-PDF, Seite 1](bilder/de/export-24-ergebnis-plan-pdf.jpg)

![Ergebnis Vektor-PDF](bilder/de/export-25-ergebnis-plan-pdf-vektor.jpg)

![Plan-PDF im Druckauftrag](bilder/de/export-26-ergebnis-plan-drucken.jpg)

Jede PDF-Ausgabe des Plans, auch der Druck, trägt das Register *Ausgegebene Dokumente* ein. PNG, JPEG, SVG und DXF tragen nichts ein.

#### Patch-Sheets

*Patch-Sheets* erzeugt je Gerät eine Port-Belegungsliste, gedacht zum Aufkleben am Gerät.

![Bereich Patch-Sheets](bilder/de/export-27-patchsheets-oeffnen.jpg)

Oben steht die kompakte Patch-Liste: eine Zeile je Kabel, nach Quellgerät sortiert, für den Techniker vor Ort. *Patchliste öffnen…* springt in den Dialog *Patch-Liste*. Darunter wählen Sie Geräte: Haken je Gerät, *Alle wählen*, *Alle abwählen* und ein Filter nach Name oder Kategorie.

![Filter in der Geräteliste](bilder/de/export-28-patchsheets-filter.jpg)

![Alle Geräte gewählt](bilder/de/export-29-patchsheets-alle.jpg)

![Keine Geräte gewählt](bilder/de/export-30-patchsheets-keine.jpg)

![Auswahl einzelner Geräte](bilder/de/export-31-patchsheets-auswahl.jpg)

Mit gewählten Geräten bieten drei Knöpfe die Ausgabe an: *Einzel-PDF (n)* eine PDF je Gerät, *Sammel-PDF (n)* eine PDF mit einem Gerät je Seite und *Drucken* die Sammel-PDF im Druckdialog. Nach dem Klick fragt eine Leiste, zum Beispiel *Einzel-PDFs — Papier-Format wählen:*, mit *A4*, *A3* und *Abbrechen*.

![Papierformat wählen](bilder/de/export-32-patchsheets-papier.jpg)

![Abbrechen](bilder/de/export-33-patchsheets-abbrechen.jpg)

![Papierformat für die Sammel-PDF](bilder/de/export-34-patchsheets-sammel-papier.jpg)

![Ergebnis: Sammel-PDF](bilder/de/export-35-ergebnis-patchsheet-sammel.jpg)

![Ergebnis: Einzel-PDF auf A3](bilder/de/export-36-ergebnis-patchsheet-einzel-a3.jpg)

![Ergebnis: Druckauftrag](bilder/de/export-37-ergebnis-patchsheet-drucken.jpg)

*Datenblätter (n)…* öffnet das Geräte-Datenblatt: Fotos und gewählte Eigenschaften, eine A4-Seite je Gerät. Die Eigenschaften sind in Gruppen geordnet (*Allgemein*, *Technische Daten*, *Fachdaten*, *Betrieb*, *Tabellen*). Vorausgewählt sind die Eigenschaften, die mindestens ein Gerät ausgefüllt hat. *Ausgefüllte*, *Alle* und *Keine* ändern die Auswahl. Eine angehakte, aber leere Eigenschaft druckt als Strich. *Drucken* öffnet den Druckdialog, *PDF speichern* schreibt die Datei.

![Datenblatt-Dialog](bilder/de/export-38-datenblatt-oeffnen.jpg)

![Keine Eigenschaften gewählt](bilder/de/export-39-datenblatt-keine.jpg)

![Alle Eigenschaften gewählt](bilder/de/export-40-datenblatt-alle.jpg)

![Nur ausgefüllte Eigenschaften](bilder/de/export-41-datenblatt-ausgefuellte.jpg)

![Datenblatt als PDF](bilder/de/export-42-datenblatt-pdf.jpg)

#### Kabel-Stückliste

*Kabel-Stückliste* ist die Stückliste aller Kabel, nach Typ und Länge zusammengefasst.

![Kabel-Stückliste](bilder/de/export-43-bom-oeffnen.jpg)

Die Tabelle nennt je Zeile *Typ*, *Länge (m)*, *Verbaut*, *Gesamt (m)*, die Rentman-Planung (*Rentman geplant*, editierbar) und die *Differenz*. Die Spalte *Stückelung* kommt hinzu, sobald Lagerlängen hinterlegt sind. Die Differenz zeigt, ob mehr oder weniger verbaut ist als geplant. Darunter steht die Summe je Gewerk und die Zahl der Steckverbinder nach Typ.

![Eingabe der Rentman-Planung](bilder/de/export-44-bom-rentman-eingabe.jpg)

Eine geänderte Planung bleibt ein Entwurf. *Rentman-Planung speichern* übernimmt sie ins Projekt, *Verwerfen* nimmt sie zurück. Die Planungsmengen stammen aus dem Rentman-Import; das Kapitel *Datei und Import* beschreibt ihn.

![Entwurf verworfen](bilder/de/export-45-bom-rentman-verwerfen.jpg)

*Als CSV herunterladen* schreibt die Tabelle als CSV in UTF-8 mit BOM für Excel, *Als PDF herunterladen* als PDF, *Drucken* öffnet sie im Druckdialog.

![Kabel-Stückliste als CSV](bilder/de/export-46-bom-csv.jpg)

![Kabel-Stückliste als PDF](bilder/de/export-47-bom-pdf.jpg)

![Kabel-Stückliste im Druckauftrag](bilder/de/export-48-bom-drucken.jpg)

Sind im Projekt Lagerlängen hinterlegt (*Einstellungen → Projekt*, Abschnitt *Verfügbare Lagerlängen*), teilt die Stückliste einen Lauf in vorhandene Stücke auf. Die Spalte *Stückelung* nennt die Teile, dazu die Kupplungen je Lauf und die Überlänge. Reicht der Bestand nicht, steht *Bestand reicht nicht* mit dem Fehlbestand dabei; CSV und PDF tragen die Spalten *Stückelung*, *Kupplungen* und *Fehlbestand*.

![Stückelung nach Lagerlängen](bilder/de/export-100-bom-lagerlaengen.jpg)

![Rentman-Planung neben den Lagerlängen](bilder/de/export-101-bom-rentman-geplant.jpg)

![Rentman-Planung gespeichert](bilder/de/export-102-bom-rentman-speichern.jpg)

![CSV mit Stückelung](bilder/de/export-103-bom-csv-lager.jpg)

![PDF mit Stückelung](bilder/de/export-104-bom-pdf-lager.jpg)

![Lagerlängen in den Einstellungen](bilder/de/export-105-bom-einstellungen-lager.jpg)

#### Geräte-Stückliste

*Geräte-Stückliste* zählt die Geräte, die der Plan braucht, nach Modell und prüft sie gegen den Lagerbestand. Drei Zustände bleiben getrennt: *gedeckt* (über die Katalog-Identität), *Vorschläge* (Namenstreffer, wartet auf Bestätigung) und *nicht im Lager*. Die Zeilen nennen *Menge*, *Modell*, *Deckung*, *Bestand* und *Lagerort*. *Typ zuweisen…* ordnet einem Gerät ohne Katalogtyp einen zu, *Bestätigen* übernimmt einen Vorschlag. *Stückliste als CSV* schreibt die Liste; *Kommissionier-Liste (CSV)* enthält nur sicher gedeckte Posten, nach Lagerort sortiert, zum Packen.

![Geräte-Stückliste](bilder/de/export-49-geraete-bom-oeffnen.jpg)

![Geräte-Stückliste als CSV](bilder/de/export-50-geraete-bom-csv.jpg)

![Typ-Liste zum Zuweisen](bilder/de/export-51-geraete-bom-typ-liste.jpg)

#### Racks & Gruppen

*Racks & Gruppen* gibt gespeicherte Racks und Gruppen einzeln als PDF aus: je enthaltenem Gerät eine Patch-Seite mit der internen Verkabelung. Ein Filter sucht Racks und Gruppen; die Karte zeigt *Rack · n HE* oder *Gruppe* und die Zahl der Geräte. *Format* wählt das Papier, *PDF* schreibt, *Drucken* öffnet den Druckdialog. Ohne gespeicherte Racks oder Gruppen steht dort, wie man sie anlegt: Geräte auf dem Canvas wählen und *Als Rack speichern* oder *Gruppe speichern*.

![Racks und Gruppen](bilder/de/export-52-racks-oeffnen.jpg)

![Papierformat der Racks](bilder/de/export-53-racks-papier.jpg)

![Filter ohne Treffer](bilder/de/export-54-racks-filter-leer.jpg)

![Rack als PDF](bilder/de/export-55-racks-pdf.jpg)

![Rack im Druckauftrag](bilder/de/export-56-racks-drucken.jpg)

#### Tally-Karte

*Tally-Karte* zeigt die Kette Rolle, Gerät, Mischer-Eingang und UMD-Adresse, aus dem Plan abgeleitet und geprüft. Die Tabelle hat die Spalten *Nr.*, *Rolle*, *Gerät(e)*, *Mischer*, *Eingang* und *UMD*. Die Lampe selbst, also welcher GPIO-Pin an welcher Box hängt, gehört zur Hardware und ist absichtlich nicht enthalten.

![Tally-Karte ohne Rollen](bilder/de/export-57-tally-leer.jpg)

![Tally-Karte mit Rollen](bilder/de/export-92-tally-karte.jpg)

Der Kasten *Prüfung: n Fehler, m Hinweise* nennt, was an der Karte nicht stimmt, zum Beispiel eine Rolle ohne Mischer-Eingang, eine Rolle ohne Gerät oder ein Gerät ohne UMD-Adresse. *Tally-Karte als CSV* schreibt die Tabelle zum Gegenlesen. *tally-pi-Geräte (JSON)* schreibt den Teil der `tally.json`, der dem Plan gehört: ID, Name, Eingang. ATEM-Adresse und GPIO-Pins bleiben an der Box. Neben der JSON-Datei legt die App eine Herkunftsdatei (`.herkunft.txt`) mit Prüfsumme und Stand ab.

![Tally-Karte als CSV](bilder/de/export-93-tally-csv.jpg)

![tally-pi-Geräte, Herkunftsdatei](bilder/de/export-94-tally-pi-json.jpg)

Hat der Plan Geräte mit Multiviewer, zeigt der Kasten *Multiviewer-Bild (wer steht in welchem Fenster)* je Gerät einen Knopf, der das Fensterbild als CSV schreibt: Multiviewer, Fenster, Position, Größe, Quelle (ATEM) und Rolle. Die Namen kommen aus denselben Rollen wie Tally und UMD, nicht aus einer zweiten, von Hand geführten Liste. Darunter stehen Befunde, etwa ein Fenster, dessen Quelle keine Rolle im Plan hat.

![Multiviewer-Bild als CSV](bilder/de/export-95-tally-mv-csv.jpg)

Der Kasten *Vor-Show-Prüfung: Weg, Lampe, und was zu sehen war* hält fest, was der Plan nicht ableiten kann. Je Position wählen Sie den *Weg* des Tally, tragen die *Adresse* und die *Lampe* ein und notieren, was *Programm* und *Vorschau* gezeigt haben. Der Knopf *gesehen* schreibt die Beobachtung mit Zeitstempel in die Spalte *Zuletzt*. Darunter steht, wie viele Positionen geprüft sind, und die Befunde, etwa ein fehlender Tally-Weg. *Vor-Show-Liste* schreibt die Prüfung als CSV.

![Auswahl des Tally-Wegs](bilder/de/export-97-tally-pfad-liste.jpg)

![Beobachtung eingetragen](bilder/de/export-98-tally-gesehen.jpg)

![Beobachtung festgehalten](bilder/de/export-99-tally-gesehen-festhalten.jpg)

![Vor-Show-Liste als CSV](bilder/de/export-96-tally-vorshow-csv.jpg)

Sind in den Einstellungen der Direktweg und die Adresse des Pi eingetragen, steht darunter ein Block *Direkt an den Pi*. *Pi lesen* holt die Liste vom Pi und zeigt den Unterschied (*n bleiben, m kommen dazu*), und welche Rollen vom Pi verschwinden, auch samt ihrer GPIO-Zuordnung. Erst danach ist *An den Pi senden* frei. Ohne diese Einstellungen fehlt der Block; die Datei bleibt der Vorgabeweg.

#### Unterlagen-Stapel

*Unterlagen-Stapel* stellt mehrere Blätter zu einem druckbaren Stapel zusammen, für den Ordner, der zur Veranstaltung mitreist. Je Blatt eine Seite, der Spaltenkopf wiederholt sich auf jeder Folgeseite. Jedes Blatt trägt seinen Stempel, sodass sich ein Stapel gestempelter Blätter morgen gegen den Plan halten lässt.

![Bereich Unterlagen-Stapel](bilder/de/export-58-stapel-oeffnen.jpg)

Angeboten werden die Blätter, die einen Stempel tragen, zum Beispiel *Zug-Liste*, *Auflege-Liste*, *Kabel-Schedule*, *Geräte-Register*, *Netz-Merkblatt*, *Spektrum-Plan*, *Ausspielung*, *Tally-Karte*, *Übergabe an die Post*, *Frontplatten*, *Signalwege*, *Hausstrecken-Belegung*, *Durchgänge (Brandschutz)*, *Mängel und Restpunkte*, *Wartungs- und Prüfplan*, *Konfigurationsvorgaben* und *Anhänge-Verzeichnis*. Gewählt sind zunächst die Zug-Liste und der Kabel-Schedule.

![Gewählte Blätter](bilder/de/export-59-stapel-blaetter.jpg)

*Papier* wählt A4, Letter oder A3. *Farbe* wählt *farbig* oder *schwarzweiß*; im Schwarzweiß-Modus bleibt der Name einer Gruppe stehen, auch wo im Farbmodus ein Farbfeld steht. *Spaltenlexikon mitdrucken* hängt ein Lexikon der Spalten an. Ein Blatt, dessen Spalten das Lexikon nicht erklärt, meldet die App als Befund, weil der Stapel an jemanden geht, der die Spalten nicht kennt. *Stapel drucken* öffnet den Druckdialog.

![Papierformat](bilder/de/export-60-stapel-papier.jpg)

![Farbmodus](bilder/de/export-61-stapel-farbe.jpg)

![Lexikon der Spalten](bilder/de/export-62-stapel-glossar.jpg)

![Der Stapel im Druckauftrag](bilder/de/export-63-stapel-drucken.jpg)

### Cloud & Lese-Link

*Datei → Cloud & Lese-Link…* ist freiwillig. Die Datei bleibt das Original; der Server hält eine Kopie mit Revisionen, verschlüsselt gespeichert. Zugangsdaten werden vor dem Hochladen entfernt. Die Cloud nutzt das Konto der Gerätebibliothek.

Ohne Anmeldung zeigt der Dialog *Cloud-Projekte nutzen dein Konto der Gerätebibliothek.* und den Knopf *Anmelden unter Einstellungen → Gerätebibliothek…*, der die Einstellungen öffnet.

![Dialog Cloud ohne Anmeldung](bilder/de/export-05-cloud-dialog.jpg)

Mit Anmeldung hat der Dialog drei Abschnitte. Diese Abschnitte sind nicht aufgenommen, weil dafür ein Konto nötig ist; sie sind aus dem Programm beschrieben.

- *Dieses Projekt.* *Dieses Projekt in die Cloud legen* legt die erste Revision an. Danach nennt der Dialog Revision und Zeitpunkt: *Änderungen gehen automatisch in die Cloud.* *Jetzt in die Cloud speichern* speichert sofort, *Nicht mehr abgleichen* trennt die Verbindung, *Aus der Cloud löschen* entfernt das Projekt mit allen Revisionen und Lese-Links; die lokale Datei bleibt. Unter *Revisionen* steht jede Revision mit Zeit und Gerät. *Wiederherstellen* macht eine ältere zur jüngsten Revision; es geht nichts verloren. Hat zwischenzeitlich ein anderes Gerät gespeichert, führt die App beide Änderungen zusammen und sagt es.
- *Lese-Link.* Ein Link lässt jeden den Plan im Browser lesen, ohne Konto; Zugangsdaten sind nicht enthalten. Der Dialog warnt davor, dass der Plan den Rechner verlässt. *Immer die neueste Revision zeigen* hält den Link aktuell, sonst zeigt er die Revision, die beim Erstellen die jüngste war. *Läuft ab* wählt *nie* oder *nach 7*, *30* oder *90 Tagen*. *Link erstellen und kopieren* legt den Link an und kopiert ihn. Die Liste der Links nennt jeweils die Zahl der Aufrufe und den Ablauf; *Kopieren* kopiert erneut, *Widerrufen* macht den Link ungültig.
- *Deine Cloud-Projekte.* Jedes andere Projekt des Kontos mit *Öffnen* und *.cableplan herunterladen*. Die Liste hat keinen Löschen-Knopf; gelöscht wird nur das verbundene Projekt.

### Viewer-Datei

*Datei → Als Viewer-Datei exportieren…* schreibt eine `.cpviewer`-Datei für Reviewer und Helfer. Der Inhalt entspricht der Projektdatei, mit erzwungenem Modus *viewer*; Zugangsdaten der Geräte sind entfernt, weil die Datei an Externe geht. Vorhandene Anmerkungen bleiben, so kann der Eigentümer Aufgaben für Freelancer vormerken. Danach nennt *Viewer-Datei gespeichert* den Pfad.

![Meldung nach dem Export der Viewer-Datei](bilder/de/export-06-viewer-exportiert.jpg)

Wer die Datei öffnet, gibt beim ersten Öffnen seinen Namen ein (Kapitel *Datei und Import*); jede Anmerkung trägt ihn.

![Inhalt der Viewer-Datei](bilder/de/export-138-viewer-exportiert-daten.jpg)

### Anmerkungen importieren

*Datei → Anmerkungen aus Viewer-Datei importieren…* liest die Anmerkungen aus einer `.cpviewer`- oder `.json`-Datei und führt sie in den Plan ein. Verglichen wird die ID einer Anmerkung: neue kommen dazu, vom Reviewer geänderte (Status, Text) werden aktualisiert. *Annotations importiert* nennt beides: *n neue Anmerkung(en) importiert.* und *n aus Prüfer-Änderungen aktualisiert.*

![Meldung nach dem ersten Import](bilder/de/export-136-anmerkungen-import.jpg)

Ein zweites Einlesen derselben Datei fügt nichts hinzu.

![Meldung beim zweiten Import](bilder/de/export-137-anmerkungen-import-zweites-mal.jpg)

### Plan-Stände vergleichen

*Datei → Plan-Stände vergleichen…* hält den offenen Plan gegen einen früheren Stand. Der gewählte Stand ist der alte, der offene Plan der neue (*Der geöffnete Plan gilt als der neuere Stand. Nichts wird geladen oder überschrieben.*): Gefragt ist, was sich seit dem früheren Stand geändert hat.

![Dialog ohne gewählten Stand](bilder/de/export-04-vergleich-leer.jpg)

Der frühere Stand kommt aus einer von zwei Quellen.

- *Vergleichs-Datei wählen…* liest eine Plandatei. Sie wird nur gelesen, nicht geladen, und kommt nicht in die Liste der zuletzt geöffneten Projekte. Eine Datei ohne Geräte- und Kabelliste meldet, dass sie keinen lesbaren Plan enthält.
- *oder festgeschriebene Revision:* wählt eine Revision des Projekts. Das braucht keine zweite Datei.

![Vergleich mit einer Datei](bilder/de/export-132-vergleich-datei-gewaehlt.jpg)

Danach nennt der Dialog den früheren Stand und beide Stempel (*Stand der gewählten Datei*, *Stand des geöffneten Plans*), dazu eine Zusammenfassung mit den Zahlen: inhaltliche Änderungen, reine Darstellung, weitere Bereiche und die überholten oder nicht beurteilbaren Blätter. Darunter stehen zwei Blöcke. *Dokumente* sagt für jede Blattart, ob der Vergleich sie überholt hat: *überholt*, *nicht beurteilbar* (mit dem Grund) oder *unverändert*. *Unterschiede* listet Geräte und Kabel als *neu*, *entfällt* oder *geändert*. *Weitere Projekt-Bereiche (nicht aufgeschlüsselt)* nennt Bereiche, die sich geändert haben, ohne einzeln aufgeführt zu sein. *Als CSV exportieren* schreibt die Unterschiede.

![Auswahl einer Revision](bilder/de/export-134-vergleich-revision-auswahl.jpg)

![Vergleich mit einer Revision](bilder/de/export-135-vergleich-revision.jpg)

![CSV des Vergleichs](bilder/de/export-133-vergleich-csv.jpg)

### Ausgegebene Dokumente

*Datei → Ausgegebene Dokumente…* ist das Register der Blätter, die die App ausgegeben hat: die Listen der Festinstallation und jede PDF-Ausgabe des Plans. Eingetragen werden nur Blätter, deren Stand sich berechnen lässt; ein Eintrag ohne Stand könnte nie sagen, ob er noch gilt. Das Register liegt neben der App, nicht im Projekt: Es hält fest, was auf diesem Rechner ausgegeben wurde, und reist nicht mit dem Plan mit.

Ohne Ausgaben steht dort *nichts ausgegeben*, dazu der Hinweis, dass für dieses Projekt noch nichts ausgegeben wurde oder die Ausgaben von einem anderen Rechner stammen.

![Register ohne Einträge](bilder/de/export-03-register-leer.jpg)

Mit Ausgaben nennt die Kopfzeile die Zahl der Einträge zu diesem Projekt und wie viele davon überholt sind. Die Tabelle gruppiert nach Empfänger (aus dem Feld *Empfänger dieses Blattes*; fehlt er, steht dort *Empfänger nicht genannt*) und zeigt je Eintrag *Dokument*, *Ausgegeben*, *Stand auf dem Blatt*, *Gilt noch?* und *Was sich seitdem geändert hat*. Der Status lautet *aktuell*, *überholt — neu ausgeben* oder *nicht beurteilbar*; bei überholten Blättern erklärt die letzte Spalte, was sich geändert hat. *Aktualisieren* liest das Register neu, *Register leeren* löscht die Einträge nach einer Rückfrage. Ältere Einträge fallen aus dem Register; ein Hinweis nennt das, ein zweiter nennt Einträge anderer Projekte.

![Register mit Einträgen](bilder/de/export-131-register-gefuellt.jpg)

### Rückweg nach Rentman

*Plan an Rentman anhängen…* hängt den aktuellen Plan als PDF an das verknüpfte Rentman-Projekt, mit Stempel. Der Dateiname trägt Projektname und Zeitpunkt; vorher fragt eine Rückfrage nach dem Zielprojekt. *Kabel an Rentman senden…* öffnet einen Dialog, der je Kabeltyp und Länge *Verbaut*, *Geplant* und *Bereits gesendet* gegenüberstellt, die Rentman-Zuordnung wählen lässt und die Differenz als Zugang sendet; weniger Verbautes als zuletzt gesendet muss in Rentman von Hand korrigiert werden. Beide Einträge sind ausgegraut, solange kein Rentman-Projekt verknüpft ist (*kein Projekt verknüpft*). Die Verknüpfung entsteht im Rentman-Import, siehe *Datei und Import*. Beide Wege sind nicht aufgenommen, weil sie ein Rentman-Konto brauchen.
