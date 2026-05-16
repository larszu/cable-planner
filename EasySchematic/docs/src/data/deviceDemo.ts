import type { SchematicNode, ConnectionEdge } from "../../../src/types";

export const deviceDemoNodes: SchematicNode[] = [
  {
    id: "demo-cam",
    type: "device",
    position: { x: 0, y: 0 },
    data: {
      label: "Camera 1",
      deviceType: "camera",
      ports: [
        { id: "cam-sdi-out", label: "SDI Out", signalType: "sdi", direction: "output" },
        { id: "cam-hdmi-out", label: "HDMI Out", signalType: "hdmi", direction: "output" },
        { id: "cam-genlock", label: "Genlock", signalType: "genlock", direction: "input" },
      ],
    },
  },
  {
    id: "demo-encoder",
    type: "device",
    position: { x: 360, y: 0 },
    data: {
      label: "NDI Encoder",
      deviceType: "ndi-encoder",
      ports: [
        { id: "enc-sdi-in", label: "SDI In", signalType: "sdi", direction: "input" },
        { id: "enc-hdmi-in", label: "HDMI In", signalType: "hdmi", direction: "input" },
        { id: "enc-ndi-out", label: "NDI Out", signalType: "ndi", direction: "output" },
        { id: "enc-eth", label: "Ethernet", signalType: "ethernet", direction: "bidirectional" },
      ],
    },
  },
  {
    id: "demo-monitor",
    type: "device",
    position: { x: 700, y: -20 },
    data: {
      label: "Monitor",
      deviceType: "monitor",
      ports: [
        { id: "mon-sdi-in", label: "SDI In", signalType: "sdi", direction: "input" },
        { id: "mon-hdmi-in", label: "HDMI In", signalType: "hdmi", direction: "input" },
      ],
    },
  },
  {
    id: "demo-switch",
    type: "device",
    position: { x: 700, y: 100 },
    data: {
      label: "Network Switch",
      deviceType: "network-switch",
      ports: [
        { id: "sw-eth-1", label: "Port 1", signalType: "ethernet", direction: "bidirectional" },
        { id: "sw-eth-2", label: "Port 2", signalType: "ethernet", direction: "bidirectional" },
      ],
    },
  },
];

export const deviceDemoEdges: ConnectionEdge[] = [];
