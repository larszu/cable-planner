## Tools: Plan

Tool dialogs for capturing, analyzing, and planning a facility — from site survey through function groups to delivery.

### Calculate

Specialized calculators for capacity and resource planning.

#### Recording storage calculator

*Tools → Calculate recording storage…*

![Storage calculator for video recording](../bilder/en/werkzeuge-planen-recording-storage-calc.jpg)

Calculates storage requirements for video recording based on codec, resolution, framerate, and duration.

- **Inputs**: Video format (HD/4K/8K), codec (DCI/H.265/ProRes/etc.), framerate (25/50/60 fps), recording duration.
- **Output**: Storage size in GB/TB.

#### Projection & display

*Tools → Projection & display…*

![Projection calculator](../bilder/en/werkzeuge-planen-projection-calc.jpg)

Calculates projection parameters for displays and projectors.

- **Inputs**: Display size (diagonal), resolution, distance to audience.
- **Output**: Optimal projection distance and lens parameters.

### Check

Analysis tools for validation and consistency checking of the plan.

#### Analyses

*Tools → Analyses (weight/network/redundancy)…*

A comprehensive analysis tool with 14 tabs for checking all aspects of the facility.

##### Tab: Weight & Heat

![Weight and heat load by equipment category](../bilder/en/werkzeuge-planen-analysis-weight.jpg)

Total weight and heat load (BTU/h) per equipment group and overall.

- **Table**: Category, count, weight (kg), power (W), heat (BTU/h), optional value (€).
- **Missing**: Display of equipment without weight values.
- **Download**: CSV export for calculations.
- **Link**: Direct access to power consumption calculator (see below).

##### Tab: Network

![Network overview: VLAN, IP duplicates, data flows](../bilder/en/werkzeuge-planen-analysis-network.jpg)

Check IP addresses, VLANs, switch ports, and network topology.

- **Address plan**: IP conflicts and missing assignments.
- **VLAN counting**: Which VLANs and how many ports per VLAN.
- **Switch port allocation**: Which device ports at which switch ports.
- **Multicast**: Multicast addresses and groups.

##### Tab: Redundancy

![Detecting single points of failure](../bilder/en/werkzeuge-planen-analysis-redundancy.jpg)

Checks where only one signal or power circuit exists.

- **Connections**: How many independent power or upstream connections per device?
- **Findings**: Red flags for devices with single connections only.

##### Tab: RF / Wireless

![Radio frequencies and spectrum conflicts](../bilder/en/werkzeuge-planen-analysis-rf.jpg)

Check wireless frequencies (microphones, headphones, cameras) and spectrum conflicts.

- **Frequency table**: All transmitters and receivers with frequency (MHz), bandwidth, power.
- **Conflicts**: Channels too close together (< 0.4 MHz spacing).
- **Spectrum scan**: Optional upload of spectrum measurement data for validation.

##### Tab: Cable Runs

![Cable lengths and routing](../bilder/en/werkzeuge-planen-analysis-runs.jpg)

Checks physical routing paths and cable lengths.

- **Findings**: Cables too long, invalid routing complexity.
- **Route details**: Per cable length, conductor count, diameter.

##### Tab: Signal Chain

![Tracing signals from source to destination](../bilder/en/werkzeuge-planen-analysis-chain.jpg)

Traces a signal through all layers — from source to output.

- **Entry**: Choose source and destination.
- **Chain**: Shows path through mixers, routers, players, etc.
- **Conflicts**: Broken or ambiguous paths.

##### Tab: Patch List

![All device-to-port assignments](../bilder/en/werkzeuge-planen-analysis-patch.jpg)

Tabular overview of all cable connections.

- **Columns**: Source device, source port → destination device, destination port, cable type, length.
- **Filter**: By device, cable type, or status (planned/installed).
- **Download**: CSV for patch list printouts.

##### Tab: Check Sheet

![Device datasheet completeness](../bilder/en/werkzeuge-planen-analysis-sheet.jpg)

Verifies that all required device datasheets are attached.

