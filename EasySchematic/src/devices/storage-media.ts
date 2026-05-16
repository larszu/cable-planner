import type { DeviceTemplate } from "../types";

/**
 * Storage media templates. Tracked as 0-port cards that drop into media-bay slots
 * (SD card, microSD, CFexpress, NVMe etc.). Pack list rolls them up under their host
 * device so a "12× SDXC for this shoot" line item flows through automatically.
 *
 * Convention: deviceType = "storage-media", slotFamily names the physical slot type.
 * Costs are typical street prices; users can override per-instance.
 */
export const templates: DeviceTemplate[] = [
  {
    id: "sd-sdhc-32",
    deviceType: "storage-media",
    slotFamily: "sd-card",
    label: "SDHC Card (32 GB)",
    manufacturer: "Generic",
    modelNumber: "SDHC-32",
    searchTerms: ["sd", "sdhc", "32gb", "card", "memory"],
    unitCost: 12,
    ports: [],
  },
  {
    id: "sd-sdxc-128",
    deviceType: "storage-media",
    slotFamily: "sd-card",
    label: "SDXC Card (128 GB)",
    manufacturer: "Generic",
    modelNumber: "SDXC-128",
    searchTerms: ["sd", "sdxc", "128gb", "card", "memory"],
    unitCost: 22,
    ports: [],
  },
  {
    id: "sd-sdxc-256",
    deviceType: "storage-media",
    slotFamily: "sd-card",
    label: "SDXC Card (256 GB)",
    manufacturer: "Generic",
    modelNumber: "SDXC-256",
    searchTerms: ["sd", "sdxc", "256gb", "card", "memory"],
    unitCost: 35,
    ports: [],
  },
  {
    id: "sd-sdxc-512",
    deviceType: "storage-media",
    slotFamily: "sd-card",
    label: "SDXC Card (512 GB)",
    manufacturer: "Generic",
    modelNumber: "SDXC-512",
    searchTerms: ["sd", "sdxc", "512gb", "card", "memory"],
    unitCost: 65,
    ports: [],
  },
  {
    id: "sd-microsdxc-128",
    deviceType: "storage-media",
    slotFamily: "microsd-card",
    label: "microSDXC Card (128 GB)",
    manufacturer: "Generic",
    modelNumber: "MICROSDXC-128",
    searchTerms: ["microsd", "microsdxc", "128gb", "card", "memory"],
    unitCost: 18,
    ports: [],
  },
  {
    id: "sd-microsdxc-256",
    deviceType: "storage-media",
    slotFamily: "microsd-card",
    label: "microSDXC Card (256 GB)",
    manufacturer: "Generic",
    modelNumber: "MICROSDXC-256",
    searchTerms: ["microsd", "microsdxc", "256gb", "card", "memory"],
    unitCost: 30,
    ports: [],
  },
];
