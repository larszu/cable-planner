## Export & Print

Everything that leaves the plan as a sheet, list or file is in the *File* menu. The entries at a glance:

| Entry | Result |
|---|---|
| *Patch list…* | every cable as a row; CSV, Excel, labels, channel lists |
| *Fixed install: docs & handover…* | lists and documents for installer and operator, QR labels |
| *Stage plot (SVG)…* and *Stage plot, light (SVG)…* | the stage top view as a one-page sheet |
| *Export & Print…* | the export centre with seven sections |
| *Cloud & share link…* | a copy with revisions and read links |
| *Export as viewer file…* | review file for reviewers |
| *Import annotations from viewer file…* | bring the reviewers' annotations back |
| *Compare plan revisions…* | differences between two states |
| *Documents handed out…* | register of the sheets handed out |
| *Attach plan to Rentman…*, *Send cables to Rentman…* | the way back to Rentman |

![The File menu](bilder/en/export-01-datei-menue.jpg)

The command palette (`Ctrl+K`) finds entries such as *Patch list…* by name.

![Command palette with the search Patch](bilder/en/export-02-palette-suche.jpg)

**File names.** Files the app downloads are named `YYYYMMDD_<project name>_NNN.<extension>`, with the sheet name after it for lists, for example `20260519_Demo-Show_007_patchliste.csv`. `NNN` counts up per day. Characters a file system does not accept are replaced by `_`.

**Stamp.** The lists of the fixed install, the sheets of the document packet and the raster PDF of the plan carry a stamp with the state of the plan. It lets you check later whether a sheet handed out still matches the plan; the register *Documents handed out* uses it for that.

### Patch list

*File → Patch list…* shows every cable as its own row, sorted for the order of patching.

![Patch list dialog](bilder/en/export-65-patch-oeffnen.jpg)

The columns are *No.*, *From device*, *Port*, *To device*, *Port*, *Type*, *Length (m)* and *Colour*. A click on a heading sorts. If a port has a content label such as *PGM*, it is the main line and the port name sits below it. The connector gender (♂/♀) is shown at the port where it is set. If a cable leads into a device marked as a converter that has only one onward cable, the row shows the end device with *via* and the converter; the onward cable then does not appear a second time. The *Fibre* column appears only if the plan contains a split socket (breakout).

The search field filters by device, port, type, colour and note.

![Search in the patch list](bilder/en/export-66-patch-suche.jpg)

If the plan has cables with a layer, the choice *All layers* appears next to it.

![Filter by layer](bilder/en/export-67-patch-ebene-audio.jpg)

![Sorted by length](bilder/en/export-68-patch-sortierung.jpg)

To the right of the filter is the number of cables shown and of all cables, for example *12 / 12*. If no row matches, it says *No cables match the filter.*

![Empty result](bilder/en/export-69-patch-leer.jpg)

**Outputs.** The footer offers four outputs. All of them take the rows currently filtered.

![Footer with the outputs](bilder/en/export-70-patch-fussleiste.jpg)

- *Export CSV* writes the table with a semicolon as separator and a UTF-8 BOM for Excel. It has 13 columns: *No.*, *From device*, *From port*, *To device*, *To port*, *Type*, *Length (m)*, *Layer*, *Multicore*, *Fibre*, *Colour*, *Cable name* and *Notes*; the port columns carry the content label in brackets and the connector gender.
- *Export XLSX* writes the same 13 columns as an Excel file with a bold header row.
- *Labels + QR (PDF)* prints an A4 sheet with two columns and nine rows. Each cable gets two labels, one per end, with number, type, cable name, route, length, colour strip and a QR code. The QR code carries the cable number or name and the route; both ends share it.
- *Label CSV* writes one row per cable end for label printers. You choose the format next to it: *Generic (CSV)*, *Brother P-touch (TXT)* or *Dymo (CSV)*. The texts are ASCII-safe, the connector gender is written as *(M)* or *(F)*.

![Labels as PDF](bilder/en/export-73-patch-etiketten-pdf.jpg)

![Label CSV, format Generic](bilder/en/export-74-patch-etikett-csv-generic.jpg)

![Label CSV, format Brother](bilder/en/export-75-patch-etikett-csv-brother.jpg)

![Label CSV, format Dymo](bilder/en/export-76-patch-etikett-csv-dymo.jpg)

![CSV of the patch list](bilder/en/export-71-patch-csv.jpg)

![XLSX of the patch list](bilder/en/export-72-patch-xlsx.jpg)

