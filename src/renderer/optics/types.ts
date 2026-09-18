// Optik-Modul aus multicam-planner übernommen. SourceIdentity wird hier nicht
// gebraucht (nur an einem fremden Feld) — lokal auf unknown gesetzt.
type SourceIdentity = unknown;

// ── Sensor ──
export interface SensorSize {
  name: string;
  widthMm: number;
  heightMm: number;
  cropFactor: number;
}

// ── Camera ──
export interface Camera {
  id: string;
  /** Datenblatt-/Hersteller-URL als Herkunftsbeleg der Daten (optional). */
  manufacturerUrl?: string;
  /**
   * Stabile geraeteuebergreifende Typ-Identitaet (GUID, GDTF/DIN-SPEC-15800-
   * analog: FixtureTypeID). Optional — gesetzt fuer Modelle, deren echte I/O im
   * Cable-Planner-Katalog hinterlegt ist. Beim Export (cameraExport) wird sie in
   * die camera-list geschrieben, sodass der Cable-Planner die Kamera AUTORITATIV
   * auf ihr Datenblatt/ihre Ports aufloest, statt ueber den Modellnamen zu raten.
   * Dieselben GUIDs stehen in cable-planner src/renderer/lib/cameraCatalog.ts.
   */
  deviceTypeId?: string;
  manufacturer: string;
  model: string;
  sensor: SensorSize;
  mount: string; // B4, EF, E, PL, MFT, M12, FZ, integrated
  adaptedMounts?: string[]; // mounts usable via adapter (e.g. B4 via LAFZ-B1 on FZ-mount)
  resolutions: string[];
  type: 'broadcast' | 'cinema' | 'ptz' | 'mirrorless' | 'camcorder' | 'eng';
  notes?: string;
  /**
   * Optional list of selectable sensor crop modes the body can run in. The first
   * entry is treated as the default and is interchangeable with `sensor`. Use this
   * for cameras with hardware crop modes that aren't determined by the lens (e.g.
   * URSA Broadcast B4 crop, VENICE 2 6K/4K windows, FX9 Super35 crop).
   */
  sensorModes?: SensorSize[];
  /**
   * Per-mount adapter metadata for the body's swappable mount plates. Keyed by
   * mount name (matching `mount` or any entry in `adaptedMounts`). When the user
   * sets `VenueCamera.activeMount` to one of these, the adapter is automatically
   * applied to FOV / DoF / aperture calculations and the badge displays its
   * name + notes.
   *
   * Use this for adapters with real optical impact (relay/crop/light loss like
   * Sony LA-FZB1 for FZ→B4, or the URSA Broadcast G2's built-in 2/3" relay on
   * the B4 mount). Passive mount plates can also be listed here for clarity —
   * the badge will show the adapter name with 0 stops loss and no crop.
   */
  mountAdapters?: Record<string, AdapterInfo>;
  /**
   * Woher die Kenndaten stammen — Feldname -> Beleg.
   *
   * WARUM. Die KI-Abfrage in `CustomCameraForm` holt Sensormasse, Mount und
   * Crop-Modi und schrieb sie ohne jede Quellenangabe ins Formular. Die
   * Sensormasse treiben die Bildwinkel- und Schaerfentiefe-Rechnung: eine
   * geratene Zahl sah dort genauso aus wie eine aus dem Datenblatt und
   * genauso wie eine von Hand getippte.
   *
   * Der `light-planner` fuehrt dasselbe Feld in derselben Form
   * (`Fixture.specSource`). Das ist Absicht: eine Idee, ein Vokabular — zwei
   * verschiedene fuer dieselbe Frage liefen unweigerlich auseinander.
   *
   * `value` ist der Wert, DEN DER BELEG STUETZT. Aendert der Nutzer das Feld
   * danach, steht hier weiterhin der alte — und die Anzeige kann sagen, dass
   * der Beleg nicht mehr passt, statt ihn still auf die neue Zahl zu beziehen.
   */
  specSource?: Record<string, { value: string; source: string }>;
}

/** Ein Beleg, dessen Wert nicht mehr zum Feld passt — der Nutzer hat es geaendert. */
export const isStaleSource = (
  entry: { value: string; source: string } | undefined,
  current: unknown,
): boolean => entry !== undefined && String(current) !== entry.value;

/** Ein Beleg, der eine Schaetzung ist und keine Ablesung. */
export const isEstimate = (entry: { source: string } | undefined): boolean =>
  entry !== undefined && /gesch(ä|ae)tzt|estimat/i.test(entry.source);

// ── Adapter result ──
export interface AdapterInfo {
  name: string;
  lightLossStops: number; // T-stop loss (0 = no loss, 1 = ~1 stop)
  cropSensor?: SensorSize; // forced sensor crop (e.g. 2/3" when using B4 adapter)
  /** Free-form background info displayed in the camera card when the adapter is active. */
  notes?: string;
}

// ── Lens image circle ──
// Format the lens actually projects (independent of its mount). E.g. an EF-S
// lens reports `mount: 'EF'` but only fills an APS-C circle. Used by the
// coverage check so an EF-S lens on a 5D body flags as vignetting even
// though the mount fits.
export type LensImageCircle = 'FF' | 'S35' | 'APSC' | 'MFT' | '2/3' | '1' | 'MF' | 'integrated';

