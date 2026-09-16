import type { Camera, SensorSize, AdapterInfo, Lens } from './types';

// ── Standard sensor sizes ──
export const SENSORS: Record<string, SensorSize> = {
  FF:        { name: 'Full Frame (36×24)',     widthMm: 36,    heightMm: 24,    cropFactor: 1.0 },
  S35:       { name: 'Super 35 (24.6×13.8)',   widthMm: 24.6,  heightMm: 13.8,  cropFactor: 1.46 },
  APSC:      { name: 'APS-C (23.5×15.6)',      widthMm: 23.5,  heightMm: 15.6,  cropFactor: 1.53 },
  MFT:       { name: 'Micro Four Thirds',      widthMm: 17.3,  heightMm: 13,    cropFactor: 2.0 },
  ONE_INCH:  { name: '1" (13.2×8.8)',          widthMm: 13.2,  heightMm: 8.8,   cropFactor: 2.73 },
  TWO_THIRD: { name: '2/3" (9.6×5.4)',         widthMm: 9.6,   heightMm: 5.4,   cropFactor: 3.93 },
  HALF_INCH: { name: '1/2" (6.4×4.8)',         widthMm: 6.4,   heightMm: 4.8,   cropFactor: 5.63 },
  THIRD_INCH:{ name: '1/3" (4.8×3.6)',         widthMm: 4.8,   heightMm: 3.6,   cropFactor: 7.5 },
  QUARTER:   { name: '1/2.3" (6.17×4.55)',     widthMm: 6.17,  heightMm: 4.55,  cropFactor: 5.64 },
};