Labelling of patch panels (strips and labels) is described in the chapter *Tools: Plan*, under the analyses.

**Channel list.** If the plan contains audio channels, the footer shows the choice *View of the channel list* and the button *Channel list*. One channel list, five views, each as CSV:

| View | For whom |
|---|---|
| *Band (rider)* | the band's rider |
| *Venue (patch)* | patch at the house input |
| *Stage (position)* | layout on stage |
| *Console (names)* | channel names for the console |
| *Monitor paths* | paths to the monitors; only if the plan has any |
| *Venue / band (who owns what)* | puts both halves side by side: the stagebox input belongs to the house, the microphone to the band |

The monitor view shows paths, not the mix; the plan does not know that.

![Choice of views](bilder/en/export-77-kanal-sichten.jpg)

![View Band (rider)](bilder/en/export-78-kanal-band.jpg)

![View Venue (patch)](bilder/en/export-79-kanal-venue.jpg)

![View Stage (position)](bilder/en/export-80-kanal-stage.jpg)

![View Console (names)](bilder/en/export-81-kanal-console.jpg)

![View Monitor paths](bilder/en/export-82-kanal-monitor.jpg)

![View Venue / band](bilder/en/export-83-kanal-owner.jpg)

Above the table the dialog reports three oddities in the channels before a sheet is printed: a channel without a house port, a number that appears as a name, and two channels on the same socket.

**Console scene file.** *Read scene file* reads the file a mixing console writes (X32, M32, WING; extensions `.scn`, `.txt`, `.snap`, `.shw`). The app only reads and writes nothing back to the console. Afterwards *Console scene file* appears above the table with the format and the number of channels, and the number of unreadable lines if there are any. *Match to the plan* matches the channels to the plan *by name* or *by channel number (only if it holds)*.

![Scene read](bilder/en/export-84-szene-lesen-1.jpg)

![Match to the plan](bilder/en/export-85-szene-zuordnung.jpg)

![Match by channel number](bilder/en/export-86-szene-nach-nummer.jpg)

Three buttons write CSV: *Channels* (the channels read), *Match* and, from the second reading on, *Changes*. The first import stays the reference state; every further one is compared against it. That turns the rehearsal into the list of changes that otherwise exists only in someone's head. If nothing changes, it says *Nothing changed in the channel names between the two states.*

![CSV of the channels](bilder/en/export-87-szene-kanaele-csv.jpg)

![CSV of the match](bilder/en/export-88-szene-zuordnung-csv.jpg)

![Second state read, with the changes](bilder/en/export-89-szene-lesen-2.jpg)

![CSV of the changes](bilder/en/export-90-szene-aenderungen-csv.jpg)

### Fixed install: docs & handover

*File → Fixed install: docs & handover…* collects the documents an installer and an operator need. The dialog has no tabs, but sections from top to bottom.

![Fixed install dialog](bilder/en/export-106-doku-oeffnen.jpg)

**Basis of this handover.** The box at the very top says whether the handover carries the built state (*as-built*) or the quote state (*As planned (no as-built)*), and names the findings, such as *No as-built recorded* or *No venue named*; without a venue the file cannot be assigned to the venue next year, and the answers of the venue IT apply nowhere. The reason is given alongside: next year the same event will be planned from this file. If it carries the plan from before load-in, every on-site change gets rediscovered. Commit an as-built revision for that; the chapter *Tools: Build* describes revisions.

**Editor.** The field *Editor (author for changelog & service)* holds the name that appears in log and service entries. It applies to the whole app.

![Editor entered](bilder/en/export-107-doku-bearbeiter.jpg)

**Recipient and reserve.** *Recipient of this sheet (department or person)* is free text, not a required field. The entry appears in the register *Documents handed out*; without one it says *Recipient not named* there. *Reserve markup for BOM (%)* (0 to 100, default 10) is added to the quantities of the cable BOM.

![Recipient entered](bilder/en/export-108-doku-empfaenger.jpg)

![Reserve markup](bilder/en/export-109-doku-reserve.jpg)

**Lists and documents.** Each card under *Lists & handover documents* produces a file with the stamp of the plan. A click on the title writes the file in its basic format. A CSV carries a column glossary at the end and a stamp line with project, time and the identifier of the state.

