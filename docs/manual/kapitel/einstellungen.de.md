## Einstellungen

### Einstellungen öffnen

Der Knopf *Einstellungen* steht rechts in der Kopfleiste.

![Kopfleiste mit dem Knopf Einstellungen](bilder/de/einstellungen-01-kopfleiste.jpg)

Weitere Wege in den Dialog:

- Befehlspalette (*Strg+K*), Eintrag *Einstellungen…*; der Eintrag *Module ein- oder ausschalten…* öffnet direkt den Reiter *Module*.
- Läuft der MCP-Server, zeigt die Statusleiste eine Anzeige dafür; ein Klick öffnet den Reiter *MCP*.
- Läuft eine Live-Kollaboration, öffnet die Anzeige *Live* in der Statusleiste den Reiter *Netzwerk-Sync*.

Der Dialog hat links die Liste der 15 Reiter und rechts den Inhalt des gewählten Reiters. Er öffnet mit dem Reiter *Projekt*.

![Einstellungen, Reiter Projekt](bilder/de/einstellungen-02-dialog.jpg)

Oben rechts liegen zwei Knöpfe: der Pfeil-Knopf lagert die Einstellungen in ein eigenes Fenster aus (etwa für einen zweiten Monitor), das Kreuz schließt den Dialog. Ein Klick auf den abgedunkelten Hintergrund schließt ihn ebenfalls. Die Kopfzeile lässt sich ziehen, um den Dialog zu verschieben.

![Kopfzeile des Dialogs mit Auslagern und Schließen](bilder/de/einstellungen-52-kopf-auslagern.jpg)

Fast alle Einstellungen gelten sofort. Ausnahmen sind die Projekt-Metadaten im Reiter *Projekt* (Knopf *Speichern*) und einzelne Felder mit eigenem *Speichern*-Knopf.

| Reiter | Inhalt | Gilt für |
|---|---|---|
| Projekt | Metadaten, Plan-Standards, Logos, Kabelnummerierung, Längenschätzung, Lagerlängen, Library-Export | das offene Projekt (Library-Export: diesen Rechner) |
| Module | Funktionsbereiche ein- und ausblenden | diesen Rechner |
| Darstellung | Sprache, Thema, Farben, Canvas-Hintergrund | diesen Rechner |
| Bearbeiten | Kabelführung, Raster, Verhalten beim Verbinden | diesen Rechner |
| Hotkeys | Tastenkürzel | diesen Rechner |
| Integrationen | Rentman, NetBox, Tally-Pi, Ausfüllen-Quelle, KI-Anbieter, GreenGo-Presets | diesen Rechner |
| Gerätebibliothek | Server, Konto, Hochladen und Abgleich | diesen Rechner |
| MCP | lokaler Server, über den Claude den Plan abfragt | diesen Rechner |
| Konfigurationen | Bibliothek von Gerätekonfigurationsdateien | diesen Rechner |
| Kabeltypen | eigene und geänderte Kabeltypen | diesen Rechner |
| Stammdaten | eigene Steckertypen, Signalstandards, Kabel-Ebenen | diesen Rechner |
| Kategorien & Felder | eigene Kategorien und Fachfelder | diesen Rechner |
| Netzwerk-Sync | Live-Kollaboration und Sync-Verzeichnis | diesen Rechner |
| Nachweise | Qualifikationen, Versicherungen, Unterweisungen | diese Person |
| Erweitert | Autosave, Kategorienverwaltung, Caches, Datenexport | diesen Rechner |

### Projekt

#### Projekt-Metadaten

Die Felder oben werden mit der Projektdatei gespeichert:

| Feld | Inhalt |
|---|---|
| Projektname | Name des Projekts |
| Beschreibung | freier Text |
| Auftraggeber (Kunde) | Endkunde |
| Auftragnehmer | ausführende Firma |
| Autor | Name des Planers |
| Projekt-Nr. | z. B. 2026-042 |

Änderungen an diesen Feldern und an den Logos übernimmt erst *Speichern* ganz unten im Reiter; *Zurücksetzen* stellt die gespeicherten Werte wieder her. Dieselben Angaben bearbeitet auch der Dialog, der sich mit einem Klick auf den Projektnamen in der Kopfleiste öffnet.

#### Plan-Standards

Technische Vorgaben für diesen Plan, je Gewerk. Die drei Auswahllisten gelten sofort.

![Plan-Standards](bilder/de/einstellungen-03-projekt-standards.jpg)

| Auswahl | Werte | Wirkung |
|---|---|---|
| Video-Format (SDI) | 576i50 (PAL) bis 2160p59.94/60 sowie DCI 4K p24 und p60, jeweils mit dem nötigen SDI-Standard (3G, 6G, 12G oder Quad 3G) | steuert die SDI-Standardverkabelung |
| Strom-/Netz-Standard | Europe / IEC 230 V einphasig, Europe 400 V dreiphasig, UK 230 V (BS 1363), North America 120 V, 208 V dreiphasig und 240 V split-phase, Japan 100 V, Australia / NZ 230 V | Spannung im Stromrechner (Watt ↔ Ampere) |
| Licht-Steuerung (Default) | DMX512 / RDM (5-pin XLR), Art-Net (Ethernet), sACN — ANSI E1.31 (Ethernet) | Vorgabe für die Lichtsteuerung |

#### Bauplan-Signatur (Logos)

Je ein Logo für *Auftragnehmer* und *Kunde*. *Auswählen…* lädt eine Bilddatei, das Kreuz daneben entfernt das Logo wieder. Die Logos werden in der Projektdatei gespeichert und erscheinen im PDF-Export und in der Signatur auf dem Canvas.

#### Verknüpftes Rentman-Projekt

