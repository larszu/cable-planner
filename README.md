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
  <sub><i>TODO: capture — full canvas overview (dark theme). See <a href="docs/screenshots/README.md">docs/screenshots/README.md</a>.</i></sub>
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

> Images live in [`docs/screenshots/`](docs/screenshots/). Slots marked
> **TODO: capture** still need a real screen grab — see the capture **and
> redaction** guide in [`docs/screenshots/README.md`](docs/screenshots/README.md).
> ⚠️ Every screenshot must be scrubbed of customer-identifying data before
> it is committed (project/client names, personal names).

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/screenshots/canvas.gif" alt="Node-based cable canvas with equipment nodes and routed connections" width="420" /><br />
      <b>Visual cable canvas</b><br /><sub><i>TODO: capture (animated)</i></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/screenshots/rack-3d.png" alt="3D rack builder showing rack-mounted devices" width="420" /><br />
      <b>3D rack builder</b><br /><sub><i>TODO: capture</i></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/screenshots/atem-multiview.png" alt="ATEM multiviewer layout editor" width="420" /><br />
      <b>ATEM multiview editor</b>
    </td>
    <td width="50%" align="center">
      <img src="docs/screenshots/export.png" alt="Export and print hub with PDF / PNG / JPEG options" width="420" /><br />
      <b>Export &amp; print hub</b><br /><sub><i>TODO: capture</i></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/screenshots/patch-sheets.png" alt="Per-device patch sheet generator" width="420" /><br />
      <b>Per-device patch sheets</b><br /><sub><i>TODO: capture</i></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/screenshots/patch-pdf.png" alt="Generated patch-list PDF with inputs and outputs" width="420" /><br />
      <b>Generated patch-list PDF</b><br /><sub><i>TODO: capture</i></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/screenshots/bom.png" alt="Location bill of materials with cable and device totals" width="420" /><br />
      <b>Bill of materials (BOM)</b><br /><sub><i>TODO: capture</i></sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/screenshots/properties.png" alt="Device and location properties panel" width="420" /><br />
      <b>Properties panel</b><br /><sub><i>TODO: capture</i></sub>
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

Compatible with Blackmagic ATEM Television Studio systems.

---

### 🔀 Videohub Routing Configuration
- SDI routing visualization
- Source → destination patch mapping
- Logical router configuration editor
- Visual signal path overview
- Exportable routing setups

Designed for Blackmagic Videohub infrastructure.

---

### 📡 Rentman Integration
- Secure API integration with :contentReference[oaicite:2]{index=2}
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
- 📦 Cable Bill of Materials (BOM) generator *(in progress)*
- 🌐 Network / Sync collaboration system *(planned)*
- 🔌 Extended device integrations (ATEM, Videohub, etc.)
- 🧪 Greengo configuration export *(experimental)*

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
