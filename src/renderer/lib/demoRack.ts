// ───────────────────────────────────────────────────────────────────────────
// Das mitgelieferte Beispiel-Rack.
//
// ─── DER BEFUND (gemessen 2026-09-10) ──────────────────────────────────────
//
// Rack-Vorlagen leben in `groupPresets`, und die kommen AUSSCHLIESSLICH aus
// `localStorage` (`store/groupPresetsPersist.ts`: kein Eintrag -> `[]`).
// Eine frische Installation hat deshalb keine einzige, und die Rack-Karte
// sagt „No rack layout saved yet".
//
// Das trifft nicht nur die Karte. An `components/Rack/` haengt die gesamte
// 3D-Ansicht samt `lib/exportRack.ts` — der groesste einzelne Brocken der
// Anwendung, und der Grund fuer die Lazy-Grenze in `CLAUDE.md`. Wer die App
// zum ersten Mal oeffnet, kann davon nichts sehen, ohne vorher selbst ein Rack
// zu bauen. Dieselbe Form wie B-65 in der Suite: gebaute Rechenwerke ohne
// einen Weg hinein.
//
// Belegt ist es an einer dritten Stelle: `docs/ui-audit.md` fuehrt
// `rack-3d.png` als offen, woertlich „das Beispielprojekt enthaelt kein Rack
// […] die 3D-Ansicht ist also nicht ohne vorheriges Bauen zu zeigen".
//
// ─── WARUM ES AM BEISPIELPROJEKT HAENGT UND NICHT AM START ─────────────────
//
// Der naheliegende Weg waere, die Vorlage beim Start in die Bibliothek zu
// setzen, wie `seedBuiltInLibrary` es fuer die Geraete-Vorlagen tut. Das waere
// hier falsch: eine Vorlage, die beim Start nachwaechst, kommt nach dem
// Loeschen wieder — und der Nutzer kann sie nicht loswerden, ohne zu wissen,
// warum sie zurueckkehrt.
//
// Sie haengt deshalb am ausdruecklichen „Beispielprojekt laden". Das ist eine
// Handlung, und wer sie ausloest, erwartet Beispieldaten. Ein zweiter Aufruf
// legt nichts doppelt an (`DEMO_RACK_PRESET_ID` ist fest), und wer die Vorlage
// loescht und das Beispiel nicht neu laedt, ist sie los.
//
// ─── DIE NAMEN SIND KENNUNGEN ──────────────────────────────────────────────
//
// Die Kabel des Racks verweisen ueber `fromPortName`/`toPortName` auf die
// Ports der Inhalte — nicht ueber einen Index. Wer hier einen Port umbenennt,
// muss das Kabel mitnehmen; `tests/beispielRack.test.ts` haelt fest, dass
// jeder Endpunkt einen Port trifft.
// ───────────────────────────────────────────────────────────────────────────
import type { GroupPreset } from '../types/equipment'

/**
 * Feste Kennung — der Wiedererkennungspunkt beim zweiten „Beispielprojekt
 * laden". Eine frische UUID je Aufruf legte die Vorlage jedes Mal erneut an.
 */
export const DEMO_RACK_PRESET_ID = 'demo-rack-ob-van'

/**
 * Ein 12-HE-Rack, wie es im Beispielprojekt stuende: Mischer, Multiviewer,
 * Patchblende, Netzteil-Leiste — und die drei Verbindungen dazwischen, die
 * man im Rack tatsaechlich steckt.
 *
 * Absichtlich klein. Es soll zeigen, wie ein Rack aussieht, und nicht, wie
 * viel hineinpasst.
 */
