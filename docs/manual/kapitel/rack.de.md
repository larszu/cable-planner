## Rack

Ein Rack fasst Geräte in 19-Zoll-Höheneinheiten (HE) zusammen und verhält sich im Plan wie ein einzelnes Gerät. Dieses Kapitel führt den Weg eines Racks entlang: anlegen, speichern, platzieren, nachträglich bearbeiten, für das Lager übergeben und löschen. Die Einzelheiten des Rack-Builders (Patchblende, Shelf, 3D, STL, Konflikte, Export) stehen im Kapitel [Werkzeuge: Bauen](#11-werkzeuge-bauen), die Karten des Reiters *Racks* im Kapitel [Bibliothek](#4-bibliothek).

| Schritt | Wo | Beschrieben in |
|---|---|---|
| Anlegen | *Werkzeuge → Neues Rack erstellen…*, *+ Neues Rack* im Reiter *Racks*, oder markierte Geräte im Rack-Builder anordnen | [Werkzeuge: Bauen](#11-werkzeuge-bauen), [Canvas](#3-canvas) |
| Speichern | *Rack speichern* im Rack-Builder legt eine Karte im Reiter *Racks* ab | [Werkzeuge: Bauen](#11-werkzeuge-bauen) |
| Platzieren | Klick auf die Karte | dieses Kapitel |
| Bearbeiten | *Rack-Editor öffnen* am platzierten Rack, Stift an der Karte | dieses Kapitel |
| Fürs Lager | *Fürs Lager* im Reiter *Racks* | dieses Kapitel |

### Gespeicherte Racks

Der Reiter *Racks* der Bibliothek (Überschrift *2D Rack Builder*) zeigt jedes gespeicherte Rack als Karte mit der Zahl der Geräte, der HE und der Kabel sowie den Gerätenamen. Ohne gespeicherte Racks steht *Noch kein Rack-Layout gespeichert.*

![Der Reiter Racks mit einer Karte](bilder/de/rack-01-racks-reiter.jpg)

Beim Zeigen auf die Karte erscheinen drei Knöpfe: der Stift (*Im 2D-Rack-Builder bearbeiten*), *Exportieren* (eine Kopie als Datei in den Downloads-Ordner) und das rote **×** (*Rack aus Library entfernen*).

![Die Karte mit ihren Knöpfen](bilder/de/rack-02-karte-hover.jpg)

### Ein Rack auf dem Plan platzieren

1. Öffnen Sie den Reiter *Racks* und klicken Sie die Karte an. Das Rack steht als ein Gerät auf dem Plan, mit dem Zusatz *(Rack)* im Namen.

   ![Das platzierte Rack](bilder/de/rack-06-karte-platziert.jpg)

   Auf dem Plan zeigt das Rack jedes enthaltene Gerät in seiner HE-Reihenfolge samt Anschlüssen. Die gestrichelten Linien im Rack sind die internen Kabel, die beim Speichern mitgenommen wurden. Von außen verbinden Sie die Anschlüsse der enthaltenen Geräte wie die jedes anderen Geräts.

2. Ein Rechtsklick auf die Kopfzeile des Racks öffnet das Kontextmenü. *Rack-Editor öffnen* gibt es nur bei einem Rack; die übrigen Einträge sind die eines Geräts (*Anmerkung hinzufügen…*, *Geräte-Datenblatt…*, *Position sperren*, *Gerät löschen*).

   ![Kontextmenü eines Racks](bilder/de/rack-07-blackbox-kontextmenue.jpg)

### Ein platziertes Rack bearbeiten

*Rack-Editor öffnen* öffnet den Rack-Builder für dieses Rack. Die Kopfzeile nennt den Namen und die Marke *Bearbeiten*. Sie ordnen Geräte neu an, ergänzen oder entfernen welche und ändern *Höhe (HE)* und *Tiefe (mm)*. Rechts zeigt die *Live-Preview*, wie das Rack auf dem Plan aussieht; die Fußzeile zählt Geräte, belegte HE und interne Kabel. *Speichern* übernimmt die Änderung, *Abbrechen* verwirft sie.

![Der Rack-Builder für das platzierte Rack](bilder/de/rack-08-rack-editor-offen.jpg)

### Fürs Lager

*Fürs Lager* im Reiter *Racks* übergibt, was in jedem gespeicherten Rack sitzt, als Datei an den Inventory Planner, der es gegen das Rack-Case prüft. Danach nennt die App, wie viele Racks übergeben wurden (*1 Racks übergeben.*) und, falls es solche gibt, wie viele Geräte außerhalb ihres Racks sitzen und deshalb weggelassen wurden. Ohne gespeicherte Racks steht *Noch kein Rack-Layout zum Übergeben.*

![Meldung nach Fürs Lager](bilder/de/rack-05-lager-meldung.jpg)

### Ein Rack löschen

Das rote **×** an der Karte fragt *Rack „…" löschen?* mit *Abbrechen* und *Löschen*. Das Löschen entfernt die Karte aus der Bibliothek.

![Rückfrage vor dem Löschen](bilder/de/rack-04-karte-loeschen-frage.jpg)
