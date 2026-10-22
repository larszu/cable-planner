## Tools: Plan

The *Tools* menu has five groups: *Calculate*, *Check*, *Plan*, *Create & manage* and *Device configuration*. This chapter describes the calculators, the checks and the tools for capturing and planning on site. The other entries of the groups *Plan* and *Create & manage* are in the chapter "Tools". Every dialog opens from *Tools* and closes with the **×** or Esc.

![Tools menu](bilder/en/werkzeuge-planen-01-menue-werkzeuge.jpg)

The menu entries and their hint lines:

| Group | Entry | Hint line |
|---|---|---|
| *Calculate* | *Calculate recording storage…* | – |
| | *Projection & display…* | – |
| *Check* | *Analyses (weight/network/redundancy)…* | Weight, network, redundancy, cable runs |
| | *Plan check…* | Finds gaps and contradictions in the plan |
| | *Plan vs. found…* | Compares the plan with what is on site |
| *Plan* | *Survey (capture existing)…* | Capture existing equipment on site: name, room, assumed connection, photo |
| | *Drum micing…* | Place and name microphones on the kit |
| | *Wireless / vocals…* | Frequencies, transmitters, receivers in the spectrum |
| | *Rundown and camera assignments…* | Read in segments, assign a shot per camera position |
| | *Delivery (streaming destinations)…* | Where it goes out, with which parameters |

### Calculate

#### Recording storage calculator

*Tools → Calculate recording storage…* calculates the storage a recording needs: codec bitrate × duration × channels. The values are guide figures without file system overhead.

![Recording storage calculator](bilder/en/werkzeuge-planen-02-speicher-offen.jpg)

| Field | Meaning |
|---|---|
| *Codec / bitrate preset* | A preset with resolution, frame rate and bitrate in its name, for example *ProRes 422 HQ (1080p25) — 220 Mbps*. The list holds ProRes 422 HQ, 422, 422 LT and 4444 (1080p25), ProRes 422 and 422 HQ (2160p25), DNxHD 220, 145 and 36 (proxy), H.264 1080p (high), H.265 2160p (high), XDCAM HD422 50, AVC-Intra 100 and *Custom (own bitrate)*. |
| *Custom bitrate (Mbps)* | Appears with *Custom*. |
| *Hours*, *Minutes*, *Channels* | Duration and number of recorded channels. |

The result shows *Effective bitrate*, *Duration*, *Per channel*, the total for all channels and the *Write rate* with a rating (for example *uncritical* or *single HDD borderline*).

1. Pick another preset, here *ProRes 422 HQ (2160p25)*.

   ![Another preset](bilder/en/werkzeuge-planen-03-speicher-codec-gewaehlt.jpg)

2. With *Custom (own bitrate)* you enter the bitrate yourself.

   ![Custom bitrate](bilder/en/werkzeuge-planen-04-speicher-custom.jpg)

3. Enter duration and channels.

   ![Four channels, four and a half hours](bilder/en/werkzeuge-planen-05-speicher-dauer-kanaele.jpg)

4. The block *Array sizing* works out the drives: *Redundancy* (*None (JBOD)*, *RAID 5 (+1)*, *RAID 6 (+2)*, *Mirror (×2)*), *Slack (%)* and *Drive (TB)*. The result shows *Usable need incl. headroom* and *Drives needed*.

   ![Array with RAID 6](bilder/en/werkzeuge-planen-06-speicher-array.jpg)

5. *Formula* unfolds the calculation rule.

   ![Formula](bilder/en/werkzeuge-planen-07-speicher-formel.jpg)

#### Projection & display

*Tools → Projection & display…* works out image size, throw distance and viewing distances, and the resolution of an LED wall. Two tabs: *Projection & display* and *LED wall*.

##### Tab Projection & display

A second selection chooses the kind: *Projector* or *Display / LED*.

