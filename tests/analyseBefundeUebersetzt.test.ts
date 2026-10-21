import { describe, expect, it } from 'vitest'
import { de } from '../src/renderer/lib/i18n/de'
import { ACTION_URGENCY_LABEL } from '../src/renderer/lib/actionItems'
import { ACTUAL_SOURCE_LABEL } from '../src/renderer/types/costLines'
import { ANSWER_STATE_LABEL, venueAnswerTable } from '../src/renderer/lib/venueAnswers'
import { ASSET_FINDING_LABEL, IDENTITY_ANCHOR_LABEL } from '../src/renderer/lager/lib/assetIdentity'
import { ATTACH_REFUSAL_LABEL } from '../src/renderer/types/receipt'
import { BOOKING_STATE_LABEL, EXPENSE_KIND_LABEL } from '../src/renderer/types/labour'
import { CHAIN_FINDING_LABEL } from '../src/renderer/lib/receiptChain'
import { CLIENT_SUMMARY_FINDING_LABEL, SUMMARY_BASIS_LABEL } from '../src/renderer/lib/clientSummary'
import { COST_FINDING_LABEL } from '../src/renderer/lib/costComparison'
import { CREW_ORIGIN_LABEL, CREW_SECTION_LABEL, crewSheetTable } from '../src/renderer/lib/crewNetworkSheet'
import { DANTE_FINDING_LABEL } from '../src/renderer/lib/dantePatch'
import { LABOUR_FINDING_LABEL } from '../src/renderer/lib/labourCost'
import { MULTICAST_FINDING_LABEL } from '../src/renderer/lib/multicastPlan'
import { MULTICAST_LEG_LABEL } from '../src/renderer/types/multicast'
import { NAMING_FINDING_LABEL } from '../src/renderer/lib/namingScheme'
import { PROFILE_LABEL, PTP_FINDING_LABEL } from '../src/renderer/lib/ptpPlan'
import { READ_SOURCE_LABEL, RECEIPT_FINDING_LABEL } from '../src/renderer/lib/receiptRead'
import { RECORD_NAME_FINDING_LABEL } from '../src/renderer/lib/recordNaming'
import { SCAN_FINDING_LABEL } from '../src/renderer/lib/spectrumScan'
import { VERDICT_LABEL } from '../src/renderer/types/spectrumScan'
import { TRACE_END_LABEL, TRACE_SOURCE_LABEL } from '../src/renderer/lib/portTrace'

// ---------------------------------------------------------------------------
// Die Befund-Maps der Analyse tragen die englische Quelle; angezeigt werden
// sie ueber `t(\`<ns>.${kind}\`, MAP[kind])`. Solche Schluessel sieht
// `i18nErreichbarkeit` nicht — der Schluessel entsteht erst zur Laufzeit.
// Fehlt hier ein deutscher Eintrag, sieht ein deutscher Nutzer Englisch,
// und kein anderer Test merkt es (#1128).
// ---------------------------------------------------------------------------

const MAPS: Array<[string, Readonly<Record<string, string>>]> = [
  ['action.urgency', ACTION_URGENCY_LABEL],
  ['cost.actualSource', ACTUAL_SOURCE_LABEL],
  ['venue.answerState', ANSWER_STATE_LABEL],
  ['asset.finding', ASSET_FINDING_LABEL],
  ['asset.anchor', IDENTITY_ANCHOR_LABEL],
  ['receipt.refusal', ATTACH_REFUSAL_LABEL],
  ['labour.booking', BOOKING_STATE_LABEL],
  ['labour.expense', EXPENSE_KIND_LABEL],
  ['receipt.chain', CHAIN_FINDING_LABEL],
  ['summary.finding', CLIENT_SUMMARY_FINDING_LABEL],
  ['summary.basis', SUMMARY_BASIS_LABEL],
  ['cost.finding', COST_FINDING_LABEL],
  ['crewSheet.origin', CREW_ORIGIN_LABEL],
  ['crewSheet.section', CREW_SECTION_LABEL],
  ['dante.finding', DANTE_FINDING_LABEL],
  ['labour.finding', LABOUR_FINDING_LABEL],
  ['multicast.finding', MULTICAST_FINDING_LABEL],
  ['multicast.leg', MULTICAST_LEG_LABEL],
  ['naming.finding', NAMING_FINDING_LABEL],
  ['ptp.finding', PTP_FINDING_LABEL],
  ['ptp.profile', PROFILE_LABEL],
  ['receipt.readSource', READ_SOURCE_LABEL],
  ['receipt.finding', RECEIPT_FINDING_LABEL],
  ['recordName.finding', RECORD_NAME_FINDING_LABEL],
  ['scan.finding', SCAN_FINDING_LABEL],
  ['scan.verdictLabel', VERDICT_LABEL],
  ['trace.end', TRACE_END_LABEL],
  ['trace.source', TRACE_SOURCE_LABEL],
]

/** Was in beiden Sprachen gleich lautet und deshalb keinen Eintrag braucht. */
const GLEICH = new Set(['ptp.profile.st2059-2', 'ptp.profile.aes67', 'ptp.profile.default', 'labour.expense.material'])

describe('Analyse-Befunde: jede Art hat eine deutsche Fassung (#1128)', () => {
  for (const [ns, map] of MAPS) {
    it(ns, () => {
      const fehlend = Object.keys(map)
        .map((k) => `${ns}.${k}`)
        .filter((k) => !(k in de) && !GLEICH.has(k))
      expect(fehlend).toEqual([])
    })
  }

  it('die Blaetter bleiben kanonisch deutsch, auch aus der englischen Quelle', () => {
    const sheet = { sections: [{ key: 'netze' as const, lines: [{ origin: 'derived' as const, text: 'x' }] }] }
    expect(crewSheetTable(sheet as never).headers).toEqual(['Abschnitt', 'Herkunft', 'Was gilt'])
    expect(crewSheetTable(sheet as never).rows[0].slice(0, 2)).toEqual(['Netze', 'aus dem Plan'])
    expect(venueAnswerTable([], (k) => k).headers[1]).toBe('Aus dem Plan')
  })
})
