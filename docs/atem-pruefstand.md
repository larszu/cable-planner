<!--
  lizenzaussage: fremd

  Diese Seite nennt die Lizenz eines FREMDEN Projekts (Swift-Atem, MIT). Das
  LICENSE dieses Repos sagt "proprietär", und der Waechter in
  `tests/lizenzaussage.test.ts` faengt genau die Verwechslung ab, dass ein
  Dokument den Eindruck erweckt, DIESER Code stuende unter einer
  Open-Source-Lizenz. Hier ist die Angabe die Auskunft, die der Leser braucht:
  ob er den Emulator ueberhaupt benutzen darf.
-->

# Der Prüfstand: den Mischer schalten, ohne die Anlage anzufassen

Wer prüfen will, ob ein geschalteter Weg wirklich dort ankommt, wo der Plan ihn
erwartet, braucht einen Mischer, der auf Befehle reagiert. Auf einer laufenden
Anlage ist das eine schlechte Idee, und ein zweiter ATEM steht selten herum.

Diese Seite beschreibt den dritten Weg: einen **Emulator**, der das
ATEM-Protokoll spricht. Er lässt sich sowohl von *ATEM Software Control*
bedienen als auch vom Cable-Planner ansteuern — und beide sehen dasselbe Gerät.

> **Der Satz, auf den es ankommt:** ein Emulator quittiert wie ein Mischer,
> aber hinter dem geschalteten Ausgang liegt **kein Signal**. Eine gelungene
> Probe zeigt, dass der Befehl richtig gebaut ist und ankommt. Sie zeigt
> nichts darüber, ob an der Anlage ein Bild erscheint. Deshalb trägt der Plan
> das Ziel als eigene Angabe und schreibt es in jeden Beleg (S-5).

---

## 1 · Was es gibt — nachgesehen, nicht erinnert

Geprüft am 2026-09-08, jeweils an der Quelle:

| Was | Wo | Befund |
|---|---|---|
| **Swift-Atem** | `github.com/Dev1an/Swift-Atem` | Implementiert **beide Seiten** des Protokolls — Steuerpult *und* Mischer. MIT-Lizenz (`LICENSE.txt`, Copyright 2018 Damiaan Dufaux). Swift 5.1 auf Apple NIO, getestet unter macOS und Raspbian. |
| **Der lauffähige Emulator** | `Sources/Simulator/main.swift`, SPM-Target `Simulator` | `swift run Simulator` startet ihn. |
| **Vorgänger in JavaScript** | `github.com/Dev1an/Atem` | Nur die **Steuerpult**-Seite; die README verweist selbst auf Swift-Atem als Nachfolger. Als Prüfstand also nicht geeignet. |
| **npm** | `registry.npmjs.org` | Kein Emulator-Paket. Gesucht nach `atem` + `emulator`/`simulator`/`mock`/`fake`/`proxy`; was es gibt, sind Steuer-Bibliotheken (`atem-connection` und Abkömmlinge). |

**Was der Emulator beantwortet** (aus `Sources/Simulator/main.swift` gelesen,
nicht aus dem Gedächtnis): `ChangeProgramBus`, `ChangePreviewBus`,
`ChangeTransitionPosition`, `ChangeAuxiliaryOutput`, `GetTimecode` sowie den
Datei-Transfer für Media-Pool-Bilder. Jede Änderung wird an **alle**
verbundenen Steuerpulte zurückgemeldet — genau deshalb sehen Software Control
und der Cable-Planner denselben Zustand.

**Was er nicht beantwortet:** alles andere. Ein Schnitt (`cut`) wird vom
Simulator-Beispiel nicht quittiert; Keyer, Übergangs-Arten, Audio und
Multiviewer-Aufteilung ebenfalls nicht. Ob *ATEM Software Control* sich mit
dieser Protokoll-Fassung verbindet, hängt an ihrer Version und ist hier nicht
geprüft — es steht in der Swift-Atem-README als Absicht des Projekts, nicht als
Zusage.

---

## 2 · Ihn starten

