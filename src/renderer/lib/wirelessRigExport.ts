// ───────────────────────────────────────────────────────────────────────────
// #1002 — Der Funkstrecken-Plan als Liste: dieselbe Tabelle fuer CSV und
// Druck (`csvFromTable` / `sheetFromTable` + `buildPacketHtml`), damit beide
// Ausgaben nie auseinanderlaufen. REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CsvTable } from './csv'
import type { WirelessRigPlan } from '../types/wirelessRig'
import { wirelessById } from './wirelessCatalog'
import { bandById, bandLabel } from './rfBands'
import { countryTable, rangeForChannel } from './rfCountryTables'
import { satz, satzKanonisch } from './satz'

export const RIG_LIST_HEADERS = [
  'Kanal',
  'Sender',
  'Kapsel',
  'Band',
  'Frequenz (MHz)',
  'Bandbreite (kHz)',
  'Zulassung',
] as const

/** Was die Zulassungsspalte ueber einen Kanal sagt. */
export const channelBandStatus = (
  rig: WirelessRigPlan,
  channelId: string,
): { inBand: boolean | undefined; allowed: boolean | undefined; country: string } => {
  const c = rig.channels.find((x) => x.id === channelId)
  if (!c) return { inBand: undefined, allowed: undefined, country: '' }
  const band = bandById(c.bandId)
  const f = c.frequencyMhz
  const half = (c.bandwidthKhz ?? 0) / 2000
  const inBand = band && f != null ? f - half >= band.fromMHz && f + half <= band.toMHz : undefined
  const table = countryTable(rig.country)
  const r = rangeForChannel(table, f, c.bandwidthKhz)
  const country =
    r === undefined
      ? ''
      : r === null
        ? satzKanonisch(satz('rest.rf.notInTable', 'not in {code} table', { code: table!.code }))
        : r.use === 'professional'
          ? satzKanonisch(satz('rest.rf.rangePro', '{code} {von}–{bis} MHz (professional production only)', { code: table!.code, von: r.fromMHz, bis: r.toMHz }))
          : `${table!.code} ${r.fromMHz}–${r.toMHz} MHz`
  return { inBand, allowed: r === undefined ? undefined : r !== null, country }
}

export const wirelessRigTable = (rig: WirelessRigPlan): CsvTable => ({
  headers: [...RIG_LIST_HEADERS],
  rows: rig.channels.map((c) => {
    const band = bandById(c.bandId)
    const st = channelBandStatus(rig, c.id)
    const bandCell = band
      ? `${bandLabel(band)} (${band.fromMHz}–${band.toMHz})${st.inBand === false ? ' AUSSERHALB' : ''}`
      : ''
    return [
      c.label,
      c.bodyDeviceTypeId ? (wirelessById(c.bodyDeviceTypeId)?.name ?? '') : '',
      c.micDeviceTypeId ? (wirelessById(c.micDeviceTypeId)?.name ?? '') : '',
      bandCell,
      c.frequencyMhz != null ? c.frequencyMhz.toFixed(3) : '',
      c.bandwidthKhz != null ? String(c.bandwidthKhz) : '',
      st.country,
    ]
  }),
})
