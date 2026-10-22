## Tools: Build

The *Tools* menu has five groups: *Calculate*, *Check*, *Plan*, *Create & manage* and *Device configuration*. This chapter describes the entries of the *Plan* group from *LED wall…* onwards, plus the groups *Create & manage* and *Device configuration*. The calculators, the checks and the other entries of the *Plan* group are in the chapter [Tools: Plan](#tools-plan). Patch list, fixed install, stage plot and *Export & Print…* are in the *File* menu and in the chapter [Export and Print](#export--print).

The group *Device configuration* appears only when the plan contains a matching device: *ATEM multiviewer layout…* for an ATEM or a multiviewer, *ATEM audio routing…* and *ATEM input labels…* for an ATEM, *Videohub routing / labels…* for a Videohub and *GreenGo intercom…* for a GreenGo device. The same tools are in the Inspector in the section *Tools for this device*. *Inventory / stock…* appears when the rental module is switched on.

![Lower half of the Tools menu](bilder/en/werkzeuge-bauen-menue-01-unten.jpg)

### LED wall

*Tools → LED wall…*

The *LED wall* dialog plans a wall of identical tiles. From the datasheet values of the panel type it calculates tile count, resolution, size, weight and power of the wall, checks whether the ports of the sending card can carry the pixels, calculates the crop of a standard source onto the wall and delivers the pixel map as a PNG. Panel types and walls belong to the project. A missing value appears as a sentence where the number would otherwise be: if a panel type carries no weight, the weight of the wall is unknown, not 0 kg.

1. Open *Tools → LED wall…*. Without a panel type it says *No panel type recorded.* with the hint to take the figures off the datasheet; under *Walls* it says *A wall needs a panel type first.*

   ![LED wall dialog without a panel type](bilder/en/werkzeuge-bauen-led-01-leer.jpg)

2. *Add panel type* creates a type with the defaults *New panel type*, 3.9 mm pitch, 128 × 128 pixels and 500 × 500 mm.

   ![New panel type](bilder/en/werkzeuge-bauen-led-02-typ-neu.jpg)

3. Enter the datasheet values. Each number is applied when you leave the field.

   ![Panel type with datasheet values](bilder/en/werkzeuge-bauen-led-03-typ-ausgefuellt.jpg)

   | Field | Meaning |
   |---|---|
   | *Name* | Name of the type; it appears in the wall's selection. |
   | *Pitch (mm)* | Pixel pitch. |
   | *Pixels across* / *Pixels down* | Resolution of one panel. |
   | *Width (mm)* / *Height (mm)* | Size of one panel. |
   | *Weight (kg)* | Weight of one panel; empty means not stated. |
   | *Power, average (W)* / *Power, peak (W)* | Power draw of one panel on average and at peak; empty means not stated. |
   | *Datasheet (URL)* | Link to the datasheet. |

   The **×** next to the first fields (*Remove*) deletes the panel type.

4. *Add wall* creates a wall *New wall* with the first panel type, 4 columns and 3 rows. With several walls, the buttons with the wall names choose which wall is shown below.

   ![New wall](bilder/en/werkzeuge-bauen-led-04-wand-neu.jpg)

5. The wall has the fields *Name*, *Panel type* (a choice among the types), *Columns* and *Rows*. The totals below change as soon as you change *Columns* or *Rows*.

   ![Grid 8 × 4](bilder/en/werkzeuge-bauen-led-05-raster.jpg)

6. Instead of counting the grid, enter the opening: *Opening width (mm)* and *Opening height (mm)*. Next to the button it says what fits, for example *6 × 3 tiles, 300 mm across and 200 mm up left over*. The result is rounded down: a tile that is only half inside the opening does not count. The remainder stays visible so that you can decide whether to hang the wall centred or change the opening.

   ![Opening entered](bilder/en/werkzeuge-bauen-led-06-oeffnung.jpg)

7. *Fit the grid* applies columns and rows. The button is active only when both dimensions are greater than 0.

   ![Grid fitted](bilder/en/werkzeuge-bauen-led-07-oeffnung-eingepasst.jpg)

#### Wall totals

Six values appear under the fields: *Panels*, *Resolution* (total pixels), *Size (mm)*, *Weight*, *Power, average* and *Power, peak*. If the panel type lacks weight or power, this place says *panel type carries no weight* or *panel type carries no power figure*. A hint reminds you to size the breaker on the peak, not on the average.

![Wall without a weight](bilder/en/werkzeuge-bauen-led-12-ohne-gewicht.jpg)

#### Source crop

The section *Source crop* calculates which part of a standard source the processor has to show so that it fills the wall without distortion and centred. *Source width (px)* and *Source height (px)* default to 1920 × 1080. The source is scaled so that it fills the whole wall; the axis that overhangs is cropped centrally. Four tiles give the values in source pixels: *X*, *Width*, *Y* and *Height*. The axis that is not cropped carries the full source size, not 0. Below there is a sentence such as *Cropped: top and bottom (Y). Scale 30 %, layer 1152 × 576.* The axis is called *none, same aspect ratio*, *sides (X)* or *top and bottom (Y)*. If the wall has no resolution yet, it says *The wall needs a resolution first.*

1. Enter the resolution of the source, here 3840 × 2160.

   ![Crop for 3840 × 2160](bilder/en/werkzeuge-bauen-led-08-zuschnitt-quelle.jpg)

2. A click on a tile copies its value to the clipboard; the tile then shows *· copied*.

   ![Value copied](bilder/en/werkzeuge-bauen-led-09-zuschnitt-kopiert.jpg)

#### Sending card

*Ports on the sending card* and *Pixels per port* describe the sending card. The dialog calculates only the number of ports, not which tile hangs on which port. The verdict appears next to the fields: *2 of 4 ports carry it*, *Not enough — 2 ports needed, 1 there* or, as long as nothing is entered, *Nothing recorded about the sending card — so nothing is claimed.*

![Four ports with 650,000 pixels](bilder/en/werkzeuge-bauen-led-10-sending-card.jpg)

![One port is not enough](bilder/en/werkzeuge-bauen-led-11-sending-card-knapp.jpg)

#### Building outlet

If the project contains a building record with outlets, the selection *Fed from (building outlet)* appears, defaulting to *not stated*. The continuous power then joins the load at that outlet; the peak gets its own finding.

#### Pixel map

*Pixel map as PNG* saves an image that is as large as the wall has pixels. The tiles are numbered row by row from the top left. The button is disabled without panels. The file is named `<date>_<project name>_<no.>_pixelmap.png`.

### Faceplate editor

*Tools → Faceplate editor…*

The faceplate editor places the connectors of a wall panel, a floor box, a stage box or a panel in millimetres and prints the label strip at 1:1. The connectors are the ports of the device, not a drawing of them: what you move is the same position the rack view reads.

1. Open *Tools → Faceplate editor…*. If the chosen device has no size in millimetres, it says *This device has no size in millimetres yet.* Without width and height there is no plate, and *Print 1:1* is disabled.

   ![Faceplate editor without a size](bilder/en/werkzeuge-bauen-frontplatte-01-offen.jpg)

2. Choose the *Device*. The selection lists all devices of the plan.

   ![Device chosen](bilder/en/werkzeuge-bauen-frontplatte-02-geraet-gewaehlt.jpg)

3. Under *Kind* choose what the device is: *Wall panel*, *Floor box*, *Stage box*, *Rack panel* or *Other*. *not a faceplate* removes the setting. The *Floor box* is a floor outlet: it passes through like a wall panel and connects like a connection point; the 3D view of the building lays it flat on the floor.

   ![Kind Wall panel](bilder/en/werkzeuge-bauen-frontplatte-03-art-wandfeld.jpg)

4. Enter *Width (mm)* and *Height (mm)* of the plate. Both values apply to the device.

   ![Size of the plate](bilder/en/werkzeuge-bauen-frontplatte-04-masse.jpg)

5. Every connector without a position appears in the table with the button *place*; it puts the connector in the middle of the plate.

   ![Connectors placed](bilder/en/werkzeuge-bauen-frontplatte-05-platziert.jpg)

6. Drag the connectors to their positions with the mouse. The table shows the position in millimetres from the top left (*Position (mm)*).

   ![Connectors moved](bilder/en/werkzeuge-bauen-frontplatte-06-verschoben.jpg)

7. For each connector enter the *Cutout (mm)* from the manufacturer's document; it appears as a dashed circle around the connector. The program does not guess the cutout. Without a cutout the connector is not checked against the others, and the findings say so.

   ![Cutouts entered](bilder/en/werkzeuge-bauen-frontplatte-07-ausschnitt.jpg)

8. *Grid (mm)* snaps dragged connectors to a grid; 0 or empty means free. *Strip (mm)* is the height of the strip holder; empty means no strip. *Print 1:1* prints the strip at original size.

   ![Grid and strip](bilder/en/werkzeuge-bauen-frontplatte-08-raster-streifen.jpg)

The findings appear under the table: *… sits outside the plate*, *… overlap by … mm* (both red), *… connectors have no position on the plate yet* and *… connectors carry no cutout size — they were NOT checked against each other.* For a pass-through panel (patch panel) there is also the field *On the plate* with *Inputs (n)* and *Outputs (n)*: only one side sits on the plate; position n in front is position n behind.

![Kind Floor box](bilder/en/werkzeuge-bauen-frontplatte-09-art-bodentank.jpg)

### Report editor

*Tools → Report editor…*

The report editor defines how a list looks: columns, order, grouping, sorting and filters. The table in the dialog is the content of the CSV file and of the printed sheet, not a preview of them.

1. Open *Tools → Report editor…*. At the top you choose the *List*; it is *Pull list* when you open it. *Group by* and the counter (*4 of 4 rows · 24 columns*) are next to it, and the buttons *CSV* and *Print* are on the right.

   ![Report editor with the pull list](bilder/en/werkzeuge-bauen-bericht-01-offen.jpg)

   There are 17 lists to choose from: *Pull list*, *Termination list*, *Cable schedule*, *Asset register*, *Network sheet*, *Spectrum plan*, *Delivery*, *Tally map*, *Handover to post*, *Faceplates*, *Signal paths*, *House run occupancy*, *Crossings (fire protection)*, *Defects and open items*, *Maintenance schedule*, *Configuration settings* and *Attachment index*.

2. Choose another list, here *Cable schedule*. The form changes with the list; it belongs to the list.

   ![Cable schedule chosen](bilder/en/werkzeuge-bauen-bericht-02-liste-gewaehlt.jpg)

3. The table *Column | Order | Sort | Filter* has one row per column. The checkbox before the name hides the column (the name appears struck through) or shows it again.

   ![Column *Standard* hidden](bilder/en/werkzeuge-bauen-bericht-03-spalte-aus.jpg)

4. The arrows under *Order* move the column up (*Move up*) or down (*Move down*).

   ![Column *Length (m)* moved forward](bilder/en/werkzeuge-bauen-bericht-04-spalte-verschoben.jpg)

5. *Sort* advances with each click: *ascending*, *descending*, *off*. Several columns sort in the order in which you switched them on; a hidden column sorts too.

   ![Descending by length](bilder/en/werkzeuge-bauen-bericht-05-sortiert.jpg)

6. Type a text into *Filter* (placeholder *contains…*); only rows whose cell contains it remain. The counter gives the rows, here *2 of 4 rows*.

   ![Filtered to Camera](bilder/en/werkzeuge-bauen-bericht-06-gefiltert.jpg)

7. *Group by* chooses a column; under the table the groups appear with their row count, for example *BNC (2)*. Without a value in the group column it says *not stated*.

   ![Grouped by type](bilder/en/werkzeuge-bauen-bericht-07-gruppiert.jpg)

8. Under *Save as template* enter a name, for example *Pull list without room*.

   ![Template name](bilder/en/werkzeuge-bauen-bericht-08-vorlage-name.jpg)

9. *with this project* stores the template in the project file; it travels with it. *for all projects* stores it in the installation; it applies to the next project. The templates of the chosen list appear below as chips with the suffix *project* or *global*. A click on the name loads the template; the wastebasket asks *Delete report template?* and removes only this saved view.

   ![Template saved](bilder/en/werkzeuge-bauen-bericht-09-vorlage-gespeichert.jpg)

10. *CSV* saves the table as a CSV file with a semicolon as separator, named after project and list. *Print* opens the sheet for printing. Both output exactly the rows and columns that the table shows.

    ![After saving as CSV](bilder/en/werkzeuge-bauen-bericht-10-csv.jpg)

If a list is empty in the project it says *This list has no rows in this project yet.*; if no row matches the filters it says *No row matches the filters.*

### Conductors and colour standards

*Tools → Conductors and colour standards…*

The dialog *Conductors, colour standards, connections and fibre polarity* has three tabs. No standard is built in: which colour assignment or polarity method applies to the installation is not something the program knows. A preset standard would look like a checked entry. You therefore enter the standard yourself, and every standard carries a source.

#### Tab Colour standards

1. Without an entry it says *No colour standard entered yet.* Without a standard the conductor colours stay unchecked; the plan check says so.

   ![Tab Colour standards without an entry](bilder/en/werkzeuge-bauen-adern-01-normen-leer.jpg)

2. *Enter colour standard* creates a standard *New colour standard*. The wastebasket deletes it after the question *Delete colour standard?*; connections that had chosen it are then left without a standard.

   ![New colour standard](bilder/en/werkzeuge-bauen-adern-02-norm-neu.jpg)

3. Enter the *Name of the standard* and the *Source (required)*, for example a regulation with edition and page, or "house standard, set by …". Without a source the field is red and the standard is discarded on the next load. Then enter the colour for each conductor: *L1*, *L2*, *L3*, *N* and *PE*.

   ![Colour standard filled in](bilder/en/werkzeuge-bauen-adern-03-norm-ausgefuellt.jpg)

#### Tab Connections (bundles)

A connection is a link that is pulled one conductor at a time: five lines make up a 400 A connection, for example. Enter which conductors it must have; only then can the plan notice that the fourth line is missing. A connection is not the same as the multicore name of a cable: the multicore name counts cables in one jacket as one piece, the connection defines which conductors must be present.

1. The tab starts empty; *Add connection* creates a connection.

   ![Tab Connections](bilder/en/werkzeuge-bauen-adern-04-anschluss-leer.jpg)

   ![New connection](bilder/en/werkzeuge-bauen-adern-05-anschluss-neu.jpg)

2. A connection has a name, the conductors *L1*, *L2*, *L3*, *N*, *PE* and *free* that it must have, the *Colour standard for this connection* (default *none chosen*) and a *Note (e.g. connector coding)*. The coding is in the manufacturer's document; it is entered, not guessed. The wastebasket asks *Delete connection?*; the lines remain and then belong to no connection.

   ![Connection filled in](bilder/en/werkzeuge-bauen-adern-06-anschluss-ausgefuellt.jpg)

#### Tab Fibre polarity

Here too no method is built in: TIA-568 knows the methods A, B and C, and they differ in where the fibres are crossed. Which one applies is in the installation document.

1. Without an entry the fibre direction stays unchecked.

   ![Tab Fibre polarity](bilder/en/werkzeuge-bauen-adern-07-polaritaet-leer.jpg)

   ![New method](bilder/en/werkzeuge-bauen-adern-08-polaritaet-neu.jpg)

2. Enter *Name of the method* and *Source (required)*. *This method crosses the fibres: TX at one end meets RX at the other.* switches the crossing on. *This method applies to this project.* chooses the method for the project. Deleting asks *Delete polarity method?*; if it was the chosen one, the fibre direction is unchecked again afterwards.

   ![Polarity method filled in](bilder/en/werkzeuge-bauen-adern-09-polaritaet-ausgefuellt.jpg)

### Received show-control messages

*Tools → Received show-control messages…*

The window keeps a transcript of incoming OSC messages. It is not a monitor of the installation: a line says that something arrived, not that anything is in order. An empty window therefore only means that nothing arrived here, not that nothing was sent.

1. At the top is the state of the listener: *Listener: off*, *Listener: listening — address:port* or *Listener: switched on, but not bound* with the reason. In the last case nothing arrives, even if someone is sending.

   ![Window with the listener switched off](bilder/en/werkzeuge-bauen-osc-01-offen.jpg)

2. Enter the *Address to listen on* and the *Port* (default 9000). There is deliberately no default for the address: one that listens on every interface would be a decision nobody made, even on the customer network. The setting belongs to the project. A loaded project file does not switch the listener on by itself.

   ![Address and port entered](bilder/en/werkzeuge-bauen-osc-02-adresse.jpg)

3. *Listen for this project* switches the listener on.

   ![Listener listening](bilder/en/werkzeuge-bauen-osc-03-lauscht.jpg)

4. Every message appears in the *Transcript* with address, time, sender and age, for example */cue/12/go at 06:29:01 from 127.0.0.1:57060 received (2 s ago)*, plus the size of the payload. The age keeps running so that an old line does not look like a current one.

   ![A received message](bilder/en/werkzeuge-bauen-osc-04-nachricht.jpg)

5. *Clear* deletes the transcript.

   ![Transcript cleared](bilder/en/werkzeuge-bauen-osc-05-geleert.jpg)

Below the transcript is the section *Read back Companion variable values*. It has no button that queries Companion: it names the command lines that you type into the TCP control of Companion, and takes the answers back through the field *Paste the answers here* with *Take as a reading*. Every reading carries the time of reading. As long as no device in the plan is switched through Companion, it says *No device in the plan is switched through Companion — there is no variable to read back.*

### Connect multiple cables

*Tools → Connect multiple cables…*

The dialog creates several cables in one go: port *i* of the source goes to port *i* of the target. Occupied target ports are skipped. It also opens from the command palette (Ctrl+K) and from the button *Connect cables* in the toolbar of the canvas when exactly two devices are selected; the two devices are then preset as source and target.

1. Open *Tools → Connect multiple cables…*. The dialog has the blocks *Source* and *Target*, below them *Cable count*, *Cable type* and *Length per cable (m)*.

   ![Dialog Connect multiple cables](bilder/en/werkzeuge-bauen-bulk-01-offen.jpg)

2. Under *Source* choose the *Device*, the *Side* (*Outputs* or *Inputs*) and the start port (*Start Output (1..n)*).

   ![Source chosen](bilder/en/werkzeuge-bauen-bulk-02-quelle.jpg)

3. Under *Target* choose device, side (*Inputs* or *Outputs*) and start port in the same way. The sides can be combined freely, even output to output, for example with a patch panel.

   ![Target chosen](bilder/en/werkzeuge-bauen-bulk-03-ziel.jpg)

4. Enter the *Cable count* (1 to 256; default 8). The *Preview* shows the pairs, up to 12; if there are more, the number of the rest appears. If the ports are not enough, the dialog warns *Count exceeds available ports — extras are skipped.*

   ![Count entered](bilder/en/werkzeuge-bauen-bulk-04-bereich.jpg)

5. Choose the *Cable type* from the catalogue including custom cable types, and the *Length per cable (m)*. The cable name is made from the two port names, the colour from the cable type.

   ![Cable type and length](bilder/en/werkzeuge-bauen-bulk-05-kabeltyp.jpg)

6. *Create 8 cables* creates the cables; the button names the number of pairs in the preview. If target ports have to be skipped, a message says how many cables were created and how many were skipped. The cables count as one step for undo. The status bar then shows the new cable count.

   ![Status bar after creating](bilder/en/werkzeuge-bauen-bulk-06-angelegt.jpg)

### Create new rack

*Tools → Create new rack…*

The entry opens the 2D rack builder with an empty rack and switches the library to the tab *Racks*. The builder assembles a rack from devices, shows it from the front, the rear, the side and in 3D, and saves it as a placeable group in the library. The cards on the tab *Racks*, editing saved racks and placing them on the canvas are described in the chapter [Library](#rack-builder); how a rack looks on the canvas is in the chapter [Canvas](#canvas).

The draft of a new rack is saved continuously; the footer shows *Autosave active* while there are unsaved changes, otherwise *Saved*.

1. Open *Tools → Create new rack…*. The header says *New rack* with the badge *New*, after the first change also *Unsaved*. On the right are *Export* and **×**.

   ![The empty rack builder](bilder/en/werkzeuge-bauen-rack-01-offen.jpg)

2. Enter the *Rack name* (required), the *Height (U)* (1 to 60) and the *Depth (mm)* (200 to 1500; default 800; common values are 350, 450, 600, 800, 1000 and 1200).

   ![Name, height and depth](bilder/en/werkzeuge-bauen-rack-02-kopf.jpg)

3. On the left is the *Library* with the number of hits. The search field *Search device…* filters by name; **×** in the field clears the search. Each card shows name, category and *n U · x In · y Out*.

   ![Searching for a device](bilder/en/werkzeuge-bauen-rack-03-suchen.jpg)

4. *+ Into rack* puts the device in the first free place. A device can also be dragged from the library into the rack; the place where it drops determines the start U and, in the view *Both*, the side. If the device is already in the rack, the button says *+ Add more*, and a counter *n×* shows how often it stands there.

   ![The device is in the rack](bilder/en/werkzeuge-bauen-rack-04-im-rack.jpg)

   The small arrow on the button opens the mount type: *Full-depth* (front + rear, default), *Front only* (*Front-mount*) or *Rear only* (*Rear-mount*, for example for a patch panel).

5. More devices are added in the same way. The footer counts how full the rack is: *Devices:* and *U occupied:*.

   ![Two devices in the rack](bilder/en/werkzeuge-bauen-rack-05-zweites-geraet.jpg)

#### Views

Above the rack are the tabs *2D* and *3D*. In the tab *2D* the buttons *Front*, *Rear*, *Both* and *Side* change the view; the zoom (**−**, percentage, **+**, *Fit*) works only in 2D. *Show connector symbols* shows or hides the drawn connectors in 2D and 3D.

1. *Rear* shows the rear.

   ![Rear view](bilder/en/werkzeuge-bauen-rack-06-hinten.jpg)

2. *Both* puts front and rear side by side.

   ![Front and rear view](bilder/en/werkzeuge-bauen-rack-07-beide.jpg)

3. *Side* shows the depth: each device is a strip from its front edge to its rear edge within the rack depth (*Front to rear: 800 mm*); the front and rear rails are marked.

   ![Side view](bilder/en/werkzeuge-bauen-rack-08-seite.jpg)

4. *3D* shows the rack spatially: rotate with the left button, pan with the right, zoom with the wheel; *Shift* moves the view up, *Space* down. The selection *View:* chooses *All* (all devices, free ports and patch panels), *Free ports* (only devices with free ports and patch panels) or *Released* (patch panels and externally cablable devices). The 3D view is read-only; editing happens in 2D.

   ![3D view](bilder/en/werkzeuge-bauen-rack-21-3d.jpg)

#### Special cases when filling a rack

- **Patch panel.** *+ Patch panel* opens *Create patch panel*. The tab *Basics* has *Name*, *Height (U)*, *Mount* (*Full-depth (front)*, *Front only*, *Rear only*), *Port count* (12, 16, 24, 32 or 48, or your own value), the checkbox *Adapter patch panel* (front and rear carry different connectors, with an internal adapter cable) and the *Connector type*. In the tab *Per-port detail (n)* label and connector can be overridden per port; empty means default. *Create patch panel* puts it in the rack.

  ![Dialog Create patch panel](bilder/en/werkzeuge-bauen-rack-09-patchblende-dialog.jpg)

  ![Tab Per-port detail](bilder/en/werkzeuge-bauen-rack-10-patchblende-ports.jpg)

  ![Patch panel in the rack](bilder/en/werkzeuge-bauen-rack-11-patchblende-angelegt.jpg)

- **Rack shelf.** *+ Rack shelf* opens *Create rack shelf* with *Name*, *Height (U)* and *Depth (mm)*. A shelf carries devices that are not 19 inch: put them on the same start U as the shelf, and in the view they stand on it.

  ![Dialog Create rack shelf](bilder/en/werkzeuge-bauen-rack-12-shelf-dialog.jpg)

  ![Shelf in the rack](bilder/en/werkzeuge-bauen-rack-13-shelf-angelegt.jpg)

- **Devices without a rack size.** With the checkbox *Include non-rack devices* the library also shows devices that are not marked as 19-inch devices; they carry the badge *No-HE*.

  ![Non-rack devices in the library](bilder/en/werkzeuge-bauen-rack-14-nicht-rack.jpg)

  When you add one, *Add "…"* asks for the type: *As 19″ device* (with *U height*) or *On a shelf* (with *Width (mm)*, *Height (mm)* and *Depth (mm)*; quick choices 1/3, 1/2 and 2/3 rack width). *Save dimensions to template permanently* remembers the answer so that it is not asked again.

  ![Question about the mount type](bilder/en/werkzeuge-bauen-rack-15-nicht-rack-dialog.jpg)

  ![Device in the rack](bilder/en/werkzeuge-bauen-rack-16-nicht-rack-hinzugefuegt.jpg)

#### Properties of a device in the rack

A double-click on a device in the rack opens *Properties · device name*. The window has *Name*, *Category*, *Height (RU)*, *Start RU* (with the maximum), *Depth (mm)*, *Mount* (*Full-depth*, *Front only*, *Rear only*), for half-width devices *Half (front view)* (*Left* or *Right*), *3D model (STL, optional)*, the sections *Depth position (Z)* and *Port side (front/rear)* and *Panel images (import + crop)*. At the bottom are *Remove from rack* (with a question) and *Close*.

![Properties of a device in the rack](bilder/en/werkzeuge-bauen-rack-17-eigenschaften.jpg)

- *Port side* defines per port whether it sits at the front or the rear; *all to rear*, *mirror* and *all to front* change all ports at once.
- *Pick STL…* takes a 3D model up to 5 MB; without a model the 3D view draws the device as a box with front and rear photo. *Remove* takes the model away again.
- The panel images can be imported, cropped (*Apply crop*), swapped (*Swap front/rear*) and removed.

![Lower half of the properties](bilder/en/werkzeuge-bauen-rack-18-eigenschaften-stl.jpg)

#### Conflicts

If two devices overlap, the box *Conflicts (n)* appears above the rack with the cases, for example *Luminex GigaCore 12 overlaps with Blackmagic Smart Videohub 12x12.* The footer gives the number as well (*n Conflicts*). Other cases: a device that is not marked as a rack device, a start U smaller than 1 and a device that no longer fits into the rack from its start U. Conflicts do not block saving; the rack is saved anyway.

![Two devices overlap](bilder/en/werkzeuge-bauen-rack-19-konflikt.jpg)

![Conflict resolved](bilder/en/werkzeuge-bauen-rack-20-konflikt-behoben.jpg)

![Back in 2D](bilder/en/werkzeuge-bauen-rack-22-2d.jpg)

#### Export, wiring and saving

- *Export* in the header offers four ways: *2D as PNG* (the current view), *3D from 4 perspectives* (PNG: front, rear, iso, top; the tab *3D* must have been opened beforehand), *3D as STL* (the whole rack as binary STL for 3D printing and CAD) and *Download .cpgroup* (the complete rack with STL and photos for transfer to another computer).

  ![Menu Export](bilder/en/werkzeuge-bauen-rack-23-export.jpg)

- *Wire internally* in the footer opens *Rack cabling: rack name*, a canvas view of the devices of the rack: drag lines from an output to an input; on the right the Inspector (*Properties (rack scope)*) shows the selected device or cable. *Done* returns to the builder. The button is active only when at least one device is in the rack. If there are internal cables, the footer gives their number (*n cables*).

  ![Rack cabling](bilder/en/werkzeuge-bauen-rack-24-intern.jpg)

- *Save rack* stores the rack as a new group in the library. It requires a name (*Please enter a rack name.*) and at least one device (*Please add at least one device to the rack.*). *Cancel* and **×** ask when there are unsaved changes (*Discard unsaved rack changes?*). When editing a saved rack the button is called *Save*.

  ![The saved rack on the tab Racks](bilder/en/werkzeuge-bauen-rack-25-gespeichert.jpg)

The field *Live-Preview* on the right shows the rack as *Black box on canvas* with *n devices · m internal cables*: this is how it appears on the canvas.

### Generate AI plan

*Tools → Generate AI plan…*

The dialog *AI plan generation* creates a draft from a description or completes the open plan from documents. Nothing is inserted without confirmation: a preview appears first. The request goes to the provider you chose under *Settings → Integrations → AI*; the recordings in this chapter show invented answers, no request leaves the computer.

1. Without a stored key it says *No AI API key set. Add a provider key under Settings → AI.* at the top, and *Generate* is disabled.

   ![Dialog without a key](bilder/en/werkzeuge-bauen-ki-01-ohne-schluessel.jpg)

2. **From a description.** Describe the installation under *Describe the system in plain language*, for example one camera over SDI into a switcher and the programme output to a recorder.

   ![Description entered](bilder/en/werkzeuge-bauen-ki-02-beschreibung.jpg)

3. *Generate* shows the preview: *Preview: 3 devices, 2 cables* with the list of the devices and their category, plus warnings, for example when a connection pointed to an unknown device. *Insert into plan* takes over devices and cables.

   ![Preview of the description](bilder/en/werkzeuge-bauen-ki-03-vorschau.jpg)

4. After inserting, the dialog closes; the status bar gives the new number of devices and cables.

   ![Status bar after inserting](bilder/en/werkzeuge-bauen-ki-04-eingefuegt.jpg)

5. **From documents.** *Choose files* or dropping files in the dashed field accepts block diagrams, IP lists, bills of materials and floor plans: PDF, Excel, CSV, images and `.cableplan`. The files appear with their size; **×** removes one again. All attachments together must not exceed 20 MB; otherwise it says *Together … — more than one request can carry. Send the documents in several rounds.* With documents the text field is called *Note for the AI (optional)*.

   ![Document attached](bilder/en/werkzeuge-bauen-ki-05-dokument.jpg)

6. *Complete plan* compares the documents with the open plan and delivers only what is missing: *Preview: 1 new rooms, 1 new devices, 0 cables, 0 devices completed* with the new rooms (+) and devices (•, with category and IP) and warnings. If the documents contain nothing new it says *The documents add nothing the plan does not already contain.*

   ![Preview of the completion](bilder/en/werkzeuge-bauen-ki-06-ergaenzung-vorschau.jpg)

7. *Insert into plan* takes over the completion.

   ![Status bar after the completion](bilder/en/werkzeuge-bauen-ki-07-ergaenzung-eingefuegt.jpg)

### Revisions & snapshots

*Tools → Revisions & snapshots…*

A revision stores a complete state of the plan under a name. Restoring keeps the history. The latest revision appears in the title block of the outputs, for an as-built revision with the suffix *(As-Built)*. You compare two states with *File → Compare plan revisions…*, see [Export and Print](#export--print).

1. Open *Tools → Revisions & snapshots…*. The section *Commit current state* has *Label* (for example "A" or "Rev 2"), *Note: what changed?* and the checkbox *As-built*. As long as no revision exists it says *No revisions committed yet.*

   ![Dialog without revisions](bilder/en/werkzeuge-bauen-revisionen-01-leer.jpg)

2. *Commit* creates the revision. Without a label it is called *Rev n*.

   ![First revision](bilder/en/werkzeuge-bauen-revisionen-02-festgeschrieben.jpg)

3. With the checkbox *As-built* you mark the state as it was built; the list marks it with *As-built*. The list is newest first, each row with label, note and time.

   ![As-built revision](bilder/en/werkzeuge-bauen-revisionen-03-as-built.jpg)

4. The arrow in the row (*Restore*) asks *Restore this state?*: the current plan is replaced by the revision, the history stays.

   ![Question when restoring](bilder/en/werkzeuge-bauen-revisionen-04-wiederherstellen.jpg)

5. The wastebasket (*Delete*) asks *Delete revision?*; the revision is removed permanently.

   ![Question when deleting](bilder/en/werkzeuge-bauen-revisionen-05-loeschen.jpg)

### Inventory / stock

*Tools → Inventory / stock…*

The entry appears when the rental module is switched on. The window manages your own equipment: items with quantity and price, storage locations and cases, individual serialised units, sets, the check-out of containers, QR labels and a report.

![Inventory / stock with the items of the plan](bilder/en/werkzeuge-bauen-lager-01-aus-plan.jpg)

Above the tabs is the field *Scan / type code (item, location, unit)…*. *Resolve* looks the code up; a hit reports *Item: …*, *Location: …* or *Unit: model · serial*, otherwise it says *No match for “…”.* The camera button (*Scan with camera*) reads the code with the camera. The footer gives the stock figures (*n items · m units · k locations · s sets*) and offers *Export* and *Import*: *Export* saves the inventory as a portable file (avplan-inventory) that other applications can read as well; *Import* reads such a file and asks *REPLACE the existing stock? “Cancel” merges instead.* with the buttons *Replace* and *Merge*. If the file is not an inventory, it says *Not a valid inventory file (avplan-inventory).*

#### Tab Items

An item is a model with a quantity. The list shows *Model*, *Quantity*, *Location / case*, *Code (QR/barcode)* and *Ownership*; the search field filters it. The pencil edits an item, the wastebasket deletes it after the question *Delete item?* When empty it says *No inventory items yet. Add some or import them from the plan.*

1. *Import from plan* creates an item for every device of the plan that does not exist yet; existing ones are not duplicated. A message then gives the number of new items. If the plan has no devices it says *No equipment in plan*.

2. *+ Item* opens the form *New item*.

   ![Form New item](bilder/en/werkzeuge-bauen-lager-02-artikel-formular.jpg)

3. Fill in the fields.

   ![Filled-in form](bilder/en/werkzeuge-bauen-lager-03-artikel-ausgefuellt.jpg)

   | Field | Meaning |
   |---|---|
   | *Model* (required) | Name of the item. |
   | *Manufacturer*, *Category* | Free text. |
   | *Quantity* | Number of pieces. |
   | *Rent price/day (€)* | Rent price per day; the report calculates with it. |
   | *Ownership* | *Owned*, *Rented* or *Sub-hire*. With the last two, *Return by* appears. |
   | *Location / case* | Choice among the locations; cases are marked with a package symbol. |
   | *Supplier* | Where the equipment comes from. |
   | *Country of origin* | For example DE, JP, US; it goes into the carnet sheet. |
   | *Code (QR/barcode)* and *Code type* | The code a label carries; *QR code* or *Barcode*. |
   | *Material type* | *Rental* or *Consumable*. |
   | *Dimensions (W×H×D · weight)* | Width, height and depth in mm and weight in kg. |
   | *Note* | Free text. |

4. *Save* creates the item.

   ![Item in the list](bilder/en/werkzeuge-bauen-lager-04-artikel-gespeichert.jpg)

Third-party equipment that has to go back is reported by a box above the list: *Third-party gear: n item(s) to return* with the rows *qty× model → supplier · due back since date* or *· no return date*.

#### Tab Locations

Storage places and cases are nodes in a tree; every node is scannable and can be nested at will: case in case in transport case.

1. *Locations (n)* shows the nodes. *+ Location* opens the form *New location* with *Name*, *Type* (*Depot*, *Room*, *Shelf*, *Bin / box*, *Case*, *Transport case*), *Parent* (*— root —* or another node), *Code (QR/barcode)*, *Code type* and *Dimensions (W×H×D · weight) — mainly for cases*.

   ![Tab Locations and form](bilder/en/werkzeuge-bauen-lager-05-lagerort-formular.jpg)

2. The row of a node offers *Stock-take at this location*, *Add child node*, *Edit* and *Delete*; *Delete* asks *Delete location?* — child nodes move up one level, the items lose their location. For a case, *Print pack list* and *Copy pack list (recursive)* are added; the copied list names everything in the case and its sub-cases.

   ![Depot with a case](bilder/en/werkzeuge-bauen-lager-06-lagerort-gespeichert.jpg)

3. The *Stock-take at this location* opens the field *Scan a code — a location label switches the location* under the node. Every scanned code is recorded as *expected here*, *in the wrong place* or as unknown; the row names the model and, where it differs, the expected location. Without a scanner, the list *Tick off without a scanner — expected here: n, still open: m* is ticked off (*here*); it records the row as *from the list*. *CSV* writes the sheet including the items not found, *Adopt location (n)* writes the location onto all objects that were in the wrong place.

#### Tab Units

Units are individual serialised copies of an item with their own serial number, code, condition and history. The buttons *Insurance* and *Carnet* at the top right produce the lists for the insurance and the carnet; they are disabled without units.

1. *+ Unit* opens the form *New unit*. Without items it says *Create items first, then you can serialize individual units.*

   ![Form New unit](bilder/en/werkzeuge-bauen-lager-07-einheit-formular.jpg)

2. Enter *Item model*, *Serial number (manufacturer)*, *House reference*, *Code (QR/barcode)* with *Code type*, the *Purchase price* (with *Currency* and *Bought on*), the *Insured value* (with *Currency* and *Value as of*) and a *Note*.

   ![Unit filled in](bilder/en/werkzeuge-bauen-lager-08-einheit-ausgefuellt.jpg)

3. A saved unit shows the condition (*OK*, *defective*, *in repair*, *retired*) with *Change condition*, *Change location*, *Report a fault* (with *Fault description*; *Record*) and the *History* of moves and repairs. The row counts open faults (*n open faults*); a fault is closed with *resolved*.

   ![Unit saved](bilder/en/werkzeuge-bauen-lager-09-einheit-gespeichert.jpg)

#### Tab Sets

A set is a logical kit of items. Its availability results from the scarcest component (*n× buildable*).

1. *+ Set* opens the form *New set* with *Set name* and the list *Components*: choose *Pick item…* and *Add*. Without an entry it says *No components yet.*

   ![Form New set](bilder/en/werkzeuge-bauen-lager-10-set-formular.jpg)

#### Tab Check-out

A container goes out as a whole; what lies in it follows through all levels. Only cases and transport cases can be checked out.

1. Choose the container under *— pick a container —*, enter *To (person, truck, client)* and optionally *Show (optional)* as well as *Handed out on* and *Due back*. The preview names which positions go with it (*n positions go with it: …*); an empty container reports *This container is empty — nothing would go out.*

   ![Container chosen](bilder/en/werkzeuge-bauen-lager-11-ausgabe-container.jpg)

2. *Check out* books the container out. Under *Out (n)* every container that has been checked out appears with recipient, number of positions and, if overdue, the mark *overdue*. Per entry the buttons offer *Move return date* (*New return date*; it counts how often it was moved), *Sheet* (the handover sheet), the signature *Sign out* or *Counter-sign return*, *Damage (n)* (*Record damage*), *Check in* and *Delete record*. When checking in, the window checks the label codes of the contents (*Check*); the *Return findings* name what is missing and what came back in addition. A counter-signature is possible only when the container is back; an existing signature cannot be overwritten. *CSV* above the list saves the checked-out containers; a list *Damage (n)* names recorded damage and, where it accumulates, to whom the equipment went.

#### Tab Labels

*Print QR labels — on A4 sheets (Avery/Zweckform) or continuous label printers. Only objects with a stored code.* Choose the *Source* (*Items with code*, *Locations / cases with code*, *Units with code* or *Contents of a case (recursive)* with the selection *Case / container*), the *Code type* (*Per code type (auto)*, *QR code* or *Barcode (Code128)*) and the *Format* (A4 sheets by Avery and Zweckform or continuous label printers). If the code does not fully fit on the label, the dialog names the formats it fits on. *First label position (partially used sheet)* skips labels already used. The counter gives *n labels · p page(s)*; *Print* produces the sheet. If the source contains no objects with a code, it says *No codes*.

![Tab Labels](bilder/en/werkzeuge-bauen-lager-12-labels.jpg)

#### Tab Reports

The report counts the inventory: *Item positions*, *Units (bulk)*, *Serialized* and *Rental vol./day (€)*, plus the distribution *By category*, *By location (root)*, *By ownership*, *By material type* and *Units by condition*. If items lack a rent price it says *n items without rental price — rental volume incomplete.*

![Tab Reports](bilder/en/werkzeuge-bauen-lager-13-auswertung.jpg)

### Device configuration

The tools of this group are in the *Tools* menu and at the device itself; the audio router of an ATEM opens via the Inspector. When you select an ATEM, Videohub, GreenGo or multiviewer device on the canvas, the Inspector shows, below the ports and the note, a card with the name of the detected device (for example *Blackmagic ATEM detected*) and the buttons of that device, and further down the section *Tools for this device* with the same entries as the menu.

![Card in the Inspector](bilder/en/werkzeuge-bauen-atem-audio-01-karte.jpg)

![Section Tools for this device](bilder/en/werkzeuge-bauen-atem-audio-02-werkzeuge.jpg)

All dialogs of this group work on the plan offline first. Connecting, reading and sending need a device on the network and the desktop app; without a connection the corresponding buttons are disabled. The recordings in this chapter show only the state without a connection; nothing is searched, connected or sent. Reading from the device never replaces the plan by itself: the state that was read appears next to the plan, with the number of differences, and only *Adopt into the plan* takes it over after a question; *Discard reading* leaves the plan as it is.

#### ATEM multiviewer layout

*Tools → ATEM multiviewer layout…*, in the Inspector *Configure multiviewer layout*

The dialog plans which source is in which window of the multiviewer outputs of an ATEM switcher.

1. The menu *Tools → ATEM multiviewer layout…* first opens the selection *ATEM multiviewer — pick device*. If the plan contains no ATEM switcher it says *No ATEM mixer in the plan. Add an ATEM from the library first — its multiviewer config will then be selectable here.* From the Inspector of a switcher the dialog opens directly with that device.

   ![Selection without an ATEM in the plan](bilder/en/werkzeuge-bauen-atem-mv-01-ohne-atem.jpg)

2. If there is an ATEM, the selection shows it (*Which ATEM mixer multiviewer do you want to configure?*). A click on the name opens the editor.

   ![Selection with an ATEM](bilder/en/werkzeuge-bauen-atem-mv-02-auswahl.jpg)

3. The editor is called *Multiviewer layout · device name*. At the top are the tabs *MV 1*, *MV 2* … for the multiviewers of the device; **+** (*Add multiviewer*) and **−** (*Remove last multiviewer*) change their number (1 to 4). The layout shows four quadrants; each window carries the name of its source and the ID.

   ![Editor with two multiviewers](bilder/en/werkzeuge-bauen-atem-mv-03-editor.jpg)

4. A click on a window opens the source selection. It has a search field (*Search…*), a field for any ID with *Apply* and the sources by group, each with name and ID. Without a connection it lists the inputs of the device and the usual internal sources (Black, Color Bars, Color 1 and 2, Media Player 1 and 2, Super Source, Program and Preview of ME 1 to 4, AUX 1 to 24); with a connection the sources of the switcher.

   ![Source selection](bilder/en/werkzeuge-bauen-atem-mv-04-quelle-waehlen.jpg)

   ![Source set](bilder/en/werkzeuge-bauen-atem-mv-05-quelle-gesetzt.jpg)

5. The small preview next to *Layout* switches each quadrant between one large window and four small ones (*1 → 4* and *4 → 1*). The ATEM layout is derived from it.

   ![A quadrant split into four small ones](bilder/en/werkzeuge-bauen-atem-mv-06-viertel.jpg)

6. The row *Model capabilities: device · n MVs · m layouts* expands: it shows which layouts the model knows and lets you change this by hand if the detection by device name is wrong. The boxes switch layouts (*Default*, *Program Top*, *Program Bottom*, *Program Left*, *Program Right*, *Top-Left Small*, *Top-Right Small*, *Bottom-Left Small*, *Bottom-Right Small*, *Grid (16 small)*, *Quad (4 big)*) on and off; *MV count:* (0 to 4) and *Max windows:* (0 to 32) set the numbers; *Reset override* returns to the detection. The setting is saved with the project.

   ![Capabilities expanded](bilder/en/werkzeuge-bauen-atem-mv-07-faehigkeiten.jpg)

7. The buttons at the bottom: *As PNG* saves the view of the current multiviewer as an image; *Save draft* writes the draft into the plan (the message *Saved* confirms); *Load from ATEM* reads the multiviewers of the connected switcher; *Push to ATEM* sends the draft. The last two are disabled without a connection; the status line then says *ATEM not connected.*, with a connection *ATEM connected — ready to push.* A change is kept only if you pressed *Save draft* or *Push to ATEM*.

   ![Draft saved](bilder/en/werkzeuge-bauen-atem-mv-08-entwurf-gespeichert.jpg)

#### ATEM audio routing

In the Inspector of an ATEM switcher: *Configure audio router*

The dialog *ATEM audio configuration — device name* plans the audio assignment of an ATEM offline. It reads and writes the profile XML of the ATEM software and changes only audio entries in it; all other sections of the profile are preserved.

1. Open the dialog via the Inspector of an ATEM switcher (*Configure audio router*).

   ![Empty audio dialog](bilder/en/werkzeuge-bauen-atem-audio-03-leer.jpg)

   Without a configuration it shows *ATEM audio routing* with two ways: *Load profile XML* reads an ATEM profile; the editor recognises whether it contains a crosspoint matrix or a classic mixer. *Matrix manual* creates a new matrix with the ATEM default inputs and 8 output busses; sources, outputs and mappings can then be edited freely.

   ![New matrix](bilder/en/werkzeuge-bauen-atem-audio-04-matrix.jpg)

2. The matrix shows the sources on the left (rows) and the outputs at the top (columns). A click on a cell routes the source to the output; a second click removes the crosspoint. A routed cell is green; an output that is occupied otherwise carries a dot. Next to the name of a source it says on how many outputs it lies (*×n*). The line above the matrix gives *n × m visible · k crosspoints*.

   ![Matrix with three crosspoints](bilder/en/werkzeuge-bauen-atem-audio-05-kreuzung.jpg)

3. *Filter sources…* and *Filter outputs…* hide rows and columns by a part of the text.

   ![Sources filtered](bilder/en/werkzeuge-bauen-atem-audio-06-filter.jpg)

4. *Source picker* and *Output picker* open a list with checkboxes: individual sources or outputs can be hidden, entire groups of same-named entries at once (*Show all*, *Hide all*). The button says how many are hidden. This only changes the view.

   ![Source picker](bilder/en/werkzeuge-bauen-atem-audio-07-quellen-auswahl.jpg)

5. *Reset all routings* asks *Reset all routings to "No Audio"?* and sets every output to *No Audio*. If the matrix exceeds 12,000 visible crosspoints, the dialog asks whether to draw it anyway (*Render anyway*); with the pickers it can be made smaller.

   ![Question when resetting](bilder/en/werkzeuge-bauen-atem-audio-08-zuruecksetzen.jpg)

6. The buttons at the top: *Load XML* and *Save XML* (the changed profile as a file, with a provenance sheet next to it), *Read (offline)* or *Read from ATEM* and *Send (offline)* or *Send to ATEM*. Sending takes effect immediately on the switcher and is not stored as startup state; for that *Save Startup State* has to be triggered in the ATEM software. At the bottom *Save in project* writes the matrix into the plan and closes the dialog; *Cancel* discards it.

#### ATEM input labels

*Tools → ATEM input labels…*, in the Inspector *Connect ATEM / push setup*

The dialog *ATEM live integration* enters the names of the inputs: it connects to the switcher over UDP and writes the port names of the plan as long and short names.

1. The window starts with the *ATEM IP address* and the buttons *Search* (looks for ATEM switchers on the local network via mDNS) and *Connect*. Below is the *Event log (n)*.

   ![Dialog ATEM live integration](bilder/en/werkzeuge-bauen-atem-labels-01-offen.jpg)

2. After connecting, the dialog shows model and number of M/E and AUX and the table *Input names (n)* with *ID*, *Type*, *Live (long / short)*, *New long (max 20)* and *New short (4)*. The new names are preset from the port names of the plan, for inputs with the bound source (role). The long name has at most 20 characters, the short name 4. *Send n changes* writes only the changed rows. Media players, audio inputs (XLR, RJ45 talkback) and internal sources (Black, Bars, Color, SuperSource) are not overwritten; their rows are locked. The names go into the working memory of the switcher; to survive a restart, *Save Startup State* has to be triggered in the ATEM software. With an existing connection, *MV Layout →* leads to the multiviewer layout.

#### Videohub routing / labels

*Tools → Videohub routing / labels…*, in the Inspector *Configure Videohub · Labels + Routing*

The dialog *Configure Videohub · Labels + Routing* plans labels and crosspoints of a Blackmagic Videohub and outputs them as a file or directly to the hub.

1. Choose the *Device on the canvas* and the *Videohub model*. The list names the models from *Micro Videohub 16x16* to *Universal Videohub 288* with their size; the last entry of the list (a custom size) asks for *Inputs* and *Outputs*. If the device has more ports than the model, the dialog warns that surplus ports are truncated.

   ![Dialog Videohub](bilder/en/werkzeuge-bauen-videohub-01-offen.jpg)

   ![Another model chosen](bilder/en/werkzeuge-bauen-videohub-02-modell.jpg)

2. *File export format* chooses what the preview and the file contain: *Full routing dump (Protocol 2.5)* or *Labels only (Input, n, name)*. It affects only the file; direct sending is independent of it. *Friendly Name* is the name of the hub in the dump; in the format *Labels only* it is ignored.

3. The *Routing view* shows the crosspoints. *Matrix* is the crosspoint matrix, *List* a list with a selection per output. A click on a crosspoint routes the output to that input. *Swap Out·In* swaps the axes; *Cabling on* or *off* shows after the names the device that hangs on the port (*← device*), and *Input label on*/*off* adds the port name. Row and column sizes can be dragged as in Excel (*Reset layout*). If the matrix is too large for the matrix display, the dialog switches to the list by itself.

   ![List view](bilder/en/werkzeuge-bauen-videohub-03-liste.jpg)

   ![Matrix with swapped axes](bilder/en/werkzeuge-bauen-videohub-04-matrix.jpg)

4. *Smart routing* suggests a routing from the cables in the plan: per output the input with the most similar device name, otherwise diagonal. *Reset* restores the diagonal (output n to input n).

   ![After smart routing](bilder/en/werkzeuge-bauen-videohub-05-smart-routing.jpg)

5. *Salvos (routing snapshots)*: *+ Save current routing* asks *Salvo name (= save routing snapshot):* and stores the state; a click on the name recalls it, **×** (*Delete salvo*) removes it. Salvos belong to the device and the model and are stored locally.

   ![Name for the salvo](bilder/en/werkzeuge-bauen-videohub-06-salvo.jpg)

   ![Salvo saved](bilder/en/werkzeuge-bauen-videohub-07-salvo-gespeichert.jpg)

   With two salvos the row *Changeover from — pick a set — to — pick a set —* appears. It calculates the difference of two salvos: *n of m crosspoints change.* (or *No difference — nothing to re-patch for this changeover.*). *Changeover sheet* saves the changed crosspoints as CSV, *Full set* all crosspoints of the chosen salvo.

6. *Send to Videohub (TCP)* connects only when you press a button. The fields *IP address* and *Port* (default 9990) take the address; the arrow next to it names the recently used connections. *Search* looks for hubs via mDNS, *Load status* fetches labels, routing and locks from the hub. *Send labels*, *Send routing* and *Send labels + routing* send only what is chosen. After reading, the dialog compares the routing of the hub with the plan (*Routing matches the plan.* or *n crosspoint(s) differ from the plan* with *adopt into the plan*); it counts locked outputs (*n outputs locked*). The *Activity log* names the latest send attempts.

7. At the bottom the *Preview* shows the content of the file. *To clipboard* copies it, *Save as file* writes the `.txt` file; next to the file a provenance sheet with the ending `.herkunft.txt` is created that names project, state and a checksum. In the format *Labels only*, *Import Labels.txt* reads a labels file (for example from Videohub Setup) and writes the names onto the ports of the device; *Labels PDF* produces printable label strips in the Smart Control grid.

   ![Format Labels only](bilder/en/werkzeuge-bauen-videohub-08-nur-labels.jpg)

#### GreenGo intercom

*Tools → GreenGo intercom…*, in the Inspector *Intercom planning / export .gg5*

The dialog *GreenGo Intercom planning* plans a Green-GO system: stations, talk groups and the assignment between them. It exports a `.gg5` file that is loaded into the Green-GO software. Under the title is the system name.

1. The tab *Overview* is empty as long as there are neither stations nor groups (*No stations or groups yet — switch to the "Stations" and "Groups" tabs.*). At the bottom are *GreenGo devices on the canvas* with the hint *unassigned*.

   ![Empty overview](bilder/en/werkzeuge-bauen-greengo-01-uebersicht-leer.jpg)

2. In the tab *Stations (n)*, *+ Station* creates a station (up to 12). Enter the name (placeholder *Station name (e.g. control room)*) and assign a device on the canvas (*— Device —*).

   ![Two stations](bilder/en/werkzeuge-bauen-greengo-02-stationen.jpg)

   ![Stations named](bilder/en/werkzeuge-bauen-greengo-03-stationen-benannt.jpg)

3. In the tab *Groups (n)*, *+ Group* creates a talk group (up to 9) and gives the number of members.

   ![Group CAM](bilder/en/werkzeuge-bauen-greengo-04-gruppen.jpg)

4. The *Overview* is the matrix of stations and groups: a click on a circle adds the station to the group or removes it; the row *Members* counts per group. For each station the column *Device (canvas)* chooses the device; *— unassigned —* means no device.

   ![Overview with group assignment](bilder/en/werkzeuge-bauen-greengo-05-uebersicht.jpg)

5. The tab *System* has *System name*, *Description*, *Multicast address* (default 239.1.160.1, must be unique on the network) and *Sample rate* (*32000 Hz (GreenGo default)* or *48000 Hz*).

   ![Tab System](bilder/en/werkzeuge-bauen-greengo-06-system.jpg)

6. The footer gives *n stations · m groups* and the number of devices on the canvas and offers: *Import .gg5* (reads a `.gg5` and links its stations to devices on the canvas), *Import Excel matrix* and *Export Excel matrix* (users and groups as an Excel matrix, also for printing), *Import neutral* and *Export neutral* (a vendor-neutral intercom file with stations, conferences and who talks or listens), *Save in project* and *Export as .gg5*. Without at least one station or group no valid `.gg5` is produced (*Without at least one station or group there is no valid .gg5 — create one first.*). Outputting the file also writes a provenance sheet (`.herkunft.txt`).

   ![Export of the files](bilder/en/werkzeuge-bauen-greengo-07-export.jpg)
