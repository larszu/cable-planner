## Collaboration

Several people can work on one plan. The app has two ways for it: **live collaboration**, where everyone edits the same plan at the same time, and the **sync directory**, through which a plan is handed on in turns. This chapter describes how to use both. All fields of the settings are described in the chapter [Settings](#13-settings), tab *Network sync*.

| Way | When | Working at the same time |
|---|---|---|
| Live collaboration | Everyone is at the plan right now: in the same set of windows, on the same network or over the internet. | yes |
| Sync directory | The plan travels through a network folder from person to person. | no, one person at a time |

### Live collaboration

The changes of all participants are merged without a server, even after a short disconnect. The function is marked *beta*. It is under *Settings → Network sync*.

#### Starting a session

1. Open *Settings → Network sync*. The box *Live collaboration (beta)* shows the state *Off* at the top right.
2. Under *Your display name* enter how the others see you, and under *Room name* a name for the session, for example `show-2026`. The room name is required: without it *Start session* stays disabled.

   ![Name and room entered](bilder/en/zusammenarbeit-02-name-und-raum.jpg)

3. Under *Mode*, choose where the others sit:

   - *This device (multiple windows)*: only windows on this computer.
   - *Network (LAN/WAN, P2P)*: other computers, on the same network or over the internet. This mode additionally shows *Signaling server*, *Local only*, *Room password (optional)* and *STUN/TURN servers (optional)*; the fields are explained in the chapter [Settings](#13-settings).

   ![Mode Network](bilder/en/zusammenarbeit-04-modus-netzwerk.jpg)

   In the mode *Network* without a *Room password* the app warns in red: the room is then unencrypted, and anyone who knows the room name and the signaling server or finds the session on the LAN can read the entire project. Set a password and give it only to your team.

4. *Start session* opens the session. The box shows *Connected — changes are shared live*, below it the participants as coloured circles with initials. As long as you are alone, it says *Only you in the room* and the note that others join by using the same room name.

   ![Running session](bilder/en/zusammenarbeit-06-sitzung-laeuft.jpg)

While the session runs, *Mode* and *Room name* are locked.

#### The state in the status bar

As long as a session runs, the green mark *Live · n* is in the status bar at the bottom; *n* is the number of participants. A click on it opens *Settings → Network sync* with participants and invitation.

![Status bar with the mark Live](bilder/en/zusammenarbeit-08-statusleiste-live.jpg)

![A click on Live opens the tab](bilder/en/zusammenarbeit-09-statusleiste-klick.jpg)

#### Joining

There are two ways to join a running session. In both cases **joining replaces your current plan with the host's**; if a plan is already in the window, the app asks first (*Join and replace*).

- **Search the network** (desktop app only): the box *Sessions on the network* has the button *Search the network*. It searches the local network for running sessions. Each one found appears in the list with project name, host and room and has a button *Join*. Without a hit it says *No open session found yet.*

  ![Search of the network without a hit](bilder/en/zusammenarbeit-03-suche-im-netz.jpg)

- **Invitation link**: in the running session the host clicks *Copy invite*; the button briefly reads *Copied*. The clipboard then holds the line *Join the LZ Cable Planner live session:* and a link. Room, mode, signaling server and password are encoded in the part of the link after `#join=`, which is not sent to a server. A room password that is set is in the link as well; hand it on to your team only. Whoever opens the link sees *Join live session “room · host”? Your current plan will be replaced by the host’s.* and joins with *Join*. STUN/TURN credentials are not in the link.

  ![Invitation copied](bilder/en/zusammenarbeit-07-einladung-kopiert.jpg)

#### Leaving the session

*Leave* (red button in the box) ends your participation. The state goes back to *Off*, the fields are free again, and the mark *Live* disappears from the status bar.

![After leaving](bilder/en/zusammenarbeit-10-verlassen.jpg)

### Sync directory

A shared directory (mounted FTP drive, network path or local folder) carries project, library and presets as JSON files. This way needs the desktop app and has no simultaneous working: whoever writes locks the directory.

1. In *Settings → Network sync* enter the *Sync directory* and your *User name (for lock display)* and save.
2. *Push* and *Pull* appear in the top bar.

   ![Push and Pull in the top bar](bilder/en/zusammenarbeit-12-push-pull-kopfleiste.jpg)

3. *Push* writes your state into the directory: `cable-planner.project.json`, `cable-planner.library.json` and `cable-planner.presets.json`. *Pull* loads these files into your current state. The message says what was loaded (project, library, presets), or that no sync files are in the directory.
4. A lock file prevents two people from writing at the same time. If the directory is locked, the message says *Directory is locked by: name*. The lock expires after two hours.

*Sync library now* also compares device templates, groups and categories with `cable-planner.library.json` in the directory, by name; local templates are never overwritten.

### Other ways to share a plan

- The plan as a file: *File → Export whole project (.avplan)…* and on the other side *File → Open…*, described in the chapter [File and Import](#8-file-and-import).
- A phone on the same network: *Phone access* shows the patch list and plug check, described in the chapter [Web edition and tablet](#15-web-edition-and-tablet).
- The report back to Rentman: [Export & Print](#9-export--print).
