## Settings

### Opening the settings

The *Settings* button sits on the right of the header bar.

![Header bar with the Settings button](bilder/en/einstellungen-01-kopfleiste.jpg)

Other ways into the dialog:

- Command palette (*Ctrl+K*), entry *Settings…*; the entry *Switch modules on or off…* opens the *Modules* tab directly.
- While the MCP server runs, the status bar shows an indicator for it; clicking it opens the *MCP* tab.
- During a live collaboration, the *Live* indicator in the status bar opens the *Network sync* tab.

The dialog lists the 15 tabs on the left and shows the selected tab on the right. It opens on the *Project* tab.

![Settings, Project tab](bilder/en/einstellungen-02-dialog.jpg)

Two buttons sit at the top right: the arrow button pops the settings out into a separate window (for example on a second monitor), the cross closes the dialog. Clicking the dimmed background also closes it. Drag the header to move the dialog.

![Dialog header with pop-out and close](bilder/en/einstellungen-52-kopf-auslagern.jpg)

Almost every setting takes effect immediately. The exceptions are the project metadata in the *Project* tab (button *Save*) and individual fields with their own *Save* button.

| Tab | Contents | Applies to |
|---|---|---|
| Project | metadata, plan defaults, logos, cable numbering, length estimation, stock lengths, library export | the open project (library export: this computer) |
| Modules | show or hide feature areas | this computer |
| Appearance | language, theme, colours, canvas background | this computer |
| Editing | cable routing, grid, behaviour when connecting | this computer |
| Hotkeys | keyboard shortcuts | this computer |
| Integrations | Rentman, NetBox, Tally-Pi, fill-in source, AI providers, GreenGo presets | this computer |
| Device library | server, account, uploads and sync | this computer |
| MCP | local server through which Claude queries the plan | this computer |
| Configurations | library of device configuration files | this computer |
| Cable types | own and changed cable types | this computer |
| Master data | own connector types, signal standards, cable layers | this computer |
| Categories & fields | own categories and domain fields | this computer |
| Network sync | live collaboration and sync directory | this computer |
| Credentials | qualifications, insurance, safety briefings | this person |
| Advanced | autosave, category management, caches, data export | this computer |

### Project

#### Project metadata

The fields at the top are saved with the project file:

| Field | Contents |
|---|---|
| Project name | name of the project |
| Description | free text |
| Client | end customer |
| Contractor | executing company |
| Author | name of the planner |
| Project no. | e.g. 2026-042 |

Changes to these fields and to the logos are applied only by *Save* at the bottom of the tab; *Reset* restores the saved values. The dialog that opens when you click the project name in the header bar edits the same data.

#### Plan defaults

Technical defaults for this plan, by discipline. The three lists take effect immediately.

![Plan defaults](bilder/en/einstellungen-03-projekt-standards.jpg)

| List | Values | Effect |
|---|---|---|
| Video format (SDI) | 576i50 (PAL) up to 2160p59.94/60 plus DCI 4K p24 and p60, each with the SDI standard it needs (3G, 6G, 12G or quad 3G) | drives the default SDI cabling |
| Power / mains standard | Europe / IEC 230 V single-phase, Europe 400 V three-phase, UK 230 V (BS 1363), North America 120 V, 208 V three-phase and 240 V split-phase, Japan 100 V, Australia / NZ 230 V | voltage used by the power calculator (watts ↔ amps) |
| Lighting control (default) | DMX512 / RDM (5-pin XLR), Art-Net (Ethernet), sACN — ANSI E1.31 (Ethernet) | default lighting control |

#### Plan signature (logos)

One logo each for *Contractor* and *Client*. *Choose…* loads an image file, the cross next to it removes the logo. The logos are stored in the project file and appear in the PDF export and in the signature on the canvas.

#### Linked Rentman project

Shows name and ID of the linked Rentman project. If none is linked, a note says that the link is made in the *Integrations* tab.

![Logos and linked Rentman project](bilder/en/einstellungen-04-projekt-logos-rentman.jpg)

#### Cable numbering

Automatic, collision-free cable IDs from a fixed scheme; they appear on the canvas, in the patch list and on the labels.

![Cable numbering and cable length estimation](bilder/en/einstellungen-05-projekt-nummerierung.jpg)

