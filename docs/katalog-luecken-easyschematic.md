# Gerätekatalog: die Lücke gegen EasySchematic (#878)

Gemessen am 2026-09-24 gegen `https://api.easyschematic.live/templates/summary`.
Nachrechnen: das Messskript steht am Ende dieses Papiers.

## Warum dieses Papier und keine Übernahme

EasySchematic steht unter **AGPL-3.0**, cable-planner ist **proprietär** lizenziert.
Kopierte Quell- oder Datendateien verlangen über §5c, cable-planner *als Ganzes*
unter AGPL-3.0 zu stellen — einschließlich §13, also Quelltext-Herausgabe an
jeden, der die gehostete Fassung benutzt. Das träfe auch die GitHub-Pages-Ausgabe
und jedes Release.

Deshalb steht hier, **was fehlt**, und nicht, **was dort steht**. Welche Hersteller
und Geräteklassen es gibt, ist eine Tatsache und keine Schöpfung; die
Zusammenstellung ihrer Datenbank ist geschützt (in der EU zusätzlich als
Datenbankwerk, 15 Jahre). Aus diesem Papier wird recherchiert, nicht kopiert:
**die Werte kommen aus dem Herstellerdatenblatt**, so wie #878 es verlangt.

## Der Stand

| | EasySchematic | cable-planner |
|---|---:|---:|
| Einträge | 4053 | 1802 |
| Hersteller | 428 | — |
| Hersteller, die uns ganz fehlen | 361 | |
| Namensgleiche Geräte auf beiden Seiten | 113 | |

Drei Befunde, die ohne die Rechnung nicht sichtbar waren:

1. **Der Abstand ist kleiner geworden, aber die ÜBERSCHNEIDUNG ist winzig.**
   1802 gegen 4053 ist ein Faktor 2,2 — vor der Übernahme aus den
   Schwester-Planern war es 8,6. Namensgleich sind aber nur
   113 Geräte, also 6 % unseres Katalogs. Die beiden
   Kataloge decken fast **verschiedene Welten** ab: hier Kamera, Objektiv,
   Licht, Mikrofon — dort Installations-AV.

2. **Ein einziger Hersteller macht bei ihnen fast ein Viertel aus.** Extron
   allein steht mit 931 Geräten da. Das ist keine breite Datenbank, sondern
   eine sehr tiefe an wenigen Stellen — dieselbe Schieflage, die #878 uns
   mit „über ein Drittel Mikrofone" vorgeworfen hat, nur an anderer Stelle.

3. **Die größten Kategorien dort sind die, die wir gar nicht führen.**
   Lautsprecher, Steuerung, KVM/Extender, Erweiterungskarten — dafür gibt es
   bei uns keine Kategorie, nicht bloß wenige Einträge.

## Wo die Lücke sitzt — nach Kategorie (deren Zählung)

| Kategorie | Geräte |
|---|---:|
| Speakers | 507 |
| Control | 395 |
| Switching | 319 |
| Networking | 308 |
| Expansion Cards | 255 |
| KVM / Extenders | 232 |
| Processing | 226 |
| Amplifiers | 206 |
| Audio I/O | 204 |
| Sources | 201 |
| Infrastructure | 184 |
| Audio | 165 |
| Lighting | 110 |
| Mixing Consoles | 98 |
| Displays | 90 |
| Microphones | 83 |
| Distribution | 63 |
| Cable Accessories | 59 |
| Projection | 56 |
| Wireless | 38 |
| LED Video | 37 |
| Intercom | 37 |
| Codecs | 35 |
| Recording | 33 |
| Media Servers | 22 |

## Die vierzig größten fehlenden Hersteller

Ein Haus in dieser Liste heißt: wir führen **kein einziges** Gerät von ihm.