// ── Lens ──
export interface Lens {
  id: string;
  /** Datenblatt-/Hersteller-URL als Herkunftsbeleg der Daten (optional). */
  manufacturerUrl?: string;
  manufacturer: string;
  model: string;
  focalLengthMin: number; // mm
  focalLengthMax: number; // mm (same as min for primes)
  maxApertureWide: number;
  maxApertureTele?: number;
  mount: string;
  /** Image circle actually projected by the lens. Falls back to a per-mount
   * heuristic when omitted. Set explicitly for crop lenses on full-frame
   * mounts (Sigma DC, Tamron Di III-A, Canon EF-S, Sony E APS-C). */
  imageCircle?: LensImageCircle;
  extenderFactors?: number[];
  type: 'zoom' | 'prime' | 'integrated';
  /** Anamorphotischer Squeeze-Faktor (2, 1.8, 1.5, 1.33). Fehlt/1 = sphaerisch.
   *  Schaltet im FOV-Modell die horizontale Entzerrung (siehe utils/fov.ts,
   *  Anamorphoten-Modus): der entzerrte Frame wird um diesen Faktor breiter. */
  squeeze?: number;
  isCustom?: boolean;
  notes?: string;
}

// ── Object type presets ──
export type StageObjectType =
  | 'person' | 'person-guitar' | 'sitting-person' | 'drums' | 'keys'
  | 'mic-stand' | 'chair' | 'table' | 'lectern' | 'schneetiger' | 'custom';

// ── Camera mount / support type (physical rig) ──
// Re-introduced from the older dev tree because each mount imposes a real
// height range and (for jib / dolly) a track length used by the live track
// slider. Without it Z is unconstrained, which is fine for typing but loses
// the "this rig physically can't go that high" check.
export type CameraMountType =
  | 'tripod' | 'hihat' | 'pedestal' | 'jib' | 'technocrane' | 'dolly' | 'slider'
  | 'cablecam' | 'drone' | 'scissorlift' | 'remotehead' | 'carmount' | 'rickshaw'
  | 'gimbal' | 'handheld' | 'steadicam' | 'fixed';

/**
 * Die Rig-Namen — in der QUELLSPRACHE des Repos, also englisch (E-28).
 *
 * Sie standen bis 2026-09-10 auf Deutsch, und kein Sprach-Waechter konnte das
 * finden: der Sprachmix-Zaehler liest JSX-Text, sichtbare Attribute und
 * Rueckfragen — nicht die Felder eines Modul-Objekts. Siebzehn Beschriftungen,
 * die an sechs Stellen der Oberflaeche erscheinen (Kamera-Liste, Rig-Auswahl,
 * Kopfzeile des Rig-Pults, Shotlist) und in keiner Messung vorkamen.
 *
 * Die deutsche Fassung liegt jetzt dort, wo jede andere Uebersetzung liegt:
 * im Woerterbuch, erreichbar ueber `mountTypeLabel(t, type)` aus
 * `src/i18n/mount.ts`. Wer hier ein Rig ergaenzt, traegt es dort in den
 * Schalter ein — TypeScript besteht darauf, weil der Schalter alle Faelle
 * abdecken muss.
 */
export const MOUNT_TYPE_LABELS: Record<CameraMountType, string> = {
  tripod: 'Tripod',
  hihat: 'Hi-hat / floor stand',
  pedestal: 'Studio pedestal',
  jib: 'Jib / crane',
  technocrane: 'Technocrane (telescoping)',
  dolly: 'Dolly (track)',
  slider: 'Slider',
  cablecam: 'Cable-cam / Spidercam',
  drone: 'Drone',
  scissorlift: 'Scissor lift',
  remotehead: 'Remote head',
  carmount: 'Car mount',
  rickshaw: 'Rickshaw / camera cart',
  gimbal: 'Gimbal',
  handheld: 'Handheld',
  steadicam: 'Steadicam',
  fixed: 'Fixed mount',
};

/**
 * Per-mount-type ergonomic ranges in metres. `pump` is the recommended single
 * height-slider step (column pump for pedestal, jib lift step, etc.). `track`
 * is the maximum live-motion travel along the rig (used by the dolly travel
 * and jib swing sliders); undefined for static rigs.
 */
export const MOUNT_HEIGHT_RANGE: Record<CameraMountType, { min: number; max: number; pump: number; track?: number }> = {
  tripod:    { min: 0.5, max: 2.2, pump: 0.05 },
  // Hi-Hat: Kamera fast auf dem Boden, kaum Hoehenspiel.
  hihat:     { min: 0.1, max: 0.5, pump: 0.05 },
  pedestal:  { min: 0.6, max: 1.8, pump: 0.4 },
  jib:       { min: 0.3, max: 6.0, pump: 1.5, track: 3.5 },
  // Techno 22 als gaengiger Vertreter: 24' (7.3 m) Objektivhoehe ueberschlaegig,
  // 15'6" (4.7 m) Teleskopweg. Der Arm faehrt teleskopierend ein/aus, statt nur
  // zu schwenken — darum deutlich mehr Track als ein klassischer Jib.
  technocrane: { min: 0.5, max: 7.3, pump: 1.5, track: 4.7 },
  dolly:     { min: 0.4, max: 1.9, pump: 0.1, track: 6.0 },
  // Slider: kurzer Weg, dafuer sehr feine Kontrolle.
  slider:    { min: 0.2, max: 2.0, pump: 0.05, track: 1.2 },
  // Cable-Cam haengt in Seilen — grosser Hoehenbereich, sehr weiter Weg.
  cablecam:  { min: 2.0, max: 40.0, pump: 2.0, track: 80.0 },
  drone:     { min: 0.5, max: 120.0, pump: 5.0, track: 100.0 },
  scissorlift: { min: 1.2, max: 12.0, pump: 1.0 },
  // Remote-Head sitzt auf einem anderen Rig; eigener Hoehenbereich bleibt klein.
  remotehead: { min: 0.3, max: 3.0, pump: 0.2 },
  carmount:  { min: 0.3, max: 2.5, pump: 0.2, track: 50.0 },
  rickshaw:  { min: 0.8, max: 2.0, pump: 0.2, track: 30.0 },
  gimbal:    { min: 0.8, max: 1.9, pump: 0.6 },
  handheld:  { min: 1.0, max: 1.9, pump: 0.8 },
  steadicam: { min: 0.3, max: 2.0, pump: 0.5 },
  fixed:     { min: 0.0, max: 12.0, pump: 0.0 },
};


