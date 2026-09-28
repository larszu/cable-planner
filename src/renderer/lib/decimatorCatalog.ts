import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Decimator Design — Miniatur-Wandler und Multiviewer.
//
// #878 nennt die Marke ausdruecklich („Konverter (AJA, Blackmagic,
// Decimator)"). MD-HX, MD-LX, MD-Cross und die DMON-Reihe stehen bereits in
// `miscCatalog`/`broadcastToolsCatalog`; hier kommen die zwei Modelle dazu,
// die dort fehlten: MD-DUCC und MD-QUAD.
//
// ─── DIE QUELLE IST DAS BROSCHUEREN-PDF, NICHT DIE PRODUKTSEITE ────────────
//
// Bei Decimator steht die Spezifikationstabelle im Broschueren-PDF; die
// Produktseite wiederholt nur den Fliesstext. `manufacturerUrl` zeigt deshalb
// auf das PDF: das ist das Blatt, aus dem die Portlisten hier stammen, und wer
// an einer Zahl zweifelt, soll mit einem Klick auf DIESE Tabelle kommen.
//
// ─── WAS HIER NICHT STEHT ──────────────────────────────────────────────────
//
// Die Leistungsaufnahme, wo das Blatt sie nicht nennt. Decimator gibt fuer die
// meisten Geraete nur den Spannungsbereich an („+5V to +32V DC"); eine
// Wattzahl daraus zu rechnen waere geraten. Wo sie dasteht — MD-LX („under 2.5
// Watts"), MD-QUAD („8 Watts"), MD-DUCC („~5 Watts") — steht sie auch hier.
//
// Ebenso fehlen die 12G-Modelle: fuer `MD-LX-12G`, `MD-HX-12G` und `DMON-4K`
// gibt es unter `brochures/` kein PDF (404, gemessen). Ohne Blatt kein
// Eintrag.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type?: string): Port => ({
  id: '',
  name,
  type: type ?? connectorType,
  connectorType,
})

const sdi = (name: string) => port(name, 'BNC', 'SDI')
const hdmi = (name: string) => port(name, 'HDMI', 'HDMI')
/** Alle Decimator-Miniaturwandler haben eine USB-Buchse fuer Steuerung und
 *  Firmware. Sie steht als EIGENER Anschluss und nicht als Fussnote: wer das
 *  Geraet im Rack fernsteuern will, braucht dafuer ein Kabel im Plan. */
const usb = (name = 'USB (Control)') => port(name, 'USB', 'USB')
/** Die DC-Buchse. Decimator nennt sie „Metal Thread Locking DC Power Socket";
 *  der Stecker ist ein Hohlstecker mit positivem Mittelstift. */
const dc = () => port('DC In (+5…32 V)', 'Custom', 'Power')

const CONV = 'Converter'

interface DecimatorEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const DECIMATOR_CATALOG: DecimatorEntry[] = [

  // ── Miniatur-Wandler ──────────────────────────────────────────────────────

  // Quelle: https://decimator.com/brochures/MD-DUCC_brochure.pdf
  {
    match: ['decimatormdducc', 'mdducc'],
    deviceTypeId: 'f18b60d5-2a94-4c31-97e8-5b0d3f8a1e62',
    template: {
      manufacturerUrl: 'https://decimator.com/brochures/MD-DUCC_brochure.pdf',
      name: 'Decimator MD-DUCC',
      category: CONV,
      // Blatt: INPUTS „(3G/HD/SD)-SDI 10-bit" — KEIN HDMI-Eingang, anders als
      // bei MD-CROSS und MD-HX. OUTPUTS „HDMI, 1 x SDI Active Loop-Through,
      // 2 x (3G/HD/SD)-SDI 10-bit Outputs".
      inputs: [sdi('SDI In'), usb(), dc()],
      outputs: [hdmi('HDMI Out'), sdi('SDI Loop'), sdi('SDI Out 1'), sdi('SDI Out 2')],
      powerWatts: 5,
      notes: '90 x 123 x 23 mm · +5…24 V DC, ca. 5 W',
      width: 240,
      height: 200,
    },
  },

  // ── Multiviewer ───────────────────────────────────────────────────────────

  // Quelle: https://decimator.com/brochures/MD-QUAD_brochure.pdf
  {
    match: ['decimatormdquad', 'mdquad'],
    deviceTypeId: '3e7a12b9-6c58-4d03-8f41-9b2e5a0c7d18',
    template: {
      manufacturerUrl: 'https://decimator.com/brochures/MD-QUAD_brochure.pdf',
      name: 'Decimator MD-QUAD',
      category: 'Video',
      // Blatt: 4 SDI-Eingaenge, „USB for control and updates", „GPI on RJ-45";
      // OUTPUTS „1 x 10-bit (3G/HD/SD)-SDI Re-clocked, HDMI".
      //
      // DIE GPI-BUCHSE IST EINE RJ-45 UND KEIN NETZWERK. Sie steht mit dem
      // Signaltyp `GPI` da: wer sie fuer einen Switch-Port haelt, zieht ein
      // Patchkabel ins Nichts.
      inputs: [
        sdi('SDI In 1'),
        sdi('SDI In 2'),
        sdi('SDI In 3'),
        sdi('SDI In 4'),
        usb(),
        port('GPI (RJ-45)', 'Ethernet/RJ45', 'GPI'),
        dc(),
      ],
      outputs: [sdi('SDI Out (Re-clocked)'), hdmi('HDMI Out')],
      powerWatts: 8,
      notes: '90 x 94 x 23 mm · +5…24 V DC, 8 W',
      width: 240,
      height: 260,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const decimatorTemplates: EquipmentTemplate[] = DECIMATOR_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
