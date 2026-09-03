// ---------------------------------------------------------------------------
// ADR-005 Design-Frage 2 — Modell- oder Instanz-Eigenschaft?
//
// DIE FRAGE. Die Template-Rekonstruktion trug 22 der 97 Felder von
// `EquipmentItem` und liess 75 liegen. Der ADR nennt den Schaden: die
// Modell-Gruppe laeuft in Stuecklisten weiter, „eine falsche Zuordnung
// propagiert still falsche Preise".
//
// DIE ANTWORT DES EIGENTUEMERS: *„Alle Modell-Eigenschaften sollten in allen
// Plaenen immer den Geraeten zugeordnet sein — egal ob in der Anwendung
// abgefragt oder nicht."* Ein Template IST ein Geraetetyp (ADR-002), also
// gehoert jede Modell-Eigenschaft hinein, auch die, die keine Maske heute
// zeigt.
//
// DER WIDERSPRUCH, DEN DAS AUFGEDECKT HAT. Die Codebasis enthielt bereits das
// richtige Urteil — an einer anderen Stelle. `healRentmanLibraryFromProject`
// in `projectStore.ts` schreibt seit jeher:
//
//   „Bewusst NICHT uebernommen: ipAddress, macAddress, username, password,
//    gateway, vlans und die uebrige Netz-Identitaet. Die beiden anderen
//    Rekonstruktionen tragen sie, aber eine Library-Vorlage mit fest
//    eingebauter IP erzeugt beim zweiten Herausziehen einen Adresskonflikt."
//
// Genau dieselben Felder traegt `templateFromEquipment` mit. Zwei
// Rekonstruktionen desselben Programms, zwei entgegengesetzte Urteile.
//
// WAS DIESE DATEI TUT UND WAS NICHT. Sie klassifiziert alle 97 Felder und
// macht daraus die Liste, die die Rekonstruktion tragen MUSS. Sie entfernt
// NICHTS, was heute mitgeht: die Netz-Identitaet in Templates ist der
// Ausroll-Nutzen, den Design-Frage 5 ausdruecklich als echt bezeichnet und
// mit „beim Export fragen" beantwortet hat. Ihn hier nebenbei wegzunehmen
// waere dieselbe Sorte Nebenbei-Entscheidung, die der Kommentar oben
// zurueckgewiesen hat.
// ---------------------------------------------------------------------------

/** Gehoert dem Geraete-MODELL: bei jedem Exemplar dieses Typs gleich. */
export const MODEL_FIELDS = [
  // Identitaet des Typs
  'name',
  'shortName',
  'subtitle',
  'category',
  'deviceTypeId',
  'categoryProps',
  'libraryRef',
  'netboxPath',
  'manufacturerUrl',

  // Bestueckung
  'inputs',
  'outputs',
  'portsUnknown',
  'modes',

  // Rolle im Signalfluss — Eigenschaft des Geraets, nicht des Exemplars
  'isConverter',
  'isDistributionAmp',
  'isPatchPanel',
  'tallyRole',
  'tcRole',
  'embedderRole',
  'sdiCaps',
  'atemMvConfig',
  'atemMvCapabilitiesOverride',
  'atemAudioConfig',
  'resolution',
  'displaySizeInch',

  // Mechanik
  'isRackDevice',
  'isRackShelf',
  'rackUnits',
  'width',
  'height',
  'widthMm',
  'heightMm',
  'depthMm',
  'weightKg',

  // Strom
  'powerConsumptionWatts',
  'powerWatts',
  'voltage',
  'currentAmps',
  'powerPhase',

  // Preise — die Gruppe, die der ADR beim Namen nennt: sie laeuft in
  // Stuecklisten weiter, eine falsche Zuordnung propagiert still falsche Zahlen
  'priceEUR',
  'rentPricePerDay',
  'rentCurrency',

  // Darstellung des TYPS (nicht des Exemplars auf dem Canvas)
  'icon',
  'imageUrl',
  'frontPanelImageUrl',
  'rearPanelImageUrl',
  'frontPanelCrop',
  'rearPanelCrop',
  'stlDataUri',
] as const

/**
 * Gehoert diesem EINEN Exemplar. Ein Template, das solche Felder traegt,
 * erzeugt beim zweiten Herausziehen einen Konflikt — bei `ipAddress` einen
 * Adresskonflikt, bei `assetTag` zwei Geraete mit derselben Inventarnummer.
 */
export const INSTANCE_FIELDS = [
  'id',

  // Wo dieses Exemplar steht
  'x',
  'y',
  'rackInstanceId',
  'rackInstanceLabel',
  'rackInstanceStartUnit',
  'rackInternalSnapshot',

  // Wer dieses Exemplar ist
  'assetTag',
  'serialNumber',
  'qrId',
  'sourceIdentityId',
  'installStatus',
  'verifiedBy',

  // Lebenslauf dieses Exemplars
  'purchaseDate',
  'warrantyUntil',
  'maintenanceIntervalDays',
  'serviceHistory',
  'supplier',
  'ownership',
  'stockLocation',
  'packed',

  // Netz-Identitaet: pro Geraet einmalig. Steht heute trotzdem im Template —
  // siehe Kopf dieser Datei, das ist Design-Frage 5 und nicht diese hier.
  'ipAddress',
  'subnetMask',
  'macAddress',
  'gateway',
  'dnsServers',
  'vlans',
  'portVlans',
  'managementVlanId',
  'mgmtUrl',
  'firmware',
  'username',
  'password',

  // Zustand dieses Exemplars
  'activeModeId',
  'videohubRouting',
  'notes',

  // Herkunft dieses Exemplars
  'importSource',
  'graphmlId',
  'netboxId',
  'netboxSourceUrl',
  'rentmanId',
  'rentmanRemoved',

  // Oberflaechen-Zustand am Canvas
  'nodeColor',
  'portsFlipped',
  'collapsed',
  'hidden',
  'favorite',
  'positionLocked',
] as const

export type ModelField = (typeof MODEL_FIELDS)[number]

/**
 * Die Modell-Eigenschaften eines Geraets herausziehen.
 *
 * `undefined` bleibt `undefined` und wird nicht zu einem Schluessel: ein
 * Template mit `priceEUR: undefined` behauptet, der Preis sei bekannt und
 * leer. `mergeDefined`-Disziplin, hier auf die Rekonstruktion angewandt.
 */
export const pickModelFields = (item: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const field of MODEL_FIELDS) {
    if (item[field] !== undefined) out[field] = item[field]
  }
  return out
}