// ── Venue wall ──
// `pattern` controls the wall surface texture in the camera preview so an
// operator can judge focus/blur against a known motif (issue #45).
export type WallPattern = 'solid' | 'grid' | 'flowers' | 'image';

export interface Wall {
  id: string;
  x1: number; y1: number; // start point in metres
  x2: number; y2: number; // end point in metres
  height: number; // metres
  label: string;
  /** Base surface colour (hex). Falls back to a neutral grey when unset. */
  color?: string;
  /** Surface pattern for blur-checking in the preview. Defaults to 'solid'. */
  pattern?: WallPattern;
  /** Data URL of a custom image, tiled across the wall when pattern === 'image'. */
  patternImage?: string;
  /**
   * Wie das Muster auf die Wand gelegt wird (#74). Ohne Angabe: gekachelt.
   * Frueher wurde das Muster im Bildschirmraum gemalt — dadurch aenderte sich
   * die Anzahl mit dem Zoom und ein Bild klebte am Bildschirm statt an der
   * Wand ("die Wand ist ein Loch fuer das Bild dahinter").
   */
  patternFit?: WallFit;
  /**
   * Wiederholungen ueber die WANDHOEHE (#74) — "wie viele Blumen in der Hoehe".
   * Die Anzahl in der Breite ergibt sich daraus, damit Kacheln nicht verzerren.
   * Gilt fuer `tile`; bei den anderen Modi bestimmt sie die Wiederholung
   * quer zur skalierten Achse. Default: 6.
   */
  patternRows?: number;
}

/**
 * Auflegen des Musters auf die Wandflaeche (#74):
 *   tile     — feste Anzahl Kacheln, Seitenverhaeltnis bleibt erhalten
 *   scale-v  — Bildhoehe = Wandhoehe, waagerecht wiederholt
 *   scale-h  — Bildbreite = Wandlaenge, senkrecht wiederholt
 *   stretch  — ein Bild ueber die ganze Wand, Seitenverhaeltnis egal
 */
export type WallFit = 'tile' | 'scale-v' | 'scale-h' | 'stretch';

// ── Reference person / object in venue ──
export interface ReferencePerson {
  id: string;
  x: number; // metres from left
  y: number; // metres from top
  height: number; // metres
  width: number; // metres (footprint width)
  label: string;
  objectType: StageObjectType;
  /** Optional custom accent colour (hex). Falls back to type default. */
  color?: string;
  /** When true, the object can't be dragged in the 2D/3D plan. */
  locked?: boolean;
}

// ── Background floor plan ──
export interface BackgroundPlan {
  dataUrl: string;
  scaleX: number; // metres per image pixel (horizontal)
  scaleY: number; // metres per image pixel (vertical)
  offsetX: number; // metres
  offsetY: number; // metres
  opacity: number; // 0-1
  widthPx: number;
  heightPx: number;
}

// ── Placed camera in the venue ──
/**
 * Wie der Operator an die Position kommt (Bedarf 59).
 *
 * `unstated` ist ein WERT und keine Luecke — dieselbe Regel wie bei der
 * Archiv-Frage im Cable-Planner: „niemand hat es gesagt" ist etwas anderes als
 * „ebenerdig". Ein Vorgabewert `none` liesse eine Position, an der eine Leiter
 * gebraucht wird, wie eine harmlose aussehen.
 */
export type RiggingAccess = 'ladder' | 'stairs' | 'ramp' | 'level' | 'unstated';

export interface RiggingSpec {
  /** Podest/Praktikabel im Klartext („4×4 ft Intellistage"). */
  riser?: string;
  /** Hoehe der Standflaeche in Metern. */
  riserHeightM?: number;
  /**
   * Traglast in kg, WIE SIE AUF DEM DATENBLATT STEHT.
   *
   * Wird nicht gerechnet und nicht geschaetzt. Podeste sind Standard-Mietware
   * mit veroeffentlichten Werten (Intellistage, Proaim); wer keinen hat, hat
   * keinen — und dann steht das da.
   */
  loadLimitKg?: number;
  access?: RiggingAccess;
  /** Welcher Stromkreis/welche Dose die Position versorgt. */
  powerDrop?: string;
  notes?: string;
}

