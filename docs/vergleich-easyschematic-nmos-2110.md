# Vergleich: EasySchematic, NMOS und SMPTE ST 2110 (#1200)

Stand 2026-11-15. Gelesen wurden der Quelltext von
[EasySchematic](https://github.com/duremovich/EasySchematic) (AGPL-3.0),
[Atoll / pi-nmos-st2110](https://github.com/dgp1000/pi-nmos-st2110) (Apache-2.0),
[`@bitfocus/nmos`](https://github.com/bitfocus/nmos) (MIT) und
[SMPTE OV 2110-0:2018](https://pub.smpte.org/doc/ov2110-0/20181204-pub/).
Übernommen wurde nichts außer Begriffen; bei EasySchematic gilt dieselbe
Lizenzgrenze wie in [`katalog-luecken-easyschematic.md`](katalog-luecken-easyschematic.md).
Der Gerätekatalog steht dort und wird hier nicht wiederholt, NMOS als
Modellsprache steht in
[`konzept-mischer-kreuzschienen-simulation.md`](konzept-mischer-kreuzschienen-simulation.md) §6.

## EasySchematic

| Thema | EasySchematic | cable-planner | Lücke |
|---|---|---|---|
| Bildexport | PDF, PNG, SVG, DXF | PDF (Raster/Vektor), PNG, JPEG, SVG, DXF | keine |
| Listen | Kabelliste, Packliste, Netz-, Strom-, Patchfeld-, Rack-Bericht (CSV/PDF) | Kabel-, Patch-, Netz-, Multicast-, PTP-Listen (CSV/PDF), Rack, Etiketten | keine |
| Projekt als Datei | JSON-Export, CSV/JSON-Import | eigenes Projektformat, CSV-, GraphML-, NetBox-, GDTF/MVR-Import | keine |
| Geräteexport | keiner | Videohub, GreenGo, Intercom-XLSX, Rentman | — |
| ST 2110 als Signal | **ein** Typ `st2110` | Essenzen -20, -22, -30, -31, -40 | keine |
| IP-Audio-Protokolle | AVB, AES50, Ultranet, SoundGrid, StageConnect, Dante, AES67 u. a. | Dante, AES67, MADI, ST 2110-30/-31 | AVB, AES50, Ultranet u. a. fehlen → #1279 |
| Lautsprecherpegel, S/PDIF, ADAT, MIDI | vorhanden | fehlt (nur MTC) | → #1279 |
| Streaming | SRT, RTMP, RTSP, MPEG-TS | SRT, RTMP, HLS, DVB-ASI | RTSP, MPEG-TS → #1279 |
| Stecker Euroblock/Phoenix | häufigster Stecker dort | fehlt | steht bereits in `katalog-luecken-easyschematic.md` |
| Netz-Prüfungen | doppelte IP, DHCP-Bereich, Subnetz-Konflikt, PoE-Budget | doppelte IP, Gateway/Subnetz, PoE-Budget, Multicast, PTP-Domänen, IGMP-Widerspruch | keine |
| Signal gegen Schnittstellen-Geschwindigkeit | nein | **neu:** `link-too-slow` | geschlossen |

EasySchematic ist für Installations-AV breiter im Vokabular, aber flach bei IP:
ST 2110 ist dort eine Farbe, keine Essenz. Hier fehlt die Breite, nicht die Tiefe.

## SMPTE ST 2110

| Teil | Inhalt | cable-planner | Lücke |
|---|---|---|---|
| -10 | Systemzeit, RTP, SDP | PTP-Plan, Grandmaster-Prüfung | SDP-Ausgabe fehlt → #1240 Punkt 6 |
| -20 | unkomprimiertes Video | Signal, 3000 Mbps fest | Bandbreite nach Format → #1280 |
| -21 | Sendeprofil (N/NL/W) | fehlt | → #1280 |
| -22 | komprimiert mit konstanter Bitrate (JPEG XS) | **neu**, 300 Mbps | geschlossen |
| -30 | PCM-Audio (AES67-Profil) | Signal, Audio-Multicast, PTP-Familie | keine |
| -31 | AES3 transparent (Dolby E) | **neu**, wie -30 eingeordnet | geschlossen |
| -40 | ANC (RFC 8331) | Signal, eigene Multicast-Gruppe | keine |
| ST 2022-7 | Rot/Blau-Redundanz | Multicast-Bein a/b, Prüfung „beide Beine auf einer Gruppe“, VLAN-Prüfung | keine |
| ST 2059-2 / PTP | Profil, Domäne 127 | `ptpPlan`: Domänen-, Profil-, Grandmaster-Befunde | keine |

Nebenbefund: `bandwidthMbpsForStandard` gibt für -30/AES67/Dante 49 Mbps an und
nannte das „64 ch @ 48 kHz/24 bit“. Das ist die Rechnung mit 16 bit; 64 Kanäle
L24 wären etwa 74 Mbps. Der Kommentar ist berichtigt, der Wert bleibt
Richtwert (eher 32–48 Kanäle L24), weil Tests und Netzbudget auf ihm stehen.

## NMOS

| Thema | Atoll / bitfocus | cable-planner | Lücke |
|---|---|---|---|
| IS-04 Discovery | Registry, Inspektor; bitfocus: typisierte GET-Abfragen mit Schema-Prüfung | nur Erinnerung `st2110-no-nmos` | IS-04 einlesen → #1240 Punkt 6 |
| IS-05 Verbindungen | Take aus der Bedienoberfläche | keine Ausgabe | IS-05 ausgeben → #1240 Punkt 6 |
| IS-07 Tally | über WebSocket an jeder Quelle | Tally als Signal und Prüfung, nicht über NMOS | in der Bridge (`tally-in-der-bridge`), nicht im Planner |
| IS-08 / IS-12 | nicht vorhanden | Konzept §6 | → #1240 Punkt 6 |

`@bitfocus/nmos` ist MIT und deckt nur IS-04-GET ab. Als Baustein für das
Einlesen einer Registry taugt es; der Planner hat aber keinen Netzzugriff im
Renderer, der Weg liefe über `main` wie bei NetBox.
