## Datei und Import

Das Menü *Datei* hat vier Teile. Oben stehen Projekt anlegen, öffnen und speichern, darunter die Importe (*yEd / GraphML*, *MultiCam-Kameras*, *Equipment aus CSV*, *Rentman-Import*, *NetBox-Import*) und der Austausch ganzer Projekte (*.avplan*, *.avsourcemap*). Darauf folgen die Ausgaben *Patch-Liste…*, *Festinstallation: Doku & Übergabe…*, *Stage-Plot*, *Exportieren & Drucken…*, die Cloud, die Viewer-Datei und die Einträge für Rentman. Diese Ausgaben beschreibt das Kapitel *Exportieren und Drucken*. *Rentman-Import…* und *NetBox-Import…* stehen nur im Menü, wenn die Integration unter *Einstellungen → Integrationen* eingeschaltet ist. *Verknüpfte Venue-Planung ansehen…* erscheint nur, wenn das Projekt eine verknüpfte Venue-Planung enthält.

![Das Menü Datei](bilder/de/datei-import-01-menue-datei-offen.jpg)

### Neues Projekt

*Datei → Neues Projekt* (`Strg+N`) öffnet das Formular *Neues Projekt*. Es verlangt einen Projektnamen; ohne ihn bleibt *Projekt anlegen* gesperrt. Enthält der aktuelle Plan Geräte, Kabel oder Standorte, steht darüber der Hinweis, dass ein neues Projekt das aktuelle verwirft und ungespeicherte Änderungen verloren gehen. Bei einem leeren Plan entfällt der Hinweis.

![Formular Neues Projekt](bilder/de/datei-import-64-neu-dialog-mit-warnung.jpg)

Das Formular fragt neben dem Namen *Auftragnehmer (Firma)*, *Kunde*, *Planer / Autor*, *Projekt-/Job-Nr.*, *Einsatz-/Mietbeginn*, *Einsatz-/Mietende*, *Beschreibung*, *Firmenlogo* und *Kundenlogo* ab. Diese Angaben erscheinen im Plankopf unten rechts beim PDF-Export. Sie lassen sich später über *Projektdaten bearbeiten* in der Kopfleiste ändern.

![Ausgefülltes Formular](bilder/de/datei-import-65-neu-dialog-ausgefuellt.jpg)

*Projekt anlegen* ersetzt den aktuellen Plan durch einen leeren mit diesen Angaben. Bei einem leeren Plan zeigt das Formular keine Warnung.

![Formular ohne Warnung](bilder/de/datei-import-66-neu-dialog-ohne-warnung.jpg)

### Neu aus Vorlage

*Datei → Neu aus Vorlage…* öffnet den Dialog *Neu aus Vorlage*. Er lädt eine Kopie der gewählten Vorlage als neues Projekt.

![Dialog Neu aus Vorlage](bilder/de/datei-import-02-vorlagen-dialog.jpg)

Unter *Mitgelieferte Vorlagen* liegen fünf Show-Setups. Jede Karte nennt die Zahl der Geräte, Kabel und Standorte.

| Vorlage | Inhalt |
|---|---|
| *OB van* | Übertragungswagen mit Bühne und FOH, getrennte Standort-Rahmen |
| *TV-Studio* | Studio mit Regie und Studioboden |
| *Live stage* | Bühne, FOH und Monitorwelt für Live-Events |
| *Konferenz / Corporate* | Saal und Regie für Tagungen und Corporate-Events |
| *Houses of Worship* | Altarraum/Bühne und Technikempore für Gottesdienste |

Unter *Eigene Vorlagen* stehen die Vorlagen, die Sie selbst gespeichert haben. Sie liegen im lokalen Speicher dieser App auf diesem Rechner, nicht in der Projektdatei.

**Eine Vorlage laden**

1. Klicken Sie auf *Verwenden*. Enthält der aktuelle Plan Inhalt, fragt *Aktuelles Projekt verwerfen?* nach. *Vorlage laden* bestätigt.

   ![Rückfrage vor dem Laden](bilder/de/datei-import-61-vorlagen-verwenden-rueckfrage.jpg)

2. Tragen Sie den Namen des neuen Projekts ein. Vorbelegt ist der Name der Vorlage.

   ![Name des neuen Projekts](bilder/de/datei-import-62-vorlagen-verwenden-name.jpg)

3. *Vorlage geladen* meldet das neue Projekt. Es ist ungespeichert und hat noch keinen Dateipfad.

   ![Meldung Vorlage geladen](bilder/de/datei-import-63-vorlagen-verwenden-geladen.jpg)

Bringt eine Haus-Vorlage Antworten für ein anderes Haus mit, als das aktuelle Projekt trägt, fragt vor dem Namen *Antworten aus einem anderen Haus* nach. *Trotzdem laden* führt fort.

**Das aktuelle Projekt als Vorlage speichern**

*Aktuelles Projekt als Vorlage* fragt nach dem Namen der Vorlage; vorbelegt ist der Projektname.

![Name der Vorlage](bilder/de/datei-import-57-vorlagen-eigene-speichern-name.jpg)

