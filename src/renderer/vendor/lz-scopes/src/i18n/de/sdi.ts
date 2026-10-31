// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/sdi.ts.
import type en from '../en/sdi';
import type { Translation } from '../types';

export default {
  'sdi.yes': 'ja',
  'sdi.no': 'nein',
  'sdi.waiting': 'Noch keine Zusatzdaten vom DeckLink-Eingang',
  'sdi.noVanc': 'Keine SDI-Zusatzdaten – nur DeckLink-Eingänge liefern VANC',
  'sdi.no352': 'Keine ST-352-Payload-ID im Signal',
  'sdi.unknownPayload': 'Payload-Code {code}h (nicht in der Tabelle)',
  'sdi.format': '{rate} {scan} · {sampling} · {bits} Bit',
  'sdi.colour': 'Übertragung {transfer} · {colorimetry} · {aspect}',
  'sdi.warnTransfer': 'Signal meldet {sig}, Scopes lesen {scope} – umschalten in ⚙',
  'sdi.warnColorimetry': 'Signal meldet {sig}, Scopes rechnen mit Matrix {scope} – umschalten in ⚙',
  'sdi.mdcv': 'Mastering-Display {max}/{min} cd/m² · R x {rx} · G y {gy}',
  'sdi.cll': 'MaxCLL {cll} cd/m² · MaxFALL {fall} cd/m²',
  'sdi.dynamic': 'Dynamische Metadaten Typ {types}',
  'sdi.afd': 'AFD {code} · Bildformat {frame}',
  'sdi.presence': 'CEA-708 {c708} · CEA-608 {c608} · Audiogruppen {audio} · Steuerung {ctrl}',
  'sdi.packets': '{n} Pakettypen (Zeile, DID/SDID, Anzahl, Daten)',
  'sdi.follow': 'Werte des Signals übernehmen',
  'sdi.followTitle': 'Übertragung und Matrix dieser Quelle auf die ST-352-Werte setzen',
  'sdi.agree': 'Übertragung und Matrix stimmen mit ST 352 überein.',
  'sdi.hint': 'Aus den SDI-Zusatzdaten eines DeckLink-Eingangs gelesen (ST 352, ST 2108-1, ST 12-2, ST 2016-3). Noch nicht mit einer Karte getestet (#116).',
} satisfies Translation<typeof en>;
