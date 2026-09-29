## File and Import

The *File* menu is the central hub for project management: creating, opening, saving projects, import sources, export formats, and collaboration with external designs.

### New Project

*File → New project*

Creates a blank project and opens it in a new window. The previous project remains open in the background. The project has a default name and can be saved under a custom name later.

Keyboard: `Ctrl+N`

### New from Template

*File → New from template…*

Opens a dialog with all available templates. Project templates are predefined building blocks: room layouts, standard equipment configurations, or wiring patterns that serve as a foundation for new designs. The dialog displays templates grouped by topic; clicking a template creates the new project.

![Template Dialog](bilder/en/datei-import-templates.jpg)

### Open

*File → Open…*

Opens an operating system file dialog. Files with extensions `.cableplan`, `.json`, or (when merging annotations) `.cpviewer` are read. The selected file is loaded into the active window.

Keyboard: `Ctrl+O`

### Save

*File → Save*

Saves the active project under its current name and path. If the project has never been saved, a "Save As" dialog opens. The file has the extension `.cableplan` and is a JSON document containing all project data: equipment, cables, settings, metadata.

Keyboard: `Ctrl+S`

Contents of `.cableplan` file:
- Project metadata (name, creator, modification date)
- All equipment and their positions
- All cables and their connections
- Categories and custom equipment templates
- Print settings and frame arrangements
- Photo attachments (if present; approximately 40 MB and larger becomes unwieldy for email distribution)

**Automatic Backup:** The app saves automatically on a regular basis and maintains a `.bak` file alongside the current project file. When the save icon rotates in the status bar, a backup copy is being written.

### Save As

*File → Save as…*

Saves the active project under a new name or in a different location. The original version remains unchanged; the new file is loaded as the active project.

Keyboard: `Ctrl+Shift+S`

### Import yEd / GraphML

*File → Import yEd / GraphML…*

Imports wiring designs from yEd (graph editor by y.Works) or any GraphML files. The dialog loads a `.graphml` file, analyzes it, and displays a preview with three tabs:

![GraphML Import Dialog](bilder/en/datei-import-graphml.jpg)

**Tab 1: Equipment** — Lists all detected nodes. The app attempts to match node names against the equipment library (HIGH = confidently identified, MED = possibly, LOW = gap). The columns are:

| Column | Function |
|---|---|
| ☐ (checkbox) | Checkbox for selecting/deselecting equipment. Checked: will be imported |
| Name | The node name from the yEd file; can be manually renamed |
| Category | The detected equipment category (e.g., Camera, Mixer); can be overridden |
| Confidence | Color-coded detection confidence (HIGH/MED/LOW) |

Functions:
- Click a single row to edit the name or category
- Select multiple rows; then bulk-assign a category via the dropdown at the top
- The green **Select all** button marks all equipment; **None** deselects all

**Tab 2: Cables** — Lists all detected connections (edges between nodes).

| Column | Function |
|---|---|
| ☐ (checkbox) | Checkbox for selecting/deselecting cables |
| From | Source equipment name |
| Port | Source port (or empty if not specified) |
| To | Destination equipment name |
| Port | Destination port (or empty) |

Functions:
- Each cable can be individually included or excluded
- Same bulk procedure as equipment (select multiple rows, then action)

**Tab 3: Skipped** — Shows all nodes or edges that cannot be imported (e.g., labels, structural nodes, unassigned categories). The list aids troubleshooting: what was omitted and why?

**Options:**
- **Append** (default) — Imported equipment and cables are added to the existing project
- **Replace** — The entire project is replaced with the import data

**Specifics:**
- Node positions from yEd are preserved (soft mapping to Cable Planner coordinates)
- Unknown categories are marked as "unclear" and can be manually corrected
- Connections without equipment assignment are shown as errors

### Import MultiCam Cameras

*File → Import MultiCam cameras…*

Imports camera definitions from a MultiCam camera list. The file is selected via an operating system file dialog. The format is text-based; the app checks the structure and adds recognized cameras to the equipment library.

The dialog does not open — instead, the file dialog is displayed directly (hidden `<input type="file"`). After file selection, the list is imported and a confirmation is shown.

### Import Equipment from CSV

*File → Import equipment from CSV…*

Imports equipment catalogs from a CSV file (Comma-Separated Values). The format is flexible: the header (Name, Category, Power, Serial Number, …) is recognized automatically. The dialog supports multilingual column names (DE/EN aliases).

![CSV Import Dialog](bilder/en/datei-import-csv.jpg)

**Workflow:**

