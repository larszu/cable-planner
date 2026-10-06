#!/usr/bin/env node
/**
 * Handbuch-Aufnahmen, Kapitel "werkzeuge-planen": die Menügruppen Berechnen,
 * Prüfen und Planen im Menü Werkzeuge (Aufnahmespeicher, Projektion & Display,
 * Analysen mit allen vierzehn Reitern samt Bandbreiten- und Stromrechner,
 * Plan-Check, Plan gegen Vorgefundenes, Bestandsaufnahme, Drum-Mikrofonierung,
 * Funkstrecken/Gesang, Ablauf und Kamera-Aufträge, Ausspielung).
 *
 * Lauf:
 *   node scripts/handbuch/bereiche/werkzeuge-planen.mjs de
 *   node scripts/handbuch/bereiche/werkzeuge-planen.mjs en
 *
 * Die Beispieldaten (Projekt, Ablauf, Messdateien) entstehen in einem
 * Wegwerfordner. Es wird nichts exportiert (kein Download), kein Schlüssel im
 * Schlüsselbund gespeichert und kein Netz benutzt.
 */
import { starte } from '../app.mjs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ARG = process.argv[2] ?? 'beide'
const TMP = mkdtempSync(join(tmpdir(), 'wp-'))

// ───────────────────────── Beispielprojekt „Planungsprobe" ─────────────────────────
// Ein Projekt, in dem absichtlich vieles unfertig oder widersprüchlich ist, damit
// die Prüfungen etwas zu melden haben. Alle Werte sind erfundene Beispieldaten.
const P = (id, name, connectorType, extra = {}) => ({ id, name, type: connectorType, connectorType, ...extra })
const EQ = (id, name, category, x, y, inputs, outputs, extra = {}) => ({
  id, name, category, x, y, width: 220, height: 110, inputs, outputs, ...extra,
})
const CB = (id, name, fe, fp, te, tp, length, extra = {}) => ({
  id, name, type: 'BNC', length, color: '#3b82f6', fromEquipmentId: fe, fromPortId: fp,
  toEquipmentId: te, toPortId: tp, notes: '', ...extra,
})
const RJ = 'Ethernet/RJ45'
const equipment = [
  EQ('cam1', 'Kamera 1', 'Cameras', 100, 100,
    [P('c1i1', 'Strom A', 'IEC 230V'), P('c1i5', 'Strom B', 'IEC 230V')],
    [P('c1o1', 'SDI Out', 'BNC', { standard: 'SDI-3G' }), P('c1o2', 'HDMI Out', 'HDMI'), P('c1o3', '2110 A', RJ, { standard: 'ST2110-20' }), P('c1o4', 'Funk 1', 'BNC')],
    {
      powerConsumptionWatts: 45, weightKg: 4.2, priceEUR: 4200, tcRole: 'sink', tallyRole: 'sink', sourceIdentityId: 'si1',
      networkInterfaces: [
        { id: 'k1a', label: '2110 rot', role: 'media-primary', ipAddress: '10.1.1.11', subnetMask: '255.255.255.0', vlanId: 30, ptpDomain: 127, ptpProfile: 'st2059-2', ptpRole: 'slave', portId: 'c1o3' },
        { id: 'k1b', label: '2110 blau', role: 'media-secondary', ipAddress: '10.1.2.11', subnetMask: '255.255.255.0', vlanId: 31, ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'slave' },
      ],
    }),
  EQ('cam2', 'Kamera 2', 'Cameras', 100, 320,
    [P('c2i1', 'Strom', 'IEC 230V')],
    [P('c2o1', 'SDI Out', 'BNC', { standard: 'SDI-3G' }), P('c2o2', 'SDI Out B', 'BNC', { standard: 'SDI-3G' }), P('c2o4', 'Funk 2', 'BNC')],
    { powerConsumptionWatts: 45, weightKg: 4.2, priceEUR: 4200, tallyRole: 'sink', sourceIdentityId: 'si2' }),
  EQ('mix', 'Bildmischer', 'Mixer', 500, 200,
    [P('m_i1', 'In 1', 'BNC', { standard: 'SDI-3G' }), P('m_i2', 'In 2', 'BNC', { standard: 'SDI-3G' }),
      P('m_i3', 'In 3', 'BNC', { standard: 'SDI-3G', dualLinkGroup: 'DL-A' }), P('m_i4', 'In 4', 'BNC', { standard: 'SDI-3G', dualLinkGroup: 'DL-A' }),
      P('m_i5', 'HDMI In', 'HDMI'), P('m_i6', 'Funk In 1', 'BNC'), P('m_i7', 'Funk In 2', 'BNC'), P('m_e1', 'LAN', RJ, { standard: 'Eth-1G' }), P('m_i8', 'Strom', 'IEC 230V')],
    [P('m_o1', 'PGM Out', 'BNC', { standard: 'SDI-3G' }), P('m_o2', 'Multiview Out', 'HDMI'), P('m_o3', 'Aux 1', 'BNC', { portGroup: 'ax', portGroupKind: 'stereo' })],
    {
      powerConsumptionWatts: 120, weightKg: 8, ipAddress: '10.0.1.20', subnetMask: '255.255.255.0', gateway: '10.0.2.1',
      managementVlanId: 10, vlans: [{ id: 10, name: 'Steuerung' }], hausPunktId: 'p1',
    }),
  EQ('ptz', 'PTZ-Kamera', 'Cameras', 500, 460,
    [P('z_e1', 'LAN', RJ, { standard: 'Eth-1G' })], [],
    { powerConsumptionWatts: 30, weightKg: 2.1, ipAddress: '10.0.1.20', subnetMask: '255.255.255.0', hausPunktId: 'pX' }),
  EQ('conv', 'Konverter', 'Converters', 300, 320,
    [P('cv_i1', 'SDI In', 'BNC')], [P('cv_o1', 'HDMI Out', 'HDMI')],
    { isConverter: true, powerConsumptionWatts: 10, weightKg: 0.4 }),
  EQ('mon', 'Regiemonitor', 'Monitors', 900, 200,
    [P('mo_i1', 'SDI In', 'BNC'), P('mo_i2', 'HDMI In', 'HDMI')], [],
    { powerConsumptionWatts: 60, weightKg: 6, displaySizeInch: 24, hausPunktId: 'p2' }),
  EQ('sw', 'Switch 1', 'Networking', 900, 460,
    Array.from({ length: 8 }, (_, i) => P(`sw_p${i + 1}`, `Port ${i + 1}`, RJ, { standard: 'Eth-1G' })), [],
    { categoryProps: { poeBudgetW: 20 }, ipAddress: '10.0.1.2', subnetMask: '255.255.255.0', powerConsumptionWatts: 60, weightKg: 3 }),
  EQ('pp', 'Patchfeld', 'Patch panels', 700, 460,
    [P('pp_i1', 'Ein 1', RJ), P('pp_i2', 'Ein 2', RJ)], [P('pp_o1', 'Aus 1', RJ), P('pp_o2', 'Aus 2', RJ)],
    { isPatchPanel: true, weightKg: 1 }),
  EQ('pc', 'Streaming-PC', 'IT/Server', 1200, 460,
    [P('pc_e1', 'LAN', RJ, { standard: 'Eth-1G' }), P('pc_i2', 'Strom', 'IEC 230V')], [P('pc_o1', 'HDMI Out', 'HDMI')],
    {
      powerConsumptionWatts: 250, weightKg: 9, ipAddress: '10.0.1.30', subnetMask: '255.255.255.0', gateway: '10.0.1.1', hausPunktId: 'p1',
      networkInterfaces: [{ id: 'n1', label: 'NET 1', role: 'media-primary', ipAddress: '10.0.1.31', subnetMask: '255.255.255.0', gateway: '10.0.1.1', vlanId: 20, switchEquipmentId: 'sw', switchPort: 'Port 2', portId: 'pc_e1' }],
      streams: [
        { id: 'st1', protocol: 'srt', direction: 'send', label: 'Programm', url: 'srt://10.0.1.30:9000', codec: 'H.264', format: '1080p50' },
        { id: 'st2', protocol: 'rtsp', direction: 'receive', label: 'PTZ', url: 'rtsp://10.0.1.20/1' },
      ],
    }),
  EQ('sb', 'Stagebox', 'Audio', 100, 560,
    [P('sb_i1', 'Strom', 'IEC 230V')],
    [P('sb_o1', 'Mic 1', 'XLR'), P('sb_o2', 'AES Out', 'XLR', { standard: 'AES3' }), P('sb_o3', 'Dante', RJ, { standard: 'Dante' })],
    { powerConsumptionWatts: 40, weightKg: 5 }),
  EQ('am', 'Tonmischer', 'Audio', 500, 620,
    [P('am_i1', 'Line 1', 'Cinch/RCA'), P('am_i2', 'AES In', 'BNC', { standard: 'AES3id' }), P('am_i3', 'Mic 1', 'XLR')], [],
    { powerConsumptionWatts: 90, weightKg: 12 }),
  EQ('lwl', 'LWL-Sender', 'Networking', 100, 800, [],
    [P('l_o1', 'LWL A', 'Fiber', { fiberClass: 'OM3', fiberConnector: 'LC' }),
      P('l_o2', 'opticalCON', 'Fiber', { fasern: [1, 2, 3, 4].map((n) => ({ id: `fa${n}`, position: n, rolle: n % 2 ? 'tx' : 'rx' })) })]),
  EQ('lwr', 'LWL-Empfänger', 'Networking', 500, 800,
    [P('r_i1', 'LWL A', 'Fiber', { fiberClass: 'OS2', fiberConnector: 'SC' }), P('r_i2', 'Faser 1', 'Fiber'), P('r_i3', 'Faser 2', 'Fiber')], []),
  EQ('lp', 'Lichtpult', 'Lighting', 900, 800, [], [P('lp_o1', 'DMX Out', 'DMX 5-pol (XLR)')]),
  EQ('dmx', 'Scheinwerfer', 'Lighting', 1200, 800,
    [P('d_i1', 'DMX In', 'DMX 5-pol (XLR)'), P('d_i2', 'Netz', 'PowerCON')], [],
    { dmxAdresse: 600, dmxUniverse: 1, hausKlinkeId: 'k1' }),
  EQ('sv', 'Stromverteiler', 'Power', 1200, 100, [],
    [1, 2, 3, 4, 6].map((n) => P(`sv_o${n}`, `Out ${n}`, 'IEC 230V')).concat([P('sv_o5', 'Powerlock', 'PowerCON')])),
  EQ('da', 'Verteilverstärker', 'Distribution', 300, 100,
    [P('da_i1', 'SDI In', 'BNC')], [P('da_o1', 'SDI Out 1', 'BNC')], { isDistributionAmp: true, powerConsumptionWatts: 15 }),
  EQ('lap', 'Laptop', 'IT/Server', 1200, 300, [], [P('lp2_o1', 'USB-C', 'USB-C')]),
  EQ('ad', 'Adapter USB-C auf DisplayPort', 'Adapters', 1200, 620,
    [P('ad_i1', 'USB-C', 'USB-C')], [P('ad_o1', 'DisplayPort', 'DisplayPort')],
    { adapter: { von: 'USB-C', nach: 'DisplayPort', richtung: 'einweg', speisung: 'passiv' } }),
  EQ('unb', 'Unbekanntes Gerät', 'Other', 300, 900, [], [], { portsUnknown: true }),
  EQ('rec', 'Vermuteter Recorder', 'Recorder', 700, 900, [P('vr_i1', 'SDI In', 'BNC')], [],
    { specSource: { inputs: { value: '1', source: 'AI-Vorschlag aus dem Gerätenamen' } } }),
]
const power = (id, from, to, tp, extra = {}) => CB(id, `Strom ${id}`, 'sv', from, to, tp, 2, { type: 'IEC 230V', layer: 'power', ...extra })
const cables = [
  CB('c1', 'CAM 1 → Mischer', 'cam1', 'c1o1', 'mix', 'm_i1', 12, { standard: 'SDI-3G', cableNumber: 'K-01', cableSpecId: 'smpte-304m-dragonfly',
    lengthDerivedFrom: { fromX: -500, fromY: -500, toX: -200, toY: -500, metersPer100px: 0.5, slackPercent: 10 } }),
  CB('c2', 'CAM 2 → Konverter', 'cam2', 'c2o1', 'conv', 'cv_i1', 18, { standard: 'SDI-3G', cableNumber: 'K-01' }),
  CB('c3', 'Konverter → Mischer', 'conv', 'cv_o1', 'mix', 'm_i5', 3, { type: 'HDMI', standard: 'HDMI-2.0', cableNumber: 'K-03' }),
  CB('c4', 'PGM → Monitor', 'mix', 'm_o1', 'mon', 'mo_i1', 0, { standard: 'SDI-3G', cableNumber: 'K-04', videoFormat: '1080p50', hausStreckeId: 'gone' }),
  CB('c5', 'Multiview → Monitor', 'mix', 'm_o2', 'mon', 'mo_i2', 30, { type: 'HDMI', standard: 'HDMI-2.0', cableNumber: 'K-05', hausStreckeId: 'st1', hausAder: '2' }),
  CB('c6', 'CAM 1 HDMI → Mischer', 'cam1', 'c1o2', 'mix', 'm_i2', 5, { type: 'HDMI', cableNumber: 'K-06' }),
  CB('c7', 'CAM 2 B → Mischer In 3', 'cam2', 'c2o2', 'mix', 'm_i3', 18, { standard: 'SDI-3G', cableNumber: 'K-07' }),
  CB('c8', 'PTZ → Patchfeld', 'ptz', 'z_e1', 'pp', 'pp_i1', 8, { type: 'Ethernet', standard: 'Eth-1G', cableNumber: 'N-01' }),
  CB('c9', 'Patchfeld → Switch', 'pp', 'pp_o1', 'sw', 'sw_p1', 2, { type: 'Ethernet', standard: 'Eth-1G', cableNumber: 'N-02' }),
  CB('c10', 'PC → Switch', 'pc', 'pc_e1', 'sw', 'sw_p2', 3, { type: 'Ethernet', standard: 'Eth-1G', cableNumber: 'N-03' }),
  CB('c11', 'Mischer → Switch', 'mix', 'm_e1', 'sw', 'sw_p3', 3, { type: 'Ethernet', standard: 'Eth-1G', cableNumber: 'N-04' }),
  CB('c12', 'Kamera 1 2110 → Switch', 'cam1', 'c1o3', 'sw', 'sw_p4', 15, { type: 'Ethernet', standard: 'ST2110-20', cableNumber: 'N-05' }),
  CB('c13', 'Stagebox Dante → Switch', 'sb', 'sb_o3', 'sw', 'sw_p5', 20, { type: 'Ethernet', standard: 'Dante', cableNumber: 'N-06' }),
  CB('c14', 'Stagebox Mic → Tonmischer', 'sb', 'sb_o1', 'am', 'am_i1', 10, { type: 'XLR', cableNumber: 'A-01' }),
  CB('c15', 'Stagebox AES → Tonmischer', 'sb', 'sb_o2', 'am', 'am_i2', 10, { type: 'XLR', cableNumber: 'A-02' }),
  CB('c16', 'LWL A', 'lwl', 'l_o1', 'lwr', 'r_i1', 100, { type: 'Fiber', cableNumber: 'F-01' }),
  CB('c17', 'opticalCON 1', 'lwl', 'l_o2', 'lwr', 'r_i2', 100, { type: 'Fiber', cableNumber: 'F-02', faserVon: 1, faserNach: 1 }),
  CB('c18', 'opticalCON 2', 'lwl', 'l_o2', 'lwr', 'r_i3', 100, { type: 'Fiber', cableNumber: 'F-03', faserVon: 1, faserNach: 1 }),
  CB('c19', 'DMX', 'lp', 'lp_o1', 'dmx', 'd_i1', 20, { type: 'DMX', standard: 'DMX512', cableNumber: 'L-01' }),
  CB('c20', 'Hybridkabel Kamera 1', 'cam1', 'c1o3', 'sw', 'sw_p7', 2500, { type: 'Fiber', cableSpecId: 'smpte-304m-lemo', cableNumber: 'H-01' }),
  CB('c21', 'Adapter-Zuleitung', 'lap', 'lp2_o1', 'ad', 'ad_i1', 1, { type: 'USB', standard: 'USB-3.x', cableNumber: 'U-01' }),
  power('p1', 'sv_o1', 'cam1', 'c1i1'), power('p2', 'sv_o6', 'cam1', 'c1i5'), power('p3', 'sv_o2', 'cam2', 'c2i1'),
  power('p4', 'sv_o3', 'mix', 'm_i8'), power('p5', 'sv_o4', 'pc', 'pc_i2'),
  CB('p6', 'Strom Scheinwerfer', 'sv', 'sv_o5', 'dmx', 'd_i2', 5, { type: 'PowerCON', layer: 'power', anschlussId: 'ans1', adern: [{ id: 'a1', rolle: 'L1' }, { id: 'a2', rolle: 'L1' }] }),
  CB('w1', 'Funk Kamera 1 (UHF)', 'cam1', 'c1o4', 'mix', 'm_i6', 0, { wireless: true, frequency: '606.4 MHz' }),
  CB('w2', 'Funk Kamera 2 (UHF)', 'cam2', 'c2o4', 'mix', 'm_i7', 0, { wireless: true, frequency: '606.6 MHz' }),
  CB('w3', 'WLAN Kamera 1', 'cam1', 'c1o4', 'mix', 'm_i6', 0, { wireless: true, frequency: '5180 MHz', wifiChannel: '36' }),
  CB('w4', 'WLAN Kamera 2', 'cam2', 'c2o4', 'mix', 'm_i7', 0, { wireless: true, frequency: '5180 MHz', wifiChannel: '36' }),
]
const projekt = {
  metadata: { name: 'Planungsprobe', description: '', createdAt: '2026-09-29T00:00:00.000Z', updatedAt: '2026-09-29T00:00:00.000Z', defaultVideoFormat: '1080p50' },
  equipment, cables, locations: [], canvasState: { x: 0, y: 0, zoom: 0.5 },
  sourceIdentities: [
    { id: 'si1', name: 'Kamera 1', number: 1, umdAddress: 1 },
    { id: 'si2', name: 'Kamera 2', number: 2, umdAddress: 1 },
  ],
  anschlussListe: [{ id: 'ans1', name: 'Powerlock A', soll: ['L1', 'L2', 'L3', 'N', 'PE'] }],
  hausAuskunft: {
    name: 'Stadthalle (Beispiel)', gelesenAm: '2026-09-01T10:00:00.000Z', quelle: 'stadthalle-beispiel.json',
    raeume: [{ id: 'r1', name: 'Saal', hausbezeichner: 'S1' }],
    punkte: [
      { id: 'p1', bezeichnung: 'Dose A1', art: 'dose', raumId: 'r1', anschlussart: 'schuko', absicherungA: 16, dauerleistungW: 200, gedimmt: true },
      { id: 'p2', bezeichnung: 'Dose A2', art: 'dose', raumId: 'r1', anschlussart: 'schuko', absicherungA: 16, geschaltet: true },
    ],
    klinken: [{ id: 'k1', system: 'dali', adresse: '3', richtung: 'schalten', bedeutung: 'Saallicht' }],
    strecken: [{ id: 'st1', bezeichnung: 'Strecke Saal-Regie', adern: [{ nr: '1' }] }],
  },
  pendingChanges: [{
    id: 'pc1', ts: '2026-09-29T09:00:00.000Z', author: 'Anna (Telefon)', source: 'mobile', kind: 'new-device',
    summary: 'Neues Gerät: Beamer Saal hinten',
    patch: { name: 'Beamer Saal hinten', raum: 'Saal', verbindung: 'HDMI zur Wand?', notiz: 'Deckenhalterung' },
  }],
}
const PROJEKT = join(TMP, 'planungsprobe.json')
writeFileSync(PROJEKT, JSON.stringify(projekt))

