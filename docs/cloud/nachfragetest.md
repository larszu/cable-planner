# Nachfragetest Pro/Cloud — die Schwelle steht VOR dem Test

*Issue [#866](https://github.com/larszu/cable-planner/issues/866). Aufgesetzt am 2026-09-19.*

## Warum es diesen Zettel gibt

Eine Schwelle, die man nach dem Ergebnis festlegt, ist keine Schwelle, sondern
eine Begründung. Deshalb steht hier vorher, was gemessen wird, ab wann gebaut
wird und was passiert, wenn die Zahl nicht kommt.

Das Issue nennt den Grund für die Reihenfolge selbst: *„Bevor Server und
Backend Geld und **Abende** kosten, muss echte Zahlungsbereitschaft gemessen
werden."* Die Abende stehen da nicht zufällig — ein Backend, das niemand
bezahlt, kostet nicht nur Miete, sondern auch die Zeit, in der es gewartet
werden will.

## Die Rechnung dahinter

| | |
|---|---:|
| Preisanker | ~15 € / Monat |
| Zielumsatz für „trägt sich" | 1.000 € / Monat |
| Nötige Abos | **~70** |

Der untere Markt ist billig besetzt: EasySchematic ist kostenlos im Browser,
WireFlow kostet 5 $ (Gründerpreis) bzw. 14,99 $ im Monat. 70 Abos gegen dieses
Feld sind kein Selbstläufer — und genau deshalb wird gemessen und nicht
geschätzt.

## Was gemessen wird

**Erste Kennzahl — zahlende Vorbestellungen.** Nicht Klicks, nicht
E-Mail-Adressen, nicht „Interesse". Wer zum Gründerpreis vorbestellt, hat
bezahlt; alles andere misst Höflichkeit.

**Zweite Kennzahl — Download-Zahlen der Releases.** Sie sagt, wie groß der
Teich überhaupt ist. Sie wird automatisch mitgeschrieben
(`npm run downloads:zaehlen`, siehe unten) und ist bewusst *nicht* die
Entscheidungsgröße: 3.000 Downloads ohne eine einzige Vorbestellung sind eine
Antwort und keine Hoffnung.

## Die Schwelle

> **20 zahlende Vorbestellungen in 3 Monaten** ab dem Tag, an dem der
> Abschnitt „Pro / Cloud" auf der Seite live geht.

**Erreicht:** Die Cloud-Kette wird gebaut, in der Reihenfolge der Issues —
[#867](https://github.com/larszu/cable-planner/issues/867) (Rechtliches),
[#868](https://github.com/larszu/cable-planner/issues/868) (VM),
[#869](https://github.com/larszu/cable-planner/issues/869) (Signaling/TURN),
[#870](https://github.com/larszu/cable-planner/issues/870) (Share-Link),
[#871](https://github.com/larszu/cable-planner/issues/871) (Sync),
[#874](https://github.com/larszu/cable-planner/issues/874) (Remote-MCP).

**Nicht erreicht:** Kein Backend. Die Vorbestellungen werden erstattet — wer
zum Gründerpreis kauft, kauft ein Versprechen, und ein nicht gehaltenes
Versprechen wird zurückgezahlt und nicht ausgesessen. Der Abschnitt kommt von
der Seite, und dieses Dokument bekommt eine Zeile mit dem Ergebnis.

**Dazwischen (5–19):** Kein automatisches Ja. Dann steht die Frage an, ob der
Preis falsch ist oder die Zielgruppe — und sie wird hier beantwortet, mit
Datum, bevor irgendetwas gebaut wird.

## Was Pro NICHT ist

Die Desktop-App bleibt, was sie ist: **kostenlos, offline, vollständig**. Das
ist keine Marketing-Zeile, sondern die Grundregel aus
[#868](https://github.com/larszu/cable-planner/issues/868) — *„Die Desktop-App
muss voll funktionieren, wenn der Server weg ist. Die Cloud ist Zusatz, nie
Voraussetzung."* Ein Abo, das den Plan am Showtag zur Geisel nimmt, wäre genau
das Produkt, das dieses Repo nicht baut.

Pro fügt hinzu, was ohne Server nicht geht:

* **Share-Link** — ein Lese-Link, der überall aufgeht, ohne Konto beim
  Empfänger (#870)
* **Sync mit Revisionen** — dasselbe Projekt auf Desktop, Tablet und Handy,
  mit Wiederherstellen (#871)
* **Remote-MCP** — der Assistent in claude.ai erreicht die Cloud-Projekte
  (#874)

## Die Zahlungsabwicklung

Über einen **Merchant of Record** (Paddle oder Lemon Squeezy). Der Grund ist
nicht Bequemlichkeit: er wird Verkäufer und schuldet damit die Umsatzsteuer im
Ausland. Ohne ihn müsste jeder Verkauf nach Österreich, in die Schweiz oder in
die USA einzeln beurteilt werden — bei 15 € Monatspreis ist das der teuerste
Teil des Geschäfts.

**Solange kein Konto besteht, gibt es auf der Seite keinen Kaufknopf.** Die
Stelle dafür ist vorbereitet (`VORBESTELLUNG_URL` in `docs/index.html`); steht
dort nichts, zeigt der Abschnitt „noch nicht offen" statt eines Knopfs, der
ins Leere führt. Ein Kaufknopf, der nicht kauft, verbrennt genau die
Aufmerksamkeit, die dieser Test messen will.

## Ergebnis

*Wird hier eingetragen, mit Datum. Leer heißt: läuft noch oder hat noch nicht
begonnen.*

| Datum | Vorbestellungen | Downloads gesamt | Entscheidung |
|---|---:|---:|---|
| — | — | — | Abschnitt noch nicht live |