Zeigt Name und ID des verknüpften Rentman-Projekts. Ist keines verknüpft, steht dort der Hinweis, dass die Verknüpfung im Reiter *Integrationen* hergestellt wird.

![Logos und verknüpftes Rentman-Projekt](bilder/de/einstellungen-04-projekt-logos-rentman.jpg)

#### Kabelnummerierung

Automatische, kollisionsfreie Kabel-IDs nach festem Schema; sie erscheinen auf dem Canvas, in der Patchliste und auf den Etiketten.

![Kabelnummerierung und Kabellängen schätzen](bilder/de/einstellungen-05-projekt-nummerierung.jpg)

| Option | Wirkung |
|---|---|
| Neuen Kabeln automatisch eine Nummer geben | jedes neue Kabel bekommt die nächste freie Nummer |
| Präfix | Text vor der Nummer, Vorgabe „C" |
| Trennzeichen | bis zu zwei Zeichen zwischen Präfix und Nummer, Vorgabe „-" |
| Stellen | Anzahl der Ziffern (1 bis 6) |
| Start-Nummer | erste vergebene Nummer |
| Eigener Zähler je Layer (V/A/N/P …) | zählt je Kabel-Ebene getrennt |

*Beispiel* zeigt die Nummer, die nach dem aktuellen Schema entsteht. *Alle Kabel neu nummerieren* vergibt die Nummern aller Kabel nach dem Schema neu; in Klammern steht die Zahl der Kabel. Ohne Kabel ist der Knopf gesperrt.

#### Kabellängen schätzen

Schätzt die Längen aus dem Abstand der Geräte auf dem Canvas: Luftlinie × Maßstab plus Reserve. Die Schätzung überschreibt vorhandene Längen; Funkverbindungen bleiben unberührt.

| Option | Wirkung |
|---|---|
| Meter pro 100 px | Maßstab des Canvas |
| Reserve (%) | Zuschlag in Prozent, 0 bis 200 |
| Auf ganze Meter aufrunden | rundet jede geschätzte Länge auf |

*Längen jetzt schätzen* führt die Schätzung aus und meldet, wie viele Längen geändert wurden.

#### Verfügbare Lagerlängen

Hier steht, mit welchen Kabellängen (Trommeln) diese Produktion fährt. Die Kabel-Stückliste teilt jeden Lauf in diese Längen — zuerst möglichst wenige Kupplungen, dann möglichst wenig Überlänge — und meldet, was der Bestand nicht hergibt.

1. Unter *Typ für einen neuen Eintrag* den Kabeltyp wählen. Die Liste zeigt die Typen, die im Plan vorkommen.
2. *Länge hinzufügen* legt eine Zeile mit 100 m an.
3. In der Zeile *Kabeltyp*, *Länge (m)* und *Vorhanden* anpassen. Das Kreuz entfernt die Zeile.

![Neue Lagerlänge eingetragen](bilder/de/einstellungen-06-projekt-laenge-hinzugefuegt.jpg)

*Vorhanden* bleibt leer, wenn niemand gezählt hat. Leer bedeutet „nicht gezählt", nicht null: die Stückliste warnt nur vor einem Fehlbestand, der tatsächlich festgestellt wurde.

#### Library Export / Import

![Library Export / Import](bilder/de/einstellungen-07-projekt-library.jpg)

*Library exportieren* speichert die eigenen Gerätevorlagen, Gruppen und Kategorien als JSON-Datei; in Klammern stehen die Anzahlen. *Library importieren…* liest eine solche Datei ein. Dabei werden nur neue Einträge angelegt: eine Vorlage, deren Name schon existiert, bleibt unverändert. Der Bericht nach dem Import nennt die angelegten Vorlagen und Gruppen-Presets sowie die übersprungenen Namen.

### Module

Module blenden ganze Funktionsbereiche ein oder aus. Das betrifft nur die Sichtbarkeit von Menüeinträgen, Panels und Dialogen; gespeicherte Projektdaten bleiben immer vollständig erhalten. Canvas, Geräte, Kabel, Eigenschaften und Export sind immer da und kein Modul.

![Reiter Module](bilder/de/einstellungen-08-module.jpg)

| Modul | Inhalt |
|---|---|
| Festinstallation | Lebenszyklus/Service, Asset-Register und QR-Etiketten, Übergabe-Doku, Feld-Rückkanal |
| Mobile-Companion | Handy-Patchliste, Steck-Check, QR-Scan-Lookup, Feld-Meldungen |
| Rentman | Import/Export-Kopplung zu Rentman (Katalog und Kabelmengen) |
| Rental / Lager | Lagerbestand, Eigentum und Verfügbarkeit, Mietkalkulation (im Aufbau) |
| NetBox | Site oder Rack aus einer NetBox-Instanz als Kabelplan importieren und später um neue Geräte und Verbindungen ergänzen |

Jedes Modul hat ein Kästchen *Modul aktiviert*.

### Darstellung

![Sprache, Thema und Geräte-Karten-Farben](bilder/de/einstellungen-09-darstellung.jpg)

| Bereich | Bedienung | Wirkung |
|---|---|---|
| Sprache | *Deutsch* / *English* | Sprache der Oberfläche, wirkt sofort |
| Darstellung | *Auto* / *Hell* / *Dunkel* | Thema der ganzen App einschließlich Canvas; *Auto* folgt dem System |
| Geräte-Karten-Farben | je Thema (*Hell*, *Dunkel*) Farbfelder für Karten-Body, Header-Strip, Rand, Haupttext, Sekundär-Text; *Reset* je Thema | Farben der Geräteknoten. Eine am Gerät gesetzte Gerätefarbe überschreibt den Body-Wert weiterhin. |
| Standard-Gerätefarbe | Farbfeld, *Reset* | Startfarbe neu hinzugefügter Geräte; leer: Body-Farbe des Themas |

