// ───────────────────────────────────────────────────────────────────────────
// Kanonisches Deutsch der Befundsaetze (#1142).
//
// Die Quelle steht englisch im `satz(key, 'English', werte)` der Module; hier
// steht die deutsche Fassung, die im gestempelten Blatt erscheint und die der
// Bildschirm bei deutscher App-Sprache zeigt. `KANONISCH_DE` (und damit
// `de.ts`) breitet diese Tabelle aus. Jede Zeile ist Zeichen fuer Zeichen der
// Satz, der vorher im Modul stand — nur mit `{platzhalter}` statt `${…}`.
// ───────────────────────────────────────────────────────────────────────────

export const BEFUNDE_DE: Readonly<Record<string, string>> = {
  'impact.derivationFailed':
    'Die Ableitung dieses Dokuments ist an diesem Plan gescheitert.',
  'postHandover.gap.noDevice':
    'Der Rolle ist kein Gerät zugeordnet — es gibt nichts, was aufgezeichnet wird.',
  'receipt.chain.versus':
    '{ist} gegen {belegt}',
  'scan.text.noPoints':
    'Aus dieser Datei liess sich kein Messpunkt lesen ({n} Zeile(n) verworfen). Ohne Messung steht bei jedem Träger „nicht gemessen" — und das ist die ehrliche Antwort, nicht „frei".',
  'scan.text.partlyUnreadable':
    '{n} Zeile(n) der Datei waren nicht lesbar. Die Messung ist damit lückenhaft; eine Lücke sieht im Verlauf aus wie ein freies Band.',
  'scan.text.occupied':
    '{n} geplante(r) Träger liegen auf gemessener Energie über {dbm} dBm: {liste}. Was dort sitzt, sagt die Messung nicht — nur, dass etwas sitzt.',
  'scan.text.outsideRange':
    '{n} Träger liegen ausserhalb des gemessenen Bereichs ({von}–{bis} MHz). Für sie sagt dieser Scan nichts — „nicht gemessen" ist kein „frei".',
  'scan.text.outside':
    '{n} Träger liegen ausserhalb des gemessenen Bereichs. Für sie sagt dieser Scan nichts — „nicht gemessen" ist kein „frei".',
  'list.and':
    '{a} und {b}',
  'ptp.text.domainClash':
    'Domäne {domain} trägt {familien}. ST 2059-2 steht per Vorgabe auf 127, AES67 in der Praxis auf 0 — auf einer gemeinsamen Domäne hängt eine der beiden Familien am falschen Medientakt. Entweder zwei Domänen mit einer Boundary Clock dazwischen, oder ein erklärter Grund, warum es hier ohne geht.',
  'ptp.text.profileClash':
    'Domäne {domain} trägt zwei Profile: {profile}. Dieselbe Domäne, zwei Vorstellungen davon, was darin gilt.',
  'ptp.text.offDefault':
    '{geraet}: Profil {profil} auf Domäne {domain}. Die Vorgabe dieses Profils ist {vorgabe}. Das ist kein Fehler — aber es ist die Zahl, die man beim Fehlersuchen als Erstes sehen will.',
  'ptp.text.noGrandmaster':
    'Domäne {domain} nennt keine Uhr. Der Aufbau läuft trotzdem an — das BMCA wählt ein Gerät aus. Welches, steht dann nirgends.',
  'ptp.text.twoGrandmasters':
    'Domäne {domain} nennt {n} Uhren ({uhren}). Auch das läuft an, und auch hier wählt das BMCA — nur hatte diesmal jemand eine Absicht, und der Plan sagt nicht, welche.',
  'clientSummary.text.emptyPlan':
    'Der Plan trägt weder Geräte noch Kabel noch Ausspielziele. Eine Übersicht darüber wäre ein leeres Blatt mit einer Überschrift.',
  'clientSummary.text.progressUnreported':
    'Aus dem Feld ist kein Aufbau-Fortschritt gemeldet. Das Blatt sagt deshalb „nicht gemeldet" und nicht „0 %" — der Unterschied entscheidet, wie ein Kunde die Zeile liest.',
  'clientSummary.text.noAsBuilt':
    'Grundlage dieses Blatts: {basis}. Jede Bestandszahl darauf ist damit eine Planzahl und kein Leistungsnachweis — genau so steht es auch in der Spalte „Grundlage".',
  'labour.text.personMissing':
    'Der Satz „{satz}" zeigt auf eine Person, die es im Plan nicht gibt.',
  'labour.text.bandMissing':
    'Der Satz „{satz}" nennt ein Band, das es nicht gibt ({band}).',
  'labour.text.rateMissing':
    'Die Schicht am {datum} hat keinen auflösbaren Satz — sie geht in keine Summe ein.',
  'labour.text.zeroLength':
    'Die Schicht am {datum} endet nicht nach ihrem Beginn.',
  'labour.text.overlap':
    '{person} hat am {datum} zwei Schichten, die sich überschneiden.',
  'labour.text.overtimeUnapproved':
    '{person} hat am {datum} {stunden} h Mehrarbeit — dazu liegt keine Zusage im Plan.',
  'labour.text.expenseWithoutReceipt':
    'Die weiterberechenbare Auslage vom {datum} über {betrag} nennt keinen Beleg.',
  'cost.text.noLines':
    'Es steht keine Kostenposition im Projekt. Der Vergleich Plan gegen Ist findet dann wieder in einer Tabellenkalkulation statt — genau der Umweg, gegen den dieser Vergleich gebaut ist.',
  'cost.text.noCurrency':
    'Es ist keine Währung angegeben. Geraten wird keine — auch nicht „EUR": eine Summe, deren Einheit die Anwendung sich ausgesucht hat, wird in der falschen Währung abgerechnet und niemand sieht es.',
  'cost.text.noEstimate':
    '„{position}" hat keine Schätzung. Die Position zählt deshalb nicht zur Projektschätzung — statt mit einer Null hineinzuzählen, die dort niemand wiederfindet.',
  'cost.text.noActual':
    '„{position}" hat keinen Ist-Wert. Die Abweichung ist damit unbekannt und nicht null — eine Null in dieser Spalte liest sich als „im Rahmen".',
  'cost.text.actualUnsourced':
    'Beim Ist-Wert von „{position}" steht nicht, woher er kommt. Eine Zahl aus dem ERP und eine aus dem Bauch sehen in dieser Spalte gleich aus.',
  'cost.text.anchorGone':
    '„{position}" hängt an etwas, das es im Plan nicht mehr gibt. Die Position wird nicht still auf „ohne Bezug" gesetzt: das wäre dieselbe Zeile wie eine Fahrtkostenposition, und sie ist etwas anderes.',
  'cost.text.noTolerance':
    'Es ist keine Toleranz gesetzt, also wird keine Abweichung als auffällig gemeldet. Ein voreingestellter Wert wäre eine Meinung darüber, was in diesem Geschäft normal ist — diese Anwendung hat dazu keine.',
  'cost.text.overTolerance':
    '„{position}" weicht um {prozent} % ab (Toleranz {toleranz} %).',
  'dante.text.rxDuplicate':
    '„{kanal}" steht {n}× in der Liste. Ein Empfangskanal kann nur ein Abo haben — eine der Zeilen ist falsch, und welche, weiss nur der Controller.',
  'dante.text.half':
    '„{kanal}" trägt {was}. Als Abo ist das unvollständig; als freier Eingang gelesen wäre die halbe Angabe verloren.',
  'dante.text.half.device':
    'ein Sendegerät ohne Kanal',
  'dante.text.half.channel':
    'einen Sendekanal ohne Gerät',
  'dante.text.nothingSubscribed':
    'Keiner der {n} Empfangskanäle ist abonniert. Entweder ist der Patch leer, oder die Sendespalten der Datei wurden nicht gefunden.',
  'dante.text.deviceNotInPlan':
    '{n} Gerät(e) im Patch führt der Plan nicht als Dante-Gerät: {namen}. Nach einer Umbenennung steht genau so der alte Name im Patch und der neue im Plan.',
  'dante.text.planDeviceUnpatched':
    '{n} Dante-Gerät(e) aus dem Plan kommen im Patch nicht vor: {namen}.',
  'naming.text.scopeEmptyCategory':
    'Die Regel trifft kein Gerät der Kategorie „{kategorie}". Sie anzuwenden täte nichts — das steht hier, damit niemand auf ein stilles Nichts wartet.',
  'naming.text.scopeEmpty':
    'Die Regel trifft kein Gerät. Sie anzuwenden täte nichts — das steht hier, damit niemand auf ein stilles Nichts wartet.',
  'naming.text.emptyName':
    'Für „{geraet}" ergibt die Regel keinen Namen — alle Teile sind leer. Ein leerer Name wird nicht gesetzt.',
  'naming.text.duplicate':
    '„{name}" bekämen {n} Geräte ({geraete}). Die Regel wird nicht angewandt: ein doppelter Name im Netz ist kein Schönheitsfehler, sondern zwei Geräte, die sich gegenseitig verdrängen.',
  'naming.text.danteTooLong':
    '„{name}" hat {n} Zeichen; ein Dante-Name trägt höchstens {grenze} (Quelle: {quelle}). Gekürzt wird hier nichts — eine automatisch gekürzte Kennung ist am Showtag nicht mehr die, die auf dem Blatt steht.',
  'naming.text.danteSubscriptionRisk':
    '„{name}" hängt am Dante-Netz. Ab Firmware 4.3 bricht das Umbenennen eines Sendekanals bestehende Subscriptions — dieser Plan kennt den Subscription-Satz nicht und kann nicht sagen, welche; er sagt nur, dass es welche geben wird.',
  'naming.text.nameInFreeText':
    '„{name}" steht {n}× im Klartext in Notizen oder Antworten. Nach dem Umbenennen stimmt dort der Name nicht mehr, und nichts bricht dabei — deshalb fällt es niemandem auf.',
  'naming.text.nothingChanges':
    'Die Regel ergibt für alle {n} getroffenen Geräte den Namen, den sie schon tragen. Es gibt nichts anzuwenden.',
  'mic.text.channelDoubleBooked':
    '{namen} stehen auf „{kanal}". Zwei Sender auf derselben Frequenz löschen einander aus — das fällt auf, wenn jemand spricht.',
  'mic.text.packDoubleBooked':
    'Sender {pack} ist {n} Personen zugeordnet. Ein Sender hängt an einem Körper; einer der beiden steht ohne da.',
  'mic.text.performerTwice':
    '{name} trägt {n} Strecken. Das kann stimmen (Headset und Handsender), ist aber öfter ein Rest aus der vorigen Session.',
  'mic.text.channelMissing':
    '{n} Zuordnung(en) zeigen auf einen Kanal, den der Rig-Plan nicht mehr führt. Auf der Karte steht dann „Kanal entfernt" statt einer Frequenz.',
  'mic.text.batteryUnrecorded':
    'Bei {n} Strecke(n) steht nicht, wann der Akku eingelegt wurde. Die Karte sagt „{karte}" — sie behauptet keine Restlaufzeit, die niemand kennt.',
  'mic.text.carriedUnconfirmed':
    '{n} Zuordnung(en) stammen aus der vorigen Session und sind für heute nicht bestätigt. Sie sparen das Neuschreiben; eine Vermutung über heute bleiben sie trotzdem.',
  'job.text.noAsBuilt':
    'Es ist nichts als „wie gebaut" festgeschrieben. Wer diese Datei nächstes Jahr öffnet, plant aus dem Stand, der vor dem Aufbau da war — also aus dem Angebot, und jede Änderung vor Ort wird ein zweites Mal gefunden.',
  'job.text.asBuiltStale':
    'Seit „{revision}" haben sich {n} Dinge substantiell geändert. Das Blatt trägt das Wort „As-Built" und stimmt nicht mehr — das ist teurer als gar keines, weil niemand nachfragt.',
  'job.text.openQuestions':
    '{n} Frage(n) ans Haus sind ohne Antwort geblieben. Genau die werden nächstes Jahr ein zweites Mal gestellt — an dieselbe IT-Abteilung.',
  'job.text.unbuiltNotes':
    '{n} Anmerkung(en) stehen noch auf „offen". Solange sie das tun, ist unklar, ob der Punkt gebaut, verworfen oder vergessen wurde.',
  'job.text.noVenue':
    'Der Plan nennt keinen Ort. Ohne ihn lässt sich diese Datei nächstes Jahr nicht dem Haus zuordnen, und die Antworten der Haus-IT gelten nirgends (Bedarf 85, 91).',
  'fallback.text.scenesUnknown':
    'Es sind Regeln hinterlegt, aber keine Szene des Encoders steht im Plan. Der Namensabgleich — die billigste Prüfung von allen — läuft damit nicht, und das Ergebnis „keine Beanstandung" wäre keins.',
  'fallback.field.normal':
    'Normalbetrieb',
  'fallback.field.low':
    'niedrige Bitrate',
  'fallback.text.sceneUnknown':
    '{ziel}, {feld}: „{szene}" steht in keiner Szene des Encoders. Der Wächter schaltet auf einen Namen, den es nicht gibt — die Show bleibt stehen, wo sie gerade war, und niemand sieht einen Fehler.',
  'fallback.text.noReturnPath':
    '{ziel}: eine Ausweichszene ist benannt, eine für den Normalbetrieb nicht. Wer einmal umschaltet, schaltet nie zurück — die Show läuft auf der Tafel weiter, während die Strecke längst wieder steht.',
  'fallback.text.thresholdOrder':
    '{ziel}: „offline" liegt bei {offline} kbit/s und „niedrig" bei {low} kbit/s. Offline muss UNTER niedrig liegen, sonst ist der Zwischenzustand nicht erreichbar und es gibt nur an oder aus.',
  'fallback.text.thresholdAboveBitrate':
    '{ziel}: die Schwelle „niedrig" liegt bei {low} kbit/s, geplant sind {geplant} kbit/s (Video {video} + Audio {audio}). Der Zustand liegt damit vom ersten Moment an vor und geht nie weg.',
  'fallback.text.loopbackElsewhere':
    'Die Statistik-Quelle ist „{url}". Der Wächter läuft auf {waechter}, die Statistik kommt aber von {fremde} — localhost zeigt dann auf {waechter} und nicht dorthin. Genau das schaltet dauerhaft auf die Offline-Szene, während die Strecke läuft (NOALBS #178).',
  'fallback.text.loopbackSame':
    'Die Statistik-Quelle ist „{url}". Wächter und Encoder stehen im Plan auf {waechter} — das passt, solange es dabei bleibt. Ob die URL dort antwortet, sagt der Plan nicht; das ist eine Messung an der Maschine.',
  'fallback.text.loopbackUnknown':
    'Die Statistik-Quelle ist „{url}". „localhost" heißt „dieselbe Maschine" — welche das ist, steht nicht im Plan. Im Beleg antwortete dieselbe URL im Browser und nicht im Wächter, und die Show lief auf der Offline-Szene weiter (NOALBS #178).',
  'crew.text.vlanWith':
    'VLAN {id} — {n} Geräte (u. a. {beispiele})',
  'crew.text.vlan':
    'VLAN {id} — {n} Geräte',
  'crew.text.ssid':
    'WLAN-Name und Passwort: stehen nicht im Plan — vor Ort erfragen.',
  'crew.text.cidr':
    '{cidr} ist vergeben — nichts eigenes hineinstecken, nichts hineinvergeben.',
  'crew.text.noCidr':
    'Der Plan nennt kein Subnetz (es fehlen Adressen oder Masken). Welche Bereiche belegt sind, muss vor Ort geklärt werden.',
  'crew.text.switch':
    '{switch}: {belegt} von {n} Ports belegt. Freie Ports sind nicht freigegeben — vor dem Stecken fragen.',
  'crew.text.refusedNote':
    '{punkt}: vom Haus abgelehnt — {notiz}',
  'crew.text.refused':
    '{punkt}: vom Haus abgelehnt',
  'crew.text.conditionNote':
    '{punkt}: nur mit Auflage — {notiz}',
  'crew.text.condition':
    '{punkt}: nur mit Auflage (Auflage nicht notiert)',
  'crew.text.noContact':
    'Kein Notfall- und kein Dienstleister-Kontakt im Projekt hinterlegt.',
  'event.text.noMetadata':
    '{n} Ausspielziel(e) stehen im Plan, aber keine Angaben zur Veranstaltung. Titel, Beginn und Sichtbarkeit werden dann am Showtag aus Mails zusammengesucht und je Plattform neu getippt.',
  'event.text.noDestinations':
    'Angaben zur Veranstaltung stehen, aber kein Ausspielziel. Das Blatt hat keine Spalte, in die jemand sie eintragen könnte.',
  'event.text.startMissing':
    'Kein geplanter Beginn hinterlegt. Jede Plattform verlangt einen, und ohne gemeinsame Angabe steht auf jeder eine andere Uhrzeit.',
  'event.text.startTimeless':
    'Der Beginn ist nur als Datum angegeben („{beginn}"). Die Uhrzeit bleibt damit im Kopf dessen, der die Plattform-Formulare ausfüllt.',
  'event.text.startUnzoned':
    'Der Beginn „{beginn}" trägt keine Zeitzone. In YouTube Studio gilt die Zeitzone des Kanals, im CMS die des Servers, im Marketing-Kalender die des Verfassers — der Plan kann das nicht auflösen und rät hier bewusst nicht.',
  'event.text.titleMissing':
    '„{ziel}" hat keinen Titel — weder am Projekt noch als Abweichung.',
  'event.text.privacyNotStated':
    'Die Sichtbarkeit von „{ziel}" ist nicht angegeben. Ein Vorgabewert wird hier bewusst nicht gesetzt: „öffentlich" zu raten schaltet im Zweifel die Generalprobe ins Netz.',
  'event.text.overrideOrphan':
    'Eine Abweichung verweist auf ein Ziel, das es im Plan nicht (mehr) gibt ({id}). Sie wird nicht still entfernt — ein kommentarlos verschwundener abweichender Titel ist schlimmer als eine Zeile, die ihn benennt.',
  'event.text.overrideInert':
    '„{ziel}" trägt eine Abweichung, die nichts abweicht — alle Felder sind leer oder gleich dem Projektwert. Auf dem Blatt sieht das aus wie eine bewusste Sonderbehandlung.',
  'event.text.overrideUnexplained':
    '„{ziel}" weicht vom Projektwert ab, ohne Begründung. Ohne sie kann niemand später entscheiden, ob das Absicht war oder ein Tippfehler.',
  'event.field.title':
    'Titel',
  'event.field.privacy':
    'Sichtbarkeit',
  'event.text.backupDiffers':
    '„{ziel}" ist der Ausweichweg für „{primaer}", trägt aber {felder} anders. Wo der Ausweichweg derselben Veranstaltung gilt (YouTube-Backup-Ingest), heißt das, dass zwei Veranstaltungen entstanden sind statt einer.',
  'multicast.reserved.localControl':
    'Local Network Control Block — TTL 1, wird von keinem Router weitergegeben',
  'multicast.reserved.internetworkControl':
    'Internetwork Control Block — hier liegen NTP und PTP selbst (224.0.1.129 ff.)',
  'multicast.reserved.ssm':
    'Source-Specific Multicast — verlangt (S,G)-Joins, ein ASM-Plan greift hier ins Leere',
  'multicast.reserved.ssdp':
    'SSDP/UPnP — jede Windows-Maschine im Netz spricht diese Gruppe an',
  'multicast.text.flowLeg':
    '{fluss} (Bein {bein})',
  'multicast.text.pairCollision':
    '{paar} ist {n}-mal vergeben: {liste}. Adresse und Port zusammen müssen je Sender eindeutig sein.',
  'multicast.text.macAlias':
    '{adressen} tragen dieselbe L2-Adresse {mac} — 32 Gruppen fallen auf eine MAC. Die Karte des Empfängers filtert auf L2 und nimmt beide Ströme an; verworfen wird erst im Betriebssystem, die Last liegt vorher an. Betroffen: {betroffen}.',
  'multicast.text.legShared':
    '{fluss} führt beide Beine auf {adresse}. Ein 2022-7-Paar auf einer Gruppe überlebt keinen Ausfall des Netzes, in dem die Gruppe liegt — es kostet die doppelte Bandbreite und liefert keine Redundanz.',
  'multicast.text.notMulticast':
    '{flussBein} trägt {adresse} — das ist keine Multicast-Adresse (224.0.0.0/4).',
  'multicast.text.reserved':
    '{flussBein} trägt {adresse} aus {grund}.',
  'multicast.text.outsidePool':
    '{n} Vergabe(n) liegen außerhalb von {pool}: {liste}.',
  'transmission.text.noEvents':
    'Es steht kein Eintrag im Sendebericht. Nach der Show wird der Verlauf dann aus OBS-Logs, einer Plattform-Kurve und Erinnerung rekonstruiert — genau der Zustand, gegen den dieser Bericht geschrieben ist.',
  'transmission.text.noAsBuilt':
    'Kein As-Built festgeschrieben. Der Bericht kann sagen, was beobachtet wurde, aber nicht, wovon die Ausspielung abgewichen ist — es gibt keinen Bauzustand, gegen den verglichen würde.',
  'transmission.text.eventOrphan':
    'Ein Eintrag bezieht sich auf ein Ziel, das es im Plan nicht (mehr) gibt ({id}). Er wird nicht still entfernt: ein verschwundener Eintrag über einen Abriss ist die teuerste Lücke in einem Sendebericht.',
  'transmission.text.eventUnzoned':
    'Der Zeitpunkt „{zeit}" trägt keine Zeitzone. Gegen ein OBS-Log und eine Plattform-Kurve lässt sich damit nichts abgleichen, und die Reihenfolge im Bericht ist dann die der geschriebenen Zeichenketten, nicht die der Zeitpunkte.',
  'transmission.text.eventUnsourced':
    'Bei „{eintrag}" steht nicht, woher die Angabe stammt. Ein Bericht, der zum Kunden geht, wird wie ein Messprotokoll gelesen — dieser Planer misst nichts, und das muss an jeder Zeile stehen.',
  'transmission.text.eventOutsideWindow':
    'Der Eintrag vom {tag} liegt außerhalb des Einsatzzeitraums ({von} bis {bis}). Entweder stimmt der Zeitraum nicht oder der Eintrag gehört zu einer anderen Show.',
  'transmission.text.dropoutWithoutEnd':
    'Auf „{ereignis}" um {zeit} folgt weder eine Wiederkehr noch ein Sendeende. So gelesen ist die Sendung nicht zurückgekommen.',
  'transmission.text.switchWithoutPlan':
    'Für „{ziel}" ist eine Umschaltung eingetragen, aber der Plan kennt für dieses Ziel weder eine Ausweich-Regel noch ein Backup-Ziel. Nächstes Jahr steht im Plan also nicht, worauf man damals ausgewichen ist.',
  'transmission.text.deviationsUnrecorded':
    'Die Ausspielung weicht in {n} Bereich(en) vom As-Built ab ({bereiche}), aber kein Eintrag nennt eine Änderung während der Sendung. Entweder wurde vorher geändert — dann gehört das As-Built nachgezogen — oder der Eintrag fehlt.',
  'transmission.text.noSummary':
    'Der Bericht trägt keine Zusammenfassung. Sie wird bewusst nicht erzeugt: aus acht Zeilen eine Bewertung der Sendung abzuleiten wäre eine Aussage, die dem Menschen gehört, der sie verantwortet.',
  // Bereiche der Ausspielung — im Bildschirm und im Abweichungs-Satz des Berichts.
  'transmission.section.deliveryDestinations': 'Ausspielziele',
  'transmission.section.fallback': 'Sicherheitsnetz',
  'transmission.section.archiveRecording': 'Archiv-Aufzeichnung',
  'transmission.section.eventMetadata': 'Angaben zur Veranstaltung',
}
