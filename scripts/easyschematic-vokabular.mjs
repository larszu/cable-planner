// ───────────────────────────────────────────────────────────────────────────
// Die Vokabel-Bruecke zur EasySchematic-Datenbank.
//
// HERKUNFT DER DATEN: die offene Lese-API von EasySchematic
// (https://api.easyschematic.live/templates, Projekt
// https://github.com/duremovich/EasySchematic, AGPL-3.0). Uebernommen auf
// ausdrueckliche Anweisung des Eigentuemers am 2026-09-24. Jeder erzeugte
// Eintrag traegt die Herkunft im Feld `herkunft`, und der Kopf der erzeugten
// Datei nennt sie ebenfalls — eine Uebernahme, die man der Datei nicht
// ansieht, waere in ein paar Monaten nicht mehr nachvollziehbar.
//
// ─── WARUM DIE ABBILDUNG EINE EIGENE DATEI IST ─────────────────────────────
//
// Sie ist der Ort, an dem zwei Weltbilder aufeinandertreffen: 84 Steckertypen
// und 73 Signalarten dort gegen unsere Liste hier. Das ist keine Mechanik,
// sondern eine Reihe von ENTSCHEIDUNGEN, und jede einzelne kann falsch sein.
// In der Generator-Datei verschwaenden sie zwischen Schleifen; hier stehen sie
// als Tabelle, die man Zeile fuer Zeile gegen ein Datenblatt halten kann.
//
// ─── DIE REGEL FUER DEN REST ───────────────────────────────────────────────
//
// Was hier nicht steht, wird `Custom` — und NICHT der naechstbeste Stecker.
// Ein `d-hole-insert`, den wir zu `XLR` machen, waere eine Falschaussage in
// der Patchliste; ein `Custom` ist eine ehrliche Luecke, die auffaellt. Der
// Generator ZAEHLT die Rueckfaelle und schreibt die Zahl in den Dateikopf.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Steckertyp dort → Steckertyp hier.
 *
 * `connectorType` ist bei uns zur Laufzeit ein freier String — der Kopf von
 * `lib/connectorCatalog.ts` sagt es ausdruecklich: „Neue Stecker bekommen eine
 * eigene String-ID […] sodass das ohne Union-Erweiterung traegt." Wo unsere
 * Union oder der Stecker-Katalog schon etwas fuehrt, wird DAS genommen; wo
 * nicht, steht hier ein neuer sprechender String statt eines erzwungenen
 * Treffers.
 */
export const STECKER = {
  // ── Netz und Daten ──
  'rj45': 'Ethernet/RJ45',
  'ethercon': 'etherCON',
  'rj11': 'RJ11',
  'rj12': 'RJ11',
  'sfp': 'SFP',
  'qsfp': 'QSFP',
  'qsfp28': 'QSFP28',
  'usb-a': 'USB Type A',
  'usb-b': 'USB Type B',
  'usb-c': 'USB-C',
  'usb-mini': 'USB Mini-B',
  'usb-micro': 'USB Micro-B',
  'db9': 'DB9',
  'db15': 'DB15',
  'db25': 'DB25',
  'db37': 'DB37',
  'mini-din-4': 'Mini-DIN 4',
  'mini-din-7': 'Mini-DIN 7',
  'mini-din-8': 'Mini-DIN 8',

  // ── Video ──
  'bnc': 'BNC',
  'hdmi': 'HDMI',
  'mini-hdmi': 'Mini-HDMI',
  'micro-hdmi': 'Micro-HDMI',
  'displayport': 'DisplayPort',
  'mini-displayport': 'Mini-DisplayPort',
  'vga': 'VGA',
  'dvi': 'DVI',
  'f-connector': 'F-Connector',
  'sma': 'SMA',
  'reverse-tnc': 'RP-TNC',

  // ── Audio ──
  // `xlr-3` und `xlr-5` haengen am Signal: eine fuenfpolige XLR mit DMX
  // darauf IST der DMX-Stecker, und die Patchliste soll ihn so nennen.
  // Das steht im Generator, weil es zwei Felder braucht; hier die Vorgabe.
  'xlr-3': 'XLR',
  'xlr-4': 'XLR 4 Male',
  'xlr-5': 'XLR 5 Male',
  'mini-xlr': 'Mini-XLR',
  'combo-xlr-trs': 'Combo XLR/Jack',
  'trs-quarter': 'Jack 6.35 mm TRS',
  'ts-quarter': 'Jack 6.35 mm TS',
  'trs-eighth': 'Jack 3.5 mm TRS',
  'mini-trs': 'Jack 3.5 mm TRS',
  'trs-2.5mm': 'Jack 2.5 mm TRS',
  'rca': 'Cinch/RCA',
  'speakon': 'speakON',
  'binding-post': 'Binding Post',
  'binding-post-banana': 'Binding Post',
  'banana': 'Binding Post',
  'toslink': 'Toslink',
  'din-5': 'DIN 5',
  // Schraubklemmen. 7901 + 1612 Anschluesse — der haeufigste Stecker der
  // ganzen Datenbank und bei uns bisher gar nicht da. Ihn auf `Custom` zu
  // werfen haette fast ein Fuenftel aller uebernommenen Anschluesse
  // unbeschriftet gelassen.
  'phoenix': 'Phoenix/Euroblock',
  'terminal-block': 'Terminal Block',
  'bare-wire': 'Blankdraht',

  // ── Glasfaser ──
  'lc': 'Fiber Optic LC',
  'sc': 'Fiber Optic SC',
  'mpo': 'MPO',
  'opticalcon': 'opticalCON',

  // ── Strom ──
  'iec': 'IEC 230V',
  'iec-c5': 'IEC C5 (Kleeblatt)',
  'iec-c7': 'C7 Eurostecker',
  'iec-c15': 'IEC C15',
  'iec-c20': 'IEC C20',
  'edison': 'NEMA 5-15 (Edison)',
  'l5-20': 'NEMA L5-20',
  'l6-20': 'NEMA L6-20',
  'l6-30': 'NEMA L6-30',
  'l21-30': 'NEMA L21-30',
  'powercon': 'PowerCON',
  'powercon-true1': 'powerCON TRUE1',
  'cam-lok': 'Cam-Lok',
  'socapex': 'Socapex',
  'd-tap': 'D-Tap',
  'v-mount': 'V-Mount',
  'pcie-6pin': 'PCIe 6-pin',
  'barrel': 'DC Barrel',

  // ── Sonstiges mit eigenem Namen ──
  'lemo-2pin': 'Lemo 2-pin',
  'lemo-4pin': 'Lemo 4-pin',
  'lemo-5pin': 'Lemo 5-pin',
  'wireless': 'Wireless/RF',
  'multipin': 'Multipin',
  'digilink': 'DigiLink',
  'kycon-4pin': 'Kycon 4-pin',
  'db7w2': 'DB7W2',
  'd-hole-insert': 'D-Hole Insert',
}

