// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/lut.ts.
import type en from '../en/lut';
import type { Translation } from '../types';

export default {
  'lut.err.invalidValue': '{name}: ungültiger Wert',
  'lut.err.noSize': '{name}: LUT_1D_SIZE oder LUT_3D_SIZE fehlt',
  'lut.err.rows': '{name}: {n} Zeilen statt {need}',
  'lut.err.noMesh': '{name}: Mesh-Zeile fehlt',
  'lut.err.unevenMesh': '{name}: ungleichmäßiges Mesh',
  'lut.err.noHeader': '{name}: Kopf {header} fehlt',
  'lut.err.cubicOnly': '{name}: nur würfelförmige {fmt} werden unterstützt',
  'lut.err.indexOutside': '{name}: Index außerhalb',
  'lut.err.incomplete': '{name}: unvollständig',
  'lut.err.values': '{name}: {n} Werte statt {need}',
  'lut.err.csp3dOnly': '{name}: nur 3D-CSP wird unterstützt',
  'lut.err.preLut': '{name}: Pre-LUT {n} ungültig',
  'lut.err.format': '{name}: Format nicht unterstützt ({list})',
  'lut.src.sonyLooks': 's709, kreative Looks (S-Log3/S-Gamut3.Cine)',
  'lut.src.sonyNote': 'LC-709/Cine+709 dort nicht; Sony-Profiseiten waren nicht abrufbar',
  'lut.src.panaNote': 'Weitergabe ohne Genehmigung untersagt (Nutzungsbedingungen)',
  'lut.src.varicam': 'VariCam-LUT-Bibliothek',
  'lut.src.canonNote': 'Weitergabe ausdrücklich untersagt; „BT.709 Wide DR“-Seite nicht abrufbar',
  'lut.src.arriLooks': 'LogC4/LogC3 → Rec.709 (LUT-Generator)',
  'lut.src.arriNote': 'Weitergabe nur mit Zustimmung (arri.com/en/legal)',
  'lut.src.redNote': 'Bedingungen hinter einer Zustimmungs-Checkbox, Text nicht einsehbar',
  'lut.src.bmdNote': 'nur mit DaVinci Resolve (Ordner LUT/Blackmagic Design), keine eigene Download-Seite',
} satisfies Translation<typeof en>;