Hängen am Projekt ortsgebundene Angaben, also Antworten der Haus-IT oder die Adresse, fragt *Vorlage an dieses Haus binden?* nach. *Neutral (nur die Form)* lässt sie weg. *Für dieses Haus* nimmt sie mit und merkt sich, für welches Haus sie gelten. Ohne ortsgebundene Angaben entfällt die Frage.

![Rückfrage Haus-Vorlage](bilder/de/datei-import-56-vorlagen-haus-frage.jpg)

*Als Vorlage gespeichert* bestätigt das Speichern.

![Meldung Als Vorlage gespeichert](bilder/de/datei-import-58-vorlagen-eigene-gespeichert.jpg)

Die Vorlage steht danach unter *Eigene Vorlagen*. Eine Haus-Vorlage zeigt *Haus-Vorlage* mit dem Haus und der Zahl der Antworten, eine aus dem As-Built gebildete zeigt *Grundlage*. Das Papierkorb-Symbol an der Karte löscht die Vorlage nach einer Rückfrage.

![Eigene Vorlagen](bilder/de/datei-import-59-vorlagen-eigene-liste.jpg)

![Löschen-Rückfrage](bilder/de/datei-import-60-vorlagen-eigene-loeschen-frage.jpg)

**As-Built als Vorlage**

*As-Built als Vorlage* nimmt nicht den aktuellen Plan, sondern den als „wie gebaut" festgeschriebenen Stand. Die Schaltfläche bleibt immer aktiv; der Hinweis am Knopf nennt den Unterschied. Zuerst fragt der Dialog nach dem Namen der Vorlage.

![Name der Vorlage aus dem As-Built](bilder/de/datei-import-03-vorlagen-as-built-frage.jpg)

Ist nichts als As-Built festgeschrieben, lehnt *Kein As-Built festgeschrieben* ab: Schreiben Sie zuerst eine As-Built-Revision fest, sonst wäre die Vorlage der Plan von vor dem Aufbau unter anderem Namen. Die Revisionen beschreibt das Kapitel *Werkzeuge: Bauen*. Mit festgeschriebenem As-Built meldet der Dialog *Vorlage … aus dem As-Built … erstellt*.

![Ablehnung ohne As-Built](bilder/de/datei-import-04-vorlagen-as-built-abgelehnt.jpg)

### Öffnen

*Datei → Öffnen…* (`Strg+O`) öffnet den Dateidialog des Betriebssystems. Er zeigt Dateien mit den Endungen `.cableplan`, `.json` und `.cpviewer`. Die gewählte Datei ersetzt den aktuellen Plan im Fenster.

Die App prüft die Datei, bevor sie sie lädt. Gültiges JSON, das keine Geräte- und Kabelliste enthält, lehnt sie ab. *Diese Datei ist kein LZ-Cable-Planner-Projekt* meldet das; der geöffnete Plan bleibt unverändert.

![Meldung Kein Projekt](bilder/de/datei-import-05-oeffnen-kein-plan.jpg)

Eine `.cpviewer`-Datei, oder ein Projekt mit dem Modus *viewer*, öffnet die App als Prüfdatei. Zuerst fragt *Viewer-Datei — Name eingeben* nach Ihrem Namen. Er wird an jede Anmerkung gehängt, die Sie in dieser Sitzung anlegen.

![Namensabfrage der Viewer-Datei](bilder/de/datei-import-06-oeffnen-viewer-name.jpg)

Ohne Namen lädt die App die Datei nicht. *Name fehlt* sagt: ohne Namen können keine Anmerkungen gemacht werden. Wie Sie Viewer-Dateien erzeugen und Anmerkungen zurückholen, beschreibt das Kapitel *Exportieren und Drucken*.

![Meldung Name fehlt](bilder/de/datei-import-07-oeffnen-viewer-name-leer.jpg)

Trägt das geöffnete Projekt den Namen *Untitled Project* oder gar keinen, übernimmt die App den Dateinamen als Projektnamen.

### Speichern und Speichern unter

*Datei → Speichern* (`Strg+S`) schreibt das Projekt in seine Datei. Hat das Projekt noch keinen Dateipfad, öffnet sich zuerst der Dialog *Speichern unter*. Als Endung hängt die App `.cableplan` an, wenn Sie keine `.cableplan` oder `.json` angeben.

*Datei → Speichern unter…* (`Strg+Umschalt+S`) schreibt das Projekt unter einem neuen Namen oder Pfad. Das neue Projekt ist danach das aktive; die Datei davor bleibt unverändert. Der Dateiname wird zum neuen Projektnamen.

Jede Schreibung ist atomar. Die App schreibt zuerst eine temporäre Datei, benennt die bisherige Datei in `<name>.cableplan.bak` um und setzt dann die temporäre Datei an ihre Stelle. Nach dem zweiten Speichern liegt neben der Projektdatei darum die `.bak`-Datei mit dem Stand davor. Ein Abbruch mitten im Schreiben zerstört weder die alte noch die neue Datei.

### Autosave und Statusleiste

Unabhängig vom Speichern in eine Datei sichert die App den offenen Plan fortlaufend im lokalen Speicher des Programms. Nach einer Änderung wartet sie kurz, bevor sie schreibt; Standard sind 400 ms. Das Intervall steht unter *Einstellungen → Erweitert* im Feld *Autosave-Intervall (ms)*. Beim nächsten Start lädt die App diese Sicherung wieder, wenn sie gültig ist.