| Hersteller | Geräte dort | Kategorien dort |
|---|---:|---|
| Extron | 931 | Amplifiers, Audio, Audio I/O, Cable Accessories |
| JBL | 135 | Powered Mixers, Speakers |
| Crestron | 97 | Amplifiers, Audio Expansion, Audio I/O, Cable Accessories |
| Martin Audio | 72 | Amplifiers, Audio, Speakers |
| Allen & Heath | 67 | Audio, Audio Expansion, Audio I/O, Expansion Cards |
| QSC | 61 | Amplifiers, Audio, Audio Expansion, Audio I/O |
| BSS | 52 | Audio, Audio I/O, Control, KVM / Extenders |
| Biamp | 45 | Amplifiers, Audio, Audio I/O, Codecs |
| Fulcrum Acoustic | 43 | Amplifiers, Audio, Speakers |
| Evertz | 42 | Control, Expansion Cards, Infrastructure, Recording |
| Sonifex | 38 | Audio, Audio I/O, Control, Distribution |
| WyreStorm | 36 | Amplifiers, Audio, Cable Accessories, Control |
| AMX | 33 | Control, KVM / Extenders, Networking, Switching |
| Genelec | 32 | Speakers |
| LAWO | 30 | Audio, Audio I/O, Control, Displays |
| AVMATRIX | 29 | Displays, Distribution, Networking, Processing |
| Epson | 24 | Peripherals, Projection, Projector Lenses, Projectors |
| Lightware | 23 | Control, Expansion Cards, KVM / Extenders, Networking |
| Cisco | 20 | Codecs, Control, Expansion Cards, Microphones |
| Kramer | 20 | Audio I/O, Control, Distribution, KVM / Extenders |
| Disguise | 20 | Expansion Cards, Media Servers |
| Blustream | 19 | Audio, Audio I/O, Control, Distribution |
| Ecler | 19 | Amplifiers, Audio, Audio I/O, Control |
| EVS | 18 | Control, Expansion Cards, Infrastructure, Recording |
| Zoom | 17 | Audio I/O, Expansion Cards, Mixing Consoles, Recording |
| ESI | 16 | Audio I/O, Control |
| Samsung | 16 | Displays, LED Video, Storage |
| Pixera | 15 | Expansion Cards, Sources |
| Yealink | 15 | Audio, Audio I/O, Codecs, Control |
| Analog Way | 14 | Control, Expansion Cards, LED Video, Processing |
| Presonus | 14 | Audio, Audio I/O, Control, Mixing Consoles |
| JBL Professional | 14 | Audio, Speakers |
| Meyer Sound | 14 | Audio, Speakers |
| Visionary Solutions | 12 | Networking, Processing |
| d&b audiotechnik | 12 | Amplifiers, Audio, Speakers |
| L-Acoustics | 12 | Amplifiers, Audio, Networking, Speakers |
| K-Array | 12 | Speakers |
| WolfVision | 12 | Codecs, Sources, Wireless |
| L'Acoustics | 12 | Amplifiers, Speakers |
| Sharp | 11 | Cable Accessories, Displays, Projection |

## Arbeitsliste, nach dem Zuschnitt von #878

#878 nennt die Reihenfolge: „Kameras, Konverter (AJA, Blackmagic, Decimator),
Netzwerk, LED-Prozessoren, Intercom". Gegen diese Messung gehalten:

- **Kameras** — erledigt (20 → 385). Kein weiterer Bedarf aus dieser Liste:
  EasySchematic führt Kameras fast nur als PTZ.
- **Konverter** — Decimator fehlt weiterhin vollständig, obwohl #878 die Marke
  ausdrücklich nennt. Dazu Lightware (23), Kramer, WyreStorm, Blustream.
- **Netzwerk** — Cisco, Netgear, Luminex. Bei uns hängt der Bereich an Ubiquiti.
- **LED-Prozessoren** — zwei Einträge. Novastar, Brompton, Megapixel.
- **Intercom** — hängt bei uns an GreenGo allein. Clear-Com, Riedel.