/** Comms an einer Kameraposition (Bedarf 60). */
export interface PositionComms {
  /** Der Kanal, auf dem diese Position hoert. */
  channel?: string;
  /** Die Kennung des Beltpacks — damit zwei Positionen nicht dasselbe fordern. */
  beltpackId?: string;
  /** Antennenzone/Funkzelle, in der die Position liegt. */
  antennaZone?: string;
  /**
   * Der Akku-Plan.
   *
   * Steht hier, weil der Beleg ihn ausdruecklich nennt: der Operator „cannot
   * leave a tripod to change a beltpack battery". Eine Position, an der
   * niemand waehrend der Show weg kann, braucht einen anderen Plan als eine
   * am Gang — und dieser Unterschied ist eine Planungsentscheidung, keine
   * Messung.
   */
  batteryPlan?: string;
}

/**
 * Bedarf 48 — wie eine Kameraposition ferngesteuert wird.
 *
 * Die Kennungen sind 1:1 die `ConnectionMode` aus `sony-camera-bridge`
 * (`packages/web-rcp/src/types.ts`), plus `none`. Sie hier umzubenennen waere
 * bequem und der Anfang einer zweiten Wahrheit — der Paritaets-Guard der
 * Suite haelt beide Listen gegeneinander.
 *
 * `none` ist eine ENTSCHEIDUNG („von Hand am Body"), das Fehlen des Feldes
 * ist keine: eine Position ohne Eintrag ist eine ungestellte Frage, und genau
 * die wird sonst in der Probe beantwortet.
 */
export type ControlPath =
  | 'tcp' | 'serial' | 'lumix-http' | 'sony-usb' | 'blackmagic' | 'sony-mnc'
  | 'canon-ccapi' | 'zcam' | 'panasonic-ptz' | 'visca' | 'visca-serial'
  | 'jvc' | 'birddog'
  // Gimbals. Sie tragen eine Kamera, sie sind keine: vom Pult aus bewegen
  // sie den Kopf und stellen NICHTS am Bild. Sie stehen hier trotzdem,
  // weil man sie aufbaut und also plant -- anders als `demo`, das es in
  // einem echten Aufbau nicht gibt.
  | 'dji-osmo' | 'dji-ronin'
  | 'none';

