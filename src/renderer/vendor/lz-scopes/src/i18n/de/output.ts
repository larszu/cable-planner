// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/output.ts.
import type en from '../en/output';
import type { Translation } from '../types';

export default {
  'output.title': 'LZ Scopes – Ausgabe',
  'output.canvas8': 'Canvas 2D 8 bit (float16 nicht verfügbar)',
  'output.av': 'Bildwechsel {refresh} · Blitz-Raster ±{jitter} ms · Bild-Vorlauf {lead} ms',
  'output.uncalibrated': '(unkalibriert)',
  'output.keys': '← → wechseln · F Vollbild · L Label · R Pegel/Codes',
  'output.labelPrompt': 'Label / Kennung',
  'output.needsMain': 'Dieses Ausgabefenster braucht das geöffnete LZ-Scopes-Hauptfenster.',
  'output.noScene': 'Keine Szene',
  'output.sceneName': 'Name der Szene',
  'output.addScope': '+ Scope …',
  'output.addScopeTitle': 'Scope hinzufügen',
  'output.sceneEdit': '✎ Szene',
  'output.windowSource': 'Quelle des Fensters',
  'output.scopeSource': 'Quelle dieses Scopes',
  'output.opacity': 'Deckkraft',
  'output.dim': 'Abdunklung',
  'output.removeScope': 'Scope entfernen (Entf)',
  'output.done': 'Fertig (E)',
  'output.endEdit': 'Bearbeiten beenden',
  'output.bridgeUnreachable': 'Bridge nicht erreichbar',
  'output.noSignal': 'Kein Signal',
  'output.webgl8': 'WebGL RGBA8 (RGBA16F nicht verfügbar)',
  'output.keyEdit': 'E Bearbeiten',
  'output.keysView': 'F Vollbild · Doppelklick Vollbild',
  'output.streamEnded': 'beendet',
  'output.labels8': 'Beschriftung 8 bit',
} satisfies Translation<typeof en>;
