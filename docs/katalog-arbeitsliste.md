# Gerätekatalog: die Arbeitsliste (#878)

Stand 2026-09-24. Maschinenlesbar in
[`scripts/katalog-arbeitsliste.json`](../scripts/katalog-arbeitsliste.json).

## Wozu sie da ist

**Die Namen kommen aus der EasySchematic-Datenbank, die Daten aus den
Herstellerblättern.** Das ist die Regel, die #878 von Anfang an nennt — und
sie hat einen Grund, der sich an einem Zwischenstand gezeigt hat: es gab einen
Versuch, die Werte gleich mit zu übernehmen (4053 Einträge, 44 376
Anschlüsse). Der ist zurückgenommen. Eine Portzahl aus zweiter Hand steht im
Plan genauso da wie eine nachgesehene, und der Unterschied fällt erst auf,
wenn jemand vor dem Rack steht.

Ein **Gerätename** ist dagegen keine Messung, sondern eine Auskunft darüber,
was es gibt. Ihn abzulesen ist genau der Zweck einer Lückenliste.

## Der Stand

| | |
|---|---:|
| Offene Modelle | **3932** |
| Hersteller mit offenen Modellen | **429** |
| Bereits im Katalog (namensgleich) | 121 |

## Die dreißig größten Posten

„Offen" heißt: die Datenbank führt das Modell, unser Katalog nicht.
„Vorhanden" heißt: namensgleich schon da.

| Hersteller | Offen | Vorhanden | Kategorien dort |
|---|---:|---:|---|
| Extron | 931 | 0 | Amplifiers, Audio, Audio I/O |
| Blackmagic Design | 146 | 15 | Audio I/O, Control, Displays |
| JBL | 135 | 0 | Powered Mixers, Speakers |
| Crestron | 97 | 0 | Amplifiers, Audio Expansion, Audio I/O |
| Yamaha | 77 | 5 | Amplifiers, Audio, Audio I/O |
| Martin Audio | 72 | 0 | Amplifiers, Audio, Speakers |
| Allen & Heath | 66 | 1 | Audio, Audio Expansion, Audio I/O |
| QSC | 61 | 0 | Amplifiers, Audio, Audio Expansion |
| Shure | 54 | 8 | Amplifiers, Audio, Audio I/O |
| BSS | 52 | 0 | Audio, Audio I/O, Control |
| Ubiquiti | 50 | 0 | Amplifiers, Control, Infrastructure |
| Biamp | 45 | 0 | Amplifiers, Audio, Audio I/O |
| Fulcrum Acoustic | 43 | 0 | Amplifiers, Audio, Speakers |
| Crown | 42 | 0 | Amplifiers, Audio |
| Evertz | 42 | 0 | Control, Expansion Cards, Infrastructure |
| Behringer | 38 | 6 | Amplifiers, Audio, Audio I/O |
| Sonifex | 38 | 0 | Audio, Audio I/O, Control |
| WyreStorm | 36 | 0 | Amplifiers, Audio, Cable Accessories |
| AMX | 33 | 0 | Control, KVM / Extenders, Networking |
| Genelec | 32 | 0 | Speakers |
| Novastar | 30 | 1 | Expansion Cards, LED Video |
| LAWO | 30 | 0 | Audio, Audio I/O, Control |
| AVMATRIX | 29 | 0 | Displays, Distribution, Networking |
| Sennheiser | 28 | 0 | Audio I/O, Codecs, Microphones |
| Epson | 24 | 0 | Peripherals, Projection, Projector Lenses |
| Lightware | 23 | 0 | Control, Expansion Cards, KVM / Extenders |
| Barco | 20 | 1 | Codecs, Expansion Cards, Processing |
| Cisco | 20 | 0 | Codecs, Control, Expansion Cards |
| Kramer | 20 | 0 | Audio I/O, Control, Distribution |
| Netgear | 20 | 2 | Network Switches, Networking, Switching |

Zwei Zahlen, die auffallen: **Ubiquiti steht mit 50 offenen Modellen da,
obwohl wir einen Ubiquiti-Katalog führen** — unsere 39 Einträge und ihre 50
überschneiden sich namentlich nicht. Und **Blackmagic mit 146 offenen gegen 15
vorhandene**: unser Katalog deckt die Mischer und Wandler ab, ihrer die
Zuspieler, Monitore und Erweiterungskarten.

## Wie ein Eintrag entsteht

1. **Namen aus der Liste nehmen.** Die JSON-Datei führt sie je Hersteller.
2. **Datenblatt beim Hersteller holen.** Direkt (`curl`), nicht über einen
   Abhol-Dienst — siehe den Abschnitt unten.
