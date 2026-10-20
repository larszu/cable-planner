// #1068 — ohne Electron, damit Vitest es pruefen kann.
//
// Der Port liegt ausserhalb der Dev-Reihe 4181–4185 und der Nachbar-Apps
// (4190 presenter, 4192 camera-sync, 4193 switcher-motion, 4195 vision-mixer).
export const MCP_STANDARD_PORT = 4187

export interface McpEinstellungen {
  an: boolean
  schreibenErlaubt: boolean
  port: number
}

export const gueltigerPort = (wert: unknown): wert is number =>
  typeof wert === 'number' && Number.isInteger(wert) && wert >= 1024 && wert <= 65535

export const normalisiereMcpEinstellungen = (roh: unknown): McpEinstellungen => {
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>
  return {
    an: o.an === true,
    schreibenErlaubt: o.schreibenErlaubt === true,
    port: gueltigerPort(o.port) ? o.port : MCP_STANDARD_PORT,
  }
}
