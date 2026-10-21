// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: encoder confidence panel (src/encoderPanel.ts).
import type { Messages } from '../types';

export default {
  'enc.pickProg': 'This panel shows the return (decoded stream). Pick the programme source in ⚙.',
  'enc.prog': 'Programme',
  'enc.ret': 'Return',
  'enc.delay': 'Delay',
  'enc.delayValue': '{s} s (match {conf} %)',
  'enc.delayNone': 'not yet – needs moving content in both',
  'enc.block': 'Blocking B/A',
  'enc.scaled': 'analysis picture scaled, not measurable',
  'enc.band': 'Banding (CAMBI-like)',
  'enc.av': 'A/V offset',
  'enc.avValue': 'programme {p} ms · return {r} ms → stream {d} ms ({rating})',
  'enc.avNone': 'needs flash and beep in both (A/V sync pattern + generator)',
  'enc.legend': 'Programme → return, medians of the last 10 s. Signs for blocking and banding are own thresholds\n(return above programme by 0.1/0.3 resp. 1/3), A/V after ITU-R BT.1359-1.',
  'enc.progPick': 'Programme',
  'enc.progNone': '– choose –',
  'enc.progTitle': 'The source that goes into the encoder; the panel’s own source is the return',
  'enc.hint': 'Blocking after Wang, Sheikh & Bovik (ICIP 2002), banding after Netflix CAMBI (simplified, not comparable with libvmaf), A/V from the flash/beep meter of each source. Tested with synthetic pictures only.',
} as const satisfies Messages;
