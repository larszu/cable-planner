## File and Import

The *File* menu has four parts. At the top are creating, opening and saving a project. Below them come the imports (*Import yEd / GraphML*, *Import MultiCam cameras*, *Import equipment from CSV*, *Rentman import*, *NetBox import*) and the exchange of whole projects (*.avplan*, *.avsourcemap*). Next come the outputs *Patch list…*, *Fixed install: docs & handover…*, *Stage plot*, *Export & Print…*, the cloud, the viewer file and the Rentman entries. The chapter *Export & Print* describes these outputs. *Rentman import…* and *NetBox import…* appear in the menu only when the integration is switched on under *Settings → Integrations*. *View linked venue plan…* appears only when the project contains a linked venue plan.

![The File menu](bilder/en/datei-import-01-menue-datei-offen.jpg)

### New project

*File → New project* (`Ctrl+N`) opens the *New project* form. It needs a project name; without one *Create project* stays disabled. If the current plan contains devices, cables or locations, a notice at the top says that a new project discards the current one and unsaved changes are lost. With an empty plan the notice is absent.

![New project form with the warning](bilder/en/datei-import-64-neu-dialog-mit-warnung.jpg)

Besides the name, the form asks for *Contractor (company)*, *Client*, *Planner / author*, *Project / job no.*, *Event/rental start*, *Event/rental end*, *Description*, *Company logo* and *Client logo*. These entries appear in the title block at the bottom right of the PDF export. You can change them later with *Edit project metadata* in the header bar.

![Filled-in form](bilder/en/datei-import-65-neu-dialog-ausgefuellt.jpg)

*Create project* replaces the current plan with an empty one that carries these entries. With an empty plan the form shows no warning.

![Form without the warning](bilder/en/datei-import-66-neu-dialog-ohne-warnung.jpg)

### New from template

*File → New from template…* opens the *New from template* dialog. It loads a copy of the chosen template as a new project.

![New from template dialog](bilder/en/datei-import-02-vorlagen-dialog.jpg)

Under *Bundled templates* there are five show setups. Each card gives the number of devices, cables and locations.

| Template | Content |
|---|---|
| *OB van* | OB van with stage and FOH, separate location frames |
| *TV-Studio* | Studio with control room and studio floor |
| *Live stage* | Stage, FOH and monitor world for live events |
| *Konferenz / Corporate* | Hall and control room for conferences and corporate events |
| *Houses of Worship* | Sanctuary/stage and tech gallery for church services |

Under *My templates* are the templates you saved yourself. They live in the local storage of this app on this computer, not in the project file.

**Loading a template**

1. Click *Use*. If the current plan has content, *Discard current project?* asks first. *Load template* confirms.

   ![Confirmation before loading](bilder/en/datei-import-61-vorlagen-verwenden-rueckfrage.jpg)

2. Enter the name of the new project. The template name is pre-filled.

   ![Name of the new project](bilder/en/datei-import-62-vorlagen-verwenden-name.jpg)

3. *Template loaded* reports the new project. It is unsaved and has no file path yet.

   ![Template loaded message](bilder/en/datei-import-63-vorlagen-verwenden-geladen.jpg)

If a venue template brings answers for a different venue than the current project carries, *Answers from a different venue* asks before the name. *Load anyway* continues.

**Saving the current project as a template**

*Save current project as template* asks for the template name; the project name is pre-filled.

![Template name](bilder/en/datei-import-57-vorlagen-eigene-speichern-name.jpg)

If the project carries venue-bound entries, that is answers from the venue's IT or the address, *Bind this template to the venue?* asks. *Neutral (shape only)* leaves them out. *For this venue* takes them along and records which venue they apply to. Without venue-bound entries the question is skipped.

![Venue question](bilder/en/datei-import-56-vorlagen-haus-frage.jpg)

*Saved as template* confirms.

![Saved as template message](bilder/en/datei-import-58-vorlagen-eigene-gespeichert.jpg)

The template then appears under *My templates*. A venue template shows *Venue template* with the venue and the number of answers; one made from the as-built shows *Basis*. The bin icon on the card deletes the template after a confirmation.

