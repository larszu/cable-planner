## Canvas

The canvas is the heart of Cable Planner. Here you plan your wiring system, visualise signal flow and manage the arrangement of all equipment. The floating toolbar in the top left provides direct access to all functions.

### Toolbar

The toolbar is a floating panel in the top left of the canvas. It contains all important functions and can be moved by dragging the handle.

![Toolbar main view](bilder/en/canvas-01-toolbar-main.jpg)

#### Close and reopen toolbar

The **X** button next to the drag handle hides the toolbar. You can reopen it via *View* → *Canvas Toolbar* menu. This is useful on small screens or for uncluttered plans.

### Settings: Defaults (Default behaviour for new cables)

The *Defaults* menu combines all standard behaviour settings that apply when creating new cables. Click the Defaults button (gear icon) to open the menu.

#### Routing (Cable path)

Determines the default shape of new cables:

- **Orthogonal** (grid pattern): Cables run horizontally and vertically
- **Straight** (direct): Straight lines between connectors
- **Curved** (smooth): Smooth curves

#### Arrows (Signal direction)

Activates small arrows on cables to show signal direction.

#### Cable Bumps

Shows small humps at cable crossings so cables visually pass over each other instead of intersecting.

#### Colour ports by type

Colours connectors by type (e.g. SDI, audio, power) differently.

#### Cable colours

Choose the colouring logic for cables:

- **Manual**: You select the colour for each cable individually
- **By length**: Automatic colouring based on cable length (with colour legends)
- **By layer**: Automatic colouring based on signal type (video, audio, control, network, power)

### Location Frames (Frames)

Frames are coloured rectangles to group equipment — for example all cameras, all mixers or all switch components.

**Add a new frame:**
1. Click the **Frame** button in the toolbar
2. An empty frame is created at the viewport centre
3. Drag the frame and edges to resize it
4. Right-click on a frame to open the context menu for editing

**Frame around selected equipment:**
1. Select one or more pieces of equipment
2. The **Frame** button now shows "Frame around the X devices"
3. Click it — a new frame will automatically be drawn around all equipment

### Selection and bulk connect

#### Select one piece of equipment

Click on equipment. It is marked with a blue outline. The alignment buttons now appear in the toolbar.

#### Select multiple pieces of equipment

Hold **Ctrl** (Windows/Linux) or **Cmd** (Mac) and click on more equipment. You can also drag a rectangle to select multiple pieces of equipment at once.

#### Bulk connect (Multiple cables at once)

When exactly **two pieces of equipment** are selected, the **Connect cables** button appears in the toolbar.

![Two pieces of equipment selected](bilder/en/canvas-06-two-equipment-selected.jpg)

In the dialog you can create multiple connections at once:
- Select output ports of the first piece of equipment
- Select input ports of the second piece of equipment
- Select cable type and colour
- Click "Connect" to create all connections at once

### Alignment and arrangement

The alignment buttons appear only when at least one piece of equipment is selected.

![Alignment buttons](bilder/en/canvas-05-align-buttons.jpg)

| Button | Function |
|--------|----------|
| **Left** | 1 item: align to left viewport edge; multiple: align left edges |
| **Centre horizontal** | 1 item: centre horizontally in viewport; multiple: centre horizontally to each other |
| **Right** | 1 item: align to right viewport edge; multiple: align right edges |
| **Top** | 1 item: align to top viewport edge; multiple: align top edges |
| **Centre vertical** | 1 item: centre vertically in viewport; multiple: centre vertically to each other |
| **Bottom** | 1 item: align to bottom viewport edge; multiple: align bottom edges |
| **Distribute horizontal** | (3+ items only) Equal spacing horizontally |
| **Distribute vertical** | (3+ items only) Equal spacing vertically |

#### Save equipment groups

Select one or more pieces of equipment and click the **Save group** button (3 rectangles). An input field appears. Enter a name and click the green **Save** button.

