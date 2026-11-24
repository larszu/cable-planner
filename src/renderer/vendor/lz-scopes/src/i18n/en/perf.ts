// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: perf (performance test, #245).
import type { Messages } from '../types';

export default {
  'perf.menu': 'Performance test …',
  'perf.title': 'Performance test',
  'perf.intro': 'Measures this computer for about ten seconds while your current layout and sources keep running: display, graphics card, processor, received pictures and what ffmpeg needs per picture. Leave the app alone while it runs. The result says what limits the scopes, and the report can go with your feedback.',
  'perf.start': 'Start test',
  'perf.running': 'Measuring … (about 10 s, the bridge part a little longer)',
  'perf.copy': 'Copy report',
  'perf.send': 'Send as feedback …',
  'perf.details': 'Full report',
  'perf.r.display': 'Display',
  'perf.r.screen': 'Screen',
  'perf.r.source': 'Source',
  'perf.v.display': 'Display: {fps} fps (smooth from about 45).',
  'perf.v.gpu': 'Graphics card: {ms} ms per 1080p trace; with {n} panels about {total} ms per frame (budget at 50 fps: 20 ms). Too much: fewer panels, analysis resolution 960 or 640 px, or the dedicated GPU.',
  'perf.v.software': 'The app draws without the graphics card (software rendering). Update the graphics driver or check chrome://gpu.',
  'perf.v.mainThread': 'Main thread busy {ms} ms per second (long tasks): statistics or picture overlays cost too much – raise the statistics interval in low-latency mode.',
  'perf.v.cpu': 'Processor: {ms} ms for one pass over a 16-bit 1080p frame – the CPU statistics path is slow here.',
  'perf.v.dropped': 'Source {name}: {n} pictures per second dropped on the way – fixed delay or a lower analysis resolution helps.',
  'perf.v.bridge': 'ffmpeg needs {ms} ms per 1080i picture at 960 px / 16 bit (budget at 50 fps: 20 ms; test signal generation included).',
  'perf.v.native': 'Native 1920 px costs ffmpeg {ms} ms per picture: full resolution (Flat waveform without smoothing) is possible on this computer.',
  'perf.v.noBridge': 'Bridge not reachable: the ffmpeg part was skipped.',
} as const satisfies Messages;
