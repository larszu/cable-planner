## Library

The library panel on the left organizes device templates, cable types, device groups, and racks
for saving, loading, and reusing designs.

### Equipment

The equipment tab shows local templates and external sources.

#### Local Library

![Equipment overview in the library](../bilder/en/bibliothek-geraete-lokal.jpg)

The local library contains 150+ built-in devices and all custom templates you create.

- *Search*: Search field with `Ctrl+F` shortcut. Filters by name or category in real time.
- *Filter Menu*: Sort order (Manual, A→Z, Z→A), show hidden devices, show only owned material.
- *Categories*: Expand/collapse, edit button to rename.
- *Entries*: One entry per device. Hover to show actions.

##### Create Your Own Device

Create new devices with ports and optional photos:

*Library → +* (green button) *→ New device…*

![Create new device](../bilder/en/bibliothek-dialog-geraet-anlegen-allgemein.jpg)

The fields:

- **Name**: What the device is called.
- **Category**: E.g., Cameras, Mixers, Monitors. Appears as a folder in the library. New categories are created here.
- **Is a rack device**: Checkbox. If yes, enter the height in rack units (RU).

###### Tab: Ports

![Configure ports](../bilder/en/bibliothek-dialog-geraet-anlegen-anschluesse.jpg)

Group ports together ("4x BNC In", "2x HDMI Out"):

- **+Input group** or **+Output group**: Add a new group.
- *For each group*:
  - *Direction*: Input or Output.
  - *Count*: How many ports of this type.
  - *Label*: E.g., "SDI In" or "Ethernet Out".
  - *Connector*: BNC, HDMI, DisplayPort, USB, Ethernet, XLR, Power, etc., or Custom.

Groups are expanded into individual ports when saved (e.g., "SDI In 1", "SDI In 2", …).

###### Tab: Photo

![Upload photos and recognize ports](../bilder/en/bibliothek-dialog-geraet-anlegen-foto.jpg)

Automatically recognize ports from a device datasheet or photo:

- **Upload photos**: Drag-and-drop or button.
- **Recognize**: Detects connector type and count.
  - If multiple models match: shows the best match.
  - Results as a table with checkboxes (uncertain entries are unchecked).
- **Keep photos**: Checkbox — images are saved with the template.

Recognition requires an API key for the device library or AI (Settings → AI Providers).

###### Port Guessing

Guess ports from the device name:

*"Guess the ports from the device name"* — button **Fill in** (using source from Settings):
- **AI** (Claude API, OpenAI GPT, Google Gemini): Sends name and optional description to AI.
- **Web Search**: Searches public datasheets and manufacturer websites.
- **Heuristic**: Simple rules based on name (e.g., "ATEM 4 Pro": expects 4 inputs).

AI provider and API key are set in *Settings → AI Providers*.

###### Save

Bottom three buttons:

- **Place only**: Add device to canvas, don't save a template.
- **Save to library**: Save template only, no device on canvas.
- **Save and place**: Both.

#### Submit Templates

Contribute custom devices to the device library:

*Library → +* *→ Submit templates*

![Submit templates dialog](../bilder/en/bibliothek-dialog-vorlagen-einreichen.jpg)

- Select which local templates to send.
- Enter manufacturer and model, optionally datasheet link.
- Template is uploaded and verified by other users (voting).

The device library is a community resource. Verified devices take precedence over local versions.

#### NetBox Import

Import network infrastructure from NetBox:

*Library → +* *→ Import file …* or via NetBox integration

![Search NetBox devices](../bilder/en/bibliothek-dialog-netbox-import.jpg)

- **Search field**: E.g., "Cisco Catalyst". Searches NetBox device types.
- **Choose category**: Where the imported template is filed.
- **Import**: Device is added to your local library.

#### Device Library

Public device database with 500+ verified templates:

![Device library](../bilder/en/bibliothek-geraete-geraetebibliothek.jpg)