- **Status**: Which devices have PDF datasheet links?
- **Findings**: Missing or outdated datasheets.

##### Tab: Client Summary

![Overview for quotes and handover](../bilder/en/werkzeuge-planen-analysis-client.jpg)

Summary for customer communication and project acceptance.

- **Project name, system**: Standard info.
- **Equipment list**: Short version for quotes.
- **Configuration**: Key parameters (cameras, inputs, outputs).

##### Tab: Costs: Plan vs. Actual

![Comparison between quote and actual expenses](../bilder/en/werkzeuge-planen-analysis-cost.jpg)

Deviations between planned and actual costs.

- **Input**: Quoted and actual prices per equipment line.
- **Variance**: Over-/under-budget, percentage.
- **Tolerance**: Threshold for deviation.

##### Tab: Crew: Hours & Expenses

![Personnel and material costs](../bilder/en/werkzeuge-planen-analysis-crew.jpg)

Work plan: who, when, how long, material budget.

- **Positions**: Technicians, camera operators, audio, etc.
- **Hours**: Setup, operation, teardown.
- **Hourly rate**: Personnel cost calculation.
- **Expenses**: Travel, accommodation, rental equipment.

##### Tab: Naming Scheme

![Apply automatic naming patterns](../bilder/en/werkzeuge-planen-analysis-naming.jpg)

Consistent naming of devices, cables, and network ports.

- **Schema**: Choose from predefined rules (category + number, manufacturer + model, custom).
- **Application**: Which objects to update?
- **Preview**: Shows what new names will look like.

##### Tab: Dante Patch

![Audio network routing and device assignment](../bilder/en/werkzeuge-planen-analysis-dante.jpg)

Validation of Dante audio routing and device certification.

- **Patch matrix**: Transmitter → receiver assignment.
- **Line quality**: Latency, jitter, redundancy per line.
- **Device list**: Dante certification and firmware version.

##### Tab: To Do

![Open tasks and findings](../bilder/en/werkzeuge-planen-analysis-todo.jpg)

Summary of all findings and tasks to complete.

- **Categories**: Weight, network, redundancy, RF, cables, costs, etc.
- **Priority**: Red (critical), yellow (warning), gray (info).
- **Actions**: What needs to be done to release the plan?

#### Plan check

*Tools → Plan check…*

![Plan check: all findings and issues](../bilder/en/werkzeuge-planen-plan-check.jpg)

Scans the entire plan for common errors and displays them structured.

- **Filter**: By finding type (error, warning, info) or device/cable.
- **Findings**: Incomplete connections, invalid combinations, missing metadata.
- **Automatic**: Runs in background when saving.

#### Plan vs. found

*Tools → Plan vs. found…*

![Deviations between plan and site survey](../bilder/en/werkzeuge-planen-reconcile.jpg)

Compares the planned layout with the captured as-found situation on site.

- **Load survey**: CSV/Excel with names and positions.
- **Matching**: Automatic alignment or manual assignment.
- **Differences**: What's planned but not present? What's on site but not in the plan?
- **Export**: Side-by-side comparison report.

### Plan

Tools for capturing, structuring, and detailing the facility.

#### Survey (capture existing)

*Tools → Survey (capture existing)…*

![Capturing existing equipment on site](../bilder/en/werkzeuge-planen-survey.jpg)

Documents physically present equipment and their location.

- **Equipment input**: Name, category, assumed location.
- **Room**: Storage location in facility, or free-standing.
- **Photo**: Snapshot of equipment (optional).
- **Notes**: Observations (condition, alternatives, blocked connectors).
- **Guess connectors**: Search device datasheet and fill in connector groups.

#### Drum micing

*Tools → Drum micing…*

![Placement of drum microphones](../bilder/en/werkzeuge-planen-drum-micing.jpg)

Specialized dialog for placing microphones on drum kit components.

- **Drum kit sketch**: Kit with positions (kick, snare, hi-hat, toms, cymbals).
- **Mic slots**: Drag-and-drop mic types to positions.
- **Connectors**: Select devices (mixer, interface) and assign input connectors.
- **Notes**: Name and notes per mic (e.g., kick-outside, snare top).

