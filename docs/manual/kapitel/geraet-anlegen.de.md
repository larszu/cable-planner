## Gerät anlegen

Ein Gerät, das die Bibliothek nicht kennt, legen Sie selbst an: von Hand, mit Hilfe eines Fotos der Anschlussseite oder über den Rentman-Import. Dieses Kapitel zeigt, welcher Weg wann passt und wo das neue Gerät danach steht. Die einzelnen Felder des Dialogs *Eigenes Gerät anlegen* beschreibt das Kapitel [Bibliothek](#4-bibliothek); die Anschlüsse eines platzierten Geräts bearbeiten Sie im [Inspector](#6-inspector).

| Weg | Wann | Ergebnis |
|---|---|---|
| Von Hand | Sie kennen die Anschlüsse oder brauchen zunächst nur einen Platzhalter. | Gerät in der Bibliothek, im Projekt oder beides |
| Mit Foto | Sie haben ein Foto der Anschlussseite und einen KI-Anbieter eingerichtet. | Vorschlag für die Port-Gruppen, den Sie prüfen |
| Mit Rentman | Das Gerät steht in einem Rentman-Projekt. | Vorlagen in der Bibliothek, mit Rentman-ID |

### Von Hand

Der Dialog *Eigenes Gerät anlegen* öffnet sich auf drei Wegen:

- im Menü **+** der Bibliothek mit *Neues Gerät…*,
- mit einem Rechtsklick auf freie Fläche des Plans und *Neues Gerät hier …* (das Gerät landet an der Klickstelle),
- mit **Strg/Cmd + Plus** über dem Plan. Dieser Weg fragt nur den Namen; das Gerät erhält die Kategorie *Other* und keine Anschlüsse.

1. Tippen Sie den Namen. Passende Geräte der Bibliothek erscheinen darunter mit *Als Vorlage nutzen*; so übernehmen Sie Kategorie und Port-Gruppen eines ähnlichen Geräts und ändern nur, was abweicht.

   ![Vorschläge beim Tippen](bilder/de/geraet-anlegen-04-a-name-treffer.jpg)

2. Wählen Sie unten, wo das Gerät landen soll:

   | Knopf | Bibliothek | Plan |
   |---|---|---|
   | *In Bibliothek speichern* | ja | nein |
   | *Nur im Projekt platzieren* | nein | ja |
   | *Speichern + Platzieren* | ja | ja |

   *Nur im Projekt platzieren* eignet sich für Leihgeräte, Platzhalter und Einzelstücke: Es entsteht keine Vorlage, die später in der Bibliothek stehen bleibt.

   ![Formular für ein Leihgerät](bilder/de/geraet-anlegen-22-a-nur-projekt-vorbereitet.jpg)

   ![Das Gerät steht auf dem Plan, nicht in der Bibliothek](bilder/de/geraet-anlegen-23-a-nur-projekt-platziert.jpg)

3. Mit *In Bibliothek speichern* steht die Vorlage in der Bibliothek, der Plan bleibt unverändert. Die Suche der Bibliothek findet sie sofort.

   ![Gerät nur in der Bibliothek](bilder/de/geraet-anlegen-26-a-nur-bibliothek-suche.jpg)

4. Ein Gerät ohne Port-Gruppen ist erlaubt. Die Bibliothek zeigt es mit *0 in / 0 out*, und der Dialog sagt, dass sich Anschlüsse auch später ergänzen lassen.

   ![Gerät ohne Anschlüsse in der Bibliothek](bilder/de/geraet-anlegen-28-a-portlos-platziert.jpg)

#### Anschlüsse später ergänzen

Ein Gerät, das nur mit Namen angelegt wurde, bekommt seine Anschlüsse im Inspector.

1. Platzieren Sie das Gerät und wählen Sie es aus. Im Abschnitt *Inputs & Outputs* steht *0 In · 0 Out*, dazu *Keine* unter *Inputs* und *Outputs*.

   ![Inspector eines Geräts ohne Anschlüsse](bilder/de/geraet-anlegen-30-a-nur-name-inspektor.jpg)

2. *+ Hinzufügen* legt einen Anschluss an. Tragen Sie den Namen ein, wählen Sie den Stecker und tragen Sie bei Bedarf die Funktion ein.

   ![Neuer Anschluss mit Namen](bilder/de/geraet-anlegen-31-a-port-plus.jpg)

   ![Anschluss mit Stecker, Funktion und Geschlecht](bilder/de/geraet-anlegen-37-a-port-ausgefuellt.jpg)

3. Weitere Anschlüsse kommen mit *+ Hinzufügen* dazu; das rote **×** nimmt einen weg. Ein Kabel, das auf das Gerät gezogen wird, legt ebenfalls einen Anschluss an.

### Mit Foto

Der Weg braucht einen KI-Anbieter mit Schlüssel. Das Foto zeigt die Anschlussseite; die App sendet es zur Erkennung an den gewählten Anbieter. Die Vorschläge sind Vermutungen und werden nie ohne Ihre Bestätigung übernommen.

1. Richten Sie den Anbieter unter *Einstellungen → Integrationen* ein. Dort wählen Sie auch, woher der Knopf *Ausfüllen* seine Vorschläge nimmt: aus einer *Web-Suche* (ohne Schlüssel) oder aus dem *KI-Modell* (mit Schlüssel).

   ![Quelle zum Ausfüllen: Web-Suche oder KI-Modell](bilder/de/geraet-anlegen-72-b-quelle-ki.jpg)

   ![Anbieter wählen und Schlüssel hinterlegen](bilder/de/geraet-anlegen-74-b-anbieter-claude.jpg)

   Ohne Schlüssel zeigt der Dialog statt der Fotofunktion den Hinweis, den Anbieter einzutragen, mit dem Knopf *Einstellungen öffnen*. Der Schlüssel lässt sich auch im Dialog selbst hinterlegen; er wird nur lokal gespeichert.

   ![Schlüssel im Dialog eintragen](bilder/de/geraet-anlegen-76-b-schluessel-eingetippt.jpg)

2. Öffnen Sie *Eigenes Gerät anlegen*. Der Abschnitt *Ports aus Foto erkennen* nimmt Fotos mit *Fotos wählen*, per Ziehen oder per Einfügen auf.

   ![Abschnitt Ports aus Foto erkennen](bilder/de/geraet-anlegen-79-b-foto-feld.jpg)

3. Mit einem Foto erscheinen *Erkennen*, die Vorschau und der Haken *Fotos beim Platzieren am Gerät speichern*. Mehrere Fotos desselben Geräts sind möglich; der **×** an der Vorschau entfernt eines.

   ![Foto gewählt](bilder/de/geraet-anlegen-80-b-foto-gewaehlt.jpg)

4. *Erkennen* sendet die Fotos. Während der Anfrage steht *Erkenne…*.

   ![Erkennung läuft](bilder/de/geraet-anlegen-86-b-erkennen-laeuft.jpg)

5. Das Ergebnis ist eine Tabelle: *Gerät:* nennt das erkannte Modell. Gibt es dazu im Katalog ein Gerät mit Datenblatt-Ports, bietet *Katalog-Gerät platzieren* es an. Jede Zeile hat einen Haken, Richtung (*Input*, *Output*, *Beide Richtungen*), Anzahl, Stecker und Beschriftung. Unsichere Zeilen sind abgewählt und mit *unsicher* markiert.

   ![Vorschläge prüfen](bilder/de/geraet-anlegen-87-b-vorschlag.jpg)

6. Haken Sie unsichere Zeilen an oder ab und ändern Sie, was nicht stimmt. *n Port-Gruppe(n) ins Formular übernehmen* trägt die gewählten Zeilen als Port-Gruppen ein.

   ![Zeilen gewählt, bereit zur Übernahme](bilder/de/geraet-anlegen-90-b-zeile-abgewaehlt.jpg)

   ![Port-Gruppen im Formular](bilder/de/geraet-anlegen-92-b-uebernehmen.jpg)

7. Speichern Sie wie gewohnt. Mit dem Haken *Fotos beim Platzieren am Gerät speichern* hängen die Fotos danach unter *Fotos* am Gerät.

   ![Gerät mit den Fotos im Inspector](bilder/de/geraet-anlegen-94-b-inspektor-fotos.jpg)

Zeigt das Foto nichts Lesbares, meldet die App *Nichts erkannt* und rät zu einem schärferen Foto von vorn mit lesbarer Beschriftung. Lehnt der Anbieter die Anfrage ab (zum Beispiel wegen eines ungültigen Schlüssels), steht seine Fehlermeldung unter dem Abschnitt.

![Fehlermeldung des Anbieters](bilder/de/geraet-anlegen-101-b-fehler-anbieter.jpg)

Für ein bereits platziertes Gerät ohne Anschlüsse bietet der Inspector dasselbe als *AI-Port-Vorschlag* mit dem Knopf *Ports vorschlagen*. Die Vorschläge erscheinen als Liste; *Übernehmen* trägt sie ein, *Verwerfen* lässt das Gerät unverändert.

![Vorschlag im Inspector](bilder/de/geraet-anlegen-98-b-inspektor-vorschlag.jpg)

![Vorschlag übernommen](bilder/de/geraet-anlegen-99-b-inspektor-uebernommen.jpg)

Die Beispiele in diesen Bildern verwenden erfundene Antworten und ein Beispielbild, keinen echten Schlüssel.

### Mit Rentman

Steht das Gerät in einem Rentman-Projekt, legen Sie es nicht selbst an, sondern importieren es. Der Ablauf beginnt mit dem Rentman-Token unter *Einstellungen → Integrationen*, danach folgen *Datei → Rentman-Import…*, die Auswahl der Geräte, die *Kategorie-Zuordnung vor Import* und gegebenenfalls ein Konfliktdialog für Geräte, die schon unter diesem Namen existieren. Die Schritte mit allen Bildern stehen im Kapitel [Datei und Import](#rentman-import); die Ansichten des Reiters *Rentman* in der Bibliothek beschreibt [Rentman in der Bibliothek](#rentman-in-der-bibliothek).

![Rentman-Import mit gewähltem Projekt](bilder/de/geraet-anlegen-113-c-projekt-gewaehlt.jpg)

Beim Konflikt entscheiden Sie je Gerät, ob die lokale Version bleibt, das Gerät mit einem anderen lokalen Gerät verknüpft, durch die Rentman-Version überschrieben, in seinen Anschlüssen mit ihr zusammengeführt oder übersprungen wird. Das Zusammenführen öffnet den Dialog [Geräte zusammenführen](#geräte-zusammenführen).

### Aus der Bibliothek weiterverarbeiten

Ein vorhandenes Gerät dient als Ausgangspunkt für ein neues.

1. Ziehen Sie den Bibliothekseintrag auf den Plan oder klicken Sie ihn an. Er erscheint als Gerät mit allen Anschlüssen der Vorlage.

   ![Gerät aus der Bibliothek auf dem Plan](bilder/de/geraet-anlegen-59-d-ziehen.jpg)

2. *Bearbeiten → Duplizieren* (**Strg/Cmd + D**) kopiert das markierte Gerät samt Anschlüssen.

   ![Menü Bearbeiten](bilder/de/geraet-anlegen-62-d-bearbeiten-menue.jpg)

   ![Das Duplikat neben dem Original](bilder/de/geraet-anlegen-63-d-duplizieren.jpg)

3. Im Inspector tauscht der Abschnitt *Gerät ersetzen* ein platziertes Gerät gegen einen Eintrag der Bibliothek. *Anderes Gerät wählen…* öffnet eine Suche; die Rückfrage nennt, wie viele Anschlüsse gemappt werden und wie viele Kabel ihren Port verlieren und gelöscht würden.

   ![Suche im Abschnitt Gerät ersetzen](bilder/de/geraet-anlegen-66-d-ersetzen-suche.jpg)

   ![Rückfrage vor dem Ersetzen](bilder/de/geraet-anlegen-67-d-ersetzen-bestaetigen.jpg)

   ![Das Gerät nach dem Ersetzen](bilder/de/geraet-anlegen-68-d-ersetzen-ergebnis.jpg)
