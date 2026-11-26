// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofile Sony (#1240, Stufe 7). pro.sony sperrt automatische Abrufe
// (403); Quelle sind die Kataloge und Spezifikationsblaetter auf sony.jp
// (japanisch, Zitate unten wortgleich). Gelesen am 26.11.2026.
//
// Zuordnung: „フレームメモリー n ch“ (Frame-Memory-Kanaele) = Mediaplayer;
// „DME n チャンネル“ = DVEs; „マルチビューアー n“ = Multiviewer. Bei der
// XVS-Reihe gilt der Katalog 2022.2; der Katalog 2019.11 nennt andere Werte
// (z. B. DME HD 8 statt 4) und ist ueberholt.
//
// Bewusst LEER, weil die Kataloge es nicht nennen: Downstream-Keyer, Aux,
// Farbgeneratoren, Makros und Snapshots (alle Modelle; sie stuenden in den
// User's Guides, die nur im Browser abrufbar sind), Clip-Plaetze, beim
// MCX-500 ausserdem Standbilder und DME, bei den MVS Frame-Memory.
// Die Split-Betriebsart der XVS (bis 10 M/E in HD) fehlt: sie halbiert die
// Keyer je M/E und ist kein eigenes Format.
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const X22 = 'https://www.sony.jp/products/catalog/PRODUCTION_SWITCHER_SYSTEM_2202.pdf'
const P19 =
  'https://www.sony.jp/professional/support/catalog_pdf/c_c-video_production/ProductionSwitcherSystem_1911.pdf'

/**
 * MCX-500: „4チャンネル1M/Eコンパクトスイッチャ―“, „1M/E＋2キーヤー（PinP×1、
 * Title×1）“, ein HDMI-Ausgang „（マルチビューアー）“. Die acht Anschluesse
 * („8映像入力（同時使用 4チャンネル）“) teilen sich vier Kanaele.
 */
export const PROFILE_SONY_MCX500: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: 'https://www.sony.jp/products/catalog/MCX-500_1701.pdf',
  blocks: { inputs: 4, mixEffects: 1, upstreamKeyers: 2, multiviewers: 1 },
}

/**
 * XVS-G1 (Katalog 2025.3): „入力 24（最大 44）“, „M/E 2（最大 4） 1（最大 2）“,
 * „キーヤー 16 4“, „フレームメモリー 16ch 6ch“, „3D DME 4ch 2ch“ (GPU-Option),
 * „マルチビューアー 2 1“ — je HD / 4K.
 */
export const PROFILE_SONY_XVS_G1: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: 'https://www.sony.jp/products/catalog/XVS-G1_2503.pdf',
  blocks: { inputs: 44, mixEffects: 4, upstreamKeyers: 16, mediaPlayers: 16, dves: 4, multiviewers: 2 },
  modes: [
    { id: 'hd', label: 'HD', limits: { inputs: 44, mixEffects: 4, upstreamKeyers: 16, mediaPlayers: 16, dves: 4, multiviewers: 2 } },
    { id: '4k', label: '4K', limits: { inputs: 24, mixEffects: 2, upstreamKeyers: 4, mediaPlayers: 6, dves: 2, multiviewers: 1 } },
  ],
}

/**
 * XVS-Reihe (Katalog 2022.2): Eingaenge „最大80 最大160“ (9000), „最大28
 * 最大112“ (7000), „最大16 最大64“ (6000) je 4K / HD; HD 8 Keyer je M/E;
 * Frame-Memory „20のフレームメモリーチャンネル“ (HD) bzw. „4チャンネルまで“ (4K).
 */
const xvs = (
  me: number,
  hdInputs: number,
  uhdInputs: number,
  uhdKeyers: number,
  uhdDves: number,
  multiviewers: number,
): SwitchingProfile => ({
  role: 'mixer',
  manufacturerUrl: X22,
  blocks: { inputs: hdInputs, mixEffects: me, upstreamKeyersPerMe: 8, mediaPlayers: 20, dves: 4, multiviewers },
  modes: [
    { id: 'hd', label: 'HD', limits: { inputs: hdInputs, mixEffects: me, upstreamKeyersPerMe: 8, mediaPlayers: 20, dves: 4 } },
    { id: '4k', label: '4K', limits: { inputs: uhdInputs, mixEffects: me, upstreamKeyers: uhdKeyers, mediaPlayers: 4, dves: uhdDves } },
  ],
})

/** XVS-9000: „XVS-9000（4K）：5M/E、80入力、40出力、20キーヤー“, DME „最大4チャンネル“, „4チャンネルのマルチビューアー“. */
export const PROFILE_SONY_XVS_9000 = xvs(5, 160, 80, 20, 4, 4)
/** XVS-7000: „3M/E、28入力、12出力、12キーヤー“ (4K), DME 4K „最大2チャンネル“, Multiviewer „（2チャンネル）“. */
export const PROFILE_SONY_XVS_7000 = xvs(3, 112, 28, 12, 2, 2)
/** XVS-6000: „2M/E、16入力、6出力、8キーヤー“ (4K), DME 4K 1 Kanal, Multiviewer „（2チャンネル）“. */
export const PROFILE_SONY_XVS_6000 = xvs(2, 64, 16, 8, 1, 2)

/**
 * MVS-6530: M/E „3“ (Katalog 2019.11), „プライマリー入力用 BNC×48“, Keyer
 * „合計16“, DME „2チャンネル“ (Option MKS-6570), Multiviewer „2系統“.
 */
export const PROFILE_SONY_MVS_6530: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: 'https://www.sony.jp/products/catalog/SPC_MVS-6530.pdf',
  sources: {
    mixEffects: P19,
    multiviewers: P19,
    upstreamKeyers: 'https://www.sony.jp/switcher/products/MVS-6530/feature_1.html',
    dves: 'https://www.sony.jp/switcher/products/MVS-6530/feature_1.html',
  },
  blocks: { inputs: 48, mixEffects: 3, upstreamKeyers: 16, dves: 2, multiviewers: 2 },
}

/** MVS-3000A: M/E „2“, „BNC×32“, Keyer „合計8“, DME 2 Kanaele (Option), Multiviewer „2系統“. */
export const PROFILE_SONY_MVS_3000A: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: 'https://www.sony.jp/products/catalog/SPC_MVS-3000A.pdf',
  sources: {
    mixEffects: P19,
    multiviewers: P19,
    upstreamKeyers: 'https://www.sony.jp/switcher/products/MVS-3000A/feature_1.html',
    dves: 'https://www.sony.jp/switcher/products/MVS-3000A/feature_1.html',
  },
  blocks: { inputs: 32, mixEffects: 2, upstreamKeyers: 8, dves: 2, multiviewers: 2 },
}