![Port-Schrift, Port-Farben, Kabelfarbe, Pfeile, Verbindungs-Warnungen](bilder/de/einstellungen-10-darstellung-portschrift.jpg)

| Bereich | Bedienung | Wirkung |
|---|---|---|
| Port-Label-Schriftgröße | Schieberegler, Vorgabe 11 px, Knopf zum Zurücksetzen | Schriftgröße der Ein- und Ausgangsbeschriftungen auf den Geräteknoten; größer ist beim Herauszoomen besser lesbar, macht die Geräte aber breiter |
| Port-Farben | *Nach Richtung (Standard)* / *Nach Steckertyp* | Einfärbung der Anschlusspunkte |
| Kabelfarbe | *Manuell* / *Nach Länge* / *Nach Gewerk* | Manuell: Farbe je Kabel aus den Eigenschaften; nach Länge: Längen-Farbcodierung; nach Gewerk: Farben der Ebenen. Die am Kabel gespeicherte Farbe bleibt in jedem Modus erhalten. |
| Pfeile auf Kabeln | *Pfeil am Ziel-Ende anzeigen (Signalflussrichtung)* | Vorgabe für neu gezeichnete Kabel; je Kabel in den Eigenschaften änderbar |
| Verbindungs-Warnungen | *Beliebige Inputs und Outputs ohne Warnung verbinden* | Normalerweise fragt die App bei einem Steckertyp-Konflikt nach. Mit diesem Haken wird die Verbindung ohne Rückfrage angelegt und als Adapter/Konverter markiert. |

![Kennung am Geräteknoten und Canvas-Hintergrund](bilder/de/einstellungen-11-darstellung-kennung-raster.jpg)

| Bereich | Bedienung | Wirkung |
|---|---|---|
| Kennung am Geräteknoten | *Asset-Tag* / *Interne Nummer* / *Keine* | welche Nummer des Exemplars neben der Kategorie steht; erscheint nur, wo eine eingetragen ist |
| Canvas-Hintergrund | *Muster*: *Punkte*, *Linien*, *Kreuze*, *Kein Raster*; Regler *Deckkraft* | Muster und Deckkraft des Canvas-Rasters. Die Rastergröße stellt der Reiter *Bearbeiten* ein. |

![Eigenes Hintergrundbild und Custom-Palette](bilder/de/einstellungen-12-darstellung-bild-palette.jpg)

**Eigenes Hintergrundbild:** *+ Bild hochladen…* lädt ein Bild als Canvas-Hintergrund, getrennt für *Dark-Mode-Bild* und *Light-Mode-Bild*. Ist ein Bild gesetzt, ersetzen *Ersetzen…* und *Bild entfernen* den Knopf. *Skalierung* wählt zwischen *Cover* (füllt komplett, beschneidet), *Contain* (vollständig sichtbar, mit Rand) und *Kacheln* (wiederholt). Das Rastermuster wird über das Bild gezeichnet.

**Custom-Palette:** *Eigene Palette aktivieren* blendet zwei Farbfelder ein: *Hintergrund* und *Raster-Strich* des Canvas. Sie überschreiben die Vorgaben von hellem und dunklem Thema, aber nur auf dem Canvas; Dialoge bleiben im Thema.

![Steckertyp-Farben](bilder/de/einstellungen-13-darstellung-steckerfarben.jpg)

**Steckertyp-Farben:** ein Farbfeld je Steckertyp. Sichtbar wird die Farbe nur, wenn *Port-Farben* auf *Nach Steckertyp* steht. Ein leeres Feld gilt als Standard; *Alle zurücksetzen* stellt alle Steckerfarben zurück.

![Geräte-Farben pro Kategorie](bilder/de/einstellungen-14-darstellung-kategoriefarben.jpg)

**Geräte-Farben pro Kategorie:** eine Vorgabefarbe je Gerätekategorie für alle Geräte dieser Kategorie ohne eigene Farbe. Eine am Gerät gesetzte Farbe gewinnt. *Alle zurücksetzen* entfernt alle Kategoriefarben.

### Bearbeiten

![Reiter Bearbeiten, oberer Teil](bilder/de/einstellungen-15-bearbeiten.jpg)

| Bereich | Bedienung | Wirkung |
|---|---|---|
| Standard-Kabelführung | *Ortho* / *Linie* / *Kurve* | Form neuer Kabel; je Kabel änderbar. *Auf alle bestehenden Kabel anwenden* setzt die gewählte Form auf alle vorhandenen Kabel (in Klammern deren Zahl). |
| Raster (Grid) | *Geräte am Raster einrasten*; *Rastergröße in Pixeln (6-60)* | Ein Raster für alles: Geräte rasten ein, Port-Reihen sitzen darauf, das automatische Routing sucht darauf. |
| Inline-Auswahl-Toolbar | *Inline-Toolbar bei Auswahl anzeigen* | schwebende Schnellaktionen (Ausrichten, Duplizieren, Rahmen, Löschen) neben der Auswahl auf dem Canvas |
| Label mit Kabel mit-wandern | *Beim Reconnect Port-Labels mit-tauschen* | Beim Umstecken übernimmt der neue Port den selbst vergebenen Namen des alten Ports; der alte fällt auf den Namen aus der Vorlage zurück. Vorgabe aus. Wirkt nur bei Ports mit selbst vergebenem Namen. |

![Reiter Bearbeiten, unterer Teil](bilder/de/einstellungen-16-bearbeiten-unten.jpg)

