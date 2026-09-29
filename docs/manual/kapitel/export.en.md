## Export & Print

The export section is the hub for all outputs: plans as PDF/image, patch lists, bill of materials, cloud storage and specialized documentation for fixed installations. Every sheet leaving the plan originates here.

### Patch List

*File → Tools → Patch list…*

![Patch list dialog](bilder/de/export-patchliste-dialog.jpg)

Table of all cables in the plan — one row per cable showing source and destination equipment, port, cable type, length and color. Built specifically for the technician in the field laying individual cables, not for plan abstractions like bills of materials.

**Columns:**
- **Number**: Cable number (empty if unassigned)
- **Source** → **Destination**: Equipment name and port
- **Type**, **Length**: Cable specification
- **Color**: Cable marking
- **Multicore**: Bundle name (if part of a snake)
- **Fiber**: For optical cables, fiber number and role (TX/RX)
- **Layer**: Video, Audio, Control, Network, Power, Other

**Filter & Sort:**
- Filter by layer (e.g. show only video cables)
- Sort by source equipment, destination equipment, cable type, length or color
- Free-text search across all columns

**Export Formats:**
- **CSV**: Tabular, for editing in Excel or as print template
- **Label format**: CSV for label printer software (Generic, Brother, Dymo); includes source port, destination port and cable length in the format your printer software expects
- **PDF labels + QR**: Small stickers per cable with QR code (for tracking) and printed details; A4 or roll format
- **PDF patch list**: The table as printable PDF — one page per device showing its cable assignments

### Fixed Installation: Docs & Handover

*File → Tools → Fixed installation: docs & handover…*

Documentation hub for installers and operators. Each tab produces a standalone CSV or PDF output document for one aspect of the fixed installation.

The tabs:

**Overview** — Installation preparation checklist:
- Installer lists: pull list (who takes what), termination list (where connectors are terminated), schedule (order of work steps), cable BOM (type+length aggregated)
- Operator asset register: equipment inventory with serial numbers and storage location
- Change log: who changed what when; can be cleared

**Handover package** — Markdown manifest of all documents with version and QR for tracking:
- Automatically includes all sheets: installer lists, technical docs, signal paths, …
- Each sheet bears its stamp (revision + date)

**QR & Asset IDs** — Equipment marking:
- Auto-assign numbers for equipment and cables (if not yet done)
- Generate QR label PDF for sticking on

**Editor ID** — Name of installer/technician (appears in every log entry as author)

### Stage Plot

*File → Tools → Stage plot (SVG)…*

Bird's-eye view of the plan as **SVG** (vector graphic): equipment only, no cables, overhead view of stage/venue. Perfect for printing or technical drawings.

### Export & Print

*File → Export & Print…*

![Export dialog overview](bilder/de/export-dialog-plan.jpg)

Central export dialog with seven tabs covering all output formats. All actions are non-destructive — no changes to the plan itself.

#### Tab: Plan

Export the canvas plan as **PDF, PNG, JPEG, SVG or DXF**.

**PDF (Raster):**
- Classic raster PDF (JPEG snapshot of the plan)
- With title block: project name, revision, change fingerprint, QR code
- Print-ready, text blurs at high zoom

**PDF (Vector, Beta):**
- Chromium printToPDF — text remains selectable and sharp at any zoom
- Smaller file size
- **No title block** — revision, fingerprint and QR appear only in the raster PDF

**PNG, JPEG:**
- Bitmap formats for email, Slack, websites
- PNG: transparency possible, sharp for small areas
- JPEG: compressed, smaller files

**SVG:**
- Vector graphic for web and further editing; all elements remain selectable

**DXF:**
- CAD format for plotters and desktop planning
- Equipment, cables and text on separate layers

**Options:**

- **PDF theme**: Dark (like canvas) or Light (recommended for printing)
- **Monochrome-safe**: Print layer text on every cable instead of colors — for black-and-white printers where video cables would otherwise be indistinguishable from audio cables
- **Render mode** (vector PDF only):
  - Raster (Classic): JPEG snapshot, reliable, but text blurs at zoom
  - Vector: Chromium printToPDF, sharp text, smaller file, but no title block
- **Page size** (vector PDF only): Auto (A0-compat), A4–A0+, Original (full canvas size for plotter)
- **Layers**: Which cable types (Video, Audio, Control, Network, Power, Other) are included in the PDF; selection is synchronized with the canvas view

#### Tab: Patch Sheets

For each selected equipment, a port-usage list — perfect for sticking on the device.

