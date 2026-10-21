// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/native.ts.
import type en from '../en/native';
import type { Translation } from '../types';

export default {
  'native.note': 'iPhone/iPad empfangen rtsp://-Kameras selbst (Einstellungen → RTSP direkt). SRT, rtsps://, Dateien und Geräte eines Rechners laufen über die Bridge auf einem Rechner im selben Netz: Desktop-App mit LZS_HOST=0.0.0.0 oder npm start -- --host 0.0.0.0. Sie meldet sich per Bonjour.',
  'native.rtsp.section': 'RTSP direkt',
  'native.rtsp.route': 'rtsp://-Kameras',
  'native.rtsp.direct': 'direkt auf diesem Gerät',
  'native.rtsp.viaBridge': 'über die Bridge',
  'native.rtsp.hint': 'Direkt: Die App empfängt RTSP/RTP selbst (TCP oder UDP wie an der Quelle eingestellt, Basic/Digest), WebKit dekodiert mit WebCodecs, VideoToolbox springt ein, wo WebKit nicht kann (z. B. HEVC 10 bit, dann 8 bit in Analysebreite). Das Bild ist die Kompression der Kamera; 16-bit-Analyse und Ton brauchen die Bridge. Geprüft mit lokalem Testserver und iOS-Simulator, noch nicht auf echtem iPhone/iPad und nicht mit echten Kameras.',
  'native.rtsp.stored': 'Zugangsdaten im Schlüsselbund',
  'native.rtsp.storedHint': 'Benutzer und Passwort in einer rtsp://-Adresse wandern in den iOS-Schlüsselbund (nur dieses Gerät) und werden aus der Adresse entfernt.',
  'native.rtsp.none': 'Keine gespeicherten Zugangsdaten.',
  'native.rtsp.forget': 'Vergessen',
  'native.rtsp.saveFailed': 'Zugangsdaten konnten nicht im Schlüsselbund gespeichert werden',
  'native.search': 'Bridge im Netz suchen',
  'native.bridgePh': 'z. B. 192.168.1.20:4192',
  'native.searching': 'Suche …',
  'native.noScreen': 'Bildschirmaufnahme (getDisplayMedia) gibt es in WKWebView auf iPhone/iPad nicht.',
  'native.noFolder': 'Ordner beobachten (File System Access) gibt es in WKWebView nicht; einzelne Dateien über „Datei“.',
  'native.camsPhone': 'iPhone: Kameras',
  'native.camsPad': 'iPad: Kameras und USB-Capture',
  'native.noPermission': 'Kamera-Freigabe fehlt noch',
  'native.selectable': 'als Quelle wählbar',
  'native.notOffered': 'von WebKit nicht angeboten',
  'native.noCamera': 'Keine Kamera gefunden.',
  'native.camHint': 'Kamera als Quelle: oben „+ Quelle → Kamera/Capture“. USB-Capture-Karten (UVC) erscheinen ab iPadOS 17, nicht am iPhone. Belegt nur über die WebKit-Dokumentation, mit echter Karte ungeprüft.',
  'native.noBridge': 'Keine Bridge gefunden. Läuft sie mit --host 0.0.0.0 im selben WLAN? Adresse sonst oben eintragen.',
  'native.ble.noChar': 'Characteristic {uuid} fehlt',
  'native.ble.noService': 'Dienst {uuid} fehlt',
  'native.ble.noDevice': 'Kein passendes Bluetooth-Gerät gefunden',
} satisfies Translation<typeof en>;
