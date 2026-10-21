// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Bridge messages in the UI language (#94). The bridge sends English text plus a code
// (server/messages.mjs): { message, code?, params? } in protocol messages, and
// { <field>, <field>Code?, <field>Params? } for other text fields (note, error, switched …).
// Known code → t('bridge.<code>', params); otherwise the English text as it came (older
// bridges, lines from ffmpeg itself, a remote bridge of another version).
import { hasKey, t, type Params } from './index';

export interface BridgeMsg { message?: string; code?: string; params?: Record<string, unknown> }

/** Parameters may themselves be messages (the reason inside a message): translate them first. */
function resolveParams(p: Record<string, unknown> | undefined): Params | undefined {
  if (!p) return undefined;
  const out: Params = {};
  for (const [k, v] of Object.entries(p)) {
    out[k] = typeof v === 'number' ? v : v && typeof v === 'object' ? bridgeMessage(v as BridgeMsg) : String(v ?? '');
  }
  return out;
}

/** Text of a bridge message in the UI language; `fallback` when it carries no text at all. */
export function bridgeMessage(m: BridgeMsg | string | null | undefined, fallback = ''): string {
  if (m == null) return fallback;
  if (typeof m === 'string') return m || fallback;
  const key = m.code ? `bridge.${m.code}` : '';
  if (key && hasKey(key)) return t(key, resolveParams(m.params));
  return m.message || fallback;
}

/** ST 2059-2 gmLockingStatus 0–4 in the UI language; `fallback` (the bridge's text) for other values. */
export function ptpLockText(status: number, fallback: string): string {
  const key = `bridge.ptp.lock${status}`;
  return hasKey(key) ? t(key) : fallback;
}

/** A text field other than `message`: bridgeText(info, 'note') reads note/noteCode/noteParams. */
export function bridgeText(o: object | null | undefined, field: string, fallback = ''): string {
  if (!o) return fallback;
  const r = o as Record<string, unknown>;
  const message = r[field];
  if (message == null || message === '') return fallback;
  return bridgeMessage({ message: String(message), code: r[`${field}Code`] as string | undefined, params: r[`${field}Params`] as Record<string, unknown> | undefined }, fallback);
}
