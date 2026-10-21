import type { EquipmentTemplate } from "../types/equipment";

// ───────────────────────────────────────────────────────────────────────────
// #1063 — "Steuerung über": control protocol, port and interface per device.
//
// Kept as an overlay keyed by the stable deviceTypeId instead of written into
// the catalogue files, because `cameraBodyCatalog.ts` is GENERATED from
// multicam-planner and a hand edit there would vanish on the next
// `katalog:uebernahme`.
//
// Every value is taken from manufacturer documentation; `source` holds that
// document (tests enforce it). A value the documentation does not state is
// left out — never guessed. For every serial interface the network-bridge
// setup is documented (interface, pinout, baud, TCP mode, ports,
// packetization); fields the manufacturer does not publish are listed in
// `bridge.unverified` instead of being filled in.

export interface SerialSettings {
  standard: "RS-422" | "RS-232" | "RS-485";
  /** Supported baud rates (bit/s), selectable on the device. */
  baud?: number[];
  /** Character format, e.g. "8N1". */
  format?: string;
  /** Pin assignment of the connector, as published by the manufacturer. */
  pinout?: string;
  /** Flow-control remark from the documentation. */
  flowControl?: string;
  /** Multidrop / daisy-chain remark from the documentation. */
  multidrop?: string;
}

export interface BridgeSetup {
  /** A serial-to-IP device server can carry this interface. */
  capable: boolean;
  /** Device-server mode to use (raw TCP server/client, UDP). */
  tcpMode?: string;
  /** Port on the device server; site-chosen unless the protocol fixes it. */
  port?: string;
  /** How messages are framed — what the bridge must not split. */
  packetization?: string;
  /** Bridge fields the manufacturer documentation does not state. */
  unverified?: string[];
}

export interface ControlInterface {
  /** Protocol name as the manufacturer calls it. */
  protocol: string;
  /** 'sdi' = control data embedded in the SDI return feed (no bridge). */
  transport: "serial" | "ip" | "sdi";
  /** Physical connector on the device. */
  connector?: string;
  serial?: SerialSettings;
  ip?: { layer: "UDP" | "TCP" | "HTTP"; port?: number };
  bridge?: BridgeSetup;
  /** Manufacturer document the values come from. */
  source: string;
}

export interface ControlEntry {
  deviceTypeId: string;
  /** Model name, for readability and as a guard against a mismatched id. */
  name: string;
  interfaces: ControlInterface[];
}

// Sources
const SONY_H800_VISCA =
  "https://sony.net/Products/CameraSystem/CA/BRC_X1000_BRC_H800/Technical_Document/C456100111.pdf";
const SONY_FR7_VISCA =
  "https://www.sony.jp/ls-camera/download/pdf/FR7/ILME-FR7_VISCA_command_list.pdf";
const PANA_UE150 =
  "https://pro-av.panasonic.net/en/products/aw-ue150/spec.html";
const BMD_HYPERDECK =
  "https://documents.blackmagicdesign.com/UserManuals/HyperDeckManual.pdf";
const AJA_KUMO_3232_12G = "https://www.aja.com/products/kumo-3232-12g";

const PANA_SPEC = (model: string) =>
  `https://pro-av.panasonic.net/en/products/${model}/spec.html`;
const BMD_STUDIO =
  "https://www.blackmagicdesign.com/products/blackmagicstudiocamera/techspecs/W-CEL-24";
const BMD_URSA_BC_G2 =
  "https://www.blackmagicdesign.com/products/blackmagicursabroadcast/techspecs/W-CUB-04";
const AJA_KUMO = (model: string) => `https://www.aja.com/products/${model}`;
const KUMO_DB9_PINOUT = "Tx- 2, Rx+ 3, Tx+ 7, Rx- 8, GND 1/4/6/9/shell, 5 n.c.";

const VISCA_PACKETS =
  "VISCA packets end with terminator 0xFF; forward each packet whole";

const viscaOverIp = (source: string): ControlInterface => ({
  protocol: "VISCA over IP",
  transport: "ip",
  connector: "RJ-45 (LAN)",
  ip: { layer: "UDP", port: 52381 },
  source,
});