export interface VenueCamera {
  id: string;
  label: string; // CAM 1, CAM 2 …
  cameraId: string;
  lensId: string;
  x: number; // metres from left
  y: number; // metres from top (2D)
  z: number; // height in metres
  pan: number; // degrees, 0 = pointing right (horizontal rotation)
  tilt: number; // degrees, 0 = level, negative = looking down
  focalLength: number; // current focal length in mm
  aperture: number; // current f-stop
  focusDistance: number; // metres
  color: string;
  extenderActive: number; // 1 = none, 1.5, 2
  useSpeedbooster?: boolean; // opt-in focal reducer (EF/NF → MFT/FZ/E/X), see SPEED_BOOSTERS
  /**
   * Index into `Camera.sensorModes` selecting a hardware crop mode. Undefined or
   * out-of-range falls back to the camera's default sensor.
   */
  sensorModeIndex?: number;
  /**
   * Currently mounted lens mount on a swappable-mount body (e.g. URSA Broadcast
   * G2 can swap between B4 / EF / PL mount plates). Defaults to the camera's
   * native `mount` when undefined. Must be either `camera.mount` or one of
   * `camera.adaptedMounts`.
   */
  activeMount?: string;
  /**
   * Physical rig the camera is mounted on. Determines the Z (height) slider
   * range via `MOUNT_HEIGHT_RANGE` and whether the live track slider is shown
   * (jib swing, dolly travel).
   */
  mountType?: CameraMountType;
  /**
   * Konkretes Rig aus dem Katalog (`data/rigs.ts`) — z. B. ein 18-ft-Jimmy-Jib
   * statt nur "Jib". Setzt Hoehenbereich und Fahrweg auf die echten Maße des
   * Geraets. Ohne Angabe gelten die Kategorie-Defaults aus MOUNT_HEIGHT_RANGE.
   */
  rigId?: string;
  /**
   * Gelegte Schienenlaenge in Metern (Dolly/Slider). Ueberschreibt den Vorschlag
   * des Rigs — die Strecke wird aus Sektionen (4/8/10 ft) gelegt und ist damit
   * pro Aufbau anders lang.
   */
  trackLengthM?: number;
  /**
   * Bedarf 59 — was an dieser Position gebaut werden muss.
   *
   *   > Riser/platform, height, load rating, ladder access and power are
   *   > agreed verbally or in a separate staging order; THE CAMERA OP FINDS
   *   > OUT ON SITE.
   *
   * Alle Felder optional und KEINES mit Vorgabewert: eine Traglast, die die
   * Anwendung sich ausgedacht hat, steht auf einem Blatt, nach dem sich jemand
   * auf ein Podest stellt. „Nicht angegeben" ist die einzige ehrliche Antwort,
   * solange niemand nachgesehen hat — und die Kamerakarte sagt sie laut.
   */
  rigging?: RiggingSpec;
  /**
   * Bedarf 60 — Comms an dieser Position.
   *
   *   > Channel assignment is verbal; operators get lost on the wrong channel,
   *   > hit dead zones at far positions, and cannot leave a tripod to change a
   *   > beltpack battery.
   */
  comms?: PositionComms;
  /**
   * Bedarf 61 — was ausser Body und Optik an dieser Position steht.
   *
   * Eine Liste im Klartext, keine Artikelnummern: der Bedarf will, dass die
   * Liste nicht ZWEIMAL getippt wird — nicht, dass dieser Planer einen
   * Mietkatalog fuehrt. Die Zeilen wandern in den Kamerakarten-Ausdruck und in
   * die `.avplan`, aus der der Cable-Planner die Bedarfsliste baut.
   */
  kit?: string[];
  /**
   * Preview drag-direction overrides. Persisted per camera so an operator with
   * a preferred swing direction keeps it across sessions.
   * `invertPreviewH` flips the pan direction, `invertPreviewV` flips tilt.
   */
  invertPreviewH?: boolean;
  invertPreviewV?: boolean;
  /**
   * Focus lock: when set, the preview keeps the focus distance pinned to the
   * named ReferencePerson. Re-pans and re-tilts but the distance follows the
   * subject automatically.
   */
  lockedPersonId?: string;
  /**
   * Distance lock: when set, the camera holds this exact subject distance while
   * dollying — moving the camera adjusts pan/tilt to keep the same target in
   * focus. Independent of `lockedPersonId` (a fixed distance, not a fixed
   * subject).
   */
  lockedDistance?: number;
  /**
   * Live-motion offset for jib swing or dolly travel (metres along the rig's
   * `track`). 0 = parked, positive = travelled. Renders as a coloured arc /
   * line in the 2D plan so the operator can see the swept area.
   */
  trackOffset?: number;
  /**
   * Ausrichtung des Rigs im Raum (Grad, gleiche Konvention wie `pan`).
   * Eine gelegte Schiene, ein Kran-Chassis oder die Beinstellung eines Stativs
   * bleiben stehen, waehrend die Kamera darauf schwenkt — darum ist das ein
   * eigener Winkel und kein Offset auf `pan`.
   *
   * Ohne Angabe folgt das Rig dem Pan der Kamera (Verhalten vor #71 und
   * sinnvoller Default: Stativ wird eben so hingestellt, wie man schaut).
   * `rigYaw()` in `utils/camera.ts` loest das auf; der Fahrweg laeuft immer
   * entlang dieser Achse, nicht entlang der Blickrichtung.
   */
  rigRotation?: number;
  /**
   * Free-form notes for this camera placement (mount, operator, instructions,
   * shot list, etc.). Shown in the sidebar and included in PNG exports when set.
   */
  notes?: string;
  /** When true, the camera marker can't be dragged in the 2D plan. */
  locked?: boolean;
  /**
   * BEDARF 130 — woran diese Kamera im Netz wiederzuerkennen ist.
   *
   *   > After a NIC outage and an OBS restart, NDI ports were reshuffled and
   *   > receivers displayed incorrect scene labels — the label says one
   *   > camera, the picture is another, so a shading correction lands on the
   *   > WRONG camera.
   *
   * Beleg: `zbynekdrlik/camera-box#1180` (August 2026, im eigenen Tracker
   * eines Live-Produktions-Teams als P0).
   *
   * Der PLAN ist die Autoritaet: hier steht, wie die Quelle heisst, und der
   * Abgleich (`utils/sourceIdentity.ts`) haelt das gegen das, was im Netz
   * wirklich da ist. Optional und ohne Vorgabewert — eine erfundene
   * Geraete-Kennung waere schlimmer als keine: sie saehe aus wie ein Beweis.
   */
  source?: SourceIdentity;
  /**
   * BEDARF 130 — an welcher Stelle der Quellenliste sie beim letzten Mal
   * stand.
   *
   * KEINE Identitaet. Sie steht hier nur, damit ein Positions-Treffer
   * ueberhaupt benannt werden kann — und der Abgleich macht ihn nie gruen:
   * genau diese Zuordnung wurde im Beleg vertauscht.
   */
  lastSourceIndex?: number;
  /**
   * Bedarf 14 -- die Presets einer PTZ-Kamera als PROJEKT-Dokumentation.
   *
   * Heute leben sie ausschliesslich im Geraetespeicher: eine Nummer, sonst
   * nichts. Wer die Nummer nicht auswendig weiss, weiss nicht, welchen Shot
   * sie liefert -- und wenn jemand die Kamera anfasst und das Preset nicht
   * ueberschreibt, ist der abgerufene Shot live falsch, ohne Operator, der
   * ihn rettet.
   */
  presets?: PtzPreset[];
  /**
   * Bedarf 58 — welchen Ausschnitt diese Position liefern MUSS.
   *
   *   > Lens choice per position is guessed from experience or checked ad hoc
   *   > with an online focal-length calculator; the wrong glass shows up on
   *   > the truck.
   *
   * Ohne diesen Auftrag ist die Frage „reicht die Optik?" nicht gestellt und
   * damit auch nicht beantwortbar: `focalLength` ist der AKTUELLE Zustand des
   * Reglers und keine Anforderung — gegen ihn geprueft waere jede Optik immer
   * ausreichend, weil der Regler ihre Grenzen gar nicht verlassen kann.
   *
   * Deshalb optional und ohne Vorgabewert. `utils/lensReach.ts` rechnet.
   */
  coverage?: CoverageAssignment;
  /**
   * Bedarf 50 — was an dieser Position waehrend der Show kaputtgegangen ist.
   *
   *   > Show-time changes are verbal and invisible to every document.
   *
   * Freie Zeilen, wie `kit`: die naechste Schicht braucht den Satz, nicht
   * eine Kennung. Getrennt von `notes`, weil eine Notiz etwas anderes ist
   * als ein Fehler — eine Liste, in der beides steht, wird von niemandem
   * mehr als Fehlerliste gelesen.
   */
  faults?: string[];
  /**
   * Bedarf 63 — der Bildzustand dieser Position.
   *
   *   > Shading is done live by the vision engineer with the operator; the
   *   > resulting scene file lives on a card or in device memory with NO
   *   > RECORD OF WHICH POSITION OR SHOW IT BELONGS TO.
   *
   * „Zur Show gehoerig" ist hier keine eigene Zuordnung — die Projektdatei
   * IST die Show. Was fehlte, ist die Bindung an die POSITION.
   *
   * Optional und ohne Vorgabewert: ein erfundener Dateiname stuende auf
   * einem Blatt, nach dem jemand am zweiten Showtag sucht.
   */
  paint?: PaintState;
  /**
   * Bedarf 48 — der geplante Fernsteuerweg dieser Position.
   *
   *   > The exposed paint set differs per protocol ... flag at plan time
   *   > which positions cannot do remote colour temperature / black balance,
   *   > instead of discovering it in rehearsal.
   *
   * Optional und ohne Vorgabewert. Ein angenommener Weg stuende auf einem
   * Blatt als Zusicherung, dass diese Position vom Pult aus schattierbar ist
   * — und das ist der Satz, den der Bedarf abschaffen will.
   */
  controlPath?: ControlPath;
  /**
   * Bedarf 47 — welche Positionen gleich aussehen MUESSEN.
   *
   *   > Synchronize settings across multiple cameras for uniform color
   *   > grading.  (companion-module-requests#1792, 25. Feb 2025)
   *
   * Ein freier Name („Buehne", „Publikum"), keine Kennung: Gruppen sind eine
   * Absicht des Bildtechnikers und keine Eigenschaft der Anlage. Abgleichen
   * laesst sich eine Gruppe nur ueber das, was JEDES ihrer Mitglieder
   * fernsteuern kann — das rechnet `paintRegistry` gegen die Tabelle aus
   * Bedarf 48 und meldet, wer herausfaellt.
   */
  matchGroup?: string;
}

