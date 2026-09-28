<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/renderer/assets/brand/lzm_hauptlogo_offwhite.svg" />
    <img src="src/renderer/assets/brand/lzm_hauptlogo_navy.svg" alt="Lars Zumpe Medienproduktion" width="220" />
  </picture>
</p>

<h1 align="center">LZ Cable Planner</h1>

<p align="center">
  <b>Broadcast and AV cable planning for macOS and Windows.</b><br />
  Draw the signal flow, get real cable lengths, and hand over every list the build day needs.
</p>

<p align="center">
  <a href="https://github.com/larszu/cable-planner/releases/latest">
    <img src="https://img.shields.io/badge/Download-macOS%20%26%20Windows-1D324F?style=for-the-badge&logo=github&logoColor=white" alt="Download LZ Cable Planner for macOS and Windows" height="40" />
  </a>
  &nbsp;
  <a href="https://larszu.github.io/cable-planner/">
    <img src="https://img.shields.io/badge/Open%20in%20browser-web%20edition-5C6B85?style=for-the-badge" alt="Open the web edition" height="40" />
  </a>
</p>

<p align="center">
  <b>User manual:</b>
  <a href="docs/manual/LZ-Cable-Planner-Manual-EN.pdf">English (PDF)</a> ·
  <a href="docs/manual/LZ-Cable-Planner-Handbuch-DE.pdf">Deutsch (PDF)</a>
  <br />
  <sub>Read online: <a href="docs/manual/manual.en.md">manual.en.md</a> · <a href="docs/manual/handbuch.de.md">handbuch.de.md</a></sub>
</p>

<p align="center">
  <img src="docs/screenshots/hero.png" alt="LZ Cable Planner — node-based canvas with devices, ports and routed cables" width="860" />
</p>

---

## Why LZ Cable Planner

- **Plan in signal flow, not in drawings.** Devices with real ports from 1,800+
  catalogue entries, each linked to its manufacturer datasheet.
- **Real cable lengths.** Put the floor plan under the canvas, calibrate it, and
  lengths follow the drawn route — split into the stock lengths you own.
- **Rooms, floors, risers, 3D.** Every cable end reads *floor · room · device ·
  port*; the signal path shows the whole chain through plates and house runs.
- **Every list for the build day.** Pull list, patch list, termination list,
  BOM, patch sheets, faceplates, acceptance record, QR labels — one report
  editor, preview equals export.
- **ATEM and Videohub.** Multiviewer layouts and router configuration.
- **On site.** Phones join by QR code, tick off work and send photos back into
  the plan.
- **Together.** Live co-editing over WebRTC, optional cloud copy with revisions,
  a shared device library across the planner suite.
- **Ask Claude.** A local MCP server answers questions about the open plan.
- **Offline first.** One JSON file per project, secrets in the OS keychain.

## Screenshots

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/screenshots/properties.png" alt="Device properties panel" width="420" /><br /><b>Device properties</b></td>
    <td width="50%" align="center"><img src="docs/screenshots/atem-multiview.png" alt="ATEM multiviewer layout editor" width="420" /><br /><b>ATEM multiviewer</b></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="docs/screenshots/export.png" alt="Export and print hub" width="420" /><br /><b>Export &amp; print</b></td>
    <td width="50%" align="center"><img src="docs/screenshots/bom.png" alt="Cable bill of materials" width="420" /><br /><b>Cable bill of materials</b></td>
  </tr>
</table>

## How it compares

| | **LZ Cable Planner** | WireCAD | D-Tools SI | Visio / draw.io |
| --- | --- | --- | --- | --- |
| Price | **Free to use** | ~$1,500–4,500 | $1,000s / yr | Subscription / free |
| Platforms | **macOS + Windows + web** | Windows | Windows + SQL Server | Windows / web |
| File format | **JSON, git-diffable** | Proprietary | Proprietary | VSDX / XML |
| Broadcast-aware (connectors, BOM, patch sheets) | **Yes** | Yes | Partial | No |
| ATEM / Videohub | **Yes** | No | No | No |

Full comparison: [`docs/comparison.html`](docs/comparison.html).

## Build from source

Requires [Node.js](https://nodejs.org/) 20+.

```bash
npm install
npm run dev     # Electron with hot reload
npm test        # vitest + guards
npm run build   # renderer, main, preload
npm run dist    # installers for macOS / Windows
```

Contributing, maintainer notes and conventions: [CONTRIBUTING.md](CONTRIBUTING.md).
Architecture: [docs/architecture.md](docs/architecture.md). Everything else in
`docs/`: [docs/README.md](docs/README.md).

Built with Electron, React 19, TypeScript, React Flow, three.js, Zustand and Vite.

## Author & support

Built and maintained by **Lars Zumpe** — Lars Zumpe Medienproduktion.
If the planner saves you time on your next show:
[PayPal](https://paypal.me/larszumpe). Donations are optional; the app stays
free to use.

## License

Proprietär — © 2026 Lars Zumpe, alle Rechte vorbehalten. Nutzung der veröffentlichten Builds ist kostenlos; Weiterverbreitung und abgeleitete Werke sind es nicht. Siehe [LICENSE](LICENSE). Not open source: the code is public to read.

Die gebündelten Fremdpakete behalten ihre eigenen Lizenzen; deren Texte und
Copyright-Hinweise stehen vollständig in
[THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md) (erzeugt von
`scripts/generate-notices.mjs` aus dem Produktions-Dependency-Baum).