| Card | Format | Content |
|---|---|---|
| *Pull/run list* | CSV | per cable: from→to, length, pathway, status |
| *Termination list* | CSV | per cable end: device, port, connector |
| *Cable schedule (register)* | CSV | master register of all cables |
| *Cable BOM + reserve* | CSV | by type and length, with reserve markup |
| *Asset register* | CSV | devices: asset tag, location, serial, warranty, service |
| *Handover document* | Markdown | operator overview: scope, status, BOM, assets |
| *Acceptance record* | HTML, printable as PDF | scope, test results, defects and open items from the plan, result boxes and signature block |
| *Defects and open items* | CSV | faults, failed tests, open field reports, items still planned |
| *Maintenance schedule* | CSV | next due date per device from its interval and the last service or the handover date |
| *Configuration settings* | CSV | per device and interface: address, mask, gateway, VLAN, switch port, patch panels in between, web interface |
| *Device cards* | HTML, printable as PDF | one card per device: location, identity, network, switcher input, cables, service history |
| *Operator overview* | HTML, printable as PDF | which source lies on which switcher input, where the outputs go, contacts, web interfaces |
| *Camera positions* | HTML, printable as PDF | per camera: location, height, aim, optics, switcher input and the PTZ presets from the camera plan |
| *Attachment index* | CSV | every attachment with kind, target, stored file and SHA-256, plus cables whose test result has no report |
| *Signal paths* | CSV | every chain from source to target with floor and room at each station |
| *Route plan per floor* | HTML, printable as PDF | top view per floor: rooms, riser, the connections between them, and the crossings list |
| *Crossings (fire protection)* | CSV | every room boundary, riser entry and floor slab a cable passes, with jacket rating and pathway |
| *House run occupancy* | CSV | per core of every house run: which cable uses it, which are free; only if the plan knows house runs |

The dialog shows no preview of the files; the following captures show a selection.

![Pull list as CSV](bilder/en/export-110-doku-01-pull.jpg)

![Cable BOM as CSV, reserve 15 %](bilder/en/export-111-doku-04-bom.jpg)

![Handover document as Markdown](bilder/en/export-112-doku-06-handover.jpg)

![Acceptance record](bilder/en/export-113-doku-07-abnahme.jpg)

![Signal paths as CSV](bilder/en/export-114-doku-15-signalwege.jpg)

**PDF and Excel.** The cards that are tables (pull list, termination list, cable schedule, cable BOM, asset register, defects and open items, maintenance schedule, configuration settings, attachment index, signal paths, crossings and house runs) carry the buttons *PDF* and *Excel* under the title. They write the same table in a designed form instead of CSV; the CSV remains the backup. The PDF is A4 landscape, repeats the table header on every page, carries bookmarks as well as stamp and page number and is set in Public Sans. The Excel file has one sheet per table with a frozen header row and an autofilter. *All lists as one PDF* and *All lists as one Excel workbook* combine all of these cards. The PDF then gets a cover page with a linked table of contents.

![Cable BOM as PDF](bilder/en/export-115-doku-pdf-einzeln.jpg)

![Cable BOM as Excel file](bilder/en/export-116-doku-excel-einzeln.jpg)

![All lists as one PDF, cover page](bilder/en/export-117-doku-alle-pdf.jpg)

![All lists as one PDF, a table page](bilder/en/export-118-doku-alle-pdf-seite.jpg)

![All lists as one Excel workbook](bilder/en/export-119-doku-alle-excel.jpg)

**QR/asset IDs and labels.** The section *QR/asset IDs & labels* assigns short, stable IDs and prints labels that tie the physical label to the record.

![QR and labels section](bilder/en/export-120-doku-qr-abschnitt.jpg)

- *Assign QR/asset IDs* gives cables and devices without an ID one. The message gives the number; if everything already has an ID, it says *All elements already have an ID.*
- *QR labels (PDF)* prints an A4 sheet with three columns, one label per cable and per device. On a cable the QR code carries the ID. On a device it leads to the device's page in the device library if it is known there, otherwise to the stored manufacturer or datasheet URL, otherwise it carries plain text with name, manufacturer, model and asset tag, which any phone reads without a network. The label names manufacturer and model even without a link. Scanning in the app finds the record in all three cases.
- *Cable labels "source → destination" (AVIXA F501.01)* names cables after their route. If a cable already has a name, it stays unless *overwrite existing names* is ticked. The message gives the number of labels; if nothing changed, it says so.

![IDs assigned](bilder/en/export-121-doku-ids-vergeben.jpg)

![QR labels as PDF](bilder/en/export-122-doku-qr-pdf.jpg)

![Cable labels from source and destination](bilder/en/export-123-doku-beschriftung-quelle-ziel.jpg)