- Load devices from the database (requires sign-in).
- See verification status: how many users have verified the device.
- Reconcile with local versions and merge if needed.

#### Rentman

Sync Rentman projects with device inventory (if Rentman module is active):

![Rentman integration](../bilder/en/bibliothek-geraete-rentman.jpg)

- **Linked Project**: Fetch the Rentman project.
- **Imported**: Which Rentman devices are already imported.
- **Catalog**: Browse more devices to import.
- **Reconcile**: Show differences between plan and Rentman project.

### Cables

Available cable types and their configurations:

![Cable overview](../bilder/en/bibliothek-kabel-uebersicht.jpg)

- **Cable types** (SDI, HDMI, DisplayPort, Ethernet, Fiber, Audio/XLR, USB, Power, Custom):
  One group per cable type.
- *Per cable*:
  - Display name (e.g., "SDI 75 Ω" or "HDMI 2.1").
  - Connectors on both ends.
  - Maximum length (optional).
  - Signal standards.
  - **Installed** / **Planned**: Count of currently routed / planned cables in the design.

The cable library is predefined; custom types are "Custom".

#### Manage Cable Types

Define new cable types or edit existing ones:

*Library → Cables tab → "Manage cable types…"*

![Manage cable types](../bilder/en/bibliothek-dialog-kabeltypen-verwalten.jpg)

- New group: e.g., "Satellite" with custom connector pair and standards.
- Edit cable: name, length, color, signals, status (Recommended/Custom/Modified).

### Groups

Save multiple devices + cables together and reuse later:

![Groups overview](../bilder/en/bibliothek-gruppen-uebersicht.jpg)

*Creating a group*:

1. Arrange devices on the canvas and wire them together.
2. Select the devices + cables (multi-select on canvas).
3. *Canvas Toolbar → "Save as group"*.
4. Enter a name → group appears in the library.

*Using a saved group*:

- Drag from library onto canvas → all devices + cables are placed at that location.
- Saved with position data, so they land in the right place.

*Operations on groups*:

- **Rename** (pencil icon)
- **Export** → `.cpgroup` file
- **Delete**

### Racks

Save 2D rack layout: which devices, at what height, stacked:

![Racks overview](../bilder/en/bibliothek-racks-uebersicht.jpg)

#### Rack Builder

Edit an empty or existing rack:

*Library → Racks tab → "+" → New rack*

![Rack Builder dialog](../bilder/en/bibliothek-dialog-rack-builder-leer.jpg)

- **Rack name**: E.g., "Server Rack 1".
- **Rack height**: Total height in rack units (typically 42 RU).
- **Add devices**: Add from the list on the right.
- **Slot editor**: Each device gets a starting position (topmost free slot).
- **Stack devices**: Multiple devices in the same rack.

After saving:

- The rack becomes a template (like a group).
- Drag onto canvas → all devices in the rack are placed.
- In Canvas Toolbar: **Edit rack** opens the builder for an already-placed rack.

#### Export for the Warehouse

Export rack inventory for warehouse system:

*Library → Racks tab → "For the warehouse"*

![Export rack for warehouse](../bilder/en/bibliothek-racks-zum-lagern.jpg)

Generates `rack-belegung.json` for your warehouse inventory system (e.g., Inventory Planner).

### Common Settings

**Port-guessing source** (automatic port recognition):
- *Settings → AI Providers* → choose OpenAI, Claude, or Google Gemini.
- Enter your API key.
- Heuristics (name analysis) run without a key.

**Manage categories**:
- New categories appear when you create or rename a device.
- Category names are bilingual (German + English).
- From the filter menu: **Expand all** / **Collapse all** toggles all categories at once.

**Search and filters**:
- Search field = real-time filtering by name or category.
- **Only owned**: Show only devices listed in your warehouse inventory.
- **Show hidden**: Devices you've collapsed from view.
