/**
 * NetBox-Roh-Typen (#597).
 *
 * Spiegelt die Teilmenge der NetBox-DCIM-API, die der Import braucht. Die
 * Felder sind bewusst alle optional: NetBox-Instanzen laufen in freier
 * Wildbahn zwischen v3.2 und v4.x, und einzelne Felder wurden zwischen
 * diesen Versionen umbenannt (`device_role` → `role`, `termination_a_*` →
 * `a_terminations[]`). Das Mapping (`lib/netboxMapping.ts`) kennt beide
 * Formen; hier stehen sie deshalb nebeneinander.
 *
 * Die Typen leben im Renderer, weil `tsconfig.main.json` ein eigenes
 * `rootDir` (src/main) hat und der Main-Prozess nicht aus dem Renderer
 * importieren kann. Main gibt den Snapshot als reines JSON durch.
 */

/** Verkürztes Referenz-Objekt, wie NetBox es in verschachtelten Feldern
 *  liefert (`{id, url, display, name, slug}`). */
export interface NetboxRef {
  id?: number
  name?: string
  display?: string
  slug?: string
  url?: string
}

export interface NetboxSite extends NetboxRef {
  description?: string
  status?: { value?: string; label?: string }
  device_count?: number
  rack_count?: number
}

export interface NetboxRack extends NetboxRef {
  site?: NetboxRef
  location?: NetboxRef
  u_height?: number
  /** Ab NetBox 4.1: `starting_unit`. Davor beginnt jedes Rack bei 1. */
  starting_unit?: number
  /** true = HE 1 oben statt unten. */
  desc_units?: boolean
  device_count?: number
  status?: { value?: string; label?: string }
}

export interface NetboxDeviceType extends NetboxRef {
  model?: string
  manufacturer?: NetboxRef
  u_height?: number
}

export interface NetboxDevice extends NetboxRef {
  device_type?: NetboxDeviceType
  /** NetBox ≥ 3.6. */
  role?: NetboxRef
  /** NetBox ≤ 3.5 (deprecated, aber noch im Feld anzutreffen). */
  device_role?: NetboxRef
  site?: NetboxRef
  rack?: NetboxRef
  /** Unterste belegte Höheneinheit (float ab NetBox 3.4 wegen halber HE). */
  position?: number | null
  face?: { value?: string; label?: string } | null
  status?: { value?: string; label?: string }
  serial?: string
  asset_tag?: string | null
  primary_ip?: { address?: string } | null
  primary_ip4?: { address?: string } | null
  description?: string
  comments?: string
}

/** Gemeinsame Form aller Geräte-Komponenten (Interface, FrontPort, …). */
export interface NetboxComponent extends NetboxRef {
  device?: NetboxRef
  label?: string
  type?: { value?: string; label?: string } | string | null
  /** Kabel-Referenz: ab NetBox 3.3 ein Brief-Objekt, davor eine blanke ID. */
  cable?: NetboxRef | number | null
  description?: string
  /** Nur Interfaces. */
  mgmt_only?: boolean
  enabled?: boolean
  mac_address?: string | null
  /** Nur FrontPorts: der zugehörige RearPort. */
  rear_port?: NetboxRef
}

/** Ein Kabelende. NetBox ≥ 3.3 liefert `a_terminations`/`b_terminations`
 *  als Arrays (Mehrfach-Terminierung möglich). */
export interface NetboxTermination {
  object_type?: string
  object_id?: number
  object?: NetboxRef & { device?: NetboxRef }
}

export interface NetboxCable extends NetboxRef {
  label?: string
  color?: string
  type?: string | null
  status?: { value?: string; label?: string } | string
  length?: number | null
  length_unit?: { value?: string; label?: string } | string | null
  description?: string
  /** NetBox ≥ 3.3. */
  a_terminations?: NetboxTermination[]
  b_terminations?: NetboxTermination[]
  /** NetBox ≤ 3.2 — Einzel-Terminierung. */
  termination_a_type?: string
  termination_a_id?: number
  termination_a?: NetboxRef & { device?: NetboxRef }
  termination_b_type?: string
  termination_b_id?: number
  termination_b?: NetboxRef & { device?: NetboxRef }
}

/**
 * Lese-Snapshot, den `netbox:fetch-snapshot` liefert. `components` ist nach
 * NetBox-`object_type`-Suffix gebündelt (`interface`, `frontport`,
 * `rearport`, `consoleport`, `consoleserverport`, `powerport`,
 * `poweroutlet`), damit `termination.object_type` direkt darauf zeigt.
 */
export interface NetboxSnapshot {
  scope: 'site' | 'rack'
  scopeId: number
  scopeName: string
  siteName: string
  racks: NetboxRack[]
  devices: NetboxDevice[]
  components: Record<string, NetboxComponent[]>
  cables: NetboxCable[]
  netboxVersion: string
}

/** Wahl von Site oder Rack im Import-Dialog. */
export interface NetboxScopeChoice {
  scope: 'site' | 'rack'
  id: number
  name: string
}
