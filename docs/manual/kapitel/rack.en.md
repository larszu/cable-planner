## Rack

A rack combines devices in 19-inch rack units (RU) and behaves on the plan like a single device. This chapter follows the path of a rack: create, save, place, edit afterwards, hand over to the warehouse and delete. The details of the rack builder (patch panel, shelf, 3D, STL, conflicts, export) are in the chapter [Tools: Build](#11-tools-build), the cards of the tab *Racks* in the chapter [Library](#4-library).

| Step | Where | Described in |
|---|---|---|
| Create | *Tools → Create new rack…*, *+ New rack* in the tab *Racks*, or arrange selected devices in the rack builder | [Tools: Build](#11-tools-build), [Canvas](#3-canvas) |
| Save | *Save rack* in the rack builder puts a card into the tab *Racks* | [Tools: Build](#11-tools-build) |
| Place | Click on the card | this chapter |
| Edit | *Open rack editor* on the placed rack, pencil on the card | this chapter |
| For the warehouse | *For the warehouse* in the tab *Racks* | this chapter |

### Saved racks

The tab *Racks* of the library (heading *2D Rack Builder*) shows every saved rack as a card with the number of devices, RU and cables and the device names. Without saved racks it says *No rack layout saved yet.*

![The tab Racks with a card](bilder/en/rack-01-racks-reiter.jpg)

When you point at the card, three buttons appear: the pencil (*Edit in the 2D rack builder*), *Export* (a copy as a file in the Downloads folder) and the red **×** (*Remove rack from library*).

![The card with its buttons](bilder/en/rack-02-karte-hover.jpg)

### Placing a rack on the plan

1. Open the tab *Racks* and click the card. The rack stands on the plan as one device, with *(Rack)* added to its name.

   ![The placed rack](bilder/en/rack-06-karte-platziert.jpg)

   On the plan the rack shows every device it contains in its RU order with its connectors. The dashed lines inside the rack are the internal cables that were taken along when saving. From outside you connect the connectors of the contained devices like those of any other device.

2. A right click on the header of the rack opens the context menu. *Open rack editor* exists only for a rack; the other entries are those of a device (*Add annotation…*, *Device datasheet…*, *Lock position*, *Delete device*).

   ![Context menu of a rack](bilder/en/rack-07-blackbox-kontextmenue.jpg)

### Editing a placed rack

*Open rack editor* opens the rack builder for this rack. The header names the rack and carries the mark *Editing*. You rearrange devices, add or remove some and change *Height (HE)* and *Depth (mm)*. On the right the *Live-Preview* shows how the rack looks on the plan; the footer counts devices, occupied RU and internal cables. *Save* takes over the change, *Cancel* discards it.

![The rack builder for the placed rack](bilder/en/rack-08-rack-editor-offen.jpg)

### For the warehouse

*For the warehouse* in the tab *Racks* hands over what sits in each saved rack, as a file, to the Inventory Planner, which checks it against the rack case. Afterwards the app says how many racks were handed over (*1 racks handed over.*) and, if there are any, how many devices sit outside their rack and were therefore left out. Without saved racks it says *No rack layout to hand over yet.*

![Message after For the warehouse](bilder/en/rack-05-lager-meldung.jpg)

### Deleting a rack

The red **×** on the card asks *Delete rack "…"?* with *Cancel* and *Delete*. Deleting removes the card from the library.

![Confirmation before deleting](bilder/en/rack-04-karte-loeschen-frage.jpg)
