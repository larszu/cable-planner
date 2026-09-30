// larszu/lz-scopes#15 — englische Namen der Testbilder aus lz-scopes.
//
// Upstream (`vendor/lz-scopes/patterns.ts`) benennt deutsch und bleibt Byte
// fuer Byte gleich. Englisch ist hier Quellsprache (E-28): die Oberflaeche
// zeigt diese Namen und in der deutschen Sprache den Namen von upstream — die
// deutsche Uebersetzung steht also schon im Vendor und nicht ein zweites Mal
// in `i18n/de.ts`. Ein Muster, das upstream neu dazukommt und hier fehlt,
// erscheint mit seinem Upstream-Namen; `tests/testPatternNames.test.ts` sagt
// es vorher.

export const PATTERN_NAMES_EN: Record<string, string> = {
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
  white: 'White 100 %',
  gray50: 'Grey 50 %',
  gray18: 'Grey 18 % reflectance (BT.709, 40.9 %)',
  black: 'Black',
  ramp: 'Grey ramp 0–100 %',
  rgbramp: 'Ramps W R G B',
  steps11: 'Grey steps 11 (0–100 %)',
  te165: 'Grey scale 11 steps, TE-165 layout',
  sweep: 'Moving grey ramp',
  pluge: 'PLUGE BT.814-4 (SDR)',
  checker: 'Checkerboard',
  convergence: 'Convergence grid',
  crosshair: 'Crosshair',
  circles: 'Circle grid',
  zoneplate: 'Zone plate',
  'zoneplate-anim': 'Zone plate, moving',
  safe: 'Safe areas (EBU R 95)',
  smpte75: 'SMPTE 75 % bars + PLUGE',
  smpte100: 'SMPTE 100 % bars + PLUGE',
  ebu75: 'EBU bars 100/0/75/0',
  ebu100: 'EBU bars 100/0/100/0',
  gradbars: 'Saturation ramps',
  hue: 'Hue wheel ramp',
  macbeth: 'ColorChecker (approximation)',
  cycle: 'Colour cycle',
  cyclegrad: 'Colour cycle ramp',
  tribar: 'Colour cycle, three bands',
  diagonal: 'Moving diagonals',
  rainbow: 'Rainbow flow',
  chromacrawl: 'Chroma crawl',
  testcard: 'Test card with circle and clock',
  avsync: 'A/V sync (flash on beep)',
  'pq-steps': 'PQ grey scale 0–10,000 cd/m²',
  'hlg-steps': 'HLG grey scale (1000 cd/m² display)',
  'pluge-hlg': 'PLUGE BT.814-4 HDR (HLG)',
  'pluge-pq': 'PLUGE BT.814-4 HDR (PQ)',
  'gray18-hlg': 'Grey card 18 % HDR (38 %, HLG)',
  'gray18-pq': 'Grey card 18 % HDR (38 %, PQ)',
  'pq-ramp': 'PQ ramp with reference white 203',
  'lz-01': '01 Black level & PLUGE',
  'lz-02': '02 White clipping',
  'lz-03': '03 Gamma',
  'lz-04': '04 ANSI contrast',
  'lz-05': '05 Uniformity',
  'lz-06': '06 Black frame',
  'lz-07': '07 Geometry',
  'lz-08': '08 Overscan',
  'lz-09': '09 Sharpness & 1:1',
  'lz-10': '10 Convergence',
  'lz-11': '11 Colour bars',
  'lz-12': '12 Ramps',
  'lz-13': '13 Measurement patches',
  'lz-14': '14 Text & sharpening',
  'lz-15': '15 Full field white',
  'lz-16': '16 Full field grey 50',
  'lz-17': '17 Full field grey 25',
  'lz-18': '18 Full field red',
  'lz-19': '19 Full field green',
  'lz-20': '20 Full field blue',
}

export const PATTERN_GROUPS_EN: Record<string, string> = {
  Vollfeld: 'Full field',
  Grau: 'Grey',
  Geometrie: 'Geometry',
  Farbe: 'Colour',
  Animiert: 'Animated',
  Testbild: 'Test card',
  HDR: 'HDR',
  'LZ Displaytest': 'LZ display test',
}

export const patternName = (def: { id: string; name: string }, lang: string): string =>
  lang === 'de' ? def.name : (PATTERN_NAMES_EN[def.id] ?? def.name)

export const patternGroup = (group: string, lang: string): string =>
  lang === 'de' ? group : (PATTERN_GROUPS_EN[group] ?? group)
