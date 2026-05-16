export const W_TO_BTUH = 3.412;

export function deriveThermalBtuh(powerDrawW?: number): number | undefined {
  if (powerDrawW == null || powerDrawW <= 0) return undefined;
  return Math.round(powerDrawW * W_TO_BTUH);
}

export function effectiveThermalBtuh(d: {
  thermalBtuh?: number;
  powerDrawW?: number;
}): { value: number; isDerived: boolean } | undefined {
  if (d.thermalBtuh != null && d.thermalBtuh > 0) {
    return { value: d.thermalBtuh, isDerived: false };
  }
  const derived = deriveThermalBtuh(d.powerDrawW);
  if (derived == null) return undefined;
  return { value: derived, isDerived: true };
}
