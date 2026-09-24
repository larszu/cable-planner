# Gerätekatalog: die EasySchematic-Übernahme (#878)

Gemessen am 2026-09-24 gegen `https://api.easyschematic.live/templates`.

## Was passiert ist

Die erste Fassung dieses Papiers war eine **Lückenliste**: was führt
EasySchematic, das uns fehlt. Am selben Tag hat der Eigentümer entschieden,
den Katalog vollständig zu übernehmen — Geräte und Kategorien. Dieses Papier
hält seither fest, **was übernommen wurde und unter welchen Vorbehalten**.

| | vorher | nachher |
|---|---:|---:|
| Katalog-Einträge | 1802 | **5784** |
| davon mit Datenblatt-Link | 1616 (89,7 %) | 1616 (**27,9 %**) |
| Kategorien | 16 | **55** |
| Steckertypen | 60 | **113** |

Die Beleg-Abdeckung **fällt**, und das ist die ehrliche Zahl: eine Portliste
aus einer Gemeinschafts-Datenbank ist eine andere Auskunft als eine aus dem
Blatt des Herstellers. `easySchematicCatalog.ts` trägt deshalb die
`BELEGLAGE`-Zeile und steht in der Liste der beleglosen Kataloge.

## Zur Lizenz

EasySchematic steht unter **AGPL-3.0**, cable-planner ist proprietär
lizenziert. Der Eigentümer hat die Übernahme am 2026-09-24 ausdrücklich
angewiesen, nachdem auf den Konflikt hingewiesen wurde. Die Herkunft steht
im Kopf der erzeugten Datei und in jedem Eintrag dieses Papiers:

> Quelle: EasySchematic-Gemeinschaftsdatenbank,
> `https://api.easyschematic.live/templates`, Projekt
> `https://github.com/duremovich/EasySchematic` (AGPL-3.0).

**Was noch zu klären ist:** AGPL-3.0 §5c verlangt, dass ein Werk, das
abgeleitetes Material enthält, als Ganzes unter derselben Lizenz steht; §13
verlangt zusätzlich die Quelltext-Herausgabe an jeden Nutzer einer
gehosteten Fassung. Ob die *Inhalte* der über die API ausgelieferten
Datenbank überhaupt unter die Software-Lizenz des Projekts fallen, ist
strittig — Tatsachen über fremde Hardware sind nicht urheberrechtlich
geschützt, die Zusammenstellung einer Datenbank in der EU dagegen schon
(Datenbankrecht, 15 Jahre). Diese Frage gehört zu einem Anwalt und nicht in
einen Commit; festgehalten ist sie hier, damit sie nicht untergeht.

## Was übernommen wurde

- **3982 Geräte** (von 4053; 71 mit doppeltem oder leerem Namen ausgelassen)
- **44 376 Anschlüsse** mit Richtung, Signalart und Steckertyp — der **erste
  übernommene Katalog mit echten Anschlüssen**. Kameras, Objektive und Rigs
  kamen mit `portsUnknown`, weil ihre Quellen keine Buchsen kennen.
- **39 neue Kategorien**: `Amplifiers`, `Audio Expansion`, `Audio I/O`, `Cloud Services`, `Codecs`, `Control`, `Controllers`, `DMX Splitter`, `Distribution`, `Expansion Cards`, `Firewalls`, `Headphone Amplifier`, `Infrastructure`, `Intercom`, `KVM / Extenders`, `LED Video`, `Management Platforms`, `Media Players`, `Media Servers`, `Monitoring`, `Network Switches`, `Peripherals`, `Power Amplifier`, `Powered Mixers`, `Processing`, `Processors`, `Projection`, `Projector Lenses`, `Projectors`, `Recording`, `Sources`, `Speakers`, `Storage`, `Storage Media`, `Switching`, `User Interfaces`, `Video Switchers`, `Windowing Processors`, `Wireless`
- **53 neue Steckertypen.** Zwei stechen heraus: `Phoenix/Euroblock` und
  `Terminal Block` sind mit zusammen **9513 Anschlüssen** der häufigste
  Stecker der ganzen Datenbank — Schraubklemmen, das Brot der Installation.
  Dass wir sie bis heute nicht kannten, sagt mehr über unseren bisherigen
  Zuschnitt als über die Stecker.

## Die drei Entscheidungen, die die Übersetzung geprägt haben

**Die Richtung.** `input` und `bidirectional` werden Eingänge, `output` und
`passthrough` Ausgänge. Unser Modell trennt Ein- und Ausgang; ihres kennt
zusätzlich die beidseitige Buchse. Eine RJ45 am Switch *ist* beides — sie in
beide Listen zu legen hätte jeden Switch mit der doppelten Portzahl gezeigt,
und das wäre eine Falschaussage in jeder Stückliste.

**Der Rückfall.** 2276 Anschlüsse (5 %) stehen auf `Custom`, weil die
Abbildungstabelle ihren Steckertyp nicht kennt — fast alle sind in der Quelle
selbst leer, `none` oder `other`. Den nächstbesten Stecker zu nehmen wäre eine
Falschaussage in der Patchliste; `Custom` ist eine Lücke, die auffällt.

**Die Kategorien behalten ihre Namen.** Sie in unsere sechzehn zu pressen
hätte sie unsichtbar gemacht: „KVM / Extenders", „Expansion Cards" und
„Windowing Processors" hätten alle „Other" geheißen. Wo wir schon einen
Bereich führen, wird abgebildet statt verdoppelt (`Mixing Consoles` →
`Mixing console`, `Displays` → `Monitors`, `PTZ Camera` → `Cameras`); ihre
zwei Tippfehler (`VIdeo`, `audio`) werden dabei geheilt.

## Ein Fund am Rande, der wichtiger ist als die Übernahme

Die ausgelieferten Vorlagen wurden bis heute in `localStorage` geschrieben.
Gemessen: 5315 Vorlagen sind als JSON **4,38 MB**, und das Kontingent liegt
in den meisten Browsern bei 5 MB für den ganzen Ursprung — geteilt mit
Projekt-Autosave, Einstellungen und Offline-Zwischenspeicher. Der
Schreibversuch wäre an `QuotaExceededError` gescheitert, und das `catch` in
`persistCustomLibrary` hätte ihn **verschluckt**: die Bibliothek wäre still
auf dem alten Stand geblieben.

Sie kommen jetzt aus ihrem Modul und sind damit immer da. `localStorage` hält
nur noch die Vorlagen des Nutzers. Damit entfällt auch der
Migrations-Umweg, dessen einziger Zweck war, einem Bestandsnutzer neue
Katalog-Einträge überhaupt zu zeigen.

## Nachziehen

```bash
curl -s https://api.easyschematic.live/templates -o scripts/easyschematic-templates.json
npm run katalog:uebernahme
```

Die rohe Datei ist in `.gitignore` — sie ist Eingangsdatum des Generators, 8 MB
groß und trägt fremde Suchbegriffe. Eingecheckt wird das Ergebnis.
Die Abbildungstabelle der Stecker, Signalarten und Kategorien steht in
`scripts/easyschematic-vokabular.mjs` und ist Zeile für Zeile prüfbar.