```bash
git clone https://github.com/Dev1an/Swift-Atem
cd Swift-Atem
swift run Simulator          # braucht eine Swift-Toolchain (macOS oder Linux)
```

Der Emulator hört auf dem ATEM-Port (UDP 9910) der Maschine, auf der er läuft.
Läuft er auf demselben Rechner wie der Cable-Planner, ist seine Adresse
`127.0.0.1`.

---

## 3 · Den Plan darauf richten

In den Geräte-Eigenschaften unter **Steuerung**:

1. **Steuer-Protokoll** auf `Blackmagic ATEM`.
2. **Ziel** auf `Prüfstand (Emulator)`.
3. **IP-Adresse** auf die des Emulators.
4. Die **Nummern am Gerät** je Anschluss eintragen (Quellen-Nummer für
   Eingänge, Bus-Nummer für Aux, Mix-Effect für Programm/Vorschau). Sie stehen
   nicht in der Position in der Liste — auch beim Emulator nicht.

Danach schaltet „Weg schalten" wie sonst auch. Der Bestätigungs-Dialog zeigt
statt der roten Eingriffs-Warnung den Prüfstand-Hinweis, und der Beleg in
`project.hubSwitches` trägt `target: "simulator"`.

### Warum das Ziel eine eigene Angabe ist und nicht aus der Adresse folgt

Ein Emulator hört auf einer IP wie jedes andere Gerät. `127.0.0.1` mag heute
der Prüfstand sein — ein echter Mischer kann über einen Tunnel genauso dort
liegen, und ein Prüfstand kann mitten im Produktionsnetz stehen. Aus der
Adresse zu schliessen, was am anderen Ende hängt, wäre derselbe Fehler wie der
Namensabgleich, den ADR-002 verbietet. Also wird es erklärt.

### Warum es im Beleg steht

`project.hubSwitches` beantwortet die Frage „wer hat den Ausgang
umgeschaltet?" — gestellt nach einer Sendung, in der etwas Falsches im Bild
war, von jemandem, der nicht dabei war. Ohne das Ziel sieht eine Probe am
Emulator dort aus wie ein Eingriff an der laufenden Anlage: gleiche Uhrzeit,
gleicher Gerätename, gleiche Nummern, gleiches „angenommen". Wer den liest,
sucht die Ursache an einer Stelle, an der nie jemand war.

Auf dem Eingriffs-Protokoll steht deshalb eine eigene Spalte: **Anlage** oder
**Prüfstand**. Ein fehlender Wert heisst „Anlage" — so waren alle Einträge, die
geschrieben wurden, bevor es einen Prüfstand gab.

---

## 4 · Die Grenze der Probe

| Der Prüfstand zeigt | Der Prüfstand zeigt **nicht** |
|---|---|
| Der Befehl wird gebaut und angenommen | Ob am Gerät ein Bild erscheint |
| Die Nummern stimmen mit dem überein, was das Protokoll erwartet | Ob die Nummern zu **diesem** Mischermodell passen |
| Der Weg durch den Plan trifft die richtigen Anschlüsse | Ob die Verkabelung so gesteckt ist wie geplant |

Das ist keine Einschränkung des Emulators, sondern der Unterschied zwischen
einer Befehls-Probe und einer Anlagen-Prüfung. Für das Zweite gibt es den
Prüfbild-Rundgang (`docs/` → Prüfbild, B-42): jemand steht vor dem Monitor und
meldet, was wirklich darauf steht.

---

## 5 · Der andere Weg: Companion

Wer keine Swift-Toolchain will, kann denselben Zweck über **Bitfocus Companion**
erreichen (S-4): Companion spricht das Protokoll, der Plan sagt nur, *was*
geschaltet wird. Ein Prüfstand ist das nicht — dahinter hängt entweder ein
echtes Gerät oder gar keines —, aber für „geht der Befehl richtig raus?" ist es
der kürzere Weg. Auch dort gilt das Ziel-Feld: steht hinter Companion ein
Emulator, gehört `Prüfstand` in die Angabe.