![My templates](bilder/en/datei-import-59-vorlagen-eigene-liste.jpg)

![Delete confirmation](bilder/en/datei-import-60-vorlagen-eigene-loeschen-frage.jpg)

**As-built as template**

*As-built as template* takes not the current plan but the state committed as "as built". The button is always active; its hint names the difference. The dialog first asks for the template name.

![Template name from the as-built](bilder/en/datei-import-03-vorlagen-as-built-frage.jpg)

If no as-built is committed, *No as-built committed* refuses: commit an as-built revision first, otherwise the template would be the plan from before load-in under another name. The chapter *Tools: Build* describes revisions. With a committed as-built the dialog reports *Template … created from the as-built …*.

![Refusal without an as-built](bilder/en/datei-import-04-vorlagen-as-built-abgelehnt.jpg)

### Open

*File → Open…* (`Ctrl+O`) opens the operating system's file dialog. It shows files with the extensions `.cableplan`, `.json` and `.cpviewer`. The chosen file replaces the current plan in the window.

The app checks the file before loading it. It rejects valid JSON that contains no equipment and cable list. *This file is not an LZ Cable Planner project* reports this; the open plan stays unchanged.

![Message: not a project](bilder/en/datei-import-05-oeffnen-kein-plan.jpg)

A `.cpviewer` file, or a project with the mode *viewer*, opens as a review file. First *Viewer file — enter name* asks for your name. It is attached to every annotation you create in this session.

![Name prompt for the viewer file](bilder/en/datei-import-06-oeffnen-viewer-name.jpg)

Without a name the app does not load the file. *Name missing* says that without a name no annotations can be made. The chapter *Export & Print* describes how to create viewer files and bring annotations back.

![Name missing message](bilder/en/datei-import-07-oeffnen-viewer-name-leer.jpg)

If the opened project is named *Untitled Project* or has no name, the app takes the file name as the project name.

### Save and Save as

*File → Save* (`Ctrl+S`) writes the project to its file. If the project has no file path yet, the *Save as* dialog opens first. The app appends `.cableplan` unless you give `.cableplan` or `.json`.

*File → Save as…* (`Ctrl+Shift+S`) writes the project under a new name or path. The new project is then the active one; the earlier file stays unchanged. The file name becomes the new project name.

Every write is atomic. The app writes a temporary file first, renames the previous file to `<name>.cableplan.bak` and then puts the temporary file in its place. After the second save the `.bak` file with the previous state therefore sits next to the project file. An interruption in the middle of writing destroys neither the old nor the new file.

### Autosave and status bar

Independently of saving to a file, the app continuously backs up the open plan in the program's local storage. After a change it waits briefly before writing; the default is 400 ms. The interval is under *Settings → Advanced* in the field *Autosave interval (ms)*. At the next start the app loads this backup again if it is valid.

![Settings, Advanced, with the autosave interval](bilder/en/datei-import-55-einstellungen-autosave.jpg)

Local storage holds only about 5 MB. If the plan gets larger, the storage refuses the backup. The status bar at the bottom then shows *No recovery copy*. Hovering over it gives the size of the plan. Nothing is missing from the plan itself; save to a file. As soon as a backup succeeds again, the indicator disappears.

![Status bar in the normal state](bilder/en/datei-import-53-statusleiste-normal.jpg)

![Status bar with the No recovery copy indicator](bilder/en/datei-import-54-statusleiste-ohne-sicherungskopie.jpg)

### The `.cableplan` file format

A `.cableplan` file is a JSON document. The app writes it with two-space indentation. The top-level fields are `metadata` (name, description, timestamps, defaults, `projectId`), `equipment`, `cables`, `locations`, `canvasState`, `floors`, `revisions`, `changelog`, `sourceIdentities`, `tallyPositions`, `patternChecks`, `hubSwitches`, `cableStock`, `ledPanelTypes`, `ledWalls`, `fotos` and further ones for standards, report templates, address layers and delivery destinations. New fields get a default value on load, including in older files. Photos are stored in the file; with many photos it grows accordingly.