![Projection with default values](bilder/en/werkzeuge-planen-08-projektion-offen.jpg)

| Field | Meaning |
|---|---|
| *Diagonal* (″) | Image diagonal in inches. |
| *Aspect ratio* | *16:9 (HD/UHD)*, *16:10 (WUXGA)*, *4:3 (XGA)*, *21:9 (UltraWide)*, *2.39:1 (CinemaScope)* or *1:1*. |
| *Bottom edge above floor* (m) | Height of the image's bottom edge. |
| *Throw ratio* | Projector only: ratio of throw distance to image width. |
| *Lens shift vertical* / *horizontal* (%) | Projector only. |
| *Available depth* (m) | Projector only: room depth for checking the distance. |

Below, *2D plan* and *3D view* select the preview. The 2D plan shows a side view with projector, image area and the viewing distances (*First row*, *Optimal*, *Last row*) and a front view with dimensions. The result fields:

| Result | Meaning |
|---|---|
| *Image area (W × H)* | Width and height of the image. |
| *Top edge above floor* | Height of the image's top edge. |
| *Throw distance (lens → image)* | Throw ratio × image width (projector only). |
| *Lens height above floor*, *Lens offset from screen centre* | Position of the lens (projector only). |
| *Max. image width in room* | Largest image width at the available depth (projector only). |
| *Min. viewing distance (THX 36°)* | Smallest distance by THX. |
| *Optimal viewing distance (SMPTE 30°)* | Distance by SMPTE. |
| *Max. viewing distance (6 × image height)* | Largest distance. |

If the projector does not fit the available depth or the lens ends up below the floor, the dialog says so.

1. Enter diagonal, throw ratio and available depth. The preview and results follow at once.

   ![Values entered](bilder/en/werkzeuge-planen-09-projektion-wurf-werte.jpg)

2. *3D view* shows the room with projector, image and seat positions in three dimensions.

   ![3D view](bilder/en/werkzeuge-planen-10-projektion-3d.jpg)

3. *Display / LED* hides the projector fields; diagonal, aspect ratio and bottom edge remain.

   ![Kind Display / LED](bilder/en/werkzeuge-planen-11-projektion-display.jpg)

##### Tab LED wall

The tab works out the resolution of an LED wall from *Pixel pitch* (mm), *Width* (m) and *Height* (m): *Resolution* in pixels and *Total pixels* with megapixels. The rule of thumb: the minimum viewing distance in metres is roughly the pixel pitch in millimetres; with 2.6 mm that is from about 2.6 m.

![Tab LED wall](bilder/en/werkzeuge-planen-12-projektion-led.jpg)

![LED wall with 3.9 mm](bilder/en/werkzeuge-planen-13-projektion-led-werte.jpg)

### Check

#### Analyses

*Tools → Analyses (weight/network/redundancy)…* opens a dialog with 14 tabs in two rows: *Was ansteht*, *Kunden-Übersicht*, *Kosten: Plan gegen Ist*, *Crew: Stunden & Auslagen*, *Namensregel*, *Dante-Patch*, *Gewicht & Wärme*, *Netzwerk*, *Redundanz*, *RF / Funk*, *Kabelwege*, *Signalwege*, *Anschlussliste* and *Blatt prüfen*. The tab labels appear in German in every interface language; the contents of the tabs are translated. The examples show a project in which a lot is deliberately unfinished.

![Analyses, tab Gewicht & Wärme](bilder/en/werkzeuge-planen-73-analysen-offen.jpg)

##### Was ansteht

*Was ansteht* says what is due and edits nothing. The page gathers findings from the other analyses by urgency: *Due*, *State* (for example *today* or *no date*), *Source* (for example receipts, costs, crew) and *What*. Without findings it reads *Nothing open — there is nothing to report on this state.*

![What is due](bilder/en/werkzeuge-planen-92-ansteht-spaeter.jpg)

##### Kunden-Übersicht

