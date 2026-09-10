# Screenshot- & GIF-Anleitung (README-Bilder)

Dieser Ordner liefert die Bilder für die Bild-Sektionen im Haupt-README
(Hero + Galerie). Die Slots im README zeigen aktuell **TODO: capture** und
rendern erst, sobald die passend benannten Dateien hier liegen.

> **Bitte keine Fake-Bilder einchecken.** Echte Aufnahmen brauchen die
> laufende GUI — die läuft hier aber unter `xvfb-run`, genau wie für
> `ui:smoke` und `ui:overflow`:
>
> ```bash
> npm run build && npm run docs:shots
> ```
>
> `scripts/screenshots.mjs` startet die App, lädt das eingebaute
> Beispielprojekt, stellt Sprache und Thema fest ein und nimmt die Slots auf.
> **Aus dem Beispielprojekt heißt: keine Kundendaten, also nichts zu
> schwärzen** — die sicherste Schwärzung ist die, die nicht nötig ist.
>
> Hier stand bis 2026-09-10 das Gegenteil („können nicht automatisch erzeugt
> werden"). Ein Satz, der eine Arbeit für unmöglich erklärt, sorgt
> zuverlässig dafür, dass sie liegenbleibt: die eingecheckten Bilder stammen
> aus **v8.1.0-101**, die App steht bei **v9.0.1**. Dazwischen liegen die
> Sprachdrehung (E-28) und der Icon-Durchgang — auf `properties.png` ist
> deshalb eine deutsche Oberfläche mit Knöpfen zu sehen („Configure
> multiviewer layout →", „↻ auto"), die es so nicht mehr gibt.
>
> **Warum die Bilder trotzdem noch die alten sind:** das mitgelieferte
> Beispielprojekt ist deutsch benannt („Kamera 1", „Bildmischer",
> „Regie-Monitor"), und 12 der 64 ausgelieferten Gerätekategorien ebenfalls
> („Funkstrecke", „Stromverteilung", „Sync/Referenz" …). Eine frische
> Aufnahme zeigt daher eine englische Oberfläche mit deutschen Inhalten —
> das ist nicht besser als ein altes Bild, nur anders falsch. Siehe Issue
> zum Sprachmix in den ausgelieferten Daten; danach `docs:shots` laufen
> lassen.

## ⚠️ Pflicht: Kundendaten schwärzen

Die Demo-Pläne enthalten reale Kunden-/Show-Daten. **Vor dem Commit** aus
JEDEM Bild entfernen (schwärzen/zuschneiden):

- **Projekt-/Show-Name**  — erscheint in der
  **Titelleiste** (oben mittig), der **Statusleiste** (unten links) und im
  **Download-Hinweis** des Export-Dialogs.
- **Kunde/Veranstaltungsort** — die **Rentman-Zeile** unten rechts
  (z. B. „Rentman:  …").
- **Personennamen** in Geräte-Labels 

Tipp für eine saubere Aufnahme: vorher ein **Demo-Projekt mit neutralen
Namen** anlegen (Projektname z. B. „Demo Show", Rentman-Integration in den
Einstellungen deaktivieren → Rentman-Zeile verschwindet). Dann muss kaum
nachträglich geschwärzt werden.

## Bilder liefern — zwei Wege

1. **Roh-PNGs pushen, Schwärzung übernimmt das Repo-Tooling:** Lege die
   unbearbeiteten Aufnahmen unter `docs/screenshots/_raw/` ab und committe
   sie auf den Feature-Branch. Die Kundennamen werden dann mit `sharp`
   geschwärzt, als saubere Dateien (s. u.) gespeichert und die Rohbilder
   wieder entfernt.
2. **Fertig geschwärzt liefern:** Schon bereinigte Bilder direkt unter den
   Zieldateinamen (s. u.) ablegen.

## Zieldateien (Namen exakt so)

| Datei                 | Inhalt                                   | Format / Größe (Richtwert)        |
| --------------------- | ---------------------------------------- | --------------------------------- |
| `hero.png`            | Canvas-Gesamtüberblick (Dark-Theme)      | PNG, ~1600×900 (16:9), < 600 KB   |
| `canvas.gif`          | Kurze Canvas-Interaktion (Drag/Verbinden)| GIF, ~1200×750, < 4 MB, 6–10 s    |
| `rack-3d.png`         | 3D-Rack-Ansicht im Rack-Builder          | PNG, ~1400×900                    |
| `atem-multiview.png`  | ATEM-Multiview-Layout-Editor             | PNG, ~1400×900                    |
| `export.png`          | „Exportieren & Drucken" — Plan-Tab        | PNG, ~1400×900                    |
| `patch-sheets.png`    | Patch-Sheets-Tab (Geräteauswahl)         | PNG, ~1400×900                    |
| `patch-pdf.png`       | Generiertes Patch-Listen-PDF (Inputs/Outputs) | PNG, ~1200×1600 (Hochformat)  |
| `bom.png`             | Standort-Stückliste (BOM-Dialog)         | PNG, ~1400×900                    |
| `properties.png`      | Eigenschaften-Panel (Gerät/Standort)     | PNG, ~1200×900                    |

Empfehlung: PNGs vor dem Commit durch eine Kompression schicken (z. B.
`pngquant` / `oxipng`) damit das Repo schlank bleibt.

## Mapping der bereits gelieferten Screenshots → Slots

Aus den im Chat gelieferten Aufnahmen passen (nach Schwärzung):

- Canvas + Eigenschaften-Panel → **`hero.png`** (+ ggf. `properties.png`)
- „Exportieren & Drucken" / Plan → **`export.png`**
- Patch-Sheets-Dialog → **`patch-sheets.png`**
- Patch-Listen-PDF → **`patch-pdf.png`**
- Standort-Stückliste → **`bom.png`**

Noch offen (keine Vorlage geliefert): **`canvas.gif`**, **`rack-3d.png`**,
**`atem-multiview.png`** → frisch aus einem neutralen Demo-Projekt aufnehmen.

## GIF aufnehmen (canvas.gif)

- macOS: Kap / CleanShot X; Windows: ScreenToGif.
- Auf den Canvas-Bereich beschränken, 6–10 s, ein Gerät platzieren + ein
  Kabel ziehen, damit die Interaktivität sichtbar wird.
- Auf < 4 MB optimieren (Framerate 12–15 fps, Farbreduktion), sonst lädt das
  README träge.
