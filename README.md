<h1 align="center">⚡ CablePlanner</h1>

<p align="center">
  <b>Broadcast cable planning software</b> — a node-based editor for AV, Network and Power Signal flow,<br />
  ATEM multiviewer layouts and Blackmagic Videohub routing.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" />
  <img src="https://img.shields.io/badge/offline-ready-success" />
  <img src="https://img.shields.io/badge/status-active%20development-orange" />
  <img src="https://img.shields.io/badge/license-proprietär-critical" />
</p>

<p align="center">
  Plan, visualize, and document complex broadcast cabling systems — from camera to switcher to encoder — with real-world production integrations.
</p>

<!-- DOWNLOAD CTA — always points at the newest GitHub release (installers auto-built in CI) -->
<p align="center">
  <a href="https://github.com/larszu/cable-planner/releases/latest">
    <img src="https://img.shields.io/badge/⬇%20Download%20for%20macOS%20%26%20Windows-863bff?style=for-the-badge&logo=github&logoColor=white" alt="Download CablePlanner for macOS and Windows" height="42" />
  </a>
  &nbsp;
  <a href="https://larszu.github.io/cable-planner/">
 
  </a>
  <br />
  <sub>Kostenlos nutzbar, proprietär lizenziert · <code>.dmg</code> (Apple Silicon + Intel) and <code>.exe</code> installers attached to every release</sub>
</p>

<!-- HERO IMAGE — see docs/screenshots/README.md for capture + redaction guide -->
<p align="center">
  <img src="docs/screenshots/hero.png" alt="CablePlanner — node-based broadcast cabling canvas for SDI signal flow, ATEM and Videohub" width="860" />
  <br />
  <sub><i>The node-based canvas — equipment nodes, ports and routed signal cabling.</i></sub>
</p>


---

## The web page

Every push to the default branch builds this repo's page from
`.github/workflows/pages.yml` and publishes it:

**https://larszu.github.io/cable-planner/**

The workflow **asks the Pages API before it configures anything.** With no
Pages site it still builds — that is a real check — and skips only the
publishing step, with a warning and the one missing step in the run summary.
A run that must stay red for a click nobody made teaches people to ignore red.

Measured 2026-09-09: **published** — the `deploy` job ran and succeeded.

---
## ✨ Overview

**CablePlanner** is free-to-use **broadcast cable planning software** for designing and visualizing **SDI signal flow**, **ATEM multiviewer** layouts and **Blackmagic Videohub routing** on a node-based canvas. It runs **fully offline** on macOS and Windows, so every audio, video and data run is documented before you ever pull cable on site.

