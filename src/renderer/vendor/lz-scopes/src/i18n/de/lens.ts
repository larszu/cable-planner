// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/lens.ts.
import type en from '../en/lens';
import type { Translation } from '../types';

export default {
  'lens.mapCaption': 'Helligkeit gegen die Mitte, ±10 %',
  'lens.sawH': 'Säge H',
  'lens.sawV': 'Säge V',
  'lens.parH': 'Par. H',
  'lens.parV': 'Par. V',
  'lens.rest': 'Rest',
  'lens.centre': 'Mitte R/G {rg} · B/G {bg}',
  'lens.ref.chosen': 'Verglichen mit {lens} @ {zoom} ({date})',
  'lens.ref.zoom': 'Verglichen mit {lens} @ {zoom}, nächster gespeicherter Zoom ({date})',
  'lens.ref.similar': 'Ähnlichster gespeicherter: {lens} @ {zoom} ({date})',
  'lens.dCentre': 'Δ Mitte R/G {rg} % · B/G {bg} %',
  'lens.worst': 'Größte Abweichung: {ch} {term} {pp} Pp.',
  'lens.noRef': 'Noch kein Fingerabdruck gespeichert – ⚙ → Objektiv, Zoom, „Fingerabdruck speichern“.',
  'lens.lens': 'Objektiv',
  'lens.lensPh': 'z. B. Fujinon XA20 (mit Extender: ×2)',
  'lens.zoom': 'Zoom',
  'lens.zoomTitle': 'Zoomstellung, z. B. die Brennweite in mm',
  'lens.signal': 'Signal',
  'lens.linear': 'linearisieren (inverse BT.709)',
  'lens.linearTitle': 'An: Gamma der Kamera ist an, Werte werden zurück in Licht gerechnet. Aus: Codewerte, wie mit abgeschaltetem Knee und Gamma beim Shading (Tektronix).',
  'lens.store': 'Fingerabdruck speichern',
  'lens.storeTitle': 'Speichert das Live-Shading unter Objektiv und Zoom (ersetzt dasselbe Objektiv mit demselben Zoom)',
  'lens.compare': 'Vergleichen mit',
  'lens.auto': 'automatisch (gleiches Objektiv, nächster Zoom; sonst der ähnlichste)',
  'lens.delete': 'Löschen',
  'lens.export': 'JSON exportieren',
  'lens.import': 'JSON importieren',
  'lens.hint': 'Gleichmäßige Weißfläche, bildfüllend oder im Messrahmen; Gain 0 dB. Säge = linearer Verlauf zum rechten/unteren Rand, Parabel = Ränder gegen die Mitte, in % der Mitte, je Kanal. Nur mit synthetischen Flächen geprüft.',
} as const satisfies Translation<typeof en>;