export const createDemoRackPreset = (): GroupPreset => ({
  id: DEMO_RACK_PRESET_ID,
  name: 'Example rack: small OB van',
  rack: {
    totalUnits: 12,
    depthMm: 800,
    placements: [
      { itemIndex: 0, startUnit: 1, heightUnits: 1, mountSide: 'front' },
      { itemIndex: 1, startUnit: 3, heightUnits: 2, mountSide: 'full' },
      { itemIndex: 2, startUnit: 6, heightUnits: 1, mountSide: 'full' },
      { itemIndex: 3, startUnit: 12, heightUnits: 1, mountSide: 'rear' },
    ],
  },
  items: [
    {
      name: 'Patch panel 16x BNC',
      category: 'Patch panels',
      rackUnits: 1,
      offsetX: 0,
      offsetY: 0,
      width: 240,
      height: 120,
      inputs: Array.from({ length: 8 }, (_, i) => ({
        id: `demo-rack-pp-in-${i + 1}`,
        name: `Rear ${i + 1}`,
        type: 'BNC',
        connectorType: 'BNC' as const,
        direction: 'in' as const,
      })),
      outputs: Array.from({ length: 8 }, (_, i) => ({
        id: `demo-rack-pp-out-${i + 1}`,
        name: `Front ${i + 1}`,
        type: 'BNC',
        connectorType: 'BNC' as const,
        direction: 'out' as const,
      })),
    },
    {
      name: 'Vision mixer',
      category: 'Mixer',
      rackUnits: 2,
      offsetX: 0,
      offsetY: 160,
      width: 240,
      height: 180,
      nodeColor: '#7c3aed',
      inputs: Array.from({ length: 4 }, (_, i) => ({
        id: `demo-rack-mix-in-${i + 1}`,
        name: `In ${i + 1}`,
        type: 'BNC',
        connectorType: 'BNC' as const,
        direction: 'in' as const,
      })),
      outputs: [
        {
          id: 'demo-rack-mix-pgm',
          name: 'PGM Out',
          type: 'BNC',
          connectorType: 'BNC' as const,
          direction: 'out' as const,
        },
        {
          id: 'demo-rack-mix-mv',
          name: 'Multiview Out',
          type: 'BNC',
          connectorType: 'BNC' as const,
          direction: 'out' as const,
        },
      ],
    },
    {
      name: 'Multiviewer',
      category: 'Monitors',
      rackUnits: 1,
      offsetX: 0,
      offsetY: 380,
      width: 240,
      height: 120,
      inputs: [
        {
          id: 'demo-rack-mv-in',
          name: 'SDI In',
          type: 'BNC',
          connectorType: 'BNC' as const,
          direction: 'in' as const,
        },
      ],
      outputs: [],
    },
    {
      // Die Leiste sitzt hinten und unten — dort, wo sie im echten Rack sitzt.
      // Der Name ist zugleich die Kennung der ausgelieferten Vorlage aus
      // `passiveCatalog.ts` (#837); wer ihn hier aendert, loest ihn von dort.
      name: 'IEC strip 8-way',
      category: 'Power',
      rackUnits: 1,
      offsetX: 0,
      offsetY: 540,
      width: 240,
      height: 120,
      inputs: [
        {
          id: 'demo-rack-pdu-feed',
          name: 'Feed',
          type: 'Schuko 230V',
          connectorType: 'Schuko 230V' as const,
          direction: 'in' as const,
        },
      ],
      outputs: Array.from({ length: 8 }, (_, i) => ({
        id: `demo-rack-pdu-out-${i + 1}`,
        name: `Outlet ${i + 1}`,
        type: 'IEC 230V',
        connectorType: 'IEC 230V' as const,
        direction: 'out' as const,
      })),
    },
  ],
  cables: [
    {
      fromItemIndex: 0,
      fromPortName: 'Front 1',
      toItemIndex: 1,
      toPortName: 'In 1',
      name: 'Patch 1 → mixer In 1',
      type: 'BNC',
      length: 1,
      color: '#3b82f6',
    },
    {
      fromItemIndex: 0,
      fromPortName: 'Front 2',
      toItemIndex: 1,
      toPortName: 'In 2',
      name: 'Patch 2 → mixer In 2',
      type: 'BNC',
      length: 1,
      color: '#3b82f6',
    },
    {
      fromItemIndex: 1,
      fromPortName: 'Multiview Out',
      toItemIndex: 2,
      toPortName: 'SDI In',
      name: 'Multiview → Multiviewer',
      type: 'BNC',
      length: 1,
      color: '#22c55e',
    },
  ],
})