![Einstellungen Erweitert mit dem Autosave-Intervall](bilder/de/datei-import-55-einstellungen-autosave.jpg)

Der lokale Speicher fasst nur etwa 5 MB. Wird der Plan größer, lehnt der Speicher die Sicherung ab. Die Statusleiste unten zeigt dann *Keine Sicherungskopie*. Ein Hinhalten mit dem Mauszeiger nennt die Größe des Plans. Am Plan selbst fehlt nichts; speichern Sie in eine Datei. Sobald eine Sicherung wieder gelingt, verschwindet die Anzeige.

![Statusleiste im Normalzustand](bilder/de/datei-import-53-statusleiste-normal.jpg)

![Statusleiste mit der Anzeige Keine Sicherungskopie](bilder/de/datei-import-54-statusleiste-ohne-sicherungskopie.jpg)

### Das Dateiformat `.cableplan`

Eine `.cableplan`-Datei ist ein JSON-Dokument. Die App schreibt es mit zwei Leerzeichen Einrückung. Die obersten Felder sind: `metadata` (Name, Beschreibung, Zeitstempel, Standardwerte, `projectId`), `equipment`, `cables`, `locations`, `canvasState`, `floors`, `revisions`, `changelog`, `sourceIdentities`, `tallyPositions`, `patternChecks`, `hubSwitches`, `cableStock`, `ledPanelTypes`, `ledWalls`, `fotos` und weitere für Normen, Berichtsvorlagen, Adressebenen und Ausspielziele. Neue Felder bekommen beim Laden einen Vorgabewert, auch in älteren Dateien. Fotos liegen in der Datei; mit vielen Fotos wird sie entsprechend groß.

Passwörter und Schlüssel externer Dienste (Rentman, NetBox, Gerätebibliothek, Stream-Keys) stehen nicht in der Datei, sondern im Schlüsselbund des Betriebssystems.

### Import yEd / GraphML

*Datei → yEd / GraphML importieren…* liest ein Diagramm aus yEd oder eine andere GraphML-Datei. Aus Knoten werden Geräte, aus Anschlusszellen Ports und aus Kanten Kabel. Der Dialog zeigt erst eine Vorschau; in den Plan geht nichts, bevor Sie den Import auslösen.

![Dialog ohne gewählte Datei](bilder/de/datei-import-08-graphml-dialog-leer.jpg)

*Datei auswählen…* öffnet den Dateidialog. Der Parser braucht etwa 250 ms je MB. Danach zeigt der Kopf des Dialogs den Dateinamen, die Zahl der Nodes und Edges und die Zähler *Geräte*, *Kabel*, *Übersprungen* und *Edges ohne Ziel*. *Geräte: 3/3* heißt: drei von drei Geräten sind zum Import gewählt. *Andere Datei* kehrt zur Dateiwahl zurück.

![Vorschau mit der yEd-Zeichnung](bilder/de/datei-import-09-graphml-vorschau-yed.jpg)

Der Reiter *yEd-Vorschau* zeigt die gelesene Zeichnung. Das Mausrad zoomt, Ziehen verschiebt. Der Reiter *Geräte* listet die erkannten Geräte.

![Reiter Geräte](bilder/de/datei-import-10-graphml-reiter-geraete.jpg)

| Spalte | Bedeutung |
|---|---|
| Kontrollkästchen | Gerät importieren oder auslassen |
| *Name* | Name aus dem Diagramm; im Feld änderbar |
| *Kategorie* | erkannte Kategorie; im Feld änderbar |
| *IP* | die im Diagramm gefundene IP-Adresse |
| *In/Out* | Zahl der erkannten Eingänge und Ausgänge |
| *Status* | Erkennungssicherheit: *HIGH*, wenn Name und mindestens ein Port erkannt sind, *MED*, wenn der Name erkannt ist, aber kein Port, *LOW*, wenn sich kein Name ermitteln ließ |

Ein abgewähltes Gerät erscheint grau. Seine Kabel übernimmt der Import nicht.

![Gerät abgewählt](bilder/de/datei-import-11-graphml-geraet-abgewaehlt.jpg)

Name und Kategorie lassen sich vor dem Import ändern.

![Name und Kategorie geändert](bilder/de/datei-import-12-graphml-geraet-umbenannt.jpg)

Der Reiter *Kabel* zeigt für jede Kante *Quelle*, *Ziel*, *Typ*, *Standard* und *Länge*. Den Typ leitet die App aus der Beschriftung ab. Fehlt eine Länge, setzt der Import 1 m. Knickpunkte der Linien aus yEd übernimmt der Import als Wegpunkte der Kabel.

![Reiter Kabel](bilder/de/datei-import-13-graphml-reiter-kabel.jpg)

![Kabel abgewählt](bilder/de/datei-import-14-graphml-kabel-abgewaehlt.jpg)

Das Feld *Filter: Name / IP / Kategorie / Kabeltyp* oben rechts blendet nicht passende Zeilen aus.

![Filter auf HDMI](bilder/de/datei-import-15-graphml-filter.jpg)

