// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/enc.ts.
import type en from '../en/enc';
import type { Translation } from '../types';

export default {
  'enc.pickProg': 'Dieses Panel zeigt den Rücklauf (dekodierter Stream). Im ⚙ die Programm-Quelle wählen.',
  'enc.prog': 'Programm',
  'enc.ret': 'Rücklauf',
  'enc.delay': 'Verzögerung',
  'enc.delayValue': '{s} s (Zuordnung {conf} %)',
  'enc.delayNone': 'noch nicht – braucht bewegten Inhalt in beiden',
  'enc.block': 'Blockbildung B/A',
  'enc.scaled': 'Analysebild skaliert, nicht messbar',
  'enc.band': 'Banding (nach CAMBI)',
  'enc.av': 'A/V-Versatz',
  'enc.avValue': 'Programm {p} ms · Rücklauf {r} ms → Strecke {d} ms ({rating})',
  'enc.avNone': 'braucht Blitz und Piep in beiden (Muster A/V-Sync + Generator)',
  'enc.legend': 'Programm → Rücklauf, Mediane der letzten 10 s. Zeichen bei Blockbildung und Banding sind eigene Schwellen\n(Rücklauf über Programm um 0,1/0,3 bzw. 1/3), A/V nach ITU-R BT.1359-1.',
  'enc.progPick': 'Programm',
  'enc.progNone': '– wählen –',
  'enc.progTitle': 'Die Quelle, die in den Encoder geht; die eigene Quelle des Panels ist der Rücklauf',
  'enc.hint': 'Blockbildung nach Wang, Sheikh & Bovik (ICIP 2002), Banding nach Netflix CAMBI (vereinfacht, nicht vergleichbar mit libvmaf), A/V aus dem Blitz/Piep-Messer jeder Quelle. Nur mit synthetischen Bildern geprüft.',
} as const satisfies Translation<typeof en>;
