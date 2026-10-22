## Canvas

The canvas is the working area on which devices stand, cables run and frames form rooms. This chapter describes the area itself, the floating toolbar, selection, drawing and editing cables, frames, floors, layers, operating modes, annotations, floor plan and plan symbols. The properties of a selected device, cable or frame are described in the chapter [Inspector](#5-inspector); the library on the left in the chapter [Library](#4-library).

### The empty plan and the example project

A plan without devices shows the note *No devices yet* in the middle: drag a device from the library on the left onto the canvas. Below it is *Load example project*.

1. Start with an empty plan.

   ![Empty plan with note](bilder/en/canvas-start-01-leerer-plan.jpg)

2. Click *Load example project*. The plan then shows Camera 1, Camera 2, Vision mixer, Multiviewer and Control room monitor with four cables. The following sections work on this example.

   ![Example project on the canvas](bilder/en/canvas-start-02-beispiel-geladen.jpg)

The area can be moved by dragging on empty ground, zoomed with the mouse wheel, and shows an overview map at the bottom right.

### The toolbar

The toolbar floats at the top left above the plan. From left to right it contains:

- the grip for moving and the close button,
- *Defaults* (presets for new cables and the appearance),
- *Frame*,
- *Voice* (create cables from a sentence),
- buttons for the selection while devices are selected (connect cables, save group, rack, align),
- the layer chips *Video*, *Audio*, *Control*, *Network*, *Power*, *Other* and custom layers,
- the chip of the operating mode that is switched on (signal path, circuit, test pattern),
- *More*.

![The toolbar](bilder/en/canvas-leiste-01-leiste-ganz.jpg)

Under *More* are the less frequent switches: *Layers ⋯* (manage layers), *Lock*, *Schematic* or *Live*, *Circuit*, *Test pattern*, *Finalise*, *Badges*, *Annotations*, *Floor plan* and *Symbols*. The buttons *Rooms* and *3D* appear there as soon as the plan contains frames.

![More opened](bilder/en/canvas-modi-04-schaltbild-an.jpg)

On a phone the toolbar shows only the grip, *Defaults* and *More*; frame, layers and selection buttons are then under *More*.

#### Moving, closing and reopening the toolbar

1. Drag the toolbar by the grip (six dots on the left) to another place.
2. The **×** next to the grip closes the toolbar.
3. Open the menu *View*.

   ![View menu](bilder/en/canvas-leiste-05-ansicht-menue.jpg)

4. Choose *Canvas toolbar*. The toolbar reappears.

### Defaults

*Defaults* (tooltip: *Default behaviour for new cables + appearance*) determines how new cables are created and how the plan looks. A dot on the button shows that at least one value has been changed.

![Defaults menu](bilder/en/canvas-defaults-01-menue-offen.jpg)

| Group | Option | Effect |
|---|---|---|
| *Cable routing* | *Ortho* | New cables run horizontally and vertically. |
| | *Direct* | New cables run in a straight line. |
| | *Curved* | New cables run as a curve. |
| *Cable colour* | *By type* | The colour comes from the cable type. |
| | *By length* | The colour depends on the length; the *?* button shows the legend *Length colours*. |
| *Other* | *Arrow at cable end* | Newly drawn cables get an arrow. |
| | *Cable bumps at crossings* | Crossings are drawn as a small bump. This can be overridden per cable in the context menu. |
| | *Hide all cable labels* | The labels of all cables disappear; their position stays saved. |
| | *Cable labels: short form* | The format suffix (for example "(1080p50/60)") is removed from the display. The full name stays in the cable properties. |
| | *Colour ports by connector type* | Ports take the colour of their connector type (SDI amber, HDMI violet, Ethernet green and so on). |

The routing applies to cables created afterwards. Cables already drawn keep their shape (see [Editing cables](#editing-cables)).

1. Under *Cable colour* choose *By length*. The cables appear in length colours.

   ![Cable colour by length](bilder/en/canvas-defaults-06-farbe-laenge-flaeche.jpg)

2. The *?* button next to *By length* shows the legend *Length colours*: 1 m red, 2 m yellow, 3 m green, 5 m white, 10 m red, 20 m yellow, 25 m yellow/white dashed, 50 m white, 100 m red. *Close* hides it.

   ![Legend of the length colours](bilder/en/canvas-defaults-07-farbe-legende.jpg)

3. *Cable bumps at crossings* draws a bump at crossings.

   ![Cable bump at a crossing](bilder/en/canvas-defaults-11-bruecken-flaeche.jpg)

4. *Colour ports by connector type* colours the ports by connector type.

   ![Coloured ports](bilder/en/canvas-defaults-16-ports-nach-typ-flaeche.jpg)

In addition, the entry *Color cables by discipline* in the *View* menu colours the cables by their layer (video, audio and so on).

### Selecting devices

- **Click** on a device selects it; the inspector on the right shows its properties.
- **Shift**, **Ctrl** or **Cmd** plus click adds further devices or removes them again.
- Holding **Shift** and dragging on empty area draws a selection rectangle.
- *Edit → Select all* selects all devices.
- A click on empty area clears the selection.

1. Click Camera 2.

   ![One device selected](bilder/en/canvas-auswahl-01-ein-geraet.jpg)

2. Click the Vision mixer while holding Shift.

   ![Two devices selected](bilder/en/canvas-auswahl-04-zwei-geraete.jpg)

3. Drag a rectangle over several devices while holding Shift.

   ![Selection rectangle](bilder/en/canvas-auswahl-07-rechteck.jpg)

4. *Edit → Select all* selects all five devices.

As soon as devices are selected, the buttons for selection actions appear in the toolbar and the [selection bar](#selection-bar-at-the-device) appears above the selection.

### Aligning devices

The align buttons are in the toolbar as soon as at least one device is selected. All results snap to the grid when *Snap to grid* is on.

| Button (tooltip) | With one device | With several devices |
|---|---|---|
| *Left align* / *Align to left viewport edge* | At the left edge of the visible area | Left edges flush |
| *Centre horizontally* | In the middle of the visible area | On a common vertical centre axis |
| *Right align* | At the right edge of the area | Right edges flush |
| *Top align* | At the top edge of the area | Top edges flush |
| *Centre vertically* | In the middle of the area | On a common horizontal centre axis |
| *Bottom align* | At the bottom edge of the area | Bottom edges flush |
| *Distribute horizontally* | – | From three devices: equal gaps |
| *Distribute vertically* | – | From three devices: equal gaps |

1. With one device selected, *Align to left viewport edge* aligns it to the edge of the visible area.

   ![One device at the left edge](bilder/en/canvas-auswahl-02-einzeln-links.jpg)

2. Select Camera 2, Vision mixer and Multiviewer and click *Left align*.

   ![Aligned left](bilder/en/canvas-auswahl-09-ausrichten-links.jpg)

3. *Distribute horizontally* evens out the gaps.

   ![Distributed horizontally](bilder/en/canvas-auswahl-15-ausrichten-verteilen-waagerecht.jpg)

Aligning can be undone with *Edit → Undo*.

### Saving a device group

The button *Save N selected devices as a group* stores the selection with its cables as a template. The group then appears in the library under *Groups* and can be dragged onto the plan.

1. Select several devices and click the button with the three rectangles. The field *Group name…* appears in the toolbar.

   ![Field for the group name](bilder/en/canvas-auswahl-17-gruppe-name.jpg)

2. Enter a name and click the green tick (*Save group*). The group appears in the library under *Groups*.

   ![Group in the library](bilder/en/canvas-auswahl-18-gruppe-gespeichert.jpg)

3. If the name already exists, the app asks *A template named "…" already exists. Overwrite?* With *Overwrite* you replace the template.

### Arranging the selection in the rack builder

The button *Arrange the N selected devices in the 2D rack builder* opens the rack builder with the selection (the device context menu has the same as *Arrange in rack builder*). If the selection already contains a rack, the button is missing; if exactly one rack is selected, the button *Edit this rack in the 2D rack builder* opens the builder for that rack instead. The builder itself is described in the chapter [Rack Builder](#rack-builder).

![Rack builder with the selection](bilder/en/canvas-auswahl-20-rack-aus-auswahl.jpg)

### Several cables between two devices

When exactly two devices are selected, the toolbar shows the button *Connect cables* (tooltip: *Create several cables between the two selected devices at once*). Without a selection, *Tools → Connect multiple cables…* opens the same dialog with two lists for source and target.

1. Select two devices, for example Camera 2 and Vision mixer.

2. Click *Connect cables*. The dialog *Connect multiple cables* explains: it creates N cables at once, source port i → target port i; occupied target ports are skipped.

   ![Dialog Connect multiple cables](bilder/en/canvas-auswahl-22-kabel-verbinden-dialog.jpg)

| Field | Meaning |
|---|---|
| *Source → Device*, *Side* | Device and side (*Outputs* or *Inputs*) the cables start from. |
| *Start Outputs (1..n)* | Number of the first source port. |
| *Target → Device*, *Side* | Device and side (*Inputs* or *Outputs*) where they end. |
| *Start Inputs (1..n)* | Number of the first target port. |
| *Cable count* | How many cables are created. |
| *Cable type* | The cable type of all new cables; the colour comes from the type. |
| *Length per cable (m)* | Length of all new cables. |
| *Preview (x/y cables)* | Lists the pairs. If the count exceeds the free ports, it says *Count exceeds available ports — extras are skipped.* |

3. Set *Start Inputs* and *Cable count*. The preview shows which pairs are created.

   ![Values set](bilder/en/canvas-auswahl-23-kabel-verbinden-werte.jpg)

4. Click *Create N cables*. A message states how many cables were created and how many were skipped (*target port occupied or invalid*).

   ![Cables created](bilder/en/canvas-auswahl-24-kabel-verbinden-erstellt.jpg)

### Cables by voice

The button *Voice* (tooltip: *Create cables from a spoken or typed sentence*) opens the dialog *Cable by voice*. A sentence of the form "<source> to <target>" is read against the names of the devices, their rooms and ports in the plan. There is no language model and no network connection. Separate several cables with a full stop.

1. Click *Voice*. The input field is active; with the microphone button you dictate if speech recognition is available, otherwise you type or use system dictation (macOS: press Fn twice, Windows: Win+H).

2. Enter a sentence, for example "SDI 1 from Camera 1 to Vision mixer In 3".

3. Click *Preview* or press Enter. For each sentence the preview shows source device and port, target device and port. Every choice can be changed. The button at the bottom gives the number of ready cables (*Connect N cables*).

   ![Preview of one sentence](bilder/en/canvas-sprache-03-vorschau.jpg)

4. Several sentences appear one below the other. A sentence without a match shows *No match - pick a device*; as long as nothing is chosen there, it does not count. If several devices fit, the preview asks *Which one? (n match)*. If a named device exists only in the library, the preview offers *Add from library: name*; it is created in the plan when connecting. If a target port is occupied, the preview asks *This input already has cable …. Replace it?*. If the signal families do not fit, a note says a converter is probably needed and a converter can be inserted.

   ![Preview of several sentences](bilder/en/canvas-sprache-04-zwei-saetze.jpg)

5. *Connect N cables* creates the cables in one step. One undo takes all of them back.

   ![Cables created](bilder/en/canvas-sprache-05-angelegt.jpg)

### Keyboard shortcuts on the canvas

| Key | Effect |
|---|---|
| Click, Shift/Ctrl/Cmd + click | Select, add to the selection |
| Arrow keys | Move selected devices by one grid cell |
| Shift + arrow keys | Move by four grid cells |
| Ctrl/Cmd + C, Ctrl/Cmd + V | Copy and paste selected devices |
| Ctrl/Cmd + D | Duplicate the selection |
| Ctrl/Cmd + Plus (or =) | Create a new device at the mouse position; a dialog asks for the name. The device gets the category *Other* and no ports. |
| Delete or Backspace | Delete the selection (devices and cables together in one step) |
| Esc | Cancel a cable being drawn |
| Ctrl/Cmd + F | Device search |

The keys have no effect while the cursor is in a text field.

1. Ctrl/Cmd + Plus asks for the name of the new device.

   ![Dialog New device](bilder/en/canvas-kuerzel-06-strg-plus.jpg)

### Drawing cables

Cables are created by dragging from one port to another.

1. Press the port dot of an output (for example SDI Out of Camera 2) and drag it onto a free input (for example In 3 on the Vision mixer).

   ![Cable being dragged](bilder/en/canvas-kabel-01-ziehen.jpg)

2. On release the dialog *New cable* opens. At the top are *From:* and *To:*. The list *Cable* shows all cable types; ✓ marks types that fit both connectors, ✕ those that do not. *★ Custom cable…* creates a custom type. Further fields are *Signal standard*, *Name*, *Length (m)*, *Colour* and *Notes*; a green note confirms that the type fits the connectors (for example *SDI 3G (1080p50/60) fits BNC ↔ BNC.*).

   ![Dialog New cable](bilder/en/canvas-kabel-02-dialog.jpg)

3. Choose a type and click *Create*. The cable appears with label and length.

   ![Cable created](bilder/en/canvas-kabel-04-kabel-angelegt.jpg)

Special cases when dragging:

- An **occupied input** is not silently overwritten. After *Create* the app reports *Port already in use* and names the existing cable. *Replace* removes the existing cable and creates the new connection, *Cancel* discards the new connection and everything stays as it is.

  ![Message Port already in use](bilder/en/canvas-kabel-05-besetzt.jpg)

- Releasing **on empty area** gives an open end: the app creates a device "Open …" there with a port *Open End* of the same connector type and opens the dialog *New cable* for it.

  ![Cable to an open end](bilder/en/canvas-kabel-07-offenes-ende.jpg)

- Releasing **on the body of another device** creates a matching new port there and connects it. This also allows cabling a device that has only a name so far.

  ![Releasing on the device body](bilder/en/canvas-kabel-09-auf-den-koerper.jpg)

- **Two clicks instead of dragging:** a click on a port starts the cable; clicks on empty area set bends, a click on a port finishes it. The banner says *Draw cable: tap the canvas for a bend, tap a port to finish.* *Undo bend* takes back the last bend, *Cancel* discards the cable; Esc also cancels. An input can only be connected to an output, not to another input. While the cable is pending, the right side shows *Quick suggestions (connector type)*: up to eight library devices with a matching port, those most often connected in the project first. A click on a suggestion places the device at the mouse position and finishes the cable at the first matching port.

  ![Cable with banner and suggestions](bilder/en/canvas-kabel-12-klick-knick.jpg)

The defaults for *Cable routing* and *Arrow at cable end* from [Defaults](#defaults) apply to every new cable.

### Editing cables

A click on a cable selects it; the inspector shows its properties, a double click opens the edit dialog. Handles appear on the selected cable.

1. Click a cable.

   ![Selected cable with handles](bilder/en/canvas-kabeleditor-01-gewaehlt.jpg)

2. Drag a segment to move the route.

3. Drag a corner to relocate the bend.

   ![Corner moved](bilder/en/canvas-kabeleditor-03-ecke-ziehen.jpg)

4. A right click on the cable opens the cable menu.

   ![Cable menu](bilder/en/canvas-kabeleditor-04-menue.jpg)

| Entry | Effect |
|---|---|
| *Change label…* | Asks for the label of the cable. |
| *Add annotation…* | Attaches an annotation to the cable. |
| *Accept into plan (mobile suggestion)* / *Remove mobile check* | Only for cables suggested or ticked off from the phone. |
| *Measure signal* | Opens the scopes for the stream the device sends at the start of the cable. Greyed out when the source device has no stream the app can open (RTSP, RTMP, SRT, HLS, MJPEG; Properties → Streams). |
| *Add waypoint here* | Inserts a waypoint at the click point. |
| *Remove nearest waypoint* | Removes the waypoint closest to the click. |
| *Clear all waypoints (n)* | Removes all waypoints of the cable. |
| *Auto-reroute* | Calculates the route again. |
| *Routing:* *Orthogonal* / *Direct* / *Curved* | Sets the shape of this cable. |
| *Cable jumps for this cable* | Overrides the global setting; *Remove override (follow global)* takes that back. |
| *Arrow at end*, *Arrow at start* | Shows or hides the arrow. |
| *Bidirectional* | Turns arrows at both ends on or off. |
| *Create off-page connection…* | See [Off-page connectors](#off-page-connectors). |
| *Delete cable* | Asks *Delete cable "…"?* and removes it after confirmation. |

5. A double click on a cable opens the dialog for editing the cable; its fields are described in the chapter [Inspector](#5-inspector).

   ![Double click on a cable](bilder/en/canvas-kabeleditor-19-doppelklick.jpg)

### Off-page connectors

An off-page connection replaces the continuous line of a cable at each end with a small connector symbol. This keeps plans readable in which two devices are far apart. All off-page cables with the same net name form a net.

1. Right click the cable, *Create off-page connection…*. The app asks *Net / signal name for the off-page connection:*; the cable name is prefilled.

   ![Question for the net name](bilder/en/canvas-seitenverbinder-01-erstellen-frage.jpg)

2. With *OK* the cable becomes an off-page connection. Each connector symbol names the counterpart (*device · port*); an arrow shows the signal direction. A click on the arrow jumps to the nearest counterpart.
3. The net name appears when you point at the symbol; the entry *Show off-page names* in the *View* menu shows it permanently.
4. A right click on a symbol opens the net info: number of endpoints, a jump list and *Resolve off-page (show line)*, which restores the line.

### Frames

A frame is a coloured rectangle that groups devices into a place or room. The button *Frame* in the toolbar creates a new frame ("New location") in the middle of the visible area. If devices are selected, the button has the tooltip *Frame around the N selected devices* and draws the frame around them.

1. Click *Frame* without a selection.

   ![New frame](bilder/en/canvas-rahmen-01-rahmen-leer.jpg)

2. A double click on the frame asks *Rename location:*.

3. A click on the frame shows the frame properties in the inspector (name, width, depth, area, floor, colour, riser, room number, address, notes); they are described in the chapter [Inspector](#5-inspector).

4. Change the size with the handles of the selected frame.

5. Drag the frame by its title. Devices whose centre lies inside the frame move with it.

   ![Frame moved with its devices](bilder/en/canvas-rahmen-14-rahmen-nimmt-mit.jpg)

6. The lock at the frame title blocks moving and resizing; the settings stay reachable.

7. A right click on the frame opens the menu with *Lock position* (or *Unlock position*) and *Delete frame*.

   ![Context menu of a frame](bilder/en/canvas-rahmen-09-rahmen-kontext.jpg)

8. *Delete frame* asks *Delete frame "…"?* — only the frame disappears, the devices stay.

9. Select several devices and click *Frame* to draw a frame around them.

   ![Frame around the selection](bilder/en/canvas-rahmen-13-rahmen-um-auswahl-fertig.jpg)

### Rooms, floors and the 3D building view

Every frame is a room. Frames can be assigned to floors; floors determine visibility in the plan and stacking in the 3D view. The buttons *Rooms* and *3D* are under *More* as soon as the plan contains at least one frame.

1. Create frames (here Studio, Control room, Machine room).

2. Select a frame. In the inspector, the entry *Add floor…* in the *Floor* selection opens the prompt *Name of the new floor (e.g. "3rd floor")*.

   ![Add floor](bilder/en/canvas-raeume-05-etage-neu.jpg)

3. The floor is then in the *Floor* field.

4. In the inspector, the section *Floors (n)* shows the floors from bottom to top with their floor level in metres; the arrows change the order, the bin removes a floor, *Add floor…* adds another.

   ![Floors with heights](bilder/en/canvas-raeume-08-etage-hoehen.jpg)

5. *Riser / vertical cable route* marks a frame that runs through all floors in the 3D view; cables between floors then run through it instead of as a straight line.

6. *More → Rooms* opens a list grouped by floor (topmost first). Each floor and each room has a tick; rooms without a floor are under *Without floor*.

   ![List of rooms](bilder/en/canvas-raeume-11-raeume-menue.jpg)

7. Remove the tick of a room: its devices and cables disappear from the plan. The button then reads *Rooms (n hidden)*.

8. The tick of a floor hides all rooms of that floor.

9. *Show all* shows everything again. Several rooms can be hidden at the same time.

10. *More → 3D* opens *Building 3D*: the rooms stacked by floor, with the connections in between.

    ![Building 3D with room connections](bilder/en/canvas-raeume-17-drei-d-raeume.jpg)

11. Under *Show* you switch between *Room connections* and *Single cables*.

    ![Single cables in 3D](bilder/en/canvas-raeume-18-drei-d-kabel.jpg)

12. *Labels* shows or hides the names. *Storey height (m)* applies only to floors without an entered height; the view points out that this is an assumption.

Devices can be dragged in the 3D view. Floor boxes appear as a flat plate in the floor, other devices as cubes. Dragging beside a device rotates the view, the mouse wheel zooms.

### Layers

The layer chips show and hide the cables of a layer. Only the cables are filtered, the devices stay. A coloured dot marks the signal type; the tooltip gives the number of cables (for example *Video — 4 cables · visible (click to hide)*).

1. The toolbar shows *Video*, *Audio*, *Control*, *Network*, *Power* and *Other*.

   ![Layer chips](bilder/en/canvas-ebenen-01-chips.jpg)

2. Click *Video*: the video cables disappear.

   ![Layer Video hidden](bilder/en/canvas-ebenen-02-video-aus.jpg)

3. *More → Layers ⋯* opens the management menu: *Create custom layer…* and *Show all layers again*.

   ![Layers menu](bilder/en/canvas-ebenen-03-menue.jpg)

4. *Create custom layer…* asks for the name (for example "intercom"). The new layer appears as a chip with a diamond symbol.

   ![Create a custom layer](bilder/en/canvas-ebenen-05-eigene-anlegen.jpg)

5. A right click (on a phone a long press) on the chip of a custom layer asks *Remove custom layer "…"?*.

### Signal path

The signal path highlights the whole chain a cable is part of and dims the rest.

1. Select a cable.

2. Click *Show signal path* in the inspector.

   ![Signal path shown](bilder/en/canvas-signalweg-02-signalweg-zeigen.jpg)

3. The toolbar shows the chip *Signal path: n cables, m devices*. A click on it or Esc ends the view.

### Operating modes: schematic, circuit, test pattern

#### Schematic and live

The button *Schematic* under *More* shows where the plan gets its picture from: *Schematic* means it is the planned path without a connection to an installation; *Live* means the observed state of a switcher or router is shown (with its age in seconds). If the connection drops, it says *· connection lost* and the view falls back to the planned path. A click on the chip does not change the mode but turns the motion of the display on or off; if the operating system has motion turned off, the view stays still.

#### Circuit

*Circuit* calculates electrical circuits: which luminaires are lit, which switch positions apply, which lines are live. The result is calculated, not measured; the switch positions are not part of the plan. Only devices that carry a circuit type in their properties are taken into account; it is never guessed from the category. If no device with a type is in the plan, the chip shows *· nothing declared*.

1. Switch *Circuit* on. The chip gives the lit luminaires out of all luminaires (for example "1/1").

2. *Reset switches* puts all switches back to their default; the plan does not change. *Suggestions* explains why the circuit does not do what it should and which wire would change that; every suggestion brings its truth table, nothing is entered without a click.

#### Test pattern

*Test pattern* is an expectation, not a video image: after choosing a source, the plan shows at every arrival point which image should be there. The app does not see what actually arrives.

1. Open *More* and choose a source under *Test pattern* (the list contains every device with an output, first *none*).

2. The plan shows the test pattern at the source and at every arrival point, labelled *Expected per plan*. The toolbar shows the chip *Test pattern* with the source, the number of arrival points and the counters *· n open*, *· n swapped*, *· n unchecked*.

   ![Test pattern chosen](bilder/en/canvas-modi-07-pruefbild-gewaehlt.jpg)

3. At each arrival point you record what you saw on site: *correct*, *different image…* (then the name on it, and *record*), *no image* or *no monitor*. The finding is then shown in colour at the arrival point (correct, still open, swapped or another deviation) and feeds into the counters of the toolbar.

   ![Test pattern toolbar](bilder/en/canvas-modi-08-pruefbild-leiste.jpg)

4. *Save…* offers three files: *Test pattern image (SVG)* for a media player, the switcher stills store or a laptop (the app feeds nothing in), *Check sheet (CSV)* as a walk-around list, also with paths the plan cannot follow to the end, and *Sign-off sheet (CSV)* with what was seen, including the time.

5. *Switch path…* appears when a router lies on a path of the source. The dialog sets the crosspoints of the plan on the live installation.


   Under *Where should the image go?* you choose the target; the dialog shows the path (for example Camera 1 → Videohub 12x12 → Control room monitor) and the commands sent. If no control protocol is declared for the device (Properties → Control), nothing is sent. *Switched by* records a name. *switch now* is only possible if the plan contains commands, nothing is in the way (for example a missing control protocol) and the tick *I have read which outputs will be switched, and I am switching the live installation.* is set.

The choice *none* ends the test pattern.

### Locking

*More → Lock* protects against accidental moves. The menu has three switches:

| Switch | Effect |
|---|---|
| *Frames* | No frame moves |
| *Devices* | No device moves |
| *Cables* | No waypoint editing (the handles on the cable disappear) |

The button shows the number of active switches (for example *Lock 1/3*).

1. Open *Lock*.

   ![Lock menu](bilder/en/canvas-sperren-01-menue.jpg)

2. Switch *Devices* on. The devices can no longer be dragged.

   ![Devices locked](bilder/en/canvas-sperren-02-geraete.jpg)

3. With *Cables* locked, a selected cable shows no handles.

   ![Cable without handles](bilder/en/canvas-sperren-05-kabel-ohne-griffe.jpg)

Individual devices and frames can also be fixed with *Lock position* in the context menu.

### Finalising the plan

*More → Finalise* locks the whole plan: no moves, no new connections, no deletions. The entry then reads *Finalised*.

1. Click *Finalise*. The app asks *Finalise plan?* and explains that the canvas will be locked and that the lock can be lifted at any time.

   ![Question Finalise plan](bilder/en/canvas-abschliessen-02-frage.jpg)

2. After *Finalise*, the banner *Plan is finalized — changes are locked.* appears above the plan with the button *Release for editing*.

   ![Finalised plan](bilder/en/canvas-abschliessen-03-abgeschlossen.jpg)

3. *Release for editing* asks *Re-open the plan for editing?*; *Release* lifts the lock. The entry under *More* asks *Re-enable plan editing?* (*Re-enable*).

   ![Question Release](bilder/en/canvas-abschliessen-05-freigeben-frage.jpg)

A viewer file (`.cpviewer`) is permanently read-only; the entry then reads *Viewer* and cannot be operated.

### Annotations

Annotations are notes on the plan, free or attached to a device or cable. Two entries under *More* belong to them: *Badges* shows or hides the markers of the annotations on the plan (the data stays), *Annotations* opens the panel.

1. Open *Annotations*. The panel shows the filters *all*, *open*, *built*, *resolved* at the top and the button *+ New annotation*.

   ![Annotations panel](bilder/en/canvas-anmerkungen-02-panel-offen.jpg)

2. Click *+ New annotation* and write the text.

3. *Add* asks for your name the first time; it is attached to all annotations you create.

4. The annotation is then in the list.

   ![Annotation created](bilder/en/canvas-anmerkungen-06-hinzugefuegt.jpg)

5. Each annotation has a status (*open*, *built*, *resolved*); the filters show only the annotations of one status.

6. The button for placing at the canvas centre puts the marker in the middle of the plan; drag the handle of an annotation onto a device to attach it there.

   ![Annotation on a device](bilder/en/canvas-anmerkungen-13-an-geraet.jpg)

7. A click on the marker on the plan shows the annotation.

8. *Badges* hides the markers.

9. Deleting asks *Delete annotation?*.

A right click on a device or cable also offers *Add annotation…*: after asking for the text (and the first time for your name) the annotation is attached to the device or cable. In viewer mode the entry *Annotations* invites reviewers to leave notes (tooltip: *Annotations — leave reviewer notes*).

### Floor plan

*More → Floor plan* (also in the *View* menu) puts an image or a PDF under the plan. It serves as a scale for cable lengths and as a spatial template.

1. Open *Floor plan*. The panel offers *Load floor plan image or PDF…*, *Import venue from MultiCam / Light Planner…* and the note that an image or PDF can also be dropped here or onto the canvas.

   ![Empty floor plan panel](bilder/en/canvas-hallenplan-02-panel-leer.jpg)

2. Load an image (PNG, JPG, WebP, GIF, BMP or AVIF up to 40 MB). It lies under the devices. The app says *Floor plan loaded. Set the scale next — until then lengths use "metres per 100 px".*

   ![Floor plan loaded](bilder/en/canvas-hallenplan-03-bild-geladen.jpg)

3. *Opacity* controls how strongly the image shows through.

4. *Lock position (clicks go through to the devices)* makes the image insensitive to clicks.

You set the **scale** in two ways.

5. *Two points* (for plans seen from above, CAD export, scan): enter the known distance in metres and click *Two points*. The app says *Click both ends of a distance of N m.*

6. After the second click the panel says *Scale from N m reference: … cm per canvas pixel.*

   ![Scale from two points](bilder/en/canvas-hallenplan-09-zwei-punkte-fertig.jpg)

7. *Four corners* (for photos, signs and isometric drawings): enter width × depth of a rectangular floor area in metres and click the four corners in turn: top left, top right, bottom right, bottom left. If the points do not form a rectangle, the app says so.

   ![Four corners in the wrong order](bilder/en/canvas-hallenplan-11-vier-ecken-falsch.jpg)

8. Afterwards the panel says *Perspective scale from a W × D m area.*

9. *Recalculate cable lengths* determines the lengths along the drawn routes (*n cable lengths recalculated along their drawn routes.*).

10. *Replace image…* asks *Replace the floor plan?* — the scale calibration is lost and has to be set again.

11. A file that is not an image is rejected by the app: *This file is not a floor plan image. Use PNG, JPG, WebP, GIF, BMP or AVIF.*

**PDF.** A PDF is loaded as an image of the page. If it has several pages, the panel shows *PDF page* with the page number and *of n*; another page replaces the plan in the same place with the same opacity.

12. Load a PDF.

13. Choose another page.

    ![PDF page chosen](bilder/en/canvas-hallenplan-21-pdf-seite.jpg)

14. *Crop…* opens a preview in the panel with the note *Drag a rectangle over the part of the plan you want to keep.* Draw the rectangle and click *Crop plan*; *Cancel* discards it.

    ![Crop drawn](bilder/en/canvas-hallenplan-23-zuschnitt-rahmen.jpg)

15. The plan now shows only the chosen part.

    ![Cropped plan](bilder/en/canvas-hallenplan-24-zugeschnitten.jpg)

**One plan per floor.** As soon as the plan has floors, the panel shows the selection *Floor* at the top with *All floors* and the floor names; each floor has its own floor plan. For cable lengths the scale of the plan applies to all floors (*Cable lengths use the scale of the plan for all floors.*).

**Venue exchange.** *Import venue from MultiCam / Light Planner…* reads a venue file of the sister apps including floor plan and scale. The panel reports error cases: *This is not a venue exchange file (MultiCam / Light Planner).*, *The venue file carries no floor plan image.*, *The venue file carries a floor plan without real dimensions.* *Export venue for MultiCam / Light Planner* writes the plan back; the exchange carries one scale per plan, so the button is disabled after a four-corner calibration.

16. *Remove floor plan* takes the image away again.

### Plan symbols

*More → Symbols* (also in the *View* menu) opens the panel *Symbols* with plan symbols that are not devices: sockets, detectors, loudspeakers, network outlets and the like.

1. Open *Symbols*. At the top are the categories *Electrical*, *Intrusion alarm*, *Fire alarm*, *Voice alarm / PA*, *IT / network*, *Automation*, *AV* and *Custom*; below are the search field *Search symbols…* and the symbols of the category.

   ![Symbols panel](bilder/en/canvas-symbole-02-panel-offen.jpg)

2. Each category contains fixed symbols, for example under *Electrical* socket outlet, socket outlet with protective contact, switch, push button, luminaire, distribution board, fuse, residual current device, energy meter, earth, motor, transformer, junction box and CEE socket; under *AV* camera, monitor, projector, projection screen, stage box, rack, floor box and cable ramp.

   ![Category AV](bilder/en/canvas-symbole-09-kategorie-av.jpg)

3. A click on a symbol (tooltip *Place on the canvas*) puts it on the plan.

   ![Symbol placed](bilder/en/canvas-symbole-12-platziert.jpg)

4. A selected symbol has the fields *Label*, *Size*, *Rotation* (0°, 90°, 180°, 270°), *Lock position* and *Delete symbol*.

   ![Properties of a symbol](bilder/en/canvas-symbole-15-drehung.jpg)

5. *Import symbol (SVG, PNG, JPG, WebP)…* stores your own symbols under *Custom*. SVG may be at most 200 KB, raster images at most 512 KB. An unused custom symbol can be removed from the library again with the **×** on its tile.

6. With an AI provider set up, *Generate symbol* creates a symbol from a description and stores it under *Custom*. The app points out that the result must be checked: it is a model's drawing, not a standard symbol.

7. *Symbol list as CSV (n)* exports the placed symbols with category, count and labels.

   ![Symbol list as CSV](bilder/en/canvas-symbole-29-liste-csv.jpg)

### Device search

*Ctrl/Cmd + F* or *View → Find device* opens the search bar *Find device…* above the plan. It can be moved, collapsed to a pill and closed (*Close search*); Ctrl/Cmd + F and the *View* menu bring it back.

1. The search sits as a pill above the plan.

   ![Search as a pill](bilder/en/canvas-suche-01-pille.jpg)

2. Ctrl/Cmd + F expands it.

3. Type a term. The list shows matches with the field in which it was found. Searched are name, short name, IP, MAC, VLAN, asset no., internal no., serial number, label code, switch port, category, subtitle and note.

   ![Matches](bilder/en/canvas-suche-03-treffer.jpg)

4. A click on a match centres the plan on the device and closes the search. Without matches it says *No matches*.

   ![Jumping to the match](bilder/en/canvas-suche-06-springen.jpg)

### Zoom and navigation

At the bottom left are the controls for zooming in, zooming out, fit view and the button for locking the interaction. At the bottom right the overview map shows the whole plan; a click on it or dragging jumps to the place. The mouse wheel zooms between 10 % and 400 %; dragging on empty area moves the plan. The *View* menu offers *Fit to view*, *Zoom 100 %*, *Zoom in*, *Zoom out* and *Fullscreen*.

![Controls and overview map](bilder/en/canvas-zoom-01-regler-minikarte.jpg)

1. *Zoom in* zooms in.

2. *Fit to view* shows all devices.

   ![Plan fitted](bilder/en/canvas-zoom-06-einpassen.jpg)

3. The lock button locks the interaction: the plan can then neither be moved nor zoomed.

4. *View → Zoom 100 %* resets the scale.

### Context menus

**Device** (right click on a device):

| Entry | Effect |
|---|---|
| *Open rack editor* | Only for a rack: opens the rack builder for it. |
| *Add annotation…* | Asks (the first time) for your name and for the text and attaches the annotation to the device. |
| *Device datasheet…* | Opens the datasheet (one A4 page) for the device or the selection. |
| *Scopes…* / *Compare scopes* | Only in the desktop app and when the devices have streams the app can open. |
| *Arrange in rack builder* / *Arrange N devices in rack builder* | Opens the rack builder with the device or the selection. |
| *Lock position* / *Unlock position* | Keeps the device in its place. |
| *Delete device* | Asks *Delete device "…"?* — the device and all connected cables are deleted. |

![Context menu of a device](bilder/en/canvas-kontext-01-geraet.jpg)

![Device datasheet](bilder/en/canvas-kontext-02-geraet-datenblatt.jpg)

**Empty area:** a right click offers *New device here …*. It opens *Create your own device* with name, category, port groups and the buttons *Save to library*, *Place in project only* and *Save + place*; the dialog is described in the chapter [Create your own device](#create-your-own-device).

![Context menu of the empty area](bilder/en/canvas-kontext-08-flaeche.jpg)

**Cable** and **frame:** see [Editing cables](#editing-cables) and [Frames](#frames).

### Selection bar at the device

Above a selection a small bar with quick actions appears.

| Selection | Buttons |
|---|---|
| One device | *Duplicate*, *Frame around selection*, *Device datasheet (A4 PDF / print)*, *Delete* |
| Two devices | additionally the six align buttons |
| Three and more devices | additionally *Distribute horizontally* and *Distribute vertically* |

For devices with readable streams, *Compare scopes (one parade per source)* is added.

![Selection bar at a device](bilder/en/canvas-inline-01-ein-geraet.jpg)

![Selection bar with three devices](bilder/en/canvas-inline-04-drei-geraete.jpg)

### Still image under the device

For a device that delivers a stream or a still image, the canvas shows a tile under the device. It is switched on in the inspector under *Streams* (*Show a still image under the device on the canvas*, with a *Still image address for the preview*). The tile does not start by itself: *Start preview · name* fetches a still image, then every 10 seconds while the tile is visible. For a live stream the tile plays it until *Stop live* is chosen. The tile names the reason when no image arrives, for example *No preview: the address is not in the local network.*, *No preview: ffmpeg was not found …* or *No preview: the device cannot be reached.* Still images are fetched by the desktop app only.

![Device with the Streams section](bilder/en/canvas-stream-02-abschnitt-streams.jpg)

### Adapters and converters in the cable

When a cable is created, the app checks whether the connectors fit together. The dialog *New cable* then names the reason and what belongs in between:

- same gender at both ends: a gender changer,
- connectors that do not mate: an adapter,
- different signal families: a converter, a device with power and a bandwidth limit that you choose yourself.

After creating the cable, the inspector of the cable offers *Insert*; it puts the adapter into the run as a device of its own (*Insert it into this run — one undo step removes it again*). An adapter belongs in the plan as a device, otherwise it is neither in the signal path nor on the pick list.

![Dialog for different connectors](bilder/en/canvas-adapter-09-dialog-adapter.jpg)