#### Wireless / vocals (spectrum)

*Tools → Wireless / vocals…*

![Frequency planning for wireless systems](../bilder/en/werkzeuge-planen-wireless.jpg)

Plans radio frequencies for wireless microphones and headphones.

- **Bands**: 2.4 GHz, UHF (600–700 MHz), UHF (900 MHz), IR, SMD24.
- **Devices**: Transmitter and receiver models, some with programmable frequencies.
- **Frequency assignment**: Assign channels one-to-one, or automatically minimize conflicts.
- **Spectrum scan**: Upload measurement data (CSV) to validate against real environmental frequencies.

#### Rundown and camera assignments

*Tools → Rundown and camera assignments…*

![Scenes, cuts, and camera instructions](../bilder/en/werkzeuge-planen-rundown.jpg)

Structures the timeline of an event and assigns camera tasks.

- **Import segments**: Read from TCS files or enter manually.
- **Cuts / scenes**: Per entry: name, duration, music timing.
- **Camera assignment**: Per camera position (camera 1, camera 2, …) which cut/shot to show?
- **Handover**: Creates instruction cards for camera crew (QR code or printout).

#### Delivery (streaming destinations)

*Tools → Delivery…*

![Streaming destinations and parameters](../bilder/en/werkzeuge-planen-delivery.jpg)

Defines where video/audio is routed (YouTube Live, Zoom, recording, etc.).

- **Destinations**: YouTube Live, Facebook, Twitch, RTMPS server, local recording, multiview monitor.
- **Parameters**: Bitrate, codec, resolution, framerate.
- **Credentials**: API keys, stream URLs (securely stored, not in project file).
- **Monitoring**: Live status, Mbps usage, error rate.

#### LED wall

*Tools → LED wall…*

![LED wall: panel size, resolution, weight](../bilder/en/werkzeuge-planen-led-wall.jpg)

Plan space and power for LED surfaces.

- **Panel format**: Choose standard sizes or custom (e.g., 500×250 mm).
- **Resolution**: Pixels per meter (256, 312, 500 ppm).
- **Layout**: Width × height in panel units → total size in meters.
- **Weight & power**: Calculated from panel data.
- **Pixel map**: Export coordinates for media server (pixel mapping).

#### Faceplate editor

*Tools → Faceplate editor…*

![Arranging connectors on wall plates or stage boxes](../bilder/en/werkzeuge-planen-faceplate.jpg)

Places connectors on flat surfaces (wall plate, patchfield, stage box) and prints 1:1 for drilling.

