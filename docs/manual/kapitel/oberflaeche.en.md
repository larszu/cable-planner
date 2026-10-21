## The interface

### Main window layout

![Main window with the example project](bilder/en/oberflaeche-01-start.jpg)

The main window has five areas:

| Area | Position | Contents |
|---|---|---|
| Header | top | menus *File*, *Edit*, *Tools*, *View*, *Help*, project name, undo/redo, theme button, *Phone access*, *Settings* |
| Library | left | equipment, cables, groups and racks to place in the plan |
| Canvas | centre | the plan with devices and cables, toolbar, search field, zoom buttons, overview map |
| Inspector | right | properties of the selection |
| Status bar | bottom | figures and notices about the project |

#### Header

![Header](bilder/en/oberflaeche-02-menueleiste.jpg)

Clicking the project name in the centre opens the dialog *Edit project metadata*.

![Edit project metadata](bilder/en/oberflaeche-10-projektname-klick.jpg)

| Field | Effect |
|---|---|
| Project name (required) | name in the header, status bar and printouts |
| Contractor (company), Client, Planner / author, Project / job no. | details for the plan footer |
| Event/rental start, Event/rental end | period of the job |
| Description | free text |
| Company logo, Client logo | image file via *Choose logo…* |

These fields appear in the plan footer when exporting to PDF. *Save* applies them, *Cancel* discards them.

The undo and redo buttons sit on the right of the header. They are greyed out while there is no step to take.

![Undo and redo in the header](bilder/en/oberflaeche-31-kopfleiste-rechts.jpg)

In a narrow window the header contracts; the menus stay available.

![Header in a narrow window](bilder/en/oberflaeche-81-schmal-kopfleiste.jpg)

#### File and Tools menus