Der Reiter *Übersprungen* nennt, was nicht importiert wird. *Nodes übersprungen* führt Knoten wie Legenden und Zierformen auf, mit dem Grund. *Edges ohne aufgelöste Ports* führt Kanten auf, deren Enden sich keinem Anschluss zuordnen ließen.

![Reiter Übersprungen](bilder/de/datei-import-16-graphml-reiter-uebersprungen.jpg)

**Ziel und Modus**

*Ziel* bestimmt, wohin der Import schreibt.

- *Canvas* platziert die Geräte samt Kabeln im Plan.
- *Library* legt die Geräte nur als wiederverwendbare Vorlagen in der lokalen Bibliothek ab. Kabel und Canvas-Platzierung entfallen.

![Ziel Library mit Hinweis](bilder/de/datei-import-17-graphml-ziel-bibliothek.jpg)

Bei *Canvas* gilt zusätzlich der *Modus*. *An Projekt anhängen* fügt die Geräte und Kabel zum Plan hinzu. *GraphML-Import ersetzen* ersetzt nur Geräte, die ein früherer GraphML-Import angelegt hat; von Hand angelegte Geräte bleiben unberührt.

![Modus GraphML-Import ersetzen](bilder/de/datei-import-18-graphml-ziel-canvas-ersetzen.jpg)

Der Knopf unten rechts nennt, was passiert, zum Beispiel *3 Geräte & 2 Kabel auf Canvas importieren* oder *2 Geräte in Library übernehmen*. Der Import auf den Canvas ist ein einziger Schritt für *Rückgängig*. Danach wählt die App das erste neue Gerät aus und zeigt den Ausschnitt mit den importierten Geräten.

![Plan nach dem Import](bilder/de/datei-import-20-graphml-import-ergebnis.jpg)

Beim Import in die Library meldet *In die Library übernommen*, wie viele Geräte neu angelegt wurden und welche Namen es schon gab. Vorhandene Vorlagen überschreibt der Import nie.

![Meldung nach dem Import in die Library](bilder/de/datei-import-21-graphml-bibliothek-ergebnis.jpg)

Beim zweiten Durchlauf mit derselben Datei legt der Import nichts an und nennt die vorhandenen Namen.

![Zweiter Import in die Library](bilder/de/datei-import-22-graphml-bibliothek-zweites-mal.jpg)

Klicken Sie neben den Dialog auf den Hintergrund, fragt *Import verwerfen?* nach: Was hier noch nicht übernommen wurde, geht verloren. *Weiter bearbeiten* kehrt zurück, *Verwerfen* schließt. Das Kreuz oben rechts schließt den Dialog ohne Rückfrage.

![Rückfrage Import verwerfen](bilder/de/datei-import-19-graphml-hintergrund-rueckfrage.jpg)

Eine Datei, die kein gültiges XML ist, zeigt *Import fehlgeschlagen* mit dem Dateinamen und der Meldung des Parsers.

![Fehlermeldung bei ungültiger Datei](bilder/de/datei-import-23-graphml-datei-ohne-inhalt.jpg)

### Import MultiCam-Kameras

*Datei → MultiCam-Kameras importieren…* öffnet direkt den Dateidialog; einen eigenen Dialog gibt es nicht. Gelesen wird die Kameraliste (`camera-list`, Version 1 bis 3), die der MultiCam-Planer exportiert. Aus jedem Eintrag wird ein Gerät der Kategorie *Kameras*.

Passt das Modell eindeutig zu einem Katalogeintrag, erbt die Kamera dessen Anschlüsse. Passt es nicht eindeutig, bleibt sie ohne Ports und gilt als „Ports unbekannt". Die App erfindet keine Anschlüsse; der Plan-Check verlangt dann die Datenblattwerte.

Eine Meldung nennt das Ergebnis: *MultiCam-Kameras: 2 neu, 0 aktualisiert, 0 unverändert.*

![Meldung nach dem ersten Import](bilder/de/datei-import-30-multicam-erster-import.jpg)

Ein weiterer Import ist ein Abgleich, kein Anhängen. Die App erkennt Kameras an der Herkunft aus dem MultiCam-Plan wieder. Aus der Liste übernimmt sie Name, Optik und, ab Version 3, die PTZ-Presets. Lage, Ports und Kabel bleiben, wie Sie sie gesetzt haben. Kameras, die im MultiCam-Plan nicht mehr stehen, markiert die App und löscht sie nicht, weil Kabel daran hängen können. Hat sich das Modell geändert, bleiben Ports und Kabel erhalten; den Körper tauschen Sie über *Anderes Gerät wählen…* in den Eigenschaften.

![Meldung nach dem Abgleich](bilder/de/datei-import-31-multicam-zweiter-import.jpg)

Eine Datei, die keine gültige Kameraliste ist, meldet *Kamera-Import fehlgeschlagen — keine gültige MultiCam-Kameraliste.*

![Fehlermeldung](bilder/de/datei-import-32-multicam-fehler.jpg)

### Import Equipment aus CSV

*Datei → Equipment aus CSV importieren…* legt Gerätevorlagen in der lokalen Bibliothek an. Es entstehen nur Vorlagen; auf den Canvas kommt nichts.

![Dialog ohne Inhalt](bilder/de/datei-import-24-csv-dialog-leer.jpg)