/**
 * Signalart dort → Signalart hier (`Port.type`).
 *
 * Bei uns ist `type` ein freier Text, der auf dem Blatt steht. Uebernommen
 * wird deshalb ueberwiegend ihr Wort, nur in lesbarer Schreibweise — eine
 * Zwangs-Abbildung auf unsere kuerzere Liste haette `hdbaset`, `dante`,
 * `madi`, `aes50` und ein Dutzend andere auf „Sonstiges" eingeebnet, und
 * genau diese Woerter sind es, wegen derer jemand den Eintrag sucht.
 */
export const SIGNAL = {
  'analog-audio': 'Analog Audio',
  'speaker-level': 'Speaker Level',
  'contact-closure': 'Contact Closure',
  'control-voltage': 'Control Voltage',
  'component-video': 'Component Video',
  's-video': 'S-Video',
  'power-ground': 'Power (GND)',
  'power-neutral': 'Power (N)',
  'power-l1': 'Power (L1)',
  'power-l2': 'Power (L2)',
  'power-l3': 'Power (L3)',
  'extron-exp': 'Extron EXP',
  'blu-link': 'BLU link',
  'mpeg-ts': 'MPEG-TS',
}

/** Die Signalarten, die ihr Wort behalten — Grossschreibung nach Gebrauch. */
export const SIGNAL_GROSS = new Set([
  'sdi', 'hdmi', 'usb', 'gpio', 'aes', 'dmx', 'ir', 'rf', 'midi', 'madi',
  'vga', 'dvi', 'ndi', 'srt', 'avb', 'adat', 'aes67', 'aes50', 'spdif',
  'st2110', 'rs422', 'rs485', 'pots', 'gps', 'dx5', 'ydif', 'sacn', 'artnet',
  'rtsp', 'rtmp', 'dars', 'hdbaset', 'dxlink', 'cresnet', 'nlight', 'ebus',
  'slink', 'dsnake', 'gigaace', 'fibreace', 'ultranet', 'soundgrid',
  'stageconnect', 'digilink', 'wordclock', 'timecode', 'genlock', 'tally',
  'serial', 'sensor', 'fiber', 'dante', 'ethernet', 'power', 'bluetooth',
  'thunderbolt', 'composite', 'custom', 'displayport',
])

/**
 * Kategorie dort → Kategorie hier.
 *
 * Nur wo wir SCHON eine fuehren. Alles andere behaelt seinen Namen und wird
 * eine neue Kategorie — so hat der Eigentuemer es angewiesen („auch alle
 * neuen kategorien"). Eine erzwungene Einsortierung nach „Sonstiges" haette
 * dreissig Bereiche unsichtbar gemacht.
 */
export const KATEGORIE = {
  'Audio': 'Audio',
  'Microphones': 'Microphones',
  'Lighting': 'Lighting',
  'Networking': 'Networking',
  'Mixing Consoles': 'Mixing console',
  'Video': 'Video',
  // Ihr Tippfehler. Er wird HIER geheilt und nicht in einer Ausnahmeliste
  // weiter hinten: sonst stuenden bei uns zwei Kategorien mit demselben Wort.
  'VIdeo': 'Video',
  // Desgleichen: ihre Daten fuehren `Audio` und `audio` nebeneinander.
  'audio': 'Audio',
  'PTZ Camera': 'Cameras',
  'Displays': 'Monitors',
  'Computer': 'PC',
  'Cable Accessories': 'Cables',
}