- **Plate**: Choose size and material (19" rack blank, wall plate, custom).
- **Connectors**: Drag-and-drop connector groups.
- **Positioning**: Millimeter-precise placement (grid-based).
- **Labeling**: Automatic from device names, or custom.
- **Print**: 1:1 to printer for hole drilling and label printing.

#### Report editor

*Tools → Report editor…*

![Columns, sorting, and filtering for lists](../bilder/en/werkzeuge-planen-report-editor.jpg)

Configures display of equipment and cable lists (print & export).

- **Columns**: Selection, order, width.
- **Grouping**: By category, room, status, or custom.
- **Sorting**: A→Z, by value, by date.
- **Filter**: Only devices of certain categories, rooms, or status.
- **Templates**: Save and recall preconfigured layouts.

#### Conductors and colour standards

*Tools → Conductors and colour standards…*

![Wire colors by standard or custom](../bilder/en/werkzeuge-planen-conductors.jpg)

Defines wire colors for cables and connector markers per IEC or custom.

- **Standards**: IEC 60757 (International), EN 50575 (EU), custom.
- **Sets**: Predefined color sequences (e.g., brown/black/gray/white for 4×4 XLR).
- **Assignment**: Which standard for which cable types?
- **Preview**: Shows actual colors of current numbers.

#### Received show-control messages

*Tools → Received show-control messages…*

![Protocol of received OSC/MIDI/API commands](../bilder/en/werkzeuge-planen-show-control.jpg)

Shows a log of all show-control commands received by the app (OSC, MIDI, HTTP).

- **Input source**: IP:port, network interface.
- **Data flow**: Timestamp, command, parameters, status (processed/ignored).
- **Errors**: Invalid commands, parse errors.
- **Live view**: Real-time monitor during a show.

### Create & Manage

Tools for building and managing the facility.

#### Connect multiple cables

*Tools → Connect multiple cables…*

![Mass cable connection in a table](../bilder/en/werkzeuge-planen-bulk-connect.jpg)

Connects many cables at once instead of clicking individually.

- **Table**: Source, source port, destination, destination port, cable type.
- **Paste**: Copy-paste from Excel or CSV.
- **Validation**: Checks for incompatibility (e.g., BNC to HDMI).
- **Apply**: Wire all rows at once.

#### Create new rack

*Tools → Create new rack…*

![New empty rack with configuration](../bilder/en/werkzeuge-planen-new-rack.jpg)

Creates a new rack container from device templates.

- **Name**: Label (e.g., "Server Rack 1").
- **Height**: Rack units (RU), usually 42 RU.
- **Template**: Optional from standard layouts or empty.
- **Position**: Where to place on canvas?

#### Rack builder

*Tools → Rack builder…*

![Interactive rack equipment placement](../bilder/en/werkzeuge-planen-rack-builder.jpg)

Populates a rack with devices, arranges them, and visualizes in 3D.

- **Existing racks**: List of editable racks.
- **Device slots**: Height (RU) per device.
- **3D view**: Front view for checking cable lengths and obstructions.
- **Export**: Save rack structure or place on canvas.

#### Generate AI plan

*Tools → Generate AI plan…*

![Generating draft plan from text description](../bilder/en/werkzeuge-planen-ai-plan.jpg)

Generates initial plan draft based on text description (AI).

- **Input**: Brief description of facility (e.g., "3 cameras, ATEM mixer, 2 monitors, streaming to YouTube").
- **Options**: Preferred equipment types, budget limits.
- **Draft**: AI selects devices from library and wires them.
- **Adjust**: Edit generated plan.

Requires an AI API key (OpenAI, Google, Anthropic).

#### Revisions & snapshots

*Tools → Revisions & snapshots…*

![Version control: snapshots and comparison](../bilder/en/werkzeuge-planen-revisions.jpg)

Saves intermediate versions of a plan to track changes.

- **Snapshots**: Timestamp, optional note.
- **Autosave**: Automatic snapshots after major changes.
- **Comparison**: Two versions side-by-side, differences highlighted.
- **Restore**: Return to an earlier version.

### Device Configuration

Setup of specialized devices (if present).

#### ATEM multiviewer layout

*Tools → ATEM multiviewer layout…*

(Only if an ATEM mixer is present in the facility.)

![Configure multiviewer windows on ATEM](../bilder/en/werkzeuge-planen-atem-mv.jpg)

Sets which sources appear in which multiviewer windows.

- **Layout**: How many windows and positions?
- **Assignment**: Source → window number.
- **Size & position**: Each window individually resizable (if supported by ATEM model).

#### ATEM audio routing

*Tools → ATEM audio routing…*

(Only if an ATEM mixer with audio inputs is present.)

![Assign audio inputs of the ATEM](../bilder/en/werkzeuge-planen-atem-audio.jpg)

Routes audio inputs (XLR, RCA, Dante) to mixer channel faders.

- **Inputs**: List all audio inputs of the ATEM.
- **Channels**: Which channel gets which input?
- **Sensitivity**: Level per input.

#### ATEM input labels

*Tools → ATEM input labels…*

(Only if an ATEM mixer is present.)

![Configure ATEM input source names](../bilder/en/werkzeuge-planen-atem-labels.jpg)

Names the input sources on the ATEM mixer (name on control surface).

- **Inputs**: List all ATEM inputs (1–20+).
- **Names**: Custom name per input (e.g., "Camera 1", "Graphics").
- **Color**: Optional marker color assignment.
