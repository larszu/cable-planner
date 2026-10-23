## Canvas

The canvas is the work area in the centre. Devices, cables and frames sit on it. The toolbar floats at the top left, with the search field below it; the zoom buttons are at the bottom left, the overview map at the bottom right.

### Toolbar

![Toolbar](bilder/en/canvas-leiste-01-leiste-ganz.jpg)

From left to right the toolbar shows:

| Element | Effect |
|---|---|
| Handle ⠿ | moves the toolbar |
| × | closes the toolbar; *View → Canvas toolbar* brings it back |
| Defaults | defaults for new cables and the display |
| Frame | creates a frame, around the selected devices if any |
| Voice | creates cables from a spoken or typed sentence |
| Selection buttons | appear only while devices are selected |
| Layer chips | Video, Audio, Control, Network, Power, Other and custom layers; show and hide the cables of a layer |
| More | further functions |

An active mode (signal path, mains diagram, test pattern) appears with its state directly in the toolbar.

#### More menu

![More menu](bilder/en/canvas-hallenplan-02-panel-leer.jpg)

| Entry | Effect |
|---|---|
| Layers ⋯ | *Create custom layer…* and *Show all layers again* |
| Lock | locks against accidental moves |
| Rooms, 3D | appear once frames exist |
| Schematic | display of the planned path |
| Mains diagram | mains diagram with switch positions |
| Test pattern | test pattern of a source |
| Finalise | locks the whole plan |
| Badges | shows and hides the annotation badges; the annotations stay |
| Annotations | opens the annotations panel |
| Floor plan | opens the floor plan panel |
| Symbols | opens the symbols panel |

### Defaults

![Defaults](bilder/en/canvas-defaults-01-menue-offen.jpg)

*Defaults* applies to newly drawn cables and to the display of all cables. A dot on the button shows that at least one default has been changed.

| Group | Options |
|---|---|
| Cable routing | Ortho, Direct, Curved |
| Cable colour | By type (colour from the cable type), By length (length colour code) |
| Other | Arrow at cable end, Cable bumps at crossings, Hide all cable labels, Cable labels: short form, Colour ports by connector type |

*Cable labels: short form* drops the format suffix such as “(1080p50/60)” from the label. Cable bumps can be set differently per cable in the context menu. Colouring by discipline is in *View → Color cables by discipline* and in *Settings → Appearance*.

With *By length* a *Length colours* legend shows the colour per length; *Close* hides it.

![Length colours](bilder/en/canvas-defaults-07-farbe-legende.jpg)

### Selecting and arranging devices

- A click selects a device. With **Ctrl** (macOS: **Cmd**) more are added; a dragged rectangle selects all devices inside it. **Ctrl+A** selects everything, **Esc** clears the selection.
- A small bar appears above the selection: for one device *Duplicate*, *Frame around selection*, *Device datasheet (A4 PDF / print)* and *Delete*; from two devices also the align buttons, from three also distribute.

![Bar above one device](bilder/en/canvas-stream-07-kachel-fehler.jpg)

![Bar above three devices](bilder/en/canvas-inline-04-drei-geraete.jpg)

#### Aligning

The align buttons are also in the toolbar.

| Button | one device | several devices |
|---|---|---|
| Left, Right, Top, Bottom | to the edge of the visible area | edges aligned |
| Centre horizontally / vertically | to the centre of the visible area | centred on each other |
| Distribute horizontally / vertically | – | equal spacing, from three devices |

#### Saving a group and rack from selection

With devices selected the toolbar has two more buttons:

- *Save as group*: a name field appears; *Save group* stores the group in the library. If the name exists, the app asks whether to overwrite.
- *Arrange in the 2D rack builder*: opens *New rack from selection* with the selected devices. Devices not marked as rack devices are listed under conflicts. With a rack selected, the button opens that rack for editing.

#### Connecting several cables

With exactly two devices selected, *Connect cables* appears. The *Connect multiple cables* dialog creates N cables at once: source port i to destination port i.

![Connect multiple cables](bilder/en/canvas-auswahl-22-kabel-verbinden-dialog.jpg)

| Field | Effect |
|---|---|
| Source / destination: device, side, start output / start input | device, port list and first port per side |
| Number of cables | how many cables |
| Cable type | cable type; the colour comes from the type |
| Length per cable (m) | length of each cable |

The preview shows the connections and warns when the number exceeds the free ports; occupied destination ports are skipped. *Create n cables* creates them.

### Drawing cables