The *Kunden-Übersicht* is a table of key figures (*Range*, *Metric*, *Value*, *Share*, *Basis*) for devices, cables and other areas of the plan, with *Export CSV*. A selection decides whether it shows the plan as planned or as built.

![Client overview](bilder/en/werkzeuge-planen-75-kunde.jpg)

##### Kosten: Plan gegen Ist

The tab compares estimate and actual value per cost line. Each row has a reference device (*— no anchor —* or a device), *Estimate*, the actual value and its origin (*Where it comes from*). The total row shows the project estimate (calculated), the lines without estimate or actual value and the deviation in percent. If it exceeds the set tolerance, the tab says so. An actual value without a stated origin is reported as well.

![Cost row](bilder/en/werkzeuge-planen-79-kosten-zeile-werte.jpg)

##### Crew: Stunden & Auslagen

The tab works out hours, rates and expenses for a period (*from* … *to*) and produces the sheet for the accounts (*Sheet as CSV*). A line at the top sums up: *Hours*, *Labour*, *Billable expenses*, *own expenses* and *to the client*. The sections:

| Section | Content |
|---|---|
| *People* | Name and company / freelance; add a person. |
| *Surcharge bands* | Band name, start, end, surcharge in percent, *Sundays only*; add a band. |
| *Rates* | Per person an activity with hourly rate, optionally a flat fee, hours from and surcharge; add a rate. |
| *Shifts* | Date, person and activity, start, end and booking state (for example *confirmed*); the row shows hours, amount and overtime. Add a shift. |
| *Expenses* | Date, kind (travel, accommodation, per diem, material, other), job, amount, receipt, *goes to the client*; add an expense. A receipt text (till-slip mail, PDF text) can be pasted; the app reads date, amount, issuer, currency and tax rate and *Create expense from receipt* creates an expense. |
| *Receipt coverage per cost line* | How much of the actual values the receipts cover. The documented sum is not written into the actual value. |
| *Approvals* | Paste a message; time and sender are read as far as they are in the text. *Record approval*. |
| *Handover to the accounts (net)* | The items per person and the call-out flat fees. |

The tab reports overtime without an approval as a hint.

![Tab Crew](bilder/en/werkzeuge-planen-81-crew-leer.jpg)

![Person and surcharge band](bilder/en/werkzeuge-planen-83-crew-band.jpg)

![Shift with overtime](bilder/en/werkzeuge-planen-87-crew-schicht-nacht.jpg)

![Receipt read](bilder/en/werkzeuge-planen-89-crew-beleg-lesen.jpg)

![Approval recorded and handover](bilder/en/werkzeuge-planen-91-crew-uebergabe.jpg)

##### Namensregel

The tab forms device names from a rule instead of from a feeling. A row with separator, case (*as generated*, *UPPER*, *lower*) and category (*— all categories —* or one) controls the naming; the table shows *Old name*, *New name* and the character count. *Apply (n)* renames the devices, *Export CSV* writes the table.

Below, *Recording names* produces the file name of every recording from the plan: *Take*, *Separator* and a *Sheet for the deck (CSV)*. The table lists per role the recorder, the channel and the file name. If a role reaches no recorder, no recording is made; a hint beside it says so.

![Naming rule](bilder/en/werkzeuge-planen-93-namen.jpg)

![Rule uppercase, category Audio](bilder/en/werkzeuge-planen-94-namen-regel.jpg)

![Take number in the recording names](bilder/en/werkzeuge-planen-96-namen-aufnahme.jpg)

##### Dante-Patch

*Read matrix* reads the subscription matrix of a Dante network and shows the number of receive channels; *Export CSV* writes it as a sheet. When a second matrix is read, *Changes* shows the comparison.

![Dante matrix read](bilder/en/werkzeuge-planen-98-dante-eins.jpg)

![Changes against the second matrix](bilder/en/werkzeuge-planen-99-dante-zwei.jpg)

