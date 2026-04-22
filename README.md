# cable-planner

**cable-planner** is an offline-capable desktop app for planning and visualizing broadcast equipment cabling on macOS and Windows.

## Features

- Electron + React + TypeScript desktop application
- Two operating modes:
  - **Standalone mode** (manual equipment planning)
  - **Rentman mode** (optional import via API token)
- Secure Rentman API token storage via **keytar**
- Rentman import flow:
  - Load projects
  - Select project
  - Load project equipment
  - Select equipment via checklist (grouped by category)
  - Import into local project
- Visual canvas powered by **React Flow**
  - Equipment nodes with input/output ports
  - Cable edges between ports
  - Cable metadata dialog (type, length, color, notes)
  - Zoom/pan/minimap
- Equipment library with common broadcast templates
- Properties panel for selected equipment/cable editing
- Local project JSON file workflow
  - New
  - Open
  - Save
  - Save As
  - Recent projects

## Tech Stack

- Electron
- React 18+ with TypeScript
- Vite
- React Flow
- Tailwind CSS
- keytar
- axios
- zustand
- electron-builder

## Installation & Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Start Development

```bash
npm run dev
```

This starts:

- Vite renderer dev server
- TypeScript watch build for Electron main process
- Electron app connected to the local renderer

## Rentman API Token Configuration

1. Open the app.
2. Click **Settings** in the top bar.
3. Paste your Rentman API Bearer token.
4. Click **Save Token**.
5. Optionally click **Test Token**.
6. Use **Rentman Import** to load projects/equipment.

Token storage is encrypted in the OS credential vault via `keytar` and is never hardcoded in source.

## Development Guide

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

## Production Builds (macOS + Windows)

```bash
npm run dist
```

Generated installers are created by `electron-builder` for:

- macOS (`dmg`)
- Windows (`nsis`)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run lint/build locally
4. Open a pull request

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
