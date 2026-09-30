// Browser side of the bridge's /clock WebSocket (server/ptp.mjs): PTP status and the ST 2110
// RTP check. Connects only while a clock panel asks for it.

export interface PtpGm {
  identity: string; clockClass: number; clockAccuracy: number; variance: number; priority1: number; priority2: number;
  stepsRemoved: number; timeSource: string; currentUtcOffset: number; utcOffsetValid: boolean; ptpTimescale: boolean;
  timeTraceable: boolean; leader: string; address?: string; logAnnounceInterval: number;
}
export interface PtpSm {
  frameRateNum: number; frameRateDen: number; gmLockingStatus: number; lockingText: string; dropFrame: boolean; colorFrame: boolean;
  currentLocalOffset: number; jumpSeconds: number; timeOfNextJump: number; timeOfNextJam: number; timeOfPreviousJam: number;
  previousJamLocalOffset: number; daylightSaving: { current: boolean; next: boolean; previousJam: boolean }; leapSecondJump: boolean;
}
export interface RtpStatus { group: string; port: number; error: string; packets: number; payloadType: number | null; frames: number; lagMs: number | null; lagFrames: number | null; gridTicks: number | null; ref: 'ptp' | 'system' }
export interface PtpStatus {
  running: boolean; error: string; state: 'none' | 'error' | 'receiving' | 'announce' | 'sync-only' | 'stale';
  domain?: number; domains: number[]; gm?: PtpGm | null; leaders?: number; twoStep?: boolean;
  rates?: { announce: number; sync: number; followUp: number; management: number; delayResp: number };
  offsetNs?: number | null; jitterNs?: number | null; meanPathDelayNs?: number | null; pathDelayIncluded?: boolean;
  history?: (number | null)[]; sm?: PtpSm | null; delayReq: boolean; iface: string;
  ifaces: { name: string; address: string }[]; serverUtcMs: number; rtp: RtpStatus | null;
}

export interface PtpWant { iface: string; delayReq: boolean; rtp: { group: string; port: number; rateNum: number; rateDen: number } | null }

class PtpClient {
  status: PtpStatus | null = null;
  /** connection state for the UI */
  conn: 'off' | 'connecting' | 'open' | 'closed' = 'off';
  receivedAt = 0;
  private ws: WebSocket | null = null;
  private wantedAt = 0;
  private sent = '';
  private url = '';
  private retry: ReturnType<typeof setTimeout> | null = null;
  private idle: ReturnType<typeof setInterval> | null = null;
  private want: PtpWant | null = null;

  /** Called on every redraw of a panel that shows PTP. */
  ensure(bridge: string, want: PtpWant) {
    this.wantedAt = performance.now();
    this.want = want;
    const url = `${bridge}/clock`;
    if (url !== this.url) { this.close(); this.url = url; }
    if (!this.ws && !this.retry) this.open();
    this.push();
    if (!this.idle) this.idle = setInterval(() => { if (performance.now() - this.wantedAt > 3000) this.close(); }, 1000);
  }

  private open() {
    this.conn = 'connecting';
    let ws: WebSocket;
    try { ws = new WebSocket(this.url); } catch { this.conn = 'closed'; return; }
    this.ws = ws; this.sent = '';
    ws.onopen = () => { this.conn = 'open'; this.push(); };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data));
        if (m.type === 'ptp') { this.status = m; this.receivedAt = performance.now(); }
      } catch { /* ignore */ }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null; this.conn = 'closed'; this.status = null;
      if (performance.now() - this.wantedAt < 3000) this.retry = setTimeout(() => { this.retry = null; if (performance.now() - this.wantedAt < 3000) this.open(); }, 2000);
    };
  }

  private push() {
    const ws = this.ws, w = this.want;
    if (!ws || ws.readyState !== WebSocket.OPEN || !w) return;
    const cfg = JSON.stringify(w);
    if (cfg === this.sent) return;
    const prev = this.sent ? JSON.parse(this.sent) as PtpWant : null;
    this.sent = cfg;
    if (!prev || prev.iface !== w.iface || prev.delayReq !== w.delayReq) ws.send(JSON.stringify({ type: 'config', iface: w.iface, delayReq: w.delayReq }));
    if (!prev || JSON.stringify(prev.rtp) !== JSON.stringify(w.rtp)) ws.send(JSON.stringify(w.rtp ? { type: 'rtp', ...w.rtp } : { type: 'rtp', off: true }));
  }

  close() {
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    if (this.idle) { clearInterval(this.idle); this.idle = null; }
    const ws = this.ws;
    this.ws = null; this.status = null; this.conn = 'off'; this.sent = '';
    ws?.close();
  }

  /** Fresh status (≤ 2 s old) or null. */
  get fresh(): PtpStatus | null { return this.status && performance.now() - this.receivedAt < 2000 ? this.status : null; }
}

export const ptpClient = new PtpClient();
