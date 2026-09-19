# Rechtliches und Betrieb für ein bezahltes Angebot — Merkliste

*Issue [#867](https://github.com/larszu/cable-planner/issues/867). Stand
2026-09-19.*

> **Das hier ist kein Rechts- und kein Steuerrat.** Es ist die Vorbereitung
> für das Gespräch mit Steuerberater und Anwalt: die Fragen sortiert, und die
> Teile ausgefüllt, die sich aus dem Code ergeben und die sonst im Termin
> nachgeschlagen werden müssten. Was eine juristische Wertung braucht, steht
> als **Frage** da und nicht als Antwort.

---

## 1. Warum die heutige LICENSE nicht trägt

Sie ist für kostenlose Nutzung geschrieben, und zwei ihrer Punkte halten bei
einem Verkauf nicht:

| Punkt | Wortlaut heute | Problem beim Verkauf |
|---|---|---|
| 2 | „jederzeit widerrufliches Recht" | Wer zahlt, kauft kein jederzeit widerrufliches Recht. Bei einem Abo ist der Widerruf an die Kündigungsfrist gebunden, nicht an den freien Willen des Anbieters. |
| 7 | „OHNE JEDE GEWÄHRLEISTUNG" | Gegenüber Verbrauchern nicht abdingbar (§§ 327 ff. BGB für digitale Produkte). Auch im B2B ist ein Vollausschluss in AGB angreifbar. |

Punkt 8 (Haftungsbeschränkung) nimmt Vorsatz, grobe Fahrlässigkeit und das
ProdHaftG bereits aus — das ist die Form, die halten kann. Punkt 5 (Beiträge)
steht schon da; **offene Frage:** gilt er auch für die Pro-Version, und ändert
das etwas daran, dass Beiträge unentgeltlich übertragen werden, während mit
dem Ergebnis Geld verdient wird?

**Nicht:** die bestehende LICENSE umschreiben. Die kostenlose Desktop-App
bleibt, was sie ist. Die bezahlte Leistung ist ein **eigener Vertrag über
einen Dienst** — der Server —, und sie gehört in ein eigenes Dokument.

---

## 2. Welche Daten die Cloud berühren — ausgefüllt, weil der Code es sagt

Das ist der Teil, den der Berater nicht wissen kann und der in jede
Datenschutzerklärung und jeden AVV gehört. Stand: geplant, nichts davon läuft.

| Dienst | Was den Server berührt | Was NICHT |
|---|---|---|
| Signaling (#869) | Raum-Kennung, Verbindungs-Metadaten (IP-Adressen der Teilnehmer, SDP-Angebote) | Planinhalt — die Verbindung ist Ende-zu-Ende über das Raum-Passwort |
| TURN (#869) | **Nutzdaten im Durchlauf**, wenn P2P scheitert; IP-Adressen | Nichts wird gespeichert — coturn relayt und schreibt nicht auf Platte |
| Share-Link (#870) | Ein Schnappschuss des Plans, bis der Link widerrufen wird oder abläuft | Zugangsdaten und Tokens — die werden **vor** dem Hochladen entfernt, wie beim bestehenden Export |
| Sync (#871) | Das Projekt und seine Revisionen, verschlüsselt at rest | — |
| Remote-MCP (#874) | Nur Projekte, die der Nutzer selbst in die Cloud gelegt hat | Lokale Projekte |

**Und die Zeile, die im Termin die wichtigste ist:** ein Kabelplan kann
**Namen, Telefonnummern und IP-Adressen der Crew** enthalten (Kontakte am
Gerät, Übergabe-Protokolle, Adressplan). Damit sind es personenbezogene Daten
Dritter, und der Kunde wird Verantwortlicher, das Angebot Auftragsverarbeiter.
Das ist der Grund für die eigene AVV-Vorlage weiter unten — nicht Formalismus.

### Was schon heute gilt, ohne Cloud

Die Stream-Keys der Ausspielziele und die Tokens für Rentman und NetBox liegen
im **Schlüsselbund des Betriebssystems** (keytar) und nie im Projekt-File. Das
Projekt trägt höchstens die Tatsache, dass eines hinterlegt ist, und die wird
beim Laden nachgefragt statt aus der Datei geglaubt. Diese Zusage muss der
Cloud-Weg halten: **was nicht in der Datei steht, darf auch nicht im Upload
stehen.**

---

## 3. Dokumente, die vor dem ersten Verkauf stehen müssen

- [ ] **EULA / AGB für die bezahlte Fassung.** Zu klären: Laufzeit und
      Kündigung; Gewährleistung nach deutschem Recht (§§ 327 ff. BGB — welche
      Aktualisierungspflicht entsteht?); Haftungsbegrenzung, die hält;
      **was nach Abo-Ende mit den Plänen passiert** (siehe Kasten unten).
- [ ] **Datenschutzerklärung für die Cloud** — welche Daten, wo gespeichert,
      wie lange, wann gelöscht. Die Tabelle aus Abschnitt 2 ist der Rohstoff.
- [ ] **Impressum** auf der Seite. Betrifft auch die heutige
      GitHub-Pages-Seite, sobald dort etwas verkauft wird.
- [ ] **AVV mit dem Hoster.** Lima City bietet ihn kostenlos elektronisch im
      Kundenkonto an.
- [ ] **Eigene AVV-Vorlage für Kunden** (Art. 28 DSGVO), aus dem Grund in
      Abschnitt 2. Im Formularsatz der Medienproduktion existiert bereits eine
      AVV-Vorlage — **Frage an den Berater:** trägt sie einen Software-Dienst,
      oder braucht es eine zweite?
- [ ] **Widerrufsbelehrung**, falls an Verbraucher verkauft wird. Bei
      digitalen Inhalten mit sofortiger Bereitstellung gibt es den
      ausdrücklichen Verzicht — der Merchant of Record hat dafür meist eine
      Vorlage, aber sie gilt für *seinen* Vertrag.

> **Was nach dem Abo-Ende passiert, ist eine Produktentscheidung und keine
> Rechtsfrage — sie steht trotzdem hier, weil sie in die AGB muss.**
> Aus #871: *„Export aller eigenen Daten als `.cableplan` jederzeit, auch nach
> Abo-Ende."* Damit ist die Antwort schon gegeben: die Pläne bleiben
> exportierbar, und die lokale Datei war ohnehin führend. Ein Abo, das den
> Plan am Showtag zur Geisel nimmt, wäre genau das Produkt, das dieses Repo
> nicht baut.

---

## 4. Steuer und Gewerbe

- [ ] **Merchant of Record** (Paddle oder Lemon Squeezy): er wird Verkäufer
      und schuldet die Umsatzsteuer im Ausland. **Frage:** wie verträgt sich
      das mit der **Kleinunternehmerregelung** (§ 19 UStG)? Zählen die
      Auszahlungen des MoR als Umsatz, und wo liegt dann die Grenze?
- [ ] **Gewerbeanmeldung prüfen.** Softwarevertrieb ist eine andere Tätigkeit
      als Medienproduktion. **Frage:** Erweiterung der bestehenden Anmeldung
      oder eigene? Und: bleibt es freiberuflich oder wird es gewerblich?
- [ ] **Nebentätigkeitsanzeige beim Arbeitgeber** um den Softwarevertrieb
      ergänzen. Die bestehende Anzeige deckt die Medienproduktion ab.
- [ ] **Rechnungsstellung:** die Verkäufe laufen über den MoR, nicht über
      Lexware Office. **Frage:** wie werden die Auszahlungen gebucht?

---

## 5. Reihenfolge

Nichts davon wird vor
[#866](https://github.com/larszu/cable-planner/issues/866) gebraucht. Der
Nachfragetest misst mit einer Vorbestellung, und die läuft über den Merchant
of Record — **das ist der erste Punkt dieser Liste, der wirklich fällig
wird**, und zwar genau dann, wenn der Abschnitt auf der Seite einen Kaufknopf
bekommt. Alles Übrige wird fällig, wenn die Schwelle erreicht ist.

Der Eigentümer hat am 2026-09-18 auf #868 festgehalten, dass bis dahin kein
Server gemietet wird. Diese Liste ändert daran nichts — sie sorgt nur dafür,
dass der Termin beim Berater nicht mit „ich schaue mal nach" endet.
