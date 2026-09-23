import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// LED-PROZESSOREN (#878)
//
// ─── WARUM ES DIESE DATEI VORHER NICHT GAB ────────────────────────────────
//
// `katalogLuecken` misst seit dem 2026-09-19 gegen die fuenf Bereiche, die
// #878 nennt, und genau einer stand bei NULL: LED-Prozessoren hatten nicht
// wenige Eintraege, sondern gar keine Kategorie. Der Unterschied zwischen
// „wenig gepflegt" und „kommt nicht vor" faellt nur auf, wenn jemand gegen
// eine Soll-Liste zaehlt.
//
// Gebaut wurde sie damals trotzdem nicht, und der Grund stand in
// `vorlagenEinreichung`: die Herstellerdatenblaetter waren von hier aus nicht
// erreichbar, und Zahlen aus einer Suchergebnis-Zusammenfassung
// abzuschreiben waere eine Angabe, die niemand nachlesen kann. Am 2026-09-23
// ging es — beide Datenblaetter unten sind vom Hersteller selbst, als PDF
// geholt und Zeile fuer Zeile gelesen, nicht aus einer Zusammenfassung
// uebernommen.
//
// ─── WAS EIN LED-PROZESSOR IM KABELPLAN IST ───────────────────────────────
//
// Die Besonderheit gegenueber allem anderen im Katalog: die AUSGAENGE sind
// Netzwerkbuchsen, und es sind viele. Ein MX40 Pro hat zwanzig. Sie tragen
// kein Netzwerk im ueblichen Sinn — an jeder haengt eine Kette LED-Kacheln,
// und welche Kachel an welchem Port haengt, ist genau die Frage, wegen der
// jemand einen Kabelplan zeichnet.
//
// Deshalb stehen sie einzeln als Ports da und nicht als „20x Ethernet" in
// einer Notiz. Ein Plan, der die Portnummer nicht kennt, beantwortet die
// Frage nicht, fuer die er gemacht wurde.
//
// ─── WAS HIER FEHLT UND WARUM ─────────────────────────────────────────────
//
// Zwei Hersteller, zwei Geraete. Megapixel (HELIOS), weitere Brompton-Modelle
// (M2, S8) und die kleineren NovaStar (MX20, CX40 Pro, VX-Serie) fehlen —
// nicht aus Versehen, sondern weil jedes davon dasselbe verlangt: das
// Datenblatt holen, lesen, eintragen. Zwei belegte Eintraege sind der Anfang
// einer Kategorie, die bei null stand; zwanzig geratene waeren ein
// Rueckschritt, weil `catalogueEvidence` sie als unbelegt zaehlt und die
// Portzahl im Plan trotzdem aussaehe wie eine Auskunft des Herstellers.
// ───────────────────────────────────────────────────────────────────────────

const port = (
  name: string,
  connectorType: Port['connectorType'] = 'Custom',
): Port => ({ id: '', name, type: connectorType, connectorType })

const eth   = (name: string) => port(name, 'Ethernet/RJ45')
const fiber = (name: string) => port(name, 'Fiber')
const hdmi  = (name: string) => port(name, 'HDMI')
const bnc   = (name: string) => port(name, 'BNC')
const dp    = (name: string) => port(name, 'DisplayPort')
const xlr   = (name: string) => port(name, 'XLR')

const LED_PROCESSING = 'LED Processing'

/** Die nummerierten Ausgaenge, die eine Kachelkette tragen. */
const kette = (praefix: string, von: number, bis: number, bauform: 'eth' | 'fiber'): Port[] =>
  Array.from({ length: bis - von + 1 }, (_, i) =>
    (bauform === 'eth' ? eth : fiber)(`${praefix} ${von + i}`),
  )

