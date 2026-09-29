## Settings

The Settings dialog contains 15 tabs for configuring all aspects of the application. Open the dialog via the command palette (*Ctrl+K*, then type "Settings…") or through the menu.

### Project

![Settings - Project](bilder/en/einstellungen-project.jpg)

Configure project-specific settings:

#### Library Export / Import

Save your own device templates and groups as a JSON file. On import, existing entries with the same name are NOT overwritten (merge-by-name).

| Option | Effect |
|--------|--------|
| **Export library** | Saves all device templates, groups, and rack presets as a JSON file |
| **Import library…** | Loads a previously exported file. Only new entries are added |

#### Cable Numbering

Automatic, collision-free cable IDs from a fixed scheme. Numbers are displayed on the canvas, in the patch list, and on labels.

| Option | Effect |
|--------|--------|
| **Auto-assign a number to new cables** | Automatically assigns the next number to new cables |
| **Prefix** | Characters before the number (e.g., "C") |
| **Separator** | Character between prefix and number (e.g., "-") |
| **Digits** | Number of places for the number (1-6) |
| **Start number** | First number in the scheme |
| **Separate counter per layer (V/A/N/P…)** | Numbers are counted per signal type instead of continuously |
| **Renumber all cables** | Applies the current scheme to all existing cables |

Example: With prefix "C", separator "-", and 3 digits: "C-001", "C-002", etc.

#### Estimate Cable Lengths

Estimates cable lengths from the on-canvas distance between devices (straight line × scale + slack). Overwrites existing lengths.

| Option | Effect |
|--------|--------|
| **Metres per 100 px** | Scaling factor (e.g., 2 = 2 m per 100 screen pixels) |
| **Slack factor** | Additional length for safety (1.2 = 20% margin) |
| **Estimate all cable lengths** | Calculates lengths for all existing cables |

### Appearance

![Settings - Appearance](bilder/en/einstellungen-appearance.jpg)

Configure the visual appearance:

#### Language and Theme

| Option | Effect |
|--------|--------|
| **Language** | Choose between German, English, and other supported languages |
| **Canvas theme** | Light or dark for the work area |

#### Port Colors

| Option | Effect |
|--------|--------|
| **Color ports by type** | Colors SDI, audio, power, etc. differently |
| **Colors for connector types** | Choose individual colors for each type |
| **Colors for device categories** | Choose colors for cameras, mixers, monitors, etc. |

#### Cable Display

| Option | Effect |
|--------|--------|
| **Cable colors** | Manual, by length, or by layer (V/A/N/P) |
| **Show arrows** | Small arrows indicate signal direction |
| **Cable bumps** | Humps at crossing points for visual clarity |
| **Port label size** | Size of port labels |

#### Custom Palette

Colors for canvas background and grid lines (overrides theme defaults):

| Option | Effect |
|--------|--------|
| **Enable custom palette** | Use custom colors |
| **Background** | Canvas background color |
| **Grid stroke** | Color of grid lines |

### Editing

![Settings - Editing](bilder/en/einstellungen-editing.jpg)

Standard behaviors when editing cables and devices:

#### Default Cable Routing

| Option | Effect |
|--------|--------|
| **Orthogonal** | Right-angled, grid-like cables |
| **Straight** | Direct lines |
| **Curved** | Smooth curves |

#### Endpoint Labels

Small labels at each cable end showing where the other end leads.

| Option | Effect |
|--------|--------|
| **Show endpoint labels** | At source end "→ target device · target port", at target end "← source device · source port" |

#### Cable Type Follows Port Connector

| Option | Effect |
|--------|--------|
| **Derive cable type from port connector** | When a port connector type changes (e.g., BNC → XLR), connected cables automatically adapt |

#### Grid

| Option | Effect |
|--------|--------|
| **Grid spacing** | Size of the snap grid in pixels |
| **Snap to grid** | Devices snap to the grid when moved |

#### Connection Warnings

| Option | Effect |
|--------|--------|
| **Show warnings for invalid connections** | Displays warnings when incompatible devices are connected |

### Cable Types

![Settings - Cable Types](bilder/en/einstellungen-cableTypes.jpg)

Define and manage cable types:

| Option | Effect |
|--------|--------|
| **New cable type** | Creates a new cable type |
| **Edit cable type** | Changes name, color, or standard length |
| **Delete cable type** | Removes an unused cable type |

Each cable type has:
- A unique name (e.g., "SDI Cable")
- A color for canvas display
- Optional: standard length and description

### Master Data

![Settings - Master Data](bilder/en/einstellungen-stammdaten.jpg)

Management of connector types, standards, and layers:

#### Connector Types

| Option | Effect |
|--------|--------|
| **New connector type** | Creates a new connector type (e.g., 3G-SDI, MADI) |
| **Edit connector type** | Changes the name or display name |

#### Standards

| Option | Effect |
|--------|--------|
| **Video standard** | PAL, NTSC, SDI, HDMI, etc. |
| **Power standard** | IEC, USA, EU, etc. |

#### Layers

Signal types for color coding:

| Option | Effect |
|--------|--------|
| **Video (V)** | Video streams |
| **Audio (A)** | Audio streams |
| **Network (N)** | Data connections |
| **Power (P)** | Power supply |