![Overwriting existing names](bilder/en/export-124-doku-ueberschreiben.jpg)

**Attachments.** The section *Attachments* manages files attached to the plan and feeds the *Attachment index*. Choose the *Kind* (*Test report*, *Manufacturer document*, *Configuration backup*, *Other*) and what the file belongs to (*Whole installation*, *Cables*, *Devices*) and click *Attach files…*. This exists only in the desktop app. The files live in a folder beside the project; a project not yet saved has none. The app does not accept files over 100 MB. An entry shows the file in its folder (*Show in folder*) or is removed, the file staying in the folder. The section names cables that have a test result but no report.

![Attachments section](bilder/en/export-125-doku-anhaenge.jpg)

**Field feedback.** If the phone view reports corrections from the field, they arrive as open entries in the section *Field feedback*, newest first. Each entry names the cable, the device or the note. *Apply (merges + logs)* brings the change into the plan and enters it in the changelog, *Discard* deletes the entry.

![Field feedback](bilder/en/export-126-doku-rueckkanal.jpg)

![Entry applied](bilder/en/export-127-doku-rueckkanal-uebernehmen.jpg)

![Entry discarded](bilder/en/export-128-doku-rueckkanal-verwerfen.jpg)

**Changelog.** The last section lists the latest 30 entries: who, what, when. *Clear* deletes them. Without entries it says that status and service changes are logged here.

![Changelog](bilder/en/export-129-doku-protokoll.jpg)

![Log cleared](bilder/en/export-130-doku-protokoll-leeren.jpg)

### Stage plot

*File → Stage plot (SVG)…* writes the stage top view as an SVG on one sheet. *Stage plot, light (SVG)…* writes the same graphic with a white background and dark text, for print and email. The entry without the addition follows the canvas theme.

The sheet contains drawing and legend from the same objects. The number on a device is the channel number of the channel list, the same as in the patch list. Devices that are not a channel, such as stagebox, console or wedge, carry no number; they are destination, not source. The legend carries the input list. If the plan has no audio cables, the sheet shows all devices without numbers and says so in its subtitle.

![Stage plot without audio channels](bilder/en/export-64-stageplot-ohne-audio.jpg)

![Stage plot with audio channels and input list](bilder/en/export-91-stageplot-mit-audio.jpg)

### Export & Print

*File → Export & Print…* opens the export centre. On the left you choose one of seven sections: *Plan*, *Patch sheets*, *Cable BOM*, *Device BOM*, *Racks & groups*, *Tally map* and *Document packet*. Each section has a line at the top that says what it does. After an output the dialog closes.

![The export centre](bilder/en/export-07-export-plan-pdf.jpg)

![The seven sections](bilder/en/export-08-export-seitenleiste.jpg)

#### Plan as a file

*Plan* outputs the canvas as a file. Five formats are available.

| Format | Property |
|---|---|
| *PDF* | printable, with a title block bottom right (see below) |
| *PNG* | transparent possible, sharp |
| *JPEG* | smaller, good for email |
| *SVG* | scalable, for web and further processing |
| *DXF* | CAD/plotter: devices, cables and text on layers |

For PDF these settings are added:

- *PDF theme*: *Dark theme (like canvas)* or *Light theme (recommended for print)*.
- *Monochrome-safe (layer spelled out, one line colour)* writes the layer in plain text on every cable and gives all lines the same colour. On a black-and-white printer video and audio are otherwise hard to tell apart.
- *Render mode*: *Raster (classic)* is a JPEG snapshot of the canvas, reliable, but text blurs at high zoom. *Vector* uses Chromium's print path: text stays selectable and sharp at any zoom, the file stays small. Both carry the same title block with project data, revision, state and QR code.
- *Title block*: can be switched off; QR code, logos and every row can be chosen individually. *Size* “Auto” grows with the sheet (A3 = 100 %), or pick a fixed value from 75 to 300 %. The setting is saved with the project.
- *Page size* exists only for the vector PDF: *Auto — A0 landscape (compatible with all viewers)*, *A4 Landscape* to *A0 Landscape*, *A0+ Plotter* and *Original — full canvas size for plotter*. Edge and Preview sometimes display pages above A0 as white; Acrobat and plotter software print them. The canvas is scaled vectorially to the page, text stays sharp.
- *Layers (included in PDF)*: the chips Video, Audio, Control, Network, Power and Other toggle a layer for canvas and PDF. For a PDF with video only, switch the others off, export and switch them on again.

![Dark theme](bilder/en/export-09-plan-thema-dunkel.jpg)

