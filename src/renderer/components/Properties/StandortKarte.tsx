import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { adresseAufloesen, geoGiltFuer, osmEinbettung, osmSuchLink, type StandortGeo } from '../../lib/standortKarte'

/**
 * #952 — OSM-Karte zur Raumadresse. Ohne Netz oder ohne Treffer bleibt nur der
 * Link, der die Suche im Browser oeffnet.
 */
export const StandortKarte = ({
  address,
  geo,
  onGeo,
}: {
  address: string
  geo?: StandortGeo
  onGeo: (geo: StandortGeo) => void
}) => {
  const t = useTranslation()
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine)
  const gueltig = geoGiltFuer(geo, address)

  useEffect(() => {
    const an = () => setOffline(false)
    const aus = () => setOffline(true)
    window.addEventListener('online', an)
    window.addEventListener('offline', aus)
    return () => {
      window.removeEventListener('online', an)
      window.removeEventListener('offline', aus)
    }
  }, [])

  useEffect(() => {
    if (gueltig || offline || !address.trim()) return
    let ab = false
    // Warten, bis das Tippen ruht — Nominatim erlaubt eine Anfrage pro Sekunde.
    const timer = setTimeout(() => {
      void adresseAufloesen(address).then((g) => {
        if (!ab && g) onGeo(g)
      })
    }, 1200)
    return () => {
      ab = true
      clearTimeout(timer)
    }
  }, [address, gueltig, offline, onGeo])

  return (
    <div className="space-y-1">
      {gueltig && !offline && (
        <iframe
          title={t('location.map.title', 'Map of the address')}
          src={osmEinbettung(geo.lat, geo.lon)}
          className="h-40 w-full rounded-cp-control border border-cp-border"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      <a
        href={osmSuchLink(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-cp-accent hover:underline"
      >
        <ExternalLink size={12} aria-hidden />
        {t('location.map.open', 'Open in OpenStreetMap')}
      </a>
    </div>
  )
}
