import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Decimator Design — Miniatur-Wandler und Multiviewer.
//
// #878 nennt die Marke ausdruecklich („Konverter (AJA, Blackmagic,
// Decimator)"), und `docs/katalog-luecken.md` hielt am 2026-09-19 fest, dass
// sie VOLLSTAENDIG fehlte. Der Grund stand dort auch: die Datenblaetter waren
// aus der Arbeitsumgebung nicht erreichbar.
//
// ─── WARUM SIE ES JETZT SIND ───────────────────────────────────────────────
//
// Sie waren es die ganze Zeit; nur der Abruf-Dienst scheiterte an der
// Zertifikatskette von `decimator.com`. Ein direkter Abruf kommt durch. Das
// ist der Unterschied zwischen „nicht erreichbar" und „mit DIESEM Werkzeug
// nicht erreichbar" — und er hat einen Bereich elf Monate leer stehen lassen.
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
const MV = 'Multiviewer'

interface DecimatorEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const DECIMATOR_CATALOG: DecimatorEntry[] = [

  // ── Miniatur-Wandler ──────────────────────────────────────────────────────

  // Quelle: https://decimator.com/brochures/MD-HX_brochure.pdf
  {
    match: ['decimatormdhx', 'mdhx'],
    deviceTypeId: '6b1d4a3c-7e52-4f18-9a06-2c8d5b3f7014',
    template: {
      manufacturerUrl: 'https://decimator.com/brochures/MD-HX_brochure.pdf',
      name: 'Decimator MD-HX',
      category: CONV,
      // Blatt: INPUTS „1 x HDMI input, 1 x (3G/HD/SD)-SDI input";
      // OUTPUTS „1 x HDMI, 2 x SDI Active Loop-through or addition outputs,
      // 2 x (3G/HD/SD)-SDI outputs". Die vier SDI-Ausgaenge sind der Grund,
      // aus dem das Blatt es auch „1 to 4 distribution amplifier" nennt.
      inputs: [hdmi('HDMI In'), sdi('SDI In'), usb(), dc()],
      outputs: [
        hdmi('HDMI Out'),
        sdi('SDI Out 1 (Loop)'),
        sdi('SDI Out 2 (Loop)'),
        sdi('SDI Out 3'),
        sdi('SDI Out 4'),
      ],
      notes: '79.5 x 123 x 29.5 mm · +5…32 V DC, positive centre pin',
      width: 240,
      height: 220,
    },
  },

  // Quelle: https://decimator.com/brochures/MD-LX_brochure.pdf
  {
    match: ['decimatormdlx', 'mdlx'],
    deviceTypeId: 'd4f7c218-8b30-4e6a-b195-7f2a0c4d9e63',
    template: {
      manufacturerUrl: 'https://decimator.com/brochures/MD-LX_brochure.pdf',
      name: 'Decimator MD-LX',
      category: CONV,
      // Blatt: „Micro USB for power, control and firmware updates" — die USB
      // IST hier die Stromversorgung, deshalb KEINE eigene DC-Buchse. Das
      // unterscheidet die MD-LX von allen anderen Geraeten dieser Datei, und
      // wer es uebersieht, packt ein Netzteil ein, das es nicht gibt.
      inputs: [hdmi('HDMI In (Type A)'), sdi('SDI In'), port('Micro USB (Power/Control)', 'USB', 'USB')],
      outputs: [hdmi('HDMI Out (Type A)'), sdi('SDI Out')],
      powerWatts: 2.5,
      notes: '60 x 73.7 x 23 mm · USB-Strom +4.4…5.25 V, unter 2.5 W',
      width: 240,
      height: 180,
    },
  },

  // Quelle: https://decimator.com/brochures/MD-CROSS_brochure.pdf
  {
    match: ['decimatormdcross', 'mdcross'],
    deviceTypeId: 'a2c93e81-5f47-4b62-8d10-6e35b9f4c072',
    template: {
      manufacturerUrl: 'https://decimator.com/brochures/MD-CROSS_brochure.pdf',
      name: 'Decimator MD-CROSS',
      category: CONV,
      // Blatt: INPUTS „HDMI, (3G/HD/SD)-SDI 10-bit"; OUTPUTS „HDMI,
      // 1 x SDI Active Loop-Through, 2 x (3G/HD/SD)-SDI 10-bit Outputs".
      inputs: [hdmi('HDMI In'), sdi('SDI In'), usb(), dc()],
      outputs: [hdmi('HDMI Out'), sdi('SDI Loop'), sdi('SDI Out 1'), sdi('SDI Out 2')],
      notes: '79.5 x 123 x 29.5 mm · +5…32 V DC',
      width: 240,
      height: 200,
    },
  },

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
      category: MV,
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

  // Quelle: https://decimator.com/brochures/DMON-QUAD_brochure.pdf
  {
    match: ['decimatordmonquad', 'dmonquad'],
    deviceTypeId: '9d02f5c7-4b81-4a36-bc09-1e6d8f3a250b',
    template: {
      manufacturerUrl: 'https://decimator.com/brochures/DMON-QUAD_brochure.pdf',
      name: 'Decimator DMON-QUAD',
      category: MV,
      // Blatt: INPUTS „4 x (3G/HD/SD)-SDI, USB for control and updates,
      // GPI on RJ-45"; OUTPUTS „1 x (3G/HD/SD)-SDI, HDMI Type A".
      inputs: [
        sdi('SDI In 1'),
        sdi('SDI In 2'),
        sdi('SDI In 3'),
        sdi('SDI In 4'),
        usb(),
        port('GPI (RJ-45)', 'Ethernet/RJ45', 'GPI'),
        dc(),
      ],
      outputs: [sdi('SDI Out'), hdmi('HDMI Out (Type A)')],
      notes: '79.5 x 123 x 29.5 mm · +5…32 V DC',
      width: 240,
      height: 260,
    },
  },

  // Quelle: https://decimator.com/brochures/DMON-6S_brochure.pdf
  {
    match: ['decimatordmon6s', 'dmon6s'],
    deviceTypeId: 'c50e8a14-7d26-4f9b-a381-0b4c6e2d9f35',
    template: {
      manufacturerUrl: 'https://decimator.com/brochures/DMON-6S_brochure.pdf',
      name: 'Decimator DMON-6S',
      category: MV,
      // Blatt: INPUTS „6 x (3G/HD/SD)-SDI, USB for control and updates";
      // OUTPUTS „6 x SDI Active Loop-throughs, 2 x SDI, HDMI Type A".
      // Dazu „32 GPI on 37-pin D-SUB for Tallies and Remote Switching" —
      // eine andere Buchse als bei den QUAD-Geraeten (dort RJ-45).
      inputs: [
        ...Array.from({ length: 6 }, (_, i) => sdi(`SDI In ${i + 1}`)),
        usb(),
        port('GPI / Tally (37-pin D-SUB)', 'Custom', 'GPI'),
        dc(),
      ],
      outputs: [
        ...Array.from({ length: 6 }, (_, i) => sdi(`SDI Loop ${i + 1}`)),
        sdi('SDI Out 1'),
        sdi('SDI Out 2'),
        hdmi('HDMI Out (Type A)'),
      ],
      notes: '220 x 103.7 x 29.5 mm · +5…32 V DC',
      width: 260,
      height: 340,
    },
  },

  // Quelle: https://decimator.com/brochures/DMON-12S_brochure.pdf
  {
    match: ['decimatordmon12s', 'dmon12s'],
    deviceTypeId: '71f3b9d8-0c45-4e72-8a16-3d9e5c072b48',
    template: {
      manufacturerUrl: 'https://decimator.com/brochures/DMON-12S_brochure.pdf',
      name: 'Decimator DMON-12S',
      category: MV,
      // Blatt: INPUTS „12 x (3G/HD/SD)-SDI, USB for control and updates";
      // OUTPUTS „HDMI Type A, 2 x SDI (3G/HD/SD)-SDI".
      //
      // KEINE LOOP-THROUGHS, anders als beim DMON-6S. Das Blatt fuehrt sie
      // beim 6S ausdruecklich („6 x active loop copies of each input") und
      // beim 12S nicht — bei zwoelf Eingaengen waere im selben Gehaeuse kein
      // Platz. Wer sie annimmt, plant zwoelf Kabel ein, die nirgends
      // hineinpassen.
      inputs: [
        ...Array.from({ length: 12 }, (_, i) => sdi(`SDI In ${i + 1}`)),
        usb(),
        port('GPI / Tally (37-pin D-SUB)', 'Custom', 'GPI'),
        dc(),
      ],
      outputs: [sdi('SDI Out 1'), sdi('SDI Out 2'), hdmi('HDMI Out (Type A)')],
      notes: '220 x 103.7 x 29.5 mm · +5…32 V DC',
      width: 260,
      height: 400,
    },
  },
]

/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */
export const decimatorTemplates: EquipmentTemplate[] = DECIMATOR_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
