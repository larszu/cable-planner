// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/perf.ts.
import type en from '../en/perf';
import type { Translation } from '../types';

export default {
  'perf.menu': 'Leistungstest …',
  'perf.title': 'Leistungstest',
  'perf.intro': 'Misst diesen Rechner etwa zehn Sekunden lang, während Layout und Quellen weiterlaufen: Darstellung, Grafikkarte, Prozessor, empfangene Bilder und was ffmpeg je Bild braucht. Während des Tests bitte nichts bedienen. Das Ergebnis sagt, was die Scopes bremst; der Bericht kann mit dem Feedback mitgehen.',
  'perf.start': 'Test starten',
  'perf.running': 'Messe … (etwa 10 s, der Bridge-Teil etwas länger)',
  'perf.copy': 'Bericht kopieren',
  'perf.send': 'Als Feedback senden …',
  'perf.details': 'Ganzer Bericht',
  'perf.r.display': 'Darstellung',
  'perf.r.screen': 'Bildschirm',
  'perf.r.source': 'Quelle',
  'perf.v.display': 'Darstellung: {fps} fps (flüssig ab etwa 45).',
  'perf.v.gpu': 'Grafikkarte: {ms} ms je 1080p-Spur; mit {n} Panels etwa {total} ms je Bild (Budget bei 50 fps: 20 ms). Zu viel: weniger Panels, Analyseauflösung 960 oder 640 px, oder die dedizierte GPU.',
  'perf.v.software': 'Die App zeichnet ohne Grafikkarte (Software-Rendering). Grafiktreiber aktualisieren oder chrome://gpu prüfen.',
  'perf.v.mainThread': 'Hauptthread {ms} ms je Sekunde blockiert (lange Aufgaben): Statistik oder Bild-Overlays kosten zu viel – im Low-Latency-Modus das Statistik-Intervall erhöhen.',
  'perf.v.cpu': 'Prozessor: {ms} ms für einen Durchlauf über ein 16-bit-1080p-Bild – der CPU-Statistikweg ist hier langsam.',
  'perf.v.dropped': 'Quelle {name}: {n} Bilder je Sekunde unterwegs verworfen – feste Verzögerung oder kleinere Analyseauflösung hilft.',
  'perf.v.bridge': 'ffmpeg braucht {ms} ms je 1080i-Bild bei 960 px / 16 bit (Budget bei 50 fps: 20 ms; Erzeugung des Testsignals eingerechnet).',
  'perf.v.native': 'Nativ 1920 px kostet ffmpeg {ms} ms je Bild: volle Auflösung (Flat-Waveform ohne Glättung) ist auf diesem Rechner möglich.',
  'perf.v.noBridge': 'Bridge nicht erreichbar: der ffmpeg-Teil fiel aus.',
} satisfies Translation<typeof en>;
