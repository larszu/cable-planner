// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/sim.ts.
import type en from '../en/sim';
import type { Translation } from '../types';

export default {
  'sim.noChain': 'Vergleicht zwei Stufen der Quelle: CST oder LUT einschalten (Seitenleiste → CST / LUT) und im ⚙ zwei verschiedene Stufen wählen.',
  'sim.stats': 'ΔE ITP Mittel {mean} · 95 % {p95} · max {max}',
  'sim.share': '{jnd} % über 1 (gerade sichtbar) · {over} % über {limit}',
  'sim.scene': 'Log-Stufe als Szenenlicht (1,0 → 203 cd/m²): nur als Rangfolge',
  'sim.a': 'Referenz',
  'sim.aTitle': 'Das echte Bild, z. B. das HDR-Signal vor der CST',
  'sim.b': 'Verglichen mit',
  'sim.bTitle': 'Das gewandelte Bild, z. B. nach CST/LUT auf SDR',
  'sim.scale': 'Farbskala bis',
  'sim.limit': 'Zählen über',
  'sim.limitTitle': 'Anteil des Bildes über diesem ΔE ITP (BT.2124 Anhang 4 nennt < 3 für einen Referenzmonitor annehmbar)',
  'sim.hint': 'ΔE ITP nach ITU-R BT.2124 auf Displaylicht; SDR zurück in den HDR-Container mit 100 % = 203 cd/m² (BT.2408). 1 = gerade sichtbar im kritischsten Adaptationszustand, kann also überschätzen. Grau = unter 1.',
} as const satisfies Translation<typeof en>;
