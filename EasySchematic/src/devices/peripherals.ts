import { port } from "./_helpers";
import type { DeviceTemplate } from "../types";

export const templates: DeviceTemplate[] = [
  // Mouse
  {
    id: "c0a80101-0028-4000-8000-000000000040",
    deviceType: "mouse",
    label: "Mouse",
    searchTerms: ["mouse", "pointer", "trackpad"],
    powerDrawW: 0, // USB-powered
    ports: [
      port("USB-A", "usb", "bidirectional", "usb-a"),
    ],
  },
  // Keyboard
  {
    id: "c0a80101-0029-4000-8000-000000000041",
    deviceType: "keyboard",
    label: "Keyboard",
    searchTerms: ["keyboard", "keypad"],
    powerDrawW: 0, // USB-powered
    ports: [
      port("USB-A", "usb", "bidirectional", "usb-a"),
    ],
  },
];