Sie fügen den CSV-Text in das Feld ein oder wählen mit *CSV-Datei wählen…* eine Datei. Die erste Zeile enthält die Spaltenüberschriften. Als Trenner gilt Semikolon oder Komma, je nachdem, was in der Kopfzeile häufiger vorkommt. Anführungszeichen und eine BOM am Dateianfang liest die App.

![Eingefügter CSV-Text mit der Vorschau](bilder/de/datei-import-25-csv-eingefuegt.jpg)

Die App ordnet die Überschriften einem Feld zu. Verglichen wird der ganze Text in Kleinschrift, nicht ein Teilstück.

| Feld | erkannte Überschriften |
|---|---|
| Name | `name`, `gerät`, `geraet`, `device`, `bezeichnung`, `artikel` |
| Kategorie | `kategorie`, `category`, `typ`, `type`, `gruppe` |
| Leistung (W) | `watt`, `watts`, `leistung`, `power`, `w` |
| Gewicht (kg) | `gewicht`, `weight`, `kg` |
| Seriennummer | `seriennummer`, `serial`, `s/n`, `sn` |
| Asset-Tag | `asset-tag`, `asset tag`, `assettag`, `asset_tag`, `inventarnummer`, `inventar-nr`, `inventar-nr.` |
| Interne Nummer | `interne nummer`, `interne nr`, `interne nr.`, `internal number`, `internal no`, `internal no.`, `hausnummer` |
| IP | `ip`, `ip-adresse`, `ipaddress`, `ip address`, `ip adresse` |
| Höheneinheiten | `he`, `rackunits`, `ru`, `höheneinheiten`, `hoeheneinheiten` |
| Untertitel | `untertitel`, `subtitle`, `hersteller`, `manufacturer`, `marke`, `brand` |

Ein Gerät mit Höheneinheiten gilt als Rack-Gerät. Fehlt die Kategorie, setzt die App *Importiert*. Fehlt die Namensspalte, gilt die erste Spalte als Name.

Der Kasten *Was mit dem Rest passiert* legt offen, was nicht als Feld ankommt:

- Spalten ohne Zuordnung wandern in die Notizen des Geräts, als Zeilen der Form `Überschrift: Wert`. Leere Zellen entfallen.
- Eine zweite Spalte auf dasselbe Feld verliert die Zuordnung: die erste gewinnt, die zweite wird zur Notiz.
- Zeilen ohne Namen werden übersprungen; der Kasten nennt ihre Nummern.
- Namen, die es in der Bibliothek schon gibt, bleiben unverändert. Das gilt auch für Namen, die in der Datei doppelt vorkommen: nur die erste Zeile zählt.

Der Knopf *2 importieren* nennt die Zahl der neuen Vorlagen. Danach meldet *CSV importiert*, wie viele Geräte neu angelegt wurden, wie viele Namen schon existierten und wie viele Zeilen ohne Namen übersprungen wurden.

![Meldung CSV importiert](bilder/de/datei-import-26-csv-import-ergebnis.jpg)

![Neue Vorlagen in der Bibliothek](bilder/de/datei-import-27-csv-in-bibliothek.jpg)

Wiederholen Sie den Import mit denselben Namen, bleiben die Vorlagen unverändert, und der Dialog führt die vorhandenen Namen auf.

![Zweiter Import mit vorhandenen Namen](bilder/de/datei-import-28-csv-zweiter-import-vorhanden.jpg)

Die Datei kann auch über *CSV-Datei wählen…* kommen; der Inhalt landet im selben Feld.

![Dialog nach der Dateiwahl](bilder/de/datei-import-29-csv-datei-gewaehlt.jpg)

### Rentman-Import

*Datei → Rentman-Import…* lädt die Geräte eines Rentman-Projekts in die Bibliothek. Der Import legt Vorlagen an, platziert aber nichts auf dem Canvas.

**Einrichten.** Schalten Sie unter *Einstellungen → Integrationen* die *Rentman-Integration aktivieren* ein. Auf der Karte *Rentman* tragen Sie den API-Token ein und speichern ihn. Er liegt im Schlüsselbund des Betriebssystems.

**Projekt wählen.** *Projekte laden* ruft die Projekte des Kontos ab. Die Liste zeigt Nummer, Name, Zeitraum und Status; *Sortierung* ordnet nach Nummer oder Datum, das Suchfeld filtert nach Name, Nummer oder Status.

![Dialog mit der Projektliste](bilder/de/datei-import-67-rentman-import-offen.jpg)

![Projekte nach der Suche](bilder/de/datei-import-68-rentman-suche.jpg)

Ein Klick auf ein Projekt lädt dessen Equipment. Der Kopf zeigt das Projekt; *ändern* kehrt zur Liste zurück, *Neu laden & Abgleichen* ruft die Stückzahlen neu ab.

![Projekt gewählt](bilder/de/datei-import-69-rentman-projekt-gewaehlt.jpg)

Der Kasten *Plan gegen Reservierung* vergleicht den Plan mit der Rentman-Reservierung: Geräte, die nur im Plan stehen, nur reserviert sind oder deren Menge abweicht. Zeilen ohne Gerätecharakter (Kommentare, Set-Inhalte, gestrichene) zählt er nicht. *CSV* speichert den Vergleich.