Passwords and keys of external services (Rentman, NetBox, device library, stream keys) are not in the file but in the operating system's keychain.

### Import yEd / GraphML

*File → Import yEd / GraphML…* reads a diagram from yEd or another GraphML file. Nodes become devices, connector cells become ports and edges become cables. The dialog first shows a preview; nothing enters the plan until you start the import.

![Dialog without a chosen file](bilder/en/datei-import-08-graphml-dialog-leer.jpg)

*Pick file…* opens the file dialog. The parser needs about 250 ms per MB. Afterwards the dialog header shows the file name, the number of nodes and edges and the counters *Devices*, *Cables*, *Skipped* and *Edges without target*. *Devices: 3/3* means three of three devices are selected for import. *Another file* returns to the file choice.

![Preview with the yEd drawing](bilder/en/datei-import-09-graphml-vorschau-yed.jpg)

The *yEd preview* tab shows the drawing as read. The mouse wheel zooms, dragging pans. The *Devices* tab lists the detected devices.

![Devices tab](bilder/en/datei-import-10-graphml-reiter-geraete.jpg)

| Column | Meaning |
|---|---|
| Checkbox | import the device or leave it out |
| *Name* | name from the diagram; editable in the field |
| *Category* | detected category; editable in the field |
| *IP* | the IP address found in the diagram |
| *In/Out* | number of detected inputs and outputs |
| *Status* | detection confidence: *HIGH* when a name and at least one port are detected, *MED* when the name is detected but no port, *LOW* when no name could be determined |

A deselected device is greyed out. The import does not take its cables.

![Device deselected](bilder/en/datei-import-11-graphml-geraet-abgewaehlt.jpg)

Name and category can be changed before the import.

![Name and category changed](bilder/en/datei-import-12-graphml-geraet-umbenannt.jpg)

The *Cables* tab shows *Source*, *Target*, *Type*, *Standard* and *Length* for every edge. The app derives the type from the label. If a length is missing, the import sets 1 m. The import takes the bend points of the lines from yEd as waypoints of the cables.

![Cables tab](bilder/en/datei-import-13-graphml-reiter-kabel.jpg)

![Cable deselected](bilder/en/datei-import-14-graphml-kabel-abgewaehlt.jpg)

The field *Filter: name / IP / category / cable type* at the top right hides rows that do not match.

![Filter set to HDMI](bilder/en/datei-import-15-graphml-filter.jpg)

The *Skipped* tab names what is not imported. *Nodes skipped* lists nodes such as legends and decorative shapes, with the reason. *Edges with unresolved ports* lists edges whose ends could not be assigned to a connector.

![Skipped tab](bilder/en/datei-import-16-graphml-reiter-uebersprungen.jpg)

**Target and mode**

*Target* decides where the import writes.

- *Canvas* places the devices with their cables in the plan.
- *Library* stores the devices only as reusable templates in the local library. Cables and canvas placement are left out.

![Target Library with the hint](bilder/en/datei-import-17-graphml-ziel-bibliothek.jpg)

With *Canvas* the *Mode* also applies. *Append to project* adds the devices and cables to the plan. *Replace GraphML import* replaces only devices that an earlier GraphML import created; devices you added by hand stay untouched.

![Mode Replace GraphML import](bilder/en/datei-import-18-graphml-ziel-canvas-ersetzen.jpg)

The button at the bottom right names what will happen, for example *3 devices & 2 cables onto canvas* or *2 devices into library*. The import onto the canvas is a single step for *Undo*. Afterwards the app selects the first new device and shows the area with the imported devices.

![Plan after the import](bilder/en/datei-import-20-graphml-import-ergebnis.jpg)

When importing into the library, *Added to the library* reports how many devices were created and which names already existed. The import never overwrites existing templates.

![Message after the import into the library](bilder/en/datei-import-21-graphml-bibliothek-ergebnis.jpg)

On a second run with the same file, the import creates nothing and names the existing ones.

![Second import into the library](bilder/en/datei-import-22-graphml-bibliothek-zweites-mal.jpg)

