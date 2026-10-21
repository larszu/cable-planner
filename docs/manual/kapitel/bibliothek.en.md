## Library

The library is the column to the left of the plan. It holds the templates the plan is built from: devices (local, from the shared device library and from Rentman), cable types, device groups and racks. Templates are put on the [canvas](#canvas) with a click or by dragging; the properties of an entry appear in the [Inspector](#inspector).

![Library next to the plan](bilder/en/bibliothek-01-fenster-ueberblick.jpg)

### The library column

The head of the column has the arrow *Hide library* on the left and the *Window* menu next to it. Below are the four tabs *Equipment*, *Cables*, *Groups* and *Racks*; for groups and racks a number shows how many entries there are.

1. The arrow at the top left hides the column and gives the width to the plan.

   ![Column hidden](bilder/en/bibliothek-02-spalte-einklappen.jpg)

2. A button *Show library* appears at the edge; it brings the column back.

   ![Column shown again](bilder/en/bibliothek-03-spalte-einblenden.jpg)

3. The *Window* menu offers *Undock (floating)* and *Open in its own window*. The button can also be dragged.

   ![Window menu](bilder/en/bibliothek-04-fenster-menue.jpg)

4. Undocked, the library floats above the plan; *Dock* (back to the side column) puts it back in its place.

   ![Undocked library](bilder/en/bibliothek-05-abgedockt.jpg)

5. You change the width of the column by dragging its divider to the plan (*Resize column*).

   ![Column widened](bilder/en/bibliothek-07-spalte-verbreitern.jpg)

### Equipment

The *Equipment* tab has three sub-tabs for the source of the templates: *Local* (own and imported templates plus the built-in catalogue), *Shared* (the shared device library, read-only) and *Rentman* (only when the Rentman module is on).

#### Local

The sub-tab *Local* shows the templates by category. Each category is a collapsible strip with the number of entries; a click opens or closes it.

![Categories of the local library](bilder/en/bibliothek-11-geraete-lokal.jpg)

![Opened category](bilder/en/bibliothek-12-kategorie-aufklappen.jpg)

Each entry shows the name and below it the category with the number of inputs and outputs. The **L** before the name marks a local device (not from Rentman). A click selects the entry and shows its template in the Inspector; a double click or dragging onto the canvas places the device. When you point at an entry, four buttons appear:

| Button | Effect |
|---|---|
| Star (*Mark as favorite* / *Remove favorite*) | Highlights the entry with a star. |
| Eye (*Hide* / *Show again*) | Hides the entry from the list; with *Show hidden* in the filter menu it reappears dimmed. |
| Arrow down (*Export*) | Saves the entry as a file (`.cpdevice`) in the Downloads folder. |
| Red **×** (*Remove from library*) | Asks "Remove … from the library?" and deletes the template after *OK*. |

![Buttons when pointing at an entry](bilder/en/bibliothek-13-eintrag-hover.jpg)

![Entry as favourite](bilder/en/bibliothek-15-eintrag-favorit.jpg)

![Entry hidden](bilder/en/bibliothek-16-eintrag-verstecken.jpg)

#### Searching

The search field above the list filters in real time by name and category. It carries the hint *Ctrl+F*: while the sub-tab *Local* is open, Ctrl+F puts the cursor in this field. The **×** in the field clears the search term.

![Search for "Avantis"](bilder/en/bibliothek-28-suche-tippen.jpg)

If the search finds nothing, it says *No devices found* with *Clear search*.

![Search without matches](bilder/en/bibliothek-29-suche-ohne-treffer.jpg)

#### Filter menu

The funnel symbol opens the filter menu.

![Filter menu](bilder/en/bibliothek-17-filter-menue.jpg)

| Entry | Effect |
|---|---|
| *Collapse all categories* / *Expand all categories* | Closes or opens all categories at once. |
| *Sorting* → *Manual (drag & drop)* | The categories stand in the order you drag them into. |
| *Sorting* → *Alphabetical A → Z* / *Z → A* | Sorts the categories by name. |
| *Show hidden (n)* | Shows the hidden entries dimmed; the number says how many there are. |
| *Show empty categories* | Also shows categories without entries. |
| *Only own material* | Shows only devices that match the own inventory (by model). The entry is greyed out as long as the inventory contains nothing matching. |

![Hidden entries visible](bilder/en/bibliothek-18-filter-versteckte-zeigen.jpg)

![All categories collapsed](bilder/en/bibliothek-21-filter-alle-einklappen.jpg)

![Sorting Z → A](bilder/en/bibliothek-22-filter-sortierung-z-a.jpg)

![Empty categories shown](bilder/en/bibliothek-57-filter-leere-kategorien-an.jpg)

#### Categories

Categories order the templates. A pencil appears when you point at the category strip.

1. The pencil opens *Rename category*. The window has two fields, *English* and *German*; when the interface language is switched, the respective name appears. An empty field is allowed, the display then falls back to the other language.

   ![Rename category](bilder/en/bibliothek-34-kategorie-umbenennen-dialog.jpg)

2. With the grip to the left of the name you drag a category to another place (with the sorting *Manual*).

   ![Dragging a category by its grip](bilder/en/bibliothek-35-kategorie-ziehen-griff.jpg)

3. Entries can be dragged onto another category; an empty category says *Drag a device here to move it*.

   ![Dragging an entry into a category](bilder/en/bibliothek-52-eintrag-in-kategorie-ziehen.jpg)

4. New categories are created with the **+** menu (see below).

   ![New, empty category](bilder/en/bibliothek-55-kategorie-umbenannt.jpg)

#### The + menu

The **+** button next to the search field (tooltip: *Create new device or category*) opens a menu with five entries.

![The + menu](bilder/en/bibliothek-37-plus-menue.jpg)

| Entry | Effect |
|---|---|
| *New device…* | Opens the dialog [Create your own device](#create-your-own-device). |
| *New category…* | Shows a field *Category name…* in the list; *OK* creates the category, **×** cancels. |
| *Import file…* | Reads a `.cpdevice` or `.cpgroup` file (see below). |
| *Submit templates…* | Opens the dialog [Submit templates](#submit-templates). |
| *Open library folder…* | Opens the folder of the library in the file manager. |

1. *New category…* shows the name field above the list.

   ![Field for the category name](bilder/en/bibliothek-39-plus-neue-kategorie.jpg)

2. After *OK* the category is in the list and can be named in both languages with the pencil.

   ![Names for both languages](bilder/en/bibliothek-54-kategorie-umbenennen-ausgefuellt.jpg)

##### Create your own device

*New device…* opens the dialog *Create your own device*. It is a single continuous form without tabs. A right click on empty area of the plan (*New device here …*) and the key combination Ctrl/Cmd + Plus on the plan lead to the same form or to a name dialog respectively.

![Dialog Create your own device](bilder/en/bibliothek-geraet-01-dialog-offen.jpg)

| Field | Meaning |
|---|---|
| *Name* | Name of the device. While you type, the form lists matching devices of the library (name, category, number of inputs and outputs) with *Use as template*. |
| *Category* | Choice from the existing categories; *+ New category…* creates another one. The default is *Other*. |
| *19" rack device* → *Is a rack device* | Marks the device as a rack device; the field *U* for the height then appears. |
| *Recognise ports from a photo* | Appears as soon as an AI provider is set up; otherwise the note says to enter one under *Settings → Integrations → AI*, with the button *Open settings*. |
| *Guess the ports from the device name* | The buttons *Fill in* (fills the port groups from the source chosen in the settings) and *Datasheet…* (reads the port groups from a PDF, HTML or text file). The source is named next to it: *from a web search — no API key needed* or *from the AI model — needs an API key*. *Add API key (AI)* opens a field for the key; it is stored locally only. |
| *Port groups* | The connectors in groups. *+ Input group* and *+ Output group* add a row. |

A port group has four entries: the direction (*Input* or *Output*), the count, the connector type and the name (label prefix). When saving, individual ports are created from them. A group without a count produces no ports; the message *No ports yet — that is fine.* says that ports can also be added later: a cable dropped onto the device adds one.

1. Type a name. Matching devices of the library appear below the field.

   ![Suggestions while typing the name](bilder/en/bibliothek-geraet-02-name-vorschlaege.jpg)

2. *Use as template* takes over category and port groups of the entry; the name gets the suffix *(copy)*. The form says *Fields taken from "…". Adjust what differs.*

   ![Fields taken from a template](bilder/en/bibliothek-geraet-03-vorlage-genommen.jpg)

3. With the tick at *Is a rack device* the field *U* appears.

   ![Rack device with field U](bilder/en/bibliothek-geraet-04-rack-geraet.jpg)

4. *+ Output group* adds another row; the red **×** removes a group.

   ![Additional output group](bilder/en/bibliothek-geraet-05-gruppe-ausgang.jpg)

Four buttons are at the bottom:

| Button | Effect |
|---|---|
| *Cancel* | Closes the dialog without saving. |
| *Save to library* | Stores the template in the local library (for re-use); the device does not go onto the plan. |
| *Place in project only* | Puts the device into this project without creating a template. Meant for loan gear, placeholders and one-offs; nothing is uploaded. |
| *Save + place* | Both. |

With photo recognition the section *Recognise ports from a photo* appears: *Choose photos* or *Take photo* (photos of the connector side can also be dropped or pasted; they are sent to the chosen provider for recognition), *Recognise*, *Remove photo* and the tick *Keep the photos on the device when placing it*. The suggestions stand as a table (*Include*, *Direction*, *Count*, *Connector*, *Label*, if needed *Read as: …*); unsure rows are unticked and marked *unsure*. If the app recognises the model, it names the catalogue device with datasheet ports (*In the catalogue with datasheet ports: …*) and offers *Place catalogue device*. *Apply N port group(s) to the form* enters the chosen rows into the port groups.

#### Import file

*Import file…* reads only `.cpdevice` and `.cpgroup` files (the format *Export* writes entries in).

1. After choosing the file, the app says *Device imported: "…" was added to the library.*

   ![Device imported](bilder/en/bibliothek-42-plus-datei-importieren.jpg)

2. If the name exists, it asks *A device named "…" already exists. Overwrite?* — *Cancel* or *Overwrite*.

   ![Question when overwriting](bilder/en/bibliothek-43-import-gleicher-name.jpg)

3. Any other file is rejected by the app: *File not recognised: This file is not a valid .cpdevice or .cpgroup export.*

   ![File not recognised](bilder/en/bibliothek-44-import-unbekannte-datei.jpg)

An imported group appears in the *Groups* tab (see there).

#### Submit templates

*Submit templates…* checks your own templates and sends them to the device library or saves them as a submission file. The dialog states at the top how many of the templates can be submitted (*3 of 3 templates can be submitted.*) and points out that the device library lists manufacturer and model separately: the split suggested from the template name is to be checked. Per template there are a tick, the fields for manufacturer and model, the datasheet link and notes, for example *Power draw not stated.*

The **datasheet link is mandatory**: a template without a link cannot be submitted. To send to the device library you must be signed in (*Sign in…*); a submission file can also be saved without an account. The buttons at the bottom are *Close*, *Save submission file* and *Send N to device library*.

![Dialog Submit templates](bilder/en/bibliothek-45-plus-vorlagen-einreichen.jpg)

#### Changing, placing and removing entries

1. Find the entry.

   ![Entry found](bilder/en/bibliothek-46-eintrag-gefunden.jpg)

2. The button *Remove from library* (red **×**) asks for confirmation.

   ![Question remove entry](bilder/en/bibliothek-48-eintrag-entfernen-abfrage.jpg)

3. A double click on an entry puts the device on the plan; a click shows the template in the Inspector.

   ![Entry selected by click](bilder/en/bibliothek-50-eintrag-klick-platziert.jpg)

4. Drag an entry onto the plan to place it at the drop position.

   ![Entry dragged onto the canvas](bilder/en/bibliothek-51-eintrag-auf-canvas-ziehen.jpg)

#### Shared

The sub-tab *Shared* shows the shared device library (devices.zumpelars.de), read-only. Signing in is needed to fetch or update the devices (*Sign in…*); devices already fetched stay usable. *Update* fetches the current state. The line *N devices stored locally* states how many devices are on this computer; they are ordered by category. Each entry carries the name, the status (*verified*, *confirmed*, *unconfirmed* or *disputed*), the number of confirmations and the link *Page* to the detail page. The status is set by the device library, not by the planner.

![Shared device library](bilder/en/bibliothek-58-geteilt-uebersicht.jpg)

![Search in the shared library](bilder/en/bibliothek-59-geteilt-suche.jpg)

*Sign in…* opens *Settings → Device library* with the server and the account.

![Settings Device library](bilder/en/bibliothek-61-geteilt-anmelden.jpg)

#### Rentman in the library

The sub-tab *Rentman* belongs to the Rentman module. Without a linked project it says *No Rentman project linked.* with the button *Link Rentman project…*; below, the views *Imported*, *Catalog* and *Reconcile* are selectable.

![Rentman without linked project](bilder/en/bibliothek-95-rentman-nicht-verknuepft.jpg)

1. *Link Rentman project…* opens *Import from Rentman*, where the projects are loaded and one is chosen.

   ![Dialog Link Rentman project](bilder/en/bibliothek-96-rentman-projekt-verknuepfen-dialog.jpg)

2. With a linked project the tab shows *Currently linked Rentman project* at the top with the counters *n imported*, *n without Rentman ID* and *n removed*, plus the buttons *Refresh from Rentman / import new items* and, if needed, *Rebuild N missing library entries* (reconstructs the templates from the data of the plan).

   ![Linked project with imported devices](bilder/en/bibliothek-100-rentman-verknuepft-importiert.jpg)

3. The view *Imported* lists the imported devices by project (the active one carries the badge *AKTIV*) and category. With *Collapse all* / *Expand all* and the search field *Search Rentman devices…* you keep the overview.

   ![Search in the imported devices](bilder/en/bibliothek-105-rentman-suche.jpg)

4. The view *Catalog* shows, after *Load catalog*, all equipment created in your Rentman account, organised by the Rentman folders, with the Rentman ID. *+ Project* asks *Add "…" to Rentman?* and points out that this changes the Rentman project and is not automatically reversible.

   ![Catalog loaded](bilder/en/bibliothek-110-rentman-katalog-geladen.jpg)

   ![Question Add to Rentman](bilder/en/bibliothek-113-rentman-katalog-zum-projekt.jpg)

5. The view *Reconcile* (*Reconcile canvas ↔ Rentman*) states how many devices of the plan are not tracked: first those *No longer in Rentman* (*removed*), then the devices without a Rentman ID (*no Rentman ID*).

   ![Reconcile canvas and Rentman](bilder/en/bibliothek-114-rentman-abgleich.jpg)

A Rentman device for which a local device of the same name exists can be linked with its ports (button *Link* on the entry).

### Cables

The tab *Cables* (*Cable library*) lists the cable types, grouped by connector type (for example *Audio / XLR*, *SDI*, *Ethernet*, *Fiber*). Behind each group is the number of types. At the top the line *N installed* states how many cables are in the plan, how many custom cable types there are and which SDI recommendation applies.

![Cable library](bilder/en/bibliothek-62-kabel-uebersicht.jpg)

1. A click on a group opens it. Each type shows colour, name, connector with maximum length and signal standards.

   ![Opened cable group](bilder/en/bibliothek-63-kabel-gruppe-aufklappen.jpg)

2. Custom types carry the badge *Custom*, adjusted built-in types the badge *Adjusted*.

   ![Custom cable type in the list](bilder/en/bibliothek-69-kabel-eigener-typ.jpg)

3. The pencil opens *Edit cable type*. The form has the fields *Name*, *Connector type* (with **+** for a new connector type), *Cable colour*, *Also compatible with (optional)*, *Signal standards* (with *+ Standard* for a new standard), *Max. length (m) — optional* and *Note (optional)*. *Save* is only possible when a name and at least one standard are set. For a built-in type the change is saved as a local adjustment (*Adjusted*); the button with the arrow (*Remove override*) asks *Reset override for "…"?* and restores the original values with *Reset*.

   ![Dialog Edit cable type](bilder/en/bibliothek-64-kabel-eintrag-bearbeiten.jpg)

4. The red **×** on a custom type asks *Delete cable type "…"?* — installed cables are not affected (if a cable refers to the type, it keeps connector and standard but loses the link to the template).

   ![Delete a custom cable type](bilder/en/bibliothek-70-kabel-eigener-typ-loeschen.jpg)

5. The groups can be moved by the grip in front of the name.

   ![Moving a cable group](bilder/en/bibliothek-71-kabel-gruppe-verschieben.jpg)

You create new custom cable types under *Settings → Cable types*.

### Groups

The tab *Groups* (*Device groups: Multiple devices + cables as a template*) shows saved device groups. A card names the name, the number of devices and cables, the height in RU and the device names. A group is created on the canvas: select several devices and click the button *Save N selected devices as a group* in the toolbar (see [Saving a device group](#saving-a-device-group)).

![Saved groups](bilder/en/bibliothek-74-gruppen-uebersicht.jpg)

1. When you point at a card, *Rename* (pencil), *Export* (arrow down) and *Remove group from library* (red **×**) appear.

   ![Card with buttons](bilder/en/bibliothek-75-gruppe-karte-hover.jpg)

2. A click on the card places the group on the canvas; when dragged, it lands at the drop position.

   ![Group placed on the canvas](bilder/en/bibliothek-76-gruppe-klick-platzieren.jpg)

3. *Rename* asks *New template name:*. If the name exists, the app asks for another one.

   ![Rename a group](bilder/en/bibliothek-79-gruppe-umbenennen-eingetippt.jpg)

4. *Export* saves the group as a `.cpgroup` file in the Downloads folder; *Import file…* in the **+** menu of the *Equipment* tab reads it again. If the name is already taken, the app asks about overwriting.

5. The red **×** asks *Delete group "…"?*.

   ![Delete a group](bilder/en/bibliothek-81-gruppe-loeschen-abfrage.jpg)

6. The cards can be re-ordered by the grip in front of the name.

   ![Order of the groups](bilder/en/bibliothek-83-gruppe-reihenfolge-losgelassen.jpg)

Without groups it says *No groups saved yet.*

![No groups](bilder/en/bibliothek-94-gruppen-leer.jpg)

### Racks

The tab *Racks* (*2D Rack Builder: Rack slots in RU, saved as a placeable group*) shows saved rack layouts as cards with the number of devices, RU and cables and the device names. At the top are the buttons *For the warehouse* and *+ New rack*.

![Racks](bilder/en/bibliothek-86-racks-uebersicht.jpg)

1. A click on the card places the rack as a black box on the canvas; when dragged, it lands at the drop position. When you point at it, *Edit* (pencil, opens the rack builder), *Export* and the red **×** (*Remove rack from library*, asks *Delete rack "…"?*) appear.

   ![Rack card with buttons](bilder/en/bibliothek-87-racks-karte-hover.jpg)

2. *For the warehouse* saves what sits in each rack as a file for the Inventory Planner, which checks it against the rack case. Afterwards the app says how many racks were handed over and how many devices sit outside their rack and were left out. Without racks it says *No rack layout to hand over yet.*

   ![For the warehouse without racks](bilder/en/bibliothek-93-racks-fuers-lager-leer.jpg)

3. Without saved racks it says *No rack layout saved yet.*

   ![No racks](bilder/en/bibliothek-92-racks-leer.jpg)

#### Rack Builder

*+ New rack* opens the 2D rack builder with an empty rack; the pencil on a card opens it with that rack. On the left the builder has the library of devices (*Patch panel*, *Rack shelf*, search, *Include non-rack devices*), in the middle the rack layout (*2D* or *3D*; *Front*, *Rear*, *Both*, *Side*) and on the right the live preview as a black box on the canvas. At the top are *Rack name*, *Height (HE)* and *Depth (mm)*, at the bottom *Wire internally*, *Cancel* and *Save*. Devices come with *+ Into rack* or by dragging into a slot; *Conflicts* names what does not fit. The saved rack is a placeable group.

![Rack builder with a new rack](bilder/en/bibliothek-88-racks-neues-rack.jpg)

![Rack builder with a saved rack](bilder/en/bibliothek-89-racks-bearbeiten.jpg)
