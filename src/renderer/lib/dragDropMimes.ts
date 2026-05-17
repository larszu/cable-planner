// v7.9.41 — Zentrale Registry für HTML5-Drag-MIME-Types.
//
// Vorher waren die MIME-Strings an 5+ Stellen als String-Literal
// dupliziert ("application/cable-planner-equipment" etc.). Tippfehler
// in einem getData/setData hätten die Drop-Erkennung lautlos kaputt
// gemacht ohne TypeScript-Fehler. Jetzt einmal hier definiert, überall
// importieren.

/** Equipment-Template aus der Library auf den Canvas droppen. */
export const MIME_EQUIPMENT = 'application/cable-planner-equipment'

/** Group-Preset (mehrere Geräte + interne Kabel) auf den Canvas droppen. */
export const MIME_GROUP_PRESET = 'application/cable-planner-group-preset'

/** Rack-Preset (= Group-Preset mit rack-Feld) auf den Canvas droppen. */
export const MIME_RACK_PRESET = 'application/cable-planner-rack-preset'

/** Annotation aus dem Annotations-Panel auf den Canvas droppen. */
export const MIME_ANNOTATION = 'application/cable-planner-annotation'