Groups can later be dragged from the library onto the canvas and the arrangement will be preserved.

### Arrange equipment in 2D rack builder

If you have selected one or more regular equipment, you can move them with the toolbar's **Rack** button or via right-click → **Arrange in rack builder** to the 2D rack builder to arrange them in rows (e.g. to simulate a rack cabinet). If the selection contains a rack, neither is offered: racks cannot be packed into racks.

If you select an existing rack (black and white black-box), an **Edit** button appears instead to open the rack builder for that specific rack.

### Context menus (right-click)

#### Equipment context menu

Right-click on equipment. A menu appears with these options:

- **Rename equipment**: Change the label
- **Change colour**: Edit frame and background colour of the equipment
- **Duplicate equipment**: Copy equipment with all connections
- **Delete equipment**: Remove equipment and all its cables
- **Hide label**: Show only the symbol without name
- **Hide connectors**: Show only the equipment symbol without port dots
- **Arrange in rack builder**: Open the rack builder with the device or the whole selection (like the toolbar's Rack button)

#### Cable context menu

Right-click on a cable. The following options are available:

![Cable context menu](bilder/en/canvas-11-canvas-context-menu.jpg)

- **Rename cable**: Change the label
- **Switch cable type**: Reassign port types (e.g. SDI ↔ optical)
- **Change colour**: Override cable colour
- **Change length**: Enter cable length in metres
- **Check connection**: Validates cable connection if available
- **Show waypoints**: Display intermediate points to change routing
- **Insert adapter**: Dialog to add a gender changer (e.g. XLR M↔F)
- **Off-page connector**: Route cable out via an off-page connector and back in
- **Delete cable**: Remove connection

#### Canvas context menu (empty area)

Right-click on an empty area:

- **New equipment here…**: Opens the equipment library filtered for quick selection at click point
- **Add frame**: Creates a new frame at cursor
- **Paste**: If you have copied equipment, it is pasted here

### Layer visibility (Video, Audio, Control, Network, Power)

![Layer visibility](bilder/en/canvas-12-layer-visibility.jpg)

The coloured **chips** after the signal path button filter which cables are visible. They only hide cables — equipment remains always visible.

Click on a **Video**, **Audio**, **Control**, **Network** or **Power** chip to toggle visibility. An **X** in the chip means that layer is hidden.

For custom layers (e.g. "RF", "Intercom") that you have created, additional chips appear.

### Signal flow display (Flow Mode)

The **Flow Mode** chip determines how cables are displayed:

- **Linear**: Direct connections without additional visualisation
- **Schematic**: Graphical display with signal flow visualisation (arrows and colours show signal direction)
- **Circuit**: Electrical circuit diagram view (if available)

### Floor plan

![Floor plan panel](bilder/en/canvas-14-floorplan-panel.jpg)

The **Floor plan** button shows or hides a floor plan beneath the canvas to display spatial positions.

**In the floor plan panel you can:**
- Upload a floor plan (JPG/PNG) or select from file library
- Adjust scale / calibration
- **Two-point calibration**: Mark two points on the plan and enter their real distance in metres
- **Four-corner calibration**: Map a floor plan rectangle to canvas coordinates

### Symbols (Electrical, Alarm, PA, IT, AV)

![Symbols panel](bilder/en/canvas-15-symbols-panel.jpg)

The **Symbols** button opens a panel with plan symbols:

- **Categories**: Electrical, Alarm, PA, IT, Automation, AV
- **Drag symbol**: Select a symbol and drag it onto the canvas
- **Import**: Upload external SVG symbols
- **AI generation**: Create new symbols using description
- **CSV import**: Import large symbol sets from file

### Room visibility (Rooms)

The **Rooms** ▾ button shows all rooms defined in the project. Click a room to see only equipment in that room. This is useful for larger projects with multiple rooms.

### 3D building view

The **3D** button opens a three-dimensional building view. Here you see the positions of all equipment spatially — useful for visualising cable routes and room layout.

Use the mouse to rotate and zoom the view.

### Show signal path

When equipment is selected, all cables that transport a signal to or from that equipment are highlighted. This quickly shows the complete signal flow.

### Equipment search (Ctrl+F / Cmd+F)

Press **Ctrl+F** (Windows/Linux) or **Cmd+F** (Mac) or click the magnifying glass. A search field appears above the canvas.

![Equipment search](bilder/en/canvas-22-equipment-search.jpg)

Type the name of equipment. Found equipment is highlighted and the canvas zooms in.

### Inline selection toolbar (Multiple selection)

When you select multiple pieces of equipment, a small toolbar appears above the selection with quick options:

- **Colour**: Changes the colour of all selected equipment
- **Delete**: Removes all selected equipment
- **More options**: Menu for all actions

### Lock

The **Lock** button combines three protection measures:

| Area | Effect |
|------|--------|
| **Lock frames** | Frames cannot be moved or deleted |
| **Lock equipment** | Equipment cannot be moved or deleted |
| **Lock cables** | Cables cannot be moved, changed or deleted |

The button label shows the number of active locks. If all three are active, the button is greyed out and shows "Lock: 3".

### Finalize (Plan lock)

The **Finalize** button on the right side of the toolbar locks the entire plan:

![Finalize button](bilder/en/canvas-17-finalize-button.jpg)

- **Editing** (default): You can make all changes
- **Finalised**: No moving, no new connections, no deletions. A confirmation dialog warns before changes
- **Viewer**: Read-only file (`.cpviewer`), cannot be edited

Clicking it toggles between Editing and Finalised. The plan remains in this state in the file.

### Annotations

![Annotations buttons](bilder/en/canvas-18-annotations-buttons.jpg)

**Badges** show/hide the coloured circle markers on the canvas without deleting annotations.

**Annotations** opens the annotations panel with a list of all markings. Here you can add notes, change colours and manage annotations.

In **Viewer mode** the annotations button is purple and shows "Viewer" to encourage reviewers to give feedback.

### Zoom and navigation

![Zoom buttons and minimap](bilder/en/canvas-19-zoom-minimap.jpg)

Bottom left of the canvas:

- **+** and **−** to zoom
- **1:1** to reset to original size
- **Fit** to make all equipment visible
- **Minimap** shows a bird's eye view, click on it to jump

You can also **zoom with the mouse wheel** or use the right mouse button (not on equipment!) to pan.

### 3D rack view

When you open a rack or call the rack builder from the canvas, a 3D view of all rack units is displayed. Here you can assign equipment to individual units and see the spatial arrangement.

The 3D view can be rotated and zoomed with the mouse.

### Cable details

Double-click on a cable or open its context menu to edit details:

- **Name/Label**: Description (appears on the cable)
- **Length**: In metres (used for cable planning and colour coding)
- **Type**: Port type (SDI, optical, audio, power, etc.)
- **Colour**: Cable colour (only for manual colouring)
- **Waypoints**: Bend points to control routing

### Stream preview

When you enable stream output of equipment, a small preview tile can be shown on the canvas (e.g. ATEM multiviewer or Videohub output). This displays the live signal.

### Canvas keyboard shortcuts

| Shortcut | Function |
|----------|----------|
| **Click** | Select equipment/cable |
| **Ctrl+Click** (Cmd+Click) | Add to selection |
| **Drag** | Move equipment or cable |
| **Right-click** | Context menu |
| **Ctrl+F** (Cmd+F) | Equipment search |
| **Ctrl+D** (Cmd+D) | Duplicate selection |
| **Delete** | Delete selection |
| **Ctrl+Z** (Cmd+Z) | Undo |
| **Ctrl+Y** (Cmd+Y) | Redo |
| **Mouse wheel** | Zoom |
| **Right button + Drag** | Pan canvas |