If you click the background outside the dialog, *Discard import?* asks: anything not yet applied here will be lost. *Keep editing* returns, *Discard* closes. The cross at the top right closes the dialog without a question.

![Discard import prompt](bilder/en/datei-import-19-graphml-hintergrund-rueckfrage.jpg)

A file that is not valid XML shows *Import failed* with the file name and the parser's message.

![Error message for an invalid file](bilder/en/datei-import-23-graphml-datei-ohne-inhalt.jpg)

### Import MultiCam cameras

*File → Import MultiCam cameras…* opens the file dialog directly; there is no dialog of its own. It reads the camera list (`camera-list`, version 1 to 3) that the MultiCam planner exports. Each entry becomes a device of the category *Kameras*.

If the model clearly matches a catalog entry, the camera inherits its connectors. If it does not match clearly, the camera stays without ports and counts as "ports unknown". The app does not invent connectors; the plan check then asks for the datasheet values.

A message gives the result: *MultiCam cameras: 2 new, 0 updated, 0 unchanged.*

![Message after the first import](bilder/en/datei-import-30-multicam-erster-import.jpg)

A further import is a reconciliation, not an append. The app recognises cameras by their origin in the MultiCam plan. From the list it takes the name, the optics and, from version 3, the PTZ presets. Position, ports and cables stay as you set them. Cameras that are no longer in the MultiCam plan are marked and not deleted, because cables may hang on them. If the model has changed, ports and cables are kept; you swap the body via *Choose another device…* in the properties.

![Message after the reconciliation](bilder/en/datei-import-31-multicam-zweiter-import.jpg)

A file that is not a valid camera list reports *Camera import failed — not a valid MultiCam camera list.*

![Error message](bilder/en/datei-import-32-multicam-fehler.jpg)

### Import equipment from CSV

*File → Import equipment from CSV…* creates device templates in the local library. Only templates are created; nothing is placed on the canvas.

![Dialog without content](bilder/en/datei-import-24-csv-dialog-leer.jpg)

You paste the CSV text into the field or choose a file with *Choose CSV file…*. The first row holds the column headings. The separator is a semicolon or a comma, whichever occurs more often in the header row. The app reads quotation marks and a BOM at the start of the file.

![Pasted CSV text with the preview](bilder/en/datei-import-25-csv-eingefuegt.jpg)

The app assigns the headings to a field. The whole text is compared in lower case, not a fragment.

| Field | recognised headings |
|---|---|
| Name | `name`, `gerät`, `geraet`, `device`, `bezeichnung`, `artikel` |
| Category | `kategorie`, `category`, `typ`, `type`, `gruppe` |
| Power (W) | `watt`, `watts`, `leistung`, `power`, `w` |
| Weight (kg) | `gewicht`, `weight`, `kg` |
| Serial number | `seriennummer`, `serial`, `s/n`, `sn` |
| Asset tag | `asset-tag`, `asset tag`, `assettag`, `asset_tag`, `inventarnummer`, `inventar-nr`, `inventar-nr.` |
| Internal number | `interne nummer`, `interne nr`, `interne nr.`, `internal number`, `internal no`, `internal no.`, `hausnummer` |
| IP | `ip`, `ip-adresse`, `ipaddress`, `ip address`, `ip adresse` |
| Rack units | `he`, `rackunits`, `ru`, `höheneinheiten`, `hoeheneinheiten` |
| Subtitle | `untertitel`, `subtitle`, `hersteller`, `manufacturer`, `marke`, `brand` |

A device with rack units counts as a rack device. If the category is missing, the app sets *Imported*. If the name column is missing, the first column counts as the name.

The box *What happens to the rest* lays open what does not arrive as a field:

- Columns without an assignment go into the device's notes, as lines of the form `Heading: value`. Empty cells are dropped.
- A second column on the same field loses the assignment: the first wins, the second becomes a note.
- Rows without a name are skipped; the box names their row numbers.
- Names that already exist in the library stay unchanged. This also applies to names that occur twice in the file: only the first row counts.

The button *Import 2* gives the number of new templates. Afterwards *CSV imported* reports how many devices were created, how many names already existed and how many rows without a name were skipped.