| Bereich | Bedienung | Wirkung |
|---|---|---|
| Kabel-Typ folgt Port-Connector | *Kabel-Typ aus Port-Connector ableiten* | Ändert sich der Stecker eines Ports (z. B. BNC → XLR), übernehmen verbundene Kabel den neuen Typ, auch beim Umstecken auf einen Port mit anderem Stecker. Kabel mit Konverter-Hinweis bleiben unberührt. Vorgabe an. |
| Endpoint-Labels an Kabelenden | *Endpoint-Labels einblenden* | kleines Label an jedem Kabelende: am Quell-Ende „→ Ziel-Gerät · Ziel-Port", am Ziel-Ende „← Quell-Gerät · Quell-Port". Vorgabe aus. Wirkt zusammen mit „Alle Labels ausblenden" und der Label-Position eines Kabels. |
| Kabel-Darstellung | *Kreuzungs-Brücken auf orthogonalen Kabeln*; *Mittellinien automatisch versetzen wenn Kabel sich überlagern* | Brücken an Kreuzungen orthogonaler Kabel; automatischer Versatz übereinanderliegender Mittellinien |

### Hotkeys

Der Reiter listet die belegbaren Tastenkürzel mit ihrer aktuellen Belegung.

![Reiter Hotkeys](bilder/de/einstellungen-17-hotkeys.jpg)

| Aktion | Vorgabe |
|---|---|
| Rückgängig | Ctrl+Z |
| Wiederherstellen | Ctrl+Y |
| Projekt speichern | Ctrl+S |
| Projekt speichern unter… | Ctrl+Shift+S |
| Neues Projekt | Ctrl+N |
| Projekt öffnen | Ctrl+O |
| Auswahl löschen | Delete |
| Alles auswählen | Ctrl+A |
| Auswahl aufheben | Escape |
| Library ein-/ausblenden | Ctrl+B |
| Eigenschaften ein-/ausblenden | Ctrl+I |
| Längen-Legende anzeigen | L |
| Zu Patches springen | P |
| Pfeil-Anzeige umschalten | A |
| Routing umschalten | R |

So belegen Sie ein Kürzel neu:

1. Auf das Feld mit der Tastenkombination klicken. Es zeigt *Taste drücken…*.
2. Die gewünschte Kombination drücken, z. B. Ctrl/Shift/Alt plus Buchstabe oder eine Funktionstaste. Sie wird sofort übernommen.

![Feld wartet auf eine Taste](bilder/de/einstellungen-18-hotkeys-aufnahme.jpg)

Das Kreuz neben dem Feld leert die Belegung; ein leeres Feld schaltet das Kürzel ab. Doppelbelegungen sind erlaubt, dann gewinnt das zuerst gefundene Kürzel. *Auf Standard zurücksetzen* stellt alle Vorgaben wieder her.

### Integrationen

#### Rentman

![Rentman-Integration](bilder/de/einstellungen-19-integrationen.jpg)

- *Rentman-Integration aktivieren* blendet Library-Reiter, Menüeinträge und Statusanzeigen für Rentman ein oder aus. Ausgeschaltet zeigt die App nur lokale Geräte und Kabel.
- *Rentman API*: Feld *API-Token* für den Bearer-Token aus dem Rentman-Konto. *Token speichern* legt ihn verschlüsselt im Schlüsselbund des Betriebssystems ab, nie in der Projektdatei. *Verbindung testen* prüft ihn, *Token löschen* entfernt ihn. Status und *Token gespeichert* zeigen den Stand; der Endpunkt ist https://api.rentman.net.
- *Verknüpftes Rentman-Projekt*: *Mit Rentman-Projekt verknüpfen…* verbindet das offene Projekt mit einem Rentman-Projekt. Dafür muss ein Token gespeichert sein.

#### NetBox

![NetBox-Integration](bilder/de/einstellungen-20-integrationen-netbox.jpg)

- *NetBox-Integration aktivieren* blendet Menüeintrag und Import-Dialog für die eigene NetBox-Instanz ein oder aus.
- *Instanz-URL*: Basis-URL der NetBox-Instanz, übernommen mit *Speichern*.
- *API-Token*: Token mit Leserechten. *Token speichern* legt ihn verschlüsselt im Schlüsselbund ab; er verlässt den Hauptprozess nicht. *Verbindung testen* und *Token löschen* wie bei Rentman.
- *Site/Rack importieren…* öffnet den Import, der eine Site oder ein Rack als Kabelplan übernimmt. Die App liest nur (`/api/dcim/…`).

#### Tally-Pi (Direktweg)

Schickt die Tally-Karte aus dem Export-Dialog direkt an den Tally-Pi, statt eine Datei herunterzuladen. Die Datei bleibt als Weg ohne Netzverbindung bestehen. Der Pi behält seine Verdrahtung; Rollen, die im Plan fehlen, verschwinden dort.

1. *Direktweg zum Tally-Pi erlauben* einschalten.
2. Unter *Adresse des Pi* die Adresse eintragen.
3. *Verbindung prüfen* meldet *Der Pi antwortet.* oder *Keine Antwort.*

![Tally-Pi mit eingeschaltetem Direktweg](bilder/de/einstellungen-21-integrationen-tallypi.jpg)

Der Pi verlangt auf diesem Weg keinen Nachweis: wer ihn erreicht, kann ihn beschreiben. Den Direktweg deshalb nur in einem vertrauenswürdigen Netz nutzen.

#### Quelle zum Ausfüllen und KI-Anbieter

*Quelle zum Ausfüllen* bestimmt, woher der Knopf *Ausfüllen* im Anlegen-Dialog und im Rentman-Assistenten seine Port-Gruppen nimmt:

| Quelle | Eigenschaft |
|---|---|
| Web-Suche | Wikipedia und DuckDuckGo, ohne API-Schlüssel. Fundstelle und Textausschnitt bleiben am Gerät gespeichert. |
| KI-Modell | der darunter gewählte Anbieter; braucht einen API-Schlüssel und nennt sich als Urheber, aber keine Fundstelle |

Beide Quellen raten und ersetzen kein Datenblatt.

![Ausfüllen-Quelle und KI-Anbieter](bilder/de/einstellungen-22-integrationen-ki.jpg)

*AI-Provider (KI-Port-Vorschläge)* listet Google Gemini, Anthropic Claude und OpenAI mit dem jeweils verwendeten Modell. Der Auswahlpunkt macht einen Anbieter aktiv. Jeder Anbieter hat ein eigenes Schlüsselfeld mit *Anzeigen*/*Ausblenden*, *Speichern* und Löschen; *Key erstellen ↗* öffnet die Seite des Anbieters. Bei Anthropic Claude gibt es zusätzlich das Feld *Workspace-ID*. Diese Schlüssel werden lokal im Speicher der App abgelegt.

#### GreenGo Intercom Presets

![GreenGo Intercom Presets](bilder/de/einstellungen-23-integrationen-greengo.jpg)

Eine Bibliothek wiederverwendbarer Intercom-Konfigurationen. *Aktuelle Konfiguration als Preset speichern* fragt nach einem Namen und speichert die GreenGo-Konfiguration des Projekts mit Beltpack-Namen, Gruppen und Routing; ohne GreenGo-Konfiguration im Projekt ist der Knopf gesperrt. Jedes Preset zeigt die Zahl der Benutzer und Gruppen; *Laden* übernimmt es nach Rückfrage ins Projekt, *Löschen* entfernt es.

### Gerätebibliothek

Die Gerätebibliothek ist ein gemeinsamer Server, mit dem der Planer Gerätevorlagen abgleicht und an den er eigene Vorlagen einreicht.

![Reiter Gerätebibliothek](bilder/de/einstellungen-24-geraetebibliothek.jpg)

**Server:** Leer lassen nutzt den Standard-Server https://devices.zumpelars.de. Eine andere Adresse übernimmt *Speichern*; *Standard wiederherstellen* kehrt zum Standard zurück. Die Zeile *Aktiv* zeigt den Server in Gebrauch. In der Browser-Fassung liegt die Anmeldung im Speicher des Browsers, in der Desktop-App im Schlüsselbund des Systems.

**Konto:** Die Gerätebibliothek ist nur mit Konto nutzbar. Konten werden auf der Website angelegt; dort wird die E-Mail-Adresse bestätigt und den Richtlinien zugestimmt.

1. *E-Mail oder Benutzername* und *Passwort* eintragen, *Anmelden*.
2. Ist für das Konto Zwei-Faktor-Anmeldung eingerichtet, erscheint das Feld *Zwei-Faktor-Code aus der Authenticator-App*; mit *Code bestätigen* ist die Anmeldung abgeschlossen, *Abbrechen* bricht ab.

*Konto anlegen* und *Passwort vergessen* öffnen die Website. Angemeldet zeigt der Bereich Name und E-Mail-Adresse und den Knopf *Abmelden*.

**Meine Geräte:** Selbst angelegte oder geänderte Vorlagen werden hochgeladen und gehen zuerst in die Moderation.

- *Eigene Geräte automatisch hochladen* lädt beim Start und nach jeder Änderung einer Vorlage hoch, solange Sie angemeldet sind.
- *Jetzt synchronisieren* lädt Geändertes hoch und holt danach Aktualisierungen. Der Knopf braucht eine Anmeldung.
- *Eigene Vorlagen (n)* klappt die Liste der eigenen Vorlagen auf. Jede zeigt ihren Stand, z. B. *noch nicht hochgeladen*, *seit dem letzten Hochladen geändert*, *hochgeladen — wartet auf Moderation*, *hochgeladen — live* oder *blockiert — die Punkte unten beheben*. Fehlen Hersteller oder Modell, stehen darunter Felder dafür; ohne beide wird die Vorlage nicht hochgeladen.

![Liste der eigenen Vorlagen und Abgleich](bilder/de/einstellungen-25-geraetebibliothek-eigene.jpg)

**Abgleich:** *Aus der Gerätebibliothek aktualisieren* holt nur, was sich seit dem letzten Abgleich geändert hat (braucht eine Anmeldung). Die Geräte erscheinen schreibgeschützt in der Bibliothek unter *Geteilt* und bleiben offline verfügbar. Darunter stehen die Zahl der lokal gespeicherten Geräte und der Zeitpunkt des letzten Abgleichs. Der Bericht nennt neue, aktualisierte und entfernte Geräte sowie Einträge, die die Vorlagenprüfung der App nicht bestehen und deshalb übersprungen werden.

### MCP

Über den MCP-Server fragt Claude diesen Plan ab: Geräte, Ports, Signalwege, Kabel und das Ergebnis des Plan-Checks. Der Server läuft nur in der Desktop-App, hört nur auf 127.0.0.1 und verlangt ein Paarungs-Token.

![Reiter MCP, Server aus](bilder/de/einstellungen-26-mcp.jpg)

1. *Server starten* startet den Server. Daneben steht die Adresse, z. B. *Hört auf http://127.0.0.1:4187/mcp*; *Server stoppen* hält ihn an. Fragt gerade ein Client an, steht dort *ein Client fragt gerade*. Ist der eingestellte Port belegt, läuft der Server auf einem zufälligen Port und die Zeile sagt das.
2. Der Zustand wird gemerkt: lief der Server beim Beenden, startet er beim nächsten Programmstart wieder auf demselben Port.
3. *Port* legt den Port fest; er gilt beim nächsten Start des Servers.

![MCP-Server läuft](bilder/de/einstellungen-27-mcp-laeuft.jpg)

**Claude darf den Plan auch ändern:** ein eigener Schalter, Vorgabe aus. Eingeschaltet darf Claude Geräte aus der Bibliothek und eigene Geräte setzen, Kabel anlegen und entfernen, Kabel-Angaben und Rackhöhen setzen, Racks speichern und Geräte umbenennen. Jeder Aufruf ist ein Rückgängig-Schritt und hinterlässt eine Zeile in der Liste *Was Claude geändert hat*, die im Reiter erscheint, sobald es Einträge gibt. Schaltbefehle an Geräte (Videohub, ATEM) werden nie angeboten. Der Schalter gilt ab dem nächsten Start des Servers.

**Paarungs-Token:** *Paarungs-Token zeigen* blendet das Token ein, *Neues Token* erzeugt ein neues. Das Token liegt im Schlüsselbund des Betriebssystems. Ein neues Token gilt nach einem Neustart des Servers, und jeder Client muss es neu bekommen.

![Paarungs-Token sichtbar](bilder/de/einstellungen-28-mcp-token.jpg)

Läuft der Server, zeigt der Reiter drei fertige Vorlagen mit Adresse und Token, jede mit *Kopieren*:

| Vorlage | Zweck |
|---|---|
| In Claude Code eintragen | der Befehl `claude mcp add --transport http cable-planner …` |
| JSON für .mcp.json oder andere Clients | Konfigurationsblock für andere Clients |
| Ohne Client-Neustart: per curl aufrufen | ein `curl`-Aufruf, der die Werkzeugliste abfragt |

![Vorlagen und Hinweis zu claude.ai](bilder/de/einstellungen-29-mcp-befehle.jpg)

**claude.ai und die Claude-App** erreichen diesen Rechner nicht. Für sie: Projekt in die Cloud legen (*Datei → Cloud & Lese-Link…*), dann in claude.ai einen eigenen Connector mit der angezeigten Adresse (Standard: https://devices.zumpelars.de/mcp) hinzufügen und mit dem Konto der Gerätebibliothek anmelden. Dieser Connector liest nur Cloud-Projekte und ändert nichts.

### Konfigurationen

Eine Bibliothek von Konfigurationsdateien für Geräte (ATEM, Videohub, GreenGo), unabhängig vom Projekt.

![Reiter Konfigurationen, leer](bilder/de/einstellungen-30-konfigurationen.jpg)

1. *Datei wählen…* lädt eine Datei (XML, JSON, TXT, CSV oder .gg5). Der Typ wird aus dem Dateinamen geraten.
2. Die Datei erscheint in der *Konfigurations-Bibliothek*, gruppiert nach Typ.

![Hochgeladene Konfiguration](bilder/de/einstellungen-31-konfigurationen-hochgeladen.jpg)

Jeder Eintrag hat:

- ein Namensfeld,
- die Typ-Auswahl: *ATEM Multiviewer Layout*, *ATEM Audio-Routing*, *Videohub Labels*, *Videohub Routing*, *GreenGo Intercom (.gg5)*, *Sonstige*,
- die Geräte-Auswahl, die die Konfiguration einem Gerät auf dem Canvas zuordnet (*(unzugeordnet)* für keines),
- den Dateinamen, einen Knopf *Originaldatei herunterladen* und das Kreuz zum Entfernen (mit Rückfrage).

Die Filterknöpfe über der Liste (*Alle* und je Typ, mit Anzahl) schränken die Anzeige ein. *Bibliothek als JSON exportieren* speichert die ganze Bibliothek in einer Datei; *JSON-Bibliothek importieren…* liest eine solche Datei und fragt, ob sie die vorhandene Bibliothek ersetzen oder ergänzen soll.

### Kabeltypen

Kabeltypen sind die Vorlagen, die der Plan beim Zeichnen anbietet: Stecker, Signal-Standards, Farbe und Höchstlänge. Sie gehören zur Installation, nicht zu einem Projekt.

![Reiter Kabeltypen](bilder/de/einstellungen-32-kabeltypen.jpg)

- **Eigene Kabeltypen:** *+ Neuer Kabeltyp* öffnet den Dialog *Neuer Kabeltyp*. Angelegte Typen stehen in jedem Projekt auf diesem Rechner zur Verfügung und haben je *Bearbeiten* und *Löschen*.
- **Geänderte eingebaute Typen:** Ein eingebauter Typ wird nie gelöscht, nur überschrieben. *Auf die eingebaute Vorgabe zurücksetzen* stellt die ausgelieferten Werte wieder her.

Die Kabel-Bibliothek in der linken Seitenleiste bearbeitet einen Typ ebenfalls direkt.

![Dialog Neuer Kabeltyp](bilder/de/einstellungen-33-kabeltypen-neu.jpg)

| Feld | Inhalt |
|---|---|
| Name | z. B. CAT6a Patch 5m |
| Stecker-Typ | Auswahl aus allen Steckertypen; *+* legt einen eigenen an |
| Kabel-Farbe | Farbfeld |
| Auch kompatibel mit (optional) | weitere Steckertypen zum Anklicken |
| Signal-Standards | Standards zum Anklicken; *+ Standard* legt einen eigenen an |
| Max. Länge (m) – optional | Höchstlänge |
| Notiz (optional) | freier Text |

*Anlegen* speichert den Typ, *Abbrechen* verwirft ihn.

### Stammdaten

Eigene Steckertypen, Signalstandards und Kabel-Ebenen an einer Stelle. Sie stehen in jeder Auswahl neben den eingebauten und reisen mit der geteilten Bibliothek (Netzwerk-Sync), damit ein Team dieselben Namen verwendet.

![Reiter Stammdaten](bilder/de/einstellungen-34-stammdaten.jpg)

Jeder der drei Bereiche *Steckertypen*, *Signalstandards* und *Kabel-Ebenen* funktioniert gleich:

1. Den Namen ins Eingabefeld schreiben (z. B. „SMPTE 2110-20" bei den Signalstandards).
2. *Hinzufügen* legt den Eintrag an. Ein Name, den es schon gibt, wird nicht angenommen.

![Eigener Signalstandard angelegt](bilder/de/einstellungen-35-stammdaten-standard-angelegt.jpg)

Eigene Einträge lassen sich umbenennen (die App fragt nach dem neuen Namen) und entfernen (nach Rückfrage). Wer einen Eintrag umbenennt, benennt ihn auch an allen Ports, Kabeln und Bibliotheksvorlagen um, die ihn benutzen.

*Eingebaut (n)* klappt die mitgelieferten Einträge auf. Eingebaut sind 127 Steckertypen, 64 Signalstandards und sechs Kabel-Ebenen: video, audio, control, network, power, other.

![Eingebaute Kabel-Ebenen aufgeklappt](bilder/de/einstellungen-36-stammdaten-eingebaut.jpg)

### Kategorien & Felder

Hier entstehen eigene Gerätekategorien und Fachfelder (z. B. eine Richtcharakteristik). Eigene Felder erscheinen automatisch in den Geräte-Eigenschaften und in Stückliste und Export. Eingebaute Felder sind gesperrt (*built-in*).

![Reiter Kategorien & Felder](bilder/de/einstellungen-37-schema.jpg)

**Kategorie wählen oder anlegen:** Die Auswahl *Kategorie* zeigt die Felder einer Kategorie. Eine neue Kategorie entsteht mit *Neue Kategorie (DE)*, optional *Name (EN)*, und *Kategorie anlegen*.

![Felder der Kategorie Kameras](bilder/de/einstellungen-38-schema-unten.jpg)

**Feld anlegen:**

1. *Feld hinzufügen* öffnet das Formular *Neues Feld*.
2. *Bezeichnung (DE)*, *Label (EN)* und *Schlüssel* eintragen.
3. *Typ* wählen: *Text*, *Zahl*, *Auswahl*, *Ja/Nein* oder *Richtcharakteristik (Diagramm)*. Für *Auswahl* mit *Option* mindestens eine Auswahlmöglichkeit anlegen.
4. Optional *Einheit* und *Platzhalter*.
5. *Feld anlegen* speichert, *Abbrechen* verwirft.

![Formular Neues Feld](bilder/de/einstellungen-39-schema-neues-feld.jpg)

Ein Schlüssel darf in einer Kategorie nur einmal vorkommen. Eigene Felder lassen sich über das Papierkorb-Symbol löschen; ein angelegtes Feld wird nicht nachträglich bearbeitet, sondern gelöscht und neu angelegt. Kategorien umbenennen geht im Reiter *Erweitert*.

### Netzwerk-Sync

Der Reiter enthält zwei getrennte Wege der Zusammenarbeit: die Live-Kollaboration und das gemeinsame Sync-Verzeichnis.

#### Live-Kollaboration (Beta)

Mehrere Planer bearbeiten denselben Plan in Echtzeit. Änderungen werden ohne Server zusammengeführt, auch nach einer kurzen Trennung.

![Live-Kollaboration, Modus Dieses Gerät](bilder/de/einstellungen-40-sync.jpg)

| Feld | Inhalt |
|---|---|
| Dein Anzeigename | Name, den die anderen sehen |
| Modus | *Dieses Gerät (mehrere Fenster)* oder *Netzwerk (LAN/WAN, P2P)* |
| Raumname | Name des gemeinsamen Raums |

Im Modus *Netzwerk* kommen weitere Felder hinzu:

| Feld | Inhalt |
|---|---|
| Signaling-Server | leer: wss://relay.zumpelars.de; er sieht nur Verbindungsdaten, nie den Plan |
| Nur lokal | kein entferntes Relay, nichts verlässt das LAN |
| Raum-Passwort (optional) | verschlüsselt den Raum |
| STUN-/TURN-Server (optional) | eine Zeile je Server: `URL|Benutzer|Passwort`; nur nötig, wenn die Gegenstelle in einem anderen Netz sitzt. Die Zugangsdaten bleiben auf diesem Rechner und stehen nicht im Einladungslink. |

Ohne Raum-Passwort ist der Raum unverschlüsselt: wer Raumname und Signaling-Server kennt oder die Session im LAN findet, kann das ganze Projekt mitlesen.

![Modus Netzwerk](bilder/de/einstellungen-41-sync-netzwerk.jpg)

*Sessions im Netzwerk*: *Im Netzwerk suchen* sucht im lokalen Netz nach laufenden Sessions (nur Desktop-App). Gefundene Sessions haben einen Knopf *Beitreten*. Beitreten übernimmt den Plan des Gastgebers und ersetzt nach Rückfrage den eigenen Plan.

*Session starten* eröffnet die Session. Danach zeigt der Bereich *Verbunden — Änderungen werden live geteilt*, die Teilnehmer im Raum und den Knopf *Einladung kopieren*, der einen Einladungslink in die Zwischenablage legt. *Verlassen* beendet die Teilnahme.

![Laufende Session](bilder/de/einstellungen-42-sync-session-aktiv.jpg)

#### Sync-Verzeichnis

Ein gemeinsames Verzeichnis (verbundenes FTP-Laufwerk, Netzwerkpfad oder lokaler Ordner), in dem Projekt, Bibliothek und Presets als JSON-Dateien geteilt werden. Dieser Weg braucht die Desktop-App.

1. *Sync-Verzeichnis* eintragen.
2. *Benutzername (für Lock-Anzeige)* eintragen; er erscheint bei den anderen, solange Sie das Verzeichnis sperren.
3. *Speichern*. *Zurücksetzen* stellt die gespeicherten Werte wieder her.

![Sync-Verzeichnis eintragen](bilder/de/einstellungen-43-sync-verzeichnis.jpg)

Mit gesetztem Verzeichnis erscheinen in der Kopfleiste die Knöpfe *Push* und *Pull*:

- *Push* schreibt `cable-planner.project.json`, `cable-planner.library.json` und `cable-planner.presets.json` ins Verzeichnis.
- *Pull* lädt diese Dateien in den aktuellen Stand. Liegen keine Sync-Dateien im Verzeichnis, meldet die App das.
- Eine Lock-Datei (`.cable-planner-sync.lock`) verhindert gleichzeitiges Überschreiben; sie verfällt nach zwei Stunden. Ist das Verzeichnis gesperrt, nennt die Meldung den Namen dessen, der es sperrt.

![Push und Pull in der Kopfleiste](bilder/de/einstellungen-45-sync-kopfleiste.jpg)

**Gemeinsame Bibliothek (Workgroup):** *Bibliothek jetzt synchronisieren* gleicht Gerätevorlagen, Gruppen und Kategorien mit der Datei `cable-planner.library.json` im Sync-Verzeichnis ab. Abgeglichen wird nach Namen; lokale Vorlagen werden nie überschrieben. Die Meldung nennt, was geholt und geteilt wurde, und Namenskonflikte, bei denen die lokale Fassung blieb.

![Gemeinsame Bibliothek mit gesetztem Verzeichnis](bilder/de/einstellungen-44-sync-gespeichert.jpg)

### Nachweise

Qualifikationen, Versicherungen und Unterweisungen der Person, die die App benutzt, jeweils mit Frist. Sie gehören zur Person, nicht zum Plan, und kommen nie in eine Projektdatei.

![Reiter Nachweise](bilder/de/einstellungen-46-nachweise.jpg)

**Nachweis eintragen:**

1. *Nachweis* öffnet das Formular.
2. *Art* wählen: Qualifikation, Versicherung, Unterweisung, Ausweis oder Sonstiges.
3. *Bezeichnung* eintragen (Pflichtfeld), optional *Aussteller*, *Nummer*, *Ausgestellt am*, *Gültig bis* und *Dateiname des Scans*.
4. *Speichern*.

![Formular Nachweis](bilder/de/einstellungen-47-nachweise-formular.jpg)

Ohne *Gültig bis* gilt ein Nachweis nicht als unbefristet, sondern als „keine Frist angegeben"; so steht es auch auf dem Deckblatt. Jeder Eintrag zeigt seinen Zustand, Art und Frist mit den verbleibenden Tagen und hat *Bearbeiten* und *Löschen*.

**Vorwarnzeit:** Die Zahl der *Tage* vor Fristende, ab der gewarnt wird. Darunter stehen die Nachweise, die innerhalb dieser Zeit ablaufen. Ohne Angabe wird nicht gewarnt.

**Deckblatt:** speichert eine CSV-Datei `nachweise-deckblatt.csv` mit allen Nachweisen (Art, Bezeichnung, Aussteller, Nummer, Gültig bis, Lage, Datei) und Summenzeilen für abgelaufene Nachweise, Nachweise ohne Frist und Nachweise ohne benannte Datei. Ohne Nachweise ist der Knopf gesperrt.

![Eingetragener Nachweis mit Vorwarnzeit](bilder/de/einstellungen-48-nachweise-eingetragen.jpg)

### Erweitert

![Reiter Erweitert](bilder/de/einstellungen-49-erweitert.jpg)

**Autosave:** *Autosave-Intervall (ms)* bestimmt, wie oft das Projekt automatisch im lokalen Speicher gesichert wird. Vorgabe 400 ms.

**Kategorienverwaltung:** Die Tabelle listet alle Bibliothekskategorien mit der Zahl der Vorlagen. Steht neben dem Namen ein zweiter in Klammern, ist das der englische Name.

- *Umbenennen* öffnet den Dialog *Kategorie umbenennen* mit je einem Feld *Deutsch* und *Englisch*. Beim Umschalten der Sprache wird der jeweilige Name gezeigt; ein leeres Feld fällt auf die andere Sprache zurück. Ändert sich der Name, wandern alle zugeordneten Vorlagen und verbauten Geräte mit. *OK* übernimmt.
- *+ Neue Kategorie* legt mit demselben Dialog eine Kategorie an.

![Dialog Kategorie umbenennen](bilder/de/einstellungen-50-erweitert-umbenennen.jpg)

**Caches & Lokale Daten:** *Rentman-Template-Cache leeren* und *Web-Suchverlauf leeren* löschen nach Rückfrage den jeweiligen Zwischenspeicher; er wird bei Bedarf neu geladen, Projektdaten gehen nicht verloren. *Willkommens-Dialog beim nächsten Start zeigen* zeigt nach Rückfrage beim nächsten Start wieder den Willkommens-Dialog.

**Datenexport:** *Alle localStorage-Daten exportieren* speichert alle lokal abgelegten Daten der App als JSON-Datei, etwa zum Übertragen auf einen anderen Rechner.

![Caches und Datenexport](bilder/de/einstellungen-51-erweitert-unten.jpg)