| Option | Effect |
|---|---|
| Auto-assign a number to new cables | every new cable gets the next free number |
| Prefix | text before the number, default "C" |
| Separator | up to two characters between prefix and number, default "-" |
| Digits | number of digits (1 to 6) |
| Start number | first number assigned |
| Separate counter per layer (V/A/N/P …) | counts each cable layer separately |

*Example* shows the number the current scheme produces. *Renumber all cables* reassigns the numbers of all cables according to the scheme; the number of cables is shown in brackets. Without cables the button is disabled.

#### Estimate cable lengths

Estimates lengths from the distance between devices on the canvas: straight line × scale plus slack. The estimate overwrites existing lengths; wireless links are left alone.

| Option | Effect |
|---|---|
| Metres per 100 px | scale of the canvas |
| Slack (%) | surcharge in percent, 0 to 200 |
| Round up to whole metres | rounds every estimated length up |

*Estimate lengths now* runs the estimate and reports how many lengths were changed.

#### Available stock lengths

This is where you record which cable lengths (drums) this production runs. The cable bill of materials splits every run into these lengths — fewest couplers first, least excess second — and reports what the stock cannot cover.

1. Pick the cable type under *Type for a new entry*. The list shows the types used in the plan.
2. *Add length* adds a row with 100 m.
3. Adjust *Cable type*, *Length (m)* and *In stock* in the row. The cross removes the row.

![New stock length added](bilder/en/einstellungen-06-projekt-laenge-hinzugefuegt.jpg)

Leave *In stock* empty when nobody has counted. Empty means "not counted", not zero: the bill of materials only warns about a shortfall somebody actually established.

#### Library Export / Import

![Library Export / Import](bilder/en/einstellungen-07-projekt-library.jpg)

*Export library* saves your own device templates, groups and categories as a JSON file; the counts are shown in brackets. *Import library…* reads such a file. Only new entries are created: a template whose name already exists stays unchanged. The report after the import names the created templates and group presets and the skipped names.

### Modules

Modules show or hide whole feature areas. This only affects the visibility of menu entries, panels and dialogs; saved project data is always kept in full. Canvas, devices, cables, properties and export are always present and are not modules.

![Modules tab](bilder/en/einstellungen-08-module.jpg)

| Module | Contents |
|---|---|
| Festinstallation | lifecycle/service, asset register and QR labels, handover documentation, field feedback |
| Mobile-Companion | phone patch list, plug check, QR scan lookup, field reports |
| Rentman | import/export link to Rentman (catalogue and cable quantities) |
| Rental / Lager | stock, ownership and availability, rental calculation (under construction) |
| NetBox | import a site or rack from a NetBox instance as a cable plan and later add new devices and connections |

Each module has a checkbox *Module enabled*.

### Appearance

![Language, theme and device card colours](bilder/en/einstellungen-09-darstellung.jpg)

| Section | Control | Effect |
|---|---|---|
| Language | *Deutsch* / *English* | interface language, takes effect immediately |
| Theme | *Auto* / *Light* / *Dark* | theme of the whole app including the canvas; *Auto* follows the system |
| Device card colors | per theme (*Light*, *Dark*) colour fields for card body, header strip, border, main text, secondary text; *Reset* per theme | colours of the device nodes. A device colour set on a device still overrides the body value. |
| Default device color | colour field, *Reset* | starting colour of newly added devices; empty: body colour of the theme |

![Port label size, port colours, cable colour, arrows, connection warnings](bilder/en/einstellungen-10-darstellung-portschrift.jpg)

| Section | Control | Effect |
|---|---|---|
| Port label font size | slider, default 11 px, button to reset | font size of the input and output labels on the device nodes; larger is easier to read when zoomed out but makes devices wider |
| Port colours | *By direction (default)* / *By connector type* | colouring of the port handles |
| Cable colour | *Manual* / *By length* / *By discipline* | manual: colour per cable from the properties; by length: length colour coding; by discipline: the layer colours. The colour stored on the cable is kept in every mode. |
| Arrows on cables | *Show arrow at the target end (signal flow direction)* | default for newly drawn cables; changeable per cable in the properties |
| Connection warnings | *Connect any inputs and outputs without warning* | Normally the app asks for confirmation on a connector-type conflict. With this box ticked the connection is created without asking and marked as adapter/converter. |