/**
 * Der Bildzustand einer Position (Bedarf 63).
 *
 * Die vier Felder sind genau die, die der Bedarf nennt: Dateiname, Datum,
 * Urheber, Referenzbedingungen. `savedWith` kommt dazu, weil sonst niemand
 * sagen kann, ob die Datei ueberhaupt noch passt — dieselbe Ueberlegung wie
 * bei `PtzPreset`: ein Verweis auf den AKTUELLEN Zustand koennte den Fall
 * per Konstruktion nicht bemerken.
 */
export interface PaintState {
  /** Dateiname der Szenendatei auf Karte oder Pult. */
  sceneFile?: string;
  /** Wann sie gesetzt wurde. Als Text, wie er im Plan steht — keine Uhr. */
  setAt?: string;
  /** Wer sie gesetzt hat. Bei einer Abweichung ist das der Fragbare. */
  setBy?: string;
  /** Referenzbedingungen im Klartext (Graukarte, Farbtemperatur, Licht). */
  reference?: string;
  /**
   * Bedarf 50 — welches Bedienfeld diese Position schattiert.
   *
   * Der Bedarf nennt die Zuordnung Kamera → Panel als eines der drei Dinge,
   * die heute nirgends stehen. Klartext („RCP 3, Seite 2"), keine Kennung:
   * dieser Planer fuehrt keine Pult-Belegung, und eine erfundene Nummerierung
   * waere eine zweite Wahrheit neben der auf dem Pult.
   */
  panel?: string;
  /**
   * Bedarf 47 — WO der Zustand liegt, wenn er keinen Dateinamen hat.
   *
   *   > Device-side storage is five unnamed slots on an SD card in an Arduino
   *   > box; on vendor CCUs the scene file has no show/venue/lighting-state
   *   > identity.
   *
   * Klartext („SD-Platz 3", „Scene File 05", „RCP-Speicher 2"), keine
   * Nummerierung: welche Plaetze es gibt, weiss das Geraet, und eine hier
   * erfundene Zaehlung waere eine zweite Wahrheit neben der auf dem Pult.
   * Ein Zustand OHNE Datei und OHNE Platz ist nicht wiederfindbar — und
   * genau das meldet `paintRegistry`.
   */
  slot?: string;
  /**
   * Bedarf 47 — auf WELCHEM Body er gesetzt wurde.
   *
   * `savedWith.cameraId` ist das MODELL. Stehen zwei gleiche Bodies in der
   * Show, sagt es nicht, welcher es war — und eine Szenendatei traegt die
   * Eigenheiten genau eines Sensors. Freitext, weil dieser Planer kein
   * Serien-Register fuehrt; die Nummer steht auf dem Geraet.
   */
  bodySerial?: string;
  /** Womit sie abgeglichen wurde. Ohne das ist „passt noch" unbeantwortbar. */
  savedWith?: PaintContext;
  notes?: string;
}

export interface PaintContext {
  /** `Camera.id` des Bodys — eine Szenendatei ist Herstellerformat. */
  cameraId?: string;
  /** `Lens.id` des Objektivs, mit dem abgeglichen wurde. */
  lensId?: string;
  /** Sensor-Modus zum Zeitpunkt des Abgleichs. */
  sensorModeIndex?: number;
}

/** Auf welcher Achse gemessen wird. */
export type ReachAxis = 'width' | 'height';

/**
 * Die Einstellungsgroessen (Bedarf 58).
 *
 * `footprint` ist der Fall aus dem Beleg — „10 ft of stage from about 100 ft":
 * die volle Breite eines Motivs, nicht seine Hoehe. `custom` traegt ein
 * eigenes Mass, damit die Konvention hinter den uebrigen Stufen ueberstimmbar
 * bleibt statt geglaubt werden zu muessen.
 */
