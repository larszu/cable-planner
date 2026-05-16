import type { SchematicNode, ConnectionEdge } from "../../../src/types";

// Port handle Y = nodeY + 40 (header) + portIndex * 20 + 10
// Both devices at y=0 → matching port indices share the same Y → straight horizontal edges.

export const connectionDemoNodes: SchematicNode[] = [
  {
    id: "src-cam",
    type: "device",
    position: { x: 0, y: 0 },
    data: {
      label: "Camera",
      deviceType: "camera",
      ports: [
        { id: "p-sdi-out", label: "SDI Out 1", signalType: "sdi", direction: "output" },
        { id: "p-sdi-out2", label: "SDI Out 2", signalType: "sdi", direction: "output" },
        { id: "p-hdmi-out", label: "HDMI Out", signalType: "hdmi", direction: "output" },
      ],
    },
  },
  {
    id: "dst-switcher",
    type: "device",
    position: { x: 400, y: 0 },
    data: {
      label: "Switcher",
      deviceType: "video-switcher",
      ports: [
        { id: "sw-sdi-in1", label: "SDI In 1", signalType: "sdi", direction: "input" },
        { id: "sw-sdi-in2", label: "SDI In 2", signalType: "sdi", direction: "input" },
        { id: "sw-hdmi-in1", label: "HDMI In 1", signalType: "hdmi", direction: "input" },
        { id: "sw-pgm", label: "PGM Out", signalType: "sdi", direction: "output" },
      ],
    },
  },
];

export const connectionDemoEdges: ConnectionEdge[] = [
  {
    id: "demo-edge-1",
    source: "src-cam",
    target: "dst-switcher",
    sourceHandle: "p-sdi-out",
    targetHandle: "sw-sdi-in1",
    data: { signalType: "sdi" },
    style: { stroke: "var(--color-sdi)", strokeWidth: 2 },
  },
];
