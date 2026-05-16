import type { SchematicNode, ConnectionEdge } from "../../../src/types";

// Signal flows left-to-right: Camera (Stage) → Switcher (Control Booth).
// Devices are at the same relative position within their rooms so port Y-levels
// align and the smoothstep edge is a straight horizontal line.

export const roomDemoNodes: SchematicNode[] = [
  {
    id: "room-stage",
    type: "room",
    position: { x: 0, y: 0 },
    data: { label: "Stage" },
    style: { width: 300, height: 180 },
    zIndex: -1,
  },
  {
    id: "rm-camera",
    type: "device",
    position: { x: 20, y: 40 },
    parentId: "room-stage",
    data: {
      label: "Camera",
      deviceType: "camera",
      ports: [
        { id: "rm-cam-sdi", label: "SDI Out", signalType: "sdi", direction: "output" },
      ],
    },
  },
  {
    id: "room-booth",
    type: "room",
    position: { x: 480, y: 0 },
    data: { label: "Control Booth" },
    style: { width: 300, height: 180 },
    zIndex: -1,
  },
  {
    id: "rm-switcher",
    type: "device",
    position: { x: 20, y: 40 },
    parentId: "room-booth",
    data: {
      label: "Switcher",
      deviceType: "video-switcher",
      ports: [
        { id: "rm-sw-in", label: "SDI In", signalType: "sdi", direction: "input" },
        { id: "rm-sw-pgm", label: "PGM", signalType: "sdi", direction: "output" },
      ],
    },
  },
];

export const roomDemoEdges: ConnectionEdge[] = [
  {
    id: "rm-e1",
    source: "rm-camera",
    target: "rm-switcher",
    sourceHandle: "rm-cam-sdi",
    targetHandle: "rm-sw-in",
    data: { signalType: "sdi" },
    style: { stroke: "var(--color-sdi)", strokeWidth: 2 },
  },
];
