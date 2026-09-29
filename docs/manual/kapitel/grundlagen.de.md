## Erste Schritte

### Installation

Das Installationsprogramm liegt im
[neuesten Release](https://github.com/larszu/cable-planner/releases/latest):

- **macOS**: `.dmg` für Apple Silicon und Intel
- **Windows**: `.exe`

Die App läuft vollständig offline. Internet braucht nur die Gerätebibliothek,
die Cloud-Kopie und die Live-Sitzung über Netzgrenzen hinweg.

Ohne Installation läuft die Web-Ausgabe unter
**https://larszu.github.io/cable-planner/** (was sie nicht kann: Kapitel 21).

### Erstes Projekt

- **Datei → Neues Projekt** beginnt einen leeren Plan. **Öffnen…**,
  **Speichern** und **Speichern unter…** wie gewohnt; die Liste der letzten
  Projekte füllt sich selbst.
- Ein Projekt ist eine einzelne JSON-Datei (`.cableplan`). Sie lässt sich mit
  git versionieren und wie Text vergleichen.
- Während der Arbeit schreibt die App alle paar hundert Millisekunden eine
  Sicherungskopie. Wird das Projekt größer als dieser Speicher (etwa 5 MB),
  zeigt die Statusleiste **„Keine Sicherungskopie"** mit der Projektgröße —
  dann in eine Datei speichern. Der Plan selbst ist davon nicht betroffen.
- Rückgängig und Wiederholen reichen 100 Schritte zurück.

![Der Canvas](../screenshots/hero.png)
