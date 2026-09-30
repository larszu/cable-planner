// Time code of a source: bridge frame side data (GOP / SEI), the container's start time code
// plus the play position, DaVinci Resolve's timeline, or a browser video file's currentTime.

import type { Source } from '../sources';
import { formatTc, fromFrames, parseTc, rateForFps, toFrames, type Rate, type TimeAddress } from './timecode';

export interface SourceTimecode {
  ta: TimeAddress; rate: Rate;
  /** where it comes from, for the UI */
  origin: string;
  /** older than 2 s (stream stalled, Resolve paused) */
  stale: boolean;
  text: string;
}

const KIND: Record<string, string> = {
  gop: 'GOP-Timecode (MPEG-2, Bildkopf)', s12m: 'SEI-Timecode (SMPTE 12-1)', resolve: 'Resolve-Timeline',
};

/** Advance a time address by a (possibly fractional) time in seconds at the stream rate. */
function advance(ta: TimeAddress, r: Rate, seconds: number): TimeAddress {
  const frames = Math.round((seconds * r.num) / r.den);
  return fromFrames(toFrames(ta, r) + frames, r, ta.df);
}

export function sourceTimecode(src: Source | null, now = performance.now()): SourceTimecode | null {
  if (!src) return null;
  const tc = src.tc;
  const make = (ta: TimeAddress, rate: Rate, origin: string, at: number): SourceTimecode =>
    ({ ta, rate, origin, stale: now - at > 2000, text: formatTc(ta) });
  if (tc?.kind === 'resolve' && tc.tc) {
    const ta = parseTc(tc.tc);
    if (!ta) return null;
    const rate = rateForFps(tc.fps ?? src.info?.fps ?? 25);
    return make({ ...ta, df: ta.df || !!tc.df }, rate, KIND.resolve, tc.at);
  }
  const fps = src.info?.sourceFps || src.info?.fps || 0;
  if (tc && fps) {
    const rate = rateForFps(fps);
    const pts = tc.pts ?? NaN;
    if (tc.tc) {
      const ta = parseTc(tc.tc);
      if (ta && Number.isFinite(pts) && Number.isFinite(tc.tcPts ?? NaN)) return make(advance(ta, rate, pts - (tc.tcPts as number)), rate, KIND[tc.kind ?? 's12m'] ?? 'Timecode', tc.at);
    }
    const start = parseTc(src.info?.timecode ?? '');
    if (start && Number.isFinite(pts)) {
      const t0 = Number.isFinite(src.info?.startTime ?? NaN) ? (src.info!.startTime as number) : (tc.first ?? 0);
      return make(advance(start, rate, pts - t0), rate, 'Start-Timecode der Datei + Position', tc.at);
    }
  }
  if (src.isVideoFile) {
    const v = src.video;
    const rate = rateForFps(1 / src.frameDuration);
    const frames = Math.floor((v?.currentTime ?? 0) * (rate.num / rate.den) + 1e-6);
    return make(fromFrames(frames, rate, false), rate, 'Abspielzeit der Datei (currentTime, ohne Start-Timecode)', now);
  }
  return null;
}
