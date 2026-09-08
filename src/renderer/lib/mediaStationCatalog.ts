// ───────────────────────────────────────────────────────────────────────────
// Medien-Station als PLAN-ENDPUNKT.
//
// Die offene Haelfte einer Zeile in `av-planner-suite/docs/research/synthesis/
// FEATURE-MATRIX.md`:
//
//   > „Media playback — YES as a planned endpoint" ist im `cable-planner`
//   > nicht eingeloest; `pi-media-station` kommt dort als Geraet oder
//   > Endpunkt nicht vor.
//
// Die Matrix sagt zu Medien-Wiedergabe zweierlei, und beides gilt: als
// KONKURRENT zu QLab, Resolume oder disguise wird nichts gebaut (WON'T), als
// geplanter ENDPUNKT gehoert die Station in den Plan. Bis hierher stand nur
// die Absage im Dokument; die Zusage war nirgends eingeloest. Eine Station,
// die man nicht auf die Flaeche ziehen kann, taucht in keiner Stueckliste, in
// keiner Kommissionierliste und auf keinem Kabelplan auf — sie wird vor Ort
// von Hand mitgedacht, und genau das ist der Schaden, gegen den dieser
// Planer gebaut ist.
//
// ─── WORAUS DIE PORTS STAMMEN ──────────────────────────────────────────────
//
// Aus dem Repo der Station selbst (`larszu/pi-media-station`), nicht aus
// einem Datenblatt: der Hersteller dieses Geraets ist dieses Projekt. Der
// `manufacturerUrl` zeigt deshalb auf das Repo — das ist hier die
// Datenblatt-Quelle im Sinne der Belegkette und keine Verlegenheitsangabe.
//
// Gelesen wurde: der Display-Modus faehrt EINEN Chromium im Kiosk
// (`--kiosk`), also genau eine Bildausgabe; der Manager und die mDNS-Meldung
// laufen ueber das Netz; der HC-SR04 haengt an GPIO.
//
// ─── WAS BEWUSST NICHT IM TEMPLATE STEHT ───────────────────────────────────
//
// **Keine analoge Klinke.** Sie waere der bequeme dritte Port und eine
// Aussage ueber die PLATINE, die dieses Repo gar nicht festlegt: der
// Raspberry Pi 5 hat die 3,5-mm-Buchse nicht mehr, der Pi 4 hat sie. Ein
// Port, den die Haelfte der Boards nicht besitzt, erzeugt ein Kabel auf der
// Kommissionierliste, das vor Ort ins Leere geht. Der Ton faehrt per Vorgabe
// ueber HDMI; wer die Station analog fahren will, haengt die Buchse von Hand
// an — eine Entscheidung, die dann im Plan steht statt in einer Annahme.
//
// **Kein zweiter HDMI.** Der Pi 4 hat zwei Micro-HDMI, die Software treibt
// aber genau eine Anzeige. Das Template beschreibt die STATION, wie ihre
// Software sie definiert, nicht den Stecker-Vorrat der Platine.
//
// **Kein Sensor-Port.** Der HC-SR04 haengt mit vier Draehten an GPIO 23/24.
// Das ist Innenverkabelung des Geraets und kein Weg im Signalfluss; er
// gehoert so wenig auf den Kabelplan wie das Netzteilkabel im Gehaeuse.
//
// Diese drei Auslassungen sind der Grund, warum hier ein eigener Katalog
// steht und kein Eintrag in `miscCatalog`: der ist an einer Rentman-Liste
// eines Vermieters gemessen, und diese Station kommt in keiner vor.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment'

interface MediaStationEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog). */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: MediaStationEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const MEDIA_STATION_CATALOG: MediaStationEntry[] = [
  // LZ Media Station — sensorgesteuerte Zuspiel-Station auf Raspberry Pi.
  // Repo gelesen 2026-09-08; der Hersteller dieses Geraets ist dieses Projekt.
  // Quelle: https://github.com/larszu/pi-media-station
  {
    match: ['media', 'station'],
    deviceTypeId: '5eb14ff7-48ab-4125-a67b-bb7344b08a66',
    template: {
      manufacturerUrl: 'https://github.com/larszu/pi-media-station',
      name: 'LZ Media Station',
      category: 'Video',
      inputs: [
        { id: '', name: 'LAN (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' },
      ],
      outputs: [
        { id: '', name: 'Display Out (HDMI)', type: 'HDMI', connectorType: 'HDMI' },
      ],
      width: 220, height: 120,
    },
  },
]

export const mediaStationTemplates: EquipmentTemplate[] = MEDIA_STATION_CATALOG.map(withTypeId)