export type FramingName = 'wide' | 'full' | 'medium' | 'close' | 'detail' | 'footprint' | 'custom';

export interface CoverageAssignment {
  /** `ReferencePerson.id` — das Motiv, das diese Position liefern muss. */
  subjectId: string;
  framing: FramingName;
  /** Nur bei `framing: 'custom'`: das geforderte Mass in Metern. */
  extentM?: number;
  /** Nur bei `framing: 'custom'`: auf welcher Achse. Sonst sagt es die Stufe. */
  axis?: ReachAxis;
}

/**
 * Ein gespeichertes PTZ-Preset -- Nummer, benannter Shot, und der Zustand
 * ZUM ZEITPUNKT DES SPEICHERNS.
 *
 * Warum der Zustand mitgeschrieben wird und nicht auf die Kamera verweist:
 *
 *   > A common cause of preset trouble is adjusting the camera's position or
 *   > focus after saving it and then forgetting to overwrite that preset.
 *
 * Ein Preset, das auf die AKTUELLEN Werte der Kamera zeigt, koennte diesen
 * Fall gar nicht bemerken -- es waere per Konstruktion immer aktuell und
 * damit als Dokument wertlos. Nur weil hier steht, wie es beim Speichern
 * aussah, laesst sich sagen, dass es seither nicht mehr stimmt.
 */
export interface PtzPreset {
  /** Preset-Nummer im Geraet. Sie ist der Griff, den jemand am Pult tippt. */
  number: number;
  /** Der benannte Shot -- „Weit Buehne", „Pult", „Publikum links". Das ist
   *  der eigentliche Inhalt dieses Bedarfs: aus einer Nummer wird eine
   *  Auskunft. */
  name: string;
  /** Welches Segment des Ablaufs er bedient (Begruessung, Predigt, Band …).
   *  Optional -- nicht jeder Shot gehoert zu genau einem Segment. */
  segment?: string;
  /** Schwenk in Grad, gleiche Konvention wie `VenueCamera.pan`. */
  pan: number;
  /** Neigung in Grad, gleiche Konvention wie `VenueCamera.tilt`. */
  tilt: number;
  /** Brennweite in mm zum Zeitpunkt des Speicherns. */
  focalLength: number;
  /** Fokusentfernung in Metern zum Zeitpunkt des Speicherns. */
  focusDistance: number;
  /** ISO-Zeitstempel des Speicherns. */
  savedAt: string;
  /**
   * Wo die Kamera STAND, als das Preset gespeichert wurde.
   *
   * Pan und Tilt sind Winkel des Kamerakoerpers. Wird der Koerper versetzt,
   * zeigt derselbe Winkel woanders hin -- jedes Preset der Kamera ist damit
   * ueberholt, ohne dass sich am Preset etwas geaendert haette. Genau das ist
   * der „nudge" aus dem Befund, und nur mit dieser Angabe faellt er auf.
   */
  savedAtPosition: { x: number; y: number; z: number };
}

// ── Stage / target zone ──
export interface Stage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  /** When true, the stage can't be dragged or resized in the 2D plan. */
  locked?: boolean;
  /**
   * Podesthoehe ueber dem Boden (m) — macht aus der Flaeche einen Koerper
   * (#73). `width`/`height` sind die Grundflaeche, deshalb der eigene Name.
   * Ohne Angabe: flach (0.1 m Andeutung wie bisher).
   */
  elevationM?: number;
  /** Farbe des Podests (Hex). Ohne Angabe das bisherige Blau. */
  color?: string;
  /** Deckkraft 0..1. Ohne Angabe 0.4 wie bisher. */
  opacity?: number;
}

// ── Venue ──
export interface Venue {
  name: string;
  widthM: number;
  heightM: number; // depth
  stages: Stage[];
}

// ── Template ──
export interface VenueTemplate {
  id: string;
  name: string;
  category: 'sport' | 'concert' | 'church' | 'conference' | 'custom';
  venue: Venue;
  cameras: Omit<VenueCamera, 'id'>[];
}

// ── FOV result ──
export interface FovResult {
  horizontalDeg: number;
  verticalDeg: number;
  diagonalDeg: number;
  imageWidthAtDistance: number; // metres
  imageHeightAtDistance: number;
  equivalentFocalLength: number;
  /** Angewandter Anamorphoten-Squeeze (1 = sphaerisch). Horizontale FOV, Diagonale
   *  und `imageWidthAtDistance` sind bereits entzerrt; vertikal bleibt es F. */
  squeeze: number;
}

// ── DoF result ──
export interface DofResult {
  nearLimit: number;
  farLimit: number;
  totalDof: number;
  hyperfocal: number;
  circleOfConfusion: number;
}

// ── Tab views ──
export type ViewTab = '2d' | '3d' | 'preview' | 'calculator' | 'shotlist';

// ── Shotlist / Storyboard (#62 Punkt 5) ──
// Ein Preset ist ein einzelner Kamera-Zustand; ein Shot ist derselbe Zustand,
// aber benannt, bebildert (Framegrab) und Teil einer geordneten Sequenz. Die
// Shotlist faehrt die Shots der Reihe nach an — mit derselben Transition-Engine
// wie die Presets (#62 Punkt 4) — und laesst sich als Storyboard exportieren.

