import type { StateCreator } from 'zustand'
import type { CablePlannerProject } from '../../types/project'
import { touchProject } from '../projectStoreHelpers'
import { scheduleProjectAutosave } from '../projectAutosave'
import { applyNamingScheme } from '../../lib/namingScheme'
import { planFromGreengo, withVendorNumbers } from '../../lib/intercomPlan'
import type { ProjectState } from '../projectStore'

/**
 * #308 — MetaSlice. Kleine Setter ohne komplexes Cross-Domain-State:
 *  - File-State: setRecentProjects, setFilePath
 *  - Metadata: setProjectMeta (name+description), updateProjectMetadata
 *    (partieller Patch), setDefaultVideoFormat
 *  - Canvas-Viewport: setCanvasState (x/y/zoom — persistiert mit dem
 *    Projekt damit Reopen den Viewport restored)
 *  - Selection-State: setSelection, setSelectedTemplateName
 *  - Sonstiges: updateGreenGoConfig (eine eigene Slice waere overkill)
 *
 * Lock-Check fehlt absichtlich — Metadata-Felder duerfen auch im
 * Viewer-Modus angepasst werden (Project-Author bei Plan-Annahme,
 * RecentProjects-Liste sowieso).
 */
export type MetaSlice = Pick<
  ProjectState,
  | 'setRecentProjects'
  | 'setFilePath'
  | 'setProjectMeta'
  | 'updateProjectMetadata'
  | 'setDefaultVideoFormat'
  | 'setCanvasState'
  | 'setSelection'
  | 'setSelectedTemplateName'
  | 'updateGreenGoConfig'
  | 'updateIntercomPlan'
  | 'setDrumKit'
  | 'setWirelessRig'
  | 'setMulticastConfig'
  | 'setFallbackPlan'
  | 'setEventMetadata'
  | 'setHausAuskunft'
  | 'setTransmissionRecord'
  | 'setCostPlan'
  | 'setNamingScheme'
  | 'setRecordNaming'
  | 'setMicPlot'
  | 'setRundown'
  | 'setTallyPosition'
  | 'recordTallyCheck'
  | 'recordPatternCheck'
  | 'recordHubSwitch'
  | 'setNetworkSegments'
  | 'applyNaming'
>

