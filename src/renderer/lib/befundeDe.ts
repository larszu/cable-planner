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
  // Signalkette: Ende an einer Durchleitung (signalChain.ts).
  'chain.end.ambiguous':
    '{art}: {grund}',
  'chain.passThrough.patch-panel':
    'Patchfeld',
  'chain.passThrough.converter':
    'Wandler',
  'chain.passThrough.distribution-amp':
    'Distribution amplifier',
  'chain.passThrough.router':
    'Kreuzschiene',
  'chain.passThrough.mixer':
    'Mischer',
  'chain.passThrough.adapter':
    'Adapter',
  // Rueckfall-Saetze und Blatt-Zellen (#1142, Reste).
  'rest.asset.unnamed':
    'nicht benannt',
  'rest.label.none':
    'kein Etikett',
  'rest.checkout.overdue':
    'überfällig',
  'rest.checkout.open':
    'offen',
  'rest.custody.overdueSince':
    'überfällig seit {bis}',
  'rest.custody.backOn':
    'zurück {bis}',
  'rest.inventory.noLocation':
    'ohne Lagerort',
  'rest.abnahme.statusFault':
    'Status „Störung"',
  'rest.abnahme.statusPlanned':
    'Status „Geplant" — noch nicht installiert',
  'rest.action.overdue':
    '{model} ist überfällig',
  'rest.action.noReturn':
    '{model} hat kein Rückgabedatum',
  'rest.attach.targetGone':
    'Ziel nicht mehr im Plan',
  'rest.channel.from':
    'aus: {name}',
  'rest.delivery.noProgramCable':
    '{name} hat an keinem Programm-Eingang ein Kabel',
  'rest.delivery.noProgramCableEncoder':
    'Der Encoder hat an keinem Programm-Eingang ein Kabel',
  'rest.delivery.backupOf':
    'Backup von {name}',
  'rest.delivery.primary':
    'Primärweg',
  'rest.encoder.keychain':
    'Schlüsselbund: stream-key:{id}',
  'rest.encoder.notStored':
    'nicht hinterlegt',
  'rest.stamp.drifted':
    '{rev} + Änderungen',
  'rest.stamp.noRevision':
    'keine Revision festgeschrieben',
  'rest.handover.noStatus':
    'ohne Status',
  'rest.stage.audio':
    '{n} Audio-Quellen/-Ziele · {k} Kanäle',
  'rest.stage.noAudio':
    '{n} Geräte — kein Audio-Kabel im Plan, daher alle',
  'rest.house.building':
    'Gebäude',
  'rest.config.cableLeadsTo':
    'Kabel an diesem Port führt zu {ziel}',
  'rest.config.noIp':
    'keine IP-Adresse im Plan',
  'rest.source.interface':
    'Schnittstelle',
  'rest.source.cable':
    'Kabel',
  'rest.switch.cableSays':
    'Kabel sagt: {x}',
  'rest.umd.roleWithout':
    'Rolle "{rolle}" speist {ziel} auf Eingang {n}, trägt aber keine UMD-Adresse',
  'rest.umd.noRole':
    'speist {ziel} auf Eingang {n} — ohne gebundene Rolle gibt es keinen Ort für die UMD-Adresse',
  'rest.mic.unassigned':
    'nicht belegt',
  'rest.mv.big':
    'groß',
  'rest.mv.small':
    'klein',
  'rest.diff.sameCount':
    '{a} Einträge, Inhalt geändert',
  'rest.diff.count':
    '{b} -> {a} Einträge',
  'rest.trace.notThrough':
    'Patchfeld {name}: der Anschluss gehört nicht zur Durchleitung',
  'rest.trace.uneven':
    'Patchfeld {name} ungleich bestückt ({hinten} hinten, {vorn} vorn) — die Position sagt hier nichts',
  'rest.trace.noCable':
    'An diesem Anschluss hängt kein Kabel',
  'rest.trace.notCabled':
    'Der Weiterweg ist im Plan nicht verkabelt',
  'rest.trace.manualOnly':
    'Nur von Hand eingetragen — im Plan liegt kein Kabel dorthin',
  'rest.trace.noCableIface':
    'An dieser Schnittstelle hängt kein Kabel',
  'rest.rack.bothOut':
    '{kabel}: {von} und {nach} sind beide Ausgänge',
  'rest.rack.bothIn':
    '{kabel}: {von} und {nach} sind beide Eingänge',
  'rest.record.noRecorder':
    'kein Recorder im Plan',
  'rest.scene.notStated':
    'nicht angegeben',
  'rest.scene.yes':
    'ja',
  'rest.scene.no':
    'nein',
  'rest.scene.unassigned':
    'nicht zugeordnet',
  'rest.scene.notInPlan':
    'nicht im Plan',
  'rest.chain.notThrough':
    'Anschluss gehört nicht zur Durchleitung des Patchfelds',
  'rest.chain.uneven':
    'Patchfeld ungleich bestückt ({hinten} hinten, {vorn} vorn) — die Position sagt hier nichts',
  'rest.chain.noCableOut':
    'Kreuzpunkt gesetzt, aber am geschalteten Ausgang hängt kein Kabel',
  'rest.chain.noOutput':
    'Die geplante Schaltung legt dieses Signal auf keinen Ausgang',
  'rest.route.noFloor':
    'Etage eines Raums nicht angegeben',
  'rest.route.noRiser':
    'Kein Steigschacht im Plan — der Weg zwischen den Etagen ist nicht bekannt',
  'rest.maint.noInterval':
    'kein Wartungsintervall angegeben',
  'rest.maint.noBasis':
    'kein Ausgangsdatum: weder Service-Eintrag noch Übergabe-Datum',
  'rest.maint.unreadable':
    'Ausgangsdatum nicht lesbar: {datum}',
  'rest.rf.notInTable':
    'nicht in {code}-Tabelle',
  'rest.rf.rangePro':
    '{code} {von}–{bis} MHz (nur prof. Produktion)',
  'rest.hub.testBench':
    'Prüfstand',
  'rest.hub.system':
    'Anlage',
  // Inventar-Stueckliste: Begruendung im Tooltip und in der CSV.
  'planBom.reason.origin':
    'Stammt (auch) aus: {liste}.',
  'planBom.reason.noCatalogType':
    'Ohne Katalog-Typ — Modellname ist der Gerätename.',
  // Warum ein Dokument nicht beurteilbar ist (UNJUDGEABLE_DOCUMENTS).
  'doc.unjudgeable.kabel-bom':
    'Der Inhalt hängt am Reserve-Aufschlag, den der Nutzer beim Export einstellt; dieser Prozentsatz steht nicht im Stempel.',
  'doc.unjudgeable.videohub-labels':
    'Es gibt eine Label-Datei je Videohub; das Register führt einen Stand je Bezeichner. Ein gemeinsamer Stand wäre beim zweiten Gerät falsch.',
  'doc.unjudgeable.atem-mv-layout':
    'Es gibt ein Multiviewer-Layout je Mischer, und die Fensterzahl ist eine Einstellung am Gerät, die nicht im Plan steht.',
  'doc.unjudgeable.switch-port-karte':
    'Es gibt eine Port-Karte je Switch; dieselbe Begründung wie bei den Videohub-Labels.',
  'doc.unjudgeable.stueckliste':
    'Der Inhalt hängt am Lagerbestand, der projektübergreifend lebt und nicht im Plan steht — dieselbe Liste ergibt morgen ein anderes Ergebnis.',
  'doc.unjudgeable.job-grundlage':
    'Der Zustand hängt an der Revisionsliste (As-Built). Der Revisions-Vergleich spannt Snapshots ohne diese Liste auf — ein Stand daraus meldete jedes Blatt als überholt, obwohl sich nichts geändert hat.',
  'doc.unjudgeable.kunden-uebersicht':
    'Jede Zeile nennt ihre Grundlage (Plan, As-Built, gemeldet), und die hängt an der Revisionsliste. Der Revisions-Vergleich spannt Snapshots ohne diese Liste auf — ein Stand daraus meldete jedes Blatt als überholt.',
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
  // Steuerung, Netz, Tally, Lager (#1142)
  'addressTemplate.containerHoldsDevice': '{where} steht auf {ip} — das liegt in der Klammer {range} ({cidr}), aber in keinem ihrer Unterbereiche. Der Unterbereich, in den das Gerät gehört, fehlt im Plan.',
  'addressTemplate.deviceOutside': '{where} ist "{role}" und steht auf {ip}. Geplant ist dafür {ranges}. Die Adresse liegt in keinem davon.',
  'addressTemplate.keyTwice': 'Ebene "{layer}" führt den Schlüssel "{key}" zweimal ({a} {aCidr} und {b} {bCidr}). Dann ist nicht entscheidbar, welchen der beiden eine Haus-Ebene ersetzt.',
  'addressTemplate.overlap': '{a} ({aCidr}, {aLayer}) und {b} ({bCidr}, {bLayer}) liegen auf denselben Adressen, und der äußere der beiden ist keine Klammer. Zwei Zwecke auf denselben Adressen erzeugen die doppelte IP, die einen Teil des Netzes stehen lässt.',
  'addressTemplate.venueOrphan': '{range} ({cidr}) trägt den Schlüssel "{key}", den der stehende Plan nicht kennt — ersetzt also nichts — und überschneidet sich mit {other} ({otherCidr}). Entweder ist der Schlüssel vertippt und die gemeinte Ersetzung findet nicht statt, oder beide Bereiche gelten nebeneinander auf denselben Adressen.',
  'addressTemplate.vlanMismatch': '{where} steht in VLAN {vlan}, ihre Adresse {ip} liegt aber in {range} ({cidr}), geplant für VLAN {planned}.',
  'asset.text.anchorWithoutUnit': '{device} trägt {anchors}, aber es steht nicht, WELCHE Kiste das ist. Wird sie am Ladetag gegen eine baugleiche getauscht, wandert der eingebrannte Geräte-Name mit — und die Abonnements zeigen ins Leere, ohne dass etwas rot wird.',
  'asset.text.serialMismatch': '{device}: am Platz steht Seriennummer {planned}, die zugeordnete Einheit trägt {actual}. Zwei Aufzeichnungen über dieselbe Kiste widersprechen sich — welche stimmt, sagt der Plan nicht, aber eine von beiden ist von einem Tausch übrig.',
  'asset.text.twice': 'Eine Einheit steht in {n} Plätzen: {slots}. Eine Kiste steht an einem Ort — einer der Plätze führt einen Rest von gestern.',
  'asset.text.twiceSerial': 'Einheit {serial} steht in {n} Plätzen: {slots}. Eine Kiste steht an einem Ort — einer der Plätze führt einen Rest von gestern.',
  'asset.text.unitBlocked': '{device} ist mit {unit} belegt, und die Einheit steht auf „{condition}". Sie geht so nicht raus.',
  'asset.text.unitMissing': '{device} nennt eine Einheit, die im Bestand nicht steht. Entweder ist sie gelöscht worden, oder der Plan kommt aus einer anderen Lagerdatenbank.',
  'asset.text.unitNotIssued': '{device} nennt Einheit {unit}, die auf keinem offenen Ausgabeschein steht. Entweder fährt eine andere Kiste mit, oder der Schein ist unvollständig.',
  'channelIdentity.bareName': '{n} Kanal/Kanäle tragen als Quelle nur eine Nummer. Eine Nummer an der Stelle eines Namens sagt weder am Pult noch im Multitrack noch auf dem Etikett etwas — genau der Zustand, in dem Dante Controller grüne Haken zeigt und trotzdem niemand weiß, welcher Kanal gemeint ist.',
  'channelIdentity.noName': '{n} Kanal/Kanäle haben gar keinen Namen. Sie erscheinen überall als „{placeholder}"; unterscheidbar sind sie dann nur über ihren Port.',
  'channelIdentity.noPort': '{n} Kanal/Kanäle haben keinen Haus-Port. Auf dem Blatt für den Haustechniker steht dort die interne Nummer mit dem Zusatz „{note}" — die einzige Nummer, die draußen etwas bedeutet, fehlt also und wird nicht erfunden.',
  'channelIdentity.portDuplicate': '{n} Kanäle liegen auf „{port}". Ein Eingang nimmt ein Signal; einer der beiden ist beim Abstecken übrig, und welcher, entscheidet sich erst im Saal.',
  'circuit.alwaysOn': 'Die Leuchte brennt in jeder Stellung — der Schalter liegt nicht im Weg. Das lässt sich nur durch Umlegen oder Entfernen einer Ader beheben, nicht durch eine zusätzliche; deshalb steht hier kein Vorschlag.',
  'circuit.assume.feeds': 'Alle Einspeisungen führen Spannung.',
  'circuit.assume.protection': 'FI, LS, Not-Aus, Schütz und Relais sind leitend angenommen.',
  'circuit.edge': '{from} Klemme {fromT} → {to} Klemme {toT}',
  'circuit.feedOff': 'Keine Einspeisung steht auf „an". Für die Prüfung wird angenommen, dass Spannung anliegt.',
  'circuit.lampMissing': 'Es gibt keine Leuchte „{lamp}".',
  'circuit.lampUnwired': 'An der Leuchte hängt keine Ader.',
  'circuit.layOne': 'Eine Ader legen: {a}.',
  'circuit.layTwo': 'Zwei Adern legen: {a} und {b}.',
  'circuit.limit.pairs': 'Keine einzelne Ader genügt, und {n} Zweier-Kombinationen sind mehr als die {max}, die geprüft werden.',
  'circuit.limit.positions': 'Mehr als {n} Stellungs-Kombinationen — die Tafel wäre nicht mehr durchzurechnen.',
  'circuit.limit.terminals': '{n} freie Klemmen — mehr als die {max}, die durchprobiert werden.',
  'circuit.manyLamps': 'Der Stromkreis hat {n} Leuchten — welche geprüft werden soll, muss benannt werden.',
  'circuit.neverOn': 'Die Leuchte brennt nicht.',
  'circuit.neverOnAny': 'Die Leuchte brennt in keiner Stellung.',
  'circuit.noFeed': 'Der Stromkreis hat keine Einspeisung — ohne sie brennt keine Leuchte, gleich wie verdrahtet wird.',
  'circuit.noLamp': 'Der Stromkreis enthält keine Leuchte.',
  'circuit.noSwitch': 'Der Stromkreis hat keinen Bedienschalter — eine Leuchte darin ist immer an oder immer aus. Geprüft wird deshalb nur, ob sie überhaupt brennt.',
  'circuit.switchNoEffect': '„{switch}" schaltet die Leuchte nicht in jeder Stellung der anderen Schalter — im Flur heisst das: er wirkt manchmal nicht.',
  'control.atem.badRole': '„{device}": der Ausgang „{port}" ist als „{role}" eingetragen — das kennt der ATEM nicht.',
  'control.atem.noRole': '„{device}": beim Ausgang „{port}" ist nicht eingetragen, ob er Programm, Vorschau oder ein Aux ist (Anschlüsse → Steuerung).',
  'control.atem.noSource': '„{device}": dem Eingang „{port}" fehlt die Quellen-Nummer des Mischers (Anschlüsse → Steuerung).',
  'control.companion.cannotBuild': '„{device}": die Companion-Aufrufe lassen sich nicht bilden.',
  'control.companion.noAddress': 'Für „{device}" ist keine Companion-Adresse hinterlegt (Eigenschaften des Geräts, Feld IP-Adresse).',
  'control.companion.noButton': 'Für „{device}" ist keine Companion-Schaltfläche eingetragen (Eigenschaften → Schaltung).',
  'control.deviceError': '„{device}": {error}',
  'control.deviceGone': '„{device}" steht nicht mehr im Plan.',
  'control.noIp': 'Für „{device}" ist keine IP-Adresse hinterlegt (Eigenschaften des Geräts).',
  'control.noPortNumber': '„{device}": dem Anschluss „{port}" fehlt die Nummer am Gerät (Anschlüsse → Steuerung).',
  'control.noProtocol': 'Für „{device}" ist kein Steuer-Protokoll erklärt (Eigenschaften → Steuerung). Ohne Erklärung wird nichts gesendet — welches Protokoll ein Gerät spricht, lässt sich nicht am Namen ablesen.',
  'control.portGone': '„{device}": der Anschluss „{port}" gehört nicht mehr zum Gerät.',
  'control.text.cannotBuild': '„{device}": die Befehlszeile lässt sich nicht bilden.',
  'control.text.noPort': 'Für „{device}" ist kein Port eingetragen. Welchen das Gerät benutzt, steht im Handbuch.',
  'control.text.noTemplate': 'Für „{device}" ist keine Befehlszeile eingetragen (Eigenschaften → Schaltung). Sie steht im Handbuch des Geräts — geraten wird sie nicht.',
  'erp.ignored.comment': 'Kommentarzeile, kein Gerät',
  'erp.ignored.setChild': 'Inhalt einer Kombination, im Elternteil gezählt',
  'erp.ignored.zero': 'Menge 0 — gestrichene Zeile',
  'handover.finding.unsignedIn': '"{container}" ist zurück, aber die Rückgabe ist NICHT gegengezeichnet. Bei einer Nachfrage in drei Wochen steht Aussage gegen Aussage.',
  'handover.finding.unsignedOut': '"{container}" ist ausgegeben, aber die Ausgabe ist nicht quittiert.',
  'inventory.history.condition': 'Zustand → {condition}',
  'inventory.history.created': 'angelegt',
  'inventory.history.locationDeleted': 'Lagerort gelöscht',
  'inventory.history.movedTo': 'nach {location}',
  'inventory.history.removed': 'aus Lagerort entfernt',
  'mv.finding.duplicate': 'MV {mv}: {n} Fenster zeigen "{name}" ({windows}). Dann fehlt eine andere Quelle im Bild.',
  'mv.finding.empty': 'MV {mv}: Fenster {window} ist nicht belegt.',
  'mv.finding.sourceN': 'Quelle {n}',
  'mv.finding.unknownSource': 'MV {mv}: Fenster {window} zeigt Quelle {source}, zu der der Plan keine Rolle kennt.',
  'netbox.skip.direction': 'Keine gültige Ausgang→Eingang-Richtung: beide Enden sind gleichgerichtet (z. B. zwei Strom-Eingänge).',
  'netbox.skip.multiTermination': 'Mehrfach-Terminierung: nur das jeweils erste Ende wurde übernommen.',
  'netbox.skip.oneEnd': 'Kabel hat in NetBox nur ein belegtes Ende.',
  'netbox.skip.outside': 'Mindestens ein Kabelende liegt außerhalb des importierten Bereichs.',
  'optics.coverage.marginal': 'Bildkreis knapp ({pct} %) — Ecken können abdunkeln.',
  'optics.coverage.vignette': 'Objektiv deckt den Sensor nicht ({pct} %) — starke Vignettierung, Crop nötig.',
  'provenance.portsUnknown': 'Beim Import gab es keinen Datenblatt-Treffer. Die Ports sind leer, weil keine erfunden wurden — nicht, weil das Gerät keine hätte.',
  'provenance.rentmanSent': 'Diese Menge wurde an Rentman geschickt. Rentman meldet nicht zurück, ob sie dort angekommen ist — ein Rücklesen kostete einen zweiten API-Aufruf je Position gegen ein Rate-Limit.',
  'salvo.duplicateName': '{n} Sätze heissen "{name}". Wer am Telefon „fahr Satz X" sagt, meint dann zwei verschiedene Zustände.',
  'salvo.empty': '"{name}" sagt zu keinem Ausgang etwas — er stellt beim Aufruf nichts um.',
  'salvo.partialCoverage': '"{a}" und "{b}" decken verschiedene Ausgänge ab ({onlyA} nur hier, {onlyB} nur dort). Auf dem Umbau-Zettel steht dort "{notSet}", und davor steht beim Umbau jemand ratlos.',
  'segment.mixed': '{name} führt Medien UND Steuerung. Der Beleg verlangt getrennte Segmente: Steuerverkehr im Medien-VLAN sitzt auf demselben PTP wie die Audio-Uhr.',
  'segment.orphan': 'VLAN {vlan} ist hinterlegt, aber weder benannt noch benutzt.',
  'segment.ptpMismatch': '{name} ist auf PTP-Domäne {planned} geplant, {where} steht auf {actual}.',
  'segment.roleMismatch': '{where} ist "{role}", liegt aber in {name} ("{purpose}").',
  'segment.unnamed': 'VLAN {vlan} trägt {n} Schnittstelle(n), aber keinen Namen — eine Zahl allein sagt niemandem, ob Dante dort hin darf.',
  'sourceMap.umdRange': 'TSL UMD v3.1 kennt nur ganze Adressen {min}–{max}',
  'tallyMap.duplicateUmd': 'UMD-Adresse {address} ist doppelt vergeben: {roles}. Beide Displays zeigen denselben Text.',
  'tallyMap.noDevice': 'Rolle "{role}" ist an kein Gerät gebunden — es gibt nichts, dessen Tally geschaltet würde.',
  'tallyMap.noSwitcherInput': 'Rolle "{role}" erreicht keinen Mischer-Eingang — ohne Eingang gibt es kein Tally-Signal.',
  'tallyMap.noUmd': 'Rolle "{role}" hat keine UMD-Adresse — das Display bleibt leer.',
  'tallyMap.routerNotResolved': 'Rolle "{role}" erreicht {router} auf Eingang {input}, aber der Kreuzpunkt zum Mischer ist nicht geplant — welchen Mischer-Eingang das Tally schaltet, ist damit offen. Kreuzpunkt im Videohub-Export setzen.',
  'tallyMap.sourceWithoutRole': '"{source}" speist {sink} auf Eingang {input}, trägt aber keine Rolle — ohne Rolle kein Tally-Eintrag.',
  'tallyPos.finding.dark': '"{role}" blieb bei der letzten Prüfung dunkel.',
  'tallyPos.finding.halfPreview': '"{role}": nur halb geprüft — die Vorschau fehlt. Genau dort sitzt der Fehler aus DistroAV#318: rot, obwohl nie auf Sendung.',
  'tallyPos.finding.halfProgram': '"{role}": nur halb geprüft — die Programm fehlt. Ohne das Programm-Tally ist die Hauptrichtung ungeprüft.',
  'tallyPos.finding.lying': '"{role}" zeigte bei der letzten Prüfung etwas Falsches (Programm: {program}, Vorschau: {preview}).',
  'tallyPos.finding.ndiPreview': '"{role}" hängt am NDI-Tally: dort kann schon ein Multiview ein Vorschau-Tally auslösen (DistroAV#318). Vorschau getrennt prüfen.',
  'tallyPos.finding.noEndpoint': '"{role}": {transport} ohne Adresse — auf dem Blatt steht dann kein Wert, den jemand am Gerät nachsehen kann.',
  'tallyPos.finding.noPosition': 'Für "{role}" ist kein Tally-Weg hinterlegt.',
  'tallyPos.finding.noTransport': '"{role}": Tally-Weg nicht festgelegt.',
  'tallyPos.finding.unchecked': '"{role}": {state}.',
  'templateScope.carries': '{n} Antwort(en) aus „{from}" gelten hier weiter — dasselbe Haus.',
  'templateScope.elsewhere': '{n} Antwort(en) stammen aus „{from}", das Projekt steht in „{to}". Sie werden als „aus einem anderen Haus" geführt und gelten hier nicht.',
  'templateScope.none': 'Die Vorlage bringt keine Antworten eines Hauses mit — nur die Form.',
  'templateScope.unknownVenue': '{n} Antwort(en) stammen aus „{from}". Solange das Projekt keinen Ort nennt, bleibt offen, ob sie hier gelten.',
  'unitIdentity.houseRefTwice': '{n} Einheiten tragen die Hausreferenz „{value}". Im eigenen Haus ist das die Nummer, die der Lagerist ruft — sie zweimal zu vergeben heißt, dass er die falsche Kiste holt.',
  'unitIdentity.none': '{n} Einheit(en) tragen weder Herstellernummer noch Hausreferenz noch Etiketten-Code. Auf jedem Blatt stehen sie als „{placeholder}" — unterscheidbar sind sie dann nur über ihren Platz im Regal.',
  'unitIdentity.serialTwice': '{n} Einheiten tragen die Herstellernummer „{value}". Eine Seriennummer gibt es genau einmal — entweder ist eine falsch getippt, oder dieselbe Kiste steht zweimal im Bestand und die Inventur zählt eine zu viel.',
  'coverage.reason.nearName': 'Modellname weicht um höchstens {n} Zeichen ab ("{model}") — bitte prüfen.',
  'coverage.reason.sameName': 'Modellname stimmt überein ("{model}"), aber die Lager-Position trägt keine Typ-Identität.',
  'tallyPos.obs.not-checked': 'nicht geprüft',
}