![Light theme](bilder/en/export-10-plan-thema-hell.jpg)

![Monochrome-safe](bilder/en/export-11-plan-monochrom.jpg)

![Render mode Vector](bilder/en/export-12-plan-vektor.jpg)

![Page size, opened](bilder/en/export-13-plan-seitenformat.jpg)

![Layers in the PDF](bilder/en/export-14-plan-ebenen.jpg)

![Layer switched on again](bilder/en/export-15-plan-ebenen-zurueck.jpg)

At the bottom the dialog shows the name under which the file is saved. *Download as PDF* writes the file. *Print* opens the plan PDF in the system's print dialog and applies to PDF only; for PNG, JPEG, SVG and DXF the button is disabled.

![Format PNG, Print disabled](bilder/en/export-19-plan-drucken-gesperrt.jpg)

![Format JPEG](bilder/en/export-16-plan-format-jpeg.jpg)

![Format SVG](bilder/en/export-17-plan-format-svg.jpg)

![Format DXF](bilder/en/export-18-plan-format-dxf.jpg)

The results, shown here as a preview of the file written:

![Result PNG](bilder/en/export-20-ergebnis-plan-png.jpg)

![Result JPEG](bilder/en/export-21-ergebnis-plan-jpeg.jpg)

![Result SVG](bilder/en/export-22-ergebnis-plan-svg.jpg)

![Result DXF](bilder/en/export-23-ergebnis-plan-dxf.jpg)

![Result raster PDF, page 1](bilder/en/export-24-ergebnis-plan-pdf.jpg)

![Result vector PDF](bilder/en/export-25-ergebnis-plan-pdf-vektor.jpg)

![Plan PDF in the print job](bilder/en/export-26-ergebnis-plan-drucken.jpg)

Every PDF output of the plan, printing included, makes an entry in the register *Documents handed out*. PNG, JPEG, SVG and DXF do not.

#### Patch sheets

*Patch sheets* creates a port assignment list per device, meant to be stuck on the device.

![Patch sheets section](bilder/en/export-27-patchsheets-oeffnen.jpg)

At the top is the compact patch list: one line per cable, sorted by source device, for the technician in the field. *Open patch list…* jumps into the *Patch list* dialog. Below it you choose devices: a tick per device, *Select all*, *Deselect all* and a filter by name or category.

![Filter in the device list](bilder/en/export-28-patchsheets-filter.jpg)

![All devices selected](bilder/en/export-29-patchsheets-alle.jpg)

![No devices selected](bilder/en/export-30-patchsheets-keine.jpg)

![A few devices selected](bilder/en/export-31-patchsheets-auswahl.jpg)

With devices selected, three buttons offer the output: *Individual PDF (n)* one PDF per device, *Combined PDF (n)* one PDF with one device per page, and *Print* the combined PDF in the print dialog. After the click a bar asks, for example *Individual PDFs — Pick paper format:*, with *A4*, *A3* and *Cancel*.

![Choosing the paper format](bilder/en/export-32-patchsheets-papier.jpg)

![Cancel](bilder/en/export-33-patchsheets-abbrechen.jpg)

![Paper format for the combined PDF](bilder/en/export-34-patchsheets-sammel-papier.jpg)

![Result: combined PDF](bilder/en/export-35-ergebnis-patchsheet-sammel.jpg)

![Result: individual PDF on A3](bilder/en/export-36-ergebnis-patchsheet-einzel-a3.jpg)

![Result: print job](bilder/en/export-37-ergebnis-patchsheet-drucken.jpg)

*Datasheets (n)…* opens the device datasheet: photos and chosen properties, one A4 page per device. The properties are arranged in groups (*General*, *Technical data*, *Category data*, *Operation*, *Tables*). The properties filled on at least one device are preselected. *Filled ones*, *All* and *None* change the selection. A ticked but empty property prints as a dash. *Print* opens the print dialog, *Save PDF* writes the file.

![Datasheet dialog](bilder/en/export-38-datenblatt-oeffnen.jpg)

![No properties selected](bilder/en/export-39-datenblatt-keine.jpg)

![All properties selected](bilder/en/export-40-datenblatt-alle.jpg)

![Only filled properties](bilder/en/export-41-datenblatt-ausgefuellte.jpg)

![Datasheet as PDF](bilder/en/export-42-datenblatt-pdf.jpg)

#### Cable BOM

*Cable BOM* is the bill of materials of all cables, combined by type and length.

![Cable BOM](bilder/en/export-43-bom-oeffnen.jpg)