- **Select equipment**: Check box next to each device or "Select all"
- **Choose format**: A4 or A3 (prompted after click)
- **Action**:
  - "Download PDF": all selected devices into one PDF
  - "Print": direct to OS printer
  - "Label CSV": compact table as CSV (one row per device instead of full page)

#### Tab: Cable Bill of Materials (BOM)

All cables aggregated by type and length — for ordering.

- **Table**: Cable type + length, quantity, Rentman planning (editable)
- **Export**:
  - CSV: for Excel editing
  - PDF: print-ready with Rentman column
- **Rentman integration**: If device library is linked to Rentman, output quantities and prices can be pulled directly

#### Tab: Equipment Bill of Materials

What equipment the plan needs — covered by inventory (stock)?

- **Three states per equipment**:
  - Green (Covered): Equipment is known in stock (via catalog identity)
  - Orange (PROPOSAL): Name match — only the guess that it's the right equipment; awaits confirmation
  - Red (Not in stock): Equipment not in inventory
- **Pick list**: only the green equipment, sorted by storage location — the list a technician takes when packing

#### Tab: Racks & Groups

Export stored racks and groups individually as PDF.

- List of all racks and groups in the plan
- **Per rack**: one patch sheet per contained equipment, showing internal cabling
- Action: "Download PDF" or "Print"

#### Tab: Tally Map

The chain: role (show position) → equipment (e.g. camera) → mixer input → UMD address (character overlay on multiviewer).

Derived from the plan and verified. Ideal for reading through or configuring tally-pi hardware.

- **CSV**: for human reading
- **JSON**: for tally-pi configuration
  - (Note: GPIO pins for physical lamps belong to hardware, not the plan)

#### Tab: Document Bundle

Multiple sheets as one print-ready stack: one page per sheet, column headers on each follow-up page, color and format selectable.

- **Select sheets**: Check boxes next to each sheet
- **Format**: A4, A3, A2, A1, A0
- **Color mode**: Color or black-and-white (each entry remains readable)
- **Action**: "Print" or "Download PDF"
- Each sheet bears its stamp (revision + date) — later a technician can hold a stack of stamped sheets against the current plan and verify whether everything is still current.

### Cloud & Share Link

*File → Cloud & share link…*

![Cloud dialog](bilder/de/export-cloud-dialog.jpg)

Save plan to cloud (optional), manage revisions, generate a read link for opening on another device.

**Prerequisite:** Sign in to device library (under *Settings → Device library*).

**Features:**

- **Save now**: Current plan is uploaded as new revision to cloud
- **Revisions**: List of all previous versions (with change fingerprint + storage time)
  - A revision can be restored (becomes the newest)
  - Download: save revision as .cp file locally
- **Share links**: External viewers open the plan in the web viewer (read-only) without signing in
  - Create link: enter recipient's email
  - Copy link (for email, Slack, documentation)
  - Delete link (revoke access)
  - Set expiry date (optional)
- **Other cloud projects**: Browse existing cloud projects, open, download or delete from cloud

**Privacy:**
- As long as nobody clicks "Save now", the plan stays local.
- The server checks sign-in — the file identity is device-specific, not file-specific.

### Export as Viewer File

*File → Export as viewer file…*

Export plan to **`.cpviewer` format**. External reviewers (freelancers, other teams) can later open the plan in the web viewer, annotate and mail the file back.

(Action: direct download; no dialog)

### Import Annotations

*File → Import annotations from viewer file…*

Open a `.cpviewer` file with annotations from a reviewer and merge the marks / comments into the current plan. Enables a feedback workflow without direct cloud connection.

(Action: file dialog; no upload to server)

### Compare Plan Revisions

*File → Compare plan revisions…*

Hold two `.cp` files against each other — e.g. current version versus version from yesterday to discover changes.

- Equipment added/removed
- Cable added/removed/rerouted
- Port rename
- etc.

Differences are highlighted visually, details in a table.

### Documents Handed Out

*File → Documents handed out…*

Register of all sheets exported from this plan so far. Why? So a technician can take an old printout to the construction site tomorrow and check whether it's still current — or whether the plan has changed since then.

**Columns:**
- **Timestamp**: When it was handed out
- **Sheet**: Which sheet (patch list, plan PDF, BOM, …)
- **Change fingerprint**: Unique identifier of the plan state when handed out
- **Revision** (if cloud): Revision number when uploaded to cloud
- **Editor**: Who handed it out (from settings)

The register is part of the project and saved with it.

---

© 2026 Lars Zumpe Media Production · free to use, proprietary license
