## Programmoberfläche

### Aufbau des Hauptfensters

![Hauptfenster mit Beispielprojekt](bilder/de/oberflaeche-01-start.jpg)

Das Hauptfenster hat fünf Bereiche:

| Bereich | Lage | Inhalt |
|---|---|---|
| Kopfleiste | oben | Menüs *Datei*, *Bearbeiten*, *Werkzeuge*, *Ansicht*, *Hilfe*, Projektname, Rückgängig/Wiederherstellen, Darstellungs-Knopf, *Handy-Zugriff*, *Einstellungen* |
| Bibliothek | links | Geräte, Kabel, Gruppen und Racks zum Einsetzen in den Plan |
| Canvas | Mitte | der Plan mit Geräten und Kabeln, Werkzeugleiste, Suchfeld, Zoom-Knöpfe, Übersichtskarte |
| Inspector | rechts | Eigenschaften der Auswahl |
| Statusleiste | unten | Kennzahlen und Hinweise zum Projekt |

#### Kopfleiste

![Kopfleiste](bilder/de/oberflaeche-02-menueleiste.jpg)

Ein Klick auf den Projektnamen in der Mitte öffnet den Dialog *Projektdaten bearbeiten*.

![Projektdaten bearbeiten](bilder/de/oberflaeche-10-projektname-klick.jpg)

| Feld | Wirkung |
|---|---|
| Projektname (Pflichtfeld) | Name in Kopfleiste, Statusleiste und Ausdrucken |
| Auftragnehmer (Firma), Kunde, Planer / Autor, Projekt-/Job-Nr. | Angaben für das Planköpfchen |
| Einsatz-/Mietbeginn, Einsatz-/Mietende | Zeitraum des Einsatzes |
| Beschreibung | freier Text |
| Firmenlogo, Kundenlogo | Bilddatei über *Logo auswählen…* |

Die Daten erscheinen im Planköpfchen unten rechts beim PDF-Export. *Speichern* übernimmt sie, *Abbrechen* verwirft sie.

Rechts in der Kopfleiste liegen die Knöpfe für Rückgängig und Wiederherstellen. Sie sind ausgegraut, solange es keinen Schritt gibt.

![Rückgängig und Wiederherstellen in der Kopfleiste](bilder/de/oberflaeche-31-kopfleiste-rechts.jpg)

In einem schmalen Fenster rückt die Kopfleiste zusammen; die Menüs bleiben erreichbar.

![Kopfleiste im schmalen Fenster](bilder/de/oberflaeche-81-schmal-kopfleiste.jpg)

#### Menüs Datei und Werkzeuge

