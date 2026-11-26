// #1240 Stufe 5 — „Als Gerät im Netz anbieten“: die Innenansicht als ATEM
// (UDP 9910) bzw. Videohub (TCP 9990), damit ATEM Software Control,
// Companion oder die Bridge sich verbinden. Vorgabe nur 127.0.0.1; die
// Adresse steht sichtbar da, und das Geraet nennt sich „Emulator …“.
import { useEffect, useState } from 'react'
import { format, useTranslation } from '../../../lib/i18n'
import { cablePlannerApi, hasDesktopBridge } from '../../../lib/bridge'
import { emulatorStarten, emulatorStoppen } from '../../../lib/emulatorSync'
import type { EquipmentItem } from '../../../types/equipment'
import type { EmuKind, EmuStatus } from '../../../types/emulator'

export const EmulatorSchalter = ({ device, kind }: { device: EquipmentItem; kind: EmuKind }) => {
  const t = useTranslation()
  const [status, setStatus] = useState<EmuStatus | null>(null)
  const [lan, setLan] = useState(false)
  const [busy, setBusy] = useState(false)
  const meins = status?.running && status.equipmentId === device.id

  useEffect(() => {
    if (!hasDesktopBridge) return
    let aktiv = true
    const holen = () =>
      void cablePlannerApi.emulator
        .status(kind)
        .then((s) => aktiv && setStatus(s))
        .catch(() => undefined)
    holen()
    const id = window.setInterval(holen, 2000)
    return () => {
      aktiv = false
      window.clearInterval(id)
    }
  }, [kind])

  const umschalten = async (an: boolean) => {
    setBusy(true)
    try {
      setStatus(an ? await emulatorStarten(kind, device, lan) : await emulatorStoppen(kind))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section data-testid="emulator-schalter">
      <label className="flex items-center gap-2 font-medium text-cp-text">
        <input
          type="checkbox"
          checked={!!meins}
          disabled={!hasDesktopBridge || busy}
          onChange={(e) => void umschalten(e.target.checked)}
        />
        {t('switching.emu.offer', 'Offer as a device on the network')}
      </label>
      {!hasDesktopBridge ? (
        <p className="mt-1 text-cp-text-muted">
          {t('switching.emu.desktopOnly', 'Desktop app only: a browser cannot open a UDP or TCP server.')}
        </p>
      ) : (
        <>
          <label className="mt-1 flex items-center gap-2 text-cp-text-secondary">
            <input type="checkbox" checked={lan} disabled={!!meins || busy} onChange={(e) => setLan(e.target.checked)} />
            {t('switching.emu.lan', 'Also reachable from other computers')}
          </label>
          {meins && status?.address && (
            <p className="mt-1 rounded-cp-card border border-cp-warn bg-cp-surface-2 p-2" data-testid="emulator-adresse">
              {format(
                t(
                  'switching.emu.address',
                  'Emulator at {address} — not a real device, no picture behind any bus. Connected consoles: {n}.',
                ),
                { address: status.address, n: status.clients },
              )}
            </p>
          )}
          {status?.running && !meins && (
            <p className="mt-1 text-cp-text-muted">
              {t('switching.emu.busy', 'Another device in the plan is already offered on this port.')}
            </p>
          )}
          {status?.error && <p className="mt-1 text-cp-warn">{status.error}</p>}
          <p className="mt-1 text-cp-text-muted">
            {kind === 'atem'
              ? t(
                  'switching.emu.hintAtem',
                  'ATEM Software Control, Companion and the bridge connect to this address (UDP 9910). Switching there changes the plan.',
                )
              : t(
                  'switching.emu.hintVideohub',
                  'Videohub software and controllers connect to this address (TCP 9990). Switching there changes the plan.',
                )}
          </p>
        </>
      )}
    </section>
  )
}