![Identifier on the device node and canvas background](bilder/en/einstellungen-11-darstellung-kennung-raster.jpg)

| Section | Control | Effect |
|---|---|---|
| Identifier on the device node | *Asset tag* / *Internal number* / *None* | which number of the unit is shown next to the category; shown only where one is entered |
| Canvas background | *Pattern*: *Dots*, *Lines*, *Crosses*, *No grid*; slider *Opacity* | pattern and opacity of the canvas grid. The grid size is set in the *Editing* tab. |

![Custom background image and custom palette](bilder/en/einstellungen-12-darstellung-bild-palette.jpg)

**Custom background image:** *+ Upload image…* loads an image as the canvas background, separately as *Dark-mode image* and *Light-mode image*. Once an image is set, *Replace…* and *Remove image* take the place of the button. *Scaling* chooses between *Cover* (fills completely, crops), *Contain* (fully visible, with margin) and *Tile* (repeated). The grid pattern is drawn on top of the image.

**Custom palette:** *Enable custom palette* shows two colour fields: *Background* and *Grid stroke* of the canvas. They override the defaults of the light and dark themes, but only on the canvas; dialogs keep the theme.

![Connector-type colours](bilder/en/einstellungen-13-darstellung-steckerfarben.jpg)

**Connector-type colors:** one colour field per connector type. The colour is only visible when *Port colours* is set to *By connector type*. An empty field means default; *Reset all* resets every connector colour.

![Device colours per category](bilder/en/einstellungen-14-darstellung-kategoriefarben.jpg)

**Device colors per category:** a default colour per device category for all devices of that category without their own colour. A colour set on the device wins. *Reset all* removes all category colours.

### Editing

![Editing tab, upper part](bilder/en/einstellungen-15-bearbeiten.jpg)

| Section | Control | Effect |
|---|---|---|
| Default cable routing | *Ortho* / *Linie* / *Kurve* | shape of new cables; changeable per cable. *Apply to all existing cables* sets the selected shape on every existing cable (their number in brackets). |
| Grid | *Snap equipment to grid*; *Grid size in pixels (6-60)* | one grid for everything: devices snap to it, port rows sit on it, automatic routing searches on it |
| Inline selection toolbar | *Show inline toolbar on selection* | floating quick actions (align, duplicate, frame, delete) next to the selection on the canvas |
| Label travels with the cable | *Swap port labels on reconnect* | When re-plugging, the new port takes over the user-assigned name of the old port; the old one falls back to the name from the template. Off by default. Only affects ports with a user-assigned name. |

![Editing tab, lower part](bilder/en/einstellungen-16-bearbeiten-unten.jpg)

| Section | Control | Effect |
|---|---|---|
| Cable type follows port connector | *Derive cable type from port connector* | When a port's connector changes (e.g. BNC → XLR), connected cables take the new type, also when re-plugging to a port with a different connector. Cables with a converter hint stay untouched. On by default. |
| Endpoint labels at cable ends | *Show endpoint labels* | small label at each cable end: at the source end "→ target device · target port", at the target end "← source device · source port". Off by default. Works together with "Hide all labels" and the label position of a cable. |
| Cable rendering | *Crossing bridges on orthogonal cables*; *Automatically offset center lines when cables overlap* | bridges where orthogonal cables cross; automatic offset of overlapping centre lines |

### Hotkeys

The tab lists the assignable keyboard shortcuts with their current binding. The action names are currently shown in German.

![Hotkeys tab](bilder/en/einstellungen-17-hotkeys.jpg)

| Action (as shown) | Meaning | Default |
|---|---|---|
| Rückgängig | undo | Ctrl+Z |
| Wiederherstellen | redo | Ctrl+Y |
| Projekt speichern | save project | Ctrl+S |
| Projekt speichern unter… | save project as | Ctrl+Shift+S |
| Neues Projekt | new project | Ctrl+N |
| Projekt öffnen | open project | Ctrl+O |
| Auswahl löschen | delete selection | Delete |
| Alles auswählen | select all | Ctrl+A |
| Auswahl aufheben | clear selection | Escape |
| Library ein-/ausblenden | show/hide library | Ctrl+B |
| Eigenschaften ein-/ausblenden | show/hide properties | Ctrl+I |
| Längen-Legende anzeigen | show length legend | L |
| Zu Patches springen | jump to patches | P |
| Pfeil-Anzeige umschalten | toggle arrows | A |
| Routing umschalten | toggle routing | R |

