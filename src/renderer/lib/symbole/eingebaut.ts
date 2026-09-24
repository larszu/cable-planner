// Eingebaute Symbole.
//
// Gezeichnet IN ANLEHNUNG an die gebraeuchlichen Planzeichen (DIN EN 60617
// fuer Elektro, DIN 14034-6 / DIN VDE 0833 fuer Gefahrenmeldeanlagen), nicht
// gegen den Normtext geprueft. Wo ein Zeichen in der Praxis ueber ein
// Kuerzel erkannt wird (BMZ, HFM, FSD), steht das Kuerzel im Kasten — das
// ist die Form, die auf Revisionsplaenen tatsaechlich zu finden ist.
//
// Einheitliches Raster 48×48, Strich 2, keine Fuellung ausser wo das Zeichen
// sie verlangt. Die Farbe ist fest dunkel; im dunklen Canvas-Thema kehrt
// `SymbolNode` sie per CSS um. `currentColor` ginge nicht: gezeichnet wird
// ueber <img>, und dort erbt ein SVG keine Farbe.

import type { SymbolDef, SymbolKategorie } from '../../types/symbol'

const svg = (inhalt: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inhalt}</svg>`

const kasten = (text: string, groesse = 12): string =>
  svg(
    `<rect x="4" y="10" width="40" height="28"/><text x="24" y="${24 + groesse * 0.36}" font-family="Arial,Helvetica,sans-serif" font-size="${groesse}" font-weight="700" fill="#111" stroke="none" text-anchor="middle">${text}</text>`,
  )

const def = (id: string, name: string, kategorie: SymbolKategorie, inhalt: string): SymbolDef => ({
  id: `builtin:${id}`,
  name,
  kategorie,
  svg: inhalt,
  herkunft: 'eingebaut',
})

export const EINGEBAUTE_SYMBOLE: SymbolDef[] = [
  // ── Elektro ──
  def('steckdose', 'Socket outlet', 'elektro', svg('<path d="M10 28a14 14 0 0 1 28 0"/><line x1="24" y1="28" x2="24" y2="42"/><line x1="10" y1="28" x2="38" y2="28"/>')),
  def('steckdose-schutz', 'Socket outlet, protective contact', 'elektro', svg('<path d="M10 28a14 14 0 0 1 28 0"/><line x1="24" y1="28" x2="24" y2="42"/><line x1="10" y1="28" x2="38" y2="28"/><line x1="24" y1="6" x2="24" y2="14"/>')),
  def('schalter', 'Switch', 'elektro', svg('<circle cx="16" cy="32" r="4"/><line x1="19" y1="29" x2="34" y2="14"/><line x1="34" y1="14" x2="39" y2="19"/>')),
  def('taster', 'Push button', 'elektro', svg('<circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="4" fill="#111"/>')),
  def('leuchte', 'Luminaire', 'elektro', svg('<circle cx="24" cy="24" r="14"/><line x1="14" y1="14" x2="34" y2="34"/><line x1="34" y1="14" x2="14" y2="34"/>')),
  def('verteiler', 'Distribution board', 'elektro', svg('<rect x="6" y="12" width="36" height="24"/><path d="M6 36 42 12 42 36Z" fill="#111"/>')),
  def('sicherung', 'Fuse', 'elektro', svg('<rect x="17" y="10" width="14" height="28"/><line x1="24" y1="4" x2="24" y2="44"/>')),
  def('fi', 'Residual current device', 'elektro', kasten('RCD')),
  def('zaehler', 'Energy meter', 'elektro', kasten('kWh')),
  def('erdung', 'Earth', 'elektro', svg('<line x1="24" y1="6" x2="24" y2="24"/><line x1="10" y1="24" x2="38" y2="24"/><line x1="15" y1="31" x2="33" y2="31"/><line x1="20" y1="38" x2="28" y2="38"/>')),
  def('motor', 'Motor', 'elektro', svg('<circle cx="24" cy="24" r="16"/><text x="24" y="30" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700" fill="#111" stroke="none" text-anchor="middle">M</text>')),
  def('trafo', 'Transformer', 'elektro', svg('<circle cx="18" cy="24" r="11"/><circle cx="30" cy="24" r="11"/>')),
  def('abzweigdose', 'Junction box', 'elektro', svg('<circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="3" fill="#111"/><line x1="4" y1="24" x2="14" y2="24"/><line x1="34" y1="24" x2="44" y2="24"/>')),
  def('cee', 'CEE socket', 'elektro', kasten('CEE')),

  // ── EMA ──
  def('emz', 'Intrusion alarm panel', 'ema', kasten('EMZ')),
  def('ema-bedienteil', 'Keypad', 'ema', svg('<rect x="10" y="6" width="28" height="36"/><rect x="15" y="11" width="18" height="7"/><circle cx="17" cy="25" r="1.5" fill="#111"/><circle cx="24" cy="25" r="1.5" fill="#111"/><circle cx="31" cy="25" r="1.5" fill="#111"/><circle cx="17" cy="31" r="1.5" fill="#111"/><circle cx="24" cy="31" r="1.5" fill="#111"/><circle cx="31" cy="31" r="1.5" fill="#111"/><circle cx="17" cy="37" r="1.5" fill="#111"/><circle cx="24" cy="37" r="1.5" fill="#111"/><circle cx="31" cy="37" r="1.5" fill="#111"/>')),
  def('bewegungsmelder', 'Motion detector (PIR)', 'ema', svg('<rect x="6" y="14" width="14" height="20"/><path d="M26 18a8 8 0 0 1 0 12"/><path d="M31 14a14 14 0 0 1 0 20"/><path d="M36 10a20 20 0 0 1 0 28"/>')),
  def('magnetkontakt', 'Magnetic contact', 'ema', svg('<rect x="6" y="18" width="16" height="12"/><rect x="26" y="18" width="16" height="12"/><line x1="10" y1="24" x2="18" y2="24"/>')),
  def('glasbruch', 'Glass break detector', 'ema', svg('<rect x="6" y="10" width="36" height="28"/><path d="M10 30 17 18 22 28 28 16 33 27 38 20"/>')),
  def('ema-sirene', 'Siren (intrusion)', 'ema', svg('<path d="M8 18h8l12-8v28l-12-8H8Z"/><path d="M33 17a9 9 0 0 1 0 14"/><path d="M38 12a16 16 0 0 1 0 24"/>')),
  def('blitzleuchte', 'Strobe', 'ema', svg('<circle cx="24" cy="24" r="8"/><line x1="24" y1="4" x2="24" y2="10"/><line x1="24" y1="38" x2="24" y2="44"/><line x1="4" y1="24" x2="10" y2="24"/><line x1="38" y1="24" x2="44" y2="24"/><line x1="10" y1="10" x2="14" y2="14"/><line x1="34" y1="34" x2="38" y2="38"/><line x1="38" y1="10" x2="34" y2="14"/><line x1="14" y1="34" x2="10" y2="38"/>')),

  // ── BMA ──
  def('bmz', 'Fire alarm panel', 'bma', kasten('BMZ')),
  def('rauchmelder', 'Smoke detector', 'bma', svg('<rect x="8" y="8" width="32" height="32"/><path d="M16 32c0-5 6-5 6-10s-6-5-6-10"/><path d="M26 32c0-5 6-5 6-10s-6-5-6-10"/>')),
  def('waermemelder', 'Heat detector', 'bma', svg('<rect x="8" y="8" width="32" height="32"/><line x1="24" y1="13" x2="24" y2="28"/><circle cx="24" cy="32" r="4"/><line x1="28" y1="16" x2="31" y2="16"/><line x1="28" y1="21" x2="31" y2="21"/>')),
  def('flammenmelder', 'Flame detector', 'bma', svg('<rect x="8" y="8" width="32" height="32"/><path d="M24 34c-6 0-8-5-6-10 1 2 3 3 3 3-1-6 3-10 5-12 0 4 5 6 5 12 0 4-3 7-7 7Z"/>')),
  def('hfm', 'Manual call point', 'bma', kasten('HFM')),
  def('fsd', 'Fire brigade key depot', 'bma', kasten('FSD')),
  def('fbf', 'Fire brigade panel', 'bma', kasten('FBF')),
  def('bma-signalgeber', 'Fire alarm sounder', 'bma', svg('<rect x="8" y="8" width="32" height="32"/><path d="M14 20h5l8-6v20l-8-6h-5Z"/><path d="M31 19a7 7 0 0 1 0 10"/>')),

  // ── SAA / ELA ──
  def('saz', 'Voice alarm panel', 'saa', kasten('SAZ')),
  def('lautsprecher', 'Loudspeaker', 'saa', svg('<rect x="8" y="17" width="8" height="14"/><path d="M16 17 30 8v32L16 31"/>')),
  def('deckenlautsprecher', 'Ceiling loudspeaker', 'saa', svg('<circle cx="24" cy="24" r="18"/><rect x="15" y="20" width="6" height="8"/><path d="M21 20 30 14v20l-9-6"/>')),
  def('hornlautsprecher', 'Horn loudspeaker', 'saa', svg('<rect x="6" y="19" width="8" height="10"/><path d="M14 19 40 8v32L14 29Z"/>')),
  def('verstaerker', 'Amplifier', 'saa', svg('<path d="M10 8 40 24 10 40Z"/><line x1="2" y1="24" x2="10" y2="24"/><line x1="40" y1="24" x2="46" y2="24"/>')),
  def('mikrofon', 'Microphone', 'saa', svg('<circle cx="24" cy="18" r="10"/><line x1="24" y1="28" x2="24" y2="42"/><line x1="16" y1="42" x2="32" y2="42"/>')),
  def('sprechstelle', 'Paging station', 'saa', svg('<rect x="6" y="26" width="36" height="14"/><line x1="24" y1="26" x2="24" y2="14"/><circle cx="24" cy="10" r="4"/><line x1="12" y1="33" x2="18" y2="33"/>')),

  // ── IT / Netzwerk ──
  def('router', 'Router', 'it', svg('<circle cx="24" cy="24" r="18"/><path d="M14 14 20 20M20 14v6h-6"/><path d="M34 34 28 28M28 34v-6h6"/><path d="M34 14 28 20M34 20v-6h-6"/><path d="M14 34 20 28M14 28v6h6"/>')),
  def('switch', 'Switch', 'it', svg('<rect x="4" y="12" width="40" height="24"/><path d="M12 20h22l-4-4M36 28H14l4 4"/>')),
  def('access-point', 'Access point', 'it', svg('<rect x="12" y="30" width="24" height="10"/><path d="M16 22a11 11 0 0 1 16 0"/><path d="M11 17a18 18 0 0 1 26 0"/><circle cx="24" cy="26" r="1.5" fill="#111"/>')),
  def('server', 'Server', 'it', svg('<rect x="10" y="6" width="28" height="10"/><rect x="10" y="19" width="28" height="10"/><rect x="10" y="32" width="28" height="10"/><circle cx="15" cy="11" r="1.5" fill="#111"/><circle cx="15" cy="24" r="1.5" fill="#111"/><circle cx="15" cy="37" r="1.5" fill="#111"/>')),
  def('firewall', 'Firewall', 'it', svg('<rect x="6" y="10" width="36" height="28"/><line x1="6" y1="19" x2="42" y2="19"/><line x1="6" y1="28" x2="42" y2="28"/><line x1="18" y1="10" x2="18" y2="19"/><line x1="30" y1="10" x2="30" y2="19"/><line x1="12" y1="19" x2="12" y2="28"/><line x1="24" y1="19" x2="24" y2="28"/><line x1="36" y1="19" x2="36" y2="28"/><line x1="18" y1="28" x2="18" y2="38"/><line x1="30" y1="28" x2="30" y2="38"/>')),
  def('netzwerkdose', 'Network outlet', 'it', svg('<rect x="10" y="10" width="28" height="28"/><path d="M17 20h14v12h-3v3h-8v-3h-3Z"/>')),
  def('patchfeld', 'Patch panel', 'it', svg('<rect x="2" y="16" width="44" height="16"/><rect x="6" y="21" width="5" height="6"/><rect x="14" y="21" width="5" height="6"/><rect x="22" y="21" width="5" height="6"/><rect x="30" y="21" width="5" height="6"/><rect x="38" y="21" width="5" height="6"/>')),
  def('lsa-leiste', 'LSA disconnection strip', 'it', svg('<rect x="2" y="18" width="44" height="12"/><line x1="7" y1="14" x2="7" y2="34"/><line x1="13" y1="14" x2="13" y2="34"/><line x1="19" y1="14" x2="19" y2="34"/><line x1="25" y1="14" x2="25" y2="34"/><line x1="31" y1="14" x2="31" y2="34"/><line x1="37" y1="14" x2="37" y2="34"/><line x1="43" y1="14" x2="43" y2="34"/>')),
  def('ip-kamera', 'IP camera', 'it', svg('<rect x="6" y="16" width="26" height="16"/><path d="M32 20l10-5v18l-10-5"/><line x1="14" y1="32" x2="14" y2="42"/><line x1="8" y1="42" x2="20" y2="42"/>')),
  def('pc', 'Workstation', 'it', svg('<rect x="6" y="8" width="36" height="24"/><line x1="24" y1="32" x2="24" y2="38"/><line x1="14" y1="40" x2="34" y2="40"/>')),
  def('telefon', 'Telephone', 'it', svg('<path d="M12 14c0-4 24-4 24 0v4h-6v-3H18v3h-6Z"/><rect x="10" y="22" width="28" height="18"/><circle cx="24" cy="31" r="4"/>')),

  // ── Automation ──
  def('sps', 'PLC', 'automation', kasten('PLC')),
  def('sensor', 'Sensor', 'automation', svg('<rect x="8" y="8" width="32" height="32"/><line x1="8" y1="40" x2="40" y2="8"/>')),
  def('aktor', 'Actuator', 'automation', svg('<rect x="8" y="8" width="32" height="32"/><path d="M14 24h18l-5-5M32 24l-5 5"/>')),
  def('ventil', 'Valve', 'automation', svg('<path d="M6 12v24l18-12Z"/><path d="M42 12v24L24 24Z"/>')),
  def('stellantrieb', 'Valve actuator', 'automation', svg('<path d="M6 20v20l18-10Z"/><path d="M42 20v20L24 30Z"/><line x1="24" y1="30" x2="24" y2="16"/><rect x="16" y="6" width="16" height="10"/>')),
  def('relais', 'Relay', 'automation', svg('<rect x="12" y="10" width="24" height="28"/><line x1="12" y1="38" x2="36" y2="10"/><line x1="24" y1="2" x2="24" y2="10"/><line x1="24" y1="38" x2="24" y2="46"/>')),

  // ── AV ──
  def('kamera', 'Camera', 'av', svg('<rect x="4" y="14" width="30" height="20"/><path d="M34 20l10-5v18l-10-5"/><circle cx="14" cy="24" r="4"/>')),
  def('monitor', 'Monitor', 'av', svg('<rect x="4" y="8" width="40" height="26"/><line x1="24" y1="34" x2="24" y2="40"/><line x1="14" y1="40" x2="34" y2="40"/>')),
  def('beamer', 'Projector', 'av', svg('<rect x="4" y="16" width="30" height="16"/><circle cx="26" cy="24" r="5"/><path d="M34 20 44 14M34 28 44 34"/>')),
  def('leinwand', 'Projection screen', 'av', svg('<line x1="4" y1="10" x2="44" y2="10"/><rect x="8" y="10" width="32" height="24"/><line x1="24" y1="34" x2="24" y2="42"/>')),
  def('stagebox', 'Stage box', 'av', svg('<rect x="4" y="12" width="40" height="24"/><circle cx="12" cy="20" r="3"/><circle cx="20" cy="20" r="3"/><circle cx="28" cy="20" r="3"/><circle cx="36" cy="20" r="3"/><circle cx="12" cy="29" r="3"/><circle cx="20" cy="29" r="3"/><circle cx="28" cy="29" r="3"/><circle cx="36" cy="29" r="3"/>')),
  def('rack', 'Rack', 'av', svg('<rect x="10" y="4" width="28" height="40"/><line x1="10" y1="12" x2="38" y2="12"/><line x1="10" y1="20" x2="38" y2="20"/><line x1="10" y1="28" x2="38" y2="28"/><line x1="10" y1="36" x2="38" y2="36"/>')),
  def('bodentank', 'Floor box', 'av', svg('<rect x="8" y="8" width="32" height="32"/><rect x="14" y="14" width="20" height="20"/><line x1="8" y1="8" x2="14" y2="14"/><line x1="40" y1="8" x2="34" y2="14"/><line x1="8" y1="40" x2="14" y2="34"/><line x1="40" y1="40" x2="34" y2="34"/>')),
  def('kabelbruecke', 'Cable ramp', 'av', svg('<path d="M4 34 14 18h20l10 16Z"/><line x1="18" y1="26" x2="30" y2="26"/>')),
]

export const SYMBOL_KATEGORIEN: SymbolKategorie[] = ['elektro', 'ema', 'bma', 'saa', 'it', 'automation', 'av', 'eigen']
