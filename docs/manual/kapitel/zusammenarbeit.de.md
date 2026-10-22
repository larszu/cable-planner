## Zusammenarbeit

Mehrere Personen können an einem Plan arbeiten. Die App kennt dafür zwei Wege: die **Live-Kollaboration**, bei der alle denselben Plan gleichzeitig bearbeiten, und das **Sync-Verzeichnis**, über das ein Plan abwechselnd weitergegeben wird. Dieses Kapitel beschreibt, wie Sie beide benutzen. Alle Felder der Einstellungen beschreibt das Kapitel [Einstellungen](#13-einstellungen) im Reiter *Netzwerk-Sync*.

| Weg | Wann | Gleichzeitig arbeiten |
|---|---|---|
| Live-Kollaboration | Alle sind gerade am Plan: im selben Fenster-Verbund, im selben Netz oder über das Internet. | ja |
| Sync-Verzeichnis | Der Plan wandert über einen Netzwerkordner von Person zu Person. | nein, jeweils eine Person |

### Live-Kollaboration

Die Änderungen aller Teilnehmer werden ohne Server zusammengeführt, auch nach einer kurzen Trennung. Die Funktion trägt die Kennzeichnung *Beta*. Sie steht unter *Einstellungen → Netzwerk-Sync*.

#### Eine Session starten

1. Öffnen Sie *Einstellungen → Netzwerk-Sync*. Der Kasten *Live-Kollaboration (Beta)* zeigt oben rechts den Zustand *Aus*.
2. Tragen Sie unter *Dein Anzeigename* ein, wie die anderen Sie sehen, und unter *Raumname* einen Namen für die Session, zum Beispiel `show-2026`. Der Raumname ist Pflicht: Ohne ihn bleibt *Session starten* gesperrt.

   ![Name und Raum eingetragen](bilder/de/zusammenarbeit-02-name-und-raum.jpg)

3. Wählen Sie bei *Modus*, wo die anderen sitzen:

   - *Dieses Gerät (mehrere Fenster)*: nur Fenster auf diesem Rechner.
   - *Netzwerk (LAN/WAN, P2P)*: andere Rechner, im selben Netz oder über das Internet. Dieser Modus zeigt zusätzlich *Signaling-Server*, *Nur lokal*, *Raum-Passwort (optional)* und *STUN-/TURN-Server (optional)*; die Felder erklärt das Kapitel [Einstellungen](#13-einstellungen).

   ![Modus Netzwerk](bilder/de/zusammenarbeit-04-modus-netzwerk.jpg)

   Im Modus *Netzwerk* ohne *Raum-Passwort* warnt die App rot: Der Raum ist dann unverschlüsselt, und jeder, der Raumnamen und Signaling-Server kennt oder die Session im LAN findet, kann das ganze Projekt lesen. Setzen Sie ein Passwort und geben Sie es nur an Ihr Team.

4. *Session starten* eröffnet die Session. Der Kasten zeigt *Verbunden — Änderungen werden live geteilt*, darunter die Teilnehmer als farbige Kreise mit Initialen. Solange Sie allein sind, steht dort *Nur du im Raum* und der Hinweis, dass andere mit demselben Raumnamen beitreten.

   ![Laufende Session](bilder/de/zusammenarbeit-06-sitzung-laeuft.jpg)

Während die Session läuft, sind *Modus* und *Raumname* gesperrt.

#### Der Zustand in der Statusleiste

Solange eine Session läuft, steht in der Statusleiste unten das grüne Zeichen *Live · n*; *n* ist die Zahl der Teilnehmer. Ein Klick darauf öffnet *Einstellungen → Netzwerk-Sync* mit Teilnehmern und Einladung.

![Statusleiste mit dem Zeichen Live](bilder/de/zusammenarbeit-08-statusleiste-live.jpg)

![Klick auf Live öffnet den Reiter](bilder/de/zusammenarbeit-09-statusleiste-klick.jpg)

#### Beitreten

Es gibt zwei Wege, einer laufenden Session beizutreten. In beiden Fällen **ersetzt Beitreten Ihren aktuellen Plan durch den des Gastgebers**; steht schon ein Plan im Fenster, fragt die App vorher nach (*Beitreten und ersetzen*).

- **Im Netzwerk suchen** (nur Desktop-App): Der Kasten *Sessions im Netzwerk* hat den Knopf *Im Netzwerk suchen*. Er durchsucht das lokale Netz nach laufenden Sessions. Jede gefundene steht mit Projektname, Gastgeber und Raum in der Liste und hat einen Knopf *Beitreten*. Ohne Treffer steht dort *Noch keine offene Session gefunden.*

  ![Suche im Netz ohne Treffer](bilder/de/zusammenarbeit-03-suche-im-netz.jpg)

- **Einladungslink**: Der Gastgeber klickt in der laufenden Session auf *Einladung kopieren*; das Feld meldet kurz *Kopiert*. In der Zwischenablage liegen die Zeile *Live-Session im LZ Cable Planner beitreten:* und ein Link. Raum, Modus, Signaling-Server und Passwort stecken kodiert im Linkteil nach `#join=`, der nicht an einen Server gesendet wird. Ein gesetztes Raum-Passwort steht ebenfalls im Link; geben Sie ihn nur an Ihr Team weiter. Wer den Link öffnet, sieht *Zur Live-Session „Raum · Gastgeber" beitreten? Dein aktueller Plan wird durch den des Hosts ersetzt.* und tritt mit *Beitreten* bei. STUN-/TURN-Zugangsdaten stehen nicht im Link.

  ![Einladung kopiert](bilder/de/zusammenarbeit-07-einladung-kopiert.jpg)

#### Die Session verlassen

*Verlassen* (roter Knopf im Kasten) beendet Ihre Teilnahme. Der Zustand springt auf *Aus*, die Felder werden wieder frei, das Zeichen *Live* verschwindet aus der Statusleiste.

![Nach dem Verlassen](bilder/de/zusammenarbeit-10-verlassen.jpg)

### Sync-Verzeichnis

Ein gemeinsames Verzeichnis (verbundenes FTP-Laufwerk, Netzwerkpfad oder lokaler Ordner) trägt Projekt, Bibliothek und Presets als JSON-Dateien. Dieser Weg braucht die Desktop-App und kennt kein gleichzeitiges Arbeiten: Wer schreibt, sperrt das Verzeichnis.

1. Tragen Sie in *Einstellungen → Netzwerk-Sync* das *Sync-Verzeichnis* und Ihren *Benutzernamen (für Lock-Anzeige)* ein und speichern Sie.
2. In der Kopfleiste erscheinen *Push* und *Pull*.

   ![Push und Pull in der Kopfleiste](bilder/de/zusammenarbeit-12-push-pull-kopfleiste.jpg)

3. *Push* schreibt Ihren Stand ins Verzeichnis: `cable-planner.project.json`, `cable-planner.library.json` und `cable-planner.presets.json`. *Pull* lädt diese Dateien in Ihren aktuellen Stand. Die Meldung nennt, was geladen wurde (Projekt, Bibliothek, Presets), oder dass keine Sync-Dateien im Verzeichnis liegen.
4. Eine Sperrdatei verhindert, dass zwei Personen gleichzeitig schreiben. Ist das Verzeichnis gesperrt, nennt die Meldung *Verzeichnis ist gesperrt von: Name*. Die Sperre verfällt nach zwei Stunden.

*Bibliothek jetzt synchronisieren* gleicht außerdem Gerätevorlagen, Gruppen und Kategorien mit `cable-planner.library.json` im Verzeichnis ab, nach Namen; lokale Vorlagen werden dabei nie überschrieben.

### Weitere Wege, einen Plan zu teilen

- Der Plan als Datei: *Datei → Gesamtprojekt exportieren (.avplan)…* und auf der anderen Seite *Datei → Öffnen…*, beschrieben im Kapitel [Datei und Import](#8-datei-und-import).
- Das Handy im selben Netz: *Handy-Zugriff* zeigt Patchliste und Steck-Check, beschrieben im Kapitel [Web-Ausgabe und Tablet](#15-web-ausgabe-und-tablet).
- Die Rückmeldung an Rentman: [Exportieren und Drucken](#9-exportieren-und-drucken).