![CSV imported message](bilder/en/datei-import-26-csv-import-ergebnis.jpg)

![New templates in the library](bilder/en/datei-import-27-csv-in-bibliothek.jpg)

If you repeat the import with the same names, the templates stay unchanged and the dialog lists the existing names.

![Second import with existing names](bilder/en/datei-import-28-csv-zweiter-import-vorhanden.jpg)

The file can also come through *Choose CSV file…*; the content lands in the same field.

![Dialog after choosing the file](bilder/en/datei-import-29-csv-datei-gewaehlt.jpg)

### Rentman import

*File → Rentman import…* loads the devices of a Rentman project into the library. The import creates templates but places nothing on the canvas.

**Setting up.** Under *Settings → Integrations* switch on *Enable Rentman integration*. On the card *Rentman API* enter the API token and save it. It is stored in the operating system's keychain.

**Choosing a project.** *Load projects* fetches the projects of the account. The list shows number, name, period and status; *Sort:* orders by number or date, the search field filters by name, number or status.

![Dialog with the project list](bilder/en/datei-import-67-rentman-import-offen.jpg)

![Projects after the search](bilder/en/datei-import-68-rentman-suche.jpg)

A click on a project loads its equipment. The header shows the project; *change* returns to the list, *Reload & sync* fetches the quantities again.

![Project chosen](bilder/en/datei-import-69-rentman-projekt-gewaehlt.jpg)

The box *Plan vs. reservation* compares the plan with the Rentman reservation: devices that are only in the plan, only reserved, or whose quantity differs. It does not count lines without device character (comments, set contents, cancelled). *CSV* saves the comparison.

**Selection.** The list shows the devices grouped by category. Next to each row are the quantity in the Rentman project and the *Link…* choice, which connects a Rentman device to an existing local device. Badges show what the app knows about the device:

| Badge | Meaning |
|---|---|
| *⊕ catalog* | match in the built-in catalog; the import creates the template from it |
| *linked* | already connected to a local template by Rentman ID; a repeated import changes only category and project link, the ports stay |
| *in library* | local template with the same name but no Rentman ID; the import then asks |

*Select all* and *Deselect all* set all ticks. Combinations appear as *Physical combi*, *Virtual combi* or *Set*. A physical combination is one stock unit and is taken over as one device. *+ as rack* takes it over as a rack, *+ main device only* leaves out the accessories. *Expand all sets* shows the contents.

![All selected](bilder/en/datei-import-70-rentman-alle-auswaehlen.jpg)

![Sets expanded](bilder/en/datei-import-71-rentman-sets-aufgeklappt.jpg)

**Cable quantities.** The block *Cable quantities from Rentman* sums up the cable lines by type and length. It can be opened. For each type there are a tick, the length, an editable quantity and the number of Rentman entries.

![Cable quantities opened](bilder/en/datei-import-72-rentman-kabelmengen.jpg)

*Adopt cable quantities* stores the chosen types with their quantities as the cable plan in the project and links the project to the Rentman project. This also works without a device import. The message reads *2 cable type(s) adopted as plan.* With *Send cables to Rentman…* in the File menu these quantities can later go back; the chapter *Export & Print* describes that.

![Cable quantities adopted](bilder/en/datei-import-73-rentman-kabel-uebernommen.jpg)

**Adopting.** *Add to library (n)* gives the number of chosen devices.

![Selection for the library](bilder/en/datei-import-74-rentman-auswahl.jpg)

Next, *Category mapping before import* opens. You assign each device a local category. The app recognises and remembers matching categories; you create missing ones with *+ New*. *Back* keeps the selection.

![Category mapping](bilder/en/datei-import-75-rentman-kategorie-zuordnung.jpg)

*Next* without a complete mapping reports *Category missing*.

![Category missing message](bilder/en/datei-import-76-rentman-weiter.jpg)

If devices already exist under the same name, a conflict dialog appears per device. The default is *Keep local version (recommended)*, so your own port assignments are kept. Further actions are *Link to another local device*, *Overwrite with Rentman version*, *Merge ports* and *Skip (do not import)*. *Set all:* applies *Keep local*, *Take Rentman* or *Skip* to all rows. The message at the end says how many devices were added to the library.

