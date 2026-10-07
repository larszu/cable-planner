// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Calibration of the A/V-sync outputs (test pattern “A/V-Sync” and generator “A/V-Sync-Piep”).
//
// The beep is placed exactly with AudioContext.getOutputTimestamp(), which includes the
// browser's estimate of the output latency (Web Audio API 1.1: outputLatency is “the
// estimation … of audio output latency”). For the picture there is no such value: a
// canvas has no presentation timestamp (requestVideoFrameCallback exists only for video
// elements), and the display adds its own processing. So the flash is drawn `videoLeadMs`
// earlier than the whole second; the value comes from a calibration measurement (see
// docs/research/audio.md, section h) and is 0 = uncalibrated by default.
//
// Stored in localStorage, shared by the main window and the output windows (same origin).

const KEY = 'lz-scopes.avcal';

export interface AvCalibration {
  /** flash drawn this many ms before the whole second (negative = later) */
  videoLeadMs: number;
  /** when and how it was set (shown in the UI); '' = never calibrated */
  note: string;
}

let cal: AvCalibration = { videoLeadMs: 0, note: '' };
const listeners = new Set<() => void>();

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && Number.isFinite(v.videoLeadMs)) cal = { videoLeadMs: Math.max(-500, Math.min(500, v.videoLeadMs)), note: String(v.note ?? '') };
  } catch { /* no storage */ }
}
if (typeof localStorage !== 'undefined') {
  load();
  if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) { load(); listeners.forEach((f) => f()); } });
}

export const avCalibration = () => cal;

export function setAvCalibration(videoLeadMs: number, note: string) {
  cal = { videoLeadMs: Math.round(Math.max(-500, Math.min(500, videoLeadMs)) * 10) / 10, note };
  try { localStorage.setItem(KEY, JSON.stringify(cal)); } catch { /* no storage */ }
  listeners.forEach((f) => f());
}

export function onAvCalibration(f: () => void) { listeners.add(f); return () => listeners.delete(f); }

/** New lead after a loop measurement: offset > 0 = picture late → draw the flash earlier. */
export const calibratedLead = (currentLeadMs: number, measuredOffsetMs: number) => currentLeadMs + measuredOffsetMs;