### Configurations

![Settings - Configurations](bilder/en/einstellungen-configs.jpg)

Saved device configurations (e.g., different firmware versions or settings):

| Option | Effect |
|--------|--------|
| **New configuration** | Creates a named configuration |
| **Apply configuration** | Applies a saved configuration to a device |
| **Delete configuration** | Removes an unused configuration |

### Device Library

![Settings - Device Library](bilder/en/einstellungen-deviceLibrary.jpg)

Connection to the online device database (devices.zumpelars.de):

| Option | Effect |
|--------|--------|
| **Sign in…** | Register or sign in with an account |
| **Upload devices** | Sends your own device templates to the database |
| **Uploaded devices** | Shows which devices you have already shared |

**Note:** These settings are only available in the desktop client. Browser mode does not support login.

### Integrations

![Settings - Integrations](bilder/en/einstellungen-integrations.jpg)

External services and AI providers:

#### Fill-in Source

Determines where the "Fill in" button gets device information from:

| Option | Effect |
|--------|--------|
| **Web search** | Searches Wikipedia and DuckDuckGo (no API key needed) |
| **AI model** | Uses an AI model (requires API key) |

#### AI Providers

| Option | Effect |
|--------|--------|
| **Provider** | Choose between Claude, OpenAI, Google Gemini |
| **API key** | Enter the provider's API key |
| **Show / hide key** | Toggles visibility of the key |

#### Rentman Integration

| Option | Effect |
|--------|--------|
| **Rentman API token** | Token for the Rentman interface |
| **Link project** | Connects the current project to a Rentman project |

#### GreenGo Presets

| Option | Effect |
|--------|--------|
| **Save preset** | Saves the current plan as a GreenGo configuration |
| **Load preset** | Loads a previously saved GreenGo configuration |
| **Delete preset** | Removes a saved preset |

### MCP

![Settings - MCP](bilder/en/einstellungen-mcp.jpg)

MCP server configuration (Claude queries the plan):

| Option | Effect |
|--------|--------|
| **Enable MCP server** | Toggles the connection to MCP servers |
| **Server address** | URL or path to the MCP server |
| **Authentication** | Username and password (if needed) |

**Note:** MCP servers are not available in browser mode.

### Modules

![Settings - Modules](bilder/en/einstellungen-modules.jpg)

Installed and available modules:

| Module | Status | Effect |
|--------|--------|--------|
| **ATEM Control** | Enabled/Disabled | Controls Blackmagic ATEM mixer |
| **Videohub** | Enabled/Disabled | Connection to Blackmagic Videohub |
| **Rentman** | Enabled/Disabled | Rentman integration |
| **Mobile Share** | Enabled/Disabled | Share smartphone view |

Each module can be enabled or disabled.

### Certificates

![Settings - Certificates](bilder/en/einstellungen-nachweise.jpg)

Management of qualifications and insurance:

| Option | Effect |
|--------|--------|
| **New certificate** | Creates a new qualification/insurance certificate |
| **Edit certificate** | Changes name, expiration date, or description |
| **Delete certificate** | Removes a certificate |

Certificates can be attached to people or devices.

### Schema Builder

![Settings - Schema Builder](bilder/en/einstellungen-schema.jpg)

Define custom categories and fields for devices:

#### Categories

| Option | Effect |
|--------|--------|
| **New category** | Creates a new device category (e.g., "Special Cameras") |
| **Rename category** | Changes the name |
| **Delete category** | Removes an unused category |

#### Fields

| Option | Effect |
|--------|--------|
| **New field** | Creates a new attribute (text, number, dropdown, etc.) |
| **Edit field** | Changes type, validation, or default value |
| **Delete field** | Removes a field from all devices |

### Sync

![Settings - Sync](bilder/en/einstellungen-sync.jpg)

Network synchronization for collaboration:

| Option | Effect |
|--------|--------|
| **Enable sync** | Allows others to see changes live |
| **Relay server** | Address of the signaling server |
| **Room code** | Unique code for this plan (share with colleagues) |

Other users can connect to your plan if they have the room code.

### Keyboard Shortcuts

![Settings - Hotkeys](bilder/en/einstellungen-hotkeys.jpg)

Customize keyboard shortcuts:

| Action | Default Shortcut | Effect |
|--------|------------------|--------|
| **New project** | Ctrl+N | Creates a blank project |
| **Open project** | Ctrl+O | Opens a file |
| **Save project** | Ctrl+S | Saves changes |
| **Command palette** | Ctrl+K | Opens search and navigation |
| **Settings** | (Ctrl+,) | Opens this dialog |

All shortcuts can be customized. Click an action to define a new shortcut.

### Advanced

![Settings - Advanced](bilder/en/einstellungen-advanced.jpg)

Advanced options for developers and power users:

| Option | Effect |
|--------|--------|
| **Data export** | Exports project and application data as a ZIP file |
| **Reset database** | Deletes all local data (cannot be undone) |
| **Enable logging** | Writes detailed logs for debugging |
| **Show log file** | Opens the current log file |
| **Clear cache** | Deletes the local screen cache |
| **Open DevTools** | Opens the browser developer tools |

Use these options only if you know what you are doing. They can damage your project.
