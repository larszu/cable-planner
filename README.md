<h1 align="center">⚡ CablePlanner</h1>

<p align="center">
  Visual cable planning for broadcast workflows
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" />
  <img src="https://img.shields.io/badge/offline-ready-success" />
  <img src="https://img.shields.io/badge/built%20with-Electron%20%2B%20React-9cf" />
  <img src="https://img.shields.io/badge/typescript-strongly%20typed-blue" />
  <img src="https://img.shields.io/badge/status-active%20development-orange" />
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" />
</p>

<p align="center">
  Plan, visualize, and manage complex broadcast cabling systems with real-world production integrations.
</p>

<!-- HERO IMAGE — see docs/screenshots/README.md for capture + redaction guide -->
<p align="center">
  <img src="docs/screenshots/hero.png" alt="CablePlanner — node-based broadcast cabling canvas" width="860" />
  <br />
  <sub><i>The node-based canvas — equipment nodes, ports and routed signal cabling.</i></sub>
</p>

---

## ✨ Overview

**CablePlanner** is a desktop application for designing, visualizing, and managing broadcast signal infrastructure.  
Built with **Electron, React, and TypeScript**, it provides a node-based canvas for mapping complex audio, video, and data signal flows.

It is designed for real-world production environments such as studios, OB vans, and live event setups.

✔ Fully offline desktop application  
✔ macOS & Windows support  
✔ Production-focused broadcast tooling  
✔ Extensible integration system  

---

## 📸 Screenshots


<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/screenshots/properties.png" alt="Device properties panel showing ports, colour, dimensions and ATEM tools" width="420" /><br />
      <b>Device &amp; location properties</b>
    </td>
    <td width="50%" align="center">
      <img src="docs/screenshots/atem-multiview.png" alt="ATEM multiviewer layout editor with program and preview windows" width="420" /><br />
      <b>ATEM multiviewer editor</b>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/screenshots/export.png" alt="Export and print hub with PDF, PNG, JPEG, SVG options and layer filter" width="420" /><br />
      <b>Export &amp; print hub</b>
    </td>
    <td width="50%" align="center">
      <img src="docs/screenshots/bom.png" alt="Cable bill of materials aggregated by connector type and length" width="420" /><br />
      <b>Cable bill of materials</b>
    </td>
  </tr>
  <tr>
    <td colspan="2" align="center">
      <img src="docs/screenshots/patch-sheets.png" alt="Per-device patch sheet generator with device selection" width="420" /><br />
      <b>Per-device patch sheets</b>
    </td>
  </tr>
</table>

---

## ✨ Core Features

### 🎛️ Visual Cable Canvas
- Drag & drop node-based interface (React Flow)
- Equipment nodes with input/output ports
- Interactive cable connections between devices
- Cable metadata (type, length, color, notes)
- Zoom, pan, minimap navigation
- Real-time signal topology visualization

---

### 🔌 Equipment & Cable Management
- Built-in broadcast equipment library
- Custom device templates
- Port-level connection system
- Cable properties:
  - Type (SDI, HDMI, Ethernet, etc.)
  - Length tracking
  - Color coding
  - Labeling & notes
- Reusable project components

---

### 📡 ATEM Multiviewer Configuration
- Visual multiview layout editor
- Camera / program / preview assignment
- Grid-based layout system
- Preconfigured source mapping
- Exportable production configs

Compatible with Blackmagic ATEM switchers (Television Studio, Constellation, and M/E models).

---

### 🔀 Videohub Routing Configuration
- SDI routing visualization
- Source → destination patch mapping
- Logical router configuration editor
- Visual signal path overview
- Exportable routing setups

Designed for Blackmagic Videohub infrastructure.

---

### 🔗 Rentman Integration
- Secure API integration with the Rentman rental-management platform
- Import projects, equipment, and categories
- Token-based authentication (encrypted local storage)
- No credentials stored in source code
- Selective import workflow (project/equipment filtering)

---

### 📄 Export & Documentation
- PDF export of full cable layouts
- Includes:
  - Equipment lists
  - Cable metadata
  - Signal routing overview
- Print-ready production documentation

---

## 🧠 Project Management
- Local JSON project system
- New / Open / Save / Save As workflows
- Recent projects list (auto-managed)
- Safe file handling with concurrency protection

---

## ⚙️ Experimental Features
- 🌐 Shared network-drive sync for multi-planner collaboration *(experimental)*
- 🗄️ 3D rack builder with STL export *(in progress)*
- 🎧 GreenGo intercom configuration export *(experimental)*
- 📱 Mobile build-day viewer (LAN + QR) for field technicians

---

## 🛠️ Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Desktop shell | **Electron** |
| UI | **React 19** + **TypeScript** |
| Canvas | **React Flow** (node graph) |
| 3D rack view | **three.js** / react-three-fiber |
| Styling | **Tailwind CSS** (token-based theming) |
| State | **Zustand** stores with localStorage autosave |
| Build | **Vite** |
| Export | **jsPDF** (vector + raster PDF, PNG/JPEG/SVG) |

The app is **offline-first**: every project is a local JSON file, all
state lives on-device, and integrations (Rentman, ATEM, Videohub) are opt-in.

---

## 🚀 Getting Started

**Prerequisites:** [Node.js](https://nodejs.org/) 20+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Run the desktop app in development (Vite + Electron, hot-reload)
npm run dev

# 3. Type-check, lint
npx tsc -p tsconfig.app.json --noEmit
npm run lint

# 4. Production build (renderer + main + preload)
npm run build

# 5. Package distributable installers (macOS / Windows)
npm run dist
```

> Tip: `npm run dev` launches the full Electron shell. The renderer also runs
> in a plain browser (`npm run dev:renderer` → `localhost:5173`) for quick UI
> work, though desktop-only features (file I/O, ATEM/LAN) are inert there.

---

## 📚 Documentation

- [`docs/architecture.md`](docs/architecture.md) — Process model, IPC, store
  architecture, build & release workflow, non-negotiable invariants.
- [`docs/app-structure.html`](docs/app-structure.html) — interactive module
  overview (open in a browser).
- [`docs/comparison.html`](docs/comparison.html) — competitor comparison.

---

## 👤 Author

Built and maintained by **Lars Zumpe**

---

## ❤️ Support / Donate

If CablePlanner saves you time on your next show, consider buying me a coffee:

<p>
  <a href="https://paypal.me/larszumpe">
    <img src="https://img.shields.io/badge/PayPal-larszumpe-00457C?logo=paypal&logoColor=white" alt="Donate via PayPal" />
  </a>
</p>

Donations are completely optional — the app stays MIT-licensed and free either way. 🙌

---

## 📄 License

MIT