The *File* menu holds new, open, save, the imports and the exports. Its entries are described in the chapters [File and Import](#file-and-import) and [Export & Print](#export--print).

![File menu](bilder/en/oberflaeche-07-menue-datei.jpg)

The *Tools* menu is divided into groups, among them *Calculate*, *Check* and *Plan*. The tools are described in the tools chapters.

![Tools menu](bilder/en/oberflaeche-08-menue-werkzeuge.jpg)

#### Inspector with nothing selected

With nothing selected, the inspector shows *Nothing selected*, the block *Photos of the project* with *Add photo…* and *Quick orientation* with four starting hints.

![Inspector with nothing selected](bilder/en/oberflaeche-05-inspector-leer.jpg)

### Arranging the side panels

The library and the inspector can be collapsed, undocked, moved into a window of their own and resized.

#### Window menu

1. Click *Window* at the top of the side panel.

   ![Window menu of the library](bilder/en/oberflaeche-11-fenster-bibliothek-menue.jpg)

2. Choose *Undock (floating)*. The library floats above the canvas as a movable panel. *Dock* puts it back in place.

   ![Library undocked](bilder/en/oberflaeche-12-bibliothek-abgedockt.jpg)

*Open in its own window* opens the side panel as a separate application window. The *Window* button can also be dragged. The menus of the inspector and of the annotations panel offer the same entries.

#### Collapsing and width

- The arrow button next to *Window* collapses the side panel. Clicking the arrow at the edge expands it again.

  ![Library collapsed](bilder/en/oberflaeche-14-bibliothek-eingeklappt.jpg)

  ![Inspector collapsed](bilder/en/oberflaeche-17-inspector-eingeklappt.jpg)

- The divider between side panel and canvas can be dragged with the mouse to change the width.

  ![Library widened](bilder/en/oberflaeche-19-trennleiste-gezogen.jpg)

- **Ctrl+B** hides and shows the library, **Ctrl+I** the inspector.

The **P** key opens the patch list.

![Patch list after pressing P](bilder/en/oberflaeche-23-tastatur-patchliste-p.jpg)

### Edit menu

![Edit menu](bilder/en/oberflaeche-24-bearbeiten-menue.jpg)

| Entry | Shortcut | Effect |
|---|---|---|
| Undo | Ctrl+Z | reverts the last step |
| Redo | Ctrl+Y | restores the reverted step |
| Duplicate | Ctrl+D | copies the selected elements |
| Delete selection | Del | deletes the selected elements |
| Select all | Ctrl+A | selects all elements of the plan |
| Clear selection | Esc | clears the selection |

![Everything selected](bilder/en/oberflaeche-25-bearbeiten-alles-auswaehlen.jpg)

### View menu

![View menu](bilder/en/oberflaeche-34-ansicht-menue.jpg)

#### Zoom

| Entry | Effect |
|---|---|
| Fit to view | zooms so that all elements are visible |
| Zoom 100 % | sets the zoom to 100 % |
| Zoom in | zooms in |
| Zoom out | zooms out |
| Fullscreen | switches the window to fullscreen and back |

The current zoom level is shown in the status bar.

#### Theme

| Entry | Effect |
|---|---|
| Theme: follow system | light or dark according to the operating system |
| Light theme | always light |
| Dark theme | always dark |

The same choice is offered by the theme button in the header (sun, moon or screen) and by *Settings → Appearance*. The choice is remembered.

![Light theme](bilder/en/oberflaeche-40-ansicht-helles-design-aus.jpg)

#### Grid and labels

| Entry | Effect |
|---|---|
| Snap to grid | devices snap to the grid while being moved |
| Hide cable labels | hides the labels on the cables |
| Show off-page names | shows the cable number or cable name on off-page connectors permanently; without the option it appears only on mouse-over |

A check mark in front of the entry shows that the option is on.

![Cable labels hidden](bilder/en/oberflaeche-45-ansicht-labels-aus.jpg)

#### Color cables by length

*Color cables by length* colours the cables with the broadcast length colour code. The stored colour of each cable stays unchanged; a second click switches back.

| Length | Colour |
|---|---|
| 1 m | red |
| 2 m | yellow |
| 3 m | green |
| 5 m | white |
| 10 m | red |
| 20 m | yellow |
| 25 m | yellow/white dashed |
| 50 m | white |
| 100 m | red |

Cables of any other length appear grey.

![Cables of 1, 2, 3 and 5 m coloured by length](bilder/en/oberflaeche-53-ansicht-farbe-laenge-regel.jpg)

#### Color cables by discipline

*Color cables by discipline* colours each cable by its discipline: Video blue, Audio red, Control orange, Network green, Power violet, Other grey. Here too the stored colour stays unchanged. The two colour modes exclude each other.

![Cables coloured by discipline](bilder/en/oberflaeche-54-ansicht-farbe-gewerk-vergleich.jpg)

#### Search field, toolbar and panels

| Entry | Shortcut | Effect |
|---|---|---|
| Find device | Ctrl+F | shows and hides the search field above the canvas |
| Canvas toolbar | | shows and hides the canvas toolbar |
| Annotations panel | | opens and closes the *Annotations* panel |
| Floor plan | | shows and hides the floor plan panel |
| Symbols | | shows and hides the symbols panel |

![Canvas without toolbar](bilder/en/oberflaeche-58-ansicht-werkzeugleiste-aus.jpg)

The *Annotations* panel appears on the right. It filters by status with *all*, *offen*, *gebaut* and *erledigt*; *+ New annotation* creates an annotation. *Close* hides it.

![Annotations panel](bilder/en/oberflaeche-60-ansicht-anmerkungen-an.jpg)

### Help menu

![Help menu](bilder/en/oberflaeche-83-hilfe-menue.jpg)

| Entry | Shortcut | Effect |
|---|---|---|
| Command palette… | Ctrl+K | opens the command palette |
| Keyboard shortcuts… | ? | opens the keyboard shortcut overview |
| Getting-started tour… | | starts the tour of the interface |
| Check for updates… | | asks for a newer version and reports the result |
| About LZ Cable Planner… | | opens the dialog with version and build |

#### Command palette

![Command palette](bilder/en/oberflaeche-84-hilfe-befehlspalette.jpg)

The command palette lists the commands from *Edit*, *View*, *File*, *Tools* and *Help*; each command shows its group on the right, some a short description below. Commands of disabled modules are left out.

1. Open the palette with **Ctrl+K** or via *Help → Command palette…*.
2. Type one or more search words. The search checks command name, group, short description and stored synonyms; every word must occur. Matches in the command name come first.

   ![Search for “zoom”](bilder/en/oberflaeche-87-palette-suche-zoom.jpg)

3. Pick a command with the arrow keys and run it with **Enter**.

Synonyms work in both languages: *qr*, for example, finds *Share to phone…*.

![Search for “qr”](bilder/en/oberflaeche-88-palette-suche-synonym.jpg)

If nothing matches, the list shows *No commands found*.

![No matches](bilder/en/oberflaeche-89-palette-keine-treffer.jpg)

#### Keyboard shortcuts

*Help → Keyboard shortcuts…* or the **?** key opens the overview.

![Keyboard shortcuts, keyboard view](bilder/en/oberflaeche-94-hilfe-tastenkuerzel.jpg)

The *Keyboard* view shows a keyboard; highlighted keys have an action, shown on mouse-over or click. The *List* view lists all shortcuts. They include:

| Shortcut | Action |
|---|---|
| Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S | New project, Open, Save, Save as |
| Ctrl+C, Ctrl+V | Copy, Paste |
| Ctrl+K | Command palette |
| Ctrl+F | Find device |
| Ctrl++ | New device at cursor |
| Ctrl+B, Ctrl+I | Show/hide library or inspector |
| P | Open patch list |
| A | Toggle arrow display |
| ? | this overview |

#### Getting-started tour

The tour takes five steps through the interface: Library on the left, Properties on the right, Plan check, Export menu, Find any function. *Next* and *Back* page through it, *End tour* stops it. On the last step *Open command palette* ends the tour and opens the command palette. On the first start the tour opens by itself.

![First step of the tour](bilder/en/oberflaeche-96-hilfe-tour-1.jpg)

#### About LZ Cable Planner

![About LZ Cable Planner](bilder/en/oberflaeche-103-hilfe-ueber.jpg)

The dialog shows:

- Version
- Build: date and time the program was built
- Author
- Repository (github.com/larszu/cable-planner)
- Platform (Electron, React, ReactFlow, Vite, Tailwind)
- the note to report issues and feature requests on GitHub

The same dialog opens when you click the version number on the right of the status bar.

### Status bar

![Status bar](bilder/en/oberflaeche-06-statusleiste.jpg)

From left to right the status bar shows:

| Element | Meaning | Click |
|---|---|---|
| Project name | name of the project | |
| devices, cables | count in the plan | |
| frames | number of room frames | |
| packed | devices marked as packed in their properties, e.g. *0/5 packed*; grey for none, yellow for some, green for all | |
| Complexity | size estimate of the plan | |
| Plan check | result of the running plan check | opens the plan check |
| Rentman | connection to Rentman | |
| Zoom | current zoom level | |
| Version | program version | opens *About LZ Cable Planner* |

In a narrow window the status bar hides frames, packed and Rentman.

#### Complexity

The badge adds up devices and cables:

| Sum | Badge |
|---|---|
| below 8 | New |
| from 8 | Small |
| from 30 | Medium |
| from 80 | Large |
| from 200 | XL |

The badge is only a guide to readability and working speed.

![Complexity XL with 115 devices and 92 cables](bilder/en/oberflaeche-70-status-komplexitaet-xl.jpg)

#### Plan check

The badge has three states:

| Colour | Meaning |
|---|---|
| green, *OK* | no findings |
| yellow with a number | warnings only |
| red with a number | at least one error |

The number is the sum of errors and warnings.

![Plan check with one warning](bilder/en/oberflaeche-71-status-plancheck-warnung.jpg)

![Plan check with errors](bilder/en/oberflaeche-73-status-plancheck-fehler.jpg)

A click opens the plan check with all findings. Clicking a finding selects the affected element.

![Plan check open](bilder/en/oberflaeche-72-status-plancheck-klick.jpg)

#### Notices that appear only when needed

| Badge | Appears when | Click |
|---|---|---|
| *Network* with a number | there are network findings: missing or duplicate addresses, masks, segments | opens the analyses on the network tab |
| *No recovery copy* | the browser store refused the project's recovery copy; the plan itself is not affected, save it to a file | |
| *Photos* with MB | the photos in the plan exceed 40 MB; the file still opens but is hard to send by mail | |
| *Due* with a number | returns, check-outs, hours, receipts or costs are overdue or due today | opens the analyses on *What is due* |
| *Live* with participant count | a live collaboration is running | opens the settings on the network sync tab |
| *MCP* | the local MCP server is running; next to it *· read only* or *· can edit*, during an active request *MCP · asking* | opens the settings on the MCP tab |

![Network findings](bilder/en/oberflaeche-74-status-netz-befunde.jpg)

![No recovery copy](bilder/en/oberflaeche-79-status-keine-sicherungskopie.jpg)

![Photos above 40 MB](bilder/en/oberflaeche-77-status-fotos.jpg)

#### Rentman indicator

The Rentman indicator appears only when the Rentman module is enabled. It shows the name of the linked Rentman project, otherwise *Token ready* when an access token is stored, otherwise *Standalone*.

![Linked Rentman project](bilder/en/oberflaeche-78-status-rentman-projekt.jpg)

### Phone access

The *Phone access* button in the header opens the dialog *Mobile access*. It starts a small web server on the local network; a phone opens the mobile view of the project via the QR code.

![Mobile access dialog](bilder/en/oberflaeche-105-handy-dialog.jpg)

| Element | Effect |
|---|---|
| Feedback from the phone: *Read only* | the phone cannot write anything back |
| Feedback from the phone: *Contribute: ticks, cables, photos, new devices* | the phone may send back ticks, cables, photos and new devices |
| *Start LAN server* | starts the server and shows the QR code |
| *Make system access codes retrievable* | releases intercom access codes via a second code; selectable only for projects with an intercom configuration |
| *Security notes* | expands the security notes |

The server stops when the app closes or via the Stop button. The mobile view is described in the chapter [Web edition and tablet](#web-edition-and-tablet).

![Security notes](bilder/en/oberflaeche-107-handy-sicherheitshinweise.jpg)

### First start

On the first start with an empty project the dialog *Welcome — what are you planning?* appears.

![Start dialog](bilder/en/oberflaeche-109-erststart-startdialog.jpg)

1. Optionally choose one or more use cases. They enable the matching modules:

   | Use case | enables the modules |
   |---|---|
   | Show / Event | Mobile-Companion, Rentman |
   | Fixed installation | Fixed installation, Mobile-Companion, NetBox |
   | Rental | Rental / Stock, Rentman |

   ![Use case selected](bilder/en/oberflaeche-110-erststart-auswahl.jpg)

2. Choose how to begin:

   | Button | Effect |
   |---|---|
   | New project | opens the project metadata for a new project |
   | Load example project | loads the example project and fits the view |
   | Open project… | opens an existing `.cableplan` file |
   | Decide later | closes the dialog |

   Without a use case the modules stay as they are. Everything can be changed under *Settings → Modules*.

3. The [Getting-started tour](#getting-started-tour) starts afterwards.

   ![Tour after the start dialog](bilder/en/oberflaeche-112-erststart-tour.jpg)
