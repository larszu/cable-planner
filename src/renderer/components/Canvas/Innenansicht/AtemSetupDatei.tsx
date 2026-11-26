// #1240 Stufe 4 — ATEM-Setup-Datei in der Innenansicht laden und speichern;
// darunter (Stufe 5) der Schalter „Als Gerät im Netz anbieten“.
//
// Die Datei geht durch `atemProfileXml.ts`: was das Modell kennt, landet im
// Plan; alles andere bleibt in der Datei und kommt beim Speichern byte-gleich
// wieder heraus. Gespeichert wird ueber denselben Weg wie die Audio-Datei
// (`exportDeviceConfig`, mit Herkunftsblatt).
import { useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import { readAtemProfileXml, writeAtemProfileXml } from '../../../lib/atemProfileXml'
import { exportDeviceConfig } from '../../../lib/deviceConfigExport'
import { buildExportFilenameWithSuffix } from '../../../lib/exportFilename'
import { detectDeviceKind } from '../../../lib/deviceKind'
import type { EquipmentItem } from '../../../types/equipment'
import type { SwitchingProfile } from '../../../lib/switching'
import { EmulatorSchalter } from './EmulatorSchalter'

const istAtem = (device: EquipmentItem, profile: SwitchingProfile | null): boolean =>
  profile ? profile.idScheme === 'atem' && profile.role === 'mixer' : detectDeviceKind(device) === 'atem'

export const AtemSetupDatei = ({ device, profile }: { device: EquipmentItem; profile: SwitchingProfile | null }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null)
  if (!istAtem(device, profile)) return null
  const datei = device.switching?.atemProfile

  const laden = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xml,application/xml,text/xml'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const r = readAtemProfileXml(device, String(reader.result ?? ''), file.name)
          updateEquipment(device.id, r.patch)
          setMeldung({
            ok: true,
            text: r.unmapped.length
              ? format(
                  t(
                    'switching.setup.loadedUnmapped',
                    'Loaded. Sources {ids} have no block in the plan; they stay unchanged in the file.',
                  ),
                  { ids: r.unmapped.join(', ') },
                )
              : t('switching.setup.loaded', 'Loaded.'),
          })
        } catch (e) {
          setMeldung({ ok: false, text: e instanceof Error ? e.message : String(e) })
        }
      }
      reader.onerror = () => setMeldung({ ok: false, text: t('switching.setup.readError', 'Could not read the file.') })
      reader.readAsText(file)
    }
    input.click()
  }

  const speichern = () => {
    try {
      const xml = writeAtemProfileXml(device)
      exportDeviceConfig(
        device.name || 'ATEM',
        'Setup-Datei',
        datei?.fileName ?? buildExportFilenameWithSuffix(device.name, 'Setup', 'xml'),
        xml,
        'application/xml',
      )
      setMeldung(null)
    } catch (e) {
      setMeldung({ ok: false, text: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <>
    <section data-testid="atem-setup-datei">
      <h3 className="mb-1 font-medium text-cp-text">{t('switching.setup.title', 'ATEM setup file')}</h3>
      <p className="mb-1 text-cp-text-muted">
        {datei
          ? format(t('switching.setup.from', 'Based on {file}. What the plan does not know stays unchanged.'), {
              file: datei.fileName ?? datei.product ?? 'XML',
            })
          : t('switching.setup.none', 'No file loaded. Saving writes the sections the plan knows.')}
      </p>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={laden} className="rounded-cp-s border border-cp-border px-2 py-1 hover:bg-cp-surface-3">
          {t('switching.setup.load', 'Load setup file…')}
        </button>
        <button type="button" onClick={speichern} className="rounded-cp-s border border-cp-border px-2 py-1 hover:bg-cp-surface-3">
          {t('switching.setup.save', 'Save setup file…')}
        </button>
      </div>
      {meldung && <p className={meldung.ok ? 'mt-1 text-cp-text-secondary' : 'mt-1 text-cp-warn'}>{meldung.text}</p>}
    </section>
    <EmulatorSchalter device={device} kind="atem" />
    </>
  )
}