export const createMetaSlice: StateCreator<ProjectState, [], [], MetaSlice> = (set) => ({
  setRecentProjects: (items) => set({ recentProjects: items }),
  setFilePath: (path) => set({ filePath: path }),
  setProjectMeta: (name, description) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          name,
          description,
        },
      }),
    })),
  updateProjectMetadata: (patch) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          ...patch,
        },
      }),
    })),
  setDefaultVideoFormat: (id) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          defaultVideoFormat: id as CablePlannerProject['metadata']['defaultVideoFormat'],
        },
      }),
    })),
  setCanvasState: (x, y, zoom) =>
    set((state) => ({
      project: {
        ...state.project,
        canvasState: { x, y, zoom },
      },
    })),
  setSelection: (equipmentId, cableId, locationId) =>
    set({
      selectedEquipmentId: equipmentId,
      selectedCableId: cableId,
      selectedLocationId: locationId,
      selectedTemplateName: undefined,
    }),
  setSelectedTemplateName: (name) =>
    set({
      selectedTemplateName: name,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
      selectedLocationId: undefined,
    }),
  /**
   * Green-GO hinein, SLOT heraus (E-2, Schritt 1).
   *
   * Der Name bleibt, weil die Aufrufer Green-GO sprechen: der Intercom-Dialog,
   * die Preset-Bibliothek und die Beltpack-Leiste arbeiten alle auf einer
   * `GreenGoConfig`. Was sich geaendert hat, ist das Ziel — geschrieben wird
   * der herstellerneutrale Slot, nicht mehr die Hersteller-Konfiguration.
   *
   * `planFromGreengo` schreibt die Anlagen-Nummern dabei fest, statt sie beim
   * naechsten Export neu zu vergeben (ADR-002).
   */
  updateGreenGoConfig: (config) =>
    set((state) => {
      const updated = { ...state.project, intercom: planFromGreengo(config) }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  /** Den Slot direkt setzen — fuer Aufrufer, die schon neutral denken. */
  updateIntercomPlan: (plan) =>
    set((state) => {
      const updated = { ...state.project, intercom: withVendorNumbers(plan) }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setDrumKit: (plan) =>
    set((state) => {
      const updated = { ...state.project, drumKit: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setWirelessRig: (plan) =>
    set((state) => {
      const updated = { ...state.project, wirelessRig: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 114 — der Mic-Plot (Personen, Sessions, Zuordnungen).
  //
  // Ein Setter fuer den ganzen Plan und keiner je Zuordnung: `carryForward`
  // liefert eine ganze Session auf einmal, und ein Einzel-Setter verfuehrte
  // dazu, sie in einer Schleife zu schreiben — jede Zwischenstufe waere ein
  // Zustand, in dem die Doppelbelegungs-Pruefung die eigenen frisch
  // uebernommenen Zeilen noch nicht kennt.
  setMicPlot: (plot) =>
    set((state) => {
      const updated = { ...state.project, micPlot: plot }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 10 — der gelesene Ablauf samt Zuordnung.
  //
  // EIN Setter fuer beides, Abschnitte UND Zuordnung, und das ist hier keine
  // Bequemlichkeit: eine Zuordnung zeigt auf einen Abschnitt. Zwei Setter
  // liessen den Zustand zu, in dem die neuen Abschnitte schon da sind und die
  // Zuordnung noch auf die alten zeigt — und `normaliseRundown` verwirft
  // Zuordnungen ins Leere, also waeren sie beim naechsten Laden still weg.
  setRundown: (rundown) =>
    set((state) => {
      const updated = { ...state.project, rundown }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 116 — die Segmente.
  //
  // EIN Setter fuer die ganze Liste und keiner je Segment: die Befunde
  // ("Medien und Steuerung im selben Segment", "Rolle passt nicht zum Zweck")
  // lesen ALLE Segmente gegeneinander. Ein Einzel-Setter verfuehrte dazu, in
  // einer Schleife zu schreiben, und jede Zwischenstufe waere ein Zustand, in
  // dem die Pruefung die eigenen frisch gesetzten Zwecke noch nicht kennt --
  // dieselbe Begruendung wie bei `setMulticastConfig` und `setMicPlot`.
  setNetworkSegments: (segments) =>
    set((state) => {
      const updated = { ...state.project, networkSegments: segments }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 105 — der Tally-Weg EINER Position.
  //
  // Hier ist der Einzel-Setter richtig, und zwar aus dem Gegenteil des
  // Grundes von oben: zwischen zwei Positionen gibt es keine Zusicherung, die
  // eine Zwischenstufe verletzen koennte. Jede Lampe haengt fuer sich.
  //
  // Abgelehnt wird, was auf keine Rolle zeigt: ein Datensatz ohne Rolle stuende
  // auf dem Vor-Show-Blatt wie eine gepruefte Position und zeigte ins Leere.
  setTallyPosition: (identityId, patch) => {
    let absage: 'unknown-role' | undefined
    set((state) => {
      const rollen = state.project.sourceIdentities ?? []
      if (!rollen.some((s) => s.id === identityId)) {
        absage = 'unknown-role'
        return {}
      }
      const bisher = state.project.tallyPositions ?? []
      const vorhanden = bisher.find((p) => p.identityId === identityId)
      const naechste = vorhanden
        ? bisher.map((p) => (p.identityId === identityId ? { ...p, ...patch } : p))
        : [...bisher, { identityId, transport: 'unknown' as const, ...patch }]
      const updated = { ...state.project, tallyPositions: naechste }
      scheduleProjectAutosave(updated)
      return { project: updated }
    })
    return absage
  },
  // BEDARF 105 — die Sichtpruefung wird ANGEHAENGT, nie ersetzt.
  //
  // „Gestern ging es, heute nicht" ist die Auskunft, die den Fehler findet,
  // und sie geht verloren, wenn jede Pruefung die vorige ueberschreibt. Der
  // Zeitpunkt kommt fertig herein — der Store nimmt keine Uhr, sonst
  // stempelte dieselbe Beobachtung bei jedem Aufruf anders.
  recordTallyCheck: (identityId, check) => {
    let absage: 'unknown-role' | undefined
    set((state) => {
      const rollen = state.project.sourceIdentities ?? []
      if (!rollen.some((s) => s.id === identityId)) {
        absage = 'unknown-role'
        return {}
      }
      const bisher = state.project.tallyPositions ?? []
      const vorhanden = bisher.find((p) => p.identityId === identityId)
      const naechste = vorhanden
        ? bisher.map((p) =>
            p.identityId === identityId ? { ...p, checks: [check, ...(p.checks ?? [])] } : p,
          )
        : [...bisher, { identityId, transport: 'unknown' as const, checks: [check] }]
      const updated = { ...state.project, tallyPositions: naechste }
      scheduleProjectAutosave(updated)
      return { project: updated }
    })
    return absage
  },
  // B-42 — die Sichtpruefung vom Pruefbild-Rundgang, ebenfalls ANGEHAENGT.
  //
  // Dieselbe Regel wie bei `recordTallyCheck` und aus demselben Grund: eine
  // Pruefung, die die vorige ueberschreibt, loescht die Auskunft „gestern
  // ging es, heute nicht". Der Zeitpunkt kommt fertig herein.
  //
  // Abgelehnt wird, was auf ein Geraet zeigt, das es nicht (mehr) gibt: ein
  // solcher Datensatz stuende im Abnahme-Blatt als gepruefter Ankunftsort
  // und zeigte ins Leere. Die QUELLE wird mitgeprueft, aus demselben Grund —
  // ohne sie ist nicht mehr feststellbar, welches Bild erwartet wurde.
  recordPatternCheck: (check) => {
    let absage: 'unknown-equipment' | undefined
    set((state) => {
      const ids = new Set(state.project.equipment.map((e) => e.id))
      if (!ids.has(check.equipmentId) || !ids.has(check.quelleId)) {
        absage = 'unknown-equipment'
        return {}
      }
      const updated = {
        ...state.project,
        patternChecks: [check, ...(state.project.patternChecks ?? [])],
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    })
    return absage
  },
  // B-42 Inkrement 3 — der EINGRIFF an der Kreuzschiene, ebenfalls ANGEHAENGT.
  //
  // Auch der ABGELEHNTE Befehl wird aufgezeichnet. Was dieser Datensatz
  // beantwortet, ist „wer hat geschaltet?" — und ein Versuch, der am
  // Netzwerk scheiterte, ist Teil dieser Auskunft; er sagt, dass jemand die
  // Absicht hatte und dass der Hub in dem Moment nicht erreichbar war.
  //
  // Was hier ABSICHTLICH NICHT passiert: `videohubRouting.planned` wird
  // nicht nachgezogen. Der Plan ist die Absicht, der Hub ein Zustand; zoege
  // das Senden den Plan mit, gaebe es hinterher keine Abweichung mehr zu
  // sehen — und die Abweichung ist der einzige Grund, warum der Plan neben
  // der Anlage steht (ADR-001).
  recordHubSwitch: (eintrag) => {
    let absage: 'unknown-equipment' | undefined
    set((state) => {
      const ids = new Set(state.project.equipment.map((e) => e.id))
      if (!ids.has(eintrag.equipmentId)) {
        absage = 'unknown-equipment'
        return {}
      }
      const updated = {
        ...state.project,
        hubSwitches: [eintrag, ...(state.project.hubSwitches ?? [])],
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    })
    return absage
  },
  // BEDARF 72 — Pool, Port und die vergebenen Gruppen.
  //
  // Ein Setter fuer das ganze Objekt und keiner je Vergabe: der Aufrufer ist
  // `allocateMulticast`, das die vollstaendige Liste zurueckgibt. Ein
  // Einzel-Setter verfuehrte dazu, in einer Schleife zu vergeben — und jede
  // Zwischenstufe waere ein Zustand, in dem die Alias-Pruefung die eigenen
  // frisch vergebenen Adressen noch nicht kennt.
  setMulticastConfig: (config) =>
    set((state) => {
      const updated = { ...state.project, multicast: config }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 89 — das Sicherheitsnetz. Wieder ein Setter fuer das ganze Objekt:
  // Szenenliste, Waechter und Regeln haengen aneinander, und ein Einzel-Setter
  // je Regel liesse einen Zustand zu, in dem eine Regel auf eine Szene zeigt,
  // die die Liste noch nicht kennt — genau der Zustand, den die Pruefung
  // meldet, nur diesmal von der Oberflaeche selbst erzeugt.
  setFallbackPlan: (plan) =>
    set((state) => {
      const updated = { ...state.project, fallback: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 88 — die Veranstaltungsangaben. Ein Setter fuer das ganze Objekt,
  // aus demselben Grund wie oben: die Abweichungen je Ziel haengen an den
  // Projektwerten, gegen die sie abweichen. Ein Einzel-Setter je Abweichung
  // liesse den Zustand zu, in dem ein Ueberschreiber gegen einen Projektwert
  // steht, den es in derselben Aktion gar nicht mehr gibt.
  setEventMetadata: (plan) =>
    set((state) => {
      const updated = { ...state.project, eventMetadata: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // Die Auskunft des GEBAEUDES (facility Issue #2). Ein Setter fuer das ganze
  // Objekt, aus demselben Grund wie oben: Punkte, Klinken und der Zeitpunkt
  // gehoeren zusammen. Eine Auskunft, deren Punkte von heute und deren Datum
  // von letzter Woche ist, waere schlimmer als keine.
  setHausAuskunft: (auskunft) =>
    set((state) => {
      const updated = { ...state.project, hausAuskunft: auskunft }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 87 — der Sendebericht. Wieder ein Setter fuer das ganze Objekt:
  // Zusammenfassung und Eintraege gehoeren zusammen, und eine Zusammenfassung
  // ohne die Eintraege, auf die sie sich bezieht, waere eine Bewertung ohne
  // Beleg.
  setTransmissionRecord: (record) =>
    set((state) => {
      const updated = { ...state.project, transmissionRecord: record }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 79 — der Kostenvergleich. Wieder ein Setter fuer das ganze Objekt:
  // Waehrung, Toleranz und Positionen gehoeren zusammen, und eine Summe ueber
  // Positionen in zwei Waehrungen waere eine Zahl, die nichts bedeutet.
  setCostPlan: (plan) =>
    set((state) => {
      const updated = { ...state.project, costPlan: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 100 — das Namensschema der Aufzeichnungen.
  setRecordNaming: (scheme) =>
    set((state) => {
      const updated = { ...state.project, recordNaming: scheme }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 74 — die Namensregel.
  setNamingScheme: (scheme) =>
    set((state) => {
      const updated = { ...state.project, namingScheme: scheme }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  // BEDARF 74 — die Regel ANWENDEN. Der Store rechnet hier nichts selbst: er
  // ruft `applyNamingScheme`, und wenn die verweigert (doppelte Namen, nichts
  // zu tun), bleibt der Zustand unveraendert. Eine Verweigerung im Store still
  // in ein Teil-Umbenennen zu verwandeln waere genau das Ueberschreiben, gegen
  // das Bedarf 96 geschrieben ist.
  applyNaming: (scheme) =>
    set((state) => {
      const result = applyNamingScheme(state.project, scheme)
      if (!result.project) return {}
      scheduleProjectAutosave(result.project)
      return { project: result.project }
    }),
})
