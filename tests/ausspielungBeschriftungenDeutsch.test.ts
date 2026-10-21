import { describe, expect, it } from 'vitest'
import { de } from '../src/renderer/lib/i18n/de'
import { ARCHIVE_ANSWER_LABEL, ARCHIVE_FINDING_LABEL } from '../src/renderer/lib/archiveIsolation'
import { EVENT_METADATA_FINDING_LABEL } from '../src/renderer/lib/eventMetadata'
import { PRIVACY_LABEL } from '../src/renderer/types/eventMetadata'
import { FALLBACK_FINDING_LABEL } from '../src/renderer/lib/fallbackPlan'
import { DELIVERY_SECTION_LABEL, TRANSMISSION_FINDING_LABEL } from '../src/renderer/lib/transmissionRecord'
import {
  TRANSMISSION_EVENT_LABEL,
  TRANSMISSION_SOURCE_LABEL,
} from '../src/renderer/types/transmissionRecord'
import { JOB_BASIS_LABEL, JOB_FINDING_LABEL } from '../src/renderer/lib/jobHandover'
import { PREFIX_BASIS_LABEL } from '../src/renderer/lib/postHandover'
import { deliveryTable } from '../src/renderer/lib/deliveryParity'
import { archiveTable } from '../src/renderer/lib/archiveIsolation'

// #1128 — die Beschriftungen stehen englisch in der Quelle und werden ueber
// einen DYNAMISCHEN Schluessel uebersetzt (`t(`job.basis.${k}`, …)`). Den sieht
// der Erreichbarkeits-Guard nicht; ohne diesen Test fiele ein fehlender
// deutscher Eintrag still auf Englisch zurueck.
const MAPS: Array<[string, Readonly<Record<string, string>>]> = [
  ['archive.answer', ARCHIVE_ANSWER_LABEL],
  ['archive.finding', ARCHIVE_FINDING_LABEL],
  ['eventMeta.finding', EVENT_METADATA_FINDING_LABEL],
  ['eventMeta.privacy', PRIVACY_LABEL],
  ['fallback.finding', FALLBACK_FINDING_LABEL],
  ['transmission.finding', TRANSMISSION_FINDING_LABEL],
  ['transmission.section', DELIVERY_SECTION_LABEL],
  ['transmission.event', TRANSMISSION_EVENT_LABEL],
  ['transmission.source', TRANSMISSION_SOURCE_LABEL],
  ['job.basis', JOB_BASIS_LABEL],
  ['job.finding', JOB_FINDING_LABEL],
  ['postHandover.prefixBasis', PREFIX_BASIS_LABEL],
]

describe('Ausspielung — englische Quelle, deutsche Fassung im Woerterbuch', () => {
  it('jeder Eintrag jeder Map hat eine deutsche Fassung', () => {
    const fehlend = MAPS.flatMap(([ns, map]) =>
      Object.keys(map)
        .filter((k) => !(`${ns}.${k}` in de))
        .map((k) => `${ns}.${k}`),
    )
    expect(fehlend).toEqual([])
  })

  it('das Blatt bleibt kanonisch deutsch — Spalten und Zellen', () => {
    expect(deliveryTable([]).headers[0]).toBe('Ziel')
    const a = { answer: 'not-stated', findings: [] } as never
    expect(archiveTable(a).headers).toEqual(['Art', 'Was', 'Gerät', 'Text'])
    expect(archiveTable(a).rows[0][1]).toBe('nicht beantwortet')
  })
})
