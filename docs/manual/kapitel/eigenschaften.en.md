## Inspector

The inspector is the right-hand side panel. It shows the properties of the selection: a device, a cable, a frame or a library template. The header names the selection, for example *Device: Camera 1*, *Cable: CAM 1 → mixer* or *Frame: Control room*.

### Nothing selected

![Inspector with nothing selected](bilder/en/eigenschaften-01-nichts-ausgewaehlt.jpg)

With nothing selected the inspector shows:

- *Nothing selected* with the hint to pick a device, cable, frame or library template.
- *Photos of the project*: photos that belong to the whole plan rather than to one device. *Add photo…* opens the file picker. Each photo shows its size and source (*from the planner* or *from the phone*) and has a *Note* field.
- *Quick orientation* with four hints: drop devices from the library on the canvas, connect ports to create cables, select multiple devices and save them as a group from the canvas, Rentman actions live in the Equipment tab under Rentman.

![Project photo added](bilder/en/eigenschaften-02-projektfoto-hinzugefuegt.jpg)

The *Window* button at the top offers *Undock (floating)* and *Open in its own window*; the arrow next to it collapses the inspector. Both are described in [Arranging the side panels](#arranging-the-side-panels).

![Window menu of the inspector](bilder/en/eigenschaften-04-fenstermenue-offen.jpg)

### Device properties

Clicking a device on the canvas shows its properties.

![Device selected](bilder/en/eigenschaften-07-kamera-gewaehlt.jpg)

In viewer mode and in a finalised plan the fields are locked; the inspector says so at the top. A finalised plan becomes editable again via *Re-enable editing* in the canvas banner. Filtering, expanding and collapsing still work.

Fixed at the top, in this order: name, short name, subtitle, *Inputs & outputs* and *Note*. The collapsible sections follow below. Which sections appear depends on category, device and enabled modules.

#### Filtering, expanding and collapsing sections

- The *Filter sections …* field hides every section whose title, subtitle or identifier does not contain the search text. Matching sections expand. The × clears the field.
- *Collapse all* collapses every section, *Expand all* expands them.

![Filter “dmx”](bilder/en/eigenschaften-35-filter-dmx-getippt.jpg)

![All sections collapsed](bilder/en/eigenschaften-37-alle-zugeklappt.jpg)

#### Reordering sections

Sections with the ⠿ handle can be dragged to another position. The order applies to all devices and is remembered. Name, short name, subtitle, *Inputs & outputs* and *Note* are fixed and have no handle.

#### Name, short name, subtitle

| Field | Effect |
|---|---|
| Name | name of the device in the plan |
| Short name | short form for port and endpoint labels; without your own entry it is derived from the name (*auto*). The pencil opens the field; *auto* restores the derived short name |
| Subtitle | optional line under the name on the node, e.g. “PGM Monitor” |

![Editing the short name](bilder/en/eigenschaften-10-kopf-kurzname-stift.jpg)

#### Inputs & outputs

The section has two lists, *Inputs* and *Outputs*. The header counts them, e.g. *0 In · 1 Out*.

![Inputs & outputs](bilder/en/eigenschaften-15-ports-abschnitt.jpg)

1. *+ Port* creates a port in the list.

   ![Input added](bilder/en/eigenschaften-16-ports-eingang-hinzu.jpg)

2. Enter number and name and choose connector type and signal standard.

   ![Port with BNC](bilder/en/eigenschaften-18-ports-anschlusstyp-bnc.jpg)

3. Further fields per port:

   | Field | Values |
   |---|---|
   | Content / function | free text, e.g. “PGM” |
   | Direction | Direction (auto), Input only, Output only, Bidirectional (e.g. network) |
   | Side | Side (auto), Left, Right |
   | Gender | Gender (–), ♂ Male / plug, ♀ Female / socket |
   | Group | — None —, existing groups, *+ New group…* |

   ![Signal, content and direction](bilder/en/eigenschaften-19-ports-signal-inhalt-richtung.jpg)

4. For SDI ports, *SDI capabilities (port-specific)* expands: *Max single-link* overrides the device value for this port; *Quad-link set* and *Dual-link set* combine ports into a set (*+ New set…*). A new set reports how many ports are already assigned to it.

   ![SDI capabilities](bilder/en/eigenschaften-20-ports-sdi-faehigkeiten.jpg)

A group combines ports that belong together. Its kind is stereo (L/R), M/S, sum (A/B), bridged (+/-), Powerlock set (L1/L2/L3/N/PE) or other; each port picks its role in the group, for stereo L or R.

Fibre ports additionally show *Breakout* (DUO (2), QUAD (4)) with one row per fibre (TX (sending), RX (receiving), not stated, *Add fibre*) and the SFP module with connector (LC, SC, ST, FC, E2000, MPO-MTP, opticalCON, LEMO) and fibre class (OM1–OM5, OS1, OS2).

An entry at the end of the connector type list creates a new connector type; the app asks for its name. The × deletes a port.

The ≡ handle in front of *Inputs* and *Outputs* swaps the two lists; *Flip ports (inputs on right, outputs on left)* puts the inputs on the right side of the node.

![Mirrored node on the canvas](bilder/en/eigenschaften-33-ports-spiegeln-canvas.jpg)

#### Note

Free field for anything that has no field of its own, such as web interface, firmware or location.

#### Rentman notice and category

With the Rentman module enabled and the device missing from the linked Rentman plan, the inspector shows *Not tracked in Rentman plan*. Below it, *Category* picks the kind of device; *+ New category…* creates your own. The section *Specs — <category>* shows the fields of that kind, for monitors panel type, HDR, brightness, frame rate and colour space.

![Category data of a monitor](bilder/en/eigenschaften-147-monitor-spezifikation.jpg)

#### Optional fields

![Optional fields](bilder/en/eigenschaften-41-opt-offen.jpg)

| Field | Effect |
|---|---|
| Verify as correct | confirms with your name that the ports are correct; the number of confirmations is shown next to it |
| Rental price / day | price with currency |
| Manufacturer link | address of the datasheet; *Open* opens it |
| Price / rental (€) | value for the quote export |
| Reference image | image, e.g. of the port layout |
| Icon | glyph or emoji on the node, at most 2 characters; empty means automatic |

![Verified](bilder/en/eigenschaften-44-opt-verifiziert.jpg)

#### Photos

*Add photo…* attaches a photo to the device. If the device has a device type from the library, the app asks *Also use for the device type?*. With *Also for the device type* the photo shows on every device of this type in the plan and is stored only once; *Only this device* attaches it here only. The section then shows two lists: *This device* and *Device type* with the number of devices of that type.

![Photo on the device](bilder/en/eigenschaften-50-fotos-hinzugefuegt.jpg)

#### Display & flags

![Display & flags](bilder/en/eigenschaften-52-flags-offen.jpg)

| Field | Effect |
|---|---|
| Compact display | node shows only icon and name, ports as dots |
| Device colour | colour of the node; *Reset* resets it |
| Packed / pack status | marks the device as packed: ✓ on the canvas and a column in the device BOM |
| Converter (patch list follows pass-through cable) | the patch list skips the device and shows the next real target |
| Patch panel (through-path follows the position) | input and output at the same position count as connected through |
| Distribution amp (1→N) | one input is split to several outputs of the same source |
| Timecode | —, Source, Sink |
| Tally | —, Source, Sink |
| Embedding | —, Embedder, De-embedder |

![Compact node](bilder/en/eigenschaften-54-flags-kompakt-canvas.jpg)

#### Signal source (role)

A role is the editorial name of a source, e.g. “Camera 1”. It survives a device swap. *Role* picks an existing role or *Create new role from device name…*. A role has an editorial name, a number and a TSL UMD address; *Rename* and *Discard* change the name, *Delete role* releases all bindings.

![Signal source](bilder/en/eigenschaften-60-quelle-offen.jpg)

#### Network & access

![Network & access](bilder/en/eigenschaften-66-netz-adresse-kennungen.jpg)

| Field | Contents |
|---|---|
| IP Address, Subnet mask, Gateway, VLAN ID, MAC address | network data of the first interface |
| Serial number, Asset tag, Internal number | identifiers of the device |
| Unit from stock | the specific unit standing in this place |
| Username, Password | login of the device |
| Role of the first interface | Media primary, Media secondary, Control, Management, not stated |
| Additional network interfaces | *Add* creates further interfaces, each with role, switch, PTP profile (ST 2059-2, AES67, IEEE 1588 default) and PTP role (Grandmaster, Boundary clock, Slave) |

Username and password are stored in the project file. The app removes them on export and when sharing.

![Additional interface](bilder/en/eigenschaften-70-netz-schnittstelle-hinzu.jpg)

#### Streams

Streams this device sends or receives. User name, password or passphrase in an address are taken out and kept in this computer's keychain, never in the plan.

1. *Add stream* creates an entry.
2. Choose protocol (RTSP, SRT, RTMP, NDI, NDI-HX, HLS, MJPEG, WebRTC, WHIP, WHEP, RTP, ST 2110, Dante, AES67, Other) and direction (*Sends*, *Receives*, *Sends and receives*), then label, address, preview address, port, codec and format.

   ![Stream entered](bilder/en/eigenschaften-74-streams-gefuellt.jpg)

3. Options:

   | Element | Effect |
   |---|---|
   | Show a still image under the device on the canvas | shows the preview image on the node |
   | Live view | plays the stream while it is open |
   | Scopes | shows waveform and vectorscope of the stream live; *Large scopes* shows waveform, vectorscope, parade and histogram in one large panel |
   | Show live waveform under the device on the canvas | shows the waveform on the node |

The desktop app plays RTSP, RTMP, SRT, HLS and MJPEG (needs ffmpeg), the browser HLS, MJPEG and WebRTC (WHEP). The address must be on the local network; at most four streams run at the same time. When it cannot play, the view names the reason.

#### Lifecycle / maintenance

Appears when the Fixed installation or Rental module is enabled.

![Lifecycle](bilder/en/eigenschaften-76-lebenszyklus-offen.jpg)

| Field | Values |
|---|---|
| Status | — no status —, Planned, Installed, Tested, Operational, Fault, Retired |
| Warranty until | date |
| Maintenance interval (days) | number |
| Ownership (Rental only) | — n/a —, owned, rented, sub-hire |
| Purchase date, Storage location, Supplier (Rental only) | date or text |
| Service history | entries with date, kind (Installation, Inspection, Repair, Replacement, Note), text and author; *Add* creates one |

![Service history](bilder/en/eigenschaften-79-lebenszyklus-historie.jpg)

#### Optics (MultiCam plan)

For cameras from a MultiCam plan this section shows, read-only: lens, focal range, set focal length, extender, horizontal field of view, lens and body mount, height, pan, tilt and a table of presets. The values are set by the MultiCam planner; the next camera import updates them.

#### Controllable functions

For cameras the section lists, per control function (pan and tilt, zoom, focus, iris, gain, shutter, ND filter, white balance, colour temperature, red and blue gain, detail, recall and store preset), whether the model supports it. *not on record* means nobody has checked it.

![Controllable functions](bilder/en/eigenschaften-81-kamerasteuerung.jpg)

#### Controlled via

For devices whose control interfaces the app knows (for example cameras with VISCA or AW protocol, HyperDeck, KUMO), this section shows, read-only, per interface: protocol, transport (serial, SDI or IP), connector, baud, format, pinout, flow control, multidrop, network port and, for a network bridge, mode, port and packets. Details not found in the manufacturer documentation are marked *Not in manufacturer documentation*. *Source* links to the documentation.

#### Camera control (bridge)

For cameras this section sits below the interfaces. A camera head is driven by the LZ Camera Bridge, a process in the control room. The section tells it how to reach the head, sends it the room and shows what it reports. The line beside the title gives the state: *not on the bridge yet*, *bridge slot n* or *bridge slot n · online*.

![The section Camera control](bilder/en/kamerasteuerung-02-abschnitt.jpg)

| Field or button | Meaning |
|---|---|
| *Bridge (room)* and *Port* | Address of the bridge in the room; the port is set to 9700. They apply to the whole project. |
| *Connect* / *Disconnect* | builds up or tears down the connection; the state beside it reads *bridge connected* or *bridge not connected*. *Connect* stays disabled while no address is entered. |
| *Control path* | how the bridge reaches this head: *– not declared –*, *Not remote-controlled*, *VISCA over IP*, *HTTP-CGI (Vissonic / PTZOptics, Sony SRG)*, *Panasonic AW PTZ*, *BirdDog*, *JVC ConnectedCam*, *Canon CCAPI*, *Blackmagic REST*, *Z CAM*, *Panasonic Lumix*, *Sony Monitor & Control*, *Sony CCU (700PTP)*, *VISCA RS-232 (at the bridge)*, *Sony RS-422 (at the bridge)*, *Sony USB (at the bridge)*, *DJI Ronin gimbal* and *DJI Osmo Pocket gimbal* |
| *Firmware family* | only for *HTTP-CGI*: *Vissonic / PTZOptics* or *Sony SRG / BRC* |
| *Control port* | port of the head; empty means *auto* |
| Hint line | the IP address comes from the section *Network*; without it the line reads *no IP address yet — set it in the Network section* |

![List of control paths](bilder/en/kamerasteuerung-05-steuerweg-liste.jpg)

![Control path HTTP-CGI with firmware family](bilder/en/kamerasteuerung-06-steuerweg-http-cgi.jpg)

*Send room to bridge* works while the connection exists. It replaces the bridge's cameras with the cameras of this plan, with address, control path, stream, heading and shots. The bridge connects them itself and keeps them across restarts. Afterwards it says *n camera(s) sent*; cameras without an IP address or without a control path appear under *left behind:*. Each camera sent gets its slot number from the bridge.

If the camera has a slot and the bridge is connected, these come in addition:

- *head online* or *head offline* with the button *Connect head*, the tally *PGM* or *PVW*, the pose (*pan … ° · tilt … °*, and the zoom share if there is one) and *Read pose*;
- *Show live picture from the bridge*, provided the slot has a stream address;
- a cross: holding drives, releasing stops; *⌂* drives to the home position. There are also keys for zoom and focus (*T/W* zoom, *N/F* focus) and *AF*;
- the *Zoom curve* with *Record point* (focal length in mm, read off the lens) and *Clear curve*;
- *Planned shots*: per shot *Recall* (the preset stored in the head), *Drive* (the planned pose) and *Head is here* with a following confirmation, which makes the difference to the plan the offset of all shots. *Store all shots in head* needs a second click to confirm; *Clear offset* takes the offset away again.

#### Video wall

*Video wall (live pictures)…* in the section *Camera control (bridge)* opens the dialog *Video wall*. It shows the live pictures of all cameras of this plan that have a slot on the bridge, as tiles. The window has no menu entry.

![The dialog Video wall without a bridge](bilder/en/kamerasteuerung-03-videowand.jpg)

At the top right are the address of the bridge with the state (without an address: *no bridge address in this project*) and the button *Reload pictures*. Without a camera on the bridge it says *No camera of this plan is on the bridge yet. Open a camera, set its control path and stream, and send the room to the bridge.* Each tile carries *CAM n* at the bottom, the device name and, with tally, *PGM* or *PVW*; the top edge colours for program and preview. If the camera lacks a stream address, it says *no stream address*, if it is not on the bridge, *not on the bridge*. Up to four tiles stand in two columns, up to nine in three, more in four.

#### Power consumption

Fields voltage (V), current (A) and power (W). When voltage and current are set, the app computes the power (P = U × I).

![Power consumption](bilder/en/eigenschaften-83-strom-werte.jpg)

#### Circuit (mains)

*Role in the circuit* defines what the device counts as in the mains diagram: none, Feed, On/off switch, Two-way switch, Intermediate switch, Dimmer, Luminaire, Junction / box, Power distro, Push button, Contactor, Relay, Emergency stop, RCD, Circuit breaker. Each connector is then assigned to a terminal of that role. The terminal belongs to the connector, not to its position in the list.

![Circuit role](bilder/en/eigenschaften-85-stromkreis-rolle.jpg)

#### Adapter

*This device is an adapter* opens the fields:

| Field | Values |
|---|---|
| Side facing the source, Side facing the sink | connector types |
| Direction | one direction only, both directions, not declared |
| Power | passive, active with own supply, active powered by the source, not declared |
| Passes at most | highest signal standard |
| Requires at the source | capability the source device must list under *Can* |
| Note | text |

*Can* lists the capabilities a device declares. Empty means “not declared”, not “cannot”.

![Adapter filled in](bilder/en/eigenschaften-89-adapter-gefuellt.jpg)

#### DMX

*This device is addressed via DMX* opens manufacturer, model, the list of modes, and universe and address. *+ Mode* creates a mode with name, channel count and source (Manual, GDTF file, Console patch, Read off the device, Estimate). With a mode chosen, the header shows mode, channel count and address. *Keep this address* protects the address from automatic assignment.

![DMX filled in](bilder/en/eigenschaften-94-dmx-gefuellt.jpg)

#### House connection

*Load building file…* reads an `.avfacility` file from the building tool. *House outlet* then picks an outlet or feed of the building; the app shows fuse, continuous rating and whether the outlet is switched or dimmed. *Control address* links an address of the building, such as KNX or DALI.

![House connection assigned](bilder/en/eigenschaften-98-haus-zugeordnet.jpg)

#### Format profile (sink)

*For this device it is declared which formats it accepts* opens the profile. *Source (required)* says where the statement comes from; without a source the app discards the profile on the next load. *+ Format* adds a row: format, bit depth (8, 10, 12 bit), colour format (RGB, YCbCr 4:4:4, 4:2:2, 4:2:0) and dynamic range (SDR, HDR10, HLG, Dolby Vision). Without a profile the plan says “not declared”.

![Format profile](bilder/en/eigenschaften-101-senke-format-hinzu.jpg)

#### Dimensions

Width, height and depth in mm. The header shows the dimensions.

![Dimensions](bilder/en/eigenschaften-104-masse-gefuellt.jpg)

#### Operating modes

An operating mode is a port layout of its own.

1. *+ New mode (editor)* opens *New operating mode* with name, description, power and weight in this mode and separate input and output lists (*+ Port*). *Adopt current device layout* copies the device's ports. *Create mode* saves.

   ![New operating mode](bilder/en/eigenschaften-107-modi-editor-gefuellt.jpg)

2. *+ Save from current layout* creates a mode from the current ports; the app asks for a name.
3. Per mode, *Editor* opens the dialog and *Capture ports* sets the mode's layout on the device. Deleting a mode keeps the ports on the device.

![Modes](bilder/en/eigenschaften-112-modi-liste.jpg)

#### Library

*Save as new default template* overwrites, after confirmation, this device's template in the library. *Save as new device in library* asks for a name and creates a new template.

![Library](bilder/en/eigenschaften-115-bib-speichern-offen.jpg)

#### Catalogue & source

Links the device to a model in the built-in catalogue; datasheet link, stock matching and BOM use it. *Choose manually* opens a list of all catalogue models.

![Catalogue choice](bilder/en/eigenschaften-119-katalog-manuell.jpg)

#### Replace device

*Choose another device…* opens a list of the library with category filter and search. After the choice the app shows how many cabled connections exist and how many inputs and outputs it maps. *Replace* swaps the device and keeps the cabling.

![Confirm replace](bilder/en/eigenschaften-124-ersetzen-bestaetigung.jpg)

#### Print / documentation

| Button | Effect |
|---|---|
| Device datasheet (A4)… | opens this device's datasheet |
| Print patch sheet (A4 PDF) | prints the A4 patch sheet |
| Print patch sheet (A3 PDF) | prints the A3 patch sheet |

The device datasheet is one A4 page. It is divided into photos, general, technical data, category data, operation and tables; each field has a check box. *Filled ones*, *All* and *None* set the check boxes; *Print* and *Save PDF* output the sheet.

![Device datasheet](bilder/en/eigenschaften-126-datenblatt-dialog.jpg)

#### Switching (signal path)

On devices with inputs and outputs, such as mixers and routers, this section defines per output which input sits on it. The header counts the planned outputs.

![Switching](bilder/en/eigenschaften-132-schaltung-kreuzpunkt.jpg)

*Control protocol* decides where the switching goes:

| Protocol | Extra fields |
|---|---|
| none — nothing will be sent | none |
| Blackmagic Videohub | target; switch *ATEM input names follow this Videohub's routing* |
| Blackmagic ATEM | target; numbers on the device per input and output (program, preview, aux) |
| Bitfocus Companion | Companion IP, port, *Fetch connections*, page, row, column and two variables for output and input |
| Documented text protocol | command line from the device manual, line start, line end, counting start, numbers, level, acknowledgement, port and templates such as Quartz / Evertz; a preview shows the line sent |

*Target* is the system (the device on the network) or the test bench (emulator).

![Text protocol with template](bilder/en/eigenschaften-135-schaltung-text-vorlage.jpg)

With *ATEM input names follow this Videohub's routing* switched on for a Videohub, the section lists each hub output that ends at an ATEM input via cables. *Start following* keeps the connection to the hub open; on every switch the ATEM input takes the name of the new hub source (long name up to 20 characters, short name 4 characters). Only names are written. Desktop app only.

#### Rack / 19" settings

*Is a 19" rack device* opens height in RU, *View* (Front only, Rear only, Front + rear), *Import front graphic + crop*, *Import rear graphic + crop* and a 2D preview with the ports.

![Rack settings](bilder/en/eigenschaften-141-rack-hoehe-ansicht.jpg)

#### Display

For monitors: resolution and diagonal in inches.

![Display](bilder/en/eigenschaften-146-monitor-anzeige-gefuellt.jpg)

#### Several devices selected

The inspector always edits one device. Actions for several selected devices, such as saving them as a group or aligning them, are on the canvas.

### Cable properties

Clicking a cable shows its properties.

![Cable selected](bilder/en/eigenschaften-160-kabel-gewaehlt.jpg)

| Field | Effect |
|---|---|
| Set cable type / standard | opens the choice of cable type and standard |
| Photos | photos of this cable |
| Name | label; *from source → destination* builds it from source and destination |
| Length (m) | length of the cable |
| Colour | colour on the canvas |
| Layer | Video, Audio, Control, Network, Power, Other; works with the layer filter in the toolbar |
| Multicore / snake | name of the multicore the cable belongs to |
| Tie-line / permanent link | marks a permanent connection |
| Off-page connection (arrow connector) | draws two arrow connectors with a *Net / signal name* instead of the line |
| Show signal path | highlights the signal path on the canvas |
| House run | assigns the cable to a run of the building |
| Notes | text |
| Delete cable | removes the cable |

![Name from source and destination](bilder/en/eigenschaften-161-kabel-name-quelle-ziel.jpg)

#### Show signal path

*Show signal path* highlights all cables and devices of the signal path on the canvas and dims the rest. The toolbar shows the number of cables and devices; the × there ends the highlight.

![Signal path on the canvas](bilder/en/eigenschaften-175-kabel-signalweg-canvas.jpg)

#### Fixed install / lifecycle

| Field | Values |
|---|---|
| Status | — no status —, Planned, Installed, Tested, Operational, Fault, Retired |
| Pathway / route | text |
| Jacket/fire rating | text |
| Term. A, Term. B | termination at both ends |
| Fibre A, Fibre B | for fibre, the strand used at each end |
| Measurement/test result | — not tested —, PASS, FAIL; plus *Margin dB*, *Standard/limit* and *Report file*; *Clear* empties the result |

![Cable lifecycle](bilder/en/eigenschaften-167-kabel-messergebnis.jpg)

#### Conductors (power)

*Belongs to connection* assigns the cable to a connection from *Tools → Conductors and colour standards*. *+ Conductor* adds a conductor: role (L1, L2, L3, N, PE, spare), colour (empty means from the standard) and reason for a deviation.

![Conductors](bilder/en/eigenschaften-171-kabel-ader-gefuellt.jpg)

#### Connection

Shows source and destination. *From device*, *Port*, *To device* and *Port* change the ends; ports in use carry *in use*, and the app warns when a port is already taken.

![Connection](bilder/en/eigenschaften-177-kabel-verbindung-offen.jpg)

#### Cable appearance

| Field | Values |
|---|---|
| Routing | Ortho, Line, Curve |
| Stroke width | line width in px, slider |
| Label position | Start, Center, End; clicking the active position hides the label; the slider fine-tunes it along the cable |
| Endpoint labels | Auto (follows *Settings → Editing*), Show, Hide |
| Dashed, Arrow ◄, Arrow ► | dashed line and arrows |
| Bidirectional cable ⇌ | arrows on both ends |

![Curve routing, stroke width and label](bilder/en/eigenschaften-181-kabel-beschriftung-position.jpg)

#### Wireless connection

*Wireless connection (no cable)* turns the cable into a wireless link. *Max. reach (m)* replaces the length; frequency and channel are added.

![Wireless connection](bilder/en/eigenschaften-188-kabel-funk-felder.jpg)

#### Adapter suggestion

When the connectors at both ends do not mate, or have the same gender, the cable shows a notice and matching adapters or converters from the library. *Insert* puts the adapter into the run; one undo step removes it again.


### Frame properties

Clicking a frame shows its properties.

![Frame properties](bilder/en/eigenschaften-196-rahmen-eigenschaften.jpg)

| Field | Effect |
|---|---|
| Name | name of the room |
| Width (m), Depth (m) | size; the area below |
| Floor | floor of the room; *Add floor…* creates one |
| Colour | colour of the frame |
| Riser / vertical cable route | marks the frame as a vertical route between floors |
| Room number, Address, Notes | text |
| Floors | list of floors bottom to top with floor level in metres; the 3D view stacks rooms by it. *Take floors from the building statement* reads them from a building file |

![Floors](bilder/en/eigenschaften-202-etagen-verwaltung-offen.jpg)

| Button | Effect |
|---|---|
| Export BOM | opens the room's BOM with devices, internal cables and external connections; *Combine cables*, *Embed plan* and *Export PDF* |
| Delete frame only | deletes the frame, the devices stay |
| Delete frame + contents | deletes, after confirmation, the frame with all its devices and their cables |

![BOM](bilder/en/eigenschaften-206-rahmen-stueckliste-dialog.jpg)