// Panasonic PTZ with CONTROL IN RS-422A (RJ-45) and LAN IP control.
const panasonicPtz = (
  deviceTypeId: string,
  name: string,
  model: string,
): ControlEntry => ({
  deviceTypeId,
  name,
  interfaces: [
    {
      protocol: "AW protocol",
      transport: "serial",
      connector: "RJ-45 (CONTROL IN RS-422A)",
      serial: { standard: "RS-422" },
      bridge: {
        capable: true,
        tcpMode: "raw TCP server on an RS-422 device server",
        port: "site-chosen on the device server",
        unverified: [
          "baud rate",
          "character format",
          "RJ-45 pinout",
          "packet framing",
        ],
      },
      source: PANA_SPEC(model),
    },
    {
      protocol: "IP control (TCP/IP, UDP/IP, HTTP)",
      transport: "ip",
      connector: "RJ-45 (LAN, 100BASE-TX/1000BASE-T)",
      ip: { layer: "HTTP" },
      source: PANA_SPEC(model),
    },
  ],
});

const bmdStudio = (
  deviceTypeId: string,
  name: string,
  ethernet: string | undefined,
): ControlEntry => ({
  deviceTypeId,
  name,
  interfaces: [
    {
      protocol: "Blackmagic Camera Control Protocol (over SDI program return)",
      transport: "sdi",
      connector: "SDI In (program return)",
      source: BMD_STUDIO,
    },
    {
      protocol: "Blackmagic Camera Control REST API",
      transport: "ip",
      connector: ethernet ?? "USB-C (USB Ethernet)",
      ip: { layer: "HTTP" },
      source: BMD_STUDIO,
    },
  ],
});

// KUMO routers: DB-9 RS-422 + Ethernet, both "basic" GV Native.
const kumo = (
  deviceTypeId: string,
  name: string,
  model: string,
  pinoutVerified: boolean,
): ControlEntry => ({
  deviceTypeId,
  name,
  interfaces: [
    {
      protocol: "Grass Valley Native Protocol (basic support)",
      transport: "serial",
      connector: "DB-9 female (RS-422)",
      serial: {
        standard: "RS-422",
        ...(pinoutVerified ? { pinout: KUMO_DB9_PINOUT } : {}),
      },
      bridge: {
        capable: true,
        tcpMode: "raw TCP server on an RS-422 device server",
        port: "site-chosen on the device server",
        unverified: [
          "baud rate",
          "character format",
          "packet framing",
          ...(pinoutVerified ? [] : ["DB-9 pinout"]),
        ],
      },
      source: AJA_KUMO(model),
    },
    {
      protocol:
        "Grass Valley Native Protocol (basic support), KUMO control panels, web server",
      transport: "ip",
      connector: "RJ-45 (10/100/1000 Ethernet)",
      ip: { layer: "HTTP" },
      source: AJA_KUMO(model),
    },
  ],
});