##### Gewicht & Wärme

The tab shows weight (kg), power (W), heat load (BTU/h) and value (€) per category from the device properties, with a total row. A line says how many devices have no weight stated. *Heaviest devices (rigging/transport)* lists the heaviest devices; *Export CSV* writes the table. The button *Calculate power consumption…* opens the [Power calculator](#power-calculator).

![Gewicht & Wärme](bilder/en/werkzeuge-planen-100-gewicht.jpg)

###### Power calculator

The calculator adds up the power ratings of the devices (devices without a value do not count). *Connection type* (for example *CEE 32 A (3-phase, red)*) and *Safety margin (%)* determine the sizing. The result shows the devices counted, the total consumption plus margin in W and kW, the current, the generator size and the heat in BTU/h and kW; *Fits on* names the connections that suffice. *Phase distribution* shows the load per phase and the neutral current; *Devices → Phase* assigns devices to a fixed phase or leaves them on *Auto* (the balancer distributes, sorted by power). *EU colour code (DIN VDE 0293-308)* names the conductor colours. *Export CSV* and *PDF report* write the result. Further sections: *UPS / battery backup* (apparent power, power factor, battery data, load, recommended UPS, estimated backup time), *Voltage drop (feeder)* (cable length, cross-section, load current, voltage drop in percent rated ≤ 3 %, > 3 %, > 5 %) and *Top consumers*.

![Power calculator](bilder/en/werkzeuge-planen-101-strom-offen.jpg)

##### Netzwerk

The *Netzwerk* tab gives an IP/VLAN overview of all network-capable devices with a duplicate-IP check. At the top are *Calculate bandwidth* (see below) and the findings: *Duplicate IP addresses* and *Check Dante/AES67 names (≤31 chars, a–z/0–9/-)* with a suggestion for a valid name. Below follow the table *Device*, *IP*, *Mgmt VLAN*, *VLANs* and the sections:

| Section | Content |
|---|---|
| *Segments (VLAN, purpose, timing, way in)* | One segment per VLAN with name, *Purpose* (media primary, media secondary, control, management, not stated), *PTP domain* and *Way in*. Adopting VLANs from the plan creates the segments; *Segments* exports, *Who sits where* lists the devices per segment. A VLAN number alone does not say whether Dante may go there; the tab therefore reports segments without a name. |
| *Streams* | Sent and received streams of the devices (protocol, address, format); *CSV*. |
| *Patch panel labels* | Strips and labels for patch panels: *Template: automatic* (or a template), *Print strips*, *Generic (CSV)* (format selectable) and *Label-printer file*. If a patch panel is in no rack, the tab says so. |
| *Address ranges (standing plan + venue overlay)* | A standing layer and the *venue layer*; the venue layer replaces a standing range with the same key. *Ranges* exports. |
| *Subnets* | The subnets of the plan with their devices. |
| *Address plan* | How many network devices are addressed; hints on missing or duplicate addresses. |
| *Switch port map* | Per switch the ports with device, interface, address and kind of connection; *CSV* and *Labels*. |
| *Request to the venue IT* | The wishes towards the venue network (VLANs, address ranges, network ports, media bandwidth, multicast standards, PoE, IGMP querier, PTP, DHCP, QoS / DSCP). For each point the answer can be recorded: *granted*, *with a condition* (with a field *condition or workaround, in plain words*), *refused* or *no answer yet*. *CSV*. |
| *Timing (PTP)* | The PTP domains and the question which device sets the clock. |
| *Which box fills which slot* | Devices with a network identity but without a named unit. |
| *Multicast address plan* | *Pool (CIDR)* and *UDP port*; assigning gives the streams addresses. |

![Network, upper part](bilder/en/werkzeuge-planen-110-netz-oben.jpg)

![Segments adopted from the plan](bilder/en/werkzeuge-planen-112-netz-segmente-uebernehmen.jpg)

![Subnets, address plan, switch port map](bilder/en/werkzeuge-planen-119-netz-subnetze.jpg)

![Request to the venue IT](bilder/en/werkzeuge-planen-122-netz-haus-anforderung.jpg)

![Recording the venue IT's answers](bilder/en/werkzeuge-planen-123-netz-haus-antwort.jpg)

![Timing (PTP) and Which box fills which slot](bilder/en/werkzeuge-planen-124-netz-ptp.jpg)

###### Calculate bandwidth

*Calculate bandwidth* works out the gross data rate of a video stream before compression and names the smallest SDI tier that carries it (pixels × lines × fps × bits per pixel). If it exceeds 12G-SDI, the dialog says it is possible only over IP transport (ST 2110, NDI, JPEG-XS …). Unfoldable lists name the SDI tiers and the IP/digital signal standards. The section *Project network budget* adds up the gross bandwidths of all cables with an IP media signal (NDI, Dante/AES67, ST 2110); Ethernet cables do not count as load, their capacity is shown separately below.

![Bandwidth calculator](bilder/en/werkzeuge-planen-129-bandbreite-offen.jpg)

##### Redundanz

The table *Device* / *Finding* names per device what is missing in redundancy, for example *only one power connection (no PSU redundancy)*, *no power connection in the plan* or *ST 2110 without 2110-7 redundancy (only one network path)*. *Export CSV* writes it.

![Redundancy](bilder/en/werkzeuge-planen-133-redundanz.jpg)

##### RF / Funk

*RF / Funk* calculates everything in the plan that transmits — the wireless mic rig and the radio links — in one calculation. The tab names the number of transmitters in the plan, transmitters without a frequency (they are in no calculation) and lists *Possible RF conflicts* (for example the same WLAN channel) and *Frequency findings across the whole spectrum* (carrier spacing and intermodulation of 2nd and 3rd order).

Below are *Free frequencies in band* (band selectable), the *Frequency bands (Sennheiser / Shure / …)* as a table with manufacturer, series, band, MHz range and notes (for example restricted in the EU), and the *Spectrum scan from the analyser*: *Read scan* reads a CSV with measurement points, *occupied from (dBm)* sets the threshold, *Sync* checks the carriers against the scan. Carriers outside the measured range are listed separately; "not measured" does not mean "free".

![RF / Funk](bilder/en/werkzeuge-planen-134-rf.jpg)

![Frequency bands](bilder/en/werkzeuge-planen-136-rf-bandtabelle.jpg)

![Spectrum scan read](bilder/en/werkzeuge-planen-137-rf-scan.jpg)

##### Kabelwege

The tab reports cables whose length is doubtful: estimated lengths carry their origin. It names cables whose estimated length has changed since the estimate and cables beyond the range of their type, each with the services running in the run. *CSV* writes the list.

![Cable runs](bilder/en/werkzeuge-planen-139-wege.jpg)

##### Signalwege

The tab lists the multi-stage paths: source, port, cable number, intermediate device (converter, patch panel) and *End device reached*.

![Signal paths](bilder/en/werkzeuge-planen-140-signal.jpg)

##### Anschlussliste

The connection list shows every network connection with device, interface, IP, VLAN, path and the switch port reached, with the source (*Cables*, *Interface*, *Cable + interface*). Connections whose path ends at a device other than a switch are listed under *Without a reached switch*. *Only open ones* shows just the unresolved ones; *CSV* exports.

![Connection list](bilder/en/werkzeuge-planen-141-anschluss.jpg)

##### Blatt prüfen

*Blatt prüfen* takes a printed sheet in hand: type the eight-character state from its foot, or read the whole document code; *Check* says whether the sheet matches the current plan, cannot be read or belongs to another project.

![Check a sheet](bilder/en/werkzeuge-planen-146-blatt-fremd.jpg)

#### Plan check dialog

*Tools → Plan check…* finds gaps and contradictions in the plan. The check runs continuously against the current plan, not only on saving. At the top are the counts of findings by severity (errors, warnings, infos) and the total. Each row names the kind (for example *Duplicate cable number*, *Duplicate IP*, *House outlet*, *Fibre breakout*) and the finding. Clicking a row selects the affected object in the plan. In the status bar at the bottom, three coloured counters show the same state.

![Plan check](bilder/en/werkzeuge-planen-148-check-offen.jpg)

![Status bar with counters](bilder/en/werkzeuge-planen-147-statusleiste.jpg)

#### Plan vs. found

*Tools → Plan vs. found…* compares the plan with what is on site: what came off the truck, under which names and with which addresses — against what the plan says. *Load file* reads a CSV file of the finds. Each row shows the result (*matches*, *address differs*, *not found*, *not in the plan*, *not unique — no match made*), the device found with its address and how it was matched (by IP or by name). A line at the top counts the results. The button *As-built* writes the as-built sheet (as planned / as built); the line "n of m entries verified" says how many entries have been checked. *CSV* exports the comparison.

![Plan vs. found, no file yet](bilder/en/werkzeuge-planen-153-abgleich-offen.jpg)

![Comparison with a file loaded](bilder/en/werkzeuge-planen-154-abgleich-datei.jpg)

### Plan

#### Survey

*Tools → Survey (capture existing)…* is for the walk through the room: write down what you see. The fields: *Device* (required), *Room* (stays for the next entry), *Connected to (assumed)* and *Note*. *Capture (Enter)* creates the entry; if a device of the same name is already in the plan, the app says so.

Two lists: *From the phone (n)* shows entries a phone has reported (on the phone set "Contribute" and choose "Report" → "New device"; phone access must be on beforehand). A tick adopts the entry, **×** discards it. *Captured, not worked out yet (n)* gathers the captured entries; *Done* takes an entry off the list. On an entry, *Photos* with *Add photo…* attaches a photo.

![Survey](bilder/en/werkzeuge-planen-14-bestand-offen.jpg)

![Entry captured](bilder/en/werkzeuge-planen-17-bestand-erfasst.jpg)

![Add a photo](bilder/en/werkzeuge-planen-19-bestand-fotos.jpg)

![Adopted from the phone](bilder/en/werkzeuge-planen-20-bestand-telefon-annehmen.jpg)

#### Drum micing

*Tools → Drum micing…* places and names the microphones on the drum kit. On the left is the kit as a top view with the zones *Kick*, *SN Top*, *SN Bot*, *HiHat*, *Tom 1*, *Tom 2*, *Floor Tom*, *Ride*, *OH L*, *OH R*, *Room L* and *Room R*. At the top, the *Technique* presets set a starting point: *Minimal (Kick + Overheads)*, *Glyn Johns (4 Mics)*, *Recorderman (Kick, Snare, 2 OH)* and *Full Close*; *Remove all mics* empties the kit.

![Drum micing](bilder/en/werkzeuge-planen-22-drum-offen.jpg)

1. A preset places the microphones of the technique (here *Glyn Johns*).

   ![Technique Glyn Johns](bilder/en/werkzeuge-planen-23-drum-technik.jpg)

2. Clicking a zone shows its microphones on the right. Adding a mic puts one in, *— pick microphone —* assigns it a model (dynamic, condenser and ribbon microphones of common makers), the bin removes it.

   ![Zone Kick with a microphone](bilder/en/werkzeuge-planen-24-drum-zone.jpg)

3. On the right are also *Subsnake* (the stage box size: 8, 12, 16, 24 or 32 in), *Patch list* and *Labels* (output of the channel list and of the labels) and *Channel list & requirements* with the number of channels, of 48 V channels and of channels without a microphone. The material list names microphones, XLR cables, stands and rim clamps and can be copied to the clipboard.

   ![Channel list and material list](bilder/en/werkzeuge-planen-25-drum-mikro-dazu.jpg)

4. *Edit kit* opens the kit editor: move, rename and delete zones in the picture and add new zones (kick, snare, tom, hi-hat, ride, crash, overhead, room). *Kit done* ends editing.

   ![Building the kit](bilder/en/werkzeuge-planen-28-drum-kit-bearbeiten.jpg)

5. *Full Close* places all drums, overheads and room microphones: twelve channels.

   ![Full Close](bilder/en/werkzeuge-planen-31-drum-full-close.jpg)

If the plan lacks mic inputs for the kit, the [Plan check](#plan-check-dialog) reports it.

#### Wireless / vocals

*Tools → Wireless / vocals…* plans wireless microphones and checks their frequencies. The header has the channel add button, the number of channels, the number of RF conflicts, the selection *— country —* (Germany, Austria, Switzerland, Netherlands, France, USA) with the button *Frequency table*, *CSV* and *Print / PDF*. Each channel has a row with:

| Column | Meaning |
|---|---|
| *Channel* | Name of the channel. |
| *Transmitter (body)* | Handheld or bodypack transmitter (for example Shure AD2, ULXD2, QLXD2, Sennheiser SKM 6000, SK 6000). |
| *Capsule / headset* | The capsules compatible with the transmitter; a tick shows that the combination fits. |
| *Band* | The frequency band of the device; the selection can be narrowed by country. |
| *Frequency (MHz)* | The carrier frequency. |
| *Bandwidth (kHz)* | The occupied bandwidth. |

The box *RF coordination — conflicts* lists what does not fit: *spacing* (carriers too close, spacing smaller than the bandwidth) and *IMD3·3* or *IMD3-2* (third-order intermodulation with three or two transmitters). Carrier spacing and intermodulation are checked. The plan is included: radio links from the plan, such as camera wireless or WLAN, appear too.

![Wireless / vocals](bilder/en/werkzeuge-planen-35-funk-offen.jpg)

![Channel created](bilder/en/werkzeuge-planen-36-funk-kanal.jpg)

![Transmitter and capsule chosen](bilder/en/werkzeuge-planen-38-funk-kapsel.jpg)

![Frequency entered](bilder/en/werkzeuge-planen-39-funk-frequenz.jpg)

##### Mic plot

The section *Mic plot — who wears which channel* records for each session who wears which link. The channel plan above belongs to the production; who wears which link changes with each performance — that is what this section is for.

| Control | Effect |
|---|---|
| *Session* (selection) and add session | Picks or creates a session. |
| Take over from the previous one | Takes over the assignments of the previous session; they count as unconfirmed for today. |
| *Session sheet* | Exports the sheet of the session. |
| Add person | Adds a row with *Person*, *Role*, *Channel*, *Transmitter* and *Battery fitted*. |

The app points out gaps: when the battery change was not recorded, and two people on the same channel.

![Mic plot, person created](bilder/en/werkzeuge-planen-43-funk-person-daten.jpg)

![Two people on one channel](bilder/en/werkzeuge-planen-44-funk-person-doppelt.jpg)

![Second session with takeover](bilder/en/werkzeuge-planen-47-funk-uebernehmen.jpg)

#### Rundown and camera assignments

*Tools → Rundown and camera assignments…* reads the editorial rundown and gives each camera position an assignment per segment. The rundown belongs to the editorial team and is only read here.

1. Enter the origin (for example "ablauf.xlsx, mail of 9 Sept.") and *Version of the source* (for example "v4").

   ![Origin and version](bilder/en/werkzeuge-planen-49-ablauf-herkunft.jpg)

2. Paste the rundown into the text field — per line number, title and note, separated by tab or semicolon — and click *Read in*.

   ![Rundown pasted](bilder/en/werkzeuge-planen-50-ablauf-text.jpg)

3. The result names the number of segments with origin and version. Lines that cannot be read are reported by the app and not taken over.

   ![Rundown read in](bilder/en/werkzeuge-planen-51-ablauf-eingelesen.jpg)

4. The table *Who does what* has a column per camera position for each segment. Enter the assignments (for example "Wide", "Close presenter"). The assignment hangs on the role, not on the device — if the spare camera steps in, it stays. The line below counts the assignments per camera.

   ![Assignments entered](bilder/en/werkzeuge-planen-52-ablauf-auftrag.jpg)

5. When the rundown is read in again, the assignments of matching segments are kept.

   ![Read in again](bilder/en/werkzeuge-planen-54-ablauf-neu-einlesen.jpg)

#### Delivery

*Tools → Delivery (streaming destinations)…* records where the programme goes out, with which parameters and which path is the fallback path. At the top are *CSV*, *Run sheet* and *Delivery path*; the dialog is one long scrolling sheet. Without a destination it reads *No delivery destination yet. Add one.* with *Add destination*.

![Delivery without a destination](bilder/en/werkzeuge-planen-55-ausspielung-offen.jpg)

The sheet has these sections:

| Section | Content |
|---|---|
| *Independent archive recording* | The question where the archive recording lives: *— not answered yet —*, *on this device* (then with a device choice and a remark) or *deliberately none*. Unanswered, it is an open question, not a warning about a device. *Sheet* exports the archive sheet. |
| *Event details* | Title, *Visibility* (*public*, *unlisted*, *private*; there is no default), start, time zone, thumbnail, tags, description. Below, deliberate deviations per destination (empty means "as on the project"; a deviation needs a reason). |
| *Transmission record* | What the broadcast did, as far as someone wrote it down: add an *Entry* (start, end, dropout, degradation, switchover, back to normal, change during the broadcast, observation) with time, destination and origin (*seen*, typed from a log, reported), a summary for the client (deliberately by hand) and *Sheet*. |
| *Fallback behaviour (safety net)* | Which device runs the watchdog (*Watchdog runs on*), the statistics source and the scenes in the encoder (*Apply*); per destination *Normal*, *Low bitrate*, *Offline* and thresholds. *Sheet* and *Skeleton* write the documents. |
| *Uplink (Mbit/s)* | The available uplink; the line sets planned against usable kbit/s (after 40 % headroom). |
| Destinations | Per destination platform (*YouTube Live*, *Twitch*, own destination), transport (*RTMP*, *SRT*, *HLS*), encoder (a device of the plan) and path (own path or a fallback path), the address, the *Stream key* (*Save key* stores it in the keychain; it is not in the project), width, height, fps, video kbit/s, keyframe interval, audio, codec and for SRT mode and measured RTT with the recommended latency. For control of the encoder, give OSC address, Companion page and slot. |

For each destination the app checks and reports, for example *No stream key stored*, a bitrate above the platform limit, or *No fallback path*.

![Destination added](bilder/en/werkzeuge-planen-56-ausspielung-ziel.jpg)

![Destination with SRT and latency](bilder/en/werkzeuge-planen-60-ausspielung-srt-rtt.jpg)

![Encoder chosen](bilder/en/werkzeuge-planen-61-ausspielung-encoder.jpg)

![Stream key stored](bilder/en/werkzeuge-planen-63-ausspielung-schluessel.jpg)

![Companion control](bilder/en/werkzeuge-planen-64-ausspielung-osc.jpg)

![Uplink changed](bilder/en/werkzeuge-planen-67-ausspielung-uplink.jpg)

![Archive recording on this device](bilder/en/werkzeuge-planen-68-ausspielung-archiv.jpg)

![Transmission record with an entry](bilder/en/werkzeuge-planen-70-ausspielung-sendebericht.jpg)

![Fallback behaviour](bilder/en/werkzeuge-planen-71-ausspielung-ausweich.jpg)
