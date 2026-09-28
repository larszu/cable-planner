# Gerätedaten: JSON, SQLite und wo was hingehört

Stand 2026-09-28. Dieses Papier hält fest, wie die Suite Geräte speichert, wann
eine SQLite-Datenbank sinnvoll ist und wann nicht. Es entstand aus der Frage, ob
die Geräte als JSON-Dateien noch die richtige Form sind. Kurz: **für den Plan
ja, für den gemeinsamen Katalog steht die Datenbank schon auf dem Server, und
lokal lohnt sich SQLite erst ab einer Größe, die heute nicht erreicht ist.**
Die Ausnahme ist der Bestand im inventory-planner.

## Wo die Geräte heute liegen

| Schicht | Ort | Form | Umfang (gemessen 2026-09-28) |
|---|---|---|---|
| Eingebaute Kataloge | `src/renderer/lib/*Catalog.ts` | TypeScript im Bundle | rund 1.000 Einträge, rund 490 KB Quelltext |
| Eigene Bibliothek | `userData/library/devices/*.cpdevice` (`librarySync.ts`) | eine JSON-Datei je Gerät, dazu `localStorage` | so viele, wie jemand anlegt |
| Team-Bibliothek | eine JSON-Datei im Sync-Ordner (Dropbox/SMB, `sharedLibrarySync.ts`) | JSON, Abgleich über den Namen, mit Sperre | Vereinigung mehrerer Arbeitsplätze |
| Gemeinsame Bibliothek | devices.zumpelars.de (`larszu/av-device-library`) | **SQLite** (`node:sqlite`, `library.sqlite`) | wächst mit allen Planern |
| Offline-Stand der gemeinsamen Bibliothek | `localStorage`, je Server-Adresse | JSON | Spiegel des letzten Abgleichs |
| Im Plan platzierte Geräte | Projektdatei | JSON, Kopie mit `libraryRef` | je Projekt |

Die Server-Datenbank führt ein Änderungsprotokoll (Tabelle `feed`, Spalte `seq`,
wächst nur). Jeder Planer merkt sich die letzte Nummer und fragt
`/api/sync?planner=…&after=<seq>` — er holt nur, was seitdem neu ist.

## Was SQLite leistet — und was es hier kostet

SQLite ist eine SQL-Datenbank in einer Datei, ohne eigenen Serverprozess.

Was sie leistet:

- **Transaktionen:** Eine Änderung an mehreren Stellen passiert ganz oder gar
  nicht. `atomicWrite` sichert das heute je Datei, nicht über mehrere Dateien.
- **Indizes und Abfragen:** „Alle SDI-Geräte eines Herstellers mit mehr als vier
  Eingängen“ lässt sich abfragen, ohne alles in den Speicher zu laden.
- **Volltextsuche (FTS5)** über Hersteller, Modell und Beschreibung.
- **Hybrid-Schema:** Feste Spalten für das, wonach gesucht wird (Hersteller,
  Modell, Kategorie, `updated_at`), der Rest bleibt eine JSON-Spalte. Neue
  Felder brauchen dann keine Migration. Der Server macht es genau so
  (`versions.data_json`).

Was sie in diesem Repo kostet:

1. **Sync-Ordner.** Eine SQLite-Datei auf SMB oder in Dropbox geht kaputt: Das
   Sperren über SMB ist unzuverlässig, und Dropbox kopiert die Datei auch
   mitten im Schreiben. Die Team-Bibliothek bleibt deshalb JSON, oder sie
   wandert ganz auf den Server.
2. **Browser-Teile.** `src/viewer` und `src/mobile` laufen ohne native Module.
   Dort ginge SQLite nur als WebAssembly (rund 1 MB), und der Mobile-Chunk hat
   72 kB, die über das Hallen-WLAN geladen werden.
3. **Die Projektdatei ist ein Dokument.** Sie wird verschickt, ist im Diff
   lesbar und läuft durch den CRDT-Abgleich, in den Viewer und durch
   `healProjectPositions`. Eine Binärdatei verlöre all das.
4. **Die Größe verlangt es noch nicht.** 1.000 Geräte sind weniger als 1 MB;
   sie ganz im Speicher zu halten kostet nichts Messbares.
5. **Ein natives Modul mehr.** `better-sqlite3` müsste wie `keytar` für jede
   Electron-Version neu gebaut werden. `node:sqlite` braucht das nicht, setzt
   aber eine Electron-Version voraus, deren Node es mitbringt.