#### Merge devices

If you choose *Merge ports* in the conflict dialog for a device, the dialog *Merge devices* opens for each such device after *Next*. It builds a new template from the local and the Rentman version. At the top it says *Pick which inputs/outputs to take from Local and Rentman.*

| Element | Meaning |
|---|---|
| *Target category* | Category of the merged template; it starts with the category from the category mapping |
| *Selected ports* | Number of ticked connectors |
| *Preview* | Result as *n In / m Out* |
| Column *Local* | Inputs and outputs of the local template, each with a tick, name and connector type; all are ticked at the start |
| Column *Rentman* | Inputs and outputs of the Rentman version; none is ticked at the start |

*Save merge* creates the template. It keeps the name of the local template. It takes the height in RU and the front and rear pictures from the Rentman version if that one has them; the notes of both versions are stacked. Without a target category the app says *Choose category*, without a ticked connector *Choose port*. *Cancel* discards all merges and ends the import before anything is written to the library. If several devices are to be merged, the dialog follows once per device; after the last one the import continues.

### NetBox import

*File → NetBox import…* reads a site or a rack from NetBox and creates devices, ports and connections as a cable plan.

**Setting up.** Under *Settings → Integrations* switch on *Enable NetBox integration*. On the card *NetBox API* enter the *Instance URL* and the *API token*. The token is stored in the keychain. *Test connection* checks the connection. Without a URL the dialog shows *Please configure the instance URL and an API token first under Settings → Integrations → NetBox.* The button *Build preview* stays disabled.

![Dialog without a configured URL](bilder/en/datei-import-33-netbox-ohne-url.jpg)

**Choosing.** Under *Site* you choose the site, optionally under *Rack (optional)* a single rack. The number in brackets is the number of devices. The icon next to the site reloads the lists. The default *— import the whole site —* takes all racks.

![Choosing site and rack](bilder/en/datei-import-34-netbox-dialog-auswahl.jpg)

![Site chosen](bilder/en/datei-import-35-netbox-standort-gewaehlt.jpg)

![Rack chosen](bilder/en/datei-import-36-netbox-rack-gewaehlt.jpg)

Under *Options* there are three switches:

- *Only import cabled ports* leaves out unused ports. Recommended: a 48-port switch would otherwise bring 48 unused ports.
- *Import connections* creates the cables.
- *Create a frame per rack* creates a frame in the plan for each rack.

![Options switched off](bilder/en/datei-import-37-netbox-optionen-aus.jpg)

![Options switched on](bilder/en/datei-import-38-netbox-optionen-ein.jpg)

**Preview.** *Build preview* loads the data and computes the reconciliation. Four counters are at the top: *New devices*, *New connections*, *New ports on existing devices* and *Unchanged*. Below, a line gives the numbers from NetBox. *skipped objects* can be expanded and names each object with the reason; in the example one cable end lies outside the imported area. *Devices that will be created* lists name, type and port count.

![Preview](bilder/en/datei-import-39-netbox-vorschau.jpg)

![Preview with the skipped objects expanded](bilder/en/datei-import-40-netbox-vorschau-uebersprungen.jpg)

*Back* returns to the choice, *Add to project* writes.

**Reconciliation instead of appending.** The reconciliation only ever adds: existing devices and cables stay with all their adjustments. The project remembers the site. The next time you open the dialog it shows *This project is linked to site "…". Last reconciliation: …*.

![Repeated run, linked project](bilder/en/datei-import-41-netbox-zweiter-lauf-verknuepft.jpg)

In the example one device has been added in NetBox. The second preview shows only this device as new; the five devices from the first run are under *Unchanged*.

![Preview of the second run](bilder/en/datei-import-42-netbox-zweiter-lauf-delta.jpg)

### Exporting and importing a whole project (`.avplan`)