1. Drag from a port to a port of another device. Releasing on the device body picks a free matching port.
2. The *New cable* dialog shows *From* and *To*. Choose the cable (matching types with ✓, non-matching with ✕, *★ Custom cable…* for your own), signal standard, name, length (m), colour and notes. A hint says whether the type matches the connectors.

   ![New cable](bilder/en/canvas-kabel-02-dialog.jpg)

3. *Create* creates the cable.

If a port is already in use, *Port already in use* asks: *Replace* deletes the existing cable and creates the new one, *Cancel* discards the new one. If a drag ends on empty space, the dialog offers a cable with an open end (*To: Open End*).

If the connectors do not mate or both have the same gender, the cable shows a notice with *Insert* in the inspector; it puts an adapter or converter into the run, and one undo step removes it again.

![Adapter notice](bilder/en/canvas-adapter-02-adapter-hinweis.jpg)

### Cables by voice

*Voice* opens *Cable by voice*. Type a sentence such as “SDI 1 from the ATEM to the NEC in the foyer” into *Sentence* or speak it (*Speak*, where speech recognition is available; otherwise the system dictation). Separate several cables with a full stop. *Preview* shows source, destination and port per cable; with several matches you pick the device, and a device not yet in the plan can come from the library. When a connection needs a converter, the preview offers it; when an input is in use, it asks whether to replace the cable. *Connect n cables* creates everything in one undo step.

### Editing cables

A selected cable shows handles at its corners and segments and an × at the label that deletes the cable. Segments and corners can be dragged.

![Selected cable](bilder/en/canvas-kabeleditor-02-segment-ziehen.jpg)

A double-click opens the properties in the inspector. A right-click opens the cable menu:

| Entry | Effect |
|---|---|
| Change label… | new name |
| Accept into plan, Remove mobile check | for suggestions and checks from the phone |
| Measure signal | shows the scopes of the stream at the source device; without a suitable stream the app says what is missing |
| Add waypoint here, Remove nearest waypoint, Clear all waypoints (n) | bends |
| Auto-reroute | lays the route anew |
| Routing: Orthogonal, Direct, Curved | shape of this cable |
| Cable jumps for this cable | on, off or global |
| Arrow at start, Arrow at end, Bidirectional | arrows |
| Create off-page connection… | replaces the line by two arrow connectors with a net name |
| Delete cable | after confirmation |

On an off-page connection, the leader line to each connector can be routed through waypoints: drag the handles, *Add waypoint* with +, a double-click deletes a waypoint.

### Context menus of device, frame and empty area

![Device context menu](bilder/en/canvas-kontext-01-geraet.jpg)

| Right-click on | Entries |
|---|---|
| Device | Device datasheet…, Arrange in rack builder (for several: n devices), Open rack editor (racks only), Lock / unlock position, Delete device |
| Frame | Lock / unlock position, Delete frame |
| Empty area | New device here … |

*New device here …* opens *Create custom device* and places the device where you clicked. Deleting a device also deletes its cables; deleting a frame keeps the devices.

![Frame context menu](bilder/en/canvas-rahmen-09-rahmen-kontext.jpg)

### Frames and rooms

