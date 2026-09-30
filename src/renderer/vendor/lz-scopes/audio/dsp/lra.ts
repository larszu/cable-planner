// Loudness Range after EBU Tech 3342 (2023), following the MATLAB reference on p7:
// short-term values (3 s window, ≥ 10 Hz) → absolute gate −70 LUFS → relative gate
// −20 LU below the energy mean of the remaining values → 95th − 10th percentile,
// percentile index round((n−1)·p/100 + 1) of the sorted values (1-based).

export const LRA_ABS_GATE = -70;
export const LRA_REL_GATE = -20;

export function loudnessRange(shortTerm: ArrayLike<number>, count = shortTerm.length): number | null {
  const abs: number[] = [];
  for (let i = 0; i < count; i++) { const v = shortTerm[i]; if (v >= LRA_ABS_GATE) abs.push(v); }
  if (!abs.length) return null;
  let power = 0;
  for (const v of abs) power += 10 ** (v / 10);
  const integrated = 10 * Math.log10(power / abs.length);
  const rel = abs.filter((v) => v >= integrated + LRA_REL_GATE).sort((a, b) => a - b);
  const n = rel.length;
  if (!n) return null;
  const at = (p: number) => rel[Math.round(((n - 1) * p) / 100 + 1) - 1];
  return at(95) - at(10);
}