/** Eingefrorener Kamera-Zustand eines Shots (die Preset-Parameter aus Punkt 3). */
export interface ShotState {
  x: number;
  y: number;
  z: number;
  pan: number;
  tilt: number;
  focalLength: number;
  aperture: number;
  focusDistance: number;
  trackOffset: number;
}

/** Wie ein Shot angefahren wird. `off` springt hart. */
export type ShotTransition = 'off' | 'fast' | 'slow' | 'manual';

export interface Shot {
  id: string;
  /** Freier Name, z. B. "WS Buehne", "CU Saenger". */
  name: string;
  /** Auf welche VenueCamera sich der Shot bezieht (`VenueCamera.id`). */
  cameraId: string;
  state: ShotState;
  transition: ShotTransition;
  /** Nur bei `transition === 'manual'` relevant. */
  transitionSeconds?: number;
  /**
   * Bewegungsstil beim Anfahren. Ohne Angabe gilt der Stil der Montage, auf der
   * die Kamera steht (`VenueCamera.mountType`) — das ist der Normalfall. Explizit
   * gesetzt laesst sich ein Shot abweichend fahren, z. B. eine Stativ-Kamera
   * bewusst „wie ein Dolly" traege anlaufen lassen.
   */
  motionStyle?: CameraMountType;
  /** Framegrab als data-URL. Klein gehalten (JPEG), damit localStorage reicht. */
  thumbnail?: string;
  /** Regie-/Kamera-Notiz. */
  note?: string;
}

export interface Shotlist {
  id: string;
  name: string;
  shots: Shot[];
}

// ── Aufgezeichnete Rig-Fahrt ("Take") ──
// Ein Shot ist EIN Zustand und wird angefahren; ein Take ist die ganze
// Bewegung, so wie sie am Pult gefahren wurde — inklusive Zoegern,
// Nachfuehren und gleichzeitiger Achsen. Damit lassen sich Fahrten
// wiedergeben, statt sie nur zwischen zwei Punkten zu interpolieren.

/** Ein abgetasteter Moment der Fahrt. `t` = Sekunden seit Aufnahmebeginn. */
export interface TakeSample {
  t: number;
  state: ShotState;
  /** Ausrichtung des Rigs zu diesem Zeitpunkt (nur wenn eigenstaendig). */
  rigRotation?: number;
}

export interface RigTake {
  id: string;
  name: string;
  /** Kamera, mit der aufgezeichnet wurde (`VenueCamera.id`). */
  cameraId: string;
  /** Montage zum Aufnahmezeitpunkt — fuer die Anzeige, nicht fuer Wiedergabe. */
  mountType?: CameraMountType;
  samples: TakeSample[];
  createdAt: number;
}

// ── Edit mode (issue #43) ──
// A top-bar slider restricts editing to one category at a time so a plan can be
// built up step by step. `all` respects each object's own lock flag instead.
export type EditMode = 'all' | 'floorplan' | 'stage' | 'objects' | 'cameras';

// ── Saved project ──
export interface ProjectFile {
  formatVersion: 1;
  appVersion: string;
  projectVersion: number; // auto-incremented on changes
  savedAt: string; // ISO date
  venue: Venue;
  cameras: VenueCamera[];
  persons: ReferencePerson[];
  backgroundPlan: BackgroundPlan | null;
  walls?: Wall[];
  /**
   * ADR-005 — Fremde .avplan-Domaenen (lighting/cabling), die MultiCam nicht
   * bearbeitet. Sie gehoeren in die Projektdatei, nicht nur in den Store:
   * lagen sie nur im Speicher, war jedes Speichern-und-neu-Oeffnen zwischen
   * Import und Export ein vollstaendiger Verlust des Licht- und Kabelplans.
   * Opak durchgereicht, nie interpretiert.
   */
  avForeign?: {
    lighting?: unknown;
    cabling?: unknown;
    /** Slots, die das FORMAT nicht benennt — unveraendert mitgefuehrt, damit
     *  sie nicht in jeder Richtung still verlorengehen (ADR-005). */
    unknownDomains?: Record<string, unknown>;
  };
  // Die vier Fremdfeld-Faecher aus MultiCams `.mcplan` — `stageForeign`,
  // `floorPlanForeign`, `wallForeign`, `personForeign` — stehen hier NICHT.
  //
  // Sie beschreiben Felder des MultiCam-Raummodells, das dieses Repo nicht
  // fuehrt, und ihre Typen kamen aus `../utils/venueExchange`: einer Datei,
  // die beim Uebernehmen der Optik-Logik (a49aad8) nicht mitkam. Vier
  // tsc-Fehler auf main waren die Folge — und damit JEDER Pull Request rot,
  // gleich woran er arbeitete.
  //
  // Die Datei nachzuvendorieren waere der falsche Ausweg gewesen:
  // `ProjectFile` ist die Form des MultiCam-Projektfiles und wird hier von
  // nichts gelesen. Das Fremdfeld-Fach mitzuschleppen hiesse, MultiCams
  // Raummodell in den Cable-Planner zu holen, damit ein ungenutzter Typ
  // vollstaendig aussieht. Wer das Fach hier wirklich braucht, braucht
  // vorher das Raummodell — und dann ist es eine Entscheidung und kein
  // Import.
  //
  // ADR-005 ist davon unberuehrt: `avForeign` oben ist das Fach, das dieses
  // Repo tatsaechlich fuehrt und ueber `lib/avplan.ts` auch wieder ausgibt.
}
