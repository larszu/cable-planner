export default function DeviceLibraryPage() {
  return (
    <>
      <h1>Device Library</h1>

      <h2>Built-in templates</h2>
      <p>
        The device library sidebar contains <strong>2,000+ real-world device templates</strong> drawn from the
        community device library — switchers, routers, audio consoles, mixing consoles, microphones, intercom, KVM
        extenders, lighting, LED processors, media servers, and many more. Templates are fetched live from the
        community database when you're online, with a bundled subset shipped with the app for offline use.
      </p>
      <p>
        Browse the full live library — including category breakdowns and search — at{" "}
        <a href="https://devices.easyschematic.live" target="_blank" rel="noopener noreferrer">
          devices.easyschematic.live
        </a>
        .
      </p>

      <h2>Using templates</h2>
      <ol>
        <li><strong>Search</strong> by typing in the search box — multi-word queries are scored and ranked, with favorites boosted to the top</li>
        <li><strong>Drag</strong> a template from the library onto the canvas</li>
        <li>The device appears with pre-configured ports matching the real hardware</li>
      </ol>
      <p>
        Templates provide sensible defaults — the right signal types, port labels, and I/O configuration for each
        device type.
      </p>

      <h2>User templates</h2>
      <p>After editing a device's ports and configuration:</p>
      <ol>
        <li><strong>Double-click</strong> the device to open the editor</li>
        <li>Configure ports, labels, and signal types as needed</li>
        <li>Click <strong>Save as User Template</strong> at the bottom of the editor</li>
        <li>The template appears in a "User Templates" category in the library</li>
      </ol>
      <p>User templates persist in your browser's localStorage.</p>

      <h2>Favorites</h2>
      <p>
        Star any device template in the library to mark it as a favorite. Favorites are pinned to
        the top of the sidebar in their own <strong>Favorites</strong> category and are boosted to the
        top of search results.
      </p>
      <ul>
        <li>Click the <strong>star icon</strong> on any library item to toggle favorite status</li>
        <li>Favorites are saved in your schematic file and persist across sessions</li>
      </ul>

      <h2>Template presets</h2>
      <p>
        Presets let you save a device configuration as the <strong>project-wide default</strong> for
        that template. Every new placement of that device will automatically apply the preset
        configuration.
      </p>
      <ol>
        <li>Edit a device's ports, labels, or signal types</li>
        <li>Click <strong>Save as Preset</strong> in the device editor</li>
        <li>The library shows a <strong>preset badge</strong> on that template</li>
      </ol>
      <p>
        When editing a device that has a preset, a blue banner shows the active preset with
        a <strong>Clear</strong> button. If the device's configuration has drifted from the preset,
        you'll see <strong>Revert to Preset</strong> and <strong>Revert to Template</strong> buttons
        to restore either baseline.
      </p>

      <h2>Auto-numbering</h2>
      <p>
        When you place multiple instances of the same device template, EasySchematic automatically numbers them:
        "Camera 1", "Camera 2", etc. Renaming a device manually removes it from auto-numbering.
      </p>

      <h2>Quick-create routers</h2>
      <p>
        Need a matrix router with specific I/O counts? Type <strong>"router"</strong> in the device library search
        to reveal the <strong>Create Custom Router</strong> button. This opens a dialog where you can:
      </p>
      <ul>
        <li>Set a <strong>device name</strong> and device type</li>
        <li>Define <strong>input and output sections</strong> — each section has a name, port prefix, count, and signal type</li>
        <li>Add multiple sections per side (e.g., 16 SDI inputs + 4 HDMI inputs + 16 SDI outputs + 4 HDMI outputs)</li>
        <li>The router is placed on the canvas and saved as a user template</li>
      </ul>

      <h2>Expansion slots</h2>
      <p>
        Some devices have <strong>expansion slots</strong> — swappable card bays that accept different I/O cards.
        This mirrors how real hardware works: a video router chassis might ship with empty slots that you populate
        with SDI, HDMI, or fiber cards depending on the job.
      </p>
      <ul>
        <li><strong>Right-click a slot</strong> on a device to see available cards and swap one in</li>
        <li>Each card contributes its own ports to the parent device</li>
        <li>Slots show the currently installed card name (or "Empty" if unoccupied)</li>
        <li>Swapping a card removes the old card's ports and adds the new card's ports</li>
      </ul>

      <h2>Community device database</h2>
      <p>
        The <a href="https://devices.easyschematic.live" target="_blank" rel="noopener noreferrer">community device database</a> lets
        anyone browse, search, and contribute device templates.
      </p>
      <ul>
        <li><strong>Submit new devices</strong> — log in with your email, fill out the device form with ports and specs,
          and include a reference URL to the manufacturer's product page</li>
        <li><strong>Suggest edits</strong> — see a mistake or missing port? Propose changes to any existing template</li>
        <li><strong>Moderation</strong> — submissions are reviewed by moderators before going live to ensure accuracy</li>
        <li><strong>Reference URLs</strong> — branded devices link directly to the manufacturer's product page so
          moderators (and you) can verify specs</li>
        <li><strong>Contributor credit</strong> — approved submissions are attributed to you on the device page and
          the contributors hall of fame</li>
        <li><strong>Submit from the app</strong> — right-click any custom device on the canvas and choose
          "Submit to Community" to submit it directly without re-entering the details on the devices site</li>
        <li><strong>Clone from an existing device</strong> — on the devices site, the "Submit a device" form has a
          <em>Clone existing device</em> option; pick any current template and the form prefills with its ports,
          connectors, and metadata. Tweak what's different (a sibling model, a regional variant) and submit — the
          moderation queue gets a much cleaner diff than a freshly typed-out form</li>
      </ul>
    </>
  );
}
