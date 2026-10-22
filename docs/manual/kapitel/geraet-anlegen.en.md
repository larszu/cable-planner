## Create a device

A device the library does not know is created by yourself: by hand, with the help of a photo of the connector side, or through the Rentman import. This chapter shows which way fits when and where the new device ends up. The individual fields of the dialog *Create your own device* are described in the chapter [Library](#4-library); the connectors of a placed device are edited in the [Inspector](#6-inspector).

| Way | When | Result |
|---|---|---|
| By hand | You know the connectors or first need only a placeholder. | Device in the library, in the project or both |
| With a photo | You have a photo of the connector side and have set up an AI provider. | Suggestion for the port groups that you check |
| With Rentman | The device is in a Rentman project. | Templates in the library, with a Rentman ID |

### By hand

The dialog *Create your own device* opens in three ways:

- in the **+** menu of the library with *New device…*,
- with a right click on empty area of the plan and *New device here …* (the device lands at the click position),
- with **Ctrl/Cmd + Plus** over the plan. This way asks only for the name; the device gets the category *Other* and no connectors.

1. Type the name. Matching devices of the library appear below it with *Use as template*; this takes category and port groups of a similar device and you change only what differs.

   ![Suggestions while typing](bilder/en/geraet-anlegen-04-a-name-treffer.jpg)

2. At the bottom, choose where the device should end up:

   | Button | Library | Plan |
   |---|---|---|
   | *Save to library* | yes | no |
   | *Place in project only* | no | yes |
   | *Save + place* | yes | yes |

   *Place in project only* suits rental devices, placeholders and one-offs: no template is created that stays in the library afterwards.

   ![Form for a rental device](bilder/en/geraet-anlegen-22-a-nur-projekt-vorbereitet.jpg)

   ![The device is on the plan, not in the library](bilder/en/geraet-anlegen-23-a-nur-projekt-platziert.jpg)

3. With *Save to library* the template is in the library and the plan stays unchanged. The library search finds it at once.

   ![Device only in the library](bilder/en/geraet-anlegen-26-a-nur-bibliothek-suche.jpg)

4. A device without port groups is allowed. The library shows it with *0 in / 0 out*, and the dialog says that connectors can be added later.

   ![Device without connectors in the library](bilder/en/geraet-anlegen-28-a-portlos-platziert.jpg)

#### Adding connectors later

A device that was created with a name only gets its connectors in the Inspector.

1. Place the device and select it. The section *Inputs & outputs* shows *0 In · 0 Out*, with *None* under *Inputs* and *Outputs*.

   ![Inspector of a device without connectors](bilder/en/geraet-anlegen-30-a-nur-name-inspektor.jpg)

2. *+ Port* adds a connector. Enter the name, choose the connector and, if needed, enter the function.

   ![New connector with a name](bilder/en/geraet-anlegen-31-a-port-plus.jpg)

   ![Connector with plug, function and gender](bilder/en/geraet-anlegen-37-a-port-ausgefuellt.jpg)

3. More connectors come with *+ Port*; the red **×** removes one. A cable dropped onto the device also adds a connector.

### With a photo

This way needs an AI provider with a key. The photo shows the connector side; the app sends it to the chosen provider for recognition. The suggestions are guesses and are never taken over without your confirmation.

1. Set up the provider under *Settings → Integrations*. There you also choose where the button *Fill in* takes its suggestions from: a *Web search* (no key) or the *AI model* (with key).

   ![Source for filling in: web search or AI model](bilder/en/geraet-anlegen-72-b-quelle-ki.jpg)

   ![Choose a provider and store the key](bilder/en/geraet-anlegen-74-b-anbieter-claude.jpg)

   Without a key the dialog shows, instead of the photo function, the note to enter the provider, with the button *Open settings*. The key can also be stored in the dialog itself; it is saved locally only.

   ![Enter the key in the dialog](bilder/en/geraet-anlegen-76-b-schluessel-eingetippt.jpg)

2. Open *Create your own device*. The section *Recognise ports from a photo* takes photos with *Choose photos*, by dropping or by pasting.

   ![Section Recognise ports from a photo](bilder/en/geraet-anlegen-79-b-foto-feld.jpg)

3. With a photo, *Recognise*, the preview and the tick *Keep the photos on the device when placing it* appear. Several photos of the same device are possible; the **×** on the preview removes one.

   ![Photo chosen](bilder/en/geraet-anlegen-80-b-foto-gewaehlt.jpg)

4. *Recognise* sends the photos. While the request runs, the button reads *Recognising…*.

   ![Recognition running](bilder/en/geraet-anlegen-86-b-erkennen-laeuft.jpg)

5. The result is a table: *Device:* names the recognised model. If the catalogue has a device with datasheet ports for it, *Place catalogue device* offers it. Every row has a tick, direction (*Input*, *Output*, *Both ways*), count, connector and label. Unsure rows are unticked and marked *unsure*.

   ![Check the suggestions](bilder/en/geraet-anlegen-87-b-vorschlag.jpg)

6. Tick or untick unsure rows and change what is wrong. *n port group(s) to the form* enters the ticked rows as port groups.

   ![Rows chosen, ready to take over](bilder/en/geraet-anlegen-90-b-zeile-abgewaehlt.jpg)

   ![Port groups in the form](bilder/en/geraet-anlegen-92-b-uebernehmen.jpg)

7. Save as usual. With the tick *Keep the photos on the device when placing it*, the photos afterwards hang under *Photos* on the device.

   ![Device with the photos in the Inspector](bilder/en/geraet-anlegen-94-b-inspektor-fotos.jpg)

If the photo shows nothing readable, the app reports *Nothing recognised* and advises a sharper photo, straight on, with the labels readable. If the provider rejects the request (for example because of an invalid key), its error message appears under the section.

![Error message of the provider](bilder/en/geraet-anlegen-101-b-fehler-anbieter.jpg)

For an already placed device without connectors, the Inspector offers the same as *AI port suggestion* with the button *Suggest ports*. The suggestions appear as a list; *Adopt* enters them, *Discard* leaves the device unchanged.

![Suggestion in the Inspector](bilder/en/geraet-anlegen-98-b-inspektor-vorschlag.jpg)

![Suggestion adopted](bilder/en/geraet-anlegen-99-b-inspektor-uebernommen.jpg)

The examples in these pictures use invented answers and a sample picture, no real key.

### With Rentman

If the device is in a Rentman project, you do not create it yourself but import it. The flow starts with the Rentman token under *Settings → Integrations*, followed by *File → Rentman import…*, the choice of devices, the *Category mapping before import* and, where needed, a conflict dialog for devices that already exist under this name. The steps with all pictures are in the chapter [File and Import](#rentman-import); the views of the tab *Rentman* in the library are described in [Rentman in the library](#rentman-in-the-library).

![Rentman import with a chosen project](bilder/en/geraet-anlegen-113-c-projekt-gewaehlt.jpg)

In the conflict you decide per device whether the local version stays, the device is linked to another local device, overwritten by the Rentman version, merged with it in its connectors or skipped. Merging opens the dialog [Merge devices](#merge-devices).

### Building on a library device

An existing device is the starting point for a new one.

1. Drag the library entry onto the plan or click it. It appears as a device with all connectors of the template.

   ![Device from the library on the plan](bilder/en/geraet-anlegen-59-d-ziehen.jpg)

2. *Edit → Duplicate* (**Ctrl/Cmd + D**) copies the selected device with its connectors.

   ![Menu Edit](bilder/en/geraet-anlegen-62-d-bearbeiten-menue.jpg)

   ![The duplicate next to the original](bilder/en/geraet-anlegen-63-d-duplizieren.jpg)

3. In the Inspector, the section *Replace device* swaps a placed device for an entry of the library. *Choose another device…* opens a search; the confirmation says how many connectors are mapped and how many cables lose their port and would be deleted.

   ![Search in the section Replace device](bilder/en/geraet-anlegen-66-d-ersetzen-suche.jpg)

   ![Confirmation before replacing](bilder/en/geraet-anlegen-67-d-ersetzen-bestaetigen.jpg)

   ![The device after replacing](bilder/en/geraet-anlegen-68-d-ersetzen-ergebnis.jpg)
