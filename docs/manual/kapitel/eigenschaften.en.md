## Inspector

The Inspector is the right sidebar of the application. It displays properties of the currently selected object — a device, cable, frame, or library template. When nothing is selected, the Inspector shows the current state of the plan: photos that belong to the plan and quick orientation tips.

![Nothing selected in the Inspector](bilder/en/eigenschaften-nichts-ausgewaehlt.jpg)

### Nothing Selected

When you have not selected any object on the canvas, the Inspector displays three things:

- **Hint**: A quick orientation — drag devices from the library onto the canvas, connect ports to create cables.
- **Plan photos**: The *Project photos* section contains all images you have attached to the plan without a target device. These belong to the plan as a whole, not to a single device.

### Device Properties

When you click a device on the canvas, the Inspector shows all properties of that device in collapsible and reorderable sections.

#### Structure and Reordering

The Inspector organizes device properties in approximately 30 expandable sections. Each section can:

- **Expand/collapse** by clicking the header. The state is remembered.
- **Reorder**: The ⠿ grip symbol on the left allows drag-and-drop to change the order. The new order is saved per device and applies to all devices of the same type (e.g., all cameras).

![Device properties: Mixer overview](bilder/en/eigenschaften-geraet-mixer-uebersicht.jpg)

#### Filter Sections

At the top of the Inspector is a search field labeled *Search sections*. Enter a name or keyword:

- The filter searches in the **section ID** (e.g., `network-config`), the **title** (e.g., "Network"), and the **subtitle** (e.g., "3 in · 2 out").
- All sections that do not match are hidden.
- A matching section automatically expands.

#### Expand All / Collapse All

Next to the search field are two buttons:

- **All open** — expands all sections.
- **All close** — collapses all sections.

### Sections in Detail

#### Name and Note (top, not reorderable)

- **Name**: Unique identifier for the device (e.g., "ATEM 1", "Camera Main").
- **Note**: Free-text field for anything that does not fit another field (e.g., web UI, firmware version, location, owner).
- **Short name**: Automatically generated from the name (e.g., "ATEM" instead of "ATEM Constellation 8K"). Used in space-constrained contexts like port labels. You can override the auto-suggestion with your own word or reset it using the refresh button (↻).

#### Inputs & Outputs (top, default position)

![Section: Inputs & Outputs](bilder/en/eigenschaften-sektion-ports.jpg)

Connectors are placed directly under name and note — at the top of the panel, since the entire application centers on cabling.

- **Inputs**: List of input connectors with type (e.g., SDI, HDMI, Fiber).
- **Outputs**: List of output connectors.
- Depending on the device, you can add, edit, or delete connectors.
- Each connector displays its name (e.g., "SDI 1") and its type.

#### Category

Select the device type (e.g., "Camera", "Mixer", "Monitor", "Inventory"). The category determines which other fields are visible in the Inspector (e.g., "Optics/Lens" appears only for cameras).

#### Photos

Upload images of the device. They are displayed in the gallery below the properties.

- **Add**: Click the plus icon or drag images directly into the field.
- **Delete**: Click the X icon on an image.

#### Device Kind Information

If the device has special support (e.g., ATEM, Videohub, GreenGo Intercom), this section shows a button to open a device information dialog or to export (e.g., ATEM patch export).

#### Catalog and Source

- **Catalog type**: The manufacturer and model number from the device library (e.g., "Blackmagic Design: ATEM Constellation 8K").
- **Source**: Shows where the port information comes from (e.g., from datasheet, manually entered, from Rentman).
- **Save to library**: Stores the device as a template for faster placement later.

#### Network and Access

- **IP address**: The network address of the device (e.g., `192.168.1.10`).
- **Username, password**: Login credentials for the device's web UI or API.
- These credentials are stored in the operating system credential store — not in the project file.

#### Streams and Playout Destinations

If the device sends live video feeds:

- **Stream URL**: The HTTP(S) or RTMP endpoint of the device.
- **Stream keys / Access credentials**: Securely stored in the credential store.

#### Optics and Lens Data (cameras only)

![Section: Optics/Lens](bilder/en/eigenschaften-sektion-optik.jpg)

For cameras, this section displays:

- **Lens model**: E.g., "Canon CN7x7", "Fujinon HA22x7.6".
- **Focuser type**: Manual or motorized (e.g., "Canon R-FS").
- **Control method**: Serial control, ESP32 bridge, simulator (for testing).

#### Power Consumption and Circuit