**Auswahl.** Die Liste führt die Geräte gruppiert nach Kategorie. Neben jeder Zeile stehen die Stückzahl im Rentman-Projekt und die Auswahl *Verknüpfen…*, die ein Rentman-Gerät mit einem vorhandenen lokalen Gerät verbindet. Abzeichen zeigen, was die App zum Gerät weiß:

| Abzeichen | Bedeutung |
|---|---|
| *⊕ Katalog* | Treffer im eingebauten Katalog; der Import legt die Vorlage daraus an |
| *verknüpft* | schon per Rentman-ID mit einer lokalen Vorlage verbunden; ein erneuter Import ändert nur Kategorie und Projektverknüpfung, die Ports bleiben |
| *schon in Lib* | lokale Vorlage mit demselben Namen, aber ohne Rentman-ID; der Import fragt dann nach |

*Alle auswählen* und *Alle abwählen* setzen alle Häkchen. Kombinationen erscheinen als *Physische Kombi*, *Virtuelle Kombi* oder *Set*. Eine physische Kombination ist eine Bestandseinheit und wird als ein Gerät übernommen. *+ als Rack* übernimmt sie als Rack, *+ nur Hauptgerät* lässt das Zubehör aus. *Alle Sets ausklappen* zeigt die Inhalte.

![Alle ausgewählt](bilder/de/datei-import-70-rentman-alle-auswaehlen.jpg)

![Sets ausgeklappt](bilder/de/datei-import-71-rentman-sets-aufgeklappt.jpg)

**Kabelmengen.** Der Block *Kabelmengen aus Rentman* fasst die Kabelzeilen nach Typ und Länge zusammen. Er lässt sich öffnen. Pro Typ stehen ein Häkchen, die Länge, eine änderbare Menge und die Zahl der Rentman-Einträge.

![Kabelmengen geöffnet](bilder/de/datei-import-72-rentman-kabelmengen.jpg)

*Kabelmengen übernehmen* speichert die gewählten Typen mit ihren Mengen als Kabelplan im Projekt und verknüpft das Projekt mit dem Rentman-Projekt. Das geht auch ohne Geräteimport. Die Meldung lautet *2 Kabeltyp(en) als Plan übernommen.* Mit *Kabel an Rentman senden…* im Datei-Menü gelangen diese Mengen später zurück; das beschreibt das Kapitel *Exportieren und Drucken*.

![Kabelmengen übernommen](bilder/de/datei-import-73-rentman-kabel-uebernommen.jpg)

**Übernehmen.** *Zur Library hinzufügen (n)* nennt die Zahl der gewählten Geräte.

![Auswahl für die Bibliothek](bilder/de/datei-import-74-rentman-auswahl.jpg)

Danach öffnet *Kategorie-Zuordnung vor Import*. Jedem Gerät ordnen Sie eine lokale Kategorie zu. Passende Kategorien erkennt und merkt sich die App; fehlende legen Sie mit *+ Neu* an. *Zurück* behält die Auswahl.

![Kategorie-Zuordnung](bilder/de/datei-import-75-rentman-kategorie-zuordnung.jpg)

*Weiter* ohne vollständige Zuordnung meldet *Kategorie fehlt*.

![Meldung Kategorie fehlt](bilder/de/datei-import-76-rentman-weiter.jpg)

Gibt es Geräte schon unter demselben Namen, erscheint pro Gerät ein Konflikt-Dialog. Vorgabe ist *Lokale Version beibehalten (empfohlen)*, damit eigene Port-Belegungen erhalten bleiben. Weitere Aktionen sind *Mit anderem lokalem Gerät verknüpfen*, *Mit Rentman-Version überschreiben*, *Ports mergen* und *Überspringen (nicht importieren)*. *Alle setzen:* wendet *Lokal beibehalten*, *Rentman übernehmen* oder *Überspringen* auf alle Zeilen an. Die Meldung am Ende nennt, wie viele Geräte zur Library hinzugefügt wurden.

#### Geräte zusammenführen

Wählen Sie im Konfliktdialog für ein Gerät *Ports mergen*, öffnet sich nach *Weiter* für jedes solche Gerät der Dialog *Geräte zusammenführen*. Er baut aus der lokalen und der Rentman-Fassung eine neue Vorlage. Oben steht *Wählen, welche Inputs/Outputs aus Lokal und Rentman übernommen werden.*

| Element | Bedeutung |
|---|---|
| *Zielkategorie* | Kategorie der zusammengeführten Vorlage; Voreinstellung ist die Kategorie aus der Kategorie-Zuordnung |
| *Gewählte Ports* | Zahl der angehakten Anschlüsse |
| *Vorschau* | Ergebnis als *n In / m Out* |
| Spalte *Lokal* | Inputs und Outputs der lokalen Vorlage, je mit Haken, Name und Steckertyp; zu Beginn sind alle angehakt |
| Spalte *Rentman* | Inputs und Outputs der Rentman-Fassung; zu Beginn ist keiner angehakt |

