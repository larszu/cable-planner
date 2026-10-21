import { describe, expect, it } from 'vitest'
import { de } from '../src/renderer/lib/i18n/de'
import { kanonisch } from '../src/renderer/lib/kanonisch'
import { ADAPTER_RICHTUNG_LABEL, ADAPTER_SPEISUNG_LABEL } from '../src/renderer/types/adapter'
import { CAMERA_CONTROL_LABEL, CONTROL_SUPPORT_LABEL } from '../src/renderer/types/cameraCapability'
import { CONTROL_TARGET_LABEL } from '../src/renderer/types/switcherControl'
import { LAUSCHER_LAGE_LABEL } from '../src/renderer/types/showControl'
import { SCENE_FORMAT_LABEL } from '../src/renderer/types/sceneImport'
import { ANHANG_ART_LABEL } from '../src/renderer/types/anhang'
import { INSTALL_STATUS_LABEL } from '../src/renderer/types/lifecycle'
import { AUDIT_LABEL, AUDIT_VIA_LABEL } from '../src/renderer/lager/lib/inventoryAudit'
import { LEG_LABEL, SIGNATURE_REFUSAL_LABEL, SIGNATURE_STATE_LABEL } from '../src/renderer/lager/lib/handoverSignature'
import { FAULT_SERVICE_LABEL } from '../src/renderer/lager/types/inventory'
import { IDENTITY_FINDING_LABEL } from '../src/renderer/lager/lib/unitIdentity'
import { SCENE_DIFF_LABEL } from '../src/renderer/lib/sceneImport'
import { CHANNEL_IDENTITY_LABEL } from '../src/renderer/lib/channelIdentity'
import { AS_BUILT_VERDICT_LABEL, READING_SOURCE_LABEL } from '../src/renderer/lib/asBuilt'
import { DURCHGANG_ART_LABEL } from '../src/renderer/lib/trassenplan'
import { MIC_FINDING_LABEL } from '../src/renderer/lib/micAssignment'

// ---------------------------------------------------------------------------
// #1128 — die Beschriftungs-Maps tragen die englische Quelle; angezeigt wird
// ueber `t(`<ns>.${k}`, MAP[k])`, gestempelt ueber `kanonisch(…)`. Der
// Schluessel ist zusammengesetzt, also sieht ihn der Erreichbarkeits-Guard
// nicht: dieser Test fragt jeden Eintrag einzeln, ob es ihn auf Deutsch gibt.
// Gleich lautende Woerter (Zoom, Tally, Video …) brauchen keinen Eintrag.
// ---------------------------------------------------------------------------

const MAPS: Array<[string, Readonly<Record<string, string>>]> = [
  ['adapter.direction', ADAPTER_RICHTUNG_LABEL],
  ['adapter.powering', ADAPTER_SPEISUNG_LABEL],
  ['camera.control', CAMERA_CONTROL_LABEL],
  ['camera.support', CONTROL_SUPPORT_LABEL],
  ['switching.targetKind', CONTROL_TARGET_LABEL],
  ['osc.listenerState', LAUSCHER_LAGE_LABEL],
  ['scene.format', SCENE_FORMAT_LABEL],
  ['scene.diff', SCENE_DIFF_LABEL],
  ['anhang.kind', ANHANG_ART_LABEL],
  ['lifecycle.status', INSTALL_STATUS_LABEL],
  ['inventory.auditOutcome', AUDIT_LABEL],
  ['inventory.auditVia', AUDIT_VIA_LABEL],
  ['handover.leg', LEG_LABEL],
  ['handover.refusal', SIGNATURE_REFUSAL_LABEL],
  ['handover.state', SIGNATURE_STATE_LABEL],
  ['fault.service', FAULT_SERVICE_LABEL],
  ['inventory.identityFinding', IDENTITY_FINDING_LABEL],
  ['channelIdentity.finding', CHANNEL_IDENTITY_LABEL],
  ['asBuilt.verdict', AS_BUILT_VERDICT_LABEL],
  ['asBuilt.source', READING_SOURCE_LABEL],
  ['trassen.kind', DURCHGANG_ART_LABEL],
  ['mic.finding', MIC_FINDING_LABEL],
]

const GLEICH = new Set(['Zoom', 'Detail', 'X32 / M32', 'WING', 'Video', 'Comms', 'Tally', 'Router'])

describe('Beschriftungs-Maps: englische Quelle, deutsche Fassung im Woerterbuch', () => {
  for (const [ns, map] of MAPS) {
    it(ns, () => {
      const fehlend = Object.entries(map)
        .filter(([k, en]) => !GLEICH.has(en) && !(`${ns}.${k}` in de))
        .map(([k]) => `${ns}.${k}`)
      expect(fehlend).toEqual([])
    })
  }

  it('kanonisch liefert das deutsche Wort, auch ohne das Desktop-Woerterbuch', () => {
    expect(kanonisch('lifecycle.status.fault', INSTALL_STATUS_LABEL.fault)).toBe('Störung')
    expect(kanonisch('gibt.es.nicht', 'Source')).toBe('Source')
  })
})
