import type { SchematicNode, ConnectionEdge } from "../../../src/types";

// Grid-aligned positions so each edge is a straight horizontal line (no vertical segments).
// Handle Y = nodeY + 40 (header) + portIndex * 20 + 10
//
// Camera N has 1 port → handle at nodeY + 50
// Switcher has 4 ports → In 1 at swY+50, In 2 at swY+70, In 3 at swY+90, PGM at swY+110
// Recorder has 1 port → handle at recY + 50
//
// Align each camera's port 0 to the corresponding switcher input:
//   cam1.y + 50 = sw.y + 50  → cam1.y = sw.y      = 0
//   cam2.y + 50 = sw.y + 70  → cam2.y = sw.y + 20  = 20
//   cam3.y + 50 = sw.y + 90  → cam3.y = sw.y + 40  = 40
//
// But cameras are 60px tall (40 header + 20 port), so at 20px spacing they overlap.
// Instead, stagger cameras with enough vertical room (80px apart) and accept that
// cam2/cam3 edges will have a clean vertical step in the gap between columns.
//
// Cam1 aligned horizontally with In 1. Cam2/Cam3 offset below — their smoothstep
// vertical segments are at x≈250 (well clear of any device at x=0..~160 or x=500+).

export const routingDemoNodes: SchematicNode[] = [
  {
    id: "r-cam1",
    type: "device",
    position: { x: 0, y: 0 },
    data: {
      label: "Camera 1",
      deviceType: "camera",
      ports: [
        { id: "r-c1-sdi", label: "SDI Out", signalType: "sdi", direction: "output" },
      ],
    },
  },
  {
    id: "r-cam2",
    type: "device",
    position: { x: 0, y: 80 },
    data: {
      label: "Camera 2",
      deviceType: "camera",
      ports: [
        { id: "r-c2-sdi", label: "SDI Out", signalType: "sdi", direction: "output" },
      ],
    },
  },
  {
    id: "r-cam3",
    type: "device",
    position: { x: 0, y: 160 },
    data: {
      label: "Camera 3",
      deviceType: "camera",
      ports: [
        { id: "r-c3-sdi", label: "SDI Out", signalType: "sdi", direction: "output" },
      ],
    },
  },
  {
    id: "r-switcher",
    type: "device",
    position: { x: 500, y: 0 },
    data: {
      label: "Switcher",
      deviceType: "video-switcher",
      ports: [
        { id: "r-sw-in1", label: "In 1", signalType: "sdi", direction: "input" },
        { id: "r-sw-in2", label: "In 2", signalType: "sdi", direction: "input" },
        { id: "r-sw-in3", label: "In 3", signalType: "sdi", direction: "input" },
        { id: "r-sw-pgm", label: "PGM", signalType: "sdi", direction: "output" },
      ],
    },
  },
  {
    id: "r-recorder",
    type: "device",
    position: { x: 860, y: 60 },
    data: {
      label: "Recorder",
      deviceType: "recorder",
      ports: [
        { id: "r-rec-in", label: "SDI In", signalType: "sdi", direction: "input" },
      ],
    },
  },
];

export const routingDemoEdges: ConnectionEdge[] = [
  {
    id: "r-e1",
    source: "r-cam1",
    target: "r-switcher",
    sourceHandle: "r-c1-sdi",
    targetHandle: "r-sw-in1",
    data: { signalType: "sdi" },
    style: { stroke: "var(--color-sdi)", strokeWidth: 2 },
  },
  {
    id: "r-e2",
    source: "r-cam2",
    target: "r-switcher",
    sourceHandle: "r-c2-sdi",
    targetHandle: "r-sw-in2",
    data: { signalType: "sdi" },
    style: { stroke: "var(--color-sdi)", strokeWidth: 2 },
  },
  {
    id: "r-e3",
    source: "r-cam3",
    target: "r-switcher",
    sourceHandle: "r-c3-sdi",
    targetHandle: "r-sw-in3",
    data: { signalType: "sdi" },
    style: { stroke: "var(--color-sdi)", strokeWidth: 2 },
  },
  {
    id: "r-e4",
    source: "r-switcher",
    target: "r-recorder",
    sourceHandle: "r-sw-pgm",
    targetHandle: "r-rec-in",
    data: { signalType: "sdi" },
    style: { stroke: "var(--color-sdi)", strokeWidth: 2 },
  },
];
