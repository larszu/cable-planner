// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Processor-specific correction hints for the LED-wall light-meter check (#10).
// Menu paths and terms from the manufacturers' manuals, opened 06.10.2026
// (docs/research/led-wall-und-messgeraete.md, C.5):
//  - NovaStar NovaLCT User Manual V5.3.1 (Synchronous Control System), 6.1.3 and 6.2.1
//  - NovaStar VX1000 User Manual V1.3.0, 5.2.6 LED Screen Color
//  - Brompton Tessera online help: 12.1.2 Colour Temperature, 12.1.9 OSCA, 12.1.10 DynaCal Interface
// Units of the processors' R/G/B sliders are not documented there: the hints give ratios in %
// of the current setting (100 % = unchanged).

import type { XY } from '../color';
import { whiteCorrection, xyOf, type MeterResults, type WhiteCorrection, type XYZ } from './oppleCheck';
import type { ProcessorKind } from './wall';
import { num, t } from '../i18n';

/**
 * Next colour-temperature setting for a slider processor (Brompton): shift the setting by the
 * measured error in mired (10⁶/K), new = 1/(1/now + 1/target − 1/measured). An approximation
 * that assumes the slider moves the white along the same curve as the measured shift – measure
 * again afterwards. Duv (green/magenta) cannot be corrected with a temperature slider.
 */
export function kelvinSuggestion(currentK: number, measuredK: number, targetK: number) {
  const m = 1e6 / currentK + 1e6 / targetK - 1e6 / measuredK;
  return m > 0 ? 1e6 / m : NaN;
}

export interface CabinetMatch {
  point: string;
  /** R, G, B in % of the current setting; null when not computable */
  gains: [number, number, number] | null;
  warnings: string[];
}

/**
 * Gains that bring every measured cabinet to the reference cabinet's white (chromaticity and
 * luminance), like NovaLCT's "adjust other batches to the fixed batch". Per cabinet the
 * chromaticity gains come from `whiteCorrection` (target = reference xy), then scaled to the
 * reference luminance; finally all gains are scaled down together so no channel needs more
 * than 100 % – the darkest cabinet sets the wall brightness. Primaries: the cabinet's own
 * measured R/G/B, else the entered chromaticities.
 */
export function cabinetMatch(res: MeterResults, ref: string, primXy?: [XY, XY, XY]): { rows: CabinetMatch[]; scale: number } {
  const r = res.get(ref)?.W;
  if (!r) return { rows: [], scale: NaN };
  const refXy = xyOf(r);
  const raw: CabinetMatch[] = [];
  for (const [point, m] of res) {
    if (!m.W) continue;
    const prim = m.R && m.G && m.B ? { measured: [m.R, m.G, m.B] as [XYZ, XYZ, XYZ] } : primXy ? { xy: primXy } : {};
    const c = whiteCorrection(m.W, refXy, prim);
    if (!c.gains || c.luminanceAfter == null) { raw.push({ point, gains: null, warnings: c.warnings.length ? c.warnings : [t('led.hint.noPrimaries')] }); continue; }
    const yAfter = m.W[1] * (c.luminanceAfter / 100);
    const f = r[1] / yAfter;
    raw.push({ point, gains: c.gains.map((g) => g * f) as [number, number, number], warnings: c.warnings.filter((w) => w !== t('led.chk.oppleApprox')) });
  }
  const top = Math.max(...raw.flatMap((x) => x.gains ?? []));
  const scale = top > 100 ? 100 / top : 1;
  return { rows: raw.map((x) => ({ ...x, gains: x.gains ? x.gains.map((g) => g * scale) as [number, number, number] : null })), scale };
}

const pct = (v: number) => `${num(v, 1)} %`;
const k0 = (v: number) => `${Math.round(v)} K`;

export interface Hint { title: string; lines: string[] }

/** Global white-point hint for the chosen processor. */
export function whitePointHints(kind: ProcessorKind, c: WhiteCorrection, currentK = 6504): Hint[] {
  const out: Hint[] = [];
  const g = c.gains;
  const gainsText = g ? t('led.hint.gains', { r: pct(g[0]), g: pct(g[1]), b: pct(g[2]) }) : '';
  if (kind === 'novastar-lct') {
    out.push({
      title: t('led.hint.lctTitle'),
      lines: g ? [
        t('led.hint.lct1'),
        t('led.hint.lct2', { gains: gainsText }),
      ] : [t('led.hint.lctNoGains')],
    });
  } else if (kind === 'novastar-vx') {
    out.push({
      title: t('led.hint.vxTitle'),
      lines: g ? [
        'Screen Configuration › More Settings › LED Screen Color › Temperature › Custom.',
        t('led.hint.vx2', { gains: gainsText }),
      ] : [t('led.hint.vxNoGains')],
    });
  } else if (kind === 'brompton') {
    const next = kelvinSuggestion(currentK, c.ist.cct, c.soll.cct);
    out.push({
      title: 'Tessera: Colour Temperature',
      lines: [
        t('led.hint.br1', { now: k0(currentK), measured: k0(c.ist.cct), target: k0(c.soll.cct), next: Number.isFinite(next) ? k0(Math.min(11000, Math.max(2000, next))) : '–' }),
        t('led.hint.br2', { duv: (c.ist.duv - c.soll.duv >= 0 ? '+' : '') + num(c.ist.duv - c.soll.duv, 4) }),
        t('led.hint.br3'),
        ...(g ? [t('led.hint.br4', { gains: gainsText })] : []),
      ],
    });
  } else {
    out.push({ title: t('led.hint.generalTitle'), lines: g ? [t('led.hint.general', { gains: gainsText })] : [t('led.hint.generalNoGains')] });
  }
  return out;
}

/** Where per-cabinet gains (cabinetMatch) go in the processor. */
export function cabinetMatchHint(kind: ProcessorKind): string {
  if (kind === 'novastar-lct') return t('led.hint.matchLct');
  if (kind === 'novastar-vx') return t('led.hint.matchVx');
  if (kind === 'brompton') return t('led.hint.matchBr');
  return t('led.hint.matchOther');
}