export const CONTROL_CATALOG: ControlEntry[] = [
  {
    deviceTypeId: "022910f2-5d5e-5086-b2c7-fa3d1450eb36",
    name: "Sony BRC-H800",
    interfaces: [
      {
        protocol: "VISCA",
        transport: "serial",
        connector: "RJ-45 (VISCA RS-422 In/Out)",
        serial: {
          standard: "RS-422",
          baud: [9600, 38400],
          format: "8N1",
          flowControl: "none (XON/XOFF and RTS/CTS not supported)",
          multidrop: "daisy chain, up to 7 cameras per controller",
        },
        bridge: {
          capable: true,
          tcpMode: "raw TCP server on an RS-422 device server",
          port: "site-chosen on the device server",
          packetization: VISCA_PACKETS,
          unverified: ["RJ-45 pinout"],
        },
        source: SONY_H800_VISCA,
      },
      viscaOverIp(SONY_H800_VISCA),
    ],
  },
  {
    deviceTypeId: "d395a7c8-f074-5eb2-a84b-030fa2eeb8c9",
    name: "Sony FR7",
    interfaces: [viscaOverIp(SONY_FR7_VISCA)],
  },
  {
    deviceTypeId: "7a15a7da-3f17-59cb-896d-8741e61723bb",
    name: "Panasonic AW-UE150",
    interfaces: [
      {
        protocol: "AW protocol",
        transport: "serial",
        connector: "RJ-45 (CONTROL IN RS-422A)",
        serial: { standard: "RS-422" },
        bridge: {
          capable: true,
          tcpMode: "raw TCP server on an RS-422 device server",
          port: "site-chosen on the device server",
          unverified: [
            "baud rate",
            "character format",
            "RJ-45 pinout",
            "packet framing",
          ],
        },
        source: PANA_UE150,
      },
      {
        protocol: "IP control (TCP/IP, UDP/IP, HTTP)",
        transport: "ip",
        connector: "RJ-45 (LAN, 100BASE-TX/1000BASE-T)",
        ip: { layer: "HTTP" },
        source: PANA_UE150,
      },
    ],
  },
  {
    deviceTypeId: "e6699d97-5974-430e-981d-2a6bad93e116",
    name: "Blackmagic Hyperdeck Studio HD Plus",
    interfaces: [
      {
        protocol: "HyperDeck Serial RS-422 Protocol (based on Sony 9-pin)",
        transport: "serial",
        connector: "REMOTE RS-422 In/Out (9-pin)",
        serial: {
          standard: "RS-422",
          baud: [38400],
          format: "8O1",
          pinout: "Rx- 2, Rx+ 7, Tx- 8, Tx+ 3, GND 1/4/6/9",
        },
        bridge: {
          capable: true,
          tcpMode: "raw TCP server on an RS-422 device server",
          port: "site-chosen on the device server",
          unverified: ["packet framing"],
        },
        source: BMD_HYPERDECK,
      },
      {
        protocol: "Blackmagic HyperDeck Ethernet Protocol",
        transport: "ip",
        connector: "Ethernet (1 Gb/s)",
        ip: { layer: "TCP", port: 9993 },
        source: BMD_HYPERDECK,
      },
    ],
  },
  {
    deviceTypeId: "2a3eed49-cc33-45be-ae0f-c5e6c89e818d",
    name: "AJA KUMO 3232-12G",
    interfaces: [
      {
        protocol: "Grass Valley Native Protocol (basic support)",
        transport: "serial",
        connector: "DB-9 female (RS-422)",
        serial: {
          standard: "RS-422",
          pinout: "Tx- 2, Rx+ 3, Tx+ 7, Rx- 8, GND 1/4/6/9/shell, 5 n.c.",
        },
        bridge: {
          capable: true,
          tcpMode: "raw TCP server on an RS-422 device server",
          port: "site-chosen on the device server",
          unverified: ["baud rate", "character format", "packet framing"],
        },
        source: AJA_KUMO_3232_12G,
      },
      {
        protocol:
          "Grass Valley Native Protocol (basic support), KUMO control panels, web server",
        transport: "ip",
        connector: "RJ-45 (10/100/1000 Ethernet)",
        ip: { layer: "HTTP" },
        source: AJA_KUMO_3232_12G,
      },
    ],
  },
];

CONTROL_CATALOG.push(
  panasonicPtz(
    "a36842c2-aaca-5ff8-949c-215cdc71c4a2",
    "Panasonic AW-UE160",
    "aw-ue160",
  ),
  panasonicPtz(
    "88b115e9-fc7e-5388-938f-a2aa62ed683c",
    "Panasonic AW-UE160W",
    "aw-ue160",
  ),
  panasonicPtz(
    "2342f661-a930-5f1b-aaec-e7a369b85fab",
    "Panasonic AW-UE100",
    "aw-ue100",
  ),
  panasonicPtz(
    "e7ed4134-c1b3-5530-ac97-89d01db52bec",
    "Panasonic AW-UE80",
    "aw-ue80",
  ),
  panasonicPtz(
    "dfd168a5-d9e7-568e-8102-2d213e53b59c",
    "Panasonic AW-HE145",
    "aw-he145",
  ),
  bmdStudio(
    "f44f3f5e-6dde-5579-ab72-0c84c04470c2",
    "Blackmagic Studio Camera 6K Pro",
    "RJ-45 (10 Gb/s Ethernet)",
  ),
  bmdStudio(
    "ca069b86-a1ce-438e-a390-28c3445254c0",
    "Blackmagic Studio Camera 4K Pro G2",
    "RJ-45 (10 Gb/s Ethernet)",
  ),
  bmdStudio(
    "57621414-690f-4cd4-b43c-0cd7ccca6acf",
    "Blackmagic Studio Camera 4K Plus G2",
    undefined,
  ),
  {
    deviceTypeId: "2b3a40b1-55a3-5e5d-b65c-5b7bd35c69f1",
    name: "Blackmagic URSA Broadcast G2",
    interfaces: [
      {
        protocol: "Blackmagic SDI Camera Control Protocol",
        transport: "sdi",
        connector: "SDI In (return feed)",
        source: BMD_URSA_BC_G2,
      },
    ],
  },
  kumo(
    "ca069939-edff-479f-acc1-56650a5a1e8e",
    "AJA KUMO 1616-12G",
    "kumo-1616-12g",
    true,
  ),
  kumo(
    "40147c52-679d-4784-a009-f8211be107f9",
    "AJA KUMO 6464-12G",
    "kumo-6464-12g",
    true,
  ),
  kumo(
    "d8584156-1793-4794-a4b4-488cfe834e59",
    "AJA KUMO 1616",
    "kumo-1616",
    false,
  ),
);

