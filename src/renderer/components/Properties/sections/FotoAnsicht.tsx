import { Camera, MapPinOff } from 'lucide-react'
import { ModalShell } from '../../shared/ModalShell'
import { Icon } from '../../shared/Icon'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useTranslation } from '../../../lib/i18n'
import { fotoDatum } from '../../../lib/fotoMasse'

/**
 * #1187 — ein Foto gross: aus der Marke im Plan oder aus der Fotoliste.
 * Bildunterschrift ist hier editierbar, damit man sie beim Ansehen
 * nachtragen kann, ohne erst das Geraet zu suchen, an dem das Foto haengt.
 */
export const FotoAnsicht = () => {
  const t = useTranslation()
  const id = useUiStore((s) => s.fotoAnsicht)
  const schliessen = useUiStore((s) => s.setFotoAnsicht)
  const foto = useProjectStore((s) => (id ? s.project.fotos?.find((f) => f.id === id) : undefined))
  const ziel = useProjectStore((s) => {
    const z = foto?.zeigtAuf
    if (!z) return ''
    if (z.equipmentId) return s.project.equipment.find((e) => e.id === z.equipmentId)?.name ?? ''
    if (z.cableId) return s.project.cables.find((c) => c.id === z.cableId)?.name ?? ''
    if (z.locationId) return s.project.locations?.find((l) => l.id === z.locationId)?.name ?? ''
    return ''
  })
  const updateFoto = useProjectStore((s) => s.updateFoto)
  if (!foto) return null
  const markeEntfernen = () => {
    const { punkt: _weg, ...rest } = foto.zeigtAuf ?? {}
    updateFoto(foto.id, { zeigtAuf: Object.keys(rest).length ? rest : undefined })
  }
  return (
    <ModalShell
      open
      onClose={() => schliessen(null)}
      title={ziel || t('foto.projectSection', 'Photos of the project')}
      titleIcon={<Icon icon={Camera} size="md" />}
      maxWidth="3xl"
    >
      <div className="space-y-2 text-cp-sm">
        {foto.dataUri ? (
          <img src={foto.dataUri} alt={foto.notiz ?? ''} className="mx-auto max-h-[70vh] max-w-full object-contain" />
        ) : (
          <p className="text-cp-text-muted">{t('foto.missing', 'image not loaded')}</p>
        )}
        <input
          value={foto.notiz ?? ''}
          placeholder={t('foto.caption', 'Caption')}
          onChange={(e) => updateFoto(foto.id, { notiz: e.target.value || undefined })}
          className="w-full border border-cp-border bg-cp-surface-3 px-2 py-1.5 text-cp-sm"
        />
        <div className="flex items-center gap-2 text-cp-xs text-cp-text-muted">
          <span className="flex-1">
            {fotoDatum(foto)} · {foto.breite} × {foto.hoehe}
          </span>
          {foto.zeigtAuf?.punkt && (
            <button
              type="button"
              onClick={markeEntfernen}
              className="inline-flex items-center gap-1 border border-cp-border px-2 py-1 hover:text-cp-text"
            >
              <Icon icon={MapPinOff} className="h-3 w-3" />
              {t('foto.unmark', 'Remove mark from plan')}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