*File → Export whole project (.avplan)…* writes the project in the exchange format `.avplan`. The file is JSON with the fields `kind` (*avplan*), `formatVersion`, `app`, `appVersion`, `exportedAt`, `venue` and `domains`. The Cable Planner enters its part under `domains.cabling`. It keeps the parts of other planners (cameras, lighting, venue) unchanged. The file name is `<project name>.avplan`; the app replaces characters other than letters, digits, `_` and `-` with `_`. The file is written as a download of the program window.

If devices carry a user name or password, *Include credentials?* asks: the `.avplan` goes to other trades. *Without credentials* removes them; re-importing into this planner then loses them. *Include* keeps them, *Cancel* aborts the export. The question is skipped when no device carries credentials.

![Credentials prompt](bilder/en/datei-import-43-avplan-export-zugangsdaten-frage.jpg)

*File → Import whole project (.avplan)…* loads an `.avplan` or `.json` file and replaces the current plan. If the file knows sections that this app does not, for example from a newer version, *This file contains unknown sections* asks for each section. The choices are *Carry through (unchanged, preserved on export)*, *Take over as* into a free known section, and *Discard*. *Carry all through* is the cautious default; if you close the dialog without choosing, it applies as well.

![Unknown sections](bilder/en/datei-import-44-avplan-import-unbekannte-abschnitte.jpg)

![Take over a section as](bilder/en/datei-import-45-avplan-import-uebernehmen-als.jpg)

If the file contains the camera list of the MultiCam plan, *This file contains the cameras of the MultiCam plan. Apply them to the signal plan?* asks. The text below gives the reconciliation result as in the MultiCam import. It asks because a camera you deleted on purpose would otherwise come back on every opening.

![Question about the cameras](bilder/en/datei-import-46-avplan-import-kameras-frage.jpg)

A file without a valid `.avplan` format reports *Import failed — not a valid .avplan file.*

![Error message](bilder/en/datei-import-47-avplan-import-fehler.jpg)

### Identity map (`.avsourcemap`)

The identity map is a small, flat format for runtime programs such as a tally computer or a UMD sender. It should not have to read the whole project to learn that "Kamera 1" sits on switcher input 3. The file carries `kind` *av-source-map*, `formatVersion`, `app`, `appVersion`, `exportedAt`, the sources (`sources`) and the open points (`unresolved`). Every value names its origin: *planned* (from the planning), *commanded* (sent to a device) or *confirmed* (reported back by the device). The Cable Planner writes only *planned*.

*File → Export identity map (.avsourcemap)…* writes `<project name>.avsourcemap` as a download in the same way. Two notices appear after writing when they apply. *Map written — with one limitation* names roles with more than one device: the file carries the target label only once per role. *Map written — without a switcher input* names roles that reach a router without the crosspoint to the switcher being planned; for them the file holds no input number.

*File → Import identity map (.avsourcemap)…* reads a map and reconciles it with the sources of the plan. A report *Identity map imported* lists the result:

| Line | Meaning |
|---|---|
| *Newly created* | sources the plan did not know yet |
| *Filled in* | fields that were empty in the plan |
| *Not applied* | fields where plan and file carry different values; the plan keeps its value |
| *Discarded* | values the app rejects, with the reason (for example a UMD address outside the range 0 to 126) |
| *No field for this in this app* | entries that stay only in the file |
| *Nothing to do* | the map says what the plan already says |

![Report with new sources and a discarded value](bilder/en/datei-import-49-karte-import-neu.jpg)

![Report with a conflict](bilder/en/datei-import-50-karte-import-konflikt.jpg)

![Report: nothing to do](bilder/en/datei-import-51-karte-import-nichts.jpg)

A file that is not an identity map reports *Import failed* with the reason.

![Error message](bilder/en/datei-import-52-karte-import-fehler.jpg)

### View linked venue plan

If a project comes from an `.avplan` that carries room, camera or lighting data of another planner, the menu contains *View linked venue plan…*. The dialog *Linked venue plan (view only)* names the room, the number of walls, persons and stage elements, and the cameras and fixtures. It changes nothing.

![Linked venue plan dialog](bilder/en/datei-import-48-venue-dialog.jpg)