// Messdateien (Beispieldaten)
const ARP = join(TMP, 'gefunden.csv')
writeFileSync(ARP, ['name;ip;mac', 'Bildmischer;10.0.1.20;aa:bb:cc:00:00:01', 'Switch 1;10.0.1.99;aa:bb:cc:00:00:02', 'Kamera 3;10.0.1.55;aa:bb:cc:00:00:03', 'Streaming-PC;10.0.1.30;aa:bb:cc:00:00:04'].join('\n'))
const SCAN = join(TMP, 'scan.csv')
writeFileSync(SCAN, ['MHz;dBm', ...Array.from({ length: 21 }, (_, i) => `${(600 + i * 0.5).toFixed(1)};${i >= 8 && i <= 10 ? -48 : -92}`)].join('\n'))
const DANTE1 = join(TMP, 'dante-1.csv')
writeFileSync(DANTE1, ['Rx Device;Rx Channel;Tx Device;Tx Channel', 'Tonmischer;1;Stagebox;1', 'Tonmischer;2;Stagebox;2', 'Monitormischer;1;Stagebox;1', 'Kamera 9;1;;'].join('\n'))
const DANTE2 = join(TMP, 'dante-2.csv')
writeFileSync(DANTE2, ['Rx Device;Rx Channel;Tx Device;Tx Channel', 'Tonmischer;1;Stagebox;3', 'Tonmischer;2;Stagebox;2', 'Monitormischer;1;Stagebox;1', 'Kamera 9;1;;'].join('\n'))