// #1063 charge 3. Values from the manufacturer spec pages only.
const URSA_MINI_PRO =
  "https://www.blackmagicdesign.com/products/blackmagicursaminipro/techspecs/W-CUM-17";

const panaIpOnly = (source: string): ControlInterface => ({
  protocol: "IP control (TCP/IP, UDP/IP, HTTP)",
  transport: "ip",
  connector: "RJ-45 (LAN for IP control)",
  ip: { layer: "HTTP" },
  source,
});

const ursaSdi = (deviceTypeId: string, name: string): ControlEntry => ({
  deviceTypeId,
  name,
  interfaces: [
    {
      protocol: "Blackmagic SDI Camera Control Protocol",
      transport: "sdi",
      connector: "SDI In (return feed)",
      source: URSA_MINI_PRO,
    },
  ],
});

const ue20 = panasonicPtz(
  "5b15ba72-e7bc-55b7-b222-39d2163815b4",
  "Panasonic AW-UE20",
  "aw-ue20",
);
ue20.interfaces.splice(1, 0, {
  protocol: "Standard protocol (RS-232C)",
  transport: "serial",
  connector: "Mini DIN 8-pin (IN/OUT)",
  serial: { standard: "RS-232" },
  bridge: {
    capable: true,
    tcpMode: "raw TCP server on an RS-232 device server",
    port: "site-chosen on the device server",
    unverified: [
      "baud rate",
      "character format",
      "Mini DIN pinout",
      "packet framing",
    ],
  },
  source: PANA_SPEC("aw-ue20"),
});

const ur100 = panasonicPtz(
  "ff05ec10-bf37-5d89-8d3e-5df9f8cf0aab",
  "Panasonic AW-UR100",
  "aw-ur100",
);
ur100.interfaces[1] = {
  ...panaIpOnly(PANA_SPEC("aw-ur100")),
  protocol: "IP control (TCP/IP, UDP/IP, HTTP); FreeD, TSL 5.0, SNMP",
};

CONTROL_CATALOG.push(
  ue20,
  panasonicPtz(
    "9711122c-0d40-5f24-bd37-3aac93d35f8f",
    "Panasonic AW-UE50",
    "aw-ue50-40",
  ),
  panasonicPtz(
    "5ee79e22-ea14-55eb-87ba-52f13c9c9bcb",
    "Panasonic AW-UE40",
    "aw-ue50-40",
  ),
  ur100,
  {
    deviceTypeId: "953a92b5-8c16-5358-962b-1ac7b2e6710c",
    name: "Panasonic AW-UE4",
    interfaces: [panaIpOnly(PANA_SPEC("aw-ue4"))],
  },
  ursaSdi(
    "1b94e2d9-f987-4b76-8827-f555d88a2e10",
    "Blackmagic URSA Mini Pro 12K",
  ),
  ursaSdi(
    "841e8039-0e83-4734-904f-bf4ffcdb8882",
    "Blackmagic URSA Mini Pro 4.6K G2",
  ),
  kumo(
    "d435ffb1-c471-4059-89ee-84a490f6025c",
    "AJA KUMO 3232",
    "kumo-3232",
    true,
  ),
  kumo(
    "379c5b0a-a4b5-40d0-a66d-a3fda51b5059",
    "AJA KUMO 6464",
    "kumo-6464",
    true,
  ),
  {
    deviceTypeId: "ecf80e2e-5376-4f86-865f-ce146e90d032",
    name: "AJA Ki Pro Ultra 12G",
    interfaces: [
      {
        protocol: "REST API, web UI",
        transport: "ip",
        connector: "Ethernet (LAN)",
        ip: { layer: "HTTP" },
        source: AJA_KUMO("ki-pro-ultra-12g"),
      },
    ],
  },
);

const BY_ID = new Map(CONTROL_CATALOG.map((e) => [e.deviceTypeId, e]));

/** Control interfaces for a device type, or undefined. */
export const controlInterfacesFor = (deviceTypeId: string | undefined) =>
  deviceTypeId ? BY_ID.get(deviceTypeId)?.interfaces : undefined;

/** Attach the documented control interfaces to a catalogue template. */
export const mitSteuerung = (t: EquipmentTemplate): EquipmentTemplate => {
  const interfaces = controlInterfacesFor(t.deviceTypeId);
  return interfaces && !t.controlInterfaces
    ? { ...t, controlInterfaces: interfaces }
    : t;
};