To rebind a shortcut:

1. Click the field showing the key combination. It shows *Press key…*.
2. Press the desired combination, e.g. Ctrl/Shift/Alt plus a letter or a function key. It is applied at once.

![Field waiting for a key](bilder/en/einstellungen-18-hotkeys-aufnahme.jpg)

The cross next to the field clears the binding; an empty field disables the shortcut. Duplicate bindings are allowed; the first match wins. *Reset to default* restores all defaults.

### Integrations

#### Rentman

![Rentman integration](bilder/en/einstellungen-19-integrationen.jpg)

- *Enable Rentman integration* shows or hides the library tab, menu entries and status badges for Rentman. When off, the app shows only local devices and cables.
- *Rentman API*: field *API token* for the bearer token from your Rentman account. *Save token* stores it encrypted in the operating system keychain, never in the project file. *Test connection* checks it, *Delete token* removes it. Status and *Token stored* show the current state; the endpoint is https://api.rentman.net.
- *Linked Rentman project*: *Link to a Rentman project…* links the open project to a Rentman project. A saved token is required.

#### NetBox

![NetBox integration](bilder/en/einstellungen-20-integrationen-netbox.jpg)

- *Enable NetBox integration* shows or hides the menu entry and import dialog for your own NetBox instance.
- *Instance URL*: base URL of the NetBox instance, applied with *Save*.
- *API token*: token with read access. *Save token* stores it encrypted in the keychain; it never leaves the main process. *Test connection* and *Delete token* as for Rentman.
- *Import site/rack…* opens the import that takes over a site or rack as a cable plan. The app only reads (`/api/dcim/…`).

#### Tally-Pi (direct path)

Sends the tally map from the export dialog straight to the tally Pi instead of downloading a file. The file remains as the way that works without a network path. The Pi keeps its wiring; roles missing from the plan disappear there.

1. Switch on *Allow the direct path to the tally-pi*.
2. Enter the address under *Address of the Pi*.
3. *Check the connection* reports *The Pi answers.* or *No answer.*

![Tally-Pi with the direct path enabled](bilder/en/einstellungen-21-integrationen-tallypi.jpg)

The Pi asks for no credential on this path: whoever can reach it can write to it. Use the direct path only on a network you trust.

#### Fill-in source and AI providers

*Fill-in source (the "Fill in" button)* decides where the *Fill in* button in the create dialog and in the Rentman assistant takes its port groups from:

| Source | Property |
|---|---|
| Web search | Wikipedia and DuckDuckGo, no API key. Source and text excerpt stay stored on the device. |
| AI model | the provider selected below; needs an API key and names itself as the origin, but no source |

Both sources guess and replace no datasheet.

![Fill-in source and AI providers](bilder/en/einstellungen-22-integrationen-ki.jpg)

