# cable-planner

**cable-planner** is a desktop application for planning and visualizing broadcast equipment cabling, built with Electron, React, and TypeScript. It works offline, runs on macOS and Windows, and integrates with Rentman for equipment import.

---

## Features

### Stable & Tested
- **Visual Canvas:**  
  Intuitive drag-and-drop interface using React Flow for cabling layouts
  - Equipment nodes with dynamic input/output ports
  - Interactive cable connections/edges between ports
  - Cable metadata (type, length, color, notes)
  - Zoom/pan/minimap support
- **Project Management:**  
  - Local JSON project files: *New*, *Open*, *Save*, *Save As*, *Recent projects*
  - Automatic management of recent projects (10-entry list)
  - File locking and safe concurrent editing on supported platforms
- **Standalone Mode:**  
  Fully manual equipment and layout planning
- **Properties Editor:**  
  Edit equipment and cable properties in a dedicated panel
- **Equipment Library:**  
  - Built-in templates for common broadcast gear
  - User-defined custom equipment support
- **Secure Rentman Integration:**  
  - Import projects/equipment from Rentman via API token
  - Token is encrypted and never stored or hardcoded
  - Rentman import flow with project/equipment selector and category-based checklist
- **PDF Export:**  
  Create PDF plans of your cable layout, including metadata

### Beta / Partially Tested
- **Cable Length Checks:**  
  Visual warning if cable is unusually long or source/target is the same port
- **Multiviewer (ATEM) Planner:**  
  Dialog for laying out ATEM MVs, including preconfigured sources and manual grid design

### In Development / Experimental
- **Cable BOM (Bill of Materials):**  
  Generate cable lists directly for purchasing or rental logistics  *(UI present, logic evolving)*
- **Greengo Config Export:**  
  Experimental Greengo device config serialization/export for real-world deployments
- **Network/Sync Features:**  
  *Planned*: Collaboration and project sync (desktop only; not yet implemented)
- **More Integrations:**  
  Support for additional device brands (Atem, Videohub, etc.) *[In progress, foundations in code]*

---

## Tech Stack

- Electron
- React 18+, TypeScript
- Vite
- React Flow
- Tailwind CSS
- keytar (secure token storage)
- zustand (state management)
- axios
- electron-builder (packaging/distribution)

---

## Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [npm](https://www.npmjs.com/) 10+

```bash
npm install
```

### Start in Development

```bash
npm run dev
```
... (see previous messages for details)

---

## Quality & Testing Status

- **Visual canvas, file I/O, Rentman import flow, and token management** are well-tested in production.
- **PDF export, cable property panels, and library mechanics** are covered in most workflows.
- **Multiviewer planner, Greengo export, and Bill of Materials** are under testing and may change.
- **Network/Sync and advanced device integration** are under active development or at prototype stage.

We welcome test feedback and issue reports—see [Contributing](#contributing).

---

... (Keep the rest as in previous drafts for contribution, license, etc.)
