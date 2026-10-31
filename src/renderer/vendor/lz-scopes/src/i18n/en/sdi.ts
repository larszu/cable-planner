// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: SDI signal info panel (src/sdiPanel.ts, #160).
import type { Messages } from '../types';

export default {
  'sdi.yes': 'yes',
  'sdi.no': 'no',
  'sdi.waiting': 'No ancillary data from the DeckLink input yet',
  'sdi.noVanc': 'No SDI ancillary data – only DeckLink inputs carry VANC',
  'sdi.no352': 'No ST 352 payload ID in the signal',
  'sdi.unknownPayload': 'Payload code {code}h (not in the table)',
  'sdi.format': '{rate} {scan} · {sampling} · {bits} bit',
  'sdi.colour': 'Transfer {transfer} · {colorimetry} · {aspect}',
  'sdi.warnTransfer': 'Signal flags {sig}, scopes read {scope} – switch in ⚙',
  'sdi.warnColorimetry': 'Signal flags {sig}, scopes decode matrix {scope} – switch in ⚙',
  'sdi.mdcv': 'Mastering display {max}/{min} cd/m² · R x {rx} · G y {gy}',
  'sdi.cll': 'MaxCLL {cll} · MaxFALL {fall} cd/m²',
  'sdi.dynamic': 'Dynamic metadata type {types}',
  'sdi.afd': 'AFD {code} · coded frame {frame}',
  'sdi.presence': 'CEA-708 {c708} · CEA-608 {c608} · audio groups {audio} · control {ctrl}',
  'sdi.packets': '{n} packet types (line, DID/SDID, count, data)',
  'sdi.follow': 'Use what the signal says',
  'sdi.followTitle': 'Set transfer and matrix of this source to the ST 352 values',
  'sdi.agree': 'Transfer and matrix agree with ST 352.',
  'sdi.hint': 'Decoded from the SDI ancillary data of a DeckLink input (ST 352, ST 2108-1, ST 12-2, ST 2016-3). Not yet tested with a card (#116).',
} satisfies Messages;