Das Menü *Datei* enthält Anlegen, Öffnen, Speichern, die Importe und die Exporte. Die Einträge beschreiben die Kapitel [Datei und Import](#6-datei-und-import) und [Exportieren und Drucken](#7-exportieren-und-drucken).

![Menü Datei](bilder/de/oberflaeche-07-menue-datei.jpg)

Das Menü *Werkzeuge* ist in Gruppen gegliedert, darunter *Berechnen*, *Prüfen* und *Planen*. Die Werkzeuge beschreiben die Kapitel zu den Werkzeugen.

![Menü Werkzeuge](bilder/de/oberflaeche-08-menue-werkzeuge.jpg)

#### Inspector ohne Auswahl

Ist nichts ausgewählt, zeigt der Inspector *Nichts ausgewählt*, den Block *Fotos des Projekts* mit *Foto hinzufügen…* und die *Schnelle Orientierung* mit vier Hinweisen zum Einstieg.

![Inspector ohne Auswahl](bilder/de/oberflaeche-05-inspector-leer.jpg)

### Seitenleisten anordnen

Bibliothek und Inspector lassen sich einklappen, abdocken, in ein eigenes Fenster legen und in der Breite ändern.

#### Fenster-Menü

1. Klicken Sie oben in der Seitenleiste auf *Fenster*.

   ![Fenster-Menü der Bibliothek](bilder/de/oberflaeche-11-fenster-bibliothek-menue.jpg)

2. Wählen Sie *Abdocken (schwebend)*. Die Bibliothek schwebt als verschiebbares Feld über dem Canvas. *Andocken* setzt sie zurück an ihren Platz.

   ![Bibliothek abgedockt](bilder/de/oberflaeche-12-bibliothek-abgedockt.jpg)

*In eigenes Fenster* öffnet die Seitenleiste als eigenes Programmfenster. Der Knopf *Fenster* lässt sich auch ziehen. Das Menü des Inspectors und das des Anmerkungen-Panels bieten dieselben Einträge.

#### Einklappen und Breite

- Der Pfeil-Knopf neben *Fenster* klappt die Seitenleiste ein. Ein Klick auf den Pfeil am Rand klappt sie wieder aus.

  ![Bibliothek eingeklappt](bilder/de/oberflaeche-14-bibliothek-eingeklappt.jpg)

  ![Inspector eingeklappt](bilder/de/oberflaeche-17-inspector-eingeklappt.jpg)

- Die Trennleiste zwischen Seitenleiste und Canvas lässt sich mit der Maus ziehen und ändert die Breite.

  ![Bibliothek verbreitert](bilder/de/oberflaeche-19-trennleiste-gezogen.jpg)

- **Strg+B** blendet die Bibliothek aus und ein, **Strg+I** den Inspector.

Die Taste **P** öffnet die Patchliste.

![Patchliste nach Taste P](bilder/de/oberflaeche-23-tastatur-patchliste-p.jpg)

### Menü Bearbeiten

![Menü Bearbeiten](bilder/de/oberflaeche-24-bearbeiten-menue.jpg)

| Eintrag | Kürzel | Wirkung |
|---|---|---|
| Rückgängig | Strg+Z | nimmt den letzten Schritt zurück |
| Wiederherstellen | Strg+Y | stellt den zurückgenommenen Schritt wieder her |
| Duplizieren | Strg+D | kopiert die ausgewählten Elemente |
| Auswahl löschen | Entf | löscht die ausgewählten Elemente |
| Alles auswählen | Strg+A | wählt alle Elemente des Plans aus |
| Auswahl aufheben | Esc | hebt die Auswahl auf |

![Alles ausgewählt](bilder/de/oberflaeche-25-bearbeiten-alles-auswaehlen.jpg)

### Menü Ansicht

![Menü Ansicht](bilder/de/oberflaeche-34-ansicht-menue.jpg)

#### Zoom

| Eintrag | Wirkung |
|---|---|
| Einpassen | zoomt so, dass alle Elemente sichtbar sind |
| Zoom 100 % | setzt den Zoom auf 100 % |
| Vergrößern | zoomt hinein |
| Verkleinern | zoomt heraus |
| Vollbild | schaltet das Fenster in den Vollbildmodus und zurück |

Die aktuelle Zoomstufe steht in der Statusleiste.

#### Darstellung

| Eintrag | Wirkung |
|---|---|
| Darstellung: wie System | hell oder dunkel nach der Einstellung des Betriebssystems |
| Helle Darstellung | immer hell |
| Dunkle Darstellung | immer dunkel |

Dieselbe Wahl bieten der Darstellungs-Knopf in der Kopfleiste (Sonne, Mond oder Bildschirm) und *Einstellungen → Darstellung*. Die Wahl bleibt gespeichert.

![Helle Darstellung](bilder/de/oberflaeche-40-ansicht-helles-design-aus.jpg)

#### Raster und Beschriftungen

| Eintrag | Wirkung |
|---|---|
| Am Raster ausrichten | Geräte rasten beim Verschieben auf dem Raster ein |
| Kabel-Labels ausblenden | blendet die Beschriftungen an den Kabeln aus |
| Off-Page-Namen anzeigen | zeigt an Off-Page-Verbindern die Kabelnummer bzw. den Kabelnamen dauerhaft; ohne die Option erscheint sie nur beim Überfahren mit der Maus |

Ein Häkchen vor dem Eintrag zeigt, dass die Option eingeschaltet ist.

![Kabel-Labels ausgeblendet](bilder/de/oberflaeche-45-ansicht-labels-aus.jpg)

#### Kabelfarbe nach Länge

*Kabelfarbe nach Länge* färbt die Kabel nach dem Längen-Farbcode der Rundfunktechnik. Die gespeicherte Farbe jedes Kabels bleibt unverändert; ein zweiter Klick schaltet zurück.

| Länge | Farbe |
|---|---|
| 1 m | rot |
| 2 m | gelb |
| 3 m | grün |
| 5 m | weiß |
| 10 m | rot |
| 20 m | gelb |
| 25 m | gelb/weiß gestrichelt |
| 50 m | weiß |
| 100 m | rot |

Kabel mit einer anderen Länge erscheinen grau.

![Kabel mit 1, 2, 3 und 5 m nach Länge gefärbt](bilder/de/oberflaeche-53-ansicht-farbe-laenge-regel.jpg)

#### Kabelfarbe nach Gewerk

*Kabelfarbe nach Gewerk* färbt jedes Kabel nach seinem Gewerk: Video blau, Audio rot, Control orange, Network grün, Power violett, Other grau. Auch hier bleibt die gespeicherte Farbe unverändert. Die beiden Farbmodi schließen sich aus.

![Kabel nach Gewerk gefärbt](bilder/de/oberflaeche-54-ansicht-farbe-gewerk-vergleich.jpg)

#### Suchfeld, Werkzeugleiste und Panels

| Eintrag | Kürzel | Wirkung |
|---|---|---|
| Gerät suchen | Strg+F | blendet das Suchfeld über dem Canvas ein und aus |
| Werkzeugleiste | | blendet die Werkzeugleiste des Canvas ein und aus |
| Anmerkungen-Panel | | öffnet und schließt das Panel *Anmerkungen* |
| Hallenplan | | blendet das Hallenplan-Panel ein und aus |
| Symbole | | blendet das Symbol-Panel ein und aus |

![Canvas ohne Werkzeugleiste](bilder/de/oberflaeche-58-ansicht-werkzeugleiste-aus.jpg)

Das Panel *Anmerkungen* erscheint rechts. Es filtert nach *alle*, *offen*, *gebaut* und *erledigt*; *+ Neue Anmerkung* legt eine Anmerkung an. *Schließen* blendet es aus.

![Anmerkungen-Panel](bilder/de/oberflaeche-60-ansicht-anmerkungen-an.jpg)

### Menü Hilfe

![Menü Hilfe](bilder/de/oberflaeche-83-hilfe-menue.jpg)

| Eintrag | Kürzel | Wirkung |
|---|---|---|
| Befehlspalette… | Strg+K | öffnet die Befehlspalette |
| Tastaturkürzel… | ? | öffnet die Übersicht der Tastaturkürzel |
| Erste-Schritte-Tour… | | startet die Tour durch die Oberfläche |
| Auf Updates prüfen… | | fragt nach einer neueren Version und meldet das Ergebnis |
| Über LZ Cable Planner… | | öffnet den Dialog mit Version und Build |

#### Befehlspalette

![Befehlspalette](bilder/de/oberflaeche-84-hilfe-befehlspalette.jpg)

Die Befehlspalette listet die Befehle aus *Bearbeiten*, *Ansicht*, *Datei*, *Werkzeuge* und *Hilfe*; rechts neben jedem Befehl steht seine Gruppe, unter manchen eine Kurzbeschreibung. Befehle abgeschalteter Module fehlen.

1. Öffnen Sie die Palette mit **Strg+K** oder über *Hilfe → Befehlspalette…*.
2. Tippen Sie ein oder mehrere Suchwörter. Die Suche prüft Befehlsname, Gruppe, Kurzbeschreibung und hinterlegte Synonyme; jedes Wort muss vorkommen. Treffer im Befehlsnamen stehen vorn.

   ![Suche nach „zoom“](bilder/de/oberflaeche-87-palette-suche-zoom.jpg)

3. Wählen Sie mit den Pfeiltasten einen Befehl und führen Sie ihn mit **Enter** aus.

Synonyme gelten in beiden Sprachen: *qr* findet zum Beispiel *Aufs Handy teilen…*.

![Suche nach „qr“](bilder/de/oberflaeche-88-palette-suche-synonym.jpg)

Passt nichts, steht *Keine Befehle gefunden* in der Liste.

![Keine Treffer](bilder/de/oberflaeche-89-palette-keine-treffer.jpg)

#### Tastaturkürzel

*Hilfe → Tastaturkürzel…* oder die Taste **?** öffnet die Übersicht.

![Tastaturkürzel, Ansicht Tastatur](bilder/de/oberflaeche-94-hilfe-tastenkuerzel.jpg)

Die Ansicht *Tastatur* zeigt eine Tastatur; markierte Tasten haben eine Aktion, die beim Überfahren oder Anklicken erscheint. Die Ansicht *Liste* führt alle Kürzel als Liste. Dazu gehören unter anderem:

| Kürzel | Aktion |
|---|---|
| Strg+N, Strg+O, Strg+S, Strg+Umsch+S | Neues Projekt, Öffnen, Speichern, Speichern unter |
| Strg+C, Strg+V | Kopieren, Einfügen |
| Strg+K | Befehlspalette |
| Strg+F | Gerät suchen |
| Strg++ | Neues Gerät an der Mausposition |
| Strg+B, Strg+I | Bibliothek bzw. Inspector ein- und ausblenden |
| P | Patchliste öffnen |
| A | Pfeildarstellung umschalten |
| ? | diese Übersicht |

#### Erste-Schritte-Tour

Die Tour führt in fünf Schritten durch die Oberfläche: Bibliothek links, Eigenschaften rechts, Plan-Prüfung, Export-Menü, Jede Funktion finden. *Weiter* und *Zurück* blättern, *Tour beenden* bricht ab. Der letzte Schritt schließt mit *Befehlspalette öffnen* die Tour und öffnet die Befehlspalette. Beim ersten Start öffnet sich die Tour von selbst.

![Erster Schritt der Tour](bilder/de/oberflaeche-96-hilfe-tour-1.jpg)

#### Über LZ Cable Planner

![Über LZ Cable Planner](bilder/de/oberflaeche-103-hilfe-ueber.jpg)

Der Dialog zeigt:

- Version
- Build: Datum und Uhrzeit, zu der das Programm gebaut wurde
- Autor
- Repository (github.com/larszu/cable-planner)
- Plattform (Electron, React, ReactFlow, Vite, Tailwind)
- den Hinweis, Fehler und Wünsche auf GitHub zu melden

Derselbe Dialog öffnet sich mit einem Klick auf die Versionsnummer rechts in der Statusleiste.

### Statusleiste

![Statusleiste](bilder/de/oberflaeche-06-statusleiste.jpg)

Die Statusleiste zeigt von links nach rechts:

| Element | Bedeutung | Klick |
|---|---|---|
| Projektname | Name des Projekts | |
| Geräte, Kabel | Anzahl im Plan | |
| Rahmen | Anzahl der Raum-Rahmen | |
| gepackt | Geräte, die in ihren Eigenschaften als gepackt markiert sind, z. B. *0/5 gepackt*; grau bei keinem, gelb bei einigen, grün bei allen | |
| Komplexität | Größeneinschätzung des Plans | |
| Plan-Check | Ergebnis der laufenden Planprüfung | öffnet den Plan-Check |
| Rentman | Verbindung zu Rentman | |
| Zoom | aktuelle Zoomstufe | |
| Version | Programmversion | öffnet *Über LZ Cable Planner* |

In einem schmalen Fenster blendet die Statusleiste Rahmen, gepackt und Rentman aus.

#### Komplexität

Das Abzeichen zählt Geräte und Kabel zusammen:

| Summe | Abzeichen |
|---|---|
| unter 8 | Neu |
| ab 8 | Klein |
| ab 30 | Mittel |
| ab 80 | Groß |
| ab 200 | XL |

Das Abzeichen dient nur der Orientierung über Lesbarkeit und Arbeitstempo.

![Komplexität XL bei 115 Geräten und 92 Kabeln](bilder/de/oberflaeche-70-status-komplexitaet-xl.jpg)

#### Plan-Check

Das Abzeichen hat drei Zustände:

| Farbe | Bedeutung |
|---|---|
| grün, *OK* | keine Befunde |
| gelb mit Zahl | nur Warnungen |
| rot mit Zahl | mindestens ein Fehler |

Die Zahl ist die Summe aus Fehlern und Warnungen.

![Plan-Check mit einer Warnung](bilder/de/oberflaeche-71-status-plancheck-warnung.jpg)

![Plan-Check mit Fehlern](bilder/de/oberflaeche-73-status-plancheck-fehler.jpg)

Ein Klick öffnet den Plan-Check mit allen Befunden. Ein Klick auf einen Befund wählt das betroffene Element aus.

![Plan-Check geöffnet](bilder/de/oberflaeche-72-status-plancheck-klick.jpg)

#### Hinweise, die nur bei Bedarf erscheinen

| Abzeichen | Erscheint, wenn | Klick |
|---|---|---|
| *Netz* mit Zahl | Netzwerk-Befunde vorliegen: fehlende oder doppelte Adressen, Masken, Segmente | öffnet die Analysen auf dem Netzwerk-Reiter |
| *Keine Sicherungskopie* | der Browser-Speicher die Sicherungskopie des Projekts abgelehnt hat; der Plan selbst ist nicht betroffen, speichern Sie ihn in eine Datei | |
| *Fotos* mit MB | die Fotos im Plan mehr als 40 MB ausmachen; die Datei öffnet weiterhin, ist aber schwer per Mail zu verschicken | |
| *Fällig* mit Zahl | Rückgaben, Ausgaben, Stunden, Belege oder Kosten überfällig oder heute fällig sind | öffnet die Analysen auf *Was ansteht* |
| *Live* mit Teilnehmerzahl | eine Live-Zusammenarbeit läuft | öffnet die Einstellungen auf dem Netzwerk-Sync-Reiter |
| *MCP* | der lokale MCP-Server läuft; daneben *· nur lesen* oder *· darf ändern*, bei aktiver Anfrage *MCP · fragt* | öffnet die Einstellungen auf dem MCP-Reiter |

![Netzwerk-Befunde](bilder/de/oberflaeche-74-status-netz-befunde.jpg)

![Keine Sicherungskopie](bilder/de/oberflaeche-79-status-keine-sicherungskopie.jpg)

![Fotos über 40 MB](bilder/de/oberflaeche-77-status-fotos.jpg)

#### Rentman-Anzeige

Die Rentman-Anzeige erscheint nur, wenn das Modul Rentman eingeschaltet ist. Sie zeigt den Namen des verknüpften Rentman-Projekts, sonst *Token bereit*, wenn ein Zugangstoken hinterlegt ist, sonst *Standalone*.

![Verknüpftes Rentman-Projekt](bilder/de/oberflaeche-78-status-rentman-projekt.jpg)

### Handy-Zugriff

Der Knopf *Handy-Zugriff* in der Kopfleiste öffnet den gleichnamigen Dialog. Er startet einen kleinen Webserver im lokalen Netzwerk; ein Handy öffnet über den QR-Code die mobile Ansicht des Projekts.

![Dialog Handy-Zugriff](bilder/de/oberflaeche-105-handy-dialog.jpg)

| Element | Wirkung |
|---|---|
| Rückmeldungen vom Handy: *Nur lesen* | das Handy kann nichts zurückschreiben |
| Rückmeldungen vom Handy: *Mitschreiben: Häkchen, Kabel, Fotos, neue Geräte* | das Handy darf Häkchen, Kabel, Fotos und neue Geräte zurückschicken |
| *LAN-Server starten* | startet den Server und zeigt den QR-Code |
| *Anlagen-Zugangscodes abrufbar machen* | gibt Intercom-Zugangscodes über einen zweiten Code frei; nur bei Projekten mit Intercom-Konfiguration wählbar |
| *Hinweise zur Sicherheit* | klappt die Sicherheitshinweise auf |

Der Server stoppt beim Schließen der App oder über den Stop-Knopf. Die mobile Ansicht beschreibt das Kapitel [Web-Ausgabe und Tablet](#12-web-ausgabe-und-tablet).

![Hinweise zur Sicherheit](bilder/de/oberflaeche-107-handy-sicherheitshinweise.jpg)

### Erster Start

Beim ersten Start mit leerem Projekt erscheint der Dialog *Willkommen — was planst du?*.

![Startdialog](bilder/de/oberflaeche-109-erststart-startdialog.jpg)

1. Wählen Sie optional einen oder mehrere Anwendungsfälle. Sie schalten die passenden Module ein:

   | Anwendungsfall | schaltet die Module ein |
   |---|---|
   | Show / Event | Mobile-Companion, Rentman |
   | Festinstallation | Festinstallation, Mobile-Companion, NetBox |
   | Vermietung | Vermietung / Lager, Rentman |

   ![Anwendungsfall gewählt](bilder/de/oberflaeche-110-erststart-auswahl.jpg)

2. Wählen Sie, wie Sie beginnen:

   | Knopf | Wirkung |
   |---|---|
   | Neues Projekt | öffnet die Projektdaten für ein neues Projekt |
   | Beispielprojekt laden | lädt das Beispielprojekt und passt die Ansicht ein |
   | Projekt öffnen… | öffnet eine vorhandene `.cableplan`-Datei |
   | Später entscheiden | schließt den Dialog |

   Ohne gewählten Anwendungsfall bleiben die Module, wie sie sind. Ändern lässt sich alles unter *Einstellungen → Module*.

3. Danach startet die [Erste-Schritte-Tour](#erste-schritte-tour).

   ![Tour nach dem Startdialog](bilder/de/oberflaeche-112-erststart-tour.jpg)
