// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: native.
import type { Messages } from '../types';

export default {
  'native.note': 'iPhone/iPad receive rtsp:// cameras themselves (Settings → RTSP direct). SRT, rtsps://, files and devices of a computer go through the bridge on a computer on the same network: desktop app with LZS_HOST=0.0.0.0 or npm start -- --host 0.0.0.0. It announces itself via Bonjour.',
  'native.rtsp.section': 'RTSP direct',
  'native.rtsp.route': 'rtsp:// cameras',
  'native.rtsp.direct': 'directly on this device',
  'native.rtsp.viaBridge': 'through the bridge',
  'native.rtsp.hint': 'Direct: the app receives RTSP/RTP itself (TCP or UDP as set on the source, Basic/Digest), WebKit decodes with WebCodecs, VideoToolbox takes over where WebKit cannot (e.g. HEVC 10 bit, then 8 bit at the analysis width). The picture is the camera’s own compression; 16-bit analysis and audio need the bridge. Tested with a local test server and the iOS simulator, not yet on a real iPhone/iPad or with real cameras.',
  'native.rtsp.stored': 'Credentials in the Keychain',
  'native.rtsp.storedHint': 'User and password typed into an rtsp:// address are moved to the iOS Keychain (this device only) and removed from the address.',
  'native.rtsp.none': 'No stored credentials.',
  'native.rtsp.forget': 'Forget',
  'native.rtsp.saveFailed': 'Credentials could not be stored in the Keychain',
  'native.search': 'Find bridge on the network',
  'native.bridgePh': 'e.g. 192.168.1.20:4192',
  'native.searching': 'Searching …',
  'native.noScreen': 'Screen capture (getDisplayMedia) does not exist in WKWebView on iPhone/iPad.',
  'native.noFolder': 'Watching a folder (File System Access) does not exist in WKWebView; single files via “File”.',
  'native.camsPhone': 'iPhone: cameras',
  'native.camsPad': 'iPad: cameras and USB capture',
  'native.noPermission': 'camera permission still missing',
  'native.selectable': 'selectable as a source',
  'native.notOffered': 'not offered by WebKit',
  'native.noCamera': 'No camera found.',
  'native.camHint': 'Camera as a source: at the top “+ Source → Camera/Capture”. USB capture cards (UVC) appear from iPadOS 17, not on the iPhone. Documented only by the WebKit documentation, unverified with a real card.',
  'native.noBridge': 'No bridge found. Is it running with --host 0.0.0.0 on the same Wi-Fi? Otherwise enter the address above.',
  'native.ble.noChar': 'Characteristic {uuid} missing',
  'native.ble.noService': 'Service {uuid} missing',
  'native.ble.noDevice': 'No matching Bluetooth device found',
} as const satisfies Messages;