// ───────────────────────── Aufnahme ─────────────────────────
async function lauf(sprache) {
  const a = await starte({ sprache, breite: 1400, hoehe: 1250 })
  const w = a.win
  w.setDefaultTimeout(8000)
  const f = a.folge('werkzeuge-planen')
  const L = (k) => a.text(k)
  const texte = {}
  const listen = {}
  const pause = (ms) => w.waitForTimeout(ms)
  const dlg = () => a.dialog()
  const S = (name, tun, ziel = dlg) => f.schritt(name, tun, { ziel })
  /** Volltext eines Ziels für die Beschreibung festhalten. */
  const T = async (name, loc = dlg()) => { try { texte[name] = await loc.first().innerText() } catch { texte[name] = '' } }
  const opts = async (name, sel) => { try { listen[name] = (await sel.locator('option').allInnerTexts()).map((s) => s.trim()) } catch { listen[name] = [] } }
  const gl = (key, o = { exact: true }) => dlg().getByLabel(L(key), o)
  const scrollTo = async (loc) => { await loc.first().evaluate((el) => el.scrollIntoView({ block: 'start' })); await pause(250) }
  const scrollTop = async () => {
    await dlg().evaluate((d) => { d.querySelectorAll('*').forEach((e) => { if (e.scrollTop > 0) e.scrollTop = 0 }) })
    await pause(250)
  }
  const scrollBy = async (px) => {
    await dlg().evaluate((d, px) => {
      const c = [...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))
      if (c) c.scrollTop += px
    }, px)
    await pause(300)
  }
  const selectByText = async (sel, rx) => {
    const v = await sel.evaluate((s, src) => {
      const r = new RegExp(src, 'i')
      const o = [...s.options].find((x) => r.test(x.text))
      return o ? o.value : null
    }, rx.source)
    if (v === null) throw new Error(`Option nicht gefunden: ${rx}`)
    await sel.selectOption(v)
  }
  const zuUndFrisch = async () => { await a.zu(); await pause(300) }
  const bestaetigen = async () => {
    const ok = w.getByRole('button', { name: /^(OK|Discard|Verwerfen|Open anyway|Trotzdem öffnen|Apply anyway|Trotzdem anwenden)$/i })
    if (await ok.count()) await ok.first().click().catch(() => {})
  }

  const V = async (fn) => { try { await fn() } catch (e) { console.log('!!', String(e.message).split('\n')[0]) } }
  try {
  // ═════════════ 0 — Menü Werkzeuge ═════════════
  await S('menue-werkzeuge', () => a.menue('app.menu.tools'), () => a.menueFeld())

  // ═════════════ 1 — Aufnahmespeicher berechnen ═════════════
  await S('speicher-offen', () => a.menue('app.menu.tools', 'app.menu.tools.recStorage'))
  await T('speicher-offen')
  await opts('speicher-codec', gl('recStorage.codec'))
  await S('speicher-codec-gewaehlt', async () => { await selectByText(gl('recStorage.codec'), /ProRes 422 HQ \(2160p25\)/); await pause(300) })
  await S('speicher-custom', async () => { await selectByText(gl('recStorage.codec'), /^Custom/i); await pause(300); await gl('recStorage.customMbps').fill('400') })
  await S('speicher-dauer-kanaele', async () => {
    await gl('recStorage.hours').fill('4'); await gl('recStorage.minutes').fill('30'); await gl('recStorage.channels').fill('4')
  })
  await T('speicher-dauer-kanaele')
  await opts('speicher-redundanz', gl('recStorage.redundancy'))
  await S('speicher-array', async () => {
    await gl('recStorage.redundancy').selectOption('raid6'); await gl('recStorage.headroom').fill('30'); await gl('recStorage.driveTb').fill('8')
  })
  await T('speicher-array')
  await S('speicher-formel', async () => { await dlg().locator('summary').filter({ hasText: L('recStorage.formulaHeader') }).click() })
  await zuUndFrisch()

  // ═════════════ 2 — Projektion & Display ═════════════
  await S('projektion-offen', () => a.menue('app.menu.tools', 'app.menu.tools.projection'))
  await T('projektion-offen')
  await S('projektion-wurf-werte', async () => {
    await gl('calc.projection.throwRatio').fill('2'); await gl('calc.projection.imageWidth', { exact: false }).fill('5'); await gl('calc.projection.roomDepth', { exact: false }).fill('12')
  })
  await T('projektion-wurf-werte')
  await S('projektion-bildgroesse', async () => { await dlg().getByRole('button', { name: L('calc.projection.tab.screen') }).click() })
  await T('projektion-bildgroesse')
  await opts('projektion-seitenverhaeltnis', gl('calc.projection.aspect'))
  await S('projektion-bildgroesse-werte', async () => { await gl('calc.projection.diagonal', { exact: false }).fill('200'); await selectByText(gl('calc.projection.aspect'), /21:9/) })
  await T('projektion-bildgroesse-werte')
  await S('projektion-led', async () => { await dlg().getByRole('button', { name: L('calc.projection.tab.led') }).click() })
  await T('projektion-led')
  await S('projektion-led-werte', async () => {
    await gl('calc.projection.pitch', { exact: false }).fill('3.9'); await gl('calc.projection.ledWidth', { exact: false }).fill('5'); await gl('calc.projection.ledHeight', { exact: false }).fill('2.5')
  })
  await T('projektion-led-werte')
  await zuUndFrisch()

  // ═════════════ Projekt laden (Beispieldaten) ═════════════
  await V(async () => {
    await a.app.evaluate(({ dialog }, pfad) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pfad] }) }, PROJEKT)
    await a.menue('app.menu.file', 'app.menu.file.open')
    await pause(3500)
    await bestaetigen()
    await pause(2000)
    await a.zu()
  })
  console.log('Geräte auf der Fläche:', await w.locator('.react-flow__node-equipment').count())

  // ═════════════ 3 — Bestandsaufnahme ═════════════
  await S('bestand-offen', () => a.menue('app.menu.tools', 'app.menu.tools.survey'))
  await T('bestand-offen')
  await S('bestand-name', async () => { await dlg().getByPlaceholder(L('survey.namePlaceholder')).fill('Projektor Decke vorne') })
  await S('bestand-felder', async () => {
    await dlg().getByPlaceholder(L('survey.roomPlaceholder')).fill('Saal')
    await dlg().getByPlaceholder(L('survey.connectionPlaceholder')).fill('Pult, HDMI hinten?')
    await dlg().getByPlaceholder(L('survey.notePlaceholder')).fill('Lüfter laut, Halterung locker')
  })
  await S('bestand-erfasst', async () => { await dlg().getByPlaceholder(L('survey.notePlaceholder')).press('Enter') })
  await T('bestand-erfasst')
  await S('bestand-zweites', async () => {
    await dlg().getByPlaceholder(L('survey.namePlaceholder')).fill('Lautsprecher links')
    await dlg().getByPlaceholder(L('survey.namePlaceholder')).press('Enter')
  })
  await S('bestand-fotos', async () => { await dlg().locator('summary').filter({ hasText: L('survey.photos') }).first().click() })
  await S('bestand-telefon-annehmen', async () => { await dlg().getByRole('button', { name: L('survey.accept') }).first().click() })
  await T('bestand-telefon-annehmen')
  await S('bestand-fertig', async () => { await dlg().getByRole('button', { name: L('survey.done'), exact: true }).first().click() })
  await T('bestand-fertig')
  await zuUndFrisch()

  // ═════════════ 4 — Drum-Mikrofonierung ═════════════
  await S('drum-offen', () => a.menue('app.menu.tools', 'app.menu.tools.drumMicing'))
  await T('drum-offen')
  await S('drum-technik', async () => { await dlg().getByRole('button', { name: /Glyn Johns/ }).click() })
  await T('drum-technik')
  await S('drum-zone', async () => { await dlg().locator('svg g').filter({ hasText: /^Kick/ }).first().click() })
  await S('drum-mikro-dazu', async () => { await dlg().getByRole('button', { name: L('drum.addMic') }).click() })
  await S('drum-mikro-modell', async () => {
    const sel = dlg().locator('select').last()
    await opts('drum-mikrofone', sel)
    await selectByText(sel, /SM57/)
  })
  await S('drum-phantom', async () => {
    await dlg().locator('svg g').filter({ hasText: /^OH L/ }).first().click()
    await dlg().getByRole('button', { name: L('drum.addMic') }).click()
    await selectByText(dlg().locator('select').last(), /C ?414|KM ?184|Condenser|MKH|AT4050|CM ?3|DPA/)
  })
  await T('drum-phantom')
  await S('drum-kit-bearbeiten', async () => { await dlg().getByRole('button', { name: L('drum.editKit') }).click() })
  await T('drum-kit-bearbeiten')
  await S('drum-zone-neu', async () => {
    const neu = dlg().locator('select').filter({ has: dlg().locator('option', { hasText: 'Crash' }) }).first()
    await neu.selectOption('crash')
    await dlg().getByPlaceholder(/Crash/).fill('Crash links')
    await dlg().getByRole('button', { name: L('drum.addZone') }).click()
  })
  await S('drum-kit-fertig', async () => { await dlg().getByRole('button', { name: L('drum.editDone') }).click() })
  await S('drum-full-close', async () => { await dlg().getByRole('button', { name: /Full Close/ }).click(); await pause(600); await bestaetigen() })
  await T('drum-full-close')
  await S('drum-zone-entfernen-frage', async () => { await dlg().getByRole('button', { name: /Minimal/ }).click(); await pause(700) }, () => w.locator('[role="dialog"]').last())
  await bestaetigen()
  await S('drum-alle-weg', async () => { await pause(400); await dlg().getByRole('button', { name: L('drum.clear') }).click() })
  await S('drum-end', async () => { await dlg().getByRole('button', { name: /Full Close/ }).click(); await pause(600); await bestaetigen() })
  await zuUndFrisch()

  // ═════════════ 5 — Funkstrecken / Gesang ═════════════
  await S('funk-offen', () => a.menue('app.menu.tools', 'app.menu.tools.wirelessRig'))
  await T('funk-offen')
  await S('funk-kanal', async () => { await dlg().getByRole('button', { name: L('wireless.addChannel'), exact: true }).click() })
  await S('funk-body', async () => {
    const sel = dlg().locator('tbody tr').first().locator('select').first()
    await opts('funk-sender', sel)
    await sel.evaluate((s) => { const o = [...s.options].find((x) => x.value); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) })
  })
  await S('funk-kapsel', async () => {
    const sel = dlg().locator('tbody tr').first().locator('select').nth(1)
    await opts('funk-kapseln', sel)
    await sel.evaluate((s) => { const o = [...s.options].filter((x) => x.value)[0]; s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) })
  })
  await S('funk-frequenz', async () => { const i = dlg().locator('tbody tr').first().locator('input[type=number]'); await i.fill('606.4'); await i.blur() })
  await S('funk-konflikt', async () => {
    await dlg().getByRole('button', { name: L('wireless.addChannel'), exact: true }).click()
    const r = dlg().locator('tbody tr').nth(1)
    await r.locator('select').first().evaluate((s) => { const o = [...s.options].filter((x) => x.value)[1] ?? [...s.options].filter((x) => x.value)[0]; s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })) })
    const i = r.locator('input[type=number]'); await i.fill('606.6'); await i.blur()
  })
  await T('funk-konflikt')
  await S('funk-personen-sitzung', async () => {
    await scrollTo(dlg().getByText(L('micPlot.title')))
    await dlg().getByRole('button', { name: L('micPlot.addSession') }).click()
  })
  await S('funk-person', async () => { await dlg().getByRole('button', { name: L('micPlot.addPerson') }).click() })
  await S('funk-person-daten', async () => {
    await dlg().getByPlaceholder(L('micPlot.rolePh')).first().fill('Moderation')
    await dlg().locator('table').last().locator('tbody tr').first().locator('input').first().fill('Anna')
    await dlg().locator('table').last().locator('tbody tr').first().getByRole('button', { name: L('micPlot.batterySet') }).click()
  })
  await S('funk-person-doppelt', async () => { await dlg().getByRole('button', { name: L('micPlot.addPerson') }).click() })
  await T('funk-person-doppelt')
  await S('funk-person-zweiter-kanal', async () => {
    const r = dlg().locator('table').last().locator('tbody tr').nth(1)
    await r.locator('select').first().evaluate((s) => { s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })) })
  })
  await S('funk-zweite-sitzung', async () => { await dlg().getByRole('button', { name: L('micPlot.addSession') }).click() })
  await S('funk-uebernehmen', async () => { await dlg().getByRole('button', { name: L('micPlot.carry') }).click() })
  await T('funk-uebernehmen')
  await zuUndFrisch()

  // ═════════════ 6 — Ablauf und Kamera-Aufträge ═════════════
  await S('ablauf-offen', () => a.menue('app.menu.tools', 'app.menu.tools.rundown'))
  await T('ablauf-offen')
  await S('ablauf-herkunft', async () => {
    await dlg().getByPlaceholder(L('rundown.source.placeholder')).fill('ablauf.xlsx, Mail vom 9. Sept.')
    await dlg().getByPlaceholder(L('rundown.revision.placeholder')).fill('v4')
  })
  await S('ablauf-text', async () => {
    await dlg().locator('textarea').fill('1\tBegrüßung\n2\tInterview\tGast kommt von links\n3\t\n4\tMusik\n5\tAbmoderation')
  })
  await S('ablauf-eingelesen', async () => { await dlg().getByRole('button', { name: L('rundown.read'), exact: true }).click() })
  await T('ablauf-eingelesen')
  await S('ablauf-auftrag', async () => {
    const inputs = dlg().locator('tbody input')
    await inputs.nth(0).fill('Totale')
    await inputs.nth(1).fill('Nahe Moderation')
  })
  await S('ablauf-auftraege', async () => {
    const inputs = dlg().locator('tbody input')
    await inputs.nth(2).fill('Halbnahe Gast')
    await inputs.nth(3).fill('Totale')
    await inputs.nth(4).fill('Nahe Band')
  })
  await T('ablauf-auftraege')
  await S('ablauf-neu-einlesen', async () => {
    await dlg().locator('textarea').fill('1\tBegrüßung\n2\tTalk mit Gast\n3\tMusik')
    await dlg().getByRole('button', { name: L('rundown.read'), exact: true }).click()
  })
  await T('ablauf-neu-einlesen')
  await zuUndFrisch()

  // ═════════════ 7 — Ausspielung ═════════════
  await S('ausspielung-offen', () => a.menue('app.menu.tools', 'app.menu.tools.delivery'))
  await T('ausspielung-offen')
  await S('ausspielung-ziel', async () => { await dlg().getByRole('button', { name: L('delivery.add') }).click() })
  await opts('ausspielung-plattform', gl('delivery.col.platform'))
  await S('ausspielung-plattform', async () => { await selectByText(gl('delivery.col.platform'), /YouTube/) })
  await S('ausspielung-name', async () => { await gl('delivery.col.name').first().fill('YouTube Hauptkanal') })
  await opts('ausspielung-transport', gl('delivery.col.transport'))
  await S('ausspielung-srt', async () => { await gl('delivery.col.transport').first().selectOption('SRT') })
  await S('ausspielung-srt-rtt', async () => { await gl('delivery.srt.rtt').fill('45') })
  await S('ausspielung-encoder', async () => { await selectByText(gl('delivery.path.encoder'), /Streaming-PC/) })
  await S('ausspielung-kodierung', async () => {
    await gl('delivery.enc.videoBitrate').fill('15000'); await gl('delivery.enc.keyframe').fill('4')
  })
  await S('ausspielung-schluessel', async () => { await gl('delivery.col.key').fill('demo-token') })
  await S('ausspielung-osc', async () => {
    await gl('delivery.osc.address').fill('/stream/haupt/start'); await gl('delivery.osc.page').fill('2'); await gl('delivery.osc.bank').fill('5')
  })
  await S('ausspielung-zweites', async () => {
    await dlg().getByRole('button', { name: L('delivery.add') }).click()
    await pause(400)
    await gl('delivery.col.name').nth(1).fill('Twitch Reserve')
    await selectByText(gl('delivery.col.platform').nth(1), /Twitch/)
  })
  await S('ausspielung-reserve', async () => {
    const s = gl('delivery.col.backupOf').nth(1)
    await selectByText(s, /YouTube Hauptkanal/)
  })
  await T('ausspielung-reserve')
  await S('ausspielung-uplink', async () => { await scrollTop(); await dlg().locator('#uplink').fill('10') })
  await S('ausspielung-archiv', async () => {
    await scrollTop()
    await gl('delivery.archive.answer').selectOption('device')
  })
  await T('ausspielung-archiv')
  await S('ausspielung-veranstaltung', async () => {
    await scrollTo(dlg().getByText(L('delivery.event.title'), { exact: true }))
    await dlg().getByPlaceholder(L('delivery.event.titlePh')).fill('Jahresempfang')
    await gl('delivery.event.privacy').selectOption('public')
    await dlg().getByPlaceholder(/2026-09-12T19:00\+02:00/).first().fill('2026-09-12T19:00+02:00')
  })
  await T('ausspielung-veranstaltung')
  await S('ausspielung-sendebericht', async () => {
    await scrollTo(dlg().getByText(L('delivery.record.title'), { exact: true }))
    await dlg().getByRole('button', { name: L('delivery.record.add'), exact: true }).click()
    await dlg().getByPlaceholder(L('delivery.record.textPh')).fill('Bild eingefroren, nach 20 s wieder da')
  })
  await T('ausspielung-sendebericht')
  await S('ausspielung-ausweich', async () => {
    await scrollTo(dlg().getByText(L('delivery.fb.title'), { exact: true }))
    await dlg().getByRole('button', { name: L('delivery.fb.protect') }).first().click()
  })
  await T('ausspielung-ausweich')
  await S('ausspielung-encoder-pruefung', async () => { await scrollTo(dlg().getByText(L('delivery.encoder.title'), { exact: true })) })
  await T('ausspielung-encoder-pruefung')
  await zuUndFrisch()

  // ═════════════ 8 — Analysen ═════════════
  const TAB = ['Was ansteht', 'Kunden-Übersicht', 'Kosten: Plan gegen Ist', 'Crew: Stunden & Auslagen', 'Namensregel', 'Dante-Patch', 'Gewicht & Wärme', 'Netzwerk', 'Redundanz', 'RF / Funk', 'Kabelwege', 'Signalwege', 'Anschlussliste', 'Blatt prüfen']
  const tab = (i) => dlg().getByRole('button', { name: TAB[i], exact: true })
  const inTab = async (i) => { await tab(i).click(); await pause(700); await scrollTop() }
  await S('analysen-offen', () => a.menue('app.menu.tools', 'app.menu.tools.analysis'))
  await T('analysen-offen')
  await V(async () => { listen['analysen-reiter'] = await dlg().locator('button').allInnerTexts() })

  // 8.1 Was ansteht
  await S('ansteht', () => inTab(0)); await T('ansteht')
  // 8.2 Kunden-Übersicht
  await S('kunde', () => inTab(1)); await T('kunde')
  // 8.3 Kosten
  await S('kosten-leer', () => inTab(2)); await T('kosten-leer')
  await S('kosten-rahmen', async () => {
    await dlg().getByLabel(L('analysis.cost.currency'), { exact: true }).fill('EUR')
    await dlg().getByLabel(L('analysis.cost.tolerance'), { exact: true }).fill('10')
  })
  await S('kosten-zeile', async () => { await dlg().getByRole('button', { name: L('analysis.cost.add') }).click() })
  await S('kosten-zeile-werte', async () => {
    await dlg().getByLabel(L('analysis.cost.label'), { exact: true }).first().fill('Kameras')
    await selectByText(dlg().getByLabel(L('analysis.cost.anchor'), { exact: true }).first(), /Kamera 1/)
    await dlg().getByLabel(L('analysis.cost.estimate'), { exact: true }).first().fill('5000')
    await dlg().getByLabel(L('analysis.cost.actual'), { exact: true }).first().fill('5600')
  })
  await opts('kosten-herkunft', dlg().getByLabel(L('analysis.cost.source'), { exact: true }).first())
  await S('kosten-zweite', async () => {
    await dlg().getByRole('button', { name: L('analysis.cost.add') }).click()
    await dlg().getByLabel(L('analysis.cost.label'), { exact: true }).nth(1).fill('Verkabelung')
    await dlg().getByLabel(L('analysis.cost.estimate'), { exact: true }).nth(1).fill('800')
  })
  await T('kosten-zweite')

  // 8.4 Crew
  await S('crew-leer', () => inTab(3)); await T('crew-leer')
  await S('crew-person', async () => {
    await dlg().getByLabel(L('analysis.crew.name'), { exact: true }).fill('Max Beispiel')
    await dlg().getByLabel(L('analysis.crew.company'), { exact: true }).fill('Freelance')
    await dlg().getByRole('button', { name: L('analysis.crew.addPerson'), exact: true }).click()
  })
  await S('crew-band', async () => {
    await dlg().getByLabel(L('analysis.crew.bandName'), { exact: true }).fill('Nacht')
    await dlg().getByRole('button', { name: L('analysis.crew.addBand'), exact: true }).click()
  })
  await S('crew-satz', async () => {
    await dlg().getByLabel(L('analysis.crew.activity'), { exact: true }).last().fill('Kamera')
    await dlg().getByLabel(L('analysis.crew.hourly'), { exact: true }).last().fill('60')
    await dlg().getByRole('button', { name: L('analysis.crew.addRate'), exact: true }).click()
  })
  await S('crew-satz-regeln', async () => {
    const r = dlg().getByLabel(L('analysis.crew.callout'), { exact: true }).first()
    await r.fill('50')
    await dlg().getByLabel(L('analysis.crew.otAfter'), { exact: true }).first().fill('8')
    await dlg().getByLabel(L('analysis.crew.otPercent'), { exact: true }).first().fill('25')
    await dlg().getByRole('checkbox', { name: 'Nacht' }).check()
  })
  await S('crew-schicht', async () => { await dlg().getByRole('button', { name: L('analysis.crew.addEntry'), exact: true }).click() })
  await S('crew-schicht-nacht', async () => {
    await dlg().getByLabel(L('analysis.crew.end'), { exact: true }).first().fill('23:00')
  })
  await opts('crew-buchungsstand', dlg().getByLabel(L('analysis.crew.booking'), { exact: true }).first())
  await T('crew-schicht-nacht')
  await S('crew-auslage', async () => {
    await dlg().getByLabel(L('analysis.crew.amount'), { exact: true }).fill('42,50')
    await dlg().getByLabel(L('analysis.crew.receipt'), { exact: true }).fill('B-17')
    await dlg().getByRole('button', { name: L('analysis.crew.addExpense'), exact: true }).click()
  })
  await opts('crew-auslagenart', dlg().getByLabel(L('analysis.crew.expenseKind'), { exact: true }))
  await S('crew-beleg-lesen', async () => {
    await scrollTo(dlg().getByText(L('analysis.crew.pasteReceipt')))
    await dlg().locator('#beleg-text').fill('Baumarkt Nord GmbH\n12.09.2026\nGaffa 3 Rollen 17,85\nSumme EUR 21,24\nMwSt 19 %')
  })
  await T('crew-beleg-lesen')
  await S('crew-zusage', async () => {
    await dlg().getByLabel(L('analysis.crew.paste'), { exact: true }).fill('[09/09/26, 20:14] Max Mustermann: ja, mach die Überstunden')
    await dlg().getByRole('button', { name: L('analysis.crew.addApproval') }).click()
  })
  await S('crew-uebergabe', async () => { await scrollBy(4000) })
  await T('crew-uebergabe')

  await S('ansteht-spaeter', () => inTab(0)); await T('ansteht-spaeter')
  // 8.5 Namensregel
  await S('namen', () => inTab(4)); await T('namen')
  await S('namen-regel', async () => {
    await dlg().getByLabel(L('analysis.naming.sep'), { exact: true }).first().fill('_')
    await dlg().getByLabel(L('analysis.naming.case'), { exact: true }).selectOption('upper')
    await dlg().getByLabel(L('analysis.naming.filter'), { exact: true }).selectOption('Audio')
  })
  await T('namen-regel')
  await opts('namen-schreibweise', dlg().getByLabel(L('analysis.naming.case'), { exact: true }))
  await S('namen-anwenden', async () => { await dlg().getByRole('button', { name: L('analysis.naming.apply') }).click() })
  await T('namen-anwenden')
  await S('namen-aufnahme', async () => {
    await dlg().getByLabel(L('analysis.recordName.take'), { exact: false }).first().fill('3')
    await scrollTo(dlg().getByText(L('analysis.recordName.title'), { exact: true }))
  })
  await T('namen-aufnahme')

  // 8.6 Dante
  await S('dante-leer', () => inTab(5)); await T('dante-leer')
  await S('dante-eins', async () => { await dlg().locator('input[type=file]').setInputFiles(DANTE1); await pause(500) })
  await T('dante-eins')
  await S('dante-zwei', async () => { await dlg().locator('input[type=file]').setInputFiles(DANTE2); await pause(500) })
  await T('dante-zwei')

  // 8.7 Gewicht & Wärme (+ Stromrechner)
  await S('gewicht', () => inTab(6)); await T('gewicht')
  await S('strom-offen', async () => { await dlg().getByRole('button', { name: L('app.menu.tools.power') }).click() })
  await T('strom-offen')
  await opts('strom-anschluss', dlg().getByLabel(L('calc.connectionType'), { exact: true }))
  await S('strom-reserve', async () => { await dlg().getByLabel(L('calc.safetyReserve'), { exact: true }).fill('30') })
  await S('strom-phasen', async () => { await scrollTo(dlg().getByText(L('calc.phaseDistribution'), { exact: false })) })
  await T('strom-phasen')
  await S('strom-phase-fix', async () => {
    const s = dlg().locator('select[title]').first()
    await s.selectOption('1')
  })
  await S('strom-export-zeile', async () => { await scrollTo(dlg().getByText(L('calc.euColorTitle'), { exact: false })) })
  await S('strom-usv', async () => { await scrollTo(dlg().getByText(L('calc.ups.title'), { exact: false })) })
  await T('strom-usv')
  await S('strom-usv-werte', async () => { await gl('calc.ups.va', { exact: false }).fill('3000') })
  await S('strom-spannungsfall', async () => { await scrollTo(dlg().getByText(L('calc.vdrop.title'), { exact: false })) })
  await T('strom-spannungsfall')
  await S('strom-verbraucher', async () => { await scrollTo(dlg().getByText(L('calc.topConsumers'), { exact: false })) })
  await T('strom-verbraucher')
  await V(async () => { await a.zu(); await a.menue('app.menu.tools', 'app.menu.tools.analysis'); await tab(6).click() })

  // 8.8 Netzwerk
  await S('netz-oben', () => inTab(7)); await T('netz-oben')
  await S('netz-segmente', async () => { await scrollTo(dlg().getByText(L('segment.title'), { exact: false })) })
  await S('netz-segmente-uebernehmen', async () => { await dlg().getByRole('button', { name: /VLAN/ }).filter({ hasText: /\d/ }).first().click() })
  await S('netz-segmente-benennen', async () => {
    const p = dlg().getByPlaceholder(L('segment.namePh')).first()
    await p.fill('Kamera-Steuerung')
  })
  await T('netz-segmente-benennen')
  await opts('netz-zweck', dlg().locator('select').filter({ has: dlg().locator('option[value="media-primary"]') }).first())
  await S('netz-streams', async () => { await scrollTo(dlg().getByText(L('streams.title'), { exact: false })) })
  await T('netz-streams')
  await S('netz-adressbereiche', async () => { await scrollTo(dlg().getByText(L('addrTpl.title'), { exact: false })) })
  await S('netz-ebene-standard', async () => { await dlg().getByRole('button', { name: L('addrTpl.addStanding') }).click() })
  await S('netz-bereich', async () => {
    await dlg().getByPlaceholder(L('addrTpl.newRangePh')).first().fill('10.0.1.0/24')
    await dlg().getByRole('button', { name: L('addrTpl.addRange'), exact: true }).first().click()
  })
  await S('netz-ebene-haus', async () => {
    await dlg().getByRole('button', { name: L('addrTpl.addVenue') }).click()
    await dlg().getByPlaceholder(L('addrTpl.newRangePh')).last().fill('10.0.1.0/25')
    await dlg().getByRole('button', { name: L('addrTpl.addRange'), exact: true }).last().click()
  })
  await T('netz-ebene-haus')
  await S('netz-subnetze', async () => { await scrollTo(dlg().getByText(L('analysis.network.subnets'), { exact: false }).first()) })
  await S('netz-adressplan', async () => { await scrollTo(dlg().getByText(L('analysis.address.title'), { exact: true })) })
  await T('netz-adressplan')
  await S('netz-portkarte', async () => { await scrollTo(dlg().getByText(L('analysis.switchPorts.title'), { exact: true })) })
  await T('netz-portkarte')
  await S('netz-haus-anforderung', async () => { await scrollTo(dlg().getByText(L('analysis.venue.title'), { exact: true })) })
  await S('netz-haus-antwort', async () => {
    const b = dlg().getByRole('button', { name: L('analysis.venue.a.granted'), exact: true }).first()
    await b.click()
    await dlg().getByRole('button', { name: L('analysis.venue.a.partial'), exact: true }).nth(1).click()
  })
  await T('netz-haus-antwort')
  await S('netz-ptp', async () => { await scrollTo(dlg().getByText(L('analysis.ptp.title'), { exact: false }).first()) })
  await T('netz-ptp')
  await S('netz-multicast', async () => { await scrollTo(dlg().getByText(L('analysis.mc.title'), { exact: true })) })
  await S('netz-multicast-pool', async () => {
    await dlg().getByPlaceholder('239.100.0.0/16').fill('239.100.0.0/16')
    await dlg().getByPlaceholder('239.100.0.0/16').blur()
    await pause(400)
    await dlg().getByRole('button', { name: /Allocate|Vergeben|vergeben/ }).first().click()
  })
  await T('netz-multicast-pool')
  await S('netz-merkblatt', async () => { await scrollTo(dlg().getByText(L('analysis.crew.title'), { exact: true }).first()) })
  await T('netz-merkblatt')
  await S('netz-knoepfe', async () => { await scrollBy(6000) })
  await S('bandbreite-offen', async () => { await dlg().getByRole('button', { name: L('app.menu.tools.bandwidth') }).click() })
  await T('bandbreite-offen')
  await opts('bandbreite-aufloesung', dlg().locator('select').first())
  await opts('bandbreite-abtastung', dlg().locator('select').nth(2))
  await S('bandbreite-werte', async () => {
    await dlg().locator('select').first().selectOption('2160p / 4K UHD')
    await dlg().locator('select').nth(1).selectOption('59.94')
    await dlg().locator('select').nth(2).selectOption('4:2:2 10-bit')
  })
  await T('bandbreite-werte')
  await S('bandbreite-listen', async () => {
    await dlg().locator('summary').filter({ hasText: 'SDI-Tiers' }).click()
    await dlg().locator('summary').filter({ hasText: L('calc.bandwidth.signalStds') }).click()
  })
  await T('bandbreite-listen')
  await S('bandbreite-projekt', async () => { await scrollTo(dlg().getByText(L('calc.bandwidth.netBudget'), { exact: false })) })
  await T('bandbreite-projekt')
  await V(async () => { await a.zu(); await a.menue('app.menu.tools', 'app.menu.tools.analysis') })

  // 8.9 Redundanz
  await S('redundanz', () => inTab(8)); await T('redundanz')
  // 8.10 RF / Funk
  await S('rf', () => inTab(9)); await T('rf')
  await opts('rf-baender', dlg().locator('select').first())
  await S('rf-band', async () => { await dlg().locator('select').first().selectOption('3') })
  await S('rf-bandtabelle', async () => { await dlg().locator('summary').filter({ hasText: L('analysis.rf.bandRef') }).click(); await scrollTo(dlg().locator('summary').filter({ hasText: L('analysis.rf.bandRef') })) })
  await S('rf-scan', async () => {
    await scrollTo(dlg().getByText(L('scan.title'), { exact: true }))
    await dlg().locator('input[type=file]').setInputFiles(SCAN); await pause(600)
  })
  await T('rf-scan')
  await S('rf-scan-schwelle', async () => { await dlg().getByLabel(L('scan.threshold')).fill('-60') })
  await T('rf-scan-schwelle')
  // 8.11 Kabelwege
  await S('wege', () => inTab(10)); await T('wege')
  // 8.12 Signalwege
  await S('signal', () => inTab(11)); await T('signal')
  // 8.13 Anschlussliste
  await S('anschluss', () => inTab(12)); await T('anschluss')
  await S('anschluss-suche', async () => { await dlg().getByPlaceholder(L('analysis.patch.search')).fill('Switch') })
  await S('anschluss-offene', async () => { await dlg().getByLabel(L('analysis.patch.onlyOpen')).check() })
  await T('anschluss-offene')
  // 8.14 Blatt prüfen
  await S('blatt', () => inTab(13))
  await S('blatt-unlesbar', async () => { await dlg().getByPlaceholder(/1a2b3c4d/).fill('xyz'); await dlg().getByRole('button', { name: L('analysis.sheet.check') }).click() })
  await T('blatt-unlesbar')
  await S('blatt-fremd', async () => { await dlg().getByPlaceholder(/1a2b3c4d/).fill('1a2b3c4d'); await dlg().getByRole('button', { name: L('analysis.sheet.check') }).click() })
  await T('blatt-fremd')
  await zuUndFrisch()

  // ═════════════ 9 — Plan-Check ═════════════
  await S('statusleiste', async () => {}, () => w.locator('footer.cp-statusbar'))
  await T('statusleiste', w.locator('footer.cp-statusbar'))
  await S('check-offen', () => a.menue('app.menu.tools', 'app.menu.tools.planCheck'))
  await T('check-offen')
  await S('check-mitte', async () => { await scrollBy(700) })
  await S('check-mitte2', async () => { await scrollBy(700) })
  await S('check-ende', async () => { await scrollBy(4000) })
  await S('check-klick', async () => {
    await scrollTop()
    await dlg().locator('ul button').first().click()
    await pause(700)
  }, () => w.locator('body'))
  await zuUndFrisch()

  // ═════════════ 10 — Plan gegen Vorgefundenes ═════════════
  await S('abgleich-offen', () => a.menue('app.menu.tools', 'app.menu.tools.reconcile'))
  await T('abgleich-offen')
  await S('abgleich-datei', async () => {
    w.once('filechooser', async (fc) => { await fc.setFiles(ARP).catch(() => {}) })
    await dlg().getByRole('button', { name: L('reconcile.load') }).click()
    await pause(1200)
  })
  await T('abgleich-datei')
  await zuUndFrisch()

  // ═════════════ 11 — Plan-Check ohne Befund ═════════════
  await V(async () => { await a.menue('app.menu.file', 'app.menu.file.new'); await pause(1500); await bestaetigen(); await pause(1200) })
  await S('check-leer', () => a.menue('app.menu.tools', 'app.menu.tools.planCheck'))
  await T('check-leer')
  await zuUndFrisch()

  } catch (e) {
    console.log('ABBRUCH', String(e.stack ?? e).split('\n').slice(0, 4).join(' | '))
  } finally {
    writeFileSync(new URL(`./werkzeuge-planen.${sprache}.json`, import.meta.url), JSON.stringify({ schritte: f.schritte, fehler: f.fehler, texte, listen }, null, 2))
  if (f.fehler.length) console.log('Fehler:\n' + f.fehler.join('\n'))
  await a.ende()
  console.log(`Lauf ${sprache} beendet`)
  }
}

// Beide Sprachen in einem Prozess: die Sperre der Aufnahme-Werkzeuge wird nur einmal abgewartet.
// Zwischen den Läufen gibt `ende()` sie frei und `starte()` nimmt sie sofort wieder.
for (const sp of ARG === 'beide' ? ['de', 'en'] : [ARG]) await lauf(sp)
console.log('FERTIG')
