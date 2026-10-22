## Bibliothek

Die Bibliothek ist die Spalte links neben dem Plan. Sie hält die Vorlagen, aus denen der Plan gebaut wird: Geräte (lokal, aus der gemeinsamen Gerätebibliothek und aus Rentman), Kabeltypen, Gerätegruppen und Racks. Vorlagen werden per Klick oder Ziehen auf den [Canvas](#3-canvas) gesetzt; die Eigenschaften eines Eintrags erscheinen im [Inspector](#6-inspector).

![Bibliothek links neben dem Plan](bilder/de/bibliothek-01-fenster-ueberblick.jpg)

### Die Bibliothek-Spalte

Der Kopf der Spalte trägt links den Pfeil *Library ausblenden* und daneben das Menü *Fenster*. Darunter stehen die vier Reiter *Geräte*, *Kabel*, *Gruppen* und *Racks*; bei Gruppen und Racks zeigt eine Zahl, wie viele Einträge es gibt.

1. Der Pfeil links oben blendet die Spalte aus und gibt dem Plan die Breite.

   ![Spalte ausgeblendet](bilder/de/bibliothek-02-spalte-einklappen.jpg)

2. Am Rand erscheint ein Knopf *Library einblenden*; er holt die Spalte zurück.

   ![Spalte wieder eingeblendet](bilder/de/bibliothek-03-spalte-einblenden.jpg)

3. Das Menü *Fenster* bietet *Abdocken (schwebend)* und *In eigenes Fenster*. Der Knopf lässt sich auch ziehen.

   ![Menü Fenster](bilder/de/bibliothek-04-fenster-menue.jpg)

4. Abgedockt schwebt die Bibliothek über dem Plan; *Andocken* (zurück zur Seiten-Spalte) setzt sie wieder an ihren Platz.

   ![Abgedockte Bibliothek](bilder/de/bibliothek-05-abgedockt.jpg)

5. Die Breite der Spalte ändern Sie, indem Sie ihre Trennlinie zum Plan ziehen.

   ![Spalte verbreitert](bilder/de/bibliothek-07-spalte-verbreitern.jpg)

### Geräte

Der Reiter *Geräte* hat drei Unterreiter für die Quelle der Vorlagen: *Lokal* (eigene und importierte Vorlagen sowie der eingebaute Katalog), *Geteilt* (die gemeinsame Gerätebibliothek, schreibgeschützt) und *Rentman* (nur wenn das Rentman-Modul eingeschaltet ist).

#### Lokal

Der Unterreiter *Lokal* zeigt die Vorlagen nach Kategorien. Jede Kategorie ist ein aufklappbarer Streifen mit der Zahl der Einträge; ein Klick klappt sie auf oder zu.

![Kategorien der lokalen Bibliothek](bilder/de/bibliothek-11-geraete-lokal.jpg)

![Aufgeklappte Kategorie](bilder/de/bibliothek-12-kategorie-aufklappen.jpg)

Jeder Eintrag zeigt den Namen und darunter die Kategorie mit der Zahl der Ein- und Ausgänge. Das **L** vor dem Namen kennzeichnet ein lokales Gerät (nicht aus Rentman). Ein Klick markiert den Eintrag und zeigt seine Vorlage im Inspector; ein Doppelklick oder Ziehen auf den Canvas platziert das Gerät. Beim Zeigen auf einen Eintrag erscheinen vier Knöpfe:

| Knopf | Wirkung |
|---|---|
| Stern (*Als Favorit markieren* / *Favorit entfernen*) | Hebt den Eintrag mit einem Stern hervor. |
| Auge (*Ausblenden* / *Wieder anzeigen*) | Blendet den Eintrag aus der Liste aus; mit *Versteckte zeigen* im Filtermenü erscheint er abgeblendet wieder. |
| Pfeil nach unten (*Exportieren*) | Speichert den Eintrag als Datei (`.cpdevice`) in den Downloads-Ordner. |
| Rotes **×** (*Aus der Bibliothek entfernen*) | Fragt „… aus der Bibliothek entfernen?" und löscht die Vorlage nach *OK*. |

![Knöpfe beim Zeigen auf einen Eintrag](bilder/de/bibliothek-13-eintrag-hover.jpg)

![Eintrag als Favorit](bilder/de/bibliothek-15-eintrag-favorit.jpg)

![Eintrag ausgeblendet](bilder/de/bibliothek-16-eintrag-verstecken.jpg)

#### Suchen

Das Suchfeld über der Liste filtert in Echtzeit nach Name und Kategorie. Es trägt den Hinweis *Strg+F*: Solange der Unterreiter *Lokal* offen ist, setzt Strg+F den Cursor in dieses Feld. Mit dem **×** im Feld löschen Sie den Suchbegriff.

![Suche nach „Avantis"](bilder/de/bibliothek-28-suche-tippen.jpg)

Findet die Suche nichts, steht *Keine Geräte gefunden* mit *Suche zurücksetzen*.

![Suche ohne Treffer](bilder/de/bibliothek-29-suche-ohne-treffer.jpg)

#### Filtermenü

Das Trichter-Symbol öffnet das Filtermenü.

![Filtermenü](bilder/de/bibliothek-17-filter-menue.jpg)

| Eintrag | Wirkung |
|---|---|
| *Alle Kategorien einklappen* / *Alle Kategorien ausklappen* | Klappt alle Kategorien auf einmal zu oder auf. |
| *Sortierung* → *Manuell (Drag&Drop)* | Die Kategorien stehen in der Reihenfolge, in die Sie sie ziehen. |
| *Sortierung* → *Alphabetisch A → Z* / *Z → A* | Sortiert die Kategorien nach dem Namen. |
| *Versteckte zeigen (n)* | Zeigt die ausgeblendeten Einträge abgeblendet; die Zahl nennt, wie viele es sind. |
| *Leere Kategorien zeigen* | Zeigt auch Kategorien ohne Einträge. |
| *Nur eigenes Material* | Zeigt nur Geräte, die zum eigenen Lagerbestand passen (nach Modell). Der Eintrag ist ausgegraut, solange der Bestand nichts Passendes enthält. |

![Versteckte Einträge sichtbar](bilder/de/bibliothek-18-filter-versteckte-zeigen.jpg)

![Alle Kategorien eingeklappt](bilder/de/bibliothek-21-filter-alle-einklappen.jpg)

![Sortierung Z → A](bilder/de/bibliothek-22-filter-sortierung-z-a.jpg)

![Leere Kategorien angezeigt](bilder/de/bibliothek-57-filter-leere-kategorien-an.jpg)

#### Kategorien

Kategorien ordnen die Vorlagen. Beim Zeigen auf den Kategoriestreifen erscheint ein Stift.

1. Der Stift öffnet *Kategorie umbenennen*. Das Fenster hat zwei Felder, *Deutsch* und *Englisch*; beim Umschalten der Oberflächensprache erscheint der jeweilige Name. Ein leeres Feld ist erlaubt, dann fällt die Anzeige auf die andere Sprache zurück.

   ![Kategorie umbenennen](bilder/de/bibliothek-34-kategorie-umbenennen-dialog.jpg)

2. Mit dem Griff links vom Namen ziehen Sie eine Kategorie an eine andere Stelle (bei der Sortierung *Manuell*).

   ![Kategorie am Griff ziehen](bilder/de/bibliothek-35-kategorie-ziehen-griff.jpg)

3. Einträge lassen sich auf eine andere Kategorie ziehen; eine leere Kategorie sagt dazu *Gerät hierher ziehen zum Verschieben*.

   ![Eintrag in eine Kategorie ziehen](bilder/de/bibliothek-52-eintrag-in-kategorie-ziehen.jpg)

4. Neue Kategorien entstehen über das Menü **+** (siehe unten).

   ![Neue, leere Kategorie](bilder/de/bibliothek-55-kategorie-umbenannt.jpg)

#### Das Menü +

Der Knopf **+** neben dem Suchfeld (Tooltip: *Neues Gerät oder neue Kategorie anlegen*) öffnet ein Menü mit fünf Einträgen.

![Menü +](bilder/de/bibliothek-37-plus-menue.jpg)

| Eintrag | Wirkung |
|---|---|
| *Neues Gerät…* | Öffnet den Dialog [Eigenes Gerät anlegen](#eigenes-gerät-anlegen). |
| *Neue Kategorie…* | Zeigt in der Liste ein Feld *Kategoriename…*; *OK* legt die Kategorie an, **×** bricht ab. |
| *Datei importieren…* | Liest eine `.cpdevice`- oder `.cpgroup`-Datei (siehe unten). |
| *Vorlagen einreichen…* | Öffnet den Dialog [Vorlagen einreichen](#vorlagen-einreichen). |
| *Bibliotheks-Ordner öffnen…* | Öffnet den Ordner der Bibliothek im Dateimanager. |

1. *Neue Kategorie…* zeigt das Namensfeld über der Liste.

   ![Feld für den Kategorienamen](bilder/de/bibliothek-39-plus-neue-kategorie.jpg)

2. Nach *OK* steht die Kategorie in der Liste und lässt sich mit dem Stift zweisprachig benennen.

   ![Namen für beide Sprachen](bilder/de/bibliothek-54-kategorie-umbenennen-ausgefuellt.jpg)

##### Eigenes Gerät anlegen

*Neues Gerät…* öffnet den Dialog *Eigenes Gerät anlegen*. Er ist ein einziges durchlaufendes Formular ohne Reiter. Ein Rechtsklick auf freie Fläche des Plans (*Neues Gerät hier …*) und die Tastenkombination Strg/Cmd + Plus am Plan führen zum selben Formular beziehungsweise zu einem Namensdialog.

![Dialog Eigenes Gerät anlegen](bilder/de/bibliothek-geraet-01-dialog-offen.jpg)

| Feld | Bedeutung |
|---|---|
| *Name* | Name des Geräts. Während Sie tippen, listet das Formular passende Geräte der Bibliothek (*Name*, Kategorie, Zahl der Ein- und Ausgänge) mit *Als Vorlage nutzen*. |
| *Kategorie* | Auswahl aus den vorhandenen Kategorien; *+ Neue Kategorie…* legt eine weitere an. Voreinstellung ist *Sonstiges*. |
| *19" Rack-Gerät* → *Ist Rack-Gerät* | Markiert das Gerät als Rack-Gerät; dann erscheint das Feld *HE* für die Höhe. |
| *Ports aus Foto erkennen* | Erscheint, sobald ein KI-Anbieter hinterlegt ist; sonst steht dort der Hinweis, ihn unter *Einstellungen → Integrationen → AI* einzutragen, mit dem Knopf *Einstellungen öffnen*. |
| *Die Ports aus dem Geräte-Namen raten* | Die Knöpfe *Ausfüllen* (füllt die Port-Gruppen aus der in den Einstellungen gewählten Quelle) und *Datenblatt…* (liest die Port-Gruppen aus einer PDF-, HTML- oder Textdatei). Die Quelle steht daneben: *aus einer Web-Suche — ohne API-Schlüssel* oder *vom KI-Modell — braucht einen API-Schlüssel*. *API-Schlüssel hinterlegen (KI)* öffnet ein Feld für den Schlüssel; er wird nur lokal gespeichert. |
| *Port-Gruppen* | Die Anschlüsse in Gruppen. *+ Input-Gruppe* und *+ Output-Gruppe* fügen eine Zeile hinzu. |

Eine Port-Gruppe hat vier Angaben: die Richtung (*Input* oder *Output*), die Anzahl, den Steckertyp und den Namen (Beschriftungspräfix). Beim Speichern entstehen daraus einzelne Anschlüsse. Eine Gruppe ohne Anzahl erzeugt keine Anschlüsse; die Meldung *Noch keine Anschlüsse — das ist in Ordnung.* sagt, dass sich Anschlüsse auch später ergänzen lassen: Ein Kabel, das auf das Gerät gezogen wird, legt einen an.

1. Tippen Sie einen Namen. Passende Geräte der Bibliothek erscheinen unter dem Feld.

   ![Vorschläge beim Tippen des Namens](bilder/de/bibliothek-geraet-02-name-vorschlaege.jpg)

2. *Als Vorlage nutzen* übernimmt Kategorie und Port-Gruppen des Eintrags; der Name erhält den Zusatz *(Kopie)*. Das Formular sagt *Felder aus „…" übernommen. Passe an, was abweicht.*

   ![Felder aus einer Vorlage übernommen](bilder/de/bibliothek-geraet-03-vorlage-genommen.jpg)

3. Mit dem Haken bei *Ist Rack-Gerät* erscheint das Feld *HE*.

   ![Rack-Gerät mit Feld HE](bilder/de/bibliothek-geraet-04-rack-geraet.jpg)

4. *+ Output-Gruppe* fügt eine weitere Zeile hinzu; das rote **×** entfernt eine Gruppe.

   ![Zusätzliche Output-Gruppe](bilder/de/bibliothek-geraet-05-gruppe-ausgang.jpg)

Unten stehen vier Knöpfe:

| Knopf | Wirkung |
|---|---|
| *Abbrechen* | Schließt den Dialog ohne zu speichern. |
| *In Bibliothek speichern* | Legt die Vorlage in der lokalen Bibliothek ab (zur Wiederverwendung); das Gerät kommt nicht auf den Plan. |
| *Nur im Projekt platzieren* | Setzt das Gerät in dieses Projekt, ohne eine Vorlage anzulegen. Gedacht für Leihgeräte, Platzhalter und Einzelstücke; nichts wird hochgeladen. |
| *Speichern + Platzieren* | Beides. |

Mit Foto-Erkennung erscheint der Abschnitt *Ports aus Foto erkennen*: *Fotos wählen* oder *Foto aufnehmen* (Fotos der Anschlussseite lassen sich auch hineinziehen oder einfügen; sie werden zur Erkennung an den gewählten Anbieter gesendet), *Erkennen*, *Foto entfernen* und der Haken *Fotos beim Platzieren am Gerät speichern*. Die Vorschläge stehen als Tabelle (*Übernehmen*, *Richtung*, *Anzahl*, *Stecker*, *Beschriftung*, bei Bedarf *Gelesen als: …*); unsichere Zeilen sind abgewählt und mit *unsicher* gekennzeichnet. Erkennt die App das Modell, nennt sie das Katalog-Gerät mit Datenblatt-Anschlüssen und bietet *Katalog-Gerät platzieren* an. *N Port-Gruppe(n) ins Formular übernehmen* trägt die gewählten Zeilen in die Port-Gruppen ein.

#### Datei importieren

*Datei importieren…* liest ausschließlich `.cpdevice`- und `.cpgroup`-Dateien (das Format, in das *Exportieren* Einträge schreibt).

1. Nach der Dateiwahl meldet die App *Gerät importiert: „…" wurde der Library hinzugefügt.*

   ![Gerät importiert](bilder/de/bibliothek-42-plus-datei-importieren.jpg)

2. Existiert der Name schon, fragt sie *Ein Gerät mit dem Namen „…" existiert bereits. Überschreiben?* — *Abbrechen* oder *Überschreiben*.

   ![Rückfrage beim Überschreiben](bilder/de/bibliothek-43-import-gleicher-name.jpg)

3. Eine andere Datei lehnt die App ab: *Datei nicht erkannt: Diese Datei ist kein gültiger .cpdevice- oder .cpgroup-Export.*

   ![Datei nicht erkannt](bilder/de/bibliothek-44-import-unbekannte-datei.jpg)

Eine importierte Gruppe erscheint im Reiter *Gruppen* (siehe dort).

#### Vorlagen einreichen

*Vorlagen einreichen…* prüft die eigenen Vorlagen und sendet sie an die Gerätebibliothek oder speichert sie als Einreichungsdatei. Der Dialog nennt oben, wie viele der Vorlagen eingereicht werden können (*3 von 3 Vorlagen können eingereicht werden.*), und weist darauf hin, dass die Gerätebibliothek Hersteller und Modell getrennt führt: Die aus dem Vorlagennamen vorgeschlagene Trennung ist zu prüfen. Je Vorlage stehen ein Haken, die Felder für Hersteller und Modell, der Datenblatt-Link und Hinweise, zum Beispiel *Leistungsaufnahme nicht angegeben.*

Der **Datenblatt-Link ist Pflicht**: Eine Vorlage ohne Link lässt sich nicht einreichen. Zum Senden an die Gerätebibliothek müssen Sie angemeldet sein (*Anmelden…*); eine Einreichungsdatei lässt sich auch ohne Konto speichern. Die Knöpfe unten sind *Schließen*, *Einreichungsdatei speichern* und *N an die Gerätebibliothek senden*.

![Dialog Vorlagen einreichen](bilder/de/bibliothek-45-plus-vorlagen-einreichen.jpg)

#### Einträge ändern, platzieren, entfernen

1. Suchen Sie den Eintrag.

   ![Eintrag gefunden](bilder/de/bibliothek-46-eintrag-gefunden.jpg)

2. Der Knopf *Aus der Bibliothek entfernen* (rotes **×**) fragt nach.

   ![Rückfrage Eintrag entfernen](bilder/de/bibliothek-48-eintrag-entfernen-abfrage.jpg)

3. Ein Doppelklick auf einen Eintrag setzt das Gerät auf den Plan; ein Klick zeigt die Vorlage im Inspector.

   ![Eintrag per Klick markiert](bilder/de/bibliothek-50-eintrag-klick-platziert.jpg)

4. Ziehen Sie einen Eintrag auf den Plan, um ihn an der Ablageposition zu platzieren.

   ![Eintrag auf den Canvas gezogen](bilder/de/bibliothek-51-eintrag-auf-canvas-ziehen.jpg)

#### Geteilt

Der Unterreiter *Geteilt* zeigt die gemeinsame Gerätebibliothek (devices.zumpelars.de), schreibgeschützt. Zum Holen oder Aktualisieren der Geräte ist eine Anmeldung nötig (*Anmelden…*); bereits geholte Geräte bleiben nutzbar. *Aktualisieren* holt den aktuellen Stand. Die Zeile *N Geräte lokal gespeichert* nennt, wie viele Geräte auf diesem Rechner liegen; sie stehen nach Kategorie geordnet. Jeder Eintrag trägt den Namen, den Status (*verifiziert*, *bestätigt*, *unbestätigt* oder *umstritten*), die Zahl der Bestätigungen und den Link *Seite* zur Detailseite. Den Status setzt die Gerätebibliothek, nicht der Planer.

![Geteilte Gerätebibliothek](bilder/de/bibliothek-58-geteilt-uebersicht.jpg)

![Suche in der geteilten Bibliothek](bilder/de/bibliothek-59-geteilt-suche.jpg)

*Anmelden…* öffnet *Einstellungen → Gerätebibliothek* mit dem Server und dem Konto.

![Einstellungen Gerätebibliothek](bilder/de/bibliothek-61-geteilt-anmelden.jpg)

#### Rentman in der Bibliothek

Der Unterreiter *Rentman* gehört zum Rentman-Modul. Ohne verknüpftes Projekt steht dort *Kein Rentman-Projekt verknüpft.* mit dem Knopf *Rentman-Projekt verknüpfen…*; darunter wählen die Ansichten *Importiert*, *Katalog* und *Abgleich*.

![Rentman ohne verknüpftes Projekt](bilder/de/bibliothek-95-rentman-nicht-verknuepft.jpg)

1. *Rentman-Projekt verknüpfen…* öffnet *Aus Rentman importieren*, wo die Projekte geladen und eines ausgewählt wird.

   ![Dialog Rentman-Projekt verknüpfen](bilder/de/bibliothek-96-rentman-projekt-verknuepfen-dialog.jpg)

2. Mit verknüpftem Projekt zeigt der Reiter oben *Aktuell verknüpftes Rentman-Projekt* mit den Zählern *n importiert*, *n ohne Rentman-ID* und *n entfernt*, dazu die Knöpfe *Aus Rentman aktualisieren / neue Items importieren* und, falls nötig, *N fehlende Library-Einträge nachbauen* (rekonstruiert die Vorlagen aus den Daten des Plans).

   ![Verknüpftes Projekt mit importierten Geräten](bilder/de/bibliothek-100-rentman-verknuepft-importiert.jpg)

3. Die Ansicht *Importiert* listet die importierten Geräte nach Projekt (das aktive trägt *AKTIV*) und Kategorie. Mit *Alle einklappen* / *Alle ausklappen* und dem Suchfeld *In Rentman-Geräten suchen…* behalten Sie den Überblick.

   ![Suche in den importierten Geräten](bilder/de/bibliothek-105-rentman-suche.jpg)

4. Die Ansicht *Katalog* zeigt nach *Katalog laden* alle in Ihrem Rentman-Account angelegten Equipments, gegliedert nach den Rentman-Ordnern, mit der Rentman-ID. *+ Projekt* fragt *„…" zu Rentman hinzufügen?* und weist darauf hin, dass dies das Rentman-Projekt ändert und nicht automatisch rückgängig zu machen ist.

   ![Katalog geladen](bilder/de/bibliothek-110-rentman-katalog-geladen.jpg)

   ![Rückfrage Zu Rentman hinzufügen](bilder/de/bibliothek-113-rentman-katalog-zum-projekt.jpg)

5. Die Ansicht *Abgleich* (*Abgleich Canvas ↔ Rentman*) nennt, wie viele Geräte des Plans nicht erfasst sind: zuerst die *Nicht mehr in Rentman vorhanden* (*entfernt*), dann die Geräte ohne Rentman-ID (*kein Rentman-ID*).

   ![Abgleich Canvas und Rentman](bilder/de/bibliothek-114-rentman-abgleich.jpg)

Ein Rentman-Gerät, zu dem es ein gleichnamiges lokales Gerät gibt, lässt sich mit dessen Anschlüssen verknüpfen (Knopf *Verknüpfen* am Eintrag).

### Kabel

Der Reiter *Kabel* (*Kabel-Library*) listet die Kabeltypen, gruppiert nach Steckertyp (zum Beispiel *Audio / XLR*, *SDI*, *Ethernet*, *Fiber*). Hinter jeder Gruppe steht die Zahl der Typen. Oben nennt die Zeile *N verbaut*, wie viele Kabel im Plan liegen, wie viele eigene Kabeltypen es gibt und welche SDI-Empfehlung gilt.

![Kabel-Library](bilder/de/bibliothek-62-kabel-uebersicht.jpg)

1. Ein Klick auf eine Gruppe klappt sie auf. Jeder Typ zeigt Farbe, Namen, Stecker mit Höchstlänge und Signal-Standards.

   ![Aufgeklappte Kabelgruppe](bilder/de/bibliothek-63-kabel-gruppe-aufklappen.jpg)

2. Eigene Typen tragen das Zeichen *Eigen*, angepasste eingebaute Typen das Zeichen *Angepasst*.

   ![Eigener Kabeltyp in der Liste](bilder/de/bibliothek-69-kabel-eigener-typ.jpg)

3. Der Stift öffnet *Kabeltyp bearbeiten*. Das Formular hat die Felder *Name*, *Stecker-Typ* (mit **+** für einen neuen Steckertyp), *Kabel-Farbe*, *Auch kompatibel mit (optional)*, *Signal-Standards* (mit *+ Standard* für einen neuen Standard), *Max. Länge (m) – optional* und *Notiz (optional)*. *Speichern* ist erst möglich, wenn ein Name und mindestens ein Standard gesetzt sind. Bei einem eingebauten Typ wird die Änderung als lokale Anpassung gespeichert (*Angepasst*); der Knopf mit dem Pfeil (*Override entfernen*) fragt *Override für „…" zurücksetzen?* und stellt mit *Zurücksetzen* die ursprünglichen Werte wieder her.

   ![Dialog Kabeltyp bearbeiten](bilder/de/bibliothek-64-kabel-eintrag-bearbeiten.jpg)

4. Das rote **×** an einem eigenen Typ fragt *Kabeltyp „…" löschen?* — bereits verlegte Kabel sind nicht betroffen (verweist ein Kabel auf den Typ, behält es Stecker und Standard, verliert aber die Verknüpfung zur Vorlage).

   ![Eigenen Kabeltyp löschen](bilder/de/bibliothek-70-kabel-eigener-typ-loeschen.jpg)

5. Die Gruppen lassen sich am Griff vor dem Namen verschieben.

   ![Kabelgruppe verschieben](bilder/de/bibliothek-71-kabel-gruppe-verschieben.jpg)

Neue eigene Kabeltypen legen Sie unter *Einstellungen → Kabeltypen* an.

### Gruppen

Der Reiter *Gruppen* (*Gerätegruppen: Mehrere Geräte + Kabel als Vorlage*) zeigt gespeicherte Gerätegruppen. Eine Karte nennt Namen, Zahl der Geräte und Kabel, die Höhe in HE und die Gerätenamen. Eine Gruppe entsteht auf dem Canvas: mehrere Geräte markieren und den Knopf *N markierte Geräte als Gruppe speichern* in der Werkzeugleiste klicken (siehe [Gerätegruppe speichern](#gerätegruppe-speichern)).

![Gespeicherte Gruppen](bilder/de/bibliothek-74-gruppen-uebersicht.jpg)

1. Beim Zeigen auf eine Karte erscheinen *Umbenennen* (Stift), *Exportieren* (Pfeil nach unten) und *Gruppe aus Library entfernen* (rotes **×**).

   ![Karte mit Knöpfen](bilder/de/bibliothek-75-gruppe-karte-hover.jpg)

2. Ein Klick auf die Karte platziert die Gruppe auf dem Canvas; beim Ziehen landet sie an der Ablageposition.

   ![Gruppe auf den Canvas gesetzt](bilder/de/bibliothek-76-gruppe-klick-platzieren.jpg)

3. *Umbenennen* fragt *Neuer Name der Vorlage:*. Existiert der Name schon, bittet die App um einen anderen.

   ![Gruppe umbenennen](bilder/de/bibliothek-79-gruppe-umbenennen-eingetippt.jpg)

4. *Exportieren* speichert die Gruppe als `.cpgroup`-Datei in den Downloads-Ordner; *Datei importieren…* im Menü **+** des Reiters *Geräte* liest sie wieder ein. Ist der Name schon vergeben, fragt die App nach dem Überschreiben.

5. Das rote **×** fragt *Gruppe „…" löschen?*.

   ![Gruppe löschen](bilder/de/bibliothek-81-gruppe-loeschen-abfrage.jpg)

6. Die Karten lassen sich am Griff vor dem Namen umsortieren.

   ![Reihenfolge der Gruppen](bilder/de/bibliothek-83-gruppe-reihenfolge-losgelassen.jpg)

Ohne Gruppen steht dort *Noch keine Gruppen gespeichert.*

![Keine Gruppen](bilder/de/bibliothek-94-gruppen-leer.jpg)

### Racks

Der Reiter *Racks* (*2D Rack Builder: Rack-Slots in HE, als platzierbare Gruppe gespeichert*) zeigt gespeicherte Rack-Layouts als Karten mit Zahl der Geräte, HE und Kabel sowie den Gerätenamen. Oben stehen die Knöpfe *Fürs Lager* und *+ Neues Rack*.

![Racks](bilder/de/bibliothek-86-racks-uebersicht.jpg)

1. Ein Klick auf die Karte platziert das Rack als Black-Box auf dem Canvas; beim Ziehen landet es an der Ablageposition. Beim Zeigen erscheinen *Bearbeiten* (Stift, öffnet den Rack-Builder), *Exportieren* und das rote **×** (*Rack aus Library entfernen*, fragt *Rack „…" löschen?*).

   ![Rack-Karte mit Knöpfen](bilder/de/bibliothek-87-racks-karte-hover.jpg)

2. *Fürs Lager* sichert, was in jedem Rack sitzt, als Datei für den Inventory Planner, der es gegen das Rack-Case prüft. Die App meldet danach, wie viele Racks übergeben wurden und wie viele Geräte außerhalb ihres Racks sitzen und weggelassen wurden. Ohne Racks steht *Noch kein Rack-Layout zum Übergeben.*

   ![Fürs Lager ohne Racks](bilder/de/bibliothek-93-racks-fuers-lager-leer.jpg)

3. Ohne gespeicherte Racks steht *Noch kein Rack-Layout gespeichert.*

   ![Keine Racks](bilder/de/bibliothek-92-racks-leer.jpg)

#### Rack Builder

*+ Neues Rack* öffnet den 2D-Rack-Builder mit einem leeren Rack; der Stift an einer Karte öffnet ihn mit diesem Rack. Der Builder hat links die Bibliothek der Geräte (*Patchblende*, *Rack-Shelf*, Suche, *Auch Nicht-Rack-Geräte*), in der Mitte das Rack-Layout (*2D* oder *3D*; *Vorne*, *Hinten*, *Beide*, *Seite*) und rechts die Live-Vorschau als Black-Box auf dem Canvas. Oben stehen *Rack-Name*, *Höhe (HE)* und *Tiefe (mm)*, unten *Intern verkabeln*, *Abbrechen* und *Rack speichern*. Geräte kommen mit *+ Ins Rack* oder per Ziehen in einen Slot; *Konflikte* nennt, was nicht passt. Das gespeicherte Rack ist eine platzierbare Gruppe.

![Rack-Builder mit neuem Rack](bilder/de/bibliothek-88-racks-neues-rack.jpg)

![Rack-Builder mit gespeichertem Rack](bilder/de/bibliothek-89-racks-bearbeiten.jpg)