The table gives per row *Type*, *Length (m)*, *Installed*, *Total (m)*, the Rentman planning (*Rentman planned*, editable) and the *Difference*. The column *Pieces* is added as soon as stock lengths are stored. The difference shows whether more or less is installed than planned. Below are the sum per discipline and the number of connectors by type.

![Entering the Rentman planning](bilder/en/export-44-bom-rentman-eingabe.jpg)

A changed planning stays a draft. *Save Rentman plan* adopts it into the project, *Discard* takes it back. The planned quantities come from the Rentman import; the chapter *File and Import* describes it.

![Draft discarded](bilder/en/export-45-bom-rentman-verwerfen.jpg)

*Download as CSV* writes the table as CSV in UTF-8 with a BOM for Excel, *Download as PDF* as PDF, *Print* opens it in the print dialog.

![Cable BOM as CSV](bilder/en/export-46-bom-csv.jpg)

![Cable BOM as PDF](bilder/en/export-47-bom-pdf.jpg)

![Cable BOM in the print job](bilder/en/export-48-bom-drucken.jpg)

If stock lengths are stored in the project (*Settings → Project*, section *Available stock lengths*), the BOM splits a run into pieces in stock. The column *Pieces* names the parts, plus the couplers per run and the excess length. If the stock does not suffice, *Stock short* appears with the shortfall; CSV and PDF carry the columns *Pieces*, *Couplers* and *Stock short*.

![Splitting by stock lengths](bilder/en/export-100-bom-lagerlaengen.jpg)

![Rentman planning next to the stock lengths](bilder/en/export-101-bom-rentman-geplant.jpg)

![Rentman planning saved](bilder/en/export-102-bom-rentman-speichern.jpg)

![CSV with the splitting](bilder/en/export-103-bom-csv-lager.jpg)

![PDF with the splitting](bilder/en/export-104-bom-pdf-lager.jpg)

![Stock lengths in the settings](bilder/en/export-105-bom-einstellungen-lager.jpg)

#### Device BOM

*Device BOM* counts the devices the plan needs by model and checks them against stock. Three states stay separate: *covered* (via catalogue identity), *proposals* (name match, awaiting confirmation) and *not in stock*. The rows give *Qty*, *Model*, *Coverage*, *Stock* and *Location*. *Assign type…* assigns a type to a device without a catalogue type, *Confirm* adopts a proposal. *Device BOM as CSV* writes the list; *Pick list (CSV)* contains only safely covered items, sorted by storage location, for packing.

![Device BOM](bilder/en/export-49-geraete-bom-oeffnen.jpg)

![Device BOM as CSV](bilder/en/export-50-geraete-bom-csv.jpg)

![Type list for assigning](bilder/en/export-51-geraete-bom-typ-liste.jpg)

#### Racks & groups

*Racks & groups* outputs saved racks and groups individually as PDF: one patch page per contained device with the internal wiring. A filter searches racks and groups; the card shows *Rack · n U* or *Group* and the number of devices. *Format* chooses the paper, *PDF* writes, *Print* opens the print dialog. Without saved racks or groups it says how to create them: select devices on the canvas and use *Save as rack* or *Save group*.

![Racks and groups](bilder/en/export-52-racks-oeffnen.jpg)

![Paper format of the racks](bilder/en/export-53-racks-papier.jpg)

![Filter without a match](bilder/en/export-54-racks-filter-leer.jpg)

![Rack as PDF](bilder/en/export-55-racks-pdf.jpg)

![Rack in the print job](bilder/en/export-56-racks-drucken.jpg)

#### Tally map

*Tally map* shows the chain role, device, switcher input and UMD address, derived from the plan and checked. The table has the columns *No.*, *Role*, *Device(s)*, *Switcher*, *Input* and *UMD*. The lamp itself, that is which GPIO pin of which box, belongs to the hardware and is deliberately not included.

![Tally map without roles](bilder/en/export-57-tally-leer.jpg)

![Tally map with roles](bilder/en/export-92-tally-karte.jpg)

The box *Validation: n errors, m notes* names what is wrong with the map, for example a role without a switcher input, a role without a device or a device without a UMD address. *Tally map as CSV* writes the table for proofreading. *tally-pi devices (JSON)* writes the part of `tally.json` that the plan owns: id, name, input. ATEM address and GPIO pins stay with the box. Next to the JSON file the app writes a provenance file (`.herkunft.txt`) with checksum and state.

![Tally map as CSV](bilder/en/export-93-tally-csv.jpg)

