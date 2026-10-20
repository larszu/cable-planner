/**
 * #952 — Karte zur Adresse eines Raums.
 *
 * OpenStreetMap statt Google Maps: Einbettung und Suche brauchen keinen
 * API-Schluessel. Die Einbettung (`export/embed.html`) nimmt nur Koordinaten,
 * deshalb wird die Adresse einmal ueber Nominatim aufgeloest und das Ergebnis
 * am Raum gespeichert (`geo.for` = die Adresse, fuer die es gilt). So fragt
 * nicht jedes Oeffnen des Panels erneut an — Nominatim erlaubt hoechstens
 * eine Anfrage pro Sekunde. Beide Hosts stehen in der CSP (`src/main/index.ts`).
 */
export interface StandortGeo {
  lat: number
  lon: number
  /** Adresse, zu der die Koordinaten gehoeren. Weicht sie ab, ist `geo` veraltet. */
  for: string
}

export const osmSuchLink = (adresse: string): string =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent(adresse.trim())}`

export const osmEinbettung = (lat: number, lon: number, spanne = 0.004): string => {
  const bbox = [lon - spanne, lat - spanne / 2, lon + spanne, lat + spanne / 2].map((n) => n.toFixed(6)).join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lon.toFixed(6)}`
}

export const geoGiltFuer = (geo: StandortGeo | undefined, adresse: string | undefined): geo is StandortGeo =>
  !!geo && !!adresse && geo.for.trim() === adresse.trim()

/** Loest eine Adresse auf; `null`, wenn nichts gefunden wurde oder das Netz fehlt. */
export const adresseAufloesen = async (adresse: string, holen: typeof fetch = fetch): Promise<StandortGeo | null> => {
  const a = adresse.trim()
  if (!a) return null
  try {
    const r = await holen(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(a)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) return null
    const treffer = (await r.json()) as Array<{ lat?: string; lon?: string }>
    const lat = Number(treffer[0]?.lat)
    const lon = Number(treffer[0]?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return { lat, lon, for: a }
  } catch {
    return null
  }
}