Built with **Electron, React, and TypeScript**, it is designed for real-world production environments such as studios, OB vans, and live event setups — a modern alternative to legacy AV/broadcast wiring tools. The source is public to read; the licence is proprietary (see [LICENSE](LICENSE)).

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
- **Runs split into the stock lengths you actually own** (#875): record the
  drums this production runs (Settings → Project → *Available stock lengths*),
  and the cable bill of materials turns a 137 m run into 100 + 50 with one
  coupler. Fewest couplers first, least excess second — a coupler is a
  connection that can come loose, ten metres of excess cost coiling. The split
  and the coupler count go into the on-screen list, the CSV and the PDF, and
  the list says what the stock does not cover. An entry without a counted
  quantity produces no warning: nobody counted, so there is nothing to warn
  about.
- Reusable project components

---

### 🔁 Adapters, gender changers, converters

Three different things, kept apart (#876):

- An **adapter** changes the shape of the plug — BNC to RCA. The signal stays
  what it was; a piece of metal does it.
- A **gender changer** changes only pin or socket. Two XLR plugs do not mate,
  although both are XLR. Port gender was already recorded and was invisible
  to every compatibility check until now — that is the error nobody sees in
  the plan and everybody finds at the dock.
- A **converter** changes the signal — SDI to HDMI. It has a manufacturer, a
  bandwidth limit and a price, and none of those is in the plan. The planner
  therefore **names** it and never inserts it.

The first two can be inserted with one click on the selected cable: one run
becomes two with the device in between, at its place on the canvas and in the
picking list. **One undo takes all of it back** — the insertion is a single
store write, not three that happen to fall inside a coalescing window.

The inserted adapter claims nothing: direction and power stay "unknown", so
the plan check lists it as an **open point** and not as a green tick. A green
tick for a part nobody has checked costs more than an open point.

---

### 🟥 LED walls

- Panel types with the figures off the datasheet — pixel pitch, resolution,
  size, and, where stated, weight and power (average **and** peak)
- Opening in millimetres → grid, with the leftover shown: a tile that only
  half fits does not fit, and the remainder is the figure you hang the wall by
- Totals: panel count, resolution, size, weight, load
- Sending card: how many ports the wall needs against how many it has
- **Pixel map as PNG**, exactly as large as the wall has pixels, tiles
  numbered row by row from the top left — the order a wall is built in
- Nothing is estimated: a panel type without a weight gives a wall of unknown
  weight, not one of zero, and a sending card nobody recorded says nothing
  rather than "fine"

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

### 🔗 Integrations & Interchange
- **Rentman** — import projects, equipment and categories from the rental
  platform, with a selective import workflow
- **NetBox** — import racks, devices and cable paths from the DCIM side
- **GraphML** — import existing diagrams, with a preview before anything lands
  in the plan
- **Green-GO** — intercom configuration export (`.gg5`), plus a
  **vendor-neutral intercom exchange file** that someone building a Riedel or
  Clear-Com system can also read
- **`.avplan`** — the shared exchange format across the planner suite

API tokens live in the **operating system's credential store** (macOS Keychain,
Windows Credential Manager, libsecret) through `keytar` — not in the project
file, not in browser storage, not in source. Exports strip them before writing.

---

### 👥 Live Collaboration
- Real-time co-editing over **WebRTC** with a CRDT document — no server holds
  your plan
- Presence: who is in the room, and where they are working
- Join by **invite link**, or find open sessions on the LAN automatically
- **Room password** encrypts the session end-to-end; without it, anyone who
  knows the room name can read along
- Bring your own **signaling relay and STUN/TURN servers** for connections
  across networks — or switch on **local-only** mode, where nothing leaves
  your LAN
- Collaborative undo takes back *your* edits, not other people's

---

### 🗄️ Inventory & Stock
- Warehouse stock with storage locations, serial numbers and quantities
- The plan's demand checked against what is actually in stock — including the
  parts that are not equipment nodes (drum kits, wireless rigs, patch fields)
- Portable stock file, importable and mergeable

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

## 📱 On Site
- **Mobile build-day view** over the LAN, opened by QR code — no install, no
  account. It is not read-only: the build team ticks off what is done, adds
  cables it actually pulled, and files change requests, all of which come back
  into the plan.
- **Label sheets and QR labels** for cables and devices, print-ready.
- **Read-only web viewer** for sharing a plan with someone who does not run the
  app.

---

## ⚙️ Experimental Features
- 🌐 Shared network-drive sync for multi-planner collaboration *(experimental)*
- 🗄️ 3D rack builder with STL export *(in progress)*

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

## 🆚 CablePlanner vs. the alternatives

Looking for a **WireCAD alternative**, a **D-Tools** or **Microsoft Visio**
replacement for AV/broadcast wiring, or something more domain-specific than
**draw.io**? Here is where CablePlanner fits:

| | **CablePlanner** | WireCAD | D-Tools SI | Visio / draw.io |
| --- | --- | --- | --- | --- |
| Price | **Kostenlos · proprietär** | ~$1,500–4,500 | $1,000s / yr | Subscription / free |
| Platforms | **macOS + Windows** | Windows only | Windows + SQL Server | Windows / web |
| File format | **Open JSON (git-diffable)** | Proprietary | Proprietary | VSDX / XML |
| Broadcast-smart defaults | **Yes** (connector→layer, BOM, patch sheets) | Yes | Partial | No |
| ATEM / Videohub live control | **Yes** | No | No | No |
| 3D rack view | **Yes** *(in progress)* | No | No | No |

- **vs. WireCAD** — CablePlanner wins on platform support, open file format,
  modern UX and live hardware control; WireCAD has the deeper symbol library and
  a longer-established workflow.
- **vs. D-Tools System Integrator** — different league: D-Tools covers the full
  quote → invoice business lifecycle, while CablePlanner is a focused planning
  tool (complementary, not competing).
- **vs. EPlan / WSCAD** — those target industrial-electrical and control-cabinet
  design; CablePlanner is purpose-built for AV/broadcast signal flow.
- **vs. draw.io / Visio** — general diagramming tools are a workaround for AV;
  CablePlanner adds connector-aware layers, a cable bill of materials and
  patch-sheet logic out of the box.

📊 Full structural comparison: [`docs/comparison.html`](docs/comparison.html).

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
> in a plain browser (`npm run dev:renderer` → `localhost:4181`) for quick UI
> work, though desktop-only features (file I/O, ATEM/LAN) are inert there.

---

## 📚 Documentation
- [**`docs/README.md`**](docs/README.md) — index of everything in `docs/`,
  grouped by operations, development, domain concepts and dated audits.
- [`docs/self-hosted-relay.md`](docs/self-hosted-relay.md) — run your own
  signaling relay and TURN server for live collaboration across networks.
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

Donations are completely optional — the app stays free to use. It is proprietary software, not open source. 🙌

---

## 📄 License

Proprietär — © 2026 Lars Zumpe, alle Rechte vorbehalten. Nutzung der veröffentlichten Builds ist kostenlos; Weiterverbreitung und abgeleitete Werke sind es nicht. Siehe [LICENSE](LICENSE).

Die gebündelten Fremdpakete behalten ihre eigenen Lizenzen; deren Texte und
Copyright-Hinweise stehen vollständig in
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) (erzeugt von
`scripts/generate-notices.mjs` aus dem Produktions-Dependency-Baum).