3. **Portliste, Signaltypen und Leistungsaufnahme abschreiben.** Was das Blatt
   nicht nennt, kommt nicht in den Eintrag
   (`docs/device-identity-concept.md`). Nennt es nur Spannung und Strom, steht
   genau das da und keine gerechnete Wattzahl.
4. **`manufacturerUrl` auf genau das Blatt setzen**, aus dem die Zahlen
   stammen — nicht auf die Produktseite, wenn die Tabelle im PDF steht.
5. Katalog in `deviceTypeRegistry`, `catalogueEvidence` und die
   Bibliotheks-Saat eintragen, Wächter-Zahlen nachziehen.

## „Nicht erreichbar" ist oft „mit diesem Werkzeug nicht erreichbar"

`docs/katalog-luecken.md` hielt fest, die Datenblätter von `decimator.com`
seien gesperrt. Ein direkter Abruf kommt durch; nur der Web-Abholdienst
scheitert an der **Zertifikatskette**. Der Irrtum hat einen Bereich stehen
lassen, den #878 beim Namen nennt.

**Vor jedem „geht nicht" also ein direkter Abruf.** Gemessen am 2026-09-24:

| Domäne | direkt |
|---|---|
| `decimator.com` | 200 |
| `bromptontech.com` | 200 |
| `clearcom.com` | 200 |
| `riedel.net` | 200 |
| `megapixelvr.com` | 200 |
| `www.novastar.tech` | 200 (ohne `www.` scheitert die Auflösung) |
| `netgear.com` | 200 |
| `lightware.com` | 200 |
| `kramerav.com` | 200 |

**Eine Ausnahme, die nicht am Netz liegt:** `riedel.net` antwortet mit 200,
aber **jede** Datenblatt-Adresse unter `/fileadmin/…` gibt 404 — auch die,
die eine Suche gerade zurückgeliefert hat. Die Downloads laufen dort über
JavaScript, die Pfade im Suchindex sind veraltet. Wer Riedel aufnimmt, holt
die PDFs von Hand aus dem Download-Center.

## Was schon erledigt ist

| Bereich | Katalog | Einträge | Beleg |
|---|---|---:|---|
| Konverter, Multiviewer | `decimatorCatalog.ts` | 8 | Broschüren-PDF je Gerät |
| LED-Prozessoren | `ledProcessorCatalog.ts`, `bromptonCatalog.ts` | 7 | Datenblatt-PDF je Gerät |
| Intercom | `clearcomCatalog.ts` | 4 | Encore-Handbuch je Gerät |
| Netzwerk (Tour) | `luminexCatalog.ts` | 6 | GigaCore-Spezifikationsblatt |
| Netzwerk (Installation) | `netgearAvCatalog.ts` | 7 | M4250-Datenblatt |
| Konverter | `lightwareCatalog.ts` | 2 | Produkt-Kurzblatt je Gerät |

Der Bereich, den #878 als den einzigen **leeren** benannt hat, ist damit der
einzige, der **vollständig belegt** ist.

**Alle fünf Zielbereiche stehen jetzt auf mindestens zwei Häusern.** Der
zweite Satz des Befundes — „ein Bereich mit einem Hersteller ist kein
bestückter Bereich" — ist damit erledigt.

| Zielbereich | Einträge | belegt | Häuser |
|---|---:|---:|---|
| Kameras | 385 | 377 | 2 Kataloge |
| Konverter | 36 | 36 | 6 |
| Netzwerk | 94 | 88 | 6 |
| LED-Prozessoren | 7 | 7 | 2 |
| Intercom | 12 | 10 | 2 |

## Was als Nächstes drankommt

Nach dem Zuschnitt von #878 und der Messung:

- **Intercom** — hängt bei uns an GreenGo allein. Clear-Com (11 offen),
  Riedel (4). Beide Domänen erreichbar.
- **Netzwerk** — Cisco (20), Netgear (32 über zwei Schreibweisen),
  Luminex (11).
- **Konverter** — Lightware (23), Kramer (20), WyreStorm (37), Blustream (19).
- **Neu aus der Messung, in #878 nicht genannt:** Steuerung (Extron 931,
  Crestron 97, AMX 33) und Lautsprecher/Verstärker (JBL 135, Martin Audio 72,
  QSC 61, BSS 52, Biamp 45). Zwei Bereiche, in denen ein Integrator arbeitet
  und wir bei null stehen. Ob sie zu den Zielkunden gehören, ist eine
  Produktentscheidung — die Messung sagt nur, dass sie fehlen.

Extron allein ist fast ein Viertel der Liste. Wer dort anfängt, sollte wissen,
dass er lange dort bleibt.
