# Gerätekatalog: wo die Lücken sind (#878)

Gemessen am 2026-09-19 von `src/renderer/lib/katalogLuecken.ts`;
`tests/katalogLuecken.test.ts` hält die Zahlen fest. Dieses Papier begründet
sie und sagt, was als Nächstes hineingehört — es rechnet nicht selbst.

## Stand 2026-09-27

| Zielbereich (#878) | Einträge | davon mit Datenblatt | Kataloge |
|---|---:|---:|---|
| Kameras | 20 | 19 | `camera` |
| Konverter | 33 | 33 | `aja`, `blackmagic`, `broadcastTools`, `decimator`, `lightware`, `lynx`, `misc` |
| Netzwerk | 90 | 90 | `aja`, `avNetwork`, `blackmagic`, `luminex`, `misc`, `netgearAv`, `ubiquiti` |
| LED-Prozessoren | 6 | 6 | `brompton`, `ledProcessor` |
| Intercom | 12 | 10 | `clearcom`, `greengo` |

Gesamt 490 Einträge. Die Arbeitsliste unten ist bis auf die Kameras
abgearbeitet (siehe die Häkchen). Die Messung vom 2026-09-19 bleibt als
Ausgangslage stehen.

## Der Stand am 2026-09-19

| Zielbereich (#878) | Einträge | davon mit Datenblatt | Kataloge |
|---|---:|---:|---|
| Kameras | 385 | 377 | `camera`, `cameraBody` |
| Konverter | 34 | 34 | `aja`, `blackmagic`, `broadcastTools`, `decimator`, `lynx`, `misc` |
| Netzwerk | 87 | 81 | `aja`, `avNetwork`, `blackmagic`, `luminex`, `misc`, `ubiquiti` |
| LED-Prozessoren | 7 | 7 | `brompton`, `ledProcessor` |
| Intercom | 12 | 10 | `clearcom`, `greengo` |

Gesamt 1825 Einträge (Stand 2026-09-25), davon 184 Mikrofone — 10,1 % statt
39,4 %.

> **Nachgezogen am 2026-09-25.** Alle drei Befunde von 2026-09-19 sind
> erledigt:
>
> 1. Die Schieflage ist weg. Mikrofone waren 39,4 % und sind 10,1 %; die
>    größte Kategorie sind jetzt die Objektive mit 835 von 1825 (14 % nach
>    Bereichen gerechnet, siehe `katalogLuecken.test.ts`).
> 2. **LED-Prozessoren sind nicht mehr leer** — und ausgerechnet der Bereich,
>    der bei null stand, ist der einzige mit **vollständigem** Beleg (7 von 7).
> 3. **Kein Bereich hängt mehr an einem Haus.** Intercom hatte nur GreenGo und
>    hat jetzt Clear-Com dazu; Netzwerk hatte nur Ubiquiti als
>    Veranstaltungs-Haus und hat jetzt Luminex.

Drei Befunde, die ohne die Rechnung nicht sichtbar waren:

1. **Die Beobachtung im Issue war geschätzt.** „Knapp 1.000 Einträge" sind 467.
   Die Schieflage dagegen stimmt: über ein Drittel Mikrofone, nachgezählt
   39,4 %. Wer gegen die geschätzte Zahl plant, hält den Katalog für doppelt
   so voll, wie er ist.
2. **LED-Prozessoren fehlen ganz.** Nicht dünn besetzt — es gibt die Kategorie
   nicht. Das ist eine andere Auskunft als „wenig gepflegt", und sie fällt nur
   auf, wenn gegen eine Soll-Liste gezählt wird statt die vorhandenen Kataloge
   aufzuzählen.
3. **Zwei Bereiche hängen an je einem Hersteller.** Kameras kommen
   ausschließlich aus `camera`, Intercom ausschließlich aus `greengo`. Ein
   Bereich mit einem Haus ist kein bestückter Bereich.

## Warum hier keine Einträge stehen

#878 verlangt zweierlei: „Lieber Herstellerdatenblätter als Quelle" und
„Prüfung vor Aufnahme (Ports, Signaltypen, Leistungsaufnahme)". Ein Eintrag
ohne Datenblatt wäre deshalb kein halber Fortschritt, sondern ein Rückschritt:
`catalogueEvidence` zählt ihn als unbelegt, die Abdeckung sinkt, und die
Portzahl stünde im Plan, als hätte der Hersteller sie genannt.

Die Datenblätter sind aus der Arbeitsumgebung dieser Sitzung nicht erreichbar:
`blackmagicdesign.com`, `aja.com` und `decimator.com` beantworten den
CONNECT-Versuch mit **403 (policy denial)**, ebenso der Abruf über den
Web-Abholdienst (`EGRESS_BLOCKED`). Nachgemessen am 2026-09-19, nicht vermutet.

> **Berichtigt am 2026-09-24.** Für `decimator.com` stimmte das nicht — oder
> nicht mehr. Ein direkter Abruf kommt durch (`200`, Broschüren-PDFs
> vollständig); nur der Web-Abholdienst scheitert, und zwar an der
> **Zertifikatskette**, nicht an einer Sperre. Das ist der Unterschied
> zwischen „nicht erreichbar" und „mit DIESEM Werkzeug nicht erreichbar", und
> er hat einen Bereich stehen lassen, den #878 ausdrücklich nennt. Acht
> Decimator-Geräte stehen seither im Katalog (`decimatorCatalog.ts`), jedes
> mit der Spezifikationstabelle seines Broschüren-PDFs als Beleg.
>
> Für die anderen beiden Häuser ist die Messung **nicht** wiederholt worden.
> Wer dort weitermacht, prüft zuerst mit einem direkten Abruf nach.

Also steht hier die Messung und die Arbeitsliste — und die Ware kommt, wenn
jemand mit Netzzugang die Blätter öffnen kann. Das ist der Unterschied zwischen
„noch nicht gemacht" und „geraten und als Messung ausgegeben".

## Arbeitsliste, nach Reihenfolge des Issues

Je Eintrag gehören in den Katalog: Portliste mit Signaltypen, Leistungsaufnahme
und `manufacturerUrl` auf das Blatt, aus dem beides stammt.

- [x] **LED-Prozessoren** — der leere Bereich, deshalb zuerst. *Erledigt:
  NovaStar MX40 Pro und Brompton SX40 (#902), Brompton S8/S4/T1/XD (aus #907
  übernommen).* Novastar, Brompton,
  Megapixel. Braucht zusätzlich eine neue Kategorie `LED Processing`;
  `ZIELBEREICHE` nennt sie bereits, damit der Bereich von Anfang an mitgezählt
  wird und nicht erst, wenn jemand daran denkt.
- [x] **Konverter** — Decimator fehlt vollständig (MD-HX, MD-LX, DMON-Serie),
  obwohl #878 die Marke ausdrücklich nennt. *Nachgemessen: MD-HX, MD-LX,
  MD-Cross und die DMON-Reihe standen schon in `misc`/`broadcastTools`;
  MD-DUCC, MD-QUAD und Lightware UCX kamen aus #907 dazu.*
- [x] **Intercom** — neben GreenGo mindestens Riedel und Clear-Com, sonst bleibt
  der Bereich ein Haus. *Clear-Com Encore (MS-702, CS-702, SB-704, RS-702).
  Riedel steht noch aus.*
- [ ] **Kameras** — dieselbe Frage: der Bereich hat 20 Einträge aus genau einem
  Katalog. *Offen: die Übernahme der 365 multicam-Kameras liegt in #907
  (Konflikt mit main, nicht übernommen).*
- [x] **Netzwerk** — der am besten bestückte der fünf; hier reicht das Nachziehen
  der sechs unbelegten Einträge. *Alle belegt; dazu Luminex GigaCore und
  NETGEAR M4250 aus #907. USW-16 ist im USW-16-PoE aufgegangen.*

## Was der Weg für Einreichungen schon kann

`src/renderer/lib/vorlagenEinreichung.ts` (ebenfalls #878) prüft eine
eingereichte Vorlage vor der Aufnahme: Quellenlink ist Pflicht, die
Leistungsaufnahme wird gemeldet und nicht gerechnet. Der Katalog kann also
wachsen, ohne dass jemand die Belegpflicht von Hand durchsetzt.