**Neu aus dieser Messung, in #878 noch nicht genannt:** Steuerung
(Crestron, AMX, Extron) und Lautsprecher/Verstärker (JBL, QSC, Martin Audio,
Genelec, Biamp, BSS). Das sind die zwei Bereiche, in denen ein Integrator
arbeitet und in denen wir bei null stehen. Ob sie zu den Zielkunden gehören,
ist eine Produktentscheidung — die Messung sagt nur, dass sie fehlen.

## Was je Eintrag hineingehört

Unverändert aus #878: **Portliste mit Signaltypen, Leistungsaufnahme und
`manufacturerUrl` auf das Blatt, aus dem beides stammt.** Ein Eintrag ohne
Datenblatt ist kein halber Fortschritt: `catalogueEvidence` zählt ihn als
unbelegt, und die Portzahl stünde im Plan, als hätte der Hersteller sie
genannt.

## Nachrechnen

```bash
curl -s https://api.easyschematic.live/templates/summary -o /tmp/es-sum.json
```

Das Skript, das diese Tabellen erzeugt hat, steht in der Sitzung vom
2026-09-24; es liest `summary` (Bezeichner, Hersteller, Kategorie) und die
`CATALOGUES`-Liste aus `lib/catalogueEvidence.ts`, gleicht Hersteller über
eine kleine Alias-Tabelle ab (`Blackmagic Design` = `Blackmagic`) und zählt.
Übernommen wird daraus nichts außer den Zahlen in diesem Papier.


## Nachtrag 2026-09-24: der Versuch, es abzukürzen

Es gab einen Zwischenstand, in dem die 4053 Einträge samt ihrer 44 376
Anschlüsse aus der API **übernommen** wurden. Das war falsch und ist
zurückgenommen (`git revert`). Der Auftraggeber hat es in einem Satz
korrigiert:

> „du sollst das aus dem hersteller datenblatt nehmen, nicht aus der
> datenbank!"

Genau das steht oben in diesem Papier und in #878 seit dem ersten Tag. Der
Unterschied ist nicht formal: eine Portzahl aus zweiter Hand steht im Plan
genauso da wie eine nachgesehene. Die Beleg-Abdeckung wäre von 89,7 % auf
27,9 % gefallen — das war das Symptom, nicht der Preis.

**Was der Fehlversuch trotzdem gebracht hat**, weil es gemessen wurde und
unabhängig gilt:

- Die ausgelieferten Vorlagen werden in `localStorage` geschrieben. 5315
  Vorlagen sind als JSON **4,38 MB** gegen ein Kontingent von etwa 5 MB für
  den ganzen Ursprung — und `persistCustomLibrary` verschluckt den
  Fehlschlag. Heute sind es 1810 Vorlagen (~0,4 MB), die Grenze ist also
  nicht erreicht; sie kommt mit jedem Katalog näher.
- `Phoenix/Euroblock` und `Terminal Block` sind in ihrer Datenbank mit
  zusammen 9513 Anschlüssen der häufigste Stecker überhaupt. Wir führen
  beide nicht. Das ist eine Lücke in unserem **Stecker**-Vokabular, die
  keine Gerätezählung zeigt — und der erste Eintrag für die Arbeitsliste,
  sobald Installations-AV drankommt.

## Erster Schritt nach dieser Liste: Decimator

`decimatorCatalog.ts`, acht Geräte, jedes mit dem Broschüren-PDF als Beleg:
MD-HX, MD-LX, MD-CROSS, MD-DUCC, MD-QUAD, DMON-QUAD, DMON-6S, DMON-12S.
Dabei ist die Behauptung aus `katalog-luecken.md` gefallen, `decimator.com`
sei nicht erreichbar — ein direkter Abruf kommt durch; nur der
Web-Abholdienst scheitert an der Zertifikatskette.

Drei Modelle fehlen weiterhin: für `MD-LX-12G`, `MD-HX-12G` und `DMON-4K`
gibt es unter `brochures/` kein PDF (404, gemessen). Ohne Blatt kein Eintrag.