*Frame* creates a frame; with devices selected it encloses them. Corners and edges change the size. A frame takes the devices inside it along when moved. The properties are described in [Frame properties](#frame-properties).

With frames, *More* shows:

- *Rooms*: a list by floor with a check box per floor and room. Unchecked rooms and floors disappear from the canvas together with their devices; several can be hidden at once.

  ![Rooms](bilder/en/canvas-raeume-11-raeume-menue.jpg)

- *3D*: *Building 3D* shows the rooms stacked by floor. Room connections or single cables choose how cables are drawn, labels show names, floor height (m) applies to floors without a height of their own, rooms hides rooms. Devices and floor boxes can be dragged; dragging next to them rotates, the mouse wheel zooms.

  ![Building 3D](bilder/en/canvas-raeume-17-drei-d-raeume.jpg)

### Layers

Hovering a layer chip shows how many cables it has. A click hides the layer's cables; devices stay. *Layers ⋯ → Create custom layer…* adds a layer of your own; right-clicking its chip removes it. *Show all layers again* shows everything.

### Lock

![Lock](bilder/en/canvas-sperren-01-menue.jpg)

| Check box | Effect |
|---|---|
| Frames | frames cannot be moved |
| Devices | devices cannot be moved |
| Cables | waypoints cannot be edited |

### Finalise

*Finalise* asks *Finalise plan?* and then locks the canvas: no moving, new connections or deletions. The button then reads *Finalised*; a click asks whether to re-enable editing and lifts the lock. In a viewer file it reads *Viewer*, and the plan is read-only.

### Signal path

With a cable selected, *Show signal path* in the inspector highlights the whole chain the cable belongs to and dims the rest. **Esc** or the × on the signal path chip in the toolbar ends it.

### Schematic, mains diagram, test pattern, switch path

| Mode | Effect |
|---|---|
| Schematic | shows the planned path with no connection to a live system. A click turns the cable motion on or off. With a system connected, the chip reads *Live* and shows the observed state |
| Mains diagram | computes the mains diagram: lit luminaires, switch positions and live lines. Switches can be flipped in the toolbar; a reset button sets them back, a suggestions button offers missing entries. Computed, not measured |
| Test pattern | after choosing a source, the plan shows at every arrival point which picture should be there and counts open, swapped and unchecked arrival points |

![Mains diagram on](bilder/en/canvas-modi-04-schaltbild-an.jpg)

![Test pattern of a source](bilder/en/canvas-modi-08-pruefbild-leiste.jpg)

For the test pattern, *Save…* offers *Test pattern image (SVG)*, *Check sheet (CSV)* as a walk-round list and *Sign-off sheet (CSV)*. *Switch path…* opens a dialog that switches the source's path to a chosen destination through routers. It shows the path and, for each device without a declared control protocol, a notice; without a protocol nothing is sent. A field takes the name of who switches; the switch button is enabled only after the check box confirming that you have read which outputs change and are switching a live system.

### Annotations

*More → Annotations* opens the *Annotations* panel. It filters by status; *+ New annotation* creates one. *Badges* shows and hides the annotation markers on the canvas.

![Annotations](bilder/en/canvas-anmerkungen-02-panel-offen.jpg)

### Floor plan

*More → Floor plan* opens the *Floor plan* panel.

1. *Load floor plan image or PDF…* loads the plan; image or PDF can also be dropped on the panel or the canvas. For multi-page PDFs *PDF page* picks the page.
2. *Crop…*: drag a rectangle over the part to keep, then *Crop plan*.
3. *Floor* assigns the plan to a floor; each floor can have its own plan. *All floors* shows one plan for all.
4. Set the scale:
   - *Two points*: for plans drawn from above (CAD export, scan). Click both ends of a known distance.
   - *Four corners*: click the four corners of an area of known size, top left first, going round; this gives a perspective scale.
5. *Recalculate cable lengths* recomputes lengths along the drawn routes.

| Element | Effect |
|---|---|
| Opacity | transparency of the plan |
| Lock position | clicks go through to the devices |
| Replace image… | loads another plan |
| Import venue from MultiCam / Light Planner… | takes plan and scale from a venue file of the sister apps |
| Export venue for MultiCam / Light Planner | writes plan and scale; not possible with a four-corner scale |
| Remove floor plan | removes the plan |

Without a scale the app uses “metres per 100 px”. Cable lengths use the scale of the plan for all floors.

### Symbols

*More → Symbols* opens the panel with plan symbols in the groups Electrical, Intrusion alarm, Fire alarm, Voice alarm / PA, IT / network, Automation, AV and Custom, with a search field.

![Symbols](bilder/en/canvas-symbole-02-panel-offen.jpg)

- Dragging a symbol onto the canvas places it. Placed symbols have a label, size and rotation (0°, 90°, 180°, 270°) and can be locked and deleted.
- *Import symbol (SVG, PNG, JPG, WebP)…* adds symbols of your own under *Custom*; the app rejects files that are too large or unreadable.
- With an AI provider set up, an area in the panel generates symbols from a description.
- The symbol list button exports the placed symbols as CSV.

### Finding devices

**Ctrl+F** or *View → Find device* shows the search field above the canvas. It finds devices by name and by fields such as IP address, serial number, MAC address, VLAN and note, and shows for each match what is connected. Clicking a match jumps to the device. The field can be moved with ⠿, collapsed with − and closed with ×.

![Search](bilder/en/canvas-suche-03-treffer.jpg)

### Zoom and overview map

Bottom left: zoom in (+), zoom out (−), fit view and the lock that stops panning and selecting on the canvas. The mouse wheel zooms. Bottom right, the overview map shows the whole plan; dragging in it moves the view. *View* also offers *Zoom 100 %* and *Fit to view*.

### Keyboard shortcuts on the canvas

| Shortcut | Effect |
|---|---|
| Arrow keys | move the selection by one grid cell, with Shift by four |
| Ctrl+D | duplicates the selection |
| Ctrl+C, Ctrl+V | copy and paste |
| Ctrl++ | creates a new device at the mouse position |
| Del | deletes the selection |
| Esc | clears the selection, cancels a cable being drawn |
| Ctrl+A | selects everything |
| Ctrl+F | search |
| P | patch list |
| A | arrows on and off |

*Help → Keyboard shortcuts…* lists all shortcuts.