![tally-pi devices, provenance file](bilder/en/export-94-tally-pi-json.jpg)

If the plan has devices with a multiviewer, the box *Multiviewer layout (who is in which window)* shows a button per device that writes the window layout as CSV: multiviewer, window, position, size, source (ATEM) and role. The names come from the same roles as tally and UMD, not from a second, hand-kept list. Below are findings, for example a window whose source has no role in the plan.

![Multiviewer layout as CSV](bilder/en/export-95-tally-mv-csv.jpg)

The box *Pre-show check: path, lamp, and what was seen* records what the plan cannot derive. For each position you choose the *Path* of the tally, enter the *Address* and the *Lamp* and note what *Program* and *Preview* showed. The button *seen* writes the observation with a timestamp into the column *Last*. Below it says how many positions are checked, and the findings, for example a missing tally path. *Pre-show list* writes the check as CSV.

![Choosing the tally path](bilder/en/export-97-tally-pfad-liste.jpg)

![Observation entered](bilder/en/export-98-tally-gesehen.jpg)

![Observation recorded](bilder/en/export-99-tally-gesehen-festhalten.jpg)

![Pre-show list as CSV](bilder/en/export-96-tally-vorshow-csv.jpg)

If the direct route and the address of the Pi are entered in the settings, a block *Straight to the Pi* appears below. *Read the Pi* fetches the list from the Pi and shows the difference (*n stay, m are added*) and which roles disappear from the Pi, including their GPIO assignment. Only then is *Send to the Pi* available. Without these settings the block is absent; the file remains the default route.

#### Document packet

*Document packet* puts several sheets together into one printable stack, for the binder that travels to the event. One page per sheet, the column header repeats on every following page. Every sheet carries its stamp, so a stack of stamped sheets can be held against the plan tomorrow.

![Document packet section](bilder/en/export-58-stapel-oeffnen.jpg)

The sheets offered are those that carry a stamp, for example *Pull list*, *Termination list*, *Cable schedule*, *Asset register*, *Network sheet*, *Spectrum plan*, *Delivery*, *Tally map*, *Handover to post*, *Faceplates*, *Signal paths*, *House run occupancy*, *Crossings (fire protection)*, *Defects and open items*, *Maintenance schedule*, *Configuration settings* and *Attachment index*. Initially the pull list and the cable schedule are selected.

![Selected sheets](bilder/en/export-59-stapel-blaetter.jpg)

*Paper* chooses A4, Letter or A3. *Colour* chooses *colour* or *black and white*; in black and white the name of a group stays, even where colour mode shows a colour swatch. *Print column glossary* appends a glossary of the columns. If a sheet has columns the glossary does not explain, the app reports it as a finding, because the stack goes to someone who does not know the columns. *Print packet* opens the print dialog.

![Paper format](bilder/en/export-60-stapel-papier.jpg)

![Colour mode](bilder/en/export-61-stapel-farbe.jpg)

![Glossary of the columns](bilder/en/export-62-stapel-glossar.jpg)

![The stack in the print job](bilder/en/export-63-stapel-drucken.jpg)

### Cloud & share link

*File → Cloud & share link…* is optional. Your file stays the master copy; the server keeps a copy with revisions, encrypted at rest. Credentials are removed before upload. The cloud uses the device library account.

Without signing in, the dialog shows *Cloud projects use your device library account.* and the button *Sign in under Settings → Device library…*, which opens the settings.

![Cloud dialog without sign-in](bilder/en/export-05-cloud-dialog.jpg)

Once signed in, the dialog has three sections. These sections are not captured because they need an account; they are described from the program.

- *This project.* *Put this project in the cloud* creates the first revision. Afterwards the dialog gives revision and time: *Changes are saved to the cloud automatically.* *Save to cloud now* saves at once, *Stop syncing* cuts the link, *Delete from cloud* removes the project with all revisions and share links; the local file stays. Under *Revisions* every revision appears with time and device. *Restore* makes an older one the newest revision; nothing is lost. If another device saved in the meantime, the app merges both changes and says so.
- *Share link.* A link lets anyone read the plan in the browser, without an account; credentials are not included. The dialog warns that the plan leaves the computer. *Always show the newest revision* keeps the link current, otherwise it shows the revision that was newest when it was created. *Expires* chooses *never* or *after 7*, *30* or *90 days*. *Create link and copy* creates the link and copies it. The list of links gives the number of openings and the expiry for each; *Copy* copies again, *Revoke* makes the link invalid.
- *Your cloud projects.* Every other project of the account with *Open* and *Download .cableplan*. The list has no delete button; only the linked project can be deleted.