1. **Load file** — Click *Select CSV file…* opens the operating system file dialog
2. **Enter/edit CSV text** — The detected text is shown in the text area and can be manually edited
3. **Preview** — All detected columns and their contents are displayed below; known columns are highlighted in green
4. **Silent losses visible** — The app counts and displays:
   - Unknown columns (ignored on import)
   - Rows without names (skipped)
   - Duplicate names (only the first row is imported)
5. **Import** — The green *0 to import* button shows the count of new equipment; clicking it commits the import

**Column Aliases:**

| German | English | Function |
|---|---|---|
| Name | Name | Equipment name (required) |
| Kategorie | Category | Equipment category (e.g., Camera) |
| Leistung | Power | Power consumption in watts |
| Gewicht | Weight | Weight for load calculations |
| Seriennummer | Serial number | Unique equipment ID |

The app remembers the column mapping for subsequent CSV imports.

### Rentman Import

*File → Rentman import…* (only if Rentman integration is enabled)

Connects to the Rentman rental management system and loads equipment from the Rentman classification as an equipment library into LZ Cable Planner. The dialog goes through several steps:

**Steps in the Dialog:**

1. **Authentication** — Enter the Rentman API token (stored in the OS credential store)
2. **Project selection** — Lists all Rentman projects; the user selects one
3. **Category mapping** — Rentman equipment classes are mapped to Cable Planner categories
4. **Preview** — Shows all equipment to be imported
5. **Import** — Confirmation and execution

The integration is enabled in *Settings → Integrations*. The workflow is non-destructive: existing equipment is not overwritten.

### NetBox Import

*File → NetBox import…* (only if NetBox integration is enabled)

Loads a network infrastructure inventory image from NetBox (IPAM/DCIM system). The dialog is similar to the Rentman import: authentication, inventory selection, category mapping, preview, and import.

**Specifics:**
- NetBox device types are interpreted as categories
- Interface specifications (e.g., "SFP+") are retained as port names
- The integration is enabled in *Settings → Integrations*

### Export Whole Project

*File → Export whole project (.avplan)…*

Saves the project in `.avplan` format — a cross-platform exchange format for AV planning software. The format is transparent (JSON) and contains all project data plus metadata for external tools (e.g., av-control-center).

A click opens a Save dialog; the default filename is `<ProjectName>.avplan`.

### Import Whole Project

*File → Import whole project (.avplan)…*

Loads a previously exported `.avplan` project. The project is loaded in the active window.

A click opens an Open dialog; file types are `.avplan` and `.json`.

### Export Identity Map

*File → Export identity map (.avsourcemap)…*

The identity map is a lookup table between internal equipment IDs (as referenced in source systems — e.g., ATEM videohub — and equipment names in the Cable Planner design. The file serves for reconciliation with hardware or other software systems.

A click opens a Save dialog.

### Import Identity Map

*File → Import identity map (.avsourcemap)…*

Loads a previously exported identity map and applies the mappings to current equipment.

A click opens an Open dialog.

### View Linked Venue Plan

*File → View linked venue plan…*

If the project is linked to a venue planning project (e.g., from light-planner) via the `.avplan` format, this dialog can display the linked file. This function aids coordination between cable and venue planning.

### Project File Format: `.cableplan`

The project file is a JSON document with the structure:

```json
{
  "metadata": {
    "name": "My Project",
    "creator": "John Doe",
    "modified": "2026-09-28T10:00:00Z",
    "version": "8.1.0"
  },
  "equipment": [
    {"id": "...", "name": "Camera 1", "category": "Camera", "position": {...}},
    ...
  ],
  "cables": [
    {"id": "...", "from": "...", "to": "...", "type": "SDI"},
    ...
  ],
  "library": [...],
  "fotos": [...]
}
```

Size benchmarks:
- Small projects (< 50 equipment): 50–200 kB
- Medium projects (50–200 equipment): 200 kB–2 MB
- Large projects (> 200 equipment) + photos: > 5 MB

**Backup and Data Loss Prevention:**

- The app saves automatically every 30 seconds
- A `.bak` file sits beside the `.cableplan` (backup of the previous version)
- On crash, the automatic backup is restored on next startup
- Backup errors are indicated in the status bar with a warning icon

### Backup Status in the Status Bar

At the bottom right of the window, the **status bar** displays the backup status:

- **Normal icon (☑)** — Project is current, last save less than 5 seconds ago
- **Rotating icon (⟳)** — Backup copy is running
- **Warning icon (⚠)** — Backup failed (e.g., disk full, write error)

Failed backups are collected and displayed in Settings under *Error Log*.

The `.bak` file is written atomically: it is never left in a half-written state, and power failures during save destroy neither the current nor the old file.