## Ab welcher Größe was

Faustregeln, keine Messung. Wer eine Schwelle erreicht, misst nach, bevor er
umbaut.

| Daten | Empfehlung |
|---|---|
| Projektdatei | **Immer JSON**, auch bei 10 bis 20 MB. Die Punkte 2 und 3 wiegen schwerer als die Geschwindigkeit. |
| Eingebauter Katalog bis ca. 5.000 Geräte | JSON/TypeScript reicht. |
| Eigene Bibliothek ab ca. 2.000 bis 5.000 Einzeldateien | Das Durchsuchen des Ordners beim Start wird spürbar, unter Windows mit Virenscanner besonders. Dann eine lokale SQLite als Index im Hauptprozess; die JSON-Dateien bleiben Quelle bzw. Export. |
| Offline-Stand der gemeinsamen Bibliothek ab ca. 5.000 bis 10.000 Geräten | `localStorage` wird zu eng (wenige MB je Ursprung, jedes Mal ganz gelesen und geschrieben). Dann eine lokale SQLite im Hauptprozess, im Browser IndexedDB. Der Abgleich über `seq` bleibt unverändert. |
| Bestand, Ausgaben, Rückgaben, Umlagerungen, Schadensverlauf (inventory-planner) | **SQLite von Anfang an**, siehe unten. |

## Die gemeinsame Bibliothek, wenn der Server fehlt

Umgesetzt am 2026-09-28 (`larszu/av-device-library#6`, cable-planner#947 und
die gleichnamigen PRs in light-, multicam-, inventory-planner und
Broadcast-intercom). Die Regel steht einmal in `syncFrom` im gemeinsamen Client
und gilt in jedem Planer gleich:

1. Den Offline-Stand ändert nur eine erfolgreiche Antwort. Offline, eine
   Zeitüberschreitung (15 s, beim Hochladen 120 s), ein Serverfehler, eine
   abgelaufene Anmeldung oder das Abmelden lassen ihn stehen.
2. Jede Server-Adresse hat ihren eigenen Platz. Wer auf einen Ersatzserver
   wechselt und zurück, verliert nichts.
3. Kennt der Server weniger als gemerkt (kleineres `latestSeq`), wird alles neu
   geholt. Ein leerer, frisch aufgesetzter Server ersetzt den Stand nicht,
   sondern meldet `server-empty`.

## Noch offen — Entscheidungen des Eigentümers

- **Katalog im Installer mitliefern.** Ein Release-Workflow könnte
  `/api/sync?after=0` als Startstand samt `latestSeq` ins Paket legen; der erste
  Abgleich holt dann nur noch den Rest. Voraussetzung: Die freigegebenen Geräte
  müssen ohne Konto lesbar sein. Heute sind sie es nicht. Damit ein Release auch
  bei abgeschaltetem Server baut, sollte ein geplanter Workflow den Stand
  regelmäßig ins Repo legen und der Release von dort lesen, nicht live vom
  Server.
- **Eine Kopie außerhalb des Servers.** Der Server sichert täglich per
  `VACUUM INTO` und hält die letzten sieben Stände, aber auf demselben
  Rechner. Ein regelmäßiger öffentlicher Export aller freigegebenen Geräte
  (Release-Asset oder GitHub Pages) wäre zugleich Sicherung, Quelle für den
  Installer-Stand und Ausweichadresse für die Planer.
- **inventory-planner auf SQLite.** Dort liegt alles in `localStorage`, als
  JSON-Blöcke, die bei jeder Änderung ganz neu geschrieben werden. Der
  Electron-Hauptprozess bietet bewusst kein IPC an. Belege wachsen stetig und
  erreichen die Grenze von `localStorage` zuerst. Außerdem brauchen sie
  Abfragen („was ist draußen, bei wem, fällig wann“) und Änderungen an mehreren
  Stellen zugleich (Beleg, Bestand, Ort). Der Weg wäre:
  - SQLite im Hauptprozess mit `inventory:*`/`checkout:*`-IPC; das hebt die
    Entscheidung „kein IPC“ auf.
  - Für die Web-Ausgabe SQLite als WebAssembly auf OPFS, oder dort nur lesen.
  - `avplan-inventory` bleibt das Austauschformat; der Bestand aus
    `localStorage` wird einmal übernommen.