interface LedProcessorEntry {
  /** Stabile Geraetetyp-Identitaet, wie in den uebrigen Katalogen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

const withTypeId = (e: LedProcessorEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const LED_PROCESSOR_CATALOG: LedProcessorEntry[] = [

  // ── Brompton Tessera SX40 ───────────────────────────────────────────────
  //
  // Brompton Technology, „Tessera SX40 LED Processor" Data Sheet Feb 2025
  // (EN), gelesen am 2026-09-23. Abschnitte HDMI 2.0b INPUT, SDI INPUT &
  // RE-CLOCKED THRU PORT, OUTPUTS, ELECTRICAL, I/O.
  //
  // LEISTUNG: Das Blatt nennt „100-240V AC, 50Hz-60Hz, 1.2-0.6A" und KEINE
  // Wattzahl. 1,2 A bei 100 V sind 120 VA — das ist die Scheinleistung der
  // Netzteil-Auslegung und nicht die gemessene Aufnahme. Deshalb steht hier
  // KEIN `powerWatts`: eine gerechnete Zahl saehe im Lastplan aus wie eine
  // gemessene, und der Unterschied entscheidet, ob eine Phase reicht.
  //
  // Quelle: https://www.bromptontech.com/wp-content/uploads/2025/07/Brompton-SX40-Data-Sheet-Feb2025-EN.pdf
  {
    match: ['brompton', 'sx40'],
    deviceTypeId: '0f2b9d41-6c8a-4d7e-9b13-5a4c8e2f7d60',
    template: {
      manufacturerUrl: 'https://www.bromptontech.com/wp-content/uploads/2025/07/Brompton-SX40-Data-Sheet-Feb2025-EN.pdf',
      name: 'Brompton Tessera SX40',
      category: LED_PROCESSING,
      inputs: [
        hdmi('HDMI 2.0b In'),
        bnc('12G-SDI In'),
        bnc('Bi/Tri-Level Sync In'),
        xlr('DMX-512A In (XLR-5)'),
        eth('Management 1 (GbE)'),
        eth('Management 2 (GbE)'),
      ],
      outputs: [
        // Vier Kupfer- UND vier Glas-Ausgaenge. Sie sind KEINE Alternative
        // zueinander im Plan: welcher bestueckt wird, entscheidet die
        // Entfernung (Cat6A bis 60 m), und beide Wege gehoeren gezeichnet.
        ...kette('Tessera 10G', 1, 4, 'eth'),
        ...kette('Tessera XD Fibre', 1, 4, 'fiber'),
        bnc('12G-SDI Thru'),
        bnc('Bi/Tri-Level Sync Thru'),
        xlr('DMX-512A Thru (XLR-5)'),
        dp('Monitor Out (DP++)'),
      ],
      width: 260, height: 120,
      notes: 'Datenblatt Feb 2025: 2 HE, 7,50 kg. Netz 100–240 V, 1,2–0,6 A; '
        + 'eine Wattangabe nennt es nicht.',
    },
  },

  // ── NovaStar MX40 Pro ───────────────────────────────────────────────────
  //
  // Xi'an NovaStar Tech, „MX40 Pro LED Display Controller Specifications"
  // V1.4.1 (2024-08), gelesen am 2026-09-23. Abschnitte Ports, Electrical
  // Specifications, Physical Specifications.
  //
  // Hier steht die Wattzahl im Blatt (95 W max) — deshalb steht sie auch
  // hier, und beim Brompton daneben nicht. Der Unterschied ist keine
  // Ungleichbehandlung, sondern der Unterschied zwischen den Quellen.
  //
  // Quelle: https://oss.novastar.tech/uploads/2024/08/MX40-Pro-LED-Display-Controller-Specifications-V1.4.1.pdf
  {
    match: ['novastar', 'mx40'],
    deviceTypeId: '7c4e1a86-3f52-4b9d-8e07-2d6b5f1c9a34',
    template: {
      manufacturerUrl: 'https://oss.novastar.tech/uploads/2024/08/MX40-Pro-LED-Display-Controller-Specifications-V1.4.1.pdf',
      name: 'NovaStar MX40 Pro',
      category: LED_PROCESSING,
      powerWatts: 95,
      inputs: [
        hdmi('HDMI 2.0-1 In'),
        hdmi('HDMI 2.0-2 In'),
        hdmi('HDMI 2.0-3 In'),
        dp('DP 1.2 In'),
        bnc('12G-SDI In'),
      ],
      outputs: [
        // Zwanzig. Genau deshalb stehen sie einzeln: an jeder haengt eine
        // Kachelkette, und welche wo haengt, ist der Grund fuer den Plan.
        ...kette('Ethernet', 1, 20, 'eth'),
        // OPT 1 traegt die Daten der Ports 1-10, OPT 2 die der Ports 11-20;
        // OPT 3 und 4 sind deren Kopierkanaele (Redundanz). Steht so im
        // Blatt und gehoert in den Plan, weil sonst vier gleich aussehende
        // Fasern vier verschiedene Bedeutungen haetten.
        fiber('OPT 1 (10G, Ports 1–10)'),
        fiber('OPT 2 (10G, Ports 11–20)'),
        fiber('OPT 3 (10G, Kopie von OPT 1)'),
        fiber('OPT 4 (10G, Kopie von OPT 2)'),
        hdmi('HDMI 2.0-1 Loop'),
        hdmi('HDMI 2.0-2 Loop'),
        hdmi('HDMI 2.0-3 Loop'),
        bnc('12G-SDI Loop'),
      ],
      width: 280, height: 120,
      notes: 'Spezifikation V1.4.1: 482,6 × 94,2 × 467,0 mm (2 HE), 7,5 kg, '
        + '100–240 V~, max. 95 W.',
    },
  },
]

/** Flat list of EquipmentTemplate objects, suitable for library seeding. */
export const ledProcessorTemplates: EquipmentTemplate[] =
  LED_PROCESSOR_CATALOG.map(withTypeId)

/** Try to match an equipment name against the LED-processor catalog. */
export const matchLedProcessorTemplate = (name: string): EquipmentTemplate | undefined => {
  const lower = name.toLowerCase()
  const entry = LED_PROCESSOR_CATALOG.find((e) =>
    e.match.every((fragment) => lower.includes(fragment)),
  )
  return entry ? withTypeId(entry) : undefined
}
