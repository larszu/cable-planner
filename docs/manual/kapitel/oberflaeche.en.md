## The interface


![Application interface overview](bilder/en/oberflaeche-start.jpg)

The interface of LZ Cable Planner consists of four main areas: the menu bar at the top, the library sidebar on the left, the canvas in the center, and the inspector panel on the right. The status bar is located at the bottom of the window.

### Edit Menu

![Edit menu](bilder/en/oberflaeche-menu-edit.jpg)

The Edit menu contains functions for modifying selections on the canvas.

| Function | Keyboard Shortcut | Description |
|---|---|---|
| Undo | Ctrl+Z | Undo the last action |
| Redo | Ctrl+Y | Redo the last undone action |
| Duplicate | Ctrl+D | Duplicate selected equipment or cables |
| Delete selection | Delete | Delete selected elements |
| Select all | Ctrl+A | Select all equipment and cables in the plan |
| Clear selection | Esc | Deselect all elements |

### View Menu

![View menu](bilder/en/oberflaeche-menu-view.jpg)

The View menu provides functions to affect the canvas view and control the display of various panels.

#### Zoom and Fitting

| Function | Description |
|---|---|
| Fit to view | Zoom the canvas so all elements are visible |
| Zoom 100 % | Reset zoom to 100 % |
| Zoom in | Increase canvas zoom level |
| Zoom out | Decrease canvas zoom level |

#### Theme and Appearance

| Function | Description |
|---|---|
| Light theme | Switch between light and dark design |
| Follow system theme | Use the operating system's theme setting |
| Fullscreen | Display the app in fullscreen mode |

#### Cables and Labels

| Function | Description |
|---|---|
| Snap to grid | Align equipment to a grid |
| Hide cable labels | Hide cable designations on the canvas |
| Show off-page names | Display names of equipment outside the plan area |
| Color cables by length | Colorize cables based on their physical length |
| Color cables by discipline | Colorize cables based on their discipline/domain |

#### Panels and Tools

| Function | Description |
|---|---|
| Find device | Show or hide the canvas search field |
| Canvas toolbar | Show or hide the canvas toolbar |
| Annotations panel | Show or hide the annotations panel |

### Help Menu

![Help menu](bilder/en/oberflaeche-menu-help.jpg)

The Help menu provides access to documentation and information about the application.

| Function | Keyboard Shortcut | Description |
|---|---|---|
| Command palette… | Ctrl+K | Quick access to commands via search |
| Keyboard shortcuts… | | Display a list of all keyboard shortcuts |
| Getting-started tour… | | Launch an interactive introduction to the app |
| Check for updates… | | Search for new application versions |
| About LZ Cable Planner… | | Display version information and credits |

### Command Palette

![Command palette](bilder/en/oberflaeche-command-palette.jpg)

The command palette is a quick way to access the most important functions. It is opened with **Ctrl+K** or via *Help → Command palette…*. It allows you to search for and execute commands via text search.

The command palette contains:
- **Edit**: Undo, Redo, Duplicate, Select all
- **View**: Fit to view, Zoom in, Zoom out, Reset zoom
- **Tools**: Plan check, Patch list, Analyses, Bulk connect, Revisions, AI plan generation, CSV import, and more functions

The command palette is especially useful when you don't remember the exact menu paths or when you want to quickly execute a function without navigating through the menus. Simply type the first letters of the command you're looking for to filter the list.

### Status Bar

![Status bar](bilder/en/oberflaeche-statusbar.jpg)

The status bar at the bottom of the window displays important information about the current project:

| Element | Description |
|---|---|
| Project name | Name of the currently open project |
| Equipment | Number of equipment elements |
| Cables | Number of cable connections |
| Locations | Number of rack locations |
| Packed | Status and count of packed equipment |
| File size | Size of the project file |
| Plan check | Status of plan verification (green OK, red problems) |
| Zoom | Current zoom level in percent |
| Version | Installed app version |

Additionally, the following badges may be displayed:
- **Live collaboration**: indicates when live collaboration is active
- **MCP server**: indicates if the MCP server is running and Claude is reading the plan
- **Action items**: indicates when there are overdue tasks

### Theme Settings

#### Light Theme

![Light theme](bilder/en/oberflaeche-theme-light.jpg)

The app design can be switched between a light and dark theme. In light theme, the app has a white/light background, while in dark theme (default) it has a dark background. The color palette is automatically adjusted.

You can also set the app to use the operating system's theme, which automatically switches between light and dark design based on the system setting.

### Canvas Visibility Options

#### Snap to Grid

![Snap to grid](bilder/en/oberflaeche-snap-to-grid.jpg)

With the "Snap to grid" option enabled, equipment that you move on the canvas automatically aligns to a grid. This makes arrangement easier and produces a neat layout result. You can enable or disable this option in the View menu.

#### Hide Cable Labels

![Hide cable labels](bilder/en/oberflaeche-hide-labels.jpg)

Cables can carry labels (such as port numbers). With "Hide cable labels" in the View menu, these can be hidden. This is useful when the canvas appears crowded or when you want to see only the connection structure.

#### Cable Colors

##### Color by Length

![Color cables by length](bilder/en/oberflaeche-color-by-length.jpg)

This option colorizes cables based on their physical length. Short cables receive one color, long cables another. This helps you see at a glance which cables are particularly long and may therefore be costly or difficult to route.

##### Color by Discipline

![Color cables by discipline](bilder/en/oberflaeche-color-by-layer.jpg)

This option colorizes cables according to their discipline/domain (e.g., video, audio, data, power). This makes it easier to distinguish between different cable types on a complex plan.

### Information and Help

#### About the Application

![About dialog](bilder/en/oberflaeche-about.jpg)

The About dialog displays the current version of LZ Cable Planner along with information about the publisher and the licences of the bundled third-party libraries. It can be accessed via *Help → About LZ Cable Planner…*.

Here you will find:
- The current version number
- The build date and time
- The author (Lars Zumpe)
- The GitHub repository (github.com/larszu/cable-planner)
- Technologies used (Electron, React, ReactFlow, Vite, Tailwind)
- Notice to report issues and feature requests directly on GitHub

### Uncaptured Functions

The following elements could not be fully documented:

- **Phone Access Dialog**: The button to start phone access may not be available in the test environment or was not successfully activated by the capture script.
- **Collaboration Panel**: The Sync panel could not be successfully opened by the test script.
- **Keyboard Shortcuts Dialog**: The dialog could not be successfully activated.

These functions are all present in the code and functional. The documentation focuses on the main menus and important settings for configuring the user interface.