*Merge speichern* legt die Vorlage an. Sie behält den Namen der lokalen Vorlage. Höhe in HE, Front- und Rückbild übernimmt sie aus der Rentman-Fassung, wenn diese sie kennt; die Notizen beider Fassungen stehen untereinander. Ohne Zielkategorie meldet die App *Kategorie wählen*, ohne angehakten Anschluss *Port wählen*. *Abbrechen* verwirft alle Zusammenführungen und beendet den Import, bevor etwas in die Bibliothek geschrieben wurde. Sind mehrere Geräte zusammenzuführen, folgt der Dialog je Gerät nacheinander; nach dem letzten läuft der Import weiter.

### NetBox-Import

*Datei → NetBox-Import…* liest eine Site oder ein Rack aus NetBox und legt Geräte, Ports und Verbindungen als Kabelplan an.

**Einrichten.** Schalten Sie unter *Einstellungen → Integrationen* die *NetBox-Integration aktivieren* ein. Auf der Karte *NetBox API* tragen Sie die *Instanz-URL* und den *API-Token* ein. Der Token liegt im Schlüsselbund. *Verbindung testen* prüft die Verbindung. Ohne URL zeigt der Dialog *Bitte zuerst unter Einstellungen → Integrationen → NetBox die Instanz-URL und ein API-Token hinterlegen.* Der Knopf *Vorschau erstellen* bleibt gesperrt.

![Dialog ohne konfigurierte URL](bilder/de/datei-import-33-netbox-ohne-url.jpg)

**Auswählen.** Unter *Site* wählen Sie die Site, optional unter *Rack (optional)* ein einzelnes Rack. Die Zahl in Klammern ist die Zahl der Geräte. Das Symbol neben der Site lädt die Listen neu. Die Standardwahl *— ganze Site importieren —* nimmt alle Racks.

![Auswahl von Site und Rack](bilder/de/datei-import-34-netbox-dialog-auswahl.jpg)

![Site gewählt](bilder/de/datei-import-35-netbox-standort-gewaehlt.jpg)

![Rack gewählt](bilder/de/datei-import-36-netbox-rack-gewaehlt.jpg)

Unter *Optionen* stehen drei Schalter:

- *Nur verkabelte Ports importieren* lässt unbenutzte Ports weg. Empfohlen: ein 48-Port-Switch brächte sonst 48 unbenutzte Ports mit.
- *Verbindungen importieren* legt die Kabel an.
- *Rahmen je Rack anlegen* erzeugt für jedes Rack einen Rahmen im Plan.

![Optionen ausgeschaltet](bilder/de/datei-import-37-netbox-optionen-aus.jpg)

![Optionen eingeschaltet](bilder/de/datei-import-38-netbox-optionen-ein.jpg)

**Vorschau.** *Vorschau erstellen* lädt die Daten und rechnet den Abgleich. Vier Zähler stehen oben: *Neue Geräte*, *Neue Verbindungen*, *Neue Ports an Bestand* und *Unverändert*. Darunter nennt die Zeile die Zahlen aus NetBox. *übersprungene Objekte* lässt sich aufklappen und nennt jedes Objekt mit dem Grund; im Beispiel liegt ein Kabelende außerhalb des importierten Bereichs. *Geräte, die angelegt werden* listet Name, Typ und Portzahl.

![Vorschau](bilder/de/datei-import-39-netbox-vorschau.jpg)

![Vorschau mit aufgeklappten übersprungenen Objekten](bilder/de/datei-import-40-netbox-vorschau-uebersprungen.jpg)

*Zurück* kehrt zur Auswahl zurück, *In Projekt übernehmen* schreibt.

**Abgleich statt Anhängen.** Der Abgleich fügt immer nur hinzu: vorhandene Geräte und Kabel bleiben mit allen Anpassungen erhalten. Das Projekt merkt sich die Site. Beim nächsten Öffnen zeigt der Dialog *Dieses Projekt ist mit Site „…" verknüpft. Letzter Abgleich: …*.

![Erneuter Lauf, verknüpftes Projekt](bilder/de/datei-import-41-netbox-zweiter-lauf-verknuepft.jpg)

Im Beispiel ist in NetBox ein Gerät hinzugekommen. Die zweite Vorschau zeigt nur dieses Gerät als neu; die fünf Geräte aus dem ersten Lauf stehen unter *Unverändert*.

![Vorschau des zweiten Laufs](bilder/de/datei-import-42-netbox-zweiter-lauf-delta.jpg)

### Gesamtprojekt exportieren und importieren (`.avplan`)

*Datei → Gesamtprojekt exportieren (.avplan)…* schreibt das Projekt im Austauschformat `.avplan`. Die Datei ist JSON mit den Feldern `kind` (*avplan*), `formatVersion`, `app`, `appVersion`, `exportedAt`, `venue` und `domains`. Der Cable Planner trägt seinen Teil unter `domains.cabling` ein. Teile anderer Planer (Kameras, Licht, Venue) bewahrt er unverändert. Der Dateiname ist `<Projektname>.avplan`; Zeichen außer Buchstaben, Ziffern, `_` und `-` ersetzt die App durch `_`. Die Datei wird als Download des Programmfensters geschrieben.

Tragen Geräte Benutzername oder Passwort, fragt *Zugangsdaten mitgeben?* nach: Die `.avplan` geht an andere Gewerke. *Ohne Zugangsdaten* entfernt sie; ein Rück-Import in diesen Planer verliert sie dann. *Mitgeben* behält sie, *Abbrechen* bricht den Export ab. Die Frage entfällt, wenn kein Gerät Zugangsdaten trägt.