- **Power consumption**: Typical power draw in watts (e.g., 150 W).
- **Circuit type**: Mains frequency and operating mode (e.g., "230 V AC, 16 A Cooler" or "12 V DC Battery").
- **Connection points**: A table shows which connectors go to which power rail (e.g., "Input 1 → Circuit A, Terminal 1").

#### Adapters

If the device requires adapters (e.g., XLR → BNC, male → female):

- List of available adapters.
- You can add adapters or import from a template.

#### DMX (for control devices)

For devices with DMX control:

- **DMX start channel**: The first occupied channel (e.g., 1, 65, etc.).
- **DMX device ID**: The universe and channel number.

#### House Cabling

Documents cabling routes within the device (e.g., from input to mixer core to output).

#### Format Profile

The input/output formats and codec profiles if the device supports multiple operating modes.

#### Dimensions

Width, height, and depth in millimeters. Used later for 3D rack visualization and space planning.

#### Network Configuration

Advanced network settings (if the device supports multiple network modes or VLANs).

#### Modes

If the device has different operating modes (e.g., "Recording", "Live streaming", "Simulator"), configure them here.

#### Rack Position

- **Rack position**: The RU (rack unit) and depth in a 19" rack.
- **Rack 3D view**: Shows a 3D visualization of devices in the rack.

#### Lifecycle

- **Installation status**: E.g., "Planned", "Installed", "Tested", "Live".
- **Test results**: Confirmation that the device works.
- **Maintenance schedule**: Maintenance dates and next check.

#### Print and Documentation

Generates patch sheets and documentation for printing (e.g., device overview, port lists).

#### Attachments

Upload datasheets, manuals, or other files.

### Cable Properties

Click a cable on the canvas to see its properties.

![Cable properties: Overview](bilder/en/eigenschaften-kabel-uebersicht.jpg)

#### Connection (From/To)

- **From device and From port**: The source device and its port (e.g., "Camera 1 → SDI out").
- **To device and To port**: The destination device and its port (e.g., → "Mixer → SDI in 1").
- You can change these via dropdown lists.

![Cable: Connection](bilder/en/eigenschaften-kabel-verbindung.jpg)

#### Label and Color

- **Name**: A label for the cable (e.g., "Main Camera Feed").
- **Color**: Click the color field to change the display color.

#### Cable Type and Specification

- **Cable specification**: Select a standard cable type from the catalog (e.g., "Belden 1694A SDI", "Fiber Optic SM9/125").
- **Length**: The cable length in meters.
- **Custom cable**: If not in the catalog, you can enter the type as free text.

![Cable: Routing and Specification](bilder/en/eigenschaften-kabel-routing.jpg)

#### Routing

- **Orthogonal** (right-angle bend): The cable follows a right-angle path (default).
- **Diagonal**: The cable runs straight from source to destination.
- **Curved**: The cable displays a Bezier curve path.

#### Conductor Composition (for multi-conductor cables)

If the cable has multiple conductors (e.g., an audio multicable with 4 pairs):

- List of individual conductors with their functions (e.g., "Conductor 1: Audio L", "Conductor 2: Audio R").

#### Fiber Mode (Fiber Optic)

If the cable is fiber optic:

- **Mode**: Single-mode (SM) or multi-mode (MM).
- **Wavelength**: E.g., 1310 nm, 1550 nm.

#### House Cabling and Vertical Chase

- Documents whether the cable runs through a house distribution panel or vertical chase.
- Notes on installation route.

#### Lifecycle and Test Results

- **Status**: E.g., "Planned", "Installed", "Tested", "Live".
- **Test result**: Pass/Fail with date and technician.

### Frame Properties

Click a frame (LocationFrame) to see its properties.

#### Name

The name of the frame/room (e.g., "Studio A", "Server room", "Control").

#### Size

- **Width, Height** in pixels on the canvas (determines the visible size of the box).

#### Color

Click the color field to change the frame's display color.

#### Floor

- **Level**: Select from existing floors or create a new one.
- Floors can have an elevation (e.g., "3rd floor (18 m)").

#### Vertical Chase

A special frame through which multiple cable routes pass vertically (routing documentation).

### Multiple Selection

When you select multiple devices simultaneously (Ctrl+Click or drag selection), the Inspector shows properties that apply **to all** of them:

- **Category**: Only if all selected devices have the same category.
- **Common fields**: Fields whose values are the same for all selected devices.

This allows batch changes, such as giving multiple devices the same color or moving them to the same category all at once.
