// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: lut.
import type { Messages } from '../types';

export default {
  'lut.err.invalidValue': '{name}: invalid value',
  'lut.err.noSize': '{name}: LUT_1D_SIZE or LUT_3D_SIZE missing',
  'lut.err.rows': '{name}: {n} rows instead of {need}',
  'lut.err.noMesh': '{name}: mesh line missing',
  'lut.err.unevenMesh': '{name}: uneven mesh',
  'lut.err.noHeader': '{name}: header {header} missing',
  'lut.err.cubicOnly': '{name}: only cubic {fmt} LUTs are supported',
  'lut.err.indexOutside': '{name}: index out of range',
  'lut.err.incomplete': '{name}: incomplete',
  'lut.err.values': '{name}: {n} values instead of {need}',
  'lut.err.csp3dOnly': '{name}: only 3D CSP is supported',
  'lut.err.preLut': '{name}: pre-LUT {n} invalid',
  'lut.err.format': '{name}: format not supported ({list})',
  'lut.src.sonyLooks': 's709, creative looks (S-Log3/S-Gamut3.Cine)',
  'lut.src.sonyNote': 'LC-709/Cine+709 not there; the Sony professional pages could not be retrieved',
  'lut.src.panaNote': 'Redistribution without permission prohibited (terms of use)',
  'lut.src.varicam': 'VariCam LUT library',
  'lut.src.canonNote': 'Redistribution expressly prohibited; the “BT.709 Wide DR” page could not be retrieved',
  'lut.src.arriLooks': 'LogC4/LogC3 → Rec.709 (LUT Generator)',
  'lut.src.arriNote': 'Redistribution only with consent (arri.com/en/legal)',
  'lut.src.redNote': 'Terms behind a consent checkbox, text not viewable',
  'lut.src.bmdNote': 'only with DaVinci Resolve (folder LUT/Blackmagic Design), no separate download page',
} as const satisfies Messages;