![Rückfrage zu den Zugangsdaten](bilder/de/datei-import-43-avplan-export-zugangsdaten-frage.jpg)

*Datei → Gesamtprojekt importieren (.avplan)…* lädt eine `.avplan`- oder `.json`-Datei und ersetzt den aktuellen Plan. Kennt die Datei Bereiche, die diese App nicht kennt, etwa von einer neueren Version, fragt *Diese Datei enthält unbekannte Bereiche* je Bereich nach. Zur Wahl stehen *Mitführen (unverändert, bleibt beim Export erhalten)*, *Übernehmen als* in einen freien bekannten Bereich und *Verwerfen*. *Alle mitführen* ist die vorsichtige Vorgabe; schließen Sie den Dialog ohne Wahl, gilt sie ebenfalls.

![Unbekannte Bereiche](bilder/de/datei-import-44-avplan-import-unbekannte-abschnitte.jpg)

![Bereich übernehmen als](bilder/de/datei-import-45-avplan-import-uebernehmen-als.jpg)

Enthält die Datei die Kameraliste des MultiCam-Plans, fragt *Diese Datei enthält die Kameras des MultiCam-Plans. In den Signalplan übernehmen?* nach. Der Text darunter nennt das Abgleichsergebnis wie beim MultiCam-Import. Gefragt wird, weil eine bewusst gelöschte Kamera sonst bei jedem Öffnen zurückkäme.

![Frage zu den Kameras](bilder/de/datei-import-46-avplan-import-kameras-frage.jpg)

Eine Datei ohne gültiges `.avplan`-Format meldet *Import fehlgeschlagen — keine gültige .avplan-Datei.*

![Fehlermeldung](bilder/de/datei-import-47-avplan-import-fehler.jpg)

### Identitäts-Karte (`.avsourcemap`)

Die Identitäts-Karte ist ein kleines, flaches Format für Laufzeit-Programme wie einen Tally-Rechner oder einen UMD-Sender. Sie soll nicht das ganze Projekt lesen müssen, um zu erfahren, dass „Kamera 1" auf Mischer-Eingang 3 liegt. Die Datei trägt `kind` *av-source-map*, `formatVersion`, `app`, `appVersion`, `exportedAt`, die Quellen (`sources`) und die ungeklärten Punkte (`unresolved`). Jeder Wert nennt seine Herkunft: *planned* (aus der Planung), *commanded* (an ein Gerät gesendet) oder *confirmed* (vom Gerät zurückgemeldet). Der Cable Planner schreibt nur *planned*.

*Datei → Identitäts-Karte exportieren (.avsourcemap)…* schreibt `<Projektname>.avsourcemap` auf demselben Weg als Download. Zwei Hinweise erscheinen nach dem Schreiben, wenn sie zutreffen. *Karte geschrieben — mit einer Einschränkung* nennt Rollen mit mehreren Geräten: die Datei trägt die Ziel-Beschriftung nur einmal je Rolle. *Karte geschrieben — ohne Mischer-Eingang* nennt Rollen, die einen Router erreichen, ohne dass der Kreuzpunkt zum Mischer geplant ist; für sie steht keine Eingangsnummer in der Datei.

*Datei → Identitäts-Karte importieren (.avsourcemap)…* liest eine Karte und gleicht sie mit den Quellen des Plans ab. Ein Bericht *Identitäts-Karte importiert* listet das Ergebnis:

| Zeile | Bedeutung |
|---|---|
| *Neu angelegt* | Quellen, die der Plan noch nicht kannte |
| *Ergänzt* | Felder, die im Plan leer waren |
| *Nicht übernommen* | Felder, in denen Plan und Datei verschiedene Werte tragen; der Plan behält seinen Wert |
| *Verworfen* | Werte, die die App ablehnt, mit Grund (zum Beispiel eine UMD-Adresse außerhalb des Bereichs 0 bis 126) |
| *Kein Feld dafür in dieser App* | Angaben, die nur in der Datei bleiben |
| *Nichts zu tun* | die Karte sagt dasselbe wie der Plan |

![Bericht mit neuen Quellen und einem verworfenen Wert](bilder/de/datei-import-49-karte-import-neu.jpg)

![Bericht mit einem Konflikt](bilder/de/datei-import-50-karte-import-konflikt.jpg)

![Bericht: nichts zu tun](bilder/de/datei-import-51-karte-import-nichts.jpg)

Eine Datei, die keine Identitäts-Karte ist, meldet *Import fehlgeschlagen* mit dem Grund.

![Fehlermeldung](bilder/de/datei-import-52-karte-import-fehler.jpg)

### Verknüpfte Venue-Planung ansehen

Stammt ein Projekt aus einer `.avplan`, die Raum-, Kamera- oder Lichtdaten eines anderen Planers trägt, steht im Menü *Verknüpfte Venue-Planung ansehen…*. Der Dialog *Verknüpfte Venue-Planung (nur Ansicht)* nennt den Raum, die Zahl der Wände, Personen und Bühnenelemente sowie die Kameras und Lampen. Er ändert nichts.

![Dialog Verknüpfte Venue-Planung](bilder/de/datei-import-48-venue-dialog.jpg)
