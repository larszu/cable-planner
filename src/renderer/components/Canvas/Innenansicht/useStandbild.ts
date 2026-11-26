// #1240 — Hooks zum Media-Pool: Bildquelle eines Platzes, Laden, Ersetzen,
// Entfernen. Die Oberflaeche dazu steht in `Standbild.tsx`.
import { useCallback, useEffect, useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import { cablePlannerApi, hasDesktopBridge } from '../../../lib/bridge'
import { alsDataUrl } from '../../../lib/anhaenge'
import { nimmStandbild } from '../../../lib/fotoAufnahme'
import {
  effectiveCounts,
  fotosInUse,
  loadIntoPlayer,
  playerSlot,
  setMediaSlot,
  stillRef,
  switchingProfileFor,
  type MediaSlotState,
} from '../../../lib/switching'

/** Bildquelle und Name eines belegten Platzes. */
export const useStillBild = (ref: MediaSlotState | undefined): { src: string | null; name: string | null } => {
  const foto = useProjectStore((s) => (ref?.fotoId ? s.project.fotos?.find((f) => f.id === ref.fotoId) : undefined))
  const anhang = useProjectStore((s) =>
    !ref?.fotoId && ref?.anhangId ? s.project.anhaenge?.find((a) => a.id === ref.anhangId) : undefined,
  )
  const filePath = useProjectStore((s) => s.filePath)
  const [geladen, setGeladen] = useState<{ storedAs: string; src: string } | null>(null)
  const storedAs = anhang?.datei.storedAs
  useEffect(() => {
    if (!storedAs || !hasDesktopBridge || !filePath) return
    let aktiv = true
    void cablePlannerApi.attachment
      .preview(filePath, storedAs)
      .then((r) => aktiv && r && setGeladen({ storedAs, src: alsDataUrl(r.mediaType, r.daten) }))
      .catch(() => undefined)
    return () => {
      aktiv = false
    }
  }, [filePath, storedAs])
  if (foto) return { src: foto.dataUri || null, name: foto.notiz || null }
  const anhangSrc = geladen && geladen.storedAs === storedAs ? geladen.src : null
  if (anhang) return { src: anhangSrc, name: anhang.titel || anhang.datei.fileName }
  return { src: null, name: null }
}

const geraetVon = (id: string) => useProjectStore.getState().project.equipment.find((e) => e.id === id)

/** Fotos, die nach einer Aenderung kein Platz mehr braucht, fallen weg. */
const aufraeumen = (deviceId: string, vorher: Set<string>) => {
  const nachher = fotosInUse(geraetVon(deviceId)?.switching)
  for (const id of vorher) if (!nachher.has(id)) useProjectStore.getState().removeFoto(id)
}

/** Laden, Ersetzen und Entfernen — liest den Stand des Geraets frisch aus dem Store. */
export const useStandbildLaden = (deviceId: string) => {
  const t = useTranslation()
  const [fehler, setFehler] = useState<string | null>(null)
  const geraet = useCallback(() => geraetVon(deviceId), [deviceId])

  const aufnehmen = useCallback(
    async (datei: File) => {
      setFehler(null)
      const r = await nimmStandbild(datei, new Date().toISOString(), { equipmentId: deviceId })
      if (!r) {
        setFehler(t('switching.media.notImage', 'Please choose a PNG or another image file.'))
        return null
      }
      useProjectStore.getState().addFoto(r.foto)
      return r.foto.id
    },
    [deviceId, t],
  )

  const inPlatz = useCallback(
    async (slot: number, datei: File) => {
      const fotoId = await aufnehmen(datei)
      const d = geraet()
      if (!fotoId || !d) return
      const vorher = fotosInUse(d.switching)
      useProjectStore.getState().updateEquipment(deviceId, { switching: setMediaSlot(d.switching, slot, { fotoId }) })
      aufraeumen(deviceId, vorher)
    },
    [aufnehmen, deviceId, geraet],
  )

  const inPlayer = useCallback(
    async (mp: number, datei: File) => {
      const fotoId = await aufnehmen(datei)
      const d = geraet()
      if (!fotoId || !d) return
      const counts = effectiveCounts(switchingProfileFor(d), d.switching)
      const slot = playerSlot(d.switching, counts, mp)
      const vorher = fotosInUse(d.switching)
      useProjectStore.getState().updateEquipment(deviceId, { switching: loadIntoPlayer(d.switching, mp, slot, { fotoId }) })
      aufraeumen(deviceId, vorher)
    },
    [aufnehmen, deviceId, geraet],
  )

  const leeren = useCallback(
    (slot: number) => {
      const d = geraet()
      if (!d || !stillRef(d.switching, slot)) return
      const vorher = fotosInUse(d.switching)
      useProjectStore.getState().updateEquipment(deviceId, { switching: setMediaSlot(d.switching, slot, undefined) })
      aufraeumen(deviceId, vorher)
    },
    [deviceId, geraet],
  )

  return { inPlatz, inPlayer, leeren, fehler }
}