*AI provider (AI port suggestions)* lists Google Gemini, Anthropic Claude and OpenAI with the model each uses. The radio button makes a provider active. Each provider has its own key field with *Show*/*Hide*, *Save* and delete; *Create key ↗* opens the provider's page. Anthropic Claude also has the field *Workspace ID (only if the API asks for it)*. These keys are stored locally in the app's storage.

#### GreenGo intercom presets

![GreenGo intercom presets](bilder/en/einstellungen-23-integrationen-greengo.jpg)

A library of reusable intercom configurations. *Save current configuration as preset* asks for a name and saves the project's GreenGo configuration with beltpack names, groups and routing; without a GreenGo configuration in the project the button is disabled. Each preset shows its number of users and groups; *Load* applies it to the project after confirmation, *Delete* removes it.

### Device library

The device library is a shared server the planner syncs device templates with and submits its own templates to.

![Device library tab](bilder/en/einstellungen-24-geraetebibliothek.jpg)

**Server:** leave empty to use the default server https://devices.zumpelars.de. *Save* applies a different address; *Restore default* goes back to the default. The line *In use* shows the active server. In the browser edition the sign-in is kept in the browser's storage, in the desktop app in the system keychain.

**Account:** the device library can only be used with an account. Accounts are created on the website, where you confirm your email address and accept the guidelines.

1. Enter *Email or username* and *Password*, then *Sign in*.
2. If two-factor sign-in is set up for the account, the field *Two-factor code from your authenticator app* appears; *Confirm code* completes the sign-in, *Cancel* aborts.

*Create account* and *Forgot password* open the website. When signed in, the section shows name and email address and the button *Sign out*.

**My devices:** templates you created or changed are uploaded and go to moderation first.

- *Upload my own devices automatically* uploads at start and after every change to a template, while you are signed in.
- *Sync now* uploads what changed, then fetches updates. The button requires a sign-in.
- *Own templates (n)* expands the list of your own templates. Each shows its state, e.g. *not uploaded yet*, *changed since the last upload*, *uploaded — waiting for moderation*, *uploaded — live* or *blocked — fix the points below*. If manufacturer or model are missing, fields for them appear below; without both the template is not uploaded.

![List of own templates and sync](bilder/en/einstellungen-25-geraetebibliothek-eigene.jpg)

**Sync:** *Update from device library* fetches only what changed since the last sync (requires a sign-in). The devices appear read-only in the library under *Shared* and stay available offline. Below it are the number of devices stored locally and the time of the last sync. The report names new, updated and removed devices as well as entries skipped because they fail the template check of this app.

### MCP

Through the MCP server Claude queries this plan: devices, ports, signal paths, cables and the result of the plan check. The server runs only in the desktop app, listens only on 127.0.0.1 and requires a pairing token.

![MCP tab, server off](bilder/en/einstellungen-26-mcp.jpg)

1. *Start server* starts the server. The address appears next to it, e.g. *Listening on http://127.0.0.1:4187/mcp*; *Stop server* stops it. While a client is asking, it says *a client is asking*. If the configured port is busy, the server runs on a random port and the line says so.
2. The state is remembered: if the server was running when the app closed, it starts again on the next launch on the same port.
3. *Port* sets the port; it takes effect when the server is next started.

![MCP server running](bilder/en/einstellungen-27-mcp-laeuft.jpg)

**Claude may also change the plan:** a separate switch, off by default. When on, Claude may place library and custom devices, connect and remove cables, set cable details and rack heights, save racks and rename devices. Every call is one undo step and leaves a line in the list *What Claude changed*, which appears in the tab as soon as there are entries. Switching commands to devices (Videohub, ATEM) are never offered. The switch takes effect when the server is next started.

**Pairing token:** *Show pairing token* reveals the token, *New token* creates a new one. The token lives in the operating system credential store. A new token takes effect after the server is restarted, and every client has to be given the new one.

![Pairing token visible](bilder/en/einstellungen-28-mcp-token.jpg)

While the server runs, the tab shows three ready-made templates with address and token, each with *Copy*:

| Template | Purpose |
|---|---|
| Add it to Claude Code | the command `claude mcp add --transport http cable-planner …` |
| JSON for .mcp.json or other clients | configuration block for other clients |
| Without restarting the client: call it with curl | a `curl` call that lists the tools |

![Templates and the note on claude.ai](bilder/en/einstellungen-29-mcp-befehle.jpg)

**claude.ai and the Claude app** cannot reach this computer. For them: put the project into the cloud (*File → Cloud & share link…*), then add a custom connector in claude.ai with the address shown (default: https://devices.zumpelars.de/mcp) and sign in with your device library account. This connector only reads cloud projects and never changes anything.

### Configurations

A library of device configuration files (ATEM, Videohub, GreenGo), independent of the project.

![Configurations tab, empty](bilder/en/einstellungen-30-konfigurationen.jpg)

1. *Choose file…* loads a file (XML, JSON, TXT, CSV or .gg5). The type is guessed from the file name.
2. The file appears in the *Configuration library*, grouped by type.

![Uploaded configuration](bilder/en/einstellungen-31-konfigurationen-hochgeladen.jpg)

Each entry has:

- a name field,
- the type list: *ATEM Multiviewer Layout*, *ATEM Audio-Routing*, *Videohub Labels*, *Videohub Routing*, *GreenGo Intercom (.gg5)*, *Sonstige* (other),
- the device list, which assigns the configuration to a device on the canvas (*(unassigned)* for none),
- the file name, a button *Download original file* and the cross to remove it (with confirmation).

The filter buttons above the list (*All* and one per type, with counts) narrow the view. *Export library as JSON* saves the whole library to one file; *Import JSON library…* reads such a file and asks whether to replace or append to the existing library.

### Cable types

Cable types are the presets the plan offers while drawing: connector, signal standards, colour and maximum length. They belong to the installation, not to a project.

![Cable types tab](bilder/en/einstellungen-32-kabeltypen.jpg)

- **Your own cable types:** *+ New cable type* opens the dialog *New cable type*. Created types are available in every project on this computer and each have *Edit* and *Delete*.
- **Changed built-in types:** a built-in type is never deleted, only overridden. *Reset to the built-in default* puts the shipped values back.

The cable library in the left sidebar can also edit a type in place.

![New cable type dialog](bilder/en/einstellungen-33-kabeltypen-neu.jpg)

| Field | Contents |
|---|---|
| Name | e.g. CAT6a patch 5m |
| Connector type | list of all connector types; *+* creates your own |
| Cable colour | colour field |
| Also compatible with (optional) | further connector types to click |
| Signal standards | standards to click; *+ Standard* creates your own |
| Max. length (m) – optional | maximum length |
| Note (optional) | free text |

*Create* saves the type, *Cancel* discards it.

### Master data

Your own connector types, signal standards and cable layers in one place. They appear in every picker next to the built-in ones and travel with the shared library (Network sync), so a team uses the same names.

![Master data tab](bilder/en/einstellungen-34-stammdaten.jpg)

Each of the three sections *Connector types*, *Signal standards* and *Cable layers* works the same way:

1. Type the name into the input field (e.g. "SMPTE 2110-20" for signal standards).
2. *Add* creates the entry. A name that already exists is not accepted.

![Own signal standard added](bilder/en/einstellungen-35-stammdaten-standard-angelegt.jpg)

Own entries can be renamed (the app asks for the new name) and removed (after confirmation). Renaming an entry also renames it on all ports, cables and library templates that use it.

*Built in (n)* expands the shipped entries. Built in are 127 connector types, 64 signal standards and six cable layers: video, audio, control, network, power, other.

![Built-in cable layers expanded](bilder/en/einstellungen-36-stammdaten-eingebaut.jpg)

### Categories & fields

This is where you create your own device categories and domain fields (e.g. a polar pattern). Own fields appear automatically in the device properties and in the bill of materials and export. Built-in fields are locked (*built-in*).

![Categories & fields tab](bilder/en/einstellungen-37-schema.jpg)

**Choose or create a category:** the *Category* list shows the fields of a category. A new category is created with *New category (DE)*, optionally *Name (EN)*, and *Create category*.

![Fields of the Cameras category](bilder/en/einstellungen-38-schema-unten.jpg)

**Create a field:**

1. *Add field* opens the form *New field*.
2. Enter *Label (DE)*, *Label (EN)* and *Key*.
3. Choose the *Type*: *Text*, *Number*, *Select*, *Yes/No* or *Polar pattern (diagram)*. For *Select*, add at least one choice with *Option*.
4. Optionally *Unit* and *Placeholder*.
5. *Create field* saves, *Cancel* discards.

![New field form](bilder/en/einstellungen-39-schema-neues-feld.jpg)

A key may occur only once per category. Own fields are deleted with the bin icon; a created field is not edited afterwards but deleted and created again. Categories are renamed in the *Advanced* tab.

### Network sync

The tab holds two separate ways of working together: live collaboration and the shared sync directory.

#### Live collaboration (beta)

Several planners edit the same plan in real time. Changes are merged without a server, even after a brief disconnect.

![Live collaboration, mode This device](bilder/en/einstellungen-40-sync.jpg)

| Field | Contents |
|---|---|
| Your display name | the name the others see |
| Mode | *This device (multiple windows)* or *Network (LAN/WAN, P2P)* |
| Room name | name of the shared room |

In *Network* mode further fields appear:

| Field | Contents |
|---|---|
| Signaling server | empty: wss://relay.zumpelars.de; it only sees connection metadata, never the plan |
| Local only | no remote relay, nothing leaves the LAN |
| Room password (optional) | encrypts the room |
| STUN/TURN servers (optional) | one server per line: `URL|user|password`; only needed when the other side sits in a different network. The credentials stay on this computer and are not part of the invite link. |

Without a room password the room is unencrypted: anyone who knows the room name and signaling server or finds the session on the LAN can read the entire project.

![Network mode](bilder/en/einstellungen-41-sync-netzwerk.jpg)

*Sessions on the network*: *Search the network* looks for running sessions on the local network (desktop app only). Sessions found have a *Join* button. Joining adopts the host's plan and, after confirmation, replaces your own.

*Start session* opens the session. The section then shows *Connected — changes are shared live*, the participants in the room and the button *Copy invite*, which puts an invite link on the clipboard. *Leave* ends your participation.

![Running session](bilder/en/einstellungen-42-sync-session-aktiv.jpg)

#### Sync directory

A shared directory (mapped FTP drive, network path or local folder) in which project, library and presets are exchanged as JSON files. This path requires the desktop app.

1. Enter the *Sync directory*.
2. Enter *User name (for lock display)*; the others see it while you hold the lock on the directory.
3. *Save*. *Reset* restores the saved values.

![Entering the sync directory](bilder/en/einstellungen-43-sync-verzeichnis.jpg)

With a directory set, the buttons *Push* and *Pull* appear in the header bar:

- *Push* writes `cable-planner.project.json`, `cable-planner.library.json` and `cable-planner.presets.json` to the directory.
- *Pull* loads these files into the current state. If the directory holds no sync files, the app says so.
- A lock file (`.cable-planner-sync.lock`) prevents simultaneous overwrites; it expires after two hours. If the directory is locked, the message names whoever holds the lock.

![Push and Pull in the header bar](bilder/en/einstellungen-45-sync-kopfleiste.jpg)

**Shared library (workgroup):** *Sync library now* syncs device templates, groups and categories with the file `cable-planner.library.json` in the sync directory. Matching is by name; local templates are never overwritten. The message names what was pulled and shared, and name conflicts where the local version was kept.

![Shared library with a directory set](bilder/en/einstellungen-44-sync-gespeichert.jpg)

### Credentials

Qualifications, insurance and safety briefings of the person using the app, each with an expiry date. They belong to the person, not to the plan, and never go into a project file.

![Credentials tab](bilder/en/einstellungen-46-nachweise.jpg)

**Adding a credential:**

1. *Credential* opens the form.
2. Choose the *Kind*. The list currently shows the German names: Qualifikation (qualification), Versicherung (insurance), Unterweisung (safety briefing), Ausweis (ID card), Sonstiges (other).
3. Enter the *Name* (required), optionally *Issued by*, *Number*, *Issued on*, *Valid until* and *Scan file name*.
4. *Save*.

![Credential form](bilder/en/einstellungen-47-nachweise-formular.jpg)

Without *Valid until*, a credential does not count as open-ended but as "no expiry stated"; the cover sheet says exactly that. Each entry shows its state, kind and expiry with the remaining days and has *Edit* and *Delete*.

**Advance warning:** the number of *days* before expiry from which a warning is given. Below it are the credentials that expire within that window. With no figure, nothing is reported.

**Cover sheet:** saves a CSV file `nachweise-deckblatt.csv` with all credentials (kind, name, issuer, number, valid until, state, file) and summary lines for expired credentials, credentials without expiry and credentials without a named file. The column headings of this file are in German. Without credentials the button is disabled.

![Credential entered, with advance warning](bilder/en/einstellungen-48-nachweise-eingetragen.jpg)

### Advanced

![Advanced tab](bilder/en/einstellungen-49-erweitert.jpg)

**Autosave:** *Autosave interval (ms)* sets how often the project is saved automatically to local storage. Default 400 ms.

**Category management:** the table lists all library categories with their number of templates.

- *Rename* opens the dialog *Rename category* with one field each for *English* and *German*. The matching name is shown for the current interface language; an empty field falls back to the other language. If the name changes, all assigned templates and placed devices move along. *OK* applies.
- *+ New category* creates a category with the same dialog.

![Rename category dialog](bilder/en/einstellungen-50-erweitert-umbenennen.jpg)

**Caches & local data:** *Clear Rentman template cache* and *Clear web search history* clear the respective cache after confirmation; it is reloaded on demand, project data is not lost. *Show welcome dialog on next start* shows the welcome dialog again on the next start, after confirmation.

**Data export:** *Export all localStorage data* saves all data the app stores locally as a JSON file, for example to move it to another computer.

![Caches and data export](bilder/en/einstellungen-51-erweitert-unten.jpg)