### Viewer file

*File → Export as viewer file…* writes a `.cpviewer` file for reviewers and helpers. The content equals the project file, with the mode forced to *viewer*; device credentials are removed because the file goes to outsiders. Existing annotations stay, so the owner can pre-mark tasks for freelancers. Afterwards *Viewer file saved* names the path.

![Message after exporting the viewer file](bilder/en/export-06-viewer-exportiert.jpg)

Whoever opens the file enters their name on first opening (chapter *File and Import*); every annotation carries it.

![Content of the viewer file](bilder/en/export-138-viewer-exportiert-daten.jpg)

### Import annotations

*File → Import annotations from viewer file…* reads the annotations from a `.cpviewer` or `.json` file and merges them into the plan. The ID of an annotation is compared: new ones are added, ones changed by the reviewer (status, text) are updated. *Annotations imported* names both: *n new annotation(s) imported.* and *n updated from reviewer changes.*

![Message after the first import](bilder/en/export-136-anmerkungen-import.jpg)

Reading the same file a second time adds nothing.

![Message on the second import](bilder/en/export-137-anmerkungen-import-zweites-mal.jpg)

### Compare plan revisions

*File → Compare plan revisions…* holds the open plan against an earlier state. The chosen state is the old one, the open plan the new one (*The open plan counts as the newer revision. Nothing is loaded or overwritten.*): the question is what has changed since the earlier state.

![Dialog without a chosen state](bilder/en/export-04-vergleich-leer.jpg)

The earlier state comes from one of two sources.

- *Choose comparison file…* reads a plan file. It is only read, not loaded, and does not enter the list of recently opened projects. A file without an equipment and cable list reports that it contains no readable plan.
- *or committed revision:* chooses a revision of the project. That needs no second file.

![Comparison with a file](bilder/en/export-132-vergleich-datei-gewaehlt.jpg)

Afterwards the dialog names the earlier state (*Earlier revision: file* or *Earlier revision: revision*) and both stamps (*Revision of the chosen file*, *Revision of the open plan*), plus a summary line with the counts: substantive changes, presentation-only changes, other areas, and the sheets superseded or impossible to judge. Two blocks follow. *Documents* says for each kind of sheet whether the comparison has superseded it: *superseded*, *cannot tell* (with the reason) or *unchanged*. *Differences* lists devices and cables as *new*, *gone* or *changed*. *Other project areas (not itemised)* names areas that have changed without being listed individually. *Export as CSV* writes the differences.

![Choosing a revision](bilder/en/export-134-vergleich-revision-auswahl.jpg)

![Comparison with a revision](bilder/en/export-135-vergleich-revision.jpg)

![CSV of the comparison](bilder/en/export-133-vergleich-csv.jpg)

### Documents handed out

*File → Documents handed out…* is the register of the sheets the app has output: the lists of the fixed install and every PDF output of the plan. Only sheets whose state can be computed are entered; an entry without a state could never say whether it still holds. The register lies beside the app, not in the project: it records what was output on this computer and does not travel with the plan.

Without outputs a note says *Nothing has been handed out for this project yet — or the exports came from another machine.*

![Register without entries](bilder/en/export-03-register-leer.jpg)

With outputs, a summary line gives how many entries belong to this project and how many of them are superseded. The table groups by recipient (from the field *Recipient of this sheet*; without one it says *Recipient not named*) and shows for each entry *Document*, *Handed out*, *Revision on the sheet*, *Still valid?* and *What changed since*. The status is *current*, *superseded — hand out again* or *cannot tell*; for superseded sheets the last column explains what has changed. *Refresh* reads the register again, *Clear register* deletes the entries after a confirmation. Older entries fall out of the register; a note says so, and a second one names entries of other projects.

![Register with entries](bilder/en/export-131-register-gefuellt.jpg)

### Way back to Rentman

*Attach plan to Rentman…* attaches the current plan as a PDF, with stamp, to the linked Rentman project. The file name carries the project name and the time; beforehand a confirmation asks about the target project. *Send cables to Rentman…* opens a dialog that sets *Built*, *Planned* and *Already sent* side by side per cable type and length, lets you choose the Rentman mapping and sends the difference as an addition; fewer built than last sent must be corrected in Rentman by hand. Both entries are greyed out as long as no Rentman project is linked (*no project linked*). The link is created in the Rentman import, see *File and Import*. Neither path is captured because they need a Rentman account.