export const CAMERAS: Camera[] = [
  // ── Sony Broadcast / Cinema ──
  { id: 'sony-hdc-3500', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-3500', manufacturer: 'Sony', model: 'HDC-3500', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'sony-hdc-5500', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-5500', manufacturer: 'Sony', model: 'HDC-5500', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'sony-hdc-f5500', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-f5500', manufacturer: 'Sony', model: 'HDC-F5500', sensor: SENSORS.S35, mount: 'PL', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'Super 35mm broadcast camera' },
  { id: 'sony-venice', manufacturerUrl: 'https://pro.sony/ue_US/products/digital-cinema-cameras/venice', manufacturer: 'Sony', model: 'VENICE', sensor: SENSORS.FF, mount: 'PL', adaptedMounts: ['E'], resolutions: ['6K', '4K', 'HD'], type: 'cinema', notes: 'Full-frame CineAlta, PL native, E-mount via supplied adapter', mountAdapters: {
    E: { name: 'Sony VENICE E-mount Adapter', lightLossStops: 0, notes: 'Sony ships VENICE with both a PL mount block and an E-mount block; swapping between them is a mechanical change with no optical relay and no light loss. The same full-frame sensor area is used.' },
  } },
  { id: 'sony-venice2', manufacturerUrl: 'https://pro.sony/ue_US/products/digital-cinema-cameras/venice2', manufacturer: 'Sony', model: 'VENICE 2', sensor: { name: 'FF 8.6K (36.2×24.1)', widthMm: 36.2, heightMm: 24.1, cropFactor: 0.99 }, mount: 'PL', adaptedMounts: ['E'], resolutions: ['8.6K', '6K', '4K', 'HD'], type: 'cinema', notes: 'Dual base ISO 800/3200, PL native, E-mount adapter', sensorModes: [
    { name: 'FF 8.6K (36.2×24.1)', widthMm: 36.2, heightMm: 24.1, cropFactor: 0.99 },
    { name: 'FF 6K 3:2 (35.9×24.0)', widthMm: 35.9, heightMm: 24.0, cropFactor: 1.0 },
    { name: 'S35 5.8K (24.8×13.1)', widthMm: 24.8, heightMm: 13.1, cropFactor: 1.46 },
    { name: 'S35 4K 4:3 (19.0×14.2)', widthMm: 19.0, heightMm: 14.2, cropFactor: 1.89 },
  ], mountAdapters: {
    E: { name: 'Sony VENICE 2 E-mount Adapter', lightLossStops: 0, notes: 'Mechanical mount-block swap, no optical relay. The full sensor area stays available — choose the desired window via the Sensor Mode dropdown.' },
  } },
  { id: 'sony-pmw-f5', manufacturerUrl: 'https://pro.sony/ue_US/products/digital-cinema-cameras/pmw-f5', deviceTypeId: 'f54cdfa3-1708-4b05-9179-4a8769c0b891', manufacturer: 'Sony', model: 'PMW-F5', sensor: SENSORS.S35, mount: 'FZ', adaptedMounts: ['PL', 'B4', 'EF', 'NF'], resolutions: ['4K', '2K', 'HD'], type: 'cinema', notes: 'FZ-mount native; PL/B4 via Sony adapter, EF via Metabones FZ-EF CINE, NF via Metabones FZ-NF', mountAdapters: {
    PL: { name: 'Sony VCT-FZ55B PL Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-FZ adapter. No optical relay, no light loss; the full Super-35 sensor is used.' },
    B4: { name: 'Sony LA-FZB1 / LA-FZB2', lightLossStops: 1.0, cropSensor: SENSORS.TWO_THIRD, notes: 'B4 mount adapter with internal 2× relay optics. Crops the Super-35 sensor down to the 2/3" image circle the B4 lens projects, and costs ~1 T-stop of light through the relay glass.' },
    EF: { name: 'Metabones EF → FZ Smart CINE Adapter', lightLossStops: 0, notes: 'Smart EF-to-FZ adapter with electronic aperture control. Passive optically — no light loss, full Super-35 sensor used.' },
    NF: { name: 'Metabones Nikon F → FZ Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-FZ adapter. Manual aperture only. No optical relay.' },
  } },
  { id: 'sony-pmw-f55', manufacturerUrl: 'https://pro.sony/ue_US/products/digital-cinema-cameras/pmw-f55', deviceTypeId: 'eb02ca7e-856c-40ab-9a73-d1e98110f003', manufacturer: 'Sony', model: 'PMW-F55', sensor: SENSORS.S35, mount: 'FZ', adaptedMounts: ['PL', 'B4', 'EF', 'NF'], resolutions: ['4K', '2K', 'HD'], type: 'cinema', notes: 'FZ-mount native; PL/B4 via Sony adapter, EF via Metabones FZ-EF CINE, NF via Metabones FZ-NF', mountAdapters: {
    PL: { name: 'Sony VCT-FZ55B PL Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-FZ adapter. No optical relay, no light loss; the full Super-35 sensor is used.' },
    B4: { name: 'Sony LA-FZB1 / LA-FZB2', lightLossStops: 1.0, cropSensor: SENSORS.TWO_THIRD, notes: 'B4 mount adapter with internal 2× relay optics. Crops the Super-35 sensor down to the 2/3" image circle the B4 lens projects, and costs ~1 T-stop of light through the relay glass.' },
    EF: { name: 'Metabones EF → FZ Smart CINE Adapter', lightLossStops: 0, notes: 'Smart EF-to-FZ adapter with electronic aperture control. Passive optically — no light loss, full Super-35 sensor used.' },
    NF: { name: 'Metabones Nikon F → FZ Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-FZ adapter. Manual aperture only. No optical relay.' },
  } },
  { id: 'sony-fx6', manufacturerUrl: 'https://sony-mea.com/en/electronics/professional-video-cameras/ilme-fx6/specifications', deviceTypeId: 'a823f2ff-3be9-4c45-af4e-bd4f6b13f7d7', manufacturer: 'Sony', model: 'FX6', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF', 'NF'], resolutions: ['4K', 'HD'], type: 'cinema', notes: 'E-mount native; PL via Metabones PL → E CINE, EF via Metabones EF → E', mountAdapters: {
    PL: { name: 'Metabones PL → E CINE Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-E adapter. No light loss, full sensor.' },
    EF: { name: 'Metabones EF → E Smart Adapter (Mk V)', lightLossStops: 0, notes: 'Smart EF-to-E adapter with electronic aperture/AF. Passive optically.' },
    NF: { name: 'Nikon F → E Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-E adapter. Manual aperture only.' },
  } },
  { id: 'sony-fx3', manufacturerUrl: 'https://www.sony-asia.com/electronics/support/camcorders-interchangeable-lens-camcorders/ilme-fx3/specifications', deviceTypeId: '3cd5dd2d-7d51-4af9-ad59-25860aa4baa2', manufacturer: 'Sony', model: 'FX3', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF', 'NF'], resolutions: ['4K', 'HD'], type: 'cinema', notes: 'E-mount native; PL/EF via passive adapter', mountAdapters: {
    PL: { name: 'PL → E Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-E adapter (Metabones, Sigma MC-11 variants).' },
    EF: { name: 'Metabones EF → E Smart Adapter (Mk V)', lightLossStops: 0, notes: 'Smart EF-to-E adapter with electronic aperture/AF.' },
    NF: { name: 'Nikon F → E Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-E adapter. Manual aperture only.' },
  } },
  { id: 'sony-fx9', manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/pxw-fx9', deviceTypeId: '05d88e97-2f3d-4b16-868c-f13f202754c5', manufacturer: 'Sony', model: 'PXW-FX9', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF', 'NF'], resolutions: ['6K', '4K', 'HD'], type: 'cinema', notes: 'E-mount native; PL/EF via adapter', sensorModes: [
    { name: 'Full Frame (35.7×18.8)', widthMm: 35.7, heightMm: 18.8, cropFactor: 1.0 },
    { name: 'Super 35 crop (23.6×12.4)', widthMm: 23.6, heightMm: 12.4, cropFactor: 1.51 },
  ], mountAdapters: {
    PL: { name: 'Metabones PL → E CINE Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-E adapter. No light loss.' },
    EF: { name: 'Metabones EF → E Smart Adapter (Mk V)', lightLossStops: 0, notes: 'Smart EF-to-E adapter with electronic aperture/AF.' },
    NF: { name: 'Nikon F → E Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-E adapter. Manual aperture only.' },
  } },
  { id: 'sony-fs7ii', manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/pxw-fs7m2', deviceTypeId: 'ff69e6b9-7a72-4eb2-ba53-df17fd8bfdf7', manufacturer: 'Sony', model: 'PXW-FS7 II', sensor: SENSORS.S35, mount: 'E', adaptedMounts: ['PL', 'EF', 'NF'], resolutions: ['4K', 'HD'], type: 'cinema', notes: 'E-mount native; PL/EF via adapter', mountAdapters: {
    PL: { name: 'Metabones PL → E CINE Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-E adapter. No light loss.' },
    EF: { name: 'Metabones EF → E Smart Adapter (Mk V)', lightLossStops: 0, notes: 'Smart EF-to-E adapter with electronic aperture/AF.' },
    NF: { name: 'Nikon F → E Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-E adapter. Manual aperture only.' },
  } },
  { id: 'sony-a7siii', manufacturerUrl: 'https://www.sony.co.uk/electronics/support/e-mount-body-ilce-7-series/ilce-7sm3/specifications', manufacturer: 'Sony', model: 'A7S III', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF', 'NF'], resolutions: ['4K', 'HD'], type: 'mirrorless', mountAdapters: {
    PL: { name: 'PL → E Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-E adapter.' },
    EF: { name: 'Sigma MC-11 / Metabones EF → E', lightLossStops: 0, notes: 'Smart EF-to-E adapter, AF supported on most Canon EF lenses.' },
    NF: { name: 'Nikon F → E Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-E adapter. Manual aperture only.' },
  } },
  { id: 'sony-a7iv', manufacturerUrl: 'https://www.sony-asia.com/interchangeable-lens-cameras/products/ilce-7m4', manufacturer: 'Sony', model: 'A7 IV', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF', 'NF'], resolutions: ['4K', 'HD'], type: 'mirrorless', mountAdapters: {
    PL: { name: 'PL → E Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-E adapter.' },
    EF: { name: 'Sigma MC-11 / Metabones EF → E', lightLossStops: 0, notes: 'Smart EF-to-E adapter, AF supported on most Canon EF lenses.' },
    NF: { name: 'Nikon F → E Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-E adapter. Manual aperture only.' },
  } },
  { id: 'sony-fr7', manufacturerUrl: 'https://pro.sony/en_CO/products/ptz-network-cameras/ilme-fr7', manufacturer: 'Sony', model: 'FR7', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF', 'NF'], resolutions: ['4K', 'HD'], type: 'ptz', notes: 'Full-frame PTZ; E-mount native, PL/EF via adapter', mountAdapters: {
    PL: { name: 'PL → E Adapter', lightLossStops: 0, notes: 'Mechanical PL-to-E adapter. Add a support bracket for heavier PL glass.' },
    EF: { name: 'Metabones EF → E Smart Adapter', lightLossStops: 0, notes: 'Smart EF-to-E adapter with electronic aperture.' },
    NF: { name: 'Nikon F → E Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-E adapter. Manual aperture only.' },
  } },

  // ── Sony ENG Camcorder ──
  { id: 'sony-pdw-700', manufacturerUrl: 'https://pro.sony/ue_US/products/shoulder-camcorders/pdw-700', manufacturer: 'Sony', model: 'PDW-700', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'eng', notes: 'XDCAM HD422, 2/3" 3-CCD' },
  { id: 'sony-pdw-850', manufacturerUrl: 'https://pro.sony/ue_US/products/shoulder-camcorders/pdw-850', manufacturer: 'Sony', model: 'PDW-850', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'eng', notes: 'XDCAM HD422, shoulder camcorder' },
  { id: 'sony-pdw-f800', manufacturerUrl: 'https://pro.sony/ue_US/products/shoulder-camcorders/pdw-f800', manufacturer: 'Sony', model: 'PDW-F800', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'eng', notes: 'XDCAM HD422, 3-CCD' },
  { id: 'sony-hdc-4300', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-4300', manufacturer: 'Sony', model: 'HDC-4300', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: '4K 3-CMOS system camera' },

  // ── Sony PTZ ──
  { id: 'sony-brc-x400', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/brc-x400', manufacturer: 'Sony', model: 'BRC-X400', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'sony-srg-x120', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/srg-x120', manufacturer: 'Sony', model: 'SRG-X120', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'sony-brc-h800', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/brc-h800', manufacturer: 'Sony', model: 'BRC-H800', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['HD'], type: 'ptz', notes: '1.0-type Exmor R CMOS (Quelle: pro.sony BRC-H800)' },

  // ── Canon Broadcast / Cinema ──
  { id: 'canon-c500ii', manufacturerUrl: 'https://www.canon-europe.com/video-cameras/eos-c500-mark-ii/specifications/', deviceTypeId: '87fc07c8-7327-466d-9fd1-eac259af154e', manufacturer: 'Canon', model: 'C500 Mark II', sensor: SENSORS.FF, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['5.9K', '4K', 'HD'], type: 'cinema', notes: 'EF native; PL via Canon swappable mount kit', mountAdapters: {
    PL: { name: 'Canon C500 II PL Mount Kit', lightLossStops: 0, notes: 'Canon-official swappable PL mount unit. Mechanical change only — no relay, no light loss; the full sensor area stays available.' },
  } },
  { id: 'canon-c300iii', manufacturerUrl: 'https://www.canon-europe.com/video-cameras/eos-c300-mark-iii/specifications/', deviceTypeId: 'bfdc4077-32b8-4f1b-b9a5-6f875b37816c', manufacturer: 'Canon', model: 'C300 Mark III', sensor: SENSORS.S35, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['4K', 'HD'], type: 'cinema', notes: 'EF native; PL via Canon swappable mount kit', mountAdapters: {
    PL: { name: 'Canon C300 III PL Mount Kit', lightLossStops: 0, notes: 'Canon-official swappable PL mount unit. Mechanical change only — no relay, no light loss.' },
  } },
  { id: 'canon-c70', manufacturerUrl: 'https://www.canon-europe.com/video-cameras/eos-c70/specifications/', deviceTypeId: 'fd8fdb1a-0927-4d70-9c8b-f40ef5ef0fdb', manufacturer: 'Canon', model: 'C70', sensor: SENSORS.S35, mount: 'RF', adaptedMounts: ['EF', 'PL'], resolutions: ['4K', 'HD'], type: 'cinema', notes: 'RF native; EF via Canon EF-EOS R 0.71×, PL via Wooden Camera adapter', mountAdapters: {
    EF: { name: 'Canon EF → RF 0.71× Speed Booster Adapter', lightLossStops: -1.0, notes: 'Canon-official EF-EOS R 0.71× cinema adapter widens FOV by 1/0.71 and brightens by ~1 stop. Full electronic EF compatibility.' },
    PL: { name: 'Wooden Camera PL → RF Adapter', lightLossStops: 0, notes: 'Passive PL-to-RF adapter (Wooden Camera, Vocas). Mechanical only — full sensor area available, no light loss.' },
  } },
  { id: 'canon-xf605', manufacturerUrl: 'https://www.canon-europe.com/video-cameras/xf605/specifications/', manufacturer: 'Canon', model: 'XF605', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  { id: 'canon-cr-n500', manufacturerUrl: 'https://www.canon-europe.com/ptz-cameras/cr-n500/specifications/', manufacturer: 'Canon', model: 'CR-N500', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'canon-cr-n300', manufacturerUrl: 'https://www.canon-europe.com/ptz-cameras/cr-n300/specifications/', manufacturer: 'Canon', model: 'CR-N300', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },

  // ── Panasonic ──
  { id: 'pana-ak-uc4000', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/ak-uc4000/spec.html', manufacturer: 'Panasonic', model: 'AK-UC4000', sensor: SENSORS.S35, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'Large-format single 4.4K MOS sensor (S35-class); built-in optical block adapts 2/3" B4 lenses (Quelle: pro-av.panasonic.net/en/products/ak-uc4000)' },
  { id: 'pana-ak-uc3300', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/ak-uc3300/spec.html', manufacturer: 'Panasonic', model: 'AK-UC3300', sensor: SENSORS.S35, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'Large-format single S35 MOS 4K sensor; built-in conversion lens adapts 2/3" B4 lenses (Quelle: pro-av.panasonic.net/en/products/ak-uc3300)' },
  { id: 'pana-ak-hc5000', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/ak-hc5000/spec.html', manufacturer: 'Panasonic', model: 'AK-HC5000', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'pana-eva1', manufacturerUrl: 'https://pro-av.panasonic.net/en/cinema_camera_varicam_eva/products/eva1/', manufacturer: 'Panasonic', model: 'AU-EVA1', sensor: SENSORS.S35, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['5.7K', '4K', 'HD'], type: 'cinema', notes: 'EF native; PL via Wooden Camera mount', mountAdapters: {
    PL: { name: 'Wooden Camera PL → EF Mount (EVA1)', lightLossStops: 0, notes: 'Replaces the EVA1 EF mount with a PL mount. Mechanical only — no relay, no light loss; the full Super-35 sensor remains.' },
  } },
  { id: 'pana-aw-ue150', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue150/spec.html', manufacturer: 'Panasonic', model: 'AW-UE150', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },

  // ── Blackmagic Design ──
  { id: 'bmd-ursa-broadcast-g2', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursabroadcast/techspecs', manufacturer: 'Blackmagic', model: 'URSA Broadcast G2', sensor: { name: 'BMD 6K (23.1×12.99)', widthMm: 23.1, heightMm: 12.99, cropFactor: 1.56 }, mount: 'B4', adaptedMounts: ['EF', 'PL'], resolutions: ['6K', '4K', 'HD'], type: 'broadcast', notes: 'B4 native, EF/PL via adapter. Broadcast camera with cinema sensor.', sensorModes: [
    { name: '6K Full (23.1×12.99)', widthMm: 23.1, heightMm: 12.99, cropFactor: 1.56 },
    { name: '4K UHD S16 crop (12.4×6.97)', widthMm: 12.4, heightMm: 6.97, cropFactor: 2.91 },
  ], mountAdapters: {
    B4: { name: 'Built-in B4 relay (2/3" mount plate)', lightLossStops: 1.0, cropSensor: SENSORS.TWO_THIRD, notes: 'The URSA Broadcast G2\'s B4 mount has internal relay optics that crop the 6K sensor to a 2/3" image area to match the B4 lens\'s smaller image circle. Costs ~1 T-stop. Swap to the EF or PL plate to use the full Super-35-ish sensor.' },
    EF: { name: 'URSA Mini EF Mount Plate', lightLossStops: 0, notes: 'Removes the B4 relay so the full 6K image area is available. EF lenses sit native — no light loss, no extra crop.' },
    PL: { name: 'URSA Mini PL Mount Plate', lightLossStops: 0, notes: 'Removes the B4 relay so the full 6K image area is available. PL cine lenses sit native — no light loss, no extra crop.' },
  } },
  { id: 'bmd-ursa-12k', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursaminipro/techspecs/W-URSA-36', manufacturer: 'Blackmagic', model: 'URSA Mini Pro 12K', sensor: SENSORS.S35, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['12K', '8K', '4K'], type: 'cinema', sensorModes: [
    { name: '12K Full S35 (27.03×14.25)', widthMm: 27.03, heightMm: 14.25, cropFactor: 1.33 },
    { name: '12K 8:1 Open Gate (27.03×19.04)', widthMm: 27.03, heightMm: 19.04, cropFactor: 1.30 },
    { name: '8K S16 crop (18.0×9.5)', widthMm: 18.0, heightMm: 9.5, cropFactor: 2.0 },
    { name: '6K S16 crop (13.5×7.13)', widthMm: 13.5, heightMm: 7.13, cropFactor: 2.66 },
  ], mountAdapters: {
    EF: { name: 'URSA Mini EF Mount Plate', lightLossStops: 0, notes: 'Mechanical swap of the PL block for the EF block — no optical relay, no light loss. The same full sensor area is available; choose the desired crop via the Sensor Mode dropdown.' },
  } },
  { id: 'bmd-ursa-g2', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursaminipro/techspecs/W-URSA-34', manufacturer: 'Blackmagic', model: 'URSA Mini Pro G2', sensor: SENSORS.S35, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['4.6K', '4K', 'HD'], type: 'cinema', mountAdapters: {
    EF: { name: 'URSA Mini EF Mount Plate', lightLossStops: 0, notes: 'Passive mechanical mount-plate swap. Full Super-35 sensor area available either way.' },
  } },
  { id: 'bmd-ursa-46k', manufacturerUrl: 'https://www.blackmagicdesign.com/media/release/20170302-01', manufacturer: 'Blackmagic', model: 'URSA Mini Pro 4.6K', sensor: SENSORS.S35, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['4.6K', '4K', 'HD'], type: 'cinema', mountAdapters: {
    EF: { name: 'URSA Mini EF Mount Plate', lightLossStops: 0, notes: 'Passive mechanical mount-plate swap. Full Super-35 sensor area available either way.' },
  } },
  { id: 'bmd-pocket6kpro', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera/techspecs', manufacturer: 'Blackmagic', model: 'Pocket Cinema 6K Pro', sensor: SENSORS.S35, mount: 'EF', resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  { id: 'bmd-pocket6k', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera/techspecs/W-CIN-19', manufacturer: 'Blackmagic', model: 'Pocket Cinema 6K G2', sensor: SENSORS.S35, mount: 'EF', resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  { id: 'bmd-pocket4k', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera/techspecs/W-CIN-12', manufacturer: 'Blackmagic', model: 'Pocket Cinema 4K', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'cinema' },
  { id: 'bmd-cinema-camera-6k', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagiccinemacamera/techspecs', manufacturer: 'Blackmagic', model: 'Cinema Camera 6K', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF', 'PL', 'NF'], resolutions: ['6K', '4K', 'HD'], type: 'cinema', notes: 'Full-frame, L-mount native; EF/PL/Nikon F via adapter', mountAdapters: {
    EF: { name: 'EF → L Adapter', lightLossStops: 0, notes: 'Passive EF-to-L adapter (Sigma MC-21, Novoflex, etc.). Mechanical only — full-frame sensor area available, no light loss.' },
    PL: { name: 'PL → L Adapter', lightLossStops: 0, notes: 'Passive PL-to-L adapter. PL has a longer flange distance than L, so an empty barrel fits between them. No optical penalty.' },
    NF: { name: 'Nikon F → L Adapter', lightLossStops: 0, notes: 'Mechanical Nikon-F-to-L adapter (Novoflex, Megadap). Manual aperture only — no electronics.' },
  } },
  { id: 'bmd-pyxis-6k', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpyxis/techspecs', manufacturer: 'Blackmagic', model: 'PYXIS 6K', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['PL', 'EF'], resolutions: ['6K', '4K', 'HD'], type: 'cinema', notes: 'Full-frame box-style, L-mount native', mountAdapters: {
    PL: { name: 'PYXIS PL Mount (interchangeable)', lightLossStops: 0, notes: 'Passive PL mount block for the PYXIS 6K. Mechanical change only — full-frame 6K sensor area is used either way.' },
    EF: { name: 'PYXIS EF Mount (interchangeable)', lightLossStops: 0, notes: 'Passive EF mount block for the PYXIS 6K. Electronic aperture control is supported. No optical penalty.' },
  } },
  { id: 'bmd-studio4kplus', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicstudiocamera', manufacturer: 'Blackmagic', model: 'Studio Camera 4K Plus', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'bmd-studio4kpro', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicstudiocamera/techspecs/W-CST-12', manufacturer: 'Blackmagic', model: 'Studio Camera 4K Pro G2', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'bmd-studio6kpro', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicstudiocamera/techspecs/W-CST-11', manufacturer: 'Blackmagic', model: 'Studio Camera 6K Pro', sensor: SENSORS.S35, mount: 'EF', resolutions: ['6K', '4K', 'HD'], type: 'broadcast' },
  { id: 'bmd-micro-studio-4k-g2', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicmicrostudiocamera/techspecs', manufacturer: 'Blackmagic', model: 'Micro Studio Camera 4K G2', sensor: SENSORS.MFT, mount: 'MFT', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'Micro form factor, MFT native, EF via adapter or EF Speedbooster', mountAdapters: {
    EF: { name: 'EF → MFT Adapter (passive)', lightLossStops: 0, notes: 'Standard EF-to-MFT adapter — purely mechanical, no glass, manual aperture control only. For light gain + wider FOV, enable Speed Booster instead.' },
  } },

  // ── Grass Valley ──
  { id: 'gv-ldx-100', manufacturerUrl: 'https://www.grassvalley.com/ldx-100/', manufacturer: 'Grass Valley', model: 'LDX 100', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'gv-ldx-150', manufacturerUrl: 'https://www.grassvalley.com/products/cameras/ldx-100-series/ldx-150/', manufacturer: 'Grass Valley', model: 'LDX 150', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K UHD', 'HD', '3x HD'], type: 'broadcast' },

  // ── Hitachi ──
  { id: 'hitachi-sk-hd1800', manufacturerUrl: 'https://www.hitachi-kokusai.co.jp/global/en/products/broadcast/camera/hd/sk-hd1800/sk-hd1800_f.html', manufacturer: 'Hitachi', model: 'SK-HD1800', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'hitachi-sk-uhd7000', manufacturerUrl: 'https://www.kokusaidenki.co.jp/kde/global/en/products/broadcast/download/pdf/SK-UHD7000_CU-UHD7000.pdf', manufacturer: 'Hitachi', model: 'SK-UHD7000', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },

  // ── ARRI ──
  { id: 'arri-alexa-35', manufacturerUrl: 'https://www.arri.com/en/camera-systems/cameras/alexa-35', manufacturer: 'ARRI', model: 'ALEXA 35', sensor: { name: 'ARRI ALEV 4 (27.99×19.22)', widthMm: 27.99, heightMm: 19.22, cropFactor: 1.29 }, mount: 'LPL', adaptedMounts: ['EF', 'LPL'], resolutions: ['4.6K', '4K', 'HD'], type: 'cinema', notes: 'ALEV 4 Super35; LPL nativ, PL via PL-zu-LPL-Adapter (Quelle: arri.com ALEXA 35)', sensorModes: [
    { name: '4.6K 3:2 Open Gate (27.99×19.22)', widthMm: 27.99, heightMm: 19.22, cropFactor: 1.29 },
    { name: '4K 16:9 (24.88×13.99)', widthMm: 24.88, heightMm: 13.99, cropFactor: 1.45 },
    { name: '4K 2:1 (27.99×13.99)', widthMm: 27.99, heightMm: 13.99, cropFactor: 1.29 },
    { name: '4K S16 (12.42×7.0)', widthMm: 12.42, heightMm: 7.0, cropFactor: 2.91 },
  ], mountAdapters: {
    EF: { name: 'ARRI EF Mount (LBUS) for ALEXA 35', lightLossStops: 0, notes: 'ARRI-official EF mount module. Passive optically — full ALEV 4 sensor area available, no light loss. Electronic aperture control via LBUS.' },
    LPL: { name: 'ARRI LPL Mount for ALEXA 35', lightLossStops: 0, notes: 'Swappable LPL mount module. LPL is mechanically larger than PL with a shorter flange depth, designed for ARRI Signature Primes. No optical relay.' },
  } },
  { id: 'arri-amira', manufacturerUrl: 'https://www.arri.com/en/camera-systems/cameras/amira', manufacturer: 'ARRI', model: 'AMIRA', sensor: { name: 'ARRI ALEV III (28.17×18.13)', widthMm: 28.17, heightMm: 18.13, cropFactor: 1.29 }, mount: 'PL', adaptedMounts: ['EF', 'B4'], resolutions: ['4K UHD', 'HD'], type: 'cinema', notes: 'PL native; EF/B4 via ARRI mount kits', mountAdapters: {
    EF: { name: 'ARRI EF Mount Module (AMIRA)', lightLossStops: 0, notes: 'ARRI-official EF mount kit for the AMIRA. Mechanical swap, no relay, full Super-35 sensor available.' },
    B4: { name: 'ARRI B4 Mount Kit (AMIRA) — 2/3" relay', lightLossStops: 1.0, cropSensor: SENSORS.TWO_THIRD, notes: 'B4 lens mount with internal 2× relay optics that crop the Super-35 sensor to a 2/3" image circle. Costs ~1 T-stop.' },
  } },

  // ── RED ──
  { id: 'red-v-raptor', manufacturerUrl: 'https://www.reddigitalcinema.com/v-raptor-xl', manufacturer: 'RED', model: 'V-RAPTOR XL', sensor: { name: 'RED VV (40.96×21.6)', widthMm: 40.96, heightMm: 21.6, cropFactor: 0.93 }, mount: 'PL', adaptedMounts: ['EF', 'L', 'RF'], resolutions: ['8K', '6K', '4K'], type: 'cinema', notes: 'PL native (LPL optional); EF/L/RF via interchangeable RED mounts', mountAdapters: {
    EF: { name: 'RED V-RAPTOR EF Mount', lightLossStops: 0, notes: 'RED-official swappable EF mount. Mechanical change only — full VistaVision sensor area available, no light loss.' },
    L: { name: 'RED V-RAPTOR L-mount', lightLossStops: 0, notes: 'RED-official swappable L-mount. Useful with Sigma / Leica L lenses. Passive optically.' },
    RF: { name: 'RED V-RAPTOR RF Mount', lightLossStops: 0, notes: 'RED-official swappable Canon RF mount. Electronic aperture / IS supported with most RF glass.' },
  } },

  { id: 'red-komodo', manufacturerUrl: 'https://www.reddigitalcinema.com/komodo', manufacturer: 'RED', model: 'KOMODO 6K', sensor: { name: 'RED S35 6K (27.03×14.25)', widthMm: 27.03, heightMm: 14.25, cropFactor: 1.42 }, mount: 'RF', adaptedMounts: ['PL', 'EF'], resolutions: ['6K', '4K', '2K'], type: 'cinema', notes: 'Canon RF native; PL/EF via adapter' },
  { id: 'red-komodo-x', manufacturerUrl: 'https://www.reddigitalcinema.com/komodo-x', manufacturer: 'RED', model: 'KOMODO-X 6K', sensor: { name: 'RED S35 6K (27.03×14.25)', widthMm: 27.03, heightMm: 14.25, cropFactor: 1.42 }, mount: 'RF', adaptedMounts: ['PL', 'EF'], resolutions: ['6K', '4K', '2K'], type: 'cinema', notes: 'Canon RF native; PL/EF via adapter' },

  // ── Weitere verbreitete Cinema-Kameras (Sensor-Masse laut Datenblatt, 2026-09) ──
  { id: 'arri-alexa-mini-lf', manufacturerUrl: 'https://www.arri.com/en/camera-systems/cameras/alexa-mini-lf', manufacturer: 'ARRI', model: 'ALEXA Mini LF', sensor: { name: 'ARRI ALEV 3 LF (36.70×25.54)', widthMm: 36.70, heightMm: 25.54, cropFactor: 0.97 }, mount: 'LPL', adaptedMounts: ['PL', 'EF'], resolutions: ['4.5K', 'UHD', 'HD'], type: 'cinema', notes: 'LPL native; PL via LPL-zu-PL-Adapter, EF via ARRI EF-Mount' },
  { id: 'sony-burano', manufacturerUrl: 'https://sony-cinematography.com/burano/', manufacturer: 'Sony', model: 'BURANO', sensor: { name: 'FF 8.6K (35.9×24.0)', widthMm: 35.9, heightMm: 24.0, cropFactor: 1.0 }, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['8.6K', '6K', '4K', 'HD'], type: 'cinema', notes: 'E-Mount nativ mit eingebautem ND; PL via Adapter' },
  { id: 'panasonic-bs1h', manufacturerUrl: 'https://pro-av.panasonic.net/en/cinema_camera_varicam_eva/products/bs1h/index.html', manufacturer: 'Panasonic', model: 'BS1H', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF', 'PL'], resolutions: ['6K', '4K', 'HD'], type: 'cinema', notes: 'Vollformat-Box, L-Mount nativ; EF/PL via Adapter' },

  // ── Z CAM (Cine) ──
  { id: 'z-cam-e2', manufacturerUrl: 'https://www.z-cam.com/products/professional-cameras/e2/', manufacturer: 'Z CAM', model: 'E2', sensor: { name: '4/3" (19.0×13.0)', widthMm: 19.0, heightMm: 13.0, cropFactor: 1.88 }, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'cinema', notes: 'MFT nativ' },
  { id: 'z-cam-e2c', manufacturerUrl: 'https://www.z-cam.com/products/professional-cameras/e2c/', manufacturer: 'Z CAM', model: 'E2C', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'cinema' },
  { id: 'z-cam-e2-m4', manufacturerUrl: 'https://www.z-cam.com/products/professional-cameras/e2-m4/', manufacturer: 'Z CAM', model: 'E2-M4', sensor: { name: '4/3" WDR (19.0x13.0)', widthMm: 19.0, heightMm: 13.0, cropFactor: 1.88 }, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'cinema' },
  { id: 'z-cam-e2-s6', manufacturerUrl: 'https://www.z-cam.com/products/professional-cameras/e2-s6/', manufacturer: 'Z CAM', model: 'E2-S6', sensor: { name: 'Super 35 (23.4×15.67)', widthMm: 23.4, heightMm: 15.67, cropFactor: 1.54 }, mount: 'EF', adaptedMounts: ['PL', 'MFT'], resolutions: ['6K', '4K', 'HD'], type: 'cinema', notes: 'EF nativ; PL/MFT via Wechselmount' },
  { id: 'z-cam-e2-f6', manufacturerUrl: 'https://www.z-cam.com/e2-f6/', manufacturer: 'Z CAM', model: 'E2-F6', sensor: { name: 'Full Frame (37.09×24.75)', widthMm: 37.09, heightMm: 24.75, cropFactor: 0.97 }, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  { id: 'z-cam-e2-f8', manufacturerUrl: 'https://www.z-cam.com/products/professional-cameras/e2-f8/', manufacturer: 'Z CAM', model: 'E2-F8', sensor: SENSORS.FF, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['8K', '6K', '4K'], type: 'cinema' },
  { id: 'z-cam-e2-s6-mk2', manufacturerUrl: 'https://www.z-cam.com/products/professional-cameras/e2-mkii/', manufacturer: 'Z CAM', model: 'E2-S6 Mark II', sensor: { name: 'Super 35 (23.5×15.7)', widthMm: 23.5, heightMm: 15.7, cropFactor: 1.53 }, mount: 'EF', adaptedMounts: ['PL', 'MFT'], resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  { id: 'z-cam-e2-f8-mk2', manufacturerUrl: 'https://www.z-cam.com/products/professional-cameras/e2-mkii/', manufacturer: 'Z CAM', model: 'E2-F8 Mark II', sensor: SENSORS.FF, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['8K', '6K', '4K'], type: 'cinema' },

  // ── Ikegami (Broadcast, 2/3" B4) ──
  { id: 'ikegami-uhk-430', manufacturerUrl: 'https://www.ikegami.com/product/detail/765/', manufacturer: 'Ikegami', model: 'UHK-430', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'Native-4K-Systemkamera' },
  { id: 'ikegami-uhk-x700', manufacturerUrl: 'https://www.ikegami.com/product/detail/763/', manufacturer: 'Ikegami', model: 'UHK-X700', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'ikegami-uhk-x600', manufacturerUrl: 'https://www.ikegami.com/product/detail/767/', manufacturer: 'Ikegami', model: 'UHK-X600', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'ikegami-uhl-43', manufacturerUrl: 'https://www.ikegami.com/product/detail/772/', manufacturer: 'Ikegami', model: 'UHL-43', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'Kompakt/POV 4K' },
  { id: 'ikegami-hdk-99', manufacturerUrl: 'https://www.ikegami.com/product/detail/769/', manufacturer: 'Ikegami', model: 'HDK-99', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'ikegami-hdk-73', manufacturerUrl: 'https://www.ikegami.de/hdk-73.html', manufacturer: 'Ikegami', model: 'HDK-73', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'ikegami-hdk-55', manufacturerUrl: 'https://www.ikegami.com/product/detail/1031/', manufacturer: 'Ikegami', model: 'HDK-55', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'ikegami-hdk-97arri', manufacturerUrl: 'https://www.ikegami.com/product/detail/1013/', manufacturer: 'Ikegami', model: 'HDK-97ARRI', sensor: SENSORS.S35, mount: 'PL', resolutions: ['HD'], type: 'broadcast', notes: 'Super-35 mit ARRI-ALEV-Sensor, PL-Mount' },

  // ── Panasonic Broadcast (2/3" B4) ──
  { id: 'pana-ak-uc3000', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/ak-uc3000', manufacturer: 'Panasonic', model: 'AK-UC3000', sensor: SENSORS.ONE_INCH, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: '1"-MOS-Großsensor (LSSIEL) mit fest verbautem Optikblock für 2/3" B4-Objektive; NICHT S35 (das ist die UC4000) (Quelle: provideocoalition)' },
  { id: 'pana-ak-hc3900', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/ak-hc3900', manufacturer: 'Panasonic', model: 'AK-HC3900', sensor: SENSORS.S35, mount: 'B4', resolutions: ['HD'], type: 'broadcast', notes: 'Large single 11.14MP 4K-CMOS sensor (S35-class); built-in optical block adapts 2/3" B4 lenses (Quelle: pro-av.panasonic.net/en/products/ak-hc3900)' },
  { id: 'pana-ak-hc3800', manufacturerUrl: 'https://na.panasonic.com/ns/22267_AK-HC3800_Brochure_PDF_V1.pdf', manufacturer: 'Panasonic', model: 'AK-HC3800', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  // ── Sony Broadcast (2/3" B4) ──
  { id: 'sony-hdc-3200', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-3200', manufacturer: 'Sony', model: 'HDC-3200', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'sony-hdc-3170', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-3170', manufacturer: 'Sony', model: 'HDC-3170', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'sony-hdc-3100', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-3100', manufacturer: 'Sony', model: 'HDC-3100', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'sony-hxc-fb80', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hxc-fb80', manufacturer: 'Sony', model: 'HXC-FB80', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'sony-hsc-100', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hsc-100r', manufacturer: 'Sony', model: 'HSC-100', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'sony-pxw-z750', manufacturerUrl: 'https://pro.sony/ue_US/products/shoulder-camcorders/pxw-z750', manufacturer: 'Sony', model: 'PXW-Z750', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'Schulter-Camcorder, 3-CMOS Global Shutter' },
  { id: 'sony-pxw-z450', manufacturerUrl: 'https://pro.sony/ue_US/products/shoulder-camcorders/pxw-z450', manufacturer: 'Sony', model: 'PXW-Z450', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  // ── Grass Valley / Hitachi (2/3" B4) ──
  { id: 'gv-ldx-135', manufacturerUrl: 'https://www.grassvalley.com/products/cameras/ldx-100-series/ldx-135/', manufacturer: 'Grass Valley', model: 'LDX 135', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'gv-ldx-98', manufacturerUrl: 'https://www.grassvalley.com/products/cameras/ldx-90-series-family/ldx-98/', manufacturer: 'Grass Valley', model: 'LDX 98', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'gv-ldx-86n', manufacturerUrl: 'https://wwwapps.grassvalley.com/docs/DataSheets/cameras/ldx/LDX_Series_DS-PUB-2-0161F-EN.pdf', manufacturer: 'Grass Valley', model: 'LDX 86N', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'hitachi-sk-hd1500', manufacturerUrl: 'https://www.hitachi-kokusai.co.jp/global/en/products/broadcast/camera/discontinued_products/sk-hd1500/index.html', manufacturer: 'Hitachi', model: 'SK-HD1500', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'hitachi-z-hd6500', manufacturerUrl: 'https://www.kokusaidenki.co.jp/global/en/products/broadcast/camera/hd/z-hd6500/index.html', manufacturer: 'Hitachi', model: 'Z-HD6500', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'hitachi-sk-uhd4000b', manufacturerUrl: 'https://www.hitachi-kokusai.co.jp/global/en/products/broadcast/camera/sk-uhd4000/index.html', manufacturer: 'Hitachi', model: 'SK-UHD4000B', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  // ── Panasonic Cinema / Lumix ──
  { id: 'pana-varicam-lt', manufacturerUrl: 'https://pro-av.panasonic.net/en/cinema_camera_varicam_eva/products/varicam_lt/', manufacturer: 'Panasonic', model: 'VariCam LT', sensor: SENSORS.S35, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['4K', 'HD'], type: 'cinema' },
  { id: 'pana-varicam-35', manufacturerUrl: 'https://pro-av.panasonic.net/en/cinema_camera_varicam_eva/products/varicam_35/', manufacturer: 'Panasonic', model: 'VariCam 35', sensor: SENSORS.S35, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'cinema' },
  { id: 'pana-lumix-s1h', manufacturerUrl: 'https://pro-av.panasonic.net/en/cinema_camera_varicam_eva/products/s1h/index.html', manufacturer: 'Panasonic', model: 'Lumix S1H', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF', 'PL'], resolutions: ['6K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-gh6', manufacturerUrl: 'https://help.na.panasonic.com/answers/specifications-sheet-for-lumix-g-series-dc-gh6/', manufacturer: 'Panasonic', model: 'Lumix GH6', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['5.7K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-gh7', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-g-series-model-dc-gh7/', manufacturer: 'Panasonic', model: 'Lumix GH7', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['5.8K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-bgh1', manufacturerUrl: 'https://pro-av.panasonic.net/en/cinema_camera_varicam_eva/products/bgh1/index.html', manufacturer: 'Panasonic', model: 'Lumix BGH1', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'cinema', notes: 'Box-Style MFT' },
  // ── Kinefinity (Cine) ──
  { id: 'kine-mavo-edge-8k', manufacturerUrl: 'https://kinefinity.com/mavo-edge-2/', manufacturer: 'Kinefinity', model: 'MAVO Edge 8K', sensor: SENSORS.FF, mount: 'PL', adaptedMounts: ['LPL', 'EF', 'E'], resolutions: ['8K', '6K', '4K'], type: 'cinema', notes: 'Natives KineMOUNT; PL/LPL/EF/E per Adapter (Quelle: kinefinity Mavo Edge 8K)' },
  { id: 'kine-mavo-edge-6k', manufacturerUrl: 'https://kinefinity.com/mavo-edge-6k/', manufacturer: 'Kinefinity', model: 'MAVO Edge 6K', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  { id: 'kine-mavo-lf', manufacturerUrl: 'https://kinefinity.com/mavo-mark2-camera/', manufacturer: 'Kinefinity', model: 'MAVO LF', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  { id: 'kine-mavo-s35', manufacturerUrl: 'https://kinefinity.com/mavo-mark2-camera/', manufacturer: 'Kinefinity', model: 'MAVO S35', sensor: SENSORS.S35, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  // ── PTZ (1" Sensor) ──
  { id: 'pana-aw-ue160', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue160/spec.html', manufacturer: 'Panasonic', model: 'AW-UE160', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'pana-aw-ue100', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue100/spec.html', manufacturer: 'Panasonic', model: 'AW-UE100', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'sony-brc-x1000', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/brc-x1000', manufacturer: 'Sony', model: 'BRC-X1000', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'sony-srg-x400', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/srg-x400', manufacturer: 'Sony', model: 'SRG-X400', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'canon-cr-n700', manufacturerUrl: 'https://asia.canon/en/business/cr-n700/main/specification', manufacturer: 'Canon', model: 'CR-N700', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz', notes: '15x Zoom' },

  // ── Cinema (Ausbau) ──
  { id: 'canon-eos-c400', manufacturerUrl: 'https://asia.canon/en/consumer/eos-c400/specification', manufacturer: 'Canon', model: 'EOS C400', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF', 'PL'], resolutions: ['6K', '4K', 'HD'], type: 'cinema', notes: 'FF 6K, RF nativ' },
  { id: 'canon-eos-c80', manufacturerUrl: 'https://asia.canon/en/consumer/eos-c80/specification', manufacturer: 'Canon', model: 'EOS C80', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  { id: 'red-v-raptor-vv', manufacturerUrl: 'https://www.red.com/v-raptor', manufacturer: 'RED', model: 'V-RAPTOR 8K VV', sensor: { name: 'VistaVision (40.96×21.6)', widthMm: 40.96, heightMm: 21.6, cropFactor: 0.93 }, mount: 'RF', adaptedMounts: ['PL', 'EF'], resolutions: ['8K', '6K', '4K'], type: 'cinema', notes: 'VistaVision 8K' },
  { id: 'red-v-raptor-s35', manufacturerUrl: 'https://www.red.com/v-raptor', manufacturer: 'RED', model: 'V-RAPTOR 8K S35', sensor: SENSORS.S35, mount: 'RF', adaptedMounts: ['PL', 'EF'], resolutions: ['8K', '6K', '4K'], type: 'cinema' },
  { id: 'red-v-raptor-xl-s35', manufacturerUrl: 'https://www.red.com/v-raptor-xl', manufacturer: 'RED', model: 'V-RAPTOR XL 8K S35', sensor: SENSORS.S35, mount: 'PL', adaptedMounts: ['RF', 'EF'], resolutions: ['8K', '6K', '4K'], type: 'cinema' },
  { id: 'red-v-raptor-x', manufacturerUrl: 'https://www.red.com/v-raptor-x', manufacturer: 'RED', model: 'V-RAPTOR [X] 8K VV', sensor: { name: 'VistaVision (40.96×21.6)', widthMm: 40.96, heightMm: 21.6, cropFactor: 0.93 }, mount: 'RF', adaptedMounts: ['PL', 'EF'], resolutions: ['8K', '6K', '4K'], type: 'cinema', notes: 'Global Shutter' },
  { id: 'bmd-ursa-cine-12k', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursacine', manufacturer: 'Blackmagic', model: 'URSA Cine 12K LF', sensor: SENSORS.FF, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['12K', '8K', '4K'], type: 'cinema', notes: 'FF 36×24, RGBW-Sensor' },
  { id: 'arri-alexa-lf', manufacturerUrl: 'https://www.arri.com/en/camera-systems/cameras/alexa-lf', manufacturer: 'ARRI', model: 'ALEXA LF', sensor: SENSORS.FF, mount: 'LPL', adaptedMounts: ['PL'], resolutions: ['4.5K', 'UHD', 'HD'], type: 'cinema' },
  // ── Camcorder ──
  { id: 'canon-xf705', manufacturerUrl: 'https://asia.canon/en/consumer/xf705/specification', manufacturer: 'Canon', model: 'XF705', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  { id: 'canon-xa75', manufacturerUrl: 'https://asia.canon/en/consumer/xa75/specification', manufacturer: 'Canon', model: 'XA75', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  { id: 'sony-pxw-z190', manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/pxw-z190', manufacturer: 'Sony', model: 'PXW-Z190', sensor: SENSORS.THIRD_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder', notes: '1/3" 3-CMOS' },
  { id: 'sony-hxr-nx5r', manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/hxr-nx5r', manufacturer: 'Sony', model: 'HXR-NX5R', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'camcorder' },
  { id: 'sony-pxw-fx30', manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/ilme-fx30', manufacturer: 'Sony', model: 'PXW-FX30', sensor: SENSORS.APSC, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['4K', 'HD'], type: 'cinema', notes: 'S35/APS-C Cinema Line' },
  { id: 'jvc-gy-hc900', manufacturerUrl: 'https://www.jvc.com/usa/pro/professional-video/shoulder-cameras/gy-hc900chu/', manufacturer: 'JVC', model: 'GY-HC900', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast', notes: '3×2/3" B4' },
  { id: 'jvc-gy-hc550', manufacturerUrl: 'https://www.jvc.com/usa/pro/professional-video/handheld-cameras/gy-hc550u/', manufacturer: 'JVC', model: 'GY-HC550', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  { id: 'pana-ag-cx350', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/ag-cx350/spec.html', manufacturer: 'Panasonic', model: 'AG-CX350', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  // ── PTZ (Ausbau) ──
  { id: 'canon-cr-n100', manufacturerUrl: 'https://asia.canon/en/business/cr-n100/main/specification', manufacturer: 'Canon', model: 'CR-N100', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'pana-aw-ue80', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue80/spec.html', manufacturer: 'Panasonic', model: 'AW-UE80', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'pana-aw-ue50', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue50-40/spec.html', manufacturer: 'Panasonic', model: 'AW-UE50', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'pana-aw-he145', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-he145/spec.html', manufacturer: 'Panasonic', model: 'AW-HE145', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['HD'], type: 'ptz', notes: '3-MOS' },
  { id: 'sony-srg-a40', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/srg-a40', manufacturer: 'Sony', model: 'SRG-A40', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'ptzoptics-move-4k', manufacturerUrl: 'https://www.ptzoptics.com/move-4k/', manufacturer: 'PTZOptics', model: 'Move 4K', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'marshall-cv730', manufacturerUrl: 'https://www.marshall-usa.com/cameras/CV730/', manufacturer: 'Marshall', model: 'CV730', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },

  // ── Marshall POV/Kompakt ──
  { id: 'marshall-cv420-cs', manufacturerUrl: 'https://www.marshall-usa.com/cameras/CV420-CS/', manufacturer: 'Marshall', model: 'CV420-CS', sensor: { name: '1/1.7" (7.6×5.7)', widthMm: 7.6, heightMm: 5.7, cropFactor: 4.55 }, mount: 'CS', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'True-4K60 12G-SDI, CS-Mount' },
  { id: 'marshall-cv420e', manufacturerUrl: 'https://www.marshall-usa.com/cameras/CV420e/', manufacturer: 'Marshall', model: 'CV420e', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'CS', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'HDMI/IP/USB Stream' },
  { id: 'marshall-cv506', manufacturerUrl: 'https://www.marshall-usa.com/cameras/CV506/', manufacturer: 'Marshall', model: 'CV506', sensor: SENSORS.THIRD_INCH, mount: 'M12', resolutions: ['HD'], type: 'broadcast', notes: 'Miniatur POV, 3G-SDI+HDMI' },
  { id: 'marshall-cv612', manufacturerUrl: 'https://www.marshall-usa.com/cameras/CV612-TBI-TWI/', manufacturer: 'Marshall', model: 'CV612', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz', notes: 'Kompakt-PTZ' },
  // ── PTZ (weitere Marken) ──
  { id: 'lumens-vc-a71', manufacturerUrl: 'https://www.mylumens.com/products/vc-a71', manufacturer: 'Lumens', model: 'VC-A71', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz', notes: '1/1.8", 30x Zoom' },
  { id: 'lumens-vc-a50p', manufacturerUrl: 'https://www.mylumens.com/products/vc-a50p', manufacturer: 'Lumens', model: 'VC-A50P', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'birddog-p400', manufacturerUrl: 'https://bird-dog.tv/p400-overview/', manufacturer: 'BirdDog', model: 'P400', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz', notes: 'Full-NDI' },
  { id: 'birddog-x1', manufacturerUrl: 'https://bird-dog.tv/x1-overview/', manufacturer: 'BirdDog', model: 'X1', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'aver-tr313', manufacturerUrl: 'https://www.averusa.com/pro-av/downloads/datasheet-brochure/tr313-datasheet.pdf', manufacturer: 'AVer', model: 'TR313', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz', notes: 'Auto-Tracking, 12x' },
  { id: 'aver-tr333', manufacturerUrl: 'https://www.averusa.com/products/ptz-camera/tr333', manufacturer: 'AVer', model: 'TR333', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'sony-srg-xp1', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/srg-xp1', manufacturer: 'Sony', model: 'SRG-XP1', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz', notes: 'POV-Box' },
  { id: 'pana-aw-ue20', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue20/spec.html', manufacturer: 'Panasonic', model: 'AW-UE20', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'ptzoptics-link-4k', manufacturerUrl: 'https://www.ptzoptics.com/link-4k/', manufacturer: 'PTZOptics', model: 'Link 4K', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },

  // ── Cinema-Hybride / Mirrorless (Ausbau) ──
  { id: 'canon-eos-r5c', manufacturerUrl: 'https://asia.canon/en/consumer/eos-r5-c/specification', manufacturer: 'Canon', model: 'EOS R5 C', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['8K', '4K', 'HD'], type: 'cinema', notes: 'Cine-Hybrid, aktive Kühlung' },
  { id: 'canon-eos-r5-ii', manufacturerUrl: 'https://asia.canon/en/consumer/eos-r5-mark-ii/specification', manufacturer: 'Canon', model: 'EOS R5 Mark II', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['8K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'canon-eos-r3', manufacturerUrl: 'https://asia.canon/en/consumer/eos-r3-body/specification', manufacturer: 'Canon', model: 'EOS R3', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['6K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'canon-eos-r6-ii', manufacturerUrl: 'https://asia.canon/en/consumer/eos-r6-mark-ii/specification', manufacturer: 'Canon', model: 'EOS R6 Mark II', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a1', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a1/specifications', manufacturer: 'Sony', model: 'A1', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['8K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a7r5', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a7rv/specifications', manufacturer: 'Sony', model: 'A7R V', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['8K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a9-iii', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a9iii/specifications', manufacturer: 'Sony', model: 'A9 III', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['4K', 'HD'], type: 'mirrorless', notes: 'Global Shutter' },
  { id: 'pana-lumix-s5-ii', manufacturerUrl: 'https://help.na.panasonic.com/answers/specifications-sheet-lumix-s-series-dc-s5m2/', manufacturer: 'Panasonic', model: 'Lumix S5 II', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF', 'PL'], resolutions: ['6K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-s1', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-s-series-model-dc-s1/', manufacturer: 'Panasonic', model: 'Lumix S1', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-gh5-ii', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-s-series-model-dc-gh5m2/', manufacturer: 'Panasonic', model: 'Lumix GH5 II', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  // ── RED DSMC2 ──
  { id: 'red-dsmc2-monstro', manufacturerUrl: 'https://docs.red.com/955-0170/DSMC2MONSTROOperationGuide/en-us/Content/A_TechSpecs/Specs_DSMC2_MONSTRO.htm', manufacturer: 'RED', model: 'DSMC2 Monstro 8K VV', sensor: { name: 'RED VV Monstro (40.96×21.6)', widthMm: 40.96, heightMm: 21.6, cropFactor: 0.93 }, mount: 'PL', adaptedMounts: ['RF', 'EF'], resolutions: ['8K', '6K', '4K'], type: 'cinema' },
  { id: 'red-dsmc2-helium', manufacturerUrl: 'https://docs.red.com/955-0171/DSMC2HELIUMOperationGuide/en-us/Content/A_TechSpecs/Specs_DSMC2_HELIUM.htm', manufacturer: 'RED', model: 'DSMC2 Helium 8K S35', sensor: { name: 'RED S35 Helium (29.9×15.77)', widthMm: 29.9, heightMm: 15.77, cropFactor: 1.28 }, mount: 'PL', adaptedMounts: ['PL', 'EF'], resolutions: ['8K', '6K', '4K'], type: 'cinema' },
  { id: 'red-dsmc2-gemini', manufacturerUrl: 'https://docs.red.com/955-0172_v7.0/DSMC2GEMINIOperationGuide/Content/A_TechSpecs/Specs_DSMC2_GEMINI.htm', manufacturer: 'RED', model: 'DSMC2 Gemini 5K S35', sensor: { name: 'RED S35 Gemini (30.72×18.0)', widthMm: 30.72, heightMm: 18.0, cropFactor: 1.16 }, mount: 'PL', adaptedMounts: ['PL', 'EF'], resolutions: ['5K', '4K', 'HD'], type: 'cinema', notes: 'Dual-ISO Low-Light' },
  // ── Broadcast / POV (Ausbau) ──
  { id: 'marshall-cv566', manufacturerUrl: 'https://www.marshall-usa.com/cameras/CV566/', manufacturer: 'Marshall', model: 'CV566', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'M12', resolutions: ['HD'], type: 'broadcast', notes: 'Micro-Genlock POV' },
  { id: 'marshall-cv346', manufacturerUrl: 'https://www.marshall-usa.com/cameras/CV346/', manufacturer: 'Marshall', model: 'CV346', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'CS/C', resolutions: ['HD'], type: 'broadcast' },
  { id: 'marshall-cv380', manufacturerUrl: 'https://www.marshall-usa.com/cameras/CV380-CS/', manufacturer: 'Marshall', model: 'CV380-CS', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'CS', resolutions: ['4K', 'HD'], type: 'broadcast' },

  // ── Nikon Z (Bodies für die Z-Objektive) ──
  { id: 'nikon-z9', manufacturerUrl: 'https://www.nikonusa.com/p/z-9/1669/overview', manufacturer: 'Nikon', model: 'Z9', sensor: SENSORS.FF, mount: 'Z', resolutions: ['8K', '4K', 'HD'], type: 'mirrorless', notes: 'Global-ish Stacked FF, Z-Mount' },
  { id: 'nikon-z8', manufacturerUrl: 'https://www.nikonusa.com/p/z-8/1695/overview', manufacturer: 'Nikon', model: 'Z8', sensor: SENSORS.FF, mount: 'Z', resolutions: ['8K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'nikon-z6-iii', manufacturerUrl: 'https://www.nikonusa.com/p/z6iii/1890/overview', manufacturer: 'Nikon', model: 'Z6 III', sensor: SENSORS.FF, mount: 'Z', resolutions: ['6K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'nikon-zf', manufacturerUrl: 'https://www.nikonusa.com/p/z-f/1761/overview', manufacturer: 'Nikon', model: 'Zf', sensor: SENSORS.FF, mount: 'Z', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  // ── Sony / Panasonic Mirrorless (Ausbau) ──
  { id: 'sony-zv-e1', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_zve1/specifications', manufacturer: 'Sony', model: 'ZV-E1', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a7-iii', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a7iii/specifications', manufacturer: 'Sony', model: 'A7 III', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a6700', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a6700/specifications', manufacturer: 'Sony', model: 'A6700', sensor: SENSORS.APSC, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless', notes: 'APS-C' },
  { id: 'sony-fx2', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_fx2/specifications', manufacturer: 'Sony', model: 'FX2', sensor: SENSORS.FF, mount: 'E', adaptedMounts: ['PL', 'EF'], resolutions: ['4K', 'HD'], type: 'cinema', notes: 'Cinema Line FF' },
  { id: 'pana-lumix-s9', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-s-series-model-dc-s9k/', manufacturer: 'Panasonic', model: 'Lumix S9', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF'], resolutions: ['6K', '4K', 'HD'], type: 'mirrorless' },
  // ── PTZ (Ausbau) ──
  { id: 'sony-srg-a12', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/srg-a12', manufacturer: 'Sony', model: 'SRG-A12', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'pana-aw-he40', manufacturerUrl: 'https://eu.connect.panasonic.com/gb/en/broadcast-proav/aw-he40s', manufacturer: 'Panasonic', model: 'AW-HE40', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'ptzoptics-move-se', manufacturerUrl: 'https://ptzoptics.com/move-se/', manufacturer: 'PTZOptics', model: 'Move SE', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'lumens-vc-tr40', manufacturerUrl: 'https://www.mylumens.com/en/Products_detail/1082/VC-TR40-AI-Auto-Tracking-Camera', manufacturer: 'Lumens', model: 'VC-TR40', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz', notes: 'Auto-Tracking' },
  { id: 'aver-tr311', manufacturerUrl: 'https://www.averusa.com/pro-av/downloads/datasheet-brochure/tr311-datasheet.pdf', manufacturer: 'AVer', model: 'TR311', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },

  // ── Broadcast / Cinema (Abschluss) ──
  { id: 'sony-hdc-p50', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-p50', manufacturer: 'Sony', model: 'HDC-P50', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: 'POV-Systemkamera' },
  { id: 'sony-hxc-fz90', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hxc-fz90', manufacturer: 'Sony', model: 'HXC-FZ90', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'pana-ak-ub300', manufacturerUrl: 'https://eu.connect.panasonic.com/gb/en/broadcast-proav/ak-ub300gj', manufacturer: 'Panasonic', model: 'AK-UB300', sensor: SENSORS.ONE_INCH, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast', notes: '1"-MOS-Großsensor mit fest verbautem Optikblock für 2/3" B4-Objektive (LSSIEL) (Quelle: tvtechnology AK-UB300)' },
  { id: 'gv-ldx-82', manufacturerUrl: 'https://community.grassvalley.com/a2mHt000002rAIu', manufacturer: 'Grass Valley', model: 'LDX 82', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'hitachi-sk-uhd8060b', manufacturerUrl: 'https://www.hitachikokusai.us/BroadcastandProfessionalCameras/SK-UHD8060B.html', manufacturer: 'Hitachi', model: 'SK-UHD8060B', sensor: SENSORS.S35, mount: 'PL', resolutions: ['8K','4K','HD'], type: 'broadcast', notes: '8K Super-35 OPF-CMOS, PL-Mount (Quelle: churchproduction SK-UHD8060B)' },
  { id: 'jvc-gy-hc500', manufacturerUrl: 'https://www.jvc.com/usa/pro/professional-video/handheld-cameras/gy-hc500u/', manufacturer: 'JVC', model: 'GY-HC500', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  { id: 'jvc-gy-hm250', manufacturerUrl: 'https://www.jvc.com/usa/pro/professional-video/handheld-cameras/gy-hm250u/', manufacturer: 'JVC', model: 'GY-HM250', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  { id: 'canon-xf400', manufacturerUrl: 'https://www.canon-europe.com/video-cameras/xf-405-and-xf-400/specifications/', manufacturer: 'Canon', model: 'XF400', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },

  // ── Broadcast / PTZ (Ergänzung) ──
  { id: 'sony-hdc-p31', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-p31', manufacturer: 'Sony', model: 'HDC-P31', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast', notes: 'POV-Systemkamera' },
  { id: 'sony-hdc-p43', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-p43', manufacturer: 'Sony', model: 'HDC-P43', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K', 'HD'], type: 'broadcast' },
  { id: 'pana-ak-plv100', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/ak-plv100gsj/spec.html', manufacturer: 'Panasonic', model: 'AK-PLV100', sensor: SENSORS.S35, mount: 'PL', adaptedMounts: ['PL'], resolutions: ['4K', 'HD'], type: 'broadcast', notes: '5.7K Super-35-MOS (17.25 MP), PL-Mount (Quelle: pro-av.panasonic AK-PLV100)' },
  { id: 'aver-ptz330', manufacturerUrl: 'https://presentation.aver.com/model/ptz330', manufacturer: 'AVer', model: 'PTZ330', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'lumens-vc-b30u', manufacturerUrl: 'https://www.mylumens.com/en/Products_detail/23/VC-B30U-Video-Conference-Camera', manufacturer: 'Lumens', model: 'VC-B30U', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'pana-aw-ue4', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue4/spec.html', manufacturer: 'Panasonic', model: 'AW-UE4', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },

  // ── Sony Alpha (Ausbau) ──
  { id: 'sony-a7c2', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a7cii/specifications', manufacturer: 'Sony', model: 'A7C II', sensor: SENSORS.FF, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a7cr', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a7cr/specifications', manufacturer: 'Sony', model: 'A7CR', sensor: SENSORS.FF, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a7r4', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a7riv/specifications', manufacturer: 'Sony', model: 'A7R IV', sensor: SENSORS.FF, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a9-ii', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a9ii/specifications', manufacturer: 'Sony', model: 'A9 II', sensor: SENSORS.FF, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a6400', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a6400/specifications', manufacturer: 'Sony', model: 'A6400', sensor: SENSORS.APSC, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a6600', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a6600/specifications', manufacturer: 'Sony', model: 'A6600', sensor: SENSORS.APSC, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-zv-e10', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_zve10/specifications', manufacturer: 'Sony', model: 'ZV-E10', sensor: SENSORS.APSC, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  // ── Canon EOS (Ausbau) ──
  { id: 'canon-eos-r', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr877.html', manufacturer: 'Canon', model: 'EOS R', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'canon-eos-rp', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr880.html', manufacturer: 'Canon', model: 'EOS RP', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'canon-eos-r6', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr895.html', manufacturer: 'Canon', model: 'EOS R6', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'canon-eos-r7', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr901.html', manufacturer: 'Canon', model: 'EOS R7', sensor: { name: 'Canon APS-C (22.3×14.9)', widthMm: 22.3, heightMm: 14.9, cropFactor: 1.61 }, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'canon-eos-r8', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr907.html', manufacturer: 'Canon', model: 'EOS R8', sensor: SENSORS.FF, mount: 'RF', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'canon-eos-r10', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr902.html', manufacturer: 'Canon', model: 'EOS R10', sensor: { name: 'Canon APS-C (22.3×14.9)', widthMm: 22.3, heightMm: 14.9, cropFactor: 1.61 }, mount: 'RF', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'canon-eos-90d', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr887.html', manufacturer: 'Canon', model: 'EOS 90D', sensor: { name: 'Canon APS-C (22.3×14.9)', widthMm: 22.3, heightMm: 14.9, cropFactor: 1.61 }, mount: 'EF', resolutions: ['4K', 'HD'], type: 'mirrorless', notes: 'DSLR EF' },
  { id: 'canon-eos-1dx3', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr891.html', manufacturer: 'Canon', model: 'EOS-1D X Mark III', sensor: SENSORS.FF, mount: 'EF', resolutions: ['5.5K', '4K', 'HD'], type: 'mirrorless', notes: 'DSLR EF' },
  // ── Nikon (Z/DSLR) ──
  { id: 'nikon-z5', manufacturerUrl: 'https://www.nikonusa.com/p/z-5/1641/overview', manufacturer: 'Nikon', model: 'Z5', sensor: SENSORS.FF, mount: 'Z', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'nikon-z6-ii', manufacturerUrl: 'https://www.nikonusa.com/p/z-6ii/1659/overview', manufacturer: 'Nikon', model: 'Z6 II', sensor: SENSORS.FF, mount: 'Z', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'nikon-z7-ii', manufacturerUrl: 'https://www.nikonusa.com/p/z-7ii/1653/overview', manufacturer: 'Nikon', model: 'Z7 II', sensor: SENSORS.FF, mount: 'Z', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'nikon-z50-ii', manufacturerUrl: 'https://www.nikonusa.com/p/z50ii/1784/overview', manufacturer: 'Nikon', model: 'Z50 II', sensor: SENSORS.APSC, mount: 'Z', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'nikon-z5-ii', manufacturerUrl: 'https://www.nikonusa.com/p/z5ii/2020/overview', manufacturer: 'Nikon', model: 'Z5 II', sensor: SENSORS.FF, mount: 'Z', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'nikon-d850', manufacturerUrl: 'https://www.nikonusa.com/p/d850/1585/overview', manufacturer: 'Nikon', model: 'D850', sensor: SENSORS.FF, mount: 'NF', resolutions: ['4K', 'HD'], type: 'mirrorless', notes: 'DSLR F' },
  // ── Panasonic Lumix (Ausbau) ──
  { id: 'pana-lumix-s5', manufacturerUrl: 'https://shop.panasonic.com/products/s5-full-frame-mirrorless-camera-body', manufacturer: 'Panasonic', model: 'Lumix S5', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-s5-iix', manufacturerUrl: 'https://shop.panasonic.com/products/s5m2x-full-frame-mirrorless-camera-body', manufacturer: 'Panasonic', model: 'Lumix S5 IIX', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF'], resolutions: ['6K', '4K', 'HD'], type: 'cinema' },
  { id: 'pana-lumix-s1r-ii', manufacturerUrl: 'https://shop.panasonic.com/products/lumix-s1rii-full-frame-mirrorless-digital-camera-dc-s1rm2', manufacturer: 'Panasonic', model: 'Lumix S1R II', sensor: SENSORS.FF, mount: 'L', resolutions: ['8K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-g9-ii', manufacturerUrl: 'https://shop.panasonic.com/products/g9m2-mirrorless-camera-body', manufacturer: 'Panasonic', model: 'Lumix G9 II', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-gh5', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-g-series-dc-gh5/', manufacturer: 'Panasonic', model: 'Lumix GH5', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  // ── Fujifilm (X / GFX) ──
  { id: 'fuji-xh2s', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-h2s/specifications/', manufacturer: 'Fujifilm', model: 'X-H2S', sensor: SENSORS.APSC, mount: 'X', resolutions: ['6.2K', '4K', 'HD'], type: 'mirrorless', notes: 'APS-C X-Mount' },
  { id: 'fuji-xh2', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-h2/specifications/', manufacturer: 'Fujifilm', model: 'X-H2', sensor: SENSORS.APSC, mount: 'X', resolutions: ['8K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'fuji-xt5', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-t5/specifications/', manufacturer: 'Fujifilm', model: 'X-T5', sensor: SENSORS.APSC, mount: 'X', resolutions: ['6.2K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'fuji-xs20', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-s20/specifications/', manufacturer: 'Fujifilm', model: 'X-S20', sensor: SENSORS.APSC, mount: 'X', resolutions: ['6.2K', '4K', 'HD'], type: 'mirrorless' },
  { id: 'fuji-gfx100-ii', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/gfx100-ii/specifications/', manufacturer: 'Fujifilm', model: 'GFX100 II', sensor: { name: 'Mittelformat 44×33', widthMm: 44, heightMm: 33, cropFactor: 0.79 }, mount: 'G', resolutions: ['8K', '4K', 'HD'], type: 'cinema', notes: 'Mittelformat 44×33' },
  { id: 'fuji-gfx100s', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/gfx100s/specifications/', manufacturer: 'Fujifilm', model: 'GFX100S', sensor: { name: 'Mittelformat 44×33', widthMm: 44, heightMm: 33, cropFactor: 0.79 }, mount: 'G', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  // ── Weitere Cinema / Box ──
  { id: 'bmd-pyxis-12k', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpyxis/techspecs', manufacturer: 'Blackmagic', model: 'PYXIS 12K', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['PL', 'EF'], resolutions: ['12K', '8K', '4K'], type: 'cinema' },
  { id: 'nikon-zr', manufacturerUrl: 'https://www.nikonusa.com/p/zr/2006/overview', manufacturer: 'Nikon', model: 'ZR (RED-Cinema)', sensor: SENSORS.FF, mount: 'Z', resolutions: ['6K', '4K', 'HD'], type: 'cinema', notes: 'RED-Farbwissenschaft, Z-Mount' },

  // ── Sony (Ausbau 2) ──
  { id: 'sony-a7s2', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a7sii/specifications', manufacturer: 'Sony', model: 'A7S II', sensor: SENSORS.FF, mount: 'E', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'sony-a99-ii', manufacturerUrl: 'https://en.wikipedia.org/wiki/Sony_%CE%B199_II', manufacturer: 'Sony', model: 'A99 II', sensor: SENSORS.FF, mount: 'A', resolutions: ['4K', 'HD'], type: 'mirrorless', notes: 'A-Mount DSLR' },
  // ── Panasonic / OM System ──
  { id: 'pana-lumix-gh4', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-g-series-dmc-gh4/', manufacturer: 'Panasonic', model: 'Lumix GH4', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'pana-lumix-s1h-b', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-s-series-model-dc-s1r/', manufacturer: 'Panasonic', model: 'Lumix S1R', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF'], resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'om-om1-ii', manufacturerUrl: 'https://explore.omsystem.com/c/en/om-1-mark-ii', manufacturer: 'OM System', model: 'OM-1 Mark II', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  { id: 'om-om5', manufacturerUrl: 'https://explore.omsystem.com/c/en/om-5-body-black', manufacturer: 'OM System', model: 'OM-5', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K', 'HD'], type: 'mirrorless' },
  // ── Broadcast Systemkameras (Ausbau) ──
  { id: 'sony-hxc-100', manufacturerUrl: 'https://pro.sony/en_AE/pdf/hxc-100', manufacturer: 'Sony', model: 'HXC-100', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'gv-ldx-100-b', manufacturerUrl: 'https://www.grassvalley.com/products/cameras/ldx-90-series-family/ldx-92/', manufacturer: 'Grass Valley', model: 'LDX 92', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'hitachi-sk-hd1200', manufacturerUrl: 'https://www.hitachi-kokusai.co.jp/global/en/products/broadcast/camera/hd/sk-hd1200/sk-hd1200_f.html', manufacturer: 'Hitachi', model: 'SK-HD1200', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'ikegami-hdk-79', manufacturerUrl: 'https://www.bhphotovideo.com/c/product/741773-REG/Ikegami_HDK_79EXIII_CT9_HDK_79EXIII_CT9_Full_Digital_HDTV.html', manufacturer: 'Ikegami', model: 'HDK-79EX III', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  // ── PTZ (Ausbau 2) ──
  { id: 'pana-aw-ue160-b', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ur100/spec.html', manufacturer: 'Panasonic', model: 'AW-UR100', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz', notes: '4K-Outdoor-PTZ, integrierte Optik' },
  { id: 'sony-brc-h900', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/brc-h900', manufacturer: 'Sony', model: 'BRC-H900', sensor: SENSORS.HALF_INCH, mount: 'integrated', resolutions: ['HD'], type: 'ptz', notes: '1/2" 3-CMOS (Quelle: pro.sony BRC-H900)' },
  { id: 'canon-cr-x500', manufacturerUrl: 'https://www.canon-europe.com/ptz-cameras/cr-x500/specifications/', manufacturer: 'Canon', model: 'CR-X500', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz', notes: 'Outdoor-PTZ' },
  { id: 'vaddio-roboshot-40', manufacturerUrl: 'https://www.legrandav.com/products/cameras/4k_ptz_camera/roboshot-40-uhd', manufacturer: 'Vaddio', model: 'RoboSHOT 40 UHD', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  { id: 'panasonic-aw-he42', manufacturerUrl: 'https://eu.connect.panasonic.com/gb/en/broadcast-proav/aw-he42', manufacturer: 'Panasonic', model: 'AW-HE42', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'birddog-a300', manufacturerUrl: 'https://birddog.tv/a300-overview/a300-techspecs/', manufacturer: 'BirdDog', model: 'A300', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'ptzoptics-move-4k-30', manufacturerUrl: 'https://ptzoptics.com/ptz-cameras/move-4k-30x', manufacturer: 'PTZOptics', model: 'Move 4K 30x', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'ptz' },
  // ── Action / POV / Kompakt ──
  { id: 'marshall-cv355', manufacturerUrl: 'https://marshall-usa.com/cameras/CV355-10X/', manufacturer: 'Marshall', model: 'CV355-10X', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['HD'], type: 'broadcast', notes: 'Kompakte 10×-Zoom-Blockkamera, 3G-SDI & HDMI (Quelle: marshall-usa.com)' },
  { id: 'marshall-cv503', manufacturerUrl: 'https://marshall-usa.com/cameras/CV503/', manufacturer: 'Marshall', model: 'CV503', sensor: SENSORS.THIRD_INCH, mount: 'M12', resolutions: ['HD'], type: 'broadcast' },
  { id: 'marshall-cv225', manufacturerUrl: 'https://marshall-usa.com/discontinued/cameras/CV225-MB.php', manufacturer: 'Marshall', model: 'CV225-M2', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'M12', resolutions: ['HD'], type: 'broadcast' },
  { id: 'marshall-cv605', manufacturerUrl: 'https://marshall-usa.com/cameras/CV605-BK-WH/', manufacturer: 'Marshall', model: 'CV605', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'gopro-hero12', manufacturerUrl: 'https://gopro.com/en/us/shop/cameras/hero12-black/CHDHX-121-master.html', manufacturer: 'GoPro', model: 'HERO12 Black', sensor: { name: '1/1.9" (6.9×5.2)', widthMm: 6.9, heightMm: 5.2, cropFactor: 5.01 }, mount: 'integrated', resolutions: ['5.3K', '4K', 'HD'], type: 'camcorder', notes: 'Action-Cam' },
  { id: 'gopro-hero13', manufacturerUrl: 'https://gopro.com/en/us/shop/cameras/learn/hero13black/CHDHX-131-master.html', manufacturer: 'GoPro', model: 'HERO13 Black', sensor: { name: '1/1.9" (6.9×5.2)', widthMm: 6.9, heightMm: 5.2, cropFactor: 5.01 }, mount: 'integrated', resolutions: ['5.3K', '4K', 'HD'], type: 'camcorder' },
  { id: 'dji-osmo-action-4', manufacturerUrl: 'https://www.dji.com/osmo-action-4/specs', manufacturer: 'DJI', model: 'Osmo Action 4', sensor: { name: '1/1.3" (9.7×7.3)', widthMm: 9.7, heightMm: 7.3, cropFactor: 3.56 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder', notes: 'Action-Cam' },
  { id: 'dji-pocket-3', manufacturerUrl: 'https://www.dji.com/osmo-pocket-3/specs', manufacturer: 'DJI', model: 'Osmo Pocket 3', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder', notes: 'Gimbal-Cam' },
  { id: 'insta360-x4', manufacturerUrl: 'https://onlinemanual.insta360.com/x4/en-us/specs/hardware', manufacturer: 'Insta360', model: 'X4', sensor: { name: '1/2" (6.4×4.8)', widthMm: 6.4, heightMm: 4.8, cropFactor: 5.41 }, mount: 'integrated', resolutions: ['8K', '5.7K', '4K'], type: 'camcorder', notes: '360°' },
  // ── Camcorder (Ausbau) ──
  { id: 'sony-pxw-z280', manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/pxw-z280', manufacturer: 'Sony', model: 'PXW-Z280', sensor: SENSORS.HALF_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder', notes: '3×1/2" Exmor R CMOS (Quelle: pro.sony PXW-Z280)' },
  { id: 'canon-xa60', manufacturerUrl: 'https://en.canon-cna.com/video-cameras/xa60b/', manufacturer: 'Canon', model: 'XA60', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  { id: 'panasonic-hc-x2', manufacturerUrl: 'https://www.panasonic.com/my/consumer/camera-camcorder/camcorder/4k-full-hd-camcorder/hc-x2.specs.html', manufacturer: 'Panasonic', model: 'HC-X2', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },
  { id: 'panasonic-ag-cx10', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/ag-cx10/', manufacturer: 'Panasonic', model: 'AG-CX10', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K', 'HD'], type: 'camcorder' },

  // ── Cinema (Kinefinity/RED/ARRI/BMD Ausbau) ──
  { id: 'kine-terra-4k', manufacturerUrl: 'https://kinefinity.com/terra/', manufacturer: 'Kinefinity', model: 'TERRA 4K', sensor: { name: 'sub-S35 (20.5×11.5)', widthMm: 20.5, heightMm: 11.5, cropFactor: 1.84 }, mount: 'E', adaptedMounts: ['PL','EF'], resolutions: ['4K','HD'], type: 'cinema' },
  { id: 'red-raptor-xl-vv', manufacturerUrl: 'https://docs.red.com/955-0203/955-0203_V1.3+Rev-B+RED+PS,+V-RAPTOR+XL+8K+VV+Operation+Guide+HTML/Content/C_TechSpecs/Specs_V-RAPTOR_XL.htm', manufacturer: 'RED', model: 'V-RAPTOR XL 8K VV', sensor: { name: 'VistaVision (40.96×21.6)', widthMm: 40.96, heightMm: 21.6, cropFactor: 0.93 }, mount: 'PL', adaptedMounts: ['RF','EF'], resolutions: ['8K','6K','4K'], type: 'cinema' },
  { id: 'arri-alexa-265', manufacturerUrl: 'https://www.arrirental.com/en/cameras/digital-65-mm-cameras/alexa-65', manufacturer: 'ARRI', model: 'ALEXA 65', sensor: { name: 'ARRI 65 (54.12×25.59)', widthMm: 54.12, heightMm: 25.59, cropFactor: 0.72 }, mount: 'XPL', resolutions: ['6.5K','4K'], type: 'cinema', notes: '65-mm-Format, XPL' },
  { id: 'bmd-cinema-camera-6k-b', manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagiccinemacamera/techspecs', manufacturer: 'Blackmagic', model: 'Cinema Camera 6K L', sensor: SENSORS.FF, mount: 'L', adaptedMounts: ['EF','PL'], resolutions: ['6K','4K'], type: 'cinema' },
  // ── Sony/Canon/Nikon/Panasonic Mirrorless (Ausbau 3) ──
  { id: 'sony-a7c', manufacturerUrl: 'https://www.sony.co.uk/electronics/support/e-mount-body-ilce-7-series/ilce-7c/specifications', manufacturer: 'Sony', model: 'A7C', sensor: SENSORS.FF, mount: 'E', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'sony-a7r3', manufacturerUrl: 'https://www.sony.co.uk/electronics/interchangeable-lens-cameras/ilce-7rm3/specifications', manufacturer: 'Sony', model: 'A7R III', sensor: SENSORS.FF, mount: 'E', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'sony-a6100', manufacturerUrl: 'https://www.sony.co.uk/electronics/interchangeable-lens-cameras/ilce-6100/specifications', manufacturer: 'Sony', model: 'A6100', sensor: SENSORS.APSC, mount: 'E', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'sony-a6300', manufacturerUrl: 'https://www.sony.co.uk/electronics/support/e-mount-body-ilce-6000-series/ilce-6300/specifications', manufacturer: 'Sony', model: 'A6300', sensor: SENSORS.APSC, mount: 'E', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'sony-zv-e10-ii', manufacturerUrl: 'https://www.sony.co.uk/electronics/support/e-mount-body-zv-e-series/zv-e10m2/specifications', manufacturer: 'Sony', model: 'ZV-E10 II', sensor: SENSORS.APSC, mount: 'E', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'canon-eos-r50', manufacturerUrl: 'https://www.canon.co.uk/cameras/eos-r50/specifications/', manufacturer: 'Canon', model: 'EOS R50', sensor: { name: 'Canon APS-C (22.3×14.9)', widthMm: 22.3, heightMm: 14.9, cropFactor: 1.61 }, mount: 'RF', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'canon-eos-r100', manufacturerUrl: 'https://en.canon-cna.com/cameras/eos-r100/specifications/', manufacturer: 'Canon', model: 'EOS R100', sensor: { name: 'Canon APS-C (22.3×14.9)', widthMm: 22.3, heightMm: 14.9, cropFactor: 1.61 }, mount: 'RF', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'canon-eos-m50-ii', manufacturerUrl: 'https://www.canon-europe.com/cameras/eos-m50-mark-ii/specifications/', manufacturer: 'Canon', model: 'EOS M50 Mark II', sensor: { name: 'Canon APS-C (22.3×14.9)', widthMm: 22.3, heightMm: 14.9, cropFactor: 1.61 }, mount: 'EF-M', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'canon-eos-5d4', manufacturerUrl: 'https://www.canon.co.uk/cameras/eos-5d-mark-iv/specifications/', manufacturer: 'Canon', model: 'EOS 5D Mark IV', sensor: SENSORS.FF, mount: 'EF', resolutions: ['4K','HD'], type: 'mirrorless', notes: 'DSLR EF' },
  { id: 'nikon-z30', manufacturerUrl: 'https://imaging.nikon.com/imaging/lineup/mirrorless/z_30/', manufacturer: 'Nikon', model: 'Z30', sensor: SENSORS.APSC, mount: 'Z', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'nikon-zfc', manufacturerUrl: 'https://imaging.nikon.com/imaging/lineup/mirrorless/z_fc/', manufacturer: 'Nikon', model: 'Zfc', sensor: SENSORS.APSC, mount: 'Z', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'nikon-z7', manufacturerUrl: 'https://imaging.nikon.com/imaging/lineup/mirrorless/z_7/', manufacturer: 'Nikon', model: 'Z7', sensor: SENSORS.FF, mount: 'Z', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'nikon-z6', manufacturerUrl: 'https://imaging.nikon.com/imaging/lineup/mirrorless/z_6/', manufacturer: 'Nikon', model: 'Z6', sensor: SENSORS.FF, mount: 'Z', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'pana-lumix-g100', manufacturerUrl: 'https://www.panasonic.com/uk/consumer/cameras-camcorders/lumix-mirrorless-cameras/lumix-g-cameras/dc-g100.specs.html', manufacturer: 'Panasonic', model: 'Lumix G100', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'pana-lumix-gh5s', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-g-series-dc-gh5s/', manufacturer: 'Panasonic', model: 'Lumix GH5S', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K','HD'], type: 'cinema' },
  { id: 'fuji-xt4', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-t4/specifications/', manufacturer: 'Fujifilm', model: 'X-T4', sensor: SENSORS.APSC, mount: 'X', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'fuji-xt50', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-t50/specifications/', manufacturer: 'Fujifilm', model: 'X-T50', sensor: SENSORS.APSC, mount: 'X', resolutions: ['6.2K','4K'], type: 'mirrorless' },
  { id: 'fuji-xpro3', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-pro3/specifications/', manufacturer: 'Fujifilm', model: 'X-Pro3', sensor: SENSORS.APSC, mount: 'X', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'fuji-gfx50s-ii', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/gfx50s-ii/specifications/', manufacturer: 'Fujifilm', model: 'GFX50S II', sensor: { name: 'Mittelformat 44×33', widthMm: 44, heightMm: 33, cropFactor: 0.79 }, mount: 'G', resolutions: ['HD'], type: 'mirrorless', notes: 'Mittelformat' },
  // ── Broadcast / Studio (Ausbau 3) ──
  { id: 'sony-hxc-fb75', manufacturerUrl: 'https://pro.sony/en_GB/products/4k-and-hd-camera-systems/hxc-fb75kc', manufacturer: 'Sony', model: 'HXC-FB75', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'gv-ldx-135-b', manufacturerUrl: 'https://www.grassvalley.com/products/cameras/ldx-100-series/ldx-c135/', manufacturer: 'Grass Valley', model: 'LDX 135 Compact', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K','HD'], type: 'broadcast' },
  { id: 'gv-kayak', manufacturerUrl: 'https://www.grassvalley.com/products/cameras/ldx-100-series/ldx-c135/', manufacturer: 'Grass Valley', model: 'LDX C135', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K','HD'], type: 'broadcast' },
  { id: 'ikegami-uhk-430s', manufacturerUrl: 'https://www.ikegami.com/product/detail/765/', manufacturer: 'Ikegami', model: 'UHK-430S', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K','HD'], type: 'broadcast' },
  { id: 'ikegami-hdk-73a', manufacturerUrl: 'https://www.ikegami.de/hdk-73.html', manufacturer: 'Ikegami', model: 'HDK-73A', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  // ── PTZ / POV (Ausbau 3) ──
  { id: 'aver-tr335', manufacturerUrl: 'https://www.averusa.com/products/ptz-camera/tr335', manufacturer: 'AVer', model: 'TR335', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'lumens-vc-tr60', manufacturerUrl: 'https://www.mylumens.com/en/Products_detail/1128/VC-TR60A-4K-Dual-Lens-Speaker-Tracking-Camera', manufacturer: 'Lumens', model: 'VC-TR60A', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'ptzoptics-move-4k-20', manufacturerUrl: 'https://ptzoptics.com/ptz-cameras/move-4k-20x', manufacturer: 'PTZOptics', model: 'Move 4K 20x', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'birddog-maki-4k', manufacturerUrl: 'https://birddog.tv/makiultra-overview/', manufacturer: 'BirdDog', model: 'Maki 4K', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'panasonic-aw-ue40', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue50-40/', manufacturer: 'Panasonic', model: 'AW-UE40', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'marshall-cv503-wp', manufacturerUrl: 'https://marshall-usa.com/discontinued/cameras/CV503-WP.php', manufacturer: 'Marshall', model: 'CV503-WP (IP67)', sensor: SENSORS.THIRD_INCH, mount: 'M12', resolutions: ['HD'], type: 'broadcast', notes: 'wetterfest' },
  { id: 'marshall-cv504', manufacturerUrl: 'https://marshall-usa.com/cameras/CV504/', manufacturer: 'Marshall', model: 'CV504', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'M12', resolutions: ['HD'], type: 'broadcast' },

  // ── ARRI ALEXA Klassiker (Rental) ──
  { id: 'arri-alexa-classic', manufacturerUrl: 'https://www.arri.com/resource/blob/75886/2653b2727b6204327852e34f0eb5344b/1-2-3-alexa-classic-data.pdf', manufacturer: 'ARRI', model: 'ALEXA Classic', sensor: { name: 'ARRI ALEV III S35 (28.17×18.13)', widthMm: 28.17, heightMm: 18.13, cropFactor: 1.29 }, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['2.8K','HD'], type: 'cinema' },
  { id: 'arri-alexa-xt', manufacturerUrl: 'https://www.arri.com/resource/blob/75900/97c70e90a0405b944074526d4a5979f8/1-1-0-camera-product-comparison-alexa-alexa-xt-data.pdf', manufacturer: 'ARRI', model: 'ALEXA XT', sensor: { name: 'ARRI ALEV III S35 (28.17×18.13)', widthMm: 28.17, heightMm: 18.13, cropFactor: 1.29 }, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['3.4K','2.8K','HD'], type: 'cinema' },
  { id: 'arri-alexa-sxt', manufacturerUrl: 'https://www.arri.com/en/cine-systems/cine-cameras/legacy-cine-cameras/alexa-sxt-w', manufacturer: 'ARRI', model: 'ALEXA SXT W', sensor: { name: 'ARRI ALEV III S35 (28.17×18.13)', widthMm: 28.17, heightMm: 18.13, cropFactor: 1.29 }, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['3.4K','UHD','HD'], type: 'cinema' },
  { id: 'arri-alexa-mini', manufacturerUrl: 'https://www.arri.com/en/cine-systems/cine-cameras/legacy-cine-cameras/alexa-mini', manufacturer: 'ARRI', model: 'ALEXA Mini', sensor: { name: 'ARRI ALEV III S35 (28.17×18.13)', widthMm: 28.17, heightMm: 18.13, cropFactor: 1.29 }, mount: 'PL', adaptedMounts: ['EF','B4'], resolutions: ['3.4K','UHD','HD'], type: 'cinema' },
  { id: 'arri-alexa-studio', manufacturerUrl: 'https://www.arri.com/resource/blob/75874/49bb65f1e663a9442ef01fb47c722210/1-3-0-alexa-studio-data.pdf', manufacturer: 'ARRI', model: 'ALEXA Studio', sensor: { name: 'ARRI ALEV III S35 (28.17×18.13)', widthMm: 28.17, heightMm: 18.13, cropFactor: 1.29 }, mount: 'PL', resolutions: ['2.8K','HD'], type: 'cinema' },
  // ── RED Klassiker ──
  { id: 'red-epic-dragon', manufacturerUrl: 'https://docs.red.com/955-0156/EPICSCARLETOperationGuide/en-us/Content/A_TechSpecs/Specs_EPIC_DRAGON.htm', manufacturer: 'RED', model: 'EPIC Dragon', sensor: { name: 'RED Dragon S35 (30.7×15.8)', widthMm: 30.7, heightMm: 15.8, cropFactor: 1.25 }, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['6K','5K','4K'], type: 'cinema' },
  { id: 'red-scarlet-w', manufacturerUrl: 'https://docs.red.com/955-0116_v7.4/SCARLET_DRAGON_7_4/en-us/Content/A_TechSpecs/Specs_SW_5K.htm', manufacturer: 'RED', model: 'SCARLET-W', sensor: { name: 'RED Dragon S35 (25.6×13.5)', widthMm: 25.6, heightMm: 13.5, cropFactor: 1.5 }, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['5K','4K'], type: 'cinema' },
  { id: 'red-epic-w-helium', manufacturerUrl: 'https://docs.red.com/955-0155_v7.0/WEAPONEPICWOperationGuide/en-us/Content/A_TechSpecs/Specs_EPIC-W_8KS35.htm', manufacturer: 'RED', model: 'EPIC-W Helium 8K', sensor: { name: 'RED Helium S35 (29.9×15.77)', widthMm: 29.9, heightMm: 15.77, cropFactor: 1.28 }, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['8K','6K','4K'], type: 'cinema' },
  { id: 'red-raven-4k', manufacturerUrl: 'https://docs.red.com/955-0154/REDRAVENOperationGuide/en-us/Content/A_TechSpecs/Specs_RAVEN.htm', manufacturer: 'RED', model: 'RAVEN 4.5K', sensor: { name: 'RED Dragon 4.5K (23.04×10.8)', widthMm: 23.04, heightMm: 10.8, cropFactor: 1.7 }, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['4.5K','4K'], type: 'cinema' },
  { id: 'red-weapon-8k-vv', manufacturerUrl: 'https://docs.red.com/955-0160/WEAPONMONSTRO8KVVOperationGuide/en-us/Content/A_TechSpecs/Specs_DSMC2_MONSTRO.htm', manufacturer: 'RED', model: 'WEAPON 8K VV Monstro', sensor: { name: 'RED Monstro VV (40.96×21.6)', widthMm: 40.96, heightMm: 21.6, cropFactor: 0.93 }, mount: 'PL', adaptedMounts: ['EF'], resolutions: ['8K','6K','4K'], type: 'cinema' },
  // ── Sony Cinema Klassiker ──
  { id: 'sony-f65', manufacturerUrl: 'https://pro.sony/ue_US/products/digital-cinema-cameras/f65', manufacturer: 'Sony', model: 'F65 CineAlta', sensor: { name: 'Sony F65 S35 (24.7×13.1)', widthMm: 24.7, heightMm: 13.1, cropFactor: 1.55 }, mount: 'PL', resolutions: ['8K','4K','HD'], type: 'cinema' },
  { id: 'sony-f35', manufacturerUrl: 'https://pro.sony/s3/cms-static-content/file/09/1237485327609.pdf', manufacturer: 'Sony', model: 'F35 CineAlta', sensor: { name: 'Super 35 CCD (23.6×13.3)', widthMm: 23.6, heightMm: 13.3, cropFactor: 1.6 }, mount: 'PL', resolutions: ['HD'], type: 'cinema' },
  { id: 'sony-pmw-f3', manufacturerUrl: 'https://pro.sony/en_CY/products/handheld-camcorders/pmw-f3l', manufacturer: 'Sony', model: 'PMW-F3', sensor: SENSORS.S35, mount: 'FZ', adaptedMounts: ['EF'], resolutions: ['HD'], type: 'cinema', notes: 'Nativer FZ-Mount; PL-Adapter mitgeliefert (Quelle: Sony PMW-F3)' },
  { id: 'sony-nex-fs700', manufacturerUrl: 'https://pro.sony/en_BD/products/handheld-camcorders/nex-fs700', manufacturer: 'Sony', model: 'NEX-FS700', sensor: SENSORS.S35, mount: 'E', adaptedMounts: ['PL','EF'], resolutions: ['4K','HD'], type: 'cinema' },
  { id: 'sony-nex-fs100', manufacturerUrl: 'https://pro.sony/en_EC/products/handheld-camcorders/nex-fs100n', manufacturer: 'Sony', model: 'NEX-FS100', sensor: SENSORS.S35, mount: 'E', adaptedMounts: ['PL','EF'], resolutions: ['HD'], type: 'cinema' },
  { id: 'sony-pxw-fs5-ii', manufacturerUrl: 'https://pro.sony/en_LU/products/handheld-camcorders/pxw-fs5m2', manufacturer: 'Sony', model: 'PXW-FS5 II', sensor: SENSORS.S35, mount: 'E', adaptedMounts: ['PL','EF'], resolutions: ['4K','HD'], type: 'cinema' },
  // ── Panasonic / Canon Cinema Klassiker ──
  { id: 'pana-varicam-classic', manufacturer: 'Panasonic', model: 'VariCam (AJ-HDC27)', sensor: { name: '2/3" 3-CCD (9.59×5.39)', widthMm: 9.59, heightMm: 5.39, cropFactor: 3.9 }, mount: 'B4', resolutions: ['HD'], type: 'cinema' },
  { id: 'pana-ag-af101', manufacturerUrl: 'https://www.bhphotovideo.com/c/product/731509-REG/Panasonic_AG_AF100_AG_AF100_Micro_Four_Thirds.html', manufacturer: 'Panasonic', model: 'AG-AF101', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['HD'], type: 'cinema' },
  { id: 'canon-eos-c300', manufacturerUrl: 'https://global.canon/en/c-museum/product/cesc821.html', manufacturer: 'Canon', model: 'EOS C300', sensor: SENSORS.S35, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['HD'], type: 'cinema' },
  { id: 'canon-eos-c300-ii', manufacturerUrl: 'https://downloads.canon.com/nw/camera/products/cinema-eos/c300-mark-ii/specifications/canon-cinema-eos-c300-mark-ii-specifications-chart.pdf', manufacturer: 'Canon', model: 'EOS C300 Mark II', sensor: SENSORS.S35, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['4K','HD'], type: 'cinema' },
  { id: 'canon-eos-c100-ii', manufacturerUrl: 'https://global.canon/en/c-museum/product/cesc825.html', manufacturer: 'Canon', model: 'EOS C100 Mark II', sensor: SENSORS.S35, mount: 'EF', resolutions: ['HD'], type: 'cinema' },
  { id: 'canon-eos-c500', manufacturerUrl: 'https://global.canon/en/c-museum/product/cesc822.html', manufacturer: 'Canon', model: 'EOS C500 (Klassiker)', sensor: SENSORS.S35, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['4K','HD'], type: 'cinema' },
  { id: 'canon-eos-c700', manufacturerUrl: 'https://global.canon/en/c-museum/product/cesc875.html', manufacturer: 'Canon', model: 'EOS C700 FF', sensor: { name: 'Full Frame 5.9K (38.1×20.1)', widthMm: 38.1, heightMm: 20.1, cropFactor: 1.0 }, mount: 'EF', adaptedMounts: ['PL'], resolutions: ['5.9K','4K','HD'], type: 'cinema' },
  { id: 'canon-me20f', manufacturerUrl: 'https://www.usa.canon.com/shop/p/me20f-sh', manufacturer: 'Canon', model: 'ME20F-SH (Ultra-Low-Light)', sensor: SENSORS.FF, mount: 'EF', resolutions: ['HD'], type: 'cinema' },
  // ── Broadcast / Studio Klassiker ──
  { id: 'sony-hdc-2500', manufacturerUrl: 'https://pro.sony/en_JM/products/4k-and-hd-camera-systems/hdc-2500', manufacturer: 'Sony', model: 'HDC-2500', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'sony-hdc-1700', manufacturerUrl: 'https://pro.sony/ue_US/products/4k-and-hd-camera-systems/hdc-1700', manufacturer: 'Sony', model: 'HDC-1700', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'sony-hxc-d70', manufacturerUrl: 'https://pro.sony/s3/cms-static-content/file/33/1237486957233.pdf', manufacturer: 'Sony', model: 'HXC-D70', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'grass-valley-ldx-86', manufacturerUrl: 'https://wwwapps.grassvalley.com/docs/DataSheets/cameras/ldx/LDX_Series_DS-PUB-2-0161F-EN.pdf', manufacturer: 'Grass Valley', model: 'LDX 86 Universe', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['4K','HD'], type: 'broadcast' },
  { id: 'hitachi-sk-hd1000', manufacturerUrl: 'https://www.hitachi-kokusai.co.jp/global/en/products/broadcast/camera/hd/sk-hd1000/sk-hd1000_s.html', manufacturer: 'Hitachi', model: 'SK-HD1000', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'ikegami-hdk-97a', manufacturerUrl: 'https://www.ikegami.com/product/detail/1012/', manufacturer: 'Ikegami', model: 'HDK-97A', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'panasonic-ak-hc3500', manufacturerUrl: 'https://www.panasonic.com/in/business/broadcast/studio-camera-systems/ak-hc3500.html', manufacturer: 'Panasonic', model: 'AK-HC3500', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },
  { id: 'grass-valley-ldk-8000', manufacturerUrl: 'https://wwwapps.grassvalley.com/docs/Manuals/cameras/ldk8000/3922-496-31341.v01.b501.pdf', manufacturer: 'Grass Valley', model: 'LDK 8000', sensor: SENSORS.TWO_THIRD, mount: 'B4', resolutions: ['HD'], type: 'broadcast' },

  // ── Konferenz / Webcam / Auto-Tracking (Streaming/AV) ──
  { id: 'obsbot-tail-air', manufacturerUrl: 'https://www.obsbot.com/obsbot-tail-air-streaming-camera', manufacturer: 'OBSBOT', model: 'Tail Air', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz', notes: 'NDI-PTZ, KI-Tracking' },
  { id: 'obsbot-tiny-2', manufacturerUrl: 'https://www.obsbot.com/obsbot-tiny-2-4k-webcam/specs', manufacturer: 'OBSBOT', model: 'Tiny 2', sensor: { name: '1/1.5" (8.53×6.4)', widthMm: 8.53, heightMm: 6.4, cropFactor: 4.06 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz', notes: 'KI-Webcam-PTZ' },
  { id: 'obsbot-tiny-2-lite', manufacturerUrl: 'https://www.obsbot.com/obsbot-tiny-2-lite-4k-webcam/specs', manufacturer: 'OBSBOT', model: 'Tiny 2 Lite', sensor: { name: '1/2" (6.4×4.8)', widthMm: 6.4, heightMm: 4.8, cropFactor: 5.41 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'obsbot-tiny-se', manufacturerUrl: 'https://www.obsbot.com/obsbot-tiny-se-full-hd-webcam/specs', manufacturer: 'OBSBOT', model: 'Tiny SE', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'logitech-mx-brio', manufacturerUrl: 'https://www.logitech.com/en-us/shop/p/mx-brio-4k-webcam', manufacturer: 'Logitech', model: 'MX Brio', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder', notes: 'Webcam' },
  { id: 'logitech-rally-camera', manufacturerUrl: 'https://www.logitech.com/en-us/products/video-conferencing/conference-cameras/rally-ultra-hd-ptz-camera.html', manufacturer: 'Logitech', model: 'Rally Camera', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz', notes: 'Konferenz-PTZ' },
  { id: 'logitech-brio-4k', manufacturerUrl: 'https://www.logitech.com/en-us/products/webcams/brio-4k-hdr-webcam.html', manufacturer: 'Logitech', model: 'Brio 4K', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder' },
  { id: 'poly-studio-e70', manufacturerUrl: 'https://www.poly.com/content/dam/www/products/video/studio/studio-e70/doc/poly-studio-e70-ds-en.pdf', manufacturer: 'Poly', model: 'Studio E70', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz', notes: 'Dual-Sensor-Konferenz' },
  { id: 'huddly-l1', manufacturerUrl: 'https://www.huddly.com/conference-cameras/l1/', manufacturer: 'Huddly', model: 'L1', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'insta360-link-2', manufacturerUrl: 'https://www.insta360.com/product/insta360-link2', manufacturer: 'Insta360', model: 'Link 2', sensor: { name: '1/2" (6.4×4.8)', widthMm: 6.4, heightMm: 4.8, cropFactor: 5.41 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz', notes: 'KI-Webcam-Gimbal' },
  { id: 'elgato-facecam-mk2', manufacturerUrl: 'https://www.elgato.com/us/en/explorer/products/camera/facecam-mk2-rethink-what-a-webcam-can-do/', manufacturer: 'Elgato', model: 'Facecam MK.2', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['HD'], type: 'camcorder' },
  { id: 'avermedia-pw515', manufacturerUrl: 'https://www.avermedia.com/product-detail/PW515', manufacturer: 'AVerMedia', model: 'PW515', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder' },
  // ── PTZ (Ausbau 4) ──
  { id: 'panasonic-aw-ue160w', manufacturerUrl: 'https://pro-av.panasonic.net/en/products/aw-ue160/spec.html', manufacturer: 'Panasonic', model: 'AW-UE160W', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'sony-srg-x40uh', manufacturerUrl: 'https://pro.sony/ue_US/products/ptz-network-cameras/srg-x40uh', manufacturer: 'Sony', model: 'SRG-X40UH', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'lumens-vc-a51s', manufacturerUrl: 'https://www.mylumens.com/en/Products_detail/20/VC-A51S', manufacturer: 'Lumens', model: 'VC-A51S', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'lumens-vc-a71p', manufacturerUrl: 'https://www.mylumens.com/en/Products_detail/42/VC-A71P-4K-PTZ-Camera', manufacturer: 'Lumens', model: 'VC-A71P', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'avonic-cm93', manufacturerUrl: 'https://avonic.com/cm93/', manufacturer: 'Avonic', model: 'CM93-NDI', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'avonic-cm70', manufacturerUrl: 'https://avonic.com/cm70-series/', manufacturer: 'Avonic', model: 'CM70-NDI', sensor: { name: '1/3" (4.8×3.6)', widthMm: 4.8, heightMm: 3.6, cropFactor: 7.5 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'ptzoptics-move-4k-12', manufacturerUrl: 'https://ptzoptics.com/ptz-cameras/move-4k-12x', manufacturer: 'PTZOptics', model: 'Move 4K 12x', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'ptzoptics-studio-pro', manufacturerUrl: 'https://docs.ptzoptics.com/docs/cameras/g2-legacy/studio-pro', manufacturer: 'PTZOptics', model: 'Studio Pro', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'birddog-p200', manufacturerUrl: 'https://birddog.tv/p200-overview/p200-techspecs/', manufacturer: 'BirdDog', model: 'P200', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'birddog-p120', manufacturerUrl: 'https://birddog.tv/p110p120-overview/', manufacturer: 'BirdDog', model: 'P120', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'panasonic-aw-he38', manufacturerUrl: 'https://eu.connect.panasonic.com/global/en/broadcast-proav/aw-he38h', manufacturer: 'Panasonic', model: 'AW-HE38', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  // ── Kompakt / Bridge / Action (1" & Action) ──
  { id: 'sony-rx100-vii', manufacturerUrl: 'https://helpguide.sony.net/dsc/1920/v1/en/contents/TP0002392811.html', manufacturer: 'Sony', model: 'RX100 VII', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder' },
  { id: 'sony-zv-1', manufacturerUrl: 'https://helpguide.sony.net/dc/1910/v1/en/contents/TP0002928649.html', manufacturer: 'Sony', model: 'ZV-1', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder' },
  { id: 'sony-rx0-ii', manufacturerUrl: 'https://helpguide.sony.net/dsc/1910/v1/en/contents/TP0002240270.html', manufacturer: 'Sony', model: 'RX0 II', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder', notes: 'Ultra-Kompakt' },
  { id: 'canon-powershot-v10', manufacturerUrl: 'https://support.usa.canon.com/kb/index?page=content&id=ART183827', manufacturer: 'Canon', model: 'PowerShot V10', sensor: SENSORS.ONE_INCH, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder' },
  { id: 'panasonic-lx100-ii', manufacturerUrl: 'https://help.na.panasonic.com/answers/features-and-specifications-lumix-point-shoot-dc-lx100m2/', manufacturer: 'Panasonic', model: 'Lumix LX100 II', sensor: SENSORS.MFT, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder' },
  { id: 'dji-osmo-action-5', manufacturerUrl: 'https://www.dji.com/osmo-action-5-pro/specs', manufacturer: 'DJI', model: 'Osmo Action 5 Pro', sensor: { name: '1/1.3" (9.7×7.3)', widthMm: 9.7, heightMm: 7.3, cropFactor: 3.56 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'camcorder' },
  { id: 'gopro-hero11', manufacturerUrl: 'https://gopro.com/en/us/shop/cameras/hero11-black/CHDHX-111-master.html', manufacturer: 'GoPro', model: 'HERO11 Black', sensor: { name: '1/1.9" (6.9×5.2)', widthMm: 6.9, heightMm: 5.2, cropFactor: 5.01 }, mount: 'integrated', resolutions: ['5.3K','4K'], type: 'camcorder' },
  { id: 'insta360-ace-pro', manufacturerUrl: 'https://onlinemanual.insta360.com/acepro/en-us/specs/hardware-aceseries', manufacturer: 'Insta360', model: 'Ace Pro', sensor: { name: '1/1.3" (9.7×7.3)', widthMm: 9.7, heightMm: 7.3, cropFactor: 3.56 }, mount: 'integrated', resolutions: ['8K','4K'], type: 'camcorder' },
  { id: 'insta360-x3', manufacturerUrl: 'https://onlinemanual.insta360.com/x3/en-us/faq/specs/hardware', manufacturer: 'Insta360', model: 'X3', sensor: { name: '1/2" (6.4×4.8)', widthMm: 6.4, heightMm: 4.8, cropFactor: 5.41 }, mount: 'integrated', resolutions: ['5.7K','4K'], type: 'camcorder', notes: '360°' },

  // ── DSLR (Rental/Foto) ──
  { id: 'canon-eos-6d2', manufacturerUrl: 'https://asia.canon/en/support/6200470100', manufacturer: 'Canon', model: 'EOS 6D Mark II', sensor: SENSORS.FF, mount: 'EF', resolutions: ['HD'], type: 'mirrorless', notes: 'DSLR' },
  { id: 'canon-eos-80d', manufacturerUrl: 'https://my.canon/en/support/6200320100', manufacturer: 'Canon', model: 'EOS 80D', sensor: { name: 'Canon APS-C (22.3×14.9)', widthMm: 22.3, heightMm: 14.9, cropFactor: 1.61 }, mount: 'EF', resolutions: ['HD'], type: 'mirrorless', notes: 'DSLR' },
  { id: 'canon-eos-1dx2', manufacturerUrl: 'https://global.canon/en/c-museum/product/dslr846.html', manufacturer: 'Canon', model: 'EOS-1D X Mark II', sensor: SENSORS.FF, mount: 'EF', resolutions: ['4K','HD'], type: 'mirrorless', notes: 'DSLR' },
  { id: 'nikon-d780', manufacturerUrl: 'https://onlinemanual.nikonimglib.com/d780/en/16_technical_notes_08.html', manufacturer: 'Nikon', model: 'D780', sensor: SENSORS.FF, mount: 'NF', resolutions: ['4K','HD'], type: 'mirrorless', notes: 'DSLR' },
  { id: 'nikon-d500', manufacturerUrl: 'https://imaging.nikon.com/imaging/lineup/dslr/d500/', manufacturer: 'Nikon', model: 'D500', sensor: SENSORS.APSC, mount: 'NF', resolutions: ['4K','HD'], type: 'mirrorless', notes: 'DSLR' },
  { id: 'nikon-d6', manufacturerUrl: 'https://onlinemanual.nikonimglib.com/d6/en/18_technical_notes_09.html', manufacturer: 'Nikon', model: 'D6', sensor: SENSORS.FF, mount: 'NF', resolutions: ['4K','HD'], type: 'mirrorless', notes: 'DSLR' },
  { id: 'pentax-k1-ii', manufacturerUrl: 'https://us.ricoh-imaging.com/product/pentax-k-1-ii/', manufacturer: 'Pentax', model: 'K-1 Mark II', sensor: SENSORS.FF, mount: 'K', resolutions: ['HD'], type: 'mirrorless', notes: 'DSLR' },
  // ── Mittelformat (High-End) ──
  { id: 'hasselblad-x2d', manufacturerUrl: 'https://www.hasselblad.com/x-system/x2d-100c/', manufacturer: 'Hasselblad', model: 'X2D 100C', sensor: { name: 'Mittelformat 44×33', widthMm: 44, heightMm: 33, cropFactor: 0.79 }, mount: 'XCD', resolutions: ['HD'], type: 'mirrorless', notes: 'Nur Foto – kein Video' },
  { id: 'hasselblad-907x', manufacturerUrl: 'https://www.hasselblad.com/v-system/907x-cfv-100c/', manufacturer: 'Hasselblad', model: '907X & CFV 100C', sensor: { name: 'Mittelformat 44×33', widthMm: 44, heightMm: 33, cropFactor: 0.79 }, mount: 'XCD', resolutions: ['HD'], type: 'mirrorless', notes: 'Nur Foto – kein Video' },
  { id: 'phaseone-xt', manufacturerUrl: 'https://www.phaseone.com/xt-camera-2/', manufacturer: 'Phase One', model: 'XT / IQ4', sensor: { name: 'Mittelformat 53.4×40', widthMm: 53.4, heightMm: 40, cropFactor: 0.64 }, mount: 'XT', resolutions: ['HD'], type: 'mirrorless', notes: 'Nur Foto – kein Video' },
  { id: 'fuji-gfx100rf', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/gfx100rf/specifications/', manufacturer: 'Fujifilm', model: 'GFX100RF', sensor: { name: 'Mittelformat 44×33', widthMm: 44, heightMm: 33, cropFactor: 0.79 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'mirrorless', notes: 'Mittelformat Kompakt' },
  // ── Mirrorless (weitere) ──
  { id: 'sony-a7', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a7/specifications', manufacturer: 'Sony', model: 'A7 (Klassiker)', sensor: SENSORS.FF, mount: 'E', resolutions: ['HD'], type: 'mirrorless' },
  { id: 'sony-a7-ii', manufacturerUrl: 'https://www.dpreview.com/products/sony/slrs/sony_a7ii/specifications', manufacturer: 'Sony', model: 'A7 II', sensor: SENSORS.FF, mount: 'E', resolutions: ['HD'], type: 'mirrorless' },
  { id: 'sony-a1-ii', manufacturerUrl: 'https://helpguide.sony.net/ilc/2440/v1/en/contents/231h_specifications_ilc2440.html', manufacturer: 'Sony', model: 'A1 II', sensor: SENSORS.FF, mount: 'E', resolutions: ['8K','4K'], type: 'mirrorless' },
  { id: 'canon-eos-r6-mark-i', manufacturerUrl: 'https://cam.start.canon/en/C004/manual/html/UG-09_Reference_0100.html', manufacturer: 'Canon', model: 'EOS R6 (Klassiker)', sensor: SENSORS.FF, mount: 'RF', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'canon-eos-ra', manufacturerUrl: 'https://en.wikipedia.org/wiki/Canon_EOS_Ra', manufacturer: 'Canon', model: 'EOS Ra (Astro)', sensor: SENSORS.FF, mount: 'RF', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'fuji-xh1', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-h1/specifications/', manufacturer: 'Fujifilm', model: 'X-H1', sensor: SENSORS.APSC, mount: 'X', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'fuji-xt3', manufacturerUrl: 'https://www.fujifilm-x.com/global/products/cameras/x-t3/specifications/', manufacturer: 'Fujifilm', model: 'X-T3', sensor: SENSORS.APSC, mount: 'X', resolutions: ['4K','HD'], type: 'mirrorless' },
  { id: 'om-om3', manufacturerUrl: 'https://explore.omsystem.com/cameras/om-3', manufacturer: 'OM System', model: 'OM-3', sensor: SENSORS.MFT, mount: 'MFT', resolutions: ['4K','HD'], type: 'mirrorless' },
  // ── PTZ (Marken-Ausbau) ──
  { id: 'datavideo-ptc-305', manufacturerUrl: 'https://datavideo.com/product/PTC-305', manufacturer: 'Datavideo', model: 'PTC-305', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'datavideo-ptc-145', manufacturerUrl: 'https://datavideo.com/product/PTC-145', manufacturer: 'Datavideo', model: 'PTC-145', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['HD'], type: 'ptz' },
  { id: 'avonic-cm93-ip', manufacturerUrl: 'https://avonic.com/cm93/', manufacturer: 'Avonic', model: 'CM93-IP', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'sony-srg-a30-b', manufacturer: 'Sony', model: 'SRG-XB25', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'canon-cr-n300w', manufacturer: 'Canon', model: 'CR-N300 (weiß)', sensor: { name: '1/2.3" (6.17×4.55)', widthMm: 6.17, heightMm: 4.55, cropFactor: 5.64 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'ptzoptics-move-4k-ndi', manufacturerUrl: 'https://docs.ptzoptics.com/docs/cameras/move-4k/technical-specs', manufacturer: 'PTZOptics', model: 'Move 4K SDI', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'lumens-vc-b11u', manufacturerUrl: 'https://www.mylumens.com/en/Products_detail/1047/VC-B11U-Video-Conference-Camera', manufacturer: 'Lumens', model: 'VC-B11U', sensor: { name: '1/2.8" (5.37×4.04)', widthMm: 5.37, heightMm: 4.04, cropFactor: 6.7 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'marshall-cv730-ndi', manufacturerUrl: 'https://marshall-usa.com/cameras/CV730-NDI/', manufacturer: 'Marshall', model: 'CV730-NDI', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },
  { id: 'aida-uhd-100a', manufacturer: 'AIDA', model: 'UHD-100A', sensor: { name: '1/2.5" (5.76×4.29)', widthMm: 5.76, heightMm: 4.29, cropFactor: 6.25 }, mount: 'C/CS', resolutions: ['4K','HD'], type: 'broadcast' },
  { id: 'aida-ptz4k-ndi', manufacturer: 'AIDA', model: 'PTZ4K-NDI-X30', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'integrated', resolutions: ['4K','HD'], type: 'ptz' },

  // ── Marshall POV ──
  { id: 'marshall-cv568', manufacturerUrl: 'https://marshall-usa.com/cameras/CV568/', manufacturer: 'Marshall', model: 'CV568', sensor: { name: '1/1.8" (7.44×5.58)', widthMm: 7.44, heightMm: 5.58, cropFactor: 4.84 }, mount: 'M12', resolutions: ['HD'], type: 'broadcast', notes: 'POV camera, global shutter' },
];

export function getCameraById(id: string, customCameras?: Camera[]): Camera | undefined {
  // Custom entries take precedence — when the user edits a built-in we shadow
  // it with a customCameras entry that has the same id, and that should win.
  return customCameras?.find((c) => c.id === id) ?? CAMERAS.find((c) => c.id === id);
}

export function getCamerasByType(type: Camera['type']): Camera[] {
  return CAMERAS.filter((c) => c.type === type);
}

/**
 * Canonical focal-reducer ("Speed Booster") per lens→body mount combo, keyed
 * "<lensMount>-><bodyMount>". Only the common 0.71× ULTRA variant is modelled
 * because the UI exposes Speed Booster as a single on/off toggle; the widened
 * sensor is derived from the body's own native sensor at runtime, so one entry
 * stays correct on any body that exposes the combo (MFT, FZ, S35 E …).
 *
 * This is intentionally NOT a global auto-adapter catalogue — it only resolves
 * when the operator explicitly enables `VenueCamera.useSpeedbooster`, matching
 * the strict, opt-in mount model below.
 */
const SPEED_BOOSTERS: Record<string, { name: string; factor: number }> = {
  'EF->MFT': { name: 'Metabones EF → MFT Speed Booster ULTRA II 0.71×',   factor: 0.71 },
  'EF->FZ':  { name: 'Metabones EF → FZ Speed Booster ULTRA 0.71×',       factor: 0.71 },
  'EF->E':   { name: 'Metabones EF → E CINE Speed Booster ULTRA II 0.71×', factor: 0.71 },
  'EF->X':   { name: 'Metabones EF-X CINE Speed Booster ULTRA II 0.71×',  factor: 0.71 },
  'NF->E':   { name: 'Metabones Nikon G → E Speed Booster ULTRA II 0.71×', factor: 0.71 },
  'NF->MFT': { name: 'Metabones Nikon G → MFT Speed Booster ULTRA 0.71×',  factor: 0.71 },
};

/** True when a Speed Booster focal reducer exists for the lens→body mount combo. */
export function speedBoosterExists(lensMount?: string, bodyMount?: string): boolean {
  if (!lensMount || !bodyMount) return false;
  return `${lensMount}->${bodyMount}` in SPEED_BOOSTERS;
}

/**
 * Resolve the Speed Booster fitted between an adapted lens and the body, if the
 * combo is supported. The widened sensor is computed from the body's own native
 * sensor (focal reduction enlarges the captured area by 1/factor), so a 0.71×
 * booster reports the correct effective frame on an MFT, FZ or S35 body alike.
 */
export function getSpeedBooster(camera: Camera, activeMount?: string): AdapterInfo | null {
  const lensMount = activeMount ?? camera.mount;
  const def = SPEED_BOOSTERS[`${lensMount}->${camera.mount}`];
  if (!def) return null;
  const { factor, name } = def;
  const widened: SensorSize = {
    name: `${camera.sensor.name} + Speed Booster ${factor}×`,
    widthMm: camera.sensor.widthMm / factor,
    heightMm: camera.sensor.heightMm / factor,
    cropFactor: camera.sensor.cropFactor * factor,
  };
  // Focal reduction is a light *gain*: stops = 2·log2(factor) (negative).
  const lightLossStops = Math.round(2 * Math.log2(factor) * 10) / 10;
  return {
    name,
    lightLossStops,
    cropSensor: widened,
    notes: `Focal reducer between the ${lensMount} lens and the ${camera.mount} body. Widens the field of view by 1/${factor} and gains ~${Math.abs(lightLossStops)} T-stop; the effective sensor area scales up accordingly.`,
  };
}

/**
 * Determine the adapter currently fitted on the camera, if any.
 *
 * Strict model:
 *   - The user picks the mount plate via the camera's Mount selector
 *     (`VenueCamera.activeMount`). Whatever adapter is needed to convert from
 *     `camera.mount` to `activeMount` is described in
 *     `camera.mountAdapters[activeMount]`.
 *   - The lens MUST match `activeMount`. There is no automatic "you picked a
 *     B4 lens so we'll assume you also fitted the LA-FZB1" — that path made
 *     the calculator silently apply optical penalties the user never opted
 *     into. Lens-mount mismatches are surfaced as an incompatibility warning
 *     in the UI instead.
 *   - Speed Booster is an opt-in focal reducer (`VenueCamera.useSpeedbooster`)
 *     that swaps in for the passive mount plate. When enabled and a booster
 *     exists for the active lens mount → body mount combo (see SPEED_BOOSTERS),
 *     it supersedes the body's plain mountAdapter entry.
 */
export function getAdapterInfo(camera: Camera, _lens: Lens, useSpeedbooster = false, activeMount?: string): AdapterInfo | null {
  const effectiveMount = activeMount ?? camera.mount;

  if (useSpeedbooster) {
    const booster = getSpeedBooster(camera, effectiveMount);
    if (booster) return booster;
  }

  return camera.mountAdapters?.[effectiveMount] ?? null;
}

/**
 * Get the effective sensor size, accounting for adapter crop and selected hardware mode.
 * Priority (highest first):
 *   1. Adapter crop (e.g. B4 relay forces 2/3", Speedbooster widens MFT)
 *   2. Camera hardware sensor mode (URSA B4 crop, VENICE window, FX9 S35 etc.)
 *   3. Camera default sensor
 */
export function getEffectiveSensor(camera: Camera, lens: Lens, useSpeedbooster = false, sensorModeIndex?: number, activeMount?: string): SensorSize {
  const adapter = getAdapterInfo(camera, lens, useSpeedbooster, activeMount);
  if (adapter?.cropSensor) return adapter.cropSensor;
  if (
    sensorModeIndex !== undefined &&
    sensorModeIndex >= 0 &&
    camera.sensorModes &&
    sensorModeIndex < camera.sensorModes.length
  ) {
    return camera.sensorModes[sensorModeIndex];
  }
  return camera.sensor;
}

/**
 * Get effective aperture accounting for adapter light loss.
 */
export function getEffectiveAperture(camera: Camera, lens: Lens, aperture: number, useSpeedbooster = false, activeMount?: string): number {
  const adapter = getAdapterInfo(camera, lens, useSpeedbooster, activeMount);
  if (!adapter || adapter.lightLossStops === 0) return aperture;
  // Each stop doubles the area, so T-number increases by 2^(stops/2)
  // Negative lightLossStops = gain (speedbooster)
  return aperture * Math.pow(2, adapter.lightLossStops / 2);
}

// ── Lens image circle (mm) by mount ──
// Rough nominal projected circle diameter for each lens family. Used by
// getCoverageStatus to warn when a lens can't fully cover the effective
// sensor (vignetting). A lens that publishes a smaller circle than its
// mount suggests (Sigma DC, Tamron Di III-A, Canon EF-S, Sony E APS-C)
// should set `Lens.imageCircle` to override this default.
const MOUNT_IMAGE_CIRCLE_MM: Record<string, number> = {
  PL:   31.4,  // Super-35 image circle
  LPL:  46.3,  // Full-frame / VistaVision
  EF:   43.3,
  RF:   43.3,
  E:    43.3,  // FE-mount lenses; APS-C E glass overridden via Lens.imageCircle
  L:    43.3,
  NF:   43.3,
  FZ:   31.4,  // Sony FZ is S35-class
  MFT:  21.6,
  X:    28.2,  // Fujifilm X is APS-C
  B4:   11.0,  // 2/3" broadcast
  M12:  8.0,   // POV / industrial — well under 1/2"
  integrated: 0,
  universal: 43.3,
};

// Explicit image-circle diameters in mm, keyed by Lens.imageCircle kind.
const IMAGE_CIRCLE_KIND_MM: Record<string, number> = {
  FF:   43.3,
  S35:  31.4,
  APSC: 28.2,
  MFT:  21.6,
  '2/3': 11.0,
  '1':  16.0,
  MF:   55.0,
  integrated: 0,
};

export type CoverageStatus = 'ok' | 'marginal' | 'vignette';
export interface CoverageResult {
  status: CoverageStatus;
  ratio: number;
  message?: string;
}

/**
 * Compare the lens image circle (inferred from its mount) against the
 * effective sensor diagonal so the UI can warn about vignetting. B4 lenses
 * on a Super-35 body without the right relay adapter, for example, leave
 * massive black corners; this catches that mid-setup.
 */
export function getCoverageStatus(camera: Camera, lens: Lens, useSpeedbooster = false, activeMount?: string, sensorModeIndex?: number): CoverageResult {
  if (lens.mount === 'integrated') return { status: 'ok', ratio: 1 };
  const adapter = getAdapterInfo(camera, lens, useSpeedbooster, activeMount);
  // Adapter with a cropSensor (B4 relay, Speedbooster) re-projects the lens
  // onto its own sensor area. The effective image circle is then bounded by
  // that adapter's crop, not by the bare lens.
  // Explicit `lens.imageCircle` overrides the per-mount heuristic so that
  // crop-format glass on a full-frame mount (Sigma DC, EF-S etc.) flags
  // correctly.
  let circle = lens.imageCircle
    ? IMAGE_CIRCLE_KIND_MM[lens.imageCircle] ?? 43.3
    : MOUNT_IMAGE_CIRCLE_MM[lens.mount] ?? 43.3;
  if (adapter?.cropSensor) {
    const adapterDiag = Math.hypot(adapter.cropSensor.widthMm, adapter.cropSensor.heightMm);
    circle = Math.min(circle, adapterDiag);
  }
  const sensor = getEffectiveSensor(camera, lens, useSpeedbooster, sensorModeIndex, activeMount);
  const sensorDiag = Math.hypot(sensor.widthMm, sensor.heightMm);
  if (sensorDiag <= 0) return { status: 'ok', ratio: 1 };
  const ratio = circle / sensorDiag;
  if (ratio >= 1.0) return { status: 'ok', ratio };
  if (ratio >= 0.9) {
    return { status: 'marginal', ratio, message: `Bildkreis knapp (${(ratio * 100).toFixed(0)} %) — Ecken können abdunkeln.` };
  }
  return { status: 'vignette', ratio, message: `Objektiv deckt den Sensor nicht (${(ratio * 100).toFixed(0)} %) — starke Vignettierung, Crop nötig.` };
}

export const CAMERA_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#8b5cf6',
  '#f43f5e', '#0ea5e9', '#84cc16', '#d946ef', '#fb923c',
];
